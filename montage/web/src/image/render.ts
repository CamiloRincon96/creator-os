// Image document render. The same code paints the live view (scale < 1) and the
// full-resolution export (scale 1), so what you see is what gets saved.

import type { Layer, TextLayer, ImageDoc, Crop } from './model';
import { rotatedDims, colorMatrix } from './model';

export interface Resources {
  base: CanvasImageSource & { width: number; height: number };
  images: Map<string, HTMLImageElement>;
}

const IDENTITY = '1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0';
let filter: SVGFilterElement | null = null;

function adjustmentsFilter() {
  if (filter) return filter;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  const f = document.createElementNS(ns, 'filter');
  f.id = 'montage-adjustments';
  f.setAttribute('color-interpolation-filters', 'sRGB');
  const cm = document.createElementNS(ns, 'feColorMatrix');
  cm.setAttribute('type', 'matrix');
  cm.setAttribute('result', 'color');
  const cv = document.createElementNS(ns, 'feConvolveMatrix');
  cv.setAttribute('in', 'color');
  cv.setAttribute('order', '3');
  cv.setAttribute('preserveAlpha', 'true');
  cv.setAttribute('edgeMode', 'duplicate');
  f.append(cm, cv);
  svg.append(f);
  document.body.append(svg);
  filter = f;
  return f;
}

/** Draws the cropped/rotated/flipped base image filling W × H. */
function drawBase(ctx: CanvasRenderingContext2D, base: Resources['base'], doc: ImageDoc, crop: Crop, W: number, H: number) {
  const { w: rw, h: rh } = rotatedDims(doc);
  ctx.save();
  ctx.scale(W / crop.w, H / crop.h);
  ctx.translate(-crop.x, -crop.y);
  ctx.translate(rw / 2, rh / 2);
  ctx.scale(doc.flipH ? -1 : 1, doc.flipV ? -1 : 1);
  ctx.rotate((doc.rotation * Math.PI) / 180);
  ctx.drawImage(base, -doc.base.width / 2, -doc.base.height / 2, doc.base.width, doc.base.height);
  ctx.restore();
}

export interface RenderOptions {
  scale: number;
  noLayers?: boolean;
  /** For crop mode: the whole (rotated) base, with no crop and no layers. */
  full?: boolean;
  hide?: string | null;
}

export function render(canvas: HTMLCanvasElement, doc: ImageDoc, res: Resources, op: RenderOptions) {
  const rot = rotatedDims(doc);
  const crop = op.full ? { x: 0, y: 0, w: rot.w, h: rot.h } : doc.crop;
  const output = op.full ? { width: rot.w, height: rot.h } : doc.output;
  const W = Math.max(1, Math.round(output.width * op.scale));
  const H = Math.max(1, Math.round(output.height * op.scale));
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.imageSmoothingQuality = 'high';

  const a = doc.adjustments;
  const matrix = colorMatrix(a);
  const filters: string[] = [];
  if (matrix || a.sharpness) {
    const f = adjustmentsFilter();
    f.querySelector('feColorMatrix')!.setAttribute('values', matrix || IDENTITY);
    const k = (a.sharpness / 100) * 0.9;
    f.querySelector('feConvolveMatrix')!.setAttribute('kernelMatrix', k ? `0 ${-k} 0 ${-k} ${1 + 4 * k} ${-k} 0 ${-k} 0` : '0 0 0 0 1 0 0 0 0');
    filters.push('url(#montage-adjustments)');
  }
  // The base goes first without blur so the edges do not end up transparent.
  if (a.blur) drawBase(ctx, res.base, doc, crop, W, H);
  if (a.blur) filters.push(`blur(${((a.blur / 100) * 0.012 * Math.max(W, H)).toFixed(2)}px)`);
  ctx.filter = filters.join(' ') || 'none';
  drawBase(ctx, res.base, doc, crop, W, H);
  ctx.filter = 'none';

  if (a.vignette) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.hypot(W, H) / 2);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${((a.vignette / 100) * 0.75).toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  if (op.noLayers || op.full) return;
  ctx.save();
  ctx.scale(op.scale, op.scale);
  for (const c of doc.layers) if (!c.hidden && c.id !== op.hide) drawLayer(ctx, c, res.images);
  ctx.restore();
}

/**
 * A single layer (text or image) on a transparent canvas the size of the frame. The video
 * editor uses it for the timeline texts and logos (preview and export).
 */
export function renderLayer(canvas: HTMLCanvasElement, layer: Layer, output: { width: number; height: number }, scale: number, images: Map<string, HTMLImageElement>) {
  const W = Math.max(1, Math.round(output.width * scale));
  const H = Math.max(1, Math.round(output.height * scale));
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.imageSmoothingQuality = 'high';
  ctx.save();
  ctx.scale(scale, scale);
  drawLayer(ctx, { ...layer, opacity: 1 }, images);
  ctx.restore();
}

// ---------------------------------------------------------------- layers

const meter = document.createElement('canvas').getContext('2d')!;

export function cssFont(c: TextLayer) {
  return `${c.weight} ${c.size}px "${c.font}"`;
}

