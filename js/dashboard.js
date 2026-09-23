/* ============================================================
   dashboard.js — laporan & statistik
   ============================================================ */
const Dashboard = {
  render() {
    const products = Products.list();
    const trxs = DB.get('transactions', []);
    const today = UI.todayStr();

    const todayTrxs = trxs.filter(t => t.date.slice(0, 10) === today);
    const revenueToday = todayTrxs.reduce((s, t) => s + t.total, 0);
    const lowStock = products.filter(p => p.stock <= 5);

    // stats cards
    document.getElementById('dash-stats').innerHTML =
      this.statCard('💵', 'violet', I18n.t('dash.revenueToday'), UI.money(revenueToday), todayTrxs.length + ' ' + I18n.t('dash.visits')) +
      this.statCard('🧾', 'green', I18n.t('dash.trxToday'), String(todayTrxs.length), I18n.t('dash.visits')) +
      this.statCard('📦', 'blue', I18n.t('dash.totalProducts'), String(products.length), lowStock.length + ' ' + I18n.t('dash.lowStock').toLowerCase()) +
      this.statCard('⚠️', 'orange', I18n.t('dash.lowStock'), String(lowStock.length), this.translateLowStock(lowStock));

    // top products
    const qtyMap = {};
    trxs.forEach(t => t.items.forEach(i => {
      if (!qtyMap[i.name]) qtyMap[i.name] = 0;
      qtyMap[i.name] += i.qty;
    }));
    const top = Object.entries(qtyMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

    document.getElementById('dash-top').innerHTML =
      '<h3 class="card-title">🏆 ' + I18n.t('dash.topProducts') + '</h3>' +
      (top.length
        ? '<div class="dash-list">' + top.map(([name, qty], i) =>
            '<div class="dash-row"><span><span class="badge badge-ok" style="margin-right:8px">#' + (i + 1) + '</span><span class="name">' + UI.esc(name) + '</span></span>' +
            '<span class="meta">' + qty + ' ' + I18n.t('dash.items') + '</span></div>'
          ).join('') + '</div>'
        : '<div class="empty">' + I18n.t('dash.noData') + '</div>');

    // low stock
    document.getElementById('dash-low').innerHTML =
      '<h3 class="card-title">⚠️ ' + I18n.t('dash.lowStockList') + '</h3>' +
      (lowStock.length
        ? '<div class="dash-list">' + lowStock.sort((a, b) => a.stock - b.stock).map(p =>
            '<div class="dash-row"><span class="name">' + UI.esc(p.name) + '</span>' +
            '<span>' + UI.stockBadge(p.stock) + '</span></div>'
          ).join('') + '</div>'
        : '<div class="empty">' + I18n.t('dash.noLowStock') + '</div>');

    // recent transactions
    document.getElementById('dash-recent').innerHTML =
      '<h3 class="card-title">🕐 ' + I18n.t('dash.recentTrx') + '</h3>' +
      (trxs.length
        ? '<div class="dash-list">' + trxs.slice(0, 5).map(t =>
            '<div class="dash-row">' +
            '<span><span class="name">' + UI.esc(t.id) + '</span><br><span class="meta">' + UI.esc(UI.fmtDateTime(t.date)) + '</span></span>' +
            '<span class="meta">' + UI.money(t.total) + '</span>' +
            '</div>'
          ).join('') + '</div>' +
          '<div class="muted" style="margin-top:10px;font-size:12.5px" data-nav-link="history">' + I18n.t('dash.viewHistory') + '</div>'
        : '<div class="empty">' + I18n.t('dash.noData') + '</div>');

    // navigation link inside dashboard
    const link = document.querySelector('#dash-recent [data-nav-link="history"]');
    if (link) link.style.cursor = 'pointer';
    if (link && !this._linked) {
      this._linked = true;
      link.onclick = () => App.show('history');
    }
  },

  statCard(icon, color, label, value, sub) {
    return '' +
      '<div class="card stat-card">' +
      '<div class="stat-icon ' + color + '">' + icon + '</div>' +
      '<div class="stat-label">' + UI.esc(label) + '</div>' +
      '<div class="stat-value">' + UI.esc(value) + '</div>' +
      '<div class="stat-sub">' + UI.esc(sub) + '</div>' +
      '</div>';
  },

  translateLowStock(lowStock) {
    const out = lowStock.filter(p => p.stock <= 0).length;
    const low = lowStock.length - out;
    const parts = [];
    if (low > 0) parts.push(low + ' ' + I18n.t('product.low').toLowerCase());
    if (out > 0) parts.push(out + ' ' + I18n.t('product.out').toLowerCase());
    return parts.join(' · ') || '—';
  }
};