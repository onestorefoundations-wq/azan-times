/// prayer_engine.dart
/// Prayer time calculation engine using the `adhan` package.
/// Enhanced with: timezone-aware times, Hijri date, countdown formatter,
/// and typed AppConfig input.

import 'package:adhan/adhan.dart';
import 'package:hijri/hijri_calendar.dart';
import 'package:intl/intl.dart';
import 'package:timezone/timezone.dart' as tz;
import 'package:timezone/data/latest.dart' as tz_data;
import 'app_config.dart';

// ═══════════════════════════════════════════════════════════════
// Prayer state machine states
// ═══════════════════════════════════════════════════════════════

enum PrayerState {
  idle,
  preAdhan,
  adhanTime,
  iqamahCountdown,
  postPrayer,
}

// ═══════════════════════════════════════════════════════════════
// Prayer data
// ═══════════════════════════════════════════════════════════════

class PrayerConfig {
  final String name;
  final String key;
  final DateTime adhanTime;
  final DateTime iqamahTime;
  final bool noIqamah;

  const PrayerConfig({
    required this.name,
    required this.key,
    required this.adhanTime,
    required this.iqamahTime,
    this.noIqamah = false,
  });
}

// ═══════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════

class PrayerEngine {
  static bool _tzInitialized = false;

  static void initTimezone() {
    if (!_tzInitialized) {
      tz_data.initializeTimeZones();
      _tzInitialized = true;
    }
  }

  static final Map<String, CalculationMethod> _methodMap = {
    'UmmAlQura': CalculationMethod.umm_al_qura,
    'MoonsightingCommittee': CalculationMethod.moon_sighting_committee,
    'NorthAmerica': CalculationMethod.north_america,
    'Muslim_World_League': CalculationMethod.muslim_world_league,
    'Egyptian': CalculationMethod.egyptian,
    'Karachi': CalculationMethod.karachi,
  };

  /// Calculate prayer times for [date] (defaults to today).
  /// Returns times adjusted to the configured timezone.
  static List<PrayerConfig> calculatePrayers(AppConfig config, {DateTime? date}) {
    initTimezone();
    final now = date ?? DateTime.now();
    final profile = config.profile;
    final adj = config.adjustments;
    final jumuah = config.jumuah;
    final useArabic = config.features.useArabicLabels;

    // Coordinates
    final coords = Coordinates(profile.latitude, profile.longitude);

    // Calculation parameters
    final method = _methodMap[profile.calculationMethod] ?? CalculationMethod.umm_al_qura;
    final params = method.getParameters();
    if (profile.asrJuristicMethod == 'Hanafi') {
      params.madhab = Madhab.hanafi;
    } else {
      params.madhab = Madhab.shafi;
    }

    final components = DateComponents(now.year, now.month, now.day);
    final times = PrayerTimes(coords, components, params);

    // Timezone conversion helper
    DateTime toConfigTz(DateTime utcTime) {
      try {
        final location = tz.getLocation(profile.timezoneId);
        final tzTime = tz.TZDateTime.from(utcTime, location);
        // Return as plain DateTime with timezone offset applied
        return DateTime(tzTime.year, tzTime.month, tzTime.day,
            tzTime.hour, tzTime.minute, tzTime.second);
      } catch (_) {
        // Fallback to local time if timezone ID is invalid
        return utcTime.toLocal();
      }
    }

    DateTime addMins(DateTime d, int mins) => d.add(Duration(minutes: mins));

    // Helper: adhan time = computed time + offset; iqamah = adhan + wait
    DateTime adhanFor(DateTime base, int offset) => toConfigTz(addMins(base, offset));
    DateTime iqamahFor(DateTime adhan, int wait) => addMins(adhan, wait);

    final fajrAdhan = adhanFor(times.fajr, adj.fajr.adhanOffset);
    final dhuhrAdhan = adhanFor(times.dhuhr, adj.dhuhr.adhanOffset);
    final asrAdhan = adhanFor(times.asr, adj.asr.adhanOffset);
    final maghribAdhan = adhanFor(times.maghrib, adj.maghrib.adhanOffset);
    final ishaAdhan = adhanFor(times.isha, adj.isha.adhanOffset);

    List<PrayerConfig> prayers = [
      PrayerConfig(
        name: useArabic ? 'الفجر' : 'Fajr',
        key: 'fajr',
        adhanTime: fajrAdhan,
        iqamahTime: iqamahFor(fajrAdhan, adj.fajr.iqamahWait),
      ),
      PrayerConfig(
        name: useArabic ? 'الشروق' : 'Sunrise',
        key: 'sunrise',
        adhanTime: toConfigTz(times.sunrise),
        iqamahTime: toConfigTz(times.sunrise),
        noIqamah: true,
      ),
      PrayerConfig(
        name: useArabic ? 'الظهر' : 'Dhuhr',
        key: 'dhuhr',
        adhanTime: dhuhrAdhan,
        iqamahTime: iqamahFor(dhuhrAdhan, adj.dhuhr.iqamahWait),
      ),
      PrayerConfig(
        name: useArabic ? 'العصر' : 'Asr',
        key: 'asr',
        adhanTime: asrAdhan,
        iqamahTime: iqamahFor(asrAdhan, adj.asr.iqamahWait),
      ),
      PrayerConfig(
        name: useArabic ? 'المغرب' : 'Maghrib',
        key: 'maghrib',
        adhanTime: maghribAdhan,
        iqamahTime: iqamahFor(maghribAdhan, adj.maghrib.iqamahWait),
      ),
      PrayerConfig(
        name: useArabic ? 'العشاء' : 'Isha',
        key: 'isha',
        adhanTime: ishaAdhan,
        iqamahTime: iqamahFor(ishaAdhan, adj.isha.iqamahWait),
      ),
    ];

    // Friday Jumu'ah override — replaces Dhuhr row
    if (now.weekday == DateTime.friday && jumuah.enabled) {
      final dhuhrIdx = prayers.indexWhere((p) => p.key == 'dhuhr');
      if (dhuhrIdx != -1) {
        final khutbahParts = jumuah.khutbahTime.split(':').map(int.parse).toList();
        final iqamahParts = jumuah.iqamahTime.split(':').map(int.parse).toList();
        final jumuahAdhan = DateTime(now.year, now.month, now.day,
            khutbahParts[0], khutbahParts.length > 1 ? khutbahParts[1] : 0);
        final jumuahIqamah = DateTime(now.year, now.month, now.day,
            iqamahParts[0], iqamahParts.length > 1 ? iqamahParts[1] : 0);
        prayers[dhuhrIdx] = PrayerConfig(
          name: useArabic ? 'الجمعة' : jumuah.displayLabel,
          key: 'jumuah',
          adhanTime: jumuahAdhan,
          iqamahTime: jumuahIqamah,
        );
      }
    }

    return prayers;
  }

