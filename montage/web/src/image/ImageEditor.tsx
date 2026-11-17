import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Copy,
  Crop as CropIcon,
  Eye,
  EyeOff,
  FlipHorizontal2,
  FlipVertical2,
  Image as ImageIcon,
  RotateCcw,
  RotateCw,
  Save,
  Square,
  Trash2,
  Type,
  Undo2,
  Redo2,
} from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FORMATS } from '../../../shared/formats.js';
import { api, upload, uploadMedia, fileUrl, repoUrl } from '../api';
import { notify, setStore } from '../state';
import type { RepoEntry, Project, Version } from '../types';
import { CMD, clamp, cx, isTyping } from '../util';
import {
  ZERO_ADJUSTMENTS,
  ADJUSTMENT_CONTROLS,
  FONTS,
  textLayer,
  rotatedDims,
  newDoc,
  newId,
  centeredCrop,
  type Layer,
  type TextLayer,
  type ImageDoc,
  type Crop,
} from './model';
import { layerBox, layerAt, loadFonts, render } from './render';

interface Props {
  project: Project;
  version: Version;
  page: number;
}

type Drag =
  | { type: 'move'; id: string; x0: number; y0: number; cx: number; cy: number; initial: ImageDoc; moved: boolean }
  | { type: 'scale' | 'width' | 'rotate'; id: string; x0: number; y0: number; layer: Layer; initial: ImageDoc; moved: boolean };

const PAD = 36;

