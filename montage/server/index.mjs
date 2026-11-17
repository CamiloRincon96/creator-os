// Montage server: API + files + live WebSocket. Listens on 127.0.0.1 only.
// Start: `npm start` (in montage/) or `node montage/cli.mjs server`.

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import express from 'express';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { describeShape, describeRegion, shapesBox } from '../shared/shapes.js';
import { BRANDS } from '../shared/formats.js';
import { timecode } from '../shared/time.js';
import { extractFrames, generateCapture, contactSheet } from './captures.mjs';
import { loadSubmissions, confirm, stopListening, claudeState, claudeEvents, handleListen, registerSubmission } from './claude.mjs';
import { CACHE, STATE, FONTS, HOST, PROJECTS, PORTS, REPO, SERVER_FILE, WEB_DIST } from './config.mjs';
import * as data from './data.mjs';
import { deliver, VARIANTS } from './deliver.mjs';
import { exportTimeline, missingRasters, rasterPath, validateTimeline } from './export.mjs';
import { mediaState, mediaEvents, pruneCache } from './media.mjs';
import { jobEvents, readJob } from './jobs.mjs';
import { withLock, isInside, toPosix, writeAtomic, writeJSON, hash, readJSON } from './util.mjs';

const { MontageError } = data;
const APP_VERSION = '0.1.0';

for (const dir of [PROJECTS, STATE, CACHE, FONTS, path.join(STATE, 'uploads')]) fs.mkdirSync(dir, { recursive: true });

// ---------------------------------------------------------------- live (WebSocket)

const clients = new Set();
function broadcast(message) {
  const text = JSON.stringify(message);
  for (const ws of clients) if (ws.readyState === 1) ws.send(text);
}

mediaEvents.on('media', (media) => broadcast({ type: 'media', media }));
claudeEvents.on('presence', (claude) => broadcast({ type: 'claude', claude }));
jobEvents.on('job', (job) => broadcast({ type: 'job', job }));

async function projectData(id) {
  const project = await data.readProject(id);
  const [notes, activity, context] = await Promise.all([data.listNotes(id), data.readActivity(id), data.readContext(id)]);
  const media = {};
  const last = project.versions.at(-1);
  for (const v of project.versions) {
    for (const a of v.files) {
      if (a.archived) {
        media[a.path] = { archived: true };
        continue;
      }
      try {
        media[a.path] = await mediaState(data.filePath(id, a), { prepare: v === last });
      } catch (e) {
        media[a.path] = { error: e.message };
      }
    }
  }
  return { project, notes, activity, media, context };
}

async function summary(id) {
  const p = await data.readProject(id);
  const notes = await data.listNotes(id);
  const last = p.versions.at(-1);
  let media = null;
  if (last) {
    try {
      media = await mediaState(data.filePath(id, last.files[0]), { prepare: true });
    } catch {}
  }
  return {
    id,
    name: p.name,
    brand: p.brand,
    type: p.type,
    format: p.format,
    final: p.final,
    versions: p.versions.length,
    last: last ? { id: last.id, author: last.author, created: last.created, note: last.note, pages: last.files.length } : null,
    poster: media?.urls?.poster || null,
    posterKey: media?.key || null,
    notes: data.countNotes(notes),
    updated: p.updated,
  };
}

// Disk watcher: Claude (or anyone) can touch the JSON files and the editor finds out.
const fingerprints = new Map();
const timers = new Map();

function scheduleRefresh(id) {
  clearTimeout(timers.get(id));
  timers.set(id, setTimeout(() => refresh(id).catch(() => {}), 75));
}

async function refresh(id) {
  timers.delete(id);
  let d;
  try {
    d = await projectData(id);
  } catch (e) {
    if (e.status === 404 && fingerprints.has(id)) {
      fingerprints.delete(id);
      broadcast({ type: 'project-deleted', id });
    }
    return;
  }
  const fingerprint = hash(JSON.stringify([d.project, d.notes, d.activity.at(-1), d.context]));
  if (fingerprints.get(id) === fingerprint) return;
  fingerprints.set(id, fingerprint);
  broadcast({ type: 'project', id, ...d });
  broadcast({ type: 'summary', summary: await summary(id) });
}

