import { registerSW } from "virtual:pwa-register";

const APP_SW_PATH = "/sw.js";
const isPreviewHost = (hostname: string) =>
  hostname.startsWith("id-preview--") || hostname.startsWith("preview--") ||
  hostname === "lovableproject.com" || hostname.endsWith(".lovableproject.com") ||
  hostname === "lovableproject-dev.com" || hostname.endsWith(".lovableproject-dev.com") ||
  hostname === "beta.lovable.dev" || hostname.endsWith(".beta.lovable.dev");

const removeAppWorker = async () => {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.filter((registration) => {
    const scriptURL = registration.active?.scriptURL ?? registration.waiting?.scriptURL;
    return scriptURL ? new URL(scriptURL).pathname === APP_SW_PATH : false;
  }).map((registration) => registration.unregister()));
};

export const initializePwa = async () => {
  if (!("serviceWorker" in navigator)) return;
  const disabled = !import.meta.env.PROD || window.self !== window.top ||
    isPreviewHost(window.location.hostname) ||
    new URLSearchParams(window.location.search).get("sw") === "off";
  if (disabled) {
    await removeAppWorker();
    return;
  }
  registerSW({ immediate: true });
};