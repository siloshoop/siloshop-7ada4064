import { Capacitor } from "@capacitor/core";

/** True only when running inside the Android/iOS Capacitor shell. */
export const isNativeApp = () => Capacitor.isNativePlatform();

/**
 * Native-only bootstrap: status bar colour, splash hide and Android hardware back.
 * No-op on the website so browser behaviour is unchanged.
 */
export const initNativeApp = async () => {
  if (!isNativeApp()) return;
  try {
    const [{ App }, { StatusBar, Style }, { SplashScreen }] = await Promise.all([
      import("@capacitor/app"),
      import("@capacitor/status-bar"),
      import("@capacitor/splash-screen"),
    ]);

    await StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);
    if (Capacitor.getPlatform() === "android") {
      await StatusBar.setBackgroundColor({ color: "#7C3AED" }).catch(() => undefined);
    }

    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack && window.location.pathname !== "/") {
        window.history.back();
      } else {
        void App.exitApp();
      }
    });

    await SplashScreen.hide().catch(() => undefined);
  } catch {
    // Plugins unavailable – ignore.
  }
};