// When Claude (or anyone) changes timeline.json / image.json, the open editor finds out.
const revisions = new Map();
function notifyDocument(id, kind) {
  const key = `${id}:${kind}`;
  clearTimeout(timers.get(key));
  timers.set(
    key,
    setTimeout(async () => {
      const doc = await readJSON(path.join(data.projectDir(id), `${kind}.json`), null).catch(() => null);
      if (!doc || revisions.get(key) === doc.rev) return;
      revisions.set(key, doc.rev);
      broadcast({ type: 'document', id, document: kind, doc });
    }, 120),
  );
}

async function refreshAll() {
  for (const id of await data.listIds()) await refresh(id);
}

try {
  fs.watch(PROJECTS, { recursive: true }, (_event, name) => {
    if (!name) return void refreshAll();
    const parts = name.split(path.sep);
    const id = parts[0];
    if (!id || id.startsWith('.')) return;
    const rest = parts.slice(1).join('/');
    if (/^(versions|captures|media|rasters)(\/|$)/.test(rest) || /\.(tmp|lock)$/.test(name) || name.endsWith('.DS_Store')) return;
    if (rest === 'timeline.json' || rest === 'image.json') return void notifyDocument(id, rest.replace('.json', ''));
    scheduleRefresh(id);
  });
} catch (e) {
  console.warn('[montage] fs.watch not available:', e.message);
}
// FSEvents can drop events: periodic sweep.
setInterval(() => refreshAll().catch(() => {}), 15_000).unref();

// ---------------------------------------------------------------- app

const app = express();
app.disable('x-powered-by');

// The port is decided at startup (the first free one in PORTS).
let port = PORTS[0];
const baseUrl = () => `http://localhost:${port}`;
const validHost = (h) => h === `127.0.0.1:${port}` || h === `localhost:${port}`;
const validOrigin = (o) => [`http://127.0.0.1:${port}`, `http://localhost:${port}`, 'http://localhost:5173', 'http://127.0.0.1:5173'].includes(o);

// Protection against DNS rebinding and requests from other pages.
app.use((req, res, next) => {
  if (!validHost(req.headers.host)) return res.status(403).json({ error: 'Host not allowed' });
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.headers.origin;
    if (origin && !validOrigin(origin)) return res.status(403).json({ error: 'Origin not allowed' });
  }
  // Who makes the change (each person on the team signs their notes). Claude's CLI does not send it.
  let person = '';
  try {
    person = decodeURIComponent(String(req.headers['x-montage-person'] || ''));
  } catch {}
  req.person = person.trim().slice(0, 40) || 'Team';
  next();
});

const api = express.Router();
api.use(express.json({ limit: '25mb' }));

const list = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map((x) => Number(String(x).trim().replace('#', ''))).filter(Number.isInteger);

api.get('/health', (_req, res) => res.json({ ok: true, app: 'montage', version: APP_VERSION, pid: process.pid, port, url: baseUrl() }));

// Shutting Montage down from the interface: tells Claude (stops listening) and closes the server.
api.post('/shutdown', (_req, res) => {
  res.json({ ok: true });
  stopListening('shutdown');
  broadcast({ type: 'shutdown' });
  setTimeout(exit, 300);
});

api.post('/claude/stop', (req, res) => res.json({ stopped: stopListening('requested', req.person) }));

api.get('/state', async (_req, res) => {
  const projects = [];
  for (const id of await data.listIds()) {
    try {
      projects.push(await summary(id));
    } catch {}
  }
  res.json({ projects, claude: claudeState(), brands: BRANDS });
});

api.post('/projects', async (req, res) => {
  const p = await data.createProject(req.body || {});
  scheduleRefresh(p.id);
  res.status(201).json(p);
});

api.get('/projects/:id', async (req, res) => res.json(await projectData(req.params.id)));

api.patch('/projects/:id', async (req, res) => res.json(await data.editProject(req.params.id, req.body || {})));

