/// supabase_sync_service.dart
/// Supabase sync service — mirrors SyncService.js exactly.
/// Handles: link account, register, disconnect, push/pull config,
/// realtime subscription, periodic sync, and device heartbeat.
///
/// Auth runs through the `auth` Edge Function (supabase/functions/auth): the
/// client posts credentials, gets back a tenant-scoped JWT, and every Supabase
/// call after that is filtered by the RLS policies in
/// supabase/02_security_hardening.sql. The client never reads admin_users.

import 'dart:async';
import 'dart:developer' as dev;
import 'package:flutter/foundation.dart' show VoidCallback;
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'app_config.dart';
import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import 'storage_service.dart';
import 'auth_session.dart';
import 'device_service.dart';

// ─────────────────────────────────────────────────────────────
// Sync Status enum
// ─────────────────────────────────────────────────────────────

enum SyncStatus {
  localOnly,   // tenant_id is null — pure offline mode
  synced,      // last sync succeeded
  syncing,     // sync in progress
  offline,     // network unavailable, changes pending
  syncError,   // network available but sync failed
}

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

class SupabaseSyncService {
  static const String _supabaseUrl = 'https://veyrcvvvsomyrahjfvhh.supabase.co';
  static const String _supabaseAnonKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleXJjdnZ2c29teXJhaGpmdmhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NjI5MzUsImV4cCI6MjA5NzMzODkzNX0.-N470V130EwnrJabX1CMId8hLiaQal0g_al_eMJzQ-Q';
  static const String _appVersion = '1.1.0-flutter';

  /// Base URL for the Edge Functions. Media uploads and deletes go through
  /// `media-proxy` so the PHP server's shared key stays off the device.
  static String get functionsUrl => '$_supabaseUrl/functions/v1';
  static String get anonKey => _supabaseAnonKey;

  static SupabaseClient? _client;
  static Timer? _syncTimer;
  static RealtimeChannel? _realtimeChannel;
  static StreamSubscription<List<ConnectivityResult>>? _connectivitySub;
  static Function(SyncStatus)? _onStatusChange;
  static VoidCallback? _onConfigUpdated;
  static String? _activeTenantId; // Tracks which tenant realtime is subscribed to

  // ─────────────────────────────────────────────────────────────
  // Init
  // ─────────────────────────────────────────────────────────────

  static Future<void> init() async {
    await AuthSession.init(supabaseUrl: _supabaseUrl, anonKey: _supabaseAnonKey);
    await Supabase.initialize(
      url: _supabaseUrl,
      anonKey: _supabaseAnonKey,
      // Third-party auth hook: supabase_flutter calls this before each request
      // (PostgREST, Storage and realtime re-auth) and uses the result as the
      // bearer, so RLS sees our tenant_id claim instead of the anon role.
      accessToken: () async => AuthSession.token ?? _supabaseAnonKey,
    );
    _client = Supabase.instance.client;
    dev.log('[Sync] Supabase initialized');
  }

  static SupabaseClient get client {
    _client ??= Supabase.instance.client;
    return _client!;
  }

  // ─────────────────────────────────────────────────────────────
  // Start / Stop sync
  // ─────────────────────────────────────────────────────────────

  static Future<void> startSync({
    required Function(SyncStatus) onStatusChange,
    required VoidCallback onConfigUpdated,
  }) async {
    _onStatusChange = onStatusChange;
    _onConfigUpdated = onConfigUpdated;

    // Initial sync first — this ensures tenantId is fresh in local storage
    await syncNow();

    // Bug 5 fix: Read tenantId AFTER syncNow() completes so it's fresh
    final config = await StorageService.loadConfig();
    final tenantId = config.profile.tenantId;

    if (tenantId != null && tenantId.isNotEmpty) {
      _subscribeRealtime(tenantId);
    }

    // Periodic sync every 5 minutes (more responsive than 15)
    _syncTimer?.cancel();
    _syncTimer = Timer.periodic(const Duration(minutes: 5), (_) => syncNow());

    // Sync on network reconnect
    _connectivitySub?.cancel();
    _connectivitySub = Connectivity()
        .onConnectivityChanged
        .listen((results) {
      final hasConnection = results.any((r) => r != ConnectivityResult.none);
      if (hasConnection) {
        dev.log('[Sync] Network reconnected — syncing now');
        syncNow();
      }
    });

    dev.log('[Sync] Sync started for tenant: $tenantId');
  }

