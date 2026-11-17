#!/usr/bin/env node
// Montage CLI (made for Claude). Talks to the server over HTTP and starts it if it is not running.
// Usage: node montage/cli.mjs <command> [...]   ·   node montage/cli.mjs help

import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTime, readableTime } from './shared/time.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(ROOT, '..');
const STATE = process.env.MONTAGE_STATE || path.join(ROOT, '.state'); // tests point this at a temporary folder
const PROJECTS = process.env.MONTAGE_PROJECTS || path.join(ROOT, 'projects');
const SERVER_FILE = path.join(STATE, 'server.json');
const BASE_PORT = Number(process.env.MONTAGE_PORT) || 38420;
const CLI = 'node montage/cli.mjs';
const WINDOWS = process.platform === 'win32';

// On Windows npm is npm.cmd and Node only runs it through a shell; the (fixed) arguments go in the same string.
const npm = (args, options) => (WINDOWS ? spawnSync(`npm ${args.join(' ')}`, { ...options, shell: true }) : spawnSync('npm', args, options));

/** Port of the server that is running (it writes it on startup), or the default one. */
function knownPort() {
  try {
    const s = JSON.parse(fs.readFileSync(SERVER_FILE, 'utf8'));
    process.kill(s.pid, 0);
    return s.port;
  } catch {
    return null;
  }
}
let BASE_URL = `http://localhost:${knownPort() || BASE_PORT}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv) {
  const pos = [];
  const op = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split(/=(.*)/s);
      if (v !== undefined) op[k] = v;
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) op[k] = argv[++i];
      else op[k] = true;
    } else pos.push(a);
  }
  return { pos, op };
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

// ---------------------------------------------------------------- server

async function health() {
  const p = knownPort();
  if (p) BASE_URL = `http://localhost:${p}`;
  try {
    const r = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(800) });
    const j = await r.json();
    return j.app === 'montage' ? j : null;
  } catch {
    return null;
  }
}

