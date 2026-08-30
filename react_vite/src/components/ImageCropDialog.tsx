/**
 * ImageCropDialog.tsx
 * Fits an imported image to the frame it will actually be shown in.
 *
 * Media picked from a phone is almost never the shape of a TV. Without this the
 * display either letterboxes a 4:3 photo onto a 16:9 screen or crops it
 * arbitrarily, and the admin has no say in which part survives. Here they pan,
 * zoom and rotate against a live outline of the real frame, and what they see
 * inside the outline is exactly what is saved.
 *
 * The preview is CSS-transformed for smoothness; Apply replays the same
 * transform onto a canvas, so preview and output cannot drift apart.
 */
import { useEffect, useRef, useState } from 'react';

interface Props {
  file: File;
  /** Frame shape to fit, e.g. 16/9 for a landscape display. */
  aspect: number;
  /** Position in the queue, for the "Image 2 of 3" hint. */
  index: number;
  total: number;
  onApply: (result: File) => void;
  onSkip: () => void;
  onCancel: () => void;
}

/** Longest edge of the exported image. Bigger than any display, small enough to upload. */
const MAX_OUTPUT_EDGE = 1920;

const MIN_SCALE = 0.2;
const MAX_SCALE = 8;

export default function ImageCropDialog({
  file,
  aspect,
  index,
  total,
  onApply,
  onSkip,
  onCancel,
}: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [rotation, setRotation] = useState(0); // degrees, always a multiple of 90
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [busy, setBusy] = useState(false);

  const frameRef = useRef<HTMLDivElement>(null);
  const objectUrl = useRef<string | null>(null);

  // Load the picked file. The object URL is revoked on unmount so a long
  // import session does not leak one blob per image.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    objectUrl.current = url;
    const image = new Image();
    image.onload = () => setImg(image);
    image.src = url;
    return () => {
      URL.revokeObjectURL(url);
      objectUrl.current = null;
    };
  }, [file]);

  // Measure the frame, which is sized by the viewport rather than fixed.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setFrame({ width: el.clientWidth, height: el.clientHeight });
    measure();
    // Same ResizeObserver guard as useElementSize -- see the note there.
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [img]);

  /** Smallest scale that still covers the frame at the current rotation. */
  const coverScale = (): number => {
    if (!img || !frame.width || !frame.height) return 1;
    const swapped = rotation % 180 !== 0;
    const w = swapped ? img.naturalHeight : img.naturalWidth;
    const h = swapped ? img.naturalWidth : img.naturalHeight;
    return Math.max(frame.width / w, frame.height / h);
  };

  // Reset to a covering fit whenever the image or rotation changes, so the
  // frame is never showing empty space after a rotate.
  useEffect(() => {
    if (!img || !frame.width || !frame.height) return;
    setScale(coverScale());
    setOffset({ x: 0, y: 0 });
    // coverScale is derived from these; listing it would re-run on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, rotation, frame.width, frame.height]);

  // ── Gestures ────────────────────────────────────────────────
  //
  // Pointer events cover mouse drag and touch pan with one code path; two
  // active pointers switch to pinch. Tracked in a ref so a move does not
  // re-render before the state update lands.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);

  const distance = (): number => {
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) pinchStart.current = { dist: distance(), scale };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size >= 2 && pinchStart.current) {
      const d = distance();
      if (d > 0 && pinchStart.current.dist > 0) {
        const next = clampScale((pinchStart.current.scale * d) / pinchStart.current.dist);
        setScale(next);
      }
      return;
    }

    setOffset((o) => ({ x: o.x + (e.clientX - prev.x), y: o.y + (e.clientY - prev.y) }));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    setScale((s) => clampScale(s * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
  };

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  const reset = () => {
    setRotation(0);
    setScale(coverScale());
    setOffset({ x: 0, y: 0 });
  };

  // ── Export ──────────────────────────────────────────────────

  const apply = async () => {
    if (!img || !frame.width) return;
    setBusy(true);
    try {
      // Output keeps the frame's aspect exactly; only the pixel size differs.
      const outW = Math.round(
        aspect >= 1 ? MAX_OUTPUT_EDGE : MAX_OUTPUT_EDGE * aspect,
      );
      const outH = Math.round(aspect >= 1 ? MAX_OUTPUT_EDGE / aspect : MAX_OUTPUT_EDGE);

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas unavailable');

      // Preview coordinates are in frame pixels; scale them up to output pixels.
      const k = outW / frame.width;

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, outW, outH);

      ctx.translate(outW / 2 + offset.x * k, outH / 2 + offset.y * k);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(scale * k, scale * k);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.9),
      );
      if (!blob) throw new Error('encode failed');

      // Re-encoded as JPEG, so the extension has to follow or the server
      // stores a .png that is really a JPEG.
      const base = file.name.replace(/\.[^.]+$/, '');
      onApply(new File([blob], `${base}.jpg`, { type: 'image/jpeg' }));
    } finally {
      setBusy(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────

  const btn: React.CSSProperties = {
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.25)',
    background: 'rgba(255,255,255,0.08)',
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(3,7,18,0.92)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: 16,
      }}
    >
      <div style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 700 }}>
        Fit to frame
        {total > 1 && (
          <span style={{ marginLeft: 8, fontWeight: 500, opacity: 0.6 }}>
            Image {index + 1} of {total}
          </span>
        )}
      </div>
      <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, textAlign: 'center' }}>
        Drag to move · pinch or scroll to zoom · anything inside the frame is kept
      </div>

      {/* The frame is the crop. Sized to the viewport but locked to the target
          aspect, so what is inside is literally what gets saved. */}
      <div
        ref={frameRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        style={{
          position: 'relative',
          // Height is constrained by folding it into the width so the ratio
          // survives; capping maxHeight instead reshapes the frame, and then
          // the outline no longer matches the display it stands for.
          width: `min(86vw, 900px, ${58 * aspect}vh)`,
          aspectRatio: String(aspect),
          overflow: 'hidden',
          borderRadius: 10,
          background: '#000000',
          border: '2px solid rgba(255,255,255,0.85)',
          touchAction: 'none',
          cursor: 'grab',
        }}
      >
        {img && (
          <img
            src={img.src}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: img.naturalWidth,
              height: img.naturalHeight,
              // Tailwind's preflight applies max-width:100% to every img. That
              // silently clamps the box below naturalWidth, and the cover
              // scale is then computed against a size the image does not have.
              maxWidth: 'none',
              maxHeight: 'none',
              transformOrigin: 'center center',
              transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${scale})`,
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button style={btn} onClick={() => setRotation((r) => (r + 270) % 360)}>
          ↺ Rotate left
        </button>
        <button style={btn} onClick={() => setRotation((r) => (r + 90) % 360)}>
          ↻ Rotate right
        </button>
        <button style={btn} onClick={() => setScale((s) => clampScale(s * 1.2))}>
          ＋ Zoom in
        </button>
        <button style={btn} onClick={() => setScale((s) => clampScale(s / 1.2))}>
          － Zoom out
        </button>
        <button style={btn} onClick={reset}>
          Reset
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button style={btn} onClick={onCancel} disabled={busy}>
          Cancel all
        </button>
        {total > 1 && (
          <button style={btn} onClick={onSkip} disabled={busy}>
            Use original
          </button>
        )}
        <button
          onClick={apply}
          disabled={!img || busy}
          style={{
            ...btn,
            background: 'var(--accent)',
            borderColor: 'var(--accent)',
            color: '#FFFFFF',
            opacity: !img || busy ? 0.6 : 1,
          }}
        >
          {busy ? 'Saving…' : 'Apply'}
        </button>
      </div>
    </div>
  );
}
