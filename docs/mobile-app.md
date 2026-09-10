# SiloShop — Android (Google Play) & iOS app

The mobile app is the **same SiloShop code and backend** wrapped in a native shell (Capacitor).
No duplicate database, users, products or orders — everything reads/writes the same Lovable Cloud backend
with the same RLS, roles (buyer / seller / admin / super admin) and payment rules.

## Files
- `capacitor.config.ts` — app id `app.lovable.p456c8c161d24407ca1f5c7b374b1fe4d`, name `SiloShop`.
  The dev live-reload server is **opt-in** through `CAP_SERVER_URL`, so release builds are secure by default.
- `assets/icon.png`, `assets/splash.png`, `assets/splash-dark.png` — sources for native icons/splash.
- `src/lib/native.ts` — status bar, splash hide, Android hardware back button (no-op on the website).
- `src/lib/registerServiceWorker.ts` — skips the web service worker inside the native shell.

## First-time setup (on your computer)
1. Export to GitHub and `git pull` the project.
2. `npm install`
3. `npx cap add android` (and `npx cap add ios` for iPhone)
4. `npx @capacitor/assets generate --android --iconBackgroundColor '#ffffff' --splashBackgroundColor '#ffffff'`
5. `npm run build && npx cap sync`

Repeat step 5 after every `git pull`.

## Run on a device / emulator
- Release-like: `npx cap run android`
- With live reload from the Lovable sandbox:
  `CAP_SERVER_URL="https://456c8c16-1d24-407c-a1f5-c7b374b1fe4d.lovableproject.com?forceHideBadge=true" npx cap run android`

## Google Play release (AAB)
Signing needs your private keystore, so the bundle must be built on your machine.
Full copy/paste reference: [`docs/android-signing.md`](./android-signing.md).

Short version:
1. `keytool -genkey -v -keystore siloshop-upload.keystore -alias siloshop -keyalg RSA -keysize 2048 -validity 10000`
2. Create `android/keystore.properties` (never commit) and add the `signingConfigs.release`
   block from `docs/android-signing.md` to `android/app/build.gradle`.
3. Set `versionCode` / `versionName` for each upload.
4. `bash scripts/android-release.sh`
   → `android/app/build/outputs/bundle/release/app-release.aab`
5. Upload the AAB in Google Play Console → Production, and fill in store listing,
   privacy policy URL (`https://www.siloshop.net/privacy`), data safety and content rating.

## iOS
`npx cap add ios` → `npx cap sync ios` → open `ios/App/App.xcworkspace` in Xcode (Mac),
set Team + Bundle ID → Product → Archive → App Store Connect.

## Security notes
- Only the public backend URL and publishable key ship in the app (same as the website); all
  privileged logic stays in database functions and edge functions.
- `allowMixedContent: false` and `webContentsDebuggingEnabled: false` on Android release.
- The live-reload server block is absent unless `CAP_SERVER_URL` is set.

Guide: https://docs.lovable.dev/tips-tricks/mobile-apps
