import { Eye, EyeOff, Lock, LockOpen, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { readableTime } from '../../../shared/time.js';
import { clock } from '../clock';
import type { Meta, Media } from '../types';
import { clamp, cx } from '../util';
import { toFrame, maxDuration, timelineDuration, end, snap, snapPoints, hasMedia, type Clip, type Track, type Timeline } from './model';

export const DRAG_TYPE = 'application/x-montage-media';
export interface DraggedMedia {
  path: string;
  name: string;
  type: 'video' | 'image' | 'audio';
  meta: Meta;
}

const RULER_HEIGHT = 26;
const HEIGHT = { video: 54, audio: 46 };

interface Props {
  tl: Timeline;
  sel: string[];
  pps: number;
  setPps: (n: number) => void;
  tool: 'select' | 'blade';
  snapOn: boolean;
  media: Map<string, Media>;
  onSelect: (ids: string[]) => void;
  onTempChange: (tl: Timeline) => void;
  onCommit: (tl: Timeline, before: Timeline) => void;
  onSeek: (t: number) => void;
  onDropMedia: (m: DraggedMedia, track: Track, t: number) => void;
  onSplitAt: (clip: Clip, t: number) => void;
  onChangeTrack: (id: string, changes: Partial<Track>) => void;
}

type Drag = { mode: 'move' | 'left' | 'right'; id: string; x0: number; before: Timeline; ids: string[]; moved: boolean };

export function EditTimeline(p: Props) {
  const { tl, pps } = p;
  const scroll = useRef<HTMLDivElement>(null);
  const ruler = useRef<HTMLCanvasElement>(null);
  const playhead = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ width: 800, left: 0 });
  const [drop, setDrop] = useState<{ track: string; x: number } | null>(null);
  const drag = useRef<Drag | null>(null);
  const current = useRef(tl);
  current.current = tl;
  const fps = tl.format.fps;
  const duration = timelineDuration(tl);
  const contentWidth = Math.max(view.width, (duration + 8) * pps);

  useLayoutEffect(() => {
    const el = scroll.current!;
    const measure = () => setView({ width: el.clientWidth, left: el.scrollLeft });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  // Playhead driven by the clock (no re-render). While playing, the view follows it.
  useEffect(
    () =>
      clock.subscribe((t) => {
        const x = t * pps;
        if (playhead.current) playhead.current.style.transform = `translateX(${x}px)`;
        const el = scroll.current;
        if (el && (x > el.scrollLeft + el.clientWidth - 30 || x < el.scrollLeft)) el.scrollLeft = Math.max(0, x - 60);
      }),
    [pps],
  );

  // Ruler (canvas fixed on the left that is redrawn on scroll).
  useEffect(() => {
    const c = ruler.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(view.width * dpr);
    c.height = Math.round(RULER_HEIGHT * dpr);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, view.width, RULER_HEIGHT);
    const steps = [1, 2, 5, 10, 15].map((f) => f / fps).concat([0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]);
    const step = steps.find((x) => x * pps >= 70) ?? 300;
    const minor = step / 5;
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '500 10px "SF Mono", ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'top';
    const t0 = Math.floor(view.left / pps / minor) * minor;
    const t1 = (view.left + view.width) / pps;
    ctx.beginPath();
    for (let t = t0; t <= t1 + minor; t += minor) {
      const x = Math.round(t * pps - view.left) + 0.5;
      const major = Math.abs(t / step - Math.round(t / step)) < 1e-6;
      ctx.moveTo(x, major ? 5 : 16);
      ctx.lineTo(x, RULER_HEIGHT);
      if (major) ctx.fillText(readableTime(t, step < 1 ? 2 : 0), x + 4, 5);
    }
    ctx.stroke();
  }, [view, pps, fps]);

  const timeAt = (clientX: number) => {
    const r = scroll.current!.getBoundingClientRect();
    return Math.max(0, (clientX - r.left + scroll.current!.scrollLeft) / pps);
  };

  // Zoom with Cmd/Ctrl + wheel around the pointer.
  const wheel = (e: React.WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const el = scroll.current!;
    const r = el.getBoundingClientRect();
    const px = e.clientX - r.left;
    const t = (px + el.scrollLeft) / pps;
    const next = clamp(pps * Math.exp(-e.deltaY * 0.01), 4, fps * 60);
    p.setPps(next);
    requestAnimationFrame(() => (el.scrollLeft = Math.max(0, t * next - px)));
  };

  // ----- ruler: scrub

  const rulerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    p.onSeek(toFrame(timeAt(e.clientX), fps));
  };
  const rulerMove = (e: React.PointerEvent) => {
    if (e.buttons & 1) p.onSeek(toFrame(timeAt(e.clientX), fps));
  };

  // ----- clips: move, trim, split

  const trackAtY = (clientY: number) => {
    const rows = scroll.current!.querySelectorAll<HTMLElement>('.et-track');
    for (const f of rows) {
      const r = f.getBoundingClientRect();
      if (clientY >= r.top && clientY < r.bottom) return tl.tracks.find((x) => x.id === f.dataset.track) || null;
    }
    return null;
  };

  const compatible = (c: Clip, track: Track) => (c.type === 'audio' ? track.type === 'audio' : track.type === 'video');

  const clipDown = (e: React.PointerEvent, c: Clip, mode: Drag['mode']) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const track = tl.tracks.find((x) => x.id === c.track);
    if (track?.locked) return p.onSelect([c.id]);
    if (p.tool === 'blade' && mode === 'move') {
      p.onSplitAt(c, toFrame(timeAt(e.clientX), fps));
      return;
    }
    const ids = e.shiftKey ? (p.sel.includes(c.id) ? p.sel.filter((x) => x !== c.id) : [...p.sel, c.id]) : p.sel.includes(c.id) ? p.sel : [c.id];
    p.onSelect(ids);
    drag.current = { mode, id: c.id, x0: e.clientX, before: tl, ids: mode === 'move' ? ids : [c.id], moved: false };
    scroll.current!.setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent) => {
    const a = drag.current;
    if (!a) return;
    if (Math.abs(e.clientX - a.x0) > 2) a.moved = true;
    if (!a.moved) return;
    const dt = (e.clientX - a.x0) / pps;
    const base = a.before;
    const tol = 8 / pps;
    const c0 = base.clips.find((x) => x.id === a.id)!;
    const points = p.snapOn ? snapPoints(base, a.ids, clock.t) : [];
    if (a.mode === 'move') {
      const moving = base.clips.filter((x) => a.ids.includes(x.id));
      let start = c0.start + dt;
      if (p.snapOn) {
        const s1 = snap(start, points, tol);
        const s2 = snap(start + c0.duration, points, tol);
        if (s1.snapped) start = s1.t;
        else if (s2.snapped) start = s2.t - c0.duration;
      }
      const delta = toFrame(Math.max(-Math.min(...moving.map((x) => x.start)), start - c0.start), fps);
      const target = trackAtY(e.clientY);
      const changesTrack = a.ids.length === 1 && target && target.id !== c0.track && compatible(c0, target) && !target.locked;
      p.onTempChange({
        ...base,
        clips: base.clips.map((x) => (a.ids.includes(x.id) ? { ...x, start: toFrame(x.start + delta, fps), track: changesTrack && x.id === a.id ? target!.id : x.track } : x)),
      });
    } else if (a.mode === 'left') {
      let start = c0.start + dt;
      if (p.snapOn) start = snap(start, points, tol).t;
      const minimum = hasMedia(c0) ? c0.start - c0.sourceIn / c0.speed : 0;
      start = clamp(toFrame(start, fps), Math.max(0, minimum), end(c0) - 1 / fps);
      const d = start - c0.start;
      const next = { ...c0, start, duration: c0.duration - d, ...(hasMedia(c0) ? { sourceIn: Math.max(0, c0.sourceIn + d * c0.speed) } : {}) } as Clip;
      p.onTempChange({ ...base, clips: base.clips.map((x) => (x.id === a.id ? next : x)) });
    } else {
      let last = end(c0) + dt;
      if (p.snapOn) last = snap(last, points, tol).t;
      last = clamp(toFrame(last, fps), c0.start + 1 / fps, c0.start + Math.min(maxDuration(c0), 3600));
      p.onTempChange({ ...base, clips: base.clips.map((x) => (x.id === a.id ? ({ ...x, duration: last - x.start } as Clip) : x)) });
    }
  };

  const up = () => {
    const a = drag.current;
    drag.current = null;
    if (a?.moved) p.onCommit(current.current, a.before);
  };

  // ----- drop media from the library

  const over = (e: React.DragEvent, track: Track) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const r = scroll.current!.getBoundingClientRect();
    setDrop({ track: track.id, x: e.clientX - r.left + scroll.current!.scrollLeft });
  };
  const dropHere = (e: React.DragEvent, track: Track) => {
    const payload = e.dataTransfer.getData(DRAG_TYPE);
    setDrop(null);
    if (!payload) return;
    e.preventDefault();
    let t = toFrame(timeAt(e.clientX), fps);
    if (p.snapOn) t = snap(t, snapPoints(tl, [], clock.t), 10 / pps).t;
    p.onDropMedia(JSON.parse(payload) as DraggedMedia, track, t);
  };

  return (
    <div className="edit-timeline" onWheel={wheel}>
      <div className="et-heads">
        <div className="et-corner" style={{ height: RULER_HEIGHT }}>
          {readableTime(duration, 1)} s
        </div>
        {tl.tracks.map((track) => (
          <div key={track.id} className={cx('et-head', track.type)} style={{ height: HEIGHT[track.type] }}>
            <span className="et-head-name">
              <b>{track.id}</b> {track.name !== track.id && <span className="dim">{track.name}</span>}
            </span>
            <span className="et-head-buttons">
              {track.type === 'video' && (
                <button className="ico small" title={track.hidden ? 'Show track' : 'Hide track'} onClick={() => p.onChangeTrack(track.id, { hidden: !track.hidden })}>
                  {track.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              )}
              <button className="ico small" title={track.muted ? 'Unmute track' : 'Mute track'} onClick={() => p.onChangeTrack(track.id, { muted: !track.muted })}>
                {track.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
              </button>
              <button className="ico small" title={track.locked ? 'Unlock' : 'Lock'} onClick={() => p.onChangeTrack(track.id, { locked: !track.locked })}>
                {track.locked ? <Lock size={13} /> : <LockOpen size={13} />}
              </button>
            </span>
          </div>
        ))}
      </div>
      <div
        className={cx('et-scroll', p.tool === 'blade' && 'blade')}
        ref={scroll}
        onScroll={(e) => setView((v) => ({ ...v, left: (e.target as HTMLDivElement).scrollLeft }))}
        onPointerMove={move}
        onPointerUp={up}
        onPointerDown={() => p.onSelect([])}
      >
        <div className="et-content" style={{ width: contentWidth }}>
          <canvas
            ref={ruler}
            className="et-ruler"
            style={{ width: view.width, height: RULER_HEIGHT }}
            onPointerDown={(e) => {
              e.stopPropagation();
              rulerDown(e);
            }}
            onPointerMove={rulerMove}
          />
          {tl.tracks.map((track) => (
            <div
              key={track.id}
              className={cx('et-track', track.type, track.hidden && 'hidden', track.locked && 'locked', drop?.track === track.id && 'dropping')}
              data-track={track.id}
              style={{ height: HEIGHT[track.type] }}
              onDragOver={(e) => over(e, track)}
              onDragLeave={() => setDrop(null)}
              onDrop={(e) => dropHere(e, track)}
            >
              {tl.clips
                .filter((c) => c.track === track.id)
                .map((c) => (
                  <ClipBlock key={c.id} c={c} pps={pps} sel={p.sel.includes(c.id)} media={'path' in c ? p.media.get(c.path) : undefined} onDown={clipDown} />
                ))}
              {drop?.track === track.id && <div className="et-drop-mark" style={{ left: drop.x }} />}
            </div>
          ))}
          <div className="et-playhead" ref={playhead} />
        </div>
      </div>
    </div>
  );
}

function ClipBlock({ c, pps, sel, media, onDown }: { c: Clip; pps: number; sel: boolean; media: Media | undefined; onDown: (e: React.PointerEvent, c: Clip, mode: Drag['mode']) => void }) {
  const width = Math.max(3, c.duration * pps);
  const name = hasMedia(c) ? c.name : c.layer.type === 'text' ? c.layer.text.split('\n')[0] : c.layer.type === 'image' ? c.layer.name : 'Shape';
  const poster = c.type === 'video' ? media?.urls.poster : null;
  return (
    <div
      className={cx('et-clip', c.type, sel && 'sel')}
      style={{ left: c.start * pps, width, backgroundImage: poster ? `url(${poster})` : undefined }}
      onPointerDown={(e) => onDown(e, c, 'move')}
      title={`${name} · ${readableTime(c.start)} → ${readableTime(end(c))}`}
    >
      {c.type === 'audio' || (c.type === 'video' && c.hasAudio) ? <Waveform c={c} media={media} width={width} /> : null}
      <span className="et-name">
        {name}
        {'speed' in c && c.speed !== 1 && <em> {c.speed}×</em>}
      </span>
      {c.fadeIn > 0 && <span className="et-fade left" style={{ width: c.fadeIn * pps }} />}
      {c.fadeOut > 0 && <span className="et-fade right" style={{ width: c.fadeOut * pps }} />}
      <span className="et-edge left" onPointerDown={(e) => onDown(e, c, 'left')} />
      <span className="et-edge right" onPointerDown={(e) => onDown(e, c, 'right')} />
    </div>
  );
}

const peaksCache = new Map<string, Promise<{ data: Uint8Array; perSecond: number } | null>>();
function peaksOf(url: string) {
  let p = peaksCache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => r.json())
      .then((j: { data: string; perSecond: number }) => {
        const bin = atob(j.data);
        const data = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
        return { data, perSecond: j.perSecond };
      })
      .catch(() => null);
    peaksCache.set(url, p);
  }
  return p;
}