/** Accepted file paths: absolute (CLI), relative to the repo, or temporary uploads. */
function resolvePath(r) {
  const file = path.isAbsolute(r) ? r : path.join(REPO, r);
  return path.resolve(file);
}

api.post('/projects/:id/versions', async (req, res) => {
  const b = req.body || {};
  const files = (b.paths || []).map(resolvePath);
  const version = await data.addVersion(req.params.id, {
    files,
    author: b.author === 'claude' ? 'claude' : 'person',
    name: b.author === 'claude' ? '' : String(b.name || req.person),
    note: String(b.note || ''),
    origin: String(b.origin || ''),
    resolves: list(b.resolves),
    markers: b.markers || [],
    created: b.created,
  });
  // Temporary uploads are already cloned into the version.
  for (const a of files) if (isInside(path.join(STATE, 'uploads'), a)) fsp.rm(a, { force: true }).catch(() => {});
  for (const a of version.files) mediaState(data.filePath(req.params.id, a), { priority: true }).catch(() => {});
  scheduleRefresh(req.params.id);
  res.status(201).json(version);
});

api.patch('/projects/:id/versions/:v', async (req, res) => res.json(await data.editVersion(req.params.id, req.params.v, req.body || {})));

api.post('/projects/:id/final', async (req, res) => res.json(await data.markFinal(req.params.id, req.body?.version || null, req.person)));

// When the piece is done: deletes the files of the versions that are not the FINAL (or the ones in `keep`); the history stays.
api.post('/projects/:id/archive', async (req, res) =>
  res.json(await data.archiveVersions(req.params.id, { keep: req.body?.keep || [], dryRun: !!req.body?.dryRun, person: req.person || 'Claude' })),
);

api.get('/projects/:id/context', async (req, res) => {
  const p = await data.readProject(req.params.id);
  res.json({ text: await data.readContext(req.params.id), template: data.CONTEXT_TEMPLATE, rules: data.brandRules(p.brand) });
});

api.put('/projects/:id/context', async (req, res) => {
  const claude = req.body?.author === 'claude';
  await data.saveContext(req.params.id, String(req.body?.text ?? ''), { author: claude ? 'claude' : 'person', name: claude ? '' : req.person });
  scheduleRefresh(req.params.id);
  res.json({ ok: true });
});

/** Compact history for Claude: versions, what each one resolved and notes by state. */
api.get('/projects/:id/history', async (req, res) => {
  const p = await data.readProject(req.params.id);
  const notes = await data.listNotes(req.params.id);
  res.json({
    project: { id: p.id, name: p.name, brand: p.brand, origin: p.origin, final: p.final, format: p.format },
    versions: p.versions.map((v) => ({ id: v.id, author: v.author, name: v.name, created: v.created, note: v.note, origin: v.origin, resolves: v.resolves, state: v.state })),
    notes: notes.map((n) => ({ n: n.n, version: n.version, state: n.state, type: n.type, text: n.text, t: n.t, resolvedIn: n.resolvedIn, createdBy: n.createdBy })),
    activity: (await data.readActivity(req.params.id, 25)).reverse(),
    context: await data.readContext(req.params.id),
    rules: data.brandRules(p.brand),
  });
});

// Raw file upload (drag and drop). Returns a temporary path to use in /versions.
api.post('/uploads', async (req, res) => {
  const name = path.basename(String(req.query.name || 'file')).replace(/[^\w.\-() ]+/g, '_') || 'file';
  const destination = path.join(STATE, 'uploads', `${Date.now()}-${crypto.randomBytes(3).toString('hex')}-${name}`);
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(destination);
    req.pipe(out);
    out.on('finish', resolve);
    out.on('error', reject);
    req.on('error', reject);
  });
  res.status(201).json({ path: destination });
});

// ----- notes

