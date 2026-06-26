/// pending_upload_service.dart
/// Persists a queue of locally-imported media files that need to be
/// uploaded to the PHP server + Supabase when internet is available.
///
/// Each entry in the queue is a plain Map stored as JSON in SharedPreferences.
/// Entry schema:
/// {
///   "local_id":   "pending_1234567890_abcdef",  // unique local ID
///   "tenant_id":  "uuid...",
///   "local_path": "/data/.../media_cache/pending_xxx.jpg",
///   "filename":   "original_name.jpg",
///   "category":   "background_landscape" | "slide_landscape" | ...,
///   "file_size":  12345,
///   "mime_type":  "image/jpeg",
///   "is_active":  false,           // whether set as active background
///   "device_id":  "device_uuid",
///   "created_at": 1234567890000,   // milliseconds since epoch
/// }

import 'dart:convert';
import 'dart:developer' as dev;
import 'package:shared_preferences/shared_preferences.dart';

class PendingUploadService {
  static const _key = 'pending_uploads_v1';

  static Future<List<Map<String, dynamic>>> loadAll() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_key);
      if (raw == null) return [];
      return (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
    } catch (e) {
      dev.log('[PendingUpload] Load error: $e');
      return [];
    }
  }

  static Future<void> _saveAll(List<Map<String, dynamic>> items) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode(items));
  }

  static Future<void> add(Map<String, dynamic> entry) async {
    final all = await loadAll();
    all.removeWhere((e) => e['local_id'] == entry['local_id']);
    all.add(entry);
    await _saveAll(all);
    dev.log('[PendingUpload] Queued: ${entry['filename']}');
  }

  static Future<void> update(String localId, Map<String, dynamic> changes) async {
    final all = await loadAll();
    final idx = all.indexWhere((e) => e['local_id'] == localId);
    if (idx >= 0) {
      all[idx] = {...all[idx], ...changes};
      await _saveAll(all);
    }
  }

  static Future<void> remove(String localId) async {
    final all = await loadAll();
    all.removeWhere((e) => e['local_id'] == localId);
    await _saveAll(all);
    dev.log('[PendingUpload] Removed from queue: $localId');
  }

  static Future<void> clearAll() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }

  /// Generate a unique local ID for a pending file.
  static String newLocalId() {
    final ts = DateTime.now().millisecondsSinceEpoch;
    final rand = ts % 999983; // pseudo-random suffix
    return 'pending_${ts}_$rand';
  }
}
