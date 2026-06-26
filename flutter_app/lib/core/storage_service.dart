/// storage_service.dart
/// Expanded SharedPreferences-backed storage service.
/// Handles full AppConfig, PIN (hashed), device_id, and slide asset metadata.

import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'app_config.dart';

class StorageService {
  static late SharedPreferences _prefs;

  // SharedPreferences keys
  static const _kMasjidProfile = 'masjid_profile';
  static const _kTimeAdjustments = 'time_adjustments';
  static const _kFeaturesFormat = 'features_format';
  static const _kSlideshowSettings = 'slideshow_settings';
  static const _kJumuahSettings = 'jumuah_settings';
  static const _kTickerSettings = 'ticker_settings';
  static const _kSyncMeta = 'sync_meta';
  static const _kLocalAdminPinHash = 'local_admin_pin_hash';
  static const _kDeviceId = 'device_id';
  static const _kPinEnabled = 'local_admin_pin_enabled';

  static Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    await _seedInitialData();
  }

  // ─────────────────────────────────────────────────────────────
  // Seeding
  // ─────────────────────────────────────────────────────────────

  static Future<void> _seedInitialData() async {
    if (!_prefs.containsKey(_kMasjidProfile)) {
      await _saveSection(_kMasjidProfile, const MasjidProfile().toJson());
    }
    if (!_prefs.containsKey(_kTimeAdjustments)) {
      await _saveSection(_kTimeAdjustments, const TimeAdjustments().toJson());
    }
    if (!_prefs.containsKey(_kFeaturesFormat)) {
      await _saveSection(_kFeaturesFormat, const FeaturesFormat().toJson());
    }
    if (!_prefs.containsKey(_kSlideshowSettings)) {
      await _saveSection(_kSlideshowSettings, const SlideshowSettings().toJson());
    }
    if (!_prefs.containsKey(_kJumuahSettings)) {
      await _saveSection(_kJumuahSettings, const JumuahSettings().toJson());
    }
    if (!_prefs.containsKey(_kTickerSettings)) {
      await _saveSection(_kTickerSettings, const TickerSettings().toJson());
    }
    if (!_prefs.containsKey(_kSyncMeta)) {
      await _saveSection(_kSyncMeta, const SyncMeta().toJson());
    }
    // Default PIN is '1234' — stored as SHA-256 hash
    if (!_prefs.containsKey(_kLocalAdminPinHash)) {
      await _prefs.setString(_kLocalAdminPinHash, _hashPin('1234'));
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Full config load / save
  // ─────────────────────────────────────────────────────────────

  /// Load the full AppConfig from SharedPreferences.
  static Future<AppConfig> loadConfig() async {
    final map = <String, dynamic>{
      _kMasjidProfile: _loadSection(_kMasjidProfile),
      _kTimeAdjustments: _loadSection(_kTimeAdjustments),
      _kFeaturesFormat: _loadSection(_kFeaturesFormat),
      _kSlideshowSettings: _loadSection(_kSlideshowSettings),
      _kJumuahSettings: _loadSection(_kJumuahSettings),
      _kTickerSettings: _loadSection(_kTickerSettings),
      _kSyncMeta: _loadSection(_kSyncMeta),
    };
    final config = AppConfig.fromStorageMap(map);
    // Merge in live PIN values so they are included in the next cloud push
    final livePinEnabled = _prefs.getBool(_kPinEnabled) ?? false;
    final livePinHash = _prefs.getString(_kLocalAdminPinHash);
    return config.copyWith(
      meta: config.meta.copyWith(
        pinEnabled: livePinEnabled,
        pinHash: livePinHash,
      ),
    );
  }

  /// Save the full AppConfig to SharedPreferences.
  static Future<void> saveConfig(AppConfig config) async {
    await Future.wait([
      _saveSection(_kMasjidProfile, config.profile.toJson()),
      _saveSection(_kTimeAdjustments, config.adjustments.toJson()),
      _saveSection(_kFeaturesFormat, config.features.toJson()),
      _saveSection(_kSlideshowSettings, config.slideshow.toJson()),
      _saveSection(_kJumuahSettings, config.jumuah.toJson()),
      _saveSection(_kTickerSettings, config.ticker.toJson()),
      _saveSection(_kSyncMeta, config.meta.toJson()),
      // Keep _kPinEnabled in sync with meta.pinEnabled for fast sync read in initState
      _prefs.setBool(_kPinEnabled, config.meta.pinEnabled),
      // Sync PIN hash if provided (from cloud — so all devices enforce same PIN)
      if (config.meta.pinHash != null)
        _prefs.setString(_kLocalAdminPinHash, config.meta.pinHash!),
    ]);
  }

  /// Update only the sync meta (version, last sync timestamp, linked user info).
  static Future<void> saveSyncMeta(SyncMeta meta) async {
    await _saveSection(_kSyncMeta, meta.toJson());
  }

  /// Update only the masjid profile (e.g., after linking an account).
  static Future<void> saveProfile(MasjidProfile profile) async {
    await _saveSection(_kMasjidProfile, profile.toJson());
  }

  // ─────────────────────────────────────────────────────────────
  // PIN management
  // ─────────────────────────────────────────────────────────────

  /// Verify a plaintext PIN against the stored hash.
  static bool verifyPin(String pin) {
    final stored = _prefs.getString(_kLocalAdminPinHash);
    if (stored == null) return pin == '1234'; // fallback
    return _hashPin(pin) == stored;
  }

  /// Store a new PIN (hashed). Never stored as plaintext.
  static Future<void> setPin(String newPin) async {
    await _prefs.setString(_kLocalAdminPinHash, _hashPin(newPin));
  }

  static String _hashPin(String pin) {
    final bytes = utf8.encode(pin);
    return sha256.convert(bytes).toString();
  }

  /// Returns whether the local PIN gate is enabled.
  /// Defaults to false (disabled) — admin must explicitly enable it.
  static bool isPinEnabled() => _prefs.getBool(_kPinEnabled) ?? false;

  /// Enable or disable the local PIN gate.
  static Future<void> setPinEnabled(bool enabled) async {
    await _prefs.setBool(_kPinEnabled, enabled);
  }

  // ─────────────────────────────────────────────────────────────
  // Device ID
  // ─────────────────────────────────────────────────────────────

  static String? getDeviceId() => _prefs.getString(_kDeviceId);

  static Future<void> setDeviceId(String id) async {
    await _prefs.setString(_kDeviceId, id);
  }

  // ─────────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────────

  static Map<String, dynamic>? _loadSection(String key) {
    final str = _prefs.getString(key);
    if (str == null) return null;
    try {
      return jsonDecode(str) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  static Future<void> _saveSection(String key, Map<String, dynamic> data) async {
    await _prefs.setString(key, jsonEncode(data));
  }

  /// Clear all stored data (for testing / reset).
  static Future<void> clearAll() async {
    await _prefs.clear();
  }
}
