/// app_config.dart
/// Strongly-typed AppConfig model hierarchy matching web's config_json shape exactly.

import 'dart:convert';
import 'package:flutter/material.dart' show Color, Colors;

// ═══════════════════════════════════════════════════════════════
// Sub-models
// ═══════════════════════════════════════════════════════════════

class MasjidProfile {
  final String name;
  final String? nameArabic;
  final String? tenantId;
  final double latitude;
  final double longitude;
  final String timezoneId;
  final String calculationMethod;
  final String asrJuristicMethod;

  const MasjidProfile({
    this.name = 'Local Mosque',
    this.nameArabic,
    this.tenantId,
    this.latitude = 11.100030590411507,
    this.longitude = 76.22848915791933,
    this.timezoneId = 'Asia/Kolkata',
    this.calculationMethod = 'Karachi',
    this.asrJuristicMethod = 'Standard',
  });

  MasjidProfile copyWith({
    String? name,
    String? nameArabic,
    String? tenantId,
    double? latitude,
    double? longitude,
    String? timezoneId,
    String? calculationMethod,
    String? asrJuristicMethod,
    bool clearTenantId = false,
    bool clearNameArabic = false,
  }) {
    return MasjidProfile(
      name: name ?? this.name,
      nameArabic: clearNameArabic ? null : (nameArabic ?? this.nameArabic),
      tenantId: clearTenantId ? null : (tenantId ?? this.tenantId),
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      timezoneId: timezoneId ?? this.timezoneId,
      calculationMethod: calculationMethod ?? this.calculationMethod,
      asrJuristicMethod: asrJuristicMethod ?? this.asrJuristicMethod,
    );
  }

  factory MasjidProfile.fromJson(Map<String, dynamic> json) {
    return MasjidProfile(
      name: json['name'] as String? ?? 'Local Mosque',
      nameArabic: json['name_arabic'] as String?,
      tenantId: json['tenant_id'] as String?,
      latitude: (json['latitude'] as num?)?.toDouble() ?? 11.100030590411507,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 76.22848915791933,
      timezoneId: json['timezone_id'] as String? ?? 'Asia/Kolkata',
      calculationMethod: json['calculation_method'] as String? ?? 'Karachi',
      asrJuristicMethod: json['asr_juristic_method'] as String? ?? 'Standard',
    );
  }

  Map<String, dynamic> toJson() => {
        'name': name,
        'name_arabic': nameArabic,
        'tenant_id': tenantId,
        'latitude': latitude,
        'longitude': longitude,
        'timezone_id': timezoneId,
        'calculation_method': calculationMethod,
        'asr_juristic_method': asrJuristicMethod,
      };
}

class PrayerOffset {
  final int adhanOffset; // minutes (can be negative)
  final int iqamahWait;  // minutes after adhan

  const PrayerOffset({this.adhanOffset = 0, this.iqamahWait = 15});

  PrayerOffset copyWith({int? adhanOffset, int? iqamahWait}) {
    return PrayerOffset(
      adhanOffset: adhanOffset ?? this.adhanOffset,
      iqamahWait: iqamahWait ?? this.iqamahWait,
    );
  }

  factory PrayerOffset.fromJson(Map<String, dynamic> json, String prefix) {
    return PrayerOffset(
      adhanOffset: (json['${prefix}_adhan_offset'] as num?)?.toInt() ?? 0,
      iqamahWait: (json['${prefix}_iqamah_wait'] as num?)?.toInt() ?? 15,
    );
  }
}

class TimeAdjustments {
  final PrayerOffset fajr;
  final PrayerOffset dhuhr;
  final PrayerOffset asr;
  final PrayerOffset maghrib;
  final PrayerOffset isha;

  const TimeAdjustments({
    this.fajr = const PrayerOffset(adhanOffset: 0, iqamahWait: 25),
    this.dhuhr = const PrayerOffset(adhanOffset: -2, iqamahWait: 15),
    this.asr = const PrayerOffset(adhanOffset: 0, iqamahWait: 15),
    this.maghrib = const PrayerOffset(adhanOffset: 0, iqamahWait: 5),
    this.isha = const PrayerOffset(adhanOffset: 0, iqamahWait: 15),
  });

  TimeAdjustments copyWith({
    PrayerOffset? fajr,
    PrayerOffset? dhuhr,
    PrayerOffset? asr,
    PrayerOffset? maghrib,
    PrayerOffset? isha,
  }) {
    return TimeAdjustments(
      fajr: fajr ?? this.fajr,
      dhuhr: dhuhr ?? this.dhuhr,
      asr: asr ?? this.asr,
      maghrib: maghrib ?? this.maghrib,
      isha: isha ?? this.isha,
    );
  }

