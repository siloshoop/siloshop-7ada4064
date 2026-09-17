// One-release cleanup for the previous Workbox app-shell worker.
// Push notifications use /push-notifications-sw.js and are intentionally untouched.
const isAppShellCache = (name) =>
  (/workbox|precache|siloshop-pages|siloshop-versioned-assets|runtime/i.test(name));

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      const cacheNames = await caches.keys();
      await Promise.allSettled(cacheNames.filter(isAppShellCache).map((name) => caches.delete(name)));
      await self.clients.claim();
      const clients = await self.clients.matchAll({ type: "window" });
      await Promise.allSettled(clients.map((client) => client.navigate(client.url)));
    } finally {
      await self.registration.unregister();
    }
  })());
});