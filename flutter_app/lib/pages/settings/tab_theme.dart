/// tab_theme.dart
/// Theme Presets settings tab.
/// Displays 12 Islamic-inspired themes in a visual swatch grid.
/// Tapping a theme applies all its color tokens instantly.

import 'package:flutter/material.dart';
import '../../core/app_theme.dart';
import '../../core/app_config.dart';

class TabTheme extends StatelessWidget {
  final SyncMeta meta;
  final ValueChanged<SyncMeta> onMetaChanged;

  const TabTheme({
    super.key,
    required this.meta,
    required this.onMetaChanged,
  });

  void _applyTheme(AppTheme theme) {
    onMetaChanged(meta.copyWith(
      themeId:          theme.id,
      primaryTextColor:   theme.primaryText,
      secondaryTextColor: theme.secondaryText,
      prayerNameColor:    theme.prayerName,
      prayerTimeColor:    theme.prayerTime,
      dateTextColor:      theme.dateText,
      tickerTextColor:    theme.tickerText,
      tickerBgColor:      theme.tickerBg,
      tvBackgroundColor:  theme.bg,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final isLight = meta.adminLightTheme;
    final cardBg    = isLight ? const Color(0xFFF1F5F9) : const Color(0xFF1E293B);
    final labelCol  = isLight ? const Color(0xFF0F172A) : const Color(0xFFE2E8F0);
    final groupCol  = isLight ? const Color(0xFF64748B) : const Color(0xFF64748B);
    final divColor  = isLight ? const Color(0xFFE2E8F0) : const Color(0xFF334155);

    final darkThemes   = kThemes.where((t) => t.group == 'dark').toList();
    final mediumThemes = kThemes.where((t) => t.group == 'medium').toList();
    final lightThemes  = kThemes.where((t) => t.group == 'light').toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Text(
            'Display Themes',
            style: TextStyle(
              color: labelCol,
              fontSize: 20,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.2,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Choose a preset theme. Colors are applied instantly to the TV display.',
            style: TextStyle(color: groupCol, fontSize: 13),
          ),
          const SizedBox(height: 24),

          _buildGroup(
            label: '🌙  Dark',
            themes: darkThemes,
            cardBg: cardBg,
            labelCol: labelCol,
            groupCol: groupCol,
            divColor: divColor,
          ),
          const SizedBox(height: 24),
          _buildGroup(
            label: '🌆  Medium',
            themes: mediumThemes,
            cardBg: cardBg,
            labelCol: labelCol,
            groupCol: groupCol,
            divColor: divColor,
          ),
          const SizedBox(height: 24),
          _buildGroup(
            label: '☀️  Light',
            themes: lightThemes,
            cardBg: cardBg,
            labelCol: labelCol,
            groupCol: groupCol,
            divColor: divColor,
          ),
          const SizedBox(height: 32),

          // Reset notice
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isLight ? const Color(0xFFF8FAFC) : const Color(0xFF0F172A),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: divColor),
            ),
            child: Row(
              children: [
                Icon(Icons.info_outline, size: 16, color: groupCol),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Selecting a theme replaces all individual color settings. '
                    'You can still adjust individual colors in System Preferences after applying a theme.',
                    style: TextStyle(color: groupCol, fontSize: 12),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGroup({
    required String label,
    required List<AppTheme> themes,
    required Color cardBg,
    required Color labelCol,
    required Color groupCol,
    required Color divColor,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            color: groupCol,
            fontSize: 12,
            fontWeight: FontWeight.w600,
            letterSpacing: 1.2,
          ),
        ),
        const SizedBox(height: 10),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 1.55,
          children: themes.map((t) => _ThemeSwatch(
            theme: t,
            isSelected: meta.themeId == t.id,
            onTap: () => _applyTheme(t),
          )).toList(),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Individual theme swatch card
// ─────────────────────────────────────────────────────────────

class _ThemeSwatch extends StatelessWidget {
  final AppTheme theme;
  final bool isSelected;
  final VoidCallback onTap;

  const _ThemeSwatch({
    required this.theme,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final t = theme;
    final selected = isSelected;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? t.accentColor : Colors.transparent,
            width: selected ? 2.5 : 1.5,
          ),
          boxShadow: selected
              ? [BoxShadow(color: t.accentColor.withOpacity(0.35), blurRadius: 12, spreadRadius: 1)]
                : [const BoxShadow(color: Colors.black26, blurRadius: 4)],
          ),
          clipBehavior: Clip.antiAlias,
          child: Stack(
            children: [
              // Background gradient from bg → surface
              Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [t.bgColor, t.surfaceColor],
                  ),
                ),
              ),

              // Ticker bar preview at bottom
              Positioned(
                bottom: 0, left: 0, right: 0,
                child: Container(
                  height: 8,
                  color: t.tickerBgColor,
                ),
              ),

              // Accent color stripe at top
              Positioned(
                top: 0, left: 0, right: 0,
                child: Container(
                  height: 3,
                  color: t.accentColor,
                ),
              ),

              // Content
              Padding(
                padding: const EdgeInsets.fromLTRB(10, 10, 10, 14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Color dots row
                    Row(
                      children: [
                        _dot(t.primaryTextColor),
                        const SizedBox(width: 4),
                        _dot(t.accentColor),
                        const SizedBox(width: 4),
                        _dot(t.prayerNameColor),
                        const SizedBox(width: 4),
                        _dot(t.dateTextColor),
                        const Spacer(),
                        if (selected)
                          Container(
                            width: 18,
                            height: 18,
                            decoration: BoxDecoration(
                              color: t.accentColor,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.check, size: 12, color: Colors.black),
                          ),
                      ],
                    ),
                    const Spacer(),
                    // Theme name
                    Text(
                      t.name,
                      style: TextStyle(
                        color: t.textColor,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.1,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 1),
                    // Group badge
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                      decoration: BoxDecoration(
                        color: t.accentColor.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        t.group.toUpperCase(),
                        style: TextStyle(
                          color: t.accentColor,
                          fontSize: 8,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.8,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
    );
  }

  Widget _dot(Color color) {
    return Container(
      width: 8,
      height: 8,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }
}
