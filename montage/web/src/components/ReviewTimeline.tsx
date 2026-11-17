import { Film, Flag, MessageSquare, MessageSquarePlus, Music, Scan, ZoomIn } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { frameAt, readableTime, timecode } from '../../../shared/time.js';
import { useStore } from '../state';
import { usePlayer } from '../engine/player';
import { clock } from '../clock';
import type { Marker, Media, Note } from '../types';
import { CMD, STATES, clamp, cx } from '../util';
import { RangeControls } from './Controls';
import { startNote } from './NotesPanel';

const PAD = 14;
const HEIGHT = { ruler: 26, markers: 22, strip: 52, wave: 40, notes: 32 };

interface Props {
  media: Media | undefined;
  duration: number;
  fps: number;
  notes: Note[];
  markers: Marker[];
  onSelectNote: (n: Note) => void;
}

export function ReviewTimeline({ media, duration, fps, notes, markers, onSelectNote }: Props) {
  const player = usePlayer();
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const playhead = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [zoom, setZoom] = useState(1);
  const [scroll, setScroll] = useState(0);
  const markIn = useStore((s) => s.markIn);
  const markOut = useStore((s) => s.markOut);
  const selNote = useStore((s) => s.selNote);
  const playing = useStore((s) => s.playing);

  const [sprite, setSprite] = useState<HTMLImageElement | null>(null);
  const [peaks, setPeaks] = useState<{ data: Uint8Array; perSecond: number } | null>(null);

  const hasMarkers = markers.length > 0;
  const hasWave = !!peaks;
  const usable = Math.max(50, width - 2 * PAD);
  const pps = (usable / Math.max(0.1, duration)) * zoom;
  const total = duration * pps;
  const maxScroll = Math.max(0, total - usable);
  const sc = clamp(scroll, 0, maxScroll);

  // Tracks from top to bottom: ruler, Claude's markers, V1 (frames), A1 (audio), N (notes).
  const yMarkers = HEIGHT.ruler;
  const yStrip = yMarkers + (hasMarkers ? HEIGHT.markers : 0);
  const yWave = yStrip + HEIGHT.strip;
  const yNotes = yWave + (hasWave ? HEIGHT.wave : 0);
  const totalHeight = yNotes + HEIGHT.notes + 2;
  const zMax = Math.max(1, (fps * 48 * duration) / usable);

  const x = (t: number) => PAD + t * pps - sc;
  const tFromX = (px: number) => clamp((px - PAD + sc) / pps, 0, duration);

  // For the clock subscription (it lives outside React).
  const geo = useRef({ pps, sc, usable });
  geo.current = { pps, sc, usable };

  useLayoutEffect(() => {
    const el = frame.current!;
    const measure = () => setWidth(el.clientWidth);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setSprite(null);
    if (!media?.urls.strip) return;
    const img = new Image();
    img.onload = () => setSprite(img);
    img.src = media.urls.strip;
    return () => {
      img.onload = null;
    };
  }, [media?.urls.strip]);

  useEffect(() => {
    setPeaks(null);
    if (!media?.urls.peaks) return;
    let alive = true;
    fetch(media.urls.peaks)
      .then((r) => r.json())
      .then((j: { data: string; perSecond: number }) => {
        if (!alive) return;
        const bin = atob(j.data);
        const data = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
        setPeaks({ data, perSecond: j.perSecond });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [media?.urls.peaks]);

  // Playhead: it moves with the clock without re-rendering; if it leaves the view (zoomed in), the view follows it.
  useEffect(
    () =>
      clock.subscribe((t) => {
        const g = geo.current;
        const px = PAD + t * g.pps - g.sc;
        if (playhead.current) playhead.current.style.transform = `translateX(${px}px)`;
        if (g.pps * duration > g.usable + 1 && (px < PAD || px > PAD + g.usable - 8)) setScroll(Math.max(0, t * g.pps - 40));
      }),
    [duration],
  );
  useEffect(() => {
    if (playhead.current) playhead.current.style.transform = `translateX(${PAD + clock.t * pps - sc}px)`;
  }, [pps, sc]);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(width * dpr);
    c.height = Math.round(totalHeight * dpr);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, totalHeight);
    const x0 = Math.max(0, x(0));
    const x1 = Math.min(width, x(duration));

    // Track background
    ctx.fillStyle = '#1a1c20';
    ctx.beginPath();
    ctx.roundRect(x0, yStrip + 3, x1 - x0, HEIGHT.strip - 6, 6);
    if (hasWave) ctx.roundRect(x0, yWave + 3, x1 - x0, HEIGHT.wave - 6, 6);
    ctx.fill();

    // Ruler
    const steps = [1, 2, 5, 10, 15].map((f) => f / fps).concat([0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600]);
    const step = steps.find((p) => p * pps >= 80) ?? 600;
    const minor = step / (step * pps >= 160 ? 10 : 5);
    ctx.strokeStyle = 'rgba(214,235,253,0.16)';
    ctx.fillStyle = 'rgba(161,164,165,0.85)';
    ctx.font = '500 10px "JetBrains Mono", ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'top';
    const tStart = Math.max(0, tFromX(0) - step);
    const tEnd = Math.min(duration, tFromX(width) + step);
    const pins = notes.filter((n) => n.t !== null).map((n) => x(n.t!));
    ctx.beginPath();
    for (let t = Math.floor(tStart / minor) * minor; t <= tEnd + 1e-9; t += minor) {
      const px = Math.round(x(t)) + 0.5;
      const major = Math.abs(t / step - Math.round(t / step)) < 1e-6;
      ctx.moveTo(px, major ? 6 : 18);
      ctx.lineTo(px, HEIGHT.ruler - 2);
      if (major) {
        const label = readableTime(t, step < 1 ? 2 : 0);
        const end = px + 6 + ctx.measureText(label).width;
        if (!pins.some((p) => p + 11 > px + 2 && p - 11 < end)) ctx.fillText(label, px + 4, 5);
      }
    }
    ctx.stroke();
    // Frame boundaries when zoomed in a lot
    if (pps / fps >= 14) {
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      for (let n = Math.floor(tStart * fps); n <= tEnd * fps; n++) {
        const px = Math.round(x(n / fps)) + 0.5;
        ctx.moveTo(px, yStrip + 3);
        ctx.lineTo(px, totalHeight - 4);
      }
      ctx.stroke();
    }

    // Thumbnail strip
    const info = media?.strip;
    if (sprite && info) {
      const height = HEIGHT.strip - 6;
      const thumbWidth = (height * info.width) / info.height;
      const start = x(0) + Math.floor((x0 - x(0)) / thumbWidth) * thumbWidth;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x0, yStrip + 3, x1 - x0, height, 6);
      ctx.clip();
      for (let px = start; px < x1; px += thumbWidth) {
        const w = Math.min(thumbWidth, x(duration) - px);
        if (w <= 0) break;
        const tc = tFromX(px + w / 2);
        const i = clamp(Math.round(tc / info.interval), 0, info.count - 1);
        const col = i % info.columns;
        const row = Math.floor(i / info.columns);
        ctx.drawImage(sprite, col * info.width, row * info.height, info.width * (w / thumbWidth), info.height, px, yStrip + 3, w, height);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      for (let px = start; px < x1; px += thumbWidth) ctx.fillRect(Math.round(px), yStrip + 3, 1, height);
      ctx.restore();
    }

    // Audio waveform
    if (peaks) {
      const center = yWave + HEIGHT.wave / 2;
      const amp = HEIGHT.wave / 2 - 6;
      ctx.fillStyle = 'rgba(161, 164, 165, 0.72)';
      for (let px = Math.floor(x0); px < x1; px++) {
        const i0 = Math.floor(tFromX(px) * peaks.perSecond);
        const i1 = Math.max(i0 + 1, Math.ceil(tFromX(px + 1) * peaks.perSecond));
        let m = 0;
        for (let i = i0; i < i1 && i < peaks.data.length; i++) if (peaks.data[i] > m) m = peaks.data[i];
        const h = Math.max(0.5, Math.sqrt(m / 255) * amp);
        ctx.fillRect(px, center - h, 1, h * 2);
      }
    }

    // Note guides across the tracks
    for (const n of notes) {
      if (n.t === null) continue;
      const px = Math.round(x(n.t)) + 0.5;
      if (px < x0 || px > x1) continue;
      ctx.strokeStyle = n.n === selNote ? 'rgba(125,227,244,0.7)' : 'rgba(240,240,240,0.16)';
      ctx.beginPath();
      ctx.moveTo(px, HEIGHT.ruler - 3);
      ctx.lineTo(px, yNotes + 6);
      ctx.stroke();
    }
  });

  const applyZoom = (z: number) => {
    const next = clamp(z, 1, zMax);
    setZoom(next);
    setScroll(Math.max(0, clock.t * (usable / Math.max(0.1, duration)) * next - usable / 2));
  };

  // Zoom (Cmd/Ctrl + wheel or pinch) around the pointer; the horizontal wheel pans.
  const wheel = (e: React.WheelEvent) => {
    const r = frame.current!.getBoundingClientRect();
    const px = e.clientX - r.left;
    if (e.ctrlKey || e.metaKey) {
      const t = tFromX(px);
      const z = clamp(zoom * Math.exp(-e.deltaY * 0.012), 1, Math.max(1, (fps * 48 * duration) / usable));
      const newPps = (usable / Math.max(0.1, duration)) * z;
      setZoom(z);
      setScroll(Math.max(0, t * newPps - (px - PAD)));
    } else if (zoom > 1) {
      setScroll(clamp(sc + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY), 0, maxScroll));
    }
  };

  // Scrubbing: the seeks are coalesced in the player; on release it snaps to the frame.
  const dragging = useRef(false);
  const down = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    player.pause();
    const r = frame.current!.getBoundingClientRect();
    player.seek(tFromX(e.clientX - r.left));
    hideTip();
  };
  const move = (e: React.PointerEvent) => {
    const r = frame.current!.getBoundingClientRect();
    const px = e.clientX - r.left;
    if (dragging.current) {
      player.seek(tFromX(px));
      return;
    }
    showTip(px);
  };
  const up = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    const r = frame.current!.getBoundingClientRect();
    player.goToFrame(frameAt(tFromX(e.clientX - r.left), fps));
  };

  const showTip = (px: number) => {
    const el = tip.current;
    const info = media?.strip;
    if (!el) return;
    if (px < PAD - 2 || px > x(duration) + 2) return hideTip();
    const t = tFromX(px);
    const img = el.firstElementChild as HTMLElement;
    if (info && media?.urls.strip) {
      const i = clamp(Math.round(t / info.interval), 0, info.count - 1);
      const scale = 96 / info.height;
      img.style.display = '';
      img.style.width = `${info.width * scale}px`;
      img.style.height = `${info.height * scale}px`;
      img.style.backgroundImage = `url(${media.urls.strip})`;
      img.style.backgroundSize = `${info.columns * info.width * scale}px ${info.rows * info.height * scale}px`;
      img.style.backgroundPosition = `-${(i % info.columns) * info.width * scale}px -${Math.floor(i / info.columns) * info.height * scale}px`;
    } else img.style.display = 'none';
    (el.lastElementChild as HTMLElement).textContent = timecode(t, fps);
    el.style.display = 'flex';
    el.style.left = `${clamp(px, 50, width - 50)}px`;
  };
  const hideTip = () => {
    if (tip.current) tip.current.style.display = 'none';
  };

  const timedNotes = notes.filter((n) => n.t !== null).sort((a, b) => a.t! - b.t!);
  const sortedMarkers = [...markers].sort((a, b) => a.t - b.t);
  const markerRoom = (i: number) => (i + 1 < sortedMarkers.length ? x(sortedMarkers[i + 1].t) - x(sortedMarkers[i].t) - 6 : width - x(sortedMarkers[i].t) - 8);
  const room = (i: number) => {
    const n = timedNotes[i];
    const next = timedNotes.slice(i + 1).find((m) => m.t! > n.t!);
    return next ? x(next.t!) - x(n.t!) - 6 : width - x(n.t!) - 8;
  };

  return (
    <div className="timeline">
      <header className="tl-head">
        <h2>Timeline</h2>
        <RangeControls fps={fps} />
        <button className="btn small" onClick={() => (player.pause(), startNote())} title="New note on this frame (C)">
          <MessageSquarePlus size={14} /> Note here
        </button>
        <div className="tl-zoom">
          <ZoomIn size={15} aria-hidden />
          <input
            type="range"
            min={0}
            max={1000}
            value={zMax > 1 ? Math.round((Math.log(zoom) / Math.log(zMax)) * 1000) : 0}
            disabled={zMax <= 1}
            aria-label="Timeline zoom"
            title={`Zoom (${CMD} + wheel)`}
            onChange={(e) => applyZoom(Math.exp((Number(e.target.value) / 1000) * Math.log(zMax)))}
          />
          <button className="ico" title="Fit to width" aria-label="Fit to width" onClick={() => (setZoom(1), setScroll(0))}>
            <Scan size={15} />
          </button>
        </div>
      </header>
      <div className="tl-body">
        <div className="tl-labels" style={{ height: totalHeight }} aria-hidden>
          {hasMarkers && (
            <span style={{ top: yMarkers, height: HEIGHT.markers }}>
              <Flag size={13} /> M
            </span>
          )}
          <span style={{ top: yStrip, height: HEIGHT.strip }}>
            <Film size={13} /> V1
          </span>
          {hasWave && (
            <span style={{ top: yWave, height: HEIGHT.wave }}>
              <Music size={13} /> A1
            </span>
          )}
          <span style={{ top: yNotes, height: HEIGHT.notes }}>
            <MessageSquare size={13} /> N
          </span>
        </div>
        <div className="tl-right">
        <div
          className={cx('tl-frame', zoom > 1 && 'zoomed')}
          ref={frame}
          style={{ height: totalHeight }}
          onWheel={wheel}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={hideTip}
        >
          <canvas ref={canvas} className="tl-canvas" style={{ width, height: totalHeight }} />
          <div className="tl-pins" style={{ height: HEIGHT.ruler }}>
            {timedNotes.map((n) => (
              <button
                key={n.n}
                className={cx('tl-pin', STATES[n.state].className, selNote === n.n && 'sel')}
                style={{ left: x(n.t!) }}
                title={`#${n.n} · ${timecode(n.t!, fps)} · ${n.text}`}
                aria-label={`Go to note ${n.n}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectNote(n);
                }}
              >
                {n.n}
              </button>
            ))}
          </div>
          {markIn !== null && (
            <div
              className="tl-range"
              style={{ left: x(markIn / fps), width: Math.max(2, ((markOut ?? Math.round(duration * fps)) - markIn) / fps * pps), top: 0, height: totalHeight }}
            />
          )}
          {hasMarkers && (
            <div className="tl-marker-lane" style={{ top: yMarkers, height: HEIGHT.markers }}>
              {sortedMarkers.map((m, i) => {
                const free = markerRoom(i);
                return (
                  <span key={i} className={cx('tl-marker', free < 48 && 'dot-only')} style={{ left: x(m.t), maxWidth: free < 48 ? undefined : Math.min(170, free) }} title={`${readableTime(m.t)} · ${m.text}`}>
                    {free >= 48 && m.text}
                  </span>
                );
              })}
            </div>
          )}
          <div className="tl-note-lane" style={{ top: yNotes, height: HEIGHT.notes }}>
            {timedNotes.map((n, i) => {
              const range = n.tEnd !== null;
              const width = range ? Math.max(24, (n.tEnd! - n.t!) * pps) : Math.min(180, room(i));
              const withText = !!n.text && width >= 64;
              return (
                <button
                  key={n.n}
                  className={cx('tl-note', STATES[n.state].className, selNote === n.n && 'sel', range && 'range', !withText && 'number-only')}
                  style={{ left: x(n.t!) - (range ? 0 : 11), ...(range ? { width } : { maxWidth: Math.max(24, width) }) }}
                  title={`#${n.n} · ${timecode(n.t!, fps)} · ${n.text}`}
                  aria-label={`Note ${n.n} at ${timecode(n.t!, fps)}: ${n.text}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectNote(n);
                  }}
                >
                  <span className="tl-note-n">{n.n}</span>
                  {withText && <span className="tl-note-text">{n.text}</span>}
                </button>
              );
            })}
          </div>
          <div className={cx('tl-playhead', playing && 'live')} ref={playhead} style={{ height: totalHeight }} />
        </div>
        <div className="tl-tip" ref={tip}>
          <div className="tl-tip-img" />
          <span />
        </div>
        </div>
      </div>
      {zoom > 1 && (
        <div className="tl-bar">
          <div
            className="tl-bar-thumb"
            style={{ left: `${(sc / (total || 1)) * 100}%`, width: `${(usable / (total || 1)) * 100}%` }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              const start = { x: e.clientX, sc };
              const onMove = (ev: PointerEvent) => setScroll(clamp(start.sc + ((ev.clientX - start.x) / usable) * total, 0, maxScroll));
              const end = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', end);
              };
              window.addEventListener('pointermove', onMove);
              window.addEventListener('pointerup', end);
            }}
          />
        </div>
      )}
    </div>
  );
}