async function captureNote(id, note) {
  if (!note.version) return;
  try {
    const p = await data.readProject(id);
    const v = data.findVersion(p, note.version);
    const file = v.files[note.page || 0] || v.files[0];
    const meta = file.meta;
    if (!meta || !meta.width) return;
    const base = `n${String(note.n).padStart(4, '0')}`;
    const out = await generateCapture({
      path: data.filePath(id, file),
      meta,
      frame: note.frame ?? 0,
      shapes: note.shapes,
      dir: path.join(data.projectDir(id), 'captures'),
      base,
    });
    const capture = { png: `captures/${out.png}`, jpg: `captures/${out.jpg}`, zone: out.zone ? `captures/${out.zone}` : null, at: Date.now() };
    await data.updateNote(id, note.n, (nt) => {
      nt.capture = capture;
      delete nt.captureError;
    });
  } catch (e) {
    console.error(`[captures] note #${note.n}: ${e.message}`);
    await data.updateNote(id, note.n, (nt) => void (nt.captureError = e.message)).catch(() => {});
  }
}

api.post('/projects/:id/notes', async (req, res) => {
  const note = await data.createNote(req.params.id, req.body || {}, req.person);
  res.status(201).json(note);
  captureNote(req.params.id, note);
});

api.patch('/projects/:id/notes/:n', async (req, res) => {
  const note = await data.editNote(req.params.id, Number(req.params.n), req.body || {}, req.person);
  res.json(note);
  if (req.body?.shapes) captureNote(req.params.id, note);
});

api.delete('/projects/:id/notes/:n', async (req, res) => res.json(await data.deleteNote(req.params.id, Number(req.params.n))));

api.post('/projects/:id/send', async (req, res) => {
  const id = req.params.id;
  const { notes, message } = await data.sendNotes(id, { message: String(req.body?.message || '').trim(), person: req.person });
  const p = await data.readProject(id);
  const r = await registerSubmission({ project: id, name: p.name, notes: notes.map((n) => n.n), message, from: req.person });
  res.json({ sent: notes.map((n) => n.n), submission: r.submission.id, listening: r.listening });
});

api.post('/projects/:id/reply', async (req, res) => {
  const b = req.body || {};
  res.json(await data.replyToNotes(req.params.id, list(b.notes), { text: b.text, state: b.state, version: b.version }));
});

api.post('/projects/:id/activity', async (req, res) => {
  const claude = req.body?.author !== 'person';
  await data.logActivity(req.params.id, { author: claude ? 'claude' : 'person', name: claude ? undefined : req.person, text: String(req.body?.text || ''), type: 'activity' });
  res.json({ ok: true });
});

// ----- for Claude

function noteDetail(id, p, note) {
  const dir = data.projectDir(id);
  let version = null;
  try {
    version = note.version ? data.findVersion(p, note.version) : null;
  } catch {}
  const file = version ? version.files[note.page || 0] || version.files[0] : null;
  const meta = file?.meta || {};
  const box = shapesBox(note.shapes);
  return {
    ...note,
    timecode: note.t !== null && meta.fps ? timecode(note.t, meta.fps) : null,
    timecodeEnd: note.tEnd !== null && meta.fps ? timecode(note.tEnd, meta.fps) : null,
    zone: box && meta.width ? describeRegion(box, meta.width, meta.height) : null,
    shapesText: (note.shapes || []).map(describeShape),
    captureAbs: note.capture ? Object.fromEntries(Object.entries(note.capture).filter(([k, v]) => v && k !== 'at').map(([k, v]) => [k, path.join(dir, v)])) : null,
    versionInfo: version
      ? { id: version.id, note: version.note, origin: version.origin, author: version.author, file: file ? path.join(dir, file.path) : null, source: file?.source, meta }
      : null,
  };
}

api.get('/pending', async (req, res) => {
  const states = String(req.query.states || 'sent').split(',');
  const ids = req.query.project ? [String(req.query.project)] : await data.listIds();
  const out = [];
  for (const id of ids) {
    const p = await data.readProject(id);
    const notes = (await data.listNotes(id)).filter((n) => states.includes(n.state));
    if (!notes.length) continue;
    out.push({
      project: {
        id,
        name: p.name,
        brand: p.brand,
        type: p.type,
        format: p.format,
        origin: p.origin,
        dir: data.projectDir(id),
        last: p.versions.at(-1)?.id || null,
        final: p.final,
        context: await data.readContext(id),
        rules: data.brandRules(p.brand),
      },
      notes: notes.map((n) => noteDetail(id, p, n)),
    });
  }
  res.json({ projects: out });
});

