// Network-only service worker used to keep registration hooks alive while placeholder graphics load.
// Ensures fetch handlers always resolve with a valid Response to avoid TypeError: Failed to convert value to 'Response'.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const preloaded = await event.preloadResponse;
        if (preloaded) {
          return preloaded;
        }
      } catch (error) {
        console.debug('[service-worker] preloadResponse failed', error);
      }

      try {
        return await fetch(event.request);
      } catch (error) {
        console.warn('[service-worker] Network request failed; returning offline response.', error);
        if (event.request.mode === 'navigate') {
          return new Response(
            '<!doctype html><title>Offline</title><body><h1>Offline</h1><p>The game is currently unavailable offline.</p></body>',
            {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            },
          );
        }
        return new Response('', { status: 503, statusText: 'Service Unavailable' });
      }
    })(),
  );
});
