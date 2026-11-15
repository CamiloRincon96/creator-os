import { EventEmitter } from 'node:events';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { CACHE, CACHE_MAX_BYTES, FFMPEG, FFPROBE } from './config.mjs';
import { withLock, run, writeJSON, hash, readJSON, dirSize } from './util.mjs';

/** Emits 'media' with the public state of a media file every time its preparation moves forward. */
export const mediaEvents = new EventEmitter();

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.avif']);

const fraction = (s) => {
  if (!s || s === '0/0') return 0;
  const [a, b] = String(s).split('/').map(Number);
  return b ? a / b : a;
};
const even = (x) => Math.max(2, Math.round(x / 2) * 2);

export async function probe(file) {
  const r = await run(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]);
  if (r.code !== 0) throw new Error(`ffprobe could not read ${path.basename(file)}: ${r.stderr.trim().slice(0, 300)}`);
  const info = JSON.parse(r.stdout);
  const ext = path.extname(file).toLowerCase();
  const streams = info.streams || [];
  const v = streams.find((s) => s.codec_type === 'video' && !s.disposition?.attached_pic);
  const a = streams.find((s) => s.codec_type === 'audio');
  const format = info.format || {};
  let type;
  if (IMAGE_EXT.has(ext) && v) type = 'image';
  else if (v) type = 'video';
  else if (a) type = 'audio';
  else throw new Error(`Cannot tell what type of file ${path.basename(file)} is`);

  const meta = { type, size: Number(format.size) || undefined, hasAudio: !!a };
  if (v) {
    let width = v.width;
    let height = v.height;
    if (Math.abs(rotation(v)) % 180 === 90) [width, height] = [height, width];
    Object.assign(meta, {
      width,
      height,
      codec: v.codec_name,
      pixFmt: v.pix_fmt,
      color: { space: v.color_space, range: v.color_range, primaries: v.color_primaries, transfer: v.color_transfer },
    });
    if (type === 'video') {
      const fps = fraction(v.avg_frame_rate) || fraction(v.r_frame_rate) || 30;
      meta.fps = Math.round(fps * 1000) / 1000;
      meta.duration = Number(v.duration) || Number(format.duration) || 0;
      meta.frames = Number(v.nb_frames) || Math.round(meta.duration * meta.fps);
    }
  }
  if (a) {
    meta.audio = { codec: a.codec_name, channels: a.channels, sampleRate: Number(a.sample_rate) };
    if (type === 'audio') meta.duration = Number(a.duration) || Number(format.duration) || 0;
  }
  return meta;
}

function rotation(v) {
  const sd = (v.side_data_list || []).find((d) => d.rotation !== undefined);
  return Number(sd?.rotation ?? v.tags?.rotate) || 0;
}

/**
 * One color policy (proxies, captures, export): if the source carries tags, they are respected;
 * if not, we assume the same as Chrome (BT.709 in HD, BT.601 in SD) and the range from the pix_fmt.
 */
export function colorInput(meta) {
  const c = meta.color || {};
  const tagged = c.space && !['unknown', 'reserved'].includes(c.space);
  const matrix = tagged ? 'auto' : Math.min(meta.width || 0, meta.height || 0) >= 720 ? 'bt709' : 'bt601';
  const hasRange = c.range && c.range !== 'unknown';
  const range = hasRange ? 'auto' : String(meta.pixFmt || '').startsWith('yuvj') ? 'pc' : 'tv';
  return `in_color_matrix=${matrix}:in_range=${range}`;
}

export const TAGS_709 = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];

/** Scaled dimensions so the longer side does not go past `max`. */
export function fitSide(width, height, max) {
  const f = Math.min(1, max / Math.max(width, height));
  return { w: even(width * f), h: even(height * f) };
}

// ---------------------------------------------------------------- cache

