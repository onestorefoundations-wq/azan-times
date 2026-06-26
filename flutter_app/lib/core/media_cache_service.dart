/// media_cache_service.dart
/// Downloads media library files to local device storage so the TV display
/// works fully offline after the first sync.
///
/// Cache directory: <app_docs>/media_cache/<filename>
/// Local index:     SharedPreferences key "media_cache_index"
///                  JSON map of { mediaFileId -> localAbsolutePath }
///
/// Web: no-op (browser handles HTTP caching via Cache-Control headers).

import 'dart:convert';
import 'dart:developer' as dev;
import 'dart:io';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MediaCacheService {
  static const _prefKey = 'media_cache_index';

  // ── Read the local index ─────────────────────────────────────

  static Future<Map<String, String>> _loadIndex() async {
    if (kIsWeb) return {};
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_prefKey);
    if (raw == null) return {};
    try {
      return Map<String, String>.from(jsonDecode(raw) as Map);
    } catch (_) {
      return {};
    }
  }

  static Future<void> _saveIndex(Map<String, String> index) async {
    if (kIsWeb) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefKey, jsonEncode(index));
  }

  // ── Cache directory ───────────────────────────────────────────

  static Future<Directory> _cacheDir() async {
    final docs = await getApplicationDocumentsDirectory();
    final dir = Directory('${docs.path}/media_cache');
    if (!dir.existsSync()) dir.createSync(recursive: true);
    return dir;
  }

  // ── Public API ────────────────────────────────────────────────

  /// Returns the local file path for [mediaFileId] if cached, else null.
  static Future<String?> localPath(String mediaFileId) async {
    if (kIsWeb) return null;
    final index = await _loadIndex();
    final path = index[mediaFileId];
    if (path == null) return null;
    // Verify file still exists on disk
    if (File(path).existsSync()) return path;
    // Stale entry — remove it
    index.remove(mediaFileId);
    await _saveIndex(index);
    return null;
  }

  /// True if [mediaFileId] is already cached locally.
  static Future<bool> isCached(String mediaFileId) async {
    if (kIsWeb) return false;
    return (await localPath(mediaFileId)) != null;
  }

  /// Download [url] and cache it under [mediaFileId].
  /// Returns the local file path on success.
  /// Throws on network or IO error.
  static Future<String> download(
    String mediaFileId,
    String url,
    String filename, {
    void Function(double progress)? onProgress,
  }) async {
    if (kIsWeb) throw UnsupportedError('Local cache not supported on web');

    final dir = await _cacheDir();
    final ext = filename.contains('.') ? filename.split('.').last : 'jpg';
    // Use mediaFileId as the local filename to guarantee uniqueness
    final localFile = File('${dir.path}/$mediaFileId.$ext');

    dev.log('[MediaCache] Downloading $filename → ${localFile.path}');

    final request = http.Request('GET', Uri.parse(url));
    final response = await request.send();

    if (response.statusCode != 200) {
      throw Exception('Download failed: HTTP ${response.statusCode}');
    }

    final totalBytes = response.contentLength ?? 0;
    var receivedBytes = 0;
    final sink = localFile.openWrite();

    try {
      await for (final chunk in response.stream) {
        sink.add(chunk);
        receivedBytes += chunk.length;
        if (totalBytes > 0 && onProgress != null) {
          onProgress(receivedBytes / totalBytes);
        }
      }
    } finally {
      await sink.close();
    }

    // Register in index
    final index = await _loadIndex();
    index[mediaFileId] = localFile.path;
    await _saveIndex(index);

    dev.log('[MediaCache] Cached $filename (${localFile.lengthSync()} bytes)');
    return localFile.path;
  }

  /// Download a list of files, skipping already-cached ones.
  /// [onProgress] receives (completedCount, totalCount).
  static Future<void> downloadAll(
    List<({String id, String url, String filename})> files, {
    void Function(int done, int total)? onProgress,
  }) async {
    if (kIsWeb) return;
    var done = 0;
    for (final f in files) {
      if (!await isCached(f.id)) {
        try {
          await download(f.id, f.url, f.filename);
        } catch (e) {
          dev.log('[MediaCache] Failed to cache ${f.filename}: $e');
        }
      }
      done++;
      onProgress?.call(done, files.length);
    }
  }

  /// Remove a cached file for [mediaFileId].
  static Future<void> evict(String mediaFileId) async {
    if (kIsWeb) return;
    final index = await _loadIndex();
    final path = index.remove(mediaFileId);
    await _saveIndex(index);
    if (path != null) {
      try {
        File(path).deleteSync();
        dev.log('[MediaCache] Evicted $mediaFileId');
      } catch (_) {}
    }
  }

  /// Remove all cached files and clear the index.
  static Future<void> clearAll() async {
    if (kIsWeb) return;
    try {
      final dir = await _cacheDir();
      if (dir.existsSync()) dir.deleteSync(recursive: true);
    } catch (_) {}
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_prefKey);
    dev.log('[MediaCache] Cache cleared');
  }

  /// Total size of all cached files in bytes.
  static Future<int> totalCacheSize() async {
    if (kIsWeb) return 0;
    try {
      final dir = await _cacheDir();
      if (!dir.existsSync()) return 0;
      return dir
          .listSync(recursive: true)
          .whereType<File>()
          .fold<int>(0, (sum, f) => sum + f.lengthSync());
    } catch (_) {
      return 0;
    }
  }

  /// Returns a map of all cached mediaFileId → localPath entries.
  static Future<Map<String, String>> allCachedIds() async {
    return _loadIndex();
  }

  /// Copy a file from [sourcePath] into the media cache under [id].
  /// Used when importing local files (USB / file manager) with no internet.
  /// Returns the cached file path.
  static Future<String> copyToCache(String id, String sourcePath, String filename) async {
    if (kIsWeb) throw UnsupportedError('Local cache not supported on web');
    final dir = await _cacheDir();
    final ext = filename.contains('.') ? filename.split('.').last : 'jpg';
    final destFile = File('${dir.path}/$id.$ext');
    await File(sourcePath).copy(destFile.path);
    final index = await _loadIndex();
    index[id] = destFile.path;
    await _saveIndex(index);
    dev.log('[MediaCache] Copied local file $filename → ${destFile.path}');
    return destFile.path;
  }
}
