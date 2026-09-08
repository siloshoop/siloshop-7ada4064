const SW_URL = "/sw.js";

const isPreviewHost = (hostname: string) =>
  hostname.startsWith("id-preview--") ||
  hostname.startsWith("preview--") ||
  hostname === "lovableproject.com" ||
  hostname.endsWith(".lovableproject.com") ||
  hostname === "lovableproject-dev.com" ||
  hostname.endsWith(".lovableproject-dev.com") ||
  hostname === "beta.lovable.dev" ||
  hostname.endsWith(".beta.lovable.dev");

const unregisterAppWorkers = async () => {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    registrations
      .filter((r) => {
        const url = r.active?.scriptURL ?? r.installing?.scriptURL ?? r.waiting?.scriptURL ?? "";
        return url.endsWith(SW_URL);
      })
      .map((r) => r.unregister()),
  );
};

/**
 * Registers the generated app-shell service worker only in the real published site.
 * Preview/dev/iframe contexts are refused (and cleaned up) so stale HTML is never served.
 * The dedicated push worker lives at another path/scope and is untouched here.
 */
export const registerServiceWorker = () => {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const swOff = new URLSearchParams(window.location.search).get("sw") === "off";
  const inIframe = window.self !== window.top;
  const refused = !import.meta.env.PROD || inIframe || swOff || isPreviewHost(window.location.hostname);

  if (refused) {
    void unregisterAppWorkers();
    return;
  }

  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(SW_URL, { scope: "/" }).catch(() => undefined);
  });
};
