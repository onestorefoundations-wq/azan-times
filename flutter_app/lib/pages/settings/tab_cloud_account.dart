/// tab_cloud_account.dart
/// Cloud Account & Sync settings tab.
/// Shows linked account details, or Link/Register forms when disconnected.

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/app_config.dart';
import '../../core/supabase_sync_service.dart';
import '../../providers/app_provider.dart';
import '../../widgets/sync_status_chip.dart';
import 'settings_helpers.dart';

class TabCloudAccount extends StatefulWidget {
  final MasjidProfile profile;
  final SyncMeta meta;
  final SyncStatus syncStatus;
  final ValueChanged<MasjidProfile> onProfileChanged;
  final ValueChanged<SyncMeta> onMetaChanged;
  /// Called after a successful login/register so SettingsPage reloads the
  /// entire draft from the freshly synced cloud config (slides, ticker, etc.).
  final VoidCallback? onConfigRefreshed;

  const TabCloudAccount({
    super.key,
    required this.profile,
    required this.meta,
    required this.syncStatus,
    required this.onProfileChanged,
    required this.onMetaChanged,
    this.onConfigRefreshed,
  });

  @override
  State<TabCloudAccount> createState() => _TabCloudAccountState();
}

class _TabCloudAccountState extends State<TabCloudAccount> {
  String _mode = 'link'; // 'link' | 'register'

  // Link form
  final _loginIdCtrl = TextEditingController();
  final _loginPasswordCtrl = TextEditingController();

  // Register form
  final _regMosqueNameCtrl = TextEditingController();
  final _regUsernameCtrl = TextEditingController();
  final _regMobileCtrl = TextEditingController();
  final _regEmailCtrl = TextEditingController();
  final _regPasswordCtrl = TextEditingController();

  bool _loading = false;
  String? _error;
  String? _success;

  @override
  void dispose() {
    _loginIdCtrl.dispose();
    _loginPasswordCtrl.dispose();
    _regMosqueNameCtrl.dispose();
    _regUsernameCtrl.dispose();
    _regMobileCtrl.dispose();
    _regEmailCtrl.dispose();
    _regPasswordCtrl.dispose();
    super.dispose();
  }

