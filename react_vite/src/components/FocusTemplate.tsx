/**
 * FocusTemplate.tsx
 * The 'focus' display template: a summary bar pinned to the bottom edge that
 * never changes, with a rotating panel filling everything above it.
 *
 * The pinned bar is the point. On the classic template the prayer table shares
 * the screen with the slideshow, so a congregant walking in during a slide has
 * to wait for the rotation to come back round before they can read the times.
 * Here the clock and the next prayer are always on screen, and only the upper
 * panel changes.
 *
 * Panes rotate in order: next prayer -> quotes -> slideshow images. Panes with
 * no content are skipped rather than rendered empty, so a mosque that has added
 * neither quotes nor images simply gets a static next-prayer card.
 */
import { useEffect, useMemo, useState } from 'react';
import { AppConfig, QuoteEntry, resolvedColors, SlideAsset } from '../core/appConfig';
import { hexA } from '../core/color';
import { formatTime, getHijriDate, PrayerConfig } from '../core/prayerEngine';
import { clamp, useElementSize } from '../hooks/useElementSize';
import { useNow } from '../hooks/useNow';
import { getStrings, localizedPrayerName } from '../i18n';
import SlideshowPanel from './SlideshowPanel';

interface Props {
  isPortrait: boolean;
  config: AppConfig;
  prayers: PrayerConfig[];
  nextPrayer: PrayerConfig | null;
  activePrayer: PrayerConfig | null;
  slides: SlideAsset[];
  /** True while the store says the slideshow phase is running. */
  isSlideshowActive: boolean;
}

type PaneKind = 'next' | 'quote' | 'slides';

/**
 * Type scale unit for a panel.
 *
 * Sizing off height alone works on a 16:9 TV and breaks on a phone: a tall
 * portrait panel makes the prayer name so large it runs off both edges. Taking
 * the smaller of a width- and a height-derived figure keeps one set of ratios
 * correct from a 1080p landscape screen down to a phone held upright.
 */
const scaleUnit = (width: number, height: number): number =>
  Math.max(Math.min(width * 0.9, height * 1.2), 1);

/**
 * Prayer times without the AM/PM suffix.
 *
 * The suffix nearly doubles the width of every time on screen, and a prayer
 * time is unambiguous from its name -- nobody reads Fajr as an evening prayer.
 * The full prayer table on the Classic template still shows it.
 */
const shortTime = (date: Date, use24: boolean): string =>
  formatTime(date, use24).replace(/\s*(AM|PM)$/i, '');

/** "SUNDAY, AUG 30" -- the bar has no room for the long-form month and year. */
const shortDate = (date: Date): string => {
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
  const month = date.toLocaleDateString('en-GB', { month: 'short' });
  return `${weekday}, ${month} ${date.getDate()}`.toUpperCase();
};