async function keyOf(file) {
  const st = await fsp.stat(file);
  return { key: hash(`${path.resolve(file)}|${st.size}|${st.mtimeMs}`), st };
}

const cacheDir = (key) => path.join(CACHE, key);
const infoPath = (key) => path.join(cacheDir(key), 'info.json');

function requiredPieces(meta) {
  if (meta.type === 'video') return ['poster', 'strip', 'preview', ...(meta.hasAudio ? ['peaks'] : [])];
  if (meta.type === 'image') return ['poster'];
  return ['peaks', 'audio'];
}

const tasks = new Map(); // key -> { progress, stage }
const queue = [];
const CONCURRENCY = 2;
let active = 0;

function publicState(info) {
  const base = `/cache/${info.key}`;
  const r = info.ready || {};
  const t = tasks.get(info.key);
  return {
    key: info.key,
    meta: info.meta,
    urls: {
      preview: r.preview ? `${base}/preview.mp4` : null,
      audio: r.audio ? `${base}/audio.flac` : null,
      strip: r.strip ? `${base}/strip.jpg` : null,
      peaks: r.peaks ? `${base}/peaks.json` : null,
      poster: r.poster ? `${base}/${r.poster}` : null,
    },
    strip: info.strip || null,
    preparing: !!t,
    stage: t?.stage || null,
    progress: t ? t.progress : null,
    error: info.error || null,
  };
}

/**
 * State of a media file (probe + which cache pieces are ready). If pieces are missing and
 * `prepare`, it queues them. Touches the cache for the LRU.
 */
export async function mediaState(file, { prepare = true, priority = false } = {}) {
  const { key } = await keyOf(file);
  const info = await withLock(`c:${key}`, async () => {
    let i = await readJSON(infoPath(key), null);
    if (!i) {
      i = { key, path: path.resolve(file), meta: await probe(file), ready: {} };
      await writeJSON(infoPath(key), i);
    }
    return i;
  });
  touch(key);
  const missing = requiredPieces(info.meta).filter((p) => !info.ready?.[p]);
  // An error from an earlier run of the server is retried; one from this run is not (avoids loops).
  if (missing.length && prepare && !failed.has(key)) enqueue(info, priority);
  return publicState(info);
}

const failed = new Set();

export async function metaOf(file) {
  return (await mediaState(file, { prepare: false })).meta;
}

function touch(key) {
  const now = new Date();
  fsp.utimes(infoPath(key), now, now).catch(() => {});
}

function enqueue(info, priority) {
  if (tasks.has(info.key)) return;
  tasks.set(info.key, { progress: 0, stage: 'queued' });
  if (priority) queue.unshift(info);
  else queue.push(info);
  pump();
}

function pump() {
  while (active < CONCURRENCY && queue.length) {
    const info = queue.shift();
    active++;
    prepareMedia(info)
      .catch((e) => console.error(`[media] ${path.basename(info.path)}: ${e.message}`))
      .finally(() => {
        active--;
        tasks.delete(info.key);
        readJSON(infoPath(info.key), info).then((i) => mediaEvents.emit('media', publicState(i)));
        pump();
        if (!queue.length && !active) pruneCache().catch(() => {});
      });
  }
}

function report(info, stage, progress) {
  const t = tasks.get(info.key);
  if (!t) return;
  t.stage = stage;
  t.progress = progress;
  mediaEvents.emit('media', publicState(info));
}

async function markReady(info, piece, value = true, extra = {}) {
  await withLock(`c:${info.key}`, async () => {
    const i = await readJSON(infoPath(info.key), info);
    i.ready = { ...(i.ready || {}), [piece]: value };
    Object.assign(i, extra);
    Object.assign(info, i);
    await writeJSON(infoPath(info.key), i);
  });
}

