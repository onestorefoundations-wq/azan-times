import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
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
        runtimeCaching: [
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
