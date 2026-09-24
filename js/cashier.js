/* ============================================================
   cashier.js — kasir: product grid, cart, payment, checkout
   ============================================================ */
const Cashier = {
  cart: [],
  state: { search: '', category: 'all', discountPct: 0 },

  render() {
    this.renderCategoryFilter();
    this.renderProducts();
    this.renderCart();
    this.bindEvents();
  },

  /* ---------- product grid ---------- */
  filteredProducts() {
    let list = Products.list();
    if (this.state.category !== 'all') {
      list = list.filter(p => p.category === this.state.category);
    }
    if (this.state.search) {
      const q = this.state.search;
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q));
    }
    return list;
  },

  renderCategoryFilter() {
    const select = document.getElementById('cs-category');
    if (!select) return;
    select.innerHTML =
      '<option value="all">' + I18n.t('common.all') + '</option>' +
      Products.categories().map(c => '<option value="' + UI.esc(c) + '">' + UI.esc(c) + '</option>').join('');
    select.value = this.state.category;
  },

  renderProducts() {
    const grid = document.getElementById('cs-products');
    const rows = this.filteredProducts();
    if (!rows.length) {
      grid.innerHTML = '<div class="empty" style="grid-column:1/-1">' + I18n.t('cash.empty') + '</div>';
      return;
    }
    grid.innerHTML = rows.map(p => {
      const inCart = this.cart.find(c => c.id === p.id);
      const left = p.stock - (inCart ? inCart.qty : 0);
      const disabled = left <= 0;
      const stockLabel = disabled
        ? '<div class="p-stock zero">' + I18n.t('cash.badgeEmpty') + '</div>'
        : '<div class="p-stock' + (left <= 5 ? ' zero' : '') + '">' + I18n.t('cash.stockLeft', { n: left }) + '</div>';
      return '' +
        '<button class="product-card" data-add="' + UI.esc(p.id) + '"' + (disabled ? ' disabled' : '') + '>' +
        '<div class="p-name">' + UI.esc(p.name) + '</div>' +
        '<div class="p-price">' + UI.money(p.price) + '</div>' +
        stockLabel +
        '</button>';
    }).join('');
  },

  /* ---------- cart ---------- */
  totals() {
    const subtotal = this.cart.reduce((s, i) => s + i.price * i.qty, 0);
    const pct = Math.max(0, Math.min(100, Number(this.state.discountPct) || 0));
    const discountAmount = Math.round(subtotal * pct / 100);
    const total = subtotal - discountAmount;
    return { subtotal, pct, discountAmount, total };
  },

  renderCart() {
    const el = document.getElementById('cs-cart');
    if (!el) return;
    const { subtotal, pct, discountAmount, total } = this.totals();

    let itemsHtml = '';
    if (!this.cart.length) {
      itemsHtml =
        '<div class="cart-empty">' +
        '<svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>' +
        '<div>' + I18n.t('cash.cartEmpty').replace(/\n/g, '<br>') + '</div>' +
        '</div>';
    } else {
      itemsHtml = this.cart.map(i =>
        '<div class="cart-item" data-id="' + UI.esc(i.id) + '">' +
        '<div class="ci-info">' +
        '<div class="ci-name">' + UI.esc(i.name) + '</div>' +
        '<div class="ci-price">' + UI.money(i.price) + '</div>' +
        '</div>' +
        '<div class="qty-ctl">' +
        '<button class="qty-btn" data-qty="-1">−</button>' +
        '<span class="qty">' + i.qty + '</span>' +
        '<button class="qty-btn" data-qty="1">+</button>' +
        '</div>' +
        '<div class="ci-line">' + UI.money(i.price * i.qty) + '</div>' +
        '<button class="icon-btn danger" data-remove title="' + I18n.t('common.delete') + '">🗑️</button>' +
        '</div>'
      ).join('');
    }

    el.innerHTML =
      '<div class="cart-panel">' +
      '<div class="cart-head">' +
      '<h3>🛒 ' + I18n.t('cash.cart') + ' (' + this.cart.length + ')</h3>' +
      (this.cart.length ? '<button class="btn btn-secondary btn-sm" data-clearcart>' + I18n.t('common.delete') + ' ×' + this.cart.length + '</button>' : '') +
      '</div>' +
      '<div class="cart-items">' + itemsHtml + '</div>' +
      (this.cart.length ? (
        '<div class="cart-total">' +
        '<div class="ct-row"><span>' + I18n.t('cash.subtotal') + '</span><span>' + UI.money(subtotal) + '</span></div>' +
        '<div class="ct-row discount"><span>' + I18n.t('cash.discount') + ' (%)</span>' +
        '<input id="discount-input" type="number" min="0" max="100" value="' + pct + '"></div>' +
        '<div class="ct-row grand"><span>' + I18n.t('cash.total') + '</span><span class="value">' + UI.money(total) + '</span></div>' +
        '<button class="btn btn-success btn-block" id="btn-checkout" style="margin-top:8px">💳 ' + I18n.t('cash.pay') + '</button>' +
        '</div>'
      ) : '') +
      '</div>';
  },

  bindEvents() {
    if (this._bound) return;
    this._bound = true;

    const grid = document.getElementById('cs-products');
    const cart = document.getElementById('cs-cart');
    const searchEl = document.getElementById('cs-search');
    const catEl = document.getElementById('cs-category');

    grid.addEventListener('click', e => {
      const btn = e.target.closest('[data-add]');
      if (!btn) return;
      this.addToCart(btn.getAttribute('data-add'));
    });

    cart.addEventListener('click', e => {
      if (e.target.closest('#btn-checkout')) { this.openCheckout(); return; }
      if (e.target.closest('[data-clearcart]')) { this.cart = []; this.render(); return; }
      const btn = e.target.closest('[data-qty], [data-remove]');
      const item = e.target.closest('.cart-item');
      if (!btn || !item) return;
      const id = item.getAttribute('data-id');
      if (btn.hasAttribute('data-qty')) this.changeQty(id, Number(btn.getAttribute('data-qty')));
      else if (btn.hasAttribute('data-remove')) this.removeFromCart(id);
    });

    cart.addEventListener('input', e => {
      if (e.target.id === 'discount-input') {
        this.state.discountPct = Number(e.target.value) || 0;
        this.renderCart(); // re-render panel (keeps focus loss acceptable)
      }
    });

    searchEl.addEventListener('input', e => {
      this.state.search = e.target.value.toLowerCase();
      this.renderProducts();
    });

    catEl.addEventListener('change', e => {
      this.state.category = e.target.value;
      this.renderProducts();
    });
  },

  /* ---------- cart operations ---------- */
  addToCart(id) {
    const p = Products.get(id);
    if (!p) return;
    const line = this.cart.find(c => c.id === id);
    const inCart = line ? line.qty : 0;
    if (inCart >= p.stock) {
      UI.toast(I18n.t('cash.outOfStock'), 'error');
      return;
    }
    if (line) line.qty++;
    else this.cart.push({ id: p.id, name: p.name, price: p.price, qty: 1, stock: p.stock });
    this.renderProducts();
    this.renderCart();
  },

  changeQty(id, delta) {
    const line = this.cart.find(c => c.id === id);
    if (!line) return;
    const p = Products.get(id);
    if (delta > 0 && line.qty >= (p ? p.stock : line.qty)) {
      UI.toast(I18n.t('cash.outOfStock'), 'error');
      return;
    }
    line.qty += delta;
    if (line.qty <= 0) this.cart = this.cart.filter(c => c.id !== id);
    this.renderProducts();
    this.renderCart();
  },

  removeFromCart(id) {
    this.cart = this.cart.filter(c => c.id !== id);
    this.renderProducts();
    this.renderCart();
  },

  /* ikon metode pembayaran (emoji) */
  methodIcon(m) {
    const icons = { cash: '💵', gopay: '🟢', ovo: '🟣', dana: '🔵', qris: '📱', bca: '🏦', kartu: '💳' };
    return icons[m] || '💳';
  },

  /* ---------- checkout ---------- */
  openCheckout() {
    if (!this.cart.length) return;
    const { total } = this.totals();

    const methods = ['cash', 'gopay', 'ovo', 'dana', 'qris', 'bca', 'kartu'];
    const methodBtns = methods.map(m =>
      '<button type="button" class="pay-method' + (m === 'cash' ? ' selected' : '') + '" data-method="' + m + '">' +
      '<span class="pm-icon">' + this.methodIcon(m) + '</span>' +
      '<span>' + UI.esc(I18n.t('cash.method.' + m)) + '</span>' +
      '</button>'
    ).join('');

    const form = UI.modal(
      '<div class="modal-head"><h3>' + I18n.t('cash.checkout.title') + '</h3>' +
      '<button class="icon-btn" data-xclose>✕</button></div>' +
      '<div class="modal-body">' +
      '<div class="muted" style="text-align:center">' + I18n.t('cash.checkout.note') + '</div>' +
      '<div class="big-total">' + UI.money(total) + '</div>' +
      '<div class="pay-methods">' + methodBtns + '</div>' +
      '<label class="field" id="co-cash-wrap"><span>' + I18n.t('cash.checkout.cash') + ' *</span>' +
      '<input id="co-cash" class="input" type="number" min="0" placeholder="0" style="font-size:18px;font-weight:700"></label>' +
      '<div class="checkout-rows" id="co-rows">' +
      '<div class="ct-row"><span>' + I18n.t('cash.checkout.cash') + '</span><span id="co-cash-show">—</span></div>' +
      '<div class="ct-row grand"><span>' + I18n.t('cash.checkout.change') + '</span><span class="value" id="co-change">—</span></div>' +
      '</div>' +
      '</div>' +
      '<div class="modal-foot">' +
      '<button class="btn btn-secondary" data-xno>' + I18n.t('common.cancel') + '</button>' +
      '<button class="btn btn-success" data-xconfirm disabled>' + I18n.t('cash.checkout.confirm') + '</button>' +
      '</div>'
    );

    const methodsBox = form.querySelector('.pay-methods');
    const cashWrap = form.querySelector('#co-cash-wrap');
    const cashEl = form.querySelector('#co-cash');
    const cashShow = form.querySelector('#co-cash-show');
    const changeEl = form.querySelector('#co-change');
    const confirmBtn = form.querySelector('[data-xconfirm]');
    let method = 'cash';
    const cashOnly = m => m === 'cash';

    const refresh = () => {
      const cash = Math.max(0, Number(cashEl.value) || 0);
      const cashShowTxt = cashOnly(method) ? cash : total;
      cashShow.textContent = UI.money(cashShowTxt);
      const change = cashOnly(method) ? cash - total : 0;
      changeEl.textContent = cashOnly(method) ? (change >= 0 ? UI.money(change) : '—') : '—';
      confirmBtn.disabled = cashOnly(method) ? change < 0 : false;
    };

    methodsBox.onclick = e => {
      const btn = e.target.closest('[data-method]');
      if (!btn) return;
      method = btn.getAttribute('data-method');
      methodsBox.querySelectorAll('[data-method]').forEach(b => b.classList.toggle('selected', b === btn));
      cashWrap.classList.toggle('hidden', !cashOnly(method));
      const lb = cashWrap.querySelector('span');
      lb.textContent = I18n.t(cashOnly(method) ? 'cash.checkout.cash' : 'cash.checkout.electronic');
      cashEl.value = cashOnly(method) ? '' : String(total);
      cashEl.disabled = !cashOnly(method);
      refresh();
    };

    cashEl.addEventListener('input', refresh);
    if (window.innerWidth > 768) cashEl.focus();
    refresh();

    form.querySelector('[data-xclose]').onclick = () => UI.closeModal();
    form.querySelector('[data-xno]').onclick = () => UI.closeModal();
    confirmBtn.onclick = () => {
      const cash = cashOnly(method) ? Math.max(0, Number(cashEl.value) || 0) : total;
      if (cashOnly(method) && cash < total) {
        UI.toast(I18n.t('cash.checkout.insufficient'), 'error');
        return;
      }
      this.complete(cash, method);
    };
  },

  complete(cash, method) {
    const { subtotal, pct, discountAmount, total } = this.totals();
    const user = Auth.current();
    const s = DB.settings();
    const now = new Date();
    const ymd = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    const id = 'TRX-' + ymd + '-' + String(DB.nextSeq()).padStart(3, '0');

    const trx = {
      id,
      date: now.toISOString(),
      status: 'paid',          // 'paid' | 'refunded' (RETUR)
      items: this.cart.map(c => ({ id: c.id, name: c.name, price: c.price, qty: c.qty })),
      subtotal, discountPct: pct, discountAmount, total,
      cash, change: cash - total,
      payMethod: method || 'cash',
      training: DB.isTraining() === true,
      cashier: user ? user.username : '?',
      shiftId: (user && user.shiftId) || null,
      updatedAt: Date.now(),
      storeName: s.storeName, storeAddress: s.storeAddress
    };

    // save transaction
    const trxs = DB.get('transactions', []);
    trxs.unshift(trx);
    DB.set('transactions', trxs);

    // decrement stock
    const products = Products.list();
    this.cart.forEach(c => {
      const p = products.find(x => x.id === c.id);
      if (p) {
        p.stock = Math.max(0, p.stock - c.qty);
        p.updatedAt = Date.now();
      }
    });
    Products.saveAll(products);

    this.cart = [];
    this.state.discountPct = 0;
    UI.closeModal();
    this.renderCart();
    this.renderProducts();

    // success modal
    const form = UI.modal(
      '<div class="modal-body" style="align-items:center;text-align:center">' +
      '<div style="font-size:42px">🎉</div>' +
      '<h3>' + I18n.t('cash.success.title') + '</h3>' +
      '<div class="muted">' + UI.esc(id) + '</div>' +
      '<div class="big-total" style="margin-top:4px">' + UI.money(total) + '</div>' +
      '</div>' +
      '<div class="modal-foot" style="justify-content:center">' +
      '<button class="btn btn-primary" id="btn-print-receipt">🖨️ ' + I18n.t('cash.success.print') + '</button>' +
      '<button class="btn btn-secondary" id="btn-new-trx">' + I18n.t('cash.success.new') + '</button>' +
      '</div>'
    );
    form.querySelector('#btn-print-receipt').onclick = () => {
      UI.closeModal();
      Receipt.print(trx);
    };
    form.querySelector('#btn-new-trx').onclick = () => UI.closeModal();
  }
};