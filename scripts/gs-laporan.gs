/**
 * ============================================================
 *  gs-laporan.gs — Google Apps Script untuk Kasir Pro / My Cash-POS APP
 *  Menerima data dari aplikasi kasir lalu menulis ke Google Spreadsheet
 *  sehingga bisa dibuat pivot table, chart, dan laporan keuangan.
 *
 *  CARA PAKAI
 *  1. Buka Google Spreadsheet baru  →  https://sheets.google.com
 *  2. menu Extensions → Apps Script
 *  3. Hapus isi Code.gs, tempel SELURUH kode ini, lalu Simpan (Ctrl+S)
 *  4. Ganti KUNCI_RAHASIA di bawah dengan kunci buatan Anda sendiri
 *     (harus sama dengan yang diisi di menu Pengaturan aplikasi)
 *  5. Klik Deploy → New deployment
 *        Type    : Web app
 *        Execute as        : Me
 *        Who has access    : Anyone
 *  6. Klik Deploy → salin URL Web App (berakhiran /exec)
 *  7. Paste URL + kunci di aplikasi: Pengaturan → Google Sheets
 *  8. Ketuk "Uji Koneksi" di aplikasi. Selesai!
 *
 *  CATATAN
 *  - Tab dibuat otomatis beserta judul kolomnya (Transaksi / Penjualan /
 *    Pengeluaran).
 *  - Baris duplikat otomatis dilewati (deteksi lewat ID_Transaksi), jadi
 *    aman Though aplikasi mengirim ulang data.
 *  - Bebas biaya (Google Apps Script gratit's).
 * ============================================================ */

/** GANTI DENGAN KUNCI MILIK ANDA (sama dengan di Pengaturan aplikasi) */
var KUNCI_RAHASIA = '87PRO.CO';

var TAB_TRANSAKSI = 'Transaksi';
var TAB_PENJUALAN = 'Penjualan';
var TAB_PENGELUARAN = 'Pengeluaran';

var HEADERS = {};
HEADERS[TAB_TRANSAKSI] = ['ID_Transaksi', 'Tanggal', 'Waktu', 'Kasir', 'Toko', 'Jml_Item',
  'Qty_Total', 'Subtotal', 'Diskon_Persen', 'Diskon_Rp', 'Total', 'Metode_Bayar',
  'Tunai', 'Kembalian', 'Shift', 'Status'];
HEADERS[TAB_PENJUALAN] = ['ID_Transaksi', 'Tanggal', 'Waktu', 'Kasir', 'ID_Produk', 'Produk',
  'Kategori', 'Qty', 'Harga_Satuan', 'Subtotal_Item'];
HEADERS[TAB_PENGELUARAN] = ['ID_Pengeluaran', 'Tanggal', 'Waktu', 'Keterangan', 'Jumlah', 'Kasir'];

/**
 * Kolom yang dipakai sebagai kunci deteksi duplikat.
 * Penjualan memakai 2 kolom (ID_Transaksi + ID_Produk) karena satu
 * transaksi bisa punya banyak item.
 */
var KOLOM_KUNCI = {};
KOLOM_KUNCI[TAB_TRANSAKSI] = ['ID_Transaksi'];
KOLOM_KUNCI[TAB_PENJUALAN] = ['ID_Transaksi', 'ID_Produk'];
KOLOM_KUNCI[TAB_PENGELUARAN] = ['ID_Pengeluaran'];

/** Buka URL ini di browser untuk memastikan endpoint sudah aktif.
 *  Kalau muncul JSON di bawah ini, berarti script sudah ter-deploy dengan benar. */
function doGet(e) {
  var info = {
    ok: true,
    app: 'My Cash-POS APP',
    status: 'aktif — endpoint siap menerima data',
    kunciSudahDiatur: KUNCI_RAHASIA !== 'GANTI-DENGAN-KUNCI-ANDA',
    tabTersedia: [TAB_TRANSAKSI, TAB_PENJUALAN, TAB_PENGELUARAN],
    caraPakai: 'Kirim POST berisi JSON {secret, tab, key, row} dari aplikasi kasir.'
  };
  if (!info.kunciSudahDiatur) {
    info.peringatan = 'KUNCI_RAHASIA masih placeholder — ganti di script lalu Deploy ulang, lalu samakan dengan aplikasi.';
  }
  return jsonOut(info);
}

