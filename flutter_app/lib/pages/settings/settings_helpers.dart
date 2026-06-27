/// settings_helpers.dart
/// Shared UI components, theme values, and layout helpers
/// used across all settings tabs.

import 'package:flutter/material.dart';

// ═══════════════════════════════════════════════════════════════
// Design tokens — theme-aware (read SettingsTheme.isDark)
// ═══════════════════════════════════════════════════════════════

class SettingsTheme {
  // Set this before the settings panel is built.
  static bool isDark = true;

  // ── Colors that change with theme ──────────────────────────
  static Color get bgPrimary =>
      isDark ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9);
  static Color get bgSurface =>
      isDark ? const Color(0xFF1E293B) : Colors.white;
  static Color get bgElevated =>
      isDark ? const Color(0xFF263549) : const Color(0xFFF8FAFC);
  static Color get borderSubtle =>
      isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0);
  static Color get textPrimary =>
      isDark ? const Color(0xFFE2E8F0) : const Color(0xFF0F172A);
  static Color get textSecondary =>
      isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);

  // ── Colors that stay constant ──────────────────────────────
  static const Color accentTeal  = Color(0xFF14B8A6);
  static const Color accentBlue  = Color(0xFF3B82F6);
  static const Color accentGold  = Color(0xFFFBBF24);
  static const Color accentRed   = Color(0xFFEF4444);

  // ── Text styles ────────────────────────────────────────────
  static TextStyle get labelStyle => TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: textSecondary,
        letterSpacing: 0.4,
      );

  static TextStyle get inputTextStyle => TextStyle(
        fontSize: 14,
        color: textPrimary,
      );

  static TextStyle get sectionTitleStyle => const TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w700,
        color: accentTeal,
      );

  // ── Input decoration ───────────────────────────────────────
  static InputDecoration inputDecoration(String hint, {IconData? prefix}) {
    return InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(color: textSecondary.withValues(alpha: 0.5), fontSize: 13),
      prefixIcon: prefix != null
          ? Icon(prefix, color: textSecondary, size: 18)
          : null,
      filled: true,
      fillColor: bgElevated,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(color: borderSubtle),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(color: borderSubtle),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: accentTeal, width: 1.5),
      ),
    );
  }

  // ── Button styles ──────────────────────────────────────────
  static ButtonStyle get primaryButtonStyle => ElevatedButton.styleFrom(
        backgroundColor: accentTeal,
        foregroundColor: isDark ? const Color(0xFF0F172A) : Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
      );

  static ButtonStyle get outlineButtonStyle => OutlinedButton.styleFrom(
        foregroundColor: textSecondary,
        side: BorderSide(color: borderSubtle),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      );
}

// ═══════════════════════════════════════════════════════════════
// Shared layout components
// ═══════════════════════════════════════════════════════════════

/// Wraps a settings tab with consistent padding and scroll.
class SettingsTabScaffold extends StatelessWidget {
  final String title;
  final List<Widget> children;

  const SettingsTabScaffold({
    super.key,
    required this.title,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: TextStyle(
            fontSize: 20, fontWeight: FontWeight.w700,
            color: SettingsTheme.textPrimary,
          )),
          const SizedBox(height: 4),
          Divider(color: SettingsTheme.borderSubtle, height: 24),
          ...children,
        ],
      ),
    );
  }
}

/// A labeled form field with optional help text.
class SettingsFormField extends StatelessWidget {
  final String label;
  final Widget child;
  final String? helpText;

  const SettingsFormField({
    super.key,
    required this.label,
    required this.child,
    this.helpText,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: SettingsTheme.labelStyle),
          const SizedBox(height: 6),
          child,
          if (helpText != null) ...[
            const SizedBox(height: 5),
            Text(
              helpText!,
              style: TextStyle(fontSize: 11, color: SettingsTheme.textSecondary),
            ),
          ],
        ],
      ),
    );
  }
}

/// A two-column row layout for form fields.
class SettingsFormRow extends StatelessWidget {
  final Widget left;
  final Widget right;

  const SettingsFormRow({
    super.key,
    required this.left,
    required this.right,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: LayoutBuilder(
        builder: (context, constraints) {
          if (constraints.maxWidth < 600) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [left, right],
            );
          }
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: left),
              const SizedBox(width: 16),
              Expanded(child: right),
            ],
          );
        },
      ),
    );
  }
}

/// A toggle row with label and description.
class SettingsToggleRow extends StatelessWidget {
  final String label;
  final String? description;
  final bool value;
  final ValueChanged<bool> onChanged;

  const SettingsToggleRow({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
    this.description,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: SettingsTheme.textPrimary)),
                if (description != null)
                  Text(description!,
                      style: TextStyle(
                          fontSize: 12,
                          color: SettingsTheme.textSecondary)),
              ],
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeTrackColor: SettingsTheme.accentTeal,
            activeThumbColor: SettingsTheme.accentTeal,
          ),
        ],
      ),
    );
  }
}

