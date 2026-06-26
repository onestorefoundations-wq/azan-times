/**
 * mediaCache.ts
 * Offline cache for cloud media. Web analogue of media_cache_service.dart.
 * Stores fetched image bytes in the Cache API (so the original https URL keeps
 * working offline) and records mediaId → url in IndexedDB. `isFileLocal` checks
 * the index. Returns the (still-original) URL for display — the Cache API /
 * service worker serves it when offline.
 */
import { idb } from './idb';

const CACHE_NAME = 'media-cache-v1';

interface CacheEntry {
  id: string;
  url: string;
}

export const MediaCache = {
  /** Fetch + store bytes for [url] under [id]. Reports coarse progress. */
  async download(id: string, url: string, _filename: string, onProgress?: (p: number) => void): Promise<string> {
    onProgress?.(0.1);
    const cache = await caches.open(CACHE_NAME);
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    await cache.put(url, res.clone());
    onProgress?.(1);
    await idb.put('cacheIndex', { id, url } as CacheEntry);
    return url;
  },

  /** id → cached url for everything in the local cache index. */
  async allCachedIds(): Promise<Record<string, string>> {
    const entries = await idb.getAll<CacheEntry>('cacheIndex');
    const map: Record<string, string> = {};
    for (const e of entries) map[e.id] = e.url;
    return map;
  },

  async evict(id: string): Promise<void> {
    const entry = await idb.get<CacheEntry>('cacheIndex', id);
    if (entry) {
      const cache = await caches.open(CACHE_NAME);
      await cache.delete(entry.url);
    }
    await idb.delete('cacheIndex', id);
  },
};
