/* ============================================================
   sync.js — sinkronisasi data antar-perangkat via server
   (Node.js + SQLite). Strategi: full-state pull + full push,
   konflik diselesaikan dengan updatedAt terbaru (last-write-wins).
   ============================================================ */
const Sync = {
  meta() {
    return DB.get('sync', { url: '', username: '', token: '', lastAt: null });
  },

  saveMeta(m) {
    DB.set('sync', m);
  },

  configured() {
    const m = this.meta();
    return !!(m.url && m.token);
  },

  serverUrl() {
    return this.meta().url.replace(/\/+$/, '');
  },

  async login(url, username, password) {
    const base = String(url || '').trim().replace(/\/+$/, '');
    if (!base || !username || !password) throw new Error(I18n.t('common.required'));
    const res = await fetch(base + '/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.token) throw new Error(data.error || I18n.t('set.syncLoginFail'));
    const m = this.meta();
    m.url = base;
    m.username = username;
    m.token = data.token;
    m.lastAt = null;
    this.saveMeta(m);
  },

  disconnect() {
    const m = this.meta();
    m.token = '';
    m.username = '';
    m.lastAt = null;
    this.saveMeta(m);
  },

  collect() {
    return {
      products: DB.get('products', []),
      transactions: DB.get('transactions', []),
      shifts: DB.get('shifts', []),
      settings: [DB.settings()]
    };
  },

  async request(path, opts) {
    const m = this.meta();
    const res = await fetch(this.serverUrl() + path, Object.assign({
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + m.token }
    }, opts));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    return data;
  },

  async push() {
    const data = await this.request('/api/sync', {
      method: 'POST',
      body: JSON.stringify({ collections: this.collect() })
    });
    return data;
  },

  async pull() {
    const data = await this.request('/api/sync');
    this.merge(data.collections || {});
    const m = this.meta();
    m.lastAt = Date.now();
    this.saveMeta(m);
    return data;
  },

  /* gabungkan hasil pull (kalahkan lokal hanya jika data server lebih baru) */
  merge(collections) {
    if (!collections) return;
    const mergeList = (key, incoming) => {
      const local = DB.get(key, []);
      const idx = {};
      local.forEach(r => { idx[r.id] = r; });
      let changed = false;
      incoming.forEach(inc => {
        const cur = idx[inc.id];
        if (!cur) {
          idx[inc.id] = inc;
          changed = true;
        } else if ((inc.updatedAt || 0) > (cur.updatedAt || 0)) {
          idx[inc.id] = inc;
          changed = true;
        }
      });
      if (changed) {
        const merged = Object.values(idx);
        if (key === 'products') Products.saveAll(merged);
        else DB.set(key, merged);
      }
    };
    if (collections.products) mergeList('products', collections.products);
    if (collections.transactions) mergeList('transactions', collections.transactions);
    if (collections.shifts) mergeList('shifts', collections.shifts);
    if (collections.settings && collections.settings[0]) {
      const s = collections.settings[0];
      const cur = DB.settings();
      if ((s.updatedAt || 0) > (cur.updatedAt || 0)) {
        const merged = Object.assign({}, s);
        merged.updatedAt = s.updatedAt;
        DB.set('settings', merged);
      }
    }
  },

  /* urutan yang aman: pull dulu (serap perubahan lain), lalu push (kirim milik kita) */
  async syncAll() {
    await this.pull();
    await this.push();
  },

  _timer: null,
  startAuto() {
    if (this._timer) return;
    this._timer = setInterval(() => {
      if (this.configured()) {
        this.syncAll().catch(() => {}); // diam saat offline
      }
    }, 60000);
  }
};