/**
 * deviceService.ts
 * Generates/persists a stable device id. Mirrors device_service.dart.
 */

import { v4 as uuidv4 } from 'uuid';
import { StorageService } from './storageService';

let cachedId: string | null = null;

export const DeviceService = {
  getOrCreateDeviceId(): string {
    if (cachedId) return cachedId;
    let id = StorageService.getDeviceId();
    if (!id) {
      id = uuidv4();
      StorageService.setDeviceId(id);
    }
    cachedId = id;
    return id;
  },

  getDeviceId(): string | null {
    return cachedId ?? StorageService.getDeviceId();
  },
};
