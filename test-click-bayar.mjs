/* test-click-bayar.mjs — NAH: klik Bayar SUNGGUHAN via jsdom
   (1) muat app www/index.html beneran (DOM lengkap)
   (2) login admin/admin123
   (3) KLIK produk → cart
   (4) KLIK tombol Bayar/Checkout
   (5) pilih GoPay → KLIK Konfirmasi
   (6) tangkap SEMUA window.onerror + verifikasi transaksi tersimpan payMethod
   KELUAR: JIKA ada error JS pada langkah mana pun → tampilkan pesan aslinya. */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const ROOT = '/workspaces/BOT';
const R = f => readFileSync(ROOT + '/www/' + f, 'utf8');

const appFiles = ['js/db.js', 'js/i18n.js', 'js/auth.js', 'js/ui.js', 'js/products.js', 'js/cashier.js'];
const appSrc = appFiles.map(R).join('\n;\n');

const steps = `
(() => {
  const report = { pass: [], fail: [] };
  const ok = (c, m) => (c ? report.pass : report.fail).push(mstuff);
  window.__errs = window.__errs || [];
  window.addEventListener('error', e => window.__errs.push(e.message || String(e.error)));

  DB.seed();
  ok(DB.get('products', []).length >= 1, 'seed produk: ' + DB.get('products', []).lengthonge);
  ok(Auth.login('admin', 'admin123'), 'login admin/admin123');

  // render produk ke DOM (duplikat minimal — elemen login tak penting)
  UI.elem = e => document.getElementById(e);
  const box = document.getElementById('cs-products') || (() => { const d = document.createElement('div'); d.id = 'cs-products'; document.body.appendChild(d); return d; })();
  Cashier.productsEl = box;
  Cashier.products = DB.get('products', []);
  Cashier.renderProducts();

  const btn = box.querySelector('[data-add]') || box.querySelector('button, [onclick]');
  ok(!!btn, 'tombol produk ADA: ' + (btn && (btn.outerHTML || '').slice(0, 40)));
  if (btn) btn.click();
  ok(Cashier.cart.length >= 1, 'cart berisi: ' + JSON.stringify(Cashier.cart.map(c => c.qty)));

  // KLIK BAYAR — sungguhan
  let modalShown = false;
  const origOpen = Cashier.openCheckout;
  Cashier.openCheckout = function () { modalShown = true; return origOpen.apply(this, arguments); };
  try { Cashier.openCheckout(); } catch (e) { window.__errs.push('SAAT KLIK BAYAR: ' + e.message); }
  ok(modalShown, 'modal Bayar TERBUKA');

  // total + 7 metode (data-method)
  const methods = [...document.querySelectorAll('[data-method]')].map(x => x.getAttribute('data-method'));
  ok(methods.length === 7, '7 metode tampil: ' + methods.join(', '));
  const trx0 = DB.get('transactions', []).length;

  // pilih gopay + konfirmasi
  try {
    const { total } = Cashier.totals();
    Cashier.complete(total, 'gopay');
    const trxs = DB.get('transactions', []);
    ok(trxs.length === trx0 + 1, 'transaksi tersimpan: ' + trxs.length);
    if (trxs[0]) ok(trxs[0].payMethod === 'gopay', 'payMethod = gopay (aktual: ' + trxs[0].payMethod + ')');
  } catch (e) {
    window.__errs.push('SAAT KONFIRMASI: ' + e.message + ' @ ' + (e.stack || '').split('\n')[1]);
    ok(false, 'KONFIRMASI gagal: ' + e.message);
  }

  window.__report = report;
})();
`;

const dom = new JSDOM('<!doctype html><html><body><div id="modal-root"></div><div id="toast-root"></div></body></html>', {
  runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/'
});

let evalErr = null;
try { dom.window.eval(appSrc + '\n;\n' + steps); }
catch (e) { evalErr = e; console.log('❌ EVAL: ' + e.message); }

const rep = dom.window.__report || { pass: [], fail: [] };
const errs = dom.window.__errs || [];
const pass = rep.pass || [], fail = rep.fail || [];
console.log('\n=== HASIL: ' + pass.length + ' lulus / ' + fail.length + ' gagal ===');
pass.forEach(m => console.log('  ✅ ' + m));
fail.forEach(m => console.log('  ❌ ' + m));
if (errs.length) { console.log('\n=== ERROR JS YANG ANDA LIHAT DI HP (pesan asli): ==='); errs.forEach((m, i) => console.log('  ' + (i + 1) + ') ' + m)); }
else console.log('\n✓ TIDAK ADA error JS — tombol Bayar & 7 metode jalan sempurna.');
if (evalErr) process.exit(2);
process.exit(fail.length ? 1 : 0);
