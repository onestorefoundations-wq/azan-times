import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { writeFileSync } from 'node:fs';

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
        globPatterns: ['**/*.{js,css,html,mp3,woff2,ttf,png,svg}'],
        // Never precache version.json — it must always be fetched from the network.
        globIgnores: ['**/version.json'],
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
  ],
  server: {
    port: 5173,
    host: true,
    allowedHosts: ['polo-dresses-courage-fare.trycloudflare.com'],
  },
});
