import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

// Stamped once per build — used by useAppUpdate to detect new deployments.
const BUILD_TIME = new Date().toISOString();

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    // Replaced at build time; useAppUpdate compares this to /version.json
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        // The TV display.
        main: path.resolve(__dirname, 'index.html'),
        // The congregation's read-only prayer-times page. A separate entry so a
        // phone does not download the display's adhan audio, fonts, Leaflet and
        // settings panel just to read a table of times.
        masjid: path.resolve(__dirname, 'masjid.html'),
        // The public landing / about page. Not at '/' because that is the TV
        // display and deployed kiosks point at it.
        about: path.resolve(__dirname, 'about.html'),
      },
    },
  },
  plugins: [
    // Write /version.json into dist after every build so pollers can detect new deploys.
    {
      name: 'version-json',
      closeBundle() {
        writeFileSync('dist/version.json', JSON.stringify({ v: BUILD_TIME }));
      },
    },
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registered by hand in main.tsx. Left on 'auto' the plugin injects the
      // display's service worker and manifest into every HTML entry, including
      // the congregation page, which has its own lightweight worker.
      injectRegister: false,
      includeAssets: ['audio/*.mp3', 'fonts/*', 'icons/*'],
      manifest: {
        name: 'Mosque TV Display',
        short_name: 'MosqueTV',
        description: 'Islamic Digital Signage - Prayer Time Display',
        theme_color: '#0F172A',
        background_color: '#0F172A',
        display: 'fullscreen',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The display's worker has scope '/', and its navigation fallback
        // serves the cached index.html for ANY navigation in the origin. Once a
        // device had loaded the display even once, /about and /m/<slug> then
        // rendered the TV display instead of their own entries -- invisible to
        // curl, which bypasses service workers, and only reproducible in a real
        // browser. These two paths are separate entries and must reach the
        // network (and their own rewrites) rather than the display's shell.
        navigateFallbackDenylist: [/^\/about(\/|$)/, /^\/m(\/|$)/],
        globPatterns: ['**/*.{js,css,html,mp3,woff2,ttf,png,svg}'],
        // Never precache version.json — it must always be fetched from the network.
        // masjid.html is the congregation entry; its own worker caches it at
        // runtime, and the display must never precache or serve it.
        globIgnores: ['**/version.json', '**/masjid.html', '**/about.html'],
        runtimeCaching: [
          {
            // version.json must NEVER be served from cache — always network.
            urlPattern: /\/version\.json(\?.*)?$/,
            handler: 'NetworkOnly',
          },
          {
            // Cache uploaded media (PHP server + any https image) for offline display
            urlPattern: /^https:\/\/expertai\.co\.uk\/.*\.(?:png|jpg|jpeg|gif|webp|bmp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'media-images',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // OpenStreetMap tiles for the location picker
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
    // `vite dev` serves index.html for any unknown path, so without this /m/<slug>
    // would render the display in development while serving the congregation
    // page in production. Mirrors the _redirects / vercel.json rewrites.
    {
      name: 'dev-serve-extra-entries',
      configureServer(server: { middlewares: { use: (fn: any) => void } }) {
        server.middlewares.use((req: any, _res: any, next: any) => {
          if (req.url && /^\/m(\/|$|\?)/.test(req.url)) req.url = '/masjid.html';
          else if (req.url && /^\/about(\/|$|\?)/.test(req.url)) req.url = '/about.html';
          next();
        });
      },
    },
    // VitePWA injects the display's manifest link into every HTML entry, which
    // would offer the fullscreen TV kiosk for install on the congregation app
    // and on the landing page. The congregation page declares its own manifest
    // instead; the landing page is a web page, not something to install.
    {
      name: 'strip-display-manifest-from-extra-entries',
      // closeBundle, not transformIndexHtml: VitePWA injects its link after any
      // post-enforced transform hook, so the only place it is reliably gone is
      // the file on disk.
      closeBundle() {
        for (const file of ['dist/masjid.html', 'dist/about.html']) {
          if (!existsSync(file)) continue;
          const html = readFileSync(file, 'utf8');
          const stripped = html.replace(
            /[ \t]*<link[^>]*rel="manifest"(?![^>]*masjid\.webmanifest)[^>]*>\r?\n?/g,
            '',
          );
          if (stripped !== html) writeFileSync(file, stripped);
        }
      },
    },
  ],
  server: {
    port: 5173,
    host: true,
    allowedHosts: ['polo-dresses-courage-fare.trycloudflare.com'],
  },
});
