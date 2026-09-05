const CACHE_NAME = 'zarbolmasal-yar-v14';
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

// Serves a cached Response as a proper 206 Partial Content reply when the
// browser asks for a byte-range (audio/video elements always do this).
// Without this, cached audio files get skipped and re-fetched from the
// network every time, even though they're already stored.
async function serveRange(request, cachedResponse) {
  const rangeHeader = request.headers.get('range');
  const buffer = await cachedResponse.arrayBuffer();
  const totalLength = buffer.byteLength;

  const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
  const start = match ? parseInt(match[1], 10) : 0;
  const end = match && match[2] ? parseInt(match[2], 10) : totalLength - 1;
  const chunk = buffer.slice(start, end + 1);

  return new Response(chunk, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': cachedResponse.headers.get('content-type') || 'application/octet-stream',
      'Content-Range': `bytes ${start}-${end}/${totalLength}`,
      'Content-Length': chunk.byteLength,
      'Accept-Ranges': 'bytes'
    }
  });
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        if (event.request.headers.has('range')) {
          return serveRange(event.request, cached);
        }
        return cached;
      }

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