export default function FocusTemplate(props: Props) {
  const { isPortrait, config, prayers, nextPrayer, activePrayer, slides, isSlideshowActive } = props;
  const [ref, { width, height }] = useElementSize<HTMLDivElement>();

  const quotes = config.quotes.enabled ? config.quotes.entries.filter((q) => q.text.trim()) : [];
  const showSlides = isSlideshowActive && slides.length > 0;

  // Rebuilt only when the available content changes, so the rotation timer in
  // usePaneRotation is not reset on every render.
  const panes = useMemo<PaneKind[]>(() => {
    const list: PaneKind[] = ['next'];
    if (quotes.length > 0) list.push('quote');
    if (showSlides) list.push('slides');
    return list;
  }, [quotes.length, showSlides]);

  const paneSeconds = clamp(config.quotes.rotationSeconds, 5, 600);
  const pane = usePaneRotation(panes, paneSeconds);

  const barHeight = isPortrait
    ? clamp(height * 0.17, 110, 260)
    : clamp(height * 0.28, 120, 320);

  const gutter = clamp(Math.min(width, height) * 0.03, 10, 28);

  return (
    <div ref={ref} className="flex h-full w-full flex-col" style={{ background: 'var(--bg)' }}>
      {/* Rotating panel. min-h-0 lets it shrink instead of pushing the bar off screen. */}
      <div className="relative min-h-0 flex-1">
        {pane === 'next' && (
          <NextPrayerPane config={config} nextPrayer={nextPrayer} activePrayer={activePrayer} />
        )}
        {pane === 'quote' && <QuotePane config={config} quotes={quotes} seconds={paneSeconds} />}
        {pane === 'slides' && (
          <div className="absolute inset-0" style={{ padding: gutter }}>
            <div className="h-full w-full overflow-hidden" style={{ borderRadius: gutter }}>
              <SlideshowPanel
                assets={slides}
                durationSeconds={config.slideshow.durationPerImageSeconds}
              />
            </div>
          </div>
        )}
      </div>

      {/* Pinned summary bar -- never rotates, never scrolls away. */}
      <div style={{ padding: '0 ' + gutter + 'px ' + gutter + 'px', flex: '0 0 auto' }}>
        <div
          style={{
            height: barHeight,
            background: 'var(--surface)',
            borderRadius: clamp(gutter * 1.2, 14, 34),
            boxShadow: '0 6px 24px ' + hexA('#000000', 0.18),
            overflow: 'hidden',
          }}
        >
          {isPortrait ? (
            <PortraitBar
              config={config}
              nextPrayer={nextPrayer}
              activePrayer={activePrayer}
              height={barHeight}
            />
          ) : (
            <LandscapeBar
              config={config}
              prayers={prayers}
              nextPrayer={nextPrayer}
              height={barHeight}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Pane rotation ─────────────────────────────────────────────

/**
 * Advances through [panes] every [seconds]. Returns the current pane, falling
 * back to 'next' so the caller never has to handle an empty list.
 */
function usePaneRotation(panes: PaneKind[], seconds: number): PaneKind {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
    if (panes.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % panes.length), seconds * 1000);
    return () => clearInterval(id);
  }, [panes, seconds]);

  return panes[index] ?? 'next';
}

// ── Panes ─────────────────────────────────────────────────────

function NextPrayerPane({
  config,
  nextPrayer,
  activePrayer,
}: {
  config: AppConfig;
  nextPrayer: PrayerConfig | null;
  activePrayer: PrayerConfig | null;
}) {
  const [ref, { width, height }] = useElementSize<HTMLDivElement>();
  const colors = resolvedColors(config.meta);
  const s = getStrings(config.features.displayLanguage);
  const prayer = activePrayer ?? nextPrayer;
  const use24 = config.features.use24HourFormat;

  const unit = scaleUnit(width, height);
  const labelFont = clamp(unit * 0.038, 10, 30);
  const nameFont = clamp(unit * 0.13, 26, 160);
  const timeFont = clamp(unit * 0.11, 20, 120);
  const chipPad = clamp(unit * 0.028, 7, 30);

  if (!prayer) return <div ref={ref} className="h-full w-full" />;

  const Chip = ({ label, time, strong }: { label: string; time: string; strong: boolean }) => (
    <div className="flex flex-col items-center" style={{ gap: chipPad * 0.5 }}>
      <div
        style={{
          fontSize: labelFont,
          letterSpacing: '0.22em',
          color: hexA(colors.primary, 0.75),
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          background: hexA(colors.primary, strong ? 0.26 : 0.16),
          borderRadius: chipPad,
          padding: chipPad * 0.5 + 'px ' + chipPad * 1.4 + 'px',
          fontSize: timeFont,
          fontWeight: 800,
          color: colors.primary,
          lineHeight: 1.05,
          whiteSpace: 'nowrap',
        }}
      >
        {time}
      </div>
    </div>
  );

  return (
    <div
      ref={ref}
      className="flex h-full w-full flex-col items-center justify-center overflow-hidden text-center"
      style={{ padding: '0 ' + chipPad + 'px' }}
    >
      <div
        style={{
          fontSize: labelFont,
          letterSpacing: '0.3em',
          color: hexA(colors.primary, 0.7),
          fontWeight: 600,
        }}
      >
        {s.nextPrayer.toUpperCase()}
      </div>
      <div
        style={{
          fontSize: nameFont,
          fontWeight: 900,
          color: colors.primary,
          lineHeight: 1.05,
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
        }}
      >
        {localizedPrayerName(
          s,
          prayer.key,
          prayer.name,
          config.features.useArabicLabels,
          config.features.displayLanguage,
        ).toUpperCase()}
      </div>

      <div className="flex items-stretch" style={{ gap: chipPad * 1.6, marginTop: chipPad }}>
        <Chip label={s.adhanTime.toUpperCase()} time={shortTime(prayer.adhanTime, use24)} strong={false} />
        {!prayer.noIqamah && (
          <>
            <div style={{ width: 1, background: hexA(colors.primary, 0.25), alignSelf: 'stretch' }} />
            <Chip label={s.iqamahTime.toUpperCase()} time={shortTime(prayer.iqamahTime, use24)} strong />
          </>
        )}
      </div>
    </div>
  );
}

function QuotePane({
  config,
  quotes,
  seconds,
}: {
  config: AppConfig;
  quotes: QuoteEntry[];
  seconds: number;
}) {
  const [ref, { width, height }] = useElementSize<HTMLDivElement>();
  const colors = resolvedColors(config.meta);
  const [index, setIndex] = useState(0);

  // One quote per visit to this pane would leave a long list barely seen, so
  // the pane cycles internally too while it is on screen.
  useEffect(() => {
    if (quotes.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % quotes.length), seconds * 1000);
    return () => clearInterval(id);
  }, [quotes.length, seconds]);

  const quote = quotes[index % quotes.length];
  if (!quote) return <div ref={ref} className="h-full w-full" />;

  const unit = scaleUnit(width, height);
  const labelFont = clamp(unit * 0.038, 10, 26);
  const textFont = clamp(unit * 0.055, 14, 60);
  const sourceFont = clamp(unit * 0.036, 10, 30);
  const pad = clamp(unit * 0.05, 12, 48);

  return (
    <div
      ref={ref}
      className="flex h-full w-full flex-col items-center justify-center text-center"
      style={{ padding: pad + 'px ' + pad * 1.6 + 'px' }}
    >
      <div
        style={{
          fontSize: labelFont,
          letterSpacing: '0.3em',
          color: hexA(colors.primary, 0.65),
          fontWeight: 600,
        }}
      >
        {config.features.displayLanguage === 'ar' ? 'حديث' : 'HADITH'}
      </div>
      <div
        style={{
          fontSize: textFont * 1.4,
          color: hexA(colors.primary, 0.3),
          lineHeight: 1,
          marginTop: pad * 0.4,
        }}
      >
        &ldquo;
      </div>

      <div
        style={{
          marginTop: pad * 0.6,
          maxWidth: '80%',
          background: hexA(colors.primary, 0.14),
          borderRadius: pad * 0.6,
          padding: pad * 0.8 + 'px ' + pad + 'px',
          fontSize: textFont,
          fontWeight: 700,
          lineHeight: 1.35,
          color: colors.primary,
        }}
      >
        {quote.text}
      </div>

      {quote.source.trim() !== '' && (
        <div
          style={{
            marginTop: pad * 0.7,
            fontSize: sourceFont,
            letterSpacing: '0.14em',
            fontWeight: 600,
            color: hexA(colors.primary, 0.65),
          }}
        >
          &mdash; {quote.source.toUpperCase()}
        </div>
      )}
    </div>
  );
}

