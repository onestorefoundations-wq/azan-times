/// tv_display.dart
/// Full-featured main display screen.
/// Supports: landscape/portrait, 3 slideshow modes, adhan overlay,
/// gesture-triggered settings, and realtime config reload.

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:marquee/marquee.dart';
import '../core/prayer_engine.dart';
import '../providers/app_provider.dart';
import '../core/app_config.dart';
import '../widgets/prayer_table_widget.dart';
import '../widgets/clock_panel_widget.dart';
import '../widgets/adhan_overlay_widget.dart';
import '../widgets/slideshow_panel_widget.dart';
import 'settings/settings_page.dart';

class TvDisplay extends StatefulWidget {
  const TvDisplay({super.key});

  @override
  State<TvDisplay> createState() => _TvDisplayState();
}

class _TvDisplayState extends State<TvDisplay> {
  // For triple-tap gesture settings trigger (TV-friendly, no keyboard needed)
  int _tapCount = 0;
  DateTime? _lastTapTime;
  final FocusNode _focusNode = FocusNode();

  @override
  void dispose() {
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AppProvider>();

    if (!provider.isLoaded) {
      return const Scaffold(
        backgroundColor: Color(0xFF0F172A),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(color: Color(0xFF14B8A6)),
              SizedBox(height: 16),
              Text(
                'Loading prayer times...',
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 16),
              ),
            ],
          ),
        ),
      );
    }

    final config = provider.config;
    final features = config.features;
    final slideshow = config.slideshow;
    final prayers = provider.prayers;
    final activePrayer = provider.activePrayer;
    final nextPrayer = provider.nextPrayer;
    final alertMode = features.adhanAlertMode;
    final displayState = provider.displayState;

    final isAlertOverlayActive = 
        (displayState == DisplayState.adhanAlert || displayState == DisplayState.iqamahAlert) &&
        alertMode != 'side_panel';

    Widget content;

    if (isAlertOverlayActive) {
      content = AdhanOverlayWidget(
        prayerState: displayState == DisplayState.adhanAlert ? PrayerState.adhanTime : PrayerState.iqamahCountdown,
        prayer: activePrayer,
        useArabic: features.useArabicLabels,
        alertMode: alertMode,
        displayLanguage: features.displayLanguage,
        onDismiss: () => provider.dismissAlert(),
      );
    } else {
      content = _buildMainLayout(
        prayers: prayers,
        nextPrayer: nextPrayer,
        activePrayer: activePrayer,
        prayerState: provider.prayerState,
        config: config,
        provider: provider,
        isSlideshowActive: displayState == DisplayState.slideshow,
        displayMode: slideshow.displayMode,
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: Theme(
        data: Theme.of(context).copyWith(
          textTheme: Theme.of(context).textTheme.apply(
            fontFamily: config.meta.displayFontFamily ?? 'Roboto',
          ),
        ),
        child: KeyboardListener(
          focusNode: _focusNode,
          autofocus: true,
          onKeyEvent: (event) {
            if (event is KeyDownEvent) {
               provider.dismissAlert();
            }
          },
          child: GestureDetector(
            // Triple-tap anywhere to open settings (TV-friendly)
            onTap: _handleTap,
            behavior: HitTestBehavior.opaque,
            child: Stack(
              children: [
                // Background: media library (orientation-aware) → legacy config → gradient
                LayoutBuilder(builder: (context, constraints) {
                  final isPortrait = constraints.maxHeight > constraints.maxWidth;
                  const gradient = BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  );
                  final bgUrl = provider.activeBgUrlForOrientation(isPortrait);
                  if (bgUrl != null && bgUrl.isNotEmpty) {
                    if (bgUrl.startsWith('http')) {
                      return Positioned.fill(
                        child: Image.network(
                          bgUrl,
                          fit: BoxFit.cover,
                          width: double.infinity,
                          height: double.infinity,
                          errorBuilder: (_, __, ___) => Container(decoration: gradient),
                        ),
                      );
                    } else if (bgUrl.startsWith('data:')) {
                      try {
                        final bytes = base64Decode(bgUrl.substring(bgUrl.indexOf(',') + 1));
                        return Positioned.fill(
                          child: Image.memory(bytes, fit: BoxFit.cover,
                              width: double.infinity, height: double.infinity),
                        );
                      } catch (_) {}
                    } else if (!kIsWeb) {
                      final file = File(bgUrl);
                      if (file.existsSync()) {
                        return Positioned.fill(
                          child: Image.file(file, fit: BoxFit.cover,
                              width: double.infinity, height: double.infinity),
                        );
                      }
                    }
                  }
                  return Positioned.fill(child: Container(decoration: gradient));
                }),

                // Main content
                Positioned.fill(child: content),

                // ── Settings FAB (bottom-right gear icon) ───────────
                Positioned(
                  bottom: 16,
                  right: 16,
                  child: Opacity(
                    opacity: 0.4,
                    child: FloatingActionButton.small(
                      heroTag: 'settings_fab',
                      onPressed: _openSettings,
                      backgroundColor: const Color(0xFF1E293B),
                      child: const Icon(Icons.settings, color: Color(0xFF94A3B8)),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ── Layout builder ──────────────────────────────────────────

  Widget _buildMainLayout({
    required List<PrayerConfig> prayers,
    required PrayerConfig? nextPrayer,
    required PrayerConfig? activePrayer,
    required PrayerState prayerState,
    required config,
    required AppProvider provider,
    required bool isSlideshowActive,
    required String displayMode,
  }) {
    final slideshow = config.slideshow;
    final features = config.features;

    final prayerTable = PrayerTableWidget(
      prayers: prayers,
      nextPrayer: nextPrayer,
      activePrayer: activePrayer,
      use24Hour: features.use24HourFormat,
      config: config,
    );

    final clockPanel = ClockPanelWidget(
      prayerState: prayerState,
      activePrayer: activePrayer,
      nextPrayer: nextPrayer,
      config: config,
    );

    final mainContent = LayoutBuilder(builder: (context, constraints) {
      final isPortrait = constraints.maxHeight > constraints.maxWidth;
      final sw = constraints.maxWidth;
      final sh = constraints.maxHeight;
      // All outer insets are % of screen dimension — scales from phone to 4K TV
      final hInset = sw * 0.022;
      final vInset = sh * 0.022;

      // ── Full-screen slideshow ────────────────────────────────
      if (isSlideshowActive && displayMode == 'full_screen') {
        return Stack(children: [
          SlideshowPanelWidget(
            assets: provider.slidesForOrientation(isPortrait),
            durationSeconds: slideshow.durationPerImageSeconds,
          ),
          Positioned(
            bottom: sh * 0.06,
            right: sw * 0.02,
            child: _MiniClockOverlay(config: config, nextPrayer: nextPrayer),
          ),
        ]);
      }

      // ── Split-screen slideshow ───────────────────────────────
      if (isSlideshowActive && displayMode == 'split_screen') {
        if (isPortrait) {
          return Column(children: [
            Expanded(
              flex: 1,
              child: SlideshowPanelWidget(
                assets: provider.slidesForOrientation(isPortrait),
                durationSeconds: slideshow.durationPerImageSeconds,
              ),
            ),
            Container(height: 1.5, color: const Color(0xFF1E293B)),
            Expanded(
              flex: 1,
              child: Column(children: [
                Expanded(flex: 1, child: clockPanel),
                Expanded(
                  flex: 1,
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(hInset, vInset * 0.5, hInset, vInset),
                    child: prayerTable,
                  ),
                ),
              ]),
            ),
          ]);
        }
        return Row(children: [
          Expanded(
            flex: 2,
            child: Column(children: [
              Expanded(flex: 3, child: Padding(
                padding: EdgeInsets.fromLTRB(hInset, vInset, hInset * 0.6, vInset * 0.4),
                child: prayerTable,
              )),
              Expanded(flex: 2, child: clockPanel),
            ]),
          ),
          Container(width: 1.5, color: const Color(0xFF1E293B)),
          Expanded(
            flex: 2,
            child: SlideshowPanelWidget(
              assets: provider.slidesForOrientation(isPortrait),
              durationSeconds: slideshow.durationPerImageSeconds,
            ),
          ),
        ]);
      }

      // ── Default: prayer table + clock panel ──────────────────
      return Stack(children: [
        if (isPortrait)
          Column(children: [
            Expanded(flex: 5, child: clockPanel),
            Expanded(
              flex: 6,
              child: Padding(
                padding: EdgeInsets.fromLTRB(hInset, vInset * 0.4, hInset, vInset),
                child: prayerTable,
              ),
            ),
          ])
        else
          Row(children: [
            Expanded(
              flex: 5,
              child: Padding(
                padding: EdgeInsets.fromLTRB(hInset, vInset, hInset * 0.6, vInset),
                child: prayerTable,
              ),
            ),
            Expanded(flex: 4, child: clockPanel),
          ]),

        // Corner overlay slideshow
        if (isSlideshowActive && displayMode == 'corner_overlay')
          _buildCornerOverlay(slideshow, isPortrait, provider),
      ]);
    });

    if (config.ticker.enabled && config.ticker.messages.isNotEmpty) {
      return LayoutBuilder(builder: (context, constraints) {
        final tickerH = (constraints.maxHeight * 0.065).clamp(36.0, 72.0);
        final tickerFontSize = (tickerH * 0.44).clamp(13.0, 32.0);
        return Column(
          children: [
            Expanded(child: mainContent),
            Container(
              height: tickerH,
              width: double.infinity,
              decoration: const BoxDecoration(
                color: Color(0xFF0A1628),
                border: Border(
                  top: BorderSide(color: Color(0xFF1E293B), width: 1.5),
                ),
              ),
              child: Marquee(
                text: config.ticker.messages.join('        •        '),
                style: TextStyle(
                  fontSize: tickerFontSize,
                  fontWeight: FontWeight.w600,
                  color: config.meta.parsedTickerTextColor,
                  letterSpacing: 0.3,
                ),
                scrollAxis: Axis.horizontal,
                crossAxisAlignment: CrossAxisAlignment.center,
                blankSpace: 120.0,
                velocity: config.ticker.speed.toDouble(),
                pauseAfterRound: const Duration(seconds: 1),
                showFadingOnlyWhenScrolling: true,
                fadingEdgeStartFraction: 0.06,
                fadingEdgeEndFraction: 0.06,
                startPadding: 16.0,
              ),
            ),
          ],
        );
      });
    }

    return mainContent;
  }

  Widget _buildCornerOverlay(slideshow, bool isPortrait, AppProvider provider) {
    final corner = slideshow.overlayCorner as String? ?? 'top_right';
    final sizePercent = slideshow.overlaySizePercent as int? ?? 25;

    final top = corner.contains('top') ? 16.0 : null;
    final bottom = corner.contains('bottom') ? 60.0 : null;
    final left = corner.contains('left') ? 16.0 : null;
    final right = corner.contains('right') ? 16.0 : null;

    return Positioned(
      top: top,
      bottom: bottom,
      left: left,
      right: right,
      child: LayoutBuilder(builder: (ctx, _) {
        final screenW = MediaQuery.sizeOf(ctx).width;
        final w = screenW * sizePercent / 100;
        return SizedBox(
          width: w,
          height: w * 9 / 16,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SlideshowPanelWidget(
              assets: provider.slidesForOrientation(isPortrait),
              durationSeconds: slideshow.durationPerImageSeconds,
            ),
          ),
        );
      }),
    );
  }

  // ── Gesture handling ────────────────────────────────────────

  void _handleTap() {
    final now = DateTime.now();
    if (_lastTapTime == null ||
        now.difference(_lastTapTime!) > const Duration(milliseconds: 600)) {
      _tapCount = 1;
    } else {
      _tapCount++;
    }
    _lastTapTime = now;

    if (_tapCount >= 3) {
      _tapCount = 0;
      _openSettings();
    }
  }

  void _openSettings() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ChangeNotifierProvider.value(
          value: context.read<AppProvider>(),
          child: const SettingsPage(),
        ),
      ),
    );
  }
}

// ── Mini clock overlay shown during full-screen slideshow ─────

class _MiniClockOverlay extends StatefulWidget {
  final dynamic config;
  final PrayerConfig? nextPrayer;
  const _MiniClockOverlay({required this.config, this.nextPrayer});

  @override
  State<_MiniClockOverlay> createState() => _MiniClockOverlayState();
}

class _MiniClockOverlayState extends State<_MiniClockOverlay> {
  DateTime _now = DateTime.now();
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(
      const Duration(seconds: 1),
      (_) { if (mounted) setState(() => _now = DateTime.now()); },
    );
  }

  @override
  void dispose() { _timer?.cancel(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final use24Hour = (widget.config as dynamic).features.use24HourFormat as bool? ?? false;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF1A2D40).withOpacity(0.88),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            PrayerEngine.formatTimeWithSeconds(_now, use24Hour: use24Hour),
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: (widget.config as dynamic).meta.parsedPrimaryColor,
            ),
          ),
          if (widget.nextPrayer != null)
            Text(
              'Next: ${widget.nextPrayer!.name}',
              style: TextStyle(
                fontSize: 12,
                color: (widget.config as dynamic).meta.parsedSecondaryColor,
                fontWeight: FontWeight.w600,
              ),
            ),
        ],
      ),
    );
  }
}