/// Dropdown with label.
class SettingsDropdown<T> extends StatelessWidget {
  final String label;
  final T value;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?> onChanged;

  const SettingsDropdown({
    super.key,
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return SettingsFormField(
      label: label,
      child: DropdownButtonFormField<T>(
        value: value,
        items: items,
        onChanged: onChanged,
        dropdownColor: SettingsTheme.bgElevated,
        style: SettingsTheme.inputTextStyle,
        decoration: SettingsTheme.inputDecoration('').copyWith(
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        ),
      ),
    );
  }
}

/// Section divider with label.
class SettingsSectionHeader extends StatelessWidget {
  final String title;

  const SettingsSectionHeader({super.key, required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 16, bottom: 12),
      child: Row(
        children: [
          Text(title, style: SettingsTheme.sectionTitleStyle),
          const SizedBox(width: 12),
          Expanded(child: Divider(color: SettingsTheme.borderSubtle)),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// Color swatch picker
// ═══════════════════════════════════════════════════════════════

/// Preset color swatches + hex text input for display color settings.
class ColorSwatchPicker extends StatefulWidget {
  final String label;
  final String? currentHex; // e.g. 'FFFFFF' or null
  final ValueChanged<String> onChanged;

  const ColorSwatchPicker({
    super.key,
    required this.label,
    required this.currentHex,
    required this.onChanged,
  });

  @override
  State<ColorSwatchPicker> createState() => _ColorSwatchPickerState();
}

class _ColorSwatchPickerState extends State<ColorSwatchPicker> {
  late TextEditingController _hexCtrl;

  static const _presets = [
    ('White',   'FFFFFF'),
    ('Teal',    '14B8A6'),
    ('Gold',    'FBBF24'),
    ('Green',   '22C55E'),
    ('Blue',    '3B82F6'),
    ('Purple',  'A855F7'),
    ('Red',     'EF4444'),
    ('Orange',  'F97316'),
    ('Pink',    'EC4899'),
    ('Slate',   '94A3B8'),
  ];

  @override
  void initState() {
    super.initState();
    _hexCtrl = TextEditingController(text: widget.currentHex ?? '');
  }

  @override
  void didUpdateWidget(ColorSwatchPicker old) {
    super.didUpdateWidget(old);
    if (old.currentHex != widget.currentHex) {
      _hexCtrl.text = widget.currentHex ?? '';
    }
  }

  @override
  void dispose() {
    _hexCtrl.dispose();
    super.dispose();
  }

  Color _parseHex(String hex) {
    try {
      var h = hex.replaceAll('#', '');
      if (h.length == 6) h = 'FF$h';
      return Color(int.parse(h, radix: 16));
    } catch (_) {
      return Colors.grey;
    }
  }

  bool _isValidHex(String hex) {
    final h = hex.replaceAll('#', '');
    return h.length == 6 && RegExp(r'^[0-9A-Fa-f]{6}$').hasMatch(h);
  }

  @override
  Widget build(BuildContext context) {
    final current = widget.currentHex ?? '';

    return SettingsFormField(
      label: widget.label,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Preset swatches
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _presets.map((preset) {
              final name = preset.$1;
              final hex = preset.$2;
              final isSelected = current.toUpperCase() == hex.toUpperCase();
              return GestureDetector(
                onTap: () {
                  _hexCtrl.text = hex;
                  widget.onChanged(hex);
                },
                child: Tooltip(
                  message: name,
                  child: Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: _parseHex(hex),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                        color: isSelected
                            ? SettingsTheme.accentTeal
                            : SettingsTheme.borderSubtle,
                        width: isSelected ? 2.5 : 1,
                      ),
                      boxShadow: isSelected
                          ? [BoxShadow(color: SettingsTheme.accentTeal.withValues(alpha: 0.5), blurRadius: 6)]
                          : null,
                    ),
                    child: isSelected
                        ? Icon(
                            Icons.check,
                            size: 16,
                            color: _parseHex(hex).computeLuminance() > 0.4
                                ? Colors.black
                                : Colors.white,
                          )
                        : null,
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 10),
          // Hex input
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _hexCtrl,
                  style: SettingsTheme.inputTextStyle.copyWith(fontFamily: 'monospace'),
                  decoration: SettingsTheme.inputDecoration('e.g. FFFFFF or 14B8A6').copyWith(
                    prefixText: '#  ',
                    prefixStyle: TextStyle(color: SettingsTheme.textSecondary, fontFamily: 'monospace'),
                  ),
                  onChanged: (v) {
                    final clean = v.replaceAll('#', '').trim();
                    if (_isValidHex(clean)) widget.onChanged(clean.toUpperCase());
                  },
                ),
              ),
              const SizedBox(width: 10),
              // Live preview swatch
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: _isValidHex(current) ? _parseHex(current) : SettingsTheme.borderSubtle,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: SettingsTheme.borderSubtle),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