api.post('/frames', async (req, res) => {
  const b = req.body || {};
  const p = await data.readProject(String(b.project));
  const v = data.findVersion(p, b.version);
  const file = v.files[Number(b.page) || 0] || v.files[0];
  const src = data.filePath(p.id, file);
  const meta = file.meta;
  const dir = path.join(STATE, 'frames', p.id);
  if (meta.type !== 'video') return res.json({ paths: [src], meta });
  const total = meta.frames || Math.round(meta.duration * meta.fps);
  let frames = [];
  if (b.frames) frames = list(b.frames);
  else if (b.times) frames = (Array.isArray(b.times) ? b.times : String(b.times).split(',')).map((t) => Math.floor(Number(t) * meta.fps + 1e-6));
  else {
    const n = Math.min(48, Math.max(2, Number(b.sheet) || 12));
    frames = Array.from({ length: n }, (_, i) => Math.min(total - 1, Math.round(((i + 0.5) * total) / n)));
  }
  frames = frames.filter((c) => Number.isInteger(c) && c >= 0 && c < total + 1);
  if (b.sheet || (!b.frames && !b.times)) {
    const destination = path.join(dir, `${v.id}-sheet.jpg`);
    await contactSheet(src, meta, frames, destination);
    return res.json({ sheet: destination, frames, meta });
  }
  res.json({ paths: await extractFrames(src, meta, frames, dir, v.id), frames, meta });
});

api.get('/claude/listen', handleListen);
api.post('/claude/ack', async (req, res) => res.json({ confirmed: await confirm(String(req.body?.token || '')) }));
api.get('/claude', (_req, res) => res.json(claudeState()));

// ----- media and repo

api.get('/media', async (req, res) => {
  const file = resolvePath(String(req.query.path || ''));
  if (!isInside(REPO, file)) throw new MontageError(403, 'Only files inside the repo');
  res.json(await mediaState(file, { prepare: req.query.prepare !== '0', priority: req.query.priority === '1' }));
});

const HIDDEN = new Set(['node_modules', '.git', '.cache', '.state', 'Auto-Save', '.DS_Store']);
api.get('/repo', async (req, res) => {
  const dir = resolvePath(String(req.query.dir || '.'));
  if (!isInside(REPO, dir)) throw new MontageError(403, 'Outside the repo');
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    if (e.name.startsWith('.') || HIDDEN.has(e.name)) continue;
    const file = path.join(dir, e.name);
    const ext = path.extname(e.name).toLowerCase();
    let type = 'other';
    if (e.isDirectory()) type = 'folder';
    else if (['.mp4', '.mov', '.m4v', '.webm', '.mkv'].includes(ext)) type = 'video';
    else if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) type = 'image';
    else if (['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg'].includes(ext)) type = 'audio';
    let size = 0;
    if (type !== 'folder') {
      try {
        size = (await fsp.stat(file)).size;
      } catch {}
    }
    out.push({ name: e.name, path: toPosix(path.relative(REPO, file)), type, size });
  }
  out.sort((a, b) => (b.type === 'folder') - (a.type === 'folder') || a.name.localeCompare(b.name, 'en'));
  res.json({ dir: toPosix(path.relative(REPO, dir)), entries: out });
});

api.post('/cache/clear', async (_req, res) => res.json(await pruneCache(0)));

// ----- editing documents (image.json / timeline.json) and project media

const DOCUMENTS = { image: 'image.json', timeline: 'timeline.json' };

api.get('/projects/:id/document/:kind', async (req, res) => {
  const name = DOCUMENTS[req.params.kind];
  if (!name) throw new MontageError(404, 'Unknown document');
  await data.readProject(req.params.id);
  res.json(await readJSON(path.join(data.projectDir(req.params.id), name), null));
});

