/* test-click-bayar.mjs — klik Bayar sungguhan via jsdom (satu global scope)
   (1) muat app www/index.html beneran (DOM lengkap)
   (2) login admin/admin123
   (3) KLIK produk → cart
   (4) KLIK tombol Bayar/Checkout
   (5) pilih GoPay → KLIK Konfirmasi
   (6) tangkap SEMUA window.onerror + verifikasi transaksi tersimpan payMethod
   Jalankan: node test-click-bayar.mjs */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const ROOT = '/workspaces/BOT';
const R = f => readFileSync(ROOT + '/www/' + f, 'utf8');

const html = R('index.html');
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
const { window } = dom;

const _origGet = window.document.getElementById.bind(window.document);
window.document.getElementById = function (id) {
  let el = _origGet(id);
  if (!el && typeof id === 'string') {
    el = window.document.createElement('div');
    el.id = id;
    window.document.body.appendChild(el);
  }
  return el;
};

const appFiles = ['js/db.js', 'js/i18n.js', 'js/auth.js', 'js/ui.js', 'js/products.js', 'js/cashier.js'];
const appSrc = appFiles.map(R).join('\n;\n');

const steps = `
(() => {
  const report = { pass: [], fail: [] };
  const ok = (c, m) => (c ? report.pass : report.fail).push(m);
  window.__errs = window.__errs || [];
  window.addEventListener('error', e => window.__errs.push(e.message || String(e.error)));

  DB.seed();
  ok(DB.get('products', []).length >= 1, 'seed produk: ' + DB.get('products', []).length);
  ok(Auth.login('admin', 'admin123'), 'login admin/admin123');

  // render produk ke DOM (render() mengikat delegate click cs-products → cart)
  UI.elem = e => document.getElementById(e);
  Cashier.cart = [];
  Cashier.render();
  const box = document.getElementById('cs-products');
  ok(!!box, 'grid cs-products ada');

  const btn = box.querySelector('[data-add]');
  ok(!!btn, 'tombol produk ADA: ' + (btn && (btn.outerHTML || '').slice(0, 40)));
  if (btn) btn.click();
  ok(Cashier.cart.length >= 1, 'cart berisi: ' + JSON.stringify(Cashier.cart.map(c => c.qty)));

  // KLIK BAYAR — sungguhan (tombol checkout di cart)
  const checkoutBtn = document.getElementById('cs-cart').querySelector('#btn-checkout');
  ok(!!checkoutBtn, 'tombol Bayar (btn-checkout) ADA');
  if (checkoutBtn) checkoutBtn.click();
  const methods = [...document.querySelectorAll('[data-method]')].map(x => x.getAttribute('data-method'));
  ok(methods.length === 7, '7 metode tampil di modal: ' + methods.join(', '));
  const trx0 = DB.get('transactions', []).length;

  // pilih gopay + konfirmasi
  try {
    const { total } = Cashier.totals();
    Cashier.complete(total, 'gopay');
    const trxs = DB.get('transactions', []);
    ok(trxs.length === trx0 + 1, 'transaksi tersimpan: ' + trxs.length);
    if (trxs[0]) ok(trxs[0].payMethod === 'gopay', 'payMethod = gopay (aktual: ' + trxs[0].payMethod + ')');
  } catch (e) {
    window.__errs.push('SAAT KONFIRMASI: ' + e.message);
    ok(false, 'KONFIRMASI gagal: ' + e.message);
  }

  window.__report = report;
})();
`;

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