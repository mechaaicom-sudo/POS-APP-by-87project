/* ============================================================
   update.js — NOTIFIKASI VERSI BARU (opsi kasir: "1")
   - Saat app dibuka (setelah login), cek ke server (updateUrl)
   - Server menyajikan file `version.json` contoh:
       { "version":"1.2.0", "apk":"/download/kasirpro.apk", "note":"..." }
   - Kalau version di server > versi lokal → tampilkan BANNER
     "⬇️ Versi baru tersedia" + tombol Download (buka APK baru langsung)
   - AMAN 100% OFFLINE: kalau updateUrl kosong / gagal → TIDAK ada
     request & TIDAK tampil apa-apa (app tetap offline tanpa error).
   ============================================================ */
const Update = (() => {
  const LOCAL_VERSION = '1.1.0'; // naikkan tiap build APK baru

  function release() {
    const s = DB.get('settings', {});
    return {
      url: (s.updateUrl || '').trim().replace(/\/+$/, ''),
      checkedAt: s.updateCheckedAt || 0,
      known: s.updateKnownVersion || ''
    };
  }

  /* simpan hasil cek supaya tidak spam tiap buka (cek ulang ~4 jam sekali,
     atau setiap kali versi lokal naik) */
  function remember(version) {
    const s = DB.get('settings', {});
    s.updateCheckedAt = Date.now();
    if (version) s.updateKnownVersion = version;
    DB.set('settings', s);
  }

  function isSameOrNewer(a, b) {
    const p = v => String(v || '').split('.').map(x => parseInt(x, 10) || 0);
    const pa = p(a), pb = p(b);
    for (let i = 0; i < 3; i++) {
      if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
    }
    return true; // sama persis
  }

  function banner(v) {
    const api = release().url;
    const old = document.querySelector('#upd-banner');
    if (old) old.remove();
    const div = document.createElement('div');
    div.id = 'upd-banner';
    div.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;' +
      'background:linear-gradient(90deg,#14532d,#16a34a);color:#fff;' +
      'padding:12px 14px;display:flex;align-items:center;gap:10px;' +
      'flex-wrap:wrap;box-shadow:0 -2px 10px rgba(0,0,0,.25)';
    div.innerHTML =
      '<span style="font-size:22px">⬇️</span>' +
      '<span style="flex:1;min-width:140px">' +
      '<b>Versi ' + UI.esc(v) + ' tersedia</b></span>' +
      '<a href="' + UI.esc(api + '/download/kasirpro.apk') + '" ' +
      'style="background:#fff;color:#14532d;padding:7px 14px;border-radius:8px;' +
      'font-weight:bold;text-decoration:none">Download</a>' +
      '<button onclick="this.closest(\'#upd-banner\').remove()" ' +
      'style="background:none;border:none;color:#fff;font-size:18px">✕</button>';
    document.body.appendChild(div);
  }

  async function check(silent) {
    const cfg = release();
    if (!cfg.url) return; // offline: tanpa URL = tidak lakukan apa-apa
    const FOUR_HOURS = 4 * 3600 * 1000;
    if (!silent && cfg.checkedAt && (Date.now() - cfg.checkedAt) < FOUR_HOURS) return;
    try {
      const res = await fetch(cfg.url + '/version.json', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (!data || typeof data.version !== 'string') return;
      const newer = (data.version !== LOCAL_VERSION) && !isSameOrNewer(LOCAL_VERSION, data.version);
      if (newer) banner(data.version);
      remember(data.version);
    } catch (e) {
      /* offline / server mati — diam, tanpa error di layar */
    }
  }

  return { check, release, LOCAL_VERSION };
})();
