/* ============================================================
   products.js — product management (CRUD)
   ============================================================ */
const Products = {
  state: { search: '', category: 'all' },

  list() {
    return DB.get('products', []);
  },

  saveAll(products) {
    const now = Date.now();
    products = products.map(p => p.updatedAt ? p : Object.assign({}, p, { updatedAt: now }));
    DB.set('products', products);
  },

  get(id) {
    return this.list().find(p => p.id === id) || null;
  },

  categories() {
    const cats = this.list().map(p => p.category).filter(Boolean);
    return Array.from(new Set(cats)).sort();
  },

  nextId() {
    const used = this.list().map(p => Number(p.id.replace('p', '')) || 0);
    return 'p' + ((used.length ? Math.max(...used) : 0) + 1);
  },

  /* ---------- render ---------- */
  render() {
    this.renderCategoryFilter();
    this.renderTable();

    const searchEl = document.getElementById('prod-search');
    searchEl.value = this.state.search;
    const catEl = document.getElementById('prod-category');
    catEl.value = this.state.category;

    // bind filters once
    if (!this._bound) {
      this._bound = true;
      searchEl.addEventListener('input', e => {
        this.state.search = e.target.value.toLowerCase();
        this.renderTable();
      });
      catEl.addEventListener('change', e => {
        this.state.category = e.target.value;
        this.renderTable();
      });
      document.getElementById('btn-add-product').addEventListener('click', () => this.openForm());
      const tbody = document.getElementById('products-tbody');
      tbody.addEventListener('click', e => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        if (btn.getAttribute('data-action') === 'edit') this.openForm(id);
        if (btn.getAttribute('data-action') === 'delete') this.confirmDelete(id);
      });
    }
  },

  filtered() {
    let list = this.list();
    if (this.state.category !== 'all') {
      list = list.filter(p => p.category === this.state.category);
    }
    if (this.state.search) {
      const q = this.state.search;
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q)
      );
    }
    return list;
  },

  renderCategoryFilter() {
    const select = document.getElementById('prod-category');
    select.innerHTML =
      '<option value="all">' + I18n.t('common.all') + '</option>' +
      this.categories().map(c => '<option value="' + UI.esc(c) + '">' + UI.esc(c) + '</option>').join('');
  },

  renderTable() {
    const tbody = document.getElementById('products-tbody');
    const empty = document.getElementById('products-empty');
    const rows = this.filtered();

    if (!rows.length) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    tbody.innerHTML = rows.map(p => {
      const editable = Auth.can('products');
      const actions = editable
        ? '<button class="icon-btn" data-action="edit" data-id="' + UI.esc(p.id) + '" title="' + I18n.t('common.edit') + '">✏️</button> ' +
          '<button class="icon-btn danger" data-action="delete" data-id="' + UI.esc(p.id) + '" title="' + I18n.t('common.delete') + '">🗑️</button>'
        : '<span class="muted">—</span>';
      return '' +
        '<tr>' +
        '<td><strong>' + UI.esc(p.name) + '</strong></td>' +
        '<td>' + UI.esc(p.category || '—') + '</td>' +
        '<td class="num">' + UI.money(p.price) + '</td>' +
        '<td class="num">' + UI.stockBadge(p.stock) + '</td>' +
        '<td class="num">' + actions + '</td>' +
        '</tr>';
    }).join('');
  },

  /* ---------- form modal ---------- */
  openForm(id) {
    const editing = id ? this.get(id) : null;
    const cats = this.categories();

    const form = UI.modal(
      '<div class="modal-head"><h3>' + (editing ? I18n.t('product.edit') : I18n.t('product.add')) + '</h3>' +
      '<button class="icon-btn" data-xclose>✕</button></div>' +
      '<div class="modal-body">' +
      '<label class="field"><span>' + I18n.t('product.form.name') + ' *</span>' +
      '<input id="pf-name" class="input" value="' + UI.esc(editing ? editing.name : '') + '"></label>' +

      '<label class="field"><span>' + I18n.t('product.form.category') + '</span>' +
      '<select id="pf-category" class="select">' +
      '<option value="">' + I18n.t('common.all') + '</option>' +
      cats.map(c => '<option value="' + UI.esc(c) + '"' + (editing && editing.category === c ? ' selected' : '') + '>' + UI.esc(c) + '</option>').join('') +
      '<option value="__new__">' + I18n.t('product.form.other') + '…</option>' +
      '</select></label>' +

      '<label class="field hidden" id="pf-newcat-wrap"><span>' + I18n.t('product.form.categoryNew') + '</span>' +
      '<input id="pf-newcat" class="input" placeholder="' + I18n.t('product.form.other') + '"></label>' +

      '<div class="form-grid">' +
      '<label class="field"><span>' + I18n.t('product.form.price') + ' *</span>' +
      '<input id="pf-price" class="input" type="number" min="0" value="' + (editing ? editing.price : '') + '"></label>' +
      '<label class="field"><span>' + I18n.t('product.form.stock') + ' *</span>' +
      '<input id="pf-stock" class="input" type="number" min="0" value="' + (editing ? editing.stock : 0) + '"></label>' +
      '</div>' +
      '</div>' +
      '<div class="modal-foot">' +
      '<button class="btn btn-secondary" data-xno>' + I18n.t('common.cancel') + '</button>' +
      '<button class="btn btn-primary" data-xsave>' + I18n.t('common.save') + '</button>' +
      '</div>'
    );

    const catSel = form.querySelector('#pf-category');
    const newcatWrap = form.querySelector('#pf-newcat-wrap');
    catSel.addEventListener('change', () => {
      newcatWrap.classList.toggle('hidden', catSel.value !== '__new__');
    });

    form.querySelector('[data-xclose]').onclick = () => UI.closeModal();
    form.querySelector('[data-xno]').onclick = () => UI.closeModal();
    form.querySelector('[data-xsave]').onclick = () => {
      const name = form.querySelector('#pf-name').value.trim();
      const price = Number(form.querySelector('#pf-price').value);
      const stock = Number(form.querySelector('#pf-stock').value);
      const rawCat = catSel.value;
      const category = rawCat === '__new__'
        ? form.querySelector('#pf-newcat').value.trim()
        : rawCat;

      if (!name || !(price >= 0) || !(stock >= 0) || isNaN(price) || isNaN(stock)) {
        UI.toast(I18n.t('common.required'), 'error');
        return;
      }

      const products = this.list();
      if (editing) {
        const idx = products.findIndex(p => p.id === editing.id);
        products[idx] = { ...products[idx], name, price, stock, category };
      } else {
        products.push({ id: this.nextId(), name, price, stock, category });
      }
      this.saveAll(products);
      UI.closeModal();
      this.renderTable();
      UI.toast(I18n.t('common.saved'), 'success');
    };
  },

  async confirmDelete(id) {
    const p = this.get(id);
    if (!p) return;
    const ok = await UI.confirm(I18n.t('product.deleteMsg', { name: p.name }), {
      title: I18n.t('product.deleteTitle'), confirmText: I18n.t('common.delete'), danger: true
    });
    if (!ok) return;
    this.saveAll(this.list().filter(x => x.id !== id));
    this.renderTable();
    UI.toast(I18n.t('common.deleted'), 'success');
  }
};