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

- [x] Fix responsive banner image/text separation
- [x] Render active native ads in all configured placements
- [x] Add campaign date controls and status visibility in admin
- [x] Verify database reads, live activation, images, and responsive layouts

## Device image uploads

- [x] Inventory every image-capable form and existing upload path
- [x] Add shared URL + device upload controls with preview, replace, and delete
- [x] Integrate across admin, vendor, profile, review, return, and messaging image forms
- [x] Verify Android-compatible file selection, responsive previews, storage cleanup, and existing URL flows
- [x] Confirm subscription and points systems remain untouched

## Admin action reliability

- [x] Fix product flag authorization function signature
- [x] Unify user ban and activation behind audited admin actions
- [x] Fix force-logout authentication for opaque server keys
- [x] Verify database admin boundary; non-admin product action correctly returns not_authorized
- [ ] Verify privileged admin mutations end to end (blocked: available test session is not an admin)

## Activation toggle reliability

- [ ] Trace admin mutations and public visibility filters for every toggle-backed section
- [ ] Fix persistence, immediate refresh, and clear feedback without touching subscriptions or balances
- [ ] Verify database policies and desktop/mobile/Android-visible behavior

## Google Play demo catalog

- [x] Add 20 clearly labeled TEST DATA products across active categories and brands
- [x] Verify database persistence and public visibility without touching subscriptions or balances
- [x] Test product display on desktop, mobile, and Android WebView sizes
