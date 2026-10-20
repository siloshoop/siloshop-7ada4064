# Production readiness audit

## Seller My Store settings
- [x] Inspect existing store fields, navigation, auth, RLS and storage: reused approved seller_applications; all 12 approved sellers have the protected vendor role, no duplicate approved profiles
- [x] Expose My Store at the top of seller navigation; add validation, safe loading/saving, upload busy guards and public business phone/address; guard server ownership, status and field limits without modifying saved business data
- [x] Verify isolated UI save/read-back and public storefront at 393/1280px with zero page errors/overflow; 195 tests pass, automatic build OK
- [ ] Verify live seller save, actual logo/cover storage upload and cross-seller/admin denial end-to-end (blocked: no authorized disposable seller test account; production profiles untouched)

## Independent product tracking
- [x] Merge saved product events immediately in buyer pages, recover subscription/reconnection gaps and guard overlapping detail reads; 184 tests pass. Real authenticated API rejects non-owner with NOT_ALLOWED. Saved detail/tracking pages checked at 393/1280px without overflow; actual seller-to-buyer mutation remains blocked below.
- [x] Restore secure seller-owned product updates, stage timestamps and deduplicated in-app notifications while retaining admin visibility.
- [x] Connect buyer/seller/admin tracking views to saved product state and live updates.
- [x] Run 180 automated tests; verify saved buyer tracking page at 393/1280px, live subscription, Arabic payment text, hidden default and nonexistent-item RPC rejection. Automatic typecheck/build passed.
- [ ] Verify actual seller/admin product updates, visible buyer timelines, simultaneous requests and notification deduplication end-to-end (blocked: all 182 saved orders have tracking disabled; no authorized disposable multi-account test orders, and production rows not changed for testing).
- [ ] Verify physical Android tracking (blocked: no device/emulator available; no Android release built).

