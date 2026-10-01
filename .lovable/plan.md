# Android responsiveness repair

## Implementation
- Correct the comparison page’s oversized fixed columns so two to four products remain usable through an intentional, bounded horizontal comparison area instead of cropping the whole page.
- Compact mobile headings, action rows, product cards, images, buttons, spacing, and table cells at narrow widths while preserving the current visual style and all actions.
- Audit and repair shared headers, search, bottom navigation, forms, dialogs, sheets, product details, grids, and administrative layouts for shrinkability, wrapping, safe areas, and viewport containment.
- Keep the current Android viewport and edge-to-edge safe-area behavior; adjust Capacitor/WebView settings only if verification shows a configuration defect.
- Make no database, authentication, order, product, currency, or business-logic changes.

## Verification
- Add responsive browser checks for 360px, 375px, 390px, and 412px portrait widths plus representative landscape sizes.
- Check representative public, comparison, search, product, form, seller, and administration pages for document-level horizontal overflow, clipped controls, and unusable dialogs.
- Run the existing tests, responsive checks, TypeScript validation, and the full production build.
- Validate the bundled Android web assets and Capacitor configuration where the local Android toolchain permits; report physical-device testing separately and never claim it without a device or emulator.

## Technical details
- Prefer responsive Tailwind sizing, `min-width: 0`, bounded scroll regions, smaller mobile-only spacing, and controlled wrapping rather than page scaling or global zoom.
- Preserve side-by-side comparison semantics and RTL behavior, with a visible horizontal scroll area only for the comparison matrix itself.
