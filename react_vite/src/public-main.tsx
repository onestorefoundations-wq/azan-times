/**
 * public-main.tsx
 * Entry point for the congregation's prayer-times page (masjid.html).
 *
 * Separate from the display's entry on purpose. The TV bundle carries adhan
 * audio, fonts, Leaflet and the whole settings panel — several megabytes a
 * phone would otherwise download to read a table of times. Sharing an entry
 * also meant the display's code was one router mistake away from a page that is
 * supposed to be read-only.
 *
 * The slug comes from the path, so this entry needs no router at all.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import PublicTimes from './pages/PublicTimes';

/** `/m/central-mosque` → `central-mosque`; `/m` or `/m/` → null. */
function slugFromPath(): string | null {
  const match = /^\/m\/([^/?#]+)/.exec(window.location.pathname);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]).toLowerCase();
  } catch {
    return match[1].toLowerCase();
  }
}

/**
 * A small runtime-caching service worker rather than a precache manifest: the
 * asset names are hashed at build time, and caching on first visit is enough
 * here — someone scans the QR at the mosque, and the page works offline after
 * that. The prayer data itself already lives in localStorage.
 */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/m-sw.js', { scope: '/m' })
      .catch((e) => console.warn('[PublicTimes] service worker registration failed', e));
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PublicTimes slug={slugFromPath()} />
  </React.StrictMode>,
);

registerServiceWorker();
