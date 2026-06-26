/**
 * idb.ts
 * Tiny IndexedDB wrapper backing the media cache index and the offline
 * pending-upload queue. Two object stores:
 *   - cacheIndex: { id, url }            (mediaId → cloud url cached via Cache API)
 *   - pending:    { localId, blob, meta } (device imports awaiting upload)
 */

const DB_NAME = 'mosque_media';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('cacheIndex')) db.createObjectStore('cacheIndex', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('pending')) db.createObjectStore('pending', { keyPath: 'localId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const idb = {
  get: <T>(store: string, key: IDBValidKey) => tx<T>(store, 'readonly', (s) => s.get(key)),
  getAll: <T>(store: string) => tx<T[]>(store, 'readonly', (s) => s.getAll()),
  put: (store: string, value: unknown) => tx<IDBValidKey>(store, 'readwrite', (s) => s.put(value)),
  delete: (store: string, key: IDBValidKey) => tx<undefined>(store, 'readwrite', (s) => s.delete(key)),
};
