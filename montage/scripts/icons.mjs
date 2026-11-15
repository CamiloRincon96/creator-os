// Makes the Montage brand icons from a brand symbol.
// Usage: node scripts/icons.mjs [brandFolder]
// The brand folder holds mark.svg (the symbol) and logo-horizontal-compact.svg (the logo).
// Outputs in web/public/brand/: montage-logo.svg, montage-symbol.svg (exact copies),
// app-icon-1024.png, favicon-64.png, favicon.svg.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const brand = process.argv[2] ?? path.resolve(root, '../../brand-assets');
const output = path.join(root, 'web/public/brand');
fs.mkdirSync(output, { recursive: true });

const markPath = path.join(brand, 'mark.svg');
const logoPath = path.join(brand, 'logo-horizontal-compact.svg');
fs.copyFileSync(logoPath, path.join(output, 'montage-logo.svg'));
fs.copyFileSync(markPath, path.join(output, 'montage-symbol.svg'));

const markSvg = fs.readFileSync(markPath, 'utf8');
const vb = markSvg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
const markAspect = vb[3] / vb[2]; // height / width

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Renders the symbol at a given width (rasterizes at the final resolution, no bitmap scaling).
async function mark(width) {
  const height = Math.round(width * markAspect);
  const svg = markSvg.replace(/width="[^"]+"/, `width="${width}"`).replace(/height="[^"]+"/, `height="${height}"`);
  return { img: await loadImage(Buffer.from(svg)), width, height };
}

// ---------- 1024 app icon (macOS template) ----------
{
  const S = 1024, M = 100, T = S - 2 * M, R = 185;
  const c = createCanvas(S, S);
  const ctx = c.getContext('2d');

  // Plate: almost black vertical gradient.
  roundRect(ctx, M, M, T, T, R);
  const g = ctx.createLinearGradient(0, M, 0, M + T);
  g.addColorStop(0, '#141517');
  g.addColorStop(1, '#0b0c0e');
  ctx.fillStyle = g;
  ctx.fill();

  // Very faint ice glow under the symbol (clipped to the plate).
  ctx.save();
  roundRect(ctx, M, M, T, T, R);
  ctx.clip();
  const glow = ctx.createRadialGradient(S / 2, S / 2 + 30, 0, S / 2, S / 2 + 30, T * 0.42);
  glow.addColorStop(0, 'rgba(125,227,244,0.09)');
  glow.addColorStop(0.5, 'rgba(125,227,244,0.035)');
  glow.addColorStop(1, 'rgba(125,227,244,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(M, M, T, T);
  ctx.restore();

  // Thin inner border.
  roundRect(ctx, M + 1, M + 1, T - 2, T - 2, R - 1);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(214,235,253,0.12)';
  ctx.stroke();

  // White symbol centered at 62 % of the plate width.
  const m = await mark(Math.round(T * 0.62));
  ctx.drawImage(m.img, Math.round((S - m.width) / 2), Math.round((S - m.height) / 2), m.width, m.height);

  fs.writeFileSync(path.join(output, 'app-icon-1024.png'), c.toBuffer('image/png'));
}

// ---------- Favicon 64 ----------
const FAV = { S: 64, R: 14, width: 0.78 };
{
  const c = createCanvas(FAV.S, FAV.S);
  const ctx = c.getContext('2d');
  roundRect(ctx, 0, 0, FAV.S, FAV.S, FAV.R);
  ctx.fillStyle = '#141517';
  ctx.fill();
  const m = await mark(Math.round(FAV.S * FAV.width));
  ctx.drawImage(m.img, (FAV.S - m.width) / 2, (FAV.S - m.height) / 2, m.width, m.height);
  fs.writeFileSync(path.join(output, 'favicon-64.png'), c.toBuffer('image/png'));
}

// ---------- favicon.svg (same design, vector) ----------
{
  const w = FAV.S * FAV.width, h = w * markAspect;
  const inner = markSvg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FAV.S}" height="${FAV.S}" viewBox="0 0 ${FAV.S} ${FAV.S}">`
    + `<rect width="${FAV.S}" height="${FAV.S}" rx="${FAV.R}" fill="#141517"/>`
    + `<svg x="${((FAV.S - w) / 2).toFixed(2)}" y="${((FAV.S - h) / 2).toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" viewBox="${vb.join(' ')}">`
    + inner + '</svg></svg>\n';
  fs.writeFileSync(path.join(output, 'favicon.svg'), svg);
}

console.log('Icons made in', output);
