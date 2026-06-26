/// sync_status_chip.dart
/// Small pill widget showing current sync status.

import 'package:flutter/material.dart';
import '../core/supabase_sync_service.dart';

class SyncStatusChip extends StatelessWidget {
  final SyncStatus status;
  final bool compact;

  const SyncStatusChip({
    super.key,
    required this.status,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final (icon, label, color) = _resolveStatus();

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 8 : 12,
        vertical: compact ? 4 : 6,
      ),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: color.withOpacity(0.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (status == SyncStatus.syncing)
            SizedBox(
              width: 12,
              height: 12,
              child: CircularProgressIndicator(
                strokeWidth: 1.5,
                color: color,
              ),
            )
          else
            Icon(icon, size: 12, color: color),
          SizedBox(width: compact ? 4 : 6),
          Text(
            label,
            style: TextStyle(
              fontSize: compact ? 10 : 12,
              color: color,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  (IconData, String, Color) _resolveStatus() {
    return switch (status) {
      SyncStatus.synced => (Icons.cloud_done, 'Synced', const Color(0xFF14B8A6)),
      SyncStatus.syncing => (Icons.sync, 'Syncing...', const Color(0xFF60A5FA)),
      SyncStatus.offline => (Icons.cloud_off, 'Offline — changes pending', const Color(0xFFF59E0B)),
      SyncStatus.syncError => (Icons.error_outline, 'Sync error', const Color(0xFFEF4444)),
      SyncStatus.localOnly => (Icons.storage, 'Local only', const Color(0xFF94A3B8)),
    };
  }
}
