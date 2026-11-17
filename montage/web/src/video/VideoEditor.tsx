import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Film,
  Image as ImageIcon,
  Magnet,
  MousePointer2,
  Music,
  Pause,
  Play,
  Redo2,
  Scissors,
  Trash2,
  Type,
  Undo2,
  Upload,
  WrapText,
} from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { rasterKey } from '../../../shared/hash.js';
import { timecode } from '../../../shared/time.js';
import { api, uploadMedia, fileUrl, repoUrl } from '../api';
import { notify, setStore, useStore } from '../state';
import { ColorField, Slider, TextInspector } from '../image/ImageEditor';
import { textLayer, newId, type ImageLayer, type TextLayer } from '../image/model';
import { renderLayer } from '../image/render';
import { clock } from '../clock';
import type { RepoEntry, Media, Project, Version } from '../types';
import { CMD, bytes, clamp, cx, isTyping } from '../util';
import { EditTimeline, DRAG_TYPE, type DraggedMedia } from './EditTimeline';
import {
  toFrame,
  rippleDelete,
  split,
  timelineDuration,
  end,
  newClipId,
  hasMedia,
  emptyTimeline,
  baseTransform,
  type Clip,
  type LayerClip,
  type VideoClip,
  type Track,
  type Timeline,
} from './model';
import { Engine } from './engine';

const versionPath = (project: string, path: string) => `montage/projects/${project}/${path}`;

