/* ============================================================
   app.js — main application controller
   ============================================================ */
const App = {
  currentView: 'dashboard',
  titles: {
    dashboard: 'dash.title',
    cashier: 'cash.title',
    products: 'product.title',
    history: 'his.title',
    reports: 'rep.title',
    settings: 'set.title'
  },

  init() {
    DB.seed();
    I18n.lang = DB.settings().lang || 'id';
    document.documentElement.lang = I18n.lang;
    document.getElementById('lang-select').value = I18n.lang;
    document.getElementById('brand-name').textContent = DB.settings().storeName || I18n.t('app.name');

    this.bindGlobal();

    if (Auth.isLoggedIn()) {
      this.enterApp();
    } else {
      this.showLogin();
    }
  },

  bindGlobal() {
    const form = document.getElementById('login-form');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const username = document.getElementById('login-username').value;
      const password = document.getElementById('login-password').value;
      if (Auth.login(username, password)) {
        document.getElementById('login-error').classList.add('hidden');
        form.reset();
        this.enterApp();
      } else {
        const err = document.getElementById('login-error');
        err.textContent = I18n.t('login.error');
        err.classList.remove('hidden');
      }
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
      Auth.logout();
      this.showLogin();
    });

    document.getElementById('main-nav').addEventListener('click', e => {
      const btn = e.target.closest('.nav-item');
      if (!btn) return;
      this.show(btn.getAttribute('data-view'));
    });

    document.getElementById('lang-select').addEventListener('change', e => {
      I18n.setLang(e.target.value);
      this.refresh();
      UI.toast(I18n.t('common.saved'), 'success');
    });
  },

  showLogin() {
    document.getElementById('login-view').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-username').focus();
  },

  enterApp() {
    const user = Auth.current();
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');

    // user info in sidebar
    document.getElementById('user-name').textContent = user.name || user.username;
    document.getElementById('user-role').textContent = I18n.t('role.' + user.role);
    document.getElementById('user-avatar').textContent = (user.name || user.username).charAt(0).toUpperCase();

    // show/hide nav-settings based on permission
    document.getElementById('nav-settings').classList.toggle('hidden', !Auth.can('settings'));
    document.getElementById('users-card').classList.toggle('hidden', !Auth.isOwner());

    this.show('dashboard');
  },

  show(view) {
    if (!Auth.can(view) && view !== 'dashboard') {
      // fallback: admin can always access dashboard minus settings
      view = 'dashboard';
    }
    this.currentView = view;

    // hide all pages, show target
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const page = document.getElementById('page-' + view);
    if (page) page.classList.remove('hidden');

    // nav active state
    document.querySelectorAll('.nav-item').forEach(n => {
      n.classList.toggle('active', n.getAttribute('data-view') === view);
    });

    // page title
    document.getElementById('page-title').textContent = I18n.t(this.titles[view]);

    // per-view render
    switch (view) {
      case 'dashboard': Dashboard.render(); break;
      case 'cashier': Cashier.render(); break;
      case 'products': Products.render(); break;
      case 'history': History.render(); break;
      case 'reports': Reports.render(); break;
      case 'settings': Settings.render(); break;
      default: Dashboard.render(); break;
    }
  },

  refresh() {
    I18n.applyStatic();
    document.getElementById('brand-name').textContent = DB.settings().storeName || I18n.t('app.name');
    const user = Auth.current();
    if (user) document.getElementById('user-role').textContent = I18n.t('role.' + user.role);
    this.show(this.currentView);
  }
};

/* Start the app */
document.addEventListener('DOMContentLoaded', () => App.init());