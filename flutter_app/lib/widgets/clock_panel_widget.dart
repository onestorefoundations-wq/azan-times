/// clock_panel_widget.dart
/// Right pane: Masjid name, live clock (HH:MM:SS), Gregorian date,
/// Hijri date, next prayer name, and live countdown.
/// In alert mode, shows an alert badge with prayer name.

import 'dart:async';
import 'dart:ui' show FontFeature;
import 'package:flutter/material.dart';
import '../core/prayer_engine.dart';
import '../core/app_config.dart';
import '../l10n/app_localizations.dart';
import 'analog_clock_widget.dart';

class ClockPanelWidget extends StatefulWidget {
  final PrayerState prayerState;
  final PrayerConfig? activePrayer;
  final PrayerConfig? nextPrayer;
  final AppConfig config;

  const ClockPanelWidget({
    super.key,
    required this.prayerState,
    required this.config,
    this.activePrayer,
    this.nextPrayer,
  });

  @override
  State<ClockPanelWidget> createState() => _ClockPanelWidgetState();
}

class _ClockPanelWidgetState extends State<ClockPanelWidget> {
  late DateTime _now;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _now = DateTime.now();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _now = DateTime.now());
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  String _prayerName(AppLocalizations? l10n, PrayerConfig prayer) {
    final useArabic = widget.config.features.useArabicLabels;
    final lang = widget.config.features.displayLanguage;
    if (useArabic && lang != 'ar' && lang != 'ur') {
      const arabicNames = {
        'fajr': 'الفجر', 'sunrise': 'الشروق', 'dhuhr': 'الظهر',
        'asr': 'العصر', 'maghrib': 'المغرب', 'isha': 'العشاء',
        'jumuah': 'الجمعة',
      };
      return arabicNames[prayer.key] ?? prayer.name;
    }
    if (l10n == null) return prayer.name;
    switch (prayer.key) {
      case 'fajr': return l10n.prayerFajr;
      case 'sunrise': return l10n.prayerSunrise;
      case 'dhuhr': return l10n.prayerDhuhr;
      case 'asr': return l10n.prayerAsr;
      case 'maghrib': return l10n.prayerMaghrib;
      case 'isha': return l10n.prayerIsha;
      case 'jumuah': return l10n.prayerJumuah;
      default: return prayer.name;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final use24Hour = widget.config.features.use24HourFormat;
    final mosqueProfile = widget.config.profile;

    final isAdhan = widget.prayerState == PrayerState.adhanTime;
    final isIqamah = widget.prayerState == PrayerState.iqamahCountdown;
    final isAlertActive = isAdhan || isIqamah;

    final countdownTarget = isIqamah
        ? widget.activePrayer?.iqamahTime
        : widget.nextPrayer?.adhanTime;

    final countdownLabel = isIqamah
        ? (l10n?.iqamahIn ?? 'Iqamah in')
        : (l10n?.adhanIn ?? 'Adhan in');

    final displayPrayer = widget.activePrayer ?? widget.nextPrayer;
    final nextPrayerLabel = l10n?.nextPrayer ?? 'Next Prayer';

    return LayoutBuilder(builder: (ctx, constraints) {
      final h = constraints.maxHeight;
      final w = constraints.maxWidth;
      final nameFontSize = (h * 0.065).clamp(14.0, 48.0);
      final clockFontSize = (h * 0.18).clamp(24.0, 120.0);
      final dateFontSize = (h * 0.05).clamp(10.0, 32.0);
      final labelFontSize = (h * 0.045).clamp(10.0, 28.0);
      final nextPrayerFontSize = (h * 0.1).clamp(14.0, 72.0);
      final countdownFontSize = (h * 0.09).clamp(14.0, 64.0);
      final hPad = w * 0.07;
      final vPad = h * 0.04;

      final content = Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Masjid name
          if (mosqueProfile.name.isNotEmpty) ...[
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                mosqueProfile.name,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: nameFontSize,
                  fontWeight: FontWeight.w700,
                  color: widget.config.meta.parsedSecondaryColor,
                  letterSpacing: 0.8,
                ),
              ),
            ),
            if (mosqueProfile.nameArabic != null &&
                mosqueProfile.nameArabic!.isNotEmpty) ...[
              SizedBox(height: h * 0.006),
              FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  mosqueProfile.nameArabic!,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: nameFontSize * 0.82,
                    color: const Color(0xFF94A3B8),
                  ),
                ),
              ),
            ],
            _divider(h),
          ],

          // Alert badge
          if (isAlertActive && displayPrayer != null) ...[
            _alertBadge(isAdhan, l10n, h),
            SizedBox(height: h * 0.015),
          ],

          // Live clock — analog or digital
          if (widget.config.features.showAnalogClock)
            AnalogClockWidget(
              time: _now,
              primaryColor: widget.config.meta.parsedPrimaryColor,
              accentColor: widget.config.meta.parsedSecondaryColor,
              size: (h * 0.38 * widget.config.features.analogClockSize / 100)
                  .clamp(60.0, 420.0),
            )
          else
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                PrayerEngine.formatTimeWithSeconds(_now, use24Hour: use24Hour),
                style: TextStyle(
                  fontSize: clockFontSize,
                  fontWeight: FontWeight.w800,
                  color: widget.config.meta.parsedPrimaryColor,
                  fontFeatures: const [FontFeature.tabularFigures()],
                  height: 1.05,
                ),
              ),
            ),

          SizedBox(height: h * 0.018),

          // Gregorian date
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              PrayerEngine.formatGregorianDate(_now),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: dateFontSize,
                color: widget.config.meta.parsedDateTextColor,
                fontWeight: FontWeight.w500,
                letterSpacing: 0.3,
              ),
            ),
          ),

          SizedBox(height: h * 0.006),

          // Hijri date
          Builder(builder: (_) {
            final hijri = PrayerEngine.getHijriDate(_now);
            if (hijri.isEmpty) return const SizedBox.shrink();
            return FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                hijri,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: dateFontSize * 0.88,
                  color: widget.config.meta.parsedDateTextColor.withOpacity(0.75),
                  fontStyle: FontStyle.italic,
                ),
              ),
            );
          }),

          _divider(h),

          // Next Prayer label + name
          if (displayPrayer != null) ...[
            Text(
              nextPrayerLabel.toUpperCase(),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: labelFontSize * 0.85,
                color: const Color(0xFF64748B),
                letterSpacing: 1.6,
                fontWeight: FontWeight.w600,
              ),
            ),
            SizedBox(height: h * 0.006),
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                _prayerName(l10n, displayPrayer),
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: nextPrayerFontSize,
                  fontWeight: FontWeight.w800,
                  color: widget.config.meta.parsedPrimaryColor,
                  letterSpacing: 0.5,
                ),
              ),
            ),
            SizedBox(height: h * 0.018),
          ],

          // Countdown
          if (countdownTarget != null) ...[
            Text(
              countdownLabel.toUpperCase(),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: labelFontSize * 0.85,
                color: isIqamah ? const Color(0xFFF59E0B) : const Color(0xFF64748B),
                letterSpacing: 1.4,
                fontWeight: FontWeight.w600,
              ),
            ),
            SizedBox(height: h * 0.006),
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                PrayerEngine.formatCountdown(countdownTarget),
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: countdownFontSize,
                  fontWeight: FontWeight.w800,
                  color: isIqamah
                      ? const Color(0xFFF59E0B)
                      : widget.config.meta.parsedSecondaryColor,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ),
          ],
        ],
      );

      return Container(
        decoration: BoxDecoration(
          border: Border(
            left: BorderSide(color: Colors.white.withOpacity(0.12), width: 1),
          ),
        ),
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: hPad, vertical: vPad),
          child: Center(
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: SizedBox(
                width: w - hPad * 2,
                child: content,
              ),
            ),
          ),
        ),
      );
    });
  }

  Widget _alertBadge(bool isAdhan, AppLocalizations? l10n, double h) {
    final badgeFontSize = (h * 0.04).clamp(11.0, 22.0);
    final hPad = (h * 0.03).clamp(10.0, 24.0);
    final vPad = (h * 0.015).clamp(6.0, 14.0);
    final color = isAdhan ? widget.config.meta.parsedSecondaryColor : const Color(0xFFF59E0B);

    final text = isAdhan
        ? '🕌 ${l10n?.adhanActive ?? 'ADHAN ACTIVE'}'
        : '📢 ${l10n?.iqamahActive ?? 'IQAMAH ACTIVE'}';

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      padding: EdgeInsets.symmetric(horizontal: hPad, vertical: vPad),
      decoration: BoxDecoration(
        color: color.withOpacity(0.18),
        borderRadius: BorderRadius.circular(hPad),
        border: Border.all(color: color),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: badgeFontSize,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }

  Widget _divider(double h) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: h * 0.03),
      child: Divider(
        color: widget.config.meta.parsedPrimaryColor.withOpacity(0.12),
        height: 1,
        thickness: 1,
      ),
    );
  }
}