  Future<void> _linkAccount() async {
    final id = _loginIdCtrl.text.trim();
    final pw = _loginPasswordCtrl.text;
    if (id.isEmpty || pw.isEmpty) {
      setState(() => _error = 'Username / Email / Mobile and Password are required.');
      return;
    }
    setState(() { _loading = true; _error = null; _success = null; });
    try {
      final res = await SupabaseSyncService.linkAccount(id, pw);
      if (!mounted) return;
      // Reload config in provider
      await context.read<AppProvider>().loadConfig();
      setState(() {
        _success = '✅ Successfully linked to ${res.mosqueName}!';
        _loginIdCtrl.clear();
        _loginPasswordCtrl.clear();
      });
      // Restart sync with new tenant
      await SupabaseSyncService.startSync(
        onStatusChange: (s) {},
        onConfigUpdated: () => context.read<AppProvider>().loadConfig(),
      );
      // Reload entire draft from freshly synced cloud config (slides, ticker, etc.)
      widget.onConfigRefreshed?.call();
    } catch (e) {
      setState(() => _error = '❌ ${e.toString().replaceAll('Exception:', '').trim()}');
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _registerAccount() async {
    final mosque = _regMosqueNameCtrl.text.trim();
    final username = _regUsernameCtrl.text.trim();
    final pw = _regPasswordCtrl.text;
    if (mosque.isEmpty || username.isEmpty || pw.isEmpty) {
      setState(() => _error = 'Mosque Name, Username, and Password are required.');
      return;
    }
    setState(() { _loading = true; _error = null; _success = null; });
    try {
      final res = await SupabaseSyncService.registerAccount(
        mosqueName: mosque,
        username: username,
        password: pw,
        mobile: _regMobileCtrl.text.trim().isEmpty ? null : _regMobileCtrl.text.trim(),
        email: _regEmailCtrl.text.trim().isEmpty ? null : _regEmailCtrl.text.trim(),
      );
      if (!mounted) return;
      // Reload entire draft from freshly registered/synced config
      await context.read<AppProvider>().loadConfig();
      widget.onConfigRefreshed?.call();

      setState(() {
        _success = '✅ Account created and linked to ${res.mosqueName}!';
        _regMosqueNameCtrl.clear();
        _regUsernameCtrl.clear();
        _regMobileCtrl.clear();
        _regEmailCtrl.clear();
        _regPasswordCtrl.clear();
      });
    } catch (e) {
      setState(() => _error = '❌ ${e.toString().replaceAll('Exception:', '').trim()}');
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _disconnect() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: SettingsTheme.bgSurface,
        title: Text('Disconnect from Cloud?',
            style: TextStyle(color: SettingsTheme.textPrimary)),
        content: Text(
          'This display will stop syncing. Local settings will remain intact.',
          style: TextStyle(color: SettingsTheme.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('Cancel', style: TextStyle(color: SettingsTheme.textSecondary)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Disconnect', style: TextStyle(color: SettingsTheme.accentRed)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() { _loading = true; _error = null; });
    try {
      await SupabaseSyncService.disconnectAccount();
      if (!mounted) return;
      // Reload config from storage so we get the cleared (disconnected) state
      final provider = context.read<AppProvider>();
      await provider.loadConfig();
      await provider.onAccountChanged();
      if (!mounted) return;
      final freshConfig = provider.config;
      widget.onProfileChanged(freshConfig.profile);
      widget.onMetaChanged(freshConfig.meta);
      setState(() => _success = '✅ Successfully disconnected from cloud sync.');
    } catch (e) {
      setState(() => _error = '❌ Failed to disconnect: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLinked = widget.profile.tenantId != null &&
        widget.profile.tenantId!.isNotEmpty;

    return SettingsTabScaffold(
      title: 'Cloud Account & Sync',
      children: [
        Text(
          'Link this display to a cloud account or create a new mosque account to sync settings across all displays.',
          style: TextStyle(fontSize: 13, color: SettingsTheme.textSecondary),
        ),
        const SizedBox(height: 16),

        // Status messages
        if (_error != null)
          _statusBanner(_error!, isError: true),
        if (_success != null)
          _statusBanner(_success!, isError: false),

        if (isLinked)
          _buildConnectedState()
        else
          _buildDisconnectedState(),
      ],
    );
  }

  Widget _buildConnectedState() {
    final meta = widget.meta;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Connection card
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: SettingsTheme.bgElevated,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: SettingsTheme.borderSubtle),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Text('🟢', style: TextStyle(fontSize: 24)),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Connected to Cloud Sync',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700,
                              color: SettingsTheme.accentTeal)), // accentTeal is a const Color
                      const SizedBox(height: 2),
                      SyncStatusChip(status: widget.syncStatus, compact: true),
                    ],
                  ),
                ],
              ),
              Divider(color: SettingsTheme.borderSubtle, height: 24),
              _infoRow('Mosque Name', meta.linkedMosqueName ?? widget.profile.name),
              _infoRow('Admin Username', meta.linkedUsername ?? 'N/A'),
              _infoRow('Admin Email', meta.linkedEmail ?? 'Not configured'),
              _infoRow('Admin Mobile', meta.linkedMobile ?? 'Not configured'),
              _infoRow('Last Synced', meta.lastSuccessfulSync != null
                  ? DateTime.fromMillisecondsSinceEpoch(meta.lastSuccessfulSync!).toLocal().toString().split('.').first
                  : 'Never'),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // Disconnect button
        OutlinedButton.icon(
          onPressed: _loading ? null : _disconnect,
          icon: _loading
              ? const SizedBox(width: 14, height: 14,
                  child: CircularProgressIndicator(strokeWidth: 2))
              : const Icon(Icons.logout, size: 16),
          label: Text(_loading ? 'Disconnecting...' : '🚪 Disconnect / Sign Out'),
          style: OutlinedButton.styleFrom(
            foregroundColor: SettingsTheme.accentRed,
            side: const BorderSide(color: SettingsTheme.accentRed),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          ),
        ),
      ],
    );
  }

  Widget _buildDisconnectedState() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Mode tabs
        Row(
          children: [
            _modeTab('link', '🔗 Link Existing Account'),
            _modeTab('register', '📝 Create New Account'),
          ],
        ),
        const SizedBox(height: 24),

        if (_mode == 'link') _buildLinkForm() else _buildRegisterForm(),
      ],
    );
  }

  Widget _modeTab(String mode, String label) {
    final isActive = _mode == mode;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() {
          _mode = mode;
          _error = null;
          _success = null;
        }),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: isActive ? SettingsTheme.accentTeal : Colors.transparent,
                width: 2.5,
              ),
            ),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: isActive ? SettingsTheme.accentTeal : SettingsTheme.textSecondary,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLinkForm() {
    return Column(
      children: [
        SettingsFormField(
          label: 'Username / Email / Mobile Number',
          child: TextField(
            controller: _loginIdCtrl,
            style: SettingsTheme.inputTextStyle,
            decoration: SettingsTheme.inputDecoration('e.g. admin@mosque.com or 07700900000'),
          ),
        ),
        SettingsFormField(
          label: 'Password',
          child: TextField(
            controller: _loginPasswordCtrl,
            obscureText: true,
            style: SettingsTheme.inputTextStyle,
            decoration: SettingsTheme.inputDecoration('••••••••'),
          ),
        ),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _loading ? null : _linkAccount,
            style: SettingsTheme.primaryButtonStyle,
            child: Text(_loading ? 'Linking...' : 'Link Account & Sync Settings'),
          ),
        ),
      ],
    );
  }

  Widget _buildRegisterForm() {
    return Column(
      children: [
        SettingsFormField(
          label: 'Mosque / Masjid Name',
          child: TextField(
            controller: _regMosqueNameCtrl,
            style: SettingsTheme.inputTextStyle,
            decoration: SettingsTheme.inputDecoration('e.g. Central Masjid London'),
          ),
        ),
        SettingsFormField(
          label: 'Admin Username',
          child: TextField(
            controller: _regUsernameCtrl,
            style: SettingsTheme.inputTextStyle,
            decoration: SettingsTheme.inputDecoration('e.g. centraladmin'),
          ),
        ),
        SettingsFormRow(
          left: SettingsFormField(
            label: 'Mobile Number (Optional)',
            child: TextField(
              controller: _regMobileCtrl,
              keyboardType: TextInputType.phone,
              style: SettingsTheme.inputTextStyle,
              decoration: SettingsTheme.inputDecoration('e.g. +447700900000'),
            ),
          ),
          right: SettingsFormField(
            label: 'Email Address (Optional)',
            child: TextField(
              controller: _regEmailCtrl,
              keyboardType: TextInputType.emailAddress,
              style: SettingsTheme.inputTextStyle,
              decoration: SettingsTheme.inputDecoration('e.g. admin@masjid.com'),
            ),
          ),
        ),
        SettingsFormField(
          label: 'Password',
          helpText: 'Minimum 6 characters recommended.',
          child: TextField(
            controller: _regPasswordCtrl,
            obscureText: true,
            style: SettingsTheme.inputTextStyle,
            decoration: SettingsTheme.inputDecoration('Minimum 6 characters recommended'),
          ),
        ),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _loading ? null : _registerAccount,
            style: SettingsTheme.primaryButtonStyle,
            child: Text(_loading ? 'Creating Account...' : 'Create Account & Link Display'),
          ),
        ),
      ],
    );
  }

  Widget _statusBanner(String msg, {required bool isError}) {
    final color = isError ? SettingsTheme.accentRed : SettingsTheme.accentTeal;
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.4)),
      ),
      child: Text(msg, style: TextStyle(fontSize: 13, color: color, fontWeight: FontWeight.w600)),
    );
  }

  Widget _infoRow(String label, String value, {bool mono = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 140,
            child: Text(label,
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: SettingsTheme.textSecondary)),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 13,
                color: mono ? SettingsTheme.accentGold : SettingsTheme.textPrimary,
                fontFamily: mono ? 'monospace' : null,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
