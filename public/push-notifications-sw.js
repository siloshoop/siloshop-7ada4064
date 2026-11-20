// Dedicated push worker. It never caches pages or application assets.
// Accepts Firebase Cloud Messaging data messages ({ data: { title, body, url, tag } })
// and plain JSON payloads ({ title, body, data: { url } }).
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); } catch { payload = { body: event.data.text() }; }
  const fcm = payload.data && typeof payload.data === "object" && typeof payload.data.title === "string" ? payload.data : null;
  const title = (fcm && fcm.title) || (payload.notification && payload.notification.title) || payload.title || "SiloShop";
  const body = (fcm && fcm.body) || (payload.notification && payload.notification.body) || payload.body || "لديك إشعار جديد";
  const url = (fcm && fcm.url) || (payload.data && payload.data.url) || "/notifications";
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: payload.icon || "/pwa-192x192.png",
    badge: payload.badge || "/pwa-192x192.png",
    tag: (fcm && fcm.tag) || undefined,
    vibrate: [100, 50, 100],
    data: { url },
    actions: [{ action: "open", title: "فتح" }, { action: "close", title: "إغلاق" }],
    dir: "rtl", lang: "ar",
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "close") return;
  const raw = event.notification.data && event.notification.data.url;
  const path = typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/notifications";
  const target = new URL(path, self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
    const existing = clientList.find((client) => client.url === target && "focus" in client);
    if (existing) return existing.focus();
    const any = clientList.find((client) => "navigate" in client && "focus" in client);
    if (any) return any.navigate(target).then((c) => c && c.focus());
    return clients.openWindow && clients.openWindow(target);
  }));
});