  factory TimeAdjustments.fromJson(Map<String, dynamic> json) {
    return TimeAdjustments(
      fajr: PrayerOffset.fromJson(json, 'fajr'),
      dhuhr: PrayerOffset.fromJson(json, 'dhuhr'),
      asr: PrayerOffset.fromJson(json, 'asr'),
      maghrib: PrayerOffset.fromJson(json, 'maghrib'),
      isha: PrayerOffset.fromJson(json, 'isha'),
    );
  }

  Map<String, dynamic> toJson() => {
        'fajr_adhan_offset': fajr.adhanOffset,
        'fajr_iqamah_wait': fajr.iqamahWait,
        'dhuhr_adhan_offset': dhuhr.adhanOffset,
        'dhuhr_iqamah_wait': dhuhr.iqamahWait,
        'asr_adhan_offset': asr.adhanOffset,
        'asr_iqamah_wait': asr.iqamahWait,
        'maghrib_adhan_offset': maghrib.adhanOffset,
        'maghrib_iqamah_wait': maghrib.iqamahWait,
        'isha_adhan_offset': isha.adhanOffset,
        'isha_iqamah_wait': isha.iqamahWait,
      };
}

class FeaturesFormat {
  final bool use24HourFormat;
  final bool useArabicLabels;
  final bool audioAlertsEnabled;
  final String adhanAlertMode; // 'full_screen' | 'dismissible' | 'side_panel'
  final String adhanAudio;
  final String iqamahAudio;
  final bool showAnalogClock; // show analog clock instead of digital
  final int analogClockSize; // scale percent: 50–200, default 100
  // en | ar | ur | tr | id | bn | fr | ms
  final String displayLanguage;

  const FeaturesFormat({
    this.use24HourFormat = false,
    this.useArabicLabels = false,
    this.audioAlertsEnabled = true,
    this.adhanAlertMode = 'full_screen',
    this.adhanAudio = 'alert1.mp3',
    this.iqamahAudio = 'alert2.mp3',
    this.showAnalogClock = false,
    this.analogClockSize = 100,
    this.displayLanguage = 'en',
  });

  FeaturesFormat copyWith({
    bool? use24HourFormat,
    bool? useArabicLabels,
    bool? audioAlertsEnabled,
    String? adhanAlertMode,
    String? adhanAudio,
    String? iqamahAudio,
    bool? showAnalogClock,
    int? analogClockSize,
    String? displayLanguage,
  }) {
    return FeaturesFormat(
      use24HourFormat: use24HourFormat ?? this.use24HourFormat,
      useArabicLabels: useArabicLabels ?? this.useArabicLabels,
      audioAlertsEnabled: audioAlertsEnabled ?? this.audioAlertsEnabled,
      adhanAlertMode: adhanAlertMode ?? this.adhanAlertMode,
      adhanAudio: adhanAudio ?? this.adhanAudio,
      iqamahAudio: iqamahAudio ?? this.iqamahAudio,
      showAnalogClock: showAnalogClock ?? this.showAnalogClock,
      analogClockSize: analogClockSize ?? this.analogClockSize,
      displayLanguage: displayLanguage ?? this.displayLanguage,
    );
  }

  factory FeaturesFormat.fromJson(Map<String, dynamic> json) {
    return FeaturesFormat(
      use24HourFormat: json['use_24_hour_format'] as bool? ?? false,
      useArabicLabels: json['use_arabic_labels'] as bool? ?? false,
      audioAlertsEnabled: json['audio_alerts_enabled'] as bool? ?? true,
      adhanAlertMode: json['adhan_alert_mode'] as String? ?? 'full_screen',
      adhanAudio: json['adhan_audio'] as String? ?? 'alert1.mp3',
      iqamahAudio: json['iqamah_audio'] as String? ?? 'alert2.mp3',
      showAnalogClock: json['show_analog_clock'] as bool? ?? false,
      analogClockSize: (json['analog_clock_size'] as num?)?.toInt() ?? 100,
      displayLanguage: json['display_language'] as String? ?? 'en',
    );
  }

  Map<String, dynamic> toJson() => {
        'use_24_hour_format': use24HourFormat,
        'use_arabic_labels': useArabicLabels,
        'audio_alerts_enabled': audioAlertsEnabled,
        'adhan_alert_mode': adhanAlertMode,
        'adhan_audio': adhanAudio,
        'iqamah_audio': iqamahAudio,
        'show_analog_clock': showAnalogClock,
        'analog_clock_size': analogClockSize,
        'display_language': displayLanguage,
      };
}

class TickerSettings {
  final bool enabled;
  final List<String> messages;
  final int speed; // marquee scroll speed (pixels per second)

  const TickerSettings({
    this.enabled = true,
    this.messages = const ['Welcome to our Masjid!'],
    this.speed = 50,
  });

