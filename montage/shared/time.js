// Time and frames. One rule for all of Montage:
// - a note stores the frame number `n` (integer) and the version's fps;
// - the browser seeks to (n + 0.5) / fps to show exactly frame n;
// - ffmpeg extracts frame n with -ss max(0, (n - 0.5) / fps).

const EPS = 1e-6;

/** Frame (0-based) shown at instant t. */
export function frameAt(t, fps) {
  return Math.max(0, Math.floor(t * fps + EPS));
}

/** Instant where frame n starts. */
export function frameStart(n, fps) {
  return n / fps;
}

/** Instant in the middle of frame n (for seeking in the browser). */
export function frameMid(n, fps) {
  return (n + 0.5) / fps;
}

/** Instant for `ffmpeg -ss` that returns exactly frame n. */
export function ffmpegSeek(n, fps) {
  return Math.max(0, (n - 0.5) / fps);
}

/** Snaps t to the start of its frame. */
export function snapToFrame(t, fps) {
  return Math.round(t * fps) / fps;
}

const two = (v) => String(v).padStart(2, '0');

/** HH:MM:SS:FF (non drop-frame). */
export function timecode(t, fps) {
  const base = Math.round(fps) || 30;
  const total = Math.round(frameAt(Math.max(0, t), fps) * (base / fps));
  const ff = total % base;
  const s = Math.floor(total / base);
  return `${two(Math.floor(s / 3600))}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}:${two(ff)}`;
}

/** 0:04.40 or 1:02:03.5, made to read fast. */
export function readableTime(t, decimals = 2) {
  const neg = t < 0;
  t = Math.abs(t);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const ss = s.toFixed(decimals).padStart(decimals ? 3 + decimals : 2, '0');
  const body = h > 0 ? `${h}:${two(m)}:${ss}` : `${m}:${ss}`;
  return (neg ? '-' : '') + body;
}

/** Accepts "4.4", "0:04.4", "1:02:03.5" or "00:00:04:12" (with fps). Returns seconds. */
export function parseTime(text, fps = 30) {
  const s = String(text).trim();
  if (!s) return NaN;
  const parts = s.split(':');
  if (parts.length === 4) {
    const [h, m, sec, f] = parts.map(Number);
    return h * 3600 + m * 60 + sec + f / (Math.round(fps) || 30);
  }
  let total = 0;
  for (const p of parts) total = total * 60 + Number(p);
  return total;
}