// ── Pinned bar ────────────────────────────────────────────────

/** Clock split so the seconds can be rendered smaller than the hours/minutes. */
function BarClock({
  config,
  height,
  compact,
}: {
  config: AppConfig;
  height: number;
  compact: boolean;
}) {
  const now = useNow(1000);
  const colors = resolvedColors(config.meta);
  const use24 = config.features.use24HourFormat;

  const hours = use24 ? now.getHours() : now.getHours() % 12 || 12;
  const hh = String(hours).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  const bigFont = clamp(height * 0.36, 22, 96);
  const secFont = bigFont * 0.55;
  const dateFont = clamp(height * 0.11, 9, 26);

  const colon = (
    <span
      style={{
        fontSize: bigFont * 0.8,
        fontWeight: 700,
        color: hexA(colors.secondary, 0.55),
        lineHeight: 1,
      }}
    >
      :
    </span>
  );

  return (
    <div className="flex min-w-0 flex-col justify-center overflow-hidden">
      <div className="flex items-baseline" style={{ gap: bigFont * 0.08 }}>
        <span style={{ fontSize: bigFont, fontWeight: 900, color: 'var(--accent)', lineHeight: 1 }}>
          {hh}
        </span>
        {colon}
        <span style={{ fontSize: bigFont, fontWeight: 900, color: 'var(--accent)', lineHeight: 1 }}>
          {mm}
        </span>
        {colon}
        <span
          style={{
            fontSize: secFont,
            fontWeight: 800,
            color: hexA(colors.secondary, 0.8),
            lineHeight: 1,
          }}
        >
          {ss}
        </span>
      </div>
      <div
        style={{
          marginTop: dateFont * 0.5,
          fontSize: dateFont,
          fontWeight: 700,
          color: 'var(--accent)',
          letterSpacing: '0.04em',
          whiteSpace: 'nowrap',
        }}
      >
        {shortDate(now)}
      </div>
      {!compact && (
        <div
          style={{
            marginTop: dateFont * 0.25,
            fontSize: dateFont,
            fontWeight: 600,
            color: hexA(colors.secondary, 0.75),
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
          }}
        >
          {getHijriDate(now).toUpperCase()}
        </div>
      )}
    </div>
  );
}

