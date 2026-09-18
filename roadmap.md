# Production readiness audit

- [x] Fix global responsive, RTL, safe-area, and viewport behavior
- [x] Fix logo and production asset fallbacks
- [x] Fix shared overlays, navigation, cards, and touch behavior
- [x] Fix page-specific mobile clipping in product, forms, admin, and seller screens
- [x] Validate TypeScript, lint, tests, production build, Capacitor config, assets, and responsive routes
- [x] Review active storage finding; public store branding retained by explicit product decision

## Android compatibility re-verification

- [x] Re-audit every route family at small, large, portrait, and landscape Android sizes
- [x] Fix remaining safe-area, bottom-navigation, RTL, asset, and overflow defects
- [x] Re-run authenticated and public browser checks plus Android source validation
- [x] Record remaining device-only or toolchain limitations

### Native build verification

- [x] JDK 21 + Android SDK 36 installed; `./gradlew assembleDebug` and `./gradlew bundleRelease` both succeed
- [x] Release bundle contains web assets, launcher icons, splash resources, and Capacitor config
- [x] Bundle signing verified with a throwaway test key (real release key stays on the owner's machine)
- [x] 77 checks over the bundled Android assets in an Android WebView user agent at 320×640, 360×800, 373×812, 412×915, 480×960, 800×360, 915×412: no overflow, clipping, broken images, or page errors
- [x] Fixed collapsed header navigation row at widths ≥768px (landscape)

### Remaining owner-only step

- Signed production AAB must be built locally with the private upload keystore (`docs/android-signing.md`).

## Banner and campaign visibility

- [ ] Fix responsive banner image/text separation
- [ ] Render active native ads in all configured placements
- [ ] Add campaign date controls and status visibility in admin
- [ ] Verify database reads, live activation, images, and responsive layouts
