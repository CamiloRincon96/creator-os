import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fileUrl } from '../api';
import { setStore, useStore } from '../state';
import { usePlayer } from '../engine/player';
import type { VersionFile, Media, Note } from '../types';
import { clamp, isTyping } from '../util';
import { DrawingLayer, Shapes, SafeZones } from './Shapes';

// Previews loaded fully into memory: seeks never touch the network.
const blobs = new Map<string, string>();
async function blobOf(url: string) {
  const cached = blobs.get(url);
  if (cached) {
    blobs.delete(url);
    blobs.set(url, cached);
    return cached;
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const u = URL.createObjectURL(await r.blob());
  blobs.set(url, u);
  while (blobs.size > 5) {
    const [k, v] = blobs.entries().next().value as [string, string];
    URL.revokeObjectURL(v);
    blobs.delete(k);
  }
  return u;
}

/** Video source: the original while the preview is being prepared; then the preview in memory. */
function useSource(media: Media | undefined, original: string | null) {
  const preview = media?.urls?.preview || null;
  const [src, setSrc] = useState<string | null>(() => (preview && blobs.get(preview)) || null);
  useEffect(() => {
    let alive = true;
    if (preview) {
      const cached = blobs.get(preview);
      if (cached) setSrc(cached);
      else {
        setSrc((previous) => previous ?? original);
        blobOf(preview)
          .then((u) => alive && setSrc(u))
          .catch(() => alive && setSrc(preview));
      }
    } else setSrc(original);
    return () => {
      alive = false;
    };
  }, [preview, original]);
  return src;
}

const GAP = 24;

interface Props {
  project: string;
  file: VersionFile;
  media: Media | undefined;
  label: string;
  b?: { file: VersionFile; media: Media | undefined; label: string } | null;
  note: Note | null;
  noteFromOtherVersion: boolean;
}

export function Viewer({ project, file, media, label, b, note, noteFromOtherVersion }: Props) {
  const player = usePlayer();
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [view, setView] = useState<{ s: number; tx: number; ty: number } | null>(null);
  const mode = useStore((s) => s.compareMode);
  const curtain = useStore((s) => s.curtain);
  const muted = useStore((s) => s.muted);
  const playing = useStore((s) => s.playing);
  const draft = useStore((s) => s.draft);
  const tool = useStore((s) => s.tool);

  const W = file.meta.width || 1080;
  const H = file.meta.height || 1920;
  const isVideo = file.type === 'video';
  const side = !!b && mode === 'side';
  const sheetWidth = side ? W * 2 + GAP : W;

  useLayoutEffect(() => {
    const el = container.current!;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  useEffect(() => setView(null), [W, H, side]);

  const fit = Math.max(0.02, Math.min((size.w - 40) / sheetWidth, (size.h - 40) / H));
  const v = view || { s: fit, tx: (size.w - sheetWidth * fit) / 2, ty: (size.h - H * fit) / 2 };
  const k = 1 / v.s;

  const src = useSource(isVideo ? media : undefined, isVideo ? fileUrl(project, file.path) : null);
  const bVideo = b?.file.type === 'video';
  const srcB = useSource(bVideo ? b!.media : undefined, bVideo ? fileUrl(project, b!.file.path) : null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoRefB = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    player.attach(isVideo ? videoRef.current : null);
  }, [player, isVideo]);
  useEffect(() => {
    player.attachSecondary(bVideo ? videoRefB.current : null);
    return () => player.attachSecondary(null);
  }, [player, bVideo, b?.file.path]);
  useEffect(() => {
    if (isVideo) player.configure(file.meta.fps, file.meta.duration);
  }, [player, isVideo, file.meta.fps, file.meta.duration]);

  // Zoom with pinch / Cmd+wheel around the pointer; the wheel alone pans if zoomed in.
  const wheel = (e: React.WheelEvent) => {
    const r = container.current!.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    if (e.ctrlKey || e.metaKey) {
      const s = clamp(v.s * Math.exp(-e.deltaY * 0.01), fit * 0.5, 8);
      setView({ s, tx: px - (px - v.tx) * (s / v.s), ty: py - (py - v.ty) * (s / v.s) });
    } else if (view) setView({ ...v, tx: v.tx - e.deltaX, ty: v.ty - e.deltaY });
  };

  // With the pointer: a click plays/pauses; dragging pans (if zoomed in). The middle button always pans.
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);
  const down = (e: React.PointerEvent) => {
    if (e.button === 1 || (e.button === 0 && tool === 'pointer')) {
      e.preventDefault();
      drag.current = { x: e.clientX, y: e.clientY, tx: v.tx, ty: v.ty, moved: false };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };
  const move = (e: React.PointerEvent) => {
    const a = drag.current;
    if (!a) return;
    const dx = e.clientX - a.x;
    const dy = e.clientY - a.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) a.moved = true;
    if (a.moved && (view || e.button === 1)) setView({ s: v.s, tx: a.tx + dx, ty: a.ty + dy });
  };
  const release = (e: React.PointerEvent) => {
    const a = drag.current;
    drag.current = null;
    if (a && !a.moved && e.button === 0 && isVideo && !(e.target as HTMLElement).closest('.curtain')) player.toggle();
  };

  // Z: fit to window · Shift+Z: 100 %.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (isTyping(e) || e.metaKey || e.ctrlKey) return;
      if (e.key === 'z') setView(null);
      if (e.key === 'Z') setView({ s: 1, tx: (size.w - sheetWidth) / 2, ty: (size.h - H) / 2 });
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [size.w, size.h, sheetWidth, H]);

  const showNoteShapes = note && !draft && !playing && note.shapes.length > 0;
  const preparing = isVideo && media && !media.urls?.preview && media.preparing;

  return (
    <div
      className="viewer"
      ref={container}
      data-tool={tool}
      onWheel={wheel}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={release}
      onDoubleClick={() => tool === 'pointer' && setView(null)}
    >
      <div className="sheet" style={{ width: sheetWidth, height: H, transform: `translate(${v.tx}px, ${v.ty}px) scale(${v.s})` }}>
        {b && (
          <div className="layer layer-b" style={{ left: side ? W + GAP : 0, width: W, height: H }}>
            {bVideo ? (
              <video ref={videoRefB} src={srcB || undefined} muted playsInline preload="auto" />
            ) : (
              <img src={fileUrl(project, b.file.path)} alt="" draggable={false} />
            )}
          </div>
        )}
        <div className="layer layer-a" style={{ left: 0, width: W, height: H, clipPath: b && !side ? `inset(0 ${(1 - curtain) * 100}% 0 0)` : undefined }}>
          {isVideo ? (
            <video ref={videoRef} src={src || undefined} muted={muted} playsInline preload="auto" />
          ) : (
            <img src={fileUrl(project, file.path)} alt="" draggable={false} />
          )}
        </div>
        <div className="layer layer-over" style={{ left: 0, width: W, height: H }}>
          <SafeZones width={W} height={H} />
          {showNoteShapes && <Shapes shapes={note!.shapes} width={W} height={H} dim={noteFromOtherVersion} />}
          <DrawingLayer width={W} height={H} scale={v.s} />
        </div>
        {b && !side && <Curtain width={W} height={H} scale={v.s} />}
        {b && (
          <>
            <span className="version-label" style={{ left: 12 * k, top: 12 * k, transform: `scale(${k})`, transformOrigin: 'top left' }}>
              {label}
            </span>
            <span
              className="version-label b"
              style={
                side
                  ? { left: W + GAP + 12 * k, top: 12 * k, transform: `scale(${k})`, transformOrigin: 'top left' }
                  : { left: W - 12 * k, top: 12 * k, translate: '-100% 0', transform: `scale(${k})`, transformOrigin: 'top right' }
              }
            >
              {b.label}
            </span>
          </>
        )}
      </div>
      {preparing && (
        <div className="viewer-notice">
          Preparing smooth preview… {Math.round((media!.progress || 0) * 100)}%
          <small>Meanwhile the original plays.</small>
        </div>
      )}
      {media?.error && <div className="viewer-notice error">The preview could not be prepared: {media.error}</div>}
      {view && (
        <button className="floating-btn" onClick={() => setView(null)} title="Fit to window (Z)">
          {Math.round(v.s * 100)} % · Fit
        </button>
      )}
    </div>
  );
}

/** Curtain line for comparing: drag it with the pointer. */
function Curtain({ width, height, scale }: { width: number; height: number; scale: number }) {
  const curtain = useStore((s) => s.curtain);
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    if (!(e.buttons & 1)) return;
    const r = ref.current!.parentElement!.getBoundingClientRect();
    setStore({ curtain: clamp((e.clientX - r.left) / (width * scale), 0, 1) });
  };
  return (
    <div
      ref={ref}
      className="curtain"
      style={{ left: curtain * width, height, width: 2 / scale, marginLeft: -1 / scale }}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={move}
    >
      <span className="curtain-grip" style={{ transform: `translate(-50%, -50%) scale(${1 / scale})` }} />
    </div>
  );
}
