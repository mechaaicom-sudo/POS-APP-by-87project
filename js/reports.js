/* ============================================================
   reports.js — laporan shift kasir (open/close saat login-logout)
   ============================================================ */
const Reports = {
  render() {
    const shifts = DB.get('shifts', []);
    const trxs = DB.get('transactions', []);
    const user = Auth.current();
    const isOwner = Auth.isOwner();
    const today = UI.todayStr();

    let list = shifts.slice();
    if (!isOwner) list = list.filter(s => s.username === user.username);
    list.sort((a, b) => new Date(b.start) - new Date(a.start));

    const paid = t => t.training !== true && t.status !== 'refunded'; /* pelatihan/retur tidak dihitung */
    const todayShifts = list.filter(s => String(s.start).slice(0, 10) === today);
    const todayTrx = trxs.filter(t => todayShifts.some(s => s.id === t.shiftId) && paid(t));
    const revenue = todayTrx.reduce((x, t) => x + t.total, 0);
    const cashiers = new Set(todayShifts.map(s => s.username)).size;
    const expensesToday = this.expenses().filter(e => String(e.date).slice(0, 10) === today);
    const expTotal = expensesToday.reduce((x, e) => x + e.amount, 0);

    document.getElementById('rep-stats').innerHTML =
      Dashboard.statCard('🕐', 'violet', I18n.t('rep.todayShifts'), String(todayShifts.length), '') +
      Dashboard.statCard('💵', 'green', I18n.t('rep.totalRevenue'), UI.money(revenue), '') +
      Dashboard.statCard('🧑‍💼', 'blue', I18n.t('rep.activeCashiers'), String(cashiers), '') +
      Dashboard.statCard('💰', 'orange', I18n.t('exp.net'), UI.money(revenue - expTotal), UI.esc(expTotal > 0 ? '− ' + UI.money(expTotal) + ' ' + I18n.t('exp.expenses').toLowerCase() : ''));

    this.renderTable(list, trxs);
    this.renderExpenses();
  },

  /* ---------- pengeluaran & laba bersih ---------- */
  expenses() {
    return DB.get('expenses', []);
  },

  saveExpenses(list) {
    DB.set('expenses', list);
  },

  renderExpenses() {
    const tbody = document.getElementById('expenses-tbody');
    const empty = document.getElementById('expenses-empty');
    if (!tbody) return;

    const list = this.expenses().slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    if (!list.length) {
      tbody.innerHTML = '';
      if (empty) {
        empty.classList.remove('hidden');
        empty.textContent = I18n.t('exp.empty');
      }
      return;
    }
    if (empty) empty.classList.add('hidden');

    tbody.innerHTML = list.map(e =>
      '<tr>' +
      '<td>' + UI.esc(UI.fmtDateTime(e.date)) + '</td>' +
      '<td><strong>' + UI.esc(e.note) + '</strong></td>' +
      '<td>' + UI.esc(e.user || '—') + '</td>' +
      '<td class="num"><strong>' + UI.money(e.amount) + '</strong></td>' +
      '<td class="num" style="white-space:nowrap">' +
      '<button class="icon-btn danger" data-exp="' + UI.esc(e.id) + '" title="' + I18n.t('exp.delete') + '">🗑️</button>' +
      '</td>' +
      '</tr>'
    ).join('');

    if (!this._expBound) {
      this._expBound = true;
      document.getElementById('btn-toggle-exp').addEventListener('click', () => {
        const form = document.getElementById('exp-form');
        form.classList.toggle('hidden');
        if (!form.classList.contains('hidden')) document.getElementById('exp-note').focus();
      });
      document.getElementById('btn-save-exp').addEventListener('click', () => this.addExpense());
      tbody.addEventListener('click', e => {
        const btn = e.target.closest('[data-exp]');
        if (!btn) return;
        this.confirmDeleteExpense(btn.getAttribute('data-exp'));
      });
    }
  },

  async addExpense() {
    const note = document.getElementById('exp-note').value.trim();
    const amount = Math.floor(Number(document.getElementById('exp-amount').value));
    if (!note || !(amount >= 0)) {
      UI.toast(I18n.t('exp.noteRequired'), 'error');
      return;
    }
    const me = Auth.current();
    const list = this.expenses();
    list.unshift({
      id: 'EXP-' + Date.now().toString(36).toUpperCase(),
      date: new Date().toISOString(),
      note,
      amount,
      user: me ? (me.name || me.username) : '—'
    });
    this.saveExpenses(list);
    document.getElementById('exp-note').value = '';
    document.getElementById('exp-amount').value = '';
    this.render();
    UI.toast(I18n.t('exp.saved'), 'success');
  },

  async confirmDeleteExpense(id) {
    const e = this.expenses().find(x => x.id === id);
    if (!e) return;
    const ok = await UI.confirm(I18n.t('exp.deleteMsg', { note: e.note, amt: UI.money(e.amount) }), {
      title: I18n.t('exp.delete'), confirmText: I18n.t('common.delete'), danger: true
    });
    if (!ok) return;
    this.saveExpenses(this.expenses().filter(x => x.id !== id));
    this.render();
    UI.toast(I18n.t('exp.deleted'), 'success');
  },

  renderTable(list, trxs) {
    const tbody = document.getElementById('reports-tbody');
    const empty = document.getElementById('reports-empty');
    if (!list.length) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
      empty.textContent = I18n.t('rep.emptyList');
      return;
    }
    empty.classList.add('hidden');

    tbody.innerHTML = list.map(s => {
      const shiftTrx = trxs.filter(t => t.shiftId === s.id && t.status !== 'refunded');
      const total = shiftTrx.reduce((x, t) => x + t.total, 0);
      const open = !s.end;
      const endStr = open
        ? '<span class="badge badge-low">' + I18n.t('rep.open') + '</span>'
        : UI.esc(UI.fmtDateTime(s.end));
      return '' +
        '<tr>' +
        '<td><strong>' + UI.esc(s.name || s.username) + '</strong>' +
        (open ? '' : '') +
        '</td>' +
        '<td>' + UI.esc(UI.fmtDateTime(s.start)) + '</td>' +
        '<td>' + endStr + '</td>' +
        '<td>' + UI.esc(this.duration(s)) + '</td>' +
        '<td class="num">' + shiftTrx.length + '</td>' +
        '<td class="num"><strong>' + UI.money(total) + '</strong></td>' +
        '<td class="num" style="white-space:nowrap">' +
        '<button class="icon-btn" data-shift="' + UI.esc(s.id) + '" title="' + I18n.t('rep.detail') + '">👁️</button>' +
        '</td>' +
        '</tr>';
    }).join('');

    if (!this._bound) {
      this._bound = true;
      tbody.addEventListener('click', e => {
        const btn = e.target.closest('[data-shift]');
        if (!btn) return;
        this.showDetail(btn.getAttribute('data-shift'));
      });
    }
  },

  duration(s) {
    const end = s.end ? new Date(s.end) : new Date();
    const ms = Math.max(0, end - new Date(s.start));
    const mins = Math.floor(ms / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return (h > 0 ? h + 'j ' : '') + m + 'm';
  },

  showDetail(shiftId) {
    const shift = DB.get('shifts', []).find(s => s.id === shiftId);
    if (!shift) return;
    const trxs = DB.get('transactions', []).filter(t => t.shiftId === shiftId);
    const total = trxs.filter(t => t.status !== 'refunded').reduce((x, t) => x + t.total, 0);

    const rows = trxs.map(t =>
      '<tr>' +
      '<td><strong>' + UI.esc(t.id) + '</strong>' +
      (t.status === 'refunded' ? ' <span class="badge badge-out" title="' + I18n.t('his.refunded') + '">↩️</span>' : '') +
      '</td>' +
      '<td>' + UI.esc(UI.fmtDateTime(t.date)) + '</td>' +
      '<td class="num">' + t.items.reduce((x, i) => x + i.qty, 0) + '</td>' +
      '<td class="num"' + (t.status === 'refunded' ? ' style="opacity:.55;text-decoration:line-through"' : '') + '>' + UI.money(t.total) + '</td>' +
      '</tr>'
    ).join('');

    UI.modal(
      '<div class="modal-head"><h3>' + I18n.t('rep.detail') + '</h3>' +
      '<button class="icon-btn" data-xclose>✕</button></div>' +
      '<div class="modal-body">' +
      '<div class="muted" style="font-size:13px">' +
      UI.esc(shift.name || shift.username) + ' · ' +
      UI.esc(UI.fmtDateTime(shift.start)) + ' → ' + (shift.end ? UI.esc(UI.fmtDateTime(shift.end)) : '<span class="badge badge-low">' + I18n.t('rep.open') + '</span>') +
      ' · ' + UI.esc(this.duration(shift)) +
      '</div>' +
      (trxs.length
        ? '<div class="table-wrap" style="max-height:300px;overflow-y:auto">' +
          '<table><thead><tr><th>' + I18n.t('his.id') + '</th><th>' + I18n.t('his.date') + '</th><th class="num">' + I18n.t('rep.trxCount') + '</th><th class="num">' + I18n.t('rep.total') + '</th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table></div>'
        : '<div class="empty">' + I18n.t('rep.noData') + '</div>') +
      '<div class="ct-row grand"><span>' + I18n.t('rep.total') + '</span><span class="value">' + UI.money(total) + '</span></div>' +
      '</div>' +
      '<div class="modal-foot">' +
      '<button class="btn btn-secondary" data-xclose2>' + I18n.t('common.close') + '</button>' +
      '</div>',
      { large: true }
    );
    const m = document.getElementById('modal-root');
    m.querySelector('[data-xclose]').onclick = () => UI.closeModal();
    m.querySelector('[data-xclose2]').onclick = () => UI.closeModal();
  }
};