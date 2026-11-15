import { useRef, useState } from 'react';
import { baseThickness } from '../../../shared/shapes.js';
import { zonesFor } from '../../../shared/formats.js';
import { setStore, getStore, newDraft, useStore } from '../state';
import { usePlayer } from '../engine/player';
import type { Shape } from '../types';

const SHADOW = 'rgba(0,0,0,0.55)';

function box(x: number, y: number, w: number, h: number) {
  return { x: w < 0 ? x + w : x, y: h < 0 ? y + h : y, w: Math.abs(w), h: Math.abs(h) };
}

/** Draws a shape the same way the server paints it in the capture (dark outline underneath). */
export function ShapeSVG({ f, base }: { f: Shape; base: number }) {
  const g = f.thickness || base;
  const width = { shadow: g + Math.max(2, g * 0.6), line: g };
  const double = (el: (stroke: string, w: number) => React.ReactNode) => (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {el(SHADOW, width.shadow)}
      {el(f.color, width.line)}
    </g>
  );
  switch (f.type) {
    case 'rect': {
      const c = box(f.x, f.y, f.w, f.h);
      return double((s, w) => <rect x={c.x} y={c.y} width={c.w} height={c.h} stroke={s} strokeWidth={w} />);
    }
    case 'ellipse': {
      const c = box(f.x, f.y, f.w, f.h);
      return double((s, w) => <ellipse cx={c.x + c.w / 2} cy={c.y + c.h / 2} rx={c.w / 2} ry={c.h / 2} stroke={s} strokeWidth={w} />);
    }
    case 'arrow': {
      const ang = Math.atan2(f.y2 - f.y1, f.x2 - f.x1);
      const p = g * 4.5;
      const d = `M${f.x1},${f.y1} L${f.x2},${f.y2} M${f.x2 - p * Math.cos(ang - 0.45)},${f.y2 - p * Math.sin(ang - 0.45)} L${f.x2},${f.y2} L${f.x2 - p * Math.cos(ang + 0.45)},${f.y2 - p * Math.sin(ang + 0.45)}`;
      return double((s, w) => <path d={d} stroke={s} strokeWidth={w} />);
    }
    case 'stroke': {
      const p = f.points;
      if (p.length < 4) return null;
      let d = `M${p[0]},${p[1]}`;
      for (let i = 2; i + 1 < p.length; i += 2) d += ` L${p[i]},${p[i + 1]}`;
      return double((s, w) => <path d={d} stroke={s} strokeWidth={w} />);
    }
    case 'text': {
      const size = f.size || 48;
      return (
        <text
          x={f.x}
          y={f.y}
          fontSize={size}
          fontWeight={700}
          fontFamily='"Inter", "Helvetica Neue", Arial, sans-serif'
          fill={f.color}
          stroke="rgba(0,0,0,0.75)"
          strokeWidth={Math.max(3, size * 0.16)}
          paintOrder="stroke"
          strokeLinejoin="round"
        >
          {f.text}
        </text>
      );
    }
    case 'pin': {
      const r = g * 3;
      return (
        <g>
          <circle cx={f.x} cy={f.y} r={r + 2} fill={SHADOW} />
          <circle cx={f.x} cy={f.y} r={r} fill={f.color} />
          <circle cx={f.x} cy={f.y} r={r * 0.35} fill="#fff" />
        </g>
      );
    }
  }
}

export function Shapes({ shapes, width, height, dim }: { shapes: Shape[]; width: number; height: number; dim?: boolean }) {
  const base = baseThickness(width, height);
  return (
    <svg className={dim ? 'layer-svg dim' : 'layer-svg'} viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      {shapes.map((f, i) => (
        <ShapeSVG key={i} f={f} base={base} />
      ))}
    </svg>
  );
}

type InProgress =
  | { type: 'rect' | 'ellipse'; x0: number; y0: number; x1: number; y1: number }
  | { type: 'arrow'; x0: number; y0: number; x1: number; y1: number }
  | { type: 'stroke'; points: number[] };

