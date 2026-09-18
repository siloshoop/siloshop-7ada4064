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

### Validation limits

- Browser viewport coverage completed at 320×640, 360×800, 373×812, 412×915, 480×960, and 740×360.
- Native icons and splash resources validate successfully, and Capacitor 8 SystemBars CSS inset handling is configured.
- A native Gradle/AAB build still requires a local JDK, Android SDK, and release keystore; this environment has no `JAVA_HOME`.
