/* ============================================================
   history.js — riwayat transaksi
   ============================================================ */
const History = {
  state: { search: '' },

  render() {
    const searchEl = document.getElementById('his-search');
    searchEl.value = this.state.search;
    this.renderTable();
    if (!this._bound) {
      this._bound = true;
      searchEl.addEventListener('input', e => {
        this.state.search = e.target.value.toLowerCase();
        this.renderTable();
      });
      document.getElementById('btn-clear-filter').addEventListener('click', () => {
        this.state.search = '';
        this.render();
      });
      const tbody = document.getElementById('history-tbody');
      tbody.addEventListener('click', e => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        if (btn.getAttribute('data-action') === 'view') this.showDetail(id);
        if (btn.getAttribute('data-action') === 'print') {
          const trx = DB.get('transactions', []).find(t => t.id === id);
          if (trx) Receipt.print(trx);
        }
      });
    }
  },

  filtered() {
    let list = DB.get('transactions', []);
    if (this.state.search) {
      const q = this.state.search;
      list = list.filter(t =>
        t.id.toLowerCase().includes(q) ||
        (t.cashier || '').toLowerCase().includes(q) ||
        UI.fmtDateTime(t.date).toLowerCase().includes(q)
      );
    }
    return list;
  },

  renderTable() {
    const tbody = document.getElementById('history-tbody');
    const empty = document.getElementById('history-empty');
    const rows = this.filtered();

    if (!rows.length) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
      empty.textContent = this.state.search ? I18n.t('his.notFound') : I18n.t('his.empty');
      return;
    }
    empty.classList.add('hidden');

    tbody.innerHTML = rows.map((t, idx) => {
      const itemCount = t.items.reduce((s, i) => s + i.qty, 0);
      const refunded = t.status === 'refunded';
      const isTraining = t.training === true;
      return '' +
        '<tr' + (refunded ? ' style="opacity:.65"' : '') + '>' +
        '<td>' + (idx + 1) + '</td>' +
        '<td><strong>' + UI.esc(t.id) + '</strong>' + (refunded ? ' <span class="badge badge-out" title="' + I18n.t('his.refunded') + '">↩️</span>' : '') + (isTraining ? ' <span class="badge badge-low" title="' + I18n.t('train.title') + '">🅿️</span>' : '') + '</td>' +
        '<td>' + UI.esc(UI.fmtDateTime(t.date)) + '</td>' +
        '<td>' + UI.esc(t.cashier) + '</td>' +
        '<td class="num">' + itemCount + '</td>' +
        '<td class="num"><strong>' + UI.money(t.total) + '</strong></td>' +
        '<td class="num" style="white-space:nowrap">' +
        '<button class="icon-btn" data-action="view" data-id="' + UI.esc(t.id) + '" title="' + I18n.t('his.view') + '">👁️</button> ' +
        '<button class="icon-btn" data-action="print" data-id="' + UI.esc(t.id) + '" title="🖨️">🖨️</button>' +
        '</td>' +
        '</tr>';
    }).join('');
  },

  showDetail(id) {
    const t = DB.get('transactions', []).find(x => x.id === id);
    if (!t) return;

    const rows = t.items.map(i =>
      '<tr>' +
      '<td>' + UI.esc(i.name) + '</td>' +
      '<td class="num">' + i.qty + ' × ' + UI.money(i.price) + '</td>' +
      '<td class="num">' + UI.money(i.price * i.qty) + '</td>' +
      '</tr>'
    ).join('');

    const refunded = t.status === 'refunded';

    UI.modal(
      '<div class="modal-head"><h3>' + I18n.t('his.detail') + '</h3>' +
      '<button class="icon-btn" data-xclose>✕</button></div>' +
      '<div class="modal-body">' +
      '<div class="muted" style="font-size:13px">' + UI.esc(t.id) + '<br>' + UI.esc(UI.fmtDateTime(t.date)) + ' · ' + UI.esc(t.cashier) +
      (refunded ? ' · <span class="badge badge-out">' + I18n.t('his.refunded') + '</span>' : '') + '</div>' +
      '<div class="table-wrap" style="max-height:280px;overflow-y:auto">' +
      '<table><thead><tr><th>' + I18n.t('product.name') + '</th><th class="num">' + I18n.t('rc.items') + '</th><th class="num">Total</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>' +
      '</div>' +
      '<div class="ct-row"><span>' + I18n.t('cash.subtotal') + '</span><span>' + UI.money(t.subtotal) + '</span></div>' +
      (t.discountAmount > 0 ? '<div class="ct-row"><span>' + I18n.t('cash.discount') + ' (' + t.discountPct + '%)</span><span>- ' + UI.money(t.discountAmount) + '</span></div>' : '') +
      '<div class="ct-row grand"><span>' + I18n.t('cash.total') + '</span><span class="value">' + UI.money(t.total) + '</span></div>' +
      '<div class="ct-row"><span>' + I18n.t('cash.checkout.cash') + '</span><span>' + UI.money(t.cash) + '</span></div>' +
      '<div class="ct-row"><span>' + I18n.t('cash.checkout.change') + '</span><span>' + UI.money(t.change) + '</span></div>' +
      '</div>' +
      '<div class="modal-foot">' +
      '<button class="btn btn-secondary" data-xclose2>' + I18n.t('common.close') + '</button>' +
      (refunded ? '' :
        '<button class="btn btn-danger" id="btn-refund">↩️ ' + I18n.t('his.refund') + '</button>') +
      '<button class="btn btn-primary" id="btn-reprint">🖨️ ' + I18n.t('cash.success.print') + '</button>' +
      '</div>',
      { large: true }
    );
    const m = document.getElementById('modal-root');
    m.querySelector('[data-xclose]').onclick = () => UI.closeModal();
    m.querySelector('[data-xclose2]').onclick = () => UI.closeModal();
    m.querySelector('#btn-reprint').onclick = () => { UI.closeModal(); Receipt.print(t); };
    const refundBtn = m.querySelector('#btn-refund');
    if (refundBtn) refundBtn.onclick = async () => {
      const ok = await UI.confirm(I18n.t('his.refundConfirm'), {
        title: I18n.t('his.refund'), confirmText: I18n.t('his.refund'), danger: true
      });
      if (ok) { UI.closeModal(); this.refund(id); }
    };
  },

  /* Retur transaksi: tandai status + kembalikan stok produk */
  async refund(id) {
    const trxs = DB.get('transactions', []);
    const t = trxs.find(x => x.id === id);
    if (!t) return;
    if (t.status === 'refunded') { UI.toast(I18n.t('his.alreadyRefunded'), 'error'); return; }

    t.status = 'refunded';
    t.refundedAt = new Date().toISOString();
    t.updatedAt = Date.now();
    DB.set('transactions', trxs);

    // kembalikan stok
    const products = Products.list();
    t.items.forEach(i => {
      const p = products.find(x => x.id === i.id);
      if (p) { p.stock = p.stock + i.qty; p.updatedAt = Date.now(); }
    });
    Products.saveAll(products);

    this.renderTable();
    UI.toast(I18n.t('his.refundedDone'), 'success');
  }
};