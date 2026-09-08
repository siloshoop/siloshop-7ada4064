import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.p456c8c161d24407ca1f5c7b374b1fe4d",
  appName: "SiloShop",
  webDir: "dist",
  // Hot-reload from the Lovable sandbox during development.
  // Remove the `server` block (or point it at https://www.siloshop.net) for store builds.
  server: {
    url: "https://456c8c16-1d24-407c-a1f5-c7b374b1fe4d.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#ffffff",
  },
  android: {
    backgroundColor: "#ffffff",
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#ffffff",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#7C3AED",
    },
  },
};

export default config;
