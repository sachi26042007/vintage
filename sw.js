/**
 * VINTAGE CAMERA STUDIO — Service Worker
 *
 * Strategy: Cache-first for app shell & assets.
 * Network-first for Google Fonts (graceful degradation).
 * All processing is in-browser — no API calls needed.
 */

const CACHE_NAME    = 'vintagecam-v1';
const FONT_CACHE    = 'vintagecam-fonts-v1';

/* App shell files to cache on install */
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './js/presets.js',
  './js/filters.js',
  './js/app.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

/* ── Install: pre-cache the app shell ── */
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      /* Fail silently on individual resource errors */
      return Promise.allSettled(
        APP_SHELL.map(url =>
          cache.add(url).catch(e =>
            console.warn('[SW] Could not cache:', url, e)
          )
        )
      );
    })
  );
});

/* ── Activate: delete old caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(k => k !== CACHE_NAME && k !== FONT_CACHE)
            .map(k => {
              console.log('[SW] Deleting old cache:', k);
              return caches.delete(k);
            })
        )
      ),
      self.clients.claim()
    ])
  );
});

/* ── Fetch: serve from cache, fall back to network ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  /* Google Fonts — network-first, cache fallback */
  if (url.hostname === 'fonts.googleapis.com' ||
      url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(async cache => {
        try {
          const fresh = await fetch(event.request);
          cache.put(event.request, fresh.clone());
          return fresh;
        } catch {
          const cached = await cache.match(event.request);
          return cached || new Response('', { status: 408 });
        }
      })
    );
    return;
  }

  /* Everything else — cache-first */
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        /* Only cache same-origin successful GET responses */
        if (
          response.ok &&
          event.request.method === 'GET' &&
          url.origin === self.location.origin
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache =>
            cache.put(event.request, clone)
          );
        }
        return response;
      }).catch(() => {
        /* Offline fallback for navigation requests */
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
