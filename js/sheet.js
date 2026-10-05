/* ============================================================
   sheet.js — kirim laporan keuangan ke GOOGLE SHEETS
   lewat Apps Script Web App (TANPA login Google di dalam app).

   Kenapa Apps Script & bukan Google Sheets API resmi?
   - Tidak perlu OAuth2/consent screen (agak ribet & wajib verifikasi Google)
   - Cukup 1 URL + 1 kunci rahasia di Pengaturan
   - App tetap jalan 100% offline; data diantre, dikirim saat ada internet

   Cara setup (panduan lengkap: docs/GOOGLE-SHEETS.md):
   1. Buat Google Spreadsheet baru
   2. Extensions → Apps Script → paste kode scripts/gs-laporan.gs
   3. Deploy → New deployment → Web app
        Execute as    : Me
        Who has access: Anyone
      → salin URL yang berakhiran /exec
   4. Tempel URL + Kunci Rahasia di menu Pengaturan → Google Sheets
   ============================================================ */
const Sheet = (() => {
  const MAX_QUEUE = 500; // batas antrean (localStorage)
  const TIMEOUT_MS = 15000;

  /* ---------------- definisi kolom per tab ---------------- */

  const TAB_TRANSAKSI = 'Transaksi';
  const TAB_PENJUALAN = 'Penjualan';
  const TAB_PENGELUARAN = 'Pengeluaran';

  const HEADERS = {
    [TAB_TRANSAKSI]: ['ID_Transaksi', 'Tanggal', 'Waktu', 'Kasir', 'Toko', 'Jml_Item',
      'Qty_Total', 'Subtotal', 'Diskon_Persen', 'Diskon_Rp', 'Total', 'Metode_Bayar',
      'Tunai', 'Kembalian', 'Shift', 'Status'],
    [TAB_PENJUALAN]: ['ID_Transaksi', 'Tanggal', 'Waktu', 'Kasir', 'ID_Produk', 'Produk',
      'Kategori', 'Qty', 'Harga_Satuan', 'Subtotal_Item'],
    [TAB_PENGELUARAN]: ['ID_Pengeluaran', 'Tanggal', 'Waktu', 'Keterangan', 'Jumlah', 'Kasir']
  };

  /* ---------------- konfigurasi (disimpan di DB) ---------------- */

  function meta() {
    return DB.get('sheet', { url: '', secret: '', lastAt: 0, lastOk: false, lastError: '' });
  }
  function saveMeta(m) { DB.set('sheet', m); }
  function configured() {
    const m = meta();
    return !!(m.url && m.secret && String(m.url).indexOf('script.google.com') > -1);
  }
  function endpoint() { return String(meta().url || '').trim().replace(/\/+$/, ''); }

  /* ---------------- antrean offline ---------------- */

  function queue() { return DB.get('sheetQueue', []); }
  function setQueue(q) { DB.set('sheetQueue', q.slice(-MAX_QUEUE)); }
  function pending() { return queue().length; }

  /* ---------------- kirim 1 baris ---------------- */

  const MAX_RETRY = 3;

  /* Kirim 1 baris dengan timeout 15 detik dan retry hingga 3x.
     Retry hanya untuk kegagalan jaringan/timeout/HTTP 5xx — error
     validasi dari server (kunci salah, tab salah, dsb.) tidak di-retry. */
  async function postOne(entry) {
    const m = meta();
    let lastErr = null;
    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        /* PENTING: pakai 'text/plain' BUKAN 'application/json'. */
        const res = await fetch(endpoint(), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ secret: m.secret, tab: entry.tab, key: entry.key, row: entry.row }),
          signal: ctrl.signal
        });
        const teks = await res.text();
        let data = {};
        try { data = JSON.parse(teks); } catch (_) { /*_balasan bukan JSON*/ }
        if (!res.ok || !data || data.ok !== true) {
          const msg = (data && data.error) || ('HTTP ' + res.status + (teks ? ' — ' + teks.slice(0, 120) : ''));
          // Error server yang bersifat permanen: jangan retry
          if (data && data.error && !/HTTP 5\d\d/.test(msg)) throw new Error(msg);
          throw Object.assign(new Error(msg), { retryable: res.status >= 500 });
        }
        return data;
      } catch (e) {
        lastErr = e;
        const msg = String((e && e.message) || e || '');
        const isAbort = e && e.name === 'AbortError';
        const isNet = /Failed to fetch|NetworkError|Load failed|ERR_/i.test(msg);
        const isServer = /HTTP 5\d\d/.test(msg) || (e && e.retryable);
        const retryable = isAbort || isNet || isServer;
        if (!retryable || attempt === MAX_RETRY) break;
        await new Promise(r => setTimeout(r, 500 * attempt)); // jeda 0.5s, 1s
      } finally {
        clearTimeout(timer);
      }
    }
    const msg = lastErr && lastErr.name === 'AbortError'
      ? 'Timeout: server tidak merespons dalam ' + (TIMEOUT_MS / 1000) + ' detik (sudah ' + MAX_RETRY + 'x dicoba).'
      : (lastErr && lastErr.message) || String(lastErr);
    throw new Error(msg);
  }

  /* Kirim semua antrean berurutan. Berhenti saat gagal agar urut tetap benar.
     _flushing = guard: hanya 1 proses kirim pada satu waktu (cegah dobel-kirim
     saat beberapa baris diantre hampir bersamaan, mis. 1 transaksi = 2+ baris). */
  let _flushing = null;
  function flush() {
    if (_flushing) return _flushing;
    _flushing = runFlush().finally(() => { _flushing = null; });
    return _flushing;
  }

  async function runFlush() {
    if (!configured()) return { sent: 0, left: queue().length, skipped: true };
    let sent = 0;
    const m = meta();
    m.lastAt = Date.now();
    for (;;) {
      const q = queue();
      if (!q.length) break;
      const entry = q[0];
      try {
        await postOne(entry);
      } catch (e) {
        m.lastOk = false;
        m.lastError = (e && e.message) || String(e);
        saveMeta(m);
        return { sent, left: q.length, error: m.lastError };
      }
      /* Hapus HANYA entri yang baru saja terkirim. Antrean bisa bertambah
         sementara kita menunggu (mis. baris item produk masuk sebelum baris
         Transaksi selesai dikirim), jadi jangan pakai snapshot `q`. */
      const cur = queue();
      const i = cur.findIndex(x => x.key === entry.key);
      setQueue(i >= 0 ? cur.slice(0, i).concat(cur.slice(i + 1)) : cur);
      sent++;
    }
    m.lastOk = true;
    m.lastError = '';
    saveMeta(m);
    return { sent, left: 0 };
  }

  /* Tambah baris ke antrean lalu langsung coba kirim (fire & forget). */
  function enqueue(tab, key, row) {
    if (!configured()) return false;
    const q = queue();
    // jangan dobelkan baris yang sama (mis. retur → payload ulang)
    if (q.some(x => x.key === key)) return false;
    q.push({ tab, key, row, at: Date.now() });
    setQueue(q);
    flush().catch(() => {});
    return true;
  }

  /* ----------------|uploader dari data app ---------------- */

  function pad(n) { return String(n).padStart(2, '0'); }

  function splitTime(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return ['', ''];
    return [d.toISOString().slice(0, 10), pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())];
  }

  function num(n) { return Math.round(Number(n) || 0); }

  /* Transaksi penjualan → 1 baris ringkasan + N baris per item */
  function pushTransaction(trx) {
    if (!configured() || !trx) return;
    const [tgl, waktu] = splitTime(trx.date);
    const items = trx.items || [];
    const qtyTotal = items.reduce((x, i) => x + (Number(i.qty) || 0), 0);

    enqueue(TAB_TRANSAKSI, trx.id, [
      trx.id, tgl, waktu, trx.cashier || '', trx.storeName || '', items.length,
      qtyTotal, num(trx.subtotal), num(trx.discountPct), num(trx.discountAmount),
      num(trx.total), trx.payMethod || 'cash', num(trx.cash), num(trx.change),
      trx.shiftId || '', trx.status || 'paid'
    ]);

    items.forEach((it, idx) => {
      const p = Products.get(it.id);
      enqueue(TAB_PENJUALAN, trx.id + '#' + (it.id || idx), [
        trx.id, tgl, waktu, trx.cashier || '', it.id || '', it.name || '',
        (p && p.category) || '', num(it.qty), num(it.price), num(it.qty) * num(it.price)
      ]);
    });
  }

  /* Pengeluaran → 1 baris */
  function pushExpense(exp) {
    if (!configured() || !exp) return;
    const [tgl, waktu] = splitTime(exp.date);
    enqueue(TAB_PENGELUARAN, exp.id || ('EXP-' + exp.date), [
      exp.id || '', tgl, waktu, exp.note || '', num(exp.amount), exp.user || ''
    ]);
  }

  /* Kirim ulang semua data (tombol "Kirim Ulang Semua") */
  function rebuildAll() {
    if (!configured()) return 0;
    DB.set('sheetQueue', []);
    const trxs = DB.get('transactions', []);
    trxs.forEach(t => {
      if (t.status !== 'refunded') pushTransaction(t);
      else pushTransaction(t);
    });
    DB.get('expenses', []).forEach(e => pushExpense(e));
    return queue().length;
  }

  /* ---------------- uji koneksi dari Pengaturan ---------------- */

  async function test() {
    if (!configured()) throw new Error(I18n.t('sheet.notConfigured'));
    const rows = [];
    HEADERS[TAB_TRANSAKSI].forEach(h => rows.push(h));
    rows.push(['TES-KONEKSI-' + Date.now().toString(36).toUpperCase(),
      new Date().toISOString().slice(0, 10), '', I18n.t('app.name'), '', 0, 0, 0, 0, 0, 0, '—', 0, 0, '', 'tes']);
    const r = await postOne({ tab: TAB_TRANSAKSI, key: rows[rows.length - 1][0], row: rows[rows.length - 1] });
    return r;
  }

  /* ---------------- diagnosa bantuan ---------------- */

  /* Cek bentuk URL sebelum mencoba koneksi, supaya pesan error lebih tepat. */
  function urlProblem() {
    const u = endpoint();
    if (!u) return I18n.t('sheet.hintNoUrl');
    if (u.indexOf('script.google.com') < 0 && u.indexOf('script.googleusercontent.com') < 0) {
      return I18n.t('sheet.hintBadHost');
    }
    if (/\/dev(\?|$)/.test(u)) return I18n.t('sheet.hintDevUrl');
    if (!/\/exec(\?|$)/.test(u)) return I18n.t('sheet.hintNotExec');
    return '';
  }

  /* Terjemahkan error teknis menjadi petunjuk yang bisa ditindaklanjuti. */
  function hintFor(err) {
    const m = String((err && err.message) || err || '');
    if (/Failed to fetch|NetworkError|Load failed|ERR_/i.test(m)) return I18n.t('sheet.hintFetch');
    if (/abort|timeout|Timeout/i.test(m)) return I18n.t('sheet.hintTimeout');
    if (/401|403|Unauthorized|Sign in/i.test(m)) return I18n.t('sheet.hintAuth');
    if (/404|Not Found/i.test(m)) return I18n.t('sheet.hint404');
    if (/KUNCI_RAHASIA|kunci rahasia|GANTI-DENGAN/i.test(m)) return I18n.t('sheet.hintSecret');
    if (/Spreadsheet|script\/storage|Document/i.test(m)) return I18n.t('sheet.hintScript');
    return I18n.t('sheet.hintUnknown');
  }

  return {
    configured, meta, saveMeta, endpoint, queue, pending, flush, enqueue,
    pushTransaction, pushExpense, rebuildAll, test, urlProblem, hintFor, HEADERS
  };
})();