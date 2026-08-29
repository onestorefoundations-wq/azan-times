/**
 * m-sw.js
 * Service worker for the congregation's prayer-times page (scope /m).
 *
 * Runtime caching rather than a precache manifest: this worker is a static file
 * so it cannot know the build's hashed asset names, and caching on first visit
 * is enough here — someone scans the QR at the mosque, and the page works
 * offline from then on. Prayer data is separately cached in localStorage, so
 * times still render even on a cold start with no network.
 *
 * Deliberately does NOT touch the display's assets. The TV's Workbox worker has
 * scope '/', but it is only ever registered from the display entry, which a
 * phone opening /m never loads.
 */
const CACHE = 'masjid-public-v1';

// Navigations fall back to this so a deep link like /m/central-mosque still
// boots offline; the slug is read from the URL at runtime, not from the shell.
const SHELL = '/masjid.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Prayer settings come from the Edge Function and are cached in localStorage
  // by the page itself, so let those requests go straight to the network.
  if (url.pathname.startsWith('/functions/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(SHELL).then((r) => r ?? Response.error())));
    return;
  }

  // Stale-while-revalidate for the shell's own assets.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return response;
        })
        .catch(() => cached ?? Response.error());
      return cached ?? network;
    }),
  );
});
