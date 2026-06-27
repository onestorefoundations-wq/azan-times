/// tab_media_library.dart
/// Dedicated media library tab — shows all images (backgrounds + slides)
/// for the linked account, with upload, delete, set-as-background, and status.
///
/// Sync status badges:
///   ⏳ Pending upload — imported from device, not yet synced to cloud
///   ⬆️ Uploading...  — currently being synced
///   📱+☁️ Synced     — on this device AND cloud
///   ☁️  Cloud only   — on cloud, not yet downloaded to this device
///
/// Changes take effect immediately (no draft system).

import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/media_file.dart';
import '../../core/media_library_service.dart';
import '../../providers/app_provider.dart';
import 'settings_helpers.dart';

// Tracks in-progress downloads per file id (0.0–1.0)
final Map<String, double> _downloadProgress = {};

class TabMediaLibrary extends StatefulWidget {
  const TabMediaLibrary({super.key});

  @override
  State<TabMediaLibrary> createState() => _TabMediaLibraryState();
}

class _TabMediaLibraryState extends State<TabMediaLibrary> {
  bool _uploading = false;
  String? _uploadingCategory;
  String? _error;
  bool _loading = false;

  // tabs: background_landscape | background_portrait | slide_landscape | slide_portrait
  String _activeCategory = 'background_landscape';

