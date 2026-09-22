import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Live-reload from the Lovable sandbox is opt-in via CAP_SERVER_URL.
 * Release (Play Store / App Store) builds run without it and ship the bundled `dist/`,
 * talking to the exact same backend as www.siloshop.net.
 *
 *   Dev:     CAP_SERVER_URL="https://456c8c16-1d24-407c-a1f5-c7b374b1fe4d.lovableproject.com?forceHideBadge=true" npx cap run android
 *   Release: npm run build && npx cap sync android
 */
const devServerUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.siloshop.app",
  appName: "SiloShop",
  webDir: "dist",
  ...(devServerUrl
    ? { server: { url: devServerUrl, cleartext: true } }
    : {}),
  ios: {
    contentInset: "always",
    backgroundColor: "#ffffff",
  },
  android: {
    backgroundColor: "#ffffff",
    allowMixedContent: false,
    // Release builds must never fall back to plain HTTP.
    webContentsDebuggingEnabled: false,
    // Secure origin (https://localhost) so localStorage — and therefore the
    // Supabase session — persists across app restarts.
    androidScheme: "https",
  },
  plugins: {
    SystemBars: {
      // Capacitor 8 injects --safe-area-inset-* values for Android 15+
      // and consumes native insets on older WebViews when necessary.
      insetsHandling: "css",
      style: "LIGHT",
    },
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#ffffff",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#7C3AED",
      // The WebView draws edge-to-edge and CSS consumes the exact native
      // insets once. Keeping overlaysWebView false would reserve them twice.
      overlaysWebView: true,
    },
  },
};

export default config;
