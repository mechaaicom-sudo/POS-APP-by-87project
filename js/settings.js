/* ============================================================
   settings.js — pengaturan toko, bahasa, manajemen pengguna,
   printer Bluetooth & sinkronisasi data
   ============================================================ */
const Settings = {
  render() {
    const s = DB.settings();
    document.getElementById('set-store-name').value = s.storeName || '';
    document.getElementById('set-store-address').value = s.storeAddress || '';
    document.getElementById('set-language').value = I18n.lang;

    const usersCard = document.getElementById('users-card');
    usersCard.classList.toggle('hidden', !Auth.isOwner());
    document.getElementById('bt-card').classList.toggle('hidden', !Bluetooth.available());
    document.getElementById('sync-card').classList.toggle('hidden', false);

    this.renderUsers();
    this.bind(false);
  },

  bind(force) {
    if (this._bound && !force) return;
    this._bound = true;

    document.getElementById('btn-save-store').onclick = () => {
      const name = document.getElementById('set-store-name').value.trim();
      const addr = document.getElementById('set-store-address').value.trim();
      const lang = document.getElementById('set-language').value;
      const s = DB.settings();
      if (!name) {
        UI.toast(I18n.t('common.required'), 'error');
        return;
      }
      s.storeName = name;
      s.storeAddress = addr;
      s.lang = lang;
      DB.saveSettings(s);
      document.getElementById('lang-select').value = lang;
      I18n.setLang(lang);
      App.refresh();
      UI.toast(I18n.t('common.saved'), 'success');
    };

    document.getElementById('btn-add-user').onclick = () => this.openUserForm();

    const tbody = document.getElementById('users-tbody');
    tbody.onclick = e => {
      const btn = e.target.closest('[data-action]');
      if (!btn || !Auth.isOwner()) return;
      const username = btn.getAttribute('data-id');
      if (btn.getAttribute('data-action') === 'pw') this.openPasswordForm(username);
      if (btn.getAttribute('data-action') === 'del') this.confirmDeleteUser(username);
    };

    document.getElementById('btn-reset-data').onclick = async () => {
      const ok = await UI.confirm(I18n.t('set.resetConfirm'), {
        title: I18n.t('set.danger'), confirmText: I18n.t('set.resetData'), danger: true
      });
      if (!ok) return;
      DB.reset();
      Auth.logout();
      window.location.reload();
    };

    // ---- Bluetooth ----
    const btCard = document.getElementById('bt-card');
    if (!btCard.classList.contains('hidden')) {
      document.getElementById('btn-bt-refresh').onclick = () => this.refreshBt();
      document.getElementById('btn-bt-save').onclick = () => this.saveBt();
      document.getElementById('btn-bt-test').onclick = () => this.testBt();
      this.refreshBt();
    }

    // ---- Sync ----
    const syncCard = document.getElementById('sync-card');
    if (!syncCard.classList.contains('hidden')) {
      document.getElementById('btn-sync-connect').onclick = () => this.connectSync();
      document.getElementById('btn-sync-disconnect').onclick = () => this.disconnectSync();
      this.renderSyncState();
    }
  },

  /* ---------- Bluetooth ---------- */
  async refreshBt() {
    const sel = document.getElementById('bt-device');
    const st = document.getElementById('bt-state');
    sel.innerHTML = '<option>' + I18n.t('common.loading') + '…</option>';
    try {
      const devices = await Bluetooth.listDevices();
      sel.innerHTML = devices.length
        ? devices.map(d => '<option value="' + UI.esc(d.address) + '">' + UI.esc(d.name || d.address) + '</option>').join('')
        : '<option>' + I18n.t('set.btNoDevices') + '</option>';
      const addr = Bluetooth.printerAddress();
      if (addr) sel.value = addr;
      st.textContent = I18n.t('set.btSaved') + (addr ? ' — ' + UI.esc(addr) : '');
      st.className = 'muted';
    } catch (e) {
      sel.innerHTML = '<option>' + I18n.t('set.btNoDevices') + '</option>';
      st.textContent = I18n.t('common.error') + ': ' + e.message;
      st.className = 'muted error';
    }
  },

  saveBt() {
    const addr = document.getElementById('bt-device').value;
    if (!addr) { UI.toast(I18n.t('common.required'), 'error'); return; }
    Bluetooth.savePrinter(addr);
    UI.toast(I18n.t('common.saved'), 'success');
    this.refreshBt();
  },

  async testBt() {
    const addr = Bluetooth.printerAddress();
    if (!addr) { UI.toast(I18n.t('bt.none'), 'error'); return; }
    const st = document.getElementById('bt-state');
    st.textContent = I18n.t('set.syncRunning');
    try {
      await Bluetooth.printLines(addr, Receipt.buildLines({
        id: 'TEST', date: new Date().toISOString(), cashier: 'TEST',
        items: [{ name: 'Test Item', price: 1000, qty: 1 }],
        subtotal: 1000, discountPct: 0, discountAmount: 0, total: 1000,
        cash: 1000, change: 0, storeName: DB.settings().storeName, storeAddress: DB.settings().storeAddress
      }));
      st.textContent = I18n.t('bt.sent'); st.className = 'muted success';
      setTimeout(() => this.refreshBt(), 2000);
    } catch (e) {
      st.textContent = I18n.t('bt.fail').replace('{err}', e.message); st.className = 'muted error';
    }
  },

  /* ---------- Sync ---------- */
  renderSyncState() {
    const st = document.getElementById('sync-state');
    const m = Sync.meta();
    if (!m.token) {
      st.textContent = I18n.t('set.syncNotConfigured'); st.className = 'muted';
    } else {
      const last = m.lastAt ? UI.fmtDateTime(new Date(m.lastAt).toISOString()) : I18n.t('set.syncNever');
      st.textContent = I18n.t('set.syncLast') + ': ' + last; st.className = 'muted success';
    }
  },

  async connectSync() {
    const url = document.getElementById('sync-url').value.trim();
    const user = document.getElementById('sync-user').value.trim();
    const pw = document.getElementById('sync-pass').value;
    const st = document.getElementById('sync-state');
    if (!url || !user || !pw) { UI.toast(I18n.t('common.required'), 'error'); return; }
    st.textContent = I18n.t('set.syncRunning');
    try {
      await Sync.login(url, user, pw);
      await Sync.syncAll();
      this.storeSyncForm();
      st.textContent = I18n.t('set.syncOk'); st.className = 'muted success';
      UI.toast(I18n.t('set.syncOk'), 'success');
      this.renderSyncState();
    } catch (e) {
      st.textContent = I18n.t('set.syncFail').replace('{err}', e.message); st.className = 'muted error';
      UI.toast(I18n.t('set.syncFail').replace('{err}', e.message), 'error');
    }
  },

  async disconnectSync() {
    Sync.disconnect();
    this.renderSyncState();
    UI.toast('Sinkronisasi diputus.', 'success');
  },

  storeSyncForm() {
    const s = DB.settings();
    s.syncUrl = document.getElementById('sync-url').value.trim();
    s.syncUser = document.getElementById('sync-user').value.trim();
    DB.saveSettings(s);
  },

  renderUsers() {
    const tbody = document.getElementById('users-tbody');
    const users = Auth.getUsers();
    const current = Auth.current();
    tbody.innerHTML = users.map(u => {
      const isSelf = current && current.username === u.username;
      return '' +
        '<tr>' +
        '<td><strong>' + UI.esc(u.username) + '</strong>' + (isSelf ? ' <span class="muted">(you)</span>' : '') + '</td>' +
        '<td>' + UI.esc(u.name || '—') + '</td>' +
        '<td><span class="badge badge-role' + (u.role === 'owner' ? ' owner' : '') + '">' + I18n.t('role.' + u.role) + '</span></td>' +
        '<td class="num">' +
        '<button class="icon-btn" data-action="pw" data-id="' + UI.esc(u.username) + '" title="🔑">🔑</button> ' +
        '<button class="icon-btn danger" data-action="del" data-id="' + UI.esc(u.username) + '" title="' + I18n.t('common.delete') + '">🗑️</button>' +
        '</td>' +
        '</tr>';
    }).join('');
  },

  openUserForm() {
    const form = UI.modal(
      '<div class="modal-head"><h3>' + I18n.t('set.userAdd') + '</h3>' +
      '<button class="icon-btn" data-xclose>✕</button></div>' +
      '<div class="modal-body">' +
      '<div class="form-grid">' +
      '<label class="field"><span>' + I18n.t('set.username') + ' *</span>' +
      '<input id="uf-username" class="input"></label>' +
      '<label class="field"><span>' + I18n.t('set.displayName') + '</span>' +
      '<input id="uf-name" class="input"></label>' +
      '</div>' +
      '<label class="field"><span>' + I18n.t('set.password') + ' *</span>' +
      '<input id="uf-password" class="input" type="password"></label>' +
      '<label class="field"><span>' + I18n.t('set.role') + ' *</span>' +
      '<select id="uf-role" class="select">' +
      '<option value="admin">' + I18n.t('role.admin') + '</option>' +
      '<option value="owner">' + I18n.t('role.owner') + '</option>' +
      '</select></label>' +
      '<p class="muted" style="font-size:12.5px">' + I18n.t('set.roleHint') + '</p>' +
      '</div>' +
      '<div class="modal-foot">' +
      '<button class="btn btn-secondary" data-xno>' + I18n.t('common.cancel') + '</button>' +
      '<button class="btn btn-primary" data-xsave>' + I18n.t('common.save') + '</button>' +
      '</div>'
    );

    form.querySelector('[data-xclose]').onclick = () => UI.closeModal();
    form.querySelector('[data-xno]').onclick = () => UI.closeModal();
    form.querySelector('[data-xsave]').onclick = () => {
      const username = form.querySelector('#uf-username').value.trim();
      const name = form.querySelector('#uf-name').value.trim();
      const password = form.querySelector('#uf-password').value.trim();
      const role = form.querySelector('#uf-role').value;
      if (!username || !password) {
        UI.toast(I18n.t('common.required'), 'error');
        return;
      }
      const users = Auth.getUsers();
      if (users.some(u => u.username === username)) {
        UI.toast(I18n.t('set.userExists'), 'error');
        return;
      }
      users.push({ username, name: name || username, password, role });
      Auth.setUsers(users);
      UI.closeModal();
      this.renderUsers();
      UI.toast(I18n.t('set.userAdded'), 'success');
    };
  },

  openPasswordForm(username) {
    const form = UI.modal(
      '<div class="modal-head"><h3>' + I18n.t('set.pwChange') + ' — ' + UI.esc(username) + '</h3>' +
      '<button class="icon-btn" data-xclose>✕</button></div>' +
      '<div class="modal-body">' +
      '<label class="field"><span>' + I18n.t('set.pwNew') + ' *</span>' +
      '<input id="pw-new" class="input" type="password"></label>' +
      '</div>' +
      '<div class="modal-foot">' +
      '<button class="btn btn-secondary" data-xno>' + I18n.t('common.cancel') + '</button>' +
      '<button class="btn btn-primary" data-xsave>' + I18n.t('common.save') + '</button>' +
      '</div>'
    );
    form.querySelector('[data-xclose]').onclick = () => UI.closeModal();
    form.querySelector('[data-xno]').onclick = () => UI.closeModal();
    form.querySelector('[data-xsave]').onclick = () => {
      const pw = form.querySelector('#pw-new').value.trim();
      if (!pw) {
        UI.toast(I18n.t('common.required'), 'error');
        return;
      }
      const users = Auth.getUsers();
      const u = users.find(x => x.username === username);
      if (u) { u.password = pw; Auth.setUsers(users); }
      UI.closeModal();
      UI.toast(I18n.t('set.pwChanged'), 'success');
    };
  },

  async confirmDeleteUser(username) {
    const current = Auth.current();
    if (current && current.username === username) {
      UI.toast(I18n.t('set.cannotDeleteSelf'), 'error');
      return;
    }
    const users = Auth.getUsers();
    const target = users.find(u => u.username === username);
    if (target && target.role === 'owner' && users.filter(u => u.role === 'owner').length <= 1) {
      UI.toast(I18n.t('set.lastOwner'), 'error');
      return;
    }
    const ok = await UI.confirm(I18n.t('set.deleteUserMsg', { name: username }), {
      title: I18n.t('set.deleteUser'), confirmText: I18n.t('common.delete'), danger: true
    });
    if (!ok) return;
    Auth.setUsers(users.filter(u => u.username !== username));
    this.renderUsers();
    UI.toast(I18n.t('set.userDeleted'), 'success');
  }
};