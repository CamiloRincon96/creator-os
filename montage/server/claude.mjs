// Claude listening: `node montage/cli.mjs wait` opens an SSE here and stays blocked
// until the creator clicks "Send to Claude". Each submission is offered to ONE listener only and
// counts as delivered when the CLI confirms (ack); if it does not confirm within 30 s it goes back to pending.

import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { STATE } from './config.mjs';
import { now, writeJSON, readJSON } from './util.mjs';

export const claudeEvents = new EventEmitter();

const SUBMISSIONS_FILE = path.join(STATE, 'submissions.json');
const listeners = new Map(); // id -> { res, since }
let submissions = [];
let next = 1;
const deadlines = new Map(); // token -> timeout

export async function loadSubmissions() {
  const data = await readJSON(SUBMISSIONS_FILE, { next: 1, submissions: [] });
  next = data.next || 1;
  submissions = (data.submissions || []).map((s) => (s.state === 'offered' ? { ...s, state: 'pending', token: undefined, listener: undefined } : s));
  await save();
}

async function save() {
  // Keeps only the last 200 submissions.
  submissions = submissions.slice(-200);
  await writeJSON(SUBMISSIONS_FILE, { next, submissions });
}

export function claudeState() {
  const first = [...listeners.values()].sort((a, b) => a.since - b.since)[0];
  const delivered = submissions.filter((s) => s.state === 'delivered');
  return {
    listening: listeners.size > 0,
    since: first ? new Date(first.since).toISOString() : null,
    pending: submissions.filter((s) => s.state !== 'delivered').length,
    lastDelivered: delivered.at(-1)?.deliveredAt || null,
  };
}

function emitPresence() {
  claudeEvents.emit('presence', claudeState());
}

/**
 * Stop listening (button in the editor) or shutdown: every connected `wait` is told so it
 * ends and Claude does not set up listening again until asked.
 */
export function stopListening(reason, person = '') {
  let n = 0;
  for (const [id, l] of listeners) {
    l.res.write(`event: stopped\ndata: ${JSON.stringify({ reason, person })}\n\n`);
    l.res.end();
    listeners.delete(id);
    n++;
  }
  emitPresence();
  return n;
}

export async function registerSubmission({ project, name, notes, message, from }) {
  const submission = { id: `S${next++}`, date: now(), project, name, notes, message: message || '', from: from || '', state: 'pending' };
  submissions.push(submission);
  await save();
  dispatch();
  return { submission, listening: listeners.size > 0 };
}

/** Offers everything pending to the oldest listener, in a single event. */
function dispatch() {
  if (!listeners.size) return;
  const pending = submissions.filter((s) => s.state === 'pending');
  if (!pending.length) return;
  const [id, listener] = [...listeners.entries()].sort((a, b) => a[1].since - b[1].since)[0];
  const token = crypto.randomBytes(8).toString('hex');
  for (const s of pending) Object.assign(s, { state: 'offered', token, listener: id, offeredAt: now() });
  save().catch(() => {});
  listener.res.write(`event: submission\ndata: ${JSON.stringify({ token, submissions: pending })}\n\n`);
  deadlines.set(
    token,
    setTimeout(() => {
      deadlines.delete(token);
      let returned = 0;
      for (const s of submissions) {
        if (s.token === token && s.state === 'offered') {
          Object.assign(s, { state: 'pending', token: undefined, listener: undefined });
          returned++;
        }
      }
      if (returned) save().then(dispatch).catch(() => {});
    }, 30_000),
  );
}

export async function confirm(token) {
  const t = deadlines.get(token);
  if (t) clearTimeout(t);
  deadlines.delete(token);
  let n = 0;
  for (const s of submissions) {
    if (s.token === token && s.state === 'offered') {
      s.state = 'delivered';
      s.deliveredAt = now();
      n++;
    }
  }
  if (n) await save();
  emitPresence();
  return n;
}

/**
 * GET /api/claude/listen?listener=<id>&take=1
 * If another session is already listening, it answers 409 unless asked to take over.
 */
export function handleListen(req, res) {
  const id = String(req.query.listener || crypto.randomUUID());
  const take = req.query.take === '1';
  const others = [...listeners.keys()].filter((k) => k !== id);
  if (others.length && !take) {
    res.status(409).json({ error: 'another-session', message: 'Another Claude session is already listening to Montage.' });
    return;
  }
  if (take) {
    for (const k of others) {
      const l = listeners.get(k);
      l.res.write(`event: takeover\ndata: {}\n\n`);
      l.res.end();
      listeners.delete(k);
    }
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`retry: 2000\nevent: hello\ndata: ${JSON.stringify({ listener: id })}\n\n`);
  const listener = { res, since: Date.now() };
  listeners.set(id, listener);
  const ping = setInterval(() => res.write(': ping\n\n'), 15_000);
  req.on('close', () => {
    clearInterval(ping);
    if (listeners.get(id) === listener) listeners.delete(id);
    // What was offered to this listener and not confirmed goes back to pending.
    let returned = 0;
    for (const s of submissions) {
      if (s.listener === id && s.state === 'offered') {
        Object.assign(s, { state: 'pending', token: undefined, listener: undefined });
        returned++;
      }
    }
    if (returned) save().catch(() => {});
    emitPresence();
  });
  emitPresence();
  dispatch();
}
