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
