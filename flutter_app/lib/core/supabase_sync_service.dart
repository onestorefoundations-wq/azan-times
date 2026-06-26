/// supabase_sync_service.dart
/// Supabase sync service — mirrors SyncService.js exactly.
/// Handles: link account, register, disconnect, push/pull config,
/// realtime subscription, periodic sync, and device heartbeat.
///
/// ⚠️ SECURITY NOTE: The current auth approach does a direct table query
/// comparing password to password_hash. This is the same method used in
/// the web client (SyncService.js) and the existing live system.
/// For production hardening, replace with a Supabase Edge Function RPC
/// for login that never exposes password_hash to the client.

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
  static const String _appVersion = '1.0.0-flutter';

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
    await Supabase.initialize(url: _supabaseUrl, anonKey: _supabaseAnonKey); // ignore: deprecated_member_use
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

            if (newData.isNotEmpty && newData['config_json'] != null) {
              final configJson = newData['config_json'] as Map<String, dynamic>;
              final version = (newData['config_version'] as num?)?.toInt() ?? 0;

              // Only apply if remote version is newer than what we last wrote
              final currentConfig = await StorageService.loadConfig();
              if (version > currentConfig.meta.supabaseConfigVersion) {
                dev.log('[Sync] Applying remote version $version (local: ${currentConfig.meta.supabaseConfigVersion})');
                await _applyConfig(configJson, version);
                _onConfigUpdated?.call();
                _onStatusChange?.call(SyncStatus.synced);
              } else {
                dev.log('[Sync] Ignored stale realtime event (version $version <= local)');
              }
            }
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

    _onStatusChange?.call(SyncStatus.syncing);

    try {
      // 1. Heartbeat — update device_registry
      if (deviceId != null) {
        await client.from('device_registry').upsert({
          'tenant_id': tenantId,
          'device_id': deviceId,
          'last_seen': DateTime.now().toIso8601String(),
          'online_status': true,
          'app_version': _appVersion,
        }, onConflict: 'device_id');
      }

      // 2. Pull new config if remote version is higher
      final localVersion = config.meta.supabaseConfigVersion;
      final response = await client
          .from('mosque_configs')
          .select('config_version, config_json, updated_at')
          .eq('tenant_id', tenantId)
          .order('config_version', ascending: false)
          .limit(1)
          .maybeSingle();

      if (response != null) {
        final remoteVersion = (response['config_version'] as num?)?.toInt() ?? 0;

        if (remoteVersion > localVersion) {
          // Remote is newer — pull
          dev.log('[Sync] Remote version $remoteVersion > local $localVersion — pulling');
          await _applyConfig(response['config_json'] as Map<String, dynamic>, remoteVersion);
          _onConfigUpdated?.call();
          _onStatusChange?.call(SyncStatus.synced);
        } else if (localVersion > remoteVersion) {
          // Local is newer — push
          // ⚠️ TODO: Replace client-side increment with a Postgres RPC call
          // (e.g., increment_config_version()) to avoid race conditions on multi-device tenants.
          dev.log('[Sync] Local version $localVersion > remote $remoteVersion — pushing');
          await pushConfigToCloud(config);
          _onStatusChange?.call(SyncStatus.synced);
        } else {
          _onStatusChange?.call(SyncStatus.synced);
        }
      } else {
        // No remote config — push local
        await pushConfigToCloud(config);
        _onStatusChange?.call(SyncStatus.synced);
      }
    } catch (e) {
      dev.log('[Sync] Failed: $e');
      _onStatusChange?.call(SyncStatus.syncError);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Push to cloud
  // ─────────────────────────────────────────────────────────────

  static Future<void> pushConfigToCloud(AppConfig config) async {
    final tenantId = config.profile.tenantId;
    if (tenantId == null || tenantId.isEmpty) return;

    try {
      final cloudJson = config.toCloudJson();
      final deviceId = config.meta.deviceId ?? 'unknown';

      // Bug 4 fix: Use atomic server-side RPC instead of read-increment-write
      // This prevents race conditions on multi-device tenants.
      // Falls back to legacy client-side push if RPC not yet created.
      int newVersion;
      try {
        final result = await client.rpc('increment_and_push_config', params: {
          'p_tenant_id': tenantId,
          'p_config_json': cloudJson,
          'p_device_id': deviceId,
        });
        newVersion = (result as num?)?.toInt() ?? 1;
        dev.log('[Sync] Pushed config via RPC to cloud version: $newVersion');
      } catch (rpcError) {
        // Fallback: RPC not yet deployed — use legacy client-side push
        dev.log('[Sync] RPC not available, falling back to direct update: $rpcError');
        final current = await client
            .from('mosque_configs')
            .select('id, config_version')
            .eq('tenant_id', tenantId)
            .maybeSingle();

        newVersion = current != null
            ? ((current['config_version'] as num?)?.toInt() ?? 0) + 1
            : 1;

        if (current != null) {
          await client.from('mosque_configs').update({
            'config_version': newVersion,
            'config_json': cloudJson,
            'updated_at': DateTime.now().toIso8601String(),
            'updated_by': deviceId,
          }).eq('id', current['id'] as String);
        } else {
          await client.from('mosque_configs').insert({
            'tenant_id': tenantId,
            'config_version': newVersion,
            'config_json': cloudJson,
            'updated_by': deviceId,
          });
        }
        dev.log('[Sync] Pushed config (fallback) to cloud version: $newVersion');
      }

      // Update local version to match what server confirmed
      final updatedMeta = config.meta.copyWith(
        supabaseConfigVersion: newVersion,
        lastSuccessfulSync: DateTime.now().millisecondsSinceEpoch,
      );
      await StorageService.saveSyncMeta(updatedMeta);
    } catch (e) {
      dev.log('[Sync] Failed to push config: $e');
      rethrow;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Apply remote config locally
  // ─────────────────────────────────────────────────────────────

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
  /// ⚠️ SECURITY: Direct table query compares password to password_hash.
  /// Migrate to a Supabase Edge Function for production hardening.
  static Future<LinkedAccountResult> linkAccount(
      String identifier, String password) async {
    // Query admin_users by username, mobile, or email + password
    final userResponse = await client
        .from('admin_users')
        .select('tenant_id, username, mobile, email')
        .or('username.eq."$identifier",mobile.eq."$identifier",email.eq."$identifier"')
        .eq('password_hash', password)
        .maybeSingle();

    if (userResponse == null) {
      throw Exception('Invalid username/mobile/email or password');
    }

    final tenantId = userResponse['tenant_id'] as String;

    // Fetch tenant name
    final tenantResponse = await client
        .from('tenants')
        .select('name')
        .eq('id', tenantId)
        .maybeSingle();

    final mosqueName = tenantResponse?['name'] as String? ?? 'Linked Mosque';

    // Fetch remote config
    final configResponse = await client
        .from('mosque_configs')
        .select('config_version, config_json')
        .eq('tenant_id', tenantId)
        .maybeSingle();

    final currentConfig = await StorageService.loadConfig();

    // Build updated meta
    final updatedMeta = currentConfig.meta.copyWith(
      linkedUsername: userResponse['username'] as String?,
      linkedMobile: userResponse['mobile'] as String?,
      linkedEmail: userResponse['email'] as String?,
      linkedMosqueName: mosqueName,
      supabaseConfigVersion: configResponse != null
          ? (configResponse['config_version'] as num?)?.toInt() ?? 0
          : 0,
      lastSuccessfulSync: DateTime.now().millisecondsSinceEpoch,
    );

    if (configResponse != null) {
      // Apply remote config, overriding local
      final newConfig = AppConfig.fromCloudJson(
        configResponse['config_json'] as Map<String, dynamic>,
        localMeta: updatedMeta,
      );
      // Ensure tenant_id is set on profile
      final profileWithTenant = newConfig.profile.copyWith(tenantId: tenantId);
      await StorageService.saveConfig(newConfig.copyWith(
        profile: profileWithTenant,
        meta: updatedMeta,
      ));
    } else {
      // No cloud config — just update tenant_id locally
      final profileWithTenant = currentConfig.profile.copyWith(tenantId: tenantId);
      await StorageService.saveConfig(currentConfig.copyWith(
        profile: profileWithTenant,
        meta: updatedMeta,
      ));
    }

    // Restart realtime subscription with new tenant
    _subscribeRealtime(tenantId);

    return LinkedAccountResult(
      tenantId: tenantId,
      username: userResponse['username'] as String? ?? '',
      mobile: userResponse['mobile'] as String? ?? '',
      email: userResponse['email'] as String? ?? '',
      mosqueName: mosqueName,
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
    // Check username uniqueness
    final existing = await client
        .from('admin_users')
        .select('id')
        .eq('username', username)
        .maybeSingle();

    if (existing != null) {
      throw Exception('Username already registered');
    }

    // Create tenant
    final tenantResponse = await client
        .from('tenants')
        .insert({'name': mosqueName})
        .select()
        .single();

    final tenantId = tenantResponse['id'] as String;

    // Create admin user
    // ⚠️ Password stored as-is in password_hash — migrate to hashed RPC for production.
    final userResponse = await client
        .from('admin_users')
        .insert({
          'tenant_id': tenantId,
          'username': username,
          'mobile': mobile,
          'email': email,
          'password_hash': password,
        })
        .select()
        .single();

    // Build initial config from current local settings
    final currentConfig = await StorageService.loadConfig();
    final initialConfig = currentConfig.copyWith(
      profile: currentConfig.profile.copyWith(
        name: mosqueName,
        tenantId: tenantId,
      ),
    );

    // Push initial config to cloud
    await client.from('mosque_configs').insert({
      'tenant_id': tenantId,
      'config_version': 1,
      'config_json': initialConfig.toCloudJson(),
    });

    // Update local meta
    final updatedMeta = currentConfig.meta.copyWith(
      linkedUsername: userResponse['username'] as String?,
      linkedMobile: userResponse['mobile'] as String?,
      linkedEmail: userResponse['email'] as String?,
      linkedMosqueName: mosqueName,
      supabaseConfigVersion: 1,
      lastSuccessfulSync: DateTime.now().millisecondsSinceEpoch,
    );

    await StorageService.saveConfig(initialConfig.copyWith(meta: updatedMeta));

    // Start realtime subscription
    _subscribeRealtime(tenantId);

    return LinkedAccountResult(
      tenantId: tenantId,
      username: userResponse['username'] as String? ?? username,
      mobile: userResponse['mobile'] as String? ?? '',
      email: userResponse['email'] as String? ?? '',
      mosqueName: mosqueName,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Account: Disconnect
  // ─────────────────────────────────────────────────────────────

  static Future<void> disconnectAccount() async {
    await stopSync();

    final currentConfig = await StorageService.loadConfig();

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
    const uploadUrl = 'https://expertai.co.uk/softwares/general_upload/masjidazan/uploads.php';
    const apiKey = r'EverY0NeKnoW$1T';

    try {
      final request = http.MultipartRequest('POST', Uri.parse(uploadUrl));
      request.headers['Authorization'] = 'Bearer $apiKey';
      request.files.add(http.MultipartFile.fromBytes('file', bytes, filename: filename));

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true) {
          String rawUrl = data['url'] as String;
          // The PHP script might return https://your-server.com/uploads/...
          // Replace it with the actual working URL path if needed.
          if (rawUrl.contains('your-server.com') || rawUrl.contains('expertai.co.uk')) {
            final filename = rawUrl.split('/').last;
            return 'https://expertai.co.uk/softwares/general_upload/masjidazan/uploads/$filename';
          }
          return rawUrl;
        } else {
          throw Exception(data['error'] ?? 'Upload failed by server');
        }
      } else {
        throw Exception('Server returned ${response.statusCode}');
      }
    } catch (e) {
      dev.log('[Sync] Upload failed: $e');
      throw Exception('Upload failed. $e');
    }
  }

  static Future<void> deleteImage(String publicUrl) async {
    // Delete API not provided in the PHP script, so we silently skip.
    // If you add a delete endpoint later, implement it here.
    dev.log('[Sync] Cannot delete $publicUrl because delete API is not implemented.');
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
