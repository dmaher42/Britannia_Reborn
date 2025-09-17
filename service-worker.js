const CACHE_VERSION = new URL(self.location).searchParams.get('v') || `${self.registration.scope}-${Date.now()}`;
const CACHE_NAME = `br-cache-${CACHE_VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './main.js',
  './world.js',
  './party.js',
  './inventory.js',
  './spells.js',
  './combat.js',
  './ui.js',
  './ai.js',
  './selection.js',
  './style.css',
  './renderer.js',
  './world3d.js',
  './controls.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      await cache.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })));
    } catch (err) {
      console.warn('[SW] Failed to precache some assets', err);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

const isSameOrigin = (url) => new URL(url).origin === location.origin;

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !isSameOrigin(request.url)) return;

  const url = new URL(request.url);
  const isHTML = request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  const isMain = url.pathname.endsWith('/main.js');

  if (isHTML || isMain) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request, { cache: 'no-store' });
        const cache = await caches.open(CACHE_NAME);
        try {
          await cache.put(request, fresh.clone());
        } catch (err) {
          console.warn('[SW] Failed to update cache for', request.url, err);
        }
        return fresh;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        return cached || new Response('Offline', {
          status: 503,
          statusText: 'Offline',
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const fresh = await fetch(request);
      try {
        await cache.put(request, fresh.clone());
      } catch (err) {
        console.warn('[SW] Failed to cache', request.url, err);
      }
      return fresh;
    } catch {
      return cached || new Response('', {
        status: 503,
        statusText: 'Service Unavailable'
      });
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

