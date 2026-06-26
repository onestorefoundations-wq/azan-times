/// tab_system_prefs.dart
/// System Preferences settings tab.
/// 24h format, Arabic labels, audio alerts, adhan display mode, PIN change.

import 'dart:io';
import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';
import 'package:provider/provider.dart';
import '../../providers/app_provider.dart';
import '../../core/app_config.dart';
import '../../core/storage_service.dart';
import '../../core/supabase_sync_service.dart';
import '../../l10n/app_localizations.dart';
import 'settings_helpers.dart';

class TabSystemPrefs extends StatefulWidget {
  final FeaturesFormat features;
  final SyncMeta meta;
  final ValueChanged<FeaturesFormat> onChanged;
  final ValueChanged<SyncMeta> onMetaChanged;

  const TabSystemPrefs({
    super.key,
    required this.features,
    required this.meta,
    required this.onChanged,
    required this.onMetaChanged,
  });

  @override
  State<TabSystemPrefs> createState() => _TabSystemPrefsState();
}

class _TabSystemPrefsState extends State<TabSystemPrefs> {
  late TextEditingController _pinCtrl;
  String? _pinMessage;
  bool _pinSuccess = false;
  bool _pickingFile = false;
  List<String> _audioFiles = ['alert1.mp3', 'alert2.mp3'];
  static const _uuid = Uuid();

  @override
  void initState() {
    super.initState();
    _pinCtrl = TextEditingController();
    _loadAudioAssets();
  }

