import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Circle,
  MapPin,
  Maximize,
  MousePointer2,
  Pause,
  Pencil,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  Square,
  Trash2,
  Type,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { COLORS } from '../../../shared/shapes.js';
import { zonesFor } from '../../../shared/formats.js';
import { readableTime, timecode } from '../../../shared/time.js';
import { setStore, getStore, useStore, type Tool } from '../state';
import { usePlayer } from '../engine/player';
import { clock } from '../clock';
import { CMD, cx } from '../util';

const TOOLS: { id: Tool; icon: React.ReactNode; name: string; key: string }[] = [
  { id: 'pointer', icon: <MousePointer2 size={17} />, name: 'Pointer', key: 'V' },
  { id: 'rect', icon: <Square size={17} />, name: 'Rectangle', key: 'R' },
  { id: 'ellipse', icon: <Circle size={17} />, name: 'Circle', key: 'E' },
  { id: 'arrow', icon: <ArrowUpRight size={17} />, name: 'Arrow', key: 'A' },
  { id: 'stroke', icon: <Pencil size={17} />, name: 'Pencil', key: 'P' },
  { id: 'text', icon: <Type size={17} />, name: 'Text', key: 'T' },
  { id: 'pin', icon: <MapPin size={17} />, name: 'Point', key: 'N' },
];

export const TOOL_KEYS: Record<string, Tool> = Object.fromEntries(TOOLS.map((h) => [h.key.toLowerCase(), h.id]));

export function Tools() {
  const tool = useStore((s) => s.tool);
  const color = useStore((s) => s.color);
  const draft = useStore((s) => s.draft);
  const hasShapes = !!draft?.shapes.length;
  return (
    <div className="tools" role="toolbar" aria-label="Drawing" aria-orientation="vertical" onPointerDown={(e) => e.stopPropagation()}>
      {TOOLS.map((h) => (
        <button
          key={h.id}
          className={cx('tool', tool === h.id && 'active')}
          title={`${h.name} (${h.key})`}
          aria-label={h.name}
          aria-pressed={tool === h.id}
          onClick={() => setStore({ tool: h.id })}
        >
          {h.icon}
        </button>
      ))}
      <span className="tool-sep" />
      {COLORS.map((c: string) => (
        <button key={c} className={cx('swatch', color === c && 'active')} style={{ background: c }} title="Drawing color" aria-label={`Color ${c}`} aria-pressed={color === c} onClick={() => setStore({ color: c })} />
      ))}
      <span className="tool-sep" />
      <button className="tool" title={`Undo stroke (${CMD}+Z)`} aria-label="Undo stroke" disabled={!hasShapes} onClick={undoShape}>
        <Undo2 size={17} />
      </button>
      <button className="tool" title="Clear drawing" aria-label="Clear drawing" disabled={!hasShapes} onClick={() => draft && setStore({ draft: { ...draft, shapes: [] } })}>
        <Trash2 size={17} />
      </button>
    </div>
  );
}

export function undoShape() {
  const b = getStore().draft;
  if (b?.shapes.length) setStore({ draft: { ...b, shapes: b.shapes.slice(0, -1) } });
}

