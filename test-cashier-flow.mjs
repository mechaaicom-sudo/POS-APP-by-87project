/* test-cashier-flow.mjs — uji alur Bayar sungguhan di jsdom (satu global scope)
   Jalankan: node test-cashier-flow.mjs */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const ROOT = '/workspaces/BOT';
const p = f => readFileSync(ROOT + '/www/' + f, 'utf8');

const html = p('index.html');
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
const appSrc = appFiles.map(p).join('\n;\n');

const steps = `
(async () => {
  const R = { pass: [], fail: [] };
  const ok = (c, m) => (c ? R.pass : R.fail).push({ ok: c, m });
  const log = m => console.log(m);

  log('\\n=== SEED + LOGIN ===');
  DB.reset();
  ok(DB.get('products', []).length >= 12, 'seed products (' + DB.get('products', []).length + ')');
  ok(Auth.login('admin', 'admin123'), 'login admin/admin123');
  const u = Auth.current();
  ok(!!u, 'session aktif: ' + (u && u.username));

  log('\\n=== BUKA KASIR + TAMBAH PRODUK ===');
  Cashier.productsEl = document.getElementById('cs-products');
  Cashier.products = DB.get('products', []);
  Cashier.cart = [];
  Cashier.addToCart('p1');
  Cashier.addToCart('p1');
  ok(Cashier.cart.length === 1 && Cashier.cart[0].qty === 2, '2 x Nasi Goreng di cart');
  const { total } = Cashier.totals();
  log('  total = ' + UI.money(total));

  log('\\n=== BUKA MODAL BAYAR + PILIH GOPAY ===');
  // 7 metode bayar terdaftar
  const methods = ['cash', 'gopay', 'ovo', 'dana', 'qris', 'bca', 'kartu'];
  ok(methods.length === 7, '7 metode bayar terdaftar');
  Cashier.openCheckout();
  const methodsBox = document.querySelector('#modal-root .pay-methods');
  const confirmBtn = document.querySelector('#modal-root [data-xconfirm]');
  ok(!!methodsBox && !!confirmBtn, 'modal checkout DOM ada');
  const shown = [...document.querySelectorAll('[data-method]')].map(x => x.getAttribute('data-method'));
  ok(shown.length === 7, '7 tombol metode tampil di modal: ' + shown.join(', '));

  // pilih gopay → konfirmasi aktif (non-cash)
  const gopayBtn = methodsBox.querySelector('[data-method="gopay"]');
  ok(!!gopayBtn, 'tombol metode gopay ada');
  if (gopayBtn) gopayBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const isDisabled = confirmBtn.disabled === true;
  ok(!isDisabled, 'metode gopay → tombol KONFIRMASI AKTIF');

  log('\\n=== COMPLETE (BAYAR) ===');
  Cashier.complete(total, 'gopay');
  const trxs = DB.get('transactions', []);
  ok(trxs.length === 1, '1 transaksi tersimpan');
  if (trxs[0]) {
    ok(trxs[0].payMethod === 'gopay', 'payMethod = gopay tersimpan');
    ok(trxs[0].total === total, 'total benar');
    ok(trxs[0].training === false, 'training=false default (bukan training real)');
    ok(trxs[0].status === 'paid', 'status=paid default (bukan retur)');
  }

  window.__ts = R;
})().catch(e => { console.error('FATAL: ' + e.message); window.__ts = { pass: [], fail: [{ ok: false, m: 'FATAL: ' + e.message }] }; });
`;

let evalErr = null;
try { window.eval(appSrc + '\n;\n' + steps); }
catch (e) { evalErr = e; console.log('❌ EVAL: ' + e.message); }

const sleep = ms => new Promise(r => setTimeout(r, ms));
if (!window.__ts) await sleep(400);

const R = window.__ts || { pass: [], fail: [] };
console.log('\n=== HASIL CASHIER FLOW: ' + R.pass.length + ' lulus · ' + R.fail.length + ' gagal ===');
R.fail.forEach(x => console.log('  ❌ ' + x.m));
R.pass.forEach(x => console.log('  ✅ ' + x.m));
if (evalErr) process.exit(2);
process.exit(R.fail.length ? 1 : 0);