/**
 * mediaLibraryService.ts
 * CRUD for the Supabase `media_library` table.
 *
 * Uploads and deletes go through the `media-proxy` Edge Function. The PHP media
 * server's shared API key used to sit in this file — i.e. in the shipped
 * bundle — and its delete endpoint keys off a bare filename, so anyone could
 * extract the key and delete any mosque's media. The key now lives as a
 * function secret, and the proxy checks the media_library row's tenant against
 * the caller's JWT before deleting anything.
 */
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, syncRealtimeAuth } from './supabaseClient';
import { FUNCTIONS_URL, SUPABASE_ANON_KEY } from './supabaseConfig';
import { AuthSession } from './authSession';
import { MediaFile, mediaFileFromJson } from './mediaFile';

const MEDIA_PROXY_URL = `${FUNCTIONS_URL}/media-proxy`;

function authHeaders(): Record<string, string> {
  const token = AuthSession.getToken();
  if (!token) throw new Error('Not linked to a cloud account');
  return { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` };
}

async function proxyJson(res: Response): Promise<any> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Media proxy returned ${res.status}`);
  return data;
}

export const MediaLibraryService = {
  async uploadFile(params: {
    tenantId: string;
    blob: Blob;
    filename: string;
    category: string;
    deviceId?: string | null;
  }): Promise<MediaFile> {
    // tenantId is ignored server-side — the proxy takes it from the JWT so a
    // client cannot file uploads under someone else's tenant. It stays in the
    // signature for call-site symmetry with the rest of the service.
    const form = new FormData();
    form.append('file', params.blob, params.filename);
    form.append('filename', params.filename);
    form.append('category', params.category);
    if (params.deviceId) form.append('deviceId', params.deviceId);

    const res = await fetch(MEDIA_PROXY_URL, {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    });
    return mediaFileFromJson(await proxyJson(res));
  },

  async fetchFiles(tenantId: string): Promise<MediaFile[]> {
    const { data, error } = await supabase
      .from('media_library')
      .select()
      .eq('tenant_id', tenantId)
      .eq('is_deleted', false)
      .order('display_order')
      .order('uploaded_at');
    if (error) throw new Error(error.message);
    return (data ?? []).map(mediaFileFromJson);
  },

  async setActiveBackground(tenantId: string, fileId: string): Promise<void> {
    await supabase.from('media_library').update({ is_active_background: false }).eq('tenant_id', tenantId).eq('is_active_background', true);
    await supabase.from('media_library').update({ is_active_background: true }).eq('id', fileId).eq('tenant_id', tenantId);
  },

  async clearActiveBackgroundForCategory(tenantId: string, category: string): Promise<void> {
    await supabase
      .from('media_library')
      .update({ is_active_background: false })
      .eq('tenant_id', tenantId)
      .eq('category', category)
      .eq('is_active_background', true);
  },

  async deleteFile(_tenantId: string, fileId: string): Promise<void> {
    // Row removal and the media-server delete both happen inside the proxy,
    // which verifies the row belongs to the caller's tenant first.
    const res = await fetch(MEDIA_PROXY_URL, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', fileId }),
    });
    await proxyJson(res);
  },

  subscribeToLibrary(tenantId: string, onUpdate: (files: MediaFile[]) => void): RealtimeChannel {
    // Same reason as the config channel: an anon socket subscribes happily and
    // then never matches a row, because media_library's policy is granted to
    // `authenticated` only.
    void syncRealtimeAuth();

    return supabase
      .channel(`media_library:${tenantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'media_library', filter: `tenant_id=eq.${tenantId}` }, async () => {
        try {
          onUpdate(await MediaLibraryService.fetchFiles(tenantId));
        } catch (e) {
          console.warn('[MediaLib] realtime fetch error', e);
        }
      })
      .subscribe();
  },
};
