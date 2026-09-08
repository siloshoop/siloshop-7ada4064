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
1. `npm run build && npx cap sync android` (no `CAP_SERVER_URL` — the app must ship bundled `dist/`).
2. Create an upload keystore once:
   ```
   keytool -genkey -v -keystore siloshop-upload.keystore -alias siloshop \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
3. In `android/`, create `keystore.properties` (never commit it):
   ```
   storeFile=../siloshop-upload.keystore
   storePassword=****
   keyAlias=siloshop
   keyPassword=****
   ```
   and reference it from `android/app/build.gradle` `signingConfigs.release`.
4. Set `versionCode` / `versionName` in `android/app/build.gradle` for each upload.
5. Build the bundle: `cd android && ./gradlew bundleRelease`
   → `android/app/build/outputs/bundle/release/app-release.aab`
6. Upload the AAB in Google Play Console → Production, and fill in store listing,
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