## Currency display only
- [x] Correct currency presentation in products, orders, reports, seller/admin lists, comparison and exports; preserve storage, imports and payment logic
- [x] Verify real public USD $20 / SYP 25,000 product pages and mixed comparison signed out, 130 automated tests, no browser runtime errors, and automatic build OK
- [ ] Authenticated cart/checkout, seller/admin reports and invoice export end-to-end (blocked: no permitted test account used; owner's real account untouched)
- [ ] Public guest tracking and wallet currency completeness (blocked: existing payloads omit saved currency; displayed explicitly as unavailable, no database/payment changes)
- [ ] Separate TypeScript and explicit production-build verification (not run manually; platform automatic build OK only)

## Capacitor performance before installation
- [x] Measure public mobile loading three times before/after without the owner's account; total initial requests fell on home/search/categories, but measured load times did not improve consistently
- [x] Defer hidden menus/search lookups, share navigation queries, and coalesce in-flight product metadata without caching stock; preserve native inset setup before splash hide
- [x] Verify search → product without document reload (875ms measured), category drawer, desktop menu, sticky header, 124 unit tests, 40 responsive checks, and automatic build
- [ ] Physical Capacitor performance (blocked: no phone or emulator available)

## Compact mobile screen frame
- [x] Compact the mobile header without removing controls and preserve the fixed bottom bar
- [x] Verify stationary bars and drawer access at 360/375/390/412px, footer clearance in portrait/landscape, 40 responsive checks, 122 automated tests, and automatic build; native safe-area behavior still needs a physical device
- [ ] Physical Android frame verification (blocked: no physical device available)

## Product listing card layout
- [x] Apply large clean images, readable seller/rating/prices and saved-data badges consistently through shared listing cards; badges use saved featured/trending flags and real discounts, without invented rankings or sponsorship
- [x] Verify real homepage/search cards, loaded images, seller names, product navigation, no cart buttons, 360/375/390/412px without document overflow or JavaScript errors; 107 automated tests and automatic build passed

## Final checkout stock validation
- [x] Existing create_order rechecks saved stock with transaction row locks before order creation, checks summed repeated lines and selected variants; no functional changes needed
- [x] Authenticated real RPC rejected overstock, repeated overstock lines, zero-stock variant, missing variant, and zero-stock simple product; orders, stock and cart unchanged; all 104 automated tests passed

## Cart quantity stock limit
- [x] Validate cart quantities and saved-item transfers against fresh product/selected-variant stock and prevent overlapping cart quantity changes
- [x] Verify authenticated one-piece variant cart at 360/375/390/412px, rejected direct update to quantity 2 with saved quantity still 1, actual sold-out purchase block, 104 automated tests, and automatic build; temporary test cart row removed
- [ ] Physical Android verification (blocked: no device or emulator available)

## Order detail product images
- [x] Resolve stored image paths and recover broken snapshots in buyer/seller/admin details without changing orders or layout
- [x] Verify all three accessible saved seller order images, fallback unit tests, 360/375/390/412px, 91 automated tests, and automatic build; physical Android and other account roles were not tested

## Product listing stock consistency
- [x] Remove direct cart actions from product listing cards; preserve product detail purchase controls
- [x] Unify saved-stock indicators across listings and product options; real homepage/detail navigation and search at 360/375/390/412px passed, 86 tests and automatic build passed

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

## Top bar Home item + gradient wordmark
- [x] Add "الرئيسية" with home icon next to the logo in the top bar (both themes)
- [x] Paint the SiloShop wordmark with the logo's purple→pink→orange→yellow gradient via theme-aware tokens
- [x] Verify light/dark at 360/393/1280px, Home click navigates, no overflow or wrap, 130 tests, automatic build OK

## Flexible product image cropping
- [x] Extend existing crop tool with custom dimensions, ratios, fit/fill and quality-preserving output
- [x] Align seller/admin/variant product uploads with selected dimensions; product storage accepts 50MB, other limits unchanged
- [x] Isolated live dialog: original ratio, invalid dimensions, fit 600×900, fill 1200×1600 at 360/393/412px, cancellation and output image rendering; 135 tests and automatic build passed
- [ ] Authenticated storage upload, product form save/edit/read-back and live AI assessment (blocked: owner's account prohibited; no permitted test account supplied)
- [ ] Physical mobile/Capacitor and 8000×8000 device memory verification (blocked: no device available)

## Row-anchored product bulk actions
- [x] Reposition existing bulk toolbars beneath the last selected visible product, preserving selection and actions
- [x] Verify selection and deselection at 375/1280px with isolated product responses, no overlap or overflow; 168 automated tests and automatic build passed (live admin account not used)

## Coupon dates and product thumbnails
- [x] Validate optional local start/end dates before saving, preserve strict server ordering, and reuse existing image resolution/fallbacks
- [x] Browser verification at 375/1280px with Arabic locale and Damascus timezone: reject invalid ordering, submit/read back valid fixture coupon, load saved/secondary/placeholder images, no overflow; 175 tests pass plus date tests in Damascus/New York; live production creation and physical Android not tested

## Footer Google Play badge
- [x] Add the official Google Play badge to the footer next to the social icons, linking to https://play.google.com/store/apps/details?id=com.siloshop.app, clickable as a whole on mobile and desktop, without touching other functionality or the Android app
- [x] Verify live preview at 393px (2x phone density) and 1280px: badge rendered from the official 646x250 asset, right edge flush with the Facebook icon (RTL start alignment), every badge edge resolves to the store link, click opens the Play Store URL, zero horizontal overflow, 189 automated tests and automatic build OK; physical Android not tested

## Footer bottom-bar clearance
- [x] Reserve the fixed bottom bar plus a margin inside the footer on phones so its last item is never flush against the bar; desktop and tablet padding unchanged
- [x] Verify home, categories, product and contact at 393x660 (2x and 2.75x density, signed out and signed in, with a 24px bottom safe area): copyright and "حذف الحساب" fully above the bar, ~79px clearance, no overlap or horizontal overflow; 189 automated tests and automatic build OK; physical Android not tested