  /// Bug 3 fix: Called on app resume to re-establish dropped WebSocket.
  static Future<void> resubscribeIfNeeded() async {
    final config = await StorageService.loadConfig();
    final tenantId = config.profile.tenantId;
    if (tenantId == null || tenantId.isEmpty) return;

    // Re-subscribe if channel is null or tenant changed
    if (_realtimeChannel == null || _activeTenantId != tenantId) {
      dev.log('[Sync] Re-establishing realtime subscription on resume');
      _subscribeRealtime(tenantId);
    }

    // Also do a fresh pull to catch any changes made while backgrounded
    await syncNow();
  }

  static Future<void> stopSync() async {
    _syncTimer?.cancel();
    _syncTimer = null;
    _connectivitySub?.cancel();
    _connectivitySub = null;

    if (_realtimeChannel != null) {
      await client.removeChannel(_realtimeChannel!);
      _realtimeChannel = null;
    }
    _activeTenantId = null;
    dev.log('[Sync] Sync stopped');
  }

  static void _subscribeRealtime(String tenantId) {
    if (_realtimeChannel != null) {
      client.removeChannel(_realtimeChannel!);
      _realtimeChannel = null;
    }

    _activeTenantId = tenantId;

    // Bug 1 fix: Filter channel to only this tenant's row
    _realtimeChannel = client
        .channel('mosque-config-$tenantId') // unique channel name per tenant
        .onPostgresChanges(
          event: PostgresChangeEvent.update, // only listen for updates
          schema: 'public',
          table: 'mosque_configs',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'tenant_id',
            value: tenantId,
          ),
          callback: (payload) async {
            dev.log('[Sync] Realtime config update received for tenant $tenantId');
            final newData = payload.newRecord;

            // Bug 2 fix: Guard against wrong-tenant payloads
            final payloadTenantId = newData['tenant_id'] as String?;
            if (payloadTenantId != tenantId) {
              dev.log('[Sync] Ignored realtime event for wrong tenant: $payloadTenantId');
              return;
            }

            final remoteVersions =
                (newData['section_versions'] as Map<String, dynamic>? ?? {})
                    .map((k, v) => MapEntry(k, (v as num?)?.toInt() ?? 0));
            final remoteJson = newData['config_json'] as Map<String, dynamic>? ?? {};
            final localVersions = StorageService.getSectionVersions();
            final dirty = StorageService.getDirtySections();

            // Take only the sections that moved and that this device has no
            // unpushed edit in, so somebody else's push cannot clobber a local
            // change that syncNow has yet to send.
            final toPull = AppConfig.configSections
                .where((name) =>
                    remoteJson[name] != null &&
                    !dirty.contains(name) &&
                    (remoteVersions[name] ?? 0) > (localVersions[name] ?? 0))
                .toList();

            if (toPull.isEmpty) {
              dev.log('[Sync] Realtime event had nothing new for this device');
              return;
            }

            final picked = <String, dynamic>{for (final n in toPull) n: remoteJson[n]};
            await _applySections(
              picked,
              remoteVersions,
              toPull,
              (newData['config_version'] as num?)?.toInt() ?? 0,
            );
            _onConfigUpdated?.call();
            _onStatusChange?.call(SyncStatus.synced);
          },
        )
        .subscribe((status, [error]) {
          dev.log('[Sync] Realtime subscription status: $status${error != null ? " error: $error" : ""}}');
          if (status == RealtimeSubscribeStatus.closed) {
            dev.log('[Sync] Realtime channel closed — will resubscribe on next resume');
            _realtimeChannel = null;
          }
        });
  }

  // ─────────────────────────────────────────────────────────────
  // Core sync
  // ─────────────────────────────────────────────────────────────

  static Future<void> syncNow() async {
    // Check connectivity
    final connectivity = await Connectivity().checkConnectivity();
    final isOnline = connectivity.any((r) => r != ConnectivityResult.none);

    if (!isOnline) {
      _onStatusChange?.call(SyncStatus.offline);
      return;
    }

    final config = await StorageService.loadConfig();
    final tenantId = config.profile.tenantId;
    final deviceId = config.meta.deviceId ?? DeviceService.getDeviceId();

    if (tenantId == null || tenantId.isEmpty) {
      _onStatusChange?.call(SyncStatus.localOnly);
      return;
    }

    if (AuthSession.token == null) {
      // Linked but the token is gone (cleared data, or linked by a build that
      // predates token auth). Local config keeps working; sync cannot.
      dev.log('[Sync] Linked tenant with no auth token — re-link required');
      _onStatusChange?.call(SyncStatus.syncError);
      return;
    }

    _onStatusChange?.call(SyncStatus.syncing);

    try {
      if (!await AuthSession.refreshIfNeeded()) {
        _onStatusChange?.call(SyncStatus.syncError);
        return;
      }

      // 1. Heartbeat — update device_registry
      if (deviceId != null) {
        await client.from('device_registry').upsert({
          'tenant_id': tenantId,
          'device_id': deviceId,
          'last_seen': DateTime.now().toIso8601String(),
          'online_status': true,
          'app_version': _appVersion,
        }, onConflict: 'tenant_id,device_id');
      }

      // 2. Reconcile with the cloud, section by section
      final dirty = StorageService.getDirtySections();
      final localVersions = StorageService.getSectionVersions();

      final response = await client
          .from('mosque_configs')
          .select('config_version, config_json, section_versions')
          .eq('tenant_id', tenantId)
          .maybeSingle();

      if (response != null) {
        // Pull only the sections that actually moved, and never one this device
        // has an unpushed edit in. A TV offline for a week now takes the phone's
        // new prayer times without reverting anything it never touched.
        final remoteVersions =
            (response['section_versions'] as Map<String, dynamic>? ?? {})
                .map((k, v) => MapEntry(k, (v as num?)?.toInt() ?? 0));
        final remoteJson = response['config_json'] as Map<String, dynamic>? ?? {};

        final toPull = <String>[];
        for (final name in AppConfig.configSections) {
          if (remoteJson[name] == null) continue;
          final rv = remoteVersions[name] ?? 0;
          final lv = localVersions[name] ?? 0;
          if (rv <= lv) continue;
          if (dirty.contains(name)) {
            // Same section edited on both sides. Rare now that sections are
            // independent; the edit made on this screen wins and we say so.
            dev.log('[Sync] Conflict in "$name" (remote v$rv) — local edit wins');
            continue;
          }
          toPull.add(name);
        }

        if (toPull.isNotEmpty) {
          final picked = <String, dynamic>{for (final n in toPull) n: remoteJson[n]};
          await _applySections(
            picked,
            remoteVersions,
            toPull,
            (response['config_version'] as num?)?.toInt() ?? 0,
          );
          _onConfigUpdated?.call();
        }
      }

      if (dirty.isNotEmpty || response == null) {
        await pushConfigToCloud(
          await StorageService.loadConfig(),
          sections: response != null ? dirty : null,
        );
      }

      _onStatusChange?.call(SyncStatus.synced);
    } catch (e) {
      dev.log('[Sync] Failed: $e');
      _onStatusChange?.call(SyncStatus.syncError);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Push to cloud
  // ─────────────────────────────────────────────────────────────

  /// Pushes [sections] (default: everything) as a section-wise merge. The
  /// server leaves every section not named here exactly as it is, so this can
  /// never revert another device's work.
  static Future<void> pushConfigToCloud(AppConfig config, {List<String>? sections}) async {
    final tenantId = config.profile.tenantId;
    if (tenantId == null || tenantId.isEmpty) return;

    final names = (sections != null && sections.isNotEmpty)
        ? sections
        : AppConfig.configSections;
    final all = config.toCloudSections();
    final payload = <String, dynamic>{for (final n in names) n: all[n]};

    final deviceId = config.meta.deviceId ?? 'unknown';

    // Marked before the call and cleared only on success, so a failure at any
    // point (offline, token rejected, process killed mid-flight) leaves a
    // durable marker for the next syncNow.
    await StorageService.markSectionsDirty(names);

    try {
      final result = await client.rpc('push_config_sections', params: {
        'p_tenant_id': tenantId,
        'p_sections': payload,
        'p_device_id': deviceId,
      }) as Map<String, dynamic>?;

      final newVersion = (result?['config_version'] as num?)?.toInt() ??
          config.meta.supabaseConfigVersion;
      final newVersions = (result?['section_versions'] as Map<String, dynamic>? ?? {})
          .map((k, v) => MapEntry(k, (v as num?)?.toInt() ?? 0));

      dev.log('[Sync] Pushed ${names.length} section(s) → version $newVersion');

      await StorageService.saveSectionVersions(newVersions);
      await StorageService.saveSyncMeta(config.meta.copyWith(
        supabaseConfigVersion: newVersion,
        lastSuccessfulSync: DateTime.now().millisecondsSinceEpoch,
      ));
      await StorageService.clearDirtySections(names);
    } catch (e) {
      dev.log('[Sync] Failed to push config: $e');
      rethrow;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Apply remote config locally
  // ─────────────────────────────────────────────────────────────

  /// Applies [picked] cloud sections onto local storage, recording the versions
  /// this device is now in step with. Sections not named here -- and all
  /// device-local meta -- are left exactly as they are.
  static Future<void> _applySections(
    Map<String, dynamic> picked,
    Map<String, int> remoteVersions,
    List<String> applied,
    int configVersion,
  ) async {
    final current = await StorageService.loadConfig();
    final next = current.applyCloudSections(picked);

    final versions = Map<String, int>.from(StorageService.getSectionVersions());
    for (final name in applied) {
      versions[name] = remoteVersions[name] ?? 0;
    }

    await StorageService.saveConfig(next.copyWith(
      meta: next.meta.copyWith(
        supabaseConfigVersion: configVersion,
        lastSuccessfulSync: DateTime.now().millisecondsSinceEpoch,
      ),
    ));
    await StorageService.saveSectionVersions(versions);
    dev.log('[Sync] Applied section(s): ${applied.join(", ")}');
  }

  static Future<void> _applyConfig(Map<String, dynamic> configJson, int newVersion) async {
    final currentConfig = await StorageService.loadConfig();

    // Build new config from cloud, preserving device-local meta
    final updatedMeta = currentConfig.meta.copyWith(
      supabaseConfigVersion: newVersion,
      lastSuccessfulSync: DateTime.now().millisecondsSinceEpoch,
    );

    final newConfig = AppConfig.fromCloudJson(configJson, localMeta: updatedMeta);
    await StorageService.saveConfig(newConfig);
    dev.log('[Sync] Applied cloud config version: $newVersion');
  }

  // ─────────────────────────────────────────────────────────────
  // Account: Link existing
  // ─────────────────────────────────────────────────────────────

  /// Links this device to an existing tenant account.
  /// The password is verified server-side (bcrypt, inside app_login) and we get
  /// back a tenant-scoped JWT. Nothing here reads admin_users, and the old
  /// string-interpolated `.or()` filter — a PostgREST filter injection — is gone.
  static Future<LinkedAccountResult> linkAccount(
      String identifier, String password) async {
    final session = await AuthSession.login(identifier, password);
    final tenantId = session.tenantId;

    final configResponse = await client
        .from('mosque_configs')
        .select('config_version, config_json, section_versions')
        .eq('tenant_id', tenantId)
        .maybeSingle();

    final currentConfig = await StorageService.loadConfig();

    final updatedMeta = currentConfig.meta.copyWith(
      linkedUsername: session.username.isEmpty ? null : session.username,
      linkedMobile: session.mobile.isEmpty ? null : session.mobile,
      linkedEmail: session.email.isEmpty ? null : session.email,
      linkedMosqueName: session.mosqueName,
      supabaseConfigVersion: configResponse != null
          ? (configResponse['config_version'] as num?)?.toInt() ?? 0
          : 0,
      lastSuccessfulSync: DateTime.now().millisecondsSinceEpoch,
    );

    if (configResponse != null) {
      final newConfig = AppConfig.fromCloudJson(
        configResponse['config_json'] as Map<String, dynamic>,
        localMeta: updatedMeta,
      );
      final profileWithTenant = newConfig.profile.copyWith(tenantId: tenantId);
      await StorageService.saveConfig(newConfig.copyWith(
        profile: profileWithTenant,
        meta: updatedMeta,
      ));
      // Cloud state was just adopted wholesale; nothing local is outstanding.
      await StorageService.saveSectionVersions(
        (configResponse['section_versions'] as Map<String, dynamic>? ?? {})
            .map((k, v) => MapEntry(k, (v as num?)?.toInt() ?? 0)),
      );
      await StorageService.clearDirtySections();
    } else {
      // Empty account: this device's existing setup becomes the account's.
      final profileWithTenant = currentConfig.profile.copyWith(tenantId: tenantId);
      await StorageService.saveConfig(currentConfig.copyWith(
        profile: profileWithTenant,
        meta: updatedMeta,
      ));
      await StorageService.saveSectionVersions({});
      await StorageService.markSectionsDirty(AppConfig.configSections);
    }

    _subscribeRealtime(tenantId);

    return LinkedAccountResult(
      tenantId: tenantId,
      username: session.username,
      mobile: session.mobile,
      email: session.email,
      mosqueName: session.mosqueName,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Account: Register new
  // ─────────────────────────────────────────────────────────────

  static Future<LinkedAccountResult> registerAccount({
    required String mosqueName,
    required String username,
    required String password,
    String? mobile,
    String? email,
  }) async {
    // Tenant + admin user are created together inside app_register(), which
    // bcrypts the password. Doing it client-side previously left an orphaned
    // tenant behind whenever the user insert failed, and stored the password
    // verbatim in password_hash.
    final session = await AuthSession.register(
      mosqueName: mosqueName,
      username: username,
      password: password,
      mobile: mobile,
      email: email,
    );
    final tenantId = session.tenantId;

    final currentConfig = await StorageService.loadConfig();
    final updatedMeta = currentConfig.meta.copyWith(
      linkedUsername: session.username.isEmpty ? username : session.username,
      linkedMobile: session.mobile.isEmpty ? null : session.mobile,
      linkedEmail: session.email.isEmpty ? null : session.email,
      linkedMosqueName: session.mosqueName,
      supabaseConfigVersion: 0,
      lastSuccessfulSync: DateTime.now().millisecondsSinceEpoch,
    );

    final initialConfig = currentConfig.copyWith(
      profile: currentConfig.profile.copyWith(
        name: mosqueName,
        tenantId: tenantId,
      ),
      meta: updatedMeta,
    );
    await StorageService.saveConfig(initialConfig);
    await StorageService.saveSectionVersions({});

    await pushConfigToCloud(initialConfig);

    _subscribeRealtime(tenantId);

    return LinkedAccountResult(
      tenantId: tenantId,
      username: session.username.isEmpty ? username : session.username,
      mobile: session.mobile,
      email: session.email,
      mosqueName: session.mosqueName,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Account: Disconnect
  // ─────────────────────────────────────────────────────────────

  static Future<void> disconnectAccount() async {
    final currentConfig = await StorageService.loadConfig();
    final tenantId = currentConfig.profile.tenantId;
    final deviceId = currentConfig.meta.deviceId ?? DeviceService.getDeviceId();

    // Clear the heartbeat latch while the token is still valid.
    if (tenantId != null && tenantId.isNotEmpty && deviceId != null && AuthSession.token != null) {
      try {
        await client
            .from('device_registry')
            .update({'online_status': false})
            .eq('tenant_id', tenantId)
            .eq('device_id', deviceId);
      } catch (e) {
        dev.log('[Sync] Could not clear online_status: $e');
      }
    }

    await stopSync();
    await AuthSession.clear();
    await StorageService.clearDirtySections();
    await StorageService.saveSectionVersions({});

    // Clear cloud-linked fields; preserve all local settings
    final updatedProfile = currentConfig.profile.copyWith(clearTenantId: true);
    final updatedMeta = SyncMeta(
      deviceId: currentConfig.meta.deviceId,
      supabaseConfigVersion: 0,
    );

    await StorageService.saveConfig(currentConfig.copyWith(
      profile: updatedProfile,
      meta: updatedMeta,
    ));

    dev.log('[Sync] Disconnected from cloud. Local settings preserved.');
  }

  // ─────────────────────────────────────────────────────────────
  // Tenant test connection
  // ─────────────────────────────────────────────────────────────

  /// Verify a tenant UUID exists in the tenants table.
  static Future<bool> testTenantConnection(String tenantId) async {
    try {
      final response = await client
          .from('tenants')
          .select('id')
          .eq('id', tenantId)
          .maybeSingle();
      return response != null;
    } catch (_) {
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Storage (Custom PHP Endpoint)
  // ─────────────────────────────────────────────────────────────

  static Future<String> uploadImage(Uint8List bytes, String filename, String pathPrefix) async {
    // Goes through the media-proxy Edge Function. The PHP server's bearer key
    // used to be a const right here, i.e. inside the shipped APK, and its
    // delete endpoint keys off a bare filename -- so anyone who pulled the key
    // out of the binary could delete any mosque's media.
    final token = AuthSession.token;
    if (token == null) throw Exception('Not linked to a cloud account');

    try {
      final request = http.MultipartRequest('POST', Uri.parse('$functionsUrl/media-proxy'));
      request.headers['Authorization'] = 'Bearer $token';
      request.headers['apikey'] = anonKey;
      request.fields['filename'] = filename;
      request.fields['category'] = pathPrefix == 'backgrounds' ? 'background' : 'slide_general';
      request.files.add(http.MultipartFile.fromBytes('file', bytes, filename: filename));

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);
      final data = jsonDecode(response.body) as Map<String, dynamic>;

      if (response.statusCode != 200) {
        throw Exception(data['error'] ?? 'Server returned ${response.statusCode}');
      }
      return data['url'] as String;
    } catch (e) {
      dev.log('[Sync] Upload failed: $e');
      throw Exception('Upload failed. $e');
    }
  }

  static Future<void> deleteImage(String publicUrl) async {
    // Deletes are keyed by media_library row id, not by URL, so the proxy can
    // confirm the row belongs to the caller's tenant before removing anything.
    dev.log('[Sync] deleteImage is a no-op; use MediaLibraryService.deleteFile(tenantId, fileId).');
  }
}

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

class LinkedAccountResult {
  final String tenantId;
  final String username;
  final String mobile;
  final String email;
  final String mosqueName;

  const LinkedAccountResult({
    required this.tenantId,
    required this.username,
    required this.mobile,
    required this.email,
    required this.mosqueName,
  });
}
