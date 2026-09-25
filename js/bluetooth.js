/* ============================================================
   bluetooth.js — cetak struk langsung ke printer termal
   Bluetooth SPP (ESC/POS). Plugin native Android:
   @kduma-autoid/capacitor-bluetooth-printer → "BluetoothPrinter"
   ============================================================ */
const Bluetooth = {
  native() {
    return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BluetoothPrinter) || null;
  },

  available() {
    return !!this.native();
  },

  async listDevices() {
    const n = this.native();
    if (!n) return [];
    const r = await n.list();
    return (r && r.devices) || [];
  },

  printerAddress() {
    return DB.settings().bluetoothPrinter || null;
  },

  savePrinter(address) {
    const s = DB.settings();
    s.bluetoothPrinter = address;
    DB.saveSettings(s);
  },

  async printLines(address, lines) {
    const n = this.native();
    if (!n) throw new Error('plugin');
    const data = typeof lines === 'string'
      ? lines
      : lines.map(l => (l && l.s) || '').join('\n');
    await n.connectAndPrint({ address, data });
  },

  async printReceipt(trx) {
    const addr = this.printerAddress();
    if (!addr) throw new Error(I18n.t('bt.none'));
    const lines = Receipt.buildLines(trx);
    await this.printLines(addr, lines);
  }
};
