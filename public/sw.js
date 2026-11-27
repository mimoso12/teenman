/* Public installation assets only. Never cache pages, credentials, APIs or media. */
const CACHE = 'teenman-pwa-v1';
const ASSETS = ['/offline.html', '/manifest.json', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('teenman-pwa-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.open(CACHE)).match('/offline.html').then(response => response || new Response('Sem conexão. Conecte-se à internet e tente novamente.', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}}))));
    return;
  }
  if (!ASSETS.includes(url.pathname) || url.search) return;
  event.respondWith(fetch(request).then(async response => {
    if (response.ok) { try { const cache = await caches.open(CACHE); await cache.put(request, response.clone()); } catch { /* Storage limits do not break online requests. */ } }
    return response;
  }).catch(async () => (await caches.open(CACHE)).match(request).then(response => response || Response.error())));
});

function pushDestination(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x20]/.test(value)) return '/notifications';
  try {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin ? url.pathname + url.search : '/notifications';
  } catch { return '/notifications'; }
}
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* A malformed payload still gets a safe visible alert. */ }
  if (!data || typeof data !== 'object') data = {};
  const title = typeof data.title === 'string' ? data.title.slice(0, 80) : 'Teenman';
  const body = typeof data.body === 'string' ? data.body.slice(0, 240) : 'Você recebeu uma nova notificação.';
  event.waitUntil(self.registration.showNotification(title, {
    body, icon: '/icon-192.png', badge: '/icon-192.png',
    tag: typeof data.tag === 'string' ? 'teenman-' + data.tag.slice(0, 80) : 'teenman-update',
    data: {url: pushDestination(data.url)},
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const path = pushDestination(event.notification.data?.url);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
    const target = new URL(path, self.location.origin).href;
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      // Client navigation preserves the global Spotify player.
      if (client.url !== target) client.postMessage({type: 'TEENMAN_PUSH_NAVIGATE', url: path});
      await client.focus(); return;
    }
    await self.clients.openWindow(target);
  })());
});
