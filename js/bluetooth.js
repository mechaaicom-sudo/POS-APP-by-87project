/* ============================================================
   bluetooth.js — cetak struk langsung ke printer termal
   Bluetooth SPP (ESC/POS).

   Prioritas plugin native Android:
   1. BluetoothEscpos  (com.kasirpro.pos.BluetoothEscposPlugin)
      — ESC/POS asli: init, align, bold, feed, potong kertas
      — otomatis minta izin runtime BLUETOOTH_CONNECT (Android 12+)
      — jalan di background thread
   2. BluetoothPrinter (@kduma-autoid/capacitor-bluetooth-printer)
      — fallback raw string SPP
   3. BluetoothTools  (com.kasirpro.pos.BluetoothToolsPlugin)
      — checkPermission + openSettings Bluetooth Android
   ============================================================ */
const Bluetooth = {
  native() {
    if (!window.Capacitor || !window.Capacitor.Plugins) return null;
    const P = window.Capacitor.Plugins;
    return P.BluetoothEscpos || P.BluetoothPrinter || P.BluetoothTools || null;
  },
  escpos() {
    return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BluetoothEscpos) || null;
  },
  tools() {
    return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BluetoothTools) || null;
  },

  available() {
    const ok = !!this.native();
    console.log('[BT] available=', ok, 'escpos=', !!this.escpos(), 'printer=', !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BluetoothPrinter));
    return ok;
  },

  /* Minta izin runtime BLUETOOTH_CONNECT (Android 12+).
     BluetoothEscposPlugin sudah handle request lewat dialog sistem saat
     listDevices()/print() dipanggil — fungsi ini hanya check status. */
  async ensurePermission() {
    const e = this.escpos();
    if (!e || typeof e.checkPermissions !== 'function') return; // kduma/web
    try {
      const st = await e.checkPermissions();
      const state = st && st.bluetooth && st.bluetooth.state;
      console.log('[BT] checkPermissions state=', state);
      if (state !== 'granted') {
        console.log('[BT] izin BLUETOOTH_CONNECT belum granted — dialog sistem akan muncul saat listDevices/print');
      }
    } catch (err) {
      console.warn('[BT] ensurePermission err=', err && err.message);
    }
  },

  async listDevices() {
    await this.ensurePermission();
    const e = this.escpos();
    if (e && typeof e.listDevices === 'function') {
      const r = await e.listDevices();
      console.log('[BT] listDevices (escpos) devices=', (r && r.devices || []).length);
      return (r && r.devices) || [];
    }
    const n = this.native();
    if (!n) return [];
    const r = await n.list();
    return (r && r.devices) || [];
  },

  printerAddress() {
    const addr = DB.settings().bluetoothPrinter || null;
    console.log('[BT] printerAddress=', addr);
    return addr;
  },

  savePrinter(address) {
    const s = DB.settings();
    s.bluetoothPrinter = address;
    DB.saveSettings(s);
  },

  /* Cetak dengan alignment/bold ESC/POS (plugin BluetoothEscpos).
     lines: array {s, a: 'left'|'center'|'right', b: bool} dari Receipt.buildLines */
  async printLines(address, lines) {
    await this.ensurePermission();
    const e = this.escpos();
    const data = typeof lines === 'string'
      ? lines
      : lines.map(l => (l && l.s) || '').join('\n');
    const structured = Array.isArray(lines)
      ? lines.map(l => ({ s: (l && l.s) || '', a: (l && l.a) || 'left', b: !!(l && l.b) }))
      : null;
    if (e && typeof e.print === 'function') {
      console.log('[BT] print via BluetoothEscpos addr=', address, 'lines=', structured && structured.length);
      const payload = structured ? { address, lines: structured } : { address, lines: [{ s: data }] };
      await e.print(payload);
      return;
    }
    const n = (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BluetoothPrinter) || null;
    if (!n || typeof n.connectAndPrint !== 'function') {
      throw new Error('Plugin printer Bluetooth tidak tersedia');
    }
    console.log('[BT] print via BluetoothPrinter (raw) addr=', address, 'len=', data.length);
    await n.connectAndPrint({ address, data });
  },

  async printReceipt(trx) {
    const addr = this.printerAddress();
    if (!addr) throw new Error(I18n.t('bt.none'));
    const lines = Receipt.buildLines(trx);
    console.log('[BT] printReceipt lines=', lines.length, 'addr=', addr);
    await this.printLines(addr, lines);
  },

  /* Buka Settings Bluetooth Android supaya user bisa pairing printer dulu */
  openSettings() {
    const t = this.tools();
    if (!t || typeof t.openSettings !== 'function') {
      return Promise.reject(new Error('Tidak bisa membuka pengaturan Bluetooth'));
    }
    return t.openSettings();
  },

  permissionState() {
    const t = this.tools();
    if (!t || typeof t.checkPermission !== 'function') {
      return Promise.resolve({ granted: true, api: -1 });
    }
    return t.checkPermission();
  }
};