async function prepareMedia(info) {
  const { meta, path: file, key } = info;
  const dir = cacheDir(key);
  await fsp.mkdir(dir, { recursive: true });
  const ready = info.ready || {};
  try {
    if (meta.type !== 'audio' && !ready.poster) {
      report(info, 'poster', 0.02);
      const name = await generatePoster(file, meta, dir);
      await markReady(info, 'poster', name);
    }
    if (meta.type === 'video' && !ready.strip) {
      report(info, 'thumbnails', 0.05);
      const strip = await generateStrip(file, meta, dir);
      await markReady(info, 'strip', true, { strip });
    }
    if (meta.hasAudio && !ready.peaks) {
      report(info, 'audio waveform', 0.1);
      await generatePeaks(file, meta, dir);
      await markReady(info, 'peaks');
    }
    if (meta.type === 'video' && !ready.preview) {
      await generatePreview(file, meta, dir, (p) => report(info, 'preview', 0.12 + p * 0.88));
      await markReady(info, 'preview');
      if (meta.hasAudio) await markReady(info, 'audio');
    }
    if (meta.type === 'audio' && !ready.audio) {
      report(info, 'audio', 0.5);
      await generateAudio(file, dir);
      await markReady(info, 'audio');
    }
  } catch (e) {
    failed.add(key);
    await markReady(info, 'failed', true, { error: e.message });
    throw e;
  }
  if (info.error) await markReady(info, 'failed', false, { error: null });
}

async function ffmpeg(args, options) {
  const r = await run(FFMPEG, ['-nostdin', '-y', '-hide_banner', '-loglevel', 'error', ...args], options);
  if (r.code !== 0) throw new Error(`ffmpeg: ${r.stderr.trim().split('\n').slice(-3).join(' | ')}`);
  return r;
}

async function generatePoster(file, meta, dir) {
  const { w, h } = fitSide(meta.width, meta.height, 640);
  const scale = `scale=${w}:${h}:flags=bicubic:${colorInput(meta)}`;
  if (meta.type === 'video') {
    const ss = Math.min(1, (meta.duration || 0) * 0.25);
    await ffmpeg(['-ss', ss.toFixed(3), '-i', file, '-frames:v', '1', '-vf', `${scale},format=rgb24`, '-q:v', '3', path.join(dir, 'poster.jpg')]);
    return 'poster.jpg';
  }
  await ffmpeg(['-i', file, '-frames:v', '1', '-vf', `${scale},format=rgba`, path.join(dir, 'poster.png')]);
  return 'poster.png';
}

/** Thumbnail strip (sprite) for the timeline and scrubbing. */
async function generateStrip(file, meta, dir) {
  const duration = meta.duration || 1;
  const interval = Math.max(0.1, duration / 120);
  const count = Math.max(1, Math.ceil(duration / interval));
  const columns = 10;
  const rows = Math.ceil((count + 1) / columns);
  const height = 160;
  const width = even((height * meta.width) / meta.height);
  await ffmpeg([
    '-i', file, '-an',
    '-vf', `fps=${(1 / interval).toFixed(5)},scale=${width}:${height}:flags=bicubic:${colorInput(meta)},format=rgb24,tile=${columns}x${rows}`,
    '-frames:v', '1', '-q:v', '5', path.join(dir, 'strip.jpg'),
  ]);
  return { interval, count, columns, rows, width, height };
}

/** Waveform peaks: 100 per second, 0–255. */
async function generatePeaks(file, meta, dir) {
  const sampleRate = 4000;
  const r = await run(FFMPEG, ['-v', 'error', '-i', file, '-map', '0:a:0', '-ac', '1', '-ar', String(sampleRate), '-f', 's16le', '-acodec', 'pcm_s16le', 'pipe:1'], { binary: true });
  if (r.code !== 0) throw new Error(`peaks: ${r.stderr.slice(-200)}`);
  const samples = new Int16Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.length / 2));
  const perSecond = 100;
  const block = sampleRate / perSecond;
  const peaks = new Uint8Array(Math.ceil(samples.length / block));
  for (let i = 0; i < peaks.length; i++) {
    let max = 0;
    const end = Math.min(samples.length, (i + 1) * block);
    for (let j = i * block; j < end; j++) {
      const v = Math.abs(samples[j]);
      if (v > max) max = v;
    }
    peaks[i] = Math.min(255, Math.round((max / 32768) * 255));
  }
  await writeJSON(path.join(dir, 'peaks.json'), { perSecond, data: Buffer.from(peaks).toString('base64') });
}

