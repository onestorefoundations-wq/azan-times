/// device_service.dart
/// Generates and persists a unique device_id on first install.
/// Sends heartbeat updates to the Supabase device_registry table.

import 'package:uuid/uuid.dart';
import 'storage_service.dart';

class DeviceService {
  static const _uuid = Uuid();
  static const String appVersion = '1.0.0';

  /// Returns the persisted device_id, generating one if not yet set.
  static Future<String> getOrCreateDeviceId() async {
    String? existing = StorageService.getDeviceId();
    if (existing != null && existing.isNotEmpty) return existing;

    final newId = 'flutter_${_uuid.v4()}';
    await StorageService.setDeviceId(newId);
    return newId;
  }

  /// Returns device_id synchronously (must call getOrCreateDeviceId first).
  static String? getDeviceId() => StorageService.getDeviceId();
}
