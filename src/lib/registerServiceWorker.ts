/**
 * Single registrar for the app-shell service worker (/sw.js).
 *
 * The push messaging worker (/push-notifications-sw.js) has its own path and
 * scope and is intentionally untouched by everything in this file.
 */
const APP_SW_PATH = "/sw.js";

const isPreviewHost = (hostname: string) =>
  hostname.startsWith("id-preview--") ||
  hostname.startsWith("preview--") ||
  hostname === "lovableproject.com" ||
  hostname.endsWith(".lovableproject.com") ||
  hostname === "lovableproject-dev.com" ||
  hostname.endsWith(".lovableproject-dev.com") ||
  hostname === "beta.lovable.dev" ||
  hostname.endsWith(".beta.lovable.dev");

const shouldRegister = () => {
  if (!import.meta.env.PROD) return false;
  if (typeof window === "undefined") return false;
  if (window.top !== window.self) return false;
  if (isPreviewHost(window.location.hostname)) return false;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return false;
  return true;
};

const unregisterAppWorker = async () => {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    registrations
      .filter((r) => {
        const scriptURL =
          r.active?.scriptURL ?? r.waiting?.scriptURL ?? r.installing?.scriptURL ?? "";
        return scriptURL.endsWith(APP_SW_PATH);
      })
      .map((r) => r.unregister()),
  );
};

export const registerAppServiceWorker = () => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  if (!shouldRegister()) {
    void unregisterAppWorker().catch(() => undefined);
    return;
  }

  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(APP_SW_PATH, { scope: "/" }).catch(() => undefined);
  });
};