api.put('/projects/:id/document/:kind', async (req, res) => {
  const name = DOCUMENTS[req.params.kind];
  if (!name) throw new MontageError(404, 'Unknown document');
  await data.readProject(req.params.id);
  const file = path.join(data.projectDir(req.params.id), name);
  const doc = await withLock(`d:${file}`, async () => {
    const current = await readJSON(file, null);
    const base = Number(req.body?.rev ?? 0);
    // If someone (Claude) changed it after the editor read it, we warn instead of overwriting it.
    if (current && req.query.force !== '1' && Number(current.rev || 0) > base) {
      throw Object.assign(new MontageError(409, 'The document changed on disk'), { current });
    }
    const next = { ...req.body, rev: Math.max(base, Number(current?.rev || 0)) + 1, updated: new Date().toISOString() };
    await writeJSON(file, next);
    return next;
  });
  res.json(doc);
});

api.post('/projects/:id/media', async (req, res) => {
  await data.readProject(req.params.id);
  const name = path.basename(String(req.query.name || 'media')).replace(/[^\w.\-() ]+/g, '_');
  const dir = path.join(data.projectDir(req.params.id), 'media');
  await fsp.mkdir(dir, { recursive: true });
  const destination = path.join(dir, `${Date.now().toString(36)}-${name}`);
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(destination);
    req.pipe(out);
    out.on('finish', resolve);
    out.on('error', reject);
  });
  res.status(201).json({ path: toPosix(path.relative(REPO, destination)) });
});

// ----- video editor: text/logo rasters and export

api.get('/projects/:id/rasters', async (req, res) => {
  const keys = String(req.query.keys || '').split(',').filter((c) => /^[0-9a-f]{16}$/.test(c));
  res.json({ existing: keys.filter((c) => fs.existsSync(rasterPath(req.params.id, c))) });
});

api.post('/projects/:id/rasters', async (req, res) => {
  await data.readProject(req.params.id);
  let n = 0;
  for (const r of req.body?.rasters || []) {
    if (!/^[0-9a-f]{16}$/.test(r.key) || typeof r.png !== 'string') continue;
    const pngData = Buffer.from(r.png.replace(/^data:image\/png;base64,/, ''), 'base64');
    await writeAtomic(rasterPath(req.params.id, r.key), pngData);
    n++;
  }
  res.json({ saved: n });
});

api.get('/projects/:id/timeline/validate', async (req, res) => {
  const tl = await readJSON(path.join(data.projectDir(req.params.id), 'timeline.json'), null);
  if (!tl) return res.json({ ok: false, problems: ['There is no timeline.json'] });
  const problems = validateTimeline(tl);
  const missing = problems.length ? [] : await missingRasters(req.params.id, tl);
  res.json({ ok: !problems.length && !missing.length, problems, missing, rev: tl.rev });
});

api.post('/projects/:id/export', async (req, res) => {
  const claude = req.body?.author === 'claude';
  res.json(await exportTimeline(req.params.id, { author: claude ? 'claude' : 'person', name: claude ? '' : req.person, note: String(req.body?.note || '') }));
});

api.get('/jobs/:id', (req, res) => {
  const j = readJob(req.params.id);
  if (!j) throw new MontageError(404, 'That job does not exist');
  res.json(j);
});

// ----- delivery of the FINAL

api.get('/projects/:id/delivery', async (req, res) => {
  const p = await data.readProject(req.params.id);
  const available = Object.entries(VARIANTS)
    .filter(([, v]) => v.for.includes(p.type))
    .map(([id, v]) => ({ id, name: v.name, description: v.description }));
  res.json({ final: p.final, folder: p.delivery?.folder, variants: available, deliveries: p.deliveries || [] });
});

api.post('/projects/:id/deliver', async (req, res) => {
  const b = req.body || {};
  res.json(await deliver(req.params.id, { variants: b.variants, folder: b.folder, overwrite: !!b.overwrite, person: req.person }));
});

