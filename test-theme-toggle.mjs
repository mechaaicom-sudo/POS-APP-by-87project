/* Smoke test: toggle tema terang/gelap (dark/light) — pola harness E2E yang sudah terbukti */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const ROOT = '/workspaces/BOT';
const read = f => readFileSync(ROOT + '/' + f, 'utf8');

/* 1) DOM = index.html asli (real login + settings) */
const html = read('www/index.html');
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
const { window } = dom;

/* 2) getElementById: elemen yang tak ada → dibuat otomatis (pola harness E2E) */
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

/* 3) urutan script = urutan <script> di index.html */
const order = ['i18n', 'db', 'ui', 'auth', 'receipt', 'products', 'cashier', 'history', 'dashboard', 'reports', 'bluetooth', 'sync', 'settings', 'app'];
const appSource = order.map(f => read('www/js/' + f + '.js')).join('\n;\n');

const steps = `
  (() => {
    const R = { pass: [], fail: [] };
    const ok = (c, m) => (c ? R.pass : R.fail).push({ ok: c, m });

    App.init();
    ok(document.documentElement.getAttribute('data-theme') === 'dark', '1) default data-theme = dark');

    // masuk app + buka Settings
    ok(Auth.login('admin', 'admin123'), 'login admin/admin123');
    App.enterApp();
    App.show('settings');
    Settings.render();
    const sel = document.getElementById('set-theme');
    ok(sel, 'elemen select tema ada');

    // i18n terisi
    const darkOpt = document.querySelector('#set-theme option[value="dark"]');
    ok(darkOpt && darkOpt.textContent.includes('Gelap'), '2) opsi dark terisi teks: ' + (darkOpt ? darkOpt.textContent : '?'));

    // toggle ke light lalu simpan
    sel.value = 'light';
    document.getElementById('btn-save-store').onclick();
    ok(document.documentElement.getAttribute('data-theme') === 'light', '3) setelah save → data-theme = light');
    ok(DB.settings().theme === 'light', '   settings.theme tersimpan = light');

    // re-render masih konsisten (persist)
    Settings.render();
    ok(document.getElementById('set-theme').value === 'light', '4) re-render settings → select tetap light');

    // kembali dark
    document.getElementById('set-theme').value = 'dark';
    document.getElementById('btn-save-store').onclick();
    ok(document.documentElement.getAttribute('data-theme') === 'dark', '5) kembali dark → data-theme = dark');

    window.__ts = R;
  })();
`;

let evalErr = null;
try {
  window.eval(appSource + '\n;\n' + steps);
} catch (e) {
  evalErr = e;
  console.error('❌ EVAL GAGAL: ' + e.message);
}
const R = window.__ts || { pass: [], fail: [] };
console.log('\n=== HASIL TEMA: ' + R.pass.length + ' lulus · ' + R.fail.length + ' gagal ===');
R.fail.forEach(x => console.log('  ❌ ' + x.m));
R.pass.forEach(x => console.log('  ✅ ' + x.m));
R.fail.forEach(x => process.exitCode = 1);
if (evalErr) process.exitCode = 2;
process.exit(process.exitCode || 0);