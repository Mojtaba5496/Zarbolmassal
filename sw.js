const CACHE_NAME = 'zarbolmasal-yar-v12';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './background.jpg',
  './bg-music.mp3',
  './afarin.m4a'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache each asset separately so one failed file (e.g. a network
      // hiccup on the big mp3) doesn't stop everything else from being
      // cached. Without this, cache.addAll() fails all-or-nothing and the
      // app ends up needing internet + a fresh download every single time.
      return Promise.allSettled(
        ASSETS.map((url) =>
          fetch(url).then((res) => {
            if (res && res.ok) return cache.put(url, res);
          }).catch(() => {})
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      // Not cached yet (e.g. install-time caching missed it) — fetch from
      // the network, and if it succeeds, store a copy for next time so the
      // app doesn't need internet again for the same file.
      return fetch(event.request).then((res) => {
        if (res && res.ok && event.request.url.startsWith(self.location.origin)) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return res;
      });
    })
  );
});
