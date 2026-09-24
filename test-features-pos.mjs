/* test-features-pos.mjs — smoke test 3 fitur POS baru:
   (1) Refund/Retur        (2) Stok Masuk & Penyesuaian   (3) Pengeluaran & Laba Bersih
   Pola harness: satu global scope (eval gabungan app), hasil di window.__ts.
   Jalankan: node test-features-pos.mjs */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const ROOT = '/workspaces/BOT';
const read = f => readFileSync(ROOT + '/' + f, 'utf8');

const html = read('www/index.html');
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

const order = ['i18n', 'db', 'ui', 'auth', 'receipt', 'products', 'cashier', 'history', 'dashboard', 'reports', 'bluetooth', 'sync', 'settings', 'app'];
const appSource = order.map(f => read('www/js/' + f + '.js')).join('\n;\n');

const steps = `
  window.__p = (async () => {
    const R = { pass: [], fail: [] };
    const ok = (c, m) => (c ? R.pass : R.fail).push({ ok: c, m });
    const today = () => new Date().toISOString().slice(0, 10);
    const real = t => t.training !== true && t.status !== 'refunded';

    DB.seed();
    ok(Auth.login('admin', 'admin123'), 'login admin/admin123');
    const ps = DB.get('products', []);
    ok(ps.length >= 1, 'produk seed: ' + ps.length);
    const p = ps[0];
    const pFresh = id => DB.get('products', []).find(x => x.id === id); // objek segar (saveAll membuat baru)

    /* ===== (1) REFUND / RETUR ===== */
    const stock0 = pFresh(p.id).stock;
    Cashier.cart = [{ id: p.id, name: p.name, price: p.price, qty: 2 }];
    const tot = Cashier.totals();
    Cashier.complete(tot.total, 'cash');
    const trx = DB.get('transactions', [])[0];
    ok(trx && trx.status === 'paid', 'transaksi baru status=paid: ' + (trx && trx.id));
    ok(pFresh(p.id).stock === stock0 - 2, 'stok berkurang 2 saat checkout: ' + pFresh(p.id).stock + ' (awal ' + stock0 + ')');

    await History.refund(trx.id);
    const after = DB.get('transactions', []).find(t => t.id === trx.id);
    ok(after.status === 'refunded', '1) setelah refund status=refunded');
    ok(!!after.refundedAt, '   refundedAt tercatat');
    ok(pFresh(p.id).stock === stock0, '   stok kembali ke ' + stock0);

    // retur ganda harus ditolak
    const stockNow = pFresh(p.id).stock;
    await History.refund(trx.id);
    ok(DB.get('transactions', []).find(t => t.id === trx.id).status === 'refunded', '   retur kedua tidak mengubah status');
    ok(pFresh(p.id).stock === stockNow, '   retur kedua tidak menambah stok');

    // tabel riwayat menampilkan badge retur ↩️
    History.renderTable();
    ok(document.getElementById('history-tbody').innerHTML.includes('↩️'), '2) tabel riwayat menampilkan badge ↩️');

    // transaksi retur+training tidak dihitung di dashboard / laporan
    const tTrx = {
      id: 'TRX-TRAIN-1', date: new Date().toISOString(), status: 'paid', training: true,
      items: [{ id: p.id, name: p.name, price: p.price, qty: 1 }],
      subtotal: 999999, discountPct: 0, discountAmount: 0, total: 999999,
      cash: 999999, change: 0, payMethod: 'cash', cashier: 'admin', shiftId: null, updatedAt: Date.now()
    };
    const trxs = DB.get('transactions', []); trxs.unshift(tTrx); DB.set('transactions', trxs);
    Dashboard.render();
    const dashHtml = document.getElementById('dash-stats').innerHTML;
    ok(!dashHtml.includes('999.999'), '3) transaksi training (Rp 999.999) TIDAK dihitung di dashboard');
    const revReal = DB.get('transactions', []).filter(t => today().includes('') && t.date.slice(0, 10) === today()).filter(real).reduce((s, t) => s + t.total, 0);
    const expReal = DB.get('expenses', []).filter(e => String(e.date).slice(0, 10) === today()).reduce((s, e) => s + e.amount, 0);
    ok(dashHtml.includes(UI.money(revReal - expReal).replace('Rp ', '').replace(/\./g, '')) || dashHtml.includes(UI.money(revReal - expReal)), '   nilai pendapatan/laba dashboard konsisten dengan data nyata');

    /* ===== (2) STOK MASUK & PENYESUAIAN ===== */
    const stockBefore = pFresh(p.id).stock;
    Products.applyStock(p.id, 5, 'in', 'restock supplier');
    ok(pFresh(p.id).stock === stockBefore + 5, '4) stok masuk +5: ' + pFresh(p.id).stock);
    const log1 = DB.get('stocklog', [])[0];
    ok(log1 && log1.type === 'in' && log1.qty === 5, '   stocklog type=in qty=+5 (aktual: ' + (log1 && log1.type) + ' ' + (log1 && log1.qty) + ')');
    ok(log1.productName === p.name, '   stocklog namaproduk benar');

    Products.applyStock(p.id, 8, 'set', 'opname');
    ok(pFresh(p.id).stock === 8, '5) penyesuaian stok → 8: ' + pFresh(p.id).stock);
    const log2 = DB.get('stocklog', [])[0];
    ok(log2 && log2.type === 'set' && log2.qty === 8 - (stockBefore + 5), '   stocklog type=set delta=' + (log2 && log2.qty));

    Products.renderStockLog();
    const stHtml = document.getElementById('stocklog-tbody').innerHTML;
    ok(stHtml.includes('restock supplier') || stHtml.includes('opname'), '6) tabel riwayat stok menampilkan entri');

    /* ===== (3) PENGELUARAN & LABA BERSIH ===== */
    const expBefore = DB.get('expenses', []).length;
    document.getElementById('exp-note').value = 'Tagihan listrik';
    document.getElementById('exp-amount').value = '50000';
    Reports.render();
    Reports.addExpense();
    ok(DB.get('expenses', []).length === expBefore + 1, '7) pengeluaran tersimpan: ' + DB.get('expenses', []).length);
    const e0 = DB.get('expenses', [])[0];
    ok(e0 && e0.note === 'Tagihan listrik' && e0.amount === 50000, '   isi pengeluaran benar (50.000)');
    Reports.renderExpenses();
    ok(document.getElementById('expenses-tbody').innerHTML.includes('Tagihan listrik'), '8) tabel pengeluaran menampilkan entri');

    // hapus pakai konfirmasi modal (klik tombol Ya)
    const delP = Reports.confirmDeleteExpense(e0.id);
    const yesBtn = document.querySelector('#modal-root [data-xyes]');
    ok(!!yesBtn, '   modal konfirmasi hapus muncul');
    if (yesBtn) yesBtn.onclick();
    await delP;
    ok(DB.get('expenses', []).length === expBefore, '9) pengeluaran dihapus: ' + DB.get('expenses', []).length);

    // laba bersih di stats reports
    DB.set('expenses', [{ id: 'EXP-T', date: new Date().toISOString(), note: 'Tes laba', amount: 25000, user: 'admin' }]);
    Reports.render();
    const repHtml = document.getElementById('rep-stats').innerHTML;
    ok(repHtml.includes(I18n.t('exp.net')), '10) kartu Laba Bersih tampil di laporan shift');

    window.__ts = R;
  })();
`;

let evalErr = null;
let pending = null;
try {
  pending = window.eval(appSource + '\n;\n' + steps);
} catch (e) {
  evalErr = e;
  console.error('❌ EVAL GAGAL: ' + e.message);
}
if (pending && typeof pending.then === 'function') {
  await pending.catch(e => { evalErr = e; console.error('❌ ASYNC GAGAL: ' + e.message); });
}

const R = window.__ts || { pass: [], fail: [] };
console.log('\n=== HASIL FITUR POS: ' + R.pass.length + ' lulus · ' + R.fail.length + ' gagal ===');
R.fail.forEach(x => console.log('  ❌ ' + x.m));
R.pass.forEach(x => console.log('  ✅ ' + x.m));
if (evalErr) process.exit(2);
process.exit(R.fail.length ? 1 : 0);