  Future<void> _refresh() async {
    setState(() => _loading = true);
    await context.read<AppProvider>().refreshMediaLibrary();
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _upload(String category) async {
    setState(() { _uploading = true; _uploadingCategory = category; _error = null; });
    try {
      final provider = context.read<AppProvider>();
      final tenantId = provider.config.profile.tenantId;
      if (tenantId == null || tenantId.isEmpty) {
        setState(() => _error = 'Not linked to an account. Please link in Cloud & Sync tab first.');
        return;
      }

      final result = await FilePicker.pickFiles(
        type: FileType.image,
        withData: true,
        allowMultiple: true,
      );
      if (result == null || result.files.isEmpty) return;

      for (final file in result.files) {
        final bytes = file.bytes;
        if (bytes == null) continue;
        await MediaLibraryService.uploadFile(
          tenantId: tenantId,
          bytes: bytes,
          filename: file.name,
          category: category,
          deviceId: provider.config.meta.deviceId,
        );
      }

      await provider.refreshMediaLibrary();
    } catch (e) {
      if (mounted) setState(() => _error = 'Upload failed: $e');
    } finally {
      if (mounted) setState(() { _uploading = false; _uploadingCategory = null; });
    }
  }

  /// Import from local storage / USB — no internet needed.
  Future<void> _importLocal(String category) async {
    if (kIsWeb) return;
    setState(() { _error = null; });
    try {
      await context.read<AppProvider>().importLocalFiles(category);
    } catch (e) {
      if (mounted) setState(() => _error = 'Import failed: $e');
    }
  }

  Future<void> _setActiveBackground(MediaFile file) async {
    final provider = context.read<AppProvider>();
    if (file.isPendingUpload) {
      await provider.setPendingFileAsBackground(file.id);
      return;
    }
    final tenantId = provider.config.profile.tenantId;
    if (tenantId == null) return;
    try {
      await MediaLibraryService.setActiveBackground(tenantId, file.id);
      await provider.refreshMediaLibrary();
    } catch (e) {
      if (mounted) setState(() => _error = 'Failed: $e');
    }
  }

  Future<void> _clearBackground(String category) async {
    final provider = context.read<AppProvider>();
    final tenantId = provider.config.profile.tenantId;
    if (tenantId == null) return;
    try {
      await MediaLibraryService.clearActiveBackgroundForCategory(tenantId, category);
      await provider.refreshMediaLibrary();
    } catch (e) {
      if (mounted) setState(() => _error = 'Failed: $e');
    }
  }

  Future<void> _delete(MediaFile file) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: SettingsTheme.bgSurface,
        title: Text('Delete Image', style: TextStyle(color: SettingsTheme.textPrimary)),
        content: Text(
          'Delete "${file.filename}"? This cannot be undone.',
          style: TextStyle(color: SettingsTheme.textSecondary),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: SettingsTheme.accentRed),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    final provider = context.read<AppProvider>();
    try {
      if (file.isPendingUpload) {
        await provider.deletePendingFile(file.id);
      } else {
        await MediaLibraryService.deleteFile(provider.config.profile.tenantId!, file.id);
        await provider.evictFromCache(file.id);
        await provider.refreshMediaLibrary();
      }
    } catch (e) {
      if (mounted) setState(() => _error = 'Delete failed: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AppProvider>();
    final isLinked = provider.isLinked;
    final allFiles = provider.allMediaFiles; // cloud + pending
    final tenantId = provider.config.profile.tenantId ?? '';

    final landscapeSlides = allFiles.where((f) => f.category == 'slide_landscape').toList();
    final portraitSlides = allFiles.where((f) => f.category == 'slide_portrait').toList();

    return SettingsTabScaffold(
      title: 'Media Library',
      children: [
        // Not linked warning — still allow local import even when not linked
        if (!isLinked)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF1A2D40),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFF0EA5E9).withOpacity(0.4)),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline, color: Color(0xFF0EA5E9), size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    kIsWeb
                        ? 'Link your account in the Cloud & Sync tab to use the media library.'
                        : 'You can import images from local storage now. '
                          'Link an account to sync to the cloud and all displays.',
                    style: TextStyle(color: SettingsTheme.textSecondary, fontSize: 13),
                  ),
                ),
              ],
            ),
          ),

        if (isLinked || !kIsWeb) ...[
          // Status bar
          if (isLinked)
            Row(
              children: [
                const Icon(Icons.cloud_done, color: SettingsTheme.accentTeal, size: 16),
                const SizedBox(width: 6),
                Text(
                  'Synced to account: $tenantId',
                  style: TextStyle(fontSize: 12, color: SettingsTheme.textSecondary),
                ),
                const Spacer(),
                if (provider.isUploadingPending)
                  const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(width: 12, height: 12,
                          child: CircularProgressIndicator(strokeWidth: 1.5, color: Color(0xFFFB923C))),
                      SizedBox(width: 5),
                      Text('Uploading...', style: TextStyle(fontSize: 11, color: Color(0xFFFB923C))),
                      SizedBox(width: 8),
                    ],
                  ),
                if (_loading)
                  const SizedBox(width: 16, height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2, color: SettingsTheme.accentTeal))
                else
                  IconButton(
                    icon: const Icon(Icons.refresh, size: 18),
                    color: SettingsTheme.textSecondary,
                    tooltip: 'Refresh library',
                    onPressed: _refresh,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
              ],
            ),
          const SizedBox(height: 4),

          if (_error != null)
            Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: SettingsTheme.accentRed.withOpacity(0.12),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: SettingsTheme.accentRed.withOpacity(0.3)),
              ),
              child: Row(children: [
                const Icon(Icons.error_outline, color: SettingsTheme.accentRed, size: 16),
                const SizedBox(width: 8),
                Expanded(child: Text(_error!, style: const TextStyle(color: SettingsTheme.accentRed, fontSize: 12))),
                IconButton(icon: const Icon(Icons.close, size: 14), color: SettingsTheme.accentRed,
                    padding: EdgeInsets.zero, constraints: const BoxConstraints(),
                    onPressed: () => setState(() => _error = null)),
              ]),
            ),

          // Pending uploads banner
          if (provider.pendingUploads.isNotEmpty && !provider.isUploadingPending)
            Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFFB923C).withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFFB923C).withOpacity(0.4)),
              ),
              child: Row(children: [
                const Icon(Icons.schedule_send, color: Color(0xFFFB923C), size: 16),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '${provider.pendingUploads.length} file${provider.pendingUploads.length == 1 ? '' : 's'} '
                    'waiting to upload to cloud when internet is available.',
                    style: const TextStyle(color: Color(0xFFFB923C), fontSize: 12),
                  ),
                ),
              ]),
            ),

          // ── Category tabs ───────────────────────────────────────
          Row(children: [
            _catTab('background_landscape', Icons.wallpaper, 'BG\nLandscape',
                allFiles.where((f) => f.category == 'background_landscape').length),
            const SizedBox(width: 5),
            _catTab('background_portrait', Icons.wallpaper_outlined, 'BG\nPortrait',
                allFiles.where((f) => f.category == 'background_portrait').length),
            const SizedBox(width: 5),
            _catTab('slide_landscape', Icons.crop_landscape, 'Slides\nLandscape', landscapeSlides.length),
            const SizedBox(width: 5),
            _catTab('slide_portrait', Icons.crop_portrait, 'Slides\nPortrait', portraitSlides.length),
          ]),
          const SizedBox(height: 10),

          // Category hint
          Text(
            switch (_activeCategory) {
              'background_landscape' => 'Shown as TV background when in landscape (horizontal) orientation.',
              'background_portrait'  => 'Shown as TV background when in portrait (vertical) orientation.',
              'slide_landscape'      => 'Slideshow images for landscape (horizontal) screens.',
              _                      => 'Slideshow images for portrait (vertical) screens.',
            },
            style: TextStyle(fontSize: 11, color: SettingsTheme.textSecondary, fontStyle: FontStyle.italic),
          ),
          const SizedBox(height: 12),

          // ── File grid ──────────────────────────────────────────
          _buildGrid(
            files: allFiles.where((f) => f.category == _activeCategory).toList(),
            category: _activeCategory,
            showSetBackground: _activeCategory.startsWith('background'),
            isUploading: provider.isUploadingPending,
          ),
        ],
      ],
    );
  }

  Widget _catTab(String key, IconData icon, String label, int count) {
    final isActive = _activeCategory == key;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _activeCategory = key),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 6),
          decoration: BoxDecoration(
            color: isActive ? SettingsTheme.accentTeal.withOpacity(0.14) : SettingsTheme.bgElevated,
            border: Border.all(
              color: isActive ? SettingsTheme.accentTeal : SettingsTheme.borderSubtle,
              width: isActive ? 1.5 : 1,
            ),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Column(
            children: [
              Icon(icon, size: 18,
                  color: isActive ? SettingsTheme.accentTeal : SettingsTheme.textSecondary),
              const SizedBox(height: 3),
              Text(label,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: isActive ? SettingsTheme.accentTeal : SettingsTheme.textSecondary)),
              Text('$count file${count == 1 ? '' : 's'}',
                  style: TextStyle(fontSize: 10, color: SettingsTheme.textSecondary)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildGrid({
    required List<MediaFile> files,
    required String category,
    required bool showSetBackground,
    required bool isUploading,
  }) {
    final isUploadingThis = _uploading && _uploadingCategory == category;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Active background strip
        if (showSetBackground) ...[
          _buildActiveBackgroundStrip(category),
          const SizedBox(height: 12),
        ],

        // File grid
        if (files.isEmpty && !isUploadingThis)
          Container(
            height: 120,
            decoration: BoxDecoration(
              color: SettingsTheme.bgElevated,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: SettingsTheme.borderSubtle),
            ),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.photo_library_outlined, color: SettingsTheme.textSecondary, size: 32),
                  const SizedBox(height: 6),
                  Text('No images yet',
                      style: TextStyle(color: SettingsTheme.textSecondary, fontSize: 12)),
                  if (!kIsWeb)
                    Text('Upload from cloud or import from device below',
                        style: TextStyle(color: SettingsTheme.textSecondary, fontSize: 11)),
                ],
              ),
            ),
          )
        else
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: files.map((f) => _fileCard(f, showSetBackground, isUploading)).toList(),
          ),

        const SizedBox(height: 16),

        // ── Upload to Cloud button ─────────────────────────────
        GestureDetector(
          onTap: isUploadingThis ? null : () => _upload(category),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 14),
            decoration: BoxDecoration(
              color: isUploadingThis
                  ? SettingsTheme.bgElevated
                  : SettingsTheme.accentTeal.withOpacity(0.12),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: isUploadingThis
                    ? SettingsTheme.borderSubtle
                    : SettingsTheme.accentTeal.withOpacity(0.5),
              ),
            ),
            child: isUploadingThis
                ? const Center(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(width: 18, height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: SettingsTheme.accentTeal)),
                        SizedBox(width: 10),
                        Text('Uploading…', style: TextStyle(color: SettingsTheme.accentTeal, fontSize: 14)),
                      ],
                    ),
                  )
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.cloud_upload_outlined, color: SettingsTheme.accentTeal, size: 20),
                      const SizedBox(width: 8),
                      Text(
                        kIsWeb ? 'Upload Image(s)' : 'Upload to Cloud',
                        style: const TextStyle(
                            color: SettingsTheme.accentTeal,
                            fontWeight: FontWeight.w600,
                            fontSize: 14),
                      ),
                    ],
                  ),
          ),
        ),

        // ── Import from Device (Android only) ─────────────────
        if (!kIsWeb) ...[
          const SizedBox(height: 8),
          GestureDetector(
            onTap: () => _importLocal(category),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                color: const Color(0xFFFB923C).withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFFB923C).withOpacity(0.45)),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.smartphone_outlined, color: Color(0xFFFB923C), size: 20),
                  SizedBox(width: 8),
                  Text(
                    'Import from Device / USB (No internet)',
                    style: TextStyle(
                        color: Color(0xFFFB923C),
                        fontWeight: FontWeight.w600,
                        fontSize: 14),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Pick images from local storage or USB. '
            'They work immediately on this TV and will auto-upload to cloud when internet returns.',
            style: TextStyle(fontSize: 11, color: SettingsTheme.textSecondary),
            textAlign: TextAlign.center,
          ),
        ],
      ],
    );
  }

  Widget _buildActiveBackgroundStrip(String category) {
    final provider = context.watch<AppProvider>();

    // Check cloud active first, then pending active
    final activeCloud = provider.mediaFiles
        .where((f) => f.category == category && f.isActiveBackground && !f.isDeleted)
        .firstOrNull;
    final activePending = provider.pendingUploads
        .where((f) => f.category == category && f.isActiveBackground)
        .firstOrNull;
    final activeMedia = activeCloud ?? activePending;

    final orientLabel = category == 'background_landscape' ? 'landscape' : 'portrait';

    if (activeMedia == null) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: SettingsTheme.bgElevated,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: SettingsTheme.borderSubtle),
        ),
        child: Row(
          children: [
            const Icon(Icons.tv, size: 16, color: Color(0xFF64748B)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'No $orientLabel background set — tap an image below to activate it',
                style: TextStyle(fontSize: 12, color: SettingsTheme.textSecondary),
              ),
            ),
          ],
        ),
      );
    }

    // Determine thumbnail widget
    Widget thumbnail;
    final localPath = activeMedia.localFilePath;
    if (localPath != null && !kIsWeb && File(localPath).existsSync()) {
      thumbnail = Image.file(File(localPath), width: 64, height: 40, fit: BoxFit.cover);
    } else if (activeMedia.url.startsWith('http')) {
      thumbnail = Image.network(activeMedia.url, width: 64, height: 40, fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Container(
            width: 64, height: 40, color: SettingsTheme.bgElevated,
            child: const Icon(Icons.broken_image, size: 20, color: Color(0xFF475569)),
          ));
    } else {
      thumbnail = Container(width: 64, height: 40, color: SettingsTheme.bgElevated,
          child: const Icon(Icons.image, size: 20, color: Color(0xFF475569)));
    }

    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: SettingsTheme.accentTeal.withOpacity(0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: SettingsTheme.accentTeal.withOpacity(0.4)),
      ),
      child: Row(
        children: [
          ClipRRect(borderRadius: BorderRadius.circular(6), child: thumbnail),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  const Icon(Icons.check_circle, color: SettingsTheme.accentTeal, size: 14),
                  const SizedBox(width: 4),
                  const Text('Active on TV', style: TextStyle(
                      color: SettingsTheme.accentTeal, fontSize: 12, fontWeight: FontWeight.w700)),
                  if (activeMedia.isPendingUpload) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFB923C).withOpacity(0.2),
                        borderRadius: BorderRadius.circular(3),
                      ),
                      child: const Text('⏳ Pending', style: TextStyle(fontSize: 9, color: Color(0xFFFB923C))),
                    ),
                  ],
                ]),
                Text(activeMedia.filename,
                    style: TextStyle(color: SettingsTheme.textSecondary, fontSize: 11),
                    overflow: TextOverflow.ellipsis),
                if (activeMedia.fileSizeLabel.isNotEmpty)
                  Text(activeMedia.fileSizeLabel,
                      style: TextStyle(color: SettingsTheme.textSecondary, fontSize: 10)),
              ],
            ),
          ),
          TextButton(
            onPressed: () => _clearBackground(category),
            child: const Text('Clear', style: TextStyle(color: SettingsTheme.accentRed, fontSize: 12)),
          ),
        ],
      ),
    );
  }

  Widget _fileCard(MediaFile file, bool showSetBg, bool globalUploading) {
    final provider = context.watch<AppProvider>();
    final isActiveBg = file.isActiveBackground;
    final isPending = file.isPendingUpload;
    final isUploadingThisFile = isPending && globalUploading;
    final isLocal = isPending || provider.isFileLocal(file.id);
    final isDownloading = !isPending && _downloadProgress.containsKey(file.id);
    final progress = _downloadProgress[file.id] ?? 0.0;
    final uploadedDate = '${file.uploadedAt.day}/${file.uploadedAt.month}/${file.uploadedAt.year}';

    // Thumbnail widget — use local file for pending, network for cloud
    Widget thumbnailChild;
    final localPath = file.localFilePath;
    if (localPath != null && !kIsWeb && File(localPath).existsSync()) {
      thumbnailChild = Image.file(
        File(localPath),
        height: 90, width: 140, fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => _brokenImage(),
      );
    } else if (file.url.startsWith('http')) {
      thumbnailChild = Image.network(
        file.url,
        height: 90, width: 140, fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => _brokenImage(),
      );
    } else {
      thumbnailChild = _brokenImage();
    }

    return Container(
      width: 140,
      decoration: BoxDecoration(
        color: SettingsTheme.bgElevated,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isPending
              ? const Color(0xFFFB923C).withOpacity(0.5)
              : isActiveBg
                  ? SettingsTheme.accentTeal
                  : SettingsTheme.borderSubtle,
          width: (isActiveBg || isPending) ? 2 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Thumbnail
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(9)),
            child: Stack(
              children: [
                thumbnailChild,

                // ACTIVE badge (top-left)
                if (isActiveBg)
                  Positioned(
                    top: 6, left: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                      decoration: BoxDecoration(
                        color: SettingsTheme.accentTeal,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.tv, size: 11, color: Colors.white),
                          SizedBox(width: 3),
                          Text('ACTIVE', style: TextStyle(fontSize: 9, color: Colors.white, fontWeight: FontWeight.w800)),
                        ],
                      ),
                    ),
                  ),

                // Sync status badge (top-right)
                if (!kIsWeb)
                  Positioned(
                    top: 6, right: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.65),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: isUploadingThisFile
                          ? const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                SizedBox(width: 9, height: 9,
                                    child: CircularProgressIndicator(strokeWidth: 1.5, color: Color(0xFFFB923C))),
                                SizedBox(width: 3),
                                Text('⬆️', style: TextStyle(fontSize: 8)),
                              ],
                            )
                          : isPending
                              ? const Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text('⏳', style: TextStyle(fontSize: 8)),
                                    SizedBox(width: 2),
                                    Text('Pending', style: TextStyle(fontSize: 8, color: Color(0xFFFB923C))),
                                  ],
                                )
                              : isDownloading
                                  ? Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        SizedBox(
                                          width: 9, height: 9,
                                          child: CircularProgressIndicator(
                                            value: progress,
                                            strokeWidth: 1.5,
                                            color: const Color(0xFF38BDF8),
                                          ),
                                        ),
                                        const SizedBox(width: 3),
                                        Text('${(progress * 100).round()}%',
                                            style: const TextStyle(fontSize: 8, color: Color(0xFF38BDF8))),
                                      ],
                                    )
                                  : Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(
                                          isLocal
                                              ? Icons.smartphone
                                              : Icons.cloud_outlined,
                                          size: 9,
                                          color: isLocal ? const Color(0xFF4ADE80) : const Color(0xFF94A3B8),
                                        ),
                                        const SizedBox(width: 2),
                                        Icon(
                                          Icons.cloud_done,
                                          size: 9,
                                          color: isLocal ? const Color(0xFF4ADE80) : SettingsTheme.accentTeal,
                                        ),
                                        const SizedBox(width: 2),
                                        Text(
                                          isLocal ? 'Synced' : 'Cloud',
                                          style: TextStyle(
                                            fontSize: 8,
                                            color: isLocal ? const Color(0xFF4ADE80) : const Color(0xFF94A3B8),
                                          ),
                                        ),
                                      ],
                                    ),
                    ),
                  ),

                // Tap-to-set BG overlay
                if (showSetBg && !isActiveBg)
                  Positioned.fill(
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () => _setActiveBackground(file),
                        borderRadius: BorderRadius.circular(9),
                      ),
                    ),
                  ),
              ],
            ),
          ),

          // Download progress bar (cloud files only)
          if (isDownloading)
            LinearProgressIndicator(
              value: progress,
              backgroundColor: SettingsTheme.bgElevated,
              color: const Color(0xFF38BDF8),
              minHeight: 2,
            ),

          // Info row
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  file.filename,
                  style: TextStyle(color: SettingsTheme.textPrimary, fontSize: 10, fontWeight: FontWeight.w600),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Row(children: [
                  if (isPending) ...[
                    Icon(Icons.schedule_send, size: 10,
                        color: isUploadingThisFile ? const Color(0xFFFB923C) : const Color(0xFFFB923C).withOpacity(0.7)),
                    const SizedBox(width: 3),
                    Text(isUploadingThisFile ? 'Uploading' : 'Device only',
                        style: TextStyle(
                            fontSize: 9,
                            color: const Color(0xFFFB923C).withOpacity(isUploadingThisFile ? 1.0 : 0.7))),
                  ] else ...[
                    Icon(Icons.cloud_done, size: 10, color: SettingsTheme.accentTeal),
                    const SizedBox(width: 3),
                    Text('Online', style: TextStyle(fontSize: 9, color: SettingsTheme.accentTeal)),
                  ],
                  const Spacer(),
                  Text(file.fileSizeLabel,
                      style: TextStyle(fontSize: 9, color: SettingsTheme.textSecondary)),
                ]),
                Text(uploadedDate,
                    style: TextStyle(fontSize: 9, color: SettingsTheme.textSecondary)),
              ],
            ),
          ),

          // Action buttons
          Padding(
            padding: const EdgeInsets.fromLTRB(6, 0, 6, 8),
            child: Column(
              children: [
                Row(
                  children: [
                    if (showSetBg)
                      Expanded(
                        child: GestureDetector(
                          onTap: isPending
                              ? () => _setActiveBackground(file)
                              : isActiveBg
                                  ? () => _clearBackground(file.category)
                                  : () => _setActiveBackground(file),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 5),
                            decoration: BoxDecoration(
                              color: isActiveBg
                                  ? const Color(0xFF0F2A1E)
                                  : SettingsTheme.accentTeal.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(5),
                              border: Border.all(
                                  color: isActiveBg
                                      ? SettingsTheme.accentTeal.withOpacity(0.5)
                                      : SettingsTheme.accentTeal.withOpacity(0.3)),
                            ),
                            child: Text(
                              isActiveBg ? 'Clear' : 'Set BG',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: SettingsTheme.accentTeal,
                              ),
                            ),
                          ),
                        ),
                      ),
                    if (showSetBg) const SizedBox(width: 5),
                    GestureDetector(
                      onTap: () => _delete(file),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 5, horizontal: 8),
                        decoration: BoxDecoration(
                          color: SettingsTheme.accentRed.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(5),
                          border: Border.all(color: SettingsTheme.accentRed.withOpacity(0.3)),
                        ),
                        child: const Icon(Icons.delete_outline, size: 12, color: SettingsTheme.accentRed),
                      ),
                    ),
                  ],
                ),
                // Download / evict button (cloud files, Android only)
                if (!kIsWeb && !isPending) ...[
                  const SizedBox(height: 4),
                  GestureDetector(
                    onTap: isDownloading
                        ? null
                        : isLocal
                            ? () => _evictFile(file)
                            : () => _downloadFile(file),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      decoration: BoxDecoration(
                        color: isLocal
                            ? const Color(0xFF4ADE80).withOpacity(0.1)
                            : const Color(0xFF38BDF8).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(5),
                        border: Border.all(
                          color: isLocal
                              ? const Color(0xFF4ADE80).withOpacity(0.3)
                              : const Color(0xFF38BDF8).withOpacity(0.3),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            isLocal ? Icons.phone_android : Icons.download_outlined,
                            size: 10,
                            color: isLocal ? const Color(0xFF4ADE80) : const Color(0xFF38BDF8),
                          ),
                          const SizedBox(width: 3),
                          Text(
                            isLocal ? 'On device' : 'Save offline',
                            style: TextStyle(
                              fontSize: 9,
                              color: isLocal ? const Color(0xFF4ADE80) : const Color(0xFF38BDF8),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _brokenImage() => Container(
    height: 90, width: 140,
    color: const Color(0xFF1E293B),
    child: const Center(
      child: Icon(Icons.broken_image, color: Color(0xFF475569), size: 32),
    ),
  );

  Future<void> _downloadFile(MediaFile file) async {
    setState(() => _downloadProgress[file.id] = 0.0);
    try {
      await context.read<AppProvider>().downloadMediaFile(
        file,
        onProgress: (p) => setState(() => _downloadProgress[file.id] = p),
      );
    } catch (e) {
      if (mounted) setState(() => _error = 'Download failed: $e');
    } finally {
      if (mounted) setState(() => _downloadProgress.remove(file.id));
    }
  }

  Future<void> _evictFile(MediaFile file) async {
    await context.read<AppProvider>().evictFromCache(file.id);
    if (mounted) setState(() {});
  }
}
