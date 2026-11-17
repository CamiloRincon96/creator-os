// Exports timeline.json to an MP4 with ffmpeg and publishes it as a new version.
// Video: each clip is trimmed with -ss/-t on the input, brought to the timeline fps, scaled
// with the color policy and overlaid in yuv444 (overlay with eof_action=pass so the clip
// disappears when it ends). Texts and logos arrive as full-frame PNGs rasterized by the
// browser (same render as the preview). Audio: adelay in samples + amix without normalizing.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { rasterKey } from '../shared/hash.js';
import { STATE, FFMPEG, REPO } from './config.mjs';
import * as data from './data.mjs';
import { TAGS_709, colorInput, probe } from './media.mjs';
import { notifyJob, newJob } from './jobs.mjs';
import { isInside, run, writeAtomic, readJSON } from './util.mjs';

const even = (x) => Math.max(2, Math.round(x / 2) * 2);
const num = (v) => Number(v).toFixed(6);
const end = (c) => c.start + c.duration;

export const rasterPath = (id, key) => path.join(data.projectDir(id), 'rasters', `${key}.png`);

function error(status, message, extra = {}) {
  return Object.assign(new data.MontageError(status, message), extra);
}

/** Checks that the timeline makes sense before spending a render. Returns the list of problems. */
export function validateTimeline(tl) {
  const p = [];
  if (!tl || typeof tl !== 'object') return ['The timeline is not an object'];
  const f = tl.format || {};
  if (!(f.width > 0 && f.height > 0 && f.fps > 0)) p.push('format must have positive width, height and fps');
  const tracks = new Set((tl.tracks || []).map((x) => x.id));
  for (const c of tl.clips || []) {
    const name = `clip ${c.id}`;
    if (!tracks.has(c.track)) p.push(`${name}: track "${c.track}" does not exist`);
    if (!(Number.isFinite(c.start) && c.start >= 0)) p.push(`${name}: invalid start`);
    if (!(Number.isFinite(c.duration) && c.duration > 0)) p.push(`${name}: invalid duration`);
    if (c.type === 'video' || c.type === 'audio') {
      if (!c.path) p.push(`${name}: path is missing`);
      if (!(c.speed > 0)) p.push(`${name}: invalid speed`);
      if (!(c.sourceIn >= 0)) p.push(`${name}: invalid sourceIn`);
    } else if (c.type === 'text' || c.type === 'image') {
      if (!c.layer) p.push(`${name}: layer is missing`);
    } else p.push(`${name}: unknown type "${c.type}"`);
  }
  return p;
}

/** atempo accepts 0.5–100: lower speeds are chained. */
function tempos(v) {
  const t = [];
  while (v < 0.5) {
    t.push(0.5);
    v /= 0.5;
  }
  t.push(v);
  return t.filter((x) => Math.abs(x - 1) > 1e-6);
}

export async function missingRasters(id, tl) {
  const missing = [];
  for (const c of tl.clips || []) {
    if (c.type !== 'text' && c.type !== 'image') continue;
    const key = rasterKey(c, tl.format);
    if (!fs.existsSync(rasterPath(id, key))) missing.push(key);
  }
  return missing;
}

