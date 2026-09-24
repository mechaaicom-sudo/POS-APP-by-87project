/* ============================================================
   db.js — localStorage helper + seed data
   ============================================================ */
const DB = {
  prefix: 'kasirpro_',

  get(key, fallback) {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  },

  set(key, value) {
    localStorage.setItem(this.prefix + key, JSON.stringify(value));
  },

  remove(key) {
    localStorage.removeItem(this.prefix + key);
  },

  settings() {
    const s = this.get('settings', {});
    if (!s.storeName) s.storeName = I18n.t('app.name');
    if (!s.storeAddress) s.storeAddress = '';
    if (!s.lang) s.lang = 'id';
    if (!s.theme) s.theme = 'dark';
    if (!s.seq) s.seq = 0;
    if (!s.updatedAt) s.updatedAt = Date.now();
    return s;
  },

  saveSettings(s) {
    s.updatedAt = Date.now();
    this.set('settings', s);
  },

  /* ---- Training Mode ---- */
  isTraining() {
    const s = this.settings();
    return !!(s && s.training);
  },

  setTraining(on) {
    const s = this.settings();
    s.training = !!on;
    s.trainingHint = s.trainingHint || false; /* saran otomatis pernah tampil */
    this.saveSettings(s);
  },

  nextSeq() {
    const s = this.settings();
    s.seq = (s.seq || 0) + 1;
    this.saveSettings(s);
    return s.seq;
  },

  /* Seed default data on first run */
  seed() {
    if (this.get('seeded', false)) return;

    const users = [
      { username: 'admin', name: 'Admin', password: 'admin123', role: 'admin' },
      { username: 'owner', name: 'Owner', password: 'owner123', role: 'owner' },
      { username: 'yusuf', name: 'Yusuf', password: 'yusuf123', role: 'admin' }
    ];
    this.set('users', users);

    const products = [
      { id: 'p1', name: 'Nasi Goreng Spesial', category: 'Makanan', price: 25000, stock: 40 },
      { id: 'p2', name: 'Ayam Geprek', category: 'Makanan', price: 20000, stock: 35 },
      { id: 'p3', name: 'Sate Ayam (10 tusuk)', category: 'Makanan', price: 30000, stock: 20 },
      { id: 'p4', name: 'Bakso Urat', category: 'Makanan', price: 18000, stock: 30 },
      { id: 'p5', name: 'Es Teh Manis', category: 'Minuman', price: 5000, stock: 80 },
      { id: 'p6', name: 'Es Kopi Susu', category: 'Minuman', price: 15000, stock: 45 },
      { id: 'p7', name: 'Air Mineral', category: 'Minuman', price: 4000, stock: 100 },
      { id: 'p8', name: 'Kentang Goreng', category: 'Camilan', price: 12000, stock: 4 },
      { id: 'p9', name: 'Pisang Goreng (3 pcs)', category: 'Camilan', price: 10000, stock: 25 },
      { id: 'p10', name: 'Roti Bakar Coklat', category: 'Camilan', price: 15000, stock: 0 },
      { id: 'p11', name: 'Mie Rebus Telur', category: 'Makanan', price: 12000, stock: 30 },
      { id: 'p12', name: 'Jus Alpukat', category: 'Minuman', price: 18000, stock: 15 }
    ];
    this.set('products', products);

    this.set('transactions', []);
    this.set('shifts', []);
    this.set('settings', { storeName: 'Kasir Pro', storeAddress: 'Jl. Contoh No. 1, Jakarta', lang: 'id', seq: 0 });
    this.set('session', null);
    this.set('seeded', true);
  },

  /* Wipe everything and re-seed */
  reset() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(this.prefix)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
    this.seed();
  }
};