export function Transport({ fps, duration, width, height }: { fps: number; duration: number; width: number; height: number }) {
  const player = usePlayer();
  const tc = useRef<HTMLSpanElement>(null);
  const playing = useStore((s) => s.playing);
  const speed = useStore((s) => s.speed);
  const loop = useStore((s) => s.loop);
  const muted = useStore((s) => s.muted);
  const zone = useStore((s) => s.zone);
  const zones = zonesFor(width, height) as { id: string; name: string }[];

  useEffect(
    () =>
      clock.subscribe((t) => {
        if (tc.current) paintTimecode(tc.current, timecode(t, fps));
      }),
    [fps],
  );

  return (
    <div className="transport">
      <div className="tc-group">
        <span className="tc" ref={tc} title="Timecode (hours:minutes:seconds:frames)">
          <span>00:00:00</span>
          <span className="tc-frames">:00</span>
        </span>
        <span className="tc-total">/ {timecode(duration, fps)}</span>
        <span className="tc-fps">{fps} fps</span>
      </div>
      <div className="transport-buttons">
        <button className="ico" title="Start (Home)" aria-label="Go to start" onClick={() => player.goToStart()}>
          <SkipBack size={17} />
        </button>
        <button className="ico" title="Previous frame (←) · Shift: 1 s" aria-label="Previous frame" onClick={() => player.step(-1)}>
          <ChevronLeft size={19} />
        </button>
        <button className="ico play" title="Play / pause (Space) · J K L" aria-label={playing ? 'Pause' : 'Play'} onClick={() => player.toggle()}>
          {playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
        </button>
        <button className="ico" title="Next frame (→) · Shift: 1 s" aria-label="Next frame" onClick={() => player.step(1)}>
          <ChevronRight size={19} />
        </button>
        <button className="ico" title="End (End)" aria-label="Go to end" onClick={() => player.goToEnd()}>
          <SkipForward size={17} />
        </button>
      </div>
      <div className="transport-options">
        <button className={cx('ico', loop && 'active')} title="Loop (the I/O range if there is one)" aria-label="Loop" aria-pressed={loop} onClick={() => setStore({ loop: !loop })}>
          <Repeat size={16} />
        </button>
        <select className="selector" value={speed} title="Speed" aria-label="Speed" onChange={(e) => player.setSpeed(Number(e.target.value))}>
          {[0.25, 0.5, 1, 1.5, 2, 4].map((v) => (
            <option key={v} value={v}>
              {v}×
            </option>
          ))}
        </select>
        <button className="ico" title="Mute (M)" aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => setStore({ muted: !muted })}>
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        {zones.length > 0 && <ZoneSelector zones={zones} zone={zone} />}
        <FullscreenButton />
      </div>
    </div>
  );
}

export function ZoneSelector({ zones, zone }: { zones: { id: string; name: string; short?: string }[]; zone: string | null }) {
  return (
    <select className={cx('selector zones', zone && 'is-active')} value={zone || ''} title="Safe zones (G)" aria-label="Safe zones" onChange={(e) => setStore({ zone: e.target.value || null })}>
      <option value="">Zones</option>
      {zones.map((z) => (
        <option key={z.id} value={z.id} title={z.name}>
          {z.short || z.name}
        </option>
      ))}
    </select>
  );
}

/** Full screen for the viewer panel (the frame, the tools and the transport). */
export function FullscreenButton() {
  return (
    <button
      className="ico"
      title="Full screen"
      aria-label="Full screen"
      onClick={() => {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else document.querySelector<HTMLElement>('.viewer-panel')?.requestFullscreen().catch(() => {});
      }}
    >
      <Maximize size={16} />
    </button>
  );
}

/** I · O and the marked range: they go in the timeline header. */
export function RangeControls({ fps }: { fps: number }) {
  const player = usePlayer();
  const markIn = useStore((s) => s.markIn);
  const markOut = useStore((s) => s.markOut);
  return (
    <div className="range">
      <button className="btn small" title="Mark in (I)" onClick={() => setMarkIn(player.frame)}>
        In <kbd>I</kbd>
      </button>
      <button className="btn small" title="Mark out (O)" onClick={() => setMarkOut(player.frame)}>
        Out <kbd>O</kbd>
      </button>
      {markIn !== null && (
        <span className="chip-range">
          {readableTime(markIn / fps)}
          {markOut !== null ? ` → ${readableTime(markOut / fps)}` : ' → …'}
          <button title="Clear range (X)" aria-label="Clear range" onClick={() => setStore({ markIn: null, markOut: null })}>
            <X size={12} />
          </button>
        </span>
      )}
    </div>
  );
}

/** Writes a timecode into a span with two children: HH:MM:SS and :FF (the frames are dimmed). */
export function paintTimecode(el: HTMLElement, text: string) {
  const i = text.lastIndexOf(':');
  const [hms, ff] = el.children;
  if (!hms || !ff) {
    el.textContent = text;
    return;
  }
  hms.textContent = text.slice(0, i);
  ff.textContent = text.slice(i);
}

export function setMarkIn(frame: number) {
  const { markOut } = getStore();
  setStore({ markIn: frame, markOut: markOut !== null && markOut > frame ? markOut : null });
}

export function setMarkOut(frame: number) {
  const { markIn } = getStore();
  if (markIn === null || frame <= markIn) setStore({ markIn: Math.max(0, frame - 1), markOut: frame });
  else setStore({ markOut: frame });
}

/** Next safe zone (shortcut G). */
export function nextZone(width: number, height: number) {
  const ids = [null, ...(zonesFor(width, height) as { id: string }[]).map((z) => z.id)];
  const i = ids.indexOf(getStore().zone);
  setStore({ zone: ids[(i + 1) % ids.length] });
}
