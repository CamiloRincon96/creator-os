#!/usr/bin/env node
// Installs Montage on this computer: dependencies, built interface and an app-like shortcut
// (Montage.app on macOS, a shortcut on the Desktop on Windows, a launcher on Linux).
//
//   node montage/install.mjs            install or update
//   node montage/install.mjs --remove   remove the shortcut (does not delete projects)

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(ROOT, '..');
const NODE = process.execPath;
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const remove = process.argv.includes('--remove');

const step = (t) => console.log(`\n▸ ${t}`);
const ok = (t) => console.log(`  ✓ ${t}`);
const warn = (t) => console.log(`  ⚠ ${t}`);
function fail(t) {
  console.error(`  ✗ ${t}`);
  process.exit(1);
}

const launchers = {
  darwin: path.join(os.homedir(), 'Applications', 'Montage.app'),
  win32: path.join(os.homedir(), 'Desktop', 'Montage.cmd'),
  linux: path.join(os.homedir(), '.local', 'share', 'applications', 'montage.desktop'),
};
const launcher = launchers[process.platform] || launchers.linux;

if (remove) {
  fs.rmSync(launcher, { recursive: true, force: true });
  console.log(`Shortcut removed (${launcher}). The projects in montage/projects are untouched.`);
  process.exit(0);
}

console.log('Montage · install');

step('Node');
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 12)) fail(`Node 22.12 or newer is needed (you have ${process.versions.node}).`);
ok(`Node ${process.versions.node} (${NODE})`);

step('ffmpeg');
const find = (bin) => {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { encoding: 'utf8' });
  if (r.status === 0) return r.stdout.split('\n')[0].trim();
  for (const d of ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin']) if (fs.existsSync(path.join(d, bin))) return path.join(d, bin);
  return null;
};
const ffmpeg = find('ffmpeg');
if (ffmpeg && find('ffprobe')) ok(`ffmpeg at ${ffmpeg}`);
else {
  warn('ffmpeg/ffprobe not found: without them there are no previews, captures or export.');
  warn(
    process.platform === 'darwin'
      ? 'Install it with:  brew install ffmpeg'
      : process.platform === 'win32'
        ? 'Install it with:  winget install Gyan.FFmpeg'
        : 'Install it with:  sudo apt install ffmpeg',
  );
}

step('Dependencies');
let r = spawnSync(NPM, ['install', '--no-audit', '--no-fund'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
if (r.status !== 0) fail('npm install failed.');
ok('Dependencies installed');

step('Interface');
r = spawnSync(NPM, ['run', 'build'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'], shell: process.platform === 'win32' });
if (r.status !== 0) fail('The interface did not build (npm run build).');
ok('Interface built');

step('App-like shortcut');
const cli = path.join(ROOT, 'cli.mjs');
const icon = path.join(ROOT, 'web', 'public', 'brand', 'app-icon-1024.png');

if (process.platform === 'darwin') {
  const contents = path.join(launcher, 'Contents');
  fs.rmSync(launcher, { recursive: true, force: true });
  fs.mkdirSync(path.join(contents, 'MacOS'), { recursive: true });
  fs.mkdirSync(path.join(contents, 'Resources'), { recursive: true });
  fs.writeFileSync(
    path.join(contents, 'Info.plist'),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Montage</string>
  <key>CFBundleDisplayName</key><string>Montage</string>
  <key>CFBundleIdentifier</key><string>com.creatoros.montage</string>
  <key>CFBundleExecutable</key><string>montage</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>0.2.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict></plist>
`,
  );
  // The launcher uses absolute paths: it does not depend on the PATH (nvm, Homebrew) of whoever opens it.
  const executable = path.join(contents, 'MacOS', 'montage');
  fs.writeFileSync(executable, `#!/bin/bash\ncd "${REPO}" || exit 1\nexec "${NODE}" "${cli}" open\n`);
  fs.chmodSync(executable, 0o755);
  if (fs.existsSync(icon)) {
    const iconset = path.join(os.tmpdir(), `montage-${Date.now()}.iconset`);
    fs.mkdirSync(iconset);
    for (const [name, side] of [
      ['icon_16x16.png', 16], ['icon_16x16@2x.png', 32], ['icon_32x32.png', 32], ['icon_32x32@2x.png', 64],
      ['icon_128x128.png', 128], ['icon_128x128@2x.png', 256], ['icon_256x256.png', 256], ['icon_256x256@2x.png', 512],
      ['icon_512x512.png', 512], ['icon_512x512@2x.png', 1024],
    ]) {
      spawnSync('sips', ['-z', String(side), String(side), icon, '--out', path.join(iconset, name)], { stdio: 'ignore' });
    }
    const ic = spawnSync('iconutil', ['-c', 'icns', iconset, '-o', path.join(contents, 'Resources', 'AppIcon.icns')]);
    fs.rmSync(iconset, { recursive: true, force: true });
    if (ic.status !== 0) warn('Could not make the icon (iconutil); the app works anyway.');
  }
  spawnSync('touch', [launcher]);
  ok(`Montage.app at ${launcher} (find it in Launchpad or Spotlight and drag it to the Dock)`);
} else if (process.platform === 'win32') {
  fs.writeFileSync(launcher, `@echo off\r\ncd /d "${REPO}"\r\n"${NODE}" "${cli}" open\r\n`);
  ok(`Shortcut on the Desktop: ${launcher}`);
} else {
  fs.mkdirSync(path.dirname(launcher), { recursive: true });
  fs.writeFileSync(
    launcher,
    `[Desktop Entry]\nType=Application\nName=Montage\nComment=Review and editing with Claude\nExec="${NODE}" "${cli}" open\nPath=${REPO}\nIcon=${icon}\nTerminal=false\nCategories=AudioVideo;Video;\n`,
  );
  fs.chmodSync(launcher, 0o755);
  ok(`Launcher at ${launcher}`);
}

console.log(`
Done.
  Open:      the Montage app (or: node montage/cli.mjs open)
  Shut down: power button at the top right in Montage (or: node montage/cli.mjs stop)
  Claude:    in Claude Code, /creator-montage so it listens and /creator-notes to handle notes
`);