  TickerSettings copyWith({
    bool? enabled,
    List<String>? messages,
    int? speed,
  }) {
    return TickerSettings(
      enabled: enabled ?? this.enabled,
      messages: messages ?? this.messages,
      speed: speed ?? this.speed,
    );
  }

  factory TickerSettings.fromJson(Map<String, dynamic> json) {
    return TickerSettings(
      enabled: json['enabled'] as bool? ?? true,
      messages: (json['messages'] as List<dynamic>?)?.cast<String>() ?? ['Welcome to our Masjid!'],
      speed: (json['speed'] as num?)?.toInt() ?? 50,
    );
  }

  Map<String, dynamic> toJson() => {
        'enabled': enabled,
        'messages': messages,
        'speed': speed,
      };
}

class SlideshowSettings {
  final bool enabled;
  /// How long the TV prayer screen shows before switching to slideshow (minutes part).
  final int tvScreenDurationMins;
  /// Extra seconds on top of tvScreenDurationMins (0–59).
  final int tvScreenExtraSecs;
  /// How long the slideshow runs before returning to TV screen (minutes part).
  final int slideshowRunDurationMins;
  /// Extra seconds on top of slideshowRunDurationMins (0–59).
  final int slideshowRunExtraSecs;
  final int durationPerImageSeconds;
  final int pauseBeforeAdhanMins;
  final int pauseAfterIqamahMins;
  final String displayMode; // 'full_screen' | 'corner_overlay' | 'split_screen'
  final String overlayCorner; // 'top_right' | 'top_left' | 'bottom_right' | 'bottom_left'
  final int overlaySizePercent;
  final List<SlideAsset> images;          // legacy / "all orientations" fallback
  final List<SlideAsset> landscapeImages; // shown only in landscape mode
  final List<SlideAsset> portraitImages;  // shown only in portrait mode

  /// Total TV screen phase duration in seconds.
  int get tvScreenTotalSecs => tvScreenDurationMins * 60 + tvScreenExtraSecs;
  /// Total slideshow run duration in seconds.
  int get slideshowRunTotalSecs => slideshowRunDurationMins * 60 + slideshowRunExtraSecs;

  int get intervalMinutes => slideshowRunDurationMins;

  /// Returns the right image list for the given orientation.
  /// Falls back to the legacy [images] list if the orientation-specific list is empty.
  List<SlideAsset> imagesForOrientation(bool isPortrait) {
    if (isPortrait) {
      return portraitImages.isNotEmpty ? portraitImages : images;
    } else {
      return landscapeImages.isNotEmpty ? landscapeImages : images;
    }
  }

  const SlideshowSettings({
    this.enabled = false,
    this.tvScreenDurationMins = 5,
    this.tvScreenExtraSecs = 0,
    this.slideshowRunDurationMins = 3,
    this.slideshowRunExtraSecs = 0,
    this.durationPerImageSeconds = 5,
    this.pauseBeforeAdhanMins = 2,
    this.pauseAfterIqamahMins = 15,
    this.displayMode = 'full_screen',
    this.overlayCorner = 'top_right',
    this.overlaySizePercent = 25,
    this.images = const [],
    this.landscapeImages = const [],
    this.portraitImages = const [],
  });

  SlideshowSettings copyWith({
    bool? enabled,
    int? tvScreenDurationMins,
    int? tvScreenExtraSecs,
    int? slideshowRunDurationMins,
    int? slideshowRunExtraSecs,
    int? durationPerImageSeconds,
    int? pauseBeforeAdhanMins,
    int? pauseAfterIqamahMins,
    String? displayMode,
    String? overlayCorner,
    int? overlaySizePercent,
    List<SlideAsset>? images,
    List<SlideAsset>? landscapeImages,
    List<SlideAsset>? portraitImages,
  }) {
    return SlideshowSettings(
      enabled: enabled ?? this.enabled,
      tvScreenDurationMins: tvScreenDurationMins ?? this.tvScreenDurationMins,
      tvScreenExtraSecs: tvScreenExtraSecs ?? this.tvScreenExtraSecs,
      slideshowRunDurationMins: slideshowRunDurationMins ?? this.slideshowRunDurationMins,
      slideshowRunExtraSecs: slideshowRunExtraSecs ?? this.slideshowRunExtraSecs,
      durationPerImageSeconds: durationPerImageSeconds ?? this.durationPerImageSeconds,
      pauseBeforeAdhanMins: pauseBeforeAdhanMins ?? this.pauseBeforeAdhanMins,
      pauseAfterIqamahMins: pauseAfterIqamahMins ?? this.pauseAfterIqamahMins,
      displayMode: displayMode ?? this.displayMode,
      overlayCorner: overlayCorner ?? this.overlayCorner,
      overlaySizePercent: overlaySizePercent ?? this.overlaySizePercent,
      images: images ?? this.images,
      landscapeImages: landscapeImages ?? this.landscapeImages,
      portraitImages: portraitImages ?? this.portraitImages,
    );
  }

