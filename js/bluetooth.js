/* ============================================================
   bluetooth.js — cetak struk langsung ke printer termal
   Bluetooth (ESC/POS). Plugin native Android: BluetoothEscpos.
   ============================================================ */
const Bluetooth = {
  native() {
    return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BluetoothEscpos) || null;
  },

  available() {
    return !!this.native();
  },

  async listDevices() {
    const n = this.native();
    if (!n) return [];
    const r = await n.listDevices();
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
    await n.print({ address, lines });
  },

  async printReceipt(trx) {
    const addr = this.printerAddress();
    if (!addr) throw new Error(I18n.t('bt.none'));
    const lines = Receipt.buildLines(trx);
    await this.printLines(addr, lines);
  }
};