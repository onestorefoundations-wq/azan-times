/**
 * AboutPage.tsx
 * The public landing page: what this is, how a mosque sets it up, and where to
 * get the TV app.
 *
 * Lives at /about rather than / because / is the TV display itself and
 * already-deployed kiosks point at it — taking the root would blank every
 * screen already mounted in a masjid.
 *
 * Its own Vite entry (about.html) so a visitor reading a marketing page does not
 * download the display bundle or the congregation app.
 */
import { useState } from 'react';

/**
 * Releases rather than a file in the deploy: the APK is tens of megabytes and
 * would land in git history on every build, and Vercel would serve it from the
 * same budget as the app.
 */
const RELEASES_URL = 'https://github.com/onestorefoundations-wq/azan-times/releases/latest';

export default function AboutPage() {
  const [slug, setSlug] = useState('');

  const openMosque = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = slug.trim().toLowerCase().replace(/^.*\/m\//, '');
    if (cleaned) window.location.href = `/m/${encodeURIComponent(cleaned)}`;
  };

  return (
    <div style={s.page}>
      <main style={s.wrap}>
        <header style={s.hero}>
          <div style={s.logo}>🕌</div>
          <h1 style={s.h1}>Masjid Prayer Times Display</h1>
          <p style={s.lede}>
            Turn any TV into a prayer-time display. Adhan and Iqamah times calculated on the
            device, a slideshow for announcements, and settings you can change from your phone.
          </p>
          <div style={s.ctaRow}>
            <a href={RELEASES_URL} style={s.primaryCta} rel="noreferrer noopener">
              ⬇ Download for Android TV
            </a>
            <a href="/" style={s.secondaryCta}>
              Open the web display
            </a>
          </div>
          <p style={s.fineprint}>
            Android 7.0 or newer. Sideload the APK, or open the web display on any smart TV
            browser.
          </p>
        </header>

        <section style={s.section}>
          <h2 style={s.h2}>How it works</h2>
          <div style={s.grid}>
            <Feature
              icon="📺"
              title="Works with no internet"
              body="Prayer times are calculated on the device from your location and method. A TV with no connection keeps showing correct times indefinitely."
            />
            <Feature
              icon="📱"
              title="Change it from your phone"
              body="Update times, slides and the theme from anywhere. Connected displays pick up the change as soon as they see a network."
            />
            <Feature
              icon="🖼️"
              title="Announcements"
              body="Add slides between prayers. Import straight from a USB stick when there is no internet at the masjid at all."
            />
            <Feature
              icon="🔗"
              title="A page for the congregation"
              body="Each mosque gets its own link and QR code. People scan it once and keep the times on their phone, offline."
            />
          </div>
        </section>

        <section style={s.section}>
          <h2 style={s.h2}>Setting up a display</h2>
          <ol style={s.steps}>
            <li>Install the app on the TV, or open the web display in its browser.</li>
            <li>Open Settings and set your mosque's location and calculation method.</li>
            <li>
              Optionally create a cloud account to manage the display from your phone and to
              publish a page for the congregation.
            </li>
          </ol>
          <p style={s.note}>
            A cloud account is optional. Everything works with local settings on the device alone.
          </p>
        </section>

        <section style={s.section}>
          <h2 style={s.h2}>Already have a mosque's link?</h2>
          <p style={s.body}>
            Enter the code from your mosque's display to see its prayer times.
          </p>
          <form onSubmit={openMosque} style={s.form}>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="central-mosque"
              aria-label="Mosque code"
              style={s.input}
            />
            <button type="submit" style={s.addBtn}>
              Open
            </button>
          </form>
        </section>

        <footer style={s.footer}>
          <p>Built for masjids. Free to use.</p>
        </footer>
      </main>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div style={s.feature}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <h3 style={s.h3}>{title}</h3>
      <p style={s.featureBody}>{body}</p>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    margin: 0,
    background: 'linear-gradient(170deg, #0d1b2a 0%, #1b263b 60%, #16202f 100%)',
    color: '#e8f0fe',
    fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    boxSizing: 'border-box',
    padding: '0 20px',
  },
  wrap: { maxWidth: 780, margin: '0 auto', padding: '56px 0 64px' },
  hero: { textAlign: 'center', marginBottom: 64 },
  logo: { fontSize: 52, marginBottom: 12 },
  h1: { fontSize: 34, fontWeight: 700, margin: '0 0 14px', lineHeight: 1.2 },
  lede: {
    fontSize: 17,
    lineHeight: 1.65,
    color: 'rgba(232,240,254,0.7)',
    maxWidth: 560,
    margin: '0 auto 28px',
  },
  ctaRow: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  primaryCta: {
    padding: '14px 26px',
    borderRadius: 10,
    background: '#00d4aa',
    color: '#06222b',
    fontWeight: 700,
    fontSize: 15,
    textDecoration: 'none',
  },
  secondaryCta: {
    padding: '14px 26px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.18)',
    color: '#e8f0fe',
    fontSize: 15,
    textDecoration: 'none',
  },
  fineprint: { fontSize: 12.5, color: 'rgba(232,240,254,0.4)', margin: 0 },
  section: { marginBottom: 56 },
  h2: { fontSize: 21, fontWeight: 600, margin: '0 0 20px' },
  h3: { fontSize: 15.5, fontWeight: 600, margin: '0 0 6px' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
    gap: 16,
  },
  feature: {
    padding: '20px 18px',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
  },
  featureBody: { fontSize: 14, lineHeight: 1.6, color: 'rgba(232,240,254,0.62)', margin: 0 },
  steps: { fontSize: 15, lineHeight: 2, color: 'rgba(232,240,254,0.75)', paddingLeft: 22, margin: 0 },
  note: {
    fontSize: 13.5,
    color: 'rgba(232,240,254,0.45)',
    marginTop: 14,
    paddingLeft: 2,
  },
  body: { fontSize: 15, lineHeight: 1.6, color: 'rgba(232,240,254,0.7)', margin: '0 0 14px' },
  form: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  input: {
    flex: '1 1 220px',
    padding: '13px 14px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.05)',
    color: '#e8f0fe',
    fontSize: 15,
    font: 'inherit',
    outline: 'none',
  },
  addBtn: {
    padding: '13px 26px',
    borderRadius: 10,
    border: '1px solid rgba(0,212,170,0.45)',
    background: 'rgba(0,212,170,0.14)',
    color: '#00d4aa',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    font: 'inherit',
  },
  footer: {
    borderTop: '1px solid rgba(255,255,255,0.07)',
    paddingTop: 24,
    textAlign: 'center',
    fontSize: 13,
    color: 'rgba(232,240,254,0.35)',
  },
};
