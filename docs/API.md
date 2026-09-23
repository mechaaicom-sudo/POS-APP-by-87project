# 🔌 Kasir Pro — API Server & Skema Data

Server sinkronisasi (Node.js 22+ `node:sqlite`) berbagi data antar-perangkat.
Semua endpoint HTTP JSON di `http://localhost:3000`.

## Skema Database — `server/kasirpro.db`

### Tabel `records`
Satu baris = satu "dokumen" termutakhir (produk, transaksi, pengaturan, dll).

| Kolom        | Tipe           | Keterangan                        |
|--------------|----------------|-----------------------------------|
| `collection` | TEXT (PK)      | `products` / `transactions` / `settings` … |
| `id`         | TEXT (PK)      | id dokumen                        |
| `updated_at` | INTEGER        | timestamp (ms) terakhir ubah      |
| `data`       | TEXT (JSON)    | isi dokumen                       |
| `version`    | INTEGER        | nomor versi (untuk konflik)       |

### Tabel `users` (auth server — terpisah dari login lokal aplikasi)
| Kolom     | Tipe    | Keterangan           |
|-----------|---------|----------------------|
| `username`| TEXT PK | nama pengguna server  |
| `name`    | TEXT    | nama tampilan         |
| `password`| TEXT    | kata sandi (teks biasa, demo) |
| `role`    | TEXT    | `admin` / `owner`     |

Akun server bawaan: `admin/admin123` · `owner/owner123`.

---

## Endpoint

### `POST /api/login`
Autentikasi ke server sinkronisasi.

```json
{ "username": "admin", "password": "admin123" }
```
→ `200 { token, user: { username, name, role } }`

### `GET /api/sync?token=...&since=<ts>`
Ambil semua perubahan setelah `since` (inkremental). Tanpa `since` = kirim semua.

```json
{ "records": [ { "collection": "transactions", "id": "TRX-...", "updated_at": 0, "data": {…}, "version": 1 } ], "serverTime": 0 }
```

### `POST /api/sync`
Kirim perubahan lokal (upsert). Body:

```json
{
  "token": "...",
  "records": [ { "collection": "products", "id": "p1", "data": {…}, "version": 2 } ]
}
```
→ `200 { accepted: [ids…], rejected: [ids…] }` — `rejected` bila versi lokal lebih
lama (konflik) dan harus diambil ulang via `GET /api/sync`.

---

## Notasi Data (payload `records[].data`)

### `products` — contoh
```json
{
  "id": "p1", "name": "Nasi Goreng", "category": "Makanan",
  "price": 25000, "stock": 40
}
```

### `transactions` — contoh (menyertakan metode pembayaran)
```json
{
  "id": "TRX-20240315-001", "date": 1710490000000, "items": [ { "productId": "p1", "name": "Nasi Goreng", "qty": 2, "price": 25000 } ],
  "subtotal": 50000, "discountPct": 10, "discountAmount": 5000, "total": 45000,
  "cash": 50000, "change": 5000, "payMethod": "cash", "cashier": "admin"
}
```

**`payMethod`** — salah satu dari 7 nilai: `cash`, `gopay`, `ovo`, `dana`,
`qris`, `bca`, `kartu`. Non-tunai = `cash` menyetar total (`change: 0`).

### `settings` — contoh
```json
{ "storeName": "Kasir Pro", "storeAddress": "Jl. Contoh No. 1, Jakarta", "lang": "id", "seq": 12 }
```

---

## Menjalankan Server
```bash
npm run server      # → http://localhost:3000
```
