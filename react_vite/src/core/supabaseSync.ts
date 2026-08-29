/**
 * supabaseSync.ts
 * Cloud sync. Port of flutter_app/lib/core/supabase_sync_service.dart.
 * Version-gated pull/push, realtime config channel, device heartbeat, and
 * link/register/disconnect.
 *
 * Auth runs through the `auth` Edge Function (see supabase/functions/auth):
 * the client posts credentials, gets back a tenant-scoped JWT, and every
 * Supabase call after that is filtered by the RLS policies in
 * supabase/02_security_hardening.sql. The client never reads admin_users.
 */
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  AppConfig,
  appConfigFromCloudJson,
  appConfigToCloudJson,
  defaultSyncMeta,
} from './appConfig';
import { APP_VERSION, supabase } from './supabaseClient';
import { AuthSession } from './authSession';
import { DeviceService } from './deviceService';
import { StorageService } from './storageService';

export type SyncStatus = 'localOnly' | 'synced' | 'syncing' | 'offline' | 'syncError';

export interface LinkedAccountResult {
  tenantId: string;
  username: string;
  mobile: string;
  email: string;
  mosqueName: string;
}

let onStatusChange: ((s: SyncStatus) => void) | null = null;
let onConfigUpdated: (() => void) | null = null;
let syncTimer: ReturnType<typeof setInterval> | null = null;
let channel: RealtimeChannel | null = null;
let activeTenantId: string | null = null;
let onlineHandler: (() => void) | null = null;

const isOnline = () => navigator.onLine;

