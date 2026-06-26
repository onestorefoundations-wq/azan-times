/**
 * pendingUploads.ts
 * Offline queue of device-imported images awaiting cloud upload.
 * Web analogue of pending_upload_service.dart — stores the File blob in
 * IndexedDB so imports survive reloads and auto-upload when back online.
 */
import { v4 as uuidv4 } from 'uuid';
import { idb } from './idb';

export interface PendingEntry {
  localId: string;
  tenantId: string;
  blob: Blob;
  filename: string;
  category: string;
  fileSize: number;
  mimeType: string;
  isActive: boolean;
  deviceId: string | null;
  createdAt: number;
}

export const PendingUploads = {
  newLocalId: () => `pending_${uuidv4()}`,

  add: (entry: PendingEntry) => idb.put('pending', entry),

  loadAll: () => idb.getAll<PendingEntry>('pending'),

  async update(localId: string, patch: Partial<PendingEntry>) {
    const existing = await idb.get<PendingEntry>('pending', localId);
    if (!existing) return;
    await idb.put('pending', { ...existing, ...patch });
  },

  remove: (localId: string) => idb.delete('pending', localId),
};

export const mimeFromFilename = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'bmp':
      return 'image/bmp';
    default:
      return 'image/jpeg';
  }
};