export function VideoEditor({ project, version }: { project: Project; version: Version }) {
  const [tl, setTl] = useState<Timeline | null>(null);
  const tlRef = useRef<Timeline | null>(null);
  tlRef.current = tl;
  const history = useRef<{ back: Timeline[]; forward: Timeline[]; group: string; t: number }>({ back: [], forward: [], group: '', t: 0 });
  const saved = useRef<{ timer?: number; rev: number; pending: boolean }>({ rev: 0, pending: false });
  const [sel, setSel] = useState<string[]>([]);
  const [pps, setPps] = useState(60);
  const [tool, setTool] = useState<'select' | 'blade'>('select');
  const [snapOn, setSnapOn] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [media, setMedia] = useState<Map<string, Media>>(new Map());
  const [jobId, setJobId] = useState<string | null>(null);
  const job = useStore((s) => (jobId ? s.jobs[jobId] : undefined));
  const engine = useMemo(() => new Engine(emptyTimeline(1080, 1920, 30)), []);

  // ----- load or create the timeline

  useEffect(() => {
    let alive = true;
    api.document<Timeline>(project.id, 'timeline').then((d) => {
      if (!alive) return;
      if (d && d.clips) {
        saved.current.rev = d.rev || 0;
        setTl(d);
        return;
      }
      const a = version.files[0];
      const m = a.meta;
      const fps = m.fps || 30;
      const fresh = emptyTimeline(m.width || 1080, m.height || 1920, fps);
      if (a.type === 'video') {
        fresh.clips.push({
          id: newClipId(),
          track: 'V1',
          type: 'video',
          path: versionPath(project.id, a.path),
          name: `${version.id} · ${a.name}`,
          start: 0,
          duration: toFrame(m.duration || 1, fps),
          sourceIn: 0,
          speed: 1,
          volume: 1,
          fadeIn: 0,
          fadeOut: 0,
          opacity: 1,
          transform: baseTransform(),
          length: m.duration || 1,
          hasAudio: !!m.hasAudio,
        });
      }
      setTl(fresh);
      scheduleSave(fresh, 0);
    });
    return () => {
      alive = false;
    };
    // Only when the project opens: after that the timeline on disk rules.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  useEffect(() => {
    engine.onChange = setPlaying;
    return () => engine.destroy();
  }, [engine]);
  useEffect(() => {
    if (tl) engine.setTimeline(tl);
  }, [tl, engine]);
  useEffect(() => engine.setMedia(media), [media, engine]);

  // ----- media (preview, audio, waveform) of everything the timeline uses

  const mediaPaths = useMemo(() => [...new Set((tl?.clips || []).filter(hasMedia).map((c) => c.path))].sort().join('|'), [tl]);
  useEffect(() => {
    if (!mediaPaths) return;
    let alive = true;
    let pending = mediaPaths.split('|');
    const request = () =>
      Promise.all(pending.map((r) => api.media(r).then((m) => [r, m] as const).catch(() => null))).then((res) => {
        if (!alive) return;
        setMedia((prev) => {
          const next = new Map(prev);
          for (const x of res) if (x) next.set(x[0], x[1]);
          return next;
        });
        pending = res.filter((x): x is readonly [string, Media] => !!x && x[1].preparing).map((x) => x[0]);
        if (pending.length) setTimeout(request, 1500);
      });
    request();
    return () => {
      alive = false;
    };
  }, [mediaPaths]);

  // ----- changes, history and saving

  const scheduleSave = useCallback(
    (d: Timeline, wait = 500) => {
      const g = saved.current;
      g.pending = true;
      clearTimeout(g.timer);
      g.timer = window.setTimeout(async () => {
        try {
          const r = await api.saveDocument(project.id, 'timeline', { ...d, rev: g.rev });
          g.rev = r.rev;
          g.pending = false;
        } catch (e) {
          g.pending = false;
          if (/changed on disk/.test((e as Error).message)) {
            const remote = await api.document<Timeline>(project.id, 'timeline');
            if (remote) {
              g.rev = remote.rev || 0;
              setTl(remote);
              notify('The timeline changed on disk (Claude?). That version was loaded.', 'claude', undefined, 7000);
            }
          } else notify(`The timeline was not saved: ${(e as Error).message}`, 'error');
        }
      }, wait);
    },
    [project.id],
  );

  const apply = useCallback(
    (next: Timeline, before?: Timeline, group = '') => {
      const h = history.current;
      const prev = before ?? tlRef.current;
      const now = Date.now();
      if (prev && !(group && group === h.group && now - h.t < 900)) {
        h.back.push(prev);
        if (h.back.length > 150) h.back.shift();
        h.forward = [];
      }
      h.group = group;
      h.t = now;
      setTl(next);
      scheduleSave(next);
    },
    [scheduleSave],
  );

  const undo = () => {
    const h = history.current;
    const prev = h.back.pop();
    if (!prev || !tl) return;
    h.forward.push(tl);
    h.group = '';
    setTl(prev);
    scheduleSave(prev);
  };
  const redo = () => {
    const h = history.current;
    const next = h.forward.pop();
    if (!next || !tl) return;
    h.back.push(tl);
    h.group = '';
    setTl(next);
    scheduleSave(next);
  };

  // Claude edited timeline.json: if there are no local changes waiting to be saved, it is loaded.
  useEffect(() => {
    const listen = (e: Event) => {
      const m = (e as CustomEvent).detail as { id: string; document: string; doc: Timeline };
      const g = saved.current;
      if (m.id !== project.id || m.document !== 'timeline' || g.pending || (m.doc.rev || 0) <= g.rev) return;
      g.rev = m.doc.rev || 0;
      setTl(m.doc);
      notify('Timeline updated from disk (Claude).', 'claude', undefined, 6000);
    };
    window.addEventListener('montage:document', listen);
    return () => window.removeEventListener('montage:document', listen);
  }, [project.id]);

  // ----- text/logo rasters (the ffmpeg export uses them)

  const syncRasters = useCallback(
    async (d: Timeline) => {
      const layers = d.clips.filter((c): c is LayerClip => c.type === 'text' || c.type === 'image');
      if (!layers.length) return;
      const keys = layers.map((c) => rasterKey(c, d.format));
      const { existing } = await api.rasters(project.id, keys);
      const missing = layers.filter((_, i) => !existing.includes(keys[i]));
      if (!missing.length) return;
      await Promise.all(
        missing
          .filter((c) => c.layer.type === 'text')
          .map((c) => document.fonts.load(`${(c.layer as TextLayer).weight} 32px "${(c.layer as TextLayer).font}"`).catch(() => [])),
      );
      const images = new Map<string, HTMLImageElement>();
      await Promise.all(
        missing
          .filter((c) => c.layer.type === 'image')
          .map(
            (c) =>
              new Promise<void>((ok) => {
                const img = new Image();
                img.onload = img.onerror = () => ok();
                img.src = repoUrl((c.layer as ImageLayer).path);
                images.set((c.layer as ImageLayer).path, img);
              }),
          ),
      );
      const rasters = missing.map((c) => {
        const cv = document.createElement('canvas');
        renderLayer(cv, c.layer, d.format, 1, images);
        return { key: rasterKey(c, d.format), png: cv.toDataURL('image/png') };
      });
      await api.uploadRasters(project.id, rasters);
    },
    [project.id],
  );
  useEffect(() => {
    if (!tl) return;
    const t = setTimeout(() => syncRasters(tl).catch(() => {}), 900);
    return () => clearTimeout(t);
  }, [tl, syncRasters]);

  // ----- editing actions

  const t = () => clock.t;
  const selected = tl ? tl.clips.filter((c) => sel.includes(c.id)) : [];
  const single = selected.length === 1 ? selected[0] : null;

  const splitAt = (targets: Clip[], instant: number) => {
    if (!tl || !targets.length) return;
    let clips = [...tl.clips];
    let count = 0;
    for (const c of targets) {
      const parts = split(c, instant, tl.format.fps);
      if (!parts) continue;
      clips = clips.flatMap((x) => (x.id === c.id ? parts : [x]));
      count++;
    }
    if (count) apply({ ...tl, clips });
  };

  const splitAtPlayhead = () => {
    if (!tl) return;
    const now = t();
    const locked = tl.tracks.filter((p) => p.locked).map((p) => p.id);
    const under = tl.clips.filter((c) => !locked.includes(c.track) && now > c.start && now < end(c));
    const targets = sel.length ? under.filter((c) => sel.includes(c.id)) : under;
    splitAt(targets, now);
  };

  const remove = (ripple: boolean) => {
    if (!tl || !sel.length) return;
    apply(ripple ? rippleDelete(tl, sel) : { ...tl, clips: tl.clips.filter((c) => !sel.includes(c.id)) });
    setSel([]);
  };

  const duplicate = () => {
    if (!tl || !selected.length) return;
    const selEnd = Math.max(...selected.map(end));
    const selStart = Math.min(...selected.map((c) => c.start));
    const copies = selected.map((c) => ({ ...c, id: newClipId(), start: toFrame(c.start - selStart + selEnd, tl.format.fps) }) as Clip);
    apply({ ...tl, clips: [...tl.clips, ...copies] });
    setSel(copies.map((c) => c.id));
  };

  const addText = () => {
    if (!tl) return;
    const track = tl.tracks.find((p) => p.type === 'video' && !p.locked);
    if (!track) return;
    const clip: LayerClip = {
      id: newClipId(),
      track: track.id,
      type: 'text',
      start: toFrame(t(), tl.format.fps),
      duration: 3,
      fadeIn: 0.15,
      fadeOut: 0.15,
      opacity: 1,
      layer: { ...textLayer({ width: tl.format.width, height: tl.format.height }), y: Math.round(tl.format.height * 0.18) },
    };
    apply({ ...tl, clips: [...tl.clips, clip] });
    setSel([clip.id]);
  };

  const changeClip = (id: string, changes: Partial<Clip>, group = '') => {
    if (!tl) return;
    apply({ ...tl, clips: tl.clips.map((c) => (c.id === id ? ({ ...c, ...changes } as Clip) : c)) }, undefined, group);
  };

  const changeTrack = (id: string, changes: Partial<Track>) => {
    if (!tl) return;
    apply({ ...tl, tracks: tl.tracks.map((p) => (p.id === id ? { ...p, ...changes } : p)) });
  };

  const dropMedia = async (m: DraggedMedia, track: Track, start: number) => {
    if (!tl) return;
    let item = media.get(m.path);
    try {
      item = item || (await api.media(m.path));
      setMedia((prev) => new Map(prev).set(m.path, item!));
    } catch (e) {
      return notify(`Could not read ${m.name}: ${(e as Error).message}`, 'error');
    }
    const meta = item.meta;
    const fps = tl.format.fps;
    let clip: Clip;
    if (meta.type === 'image') {
      if (track.type !== 'video') return notify('Images go on a video track.', 'error');
      const W = tl.format.width;
      const H = tl.format.height;
      const s = Math.max(W / (meta.width || W), H / (meta.height || H));
      const width = Math.round((meta.width || W) * s);
      const height = Math.round((meta.height || H) * s);
      clip = {
        id: newClipId(),
        track: track.id,
        type: 'image',
        start,
        duration: 3,
        fadeIn: 0,
        fadeOut: 0,
        opacity: 1,
        layer: { id: newId(), type: 'image', path: m.path, name: m.name, x: Math.round((W - width) / 2), y: Math.round((H - height) / 2), width, height, rotation: 0, opacity: 1 },
      };
    } else if (meta.type === 'audio' || track.type === 'audio') {
      if (track.type !== 'audio') return notify('Audio goes on an audio track (A1, A2).', 'error');
      if (!meta.hasAudio && meta.type !== 'audio') return notify('That video has no audio.', 'error');
      clip = { id: newClipId(), track: track.id, type: 'audio', path: m.path, name: m.name, start, duration: toFrame(meta.duration || 1, fps), sourceIn: 0, speed: 1, volume: 1, fadeIn: 0, fadeOut: 0, length: meta.duration || 1 };
    } else {
      clip = {
        id: newClipId(),
        track: track.id,
        type: 'video',
        path: m.path,
        name: m.name,
        start,
        duration: toFrame(meta.duration || 1, fps),
        sourceIn: 0,
        speed: 1,
        volume: 1,
        fadeIn: 0,
        fadeOut: 0,
        opacity: 1,
        transform: baseTransform(),
        length: meta.duration || 1,
        hasAudio: !!meta.hasAudio,
      };
    }
    apply({ ...tl, clips: [...tl.clips, clip] });
    setSel([clip.id]);
  };

  // ----- export

  const exportVersion = async () => {
    if (!tl) return;
    try {
      const g = saved.current;
      if (g.pending) {
        clearTimeout(g.timer);
        const r = await api.saveDocument(project.id, 'timeline', { ...tl, rev: g.rev });
        g.rev = r.rev;
        g.pending = false;
      }
      await syncRasters(tl);
      engine.pause();
      const r = await api.export(project.id, '');
      setJobId(r.job);
    } catch (e) {
      notify((e as Error).message, 'error');
    }
  };

  useEffect(() => {
    if (!job) return;
    if (job.done && job.version) {
      notify(`Exported as ${job.version}. It is in Review now.`, 'ok', { text: 'View', fn: () => (setStore({ selVersion: job.version! }), (location.hash = `#/p/${project.id}`)) }, 9000);
      setJobId(null);
    } else if (job.error) {
      notify(`The export failed: ${job.error}`, 'error', undefined, 10000);
      setJobId(null);
    }
  }, [job, project.id]);

  // ----- keyboard

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (isTyping(e) || !tl) return;
      const cmd = e.metaKey || e.ctrlKey;
      const fps = tl.format.fps;
      if (cmd && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        return e.shiftKey ? redo() : undo();
      }
      // Ctrl+Y: redo, as on Windows.
      if (e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        return redo();
      }
      if (cmd && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        return duplicate();
      }
      if (cmd) return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          engine.toggle();
          break;
        case 'ArrowLeft':
        case 'ArrowRight': {
          e.preventDefault();
          engine.pause();
          const d = (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? fps : 1);
          engine.seek((Math.round(clock.t * fps) + d) / fps);
          break;
        }
        case 'Home':
          engine.seek(0);
          break;
        case 'End':
          engine.seek(timelineDuration(tl));
          break;
        case 'k':
          engine.pause();
          break;
        case 'l':
          engine.play();
          break;
        case 'j':
          engine.pause();
          engine.seek(clock.t - 1);
          break;
        case 's':
          splitAtPlayhead();
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          remove(e.shiftKey);
          break;
        case 'v':
          setTool('select');
          break;
        case 'b':
          setTool('blade');
          break;
        case 'n':
          setSnapOn((x) => !x);
          break;
        case 't':
          addText();
          break;
        case '+':
        case '=':
          setPps((x) => clamp(x * 1.4, 4, fps * 60));
          break;
        case '-':
          setPps((x) => clamp(x / 1.4, 4, fps * 60));
          break;
        case 'Escape':
          setSel([]);
          break;
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  if (!tl) return <div className="loading">Preparing the video editor…</div>;

  const duration = timelineDuration(tl);

  return (
    <div className="video-editor">
      <Library project={project} />
      <div className="ve-center">
        <Monitor tl={tl} engine={engine} selected={single} onMove={(id, changes, before) => apply({ ...tl, clips: tl.clips.map((c) => (c.id === id ? ({ ...c, ...changes } as Clip) : c)) }, before)} onTemp={setTl} />
        <div className="ve-transport">
          <Timecode fps={tl.format.fps} />
          <span className="tc-total">/ {timecode(duration, tl.format.fps)}</span>
          <div className="transport-buttons">
            <button className="ico" title="Previous frame (←)" onClick={() => (engine.pause(), engine.seek(clock.t - 1 / tl.format.fps))}>
              <ChevronLeft size={18} />
            </button>
            <button className="ico large" title="Play / pause (Space)" onClick={() => engine.toggle()}>
              {playing ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button className="ico" title="Next frame (→)" onClick={() => (engine.pause(), engine.seek(clock.t + 1 / tl.format.fps))}>
              <ChevronRight size={18} />
            </button>
          </div>
          <span className="dim small">
            {tl.format.width}×{tl.format.height} · {tl.format.fps} fps
          </span>
        </div>
      </div>
      <aside className="panel inspector-panel">
        {single ? (
          <ClipInspector clip={single} tl={tl} onChange={(changes, group) => changeClip(single.id, changes, group)} />
        ) : (
          <TimelineInspector tl={tl} selectedCount={selected.length} onChange={(d) => apply(d)} />
        )}
      </aside>
      <div className="ve-bottom">
        <div className="ve-bar">
          <div className="segmented">
            <button className={cx(tool === 'select' && 'active')} onClick={() => setTool('select')} title="Select (V)">
              <MousePointer2 size={13} /> Select
            </button>
            <button className={cx(tool === 'blade' && 'active')} onClick={() => setTool('blade')} title="Blade: click a clip to split it there (B)">
              <Scissors size={13} /> Blade
            </button>
          </div>
          <button className="btn small" onClick={splitAtPlayhead} title="Split at the playhead (S)">
            <Scissors size={13} /> Split
          </button>
          <button className="btn small" onClick={() => remove(false)} disabled={!sel.length} title="Delete (Del)">
            <Trash2 size={13} />
          </button>
          <button className="btn small" onClick={() => remove(true)} disabled={!sel.length} title="Delete and close the gap (Shift+Del)">
            <WrapText size={13} /> Ripple
          </button>
          <button className="btn small" onClick={duplicate} disabled={!sel.length} title={`Duplicate (${CMD}+D)`}>
            <Copy size={13} />
          </button>
          <button className="btn small" onClick={addText} title="Text at the playhead (T)">
            <Type size={13} /> Text
          </button>
          <button className={cx('btn small', snapOn && 'active')} onClick={() => setSnapOn(!snapOn)} title="Snap (N)">
            <Magnet size={13} />
          </button>
          <button className="ico" title={`Undo (${CMD}+Z)`} disabled={!history.current.back.length} onClick={undo}>
            <Undo2 size={15} />
          </button>
          <button className="ico" title={`Redo (Shift+${CMD}+Z)`} disabled={!history.current.forward.length} onClick={redo}>
            <Redo2 size={15} />
          </button>
          <input className="zoom-tl" type="range" min={4} max={tl.format.fps * 60} value={pps} title={`Zoom (${CMD} + wheel, + / -)`} onChange={(e) => setPps(Number(e.target.value))} />
          <div className="bar-right">
            {job && !job.done && !job.error && (
              <span className="export-progress">
                <span className="progress-bar">
                  <span style={{ transform: `scaleX(${job.progress})` }} />
                </span>
                Exporting… {Math.round(job.progress * 100)}%
              </span>
            )}
            <button className="btn primary" onClick={exportVersion} disabled={!!jobId || !tl.clips.length} title="Render with ffmpeg and publish as a new version">
              <Film size={14} /> Export as version
            </button>
          </div>
        </div>
        <EditTimeline
          tl={tl}
          sel={sel}
          pps={pps}
          setPps={setPps}
          tool={tool}
          snapOn={snapOn}
          media={media}
          onSelect={setSel}
          onTempChange={setTl}
          onCommit={(next, before) => apply(next, before)}
          onSeek={(x) => (engine.pause(), engine.seek(x))}
          onDropMedia={dropMedia}
          onSplitAt={(c, x) => splitAt([c], x)}
          onChangeTrack={changeTrack}
        />
      </div>
    </div>
  );
}

function Timecode({ fps }: { fps: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(
    () =>
      clock.subscribe((t) => {
        if (ref.current) ref.current.textContent = timecode(t, fps);
      }),
    [fps],
  );
  return <span className="tc" ref={ref} />;
}

// ---------------------------------------------------------------- monitor

function Monitor({ tl, engine, selected, onMove, onTemp }: { tl: Timeline; engine: Engine; selected: Clip | null; onMove: (id: string, changes: Partial<Clip>, before: Timeline) => void; onTemp: (t: Timeline) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 600, h: 500 });
  const drag = useRef<{ x: number; y: number; before: Timeline; clip: Clip } | null>(null);

  useLayoutEffect(() => {
    const el = box.current!;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  const { width: W, height: H } = tl.format;
  const e = Math.max(0.05, Math.min((size.w - 24) / W, (size.h - 24) / H));
  const dpr = window.devicePixelRatio || 1;
  useEffect(() => {
    const c = canvas.current!;
    c.width = Math.round(Math.min(W, W * e * dpr));
    c.height = Math.round(Math.min(H, H * e * dpr));
    engine.attach(c);
  }, [e, W, H, dpr, engine]);

  const visual = selected && selected.type !== 'audio' ? selected : null;
  const down = (ev: React.PointerEvent) => {
    if (!visual) return;
    ev.currentTarget.setPointerCapture(ev.pointerId);
    drag.current = { x: ev.clientX, y: ev.clientY, before: tl, clip: visual };
  };
  const move = (ev: React.PointerEvent) => {
    const a = drag.current;
    if (!a) return;
    const dx = Math.round((ev.clientX - a.x) / e);
    const dy = Math.round((ev.clientY - a.y) / e);
    const c = a.clip;
    const changes = c.type === 'video' ? { transform: { ...c.transform, x: c.transform.x + dx, y: c.transform.y + dy } } : c.type !== 'audio' ? { layer: { ...c.layer, x: c.layer.x + dx, y: c.layer.y + dy } } : {};
    onTemp({ ...a.before, clips: a.before.clips.map((x) => (x.id === c.id ? ({ ...x, ...changes } as Clip) : x)) });
  };
  const up = (ev: React.PointerEvent) => {
    const a = drag.current;
    drag.current = null;
    if (!a || (Math.abs(ev.clientX - a.x) < 2 && Math.abs(ev.clientY - a.y) < 2)) return;
    const current = engine.tl.clips.find((x) => x.id === a.clip.id);
    if (current) onMove(current.id, current, a.before);
  };

  return (
    <div className="ve-monitor" ref={box}>
      <canvas
        ref={canvas}
        className={cx('ve-canvas', visual && 'movable')}
        style={{ width: W * e, height: H * e }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        title={visual ? 'Drag to move the selected clip' : undefined}
      />
    </div>
  );
}

// ---------------------------------------------------------------- library

function Library({ project }: { project: Project }) {
  const [tab, setTab] = useState<'versions' | 'media' | 'repo'>('versions');
  const [dir, setDir] = useState('brands');
  const [entries, setEntries] = useState<RepoEntry[]>([]);
  const [reload, setReload] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tab === 'versions') return;
    const folder = tab === 'media' ? `montage/projects/${project.id}/media` : dir;
    api
      .repo(folder)
      .then((r) => setEntries(r.entries))
      .catch(() => setEntries([]));
  }, [tab, dir, project.id, reload]);

  const dragStart = (ev: React.DragEvent, m: DraggedMedia) => {
    ev.dataTransfer.setData(DRAG_TYPE, JSON.stringify(m));
    ev.dataTransfer.effectAllowed = 'copy';
  };

  const uploadFiles = async (files: FileList | null) => {
    for (const f of files || []) {
      try {
        await uploadMedia(project.id, f, f.name);
      } catch (e) {
        notify((e as Error).message, 'error');
      }
    }
    setTab('media');
    setReload((x) => x + 1);
  };

  const icon = (type: string) => (type === 'video' ? <Film size={14} /> : type === 'audio' ? <Music size={14} /> : <ImageIcon size={14} />);

  return (
    <aside className="panel library-panel">
      <header className="panel-head">
        <h2>Media</h2>
        <button className="btn mini" onClick={() => input.current?.click()} title="Upload video, image or music to the project">
          <Upload size={12} /> Upload
        </button>
        <input ref={input} type="file" multiple hidden accept="video/*,image/*,audio/*" onChange={(e) => uploadFiles(e.target.files)} />
      </header>
      <div className="tabs" style={{ margin: '8px 10px 0' }}>
        {(['versions', 'media', 'repo'] as const).map((p) => (
          <button key={p} className={cx(tab === p && 'active')} onClick={() => setTab(p)}>
            {p === 'versions' ? 'Versions' : p === 'media' ? 'Project' : 'Repo'}
          </button>
        ))}
      </div>
      <div className="panel-body">
        <p className="track">Drag onto the timeline.</p>
        {tab === 'versions' &&
          [...project.versions].reverse().flatMap((v) =>
            v.files.map((a) => (
              <div
                key={v.id + a.path}
                className="media-bin"
                draggable
                onDragStart={(ev) => dragStart(ev, { path: versionPath(project.id, a.path), name: `${v.id} · ${a.name}`, type: a.type as DraggedMedia['type'], meta: a.meta })}
              >
                {a.type === 'image' ? <img src={fileUrl(project.id, a.path)} alt="" /> : icon(a.type)}
                <span className="name">
                  <b>{v.id}</b> {a.name}
                </span>
              </div>
            )),
          )}
        {tab !== 'versions' && (
          <>
            {tab === 'repo' && (
              <div className="crumbs">
                <button onClick={() => setDir(dir.split('/').slice(0, -1).join('/'))} disabled={!dir}>
                  ↑
                </button>
                <span className="dim">{dir || 'creator-os'}</span>
              </div>
            )}
            {entries
              .filter((x) => x.type !== 'other')
              .map((x) =>
                x.type === 'folder' ? (
                  <button key={x.path} className="media-bin folder" onClick={() => setDir(x.path)}>
                    📁 <span className="name">{x.name}</span>
                  </button>
                ) : (
                  <div key={x.path} className="media-bin" draggable onDragStart={(ev) => dragStart(ev, { path: x.path, name: x.name, type: x.type as DraggedMedia['type'], meta: { type: x.type as 'video' } })}>
                    {x.type === 'image' ? <img src={repoUrl(x.path)} alt="" loading="lazy" /> : icon(x.type)}
                    <span className="name">{x.name}</span>
                    <small className="dim">{bytes(x.size)}</small>
                  </div>
                ),
              )}
            {!entries.length && <p className="empty">{tab === 'media' ? 'Upload music, logos or clips with "Upload".' : 'Empty folder.'}</p>}
          </>
        )}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------- inspector

function SecondsField({ name, value, onChange, step = 0.1, min = 0 }: { name: string; value: number; onChange: (v: number) => void; step?: number; min?: number }) {
  return (
    <label className="number">
      <span>{name}</span>
      <input type="number" step={step} min={min} value={Math.round(value * 1000) / 1000} onChange={(e) => e.target.value !== '' && onChange(Math.max(min, Number(e.target.value)))} />
    </label>
  );
}

function ClipInspector({ clip, tl, onChange }: { clip: Clip; tl: Timeline; onChange: (c: Partial<Clip>, group?: string) => void }) {
  const fps = tl.format.fps;
  const changeTime = (changes: Partial<Clip>) => {
    const r = { ...changes };
    for (const k of ['start', 'duration'] as const) if (r[k] !== undefined) r[k] = Math.max(k === 'duration' ? 1 / fps : 0, toFrame(r[k]!, fps));
    onChange(r, 'time');
  };
  const title = { video: 'Video clip', audio: 'Audio clip', text: 'Text', image: 'Image / logo' }[clip.type];
  return (
    <>
      <header className="panel-head">
        <h2>{title}</h2>
      </header>
      <div className="panel-body inspector">
        {'name' in clip && <p className="dim small">{clip.path}</p>}
        <div className="number-row">
          <SecondsField name="Start (s)" value={clip.start} onChange={(v) => changeTime({ start: v })} />
          <SecondsField name="Duration (s)" value={clip.duration} onChange={(v) => changeTime({ duration: v })} />
          {hasMedia(clip) && <SecondsField name="In point in the media (s)" value={clip.sourceIn} onChange={(v) => onChange({ sourceIn: v } as Partial<Clip>, 'in')} />}
          <SecondsField name="Fade in (s)" value={clip.fadeIn} onChange={(v) => onChange({ fadeIn: Math.min(v, clip.duration) }, 'fi')} />
          <SecondsField name="Fade out (s)" value={clip.fadeOut} onChange={(v) => onChange({ fadeOut: Math.min(v, clip.duration) }, 'fo')} />
        </div>
        {hasMedia(clip) && (
          <>
            <Slider
              name="Speed"
              value={clip.speed}
              min={0.25}
              max={4}
              step={0.05}
              unit="×"
              onChange={(v) => onChange({ speed: v, duration: toFrame((clip.duration * clip.speed) / v, fps) } as Partial<Clip>, 'speed')}
            />
            <Slider name="Volume" value={Math.round(clip.volume * 100)} min={0} max={200} unit="%" onChange={(v) => onChange({ volume: v / 100 } as Partial<Clip>, 'vol')} />
          </>
        )}
        {clip.type !== 'audio' && <Slider name="Opacity" value={Math.round(clip.opacity * 100)} min={0} max={100} unit="%" onChange={(v) => onChange({ opacity: v / 100 } as Partial<Clip>, 'op')} />}
        {clip.type === 'video' && <VideoTransform c={clip} onChange={onChange} />}
        {clip.type === 'text' && clip.layer.type === 'text' && <TextInspector c={clip.layer} onChange={(changes, group) => onChange({ layer: { ...clip.layer, ...changes } } as Partial<Clip>, group)} />}
        {clip.type === 'image' && clip.layer.type === 'image' && (
          <div className="number-row">
            <SecondsField name="X" step={1} min={-99999} value={clip.layer.x} onChange={(v) => onChange({ layer: { ...clip.layer, x: Math.round(v) } } as Partial<Clip>, 'x')} />
            <SecondsField name="Y" step={1} min={-99999} value={clip.layer.y} onChange={(v) => onChange({ layer: { ...clip.layer, y: Math.round(v) } } as Partial<Clip>, 'y')} />
            <SecondsField
              name="Width"
              step={1}
              value={clip.layer.width}
              onChange={(v) => {
                const c = clip.layer as ImageLayer;
                onChange({ layer: { ...c, width: Math.round(v), height: Math.round((v * c.height) / c.width) } } as Partial<Clip>, 'width');
              }}
            />
            <SecondsField name="Rotation (°)" step={1} min={-180} value={clip.layer.rotation} onChange={(v) => onChange({ layer: { ...clip.layer, rotation: v } } as Partial<Clip>, 'rot')} />
          </div>
        )}
        <p className="track">Drag on the monitor to move it. The clip edges on the timeline trim it.</p>
      </div>
    </>
  );
}

function VideoTransform({ c, onChange }: { c: VideoClip; onChange: (changes: Partial<Clip>, group?: string) => void }) {
  const tr = c.transform;
  const change = (x: Partial<VideoClip['transform']>, group: string) => onChange({ transform: { ...tr, ...x } } as Partial<Clip>, group);
  return (
    <>
      <div className="segmented">
        <button className={cx(tr.fit === 'cover' && 'active')} onClick={() => change({ fit: 'cover' }, 'fit')}>
          Fill frame
        </button>
        <button className={cx(tr.fit === 'contain' && 'active')} onClick={() => change({ fit: 'contain' }, 'fit')}>
          Show all
        </button>
      </div>
      <Slider name="Scale" value={Math.round(tr.scale * 100)} min={10} max={400} unit="%" onChange={(v) => change({ scale: v / 100 }, 'scale')} />
      <Slider name="Rotation" value={tr.rotation} min={-180} max={180} unit="°" onChange={(v) => change({ rotation: v }, 'rot')} />
      <div className="number-row">
        <SecondsField name="X (px)" step={1} min={-99999} value={tr.x} onChange={(v) => change({ x: Math.round(v) }, 'x')} />
        <SecondsField name="Y (px)" step={1} min={-99999} value={tr.y} onChange={(v) => change({ y: Math.round(v) }, 'y')} />
      </div>
      {(tr.x !== 0 || tr.y !== 0 || tr.scale !== 1 || tr.rotation !== 0) && (
        <button className="btn mini" onClick={() => change({ x: 0, y: 0, scale: 1, rotation: 0 }, '')}>
          Reset position
        </button>
      )}
    </>
  );
}

function TimelineInspector({ tl, selectedCount, onChange }: { tl: Timeline; selectedCount: number; onChange: (d: Timeline) => void }) {
  return (
    <>
      <header className="panel-head">
        <h2>{selectedCount > 1 ? `${selectedCount} clips` : 'Sequence'}</h2>
      </header>
      <div className="panel-body inspector">
        <p className="dim small">
          {tl.format.width} × {tl.format.height} · {tl.format.fps} fps · {tl.clips.length} clips
        </p>
        <ColorField name="Background" value={tl.background} onChange={(v) => onChange({ ...tl, background: v || '#000000' })} />
        <div className="editor-help">
          <p>
            <b>Shortcuts:</b> Space play · ←/→ frame · S split · B blade · T text · Del delete (Shift: close the gap) · {CMD}+D duplicate · N snap · {CMD}+Z undo
          </p>
          <p>
            Claude can edit this timeline too: it lives in <code>montage/projects/&lt;id&gt;/timeline.json</code> and the editor updates on its own.
          </p>
        </div>
      </div>
    </>
  );
}