  static List<SlideAsset> _parseAssets(dynamic raw) =>
      (raw as List<dynamic>? ?? [])
          .map((e) => SlideAsset.fromJson(e as Map<String, dynamic>))
          .toList();

  factory SlideshowSettings.fromJson(Map<String, dynamic> json) {
    return SlideshowSettings(
      enabled: json['enabled'] as bool? ?? false,
      tvScreenDurationMins: (json['tv_screen_duration_mins'] as num?)?.toInt() ??
          (json['interval_minutes'] as num?)?.toInt() ?? 5,
      tvScreenExtraSecs: (json['tv_screen_extra_secs'] as num?)?.toInt() ?? 0,
      slideshowRunDurationMins: (json['slideshow_run_duration_mins'] as num?)?.toInt() ?? 3,
      slideshowRunExtraSecs: (json['slideshow_run_extra_secs'] as num?)?.toInt() ?? 0,
      durationPerImageSeconds: (json['duration_per_image_seconds'] as num?)?.toInt() ?? 5,
      pauseBeforeAdhanMins: (json['pause_before_adhan_mins'] as num?)?.toInt() ?? 2,
      pauseAfterIqamahMins: (json['pause_after_iqamah_mins'] as num?)?.toInt() ?? 15,
      displayMode: json['display_mode'] as String? ?? 'full_screen',
      overlayCorner: json['overlay_corner'] as String? ?? 'top_right',
      overlaySizePercent: (json['overlay_size_percent'] as num?)?.toInt() ?? 25,
      images: _parseAssets(json['images']),
      landscapeImages: _parseAssets(json['landscape_images']),
      portraitImages: _parseAssets(json['portrait_images']),
    );
  }

  Map<String, dynamic> toJson() => {
        'enabled': enabled,
        'tv_screen_duration_mins': tvScreenDurationMins,
        'tv_screen_extra_secs': tvScreenExtraSecs,
        'slideshow_run_duration_mins': slideshowRunDurationMins,
        'slideshow_run_extra_secs': slideshowRunExtraSecs,
        'duration_per_image_seconds': durationPerImageSeconds,
        'pause_before_adhan_mins': pauseBeforeAdhanMins,
        'pause_after_iqamah_mins': pauseAfterIqamahMins,
        'display_mode': displayMode,
        'overlay_corner': overlayCorner,
        'overlay_size_percent': overlaySizePercent,
        'images': images.map((e) => e.toJson()).toList(),
        'landscape_images': landscapeImages.map((e) => e.toJson()).toList(),
        'portrait_images': portraitImages.map((e) => e.toJson()).toList(),
      };
}

class SlideAsset {
  final String id;
  final String filename;
  final String localPath; // absolute path on device
  final int uploadedAt;   // epoch ms

  const SlideAsset({
    required this.id,
    required this.filename,
    required this.localPath,
    required this.uploadedAt,
  });