async function build(id, tl) {
  const { width: W, height: H, fps } = tl.format;
  const D = Math.max(0, ...tl.clips.map(end));
  if (!(D > 0)) throw error(400, 'The timeline is empty');

  const metas = new Map();
  for (const c of tl.clips) {
    if (c.type !== 'video' && c.type !== 'audio') continue;
    const abs = path.resolve(REPO, c.path);
    if (!isInside(REPO, abs) || !fs.existsSync(abs)) throw error(400, `Media ${c.path} does not exist`);
    if (!metas.has(c.path)) metas.set(c.path, { abs, meta: await probe(abs) });
  }

  const inputs = [];
  const filters = [];
  const audios = [];
  let n = 0;
  const color = /^#[0-9a-f]{6}$/i.test(tl.background || '') ? `0x${tl.background.slice(1)}` : 'black';
  inputs.push('-f', 'lavfi', '-i', `color=c=${color}:s=${W}x${H}:r=${fps}:d=${num(D)}`);
  filters.push(`[${n++}:v]format=rgb24,scale=out_color_matrix=bt709:out_range=tv,format=yuv444p[b]`);
  let acc = 'b';
  let k = 0;

  const fades = (c, dur) => {
    let s = '';
    if (c.opacity !== undefined && c.opacity < 1) s += `,lut=a=val*${Math.max(0, c.opacity).toFixed(4)}`;
    if (c.fadeIn > 0) s += `,fade=t=in:st=0:d=${num(Math.min(c.fadeIn, dur))}:alpha=1`;
    if (c.fadeOut > 0) s += `,fade=t=out:st=${num(Math.max(0, dur - c.fadeOut))}:d=${num(Math.min(c.fadeOut, dur))}:alpha=1`;
    return s;
  };

  const videoTracks = tl.tracks.filter((p) => p.type === 'video' && !p.hidden).reverse();
  for (const track of videoTracks) {
    const clips = tl.clips.filter((c) => c.track === track.id && c.type !== 'audio').sort((a, b) => a.start - b.start);
    for (const c of clips) {
      if (c.type === 'video') {
        const { abs, meta } = metas.get(c.path);
        const speed = c.speed || 1;
        inputs.push('-ss', num(c.sourceIn), '-t', num(c.duration * speed), '-i', abs);
        const i = n++;
        const tr = c.transform || { scale: 1, x: 0, y: 0, rotation: 0, fit: 'cover' };
        const fit = tr.fit === 'contain' ? Math.min(W / meta.width, H / meta.height) : Math.max(W / meta.width, H / meta.height);
        const s = fit * (tr.scale || 1);
        const w = even(meta.width * s);
        const h = even(meta.height * s);
        let ow = w;
        let oh = h;
        let chain = `[${i}:v]setpts=(PTS-STARTPTS)/${speed},fps=${fps},scale=${w}:${h}:flags=bicubic:${colorInput(meta)}:out_color_matrix=bt709:out_range=tv,format=yuva444p`;
        if (tr.rotation) {
          const rad = (tr.rotation * Math.PI) / 180;
          ow = even(Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad)));
          oh = even(Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad)));
          chain += `,rotate=${rad.toFixed(6)}:ow=${ow}:oh=${oh}:c=none`;
        }
        chain += `${fades(c, c.duration)},setpts=PTS+${num(c.start)}/TB[v${k}]`;
        filters.push(chain);
        const x = Math.round(W / 2 + (tr.x || 0) - ow / 2);
        const y = Math.round(H / 2 + (tr.y || 0) - oh / 2);
        filters.push(`[${acc}][v${k}]overlay=x=${x}:y=${y}:eof_action=pass:format=yuv444[o${k}]`);
        acc = `o${k++}`;
        if (c.hasAudio !== false && meta.hasAudio && !track.muted && c.volume > 0) audios.push({ i, c });
      } else {
        const png = rasterPath(tl.__id, rasterKey(c, tl.format));
        inputs.push('-loop', '1', '-framerate', String(fps), '-t', num(c.duration), '-i', png);
        const i = n++;
        filters.push(`[${i}:v]format=rgba,scale=out_color_matrix=bt709:out_range=tv,format=yuva444p${fades(c, c.duration)},setpts=PTS-STARTPTS+${num(c.start)}/TB[v${k}]`);
        filters.push(`[${acc}][v${k}]overlay=x=0:y=0:eof_action=pass:format=yuv444[o${k}]`);
        acc = `o${k++}`;
      }
    }
  }

  for (const track of tl.tracks.filter((p) => p.type === 'audio' && !p.muted)) {
    for (const c of tl.clips.filter((x) => x.track === track.id && x.type === 'audio')) {
      if (!(c.volume > 0)) continue;
      const { abs } = metas.get(c.path);
      inputs.push('-ss', num(c.sourceIn), '-t', num(c.duration * (c.speed || 1)), '-i', abs);
      audios.push({ i: n++, c });
    }
  }

  filters.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${num(D)}[silence]`);
  const audioPads = ['[silence]'];
  audios.forEach(({ i, c }, j) => {
    let chain = `[${i}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,asetpts=PTS-STARTPTS`;
    for (const f of tempos(c.speed || 1)) chain += `,atempo=${f.toFixed(6)}`;
    if (c.volume !== 1) chain += `,volume=${Number(c.volume).toFixed(4)}`;
    if (c.fadeIn > 0) chain += `,afade=t=in:st=0:d=${num(c.fadeIn)}`;
    if (c.fadeOut > 0) chain += `,afade=t=out:st=${num(Math.max(0, c.duration - c.fadeOut))}:d=${num(c.fadeOut)}`;
    chain += `,adelay=delays=${Math.round(c.start * 48000)}S:all=1[x${j}]`;
    filters.push(chain);
    audioPads.push(`[x${j}]`);
  });
  filters.push(`${audioPads.join('')}amix=inputs=${audioPads.length}:duration=first:normalize=0,alimiter=limit=0.95:level=0:latency=1[aout]`);
  filters.push(`[${acc}]format=yuv420p[vout]`);
  return { inputs, graph: filters.join(';\n'), D, fps };
}

export async function exportTimeline(id, { author = 'person', name = '', note = '' } = {}) {
  await data.readProject(id);
  const tl = await readJSON(path.join(data.projectDir(id), 'timeline.json'), null);
  if (!tl) throw error(404, 'This project has no timeline yet (open it in Edit)');
  const problems = validateTimeline(tl);
  if (problems.length) throw error(400, `The timeline has problems: ${problems.join('; ')}`);
  const missing = await missingRasters(id, tl);
  if (missing.length) {
    throw error(409, `${missing.length} text(s)/logo(s) still need to be prepared: open the project's video editor (node montage/cli.mjs open ${id}) and export again`, { missing });
  }
  const plan = await build(id, { ...tl, __id: id });
  const job = newJob({ type: 'export', project: id, version: null });
  runJob(id, job, plan, { author, name, note, rev: tl.rev }).catch(() => {});
  return { job: job.id, duration: plan.D };
}

