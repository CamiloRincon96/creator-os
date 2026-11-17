#!/usr/bin/env node
// Installs Montage on this computer: dependencies, built interface and an app-like shortcut
// (Montage.app on macOS, shortcuts on the Desktop and in the Start menu on Windows, a launcher on Linux).
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
const WINDOWS = process.platform === 'win32';
const remove = process.argv.includes('--remove');

// On Windows npm is npm.cmd and Node only runs it through a shell; the (fixed) arguments go in the same string.
const npm = (args, options) => (WINDOWS ? spawnSync(`npm ${args.join(' ')}`, { ...options, shell: true }) : spawnSync('npm', args, options));

const step = (t) => console.log(`\n▸ ${t}`);
const ok = (t) => console.log(`  ✓ ${t}`);
const warn = (t) => console.log(`  ⚠ ${t}`);
function fail(t) {
  console.error(`  ✗ ${t}`);
  process.exit(1);
}

const launchers = {
  darwin: path.join(os.homedir(), 'Applications', 'Montage.app'),
  linux: path.join(os.homedir(), '.local', 'share', 'applications', 'montage.desktop'),
};
// On Windows the shortcuts (Montage.lnk) go in the folders the system reports: see WINDOWS_FOLDERS.
const launcher = launchers[process.platform] || launchers.linux;

/** Runs a PowerShell script without going through command-line quoting (sent as UTF-16, base64). */
function powershell(script) {
  const encoded = Buffer.from(`[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false\n${script}`, 'utf16le').toString('base64');
  return spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { encoding: 'utf8', windowsHide: true });
}
/** PowerShell string literal (single quotes; a quote is written twice). */
const ps = (text) => `'${String(text).replace(/'/g, "''")}'`;
// The real Desktop (OneDrive can move it out of %USERPROFILE%\Desktop) and the Start menu.
const WINDOWS_FOLDERS = "@([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))";
// Earlier installs left a Montage.cmd in %USERPROFILE%\Desktop.
const OLD_CMD = path.join(os.homedir(), 'Desktop', 'Montage.cmd');
function removeOldCmd() {
  try {
    if (fs.readFileSync(OLD_CMD, 'utf8').includes('cli.mjs')) fs.rmSync(OLD_CMD);
  } catch {}
}

if (remove) {
  if (WINDOWS) {
    const r = powershell(`foreach ($d in ${WINDOWS_FOLDERS}) {
  if (-not $d) { continue }
  $f = Join-Path $d 'Montage.lnk'
  if (Test-Path -LiteralPath $f) { Remove-Item -LiteralPath $f -Force; Write-Output $f }
}`);
    removeOldCmd();
    const removed = String(r.stdout || '').split(/\r?\n/).filter(Boolean);
    console.log(`Shortcuts removed${removed.length ? ` (${removed.join(', ')})` : ''}. The projects in montage/projects are untouched.`);
  } else {
    fs.rmSync(launcher, { recursive: true, force: true });
    console.log(`Shortcut removed (${launcher}). The projects in montage/projects are untouched.`);
  }
  process.exit(0);
}

/** .ico for the Windows shortcut: the app icon at 256/48/32/16 px, each stored as PNG (Vista and later). */
async function icoFromPng(png, destination) {
  const { createCanvas, loadImage } = await import('@napi-rs/canvas');
  const img = await loadImage(fs.readFileSync(png));
  const images = [256, 48, 32, 16].map((side) => {
    const c = createCanvas(side, side);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, side, side);
    return { side, data: c.toBuffer('image/png') };
  });
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ side, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(side % 256, e); // 0 = 256
    header.writeUInt8(side % 256, e + 1);
    header.writeUInt16LE(1, e + 4); // planes
    header.writeUInt16LE(32, e + 6); // bits per pixel
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, Buffer.concat([header, ...images.map((x) => x.data)]));
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
      : WINDOWS
        ? 'Install it with:  winget install Gyan.FFmpeg  (then open a new terminal so it is found)'
        : 'Install it with:  sudo apt install ffmpeg',
  );
}

step('Dependencies');
let r = npm(['install', '--no-audit', '--no-fund'], { cwd: ROOT, stdio: 'inherit' });
if (r.status !== 0) fail('npm install failed.');
ok('Dependencies installed');

step('Interface');
r = npm(['run', 'build'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
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
} else if (WINDOWS) {
  // .lnk shortcuts (with icon) that run node with the CLI. The console starts minimized and closes
  // by itself as soon as Montage is open; the server keeps running without a window.
  const ico = path.join(ROOT, '.state', 'montage.ico');
  let withIcon = false;
  if (fs.existsSync(icon)) {
    try {
      await icoFromPng(icon, ico);
      withIcon = true;
    } catch (e) {
      warn(`Could not make the icon (${e.message}); the shortcut works anyway.`);
    }
  }
  const r = powershell(`$s = New-Object -ComObject WScript.Shell
foreach ($d in ${WINDOWS_FOLDERS}) {
  if (-not $d) { continue }
  try {
    $f = Join-Path $d 'Montage.lnk'
    $l = $s.CreateShortcut($f)
    $l.TargetPath = ${ps(NODE)}
    $l.Arguments = ${ps(`"${cli}" open`)}
    $l.WorkingDirectory = ${ps(REPO)}
    $l.WindowStyle = 7
    $l.Description = 'Montage'
    ${withIcon ? `$l.IconLocation = ${ps(`${ico},0`)}` : ''}
    $l.Save()
    Write-Output $f
  } catch { [Console]::Error.WriteLine($_.Exception.Message) }
}`);
  const made = String(r.stdout || '').split(/\r?\n/).filter(Boolean);
  if (made.length) {
    removeOldCmd();
    for (const f of made) ok(`Shortcut: ${f}`);
  } else warn(`Could not create the shortcut (${String(r.stderr || r.error?.message || 'PowerShell failed').trim().slice(0, 300)}). Open Montage with:  node montage/cli.mjs open`);
} else {
  fs.mkdirSync(path.dirname(launcher), { recursive: true });
  fs.writeFileSync(
    launcher,
    `[Desktop Entry]\nType=Application\nName=Montage\nComment=Review and editing with Claude\nExec="${NODE}" "${cli}" open\nPath=${REPO}\nIcon=${icon}\nTerminal=false\nCategories=AudioVideo;Video;\n`,
  );
  fs.chmodSync(launcher, 0o755);
  ok(`Launcher at ${launcher}`);
}

const howToOpen = process.platform === 'darwin' ? 'the Montage app' : WINDOWS ? 'the Montage shortcut on the Desktop or in the Start menu' : 'Montage in the applications menu';
console.log(`
Done.
  Open:      ${howToOpen} (or: node montage/cli.mjs open)
  Shut down: power button at the top right in Montage (or: node montage/cli.mjs stop)
  Claude:    in Claude Code, /creator-montage so it listens and /creator-notes to handle notes
`);