export const SupabaseSync = {
  async startSync(cbs: { onStatusChange: (s: SyncStatus) => void; onConfigUpdated: () => void }) {
    onStatusChange = cbs.onStatusChange;
    onConfigUpdated = cbs.onConfigUpdated;

    await SupabaseSync.syncNow();

    const config = StorageService.loadConfig();
    const tenantId = config.profile.tenantId;
    if (tenantId) subscribeRealtime(tenantId);

    if (syncTimer) clearInterval(syncTimer);
    syncTimer = setInterval(() => void SupabaseSync.syncNow(), 5 * 60_000);

    if (onlineHandler) window.removeEventListener('online', onlineHandler);
    onlineHandler = () => void SupabaseSync.syncNow();
    window.addEventListener('online', onlineHandler);
  },

  async resubscribeIfNeeded() {
    const config = StorageService.loadConfig();
    const tenantId = config.profile.tenantId;
    if (!tenantId) return;
    if (channel == null || activeTenantId !== tenantId) subscribeRealtime(tenantId);
    await SupabaseSync.syncNow();
  },

  async stopSync() {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = null;
    if (onlineHandler) window.removeEventListener('online', onlineHandler);
    onlineHandler = null;
    if (channel) {
      await supabase.removeChannel(channel);
      channel = null;
    }
    activeTenantId = null;
  },

  async syncNow() {
    if (!isOnline()) {
      onStatusChange?.('offline');
      return;
    }
    const config = StorageService.loadConfig();
    const tenantId = config.profile.tenantId;
    const deviceId = config.meta.deviceId ?? DeviceService.getDeviceId();

    if (!tenantId) {
      onStatusChange?.('localOnly');
      return;
    }

    if (!AuthSession.getToken()) {
      // Linked but the token is gone (cleared storage, or linked by a build
      // predating token auth). Local config keeps working; sync cannot.
      console.warn('[Sync] linked tenant with no auth token — re-link required');
      onStatusChange?.('syncError');
      return;
    }

    onStatusChange?.('syncing');
    try {
      if (!(await AuthSession.refreshIfNeeded())) {
        onStatusChange?.('syncError');
        return;
      }

      if (deviceId) {
        await supabase.from('device_registry').upsert(
          {
            tenant_id: tenantId,
            device_id: deviceId,
            last_seen: new Date().toISOString(),
            online_status: true,
            app_version: APP_VERSION,
          },
          { onConflict: 'tenant_id,device_id' },
        );
      }

      const localVersion = config.meta.supabaseConfigVersion;
      const pushPending = StorageService.isConfigPushPending();

      const { data: remote } = await supabase
        .from('mosque_configs')
        .select('config_version, config_json, updated_at')
        .eq('tenant_id', tenantId)
        .order('config_version', { ascending: false })
        .limit(1)
        .maybeSingle();

      const remoteVersion = remote ? ((remote.config_version as number) ?? 0) : -1;

      if (pushPending) {
        // An edit was made on this device that never reached the cloud. It wins
        // even when the remote moved on in the meantime: the alternative is
        // silently discarding something the user typed on this screen.
        if (remoteVersion > localVersion)
          console.warn(
            `[Sync] conflict: local pending edit over remote v${remoteVersion} — local wins`,
          );
        await SupabaseSync.pushConfigToCloud(config);
        onStatusChange?.('synced');
        return;
      }

      if (!remote) {
        await SupabaseSync.pushConfigToCloud(config);
      } else if (remoteVersion > localVersion) {
        await applyConfig(remote.config_json, remoteVersion);
        onConfigUpdated?.();
      } else if (localVersion > remoteVersion) {
        await SupabaseSync.pushConfigToCloud(config);
      }
      onStatusChange?.('synced');
    } catch (e) {
      console.warn('[Sync] failed', e);
      onStatusChange?.('syncError');
    }
  },

  async pushConfigToCloud(config: AppConfig) {
    const tenantId = config.profile.tenantId;
    if (!tenantId) return;
    const cloudJson = appConfigToCloudJson(config);
    const deviceId = config.meta.deviceId ?? 'unknown';

    // Set before the call, cleared only on success, so a failure at any point
    // (offline, token rejected, tab closed mid-flight) leaves a durable marker
    // for the next syncNow.
    StorageService.setConfigPushPending(true);

    const { data, error } = await supabase.rpc('increment_and_push_config', {
      p_tenant_id: tenantId,
      p_config_json: cloudJson,
      p_device_id: deviceId,
    });
    if (error) throw new Error(error.message);

    const newVersion = Number(data) || 1;

    StorageService.saveSyncMeta({
      ...config.meta,
      supabaseConfigVersion: newVersion,
      lastSuccessfulSync: Date.now(),
    });
    StorageService.setConfigPushPending(false);
  },

  async linkAccount(identifier: string, password: string): Promise<LinkedAccountResult> {
    const session = await AuthSession.login(identifier, password);
    const tenantId = session.tenantId;

    const { data: cfg } = await supabase
      .from('mosque_configs')
      .select('config_version, config_json')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const currentConfig = StorageService.loadConfig();
    const updatedMeta = {
      ...currentConfig.meta,
      linkedUsername: session.username || null,
      linkedMobile: session.mobile || null,
      linkedEmail: session.email || null,
      linkedMosqueName: session.mosqueName,
      supabaseConfigVersion: cfg ? ((cfg.config_version as number) ?? 0) : 0,
      lastSuccessfulSync: Date.now(),
    };

    if (cfg) {
      const newConfig = appConfigFromCloudJson(cfg.config_json, updatedMeta);
      StorageService.saveConfig({
        ...newConfig,
        profile: { ...newConfig.profile, tenantId },
        meta: updatedMeta,
      });
      // Cloud state was just adopted wholesale; nothing local is outstanding.
      StorageService.setConfigPushPending(false);
    } else {
      StorageService.saveConfig({
        ...currentConfig,
        profile: { ...currentConfig.profile, tenantId },
        meta: updatedMeta,
      });
    }

    subscribeRealtime(tenantId);
    return {
      tenantId,
      username: session.username,
      mobile: session.mobile,
      email: session.email,
      mosqueName: session.mosqueName,
    };
  },

  async registerAccount(params: {
    mosqueName: string;
    username: string;
    password: string;
    mobile?: string;
    email?: string;
  }): Promise<LinkedAccountResult> {
    // Tenant + user are created inside app_register() in one transaction, so a
    // duplicate username can no longer leave an orphaned tenant behind.
    const session = await AuthSession.register(params);
    const tenantId = session.tenantId;

    const currentConfig = StorageService.loadConfig();
    const updatedMeta = {
      ...currentConfig.meta,
      linkedUsername: session.username || params.username,
      linkedMobile: session.mobile || null,
      linkedEmail: session.email || null,
      linkedMosqueName: session.mosqueName,
      supabaseConfigVersion: 0,
      lastSuccessfulSync: Date.now(),
    };
    const initialConfig: AppConfig = {
      ...currentConfig,
      profile: { ...currentConfig.profile, name: params.mosqueName, tenantId },
      meta: updatedMeta,
    };
    StorageService.saveConfig(initialConfig);

    await SupabaseSync.pushConfigToCloud(initialConfig);

    subscribeRealtime(tenantId);
    return {
      tenantId,
      username: session.username || params.username,
      mobile: session.mobile,
      email: session.email,
      mosqueName: session.mosqueName,
    };
  },

  async disconnectAccount() {
    const currentConfig = StorageService.loadConfig();
    const tenantId = currentConfig.profile.tenantId;
    const deviceId = currentConfig.meta.deviceId ?? DeviceService.getDeviceId();

    // Clear the heartbeat latch while the token is still valid.
    if (tenantId && deviceId && isOnline() && AuthSession.getToken()) {
      try {
        await supabase
          .from('device_registry')
          .update({ online_status: false })
          .eq('tenant_id', tenantId)
          .eq('device_id', deviceId);
      } catch (e) {
        console.warn('[Sync] could not clear online_status', e);
      }
    }

    await SupabaseSync.stopSync();
    AuthSession.clear();
    StorageService.setConfigPushPending(false);
    StorageService.saveConfig({
      ...currentConfig,
      profile: { ...currentConfig.profile, tenantId: null },
      meta: { ...defaultSyncMeta(), deviceId: currentConfig.meta.deviceId },
    });
  },

  async testTenantConnection(tenantId: string): Promise<boolean> {
    try {
      const { data } = await supabase.from('tenants').select('id').eq('id', tenantId).maybeSingle();
      return data != null;
    } catch {
      return false;
    }
  },
};

