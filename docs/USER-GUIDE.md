# 📘 Kasir Pro — Panduan Pengguna

Aplikasi POS (Point of Sale) ringan berbasis web. Semua data tersimpan di
browser (`localStorage`) — tidak perlu internet/koneksi server untuk transaksi
harian. Sinkronisasi antar-perangkat (opsional) dijelaskan di bagian akhir.

---

## 1. Masuk Aplikasi

| Peran  | Kemampuan |
|--------|-----------|
| **Owner** | Semua menu termasuk **Pengaturan** (manajemen pengguna, hapus data) |
| **Admin** | Kasir, Produk, Riwayat, Dashboard, Laporan shift (shift sendiri) |

> Tidak ada **akun demo** di layar login. Akun dibuat dengan register di halaman
> login. Login **lokal** terpisah dari login **server** sinkronisasi (lihat §6).

---

## 2. Dashboard

- **Pendapatan Hari Ini** & **Transaksi Hari Ini** — ringkasan harian.
- **Produk Terlaris** — item paling laris (jumlah terjual).
- **Produk Stok Menipis** — peringatan stok rendah biar cepat restock.
- **Transaksi Terbaru** — daftar transaksi terakhir, klik untuk detail.

---

## 3. Kasir — Bertransaksi

### 3.1 Keranjang
1. Ketik di **Cari produk…** atau klik produk di daftar → otomatis masuk keranjang.
2. Untuk ubah jumlah: klik **+ / −** pada item keranjang. Klik **🗑** untuk hapus.
3. Klik **Diskon** untuk memasang potongan harga dalam persen (%).
4. Panel kiri menampilkan **Subtotal → Diskon → Total** secara real-time.

### 3.2 Checkout & Pembayaran
Tekan **Bayar** → muncul dialog checkout:

1. **Metode Pembayaran** — 7 pilihan dalam satu baris ikon:
   `Tunai · GoPay · OVO · DANA · QRIS · BCA VA · Kartu`
   - **Tunai**: isi **Uang diterima** → **Kembalian** dihitung otomatis.
   - **Non-tunai** (GoPay/OVO/DANA/QRIS/BCA VA/Kartu): nilai uang otomatis =
     total, tanpa perlu input. Langsung tekan **Konfirmasi Pembayaran**.
2. Jika uang diterima **kurang dari total** → ditolak dengan pesan peringatan.
3. Selesai → halaman sukses dengan tombol **Cetak Struk** & **Transaksi Baru**.

> Metode bayar yang dipilih **tersimpan di tiap transaksi** dan tampil di Riwayat.

### 3.3 Cetak Struk (58mm)
- **Cetak Struk** di halaman sukses / halaman Riwayat → struk terformat untuk
  printer termal 58mm (font monospace, hitam-putih, `@page size 58mm`).
- **Android**: **🖨️ Cetak Bluetooth** mengirim struk ESC/POS ke printer termal
  Bluetooth yang sudah dipasangkan (lihat README → Cetak Bluetooth).

---

## 4. Riwayat Transaksi

- Cari berdasarkan ID, produk, atau periode. Lihat **detail** transaksi
  (termasuk **metode bayar**, uang diterima, kembalian, diskon).
- **Cetak ulang struk** untuk transaksi lama.

---

## 5. Laporan

### 5.1 Laporan Shift
- **Owner**: melihat semua shift semua kasir.
- **Admin**: hanya shift miliknya sendiri.
- Detail: total transaksi, total pendapatan per shift, rincian transaksi.

### 5.2 Dashboard
- Pendapatan & transaksi hari ini, produk terlaris, peringatan stok menipis.

---

## 6. Pengaturan

- **Profil toko** — nama & alamat toko (muncul di judul/struk).
- **Bahasa** — Indonesia / English (beralih kapan saja).
- **Printer Bluetooth (Android)** — pasang & uji printer ESC/POS.
- **Sinkronisasi Data** (opsional) — hubungkan ke server untuk berbagi data
  antar-perangkat (mis. 2 kasir):
  1. Jalankan server: `npm run server` (butuh Node.js 22+).
  2. Buka Pengaturan → Sinkronisasi → isi URL `http://IP-SERVER:3000`.
  3. Login dengan akun **server** (`admin/admin123` atau `owner/owner123`).
  4. Tekan **Hubungkan & Sinkronkan** → sinkron otomatis tiap 60 detik.
- **Manajemen Pengguna** (owner) — tambah/ubah/hapus pengguna.
- **Hapus Semua Data** (owner) — reset total ke kondisi awal.

> Server menyimpan data di `server/kasirpro.db`. Login server terpisah dari
> login lokal. Setelah server restart, token perlu login ulang.

---

## 7. Data & Privasi

- Data tersimpan **lokal** di perangkat (localStorage) — tidak dikirim ke
  internet kecuali Anda memilih sinkronisasi ke server Anda sendiri.
- Kata sandi disimpan teks biasa (cukup untuk demo/kantor kecil). Untuk
  produksi, gunakan backend dengan autentikasi yang aman.
- **Reset**: tombol *Hapus Semua Data* di Pengaturan (owner).
