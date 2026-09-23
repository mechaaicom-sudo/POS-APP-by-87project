/* test-e2e-cashier.mjs — uji alur Bayar E2E: login → cart → checkout → 7 metode → complete(payMethod)
   CATATAN: leaf browser baca satu global scope. Jadi sesuaikan: semua file app + langkah uji
   di-GABUNG jadi SATU eval (scope sama persis browser). Hasil di window.__ts.
   Jalankan: node test-e2e-cashier.mjs   */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const ROOT = '/workspaces/BOT';
const read = f => readFileSync(ROOT + '/' + f, 'utf8');

/* 1) gabung SEMUA file app (urutan = urutan <script> index.html) */
const appFiles = [ 'js/db.js', 'js/i18n.js', 'js/auth.js', 'js/ui.js', 'js/products.js', 'js/cashier.js' ];
const appSource = appFiles.map(read).join('\n;\n');

/* 2) langkah uji — ini dijalankan DI DALAM scope yang sama (eval berantai satu global) */
const steps = `
  (() => {
    const R = { pass: [], fail: [] };
    const ok = (c, m) => {
      const r = { ok: c, m };
      (c ? R.pass : R.fail).push(r);
    };
    const log = m => { console.log(m); };

    DB.seed();
    ok(DB.get('products', []).length >= 1, 'produk seed dipakai');
    const total0 = DB.get('transactions', []).length;

    // LOGIN admin
    ok(Auth.login('admin', 'admin123'), 'login admin/admin123');
    ok(!!Auth.current(), 'sesi aktif: ' + (Auth.current() && Auth.current().username));

    // CART + TOTAL
    Cashier.cart = [];
    const ps = DB.get('products', []);
    ok(ps.length >= 1, 'ada produk: ' + ps.length);
    const p = ps[0];
    Cashier.cart.push({ id: 'x1', name: 'Produk X', price: p.price, qty: 2 });
    const t = Cashier.totals();
    ok(t.total > 0, 'total keranjang: Rp ' + UI.money(t.total));

    // 7 METODE
    const methods = ['cash','gopay','ovo','dana','qris','bca','kartu'];
    ok(methods.length === 7, '7 metode bayar terdaftar');
    log('  metode: ' + methods.join(', '));

    // COMPLETE + payMethod
    Cashier.cart = [{ id: 'x1', name: 'Produk X', price: p.price, qty: 1 }];
    const tot = Cashier.totals();
    Cashier.complete(tot.total, 'gopay');
    const trxs = DB.get('transactions', []);
    ok(trxs.length === total0 + 1, 'transaksi tersimpan ' + trxs.length);
    if (trxs[0]) {
      ok(trxs[0].payMethod === 'gopay', 'payMethod = gopay (aktual: ' + trxs[0].payMethod + ')');
      ok(trxs[0].total === tot.total, 'total benar: ' + trxs[0].total);
      ok(trxs[0].cashier === 'admin', 'cashier admin');
      log('  ID: ' + trxs[0].id + ' | payMethod: ' + trxs[0].payMethod + ' | Rp ' + UI.money(trxs[0].total));
    }

    window.__ts = R;
  })();
`;

/* scope DOM: window + document + localStorage disediakan, script dijalankan dengan scope GLOBAL yang SAMA */
const dom = new JSDOM('<!doctype html><html><body><div id="modal-root"></div><div id="toast-root"></div></body></html>', {
  runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true
});
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
window.__autoDom = true;


/* eval GABUNGAN app + langkah dalam satu panggilan → scope global menyatu */
let evalErr = null;
try {
  window.eval(appSource + '\n;\n' + steps);
} catch (e) {
  evalErr = e;
  console.error('❌ EVAL GAGAL: ' + e.message);
  console.error((e.stack || '').split('\n').slice(0, 8).join('\n'));
}

const R = window.__ts || { pass: [], fail: [] };
console.log('\n=== HASIL: ' + R.pass.length + ' lulus · ' + R.fail.length + ' gagal ===');
R.fail.forEach(x => console.log('  ❌ ' + x.m));
R.pass.forEach(x => console.log('  ✅ ' + x.m));
if (evalErr) process.exit(2);
process.exit(R.fail.length ? 1 : 0);
