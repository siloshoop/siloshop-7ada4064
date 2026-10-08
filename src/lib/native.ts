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

    // Hide splash screen as soon as plugins are loaded and React has likely
    // completed its first meaningful paint.
    void SplashScreen.hide().catch(() => undefined);

    // Non-critical native UI adjustments are performed without awaiting to avoid
    // blocking the splash screen hide or app interactive state.
    void SystemBars.setStyle({ style: SystemBarsStyle.Light }).catch(() => undefined);
    void SystemBars.show().catch(() => undefined);

    void StatusBar.setOverlaysWebView({ overlay: true }).catch(() => undefined);
    void StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);
    if (Capacitor.getPlatform() === "android") {
      void StatusBar.setBackgroundColor({ color: "#7C3AED" }).catch(() => undefined);
    }

    // Keep the stored Supabase session alive across app close/reopen and
    // background/foreground cycles. Data itself always comes from Supabase.
    void supabase.auth.startAutoRefresh().catch(() => undefined);
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
  } catch {
    // Plugins unavailable – ignore.
  }
};
