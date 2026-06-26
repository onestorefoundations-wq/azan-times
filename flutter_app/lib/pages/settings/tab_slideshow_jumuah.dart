/// tab_slideshow_jumuah.dart
/// Slideshow & Jumu'ah Override settings tab.
/// Slides are now managed in the Media Library tab.

import 'package:flutter/material.dart';
import '../../core/app_config.dart';
import 'settings_helpers.dart';

class TabSlideshowJumuah extends StatefulWidget {
  final SlideshowSettings slideshow;
  final JumuahSettings jumuah;
  final ValueChanged<SlideshowSettings> onSlideshowChanged;
  final ValueChanged<JumuahSettings> onJumuahChanged;

  const TabSlideshowJumuah({
    super.key,
    required this.slideshow,
    required this.jumuah,
    required this.onSlideshowChanged,
    required this.onJumuahChanged,
  });

  @override
  State<TabSlideshowJumuah> createState() => _TabSlideshowJumuahState();
}

class _TabSlideshowJumuahState extends State<TabSlideshowJumuah> {
  late TextEditingController _tvScreenCtrl;
  late TextEditingController _tvScreenSecsCtrl;
  late TextEditingController _slideshowRunCtrl;
  late TextEditingController _slideshowRunSecsCtrl;
  late TextEditingController _durationCtrl;
  late TextEditingController _pauseBeforeCtrl;
  late TextEditingController _pauseAfterCtrl;
  late TextEditingController _khutbahCtrl;
  late TextEditingController _iqamahCtrl;
  late TextEditingController _labelCtrl;

  @override
  void initState() {
    super.initState();
    final s = widget.slideshow;
    final j = widget.jumuah;
    _tvScreenCtrl = TextEditingController(text: s.tvScreenDurationMins.toString());
    _tvScreenSecsCtrl = TextEditingController(text: s.tvScreenExtraSecs.toString());
    _slideshowRunCtrl = TextEditingController(text: s.slideshowRunDurationMins.toString());
    _slideshowRunSecsCtrl = TextEditingController(text: s.slideshowRunExtraSecs.toString());
    _durationCtrl = TextEditingController(text: s.durationPerImageSeconds.toString());
    _pauseBeforeCtrl = TextEditingController(text: s.pauseBeforeAdhanMins.toString());
    _pauseAfterCtrl = TextEditingController(text: s.pauseAfterIqamahMins.toString());
    _khutbahCtrl = TextEditingController(text: j.khutbahTime);
    _iqamahCtrl = TextEditingController(text: j.iqamahTime);
    _labelCtrl = TextEditingController(text: j.displayLabel);
  }

  @override
  void dispose() {
    _tvScreenCtrl.dispose();
    _tvScreenSecsCtrl.dispose();
    _slideshowRunCtrl.dispose();
    _slideshowRunSecsCtrl.dispose();
    _durationCtrl.dispose();
    _pauseBeforeCtrl.dispose();
    _pauseAfterCtrl.dispose();
    _khutbahCtrl.dispose();
    _iqamahCtrl.dispose();
    _labelCtrl.dispose();
    super.dispose();
  }

  void _notifySlideshow({bool? enabled, String? displayMode, String? overlayCorner, int? overlaySize}) {
    widget.onSlideshowChanged(widget.slideshow.copyWith(
      enabled: enabled,
      tvScreenDurationMins: int.tryParse(_tvScreenCtrl.text) ?? 5,
      tvScreenExtraSecs: (int.tryParse(_tvScreenSecsCtrl.text) ?? 0).clamp(0, 59),
      slideshowRunDurationMins: int.tryParse(_slideshowRunCtrl.text) ?? 3,
      slideshowRunExtraSecs: (int.tryParse(_slideshowRunSecsCtrl.text) ?? 0).clamp(0, 59),
      durationPerImageSeconds: int.tryParse(_durationCtrl.text) ?? 5,
      pauseBeforeAdhanMins: int.tryParse(_pauseBeforeCtrl.text) ?? 2,
      pauseAfterIqamahMins: int.tryParse(_pauseAfterCtrl.text) ?? 15,
      displayMode: displayMode,
      overlayCorner: overlayCorner,
      overlaySizePercent: overlaySize,
    ));
  }

