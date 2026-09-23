/* ============================================================
   ui.js — generic UI helpers: escape, money, modal, toast, confirm
   ============================================================ */
const UI = {
  esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  money(n) {
    try {
      return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);
    } catch (e) {
      return 'Rp ' + (n || 0);
    }
  },

  fmtDateTime(iso) {
    const d = new Date(iso);
    return d.toLocaleString(I18n.lang === 'en' ? 'en-GB' : 'id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  },

  todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },

  toast(message, type) {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'info');
    const icons = {
      success: '✅', error: '❌', info: 'ℹ️'
    };
    el.textContent = (icons[type] ? icons[type] + ' ' : '') + message;
    root.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .3s, transform .3s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(-8px)';
      setTimeout(() => el.remove(), 300);
    }, 2600);
  },

  modal(html, { large } = {}) {
    const root = document.getElementById('modal-root');
    root.innerHTML =
      '<div class="modal-overlay" id="modal-overlay">' +
      '<div class="modal' + (large ? ' modal-lg' : '') + '">' + html + '</div>' +
      '</div>';
    const overlay = root.firstElementChild;
    overlay.addEventListener('mousedown', e => {
      if (e.target === overlay) this.closeModal();
    });
    document.body.style.overflow = 'hidden';
    return root.querySelector('.modal');
  },

  closeModal() {
    const root = document.getElementById('modal-root');
    root.innerHTML = '';
    document.body.style.overflow = '';
  },

  confirm(message, { title, confirmText, danger } = {}) {
    return new Promise(resolve => {
      const modal = this.modal(
        '<div class="modal-head"><h3>' + this.esc(title || I18n.t('common.confirm')) + '</h3>' +
        '<button class="icon-btn" data-xclose>✕</button></div>' +
        '<div class="modal-body"><p>' + this.esc(message) + '</p></div>' +
        '<div class="modal-foot">' +
        '<button class="btn btn-secondary" data-xno>' + this.esc(I18n.t('common.cancel')) + '</button>' +
        '<button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-xyes>' + this.esc(confirmText || I18n.t('common.confirm')) + '</button>' +
        '</div>'
      );
      const done = val => { this.closeModal(); resolve(val); };
      modal.querySelector('[data-xyes]').onclick = () => done(true);
      modal.querySelector('[data-xno]').onclick = () => done(false);
      modal.querySelector('[data-xclose]').onclick = () => done(false);
    });
  },

  stockBadge(stock) {
    if (stock <= 0) {
      return '<span class="badge badge-out">' + I18n.t('product.out') + '</span>';
    }
    if (stock <= 5) {
      return '<span class="badge badge-low">' + I18n.t('product.low') + ' · ' + stock + '</span>';
    }
    return '<span class="badge badge-ok">' + stock + '</span>';
  }
};