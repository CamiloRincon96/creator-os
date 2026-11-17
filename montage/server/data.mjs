// Montage data on disk. The server is the only writer; the CLI and the browser
// go through its API. Everything is readable JSON so Claude can inspect it.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { PROJECTS, REPO } from './config.mjs';
import { probe } from './media.mjs';
import { clone, isInside, now, readJSON, slug, toPosix, withLock, writeAtomic, writeJSON } from './util.mjs';

export const NOTE_STATES = ['draft', 'sent', 'in_progress', 'question', 'resolved', 'approved', 'reopened'];
export const NOTE_TYPES = ['add', 'remove', 'change', 'fix', 'idea'];
export const VERSION_STATES = ['review', 'discarded', 'final'];
export const PROJECT_TYPES = ['video', 'image', 'carousel'];

export class MontageError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const error = (status, message) => new MontageError(status, message);

export const projectDir = (id) => path.join(PROJECTS, id);
const projectPath = (id) => path.join(projectDir(id), 'project.json');
const notesDir = (id) => path.join(projectDir(id), 'notes');
export const notePath = (id, n) => path.join(notesDir(id), `n${String(n).padStart(4, '0')}.json`);
const activityPath = (id) => path.join(projectDir(id), 'activity.jsonl');

export function validateId(id) {
  if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(String(id))) throw error(400, `Invalid project id: ${id}`);
}

/** Path relative to the repo when it is inside it (for display, always with `/`), absolute otherwise. */
export function readablePath(file) {
  return isInside(REPO, file) ? toPosix(path.relative(REPO, file)) : file;
}

// ---------------------------------------------------------------- projects

export async function listIds() {
  let entries = [];
  try {
    entries = await fsp.readdir(PROJECTS, { withFileTypes: true });
  } catch {
    return [];
  }
  const ids = [];
  for (const e of entries) {
    if (e.isDirectory() && !e.name.startsWith('.')) {
      try {
        await fsp.access(projectPath(e.name));
        ids.push(e.name);
      } catch {}
    }
  }
  return ids.sort();
}

export async function readProject(id) {
  validateId(id);
  const p = await readJSON(projectPath(id), null);
  if (!p) throw error(404, `Project "${id}" does not exist`);
  return p;
}

export async function createProject({ id, name, brand = '', type = 'video', format, origin = '', delivery }) {
  if (!name) throw error(400, 'The project name is missing');
  if (!PROJECT_TYPES.includes(type)) throw error(400, `Invalid type: ${type}`);
  id = id ? slug(id) : slug(`${brand ? brand.split('-')[0] + ' ' : ''}${name}`);
  validateId(id);
  return withLock(`p:${id}`, async () => {
    if (await readJSON(projectPath(id), null)) throw error(409, `Project "${id}" already exists`);
    const p = {
      id,
      name,
      brand,
      type,
      format: format || null,
      origin,
      delivery: delivery || { folder: brand ? path.posix.join('brands', brand, 'finals', id) : path.posix.join('finals', id) },
      final: null,
      nextNote: 1,
      versions: [],
      created: now(),
      updated: now(),
    };
    await writeJSON(projectPath(id), p);
    return p;
  });
}

export async function updateProject(id, mutate) {
  validateId(id);
  return withLock(`p:${id}`, async () => {
    const p = await readProject(id);
    const r = await mutate(p);
    p.updated = now();
    await writeJSON(projectPath(id), p);
    return r === undefined ? p : r;
  });
}

export async function editProject(id, changes) {
  return updateProject(id, (p) => {
    for (const k of ['name', 'brand', 'origin']) if (typeof changes[k] === 'string') p[k] = changes[k];
    if (changes.format) p.format = changes.format;
    if (changes.delivery?.folder) p.delivery = { ...p.delivery, folder: changes.delivery.folder };
  });
}

// ---------------------------------------------------------------- versions

function uniqueName(name, used) {
  if (!used.some((a) => a.name === name)) return name;
  const ext = path.extname(name);
  const base = name.slice(0, -ext.length || undefined);
  for (let i = 2; ; i++) {
    const other = `${base}-${i}${ext}`;
    if (!used.some((a) => a.name === other)) return other;
  }
}

/**
 * Adds a new version by cloning the files (APFS, no extra space) into versions/vN/.
 * A carousel carries several images (pages) in a single version.
 */
