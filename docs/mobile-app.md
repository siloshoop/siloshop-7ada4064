# SiloShop — Android & iOS app (Capacitor)

The mobile app is the **same SiloShop code and backend** wrapped in a native shell.
No duplicate database, users, products or orders — everything reads/writes the same Lovable Cloud backend
with the same RLS, roles (buyer / seller / admin / super admin), COD vs Sham Cash rules and seller approval.

## Files
- `capacitor.config.ts` — app id `app.lovable.p456c8c161d24407ca1f5c7b374b1fe4d`, name `SiloShop`.
- `src/lib/native.ts` — status bar, splash, Android back button (no-op on the website).
- `src/lib/registerServiceWorker.ts` — skips the web service worker inside the native shell.

## Build on your computer
1. Export to GitHub and `git pull` the project.
2. `npm install`
3. `npx cap add android` and/or `npx cap add ios`
4. `npx cap update android` / `npx cap update ios`
5. `npm run build`
6. `npx cap sync`
7. `npx cap run android` (Android Studio) or `npx cap run ios` (Mac + Xcode)

Repeat steps 5–6 after every `git pull`.

## Production (store) builds
In `capacitor.config.ts` **remove the `server` block** (it hot-reloads from the Lovable sandbox during development)
so the app ships the bundled `dist/` and talks to the same backend. Then:
- Android: open `android/` in Android Studio → Build → Generate Signed Bundle (AAB) → Google Play Console.
- iOS: open `ios/App/App.xcworkspace` in Xcode → set Team/Bundle ID → Product → Archive → App Store Connect.

App icons/splash: run `npx @capacitor/assets generate --iconBackgroundColor '#ffffff' --splashBackgroundColor '#ffffff'`
using `public/pwa-512x512.png` as the source (`assets/icon.png`, `assets/splash.png`).

Guide: https://docs.lovable.dev/tips-tricks/mobile-apps
