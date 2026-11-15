import { createCanvas, loadImage } from '@napi-rs/canvas';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { shapesBox, drawShapes } from '../shared/shapes.js';
import { ffmpegSeek, timecode } from '../shared/time.js';
import { FFMPEG } from './config.mjs';
import { fitSide, colorInput } from './media.mjs';
import { run } from './util.mjs';

/** PNG of frame n of the original file, at native resolution and with the color policy. */
export async function framePNG(file, meta, n) {
  const args = [
    '-v', 'error', '-nostdin',
    '-ss', ffmpegSeek(n, meta.fps).toFixed(6), '-i', file,
    '-frames:v', '1', '-an',
    '-vf', `scale=${meta.width}:${meta.height}:flags=bicubic:${colorInput(meta)},format=rgb24`,
    '-f', 'image2pipe', '-c:v', 'png', 'pipe:1',
  ];
  const r = await run(FFMPEG, args, { binary: true });
  if (r.code !== 0 || !r.stdout.length) throw new Error(`Could not extract frame ${n}: ${r.stderr.slice(-200)}`);
  return r.stdout;
}

async function baseImage(file, meta, frame) {
  if (meta.type === 'video') return loadImage(await framePNG(file, meta, frame ?? 0));
  return loadImage(await fsp.readFile(file));
}

/**
 * Generates the capture of a note: original frame + drawing.
 * Writes <base>.png (full), <base>.jpg (≤1024 px, for Claude) and <base>-zone.png
 * (crop of the drawn area at full resolution). Returns paths relative to `dir`.
 */
export async function generateCapture({ path: file, meta, frame, shapes, dir, base }) {
  const img = await baseImage(file, meta, frame);
  const W = img.width;
  const H = img.height;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, W, H);
  // The shapes come in pixels of the frame declared in meta; if the real image differs, we scale.
  const sx = W / (meta.width || W);
  const sy = H / (meta.height || H);
  ctx.save();
  ctx.scale(sx, sy);
  drawShapes(ctx, shapes, meta.width || W, meta.height || H);
  ctx.restore();

  await fsp.mkdir(dir, { recursive: true });
  const out = { png: `${base}.png`, jpg: `${base}.jpg`, zone: null };
  await fsp.writeFile(path.join(dir, out.png), await canvas.encode('png'));

  const { w, h } = fitSide(W, H, 1024);
  const small = createCanvas(w, h);
  small.getContext('2d').drawImage(canvas, 0, 0, w, h);
  await fsp.writeFile(path.join(dir, out.jpg), await small.encode('jpeg', 85));

  const box = shapesBox(shapes);
  if (box && box.w * box.h < W * H * 0.5) {
    const margin = Math.max(80, Math.max(box.w, box.h) * 0.25);
    const x = Math.max(0, Math.floor((box.x - margin) * sx));
    const y = Math.max(0, Math.floor((box.y - margin) * sy));
    const x1 = Math.min(W, Math.ceil((box.x + box.w + margin) * sx));
    const y1 = Math.min(H, Math.ceil((box.y + box.h + margin) * sy));
    if (x1 - x > 8 && y1 - y > 8) {
      const crop = createCanvas(x1 - x, y1 - y);
      crop.getContext('2d').drawImage(canvas, x, y, x1 - x, y1 - y, 0, 0, x1 - x, y1 - y);
      out.zone = `${base}-zone.png`;
      await fsp.writeFile(path.join(dir, out.zone), await crop.encode('png'));
    }
  }
  return out;
}

/** Loose frames (full PNGs) for Claude to verify. */
export async function extractFrames(file, meta, frames, dir, prefix) {
  await fsp.mkdir(dir, { recursive: true });
  const paths = [];
  for (const n of frames) {
    const destination = path.join(dir, `${prefix}-f${n}.png`);
    if (meta.type === 'video') await fsp.writeFile(destination, await framePNG(file, meta, n));
    else await fsp.copyFile(file, destination);
    paths.push(destination);
  }
  return paths;
}

/** Contact sheet with timecode and frame number in each cell. */
export async function contactSheet(file, meta, frames, destination, { columns, cellWidth = 270 } = {}) {
  const n = frames.length;
  const cols = columns || Math.min(n, Math.ceil(Math.sqrt(n * (meta.height / meta.width) * 1.2)) || 1);
  const rows = Math.ceil(n / cols);
  const cellHeight = Math.round((cellWidth * meta.height) / meta.width);
  const label = 30;
  const gap = 6;
  const canvas = createCanvas(cols * (cellWidth + gap) + gap, rows * (cellHeight + label + gap) + gap);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < n; i++) {
    const img = await loadImage(await framePNG(file, meta, frames[i]));
    const x = gap + (i % cols) * (cellWidth + gap);
    const y = gap + Math.floor(i / cols) * (cellHeight + label + gap);
    ctx.drawImage(img, x, y + label, cellWidth, cellHeight);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '600 15px "SF Mono", Menlo, monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(`#${i + 1}  ${timecode(frames[i] / meta.fps, meta.fps)}  f${frames[i]}`, x + 4, y + label / 2);
  }
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  await fsp.writeFile(destination, await canvas.encode('jpeg', 88));
  return destination;
}