export async function addVersion(id, { files, author = 'claude', name = '', note = '', origin = '', resolves = [], markers = [], created, stage = null, rating = null }) {
  if (!files?.length) throw error(400, 'There are no files for the version');
  const metas = [];
  for (const a of files) {
    try {
      await fsp.access(a);
    } catch {
      throw error(400, `File ${a} does not exist`);
    }
    metas.push(await probe(a));
  }
  const version = await updateProject(id, async (p) => {
    const num = (p.versions || []).reduce((m, v) => Math.max(m, Number(v.id.slice(1)) || 0), 0) + 1;
    const vid = `v${num}`;
    const dir = path.join(projectDir(id), 'versions', vid);
    const list = [];
    for (let i = 0; i < files.length; i++) {
      // Temporary uploads carry a prefix (timestamp + random) that does not go into the version.
      const fileName = uniqueName(path.basename(files[i]).replace(/^\d{13}-[0-9a-f]{6}-/, ''), list);
      const destination = path.join(dir, fileName);
      await clone(files[i], destination);
      await fsp.chmod(destination, 0o444).catch(() => {});
      list.push({ name: fileName, path: path.posix.join('versions', vid, fileName), type: metas[i].type, meta: metas[i], source: readablePath(files[i]) });
    }
    if (!p.format && metas[0].width) p.format = { width: metas[0].width, height: metas[0].height, fps: metas[0].fps || null };
    const v = {
      id: vid,
      files: list,
      author,
      ...(author === 'person' ? { name } : {}),
      // When importing old work, the real render date is kept.
      created: created && !Number.isNaN(Date.parse(created)) ? new Date(created).toISOString() : now(),
      note,
      origin,
      resolves: resolves.map(Number).filter(Boolean),
      markers: cleanMarkers(markers),
      state: 'review',
      ...(Number.isInteger(Number(stage)) && stage !== null ? { stage: Number(stage) } : {}),
      ...(rating?.reviewer ? { rating: { reviewer: cleanReviewer(rating.reviewer) } } : {}),
    };
    p.versions = [...(p.versions || []), v];
    return v;
  });
  for (const n of version.resolves) {
    await updateNote(id, n, (nt) => {
      nt.state = 'resolved';
      nt.resolvedIn = version.id;
      nt.thread.push({ author, ...(author === 'person' ? { name } : {}), text: `Resolved in ${version.id}.`, date: now(), version: version.id });
    }).catch(() => {});
  }
  await logActivity(id, {
    author,
    name,
    type: 'version',
    version: version.id,
    text: `${who(author, name)} published ${version.id}${note ? ` — ${note}` : ''}`,
  });
  return version;
}

/** The independent reviewer's score (shared/review.js reads it from the report): axes from 1 to 10 and its verdict. */
function cleanReviewer(r) {
  const axes = (r.axes || [])
    .map((a) => ({ axis: String(a.axis || '').slice(0, 80), score: Number(a.score) }))
    .filter((a) => a.axis && Number.isFinite(a.score) && a.score >= 1 && a.score <= 10);
  const scores = axes.map((a) => a.score);
  return {
    axes,
    average: scores.length ? Math.round((10 * scores.reduce((a, b) => a + b, 0)) / scores.length) / 10 : null,
    minimum: scores.length ? Math.min(...scores) : null,
    verdict: String(r.verdict || '').slice(0, 600),
    skipped: (r.skipped || []).map((x) => String(x).slice(0, 200)),
  };
}

/** The person's stars (1 to 5) for a version. Next to the reviewer's score, they show where Claude fools itself. */
export async function rateVersion(id, vid, { stars, person = 'Team' }) {
  const n = Number(stars);
  if (!Number.isInteger(n) || n < 1 || n > 5) throw error(400, 'Stars go from 1 to 5');
  const v = await updateProject(id, (p) => {
    const v = p.versions.find((x) => x.id === vid);
    if (!v) throw error(404, `Version ${vid} does not exist`);
    v.rating = { ...(v.rating || {}), person: { stars: n, name: person, date: now() } };
    return v;
  });
  const r = v.rating.reviewer;
  await logActivity(id, {
    author: 'person',
    name: person,
    type: 'rating',
    version: vid,
    text: `${person} gave ${vid} ${n} out of 5 stars${r ? ` (the reviewer had given it ${r.average} out of 10)` : ''}`,
  });
  return v;
}

