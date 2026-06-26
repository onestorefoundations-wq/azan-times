/// tab_prayer_offsets.dart
/// Prayer Time Adjustments: Adhan offset + Iqamah wait for each prayer.

import 'package:flutter/material.dart';
import '../../core/app_config.dart';
import 'settings_helpers.dart';

class TabPrayerOffsets extends StatefulWidget {
  final TimeAdjustments adjustments;
  final ValueChanged<TimeAdjustments> onChanged;

  const TabPrayerOffsets({
    super.key,
    required this.adjustments,
    required this.onChanged,
  });

  @override
  State<TabPrayerOffsets> createState() => _TabPrayerOffsetsState();
}

class _TabPrayerOffsetsState extends State<TabPrayerOffsets> {
  late Map<String, TextEditingController> _adhanCtrl;
  late Map<String, TextEditingController> _iqamahCtrl;

  static const List<(String, String)> _prayers = [
    ('fajr', 'Fajr'),
    ('dhuhr', 'Dhuhr'),
    ('asr', 'Asr'),
    ('maghrib', 'Maghrib'),
    ('isha', 'Isha'),
  ];

  PrayerOffset _getOffset(String key) {
    return switch (key) {
      'fajr' => widget.adjustments.fajr,
      'dhuhr' => widget.adjustments.dhuhr,
      'asr' => widget.adjustments.asr,
      'maghrib' => widget.adjustments.maghrib,
      'isha' => widget.adjustments.isha,
      _ => const PrayerOffset(),
    };
  }

  @override
  void initState() {
    super.initState();
    _adhanCtrl = {
      for (final (key, _) in _prayers)
        key: TextEditingController(text: _getOffset(key).adhanOffset.toString()),
    };
    _iqamahCtrl = {
      for (final (key, _) in _prayers)
        key: TextEditingController(text: _getOffset(key).iqamahWait.toString()),
    };
  }

  @override
  void dispose() {
    for (final c in _adhanCtrl.values) c.dispose();
    for (final c in _iqamahCtrl.values) c.dispose();
    super.dispose();
  }

  void _notify() {
    widget.onChanged(TimeAdjustments(
      fajr: PrayerOffset(
        adhanOffset: int.tryParse(_adhanCtrl['fajr']!.text) ?? 0,
        iqamahWait: int.tryParse(_iqamahCtrl['fajr']!.text) ?? 25,
      ),
      dhuhr: PrayerOffset(
        adhanOffset: int.tryParse(_adhanCtrl['dhuhr']!.text) ?? -2,
        iqamahWait: int.tryParse(_iqamahCtrl['dhuhr']!.text) ?? 15,
      ),
      asr: PrayerOffset(
        adhanOffset: int.tryParse(_adhanCtrl['asr']!.text) ?? 0,
        iqamahWait: int.tryParse(_iqamahCtrl['asr']!.text) ?? 15,
      ),
      maghrib: PrayerOffset(
        adhanOffset: int.tryParse(_adhanCtrl['maghrib']!.text) ?? 0,
        iqamahWait: int.tryParse(_iqamahCtrl['maghrib']!.text) ?? 5,
      ),
      isha: PrayerOffset(
        adhanOffset: int.tryParse(_adhanCtrl['isha']!.text) ?? 0,
        iqamahWait: int.tryParse(_iqamahCtrl['isha']!.text) ?? 15,
      ),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return SettingsTabScaffold(
      title: 'Prayer Time Adjustments',
      children: [
        Text(
          'Modify Adhan offsets (mins, can be negative) and custom Iqamah wait timings (mins after Adhan).',
          style: TextStyle(fontSize: 13, color: SettingsTheme.textSecondary),
        ),
        const SizedBox(height: 16),

        // Table header
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: SettingsTheme.bgElevated,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(10)),
            border: Border(
              bottom: BorderSide(color: SettingsTheme.borderSubtle),
            ),
          ),
          child: Row(
            children: [
              Expanded(flex: 3, child: Text('Prayer',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
                      color: SettingsTheme.textSecondary, letterSpacing: 1))),
              Expanded(flex: 3, child: Text('Adhan Offset (Mins)',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
                      color: SettingsTheme.textSecondary, letterSpacing: 1))),
              Expanded(flex: 3, child: Text('Iqamah Wait (Mins)',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
                      color: SettingsTheme.textSecondary, letterSpacing: 1))),
            ],
          ),
        ),

        // Prayer rows
        Container(
          decoration: BoxDecoration(
            border: Border.all(color: SettingsTheme.borderSubtle),
            borderRadius: const BorderRadius.vertical(bottom: Radius.circular(10)),
          ),
          child: Column(
            children: _prayers.map(((String, String) entry) {
              final (key, label) = entry;
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(
                      color: key == 'isha'
                          ? Colors.transparent
                          : SettingsTheme.borderSubtle,
                    ),
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      flex: 3,
                      child: Text(label,
                          style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: SettingsTheme.textPrimary)),
                    ),
                    Expanded(
                      flex: 3,
                      child: Padding(
                        padding: const EdgeInsets.only(right: 12),
                        child: TextField(
                          controller: _adhanCtrl[key],
                          keyboardType: const TextInputType.numberWithOptions(signed: true),
                          style: SettingsTheme.inputTextStyle,
                          decoration: SettingsTheme.inputDecoration('0'),
                          onChanged: (_) => _notify(),
                        ),
                      ),
                    ),
                    Expanded(
                      flex: 3,
                      child: TextField(
                        controller: _iqamahCtrl[key],
                        keyboardType: TextInputType.number,
                        style: SettingsTheme.inputTextStyle,
                        decoration: SettingsTheme.inputDecoration('15'),
                        onChanged: (_) => _notify(),
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }
}
