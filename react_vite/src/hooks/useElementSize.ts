import { RefObject, useLayoutEffect, useRef, useState } from 'react';

export interface Size {
  width: number;
  height: number;
}

/**
 * Measures an element via ResizeObserver. Lets components reproduce the
 * Flutter LayoutBuilder + clamp() responsive font scaling pixel-for-pixel.
 */
export function useElementSize<T extends HTMLElement>(): [RefObject<T>, Size] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();

    // ResizeObserver is Chrome 64+. Android TV boxes ship System WebViews well
    // older than their Android version, and an unguarded constructor throws
    // during layout, unmounts the tree and leaves the screen blank. A window
    // resize listener misses element-only changes, which on a fixed-size kiosk
    // is a fair trade for rendering at all.
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      window.addEventListener('orientationchange', update);
      return () => {
        window.removeEventListener('resize', update);
        window.removeEventListener('orientationchange', update);
      };
    }

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, size];
}

/** Clamp helper matching Dart's num.clamp(lo, hi). */
export const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));
