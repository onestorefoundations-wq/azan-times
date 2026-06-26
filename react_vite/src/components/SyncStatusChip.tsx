/**
 * SyncStatusChip.tsx — port of sync_status_chip.dart.
 */
import { SyncStatus } from '../core/supabaseSync';

const MAP: Record<SyncStatus, { label: string; color: string; icon: string }> = {
  localOnly: { label: 'Local Only', color: '#94A3B8', icon: '📴' },
  synced: { label: 'Synced', color: '#14B8A6', icon: '✅' },
  syncing: { label: 'Syncing…', color: '#3B82F6', icon: '🔄' },
  offline: { label: 'Offline', color: '#FB923C', icon: '⚠️' },
  syncError: { label: 'Sync Error', color: '#EF4444', icon: '❌' },
};

export default function SyncStatusChip({ status }: { status: SyncStatus }) {
  const s = MAP[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 12,
        fontWeight: 600,
        color: s.color,
        background: `${s.color}22`,
        border: `1px solid ${s.color}66`,
        borderRadius: 999,
        padding: '2px 10px',
      }}
    >
      <span>{s.icon}</span>
      {s.label}
    </span>
  );
}
