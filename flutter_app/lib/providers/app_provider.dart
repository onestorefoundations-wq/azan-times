/// app_provider.dart
/// Central state management using ChangeNotifier.
/// Manages: AppConfig, prayer calculations, prayer state machine,
/// audio alerts, sync status, and the 1-second tick.

import 'dart:async';
import 'dart:convert';
import 'dart:developer' as dev;
import 'dart:io';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import '../core/app_config.dart';
import '../core/media_cache_service.dart';
import '../core/media_file.dart';
import '../core/media_library_service.dart';
import '../core/pending_upload_service.dart';
import '../core/prayer_engine.dart';
import '../core/storage_service.dart';
import '../core/audio_service.dart';
import '../core/supabase_sync_service.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

enum DisplayState { normal, adhanAlert, iqamahAlert, slideshow }

class AppProvider extends ChangeNotifier with WidgetsBindingObserver {
  // ── State ──────────────────────────────────────────────────
  AppConfig _config = const AppConfig();
  List<PrayerConfig> _prayers = [];
  PrayerState _prayerState = PrayerState.idle;
  PrayerConfig? _activePrayer;
  PrayerConfig? _nextPrayer;
  SyncStatus _syncStatus = SyncStatus.localOnly;
  bool _isLoaded = false;

  DisplayState _displayState = DisplayState.normal;
  DateTime? _alertTimeout;

  // Slideshow cycle state
  // Cycle: TV screen for tvScreenDurationMins → slideshow for slideshowRunDurationMins → repeat
  Timer? _slideshowCycleTimer;
  bool _inSlideshowPhase = false; // true = currently in slideshow phase

  // Tracking last-alerted prayer to avoid duplicate alerts
  String? _lastAlertedAdhan;
  String? _lastAlertedIqamah;

  // Media library
  List<MediaFile> _mediaFiles = [];
  RealtimeChannel? _mediaChannel;
  // In-memory local cache index: mediaFileId → local file path
  Map<String, String> _localCacheIndex = {};
  // Locally imported files not yet uploaded to cloud
  List<MediaFile> _pendingUploads = [];
  bool _isUploadingPending = false;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;

  // Timers
  Timer? _tickTimer;
  Timer? _midnightTimer;

  // ── Getters ────────────────────────────────────────────────
  AppConfig get config => _config;
  List<PrayerConfig> get prayers => _prayers;
  PrayerState get prayerState => _prayerState;
  PrayerConfig? get activePrayer => _activePrayer;
  PrayerConfig? get nextPrayer => _nextPrayer;
  SyncStatus get syncStatus => _syncStatus;
  bool get isLoaded => _isLoaded;
  DisplayState get displayState => _displayState;
  bool get isLinked =>
      _config.profile.tenantId != null && _config.profile.tenantId!.isNotEmpty;

  // ── Media library getters ──────────────────────────────────

  /// Cloud-synced media files only.
  List<MediaFile> get mediaFiles => _mediaFiles;

  /// All media files: cloud + locally imported pending uploads.
  List<MediaFile> get allMediaFiles => [..._mediaFiles, ..._pendingUploads];

  /// Locally imported files not yet uploaded.
  List<MediaFile> get pendingUploads => _pendingUploads;

  /// True while auto-upload of pending files is running.
  bool get isUploadingPending => _isUploadingPending;

  /// Snapshot of the local cache: mediaFileId → absolute local file path.
  Map<String, String> get localCacheIndex => _localCacheIndex;

  /// True if [fileId] is cached locally on this device.
  bool isFileLocal(String fileId) =>
      _localCacheIndex.containsKey(fileId) ||
      _pendingUploads.any((f) => f.id == fileId);

