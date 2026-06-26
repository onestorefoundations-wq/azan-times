/// prayer_table_widget.dart
/// 3-column prayer table: Prayer Name | Adhan Time | Iqamah Time.
/// Highlights the active/next prayer row with teal accent.

import 'package:flutter/material.dart';
import '../core/prayer_engine.dart';
import '../core/app_config.dart';
import '../l10n/app_localizations.dart';

class PrayerTableWidget extends StatelessWidget {
  final List<PrayerConfig> prayers;
  final PrayerConfig? nextPrayer;
  final PrayerConfig? activePrayer;
  final bool use24Hour;
  final AppConfig? config;

  const PrayerTableWidget({
    super.key,
    required this.prayers,
    this.nextPrayer,
    this.activePrayer,
    this.use24Hour = false,
    this.config,
  });

  String _prayerName(BuildContext ctx, PrayerConfig prayer) {
    final useArabic = config?.features.useArabicLabels ?? false;
    final lang = config?.features.displayLanguage ?? 'en';
    // useArabicLabels overrides only when not already in an Arabic-script locale
    if (useArabic && lang != 'ar' && lang != 'ur') {
      const arabicNames = {
        'fajr': 'الفجر', 'sunrise': 'الشروق', 'dhuhr': 'الظهر',
        'asr': 'العصر', 'maghrib': 'المغرب', 'isha': 'العشاء',
        'jumuah': 'الجمعة',
      };
      return arabicNames[prayer.key] ?? prayer.name;
    }
    final l10n = AppLocalizations.of(ctx);
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
    return LayoutBuilder(builder: (context, constraints) {
      final availableH = constraints.maxHeight;
      final rowCount = (prayers.length + 1).clamp(4, 8).toDouble();
      final rowH = availableH / rowCount;
      final headerFontSize = (rowH * 0.32).clamp(10.0, 22.0);
      final bodyFontSize = (rowH * 0.36).clamp(11.0, 26.0);

      final hPad = (constraints.maxWidth * 0.02).clamp(6.0, 20.0);

      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildHeaderRow(headerFontSize, rowH, hPad, l10n),
          Container(height: 1.5, color: const Color(0xFF334155)),
          SizedBox(height: rowH * 0.04),
          ...prayers.map((p) => _buildPrayerRow(context, p, bodyFontSize, rowH, hPad)),
        ],
      );
    });
  }

  Widget _buildHeaderRow(double fontSize, double rowH, double hPad, AppLocalizations? l10n) {
    final headerColor = (config?.meta.parsedPrayerNameColor ?? const Color(0xFFCBD5E1)).withOpacity(0.5);
    return SizedBox(
      height: rowH * 0.75,
      child: Row(
        children: [
          _headerCell(l10n?.headerPrayer ?? 'Prayer', fontSize, color: headerColor, hPad: hPad, flex: 3, align: TextAlign.left),
          _headerCell(l10n?.headerAdhan ?? 'Adhan', fontSize, color: headerColor, hPad: hPad, flex: 2, align: TextAlign.center),
          _headerCell(l10n?.headerIqamah ?? 'Iqamah', fontSize, color: headerColor, hPad: hPad, flex: 2, align: TextAlign.center),
        ],
      ),
    );
  }

  Widget _headerCell(String text, double fontSize, {required Color color, required double hPad, int flex = 1, TextAlign align = TextAlign.left}) {
    return Expanded(
      flex: flex,
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: hPad),
        child: Text(
          text.toUpperCase(),
          textAlign: align,
          style: TextStyle(
            fontSize: fontSize,
            fontWeight: FontWeight.w700,
            color: color,
            letterSpacing: 1.4,
          ),
        ),
      ),
    );
  }

  Widget _buildPrayerRow(BuildContext context, PrayerConfig prayer, double fontSize, double rowH, double hPad) {
    final isHighlighted = (nextPrayer?.key == prayer.key) ||
        (activePrayer?.key == prayer.key);
    final accentColor = config?.meta.parsedSecondaryColor ?? const Color(0xFF14B8A6);
    final primaryColor = config?.meta.parsedPrimaryColor ?? Colors.white;
    final nameColor = config?.meta.parsedPrayerNameColor ?? const Color(0xFFCBD5E1);
    final timeColor = config?.meta.parsedPrayerTimeColor ?? const Color(0xFFCBD5E1);
    final vMargin = (rowH * 0.04).clamp(2.0, 6.0);
    final accentBarW = (rowH * 0.06).clamp(3.0, 6.0);

    return Flexible(
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 400),
        margin: EdgeInsets.symmetric(vertical: vMargin, horizontal: hPad * 0.2),
        decoration: BoxDecoration(
          color: isHighlighted
              ? accentColor.withOpacity(0.13)
              : primaryColor.withOpacity(0.04),
          border: isHighlighted
              ? Border.all(color: accentColor, width: 1.5)
              : Border.all(color: primaryColor.withOpacity(0.06)),
          borderRadius: BorderRadius.circular((rowH * 0.15).clamp(8.0, 14.0)),
        ),
        child: Row(
          children: [
            // Left accent bar — scales with row height
            AnimatedContainer(
              duration: const Duration(milliseconds: 400),
              width: accentBarW,
              margin: EdgeInsets.symmetric(vertical: rowH * 0.12),
              decoration: BoxDecoration(
                color: isHighlighted ? accentColor : Colors.transparent,
                borderRadius: const BorderRadius.only(
                  topRight: Radius.circular(4),
                  bottomRight: Radius.circular(4),
                ),
              ),
            ),
            _prayerCell(
              _prayerName(context, prayer),
              fontSize,
              flex: 3,
              bold: isHighlighted,
              align: TextAlign.left,
              color: isHighlighted ? primaryColor : nameColor,
              hPad: hPad,
              vPad: rowH * 0.1,
            ),
            _prayerCell(
              PrayerEngine.formatTime(prayer.adhanTime, use24Hour: use24Hour),
              fontSize,
              flex: 2,
              bold: isHighlighted,
              align: TextAlign.center,
              color: isHighlighted ? accentColor : timeColor,
              hPad: hPad,
              vPad: rowH * 0.1,
            ),
            _prayerCell(
              prayer.noIqamah
                  ? '—'
                  : PrayerEngine.formatTime(prayer.iqamahTime, use24Hour: use24Hour),
              fontSize,
              flex: 2,
              bold: isHighlighted,
              align: TextAlign.center,
              color: prayer.noIqamah
                  ? const Color(0xFF475569)
                  : isHighlighted
                      ? const Color(0xFFFBBF24)
                      : timeColor,
              hPad: hPad,
              vPad: rowH * 0.1,
            ),
          ],
        ),
      ),
    );
  }

  Widget _prayerCell(
    String text,
    double fontSize, {
    int flex = 1,
    bool bold = false,
    Color color = Colors.white,
    TextAlign align = TextAlign.left,
    required double hPad,
    required double vPad,
  }) {
    return Expanded(
      flex: flex,
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: hPad, vertical: vPad),
        child: FittedBox(
          fit: BoxFit.scaleDown,
          alignment: align == TextAlign.center ? Alignment.center : Alignment.centerLeft,
          child: Text(
            text,
            textAlign: align,
            style: TextStyle(
              fontSize: fontSize,
              fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
              color: color,
              letterSpacing: bold ? 0.3 : 0,
            ),
          ),
        ),
      ),
    );
  }
}
