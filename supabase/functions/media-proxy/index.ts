/**
 * functions/media-proxy
 * The PHP media server authenticates with a single shared bearer key and its
 * delete endpoint takes a bare filename. Both used to live in the client
 * bundle, so any user could read the key out of the JS and delete any other
 * mosque's media by guessing a filename.
 *
 * This function holds the key as a secret and is the only thing that talks to
 * the PHP server. tenant_id comes from the caller's JWT, never from the request
 * body, and deletes are refused unless the media_library row belongs to that
 * tenant.
 *
 *   POST multipart  action=upload   file, filename, category
 *   POST json       { action: "delete", fileId }
 *
 * Both require Authorization: Bearer <token from functions/auth>.
 *
 *   supabase functions deploy media-proxy --no-verify-jwt
 * (--no-verify-jwt because these are our own HS256 tokens, verified below,
 *  not Supabase Auth sessions.)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { json, preflight, corsHeaders } from '../_shared/cors.ts';
import { verifyToken } from '../_shared/jwt.ts';

const PHP_API_URL =
  Deno.env.get('PHP_API_URL') ??
  'https://expertai.co.uk/softwares/general_upload/masjidazan/media_api.php';
const PHP_API_KEY = Deno.env.get('PHP_API_KEY');
if (!PHP_API_KEY) throw new Error('PHP_API_KEY is not set');

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // matches php_server/uploads.php
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

async function phpUpload(blob: Blob, filename: string) {
  const form = new FormData();
  form.append('action', 'upload');
  form.append('file', blob, filename);
  const res = await fetch(PHP_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PHP_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Media server returned ${res.status}`);
  const data = await res.json();
  if (data.success !== true) throw new Error(data.error ?? 'Upload failed');
  return {
    url: data.url as string,
    filename: (data.filename as string) ?? (data.url as string).split('/').pop()!,
    size: (data.size as number) ?? blob.size,
    mime: (data.mime_type as string) ?? blob.type ?? 'image/jpeg',
  };
}

async function phpDelete(url: string) {
  const filename = url.split('/').pop();
  if (!filename) return;
  await fetch(PHP_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PHP_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'delete', filename }),
  });
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  const claims = await verifyToken(req.headers.get('Authorization'));
  if (!claims) return json(req, { error: 'Unauthorized' }, 401);
  const tenantId = claims.tenant_id;

  const contentType = req.headers.get('Content-Type') ?? '';

  try {
    // ── upload (multipart) ───────────────────────────────────────────────
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      if (!(file instanceof File)) return json(req, { error: 'No file supplied' }, 400);
      if (file.size > MAX_UPLOAD_BYTES)
        return json(req, { error: 'File exceeds the 5MB limit' }, 413);

      const mime = file.type || 'image/jpeg';
      if (!ALLOWED_MIME.includes(mime))
        return json(req, { error: `Unsupported file type ${mime}` }, 415);

      const filename = (form.get('filename') as string | null) ?? file.name;
      const category = (form.get('category') as string | null) ?? 'background';
      const deviceId = (form.get('deviceId') as string | null) ?? null;

      const uploaded = await phpUpload(file, filename);

      const { data, error } = await admin
        .from('media_library')
        .insert({
          tenant_id: tenantId, // from the JWT, not the request
          filename: uploaded.filename,
          url: uploaded.url,
          file_size_bytes: uploaded.size,
          mime_type: uploaded.mime,
          category,
          is_active_background: false,
          is_deleted: false,
          uploaded_by_device: deviceId,
          metadata: {},
        })
        .select()
        .single();

      if (error || !data) {
        // Don't leave an orphan on the media server.
        await phpDelete(uploaded.url).catch(() => {});
        return json(req, { error: error?.message ?? 'Insert failed' }, 500);
      }
      return json(req, data);
    }

    // ── delete (json) ────────────────────────────────────────────────────
    const body = await req.json();
    if (body.action !== 'delete') return json(req, { error: 'Unknown action' }, 400);

    const fileId = typeof body.fileId === 'string' ? body.fileId : '';
    if (!fileId) return json(req, { error: 'fileId is required' }, 400);

    const { data: row } = await admin
      .from('media_library')
      .select('id, url, tenant_id')
      .eq('id', fileId)
      .maybeSingle();

    // Same response whether the row is missing or belongs elsewhere, so this
    // can't be used to probe for other tenants' file ids.
    if (!row || row.tenant_id !== tenantId) return json(req, { error: 'Not found' }, 404);

    await admin.from('media_library').delete().eq('id', fileId).eq('tenant_id', tenantId);
    await phpDelete(row.url as string).catch((e) => console.warn('[media-proxy] php delete', e));

    return json(req, { ok: true });
  } catch (e) {
    console.error('[media-proxy]', e);
    return new Response(JSON.stringify({ error: (e as Error).message ?? 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});
