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
 * Panes rotate in order: full prayer table -> next prayer -> quotes, and the
 * slideshow takes the panel over for the whole of its phase, laid out by the
 * admin's slideshow display mode: full_screen fills the panel, split_screen
 * halves it with the rotating content, corner_overlay floats a small pane over
 * the content in the configured corner. A pane with no content is skipped
 * rather than rendered empty, so a mosque that has added no quotes simply
 * alternates the table with the next-prayer card.
 *
 * The table pane is portrait-only: in landscape the pinned bar already carries
 * every prayer as a column, so repeating it above would say the same thing
 * twice on one screen.
 */
import { CSSProperties, JSX, useEffect, useMemo, useState } from 'react';
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

type PaneKind = 'list' | 'next' | 'quote';

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
  const slideMode = config.slideshow.displayMode;

  // Rebuilt only when the available content changes, so the rotation timer in
  // usePaneRotation is not reset on every render.
  //
  // The slideshow phase is not a turn in the rotation: the store already decides
  // how long slides run, and cutting away mid-phase would unmount
  // SlideshowPanel and restart the album from its first image every time the
  // rotation came back round. Only full_screen suppresses the content rotation
  // outright -- the other two modes keep it running beside or beneath the
  // slides.
  const panes = useMemo<PaneKind[]>(() => {
    const list: PaneKind[] = isPortrait ? ['list', 'next'] : ['next'];
    if (quotes.length > 0) list.push('quote');
    return list;
  }, [isPortrait, quotes.length]);

  const paneSeconds = clamp(config.quotes.rotationSeconds, 5, 600);
  const pane = usePaneRotation(panes, paneSeconds);

  const barHeight = isPortrait
    ? clamp(height * 0.17, 110, 260)
    : clamp(height * 0.28, 120, 320);

  const gutter = clamp(Math.min(width, height) * 0.03, 10, 28);

  const content = (
    <>
      {pane === 'list' && (
        <PrayerListPane
          config={config}
          prayers={prayers}
          nextPrayer={nextPrayer}
          activePrayer={activePrayer}
        />
      )}
      {pane === 'next' && (
        <NextPrayerPane config={config} nextPrayer={nextPrayer} activePrayer={activePrayer} />
      )}
      {pane === 'quote' && <QuotePane config={config} quotes={quotes} seconds={paneSeconds} />}
    </>
  );

  const slideshow = (
    <div className="h-full w-full overflow-hidden" style={{ borderRadius: gutter }}>
      <SlideshowPanel assets={slides} durationSeconds={config.slideshow.durationPerImageSeconds} />
    </div>
  );

  // The overlay is sized off the panel's own width, not the screen's, so the
  // admin's percentage means the same thing here as it does on the classic
  // template.
  const overlayWidth = clamp((width * config.slideshow.overlaySizePercent) / 100, 90, width - gutter * 2);
  const corner = config.slideshow.overlayCorner;
  const overlayStyle: CSSProperties = {
    position: 'absolute',
    top: corner.startsWith('top') ? gutter : undefined,
    bottom: corner.startsWith('bottom') ? gutter : undefined,
    left: corner.endsWith('left') ? gutter : undefined,
    right: corner.endsWith('right') ? gutter : undefined,
    width: overlayWidth,
    height: (overlayWidth * 9) / 16,
  };

  let panel: JSX.Element;
  if (showSlides && slideMode === 'full_screen') {
    panel = (
      <div className="absolute inset-0" style={{ padding: gutter }}>
        {slideshow}
      </div>
    );
  } else if (showSlides && slideMode === 'split_screen') {
    // Portrait stacks (slides above, times below); landscape sits them side by
    // side, which is the only split that leaves either half a usable shape.
    panel = (
      <div
        className={'flex h-full w-full ' + (isPortrait ? 'flex-col' : 'flex-row')}
        style={{ padding: gutter, gap: gutter }}
      >
        <div className="min-h-0 min-w-0 flex-1">{slideshow}</div>
        <div className="relative min-h-0 min-w-0 flex-1">{content}</div>
      </div>
    );
  } else if (showSlides && slideMode === 'corner_overlay') {
    panel = (
      <>
        {content}
        <div style={overlayStyle}>{slideshow}</div>
      </>
    );
  } else {
    panel = content;
  }

  return (
    <div ref={ref} className="flex h-full w-full flex-col" style={{ background: 'var(--bg)' }}>
      {/* Rotating panel. min-h-0 lets it shrink instead of pushing the bar off screen. */}
      <div className="relative min-h-0 flex-1">{panel}</div>

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

/**
 * Every prayer of the day as a stack of rounded rows: name, adhan, iqamah.
 *
 * The current prayer's row is inverted -- accent fill, surface-coloured text --
 * rather than merely tinted, so it is the one row readable from the back of the
 * hall. Rows share the vertical space equally and the type scale is derived
 * from the row height, so seven rows on a phone and six on a tall TV both fill
 * the pane without clipping.
 */
function PrayerListPane({
  config,
  prayers,
  nextPrayer,
  activePrayer,
}: {
  config: AppConfig;
  prayers: PrayerConfig[];
  nextPrayer: PrayerConfig | null;
  activePrayer: PrayerConfig | null;
}) {
  const [ref, { width, height }] = useElementSize<HTMLDivElement>();
  const colors = resolvedColors(config.meta);
  const s = getStrings(config.features.displayLanguage);
  const use24 = config.features.use24HourFormat;

  const pad = clamp(Math.min(width, height) * 0.035, 10, 32);
  // The header takes roughly one row's worth of height; the rest is split
  // evenly between the prayers.
  const rowH = height > 0 ? (height - pad * 2) / (prayers.length + 1.15) : 56;
  const gap = clamp(rowH * 0.14, 4, 16);
  const radius = clamp(rowH * 0.28, 10, 26);

  // Height alone is not enough to size the type. A row is name(3) + adhan(2) +
  // iqamah(2) across, so on a phone -- tall rows, narrow columns -- a font
  // picked to fill the row's height overflows its column's width, and since the
  // time cells cannot shrink below their own text the two columns run into each
  // other ("5:055:30"). Bound every scale by the width its column actually has.
  const contentW = width > 0 ? Math.max(width - pad * 3.2, 0) : 0;
  const colW = (units: number) => (contentW * units) / 7;
  // Rough advance width of a heavy sans, in em: digits and colons run narrow,
  // capitals wider, and the column labels carry 0.16em of tracking on top. The
  // 0.92 keeps a little slack -- the real face is not the one measured here.
  const fits = (px: number, chars: number, em: number) =>
    px > 0 ? (px * 0.92) / (chars * em) : Infinity;

  const nameFont = clamp(Math.min(rowH * 0.42, fits(colW(3), 8, 0.72)), 12, 46);
  const timeFont = clamp(Math.min(rowH * 0.5, fits(colW(2), 5, 0.62)), 14, 58);
  const titleFont = clamp(rowH * 0.44, 13, 48);
  const labelFont = clamp(Math.min(rowH * 0.24, fits(colW(2), 6, 0.88)), 9, 24);

  return (
    <div
      ref={ref}
      className="flex h-full w-full flex-col overflow-hidden"
      style={{ padding: pad, gap }}
    >
      {/* Masjid identity doubles as the column header strip: the two time
          columns are labelled once, above the rows they belong to. */}
      <div className="flex items-start" style={{ padding: '0 ' + pad * 0.6 + 'px' }}>
        <div className="min-w-0 flex-[3]">
          <div
            style={{
              fontSize: titleFont,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: '0.01em',
              color: colors.primary,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
            }}
          >
            {config.profile.name.toUpperCase()}
          </div>
          {config.profile.nameArabic?.trim() && (
            <div
              style={{
                marginTop: labelFont * 0.25,
                fontSize: labelFont,
                fontWeight: 600,
                letterSpacing: '0.08em',
                color: hexA(colors.primary, 0.7),
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {config.profile.nameArabic}
            </div>
          )}
        </div>
        <ColumnLabel text={s.headerAdhan.toUpperCase()} font={labelFont} color={colors.primary} />
        <ColumnLabel text={s.headerIqamah.toUpperCase()} font={labelFont} color={colors.primary} />
      </div>

      {prayers.map((p) => {
        const highlighted = activePrayer?.key === p.key || nextPrayer?.key === p.key;
        const fg = highlighted ? 'var(--surface)' : colors.primary;
        return (
          <div
            key={p.key}
            className="flex min-h-0 flex-1 items-center transition-colors duration-300"
            style={{
              background: highlighted ? 'var(--accent)' : hexA(colors.primary, 0.16),
              borderRadius: radius,
              padding: '0 ' + pad * 0.6 + 'px',
              boxShadow: highlighted ? '0 6px 20px ' + hexA('#000000', 0.22) : 'none',
            }}
          >
            <div
              className="min-w-0 flex-[3]"
              style={{
                fontSize: nameFont,
                fontWeight: 800,
                letterSpacing: '0.02em',
                color: fg,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
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
            <TimeCell text={shortTime(p.adhanTime, use24)} font={timeFont} color={fg} />
            {p.noIqamah ? (
              // A dash rather than a blank keeps the column aligned and says
              // explicitly that Shuruq has no congregation.
              <TimeCell text="--" font={timeFont * 0.6} color={hexA(colors.primary, 0.45)} />
            ) : (
              <TimeCell text={shortTime(p.iqamahTime, use24)} font={timeFont} color={fg} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ColumnLabel({ text, font, color }: { text: string; font: number; color: string }) {
  return (
    // min-w-0: a flex item defaults to min-width:auto, which for nowrap text is
    // the width of the text -- the column would push its neighbour aside rather
    // than give, so a font a shade too large collides instead of clipping.
    <div
      className="min-w-0 flex-[2] overflow-hidden text-center"
      style={{
        fontSize: font,
        fontWeight: 800,
        letterSpacing: '0.16em',
        color: hexA(color, 0.85),
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  );
}

function TimeCell({ text, font, color }: { text: string; font: number; color: string }) {
  return (
    // min-w-0 for the same reason as ColumnLabel: without it the adhan and
    // iqamah cells overflow into one another and the two times read as one.
    <div
      className="min-w-0 flex-[2] overflow-hidden text-center"
      style={{
        fontSize: font,
        fontWeight: 900,
        lineHeight: 1,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  );
}

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