function cleanMarkers(markers) {
  return (markers || [])
    .map((m) => ({ t: Number(m.t), text: String(m.text || '').slice(0, 80) }))
    .filter((m) => Number.isFinite(m.t) && m.t >= 0)
    .sort((a, b) => a.t - b.t);
}

export async function editVersion(id, vid, { state, note, markers }) {
  return updateProject(id, (p) => {
    const v = p.versions.find((x) => x.id === vid);
    if (!v) throw error(404, `Version ${vid} does not exist`);
    if (state) {
      if (!['review', 'discarded'].includes(state)) throw error(400, 'Use "Mark as final" for the final version');
      v.state = state;
      if (p.final === vid && state !== 'final') p.final = null;
    }
    if (typeof note === 'string') v.note = note;
    if (markers) v.markers = cleanMarkers(markers);
    return v;
  });
}

/** Only one FINAL version per project. null removes it. */
export async function markFinal(id, vid, person = 'Team') {
  const p = await updateProject(id, (p) => {
    if (vid && !p.versions.some((v) => v.id === vid)) throw error(404, `Version ${vid} does not exist`);
    for (const v of p.versions) {
      if (v.id === vid) v.state = 'final';
      else if (v.state === 'final') v.state = 'review';
    }
    p.final = vid || null;
  });
  await logActivity(id, { author: 'person', name: person, type: 'final', version: vid, text: vid ? `${person} marked ${vid} as FINAL` : `${person} removed the final version` });
  return p;
}

/**
 * Frees space once the piece is done: deletes the files of every version except the FINAL and the ones
 * in `keep`. Notes, history and each version's data stay (the version becomes «archived»).
 * Without a FINAL and without `keep` it deletes nothing. With `dryRun` it only says what it would delete and how much it frees.
 */
export async function archiveVersions(id, { keep = [], dryRun = false, person = 'Claude' } = {}) {
  const p0 = await readProject(id);
  const kept = new Set([p0.final, ...keep].filter(Boolean));
  if (!kept.size) throw error(400, 'The project has no FINAL version: mark one before archiving, or say which ones to keep');
  for (const vid of kept) if (!p0.versions.some((v) => v.id === vid)) throw error(404, `Version ${vid} does not exist`);
  const plan = [];
  for (const v of p0.versions) {
    if (kept.has(v.id) || v.archived) continue;
    let bytes = 0;
    for (const a of v.files) bytes += (await fsp.stat(filePath(id, a)).catch(() => null))?.size || 0;
    plan.push({ version: v.id, files: v.files.length, bytes });
  }
  const total = plan.reduce((s, x) => s + x.bytes, 0);
  if (dryRun || !plan.length) return { dryRun: true, keep: [...kept], plan, bytes: total };
  await updateProject(id, async (p) => {
    for (const v of p.versions) {
      if (!plan.some((x) => x.version === v.id)) continue;
      // On Windows the version's 0o444 is the "read-only" attribute: clear it before deleting.
      if (process.platform === 'win32') for (const a of v.files) await fsp.chmod(filePath(id, a), 0o644).catch(() => {});
      await fsp.rm(path.join(projectDir(id), 'versions', v.id), { recursive: true, force: true });
      v.files = v.files.map((a) => ({ ...a, archived: true }));
      v.archived = now();
    }
  });
  await logActivity(id, {
    author: 'claude',
    name: person,
    type: 'note',
    text: `Archived ${plan.length} version(s) (${(total / 1e6).toFixed(0)} MB freed); still with files: ${[...kept].join(', ')}`,
  });
  return { dryRun: false, keep: [...kept], plan, bytes: total };
}

export function findVersion(p, vid) {
  const v = vid ? p.versions.find((x) => x.id === vid) : p.versions.at(-1);
  if (!v) throw error(404, vid ? `Version ${vid} does not exist` : 'The project has no versions');
  return v;
}

export const filePath = (id, file) => path.join(projectDir(id), file.path);

// ---------------------------------------------------------------- notes

export async function listNotes(id) {
  let names = [];
  try {
    names = await fsp.readdir(notesDir(id));
  } catch {
    return [];
  }
  const notes = [];
  for (const name of names) {
    if (!/^n\d+\.json$/.test(name)) continue;
    try {
      notes.push(JSON.parse(await fsp.readFile(path.join(notesDir(id), name), 'utf8')));
    } catch {}
  }
  return notes.sort((a, b) => a.n - b.n);
}

