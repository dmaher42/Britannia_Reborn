const SCRIPT_VERSION = new URL(self.location).searchParams.get('v') || 'static';
const CACHE_NAME = `br-cache-${SCRIPT_VERSION}`;
const PRECACHE_URLS = [
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

const isSameOrigin = (url) => {
  try {
    return new URL(url).origin === self.location.origin;
  } catch {
    return false;
  }
};

const canCacheResponse = (response) => response && response.ok && ['basic', 'cors'].includes(response.type);

async function cachePutSafe(cache, request, response) {
  if (!response || !canCacheResponse(response)) return;
  try {
    await cache.put(request, response.clone());
  } catch (err) {
    console.warn('[SW] Failed to update cache for', request.url, err);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      await cache.addAll(PRECACHE_URLS.map((url) => new Request(url, { cache: 'reload' })));
    } catch (err) {
      console.warn('[SW] Failed to precache some assets', err);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !isSameOrigin(request.url)) return;

  event.respondWith((async () => {
    try {
      if (request.mode === 'navigate') {
        return await handleNavigationRequest(request);
      }
      return await handleAssetRequest(request);
    } catch (err) {
      console.warn('[SW] Falling back after fetch handler failure', request.url, err);
      return respondWithFallback(request);
    }
  })());
});

async function handleNavigationRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    await cachePutSafe(cache, request, response);
    return response;
  } catch (err) {
    const fallback = (await cache.match(request)) || (await cache.match('./index.html'));
    if (fallback) {
      return fallback;
    }
    return new Response('Offline', {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

async function handleAssetRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    fetch(request).then((response) => cachePutSafe(cache, request, response)).catch((err) => {
      console.warn('[SW] Failed to refresh cached asset', request.url, err);
    });
    return cached;
  }

  try {
    const response = await fetch(request);
    await cachePutSafe(cache, request, response);
    return response;
  } catch (err) {
    console.warn('[SW] Network request failed; attempting cache fallback', request.url, err);
    return respondWithFallback(request);
  }
}

async function respondWithFallback(request) {
  let cache;
  try {
    cache = await caches.open(CACHE_NAME);
  } catch (err) {
    console.warn('[SW] Failed to open cache during fallback', err);
  }

  if (request.mode === 'navigate') {
    if (cache) {
      const cached = (await cache.match(request)) || (await cache.match('./index.html'));
      if (cached) {
        return cached;
      }
    }
    return new Response('Offline', {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  if (cache) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
  }

  return new Response('', {
    status: 503,
    statusText: 'Service Unavailable'
  });
}

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
