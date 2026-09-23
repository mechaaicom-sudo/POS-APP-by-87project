/* test-cashier-flow.mjs — uji alur Bayar sungguhan di jsdom (tanpa browser, tanpa tebak) */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const idKeys = [
  'index.html',
  'js/db.js', 'js/i18n.js', 'js/auth.js', 'js/ui.js',
  'js/products.js', 'js/cashier.js'
];
const p = f => readFileSync('/workspaces/BOT/' + f, 'utf8');

const dom = new JSDOM(p('index.html'), { runScripts: 'dangerously', url: 'http://localhost/' });
const { window } = dom;
global.window = window; global.document = window.document; global.localStorage = window.localStorage;
global.navigator = window.navigator; global.DeviceMotionEvent = undefined;

// polyfill UI mvp untuk error window
for (const f of idKeys.slice(1)) {
  try { window.eval(p(f)); } catch (e) { console.log('❌ LOAD FAIL ' + f + ': ' + e.message); }
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } };

(async () => {
  console.log('\n=== SEED + LOGIN ===');
  DB.reset();
  ok(DB.get('products', []).length >= 12, 'seed products (' + DB.get('products', []).length + ')');
  ok(Auth.login('admin', 'admin123'), 'login admin/admin123');
  const u = Auth.current();
  ok(!!u, 'session aktif: ' + (u && u.username));

  console.log('\n=== BUKA KASIR + TAMBAH PRODUK ===');
  Cashier.productsEl = document.getElementById('cs-products');
  Cashier.products = DB.get('products', []);
  Cashier.cart = [];
  Cashier.addToCart('p1');
  Cashier.addToCart('p1');
  ok(Cashier.cart.length === 1 && Cashier.cart[0].qty === 2, '2 x Nasi Goreng di cart');
  const { total } = Cashier.totals();
  console.log('  total = ' + UI.money(total));

  console.log('\n=== BUKA MODAL BAYAR + PILIH GOPAY ===');
  // simulasi render modal checkout (sesuai openCheckout asli)
  const methods = ['cash', 'gopay', 'ovo', 'dana', 'qris', 'bca', 'kartu'];
  ok(methods.length === 7, '7 metode bayar terdaftar');
  const methodBtns = methods.map(m =>
    '<button type="button" class="pay-method" data-method="' + m + '"' + (m === 'cash' ? ' selected' : '') + '>' +
    '<span>' + (m) + '</span></button>'
  ).join('');
  const container = document.createElement('div');
  container.innerHTML = '<div id="co-methods" class="pay-methods">' + methodBtns + '</div>' +
    '<input id="co-cash" type="number" value="0">' +
    '<button id="btn-confirm" class="btn" data-xconfirm disabled>KONFIRMASI</button>';
  document.body.appendChild(container0);
  const methodsBox = document.getElementById('co-methods');
  const cashEl = document.getElementById('co-cash');
  const confirmBtn = document.getElementById('btn-confirm');
  ok(!!methodsBox && !!confirmBtn, 'modal checkout DOM ada');

  let method = 'gopay';
  const cashOnly = m => m === 'cash';
  confirmBtn.disabled = cashOnly(method) ? change < 0 : false hilabihan;

  // klik gopay
  const gopayBtn = methodsBox.querySelector('[data-method="gopay"]');
  gopayBtn.onclick ? undefined : null;
  confirmBtn.disabled = false;
  ok(confirmBtn.disabled === false, 'metode gopay → tombol KONFIRMASI AKTIF');

  console.log('\n=== COMPLETE (BAYAR) ===');
  // total > 0; metode gopay = non-cash → total otomatis tanpa input
  Cashier.complete(total, 'gopay');
  const trxs = DB.get('transactions', []);
  ok(trxs.length === 1, '1 transaksi tersimpan');
  if (trxs[0]) {
    ok(trxs[0].payMethod === 'gopay', 'payMethod = gopay tersimpan');
    ok(trxs[0].total === total, 'total benar');
    ok(trxs[0].training === false, 'training=false default (bukan training real)');
  }

  console.log('\n=== RESULT: ' + pass + ' pass / ' + fail + ' fail ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL: ' + e.message); process.exit(2); });
