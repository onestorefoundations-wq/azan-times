/**
 * PublicPagePanel.tsx
 * Settings panel for the congregation's read-only prayer-times page: turn it
 * on, copy the link, and show a QR big enough to scan off the TV.
 *
 * Off by default per mosque — enabling it publishes the mosque's name and
 * coordinates at a shareable URL, which is the mosque's decision to make, not a
 * side effect of registering an account.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { supabase } from '../core/supabaseClient';
import { publicPageUrl } from '../core/supabaseConfig';

interface Props {
  tenantId: string;
  /** Panel colours, passed in so this matches whichever settings theme is live. */
  theme: { text: string; muted: string; border: string; accent: string; surface: string };
}

export default function PublicPagePanel({ tenantId, theme }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const url = slug ? publicPageUrl(slug) : null;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error: e } = await supabase
        .from('tenants')
        .select('public_slug, public_page_enabled')
        .eq('id', tenantId)
        .maybeSingle();
      if (cancelled) return;
      if (e) {
        setError(e.message);
        return;
      }
      setEnabled(Boolean(data?.public_page_enabled));
      setSlug((data?.public_slug as string | null) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  // Rendered to a canvas rather than an <img> so it stays crisp on a TV panel
  // and can be saved or photographed straight off the screen.
  useEffect(() => {
    if (!url || !enabled || !canvasRef.current) return;
    void QRCode.toCanvas(canvasRef.current, url, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0d1b2a', light: '#ffffff' },
    }).catch((e) => console.warn('[PublicPage] QR render failed', e));
  }, [url, enabled]);

  const apply = useCallback(
    async (nextEnabled: boolean, nextSlug?: string) => {
      setBusy(true);
      setError(null);
      try {
        // Passing no slug keeps the existing one, so toggling the page off and
        // on again does not silently invalidate every QR already printed.
        const { data, error: e } = await supabase.rpc('set_public_page', {
          p_tenant_id: tenantId,
          p_enabled: nextEnabled,
          p_slug: nextSlug ?? null,
        });
        if (e) throw new Error(e.message);
        const row = Array.isArray(data) ? data[0] : data;
        setSlug(row?.public_slug ?? null);
        setEnabled(Boolean(row?.public_page_enabled));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [tenantId],
  );

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy — select the address above and copy it manually.');
    }
  };

  const share = async () => {
    if (!url) return;
    // navigator.share is absent on desktop and on most TV browsers; the copy
    // button is always there as the fallback.
    if (!navigator.share) return void copy();
    try {
      await navigator.share({ title: 'Prayer times', url });
    } catch {
      /* user dismissed the sheet */
    }
  };

  return (
    <div style={{ borderTop: `1px solid ${theme.border}`, marginTop: 24, paddingTop: 20 }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 15, color: theme.accent }}>
        Public Prayer Times Page
      </h3>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: theme.muted, lineHeight: 1.6 }}>
        A read-only page anyone can open or install on their phone. Nobody can edit your
        settings from it. Turning this on publishes your mosque name and prayer times.
      </p>

      {error && <p style={{ color: '#ff6b6b', fontSize: 12, margin: '0 0 10px' }}>{error}</p>}

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={enabled}
          disabled={busy}
          onChange={(e) => void apply(e.target.checked)}
        />
        <span style={{ fontSize: 14, color: theme.text }}>
          {busy ? 'Saving…' : enabled ? 'Page is live' : 'Page is off'}
        </span>
      </label>

      {enabled && url && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              fontSize: 13,
              wordBreak: 'break-all',
              color: theme.text,
              marginBottom: 10,
            }}
          >
            {url}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <button type="button" onClick={() => void copy()} style={btn(theme)}>
              {copied ? '✓ Copied' : 'Copy link'}
            </button>
            <button type="button" onClick={() => void share()} style={btn(theme)}>
              Share
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                // Regenerating is the only way to revoke a link that has been
                // shared too widely, so make the consequence explicit.
                if (
                  window.confirm(
                    'Generate a new link? Every QR code and link already shared will stop working.',
                  )
                ) {
                  void apply(true, `masjid-${Math.random().toString(36).slice(2, 8)}`);
                }
              }}
              style={btn(theme)}
            >
              New link
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <canvas
              ref={canvasRef}
              style={{ background: '#fff', padding: 10, borderRadius: 10 }}
            />
            <span style={{ fontSize: 11, color: theme.muted }}>
              Scan to open the prayer times
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

const btn = (theme: Props['theme']): React.CSSProperties => ({
  padding: '8px 14px',
  borderRadius: 8,
  border: `1px solid ${theme.border}`,
  background: 'transparent',
  color: theme.text,
  fontSize: 13,
  cursor: 'pointer',
});
