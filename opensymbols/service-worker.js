// Basic service worker that caches static assets and forwards/caches image API responses.
// Note: Update cache names as needed. The service worker assumes cross-origin requests to the CLOUD_FRONT domain are allowed.

const STATIC_CACHE = 'opensymbols-static-v1';
const IMAGE_CACHE = 'opensymbols-images-v1';
const API_BASE = 'https://d18vdu4p71yql0.cloudfront.net';

self.addEventListener('install', (ev) => {
  self.skipWaiting();
  ev.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll([
      '/', '/index.html', '/styles.css', '/app.js'
    ]))
  );
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  const url = new URL(req.url);

  // If the request is to the API base (images), use network-first then cache fallback
  if (req.url.startsWith(API_BASE)) {
    ev.respondWith(networkFirst(req));
    return;
  }

  // For same-origin navigation/static assets use cache-first
  if (req.mode === 'navigate' || req.destination === 'document' || req.destination === 'script' || req.destination === 'style') {
    ev.respondWith(caches.match(req).then(r => r || fetch(req)));
    return;
  }

  // Otherwise do a simple fetch
  ev.respondWith(fetch(req).catch(() => caches.match(req)));
});

async function networkFirst(req) {
  const cache = await caches.open(IMAGE_CACHE);
  try {
    const fresh = await fetch(req);
    // Only cache successful image responses (status 200)
    if (fresh && fresh.ok) {
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    return new Response('Network error', {status: 408});
  }
}