  /// URL/path of the active background for the given orientation.
  /// Checks pending local files first, then cloud files.
  /// Returns local file path when cached/pending, otherwise cloud URL.
  String? activeBgUrlForOrientation(bool isPortrait) {
    final specificCat = isPortrait ? 'background_portrait' : 'background_landscape';

    // 1. Pending local active background (orientation-specific)
    final pendingSpecific = _pendingUploads
        .where((f) => f.category == specificCat && f.isActiveBackground)
        .firstOrNull;
    if (pendingSpecific != null) return pendingSpecific.localFilePath ?? pendingSpecific.url;

    // 2. Cloud active background (orientation-specific)
    final specific = _mediaFiles
        .where((f) => f.category == specificCat && f.isActiveBackground && !f.isDeleted)
        .firstOrNull;
    if (specific != null) return _localCacheIndex[specific.id] ?? specific.url;

    // 3. Pending local active background (any-orientation)
    final pendingAny = _pendingUploads
        .where((f) => f.category == 'background' && f.isActiveBackground)
        .firstOrNull;
    if (pendingAny != null) return pendingAny.localFilePath ?? pendingAny.url;

    // 4. Cloud active background (any-orientation)
    final any = _mediaFiles
        .where((f) => f.category == 'background' && f.isActiveBackground && !f.isDeleted)
        .firstOrNull;
    if (any != null) return _localCacheIndex[any.id] ?? any.url;

    // 5. Legacy customBackgroundPath (http URLs only)
    final legacy = _config.meta.customBackgroundPath;
    if (legacy != null && legacy.startsWith('http')) return legacy;
    return null;
  }

  // Keep for backward compat (non-orientation-aware callers)
  String? get activeBgUrl => activeBgUrlForOrientation(false);