function PortraitBar({
  config,
  nextPrayer,
  activePrayer,
  height,
}: {
  config: AppConfig;
  nextPrayer: PrayerConfig | null;
  activePrayer: PrayerConfig | null;
  height: number;
}) {
  const colors = resolvedColors(config.meta);
  const s = getStrings(config.features.displayLanguage);
  const prayer = activePrayer ?? nextPrayer;
  const use24 = config.features.use24HourFormat;

  const pad = clamp(height * 0.14, 8, 30);
  const nameFont = clamp(height * 0.12, 10, 28);
  const timeFont = clamp(height * 0.2, 14, 52);

  return (
    <div className="flex h-full w-full items-center" style={{ padding: '0 ' + pad + 'px', gap: pad }}>
      <div className="min-w-0 flex-1">
        <BarClock config={config} height={height} compact={false} />
      </div>

      <div
        style={{
          width: 1,
          alignSelf: 'stretch',
          margin: pad * 0.6 + 'px 0',
          background: hexA(colors.secondary, 0.2),
        }}
      />

      {prayer && (
        <div className="flex flex-col items-center justify-center" style={{ gap: height * 0.04 }}>
          <div
            style={{
              fontSize: nameFont,
              fontWeight: 800,
              letterSpacing: '0.1em',
              color: 'var(--accent)',
              whiteSpace: 'nowrap',
            }}
          >
            {localizedPrayerName(
              s,
              prayer.key,
              prayer.name,
              config.features.useArabicLabels,
              config.features.displayLanguage,
            ).toUpperCase()}
          </div>
          <div
            style={{
              fontSize: timeFont,
              fontWeight: 900,
              color: 'var(--accent)',
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
          >
            {shortTime(prayer.adhanTime, use24)}
          </div>
          {!prayer.noIqamah && (
            <div
              style={{
                background: 'var(--accent)',
                color: 'var(--surface)',
                borderRadius: 999,
                padding: height * 0.02 + 'px ' + height * 0.08 + 'px',
                fontSize: timeFont * 0.72,
                fontWeight: 900,
                lineHeight: 1.15,
                whiteSpace: 'nowrap',
              }}
            >
              {shortTime(prayer.iqamahTime, use24)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LandscapeBar({
  config,
  prayers,
  nextPrayer,
  height,
}: {
  config: AppConfig;
  prayers: PrayerConfig[];
  nextPrayer: PrayerConfig | null;
  height: number;
}) {
  const colors = resolvedColors(config.meta);
  const s = getStrings(config.features.displayLanguage);
  const use24 = config.features.use24HourFormat;

  const pad = clamp(height * 0.12, 10, 30);
  const nameFont = clamp(height * 0.11, 9, 24);
  const timeFont = clamp(height * 0.21, 14, 46);

  return (
    <div className="flex h-full w-full items-stretch" style={{ padding: '0 ' + pad + 'px' }}>
      <div className="flex items-center" style={{ paddingRight: pad }}>
        {/* The hijri line is dropped here: the landscape bar already carries six
            prayer columns, and a third date line squeezes the clock too small. */}
        <BarClock config={config} height={height} compact />
      </div>

      <div style={{ width: 1, margin: pad + 'px 0', background: hexA(colors.secondary, 0.2) }} />

      <div className="flex min-w-0 flex-1 items-center">
        {prayers.map((p, i) => {
          const isNext = nextPrayer?.key === p.key;
          return (
            <div key={p.key} className="flex min-w-0 flex-1 items-center">
              {i > 0 && (
                <div
                  style={{
                    width: 1,
                    alignSelf: 'stretch',
                    margin: pad + 'px 0',
                    background: hexA(colors.secondary, 0.14),
                  }}
                />
              )}
              <div
                className="flex min-w-0 flex-1 flex-col items-center justify-center"
                style={{
                  gap: height * 0.03,
                  background: isNext ? 'var(--accent)' : 'transparent',
                  borderRadius: isNext ? pad : 0,
                  padding: height * 0.07 + 'px ' + pad * 0.3 + 'px',
                  margin: pad * 0.5 + 'px ' + pad * 0.15 + 'px',
                }}
              >
                <div
                  style={{
                    fontSize: nameFont,
                    fontWeight: 800,
                    letterSpacing: '0.1em',
                    color: isNext ? 'var(--surface)' : 'var(--accent)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {localizedPrayerName(
                    s,
                    p.key,
                    p.name,
                    config.features.useArabicLabels,
                    config.features.displayLanguage,
                  ).toUpperCase()}
                </div>
                <div
                  style={{
                    fontSize: timeFont,
                    fontWeight: 900,
                    lineHeight: 1,
                    color: isNext ? 'var(--surface)' : 'var(--accent)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {shortTime(p.adhanTime, use24)}
                </div>
                <div
                  style={{
                    background: isNext ? hexA('#FFFFFF', 0.25) : hexA(colors.secondary, 0.12),
                    color: isNext ? 'var(--surface)' : hexA(colors.secondary, 0.9),
                    borderRadius: pad * 0.4,
                    padding: height * 0.015 + 'px ' + pad * 0.5 + 'px',
                    fontSize: timeFont * 0.6,
                    fontWeight: 800,
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.noIqamah ? '--' : shortTime(p.iqamahTime, use24)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
