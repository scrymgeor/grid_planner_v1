// Grid Background Web Push Service Worker Script
// Loaded via workbox.importScripts so push notifications wake the device
// and appear on the lock screen even when the app is completely closed.

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Grid Deadline Alert',
    body: 'You have an upcoming deadline in Grid.',
    tag: 'grid-push',
    url: '/',
    urgent: false,
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      const text = event.data.text();
      if (text) payload.body = text;
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: payload.tag || 'grid-push',
      renotify: true,
      requireInteraction: Boolean(payload.urgent),
      vibrate: payload.urgent ? [200, 100, 200, 100, 200] : [150, 80, 150],
      data: {
        url: payload.url || '/',
      },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
