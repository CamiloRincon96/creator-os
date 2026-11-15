// Image editor document (non-destructive): saved in projects/<id>/image.json.
// Layer coordinates in pixels of the output canvas.

export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Adjustments {
  exposure: number;
  contrast: number;
  saturation: number;
  temperature: number;
  tint: number;
  sharpness: number;
  blur: number;
  vignette: number;
}

interface BaseLayer {
  id: string;
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  hidden?: boolean;
}

export interface TextLayer extends BaseLayer {
  type: 'text';
  width: number;
  text: string;
  font: string;
  weight: number;
  size: number;
  color: string;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
  letterSpacing: number;
  outline: { color: string; width: number } | null;
  shadow: { color: string; blur: number; dx: number; dy: number } | null;
  background: { color: string; radius: number; padding: number } | null;
}

export interface ImageLayer extends BaseLayer {
  type: 'image';
  width: number;
  height: number;
  path: string;
  name: string;
}

export interface ShapeLayer extends BaseLayer {
  type: 'shape';
  shape: 'rect' | 'ellipse';
  width: number;
  height: number;
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  radius: number;
}

export type Layer = TextLayer | ImageLayer | ShapeLayer;

export interface ImageDoc {
  rev?: number;
  base: { version: string; page: number; path: string; width: number; height: number };
  format: string | null;
  output: { width: number; height: number };
  crop: Crop;
  rotation: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
  adjustments: Adjustments;
  layers: Layer[];
}

export const ZERO_ADJUSTMENTS: Adjustments = { exposure: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, sharpness: 0, blur: 0, vignette: 0 };

export const ADJUSTMENT_CONTROLS: { id: keyof Adjustments; name: string; min: number; max: number }[] = [
  { id: 'exposure', name: 'Exposure', min: -100, max: 100 },
  { id: 'contrast', name: 'Contrast', min: -100, max: 100 },
  { id: 'saturation', name: 'Saturation', min: -100, max: 100 },
  { id: 'temperature', name: 'Temperature', min: -100, max: 100 },
  { id: 'tint', name: 'Tint', min: -100, max: 100 },
  { id: 'sharpness', name: 'Sharpness', min: 0, max: 100 },
  { id: 'blur', name: 'Blur', min: 0, max: 100 },
  { id: 'vignette', name: 'Vignette', min: 0, max: 100 },
];

export const FONTS: { family: string; weights: number[] }[] = [
  { family: 'Montserrat', weights: [400, 500, 600, 700, 800, 900] },
  { family: 'Jost', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Inter', weights: [400, 500, 600, 700, 800] },
  { family: 'Bricolage Grotesque', weights: [400, 500, 600, 700, 800] },
  { family: 'Rajdhani', weights: [400, 500, 600, 700] },
  { family: 'Playfair Display', weights: [400, 500, 600, 700, 800, 900] },
  { family: 'Michroma', weights: [400] },
  { family: 'Geist', weights: [400, 500, 600, 700, 800] },
];

export function rotatedDims(doc: Pick<ImageDoc, 'base' | 'rotation'>) {
  return doc.rotation % 180 ? { w: doc.base.height, h: doc.base.width } : { w: doc.base.width, h: doc.base.height };
}

export function newDoc(base: ImageDoc['base']): ImageDoc {
  return {
    base,
    format: null,
    output: { width: base.width, height: base.height },
    crop: { x: 0, y: 0, w: base.width, h: base.height },
    rotation: 0,
    flipH: false,
    flipV: false,
    adjustments: { ...ZERO_ADJUSTMENTS },
    layers: [],
  };
}

/** Largest centered crop with the requested ratio, inside w × h. */
export function centeredCrop(w: number, h: number, ratio: number): Crop {
  let rw = w;
  let rh = w / ratio;
  if (rh > h) {
    rh = h;
    rw = h * ratio;
  }
  return { x: Math.round((w - rw) / 2), y: Math.round((h - rh) / 2), w: Math.round(rw), h: Math.round(rh) };
}

export const newId = () => Math.random().toString(36).slice(2, 9);

export function textLayer(output: { width: number; height: number }): TextLayer {
  const size = Math.round(Math.min(output.width, output.height) * 0.075);
  return {
    id: newId(),
    type: 'text',
    x: Math.round(output.width * 0.1),
    y: Math.round(output.height * 0.12),
    width: Math.round(output.width * 0.8),
    rotation: 0,
    opacity: 1,
    text: 'Type here',
    font: 'Montserrat',
    weight: 800,
    size,
    color: '#ffffff',
    align: 'center',
    lineHeight: 1.15,
    letterSpacing: 0,
    outline: null,
    shadow: { color: 'rgba(0,0,0,0.45)', blur: Math.round(size * 0.25), dx: 0, dy: Math.round(size * 0.06) },
    background: null,
  };
}

// ---------------------------------------------------------------- color matrix

type M = number[]; // 5×5, row by row

const identity = (): M => [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1];

function multiply(a: M, b: M): M {
  const r = new Array(25).fill(0);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) for (let k = 0; k < 5; k++) r[i * 5 + j] += a[i * 5 + k] * b[k * 5 + j];
  return r;
}

const scale = (r: number, g: number, b: number): M => [r, 0, 0, 0, 0, 0, g, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1];

/**
 * Exposure, contrast, saturation, temperature and tint composed into a single matrix
 * (feColorMatrix, sRGB space). Returns null if nothing changes.
 */
export function colorMatrix(a: Adjustments): string | null {
  if (!a.exposure && !a.contrast && !a.saturation && !a.temperature && !a.tint) return null;
  let m = identity();
  const e = Math.pow(2, a.exposure / 50);
  m = multiply(scale(e, e, e), m);
  const k = 1 + a.contrast / 100;
  const off = 0.5 * (1 - k);
  m = multiply([k, 0, 0, 0, off, 0, k, 0, 0, off, 0, 0, k, 0, off, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1], m);
  const s = 1 + a.saturation / 100;
  const [lr, lg, lb] = [0.2126, 0.7152, 0.0722];
  m = multiply(
    [lr * (1 - s) + s, lg * (1 - s), lb * (1 - s), 0, 0, lr * (1 - s), lg * (1 - s) + s, lb * (1 - s), 0, 0, lr * (1 - s), lg * (1 - s), lb * (1 - s) + s, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
    m,
  );
  const t = a.temperature / 100;
  m = multiply(scale(1 + 0.14 * t, 1 + 0.02 * t, 1 - 0.14 * t), m);
  const ti = a.tint / 100;
  m = multiply(scale(1 + 0.05 * ti, 1 - 0.1 * ti, 1 + 0.05 * ti), m);
  return m.slice(0, 20).map((v) => +v.toFixed(5)).join(' ');
}
