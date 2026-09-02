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
  CONFIG_SECTIONS,
  ConfigSection,
  SectionVersions,
  appConfigFromCloudJson,
  appConfigToCloudSections,
  applyCloudSections,
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

      const dirty = StorageService.getDirtySections();
      const localVersions = StorageService.getSectionVersions();

      const { data: remote } = await supabase
        .from('mosque_configs')
        .select('config_version, config_json, section_versions')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (remote) {
        // Pull only the sections that actually moved, and never one this device
        // has an unpushed edit in. A TV offline for a week now takes the phone's
        // new prayer times without reverting anything it never touched.
        const remoteVersions = (remote.section_versions ?? {}) as SectionVersions;
        const remoteJson = (remote.config_json ?? {}) as Record<string, any>;

        const toPull = CONFIG_SECTIONS.filter((name) => {
          if (remoteJson[name] == null) return false;
          const rv = remoteVersions[name] ?? 0;
          const lv = localVersions[name] ?? 0;
          if (rv <= lv) return false;
          if (dirty.includes(name)) {
            // Same section edited on both sides. Rare now that sections are
            // independent; the edit made on this screen wins and we say so.
            console.warn(`[Sync] conflict in "${name}" (remote v${rv}) — local edit wins`);
            return false;
          }
          return true;
        });

        if (toPull.length > 0) {
          const picked: Partial<Record<ConfigSection, any>> = {};
          for (const name of toPull) picked[name] = remoteJson[name];
          applySections(picked, remoteVersions, toPull, remote.config_version as number);
          onConfigUpdated?.();
        }
      }

      if (dirty.length > 0 || !remote) {
        await SupabaseSync.pushConfigToCloud(StorageService.loadConfig(), remote ? dirty : undefined);
      }

      onStatusChange?.('synced');
    } catch (e) {
      console.warn('[Sync] failed', e);
      onStatusChange?.('syncError');
    }
  },

  /**
   * Pushes [sections] (default: everything) as a section-wise merge. The server
   * leaves every section not named here exactly as it is, so this can never
   * revert another device's work.
   */
  async pushConfigToCloud(config: AppConfig, sections?: ConfigSection[]) {
    const tenantId = config.profile.tenantId;
    if (!tenantId) return;

    const names = sections && sections.length > 0 ? sections : [...CONFIG_SECTIONS];
    const all = appConfigToCloudSections(config);
    const payload: Record<string, unknown> = {};
    for (const name of names) payload[name] = all[name];

    const deviceId = config.meta.deviceId ?? 'unknown';

    // Marked before the call and cleared only on success, so a failure at any
    // point (offline, token rejected, tab closed mid-flight) leaves a durable
    // marker for the next syncNow.
    StorageService.markSectionsDirty(names);

    const { data, error } = await supabase.rpc('push_config_sections', {
      p_tenant_id: tenantId,
      p_sections: payload,
      p_device_id: deviceId,
    });
    if (error) throw new Error(error.message);

    const result = (data ?? {}) as {
      config_version?: number;
      section_versions?: SectionVersions;
    };

    StorageService.saveSectionVersions(result.section_versions ?? {});
    StorageService.saveSyncMeta({
      ...config.meta,
      supabaseConfigVersion: result.config_version ?? config.meta.supabaseConfigVersion,
      lastSuccessfulSync: Date.now(),
    });
    StorageService.clearDirtySections(names);
  },

  async linkAccount(identifier: string, password: string): Promise<LinkedAccountResult> {
    const session = await AuthSession.login(identifier, password);
    const tenantId = session.tenantId;

    const { data: cfg } = await supabase
      .from('mosque_configs')
      .select('config_version, config_json, section_versions')
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
        // newConfig.meta is updatedMeta with the account's display_settings
        // (font, colours, template, backgrounds) folded in. Overwriting it with
        // updatedMeta dropped those while still recording the cloud's
        // display_settings version, so the device believed it was in step and
        // never pulled them again.
        meta: newConfig.meta,
      });
      // Cloud state was just adopted wholesale; nothing local is outstanding.
      StorageService.saveSectionVersions((cfg.section_versions ?? {}) as SectionVersions);
      StorageService.clearDirtySections();
    } else {
      // Empty account: this device's existing setup becomes the account's.
      StorageService.saveConfig({
        ...currentConfig,
        profile: { ...currentConfig.profile, tenantId },
        meta: updatedMeta,
      });
      StorageService.saveSectionVersions({});
      StorageService.markSectionsDirty([...CONFIG_SECTIONS]);
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
    StorageService.saveSectionVersions({});

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
    StorageService.clearDirtySections();
    StorageService.saveSectionVersions({});
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

/**
 * Applies [picked] cloud sections onto local storage, recording the versions
 * this device is now in step with. Sections not named here — and all
 * device-local meta — are left exactly as they are.
 */
function applySections(
  picked: Partial<Record<ConfigSection, any>>,
  remoteVersions: SectionVersions,
  applied: ConfigSection[],
  configVersion: number,
) {
  const current = StorageService.loadConfig();
  const next = applyCloudSections(current, picked);

  const versions = { ...StorageService.getSectionVersions() };
  for (const name of applied) versions[name] = remoteVersions[name] ?? 0;

  StorageService.saveConfig({
    ...next,
    meta: {
      ...next.meta,
      supabaseConfigVersion: configVersion,
      lastSuccessfulSync: Date.now(),
    },
  });
  StorageService.saveSectionVersions(versions);
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

        const remoteVersions = (newData.section_versions ?? {}) as SectionVersions;
        const remoteJson = newData.config_json as Record<string, any>;
        const localVersions = StorageService.getSectionVersions();
        const dirty = StorageService.getDirtySections();

        // Take only the sections that moved and that this device has no
        // unpushed edit in, so somebody else's push cannot clobber a local
        // change that syncNow has yet to send.
        const toPull = CONFIG_SECTIONS.filter(
          (name) =>
            remoteJson[name] != null &&
            !dirty.includes(name) &&
            (remoteVersions[name] ?? 0) > (localVersions[name] ?? 0),
        );
        if (toPull.length === 0) return;

        const picked: Partial<Record<ConfigSection, any>> = {};
        for (const name of toPull) picked[name] = remoteJson[name];
        applySections(picked, remoteVersions, toPull, (newData.config_version as number) ?? 0);
        onConfigUpdated?.();
        onStatusChange?.('synced');
      },
    )
    .subscribe();
}