  factory SlideAsset.fromJson(Map<String, dynamic> json) {
    return SlideAsset(
      id: json['id'] as String? ?? '',
      filename: json['filename'] as String? ?? '',
      localPath: json['local_path'] as String? ?? '',
      uploadedAt: (json['uploaded_at'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'filename': filename,
        'local_path': localPath,
        'uploaded_at': uploadedAt,
      };
}

class JumuahSettings {
  final bool enabled;
  final String khutbahTime;  // HH:mm (Adhan/Khutbah start)
  final String iqamahTime;   // HH:mm
  final String displayLabel;

  const JumuahSettings({
    this.enabled = true,
    this.khutbahTime = '13:00',
    this.iqamahTime = '13:30',
    this.displayLabel = "Jumu'ah",
  });

  JumuahSettings copyWith({
    bool? enabled,
    String? khutbahTime,
    String? iqamahTime,
    String? displayLabel,
  }) {
    return JumuahSettings(
      enabled: enabled ?? this.enabled,
      khutbahTime: khutbahTime ?? this.khutbahTime,
      iqamahTime: iqamahTime ?? this.iqamahTime,
      displayLabel: displayLabel ?? this.displayLabel,
    );
  }

  factory JumuahSettings.fromJson(Map<String, dynamic> json) {
    return JumuahSettings(
      enabled: json['enabled'] as bool? ?? true,
      khutbahTime: json['khutbah_time'] as String? ?? '13:00',
      iqamahTime: json['iqamah_time'] as String? ?? '13:30',
      displayLabel: json['display_label'] as String? ?? "Jumu'ah",
    );
  }

  Map<String, dynamic> toJson() => {
        'enabled': enabled,
        'khutbah_time': khutbahTime,
        'iqamah_time': iqamahTime,
        'display_label': displayLabel,
      };
}

/// Local-device-only metadata — NEVER pushed to Supabase config_json.
class SyncMeta {
  final String? deviceId;
  final int supabaseConfigVersion;
  final int? lastSuccessfulSync; // epoch ms
  final String? linkedUsername;
  final String? linkedMobile;
  final String? linkedEmail;
  final String? linkedMosqueName;
  final String displayOrientation; // 'auto' | 'landscape' | 'portrait'
  final String? customBackgroundPath;
  final String? displayFontFamily;
  final String? primaryTextColor;   // hex — clock, highlighted prayer name
  final String? secondaryTextColor; // hex — accent, highlighted adhan time
  final String? prayerNameColor;    // hex — normal (non-highlighted) prayer name text
  final String? prayerTimeColor;    // hex — normal adhan/iqamah time text
  final String? dateTextColor;      // hex — date/Hijri text below clock
  final String? tickerTextColor;    // hex — scrolling ticker text
  final String? tickerBgColor;      // hex — ticker bar background
  final String? tvBackgroundColor;  // hex — TV screen solid background (used when no image)
  final String? themeId;            // selected theme preset id (e.g. 'midnight')
  final bool adminLightTheme; // light mode for the admin settings panel
  final bool pinEnabled;      // whether PIN gate is required to open settings
  final String? pinHash;      // SHA-256 hash of the admin PIN (synced so all devices use same PIN)
  final List<String> backgroundImages; // legacy background URL list (pre-media-library)
  final String? activeBackgroundMediaId; // UUID in media_library table (new system)

  const SyncMeta({
    this.deviceId,
    this.supabaseConfigVersion = 0,
    this.lastSuccessfulSync,
    this.linkedUsername,
    this.linkedMobile,
    this.linkedEmail,
    this.linkedMosqueName,
    this.displayOrientation = 'auto',
    this.customBackgroundPath,
    this.displayFontFamily,
    this.primaryTextColor,
    this.secondaryTextColor,
    this.prayerNameColor,
    this.prayerTimeColor,
    this.dateTextColor,
    this.tickerTextColor,
    this.tickerBgColor,
    this.tvBackgroundColor,
    this.themeId,
    this.adminLightTheme = false,
    this.pinEnabled = false,
    this.pinHash,
    this.backgroundImages = const [],
    this.activeBackgroundMediaId,
  });

  Color get parsedPrimaryColor {
    if (primaryTextColor == null || primaryTextColor!.isEmpty) return Colors.white;
    try {
      var hex = primaryTextColor!.replaceAll('#', '');
      if (hex.length == 6) hex = 'FF$hex';
      return Color(int.parse(hex, radix: 16));
    } catch (_) {
      return Colors.white;
    }
  }

  Color get parsedSecondaryColor {
    if (secondaryTextColor == null || secondaryTextColor!.isEmpty) return const Color(0xFF14B8A6);
    try {
      var hex = secondaryTextColor!.replaceAll('#', '');
      if (hex.length == 6) hex = 'FF$hex';
      return Color(int.parse(hex, radix: 16));
    } catch (_) {
      return const Color(0xFF14B8A6);
    }
  }

  Color get parsedPrayerNameColor {
    if (prayerNameColor == null || prayerNameColor!.isEmpty) return const Color(0xFFCBD5E1);
    try {
      var hex = prayerNameColor!.replaceAll('#', '');
      if (hex.length == 6) hex = 'FF$hex';
      return Color(int.parse(hex, radix: 16));
    } catch (_) {
      return const Color(0xFFCBD5E1);
    }
  }

  Color get parsedPrayerTimeColor {
    if (prayerTimeColor == null || prayerTimeColor!.isEmpty) return const Color(0xFFCBD5E1);
    try {
      var hex = prayerTimeColor!.replaceAll('#', '');
      if (hex.length == 6) hex = 'FF$hex';
      return Color(int.parse(hex, radix: 16));
    } catch (_) {
      return const Color(0xFFCBD5E1);
    }
  }

  Color get parsedDateTextColor {
    if (dateTextColor == null || dateTextColor!.isEmpty) return const Color(0xFF94A3B8);
    try {
      var hex = dateTextColor!.replaceAll('#', '');
      if (hex.length == 6) hex = 'FF$hex';
      return Color(int.parse(hex, radix: 16));
    } catch (_) {
      return const Color(0xFF94A3B8);
    }
  }

  Color get parsedTickerTextColor {
    if (tickerTextColor == null || tickerTextColor!.isEmpty) return const Color(0xFF14B8A6);
    try {
      var hex = tickerTextColor!.replaceAll('#', '');
      if (hex.length == 6) hex = 'FF$hex';
      return Color(int.parse(hex, radix: 16));
    } catch (_) {
      return const Color(0xFF14B8A6);
    }
  }

  Color get parsedTickerBgColor {
    if (tickerBgColor == null || tickerBgColor!.isEmpty) return const Color(0xFF07121E);
    try {
      var hex = tickerBgColor!.replaceAll('#', '');
      if (hex.length == 6) hex = 'FF$hex';
      return Color(int.parse(hex, radix: 16));
    } catch (_) {
      return const Color(0xFF07121E);
    }
  }

  Color get parsedTvBackgroundColor {
    if (tvBackgroundColor == null || tvBackgroundColor!.isEmpty) return const Color(0xFF0D1B2A);
    try {
      var hex = tvBackgroundColor!.replaceAll('#', '');
      if (hex.length == 6) hex = 'FF$hex';
      return Color(int.parse(hex, radix: 16));
    } catch (_) {
      return const Color(0xFF0D1B2A);
    }
  }

  SyncMeta copyWith({
    String? deviceId,
    int? supabaseConfigVersion,
    int? lastSuccessfulSync,
    String? linkedUsername,
    String? linkedMobile,
    String? linkedEmail,
    String? linkedMosqueName,
    String? displayOrientation,
    String? customBackgroundPath,
    bool clearCustomBackgroundPath = false,
    String? displayFontFamily,
    String? primaryTextColor,
    String? secondaryTextColor,
    String? prayerNameColor,
    String? prayerTimeColor,
    String? dateTextColor,
    String? tickerTextColor,
    String? tickerBgColor,
    String? tvBackgroundColor,
    String? themeId,
    bool clearThemeId = false,
    bool? adminLightTheme,
    bool? pinEnabled,
    String? pinHash,
    List<String>? backgroundImages,
    String? activeBackgroundMediaId,
    bool clearActiveBackgroundMediaId = false,
  }) {
    return SyncMeta(
      deviceId: deviceId ?? this.deviceId,
      supabaseConfigVersion: supabaseConfigVersion ?? this.supabaseConfigVersion,
      lastSuccessfulSync: lastSuccessfulSync ?? this.lastSuccessfulSync,
      linkedUsername: linkedUsername ?? this.linkedUsername,
      linkedMobile: linkedMobile ?? this.linkedMobile,
      linkedEmail: linkedEmail ?? this.linkedEmail,
      linkedMosqueName: linkedMosqueName ?? this.linkedMosqueName,
      displayOrientation: displayOrientation ?? this.displayOrientation,
      customBackgroundPath: clearCustomBackgroundPath ? null : (customBackgroundPath ?? this.customBackgroundPath),
      displayFontFamily: displayFontFamily ?? this.displayFontFamily,
      primaryTextColor: primaryTextColor ?? this.primaryTextColor,
      secondaryTextColor: secondaryTextColor ?? this.secondaryTextColor,
      prayerNameColor: prayerNameColor ?? this.prayerNameColor,
      prayerTimeColor: prayerTimeColor ?? this.prayerTimeColor,
      dateTextColor: dateTextColor ?? this.dateTextColor,
      tickerTextColor: tickerTextColor ?? this.tickerTextColor,
      tickerBgColor: tickerBgColor ?? this.tickerBgColor,
      tvBackgroundColor: tvBackgroundColor ?? this.tvBackgroundColor,
      themeId: clearThemeId ? null : (themeId ?? this.themeId),
      adminLightTheme: adminLightTheme ?? this.adminLightTheme,
      pinEnabled: pinEnabled ?? this.pinEnabled,
      pinHash: pinHash ?? this.pinHash,
      backgroundImages: backgroundImages ?? this.backgroundImages,
      activeBackgroundMediaId: clearActiveBackgroundMediaId
          ? null
          : (activeBackgroundMediaId ?? this.activeBackgroundMediaId),
    );
  }

  factory SyncMeta.fromJson(Map<String, dynamic> json) {
    return SyncMeta(
      deviceId: json['device_id'] as String?,
      supabaseConfigVersion: (json['supabase_config_version'] as num?)?.toInt() ?? 0,
      lastSuccessfulSync: (json['last_successful_sync'] as num?)?.toInt(),
      linkedUsername: json['linked_username'] as String?,
      linkedMobile: json['linked_mobile'] as String?,
      linkedEmail: json['linked_email'] as String?,
      linkedMosqueName: json['linked_mosque_name'] as String?,
      displayOrientation: json['display_orientation'] as String? ?? 'auto',
      customBackgroundPath: json['custom_background_path'] as String?,
      displayFontFamily: json['display_font_family'] as String?,
      primaryTextColor: json['primary_text_color'] as String?,
      secondaryTextColor: json['secondary_text_color'] as String?,
      prayerNameColor: json['prayer_name_color'] as String?,
      prayerTimeColor: json['prayer_time_color'] as String?,
      dateTextColor: json['date_text_color'] as String?,
      tickerTextColor: json['ticker_text_color'] as String?,
      tickerBgColor: json['ticker_bg_color'] as String?,
      tvBackgroundColor: json['tv_background_color'] as String?,
      themeId: json['theme_id'] as String?,
      adminLightTheme: json['admin_light_theme'] as bool? ?? false,
      pinEnabled: json['pin_enabled'] as bool? ?? false,
      pinHash: json['pin_hash'] as String?,
      backgroundImages: (json['background_images'] as List<dynamic>? ?? []).cast<String>(),
      activeBackgroundMediaId: json['active_background_media_id'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'device_id': deviceId,
        'supabase_config_version': supabaseConfigVersion,
        'last_successful_sync': lastSuccessfulSync,
        'linked_username': linkedUsername,
        'linked_mobile': linkedMobile,
        'linked_email': linkedEmail,
        'linked_mosque_name': linkedMosqueName,
        'display_orientation': displayOrientation,
        'custom_background_path': customBackgroundPath,
        'display_font_family': displayFontFamily,
        'primary_text_color': primaryTextColor,
        'secondary_text_color': secondaryTextColor,
        'prayer_name_color': prayerNameColor,
        'prayer_time_color': prayerTimeColor,
        'date_text_color': dateTextColor,
        'ticker_text_color': tickerTextColor,
        'ticker_bg_color': tickerBgColor,
        'tv_background_color': tvBackgroundColor,
        'theme_id': themeId,
        'admin_light_theme': adminLightTheme,
        'pin_enabled': pinEnabled,
        'pin_hash': pinHash,
        'background_images': backgroundImages,
        'active_background_media_id': activeBackgroundMediaId,
      };
}

// ═══════════════════════════════════════════════════════════════
// Root AppConfig
// ═══════════════════════════════════════════════════════════════

class AppConfig {
  final MasjidProfile profile;
  final TimeAdjustments adjustments;
  final FeaturesFormat features;
  final SlideshowSettings slideshow;
  final JumuahSettings jumuah;
  final TickerSettings ticker;
  final SyncMeta meta;

  const AppConfig({
    this.profile = const MasjidProfile(),
    this.adjustments = const TimeAdjustments(),
    this.features = const FeaturesFormat(),
    this.slideshow = const SlideshowSettings(),
    this.jumuah = const JumuahSettings(),
    this.ticker = const TickerSettings(),
    this.meta = const SyncMeta(),
  });

  AppConfig copyWith({
    MasjidProfile? profile,
    TimeAdjustments? adjustments,
    FeaturesFormat? features,
    SlideshowSettings? slideshow,
    JumuahSettings? jumuah,
    TickerSettings? ticker,
    SyncMeta? meta,
  }) {
    return AppConfig(
      profile: profile ?? this.profile,
      adjustments: adjustments ?? this.adjustments,
      features: features ?? this.features,
      slideshow: slideshow ?? this.slideshow,
      jumuah: jumuah ?? this.jumuah,
      ticker: ticker ?? this.ticker,
      meta: meta ?? this.meta,
    );
  }

  /// Deserialize from local SharedPreferences JSON strings.
  factory AppConfig.fromStorageMap(Map<String, dynamic> map) {
    return AppConfig(
      profile: map['masjid_profile'] != null
          ? MasjidProfile.fromJson(map['masjid_profile'] as Map<String, dynamic>)
          : const MasjidProfile(),
      adjustments: map['time_adjustments'] != null
          ? TimeAdjustments.fromJson(map['time_adjustments'] as Map<String, dynamic>)
          : const TimeAdjustments(),
      features: map['features_format'] != null
          ? FeaturesFormat.fromJson(map['features_format'] as Map<String, dynamic>)
          : const FeaturesFormat(),
      slideshow: map['slideshow_settings'] != null
          ? SlideshowSettings.fromJson(map['slideshow_settings'] as Map<String, dynamic>)
          : const SlideshowSettings(),
      jumuah: map['jumuah_settings'] != null
          ? JumuahSettings.fromJson(map['jumuah_settings'] as Map<String, dynamic>)
          : const JumuahSettings(),
      ticker: map['ticker_settings'] != null
          ? TickerSettings.fromJson(map['ticker_settings'] as Map<String, dynamic>)
          : const TickerSettings(),
      meta: map['sync_meta'] != null
          ? SyncMeta.fromJson(map['sync_meta'] as Map<String, dynamic>)
          : const SyncMeta(),
    );
  }

  /// Serialize to the Supabase config_json shape.
  /// IMPORTANT: meta (device-local fields) is excluded, but display config is explicitly synced.
  Map<String, dynamic> toCloudJson() => {
        'masjid_profile': profile.toJson(),
        'time_adjustments': adjustments.toJson(),
        'features_format': features.toJson(),
        'slideshow_settings': slideshow.toJson(),
        'jumuah_settings': jumuah.toJson(),
        'ticker_settings': ticker.toJson(),
        'display_settings': {
          'custom_background_path': meta.customBackgroundPath,
          'display_font_family': meta.displayFontFamily,
          'primary_text_color': meta.primaryTextColor,
          'secondary_text_color': meta.secondaryTextColor,
          'prayer_name_color': meta.prayerNameColor,
          'prayer_time_color': meta.prayerTimeColor,
          'date_text_color': meta.dateTextColor,
          'ticker_text_color': meta.tickerTextColor,
          'ticker_bg_color': meta.tickerBgColor,
          'tv_background_color': meta.tvBackgroundColor,
          'theme_id': meta.themeId,
          'display_orientation': meta.displayOrientation,
          'admin_light_theme': meta.adminLightTheme,
          'pin_enabled': meta.pinEnabled,
          'pin_hash': meta.pinHash,
          'background_images': meta.backgroundImages,
          'active_background_media_id': meta.activeBackgroundMediaId,
        },
      };

  /// Deserialize from Supabase config_json shape.
  /// Preserves the passed [localMeta] (device-local fields) while applying cloud display settings.
  factory AppConfig.fromCloudJson(Map<String, dynamic> json, {SyncMeta? localMeta}) {
    final ds = json['display_settings'] as Map<String, dynamic>? ?? {};
    final mergedMeta = (localMeta ?? const SyncMeta()).copyWith(
      customBackgroundPath: ds['custom_background_path'] as String?,
      clearCustomBackgroundPath: ds['custom_background_path'] == null,
      displayFontFamily: ds['display_font_family'] as String?,
      primaryTextColor: ds['primary_text_color'] as String?,
      secondaryTextColor: ds['secondary_text_color'] as String?,
      prayerNameColor: ds['prayer_name_color'] as String?,
      prayerTimeColor: ds['prayer_time_color'] as String?,
      dateTextColor: ds['date_text_color'] as String?,
      tickerTextColor: ds['ticker_text_color'] as String?,
      tickerBgColor: ds['ticker_bg_color'] as String?,
      tvBackgroundColor: ds['tv_background_color'] as String?,
      themeId: ds['theme_id'] as String?,
      displayOrientation: ds['display_orientation'] as String?,
      adminLightTheme: ds['admin_light_theme'] as bool?,
      pinEnabled: ds['pin_enabled'] as bool?,
      pinHash: ds['pin_hash'] as String?,
      backgroundImages: (ds['background_images'] as List<dynamic>? ?? []).cast<String>(),
      activeBackgroundMediaId: ds['active_background_media_id'] as String?,
    );

    return AppConfig(
      profile: json['masjid_profile'] != null
          ? MasjidProfile.fromJson(json['masjid_profile'] as Map<String, dynamic>)
          : const MasjidProfile(),
      adjustments: json['time_adjustments'] != null
          ? TimeAdjustments.fromJson(json['time_adjustments'] as Map<String, dynamic>)
          : const TimeAdjustments(),
      features: json['features_format'] != null
          ? FeaturesFormat.fromJson(json['features_format'] as Map<String, dynamic>)
          : const FeaturesFormat(),
      slideshow: json['slideshow_settings'] != null
          ? SlideshowSettings.fromJson(json['slideshow_settings'] as Map<String, dynamic>)
          : const SlideshowSettings(),
      jumuah: json['jumuah_settings'] != null
          ? JumuahSettings.fromJson(json['jumuah_settings'] as Map<String, dynamic>)
          : const JumuahSettings(),
      ticker: json['ticker_settings'] != null
          ? TickerSettings.fromJson(json['ticker_settings'] as Map<String, dynamic>)
          : const TickerSettings(),
      meta: mergedMeta,
    );
  }

  String toJsonString() => jsonEncode({
        'masjid_profile': profile.toJson(),
        'time_adjustments': adjustments.toJson(),
        'features_format': features.toJson(),
        'slideshow_settings': slideshow.toJson(),
        'jumuah_settings': jumuah.toJson(),
        'ticker_settings': ticker.toJson(),
        'sync_meta': meta.toJson(),
      });

  factory AppConfig.fromJsonString(String jsonStr) {
    final map = jsonDecode(jsonStr) as Map<String, dynamic>;
    return AppConfig.fromStorageMap(map);
  }
}
