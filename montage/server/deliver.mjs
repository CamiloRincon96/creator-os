// Delivery of the FINAL version: copies the original and generates the variants per platform
// (the same ones already in use: -ig HEVC, -fb H.264, -web, -no-audio) in brands/<brand>/finals/<project>/.

import fsp from 'node:fs/promises';
import path from 'node:path';
import { FFMPEG, REPO } from './config.mjs';
import * as data from './data.mjs';
import { TAGS_709, colorInput } from './media.mjs';
import { notifyJob, newJob } from './jobs.mjs';
import { now, isInside, rename, run, slug, toPosix } from './util.mjs';

export const VARIANTS = {
  original: { name: 'Original', suffix: '', description: 'Exact copy of the final render', for: ['video', 'image', 'carousel'] },
  ig: { name: 'Instagram', suffix: '-ig', description: 'Light HEVC (hvc1), AAC', for: ['video'] },
  fb: { name: 'Facebook', suffix: '-fb', description: 'H.264 High 4.1, AAC', for: ['video'] },
  web: { name: 'Web', suffix: '-web', description: 'H.264 with higher quality, fast start', for: ['video'] },
  'no-audio': { name: 'No audio', suffix: '-no-audio', description: 'The same video without an audio track', for: ['video'] },
  jpg: { name: 'JPG', suffix: '', description: 'JPG quality 92 (for a quick upload)', for: ['image', 'carousel'] },
};

function variantArgs(id, meta) {
  const color = `scale=${meta.width}:${meta.height}:${colorInput(meta)}:out_color_matrix=bt709:out_range=tv,format=yuv420p`;
  const audio = meta.hasAudio ? ['-c:a', 'aac', '-b:a', '160k', '-ar', '48000'] : ['-an'];
  switch (id) {
    case 'ig':
      return ['-vf', color, '-c:v', 'libx265', '-preset', 'medium', '-crf', '24', '-maxrate', '4M', '-bufsize', '8M', '-tag:v', 'hvc1', ...TAGS_709, ...audio, '-movflags', '+faststart'];
    case 'fb':
      return ['-vf', color, '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-maxrate', '5M', '-bufsize', '10M', '-profile:v', 'high', '-level:v', '4.1', ...TAGS_709, ...audio, '-movflags', '+faststart'];
    case 'web':
      return ['-vf', color, '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-maxrate', '8M', '-bufsize', '16M', '-profile:v', 'high', ...TAGS_709, ...audio, '-movflags', '+faststart'];
    case 'no-audio':
      return ['-map', '0:v:0', '-c:v', 'copy', '-an', '-movflags', '+faststart'];
    default:
      return null;
  }
}

/** Works out which files will be written (without writing anything). */
export async function deliveryPlan(id, { variants, folder }) {
  const p = await data.readProject(id);
  if (!p.final) throw new data.MontageError(400, 'First mark a version as FINAL');
  const v = data.findVersion(p, p.final);
  const fallback = p.brand ? path.posix.join('brands', p.brand, 'finals', id) : path.posix.join('finals', id);
  // With `/` even if typed with `\` on Windows: it is stored in project.json and shown in the editor.
  const destinationRel = toPosix(folder || p.delivery?.folder || fallback).replace(/^\/+/, '');
  const destination = path.resolve(REPO, destinationRel);
  if (!isInside(REPO, destination)) throw new data.MontageError(400, 'The delivery folder must be inside the repo');
  const base = slug(p.name) || id;
  const outputs = [];
  const valid = (variants || []).filter((x) => VARIANTS[x]?.for.includes(p.type));
  if (!valid.length) throw new data.MontageError(400, 'Choose at least one variant');
  v.files.forEach((a, i) => {
    const ext = path.extname(a.name).toLowerCase();
    const page = v.files.length > 1 ? `-${String(i + 1).padStart(2, '0')}` : '';
    for (const vid of valid) {
      const outExt = vid === 'jpg' ? '.jpg' : vid === 'original' ? ext : '.mp4';
      if (vid === 'jpg' && ['.jpg', '.jpeg'].includes(ext)) continue;
      outputs.push({ variant: vid, source: data.filePath(id, a), meta: a.meta, destination: path.join(destination, `${base}${page}${VARIANTS[vid].suffix}${outExt}`) });
    }
  });
  const existing = [];
  for (const o of outputs) {
    try {
      await fsp.access(o.destination);
      existing.push(toPosix(path.relative(REPO, o.destination)));
    } catch {}
  }
  return { project: p, version: v, destination, destinationRel, outputs, existing };
}

export async function deliver(id, { variants, folder, overwrite = false, person = 'Team' }) {
  const plan = await deliveryPlan(id, { variants, folder });
  if (plan.existing.length && !overwrite) {
    const e = new data.MontageError(409, `Already exist: ${plan.existing.join(', ')}`);
    e.existing = plan.existing;
    throw e;
  }
  const job = newJob({ type: 'delivery', project: id, version: plan.version.id });
  runJob(job, plan, person).catch(() => {});
  return { job: job.id, files: plan.outputs.map((o) => toPosix(path.relative(REPO, o.destination))), destination: plan.destinationRel };
}

const emit = notifyJob;

async function runJob(j, plan, person) {
  try {
    await fsp.mkdir(plan.destination, { recursive: true });
    const n = plan.outputs.length;
    for (let i = 0; i < n; i++) {
      const o = plan.outputs[i];
      j.stage = `${VARIANTS[o.variant].name} (${i + 1}/${n})`;
      j.progress = i / n;
      emit(j);
      const tmp = `${o.destination}.tmp${path.extname(o.destination)}`;
      if (o.variant === 'original') {
        await fsp.copyFile(o.source, tmp);
      } else if (o.variant === 'jpg') {
        const r = await run(FFMPEG, ['-nostdin', '-y', '-v', 'error', '-i', o.source, '-frames:v', '1', '-q:v', '2', tmp]);
        if (r.code !== 0) throw new Error(r.stderr.slice(-300));
      } else {
        const total = (o.meta.duration || 1) * 1e6;
        const args = ['-nostdin', '-y', '-v', 'error', '-progress', 'pipe:1', '-nostats', '-i', o.source, ...variantArgs(o.variant, o.meta), tmp];
        const r = await run(FFMPEG, args, {
          onLine: (l) => {
            const m = /^out_time_us=(\d+)/.exec(l);
            if (m) {
              j.progress = (i + Math.min(1, Number(m[1]) / total)) / n;
              emit(j);
            }
          },
        });
        if (r.code !== 0) throw new Error(r.stderr.trim().split(/\r?\n/).slice(-2).join(' | '));
      }
      await rename(tmp, o.destination);
      await fsp.chmod(o.destination, 0o644).catch(() => {});
      j.files.push(toPosix(path.relative(REPO, o.destination)));
    }
    j.progress = 1;
    j.stage = 'done';
    j.done = true;
    await data.updateProject(j.project, (p) => {
      p.deliveries = [...(p.deliveries || []), { version: j.version, date: now(), files: j.files }];
      if (plan.destinationRel !== p.delivery?.folder) p.delivery = { ...p.delivery, folder: plan.destinationRel };
    });
    await data.logActivity(j.project, {
      author: 'person',
      name: person,
      type: 'delivery',
      version: j.version,
      text: `${person} delivered ${j.version}: ${j.files.length} file${j.files.length === 1 ? '' : 's'} to ${plan.destinationRel}`,
    });
  } catch (e) {
    j.error = e.message;
    j.stage = 'error';
  }
  emit(j);
}
