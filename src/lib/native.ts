import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

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

    // Capacitor 8 exposes Android system-bar insets as
    // --safe-area-inset-* CSS variables when viewport-fit=cover is present.
    await SystemBars.setStyle({ style: SystemBarsStyle.Light }).catch(() => undefined);
    await SystemBars.show().catch(() => undefined);

    await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => undefined);
    await StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);
    if (Capacitor.getPlatform() === "android") {
      await StatusBar.setBackgroundColor({ color: "#7C3AED" }).catch(() => undefined);
    }

    // Keep the stored Supabase session alive across app close/reopen and
    // background/foreground cycles. Data itself always comes from Supabase.
    supabase.auth.startAutoRefresh().catch(() => undefined);
    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        void supabase.auth.startAutoRefresh().catch(() => undefined);
        void supabase.auth.getSession().catch(() => undefined);
      } else {
        void supabase.auth.stopAutoRefresh().catch(() => undefined);
      }
    });

    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack && window.location.pathname !== "/") {
        window.history.back();
      } else if (/^\/(auth|forgot-password|verify-email|reset-password)/.test(window.location.pathname)) {
        window.location.assign("/");
      } else {
        void App.exitApp();
      }
    });

    await SplashScreen.hide().catch(() => undefined);
  } catch {
    // Plugins unavailable – ignore.
  }
};
