# Mosque TV Display — React / Vite

A React + TypeScript + Vite port of the Flutter `flutter_app`, feature-for-feature.
It is an offline-first, installable **PWA** for displaying mosque prayer times on TVs,
tablets, and phones, with an embedded admin settings panel.

It is **wire-compatible** with the Flutter app: it reads/writes the identical Supabase
`config_json`, talks to the same tables, realtime channels, and PHP media server — so a
React display syncs in real time alongside existing Flutter displays on the same account.

## Features

- **Prayer engine** — `adhan` + `luxon` (IANA timezone) + Hijri (Intl Islamic calendar);
  per-prayer Adhan offsets & Iqamah waits, Friday Jumu'ah override, the full state machine
  (pre-adhan → adhan → iqamah countdown → post-prayer).
- **TV display** — orientation-aware background, default / full-screen / split / corner-overlay
  slideshow layouts, scrolling ticker, digital **or** analog clock, Gregorian + Hijri dates.
- **Alerts** — full-screen / dismissible / side-panel adhan & iqamah overlays + audio.
- **Settings panel** — PIN gate + 8 tabs (General, Location w/ Leaflet map, Prayer Offsets,
  Slideshow & Jumu'ah, Ticker, System Preferences, Media Library, Cloud & Sync), draft-then-save.
- **Cloud sync** — link / register / disconnect, version-gated pull/push, realtime config,
  device heartbeat.
- **Media library** — cloud upload (PHP server + `media_library`), import-from-device offline
  queue (IndexedDB), Cache-API offline caching, per-orientation backgrounds & slides.
- **i18n** — 33 locales + RTL (ar/ur/fa/ps), generated from the Flutter `.dart` translations.
- **PWA** — installable, service worker precaches the app shell + audio and runtime-caches media
  and map tiles for offline kiosk use.

## Develop

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # tsc + vite build (+ PWA service worker)
npm run preview      # serve the production build
npm run typecheck
```

## Notes

- Open settings by **triple-tapping** the screen or the bottom-right gear. Default admin PIN is
  `1234` (PIN gate is disabled by default; enable it in System Preferences).
- Forced orientation (System Preferences) is device-local; it uses the Screen Orientation API
  where supported and falls back to a CSS rotation for kiosks.
- Browsers block audio autoplay until a user gesture — the display shows a one-time
  "tap to enable sound" hint.

## Regenerating locales

Locale string maps under `src/i18n/locales/` are generated from the Flutter app's
`lib/l10n/*.dart` files:

```bash
node tools/gen-locales.mjs
```