export async function readNote(id, n) {
  const note = await readJSON(notePath(id, n), null);
  if (!note) throw error(404, `Note #${n} does not exist in ${id}`);
  return note;
}

function cleanShapes(shapes) {
  if (!Array.isArray(shapes)) return [];
  return shapes.slice(0, 50).map((f) => {
    const c = { type: String(f.type), color: String(f.color || '#ff3b30') };
    for (const k of ['x', 'y', 'w', 'h', 'x1', 'y1', 'x2', 'y2', 'size', 'thickness']) if (Number.isFinite(f[k])) c[k] = Math.round(f[k] * 10) / 10;
    if (Array.isArray(f.points)) c.points = f.points.filter(Number.isFinite).map((v) => Math.round(v * 10) / 10).slice(0, 4000);
    if (typeof f.text === 'string') c.text = f.text.slice(0, 200);
    return c;
  });
}

export async function createNote(id, data, person = 'Team') {
  const p = await readProject(id);
  const version = data.version ? findVersion(p, data.version) : p.versions.at(-1) || null;
  const type = NOTE_TYPES.includes(data.type) ? data.type : 'change';
  const n = await updateProject(id, (pp) => {
    const n = pp.nextNote || 1;
    pp.nextNote = n + 1;
    return n;
  });
  const fps = version?.files?.[0]?.meta?.fps || null;
  const frame = Number.isInteger(data.frame) ? data.frame : null;
  const frameEnd = Number.isInteger(data.frameEnd) && frame !== null && data.frameEnd > frame ? data.frameEnd : null;
  const note = {
    n,
    version: version?.id || null,
    page: Number.isInteger(data.page) ? data.page : null,
    frame,
    frameEnd,
    fps,
    t: frame !== null && fps ? frame / fps : null,
    tEnd: frameEnd !== null && fps ? frameEnd / fps : null,
    shapes: cleanShapes(data.shapes),
    text: String(data.text || '').slice(0, 4000),
    type,
    state: 'draft',
    thread: [],
    capture: null,
    createdBy: person,
    created: now(),
    updated: now(),
  };
  await withLock(`n:${id}:${n}`, () => writeJSON(notePath(id, n), note));
  return note;
}

export async function updateNote(id, n, mutate) {
  validateId(id);
  return withLock(`n:${id}:${n}`, async () => {
    const note = await readNote(id, n);
    const r = await mutate(note);
    note.updated = now();
    await writeJSON(notePath(id, n), note);
    return r === undefined ? note : r;
  });
}

/** Changes the creator makes from the editor. */
export async function editNote(id, n, changes, person = 'Team') {
  return updateNote(id, n, (note) => {
    if (typeof changes.text === 'string') note.text = changes.text.slice(0, 4000);
    if (NOTE_TYPES.includes(changes.type)) note.type = changes.type;
    if (changes.shapes) note.shapes = cleanShapes(changes.shapes);
    if (changes.message) {
      note.thread.push({ author: 'person', name: person, text: String(changes.message).slice(0, 4000), date: now() });
      if (['question', 'resolved', 'approved', 'in_progress', 'sent'].includes(note.state) && changes.state === undefined) note.state = 'reopened';
    }
    if (changes.state) {
      const allowed = { approved: ['resolved', 'reopened'], reopened: ['resolved', 'approved', 'question', 'in_progress', 'sent'], draft: ['reopened'] };
      if (!allowed[changes.state]?.includes(note.state) && changes.state !== note.state) {
        throw error(400, `Note #${n} cannot go from "${note.state}" to "${changes.state}"`);
      }
      note.state = changes.state;
    }
  });
}

/** Claude's replies (CLI): adds to the thread and changes the state. */
export async function replyToNotes(id, numbers, { text, state, version, author = 'claude' }) {
  if (state && !['in_progress', 'question', 'resolved'].includes(state)) throw error(400, `Invalid state for Claude: ${state}`);
  const done = [];
  for (const n of numbers) {
    done.push(
      await updateNote(id, n, (note) => {
        if (text) note.thread.push({ author, text: String(text).slice(0, 4000), date: now(), ...(version ? { version } : {}) });
        if (state) note.state = state;
        if (state === 'resolved' && version) note.resolvedIn = version;
      }),
    );
  }
  if (state === 'in_progress') await logActivity(id, { author, type: 'work', text: `Claude is working on ${numbers.map((n) => '#' + n).join(', ')}` });
  return done;
}

