/**
 * mediaLibraryService.ts
 * CRUD for the Supabase `media_library` table + the PHP media server.
 * Port of media_library_service.dart — same endpoints, key, and table shape.
 */
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { MediaFile, mediaFileFromJson } from './mediaFile';

const PHP_API_URL = 'https://expertai.co.uk/softwares/general_upload/masjidazan/media_api.php';
const PHP_API_KEY = 'EverY0NeKnoW$1T';

async function uploadToPhp(blob: Blob, filename: string): Promise<{ url: string; filename: string; size: number; mime: string }> {
  const form = new FormData();
  form.append('action', 'upload');
  form.append('file', blob, filename);
  const res = await fetch(PHP_API_URL, { method: 'POST', headers: { Authorization: `Bearer ${PHP_API_KEY}` }, body: form });
  if (!res.ok) throw new Error(`PHP server returned ${res.status}`);
  const data = await res.json();
  if (data.success !== true) throw new Error(data.error ?? 'Upload failed');
  return {
    url: data.url as string,
    filename: (data.filename as string) ?? (data.url as string).split('/').pop()!,
    size: (data.size as number) ?? blob.size,
    mime: (data.mime_type as string) ?? blob.type ?? 'image/jpeg',
  };
}

export const MediaLibraryService = {
  async uploadFile(params: {
    tenantId: string;
    blob: Blob;
    filename: string;
    category: string;
    deviceId?: string | null;
  }): Promise<MediaFile> {
    const uploaded = await uploadToPhp(params.blob, params.filename);
    const { data, error } = await supabase
      .from('media_library')
      .insert({
        tenant_id: params.tenantId,
        filename: uploaded.filename,
        url: uploaded.url,
        file_size_bytes: uploaded.size,
        mime_type: uploaded.mime,
        category: params.category,
        is_active_background: false,
        is_deleted: false,
        uploaded_by_device: params.deviceId ?? null,
        metadata: {},
      })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? 'Insert failed');
    return mediaFileFromJson(data);
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

  async deleteFile(tenantId: string, fileId: string): Promise<void> {
    const { data: rows } = await supabase.from('media_library').select('url').eq('id', fileId).eq('tenant_id', tenantId).limit(1);
    const url = rows && rows.length ? (rows[0].url as string) : null;
    await supabase.from('media_library').delete().eq('id', fileId).eq('tenant_id', tenantId);
    if (url) void deleteFileFromServer(url);
  },

  subscribeToLibrary(tenantId: string, onUpdate: (files: MediaFile[]) => void): RealtimeChannel {
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

async function deleteFileFromServer(url: string): Promise<void> {
  try {
    const filename = url.split('/').pop();
    await fetch(PHP_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${PHP_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', filename }),
    });
  } catch (e) {
    console.warn('[MediaLib] server delete failed', e);
  }
}
