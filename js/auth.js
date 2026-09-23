/* ============================================================
   auth.js — login/session + role-based permissions
   ============================================================ */
const Auth = {
  getUsers() {
    return DB.get('users', []);
  },

  setUsers(users) {
    DB.set('users', users);
  },

  current() {
    const s = DB.get('session', null);
    /* Sesi bertahan 7 HARI (pilihan user: b) — setelah itu wajib login ulang */
    if (s && s.loginAt) {
      const ageMs = Date.now() - new Date(s.loginAt).getTime();
      if (ageMs > 7 * 24 * 3600 * 1000) {
        DB.set('session', null);
        return null;
      }
    }
    return s;
  },

  login(username, password) {
    const users = this.getUsers();
    const user = users.find(u => u.username === username.trim() && u.password === password);
    if (!user) return false;
    const now = new Date().toISOString();
    DB.set('session', {
      username: user.username,
      name: user.name,
      role: user.role,
      loginAt: now,
      shiftId: this.openShift(user, now)
    });
    return true;
  },

  /* Buka shift baru saat login */
  openShift(user, now) {
    const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const d = new Date(now);
    const shift = {
      id: 'SHF-' + d.getTime().toString(36).toUpperCase(),
      username: user.username,
      name: user.name || user.username,
      start: now,
      end: null,
      updatedAt: Date.now()
    };
    const shifts = DB.get('shifts', []);
    shifts.unshift(shift);
    DB.set('shifts', shifts);
    return shift.id;
  },

  /* Tutup shift saat logout */
  closeShift(shiftId) {
    if (!shiftId) return;
    const shifts = DB.get('shifts', []);
    const shift = shifts.find(s => s.id === shiftId);
    if (shift && !shift.end) {
      shift.end = new Date().toISOString();
      shift.updatedAt = Date.now();
      DB.set('shifts', shifts);
    }
  },

  logout() {
    const s = this.current();
    if (s) this.closeShift(s.shiftId);
    DB.set('session', null);
  },

  isLoggedIn() {
    return !!this.current();
  },

  can(permission) {
    const u = this.current();
    if (!u) return false;
    const perms = {
      admin: ['cashier', 'products', 'history', 'dashboard', 'reports'],
      owner: ['cashier', 'products', 'history', 'dashboard', 'reports', 'settings']
    };
    return (perms[u.role] || []).includes(permission);
  },

  isOwner() {
    return this.current() && this.current().role === 'owner';
  }
};