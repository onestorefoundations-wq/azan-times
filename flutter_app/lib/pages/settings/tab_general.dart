/// tab_general.dart
/// General Info settings tab: Masjid name and Arabic name.
/// Cloud account linking is handled in the Cloud & Sync tab.

import 'package:flutter/material.dart';
import '../../core/app_config.dart';
import '../settings/settings_helpers.dart';

class TabGeneral extends StatefulWidget {
  final MasjidProfile profile;
  final ValueChanged<MasjidProfile> onChanged;

  const TabGeneral({
    super.key,
    required this.profile,
    required this.onChanged,
  });

  @override
  State<TabGeneral> createState() => _TabGeneralState();
}

class _TabGeneralState extends State<TabGeneral> {
  late TextEditingController _nameCtrl;
  late TextEditingController _nameArabicCtrl;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.profile.name);
    _nameArabicCtrl = TextEditingController(text: widget.profile.nameArabic ?? '');
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _nameArabicCtrl.dispose();
    super.dispose();
  }

  void _notify() {
    widget.onChanged(widget.profile.copyWith(
      name: _nameCtrl.text.trim(),
      nameArabic: _nameArabicCtrl.text.trim().isEmpty ? null : _nameArabicCtrl.text.trim(),
      clearNameArabic: _nameArabicCtrl.text.trim().isEmpty,
    ));
  }

  @override
  Widget build(BuildContext context) {
    return SettingsTabScaffold(
      title: 'General Settings',
      children: [
        SettingsFormField(
          label: 'Masjid / Mosque Name',
          helpText: 'Displayed on the main TV screen and synced across all linked displays.',
          child: TextField(
            controller: _nameCtrl,
            style: SettingsTheme.inputTextStyle,
            decoration: SettingsTheme.inputDecoration('e.g. Central Mosque London'),
            onChanged: (_) => _notify(),
          ),
        ),
        SettingsFormField(
          label: 'Arabic Mosque Name (Optional)',
          helpText: 'Shown below the English name on the TV display.',
          child: TextField(
            controller: _nameArabicCtrl,
            textDirection: TextDirection.rtl,
            style: SettingsTheme.inputTextStyle,
            decoration: SettingsTheme.inputDecoration('مسجد'),
            onChanged: (_) => _notify(),
          ),
        ),

        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: SettingsTheme.bgElevated,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: SettingsTheme.borderSubtle),
          ),
          child: Row(
            children: [
              const Icon(Icons.cloud_outlined, color: SettingsTheme.accentTeal, size: 20),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'To link this display to a cloud account for multi-device sync, go to the ☁️ Cloud & Sync tab.',
                  style: TextStyle(fontSize: 13, color: SettingsTheme.textSecondary),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
