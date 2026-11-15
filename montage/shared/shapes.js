// Shapes the creator draws over a frame. Coordinates are always in pixels of the
// original frame (the same ones After Effects uses for the composition).
//
// { type: 'rect' | 'ellipse', x, y, w, h }
// { type: 'arrow', x1, y1, x2, y2 }
// { type: 'stroke', points: [x, y, x, y, ...] }
// { type: 'text', x, y, text, size }
// { type: 'pin', x, y }
// All of them carry `color` and optionally `thickness`.

export const COLORS = ['#ff3b30', '#ffcc00', '#34c759', '#0a84ff', '#ffffff', '#bf5af2'];

export function baseThickness(width, height) {
  return Math.max(3, Math.round(Math.min(width, height) * 0.006));
}

export function shapeBox(f) {
  switch (f.type) {
    case 'rect':
    case 'ellipse':
      return norm(f.x, f.y, f.w, f.h);
    case 'arrow':
      return norm(f.x1, f.y1, f.x2 - f.x1, f.y2 - f.y1);
    case 'stroke': {
      const p = f.points || [];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i + 1 < p.length; i += 2) {
        x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]);
        y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]);
      }
      return Number.isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
    }
    case 'text': {
      const size = f.size || 48;
      return { x: f.x, y: f.y - size, w: Math.max(size, (f.text || '').length * size * 0.55), h: size * 1.3 };
    }
    case 'pin':
      return { x: f.x - 20, y: f.y - 20, w: 40, h: 40 };
    default:
      return null;
  }
}

function norm(x, y, w, h) {
  return { x: w < 0 ? x + w : x, y: h < 0 ? y + h : y, w: Math.abs(w), h: Math.abs(h) };
}

/** Box that wraps all the shapes, or null. */
export function shapesBox(shapes) {
  let box = null;
  for (const f of shapes || []) {
    const c = shapeBox(f);
    if (!c) continue;
    if (!box) { box = { ...c }; continue; }
    const x1 = Math.max(box.x + box.w, c.x + c.w);
    const y1 = Math.max(box.y + box.h, c.y + c.h);
    box.x = Math.min(box.x, c.x);
    box.y = Math.min(box.y, c.y);
    box.w = x1 - box.x;
    box.h = y1 - box.y;
  }
  return box;
}

const ROWS = ['top', 'middle', 'bottom'];
const COLUMNS = ['left', 'center', 'right'];

/** "top center", "bottom right"… on the frame's 3×3 grid. */
export function describeRegion(box, width, height) {
  if (!box) return '';
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const col = Math.min(2, Math.max(0, Math.floor((cx / width) * 3)));
  const row = Math.min(2, Math.max(0, Math.floor((cy / height) * 3)));
  if (row === 1 && col === 1) return 'in the center';
  return `${ROWS[row]} ${COLUMNS[col]}`;
}

const r = Math.round;

/** Short text per shape, for Claude: "rectangle x 320–760 · y 140–420". */
export function describeShape(f) {
  const c = shapeBox(f);
  switch (f.type) {
    case 'rect': return `rectangle x ${r(c.x)}–${r(c.x + c.w)} · y ${r(c.y)}–${r(c.y + c.h)}`;
    case 'ellipse': return `circle/ellipse x ${r(c.x)}–${r(c.x + c.w)} · y ${r(c.y)}–${r(c.y + c.h)}`;
    case 'arrow': return `arrow from (${r(f.x1)}, ${r(f.y1)}) to (${r(f.x2)}, ${r(f.y2)}) — points at (${r(f.x2)}, ${r(f.y2)})`;
    case 'stroke': return `freehand stroke x ${r(c.x)}–${r(c.x + c.w)} · y ${r(c.y)}–${r(c.y + c.h)}`;
    case 'text': return `text «${f.text}» at (${r(f.x)}, ${r(f.y)})`;
    case 'pin': return `point at (${r(f.x)}, ${r(f.y)})`;
    default: return f.type;
  }
}

/**
 * Draws the shapes on a Canvas2D context (browser or @napi-rs/canvas).
 * Each stroke has a dark outline underneath so it reads over any background.
 */
export function drawShapes(ctx, shapes, width, height) {
  const base = baseThickness(width, height);
  for (const f of shapes || []) {
    const g = f.thickness || base;
    const color = f.color || COLORS[0];
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const stroke = (path) => {
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = g + Math.max(2, g * 0.6);
      path();
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = g;
      path();
      ctx.stroke();
    };
    switch (f.type) {
      case 'rect': {
        const c = norm(f.x, f.y, f.w, f.h);
        stroke(() => { ctx.beginPath(); ctx.rect(c.x, c.y, c.w, c.h); });
        break;
      }
      case 'ellipse': {
        const c = norm(f.x, f.y, f.w, f.h);
        stroke(() => {
          ctx.beginPath();
          ctx.ellipse(c.x + c.w / 2, c.y + c.h / 2, Math.max(1, c.w / 2), Math.max(1, c.h / 2), 0, 0, Math.PI * 2);
        });
        break;
      }
      case 'arrow': {
        const ang = Math.atan2(f.y2 - f.y1, f.x2 - f.x1);
        const tip = g * 4.5;
        const body = () => {
          ctx.beginPath();
          ctx.moveTo(f.x1, f.y1);
          ctx.lineTo(f.x2, f.y2);
          ctx.moveTo(f.x2 - tip * Math.cos(ang - 0.45), f.y2 - tip * Math.sin(ang - 0.45));
          ctx.lineTo(f.x2, f.y2);
          ctx.lineTo(f.x2 - tip * Math.cos(ang + 0.45), f.y2 - tip * Math.sin(ang + 0.45));
        };
        stroke(body);
        break;
      }
      case 'stroke': {
        const p = f.points || [];
        if (p.length < 4) break;
        stroke(() => {
          ctx.beginPath();
          ctx.moveTo(p[0], p[1]);
          for (let i = 2; i + 1 < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
        });
        break;
      }
      case 'text': {
        const size = f.size || Math.round(Math.min(width, height) * 0.045);
        ctx.font = `700 ${size}px "Inter", "Helvetica Neue", Arial, sans-serif`;
        ctx.textBaseline = 'alphabetic';
        ctx.lineWidth = Math.max(3, size * 0.16);
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.strokeText(f.text || '', f.x, f.y);
        ctx.fillStyle = color;
        ctx.fillText(f.text || '', f.x, f.y);
        break;
      }
      case 'pin': {
        const rad = g * 3;
        ctx.beginPath();
        ctx.arc(f.x, f.y, rad + 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(f.x, f.y, rad, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(f.x, f.y, rad * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        break;
      }
    }
    ctx.restore();
  }
}