/** Breaks the text into lines that fit the layer width (keeps line breaks). */
export function measureText(c: TextLayer) {
  meter.font = cssFont(c);
  meter.letterSpacing = `${c.letterSpacing || 0}px`;
  const padding = c.background ? c.background.padding : 0;
  const usable = Math.max(10, c.width - padding * 2);
  const lines: { text: string; width: number }[] = [];
  for (const paragraph of c.text.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push({ text: '', width: 0 });
      continue;
    }
    let current = words[0];
    for (const p of words.slice(1)) {
      const attempt = `${current} ${p}`;
      if (meter.measureText(attempt).width <= usable) current = attempt;
      else {
        lines.push({ text: current, width: meter.measureText(current).width });
        current = p;
      }
    }
    lines.push({ text: current, width: meter.measureText(current).width });
  }
  const lineHeight = c.size * c.lineHeight;
  const gap = c.background ? padding * 0.6 : 0;
  return { lines, lineHeight, gap, padding, height: lines.length * (lineHeight + gap * 2) };
}

export function layerBox(c: Layer) {
  if (c.type === 'text') return { x: c.x, y: c.y, w: c.width, h: Math.max(c.size, measureText(c).height) };
  return { x: c.x, y: c.y, w: c.width, h: c.height };
}

function drawLayer(ctx: CanvasRenderingContext2D, c: Layer, images: Map<string, HTMLImageElement>) {
  const box = layerBox(c);
  ctx.save();
  ctx.globalAlpha = c.opacity;
  if (c.rotation) {
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    ctx.translate(cx, cy);
    ctx.rotate((c.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }
  if (c.type === 'text') drawText(ctx, c);
  else if (c.type === 'image') {
    const img = images.get(c.path);
    if (img?.complete && img.naturalWidth) ctx.drawImage(img, c.x, c.y, c.width, c.height);
  } else {
    ctx.beginPath();
    if (c.shape === 'ellipse') ctx.ellipse(c.x + c.width / 2, c.y + c.height / 2, c.width / 2, c.height / 2, 0, 0, Math.PI * 2);
    else ctx.roundRect(c.x, c.y, c.width, c.height, Math.min(c.radius, c.width / 2, c.height / 2));
    if (c.fill) {
      ctx.fillStyle = c.fill;
      ctx.fill();
    }
    if (c.stroke && c.strokeWidth) {
      ctx.strokeStyle = c.stroke;
      ctx.lineWidth = c.strokeWidth;
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, c: TextLayer) {
  const m = measureText(c);
  ctx.font = cssFont(c);
  ctx.letterSpacing = `${c.letterSpacing || 0}px`;
  ctx.textAlign = c.align;
  ctx.textBaseline = 'middle';
  const xText = c.align === 'left' ? c.x + m.padding : c.align === 'right' ? c.x + c.width - m.padding : c.x + c.width / 2;
  const rows = m.lines.map((l, i) => ({ ...l, y: c.y + i * (m.lineHeight + m.gap * 2) + m.gap + m.lineHeight / 2 }));

  // Background per line (the "highlight" style of reel texts).
  if (c.background) {
    ctx.fillStyle = c.background.color;
    for (const f of rows) {
      if (!f.text) continue;
      const w = f.width + m.padding * 2;
      const x = c.align === 'left' ? c.x : c.align === 'right' ? c.x + c.width - w : c.x + (c.width - w) / 2;
      ctx.beginPath();
      ctx.roundRect(x, f.y - m.lineHeight / 2 - m.gap, w, m.lineHeight + m.gap * 2, c.background.radius);
      ctx.fill();
    }
  }
  const shadow = () => {
    if (!c.shadow) return;
    ctx.shadowColor = c.shadow.color;
    ctx.shadowBlur = c.shadow.blur;
    ctx.shadowOffsetX = c.shadow.dx;
    ctx.shadowOffsetY = c.shadow.dy;
  };
  const noShadow = () => {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  };
  if (c.outline && c.outline.width > 0) {
    shadow();
    ctx.strokeStyle = c.outline.color;
    ctx.lineWidth = c.outline.width * 2;
    ctx.lineJoin = 'round';
    for (const f of rows) ctx.strokeText(f.text, xText, f.y);
    noShadow();
  } else if (!c.background) shadow();
  ctx.fillStyle = c.color;
  for (const f of rows) ctx.fillText(f.text, xText, f.y);
  noShadow();
}

/** Layer under the point (output coordinates), from top to bottom, taking rotation into account. */
export function layerAt(doc: ImageDoc, x: number, y: number): Layer | null {
  for (let i = doc.layers.length - 1; i >= 0; i--) {
    const c = doc.layers[i];
    if (c.hidden) continue;
    const k = layerBox(c);
    const cx = k.x + k.w / 2;
    const cy = k.y + k.h / 2;
    const ang = (-c.rotation * Math.PI) / 180;
    const lx = cx + (x - cx) * Math.cos(ang) - (y - cy) * Math.sin(ang);
    const ly = cy + (x - cx) * Math.sin(ang) + (y - cy) * Math.cos(ang);
    if (lx >= k.x && lx <= k.x + k.w && ly >= k.y && ly <= k.y + k.h) return c;
  }
  return null;
}

/** Waits until the fonts of the text layers are loaded. */
export async function loadFonts(doc: ImageDoc) {
  const requested = new Set(doc.layers.filter((c): c is TextLayer => c.type === 'text').map((c) => `${c.weight} 32px "${c.font}"`));
  await Promise.all([...requested].map((f) => document.fonts.load(f).catch(() => [])));
}
