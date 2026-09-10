#!/usr/bin/env bash
# SiloShop — build the signed Google Play bundle (AAB).
#
# Run this on your own computer (macOS / Linux / WSL) after:
#   1. Export to GitHub + git pull
#   2. npm install
#   3. npx cap add android          (only the first time)
#   4. Create the keystore + android/keystore.properties (see docs/mobile-app.md)
#
# Usage:  bash scripts/android-release.sh
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -d android ]; then
  echo "android/ is missing. Run: npx cap add android" >&2
  exit 1
fi

if [ ! -f android/keystore.properties ]; then
  echo "android/keystore.properties is missing. See docs/mobile-app.md (Google Play release)." >&2
  exit 1
fi

# Never ship the live-reload server URL in a store build.
unset CAP_SERVER_URL

echo "==> Building web assets"
npm run build

echo "==> Generating native icons and splash screens"
npx @capacitor/assets generate --android \
  --iconBackgroundColor '#ffffff' \
  --splashBackgroundColor '#ffffff'

echo "==> Syncing Capacitor"
npx cap sync android

echo "==> Building release bundle"
cd android
./gradlew clean bundleRelease

AAB="app/build/outputs/bundle/release/app-release.aab"
if [ -f "$AAB" ]; then
  echo
  echo "Done: android/$AAB"
  echo "Upload this file in Google Play Console -> Production -> Create new release."
else
  echo "Build finished but the AAB was not found at android/$AAB" >&2
  exit 1
fi