/** Layer where the creator draws. Starting to draw pauses and opens a draft note. */
export function DrawingLayer({ width, height, scale }: { width: number; height: number; scale: number }) {
  const player = usePlayer();
  const tool = useStore((s) => s.tool);
  const color = useStore((s) => s.color);
  const draft = useStore((s) => s.draft);
  const [inProgress, setInProgress] = useState<InProgress | null>(null);
  const [text, setText] = useState<{ x: number; y: number; value: string } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const base = baseThickness(width, height);
  const active = tool !== 'pointer';

  const point = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * width, y: ((e.clientY - r.top) / r.height) * height };
  };

  const add = (f: Shape) => {
    const b = getStore().draft || newDraft();
    setStore({ draft: { ...b, shapes: [...b.shapes, f] }, selNote: null });
  };

  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!active || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    player.pause();
    if (!getStore().draft) setStore({ draft: newDraft(), selNote: null });
    const { x, y } = point(e);
    if (tool === 'pin') return add({ type: 'pin', x, y, color });
    if (tool === 'text') return setText({ x, y, value: '' });
    svgRef.current!.setPointerCapture(e.pointerId);
    if (tool === 'stroke') setInProgress({ type: 'stroke', points: [x, y] });
    else setInProgress({ type: tool, x0: x, y0: y, x1: x, y1: y });
  };

  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!inProgress) return;
    const { x, y } = point(e);
    if (inProgress.type === 'stroke') {
      const p = inProgress.points;
      const dx = x - p[p.length - 2];
      const dy = y - p[p.length - 1];
      if (dx * dx + dy * dy > (3 / scale) ** 2) setInProgress({ type: 'stroke', points: [...p, x, y] });
    } else setInProgress({ ...inProgress, x1: x, y1: y });
  };

  const up = () => {
    if (!inProgress) return;
    const minimum = 6 / scale;
    if (inProgress.type === 'stroke') {
      if (inProgress.points.length >= 4) add({ type: 'stroke', points: inProgress.points.map((v) => Math.round(v)), color });
    } else {
      const { x0, y0, x1, y1 } = inProgress;
      if (Math.abs(x1 - x0) > minimum || Math.abs(y1 - y0) > minimum) {
        if (inProgress.type === 'arrow') add({ type: 'arrow', x1: x0, y1: y0, x2: x1, y2: y1, color });
        else add({ type: inProgress.type, x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0), color });
      }
    }
    setInProgress(null);
  };

  const confirmText = () => {
    if (text && text.value.trim()) add({ type: 'text', x: text.x, y: text.y, text: text.value.trim(), size: Math.round(Math.min(width, height) * 0.045), color });
    setText(null);
  };

  let temporary: Shape | null = null;
  if (inProgress?.type === 'stroke') temporary = { type: 'stroke', points: inProgress.points, color };
  else if (inProgress?.type === 'arrow') temporary = { type: 'arrow', x1: inProgress.x0, y1: inProgress.y0, x2: inProgress.x1, y2: inProgress.y1, color };
  else if (inProgress) temporary = { type: inProgress.type, x: inProgress.x0, y: inProgress.y0, w: inProgress.x1 - inProgress.x0, h: inProgress.y1 - inProgress.y0, color };

  const textSize = Math.round(Math.min(width, height) * 0.045);
  return (
    <>
      <svg
        ref={svgRef}
        className={active ? 'layer-svg drawing active' : 'layer-svg drawing'}
        data-tool={tool}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => setInProgress(null)}
      >
        {draft?.shapes.map((f, i) => <ShapeSVG key={i} f={f} base={base} />)}
        {temporary && <ShapeSVG f={temporary} base={base} />}
      </svg>
      {text && (
        <input
          className="shape-text-input"
          autoFocus
          value={text.value}
          placeholder="Type and press Enter"
          style={{ left: text.x, top: text.y - textSize, fontSize: textSize, color, minWidth: textSize * 6 }}
          onChange={(e) => setText({ ...text, value: e.target.value })}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') confirmText();
            if (e.key === 'Escape') setText(null);
          }}
          onBlur={confirmText}
        />
      )}
    </>
  );
}

/** Brand or platform safe zones, scaled to the frame. */
export function SafeZones({ width, height }: { width: number; height: number }) {
  const zone = useStore((s) => s.zone);
  const z = zonesFor(width, height).find((x: { id: string }) => x.id === zone);
  if (!z) return null;
  const sx = width / z.ref.width;
  const sy = height / z.ref.height;
  const size = Math.round(Math.min(width, height) * 0.022);
  return (
    <svg className="layer-svg zones" viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      {z.avoid.map((r: { x: number; y: number; w: number; h: number; label?: string }, i: number) => (
        <g key={i}>
          <rect x={r.x * sx} y={r.y * sy} width={r.w * sx} height={r.h * sy} fill="rgba(255, 59, 48, 0.16)" />
          {r.label && (
            <text x={r.x * sx + size * 0.6} y={r.y * sy + size * 1.4} fontSize={size} fill="rgba(255,255,255,0.85)" fontWeight={600}>
              {r.label}
            </text>
          )}
        </g>
      ))}
      <rect
        x={z.safe.x * sx}
        y={z.safe.y * sy}
        width={z.safe.w * sx}
        height={z.safe.h * sy}
        fill="none"
        stroke="rgba(52, 199, 123, 0.95)"
        strokeWidth={Math.max(2, width * 0.003)}
        strokeDasharray={`${width * 0.015} ${width * 0.01}`}
      />
      <text x={z.safe.x * sx + size * 0.6} y={z.safe.y * sy + z.safe.h * sy - size * 0.7} fontSize={size} fill="rgba(52, 199, 123, 1)" fontWeight={700}>
        {z.name}
      </text>
    </svg>
  );
}
