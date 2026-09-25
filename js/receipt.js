/* ============================================================
   receipt.js — build & print struk (receipt) untuk printer termal 58mm
   ------------------------------------------------------------
   Kertas 58mm  -> area cetak efektif ±48mm.
   Format: kolom sempit, font monospace, hitam-putih (tanpa
   background berwarna agar hasil cetak termal tetap jelas).
   ============================================================ */
const Receipt = {
  /* gaya CSS struk 58mm, di-salin dari css/style.css agar dokumen cetak mandiri */
  R58_CSS: [
    '.receipt{font-family:"Courier New",Courier,monospace;font-size:10.5px;line-height:1.4;color:#000;background:#fff;width:48mm;padding:2mm 2mm 0;box-sizing:border-box}',
    'body{margin:0;background:#fff}',
    '.r-center{text-align:center}',
    '.r-store{font-weight:700;font-size:13px;text-transform:uppercase}',
    '.r-addr{font-size:9px}',
    '.r-rule{border-top:1px dashed #000;margin:4px 0}',
    '.r-row{display:flex;justify-content:space-between;gap:6px;white-space:nowrap}',
    '.r-amt{text-align:right}',
    '.r-total{display:flex;justify-content:space-between;gap:6px;font-weight:700;font-size:12px;margin:3px 0}',
    '.r-items{padding:2px 0}',
    '.r-item{margin-bottom:3px}',
    '.r-iname{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.r-iline{display:flex;justify-content:space-between;font-size:9.5px}',
    '.r-cut{height:8mm}'
  ].join(''),

  /* maksimal karakter nama item agar tidak meluber (48mm @ 10.5px monospace) */
  build(trx) {
    const storeName = trx.storeName || DB.settings().storeName || '';
    const storeAddress = trx.storeAddress || DB.settings().storeAddress || '';
    const d = new Date(trx.date);

    const pad2 = n => String(n).padStart(2, '0');
    const dateStr = pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear() +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());

    const maxName = 28;

    let itemsHtml = '';
    trx.items.forEach(item => {
      const name = item.name.length > maxName ? item.name.slice(0, maxName - 1) + '~' : item.name;
      const qtyLine = UI.esc(item.qty) + ' x ' + UI.esc(UI.money(item.price).replace(/\u00A0/g, ' '));
      const amt = UI.esc(UI.money(item.qty * item.price).replace(/\u00A0/g, ' '));
      itemsHtml +=
        '<div class="r-item">' +
        '<div class="r-iname">' + UI.esc(name) + '</div>' +
        '<div class="r-iline"><span class="r-iqty">' + qtyLine + '</span><span class="r-iamt">' + amt + '</span></div>' +
        '</div>';
    });

    let discountHtml = '';
    if (trx.discountAmount > 0) {
      discountHtml =
        '<div class="r-row"><span>' + I18n.t('cash.discount') + ' ' + (trx.discountPct || 0) + '%' + '</span>' +
        '<span class="r-amt">-' + UI.esc(UI.money(trx.discountAmount).replace(/\u00A0/g, ' ')) + '</span></div>';
    }

    return '' +
      '<div class="receipt r58">' +

      /* header toko */
      '<div class="r-center">' +
      (storeName ? '<div class="r-store">' + UI.esc(storeName) + '</div>' : '') +
      (storeAddress ? '<div class="r-addr">' + UI.esc(storeAddress) + '</div>' : '') +
      '</div>' +
      '<div class="r-rule"></div>' +

      /* meta transaksi */
      '<div class="r-row"><span>' + I18n.t('rc.id') + '</span><span class="r-amt">' + UI.esc(trx.id) + '</span></div>' +
      '<div class="r-row"><span>' + I18n.t('rc.date') + '</span><span class="r-amt">' + UI.esc(dateStr) + '</span></div>' +
      '<div class="r-row"><span>' + I18n.t('rc.cashier') + '</span><span class="r-amt">' + UI.esc(trx.cashier) + '</span></div>' +
      '<div class="r-rule"></div>' +

      /* item */
      '<div class="r-items">' + itemsHtml + '</div>' +
      '<div class="r-rule"></div>' +

      /* rincian pembayaran */
      '<div class="r-row"><span>' + I18n.t('cash.subtotal') + '</span>' +
      '<span class="r-amt">' + UI.esc(UI.money(trx.subtotal).replace(/\u00A0/g, ' ')) + '</span></div>' +
      discountHtml +
      '<div class="r-total"><span>' + I18n.t('rc.total') + '</span>' +
      '<span class="r-amt">' + UI.esc(UI.money(trx.total).replace(/\u00A0/g, ' ')) + '</span></div>' +
      '<div class="r-row"><span>' + I18n.t('rc.cash') + '</span>' +
      '<span class="r-amt">' + UI.esc(UI.money(trx.cash).replace(/\u00A0/g, ' ')) + '</span></div>' +
      '<div class="r-row"><span>' + I18n.t('rc.change') + '</span>' +
      '<span class="r-amt">' + UI.esc(UI.money(trx.change).replace(/\u00A0/g, ' ')) + '</span></div>' +
      '<div class="r-rule"></div>' +

      /* footer */
      (trx.status === 'refunded'
        ? '<div class="r-center" style="font-weight:700;letter-spacing:1px">*** ' + I18n.t('his.refunded') + ' ***</div>'
        : '') +
      '<div class="r-center">' + I18n.t('rc.thanks') + '<br>' + I18n.t('rc.visit') + '</div>' +

      /* ruang pemotongan kertas */
      '<div class="r-cut"></div>' +
      '</div>';
  },

  /* ---------- Teks ESC/POS untuk printer termal (tidak via dialog cetak) ---------- */
  buildLines(trx) {
    const W = 32; // kolom standar ESC/POS 58mm
    const storeName = trx.storeName || DB.settings().storeName || '';
    const storeAddress = trx.storeAddress || DB.settings().storeAddress || '';
    const d = new Date(trx.date);
    const pad2 = n => String(n).padStart(2, '0');
    const dateStr = pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear() +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    const clean = s => UI.esc(s).replace(/\u00A0/g, ' ').slice(0, W - 1);
    const money = n => UI.money(n).replace(/\u00A0/g, ' ');
    const rule = '-'.repeat(W);

    const lines = [];
    const push = (s, a, b) => lines.push({ s, a: a || 'left', b: !!b });

    if (storeName) push(storeName, 'center', true);
    if (storeAddress) push(storeAddress, 'center');
    push(rule);
    push(clean(I18n.t('rc.id')) + ' : ' + trx.id);
    push(clean(I18n.t('rc.date')) + ' : ' + dateStr);
    push(clean(I18n.t('rc.cashier')) + ' : ' + trx.cashier);
    push(rule);

    const row = (label, amt, bold) => {
      const l = clean(label);
      const r = money(amt);
      const pad = W - l.length - r.length;
      push(l + (pad > 0 ? ' '.repeat(pad) : ' ') + r, 'left', bold);
    };

    trx.items.forEach(item => {
      push(clean(item.name));
      row(clean(item.qty) + ' x ' + money(item.price), item.qty * item.price);
    });
    push(rule);
    row(clean(I18n.t('cash.subtotal')), trx.subtotal);
    if (trx.discountAmount > 0) row(clean(I18n.t('cash.discount')) + ' ' + (trx.discountPct || 0) + '%', -trx.discountAmount);
    row(clean(I18n.t('rc.total')), trx.total, true);
    row(clean(I18n.t('rc.cash')), trx.cash);
    row(clean(I18n.t('rc.change')), trx.change);
    push(rule);
    push(clean(I18n.t('rc.thanks')), 'center');
    push(clean(I18n.t('rc.visit')), 'center');
    return lines;
  },

  async print(trx) {
    /* PRIORITAS 1 — printer Bluetooth SPP (jalur langsung ke
       printer termal 58mm tanpa dialog). Plugin @kduma-autoid/
       capacitor-bluetooth-printer mengirim ESC/POS langsung. */
    if (Bluetooth.available() && Bluetooth.printerAddress()) {
      try {
        await Bluetooth.printReceipt(trx);
        UI.toast(I18n.t('bt.sent'), 'success');
        return;
      } catch (e) {
        UI.toast(I18n.t('bt.fail').replace('{err}', e.message || 'Bluetooth'), 'error');
        return;
      }
    }

    const area = document.getElementById('print-area');
    area.innerHTML = this.build(trx);
    // delay singkat agar browser merender struk sebelum dialog cetak muncul
    await new Promise(r => setTimeout(r, 100));

    /* PRIORITAS 2 — dialog cetak HTML (plugin @capgo/printer / window.print),
       dipakai kalau printer Bluetooth BELUM diatur. */
    const PrinterNative = (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Printer);
    if (PrinterNative && typeof PrinterNative.printHtml === 'function') {
      const doc =
        '<!DOCTYPE html><html><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<style>' + this.R58_CSS + '</style></head><body>' + area.innerHTML + '</body></html>';
      try {
        await PrinterNative.printHtml({ name: 'Struk ' + trx.id, html: doc });
        return;
      } catch (e) {
        console.warn('Printer plugin gagal, fallback ke window.print():', e);
      }
    }
    window.print();
  }
};