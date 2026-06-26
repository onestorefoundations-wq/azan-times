/**
 * SlideshowPanel.tsx
 * Port of flutter_app/lib/widgets/slideshow_panel_widget.dart.
 * Auto-advancing crossfade slideshow with dot indicators.
 */
import { useEffect, useRef, useState } from 'react';
import { SlideAsset } from '../core/appConfig';
import { clamp } from '../hooks/useElementSize';

interface Props {
  assets: SlideAsset[];
  durationSeconds: number;
}

export default function SlideshowPanel({ assets, durationSeconds }: Props) {
  const [index, setIndex] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (assets.length <= 1) return;
    const ms = clamp(durationSeconds, 1, 999) * 1000;
    timer.current = setInterval(() => {
      setIndex((i) => (i + 1) % assets.length);
    }, ms);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [assets.length, durationSeconds]);

  // Reset index if asset list shrank.
  useEffect(() => {
    if (index >= assets.length) setIndex(0);
  }, [assets.length, index]);

  if (assets.length === 0) return null;

  return (
    <div className="relative h-full w-full overflow-hidden bg-bg-primary">
      {assets.map((asset, i) => (
        <img
          key={asset.id || asset.localPath}
          src={asset.localPath}
          alt={asset.filename}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
          style={{ opacity: i === index ? 1 : 0 }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.opacity = '0';
          }}
        />
      ))}

      {/* Dot indicators */}
      {assets.length > 1 && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
          {assets.map((_, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === index ? 20 : 6,
                background: i === index ? '#14B8A6' : 'rgba(255,255,255,0.3)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
