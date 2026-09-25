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
    const ok = !!this.native();
    console.log('[BT] available=', ok, 'Plugins.BluetoothPrinter=', !!this.native());
    return ok;
  },

  async listDevices() {
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

  async printLines(address, lines) {
    const n = this.native();
    console.log('[BT] printLines addr=', address, 'n=', !!n, 'n.connectAndPrint=', typeof n.connectAndPrint);
    if (!n) throw new Error('plugin');
    const data = typeof lines === 'string'
      ? lines
      : lines.map(l => (l && l.s) || '').join('\n');
    console.log('[BT] data length=', data.length);
    await n.connectAndPrint({ address, data });
  },

  async printReceipt(trx) {
    const addr = this.printerAddress();
    if (!addr) throw new Error(I18n.t('bt.none'));
    const lines = Receipt.buildLines(trx);
    console.log('[BT] printReceipt lines=', lines.length, 'addr=', addr);
    await this.printLines(addr, lines);
  }
};
