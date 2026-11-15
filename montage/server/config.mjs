import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = path.resolve(ROOT, '..');
// The tests point these folders to a temporary directory.
export const PROJECTS = process.env.MONTAGE_PROJECTS || path.join(ROOT, 'projects');
export const STATE = process.env.MONTAGE_STATE || path.join(ROOT, '.state');
export const CACHE = process.env.MONTAGE_CACHE || path.join(ROOT, '.cache');
export const FONTS = path.join(ROOT, 'fonts');
export const WEB_DIST = path.join(ROOT, 'web', 'dist');

// A port few other apps use. If it is taken, the next one is tried (up to 10);
// the chosen one is written to .state/server.json so the CLI can find it.
export const BASE_PORT = Number(process.env.MONTAGE_PORT) || 38420;
export const PORTS = Array.from({ length: 10 }, (_, i) => BASE_PORT + i);
export const HOST = '127.0.0.1';
export const SERVER_FILE = path.join(STATE, 'server.json');

// Size limit of the preview cache (the least used files go first).
export const CACHE_MAX_BYTES = 6 * 1024 ** 3;

function binary(name) {
  for (const dir of ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin']) {
    const file = path.join(dir, name);
    if (fs.existsSync(file)) return file;
  }
  return name;
}

export const FFMPEG = process.env.FFMPEG || binary('ffmpeg');
export const FFPROBE = process.env.FFPROBE || binary('ffprobe');