  // ─────────────────────────────────────────────────────────────
  // Prayer state machine
  // ─────────────────────────────────────────────────────────────

  static Map<String, dynamic> getCurrentPrayerState(
    List<PrayerConfig> prayers, {
    int pauseBeforeAdhanMins = 2,
    int pauseAfterIqamahMins = 15,
  }) {
    final now = DateTime.now();

    for (final prayer in prayers) {
      if (prayer.noIqamah) continue;

      final preAdhanStart = prayer.adhanTime.subtract(Duration(minutes: pauseBeforeAdhanMins));
      final postPrayerEnd = prayer.iqamahTime.add(Duration(minutes: pauseAfterIqamahMins));

      if (now.isAfter(postPrayerEnd) || now.isAtSameMomentAs(postPrayerEnd)) continue;
      if (now.isBefore(preAdhanStart)) continue;

      if (now.isBefore(prayer.adhanTime)) {
        return {'state': PrayerState.preAdhan, 'prayer': prayer};
      }
      if (now.isBefore(prayer.iqamahTime)) {
        return {'state': PrayerState.adhanTime, 'prayer': prayer};
      }
      return {'state': PrayerState.iqamahCountdown, 'prayer': prayer};
    }

    return {'state': PrayerState.idle, 'prayer': getNextPrayer(prayers)};
  }

  static PrayerConfig? getNextPrayer(List<PrayerConfig> prayers) {
    final now = DateTime.now();
    for (final p in prayers) {
      if (p.adhanTime.isAfter(now)) return p;
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────
  // Formatters
  // ─────────────────────────────────────────────────────────────

  /// Format a time as HH:MM or h:mm am/pm based on [use24Hour].
  static String formatTime(DateTime time, {bool use24Hour = false}) {
    if (use24Hour) {
      return DateFormat('HH:mm').format(time);
    }
    return DateFormat('h:mm a').format(time);
  }

  /// Format a time with seconds as HH:MM:SS or h:mm:ss am/pm.
  static String formatTimeWithSeconds(DateTime time, {bool use24Hour = false}) {
    if (use24Hour) {
      return DateFormat('HH:mm:ss').format(time);
    }
    return DateFormat('h:mm:ss a').format(time);
  }

  /// Format countdown to target as HH:MM:SS.
  static String formatCountdown(DateTime target) {
    final now = DateTime.now();
    final diff = target.difference(now);
    if (diff.isNegative) return '00:00:00';
    final h = diff.inHours.toString().padLeft(2, '0');
    final m = (diff.inMinutes % 60).toString().padLeft(2, '0');
    final s = (diff.inSeconds % 60).toString().padLeft(2, '0');
    return '$h:$m:$s';
  }

  /// Get Gregorian date string, e.g. "Thursday, 19 June 2026".
  static String formatGregorianDate(DateTime date) {
    return DateFormat('EEEE, d MMMM yyyy').format(date);
  }

  /// Get Hijri date string, e.g. "23 Dhul Hijjah 1447".
  static String getHijriDate(DateTime date) {
    try {
      final hijri = HijriCalendar.fromDate(date);
      // hijri package v3.x: use longMonthName if available, else fallback to hMonth
      final monthName = hijri.longMonthName;
      return '${hijri.hDay} $monthName ${hijri.hYear}';
    } catch (_) {
      return '';
    }
  }
}
