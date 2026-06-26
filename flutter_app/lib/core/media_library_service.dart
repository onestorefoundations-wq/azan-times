/// media_library_service.dart
/// CRUD for the Supabase `media_library` table.
/// All files flow through the PHP upload server for the actual bytes.
/// Supabase holds metadata + sync state only.

import 'dart:developer' as dev;
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import 'dart:convert';
import 'media_file.dart';

class MediaLibraryService {
  static const _phpUploadUrl =
      'https://expertai.co.uk/softwares/general_upload/masjidazan/uploads.php';
  static const _phpApiUrl =
      'https://expertai.co.uk/softwares/general_upload/masjidazan/media_api.php';
  static const _phpApiKey = r'EverY0NeKnoW$1T';

  static SupabaseClient get _db => Supabase.instance.client;

  // ── Upload a file to PHP server + register in media_library ──

  static Future<MediaFile> uploadFile({
    required String tenantId,
    required Uint8List bytes,
    required String filename,
    required String category,    // 'background' | 'slide_landscape' | 'slide_portrait'
    String? deviceId,
    Map<String, dynamic>? metadata,
  }) async {
    // 1. Upload bytes to PHP server
    final uploaded = await _uploadToPhp(bytes, filename);

    // 2. Insert row in media_library
    final row = {
      'tenant_id': tenantId,
      'filename': uploaded.filename,
      'url': uploaded.url,
      'file_size_bytes': uploaded.size,
      'mime_type': uploaded.mime,
      'category': category,
      'is_active_background': false,
      'is_deleted': false,
      'uploaded_by_device': deviceId,
      'metadata': metadata ?? {},
    };

    final response = await _db
        .from('media_library')
        .insert(row)
        .select()
        .single();

    dev.log('[MediaLib] Uploaded ${uploaded.filename} → ${response['id']}');
    return MediaFile.fromJson(response);
  }

  // ── Fetch all active files for a tenant ──────────────────────

  static Future<List<MediaFile>> fetchFiles(String tenantId, {String? category}) async {
    final baseQuery = _db
        .from('media_library')
        .select()
        .eq('tenant_id', tenantId)
        .eq('is_deleted', false);

    final filteredQuery = category != null
        ? baseQuery.eq('category', category)
        : baseQuery;

    final rows = await filteredQuery
        .order('display_order')
        .order('uploaded_at');

    return (rows as List).map((r) => MediaFile.fromJson(r as Map<String, dynamic>)).toList();
  }

  // ── Set a file as the active background ─────────────────────
  // Clears any other active background for this tenant first.

  static Future<void> setActiveBackground(String tenantId, String fileId) async {
    // Clear existing active background
    await _db
        .from('media_library')
        .update({'is_active_background': false})
        .eq('tenant_id', tenantId)
        .eq('is_active_background', true);

    // Set the new one
    await _db
        .from('media_library')
        .update({'is_active_background': true})
        .eq('id', fileId)
        .eq('tenant_id', tenantId);

    dev.log('[MediaLib] Active background → $fileId');
  }

  // ── Clear active background for a specific category ──────────

  static Future<void> clearActiveBackground(String tenantId) async {
    await _db
        .from('media_library')
        .update({'is_active_background': false})
        .eq('tenant_id', tenantId)
        .eq('is_active_background', true);
    dev.log('[MediaLib] Cleared all active backgrounds');
  }

  static Future<void> clearActiveBackgroundForCategory(String tenantId, String category) async {
    await _db
        .from('media_library')
        .update({'is_active_background': false})
        .eq('tenant_id', tenantId)
        .eq('category', category)
        .eq('is_active_background', true);
    dev.log('[MediaLib] Cleared active background for $category');
  }

  // ── Delete a file (server + Supabase) ───────────────────────

  static Future<void> deleteFile(String tenantId, String fileId) async {
    // Fetch URL before deleting so we can remove from server too
    final rows = await _db
        .from('media_library')
        .select('url')
        .eq('id', fileId)
        .eq('tenant_id', tenantId)
        .limit(1);

    final url = (rows as List).isNotEmpty
        ? (rows.first as Map<String, dynamic>)['url'] as String?
        : null;

    // Remove from Supabase (hard delete — cleaner than soft-delete for media)
    await _db
        .from('media_library')
        .delete()
        .eq('id', fileId)
        .eq('tenant_id', tenantId);

    // Remove from PHP server (fire and forget — don't block on failure)
    if (url != null) {
      deleteFileFromServer(url); // intentionally not awaited
    }

    dev.log('[MediaLib] Deleted $fileId from DB and queued server delete');
  }

  // ── Reorder files within a category ─────────────────────────

  static Future<void> reorderFiles(List<MediaFile> ordered) async {
    for (var i = 0; i < ordered.length; i++) {
      await _db
          .from('media_library')
          .update({'display_order': i})
          .eq('id', ordered[i].id);
    }
  }

