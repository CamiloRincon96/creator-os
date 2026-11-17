import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

export const now = () => new Date().toISOString();

/** Path with `/` (what goes to the browser, to the JSON files and to URLs). No change on macOS and Linux. */
export const toPosix = (file) => String(file).split(path.sep).join('/');

/**
 * Renames. On Windows a file held open by another process (antivirus, indexer, a reader) gives
 * EPERM/EBUSY/EACCES for a moment: retry briefly before giving up.
 */
export async function rename(source, destination) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fsp.rename(source, destination);
    } catch (e) {
      if (process.platform !== 'win32' || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code) || attempt >= 10) throw e;
      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
    }
  }
}

export function hash(text, length = 16) {
  return crypto.createHash('sha1').update(text).digest('hex').slice(0, length);
}

export function slug(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Writes to a temp file in the same directory, syncs and renames. */
export async function writeAtomic(file, content) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  const fh = await fsp.open(tmp, 'w');
  try {
    await fh.writeFile(content);
    await fh.sync();
  } finally {
    await fh.close();
  }
  try {
    await rename(tmp, file);
  } catch (e) {
    await fsp.rm(tmp, { force: true }).catch(() => {});
    throw e;
  }
}

export const writeJSON = (file, data) => writeAtomic(file, JSON.stringify(data, null, 2) + '\n');

export async function readJSON(file, fallback) {
  try {
    return JSON.parse(await fsp.readFile(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw e;
  }
}

export async function exists(file) {
  try {
    await fsp.access(file);
    return true;
  } catch {
    return false;
  }
}

/** In-process locks: the server is the only writer, so serializing per key is enough. */
const queues = new Map();
export function withLock(key, fn) {
  const previous = queues.get(key) || Promise.resolve();
  const current = previous.then(fn, fn);
  const queue = current.catch(() => {});
  queues.set(key, queue);
  queue.then(() => {
    if (queues.get(key) === queue) queues.delete(key);
  });
  return current;
}

/**
 * Clones with clonefile (APFS): the copy takes no extra space. Node does not really clone on
 * macOS (COPYFILE_FICLONE makes a full copy), so we use `cp -c` and, if that fails (another
 * volume), we copy normally. On Linux COPYFILE_FICLONE clones where it can (btrfs, XFS) and
 * copies otherwise; on Windows it copies normally.
 */
export async function clone(source, destination) {
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  if (process.platform === 'darwin') {
    const r = await run('/bin/cp', ['-c', source, destination]);
    if (r.code === 0) return;
  }
  await fsp.copyFile(source, destination, fs.constants.COPYFILE_FICLONE);
}

/**
 * Runs a binary without a shell. `onLine` receives stdout line by line if given.
 * Returns { code, stdout, stderr }.
 */
export function run(cmd, args, { onLine, binary = false, signal } = {}) {
  return new Promise((resolve) => {
    // windowsHide: without it, every ffmpeg opens a console window on Windows.
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], signal, windowsHide: true });
    const output = [];
    let error = '';
    let rest = '';
    child.stdout.on('data', (d) => {
      if (binary) return output.push(d);
      if (onLine) {
        rest += d.toString();
        let i;
        while ((i = rest.indexOf('\n')) >= 0) {
          onLine(rest.slice(0, i).replace(/\r$/, ''));
          rest = rest.slice(i + 1);
        }
      } else output.push(d);
    });
    child.stderr.on('data', (d) => {
      error += d.toString();
      if (error.length > 20000) error = error.slice(-20000);
    });
    child.on('error', (e) => resolve({ code: -1, stdout: '', stderr: String(e) }));
    child.on('close', (code) => {
      const buf = Buffer.concat(output);
      resolve({ code, stdout: binary ? buf : buf.toString(), stderr: error });
    });
  });
}

export async function dirSize(dir) {
  let total = 0;
  let entries = [];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    const file = path.join(dir, e.name);
    if (e.isDirectory()) total += await dirSize(file);
    else {
      try {
        total += (await fsp.stat(file)).size;
      } catch {}
    }
  }
  return total;
}

/** Is `file` inside `base`? */
export function isInside(base, file) {
  const rel = path.relative(base, file);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function ensureDirSync(dir) {
  fs.mkdirSync(dir, { recursive: true });
}
