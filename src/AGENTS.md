# src architecture rules
- In the Android app, WebView textZoom stays 100% and FontScalePlugin's system fontScale (clamped, src/lib/appFontScale.ts) scales the root font size; fixed text sizes use rem and enlarged-only layout tweaks use the `scaled:` variant, so text, fields and images grow together without changing the normal-size design.
- Canonical tags always use the www production origin: RouteCanonical sets one per path inside BrowserRouter (pages may override), and Android App Links claim only www.siloshop.net because the bare domain redirects and Android rejects redirecting hosts.
