/**
 * supabaseSync.ts
 * Cloud sync. Port of flutter_app/lib/core/supabase_sync_service.dart.
 * Version-gated pull/push, realtime config channel, device heartbeat, and
 * link/register/disconnect — wire-compatible with the Flutter app.
 *
 * ⚠️ Auth mirrors the existing system: a direct table query compares the
 * password to password_hash (same as the Flutter client). Harden with an
 * Edge Function for production.
 */
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  AppConfig,
  appConfigFromCloudJson,
  appConfigToCloudJson,
  defaultSyncMeta,
} from './appConfig';
import { APP_VERSION, supabase } from './supabaseClient';
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

    onStatusChange?.('syncing');
    try {
      if (deviceId) {
        await supabase.from('device_registry').upsert(
          {
            tenant_id: tenantId,
            device_id: deviceId,
            last_seen: new Date().toISOString(),
            online_status: true,
            app_version: APP_VERSION,
          },
          { onConflict: 'device_id' },
        );
      }

      const localVersion = config.meta.supabaseConfigVersion;
      const { data: remote } = await supabase
        .from('mosque_configs')
        .select('config_version, config_json, updated_at')
        .eq('tenant_id', tenantId)
        .order('config_version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (remote) {
        const remoteVersion = (remote.config_version as number) ?? 0;
        if (remoteVersion > localVersion) {
          await applyConfig(remote.config_json, remoteVersion);
          onConfigUpdated?.();
          onStatusChange?.('synced');
        } else if (localVersion > remoteVersion) {
          await SupabaseSync.pushConfigToCloud(config);
          onStatusChange?.('synced');
        } else {
          onStatusChange?.('synced');
        }
      } else {
        await SupabaseSync.pushConfigToCloud(config);
        onStatusChange?.('synced');
      }
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

    let newVersion: number;
    const { data: rpcResult, error: rpcError } = await supabase.rpc('increment_and_push_config', {
      p_tenant_id: tenantId,
      p_config_json: cloudJson,
      p_device_id: deviceId,
    });

    if (!rpcError && rpcResult != null) {
      newVersion = Number(rpcResult) || 1;
    } else {
      // Fallback: legacy read-increment-write.
      const { data: current } = await supabase
        .from('mosque_configs')
        .select('id, config_version')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      newVersion = current ? ((current.config_version as number) ?? 0) + 1 : 1;
      if (current) {
        await supabase
          .from('mosque_configs')
          .update({
            config_version: newVersion,
            config_json: cloudJson,
            updated_at: new Date().toISOString(),
            updated_by: deviceId,
          })
          .eq('id', current.id as string);
      } else {
        await supabase
          .from('mosque_configs')
          .insert({ tenant_id: tenantId, config_version: newVersion, config_json: cloudJson, updated_by: deviceId });
      }
    }

    StorageService.saveSyncMeta({
      ...config.meta,
      supabaseConfigVersion: newVersion,
      lastSuccessfulSync: Date.now(),
    });
  },

  async linkAccount(identifier: string, password: string): Promise<LinkedAccountResult> {
    const { data: user } = await supabase
      .from('admin_users')
      .select('tenant_id, username, mobile, email')
      .or(`username.eq."${identifier}",mobile.eq."${identifier}",email.eq."${identifier}"`)
      .eq('password_hash', password)
      .maybeSingle();

    if (!user) throw new Error('Invalid username/mobile/email or password');
    const tenantId = user.tenant_id as string;

    const { data: tenant } = await supabase.from('tenants').select('name').eq('id', tenantId).maybeSingle();
    const mosqueName = (tenant?.name as string) ?? 'Linked Mosque';

    const { data: cfg } = await supabase
      .from('mosque_configs')
      .select('config_version, config_json')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const currentConfig = StorageService.loadConfig();
    const updatedMeta = {
      ...currentConfig.meta,
      linkedUsername: (user.username as string) ?? null,
      linkedMobile: (user.mobile as string) ?? null,
      linkedEmail: (user.email as string) ?? null,
      linkedMosqueName: mosqueName,
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
      username: (user.username as string) ?? '',
      mobile: (user.mobile as string) ?? '',
      email: (user.email as string) ?? '',
      mosqueName,
    };
  },

  async registerAccount(params: {
    mosqueName: string;
    username: string;
    password: string;
    mobile?: string;
    email?: string;
  }): Promise<LinkedAccountResult> {
    const { mosqueName, username, password, mobile, email } = params;

    const { data: existing } = await supabase.from('admin_users').select('id').eq('username', username).maybeSingle();
    if (existing) throw new Error('Username already registered');

    const { data: tenant, error: tErr } = await supabase
      .from('tenants')
      .insert({ name: mosqueName })
      .select()
      .single();
    if (tErr || !tenant) throw new Error(tErr?.message ?? 'Failed to create tenant');
    const tenantId = tenant.id as string;

    const { data: user, error: uErr } = await supabase
      .from('admin_users')
      .insert({ tenant_id: tenantId, username, mobile, email, password_hash: password })
      .select()
      .single();
    if (uErr || !user) throw new Error(uErr?.message ?? 'Failed to create user');

    const currentConfig = StorageService.loadConfig();
    const initialConfig: AppConfig = {
      ...currentConfig,
      profile: { ...currentConfig.profile, name: mosqueName, tenantId },
    };

    await supabase
      .from('mosque_configs')
      .insert({ tenant_id: tenantId, config_version: 1, config_json: appConfigToCloudJson(initialConfig) });

    const updatedMeta = {
      ...currentConfig.meta,
      linkedUsername: (user.username as string) ?? username,
      linkedMobile: (user.mobile as string) ?? null,
      linkedEmail: (user.email as string) ?? null,
      linkedMosqueName: mosqueName,
      supabaseConfigVersion: 1,
      lastSuccessfulSync: Date.now(),
    };
    StorageService.saveConfig({ ...initialConfig, meta: updatedMeta });

    subscribeRealtime(tenantId);
    return {
      tenantId,
      username: (user.username as string) ?? username,
      mobile: (user.mobile as string) ?? '',
      email: (user.email as string) ?? '',
      mosqueName,
    };
  },

  async disconnectAccount() {
    await SupabaseSync.stopSync();
    const currentConfig = StorageService.loadConfig();
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