/**
 * Preview for review: H.264 with a GOP of 10 and no B-frames (fast, exact seeking),
 * same frames as the original, BT.709. Along the way it pulls the audio out as FLAC for the editor.
 */
async function generatePreview(file, meta, dir, onProgress) {
  const short = Math.min(meta.width, meta.height);
  const f = short > 1080 ? 1080 / short : 1;
  const w = even(meta.width * f);
  const h = even(meta.height * f);
  const tmpVideo = path.join(dir, 'preview.tmp.mp4');
  const tmpAudio = path.join(dir, 'audio.tmp.flac');
  const args = [
    '-progress', 'pipe:1', '-nostats', '-i', file,
    '-map', '0:v:0',
    '-vf', `scale=${w}:${h}:flags=bicubic:${colorInput(meta)}:out_color_matrix=bt709:out_range=tv,format=yuv420p`,
    '-fps_mode', 'passthrough',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-g', '10', '-keyint_min', '10', '-sc_threshold', '0', '-bf', '0', '-profile:v', 'high',
    ...TAGS_709,
  ];
  if (meta.hasAudio) args.push('-map', '0:a:0', '-c:a', 'aac', '-b:a', '160k', '-ac', '2', '-ar', '48000');
  args.push('-movflags', '+faststart', tmpVideo);
  if (meta.hasAudio) args.push('-map', '0:a:0', '-c:a', 'flac', '-sample_fmt', 's16', '-ac', '2', '-ar', '48000', tmpAudio);
  const total = (meta.duration || 1) * 1e6;
  await ffmpeg(args, {
    onLine: (line) => {
      const m = /^out_time_us=(\d+)/.exec(line);
      if (m) onProgress(Math.min(0.99, Number(m[1]) / total));
    },
  });
  await fsp.rename(tmpVideo, path.join(dir, 'preview.mp4'));
  if (meta.hasAudio) await fsp.rename(tmpAudio, path.join(dir, 'audio.flac'));
}

async function generateAudio(file, dir) {
  const tmp = path.join(dir, 'audio.tmp.flac');
  await ffmpeg(['-i', file, '-map', '0:a:0', '-c:a', 'flac', '-sample_fmt', 's16', '-ac', '2', '-ar', '48000', tmp]);
  await fsp.rename(tmp, path.join(dir, 'audio.flac'));
}

/** Deletes the least used entries if the cache goes past the limit. */
export async function pruneCache(maxBytes = CACHE_MAX_BYTES) {
  let entries = [];
  try {
    entries = await fsp.readdir(CACHE, { withFileTypes: true });
  } catch {
    return { deleted: 0, bytes: 0 };
  }
  const dirs = [];
  let total = 0;
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const dir = path.join(CACHE, e.name);
    const bytes = await dirSize(dir);
    let used = 0;
    try {
      used = (await fsp.stat(path.join(dir, 'info.json'))).mtimeMs;
    } catch {}
    dirs.push({ key: e.name, dir, bytes, used });
    total += bytes;
  }
  let deleted = 0;
  if (total > maxBytes) {
    dirs.sort((a, b) => a.used - b.used);
    for (const d of dirs) {
      if (total <= maxBytes * 0.85) break;
      if (tasks.has(d.key)) continue;
      await fsp.rm(d.dir, { recursive: true, force: true });
      total -= d.bytes;
      deleted++;
    }
  }
  return { deleted, bytes: total };
}