function Waveform({ c, media, width }: { c: Clip; media: Media | undefined; width: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const url = media?.urls.peaks;
  useEffect(() => {
    if (!url || !ref.current || !hasMedia(c)) return;
    let alive = true;
    peaksOf(url).then((p) => {
      const cv = ref.current;
      if (!alive || !p || !cv) return;
      const w = Math.min(4000, Math.round(width));
      const h = cv.clientHeight || 30;
      cv.width = w;
      cv.height = h;
      const ctx = cv.getContext('2d')!;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = c.type === 'audio' ? 'rgba(120, 230, 170, 0.85)' : 'rgba(255,255,255,0.45)';
      for (let x = 0; x < w; x++) {
        const t0 = c.sourceIn + (x / w) * c.duration * c.speed;
        const t1 = c.sourceIn + ((x + 1) / w) * c.duration * c.speed;
        let m = 0;
        for (let i = Math.floor(t0 * p.perSecond); i < Math.ceil(t1 * p.perSecond) && i < p.data.length; i++) if (p.data[i] > m) m = p.data[i];
        const a = Math.sqrt(m / 255) * (h / 2 - 1) * c.volume;
        ctx.fillRect(x, h / 2 - a, 1, Math.max(1, a * 2));
      }
    });
    return () => {
      alive = false;
    };
  }, [url, width, c]);
  return <canvas ref={ref} className="et-wave" />;
}