// ── internal ──────────────────────────────────────────────────

async function applyConfig(configJson: Record<string, unknown>, newVersion: number) {
  const current = StorageService.loadConfig();
  const updatedMeta = {
    ...current.meta,
    supabaseConfigVersion: newVersion,
    lastSuccessfulSync: Date.now(),
  };
  const newConfig = appConfigFromCloudJson(configJson, updatedMeta);
  StorageService.saveConfig(newConfig);
}

function subscribeRealtime(tenantId: string) {
  if (channel) {
    void supabase.removeChannel(channel);
    channel = null;
  }
  activeTenantId = tenantId;

  channel = supabase
    .channel(`mosque-config-${tenantId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'mosque_configs', filter: `tenant_id=eq.${tenantId}` },
      async (payload) => {
        const newData = payload.new as Record<string, any>;
        if (newData?.tenant_id !== tenantId) return; // guard wrong tenant
        if (newData?.config_json == null) return;
        // A local edit that has not reached the cloud must not be clobbered by
        // the echo of somebody else's push; syncNow resolves it.
        if (StorageService.isConfigPushPending()) return;
        const version = (newData.config_version as number) ?? 0;
        const current = StorageService.loadConfig();
        if (version > current.meta.supabaseConfigVersion) {
          await applyConfig(newData.config_json, version);
          onConfigUpdated?.();
          onStatusChange?.('synced');
        }
      },
    )
    .subscribe();
}
