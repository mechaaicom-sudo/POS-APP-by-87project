# BUILD — Kasir Pro (POS) → APK Android

Panduan membangun APK Android dari kode web (root) menggunakan Capacitor.
Semua perintah dijalankan dari folder proyek `/workspaces/BOT`.

> **Penting:** Jangan build dari `www/` atau `android/app/src/main/assets/public/`
> secara langsung. Sumber sebenarnya ada di root (`index.html`, `css/`, `js/`);
> `www/` hanya salinan (webDir) yang disalin ke APK oleh Capacitor.

---

## 0. Prasyarat (sekali saja)

- Node.js 18+ dan `npm install` sudah pernah dijalankan.
- Android Studio / JDK 17 / Android SDK terpasang.
- Capacitor project sudah ada: folder `android/` + `capacitor.config.ts`.

---

## 1. Sync kode web → APK (harus tiap kali ubah `js/`, `css/`, `index.html`)

```bash
cd /workspaces/BOT
npm run sync:www      # salin root → www/  (menjalankan scripts/sync-www.mjs)
npx cap sync android  # sinkron + salin webDir ke folder android
```

---

## 2. Build APK

### Debug (uji coba, tanpa tanda tangan rilis)

```bash
cd android
./gradlew assembleDebug
```

Hasil:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### Release (tanda tangan rilis via keystore)

```bash
cd android
./gradlew assembleRelease
```

Hasil:
```
android/app/build/outputs/apk/release/app-release.apk
```

> **Keystore:** Release menggunakan `kasirpro-release.keystore` (deteksi otomatis
> dari `signingConfigs` di `app/build.gradle`). **JANGAN ganti keystore/appId**
> selama masih ingin APK baru bisa diupdate di atas versi lama tanpa uninstall.
> AppId (package) = `com.kasirpro.pos` — sudah konsisten di `capacitor.config.ts`,
> `android/app/build.gradle`, `android/app/src/main/AndroidManifest.xml`,
> `android/app/src/main/assets/capacitor.config.json`, dan `strings.xml`.

---

## 3. Salin + beri nama hasil ke `dist/`

Hasil gradle bernama generik (`app-debug.apk` / `app-release.apk`). Salin ke
`dist/` dengan nama berciri *Kasir Pro*:

```bash
cd /workspaces/BOT
mkdir -p dist
cp android/app/build/outputs/apk/debug/app-debug.apk    dist/KasirPro-v1.0.0.apk
cp android/app/build/outputs/apk/release/app-release.apk dist/KasirPro-v1.0.0-release.apk
```

---

## 4. Verifikasi

1. Pasang APK di perangkat/emulator, login tanpa akun demo (register akun baru).
2. Buka Kasir → checkout → **7 metode bayar** (Tunai, GoPay, OVO, DANA, QRIS,
   BCA VA, Kartu) tampil. Pilih metode, selesaikan transaksi.
3. Cek Riwayat → transaksi menampilkan metode bayar yang dipilih.
4. Identitas aplikasi = **Kasir Pro** (nama, ikon, splash).

---

## Referensi Perintah (ringkas)

| Tujuan                     | Perintah                                              |
|----------------------------|-------------------------------------------------------|
| Update www dari root       | `npm run sync:www`                                    |
| Sync webDir ke android     | `npx cap sync android`                                |
| Build debug                | `cd android && ./gradlew assembleDebug`               |
| Build release              | `cd android && ./gradlew assembleRelease`             |
| Jalankan server dev (web)  | `npm run server`                                      |

---

## Troubleshooting cepat

- **Fitur metode bayar tidak muncul di APK** → lupa `npm run sync:www` setelah
  ubah `js/`. Cek `www/js/cashier.js` berisi `complete(cash, method)`.
- **Error `keystore` saat release** → pastikan `kasirpro-release.keystore` ada
  dan password sesuai `build.gradle` (jangan commit ke repositori publik).
- **Localhost tidak bisa diakses di perangkat** → aplikasi ini sepenuhnya
  offline (localStorage), tidak butuh server.