function doPost(e) {
  try {
    var isi = (e && e.postData && e.postData.contents) || '';

    // Diagnosa: kalau body tidak sampai (mis. diblokir browser / deploy salah)
    if (!isi || !isi.trim()) {
      return jsonOut({ ok: false, error: 'Payload kosong diterima. Body POST tidak sampai — pastikan URL deployment berakhiran /exec dan aplikasi memakai Content-Type text/plain.' });
    }

    var payload;
    try {
      payload = JSON.parse(isi);
    } catch (pe) {
      return jsonOut({ ok: false, error: 'Payload bukan JSON yang valid: ' + isi.slice(0, 100) });
    }

    // 1) validasi kunci rahasia
    if (KUNCI_RAHASIA === 'GANTI-DENGAN-KUNCI-ANDA') {
      return jsonOut({ ok: false, error: 'KUNCI_RAHASIA di script masih placeholder. Ganti dengan kunci Anda lalu Deploy ulang.' });
    }
    if (payload.secret !== KUNCI_RAHASIA) {
      return jsonOut({ ok: false, error: 'Kunci rahasia salah. Samakan dengan KUNCI_RAHASIA di script ini.' });
    }

    // 2) validasi tab
    var tab = String(payload.tab || '');
    if (!HEADERS[tab]) {
      return jsonOut({ ok: false, error: 'Tab tidak dikenal: ' + tab });
    }
    if (!payload.row || !payload.row.length) {
      return jsonOut({ ok: false, error: 'Baris kosong.' });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ambilTab(ss, tab);

    // 3) cek duplikat (hanya untuk baris transaksi/pengeluaran)
    var sudahAda = cekDuplikat(sh, tab, payload.row);
    if (sudahAda) {
      return jsonOut({ ok: true, skipped: true, message: 'Data sudah ada, dilewati.' });
    }

    // 4) tulis baris
    sh.appendRow(payload.row.map(nilai));

    return jsonOut({ ok: true, added: 1, tab: tab });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/* ---------- helper ---------- */

/** pastikan tab ada + judul kolomnya sesuai */
function ambilTab(ss, nama) {
  var sh = ss.getSheetByName(nama);
  if (!sh) {
    sh = ss.insertSheet(nama);
    sh.getRange(1, 1, 1, HEADERS[nama].length).setValues([HEADERS[nama]]);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** cek apakah kunci sudah pernah ditulis (dibaca max 2000 baris terakhir) */
function cekDuplikat(sh, tab, row) {
  var namaKolom = KOLOM_KUNCI[tab] || [];
  var idx = [];
  var id = '';
  for (var a = 0; a < namaKolom.length; a++) {
    var c = HEADERS[tab].indexOf(namaKolom[a]);
    if (c < 0) return false;
    idx.push(c);
    id += '|' + String(row[c] || '');
  }
  if (!id.replace(/\|/g, '')) return false;

  var last = sh.getLastRow();
  if (last < 2) return false;

  var mulai = Math.max(2, last - 2000);
  // baca semua kolom kunci sekaligus (1 bulk read, lebih cepat)
  var maks = 0;
  for (var b = 0; b < idx.length; b++) maks = Math.max(maks, idx[b]);
  var lebar = maks + 1;
  var nilai = sh.getRange(mulai, 1, last - mulai + 1, lebar).getValues();

  for (var i = 0; i < nilai.length; i++) {
    var gabung = '';
    for (var j = 0; j < idx.length; j++) gabung += '|' + String(nilai[i][idx[j]] || '');
    if (gabung === id) return true;
  }
  return false;
}

/** pastikan nilai rapi: angka tetap angka, teks jadi teks, null jadi kosong */
function nilai(v) {
  if (v === null || v === undefined) return '';
  return v;
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}