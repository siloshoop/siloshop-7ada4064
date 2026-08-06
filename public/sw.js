// One-release cleanup worker for the retired app-shell cache.
// The dedicated push worker uses a different path/scope and is not affected.
function isRetiredSiloShopCache(name) {
  return name === "siloshop-pages" ||
    name === "siloshop-versioned-assets" ||
    /(^|-)precache-v\d+-|(^|-)runtime-/.test(name);
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      const cacheNames = await caches.keys();
      const retiredCaches = cacheNames.filter(isRetiredSiloShopCache);
      await Promise.allSettled(retiredCaches.map((name) => caches.delete(name)));
      await self.clients.claim();
      const windows = await self.clients.matchAll({ type: "window" });
      await Promise.allSettled(windows.map((client) => client.navigate(client.url)));
    } finally {
      await self.registration.unregister();
    }
  })());
});