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
  './style.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })));
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
        cache.put(request, fresh.clone());
        return fresh;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        return cached || new Response('Offline', { status: 503 });
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
      cache.put(request, fresh.clone());
      return fresh;
    } catch {
      return cached || Response.error();
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

