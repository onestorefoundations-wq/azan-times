/**
 * Ticker.tsx
 * Scrolling marquee bar. Port of the Marquee in tv_display.dart.
 * Speed is pixels/second (matches TickerSettings.speed → Marquee velocity).
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { AppConfig, resolvedColors } from '../core/appConfig';
import { clamp } from '../hooks/useElementSize';

interface Props {
  config: AppConfig;
  heightPx: number;
}

export default function Ticker({ config, heightPx }: Props) {
  const colors = resolvedColors(config.meta);
  const fontSize = clamp(heightPx * 0.44, 13, 32);
  const text = config.ticker.messages.join('        •        ');
  const speed = Math.max(5, config.ticker.speed); // px/sec

  const trackRef = useRef<HTMLDivElement>(null);
  const [durationSec, setDurationSec] = useState(20);

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    // Track holds two copies; one copy is half the scrollWidth.
    const singleWidth = el.scrollWidth / 2;
    if (singleWidth > 0) setDurationSec(singleWidth / speed);
  }, [text, speed]);

  return (
    <div
      className="w-full overflow-hidden"
      style={{
        height: heightPx,
        background: 'var(--c-ticker-bg, #0A1628)',
        borderTop: '1.5px solid var(--surface, #1E293B)',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div
        ref={trackRef}
        style={{
          display: 'inline-flex',
          whiteSpace: 'nowrap',
          willChange: 'transform',
          ['--marquee-shift' as string]: '-50%',
          animation: `marquee-scroll ${durationSec}s linear infinite`,
        }}
      >
        <span style={{ fontSize, fontWeight: 600, color: colors.ticker, letterSpacing: 0.3, paddingLeft: 16, paddingRight: 120 }}>
          {text}
        </span>
        <span style={{ fontSize, fontWeight: 600, color: colors.ticker, letterSpacing: 0.3, paddingLeft: 16, paddingRight: 120 }}>
          {text}
        </span>
      </div>
    </div>
  );
}
