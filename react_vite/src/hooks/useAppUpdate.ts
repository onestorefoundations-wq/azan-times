/**
 * useAppUpdate
 *
 * Ensures the kiosk reloads automatically whenever a new build is deployed,
 * as long as it has internet access. Two independent mechanisms:
 *
 * 1. Service-worker controller change
 *    vite-plugin-pwa (autoUpdate) installs the new SW and calls skipWaiting()
 *    automatically. When the new SW takes control, `controllerchange` fires →
 *    we reload so the page runs on the fresh cached assets.
 *
 * 2. /version.json polling (backup)
 *    Each build writes /version.json with the build timestamp. We poll it
 *    every POLL_MS (default 10 min) using cache:'no-store' so the SW never
 *    serves a stale copy. If the server version differs from our build time →
 *    we wipe all SW caches and reload, guaranteeing a clean slate.
 *
 * Both paths are no-ops when offline, so a TV with no internet keeps working
 * indefinitely on its cached copy.
 */

import { useEffect } from 'react';

const POLL_MS = 10 * 60 * 1000; // 10 minutes

declare const __BUILD_TIME__: string;

async function reloadFresh() {
  try {
    // Delete all SW caches so the reload pulls everything fresh.
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // ignore — reload anyway
  }
  window.location.reload();
}

async function checkVersion() {
  if (!navigator.onLine) return;
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout?.(8000) ?? undefined,
    });
    if (!res.ok) return;
    const { v } = (await res.json()) as { v?: string };
    if (v && v !== __BUILD_TIME__) {
      console.info('[update] new build detected, reloading…', { deployed: v, running: __BUILD_TIME__ });
      await reloadFresh();
    }
  } catch {
    // network unavailable or parse error — ignore
  }
}

export function useAppUpdate() {
  useEffect(() => {
    // ── 1. SW controller change ──────────────────────────────
    const sw = navigator.serviceWorker;
    const onControllerChange = () => {
      console.info('[update] new service worker activated, reloading…');
      window.location.reload();
    };
    sw?.addEventListener('controllerchange', onControllerChange);

    // ── 2. Version polling ───────────────────────────────────
    // Check immediately on mount (catches updates that happened while offline),
    // then on a fixed interval, and again whenever the device comes back online.
    void checkVersion();
    const timer = setInterval(checkVersion, POLL_MS);
    window.addEventListener('online', checkVersion);

    return () => {
      sw?.removeEventListener('controllerchange', onControllerChange);
      clearInterval(timer);
      window.removeEventListener('online', checkVersion);
    };
  }, []);
}
