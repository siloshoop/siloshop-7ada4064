// Service Worker for Push Notifications

self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    
    const options = {
      body: data.body || "لديك إشعار جديد",
      icon: data.icon || "/pwa-192x192.png",
      badge: data.badge || "/pwa-192x192.png",
      vibrate: [100, 50, 100],
      data: data.data || {},
      actions: [
        { action: "open", title: "فتح" },
        { action: "close", title: "إغلاق" },
      ],
      dir: "rtl",
      lang: "ar",
    };

    event.waitUntil(
      self.registration.showNotification(data.title || "إشعار جديد", options)
    );
  } catch (error) {
    console.error("Push event error:", error);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "close") return;

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }
      // Open new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Handle subscription change
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    fetch("/api/push-subscription-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        oldEndpoint: event.oldSubscription?.endpoint,
        newSubscription: event.newSubscription?.toJSON(),
      }),
    })
  );
});