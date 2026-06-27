/// settings_page.dart
/// Settings panel: PIN gate → sidebar navigation → 6 tabs.
/// Discard / Save Changes footer. Async cloud push on save.

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/app_config.dart';
import '../../core/storage_service.dart';
import '../../core/supabase_sync_service.dart';
import '../../providers/app_provider.dart';
import '../../l10n/app_localizations.dart';
import 'tab_general.dart';
import 'tab_location.dart';
import 'tab_prayer_offsets.dart';
import 'tab_slideshow_jumuah.dart';
import 'tab_system_prefs.dart';
import 'tab_ticker.dart';
import 'tab_cloud_account.dart';
import 'tab_media_library.dart';
import 'tab_theme.dart';
import 'settings_helpers.dart';

// ═══════════════════════════════════════════════════════════════
// Settings Page
// ═══════════════════════════════════════════════════════════════

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  static DateTime? lastAuthTime;

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  // PIN gate
  bool _authenticated = false;

  // Working copy of config (discarded if user closes without saving)
  late AppConfig _draft;

  String _activeTab = 'general';

  @override
  void initState() {
    super.initState();
    _draft = context.read<AppProvider>().config;
    // Apply stored admin theme preference before first build
    SettingsTheme.isDark = !_draft.meta.adminLightTheme;

    // Skip PIN gate if PIN is disabled (default), or if recently authenticated
    if (!StorageService.isPinEnabled()) {
      _authenticated = true;
    } else if (SettingsPage.lastAuthTime != null &&
        DateTime.now().difference(SettingsPage.lastAuthTime!).inMinutes < 5) {
      _authenticated = true;
    }
  }

  List<(String, String, IconData)> _buildTabs(AppLocalizations? l10n) => [
    ('general', l10n?.tabGeneral ?? 'General Info', Icons.mosque_outlined),
    ('location', l10n?.tabLocation ?? 'Location & Calc', Icons.location_on_outlined),
    ('prayers', l10n?.tabPrayerOffsets ?? 'Prayer Offsets', Icons.schedule_outlined),
    ('slideshow_jumuah', l10n?.tabSlideshow ?? "Slideshow & Jumu'ah", Icons.slideshow_outlined),
    ('ticker', l10n?.tabTicker ?? 'Scrolling Ticker', Icons.text_fields_outlined),
    ('themes', '🎨 Themes', Icons.palette_outlined),
    ('system', l10n?.tabSystemPrefs ?? 'System Preferences', Icons.settings_outlined),
    ('media', '🖼️ ${l10n?.tabMediaLibrary ?? 'Media Library'}', Icons.photo_library_outlined),
    ('account', '☁️ ${l10n?.tabCloud ?? 'Cloud & Sync'}', Icons.cloud_outlined),
  ];

  Future<void> _saveAndClose() async {
    await context.read<AppProvider>().saveConfig(_draft);
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    if (!_authenticated) {
      return _PinGateScreen(
        onAuthenticated: () {
          SettingsPage.lastAuthTime = DateTime.now();
          setState(() => _authenticated = true);
        },
        onCancel: () => Navigator.of(context).pop(),
      );
    }

    return LayoutBuilder(builder: (context, constraints) {
      final isMobile = constraints.maxWidth < 800;

      return Scaffold(
        backgroundColor: SettingsTheme.bgPrimary,
        appBar: isMobile
            ? AppBar(
                backgroundColor: SettingsTheme.bgSurface,
                title: Text('Settings Panel', style: TextStyle(fontSize: 18, color: SettingsTheme.textPrimary, fontWeight: FontWeight.bold)),
                iconTheme: IconThemeData(color: SettingsTheme.textPrimary),
                elevation: 0,
                bottom: PreferredSize(
                  preferredSize: const Size.fromHeight(1),
                  child: Divider(color: SettingsTheme.borderSubtle, height: 1),
                ),
                actions: [
                  IconButton(
                    icon: Icon(Icons.close, color: SettingsTheme.textSecondary),
                    onPressed: () => Navigator.of(context).pop(),
                    tooltip: 'Discard & Close',
                  ),
                ],
              )
            : null,
        drawer: isMobile ? _buildDrawer() : null,
        body: Column(
          children: [
            // Header (Desktop/Tablet only)
            if (!isMobile) _buildHeader(),

            // Body: sidebar + content
            Expanded(
              child: Row(
                children: [
                  if (!isMobile) _buildSidebar(),
                  if (!isMobile) VerticalDivider(color: SettingsTheme.borderSubtle, width: 1),
                  Expanded(child: _buildTabContent()),
                ],
              ),
            ),

            // Footer
            _buildFooter(),
          ],
        ),
      );
    });
  }

  Widget _buildHeader() {
    final provider = context.watch<AppProvider>();
    final isLinked = provider.config.profile.tenantId != null &&
        provider.config.profile.tenantId!.isNotEmpty;
    final displayName = (provider.config.meta.linkedUsername != null &&
            provider.config.meta.linkedUsername!.isNotEmpty)
        ? provider.config.meta.linkedUsername!
        : (provider.config.profile.name ?? 'Admin');

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      decoration: BoxDecoration(
        color: SettingsTheme.bgSurface,
        border: Border(bottom: BorderSide(color: SettingsTheme.borderSubtle)),
      ),
      child: Row(
        children: [
          const Text('🛠️', style: TextStyle(fontSize: 20)),
          const SizedBox(width: 10),
          Text(
            'Settings Panel',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: SettingsTheme.textPrimary,
            ),
          ),
          const Spacer(),
          // Light/Dark theme toggle
          Tooltip(
            message: SettingsTheme.isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme',
            child: IconButton(
              icon: Icon(
                SettingsTheme.isDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined,
                color: SettingsTheme.textSecondary,
                size: 20,
              ),
              onPressed: () {
                setState(() {
                  SettingsTheme.isDark = !SettingsTheme.isDark;
                  _draft = _draft.copyWith(
                    meta: _draft.meta.copyWith(adminLightTheme: !SettingsTheme.isDark),
                  );
                });
              },
            ),
          ),
          const SizedBox(width: 4),
          if (isLinked) ...[
            Icon(Icons.account_circle, color: SettingsTheme.accentTeal, size: 20),
            const SizedBox(width: 8),
            Text(
              displayName,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: SettingsTheme.accentTeal),
            ),
            const SizedBox(width: 16),
            TextButton.icon(
              icon: const Icon(Icons.logout, size: 16, color: SettingsTheme.accentRed),
              label: const Text('Logout', style: TextStyle(color: SettingsTheme.accentRed, fontSize: 13)),
              onPressed: () async {
                await SupabaseSyncService.disconnectAccount();
                if (mounted) {
                  await context.read<AppProvider>().loadConfig();
                  setState(() {
                    _draft = context.read<AppProvider>().config;
                  });
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Logged out successfully')),
                  );
                }
              },
            ),
            const SizedBox(width: 24),
          ],
          IconButton(
            icon: Icon(Icons.close, color: SettingsTheme.textSecondary),
            onPressed: () => Navigator.of(context).pop(),
            tooltip: 'Discard & Close',
          ),
        ],
      ),
    );
  }

  Widget _buildSidebar() {
    final l10n = AppLocalizations.of(context);
    final tabs = _buildTabs(l10n);
    return SizedBox(
      width: 200,
      child: ColoredBox(
        color: SettingsTheme.bgSurface,
        child: ListView.builder(
          itemCount: tabs.length,
          itemBuilder: (_, i) {
            final (key, label, icon) = tabs[i];
            final isActive = _activeTab == key;
            return Container(
              decoration: BoxDecoration(
                color: isActive
                    ? SettingsTheme.accentTeal.withOpacity(0.12)
                    : Colors.transparent,
                border: Border(
                  left: BorderSide(
                    color: isActive
                        ? SettingsTheme.accentTeal
                        : Colors.transparent,
                    width: 3,
                  ),
                ),
              ),
              child: Material(
                color: Colors.transparent,
                child: ListTile(
                  leading: Icon(icon,
                      size: 18,
                      color: isActive
                          ? SettingsTheme.accentTeal
                          : SettingsTheme.textSecondary),
                  title: Text(
                    label,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                      color: isActive
                          ? SettingsTheme.textPrimary
                          : SettingsTheme.textSecondary,
                    ),
                  ),
                  onTap: () => setState(() => _activeTab = key),
                  dense: true,
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildDrawer() {
    final provider = context.watch<AppProvider>();
    final isLinked = provider.config.profile.tenantId != null &&
        provider.config.profile.tenantId!.isNotEmpty;
    final displayName = (provider.config.meta.linkedUsername != null &&
            provider.config.meta.linkedUsername!.isNotEmpty)
        ? provider.config.meta.linkedUsername!
        : (provider.config.profile.name ?? 'Admin');

    return Drawer(
      backgroundColor: SettingsTheme.bgSurface,
      child: SafeArea(
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              alignment: Alignment.centerLeft,
              child: Text('Settings', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: SettingsTheme.textPrimary)),
            ),
            if (isLinked) ...[
              Divider(color: SettingsTheme.borderSubtle, height: 1),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                color: SettingsTheme.bgElevated,
                child: Row(
                  children: [
                    const Icon(Icons.account_circle, color: SettingsTheme.accentTeal, size: 24),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            displayName,
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: SettingsTheme.accentTeal),
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            'Connected',
                            style: TextStyle(fontSize: 12, color: SettingsTheme.textSecondary),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.logout, size: 20, color: SettingsTheme.accentRed),
                      tooltip: 'Logout',
                      onPressed: () async {
                        await SupabaseSyncService.disconnectAccount();
                        if (mounted) {
                          await context.read<AppProvider>().loadConfig();
                          setState(() {
                            _draft = context.read<AppProvider>().config;
                          });
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Logged out successfully')),
                          );
                        }
                      },
                    ),
                  ],
                ),
              ),
            ],
            Divider(color: SettingsTheme.borderSubtle, height: 1),
            Expanded(
              child: Builder(builder: (ctx) {
                final l10n = AppLocalizations.of(ctx);
                final tabs = _buildTabs(l10n);
                return ListView.builder(
                itemCount: tabs.length,
                itemBuilder: (_, i) {
                  final (key, label, icon) = tabs[i];
                  final isActive = _activeTab == key;
                  return Material(
                    color: Colors.transparent,
                    child: ListTile(
                      leading: Icon(icon, color: isActive ? SettingsTheme.accentTeal : SettingsTheme.textSecondary),
                      title: Text(label, style: TextStyle(color: isActive ? SettingsTheme.textPrimary : SettingsTheme.textSecondary, fontWeight: isActive ? FontWeight.w700 : FontWeight.w500)),
                      selected: isActive,
                      selectedTileColor: SettingsTheme.accentTeal.withOpacity(0.12),
                      onTap: () {
                        setState(() => _activeTab = key);
                        Navigator.of(context).pop(); // close drawer
                      },
                    ),
                  );
                },
              );
              }),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTabContent() {
    final provider = context.watch<AppProvider>();
    return switch (_activeTab) {
      'general' => TabGeneral(
          profile: _draft.profile,
          onChanged: (p) => setState(() => _draft = _draft.copyWith(profile: p)),
        ),
      'location' => TabLocation(
          profile: _draft.profile,
          onChanged: (p) => setState(() => _draft = _draft.copyWith(profile: p)),
        ),
      'prayers' => TabPrayerOffsets(
          adjustments: _draft.adjustments,
          onChanged: (a) => setState(() => _draft = _draft.copyWith(adjustments: a)),
        ),
      'slideshow_jumuah' => TabSlideshowJumuah(
          slideshow: _draft.slideshow,
          jumuah: _draft.jumuah,
          onSlideshowChanged: (s) => setState(() => _draft = _draft.copyWith(slideshow: s)),
          onJumuahChanged: (j) => setState(() => _draft = _draft.copyWith(jumuah: j)),
        ),
      'ticker' => TabTicker(
          ticker: _draft.ticker,
          onChanged: (t) => setState(() => _draft = _draft.copyWith(ticker: t)),
        ),
      'themes' => TabTheme(
          meta: _draft.meta,
          onMetaChanged: (m) => setState(() => _draft = _draft.copyWith(meta: m)),
        ),
      'system' => TabSystemPrefs(
          features: _draft.features,
          meta: _draft.meta,
          onChanged: (f) => setState(() => _draft = _draft.copyWith(features: f)),
          onMetaChanged: (m) => setState(() => _draft = _draft.copyWith(meta: m)),
        ),
      'media' => const TabMediaLibrary(),
      'account' => TabCloudAccount(
          profile: _draft.profile,
          meta: _draft.meta,
          syncStatus: provider.syncStatus,
          onProfileChanged: (p) => setState(() => _draft = _draft.copyWith(profile: p)),
          onMetaChanged: (m) => setState(() => _draft = _draft.copyWith(meta: m)),
          onConfigRefreshed: () => setState(() {
            _draft = context.read<AppProvider>().config;
          }),
        ),
      _ => const SizedBox.shrink(),
    };
  }

  Widget _buildFooter() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
      decoration: BoxDecoration(
        color: SettingsTheme.bgSurface,
        border: Border(top: BorderSide(color: SettingsTheme.borderSubtle)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          OutlinedButton(
            onPressed: () => Navigator.of(context).pop(),
            style: SettingsTheme.outlineButtonStyle,
            child: const Text('Discard'),
          ),
          const SizedBox(width: 12),
          ElevatedButton(
            onPressed: _saveAndClose,
            style: SettingsTheme.primaryButtonStyle,
            child: const Text('Save Changes'),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// PIN Gate Screen
// ═══════════════════════════════════════════════════════════════

class _PinGateScreen extends StatefulWidget {
  final VoidCallback onAuthenticated;
  final VoidCallback onCancel;

  const _PinGateScreen({
    required this.onAuthenticated,
    required this.onCancel,
  });

  @override
  State<_PinGateScreen> createState() => _PinGateScreenState();
}

class _PinGateScreenState extends State<_PinGateScreen> {
  String _input = '';
  bool _error = false;

  void _keyPress(String key) {
    setState(() {
      _error = false;
      if (key == 'clear') {
        _input = '';
      } else if (key == 'back') {
        if (_input.isNotEmpty) _input = _input.substring(0, _input.length - 1);
      } else {
        if (_input.length < 8) _input += key;
      }
    });
  }

  void _submit() {
    if (StorageService.verifyPin(_input)) {
      widget.onAuthenticated();
    } else {
      setState(() { _error = true; _input = ''; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final mediaQuery = MediaQuery.of(context);
    final isSmallHeight = mediaQuery.size.height < 600;
    final isVerySmallHeight = mediaQuery.size.height < 450;
    final isLandscape = mediaQuery.orientation == Orientation.landscape;

    // Expand width slightly in landscape to give keys more breathing room horizontally
    final containerWidth = isLandscape ? 440.0 : 360.0;

    return Scaffold(
      backgroundColor: SettingsTheme.bgPrimary,
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
          child: Container(
            width: containerWidth,
            padding: EdgeInsets.all(isSmallHeight ? 20 : 32),
            decoration: BoxDecoration(
              color: SettingsTheme.bgSurface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: SettingsTheme.borderSubtle),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.4),
                  blurRadius: 32,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (!isVerySmallHeight) ...[
                  const Text('🔐', style: TextStyle(fontSize: 48)),
                  const SizedBox(height: 16),
                ],
                Text(
                  'Local Admin Settings',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: SettingsTheme.textPrimary,
                  ),
                ),
                SizedBox(height: isSmallHeight ? 4 : 6),
                Text(
                  'Enter your Local Admin PIN to access settings.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13, color: SettingsTheme.textSecondary),
                ),
                SizedBox(height: isSmallHeight ? 16 : 24),

                // PIN display
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: SettingsTheme.bgElevated,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: _error
                          ? SettingsTheme.accentRed
                          : SettingsTheme.borderSubtle,
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(8, (i) {
                      final filled = i < _input.length;
                      return Container(
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: filled
                              ? SettingsTheme.accentTeal
                              : SettingsTheme.borderSubtle,
                        ),
                      );
                    }),
                  ),
                ),

                if (_error) ...[
                  const SizedBox(height: 8),
                  const Text('Incorrect PIN. Try again.',
                      style: TextStyle(color: SettingsTheme.accentRed, fontSize: 13)),
                ],

                SizedBox(height: isSmallHeight ? 16 : 20),

                // Numeric keypad
                GridView(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    mainAxisSpacing: 8,
                    crossAxisSpacing: 8,
                    mainAxisExtent: isSmallHeight ? 48 : 56, // Fixed height for keys
                  ),
                  children: [
                    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => _keyButton(n.toString())),
                    _keyButton('clear', label: 'Clear', special: true),
                    _keyButton('0'),
                    _keyButton('back', label: '⌫', special: true),
                  ],
                ),

                SizedBox(height: isSmallHeight ? 16 : 20),

                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: widget.onCancel,
                        style: SettingsTheme.outlineButtonStyle,
                        child: const Text('Cancel'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: _input.isNotEmpty ? _submit : null,
                        style: SettingsTheme.primaryButtonStyle,
                        child: const Text('Enter'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _keyButton(String key, {String? label, bool special = false}) {
    return ElevatedButton(
      onPressed: () => key == 'back' || key == 'clear' || key == '0'
          ? _keyPress(key)
          : _keyPress(key),
      style: ElevatedButton.styleFrom(
        backgroundColor:
            special ? SettingsTheme.bgElevated : SettingsTheme.bgSurface,
        foregroundColor:
            special ? SettingsTheme.textSecondary : SettingsTheme.textPrimary,
        side: BorderSide(color: SettingsTheme.borderSubtle),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        padding: EdgeInsets.zero,
      ),
      child: Text(
        label ?? key,
        style: TextStyle(
          fontSize: special ? 13 : 18,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
