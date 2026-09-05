self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

function safeDestination(rawUrl) {
  try {
    const url = new URL(String(rawUrl || '/'), self.location.origin);
    return url.origin === self.location.origin ? `${url.pathname}${url.search}${url.hash}` : '/';
  } catch {
    return '/';
  }
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch {
    data = { title: 'GeeLark Flows', body: event.data?.text() || 'A new store update is available.' };
  }

  const destination = safeDestination(data.url);
  const title = String(data.title || 'GeeLark Flows').slice(0, 80);
  const body = String(data.body || 'A new store update is available.').slice(0, 280);
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: String(data.tag || data.notificationId || 'geelark-update').slice(0, 120),
    renotify: false,
    data: { url: destination },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destination = safeDestination(event.notification.data?.url);
  const targetUrl = new URL(destination, self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.navigate(targetUrl);
        return client.focus();
      }
    }
    return self.clients.openWindow(targetUrl);
  })());
});
