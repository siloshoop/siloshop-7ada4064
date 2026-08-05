// Dedicated push worker. It never caches pages or application assets.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(self.registration.showNotification(data.title || "إشعار جديد", {
      body: data.body || "لديك إشعار جديد",
      icon: data.icon || "/pwa-192x192.png",
      badge: data.badge || "/pwa-192x192.png",
      vibrate: [100, 50, 100], data: data.data || {},
      actions: [{ action: "open", title: "فتح" }, { action: "close", title: "إغلاق" }],
      dir: "rtl", lang: "ar",
    }));
  } catch (error) { console.error("Push event error:", error); }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "close") return;
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
    const existing = clientList.find((client) => client.url === target && "focus" in client);
    return existing ? existing.focus() : clients.openWindow?.(target);
  }));
});