export async function deleteNote(id, n) {
  return withLock(`n:${id}:${n}`, async () => {
    const note = await readNote(id, n);
    if (note.state !== 'draft') throw error(400, 'Only draft notes can be deleted');
    await fsp.rm(notePath(id, n), { force: true });
    for (const k of ['png', 'jpg', 'zone']) if (note.capture?.[k]) await fsp.rm(path.join(projectDir(id), note.capture[k]), { force: true });
    return note;
  });
}

/** Moves drafts and reopened notes to "sent". A message without notes creates a general note. */
export async function sendNotes(id, { message, person = 'Team' } = {}) {
  const notes = await listNotes(id);
  const ready = notes.filter((nt) => nt.state === 'draft' || nt.state === 'reopened');
  if (message && !ready.length) {
    const general = await createNote(id, { text: message, type: 'change' }, person);
    ready.push(general);
    message = '';
  }
  if (!ready.length) throw error(400, 'There are no notes to send');
  const sent = [];
  for (const nt of ready) {
    sent.push(
      await updateNote(id, nt.n, (note) => {
        note.state = 'sent';
        note.sentAt = now();
      }),
    );
  }
  await logActivity(id, { author: 'person', name: person, type: 'send', text: `${person} sent ${sent.length} note${sent.length === 1 ? '' : 's'} to Claude${message ? `: «${message}»` : ''}` });
  return { notes: sent, message: message || '' };
}

// ---------------------------------------------------------------- activity

export async function logActivity(id, { author = 'claude', name, text, type = 'note', version }) {
  const line = JSON.stringify({ date: now(), author, ...(author === 'person' && name ? { name } : {}), type, text: String(text).slice(0, 500), ...(version ? { version } : {}) });
  await fsp.mkdir(projectDir(id), { recursive: true });
  await fsp.appendFile(activityPath(id), line + '\n');
}

export async function readActivity(id, max = 80) {
  let text = '';
  try {
    text = await fsp.readFile(activityPath(id), 'utf8');
  } catch {
    return [];
  }
  return text
    .trim()
    .split('\n')
    .slice(-max)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

// ---------------------------------------------------------------- project context

const contextPath = (id) => path.join(projectDir(id), 'context.md');

export const CONTEXT_TEMPLATE = `## Goal

## Audience

## Platforms and formats

## Tone and style

## Must have

## Avoid

## References
`;

/** The project brief: Claude receives it with every submission and can update it. */
export async function readContext(id) {
  try {
    return await fsp.readFile(contextPath(id), 'utf8');
  } catch {
    return '';
  }
}

export async function saveContext(id, text, { author = 'person', name = 'Team' } = {}) {
  await readProject(id);
  await writeAtomic(contextPath(id), String(text || '').slice(0, 20000));
  // The editor saves while someone types: one activity line per person every 15 min.
  const [last] = await readActivity(id, 1);
  const recent =
    last?.type === 'context' && last.author === author && (last.name || '') === (author === 'person' ? name : '') && Date.now() - new Date(last.date).getTime() < 15 * 60_000;
  if (!recent) await logActivity(id, { author, name, type: 'context', text: `${who(author, name)} updated the project context` });
}

/** Brand rule documents that exist in the repo (for Claude to read). */
export function brandRules(brand) {
  const candidates = brand ? [path.posix.join('brands', brand, 'BRAND.md'), path.posix.join('brands', brand, 'PROFILE.md')] : [];
  candidates.push('WORKFLOW.md');
  return candidates.filter((r) => {
    try {
      return fs.statSync(path.join(REPO, r)).isFile();
    } catch {
      return false;
    }
  });
}

export function who(author, name) {
  if (author === 'claude') return 'Claude';
  if (author === 'creator') return 'the creator';
  return name || 'Someone from the team';
}

// ---------------------------------------------------------------- summaries

export function countNotes(notes) {
  const c = {};
  for (const nt of notes) c[nt.state] = (c[nt.state] || 0) + 1;
  return c;
}
