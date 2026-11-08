# src architecture rules
- In the Android app, WebView textZoom stays 100% and FontScalePlugin's system fontScale (clamped, src/lib/appFontScale.ts) scales the root font size; fixed text sizes use rem and enlarged-only layout tweaks use the `scaled:` variant, so text, fields and images grow together without changing the normal-size design.