/** Chrome or, if missing, Edge (it ships with Windows 10 and 11), in the folders where they get installed. */
function windowsBrowser() {
  const e = process.env;
  const candidates = [
    [e.ProgramFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'],
    [e['ProgramFiles(x86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'],
    [e.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'],
    [e['ProgramFiles(x86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'],
    [e.ProgramFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'],
  ];
  for (const [base, ...rest] of candidates) {
    if (!base) continue;
    const file = path.join(base, ...rest);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

/** Opens Montage as an app window (Chrome without tabs); without Chrome, the default browser. */
function openBrowser(url) {
  if (process.platform === 'darwin') {
    if (fs.existsSync('/Applications/Google Chrome.app')) spawnSync('open', ['-na', 'Google Chrome', '--args', `--app=${url}`]);
    else spawnSync('open', [url]);
  } else if (WINDOWS) {
    // No `start chrome`: if Chrome is missing, Windows shows an error dialog instead of returning a code.
    const exe = windowsBrowser();
    if (exe) spawn(exe, [`--app=${url}`], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
    else spawnSync('cmd', ['/c', 'start', '', url], { windowsHide: true });
  } else {
    // No waiting: if Chrome was not open, the process lives as long as the window is open.
    const chrome = spawn('google-chrome', [`--app=${url}`], { detached: true, stdio: 'ignore' });
    chrome.on('error', () => spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref());
    chrome.unref();
  }
}

function maxMtime(dir) {
  let max = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, e.name);
    max = Math.max(max, e.isDirectory() ? maxMtime(file) : fs.statSync(file).mtimeMs);
  }
  return max;
}

/** Builds the interface if it is missing or if the code is newer than the build. */
function ensureInterface() {
  const index = path.join(ROOT, 'web', 'dist', 'index.html');
  const sources = [path.join(ROOT, 'web', 'src'), path.join(ROOT, 'shared')];
  const latest = Math.max(...sources.map((d) => (fs.existsSync(d) ? maxMtime(d) : 0)));
  if (fs.existsSync(index) && fs.statSync(index).mtimeMs >= latest) return;
  if (!fs.existsSync(path.join(ROOT, 'node_modules'))) {
    console.error('Installing Montage dependencies…');
    npm(['install'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  }
  console.error('Building the interface…');
  const r = npm(['run', 'build'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
  if (r.status !== 0) {
    const detail = String(r.stderr || '').split('\n').filter((l) => /error|Error/.test(l)).slice(0, 3).join('\n');
    // With a previous build the server still serves; better that than leaving it down.
    if (fs.existsSync(index)) console.error(`⚠ The new interface did not build; the previous one stays.\n${detail}`);
    else fail(`The interface did not build (npm run build).\n${detail}`);
  }
}

async function ensureServer() {
  if (await health()) return;
  ensureInterface();
  fs.mkdirSync(STATE, { recursive: true });
  const log = fs.openSync(path.join(STATE, 'server.log'), 'a');
  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'index.mjs')], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', log, log],
    env: process.env,
    windowsHide: true, // on Windows, no console window for the server
  });
  child.unref();
  for (let i = 0; i < 60; i++) {
    await sleep(200);
    if (await health()) return;
  }
  fail(`The server did not start. Check ${path.join(STATE, 'server.log')}`);
}

async function request(method, route, body) {
  await ensureServer();
  const r = await fetch(`${BASE_URL}/api${route}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) fail(data.error || `HTTP ${r.status}`);
  return data;
}

async function stopServer() {
  const s = await health();
  if (!s) return false;
  process.kill(s.pid, 'SIGTERM');
  for (let i = 0; i < 25 && (await health()); i++) await sleep(200);
  // On Windows SIGTERM ends the process without running its cleanup: remove its server.json here.
  if (WINDOWS) {
    try {
      if (JSON.parse(fs.readFileSync(SERVER_FILE, 'utf8')).pid === s.pid) fs.rmSync(SERVER_FILE, { force: true });
    } catch {}
  }
  return true;
}

// ---------------------------------------------------------------- formatting

const STATE_LABEL = {
  draft: 'draft',
  sent: 'sent',
  in_progress: 'in progress',
  question: 'question from Claude',
  resolved: 'resolved',
  approved: 'approved',
  reopened: 'reopened',
};

function ago(date) {
  const s = (Date.now() - new Date(date).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

function projectFormat(p) {
  const f = p.format;
  return [p.brand, p.type, f?.width ? `${f.width}×${f.height}${f.fps ? ` @${f.fps}` : ''}` : null].filter(Boolean).join(' · ');
}

function noteText(nt) {
  const l = [];
  let when = 'the whole piece';
  if (nt.timecode) {
    when = `${nt.timecode} (${nt.t.toFixed(2)} s, frame ${nt.frame})`;
    if (nt.timecodeEnd) when += ` → ${nt.timecodeEnd} (${nt.tEnd.toFixed(2)} s, frame ${nt.frameEnd})`;
  }
  if (nt.page !== null && nt.page !== undefined) when = `page ${nt.page + 1}` + (nt.timecode ? ` · ${when}` : '');
  l.push(`### Note #${nt.n} · ${nt.type} · ${nt.version || 'no version'} · ${when} · [${STATE_LABEL[nt.state] || nt.state}]`);
  for (const line of (nt.text || '(no text)').split('\n')) l.push(`> ${line}`);
  if (nt.shapesText?.length) l.push(`- Drawing${nt.zone ? ` (${nt.zone})` : ''}: ${nt.shapesText.join('; ')}  — px of the original frame`);
  const v = nt.versionInfo;
  if (v) {
    const m = v.meta || {};
    const size = m.width ? ` · ${m.width}×${m.height}${m.fps ? ` @${m.fps}` : ''}${m.duration ? ` · ${readableTime(m.duration)} s` : ''}` : '';
    l.push(`- File ${v.id}: ${v.file}${size}`);
    if (v.source) l.push(`- Source render: ${v.source}`);
    if (v.origin) l.push(`- How ${v.id} was produced: ${v.origin}`);
  }
  if (nt.captureAbs) {
    l.push(`- Capture (read it with Read): ${nt.captureAbs.jpg}${nt.captureAbs.zone ? ` · zoomed zone: ${nt.captureAbs.zone}` : ''}`);
  } else if (nt.captureError) l.push(`- Capture: failed (${nt.captureError})`);
  if (nt.thread?.length) {
    l.push('- Thread:');
    for (const m of nt.thread) l.push(`  - ${m.author === 'claude' ? 'Claude' : m.name || 'the creator'} (${ago(m.date)}): ${m.text.replace(/\n/g, ' ')}`);
  }
  return l.join('\n');
}

function pendingText(data) {
  const l = [];
  let total = 0;
  for (const g of data.projects) total += g.notes.length;
  l.push(`# Montage · ${total} note${total === 1 ? '' : 's'}`);
  for (const g of data.projects) {
    const p = g.project;
    l.push('', `## ${p.name} — \`${p.id}\` (${projectFormat(p)})`);
    if (p.origin) l.push(`Project origin: ${p.origin}`);
    l.push(`Last version: ${p.last || '—'} · Final: ${p.final || '—'} · Folder: ${p.dir}`);
    if (p.rules?.length) l.push(`Brand rules (read them if you do not have them in mind): ${p.rules.join(', ')}`);
    if (p.context?.trim()) {
      const lines = p.context.trim().split(/\r?\n/);
      l.push('', '**Project context:**', ...lines.slice(0, 60), ...(lines.length > 60 ? [`… (full: ${CLI} context ${p.id})`] : []));
    }
    for (const nt of g.notes) l.push('', noteText(nt));
  }
  return l.join('\n');
}

const STEPS = (ids) => `
## How to continue
1. Read the captures with Read (and \`${CLI} view <project> --t <s>\` or \`--sheet 12\` if you need more frames).
2. Mark your plan on each note: \`${CLI} reply <project> <n,n> "Plan: …" --state in_progress\`.
   If something is ambiguous or will spend Higgsfield credits: \`--state question\` with the question, and go on with the rest.
3. Make the changes (AE / render.mjs / Higgsfield / ElevenLabs / ffmpeg) and render to a new file.
4. Check with \`${CLI} view\` and publish: \`${CLI} publish <project> <file> --note "what changed" --resolves <n,n>\`.
5. If you want per-note detail: \`${CLI} reply <project> <n> "What I did" --state resolved --version vN\`.
6. Never mark FINAL or post to social media: the creator decides that.
7. When you are done, listen again: \`${CLI} wait\` in the background (run_in_background).${ids.length ? `\nProjects in this submission: ${ids.join(', ')}` : ''}`;

// ---------------------------------------------------------------- commands

const COMMANDS = {
  async help() {
    console.log(`Montage — CLI to work with the editor (${BASE_URL})

  status                                  projects, notes and whether Claude is listening
  open [project]                          starts the server and opens Montage (app window)
  stop                                    shuts Montage down (and Claude listening)
  context <project> [--set "…" | --file f.md]   reads or replaces the project brief
  history <project>                       versions, notes and activity of the project
  server [--stop | --restart]             starts / stops the server
  new <id> --name "…" --brand <b> --type video|image|carousel [--origin "…"]
  publish <project> <file…> [--note "…"] [--resolves 4,5] [--origin "…"] [--markers "0:Hook,2.5:Logo"] [--author creator] [--date file|ISO]
      An AI's video needs its review first (production/tools/review.py) with "What I saw" written;
      --skip-review "why" skips it and leaves the why in the note.
  pending [--project id] [--all]          notes sent by the creator (with capture paths)
  note <project> <n>                      detail of one note
  view <project> [--v vN] [--t 1.2,4.4 | --frames 30,132 | --sheet 12] [--page N]
  reply <project> <n[,n]> "text" [--state in_progress|question|resolved] [--version vN]
  activity <project> "text"               status line visible in the editor
  wait [--take]                           blocks until the creator clicks "Send to Claude"
  timeline <project>                      validates montage/projects/<id>/timeline.json (video editor)
  export <project> [--note "…"]           renders timeline.json with ffmpeg and publishes it as a version
  clear-cache                             deletes previews (they are made again)
  archive <project> [--keep v3,v5] [--yes]   when the piece is done: deletes the files of the versions that are not the FINAL
                                          (or the ones in --keep); notes and history stay. Without --yes it only says what it would delete

Timeline (video editor): montage/projects/<id>/timeline.json. Times in seconds, positions in px.
  Clips: video {path, start, duration, sourceIn, speed, volume, opacity, transform{scale,x,y,rotation,fit}},
  audio {path, start, duration, sourceIn, speed, volume}, text/image {start, duration, layer{…}}.
  Edit it, raise "rev" by 1 and the open editor updates on its own.`);
  },

  async server({ op }) {
    if (op.stop || op.restart) {
      const wasRunning = await stopServer();
      if (op.stop) return console.log(wasRunning ? 'Server stopped.' : 'The server was not running.');
    }
    await ensureServer();
    const s = await health();
    console.log(`Montage at ${BASE_URL} (pid ${s.pid})`);
  },

  async open({ pos }) {
    await ensureServer();
    const url = pos[0] ? `${BASE_URL}/#/p/${pos[0]}` : BASE_URL;
    openBrowser(url);
    console.log(`Opened: ${url}`);
  },

  /** Shuts the server down (and with it, Claude listening). */
  async stop() {
    if (!(await health())) return console.log('Montage was already off.');
    await fetch(`${BASE_URL}/api/shutdown`, { method: 'POST' }).catch(() => {});
    console.log('Montage shut down.');
  },

  /** Project context (brief): with no options it prints it; with --set or --file it replaces it. */
  async context({ pos, op }) {
    const project = pos[0];
    if (!project) fail('Usage: context <project> [--set "text" | --file path.md]');
    if (op.set || op.file) {
      const text = op.file ? fs.readFileSync(path.resolve(process.cwd(), op.file), 'utf8') : String(op.set);
      await request('PUT', `/projects/${project}/context`, { text, author: 'claude' });
      return console.log(`Context of ${project} updated (${text.length} characters).`);
    }
    const d = await request('GET', `/projects/${project}/context`);
    console.log(d.text?.trim() ? d.text : `(no context yet; suggested template)\n\n${d.template}`);
  },

  /** Project history: versions, what each one resolved, notes and recent activity. */
  async history({ pos }) {
    const project = pos[0];
    if (!project) fail('Usage: history <project>');
    const d = await request('GET', `/projects/${project}/history`);
    const p = d.project;
    const l = [`# History · ${p.name} (\`${p.id}\`)${p.final ? ` · FINAL ${p.final}` : ''}`];
    if (p.origin) l.push(`Origin: ${p.origin}`);
    if (d.rules?.length) l.push(`Brand rules: ${d.rules.join(', ')}`);
    if (d.context?.trim()) l.push('', '## Context', d.context.trim());
    l.push('', '## Versions');
    for (const v of [...d.versions].reverse()) {
      l.push(`- ${v.id} · ${v.author === 'claude' ? 'Claude' : v.name || 'the creator'} · ${ago(v.created)}${v.state !== 'review' ? ` · ${v.state.toUpperCase()}` : ''}${v.note ? ` — ${v.note}` : ''}${v.resolves?.length ? ` (resolved ${v.resolves.map((n) => '#' + n).join(' ')})` : ''}`);
      if (v.origin) l.push(`  origin: ${v.origin}`);
    }
    l.push('', '## Notes');
    for (const n of d.notes) l.push(`- #${n.n} [${STATE_LABEL[n.state] || n.state}] ${n.version || ''}${n.t !== null ? ` ${n.t.toFixed(2)} s` : ''} · ${n.type}: ${(n.text || '').replace(/\n/g, ' ').slice(0, 140)}${n.resolvedIn ? ` → ${n.resolvedIn}` : ''}`);
    l.push('', '## Recent activity');
    for (const a of d.activity.slice(0, 12)) l.push(`- ${ago(a.date)}: ${a.text}`);
    console.log(l.join('\n'));
  },

  async status() {
    const d = await request('GET', '/state');
    const c = d.claude;
    console.log(`Montage at ${BASE_URL} · Claude ${c.listening ? 'listening' : 'is not listening'}${c.pending ? ` · ${c.pending} submission(s) not delivered` : ''}`);
    if (!d.projects.length) return console.log('No projects yet.');
    for (const p of d.projects) {
      const n = p.notes;
      const parts = [
        n.sent && `${n.sent} sent`,
        n.in_progress && `${n.in_progress} in progress`,
        n.question && `${n.question} with a question`,
        n.resolved && `${n.resolved} to verify`,
        n.draft && `${n.draft} draft(s)`,
      ].filter(Boolean);
      console.log(`- ${p.id} · ${p.name} · ${p.last?.id || 'no versions'}${p.final ? ` · FINAL ${p.final}` : ''}${parts.length ? ` · ${parts.join(', ')}` : ''}`);
    }
  },

  async new({ pos, op }) {
    const id = pos[0];
    if (!id || !op.name) fail('Usage: new <id> --name "…" --brand <b> --type video|image|carousel');
    let format;
    if (op.format) {
      const m = /^(\d+)x(\d+)(?:@([\d.]+))?$/.exec(op.format);
      if (!m) fail('--format must be WIDTHxHEIGHT@FPS, e.g. 1080x1920@30');
      format = { width: +m[1], height: +m[2], fps: m[3] ? +m[3] : null };
    }
    const p = await request('POST', '/projects', {
      id,
      name: op.name,
      brand: op.brand || '',
      type: op.type || 'video',
      origin: op.origin || '',
      format,
      delivery: op.delivery ? { folder: op.delivery } : undefined,
    });
    console.log(`Project created: ${p.id} (${BASE_URL}/#/p/${p.id})`);
  },

  async publish({ pos, op }) {
    const [project, ...files] = pos;
    if (!project || !files.length) fail('Usage: publish <project> <file…> [--note "…"] [--resolves 4,5]');
    const paths = files.map((a) => path.resolve(process.cwd(), a));
    for (const r of paths) if (!fs.existsSync(r)) fail(`${r} does not exist`);
    // Mandatory review: an AI's video isn't published without review.py and without "What I saw" written.
    const byAI = !op.author || op.author === 'claude';
    let note = op.note || '';
    if (byAI && op['skip-review']) note = `${note}${note ? ' · ' : ''}(published without review: ${op['skip-review']})`;
    if (byAI && !op['skip-review']) {
      for (const r of paths.filter((x) => /\.(mp4|mov|m4v|webm)$/i.test(x))) {
        const report = path.join(path.dirname(r), path.basename(r).replace(/\.[^.]+$/, '') + '-review', 'REVIEW.md');
        const run = `python3 production/tools/review.py "${path.relative(process.cwd(), r)}"`;
        if (!fs.existsSync(report) || fs.statSync(report).mtimeMs < fs.statSync(r).mtimeMs)
          fail(`${path.basename(r)} hasn't been reviewed (or it changed after the review).\n  1. ${run}\n  2. Look at every image it leaves and read the report.\n  3. Write in "## What I saw" what you reviewed, what you found and what you fixed.`);
        const seen = (fs.readFileSync(report, 'utf8').split('## What I saw')[1] || '').replace(/<!--[\s\S]*?-->/g, '').trim();
        if (!seen) fail(`The review of ${path.basename(r)} has no "## What I saw" written: ${report}`);
      }
    }
    const markers = op.markers
      ? String(op.markers)
          .split(',')
          .map((pair) => {
            const i = pair.lastIndexOf(':');
            return { t: parseTime(pair.slice(0, i)), text: pair.slice(i + 1).trim() };
          })
      : [];
    const v = await request('POST', `/projects/${project}/versions`, {
      paths,
      note,
      origin: op.origin || '',
      resolves: op.resolves || '',
      markers,
      author: !op.author || op.author === 'claude' ? 'claude' : 'person',
      name: op.author && op.author !== 'claude' ? String(op.author) : undefined,
      created: op.date === 'file' ? fs.statSync(paths[0]).mtime.toISOString() : op.date || undefined,
    });
    console.log(`Published ${v.id} in ${project} (${v.files.length} file${v.files.length === 1 ? '' : 's'}, cloned with no extra space).`);
    if (v.resolves.length) console.log(`Notes marked as resolved in ${v.id}: ${v.resolves.map((n) => '#' + n).join(', ')}`);
    console.log(`View: ${BASE_URL}/#/p/${project}`);
  },

  async pending({ op }) {
    const states = op.all ? 'sent,in_progress,question,reopened' : 'sent';
    const q = new URLSearchParams({ states, ...(op.project ? { project: op.project } : {}) });
    const d = await request('GET', `/pending?${q}`);
    if (!d.projects.length) return console.log(op.all ? 'There are no open notes.' : 'There are no sent notes pending.');
    console.log(pendingText(d));
    console.log(STEPS(d.projects.map((g) => g.project.id)));
  },

  async note({ pos }) {
    const [project, n] = pos;
    if (!project || !n) fail('Usage: note <project> <n>');
    const q = new URLSearchParams({ states: 'draft,sent,in_progress,question,resolved,approved,reopened', project });
    const d = await request('GET', `/pending?${q}`);
    const nt = d.projects[0]?.notes.find((x) => x.n === Number(String(n).replace('#', '')));
    if (!nt) fail(`Note #${n} does not exist in ${project}`);
    console.log(noteText(nt));
  },

  async view({ pos, op }) {
    const project = pos[0];
    if (!project) fail('Usage: view <project> [--v vN] [--t 1.2,4.4 | --frames 30,132 | --sheet 12]');
    const d = await request('POST', '/frames', {
      project,
      version: op.v || op.version,
      times: op.t,
      frames: op.frames,
      sheet: op.sheet === true ? 12 : op.sheet,
      page: op.page ? Number(op.page) - 1 : 0,
    });
    if (d.sheet) console.log(`Contact sheet (read it with Read): ${d.sheet}\nFrames: ${d.frames.join(', ')}`);
    else for (const r of d.paths) console.log(r);
  },

  async reply({ pos, op }) {
    const [project, numbers, ...rest] = pos;
    const text = rest.join(' ');
    if (!project || !numbers || (!text && !op.state)) fail('Usage: reply <project> <n[,n]> "text" [--state in_progress|question|resolved] [--version vN]');
    const notes = await request('POST', `/projects/${project}/reply`, { notes: numbers, text, state: op.state, version: op.version });
    console.log(`Replied on ${notes.map((n) => `#${n.n} (${STATE_LABEL[n.state]})`).join(', ')}.`);
  },

  async activity({ pos }) {
    const [project, ...rest] = pos;
    if (!project || !rest.length) fail('Usage: activity <project> "text"');
    await request('POST', `/projects/${project}/activity`, { text: rest.join(' ') });
    console.log('Done.');
  },

  /** Exports timeline.json with ffmpeg and publishes it as a version (waits until it finishes). */
  async export({ pos, op }) {
    const project = pos[0];
    if (!project) fail('Usage: export <project> [--note "…"]');
    await ensureServer();
    const r = await fetch(`${BASE_URL}/api/projects/${project}/export`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ note: op.note || '', author: 'claude' }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) fail(d.error || `HTTP ${r.status}`);
    console.error(`Exporting ${readableTime(d.duration, 1)} s…`);
    for (;;) {
      await sleep(700);
      const t = await request('GET', `/jobs/${d.job}`);
      if (t.error) fail(`The export failed: ${t.error}`);
      if (t.done) {
        console.log(`Exported and published as ${t.version} in ${project}. View: ${BASE_URL}/#/p/${project}`);
        return;
      }
    }
  },

  /** Checks timeline.json (structure, media and rasterized texts) without exporting. */
  async timeline({ pos }) {
    const project = pos[0];
    if (!project) fail('Usage: timeline <project>');
    const v = await request('GET', `/projects/${project}/timeline/validate`);
    if (v.ok) return console.log(`timeline.json (rev ${v.rev}) ready to export.`);
    for (const p of v.problems) console.log(`✗ ${p}`);
    if (v.missing?.length) console.log(`✗ ${v.missing.length} rasterized text(s)/logo(s) missing: open the video editor (node montage/cli.mjs open ${project}) and they are made on their own.`);
  },

  async archive({ pos, op }) {
    const project = pos[0];
    if (!project) throw new Error('Usage: archive <project> [--keep v3,v5] [--yes]');
    const keep = op.keep ? String(op.keep).split(',').map((x) => x.trim()).filter(Boolean) : [];
    const r = await request('POST', `/projects/${project}/archive`, { keep, dryRun: !op.yes });
    const mb = (b) => `${(b / 1e6).toFixed(0)} MB`;
    if (!r.plan.length) return console.log(`Nothing to archive: only ${r.keep.join(', ')} still have files.`);
    console.log(`${r.dryRun ? 'Would delete' : 'Deleted'} the files of ${r.plan.length} version(s), ${mb(r.bytes)}; still with files: ${r.keep.join(', ')}.`);
    for (const x of r.plan) console.log(`  ${x.version}: ${x.files} file(s), ${mb(x.bytes)}`);
    if (r.dryRun) console.log('Nothing was deleted. To really delete (cannot be undone): add --yes');
  },

  async 'clear-cache'() {
    const r = await request('POST', '/cache/clear');
    console.log(`Cache cleared: ${r.deleted} media item(s) deleted.`);
  },

  /**
   * Stays listening (SSE) until a submission arrives. Prints the full detail so that
   * Claude can work even if the context was compacted, confirms and exits.
   */
  async wait({ op }) {
    const listener = crypto.randomUUID();
    let announced = false;
    let downSince = null;
    await ensureServer();
    for (;;) {
      // If the server goes down (or was shut down) it is not started again from here.
      if (!(await health())) {
        downSince ??= Date.now();
        if (Date.now() - downSince > 90_000) {
          console.log('Montage is off; I stopped listening. To resume: /creator-montage');
          return;
        }
        await sleep(2000);
        continue;
      }
      downSince = null;
      let response;
      try {
        response = await fetch(`${BASE_URL}/api/claude/listen?listener=${listener}${op.take ? '&take=1' : ''}`, { headers: { accept: 'text/event-stream' } });
      } catch {
        await sleep(2000);
        continue;
      }
      if (response.status === 409) {
        console.log('Another Claude session is already listening to Montage; no need to set it up again. (Use --take to take over.)');
        return;
      }
      if (!response.ok) {
        await sleep(2000);
        continue;
      }
      if (!announced) {
        console.error(`Listening to Montage at ${BASE_URL}…`);
        announced = true;
      }
      const event = await readSubmission(response);
      if (event === 'takeover') {
        console.log('Another session took over listening to Montage. This one stops listening.');
        return;
      }
      if (event && typeof event === 'object' && 'stopped' in event) {
        console.log(
          event.stopped === 'shutdown'
            ? 'Montage was shut down from the editor. I stopped listening; do not set up `wait` again until you are asked to (/creator-montage).'
            : `${event.person || 'The team'} asked to stop listening from the editor. Do not set up \`wait\` again until you are asked to (/creator-montage).`,
        );
        return;
      }
      if (!event) {
        await sleep(1500);
        continue;
      }
      const ids = [...new Set(event.submissions.map((s) => s.project))];
      const header = event.submissions
        .map((s) => `- ${s.id} · ${s.name} (\`${s.project}\`) · notes ${s.notes.map((n) => '#' + n).join(', ')}${s.message ? ` · message: «${s.message}»` : ''}`)
        .join('\n');
      const who = [...new Set(event.submissions.map((s) => s.from).filter(Boolean))].join(' and ') || 'the creator';
      const parts = [`# 📨 ${who} sent feedback from Montage\n${header}`];
      for (const id of ids) {
        const q = new URLSearchParams({ states: 'sent', project: id });
        const d = await request('GET', `/pending?${q}`);
        if (d.projects.length) parts.push(pendingText(d));
      }
      parts.push(STEPS(ids));
      console.log(parts.join('\n\n'));
      await request('POST', '/claude/ack', { token: event.token });
      process.exit(0);
    }
  },

  /** For the UserPromptSubmit hook: warns if there are sent notes nobody handled. Reads the disk, it is fast. */
  async notice() {
    let total = 0;
    const byProject = [];
    try {
      for (const id of fs.readdirSync(PROJECTS)) {
        const dir = path.join(PROJECTS, id, 'notes');
        if (!fs.existsSync(dir)) continue;
        let n = 0;
        for (const f of fs.readdirSync(dir)) {
          if (!f.endsWith('.json')) continue;
          try {
            if (JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).state === 'sent') n++;
          } catch {}
        }
        if (n) byProject.push(`${id} (${n})`);
        total += n;
      }
    } catch {
      return;
    }
    if (!total) return;
    const text = `Montage: the creator has ${total} sent note${total === 1 ? '' : 's'} not handled yet in ${byProject.join(', ')}. If you are not working on them already, handle them with /creator-notes (or \`${CLI} pending\`).`;
    console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: text } }));
  },
};

/** Reads the SSE until a `submission` event (returns {token, submissions}), `takeover` or the end of the connection (null). */
async function readSubmission(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return null;
      buf += decoder.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i);
        buf = buf.slice(i + 2);
        let name = 'message';
        let data = '';
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) name = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        // The connection stays open until confirming: if it closed earlier, the server
        // would put the submission back to pending and it would arrive twice.
        if (name === 'submission') return JSON.parse(data);
        if (name === 'takeover') return 'takeover';
        if (name === 'stopped') {
          const d = data ? JSON.parse(data) : {};
          return { stopped: d.reason || 'requested', person: d.person || '' };
        }
      }
    }
  } catch {
    return null;
  }
}

const [command = 'help', ...rest] = process.argv.slice(2);
const fn = COMMANDS[command];
if (!fn) fail(`Unknown command: ${command}. Use "${CLI} help".`);
await fn(parseArgs(rest));
