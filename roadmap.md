# Production readiness audit

## Footer and page navigation
- [x] Move store-opening button to the end of Customer Service
- [x] Reset page scroll on opening, forward/back navigation, and reload; desktop/mobile browser checks, 82 tests and automatic build passed

## Stock availability
- [x] Apply locked sold-out options and consistent seller/buyer product status
- [x] Enforce saved-stock purchase guards and automatic cart/favorites removal
- [x] Verify real seller restock/sell-out, saved cart/checkout options, database rejection guards, 360/375/390/412px and landscape, 80 automated tests and automatic build
- [ ] Verify physical Android stock behavior (blocked: no device or emulator available)

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
## Current Android UI and navigation pass

- [x] Fix shared safe-area spacing, RTL wrapping, and viewport overflow
- [x] Fix product-card mobile alignment and action layout
- [x] Fix login/register and Android hardware Back navigation history
- [x] Verify representative pages at small/large portrait and landscape Android sizes

## Physical Android device verification

- [ ] Build and upload the current Android WebView APK to a real-device cloud
- [ ] Verify RTL, safe areas, margins, and overflow on small and large Android phones
- [ ] Verify system Back across Home, Login, Register, product, cart, and modal flows
- [ ] Record device models, Android versions, screenshots, and any remaining blocker

## Fixed mobile bars and footer clearance

- [x] Unify safe-area and content heights for mobile navigation and product purchase bars
- [x] Reserve the exact fixed-bar height after page footers, including preview-only product notices
- [x] Run automated footer visibility and click-clearance checks across Android portrait and landscape sizes

## Comprehensive mobile overlap repair

- [x] Fix overlapping headings, controls, product rows, form actions, and footer content shown in Android screenshots
- [x] Apply safe shared wrapping and shrinking rules to Arabic text and interactive controls without visual redesign
- [x] Audit representative public, buyer, seller, and admin screens at narrow Android widths
- [x] Run automated tests and verify corrected screens visually

## Android responsive density and comparison repair

- [x] Contain and compact the comparison matrix at 360–412px without page-level cropping
- [x] Compact shared mobile cards, controls, overlays, search, product details, and seller layouts
- [x] Verify portrait and landscape Android viewports, existing tests, and production build status

## Share & export centralization
- [x] Central share (src/lib/share.ts) and export (src/lib/exportFile.ts) utilities; all callers migrated; tests added

## Mobile chat clipping repair
- [x] Bound chat and inbox height; reserve non-shrinking composer and header space
- [x] Verify chat controls at 360, 375, 390, and 412px with an isolated empty-thread fixture; all 63 existing tests and automatic build passed
- [ ] Physical Android chat verification (blocked: no device or emulator available)

## Seller shipment tracking page
- [x] Render independent saved seller shipments with vertical RTL timelines and product details
- [x] Verify completed/current/future states, independent refresh/reload, 360/375/390/412px plus landscape, 71 automated tests, and automatic build using isolated signed-in browser fixtures
- [ ] Verify real saved multi-seller order end to end (blocked: available account has no orders; no customer orders changed for testing)
- [ ] Verify tracking on physical Android/PWA installation (blocked: no device or emulator available)