async function runJob(id, j, plan, { author, name, note, rev }) {
  const stamp = Date.now().toString(36);
  const graph = path.join(STATE, `graph-${id}-${stamp}.txt`);
  const output = path.join(STATE, `export-${id}-${stamp}.mp4`);
  try {
    await writeAtomic(graph, plan.graph);
    j.stage = 'exporting';
    notifyJob(j);
    const args = [
      '-nostdin', '-y', '-hide_banner', '-loglevel', 'error', '-progress', 'pipe:1', '-nostats',
      ...plan.inputs,
      '-/filter_complex', graph,
      '-map', '[vout]', '-map', '[aout]', '-t', num(plan.D), '-r', String(plan.fps),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-profile:v', 'high', '-pix_fmt', 'yuv420p', ...TAGS_709,
      // aac_at (AudioToolbox) only exists on macOS; on Windows and Linux, ffmpeg's own AAC.
      '-c:a', process.platform === 'darwin' ? 'aac_at' : 'aac', '-b:a', '192k', '-ar', '48000',
      '-movflags', '+faststart', output,
    ];
    const r = await run(FFMPEG, args, {
      onLine: (l) => {
        const m = /^out_time_us=(\d+)/.exec(l);
        if (m) {
          j.progress = Math.min(0.98, Number(m[1]) / 1e6 / plan.D);
          notifyJob(j);
        }
      },
    });
    if (r.code !== 0) throw new Error(r.stderr.trim().split(/\r?\n/).slice(-3).join(' | ') || 'ffmpeg failed');
    j.stage = 'publishing';
    notifyJob(j);
    const v = await data.addVersion(id, {
      files: [output],
      author,
      name,
      note: note || 'Exported from the Montage editor',
      origin: `Montage: timeline.json rev ${rev ?? '?'}`,
    });
    j.version = v.id;
    j.progress = 1;
    j.done = true;
    j.stage = 'done';
  } catch (e) {
    j.error = e.message;
    j.stage = 'error';
  } finally {
    await fsp.rm(output, { force: true }).catch(() => {});
    await fsp.rm(graph, { force: true }).catch(() => {});
  }
  notifyJob(j);
}