api.post('/reveal', async (req, res) => {
  const file = resolvePath(String(req.body?.path || ''));
  if (!isInside(REPO, file)) throw new MontageError(403, 'Outside the repo');
  // Shows the file in Finder / File Explorer / its containing folder (Linux).
  const [cmd, args] =
    process.platform === 'darwin'
      ? ['open', ['-R', file]]
      : process.platform === 'win32'
        ? ['explorer.exe', ['/select,', file]] // explorer exits with code 1 even when it works: not checked
        : ['xdg-open', [fs.existsSync(file) && fs.statSync(file).isDirectory() ? file : path.dirname(file)]];
  const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
  child.on('error', (e) => console.error(`[reveal] ${cmd}: ${e.message}`));
  child.unref();
  res.json({ ok: true });
});

api.use((err, _req, res, _next) => {
  const status = err.status || (err.type === 'entity.too.large' ? 413 : 500);
  if (status >= 500) console.error('[api]', err);
  res.status(status).json({
    error: err.message || String(err),
    ...(err.existing ? { existing: err.existing } : {}),
    ...(err.current ? { current: err.current } : {}),
    ...(err.missing ? { missing: err.missing } : {}),
  });
});

app.use('/api', api);

// ----- files

app.use('/cache', express.static(CACHE, { index: false, immutable: true, maxAge: '365d' }));
app.use(
  '/files/projects',
  express.static(PROJECTS, {
    index: false,
    setHeaders: (res, file) => {
      const immutable = file.includes(`${path.sep}versions${path.sep}`);
      res.setHeader('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
    },
  }),
);
app.use('/files/repo', express.static(REPO, { index: false, dotfiles: 'deny' }));
app.use('/fonts', express.static(FONTS, { maxAge: '30d' }));
// Assets carry a hash in their name; index.html is always revalidated so an update shows on open.
app.use(
  express.static(WEB_DIST, {
    index: 'index.html',
    setHeaders: (res, file) => res.setHeader('Cache-Control', file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache'),
  }),
);
app.get('/*splat', (_req, res) => {
  const index = path.join(WEB_DIST, 'index.html');
  res.setHeader('Cache-Control', 'no-cache');
  if (fs.existsSync(index)) res.sendFile(index);
  else res.status(503).send('The interface is not built yet: cd montage && npm run build');
});

// ---------------------------------------------------------------- startup

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const origin = req.headers.origin;
  if (!req.url.startsWith('/ws') || !validHost(req.headers.host) || (origin && !validOrigin(origin))) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ type: 'hello', claude: claudeState(), version: APP_VERSION }));
    ws.on('close', () => clients.delete(ws));
    ws.on('error', () => clients.delete(ws));
  });
});

/** Listens on the first free port in PORTS. If a Montage is already running, it does not start another one. */
function listen(i = 0) {
  const p = PORTS[i];
  if (p === undefined) {
    console.error(`No free port found between ${PORTS[0]} and ${PORTS.at(-1)}. Use MONTAGE_PORT=another.`);
    process.exit(1);
  }
  const onError = async (e) => {
    if (e.code !== 'EADDRINUSE') throw e;
    try {
      const r = await fetch(`http://127.0.0.1:${p}/api/health`, { signal: AbortSignal.timeout(800) });
      const s = await r.json();
      if (s.app === 'montage') {
        console.log(`Montage is already running at http://localhost:${p} (pid ${s.pid}).`);
        process.exit(0);
      }
    } catch {}
    listen(i + 1);
  };
  server.once('error', onError);
  server.listen(p, HOST, async () => {
    server.off('error', onError);
    port = p;
    await loadSubmissions();
    fs.writeFileSync(SERVER_FILE, JSON.stringify({ pid: process.pid, port, url: baseUrl(), started: new Date().toISOString() }));
    console.log(`Montage ready at ${baseUrl()}`);
    await refreshAll();
  });
}
listen();

function exit() {
  try {
    const current = JSON.parse(fs.readFileSync(SERVER_FILE, 'utf8'));
    if (current.pid === process.pid) fs.rmSync(SERVER_FILE, { force: true });
  } catch {}
  process.exit(0);
}
process.on('SIGINT', exit);
process.on('SIGTERM', exit);
