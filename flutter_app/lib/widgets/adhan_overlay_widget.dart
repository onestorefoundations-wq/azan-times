/// adhan_overlay_widget.dart
/// Full-screen overlay displayed during Adhan and Iqamah states.
/// Supports: full_screen, dismissible, and side_panel alert modes.

import 'dart:async';
import 'dart:ui' show FontFeature;
import 'package:flutter/material.dart';
import '../core/prayer_engine.dart';
import '../l10n/app_localizations.dart';

class AdhanOverlayWidget extends StatefulWidget {
  final PrayerState prayerState;
  final PrayerConfig? prayer;
  final bool useArabic;
  final String alertMode; // 'full_screen' | 'dismissible' | 'side_panel'
  final String displayLanguage;
  final VoidCallback? onDismiss;

  const AdhanOverlayWidget({
    super.key,
    required this.prayerState,
    this.prayer,
    this.useArabic = false,
    this.alertMode = 'full_screen',
    this.displayLanguage = 'en',
    this.onDismiss,
  });

  @override
  State<AdhanOverlayWidget> createState() => _AdhanOverlayWidgetState();
}

class _AdhanOverlayWidgetState extends State<AdhanOverlayWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;
  Timer? _countdownTimer;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    )..repeat(reverse: true);
    _pulseAnimation =
        Tween<double>(begin: 0.85, end: 1.0).animate(_pulseController);

    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _countdownTimer?.cancel();
    super.dispose();
  }

  String _prayerName(AppLocalizations? l10n, PrayerConfig? prayer) {
    if (prayer == null) return '';
    if (widget.useArabic && widget.displayLanguage != 'ar' && widget.displayLanguage != 'ur') {
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
    final isAdhan = widget.prayerState == PrayerState.adhanTime;
    final isIqamah = widget.prayerState == PrayerState.iqamahCountdown;

    final accentColor =
        isAdhan ? const Color(0xFF14B8A6) : const Color(0xFFF59E0B);

    final badgeText = isAdhan
        ? (l10n?.adhanTime ?? 'ADHAN TIME')
        : (l10n?.iqamahTime ?? 'IQAMAH TIME');

    final countdownTarget = isIqamah
        ? widget.prayer?.iqamahTime
        : widget.prayer?.adhanTime;

    return AnimatedOpacity(
      opacity: 1.0,
      duration: const Duration(milliseconds: 300),
      child: Container(
        color: const Color(0xFF0F172A),
        child: Stack(
          children: [
            // Background glow
            Center(
              child: AnimatedBuilder(
                animation: _pulseAnimation,
                builder: (_, __) => Container(
                  width: MediaQuery.sizeOf(context).width * 0.7 * _pulseAnimation.value,
                  height: MediaQuery.sizeOf(context).height * 0.7 * _pulseAnimation.value,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        accentColor.withOpacity(0.06),
                        Colors.transparent,
                      ],
                    ),
                  ),
                ),
              ),
            ),

            // ── Dismiss Button ────────────────────────────────────
            if (widget.onDismiss != null)
              Positioned(
                top: 24,
                right: 24,
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: widget.onDismiss,
                    borderRadius: BorderRadius.circular(32),
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withOpacity(0.1),
                        border: Border.all(color: Colors.white.withOpacity(0.2)),
                      ),
                      child: const Icon(Icons.close, color: Colors.white, size: 28),
                    ),
                  ),
                ),
              ),

            // Main content
            Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Mosque icon
                    Text(
                      '🕌',
                      style: TextStyle(
                        fontSize: MediaQuery.sizeOf(context).height * 0.1,
                      ),
                    ),

                    const SizedBox(height: 24),

                    // Badge
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 24, vertical: 10),
                      decoration: BoxDecoration(
                        color: accentColor.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(32),
                        border: Border.all(color: accentColor, width: 1.5),
                      ),
                      child: Text(
                        badgeText,
                        style: TextStyle(
                          fontSize: MediaQuery.sizeOf(context).height * 0.035,
                          fontWeight: FontWeight.w700,
                          color: accentColor,
                          letterSpacing: 3,
                        ),
                      ),
                    ),

                    const SizedBox(height: 20),

                    // Prayer name
                    if (widget.prayer != null)
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          _prayerName(l10n, widget.prayer),
                          style: TextStyle(
                            fontSize:
                                MediaQuery.sizeOf(context).height * 0.12,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                            height: 1.1,
                          ),
                        ),
                      ),

                    const SizedBox(height: 24),

                    // Countdown (Iqamah only)
                    if (isIqamah && countdownTarget != null) ...[
                      Text(
                        l10n?.iqamahStartingIn ?? 'Iqamah starting in',
                        style: TextStyle(
                          fontSize:
                              MediaQuery.sizeOf(context).height * 0.03,
                          color: const Color(0xFF94A3B8),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        PrayerEngine.formatCountdown(countdownTarget),
                        style: TextStyle(
                          fontSize:
                              MediaQuery.sizeOf(context).height * 0.1,
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFFF59E0B),
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
                      ),
                    ],

                    // Dismiss button
                    if (widget.onDismiss != null) ...[
                      const SizedBox(height: 32),
                      TextButton.icon(
                        onPressed: widget.onDismiss,
                        icon: const Icon(Icons.close, color: Colors.white54),
                        label: Text(
                          l10n?.dismiss ?? 'Dismiss',
                          style: const TextStyle(
                              color: Colors.white54, fontSize: 16),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
