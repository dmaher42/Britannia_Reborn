const CACHE_VERSION = 'v1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const ASSETS = [
  'index.html',
  'style.css',
  'main.js',
  'world.js',
  'party.js',
  'inventory.js',
  'spells.js',
  'combat.js',
  'ui.js',
  'ai.js',
  'selection.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache =>
      Promise.all(
        ASSETS.map(url =>
          cache.add(url).catch(err =>
            console.warn('Failed to cache', url, err)
          )
        )
      )
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== STATIC_CACHE).map(key => caches.delete(key))
    ))
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Match typical static asset extensions
  const assetRegex = /\.(?:html|js|css|png|jpg|jpeg|gif|svg)$/;
  if (assetRegex.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(res => {
        return res || fetch(event.request).then(response => {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(event.request, copy));
          return response;
        });
      })
    );
  }
});