  Future<void> _loadAudioAssets() async {
    try {
      final manifestContent = await rootBundle.loadString('AssetManifest.json');
      final Map<String, dynamic> manifestMap = json.decode(manifestContent);
      final mp3Paths = manifestMap.keys
          .where((String key) => key.startsWith('assets/audio/') && key.endsWith('.mp3'))
          .toList();
      if (mp3Paths.isNotEmpty) {
        if (mounted) {
          setState(() {
            _audioFiles = mp3Paths.map((path) => path.split('/').last).toList();
          });
        }
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _pinCtrl.dispose();
    super.dispose();
  }

  Future<void> _changePin() async {
    final pin = _pinCtrl.text.trim();
    if (pin.isEmpty || pin.length < 4) {
      setState(() {
        _pinMessage = '⚠️ PIN must be at least 4 digits.';
        _pinSuccess = false;
      });
      return;
    }
    if (!RegExp(r'^\d+$').hasMatch(pin)) {
      setState(() {
        _pinMessage = '⚠️ PIN must be numeric only.';
        _pinSuccess = false;
      });
      return;
    }
    await StorageService.setPin(pin);
    _pinCtrl.clear();
    setState(() {
      _pinMessage = '✅ PIN changed successfully.';
      _pinSuccess = true;
    });
  }

  Future<void> _pickBackground() async {
    setState(() => _pickingFile = true);
    try {
      final result = await FilePicker.pickFiles(type: FileType.image, withData: true);
      if (result == null || result.files.isEmpty) return;

      final isLinked = context.read<AppProvider>().config.profile.tenantId != null &&
          context.read<AppProvider>().config.profile.tenantId!.isNotEmpty;

      String destPath;
      if (isLinked || kIsWeb) {
        final bytes = result.files.single.bytes;
        if (bytes == null) throw Exception('File bytes are null. Please try again.');
        destPath = await SupabaseSyncService.uploadImage(bytes, result.files.single.name, 'backgrounds');
      } else {
        final file = File(result.files.single.path!);
        final appDir = await getApplicationDocumentsDirectory();
        final destDir = Directory('${appDir.path}/backgrounds');
        await destDir.create(recursive: true);
        final ext = result.files.single.name.split('.').last;
        final id = const Uuid().v4();
        destPath = '${destDir.path}/$id.$ext';
        await file.copy(destPath);
      }

      // Add to library and auto-select it
      final updated = List<String>.from(widget.meta.backgroundImages)..add(destPath);
      widget.onMetaChanged(widget.meta.copyWith(
        backgroundImages: updated,
        customBackgroundPath: destPath,
      ));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error uploading background: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _pickingFile = false);
    }
  }

  Future<void> _removeBackground(String url) async {
    if (url.startsWith('http')) {
      await SupabaseSyncService.deleteImage(url);
    }
    final updated = List<String>.from(widget.meta.backgroundImages)..remove(url);
    final isActive = widget.meta.customBackgroundPath == url;
    final newActive = isActive ? (updated.isEmpty ? null : updated.last) : widget.meta.customBackgroundPath;
    widget.onMetaChanged(widget.meta.copyWith(
      backgroundImages: updated,
      customBackgroundPath: newActive,
      clearCustomBackgroundPath: isActive && updated.isEmpty,
    ));
  }

  void _selectBackground(String url) {
    widget.onMetaChanged(widget.meta.copyWith(customBackgroundPath: url));
  }

  Widget _buildBgThumbnail(String url, double w, double h) {
    final broken = Container(
      width: w, height: h, color: const Color(0xFF1E293B),
      child: const Center(child: Icon(Icons.broken_image, color: Color(0xFF475569))),
    );
    if (url.startsWith('http')) {
      return Image.network(url, width: w, height: h, fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => broken);
    }
    if (url.startsWith('data:')) {
      if (kIsWeb) {
        return Image.network(url, width: w, height: h, fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => broken);
      }
      try {
        final bytes = base64Decode(url.substring(url.indexOf(',') + 1));
        return Image.memory(bytes, width: w, height: h, fit: BoxFit.cover);
      } catch (_) {
        return broken;
      }
    }
    return Image.file(File(url), width: w, height: h, fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => broken);
  }

  void _showBgPreview(BuildContext context, String url) {
    final isActive = widget.meta.customBackgroundPath == url;
    Widget imgWidget;
    if (url.startsWith('http')) {
      imgWidget = Image.network(url, fit: BoxFit.contain,
          errorBuilder: (_, __, ___) => const Icon(Icons.broken_image, color: Colors.red, size: 60));
    } else if (url.startsWith('data:')) {
      if (kIsWeb) {
        imgWidget = Image.network(url, fit: BoxFit.contain,
            errorBuilder: (_, __, ___) => const Icon(Icons.broken_image, color: Colors.red, size: 60));
      } else {
        try {
          final bytes = base64Decode(url.substring(url.indexOf(',') + 1));
          imgWidget = Image.memory(bytes, fit: BoxFit.contain);
        } catch (_) {
          imgWidget = const Icon(Icons.broken_image, color: Colors.red, size: 60);
        }
      }
    } else {
      imgWidget = Image.file(File(url), fit: BoxFit.contain,
          errorBuilder: (_, __, ___) => const Icon(Icons.broken_image, color: Colors.red, size: 60));
    }

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlg) => Dialog(
          backgroundColor: const Color(0xFF0F172A),
          insetPadding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 8, 8),
                child: Row(
                  children: [
                    Expanded(child: Text(
                      url.split('/').last,
                      style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500),
                      overflow: TextOverflow.ellipsis,
                    )),
                    IconButton(icon: const Icon(Icons.close, color: Colors.white60), onPressed: () => Navigator.pop(ctx)),
                  ],
                ),
              ),
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 420),
                child: InteractiveViewer(child: imgWidget),
              ),
              Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    ElevatedButton.icon(
                      onPressed: isActive ? null : () {
                        _selectBackground(url);
                        Navigator.pop(ctx);
                      },
                      icon: Icon(isActive ? Icons.check_circle : Icons.tv, size: 16),
                      label: Text(isActive ? 'Active on TV' : 'Set as Active'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: isActive ? const Color(0xFF0F2A1E) : const Color(0xFF14B8A6),
                        foregroundColor: isActive ? const Color(0xFF14B8A6) : Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final f = widget.features;

    return SettingsTabScaffold(
      title: 'System Preferences',
      children: [
        SettingsToggleRow(
          label: 'Analog Clock Display',
          description: 'Show an analog clock face instead of the digital clock on the TV',
          value: f.showAnalogClock,
          onChanged: (v) => widget.onChanged(f.copyWith(showAnalogClock: v)),
        ),

        if (f.showAnalogClock)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Analog Clock Size',
                        style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: SettingsTheme.textPrimary)),
                    Text('${f.analogClockSize}%',
                        style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: SettingsTheme.accentTeal)),
                  ],
                ),
                const SizedBox(height: 4),
                Text('Adjust the clock face size on the TV display',
                    style: TextStyle(fontSize: 12, color: SettingsTheme.textSecondary)),
                Slider(
                  value: f.analogClockSize.toDouble(),
                  min: 50,
                  max: 200,
                  divisions: 15,
                  activeColor: SettingsTheme.accentTeal,
                  inactiveColor: SettingsTheme.accentTeal.withOpacity(0.2),
                  label: '${f.analogClockSize}%',
                  onChanged: (v) => widget.onChanged(
                      f.copyWith(analogClockSize: v.round())),
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('50%', style: TextStyle(fontSize: 11, color: SettingsTheme.textSecondary)),
                    Text('100% (default)', style: TextStyle(fontSize: 11, color: SettingsTheme.textSecondary)),
                    Text('200%', style: TextStyle(fontSize: 11, color: SettingsTheme.textSecondary)),
                  ],
                ),
              ],
            ),
          ),

        // ── Display Language ───────────────────────────────────
        Builder(builder: (ctx) {
          final l10n = AppLocalizations.of(ctx);
          return SettingsDropdown<String>(
            label: l10n?.displayLanguage ?? 'Display Language',
            value: f.displayLanguage,
            onChanged: (v) {
              if (v != null) widget.onChanged(f.copyWith(displayLanguage: v));
            },
            items: [
              // ── Fixed top 3 ─────────────────────────────────────
              DropdownMenuItem(value: 'en', child: Text(l10n?.langEnglish ?? 'English')),
              DropdownMenuItem(value: 'ar', child: Text(l10n?.langArabic ?? 'العربية')),
              DropdownMenuItem(value: 'ml', child: Text(l10n?.langMalayalam ?? 'മലയാളം')),
              // ── Alphabetical by English name ─────────────────────
              DropdownMenuItem(value: 'am', child: Text(l10n?.langAmharic ?? 'አማርኛ')),
              DropdownMenuItem(value: 'az', child: Text(l10n?.langAzerbaijani ?? 'Azərbaycan')),
              DropdownMenuItem(value: 'bn', child: Text(l10n?.langBengali ?? 'বাংলা')),
              DropdownMenuItem(value: 'zh', child: Text(l10n?.langChinese ?? '中文')),
              DropdownMenuItem(value: 'nl', child: Text(l10n?.langDutch ?? 'Nederlands')),
              DropdownMenuItem(value: 'fr', child: Text(l10n?.langFrench ?? 'Français')),
              DropdownMenuItem(value: 'de', child: Text(l10n?.langGerman ?? 'Deutsch')),
              DropdownMenuItem(value: 'gu', child: Text(l10n?.langGujarati ?? 'ગુજરાતી')),
              DropdownMenuItem(value: 'ha', child: Text(l10n?.langHausa ?? 'Hausa')),
              DropdownMenuItem(value: 'hi', child: Text(l10n?.langHindi ?? 'हिन्दी')),
              DropdownMenuItem(value: 'id', child: Text(l10n?.langIndonesian ?? 'Bahasa Indonesia')),
              DropdownMenuItem(value: 'it', child: Text(l10n?.langItalian ?? 'Italiano')),
              DropdownMenuItem(value: 'kn', child: Text(l10n?.langKannada ?? 'ಕನ್ನಡ')),
              DropdownMenuItem(value: 'ku', child: Text(l10n?.langKurdish ?? 'Kurdî')),
              DropdownMenuItem(value: 'ms', child: Text(l10n?.langMalay ?? 'Bahasa Melayu')),
              DropdownMenuItem(value: 'ps', child: Text(l10n?.langPashto ?? 'پښتو')),
              DropdownMenuItem(value: 'fa', child: Text(l10n?.langPersian ?? 'فارسی')),
              DropdownMenuItem(value: 'pt', child: Text(l10n?.langPortuguese ?? 'Português')),
              DropdownMenuItem(value: 'ru', child: Text(l10n?.langRussian ?? 'Русский')),
              DropdownMenuItem(value: 'si', child: Text(l10n?.langSinhala ?? 'සිංහල')),
              DropdownMenuItem(value: 'so', child: Text(l10n?.langSomali ?? 'Soomaali')),
              DropdownMenuItem(value: 'es', child: Text(l10n?.langSpanish ?? 'Español')),
              DropdownMenuItem(value: 'sw', child: Text(l10n?.langSwahili ?? 'Kiswahili')),
              DropdownMenuItem(value: 'tl', child: Text(l10n?.langTagalog ?? 'Filipino')),
              DropdownMenuItem(value: 'ta', child: Text(l10n?.langTamil ?? 'தமிழ்')),
              DropdownMenuItem(value: 'te', child: Text(l10n?.langTelugu ?? 'తెలుగు')),
              DropdownMenuItem(value: 'tr', child: Text(l10n?.langTurkish ?? 'Türkçe')),
              DropdownMenuItem(value: 'ur', child: Text(l10n?.langUrdu ?? 'اردو')),
              DropdownMenuItem(value: 'uz', child: Text(l10n?.langUzbek ?? "O'zbek")),
              DropdownMenuItem(value: 'yo', child: Text(l10n?.langYoruba ?? 'Yorùbá')),
            ],
          );
        }),

        const SizedBox(height: 8),

        SettingsToggleRow(
          label: 'Use 24-Hour Time Format',
          description: 'Display times as 13:00 instead of 1:00 PM',
          value: f.use24HourFormat,
          onChanged: (v) => widget.onChanged(f.copyWith(use24HourFormat: v)),
        ),

        SettingsToggleRow(
          label: 'Use Arabic Prayer Labels',
          description: 'Show الفجر, الظهر, العصر, المغرب, العشاء (overrides language for prayer names)',
          value: f.useArabicLabels,
          onChanged: (v) => widget.onChanged(f.copyWith(useArabicLabels: v)),
        ),

        SettingsToggleRow(
          label: 'Enable Adhan & Iqamah Sound Alerts',
          description: 'Play audio alert at Adhan and Iqamah times',
          value: f.audioAlertsEnabled,
          onChanged: (v) => widget.onChanged(f.copyWith(audioAlertsEnabled: v)),
        ),

        const SizedBox(height: 8),

        SettingsDropdown<String>(
          label: 'Adhan Audio File',
          value: _audioFiles.contains(f.adhanAudio) ? f.adhanAudio : _audioFiles.first,
          onChanged: (v) {
            if (v != null) widget.onChanged(f.copyWith(adhanAudio: v));
          },
          items: _audioFiles.map((file) => DropdownMenuItem(value: file, child: Text(file))).toList(),
        ),

        SettingsDropdown<String>(
          label: 'Iqamah Audio File',
          value: _audioFiles.contains(f.iqamahAudio) ? f.iqamahAudio : _audioFiles.first,
          onChanged: (v) {
            if (v != null) widget.onChanged(f.copyWith(iqamahAudio: v));
          },
          items: _audioFiles.map((file) => DropdownMenuItem(value: file, child: Text(file))).toList(),
        ),

        const SizedBox(height: 8),

        SettingsDropdown<String>(
          label: 'Adhan Alert Display Mode',
          value: f.adhanAlertMode,
          onChanged: (v) {
            if (v != null) widget.onChanged(f.copyWith(adhanAlertMode: v));
          },
          items: const [
            DropdownMenuItem(
              value: 'full_screen',
              child: Text('Mode 1: Full Screen Alert (Covers entire screen)'),
            ),
            DropdownMenuItem(
              value: 'dismissible',
              child: Text('Mode 2: Dismissible Alert (Shows close button)'),
            ),
            DropdownMenuItem(
              value: 'side_panel',
              child: Text('Mode 3: Side Panel Only (No overlay, panel shows alert)'),
            ),
          ],
        ),

        Divider(color: SettingsTheme.borderSubtle, height: 32),
        const SettingsSectionHeader(title: 'Display Appearance'),
        Text(
          'Customize fonts and colors for the main TV display.',
          style: TextStyle(fontSize: 12, color: SettingsTheme.textSecondary),
        ),
        const SizedBox(height: 12),

        SettingsDropdown<String>(
          label: 'Display Font Family',
          value: widget.meta.displayFontFamily ?? 'Roboto',
          onChanged: (v) {
            if (v != null) widget.onMetaChanged(widget.meta.copyWith(displayFontFamily: v));
          },
          items: const [
            DropdownMenuItem(value: 'Roboto', child: Text('Roboto (Default)')),
            DropdownMenuItem(value: 'Arial', child: Text('Arial')),
            DropdownMenuItem(value: 'Times New Roman', child: Text('Times New Roman')),
            DropdownMenuItem(value: 'Courier', child: Text('Courier')),
            DropdownMenuItem(value: 'Verdana', child: Text('Verdana')),
          ],
        ),

        ColorSwatchPicker(
          label: 'Primary Text Color (Clock, Prayer Names)',
          currentHex: widget.meta.primaryTextColor,
          onChanged: (hex) => widget.onMetaChanged(widget.meta.copyWith(primaryTextColor: hex)),
        ),

        ColorSwatchPicker(
          label: 'Accent / Secondary Color (Highlights, Countdown)',
          currentHex: widget.meta.secondaryTextColor,
          onChanged: (hex) => widget.onMetaChanged(widget.meta.copyWith(secondaryTextColor: hex)),
        ),

        ColorSwatchPicker(
          label: 'Prayer Name Color (Normal Rows)',
          currentHex: widget.meta.prayerNameColor,
          onChanged: (hex) => widget.onMetaChanged(widget.meta.copyWith(prayerNameColor: hex)),
        ),

        ColorSwatchPicker(
          label: 'Prayer Time Color (Adhan & Iqamah Normal Rows)',
          currentHex: widget.meta.prayerTimeColor,
          onChanged: (hex) => widget.onMetaChanged(widget.meta.copyWith(prayerTimeColor: hex)),
        ),

        ColorSwatchPicker(
          label: 'Date & Hijri Text Color',
          currentHex: widget.meta.dateTextColor,
          onChanged: (hex) => widget.onMetaChanged(widget.meta.copyWith(dateTextColor: hex)),
        ),

        ColorSwatchPicker(
          label: 'Scrolling Ticker Text Color',
          currentHex: widget.meta.tickerTextColor,
          onChanged: (hex) => widget.onMetaChanged(widget.meta.copyWith(tickerTextColor: hex)),
        ),

        Divider(color: SettingsTheme.borderSubtle, height: 32),
        const SettingsSectionHeader(title: 'Hardware Display Settings (Local)'),

        Text(
          'These settings apply only to this specific physical device and are not synced via the cloud. Use "Force Landscape" if this device is mounted on a wall or TV.',
          style: TextStyle(fontSize: 12, color: SettingsTheme.textSecondary),
        ),
        const SizedBox(height: 12),

        SettingsDropdown<String>(
          label: 'Display Orientation',
          value: widget.meta.displayOrientation,
          onChanged: (v) {
            if (v != null) widget.onMetaChanged(widget.meta.copyWith(displayOrientation: v));
          },
          items: const [
            DropdownMenuItem(value: 'auto', child: Text('Auto (Follow Device Rotation)')),
            DropdownMenuItem(value: 'landscape', child: Text('Force Landscape (Recommended for TVs)')),
            DropdownMenuItem(value: 'portrait', child: Text('Force Portrait')),
          ],
        ),

        Divider(color: SettingsTheme.borderSubtle, height: 32),
        const SettingsSectionHeader(title: 'Background Images'),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFF0D2137),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: SettingsTheme.accentTeal.withOpacity(0.35)),
          ),
          child: Row(
            children: [
              const Icon(Icons.photo_library_outlined, color: SettingsTheme.accentTeal, size: 22),
              const SizedBox(width: 12),
              const Expanded(
                child: Text(
                  'Background images are now managed in the Media Library tab.\n'
                  'Upload landscape and portrait backgrounds there and tap "Set BG" to activate.',
                  style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                ),
              ),
            ],
          ),
        ),

        Divider(color: SettingsTheme.borderSubtle, height: 32),
        const SettingsSectionHeader(title: 'Local Admin PIN'),

        Text(
          'Optionally lock settings access with a PIN on this device. Disabled by default.',
          style: TextStyle(fontSize: 12, color: SettingsTheme.textSecondary),
        ),
        const SizedBox(height: 12),

        StatefulBuilder(builder: (context, setLocal) {
          return SettingsToggleRow(
            label: 'Require PIN to Open Settings',
            description: 'If off, settings open without a PIN (easier for testing)',
            value: widget.meta.pinEnabled,
            onChanged: (v) async {
              await StorageService.setPinEnabled(v);
              widget.onMetaChanged(widget.meta.copyWith(pinEnabled: v));
              setLocal(() {});
            },
          );
        }),

        SettingsFormField(
          label: 'New PIN',
          helpText: 'Minimum 4 digits. Stored securely as a SHA-256 hash.',
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _pinCtrl,
                  keyboardType: TextInputType.number,
                  obscureText: true,
                  maxLength: 8,
                  style: SettingsTheme.inputTextStyle,
                  decoration: SettingsTheme.inputDecoration('Enter new numeric PIN')
                      .copyWith(counterText: ''),
                ),
              ),
              const SizedBox(width: 12),
              ElevatedButton(
                onPressed: _changePin,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1E293B),
                  foregroundColor: SettingsTheme.accentTeal,
                  side: const BorderSide(color: SettingsTheme.accentTeal),
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                ),
                child: const Text('Set PIN'),
              ),
            ],
          ),
        ),

        if (_pinMessage != null)
          Text(
            _pinMessage!,
            style: TextStyle(
              fontSize: 13,
              color: _pinSuccess
                  ? SettingsTheme.accentTeal
                  : SettingsTheme.accentRed,
            ),
          ),
      ],
    );
  }
}
