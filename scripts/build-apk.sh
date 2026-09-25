#!/usr/bin/env bash
# ============================================================
# build-apk.sh — My Cash-POS APP: sync www → cap sync → gradle → dist
# 1 perintah bangun APK debug + release. Jalankan: npm run build
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

echo "── 1/4 sync root → www ──"
npm run sync:www

echo "── 2/4 cap sync android ──"
npx cap sync android

echo "── 3/4 gradle build ──"
(cd android && ./gradlew assembleDebug assembleRelease)

echo "── 4/4 salin hasil ke dist/ ──"
mkdir -p dist
cp android/app/build/outputs/apk/debug/app-debug.apk    dist/KasirPro-v1.2.2.apk
cp android/app/build/outputs/apk/release/app-release.apk dist/KasirPro-v1.2.2-release.apk

echo ""
echo "✅ Selesai! APK:"
echo "   dist/KasirPro-v1.2.2.apk"
echo "   dist/KasirPro-v1.2.2-release.apk"