export function ImageEditor({ project, version, page }: Props) {
  const file = version.files[Math.min(page, version.files.length - 1)];
  const [doc, setDoc] = useState<ImageDoc | null>(null);
  const history = useRef<{ back: ImageDoc[]; forward: ImageDoc[]; group: string; t: number }>({ back: [], forward: [], group: '', t: 0 });
  const [, force] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop | null>(null);
  const [before, setBefore] = useState(false);
  const [base, setBase] = useState<HTMLImageElement | null>(null);
  const images = useRef(new Map<string, HTMLImageElement>());
  const [guides, setGuides] = useState<{ v: boolean; h: boolean }>({ v: false, h: false });
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 900, h: 700 });
  const drag = useRef<Drag | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);

  // ----- loading

  useEffect(() => {
    let alive = true;
    const baseInfo = { version: version.id, page, path: file.path, width: file.meta.width || 1080, height: file.meta.height || 1080 };
    api
      .document<ImageDoc>(project.id, 'image')
      .then((d) => {
        if (!alive) return;
        const fits = d && d.base?.version === version.id && d.base?.page === page;
        setDoc(fits ? d : newDoc(baseInfo));
        history.current = { back: [], forward: [], group: '', t: 0 };
        setSel(null);
      })
      .catch(() => alive && setDoc(newDoc(baseInfo)));
    return () => {
      alive = false;
    };
  }, [project.id, version.id, page, file.path, file.meta.width, file.meta.height]);

  useEffect(() => {
    setBase(null);
    const img = new Image();
    img.onload = () => setBase(img);
    img.src = fileUrl(project.id, file.path);
  }, [project.id, file.path]);

  useEffect(() => {
    if (!doc) return;
    for (const c of doc.layers) {
      if (c.type !== 'image' || images.current.has(c.path)) continue;
      const img = new Image();
      img.onload = () => force((n) => n + 1);
      img.src = repoUrl(c.path);
      images.current.set(c.path, img);
    }
    loadFonts(doc).then(() => force((n) => n + 1));
  }, [doc]);

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [doc === null]);

  // ----- changes with history (grouped for sliders and drags)

  const change = useCallback(
    (next: ImageDoc, group = '', from?: ImageDoc) => {
      const h = history.current;
      const now = Date.now();
      const prev = from || doc;
      if (prev && !(group && group === h.group && now - h.t < 900)) {
        h.back.push(prev);
        if (h.back.length > 120) h.back.shift();
        h.forward = [];
      }
      h.group = group;
      h.t = now;
      setDoc(next);
      clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        api.saveDocument(project.id, 'image', next, true).catch(() => {});
      }, 700);
    },
    [doc, project.id],
  );

  const undo = () => {
    const h = history.current;
    const prev = h.back.pop();
    if (!prev || !doc) return;
    h.forward.push(doc);
    h.group = '';
    setDoc(prev);
  };
  const redo = () => {
    const h = history.current;
    const next = h.forward.pop();
    if (!next || !doc) return;
    h.back.push(doc);
    h.group = '';
    setDoc(next);
  };

  const updateLayer = (id: string, changes: Partial<Layer>, group = '') => {
    if (!doc) return;
    change({ ...doc, layers: doc.layers.map((c) => (c.id === id ? ({ ...c, ...changes } as Layer) : c)) }, group);
  };

  // ----- view geometry

  const inCrop = crop !== null;
  const rot = doc ? rotatedDims(doc) : { w: 1, h: 1 };
  const viewW = inCrop ? rot.w : doc?.output.width || 1;
  const viewH = inCrop ? rot.h : doc?.output.height || 1;
  const vs = Math.max(0.02, Math.min((size.w - PAD * 2) / viewW, (size.h - PAD * 2) / viewH));
  const dpr = window.devicePixelRatio || 1;

  // ----- render

  useEffect(() => {
    if (!doc || !base || !canvas.current) return;
    const id = requestAnimationFrame(() => {
      if (before) render(canvas.current!, newDoc(doc.base), { base, images: images.current }, { scale: Math.min(1, vs * dpr), full: true });
      else render(canvas.current!, doc, { base, images: images.current }, { scale: Math.min(1, vs * dpr), full: inCrop });
    });
    return () => cancelAnimationFrame(id);
  });

  // ----- canvas interaction

  const toOutput = (e: { clientX: number; clientY: number }) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * viewW, y: ((e.clientY - r.top) / r.height) * viewH };
  };

  const onDown = (e: React.PointerEvent) => {
    if (!doc || inCrop || before || e.button !== 0) return;
    const p = toOutput(e);
    const c = layerAt(doc, p.x, p.y);
    setSel(c?.id ?? null);
    if (c) {
      drag.current = { type: 'move', id: c.id, x0: p.x, y0: p.y, cx: c.x, cy: c.y, initial: doc, moved: false };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const startHandle = (e: React.PointerEvent, type: 'scale' | 'width' | 'rotate', layer: Layer) => {
    e.stopPropagation();
    if (!doc) return;
    const p = toOutput(e);
    drag.current = { type, id: layer.id, x0: p.x, y0: p.y, layer, initial: doc, moved: false };
    stage.current!.setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    const a = drag.current;
    if (!a || !doc) return;
    const p = toOutput(e);
    const dx = p.x - a.x0;
    const dy = p.y - a.y0;
    if (Math.abs(dx) + Math.abs(dy) > 1) a.moved = true;
    const W = doc.output.width;
    const H = doc.output.height;
    const threshold = 8 / vs;
    const replace = (changes: Partial<Layer>) =>
      setDoc({ ...doc, layers: doc.layers.map((c) => (c.id === a.id ? ({ ...c, ...changes } as Layer) : c)) });
    if (a.type === 'move') {
      const c = doc.layers.find((x) => x.id === a.id)!;
      const k = layerBox(c);
      let x = Math.round(a.cx + dx);
      let y = Math.round(a.cy + dy);
      const v = Math.abs(x + k.w / 2 - W / 2) < threshold;
      const h = Math.abs(y + k.h / 2 - H / 2) < threshold;
      if (v && !e.altKey) x = Math.round(W / 2 - k.w / 2);
      if (h && !e.altKey) y = Math.round(H / 2 - k.h / 2);
      setGuides({ v: v && !e.altKey, h: h && !e.altKey });
      replace({ x, y });
    } else if (a.type === 'scale') {
      const c = a.layer;
      const k = layerBox(c);
      const f = Math.max(0.05, (k.w + dx) / k.w);
      if (c.type === 'text') replace({ width: Math.round(c.width * f), size: Math.max(6, Math.round(c.size * f)) });
      else if (c.type === 'image' || e.shiftKey) replace({ width: Math.round(c.width * f), height: Math.round(c.height * f) });
      else replace({ width: Math.max(4, Math.round(c.width + dx)), height: Math.max(4, Math.round(c.height + dy)) });
    } else if (a.type === 'width' && a.layer.type === 'text') {
      replace({ width: Math.max(a.layer.size, Math.round(a.layer.width + dx)) });
    } else if (a.type === 'rotate') {
      const k = layerBox(a.layer);
      let ang = (Math.atan2(p.y - (k.y + k.h / 2), p.x - (k.x + k.w / 2)) * 180) / Math.PI + 90;
      ang = ((ang + 540) % 360) - 180;
      if (e.shiftKey) ang = Math.round(ang / 15) * 15;
      else if (Math.abs(ang) < 3) ang = 0;
      replace({ rotation: Math.round(ang) });
    }
  };

  const onUp = () => {
    const a = drag.current;
    drag.current = null;
    setGuides({ v: false, h: false });
    if (a?.moved && doc) change(doc, '', a.initial);
  };

  // ----- image actions

  const selFormat = FORMATS.find((f: { id: string }) => f.id === doc?.format) as { id: string; name: string; width: number; height: number } | undefined;

  const startCrop = (format?: string | null) => {
    if (!doc) return;
    const f = (format !== undefined ? FORMATS.find((x: { id: string }) => x.id === format) : selFormat) as typeof selFormat;
    const r = rotatedDims(doc);
    if (format !== undefined) change({ ...doc, format });
    setCrop(f ? centeredCrop(r.w, r.h, f.width / f.height) : { ...doc.crop });
    setSel(null);
  };

  const applyCrop = () => {
    if (!doc || !crop) return;
    const output = selFormat ? { width: selFormat.width, height: selFormat.height } : { width: Math.round(crop.w), height: Math.round(crop.h) };
    change({ ...doc, crop: { x: Math.round(crop.x), y: Math.round(crop.y), w: Math.round(crop.w), h: Math.round(crop.h) }, output });
    setCrop(null);
  };

  const rotate = (d: 90 | -90) => {
    if (!doc) return;
    const rotation = (((doc.rotation + d) % 360) + 360) % 360 as ImageDoc['rotation'];
    const r = rotatedDims({ base: doc.base, rotation });
    const rc = selFormat ? centeredCrop(r.w, r.h, selFormat.width / selFormat.height) : { x: 0, y: 0, w: r.w, h: r.h };
    change({ ...doc, rotation, crop: rc, output: selFormat ? doc.output : { width: r.w, height: r.h } });
  };

  const addLayer = (c: Layer) => {
    if (!doc) return;
    change({ ...doc, layers: [...doc.layers, c] });
    setSel(c.id);
  };

  const addImage = (path: string, name: string) => {
    if (!doc) return;
    const img = new Image();
    img.onload = () => {
      images.current.set(path, img);
      const width = Math.round(doc.output.width * 0.3);
      const height = Math.round((width * img.naturalHeight) / img.naturalWidth);
      addLayer({ id: newId(), type: 'image', path, name, x: Math.round((doc.output.width - width) / 2), y: Math.round(doc.output.height * 0.78 - height / 2), width, height, rotation: 0, opacity: 1 });
    };
    img.onerror = () => notify('Could not load that image.', 'error');
    img.src = repoUrl(path);
  };

  const removeSel = () => {
    if (!doc || !sel) return;
    change({ ...doc, layers: doc.layers.filter((c) => c.id !== sel) });
    setSel(null);
  };

  const duplicateSel = () => {
    const c = doc?.layers.find((x) => x.id === sel);
    if (!c) return;
    addLayer({ ...c, id: newId(), x: c.x + 24, y: c.y + 24 });
  };

  const moveLayer = (d: 1 | -1) => {
    if (!doc || !sel) return;
    const i = doc.layers.findIndex((c) => c.id === sel);
    const j = i + d;
    if (i < 0 || j < 0 || j >= doc.layers.length) return;
    const layers = [...doc.layers];
    [layers[i], layers[j]] = [layers[j], layers[i]];
    change({ ...doc, layers });
  };

  // ----- keyboard

  useEffect(() => {
    const keyDown = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      // Ctrl+Y: redo, as on Windows.
      if (e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (cmd && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSel();
        return;
      }
      if (inCrop) {
        if (e.key === 'Enter') applyCrop();
        if (e.key === 'Escape') setCrop(null);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        e.preventDefault();
        removeSel();
      }
      if (e.key === 'Escape') setSel(null);
      if (e.key === '\\') setBefore(true);
      if (sel && e.key.startsWith('Arrow') && doc) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const c = doc.layers.find((x) => x.id === sel)!;
        const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]!;
        updateLayer(sel, { x: c.x + d[0], y: c.y + d[1] }, 'nudge');
      }
    };
    const keyUp = (e: KeyboardEvent) => e.key === '\\' && setBefore(false);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    return () => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
    };
  });

  if (!doc) return <div className="loading">Preparing the editor…</div>;

  const selLayer = doc.layers.find((c) => c.id === sel) || null;
  const selBox = selLayer ? layerBox(selLayer) : null;

  return (
    <div className="image-editor">
      <LayersPanel
        doc={doc}
        sel={sel}
        project={project}
        onSelect={setSel}
        onAddText={() => addLayer(textLayer(doc.output))}
        onAddShape={() =>
          addLayer({
            id: newId(),
            type: 'shape',
            shape: 'rect',
            x: Math.round(doc.output.width * 0.1),
            y: Math.round(doc.output.height * 0.7),
            width: Math.round(doc.output.width * 0.8),
            height: Math.round(doc.output.height * 0.12),
            fill: '#d97757',
            stroke: null,
            strokeWidth: 0,
            radius: 24,
            rotation: 0,
            opacity: 1,
          })
        }
        onAddImage={addImage}
        onHide={(id, hidden) => updateLayer(id, { hidden })}
        onMove={moveLayer}
      />

      <div className="editor-center">
        <div className="stage" ref={stage} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
          <div className="canvas-wrap" style={{ width: viewW * vs, height: viewH * vs }}>
            <canvas ref={canvas} className="image-canvas" style={{ width: viewW * vs, height: viewH * vs }} />
            {guides.v && <div className="guide v" />}
            {guides.h && <div className="guide h" />}
            {selLayer && selBox && !inCrop && !before && (
              <div
                className="selection"
                style={{ left: selBox.x * vs, top: selBox.y * vs, width: selBox.w * vs, height: selBox.h * vs, transform: `rotate(${selLayer.rotation}deg)` }}
              >
                <span className="handle rotate" title="Rotate (Shift: in 15° steps)" onPointerDown={(e) => startHandle(e, 'rotate', selLayer)} />
                <span className="handle scale" title="Scale" onPointerDown={(e) => startHandle(e, 'scale', selLayer)} />
                {selLayer.type === 'text' && <span className="handle wide" title="Text width" onPointerDown={(e) => startHandle(e, 'width', selLayer)} />}
              </div>
            )}
            {inCrop && crop && (
              <CropBox crop={crop} width={rot.w} height={rot.h} scale={vs} ratio={selFormat ? selFormat.width / selFormat.height : null} onChange={setCrop} />
            )}
            {before && <span className="label-before">Before</span>}
          </div>
        </div>
        <div className="editor-bar">
          {inCrop ? (
            <>
              <span className="dim">
                Crop {Math.round(crop!.w)} × {Math.round(crop!.h)} px{selFormat ? ` → ${selFormat.width} × ${selFormat.height}` : ''}
              </span>
              <div className="bar-right">
                <button className="btn" onClick={() => setCrop(null)}>
                  Cancel <kbd>Esc</kbd>
                </button>
                <button className="btn primary" onClick={applyCrop}>
                  Apply crop <kbd>⏎</kbd>
                </button>
              </div>
            </>
          ) : (
            <>
              <button className="btn small" onClick={() => startCrop()} title="Crop">
                <CropIcon size={14} /> Crop
              </button>
              <select className="selector" value={doc.format || ''} onChange={(e) => startCrop(e.target.value || null)} title="Output format">
                <option value="">Free format ({doc.output.width}×{doc.output.height})</option>
                {FORMATS.map((f: { id: string; name: string; width: number; height: number }) => (
                  <option key={f.id} value={f.id}>
                    {f.name} · {f.width}×{f.height}
                  </option>
                ))}
              </select>
              <button className="ico" title="Rotate left" onClick={() => rotate(-90)}>
                <RotateCcw size={16} />
              </button>
              <button className="ico" title="Rotate right" onClick={() => rotate(90)}>
                <RotateCw size={16} />
              </button>
              <button className={cx('ico', doc.flipH && 'active')} title="Flip horizontal" onClick={() => change({ ...doc, flipH: !doc.flipH })}>
                <FlipHorizontal2 size={16} />
              </button>
              <button className={cx('ico', doc.flipV && 'active')} title="Flip vertical" onClick={() => change({ ...doc, flipV: !doc.flipV })}>
                <FlipVertical2 size={16} />
              </button>
              <span className="sep-v" />
              <button
                className={cx('btn small', before && 'active')}
                onPointerDown={() => setBefore(true)}
                onPointerUp={() => setBefore(false)}
                onPointerLeave={() => setBefore(false)}
                title="Hold to see the original (or the \ key)"
              >
                Before / after
              </button>
              <button className="ico" title={`Undo (${CMD}+Z)`} disabled={!history.current.back.length} onClick={undo}>
                <Undo2 size={16} />
              </button>
              <button className="ico" title={`Redo (Shift+${CMD}+Z)`} disabled={!history.current.forward.length} onClick={redo}>
                <Redo2 size={16} />
              </button>
              <div className="bar-right">
                <SaveVersion project={project} version={version} page={page} doc={doc} base={base} images={images.current} />
              </div>
            </>
          )}
        </div>
      </div>

      <aside className="panel inspector-panel">
        {selLayer ? (
          <LayerInspector
            layer={selLayer}
            onChange={(changes, group) => updateLayer(selLayer.id, changes, group)}
            onRemove={removeSel}
            onDuplicate={duplicateSel}
          />
        ) : (
          <AdjustmentsInspector doc={doc} onChange={change} />
        )}
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------- crop

function CropBox({ crop, width, height, scale, ratio, onChange }: { crop: Crop; width: number; height: number; scale: number; ratio: number | null; onChange: (r: Crop) => void }) {
  const start = useRef<{ x: number; y: number; r: Crop; handle: string } | null>(null);
  const begin = (e: React.PointerEvent, handle: string) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY, r: { ...crop }, handle };
  };
  const move = (e: React.PointerEvent) => {
    const i = start.current;
    if (!i) return;
    const dx = (e.clientX - i.x) / scale;
    const dy = (e.clientY - i.y) / scale;
    let { x, y, w, h } = i.r;
    const m = i.handle;
    if (m === 'move') {
      x = clamp(x + dx, 0, width - w);
      y = clamp(y + dy, 0, height - h);
    } else {
      if (m.includes('e')) w = clamp(w + dx, 20, width - x);
      if (m.includes('s')) h = clamp(h + dy, 20, height - y);
      if (m.includes('w')) {
        const nx = clamp(x + dx, 0, x + w - 20);
        w += x - nx;
        x = nx;
      }
      if (m.includes('n')) {
        const ny = clamp(y + dy, 0, y + h - 20);
        h += y - ny;
        y = ny;
      }
      if (ratio) {
        // Keep the ratio of the chosen format.
        if (m.includes('e') || m.includes('w')) h = w / ratio;
        else w = h * ratio;
        if (y + h > height) {
          h = height - y;
          w = h * ratio;
        }
        if (x + w > width) {
          w = width - x;
          h = w / ratio;
        }
        if (m.includes('n')) y = i.r.y + i.r.h - h;
        if (m.includes('w')) x = i.r.x + i.r.w - w;
      }
    }
    onChange({ x, y, w, h });
  };
  const handles = ratio ? ['nw', 'ne', 'sw', 'se'] : ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  return (
    <div className="crop-layer" onPointerMove={move} onPointerUp={() => (start.current = null)}>
      <div
        className="crop-box"
        style={{ left: crop.x * scale, top: crop.y * scale, width: crop.w * scale, height: crop.h * scale }}
        onPointerDown={(e) => begin(e, 'move')}
      >
        <span className="thirds" />
        {handles.map((m) => (
          <span key={m} className={`crop-handle ${m}`} onPointerDown={(e) => begin(e, m)} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- panels

function LayersPanel(props: {
  doc: ImageDoc;
  sel: string | null;
  project: Project;
  onSelect: (id: string | null) => void;
  onAddText: () => void;
  onAddShape: () => void;
  onAddImage: (path: string, name: string) => void;
  onHide: (id: string, hidden: boolean) => void;
  onMove: (d: 1 | -1) => void;
}) {
  const { doc, sel, project } = props;
  const [logos, setLogos] = useState<RepoEntry[] | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const openLogos = async () => {
    if (logos) return setLogos(null);
    const folders = [`${project.brand}/logo`, `${project.brand}/profile`];
    const found: RepoEntry[] = [];
    for (const c of folders) {
      try {
        const r = await api.repo(c);
        found.push(...r.entries.filter((e) => e.type === 'image'));
      } catch {}
    }
    setLogos(found);
  };
  const uploadLocal = async (f: File) => {
    try {
      const path = await uploadMedia(project.id, f, f.name);
      props.onAddImage(path, f.name);
    } catch (e) {
      notify((e as Error).message, 'error');
    }
  };
  const layerName = (c: Layer) => (c.type === 'text' ? c.text.split('\n')[0] || 'Text' : c.type === 'image' ? c.name : c.shape === 'rect' ? 'Rectangle' : 'Ellipse');
  return (
    <aside className="panel layers-panel">
      <header className="panel-head">
        <h2>Layers</h2>
      </header>
      <div className="panel-body">
        <div className="add-layers">
          <button className="btn small" onClick={props.onAddText}>
            <Type size={14} /> Text
          </button>
          <button className="btn small" onClick={openLogos}>
            <ImageIcon size={14} /> Logo / image
          </button>
          <button className="btn small" onClick={props.onAddShape}>
            <Square size={14} /> Shape
          </button>
        </div>
        {logos && (
          <div className="logos">
            {logos.map((l) => (
              <button key={l.path} className="logo" title={l.name} onClick={() => (props.onAddImage(l.path, l.name), setLogos(null))}>
                <img src={repoUrl(l.path)} alt={l.name} loading="lazy" />
              </button>
            ))}
            <button className="logo upload" onClick={() => input.current?.click()}>
              From your computer…
            </button>
            <input ref={input} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadLocal(e.target.files[0])} />
          </div>
        )}
        <ul className="layer-list">
          {[...doc.layers].reverse().map((c) => (
            <li key={c.id} className={cx(sel === c.id && 'sel', c.hidden && 'hidden')} onClick={() => props.onSelect(c.id)}>
              {c.type === 'text' ? <Type size={13} /> : c.type === 'image' ? <ImageIcon size={13} /> : <Square size={13} />}
              <span className="name">{layerName(c)}</span>
              <button
                className="ico small"
                title={c.hidden ? 'Show' : 'Hide'}
                onClick={(e) => {
                  e.stopPropagation();
                  props.onHide(c.id, !c.hidden);
                }}
              >
                {c.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </li>
          ))}
          <li className={cx('fixed', !sel && 'sel')} onClick={() => props.onSelect(null)}>
            <ImageIcon size={13} /> <span className="name">Base image · adjustments</span>
          </li>
        </ul>
        {sel && (
          <div className="row-right">
            <button className="btn mini" onClick={() => props.onMove(1)} title="Move layer up">
              <ArrowUp size={12} /> Up
            </button>
            <button className="btn mini" onClick={() => props.onMove(-1)} title="Move layer down">
              <ArrowDown size={12} /> Down
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

export function Slider({ name, value, min, max, step = 1, onChange, unit = '' }: { name: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; unit?: string }) {
  return (
    <label className="slider" onDoubleClick={() => onChange(min < 0 ? 0 : min)}>
      <span className="name">{name}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="value">
        {value > 0 && min < 0 ? '+' : ''}
        {Math.round(value * 100) / 100}
        {unit}
      </span>
    </label>
  );
}

function AdjustmentsInspector({ doc, onChange }: { doc: ImageDoc; onChange: (d: ImageDoc, group?: string) => void }) {
  const changed = ADJUSTMENT_CONTROLS.some((c) => doc.adjustments[c.id] !== 0);
  return (
    <>
      <header className="panel-head">
        <h2>Image adjustments</h2>
        {changed && (
          <button className="btn mini" onClick={() => onChange({ ...doc, adjustments: { ...ZERO_ADJUSTMENTS } })}>
            Reset
          </button>
        )}
      </header>
      <div className="panel-body">
        {ADJUSTMENT_CONTROLS.map((c) => (
          <Slider key={c.id} name={c.name} value={doc.adjustments[c.id]} min={c.min} max={c.max} onChange={(v) => onChange({ ...doc, adjustments: { ...doc.adjustments, [c.id]: v } }, `adj-${c.id}`)} />
        ))}
        <p className="track">Double-click a control to set it back to zero. Hold the \ key to compare with the original.</p>
        <p className="track">
          Output: {doc.output.width} × {doc.output.height} px · base {doc.base.width} × {doc.base.height} ({doc.base.version})
        </p>
      </div>
    </>
  );
}

function LayerInspector({ layer, onChange, onRemove, onDuplicate }: { layer: Layer; onChange: (c: Partial<Layer>, group?: string) => void; onRemove: () => void; onDuplicate: () => void }) {
  return (
    <>
      <header className="panel-head">
        <h2>{layer.type === 'text' ? 'Text' : layer.type === 'image' ? 'Image' : 'Shape'}</h2>
        <div className="row-right" style={{ margin: 0 }}>
          <button className="ico small" title={`Duplicate (${CMD}+D)`} onClick={onDuplicate}>
            <Copy size={14} />
          </button>
          <button className="ico small" title="Delete layer (Del)" onClick={onRemove}>
            <Trash2 size={14} />
          </button>
        </div>
      </header>
      <div className="panel-body inspector">
        {layer.type === 'text' && <TextInspector c={layer} onChange={onChange} />}
        {layer.type === 'shape' && (
          <>
            <div className="segmented">
              <button className={cx(layer.shape === 'rect' && 'active')} onClick={() => onChange({ shape: 'rect' })}>
                Rectangle
              </button>
              <button className={cx(layer.shape === 'ellipse' && 'active')} onClick={() => onChange({ shape: 'ellipse' })}>
                Ellipse
              </button>
            </div>
            <ColorField name="Fill" value={layer.fill} allowNone onChange={(v) => onChange({ fill: v }, 'fill')} />
            <ColorField name="Stroke" value={layer.stroke} allowNone onChange={(v) => onChange({ stroke: v, strokeWidth: v && !layer.strokeWidth ? 6 : layer.strokeWidth }, 'stroke')} />
            <Slider name="Stroke width" value={layer.strokeWidth} min={0} max={60} onChange={(v) => onChange({ strokeWidth: v }, 'strokeWidth')} />
            {layer.shape === 'rect' && <Slider name="Corners" value={layer.radius} min={0} max={300} onChange={(v) => onChange({ radius: v }, 'radius')} />}
          </>
        )}
        <Slider name="Opacity" value={Math.round(layer.opacity * 100)} min={0} max={100} unit="%" onChange={(v) => onChange({ opacity: v / 100 }, 'opacity')} />
        <Slider name="Rotation" value={layer.rotation} min={-180} max={180} unit="°" onChange={(v) => onChange({ rotation: v }, 'rotation')} />
        <div className="number-row">
          <NumberField name="X" value={layer.x} onChange={(v) => onChange({ x: v }, 'x')} />
          <NumberField name="Y" value={layer.y} onChange={(v) => onChange({ y: v }, 'y')} />
          <NumberField name="Width" value={layer.width} onChange={(v) => onChange(layer.type === 'image' ? { width: v, height: Math.round((v * layer.height) / layer.width) } : { width: v }, 'width')} />
          {layer.type !== 'text' && <NumberField name="Height" value={layer.height} onChange={(v) => onChange({ height: v }, 'height')} />}
        </div>
      </div>
    </>
  );
}

export function TextInspector({ c, onChange }: { c: TextLayer; onChange: (changes: Partial<TextLayer>, group?: string) => void }) {
  const font = FONTS.find((f) => f.family === c.font) || FONTS[0];
  return (
    <>
      <textarea rows={3} value={c.text} onChange={(e) => onChange({ text: e.target.value }, 'text')} placeholder="Text" />
      <div className="row">
        <select value={c.font} onChange={(e) => {
          const f = FONTS.find((x) => x.family === e.target.value)!;
          onChange({ font: f.family, weight: f.weights.includes(c.weight) ? c.weight : f.weights.at(-1)! });
        }} style={{ fontFamily: `"${c.font}"` }}>
          {FONTS.map((f) => (
            <option key={f.family} value={f.family}>
              {f.family}
            </option>
          ))}
        </select>
        <select value={c.weight} onChange={(e) => onChange({ weight: Number(e.target.value) })}>
          {font.weights.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div className="row">
        <NumberField name="Size" value={c.size} onChange={(v) => onChange({ size: Math.max(4, v) }, 'size')} />
        <div className="segmented">
          {(['left', 'center', 'right'] as const).map((a) => (
            <button key={a} className={cx(c.align === a && 'active')} onClick={() => onChange({ align: a })} title={a === 'left' ? 'Left' : a === 'center' ? 'Center' : 'Right'}>
              {a === 'left' ? <AlignLeft size={14} /> : a === 'center' ? <AlignCenter size={14} /> : <AlignRight size={14} />}
            </button>
          ))}
        </div>
      </div>
      <ColorField name="Color" value={c.color} onChange={(v) => onChange({ color: v || '#ffffff' }, 'color')} />
      <Slider name="Line height" value={c.lineHeight} min={0.8} max={2} step={0.05} onChange={(v) => onChange({ lineHeight: v }, 'lineHeight')} />
      <Slider name="Letter spacing" value={c.letterSpacing} min={-10} max={40} onChange={(v) => onChange({ letterSpacing: v }, 'letterSpacing')} />
      <label className="checkbox">
        <input type="checkbox" checked={!!c.background} onChange={(e) => onChange({ background: e.target.checked ? { color: '#ffffff', radius: Math.round(c.size * 0.35), padding: Math.round(c.size * 0.35) } : null, color: e.target.checked && c.color.toLowerCase() === '#ffffff' ? '#111111' : c.color })} />
        Background per line (reel style)
      </label>
      {c.background && (
        <>
          <ColorField name="Background color" value={c.background.color} onChange={(v) => onChange({ background: { ...c.background!, color: v || '#ffffff' } }, 'background')} />
          <Slider name="Corners" value={c.background.radius} min={0} max={Math.round(c.size)} onChange={(v) => onChange({ background: { ...c.background!, radius: v } }, 'bgRadius')} />
          <Slider name="Padding" value={c.background.padding} min={0} max={Math.round(c.size)} onChange={(v) => onChange({ background: { ...c.background!, padding: v } }, 'bgPadding')} />
        </>
      )}
      <label className="checkbox">
        <input type="checkbox" checked={!!c.outline} onChange={(e) => onChange({ outline: e.target.checked ? { color: '#000000', width: Math.max(2, Math.round(c.size * 0.06)) } : null })} />
        Outline
      </label>
      {c.outline && (
        <>
          <ColorField name="Outline color" value={c.outline.color} onChange={(v) => onChange({ outline: { ...c.outline!, color: v || '#000000' } }, 'outlineColor')} />
          <Slider name="Thickness" value={c.outline.width} min={1} max={Math.max(20, Math.round(c.size * 0.2))} onChange={(v) => onChange({ outline: { ...c.outline!, width: v } }, 'outlineWidth')} />
        </>
      )}
      <label className="checkbox">
        <input type="checkbox" checked={!!c.shadow} onChange={(e) => onChange({ shadow: e.target.checked ? { color: 'rgba(0,0,0,0.45)', blur: Math.round(c.size * 0.25), dx: 0, dy: Math.round(c.size * 0.06) } : null })} />
        Shadow
      </label>
      {c.shadow && <Slider name="Shadow blur" value={c.shadow.blur} min={0} max={Math.round(c.size)} onChange={(v) => onChange({ shadow: { ...c.shadow!, blur: v } }, 'shadow')} />}
    </>
  );
}

export function NumberField({ name, value, onChange }: { name: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="number">
      <span>{name}</span>
      <input type="number" value={Math.round(value)} onChange={(e) => e.target.value !== '' && onChange(Number(e.target.value))} />
    </label>
  );
}

const PALETTE = ['#ffffff', '#111111', '#d97757', '#4a9eff', '#34c77b', '#f4b740', '#ff3b30', '#7c5cff'];

export function ColorField({ name, value, onChange, allowNone }: { name: string; value: string | null; onChange: (v: string | null) => void; allowNone?: boolean }) {
  const hex = value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff';
  return (
    <div className="color">
      <span className="name">{name}</span>
      <div className="swatches">
        {allowNone && <button className={cx('swatch none', !value && 'active')} title="None" onClick={() => onChange(null)} />}
        {PALETTE.map((c) => (
          <button key={c} className={cx('swatch', value?.toLowerCase() === c && 'active')} style={{ background: c }} onClick={() => onChange(c)} />
        ))}
        <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} title="Custom color" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- save

function changesSummary(doc: ImageDoc) {
  const parts: string[] = [];
  const r = rotatedDims(doc);
  if (doc.format) parts.push(`format ${doc.output.width}×${doc.output.height}`);
  else if (doc.crop.w !== r.w || doc.crop.h !== r.h) parts.push(`crop ${doc.output.width}×${doc.output.height}`);
  if (doc.rotation) parts.push(`rotated ${doc.rotation}°`);
  if (doc.flipH || doc.flipV) parts.push('flipped');
  const adj = ADJUSTMENT_CONTROLS.filter((c) => doc.adjustments[c.id]).map((c) => `${c.name.toLowerCase()} ${doc.adjustments[c.id] > 0 && c.min < 0 ? '+' : ''}${doc.adjustments[c.id]}`);
  if (adj.length) parts.push(adj.join(', '));
  const texts = doc.layers.filter((c) => c.type === 'text').length;
  const imgs = doc.layers.filter((c) => c.type === 'image').length;
  const shapes = doc.layers.filter((c) => c.type === 'shape').length;
  if (texts) parts.push(`${texts} text${texts > 1 ? 's' : ''}`);
  if (imgs) parts.push(`${imgs} logo/image${imgs > 1 ? 's' : ''}`);
  if (shapes) parts.push(`${shapes} shape${shapes > 1 ? 's' : ''}`);
  return parts.length ? `Edited in Montage: ${parts.join(' · ')}` : 'Edited in Montage';
}

function SaveVersion({ project, version, page, doc, base, images }: { project: Project; version: Version; page: number; doc: ImageDoc; base: HTMLImageElement | null; images: Map<string, HTMLImageElement> }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!base) return;
    setSaving(true);
    try {
      await loadFonts(doc);
      const canvas = document.createElement('canvas');
      render(canvas, doc, { base, images }, { scale: 1 });
      const file = version.files[page];
      const jpg = /\.jpe?g$/i.test(file.name);
      const blob: Blob = await new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('Could not export'))), jpg ? 'image/jpeg' : 'image/png', 0.95));
      const name = file.name.replace(/\.[^.]+$/, '') + (jpg ? '.jpg' : '.png');
      const path = await upload(new File([blob], name, { type: blob.type }));
      // In a carousel, the new version carries every page, with the edited one replaced.
      const paths = version.files.map((a, i) => (i === page ? path : `montage/projects/${project.id}/${a.path}`));
      const v = await api.addVersion(project.id, { paths, note: note.trim() || changesSummary(doc) });
      notify(`Saved as ${v.id}`, 'ok', undefined, 4000);
      setStore({ selVersion: v.id, selPage: page, compare: null });
      location.hash = `#/p/${project.id}`;
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setSaving(false);
      setOpen(false);
    }
  };
  return (
    <div className="send-wrap">
      <button className="btn primary" onClick={() => (setNote(''), setOpen(!open))} disabled={!base}>
        <Save size={14} /> Save as version
      </button>
      {open && (
        <div className="popover send-bubble" style={{ top: 'auto', bottom: 'calc(100% + 8px)' }}>
          <p className="popover-title">New version of {project.name}</p>
          <input autoFocus placeholder={changesSummary(doc)} value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} style={{ width: '100%' }} />
          <div className="row-right">
            <button className="btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn primary" disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