  /// Slide assets for the given orientation — media library + pending files, then legacy.
  List<SlideAsset> slidesForOrientation(bool isPortrait) {
    // Cloud slides
    final cloudSlides = _mediaFiles
        .where((f) => !f.isDeleted && (isPortrait ? f.isPortraitSlide : f.isLandscapeSlide))
        .toList()
      ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));

    // Locally imported pending slides
    final pendingSlides = _pendingUploads
        .where((f) => isPortrait ? f.isPortraitSlide : f.isLandscapeSlide)
        .toList();

    final allSlides = [
      ...cloudSlides.map((f) => SlideAsset(
        id: f.id,
        filename: f.filename,
        localPath: _localCacheIndex[f.id] ?? f.url,
        uploadedAt: f.uploadedAt.millisecondsSinceEpoch,
      )),
      ...pendingSlides.map((f) => SlideAsset(
        id: f.id,
        filename: f.filename,
        localPath: f.localFilePath ?? f.url,
        uploadedAt: f.uploadedAt.millisecondsSinceEpoch,
      )),
    ];

    if (allSlides.isNotEmpty) return allSlides;
    return _config.slideshow.imagesForOrientation(isPortrait);
  }

  bool get hasSlidesAvailable {
    final hasMediaSlides = _mediaFiles.any((f) => !f.isDeleted && f.isSlide);
    final hasPendingSlides = _pendingUploads.any((f) => f.isSlide);
    return hasMediaSlides || hasPendingSlides ||
        _config.slideshow.images.isNotEmpty ||
        _config.slideshow.landscapeImages.isNotEmpty ||
        _config.slideshow.portraitImages.isNotEmpty;
  }

  void dismissAlert() {
    _alertTimeout = null;
    if (_displayState == DisplayState.adhanAlert ||
        _displayState == DisplayState.iqamahAlert) {
      // Return to whatever phase the cycle is currently in
      _displayState = _inSlideshowPhase && _slideshowEnabled
          ? DisplayState.slideshow
          : DisplayState.normal;
    }
    notifyListeners();
  }

  bool get _slideshowEnabled =>
      _config.slideshow.enabled && hasSlidesAvailable;

  // ── Init ───────────────────────────────────────────────────

  Future<void> init() async {
    WidgetsBinding.instance.addObserver(this);
    await loadConfig();
    _startTickTimer();
    _scheduleMidnightRecalculation();
    await _loadPendingUploads();
    _setupConnectivityListener();

    if (isLinked) {
      await SupabaseSyncService.startSync(
        onStatusChange: _onSyncStatusChange,
        onConfigUpdated: () async {
          dev.log('[AppProvider] Cloud config updated — reloading');
          await loadConfig();
          await refreshMediaLibrary();
        },
      );
      await refreshMediaLibrary();
      _subscribeMediaLibrary();
      _tryAutoUploadPending();
    }
  }

  /// Load pending uploads from SharedPreferences into memory.
  Future<void> _loadPendingUploads() async {
    if (kIsWeb) return;
    final entries = await PendingUploadService.loadAll();
    _pendingUploads = entries.map(_entryToMediaFile).toList();
    dev.log('[AppProvider] Loaded ${_pendingUploads.length} pending uploads');
    if (_pendingUploads.isNotEmpty) notifyListeners();
  }

  MediaFile _entryToMediaFile(Map<String, dynamic> e) => MediaFile(
        id: e['local_id'] as String,
        tenantId: e['tenant_id'] as String? ?? '',
        filename: e['filename'] as String,
        url: e['local_path'] as String,
        fileSizeBytes: (e['file_size'] as num?)?.toInt(),
        mimeType: e['mime_type'] as String? ?? 'image/jpeg',
        category: e['category'] as String,
        isActiveBackground: e['is_active'] as bool? ?? false,
        displayOrder: 0,
        isDeleted: false,
        uploadedAt: DateTime.fromMillisecondsSinceEpoch(e['created_at'] as int? ?? 0),
        uploadedByDevice: e['device_id'] as String?,
        metadata: const {},
        isPendingUpload: true,
        localFilePath: e['local_path'] as String,
      );

  /// Listen for network changes and auto-upload pending files when connected.
  void _setupConnectivityListener() {
    if (kIsWeb) return;
    _connectivitySub?.cancel();
    _connectivitySub = Connectivity()
        .onConnectivityChanged
        .listen((results) {
      final hasNet = results.any((r) => r != ConnectivityResult.none);
      if (hasNet && _pendingUploads.isNotEmpty) {
        dev.log('[AppProvider] Network restored — attempting pending uploads');
        _tryAutoUploadPending();
      }
    });
  }

  /// Reload all media files for this account from Supabase.
  /// Falls back to the locally persisted list when offline.
  Future<void> refreshMediaLibrary() async {
    final tenantId = _config.profile.tenantId;
    if (tenantId == null || tenantId.isEmpty) return;

    // Always load local cache index first (works offline)
    _localCacheIndex = await MediaCacheService.allCachedIds();

    try {
      // Try to fetch fresh list from Supabase
      final fresh = await MediaLibraryService.fetchFiles(tenantId);
      _mediaFiles = fresh;
      // Persist the list locally so we survive offline restarts
      await _saveMediaFilesLocally(fresh);
      dev.log('[AppProvider] Media library synced: ${fresh.length} files, '
          '${_localCacheIndex.length} cached locally');
    } catch (e) {
      dev.log('[AppProvider] Supabase unreachable — loading persisted media list: $e');
      // Load the last-known list saved to SharedPreferences
      final persisted = await _loadMediaFilesLocally();
      if (persisted.isNotEmpty) {
        _mediaFiles = persisted;
        dev.log('[AppProvider] Loaded ${persisted.length} media files from local storage (offline)');
      }
    }

    notifyListeners();
    // Download any not-yet-cached files in the background (only if we have internet)
    _autoDownloadMediaFiles();
  }

  static const _mediaFilesKey = 'media_library_snapshot';

  Future<void> _saveMediaFilesLocally(List<MediaFile> files) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final json = files.map((f) => f.toJson()).toList();
      await prefs.setString(_mediaFilesKey, jsonEncode(json));
    } catch (e) {
      dev.log('[AppProvider] Failed to persist media list: $e');
    }
  }

  Future<List<MediaFile>> _loadMediaFilesLocally() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_mediaFilesKey);
      if (raw == null) return [];
      final list = jsonDecode(raw) as List;
      return list.map((e) => MediaFile.fromJson(e as Map<String, dynamic>)).toList();
    } catch (e) {
      dev.log('[AppProvider] Failed to load persisted media list: $e');
      return [];
    }
  }

  /// Background-download all media files not yet in local cache.
  /// Updates the in-memory index as each file finishes so the UI reacts.
  void _autoDownloadMediaFiles() {
    final files = List<MediaFile>.from(_mediaFiles);
    Future(() async {
      for (final f in files) {
        if (_localCacheIndex.containsKey(f.id)) continue;
        try {
          final localPath = await MediaCacheService.download(f.id, f.url, f.filename);
          _localCacheIndex[f.id] = localPath;
          dev.log('[AppProvider] Auto-cached ${f.filename}');
          notifyListeners(); // update status badges as each file downloads
        } catch (e) {
          dev.log('[AppProvider] Auto-cache failed for ${f.filename}: $e');
        }
      }
    });
  }

  /// Manually download a single file to local cache (called from media library UI).
  Future<void> downloadMediaFile(
    MediaFile file, {
    void Function(double)? onProgress,
  }) async {
    try {
      final localPath = await MediaCacheService.download(
        file.id, file.url, file.filename,
        onProgress: onProgress,
      );
      _localCacheIndex[file.id] = localPath;
      notifyListeners();
    } catch (e) {
      dev.log('[AppProvider] Manual download failed for ${file.filename}: $e');
      rethrow;
    }
  }

  /// Remove a file from local cache (frees device storage).
  Future<void> evictFromCache(String fileId) async {
    await MediaCacheService.evict(fileId);
    _localCacheIndex.remove(fileId);
    notifyListeners();
  }

  // ── Local import (no internet) ────────────────────────────────

  /// Pick images from local storage / USB and import them into the pending queue.
  /// [category] must be one of: background_landscape, background_portrait,
  /// slide_landscape, slide_portrait, slide_general.
  Future<void> importLocalFiles(String category) async {
    if (kIsWeb) return;
    final result = await FilePicker.pickFiles(
      type: FileType.image,
      allowMultiple: true,
      withData: false, // use path, not in-memory bytes
    );
    if (result == null || result.files.isEmpty) return;

    for (final file in result.files) {
      final sourcePath = file.path;
      if (sourcePath == null) continue;
      final localId = PendingUploadService.newLocalId();
      final cachedPath = await MediaCacheService.copyToCache(
          localId, sourcePath, file.name);
      final entry = <String, dynamic>{
        'local_id': localId,
        'tenant_id': _config.profile.tenantId ?? '',
        'local_path': cachedPath,
        'filename': file.name,
        'category': category,
        'file_size': file.size,
        'mime_type': _mimeFromFilename(file.name),
        'is_active': false,
        'device_id': _config.meta.deviceId,
        'created_at': DateTime.now().millisecondsSinceEpoch,
      };
      await PendingUploadService.add(entry);
      _pendingUploads.add(_entryToMediaFile(entry));
    }
    notifyListeners();
    // Attempt immediate upload if we're online
    _tryAutoUploadPending();
  }

  /// Set a pending-upload file as active background.
  /// Clears any other active backgrounds in the same category.
  Future<void> setPendingFileAsBackground(String localId) async {
    for (final p in _pendingUploads) {
      if (p.isBackground && p.isActiveBackground) {
        await PendingUploadService.update(p.id, {'is_active': false});
      }
    }
    await PendingUploadService.update(localId, {'is_active': true});
    await _loadPendingUploads();
  }

  /// Delete a pending-upload file from the queue and local storage.
  Future<void> deletePendingFile(String localId) async {
    await MediaCacheService.evict(localId);
    await PendingUploadService.remove(localId);
    _pendingUploads.removeWhere((f) => f.id == localId);
    notifyListeners();
  }

  /// Upload all pending files to the server (runs in background).
  /// Called automatically on connectivity restore and on app start if linked.
  Future<void> _tryAutoUploadPending() async {
    if (_isUploadingPending) return;
    if (_pendingUploads.isEmpty) return;
    final tenantId = _config.profile.tenantId;
    if (tenantId == null || tenantId.isEmpty) return;

    _isUploadingPending = true;
    notifyListeners();

    final toUpload = List<MediaFile>.from(_pendingUploads);
    for (final pending in toUpload) {
      try {
        final localPath = pending.localFilePath!;
        if (!File(localPath).existsSync()) {
          // File gone — remove from queue
          await PendingUploadService.remove(pending.id);
          _pendingUploads.removeWhere((f) => f.id == pending.id);
          continue;
        }
        final bytes = await File(localPath).readAsBytes();
        final uploaded = await MediaLibraryService.uploadFile(
          tenantId: tenantId,
          bytes: bytes,
          filename: pending.filename,
          category: pending.category,
          deviceId: pending.uploadedByDevice,
        );
        // If this was set as active background, apply in cloud too
        if (pending.isActiveBackground && uploaded.isBackground) {
          await MediaLibraryService.setActiveBackground(tenantId, uploaded.id);
        }
        // Transfer local file path to the new cloud ID in cache index
        _localCacheIndex[uploaded.id] = localPath;
        await MediaCacheService.copyToCache(
            uploaded.id, localPath, uploaded.filename);
        // Remove from pending queue
        await PendingUploadService.remove(pending.id);
        _pendingUploads.removeWhere((f) => f.id == pending.id);
        dev.log('[AppProvider] Uploaded pending: ${pending.filename} → ${uploaded.id}');
        notifyListeners();
      } catch (e) {
        dev.log('[AppProvider] Upload failed for ${pending.filename}: $e');
      }
    }

    _isUploadingPending = false;
    await refreshMediaLibrary();
  }

  String _mimeFromFilename(String filename) {
    final ext = filename.split('.').last.toLowerCase();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  }

  void _subscribeMediaLibrary() {
    final tenantId = _config.profile.tenantId;
    if (tenantId == null || tenantId.isEmpty) return;
    _mediaChannel?.unsubscribe();
    _mediaChannel = MediaLibraryService.subscribeToLibrary(
      tenantId,
      (files) {
        _mediaFiles = files;
        dev.log('[AppProvider] Media library realtime update: ${files.length} files');
        notifyListeners();
      },
    );
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && isLinked) {
      dev.log('[AppProvider] App resumed — resubscribing realtime and syncing');
      SupabaseSyncService.resubscribeIfNeeded();
      _tryAutoUploadPending();
    }
  }

  // ── Config load / save ────────────────────────────────────

  Future<void> loadConfig() async {
    final cfg = await StorageService.loadConfig();
    _config = cfg;
    _recalculatePrayers();
    AudioService.setEnabled(_config.features.audioAlertsEnabled);
    _applyOrientation();
    _restartSlideshowCycle();
    _isLoaded = true;
    notifyListeners();
  }

  Future<void> saveConfig(AppConfig newConfig) async {
    _config = newConfig;
    await StorageService.saveConfig(newConfig);
    _recalculatePrayers();
    AudioService.setEnabled(_config.features.audioAlertsEnabled);
    _applyOrientation();
    _restartSlideshowCycle();
    notifyListeners();

    if (isLinked) {
      _syncStatus = SyncStatus.syncing;
      notifyListeners();
      try {
        await SupabaseSyncService.pushConfigToCloud(newConfig);
        _syncStatus = SyncStatus.synced;
      } catch (e) {
        dev.log('[AppProvider] Failed to push config: $e');
        _syncStatus = SyncStatus.syncError;
      }
      notifyListeners();
    }
  }

  /// Called when user links/unlinks account to restart media subscription.
  Future<void> onAccountChanged() async {
    _mediaChannel?.unsubscribe();
    _mediaChannel = null;
    _mediaFiles = [];
    if (isLinked) {
      await refreshMediaLibrary();
      _subscribeMediaLibrary();
    }
    notifyListeners();
  }

  void _recalculatePrayers() {
    _prayers = PrayerEngine.calculatePrayers(_config);
    _tick();
  }

  void _applyOrientation() {
    final mode = _config.meta.displayOrientation;
    if (mode == 'landscape') {
      SystemChrome.setPreferredOrientations([
        DeviceOrientation.landscapeLeft,
        DeviceOrientation.landscapeRight,
      ]);
    } else if (mode == 'portrait') {
      SystemChrome.setPreferredOrientations([
        DeviceOrientation.portraitUp,
        DeviceOrientation.portraitDown,
      ]);
    } else {
      SystemChrome.setPreferredOrientations([]);
    }
  }

  // ── Slideshow cycle ────────────────────────────────────────
  // Pattern: [TV screen for tvScreenDurationMins] → [slideshow for slideshowRunDurationMins] → repeat
  // Adhan/iqamah alerts always interrupt and restore afterwards.

  void _restartSlideshowCycle() {
    _slideshowCycleTimer?.cancel();
    _slideshowCycleTimer = null;
    _inSlideshowPhase = false;

    if (!_slideshowEnabled) {
      // Make sure we return to normal if slideshow was just disabled
      if (_displayState == DisplayState.slideshow) {
        _displayState = DisplayState.normal;
      }
      return;
    }

    // Start with TV screen phase
    _scheduleTvPhase();
  }

  void _scheduleTvPhase() {
    _inSlideshowPhase = false;
    final tvSecs = _config.slideshow.tvScreenTotalSecs.clamp(5, 7200);
    dev.log('[Slideshow] TV screen phase: ${tvSecs}s');
    _slideshowCycleTimer = Timer(Duration(seconds: tvSecs), () {
      if (!_isAlertActive) {
        _inSlideshowPhase = true;
        _displayState = DisplayState.slideshow;
        notifyListeners();
      }
      _scheduleSlideshowPhase();
    });
  }

  void _scheduleSlideshowPhase() {
    _inSlideshowPhase = true;
    final runSecs = _config.slideshow.slideshowRunTotalSecs.clamp(5, 3600);
    dev.log('[Slideshow] Slideshow phase: ${runSecs}s');
    _slideshowCycleTimer = Timer(Duration(seconds: runSecs), () {
      _inSlideshowPhase = false;
      if (!_isAlertActive) {
        _displayState = DisplayState.normal;
        notifyListeners();
      }
      _scheduleTvPhase();
    });
  }

  bool get _isAlertActive =>
      _alertTimeout != null ||
      _displayState == DisplayState.adhanAlert ||
      _displayState == DisplayState.iqamahAlert;

  // ── 1-second tick ─────────────────────────────────────────

  void _startTickTimer() {
    _tickTimer?.cancel();
    _tickTimer = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
  }

  void _tick() {
    if (_prayers.isEmpty) return;

    final slideshow = _config.slideshow;
    final result = PrayerEngine.getCurrentPrayerState(
      _prayers,
      pauseBeforeAdhanMins: slideshow.pauseBeforeAdhanMins,
      pauseAfterIqamahMins: slideshow.pauseAfterIqamahMins,
    );

    final state = result['state'] as PrayerState;
    final prayer = result['prayer'] as PrayerConfig?;
    final next = PrayerEngine.getNextPrayer(_prayers);

    // Trigger audio and overlays on state transitions
    if (state == PrayerState.adhanTime &&
        prayer != null &&
        _lastAlertedAdhan != prayer.key) {
      _lastAlertedAdhan = prayer.key;
      AudioService.playAlert(_config.features.adhanAudio);
      if (_displayState != DisplayState.adhanAlert) {
        _displayState = DisplayState.adhanAlert;
        _alertTimeout = DateTime.now().add(const Duration(minutes: 5));
      }
    }
    if (state == PrayerState.iqamahCountdown &&
        prayer != null &&
        _lastAlertedIqamah != prayer.key) {
      _lastAlertedIqamah = prayer.key;
      AudioService.playAlert(_config.features.iqamahAudio);
      if (_displayState != DisplayState.iqamahAlert) {
        _displayState = DisplayState.iqamahAlert;
        _alertTimeout = DateTime.now().add(const Duration(minutes: 2));
      }
    }

    final isAlertActive = state == PrayerState.adhanTime ||
        state == PrayerState.iqamahCountdown;

    _prayerState = state;
    _activePrayer = (isAlertActive && prayer?.key != next?.key) ? prayer : null;
    _nextPrayer = next;

    // Auto-dismiss alert overlay after timeout
    if (_alertTimeout != null && DateTime.now().isAfter(_alertTimeout!)) {
      _alertTimeout = null;
      // Return to the correct cycle phase
      _displayState = _inSlideshowPhase && _slideshowEnabled
          ? DisplayState.slideshow
          : DisplayState.normal;
    }

    notifyListeners();
  }

  // ── Midnight recalculation ────────────────────────────────

  void _scheduleMidnightRecalculation() {
    _midnightTimer?.cancel();
    final now = DateTime.now();
    final midnight = DateTime(now.year, now.month, now.day + 1);
    final msTillMidnight = midnight.difference(now);
    _midnightTimer = Timer(msTillMidnight, () {
      dev.log('[AppProvider] Midnight recalculation triggered');
      _recalculatePrayers();
      _scheduleMidnightRecalculation();
    });
  }

  // ── Sync status callback ───────────────────────────────────

  void _onSyncStatusChange(SyncStatus status) {
    _syncStatus = status;
    notifyListeners();
  }

  // ── Cleanup ────────────────────────────────────────────────

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _tickTimer?.cancel();
    _midnightTimer?.cancel();
    _slideshowCycleTimer?.cancel();
    _mediaChannel?.unsubscribe();
    _connectivitySub?.cancel();
    SupabaseSyncService.stopSync();
    AudioService.dispose();
    super.dispose();
  }
}