  void _notifyJumuah({bool? enabled}) {
    widget.onJumuahChanged(widget.jumuah.copyWith(
      enabled: enabled,
      khutbahTime: _khutbahCtrl.text.trim(),
      iqamahTime: _iqamahCtrl.text.trim(),
      displayLabel: _labelCtrl.text.trim(),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.slideshow;
    final j = widget.jumuah;

    return SettingsTabScaffold(
      title: "Slideshow & Jumu'ah Override",
      children: [
        // ── Slideshow section ──────────────────────────────────
        const SettingsSectionHeader(title: 'Slideshow & Screensaver'),

        SettingsToggleRow(
          label: 'Enable Announcement Image Slideshow',
          description: 'Cycles between prayer time screen and full-screen images.',
          value: s.enabled,
          onChanged: (v) => _notifySlideshow(enabled: v),
        ),

        if (s.enabled)
          Container(
            margin: const EdgeInsets.only(bottom: 16),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: SettingsTheme.bgElevated,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: SettingsTheme.borderSubtle),
            ),
            child: Text(
              '📺 TV Screen (${_tvScreenCtrl.text}m ${_tvScreenSecsCtrl.text}s)  →  '
              '🖼️ Slideshow (${_slideshowRunCtrl.text}m ${_slideshowRunSecsCtrl.text}s)  →  📺 Repeat',
              style: TextStyle(fontSize: 12, color: SettingsTheme.accentTeal, fontWeight: FontWeight.w600),
            ),
          ),

        // TV Screen Display Time — min + sec
        SettingsFormField(
          label: 'TV Screen Display Time',
          helpText: 'How long to show prayer times before switching to slideshow.',
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _tvScreenCtrl,
                  keyboardType: TextInputType.number,
                  style: SettingsTheme.inputTextStyle,
                  decoration: SettingsTheme.inputDecoration('5').copyWith(suffixText: 'min'),
                  onChanged: (_) => _notifySlideshow(),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _tvScreenSecsCtrl,
                  keyboardType: TextInputType.number,
                  style: SettingsTheme.inputTextStyle,
                  decoration: SettingsTheme.inputDecoration('0').copyWith(suffixText: 'sec'),
                  onChanged: (_) => _notifySlideshow(),
                ),
              ),
            ],
          ),
        ),

        // Slideshow Run Duration — min + sec
        SettingsFormField(
          label: 'Slideshow Run Duration',
          helpText: 'How long the slideshow plays before returning to TV screen.',
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _slideshowRunCtrl,
                  keyboardType: TextInputType.number,
                  style: SettingsTheme.inputTextStyle,
                  decoration: SettingsTheme.inputDecoration('3').copyWith(suffixText: 'min'),
                  onChanged: (_) => _notifySlideshow(),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _slideshowRunSecsCtrl,
                  keyboardType: TextInputType.number,
                  style: SettingsTheme.inputTextStyle,
                  decoration: SettingsTheme.inputDecoration('0').copyWith(suffixText: 'sec'),
                  onChanged: (_) => _notifySlideshow(),
                ),
              ),
            ],
          ),
        ),

        SettingsFormField(
          label: 'Duration Per Image (Seconds)',
          helpText: 'How long each individual image displays within the slideshow.',
          child: TextField(
            controller: _durationCtrl,
            keyboardType: TextInputType.number,
            style: SettingsTheme.inputTextStyle,
            decoration: SettingsTheme.inputDecoration('5'),
            onChanged: (_) => _notifySlideshow(),
          ),
        ),

        SettingsDropdown<String>(
          label: 'Slideshow Template Mode',
          value: s.displayMode,
          onChanged: (v) => _notifySlideshow(displayMode: v),
          items: const [
            DropdownMenuItem(value: 'full_screen',
                child: Text('Mode 1: Full Screen (Takes over during idle)')),
            DropdownMenuItem(value: 'corner_overlay',
                child: Text('Mode 2: Corner Overlay (Floating image)')),
            DropdownMenuItem(value: 'split_screen',
                child: Text('Mode 3: Split Screen (50/50 layout)')),
          ],
        ),

        if (s.displayMode == 'corner_overlay')
          SettingsFormRow(
            left: SettingsDropdown<String>(
              label: 'Corner Position',
              value: s.overlayCorner,
              onChanged: (v) => _notifySlideshow(overlayCorner: v),
              items: const [
                DropdownMenuItem(value: 'top_right', child: Text('Top Right')),
                DropdownMenuItem(value: 'top_left', child: Text('Top Left')),
                DropdownMenuItem(value: 'bottom_right', child: Text('Bottom Right')),
                DropdownMenuItem(value: 'bottom_left', child: Text('Bottom Left')),
              ],
            ),
            right: SettingsDropdown<int>(
              label: 'Overlay Size (% of screen)',
              value: s.overlaySizePercent,
              onChanged: (v) => _notifySlideshow(overlaySize: v),
              items: const [
                DropdownMenuItem(value: 15, child: Text('Small (15%)')),
                DropdownMenuItem(value: 20, child: Text('Medium-Small (20%)')),
                DropdownMenuItem(value: 25, child: Text('Medium (25%)')),
                DropdownMenuItem(value: 30, child: Text('Medium-Large (30%)')),
                DropdownMenuItem(value: 40, child: Text('Large (40%)')),
              ],
            ),
          ),

        SettingsFormRow(
          left: SettingsFormField(
            label: 'Pause Before Adhan (Mins)',
            child: TextField(
              controller: _pauseBeforeCtrl,
              keyboardType: TextInputType.number,
              style: SettingsTheme.inputTextStyle,
              decoration: SettingsTheme.inputDecoration('2'),
              onChanged: (_) => _notifySlideshow(),
            ),
          ),
          right: SettingsFormField(
            label: 'Pause After Iqamah (Mins)',
            child: TextField(
              controller: _pauseAfterCtrl,
              keyboardType: TextInputType.number,
              style: SettingsTheme.inputTextStyle,
              decoration: SettingsTheme.inputDecoration('15'),
              onChanged: (_) => _notifySlideshow(),
            ),
          ),
        ),

        // ── Slides — point to Media Library ───────────────────
        Divider(color: SettingsTheme.borderSubtle, height: 32),

        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: SettingsTheme.accentTeal.withOpacity(0.07),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: SettingsTheme.accentTeal.withOpacity(0.35)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.photo_library_outlined, color: SettingsTheme.accentTeal, size: 20),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Slide Images — managed in Media Library',
                        style: TextStyle(
                            color: SettingsTheme.accentTeal,
                            fontWeight: FontWeight.w700,
                            fontSize: 13)),
                    const SizedBox(height: 4),
                    Text(
                      'Upload and manage your announcement slides from the Media Library tab. '
                      'Use the "Slides Landscape" category for TVs in horizontal mode, '
                      'and "Slides Portrait" for vertical/phone mode. '
                      'Slides work offline and sync automatically across all displays.',
                      style: TextStyle(color: SettingsTheme.textSecondary, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        // ── Jumu'ah override ──────────────────────────────────
        Divider(color: SettingsTheme.borderSubtle, height: 32),
        const SettingsSectionHeader(title: "Friday Jumu'ah Override"),

        SettingsToggleRow(
          label: "Override Dhuhr with Jumu'ah on Fridays",
          value: j.enabled,
          onChanged: (v) => _notifyJumuah(enabled: v),
        ),

        SettingsFormRow(
          left: SettingsFormField(
            label: 'Khutbah Start Time (Adhan)',
            child: TextField(
              controller: _khutbahCtrl,
              style: SettingsTheme.inputTextStyle,
              decoration: SettingsTheme.inputDecoration('e.g. 13:00'),
              onChanged: (_) => _notifyJumuah(),
            ),
          ),
          right: SettingsFormField(
            label: "Jumu'ah Prayer / Iqamah Time",
            child: TextField(
              controller: _iqamahCtrl,
              style: SettingsTheme.inputTextStyle,
              decoration: SettingsTheme.inputDecoration('e.g. 13:30'),
              onChanged: (_) => _notifyJumuah(),
            ),
          ),
        ),

        SettingsFormField(
          label: 'Display Label',
          child: TextField(
            controller: _labelCtrl,
            style: SettingsTheme.inputTextStyle,
            decoration: SettingsTheme.inputDecoration("e.g. Jumu'ah"),
            onChanged: (_) => _notifyJumuah(),
          ),
        ),
      ],
    );
  }
}
