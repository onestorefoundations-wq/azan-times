/// media_library_service.dart
/// CRUD for the Supabase `media_library` table.
///
/// Uploads and deletes go through the `media-proxy` Edge Function. The PHP
/// media server's shared API key used to be a const in this file -- i.e. inside
/// the shipped APK -- and its delete endpoint keys off a bare filename, so
/// anyone who extracted the key could delete any mosque's media. The key now
/// lives as a function secret, and the proxy checks the media_library row's
/// tenant against the caller's JWT before deleting anything.

import 'dart:developer' as dev;
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import 'dart:convert';
import 'media_file.dart';
import 'auth_session.dart';
import 'supabase_sync_service.dart';

class MediaLibraryService {
  static String get _proxyUrl => '${SupabaseSyncService.functionsUrl}/media-proxy';

  static Map<String, String> _authHeaders() {
    final token = AuthSession.token;
    if (token == null) throw Exception('Not linked to a cloud account');
    return {
      'Authorization': 'Bearer $token',
      'apikey': SupabaseSyncService.anonKey,
    };
  }

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
    // tenantId is ignored server-side -- the proxy takes it from the JWT so a
    // client cannot file uploads under someone else's tenant. It stays in the
    // signature for call-site symmetry with the rest of the service.
    final request = http.MultipartRequest('POST', Uri.parse(_proxyUrl));
    request.headers.addAll(_authHeaders());
    request.fields['filename'] = filename;
    request.fields['category'] = category;
    if (deviceId != null) request.fields['deviceId'] = deviceId;
    request.files.add(http.MultipartFile.fromBytes('file', bytes, filename: filename));

    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);
    final data = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode != 200) {
      throw Exception(data['error'] ?? 'Upload failed (${response.statusCode})');
    }

    dev.log('[MediaLib] Uploaded $filename → ${data['id']}');
    return MediaFile.fromJson(data);
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
    // Row removal and the media-server delete both happen inside the proxy,
    // which verifies the row belongs to the caller's tenant first.
    final response = await http.post(
      Uri.parse(_proxyUrl),
      headers: {..._authHeaders(), 'Content-Type': 'application/json'},
      body: jsonEncode({'action': 'delete', 'fileId': fileId}),
    );

    if (response.statusCode != 200) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      throw Exception(data['error'] ?? 'Delete failed (${response.statusCode})');
    }

    dev.log('[MediaLib] Deleted $fileId');
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
}