  // ── Fetch just the active background for a tenant ────────────

  static Future<MediaFile?> fetchActiveBackground(String tenantId) async {
    final rows = await _db
        .from('media_library')
        .select()
        .eq('tenant_id', tenantId)
        .eq('category', 'background')
        .eq('is_active_background', true)
        .eq('is_deleted', false)
        .limit(1);

    if ((rows as List).isEmpty) return null;
    return MediaFile.fromJson(rows.first as Map<String, dynamic>);
  }

  // ── Fetch slide files for a given orientation ────────────────
  // Returns landscape slides, then portrait slides, then general slides.

  static Future<List<MediaFile>> fetchSlides(
    String tenantId, {
    required bool isPortrait,
  }) async {
    final category = isPortrait ? 'slide_portrait' : 'slide_landscape';
    final rows = await _db
        .from('media_library')
        .select()
        .eq('tenant_id', tenantId)
        .eq('is_deleted', false)
        .inFilter('category', [category, 'slide_general'])
        .order('display_order')
        .order('uploaded_at');

    return (rows as List).map((r) => MediaFile.fromJson(r as Map<String, dynamic>)).toList();
  }

  // ── Realtime subscription ────────────────────────────────────
  // Returns a RealtimeChannel; call .unsubscribe() to clean up.

  static RealtimeChannel subscribeToLibrary(
    String tenantId,
    void Function(List<MediaFile> files) onUpdate,
  ) {
    return _db
        .channel('media_library:$tenantId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'media_library',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'tenant_id',
            value: tenantId,
          ),
          callback: (_) async {
            try {
              final files = await fetchFiles(tenantId);
              onUpdate(files);
            } catch (e) {
              dev.log('[MediaLib] Realtime fetch error: $e');
            }
          },
        )
        .subscribe();
  }

  // ── PHP server helpers ───────────────────────────────────────

  /// Check if a file actually exists on the PHP server.
  static Future<bool> checkFileExistsOnServer(String url) async {
    try {
      final filename = url.split('/').last;
      final response = await http.post(
        Uri.parse(_phpApiUrl),
        headers: {
          'Authorization': 'Bearer $_phpApiKey',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'action': 'exists', 'filename': filename}),
      );
      if (response.statusCode != 200) return false;
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      return data['exists'] as bool? ?? false;
    } catch (_) {
      return false;
    }
  }

  /// Delete a file from the PHP server by URL.
  static Future<void> deleteFileFromServer(String url) async {
    try {
      final filename = url.split('/').last;
      final response = await http.post(
        Uri.parse(_phpApiUrl),
        headers: {
          'Authorization': 'Bearer $_phpApiKey',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'action': 'delete', 'filename': filename}),
      );
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      dev.log('[MediaLib] Server delete $filename → ${data['deleted']}');
    } catch (e) {
      dev.log('[MediaLib] Server delete failed: $e');
    }
  }

  /// List all files on the PHP server (for audit/reconciliation).
  static Future<List<Map<String, dynamic>>> listServerFiles() async {
    final response = await http.post(
      Uri.parse(_phpApiUrl),
      headers: {
        'Authorization': 'Bearer $_phpApiKey',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({'action': 'list'}),
    );
    if (response.statusCode != 200) throw Exception('List failed: ${response.statusCode}');
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return (data['files'] as List).cast<Map<String, dynamic>>();
  }

  // ── PHP upload helper ────────────────────────────────────────

  static Future<({String url, String filename, int size, String mime})> _uploadToPhp(
      Uint8List bytes, String filename) async {
    // Use new media_api.php endpoint (upload action)
    final request = http.MultipartRequest('POST', Uri.parse(_phpApiUrl));
    request.headers['Authorization'] = 'Bearer $_phpApiKey';
    request.fields['action'] = 'upload';
    request.files.add(http.MultipartFile.fromBytes('file', bytes, filename: filename));

    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);

    if (response.statusCode != 200) {
      throw Exception('PHP server returned ${response.statusCode}');
    }

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    if (data['success'] != true) {
      throw Exception(data['error'] ?? 'Upload failed');
    }

    final url = data['url'] as String;
    final fname = data['filename'] as String? ?? url.split('/').last;
    final size = (data['size'] as num?)?.toInt() ?? bytes.length;
    final mime = data['mime_type'] as String? ?? _mimeFromFilename(filename);
    return (url: url, filename: fname, size: size, mime: mime);
  }

  static String _mimeFromFilename(String filename) {
    final ext = filename.split('.').last.toLowerCase();
    return switch (ext) {
      'png' => 'image/png',
      'gif' => 'image/gif',
      'webp' => 'image/webp',
      'bmp' => 'image/bmp',
      _ => 'image/jpeg',
    };
  }
}
