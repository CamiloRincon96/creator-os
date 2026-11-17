#!/usr/bin/env python3
"""Gets a computer ready for the reels workflow (/creator-reel). Claude runs it when /creator-reel starts; you can also run it by hand.

    python3 production/install.py --check            # only checks, installs nothing
    python3 production/install.py                    # installs what needs no permission
    python3 production/install.py --with-whisper     # also downloads the Whisper model (2.9 GB)

On Windows you type `python` instead of `python3`. It works the same on macOS, Windows and Linux.

Installed without asking (everything stays inside the repo or in the user's Claude skills, and can be deleted):
  - production/.venv with the Python libraries (requirements.txt)
  - the voice cleanup model (rnnoise, 300 KB) in production/models/rnnoise/
  - the Node dependencies of each brand's Remotion project (brands/<brand>/reel) and of Montage
  - the real-sfx and openverse-audio skills in ~/.claude/skills/ (copied from production/skills/), with the repo's
    CC0 sound library (brands/example/sounds/openverse) registered in real-sfx
Asks for permission (this script only says so; Claude asks and does it if the person says yes):
  - missing system programs: ffmpeg, Node.js 22.12+, Python 3.10+ (Homebrew on macOS, winget on Windows,
    the package manager on Linux; this script gives the exact command)
  - the Whisper large-v3 model (2.9 GB): --with-whisper
  - logins: Higgsfield, ElevenLabs, Adobe; and approving the MCP servers and the plugin the repo declares
Exits with 0 if everything required is there, 2 if something that needs permission is missing, 1 if something failed.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "tools"))
import system  # noqa: E402

system.prepare()

import json  # noqa: E402
import os  # noqa: E402
import re  # noqa: E402
import shutil  # noqa: E402
import subprocess  # noqa: E402
import urllib.request  # noqa: E402

REPO = Path(__file__).resolve().parents[1]
PROD = REPO / "production"
VENV = PROD / ".venv"
MODELS = PROD / "models"
RNNOISE_URL = "https://raw.githubusercontent.com/richardpl/arnndn-models/master/std.rnnn"
USER_SKILLS = Path.home() / ".claude" / "skills"
SOUND_LIBRARY = REPO / "brands" / "example" / "sounds" / "openverse"

args = sys.argv[1:]
CHECK = "--check" in args
WITH_WHISPER = "--with-whisper" in args
MAC, WINDOWS = system.MAC, system.WINDOWS
# how to install each system program, per system (Claude runs it only with the person's yes)
HOW = {
    "ffmpeg": ("brew install ffmpeg", "winget install --id Gyan.FFmpeg -e", "sudo apt install ffmpeg"),
    "node": ("brew install node", "winget install --id OpenJS.NodeJS.LTS -e", "with nvm or the package manager (Node 22.12 or newer)"),
    "python": ("brew install python", "winget install --id Python.Python.3.12 -e", "sudo apt install python3 python3-venv"),
    "uv": ("brew install uv", "winget install --id astral-sh.uv -e", "curl -LsSf https://astral.sh/uv/install.sh | sh"),
    "chrome": ("brew install --cask google-chrome", "winget install --id Google.Chrome -e", "the google-chrome package from google.com/chrome"),
}


def how(program):
    mac, win, linux = HOW[program]
    return mac if MAC else win if WINDOWS else linux


ok, done, permission, failed, notes = [], [], [], [], []


def run(cmd, cwd=None, quiet=True):
    r = subprocess.run(cmd, cwd=cwd, capture_output=quiet, text=True)
    if r.returncode != 0:
        raise RuntimeError((r.stderr or r.stdout or "").strip()[-600:] or f"failed: {' '.join(map(str, cmd))}")
    return r.stdout if quiet else ""


def version(cmd, pattern):
    try:
        out = subprocess.run(cmd, capture_output=True, text=True).stdout + subprocess.run(cmd, capture_output=True, text=True).stderr
        m = re.search(pattern, out)
        return tuple(int(x) for x in m.groups()) if m else None
    except FileNotFoundError:
        return None


# ---------------------------------------------------------------- 1. system programs (need permission)
ff = shutil.which("ffmpeg") and shutil.which("ffprobe")
(ok if ff else permission).append("ffmpeg and ffprobe" if ff else f"ffmpeg: cuts, mixing and videos ({how('ffmpeg')})")
node = version(["node", "--version"], r"v(\d+)\.(\d+)")
if node and node >= (22, 12):
    ok.append(f"Node.js {node[0]}.{node[1]}")
else:
    permission.append(f"Node.js 22.12 or newer: Remotion and Montage ({how('node')})")
py = sys.version_info
(ok if py >= (3, 10) else permission).append(f"Python {py.major}.{py.minor}" if py >= (3, 10) else f"Python 3.10 or newer ({how('python')})")
if not system.chrome():
    notes.append(f"Google Chrome is not installed (optional: {how('chrome')}). Remotion downloads its own browser and Montage opens "
                 + ("in Edge" if WINDOWS else "in your regular browser"))
if not shutil.which("uv"):
    notes.append(f"uv is not installed: it is only needed to download reference reels (uvx yt-dlp); optional ({how('uv')})")
if WINDOWS and permission:
    notes.append("Windows: after installing with winget, close and reopen the terminal (and Claude Code) so the new "
                 "programs show up. If Windows asks for permission in a window, accept it yourself")

# ---------------------------------------------------------------- 2. the repo's Python (no permission needed)
pyvenv = system.venv_python(create=True)  # bin/python on macOS and Linux, Scripts/python.exe on Windows


def libraries_ok():
    if not pyvenv.exists():
        return False
    r = subprocess.run([str(pyvenv), "-c", "import faster_whisper, soundfile, numpy, scipy"], capture_output=True)
    return r.returncode == 0


if libraries_ok():
    ok.append("production/.venv with faster-whisper, soundfile, numpy and scipy")
elif CHECK:
    failed.append("production/.venv is missing (installed without permission: run without --check)")
elif py >= (3, 10):
    try:
        if shutil.which("uv"):
            if not pyvenv.exists():
                run(["uv", "venv", str(VENV), "--python", "3.12"])
            run(["uv", "pip", "install", "--python", str(pyvenv), "-r", str(PROD / "requirements.txt")])
        else:
            if not pyvenv.exists():
                run([sys.executable, "-m", "venv", str(VENV)])
            run([str(pyvenv), "-m", "pip", "install", "-q", "-r", str(PROD / "requirements.txt")])
        (done if libraries_ok() else failed).append("production/.venv with the Python libraries")
    except Exception as e:  # noqa: BLE001
        failed.append(f"production/.venv: {e}")

# ---------------------------------------------------------------- 3. models
rn = MODELS / "rnnoise" / "std.rnnn"
if rn.exists():
    ok.append("voice cleanup model (rnnoise)")
elif CHECK:
    failed.append("the rnnoise model is missing (downloaded without permission: run without --check)")
else:
    try:
        rn.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(RNNOISE_URL, rn)
        done.append("voice cleanup model (rnnoise, 300 KB)")
    except Exception as e:  # noqa: BLE001
        failed.append(f"rnnoise: {e}")

whisper = MODELS / "models--Systran--faster-whisper-large-v3"
if whisper.exists() and any(whisper.rglob("model.bin")):
    ok.append("Whisper large-v3 model (transcribes the voice)")
elif WITH_WHISPER and not CHECK and libraries_ok():
    try:
        run([str(pyvenv), "-c", f"from faster_whisper import WhisperModel; WhisperModel('large-v3', device='cpu', compute_type='int8', download_root=r'{MODELS}')"], quiet=False)
        done.append("Whisper large-v3 model (2.9 GB)")
    except Exception as e:  # noqa: BLE001
        failed.append(f"Whisper: {e}")
else:
    permission.append("Whisper large-v3 model, a 2.9 GB download: transcribes the voice in stage 3 (--with-whisper). Without it, it downloads itself the first time something is transcribed")

# ---------------------------------------------------------------- 4. Node dependencies (no permission needed)
node_projects = [p.parent for p in sorted(REPO.glob("brands/*/reel/package.json"))] + [REPO / "montage"]
for d in node_projects:
    rel = d.relative_to(REPO)
    if (d / "node_modules").exists():
        ok.append(f"{rel}: Node dependencies")
    elif CHECK or not node:
        (failed if node else permission).append(f"{rel}: the Node dependencies are missing (npm install)")
    else:
        try:
            run([system.program("npm"), "ci" if (d / "package-lock.json").exists() else "install", "--no-audit", "--no-fund"], cwd=d)
            done.append(f"{rel}: Node dependencies")
        except Exception as e:  # noqa: BLE001
            failed.append(f"{rel}: {e}")
dist = REPO / "montage" / "web" / "dist" / "index.html"
if dist.exists():
    ok.append("Montage: editor built")
elif not CHECK and (REPO / "montage" / "node_modules").exists():
    try:
        run([system.program("npm"), "run", "build"], cwd=REPO / "montage")
        done.append("Montage: editor built")
    except Exception as e:  # noqa: BLE001
        failed.append(f"Montage (build): {e}")
else:
    failed.append("Montage: the editor still has to be built (npm run build in montage/)")

# ---------------------------------------------------------------- 5. user skills (no permission needed)
for name in ("real-sfx", "openverse-audio"):
    target = USER_SKILLS / name
    if not (PROD / "skills" / name).exists() and not (target / "SKILL.md").exists():
        ok.append(f"skill {name}: optional, not included in this repo")
        continue
    if (target / "SKILL.md").exists():
        ok.append(f"skill {name}")
    elif CHECK:
        failed.append(f"the {name} skill is missing (copied without permission: run without --check)")
    else:
        shutil.copytree(PROD / "skills" / name, target, dirs_exist_ok=True)
        done.append(f"skill {name} in ~/.claude/skills (copied from production/skills)")
sfx = USER_SKILLS / "real-sfx"
if (PROD / "skills" / "real-sfx").exists() and (sfx / "SKILL.md").exists():
    cfg = sfx / "config.json"
    has_library = cfg.exists() and str(SOUND_LIBRARY) in cfg.read_text(encoding="utf-8")
    if has_library and (sfx / "library_index.json").exists():
        ok.append("real-sfx with the repo's CC0 sound library")
    elif not CHECK and ff:
        try:
            if cfg.exists():
                run([sys.executable, "scripts/setup.py", "add-library", "openverse", str(SOUND_LIBRARY), "--tier", "main", "--index"], cwd=sfx)
            else:
                run([sys.executable, "scripts/setup.py", "init", "--library", f"openverse={SOUND_LIBRARY}", "--uisfx", "--index"], cwd=sfx)
            done.append("real-sfx: CC0 sound library registered and indexed")
        except Exception as e:  # noqa: BLE001
            failed.append(f"real-sfx (library): {e}")
    else:
        failed.append("real-sfx: the sound library still has to be registered (run without --check)")

# ---------------------------------------------------------------- 6. plugin and MCP servers (the person approves them in Claude Code)
installed = Path.home() / ".claude" / "plugins" / "installed_plugins.json"
try:
    plug = json.loads(installed.read_text(encoding="utf-8"))
    plug = plug.get("plugins", plug)
except Exception:  # noqa: BLE001
    plug = {}
if "instagram-agent@instagram-agent-skill" in plug:
    ok.append("instagram-agent plugin (copy and scripts)")
else:
    permission.append("instagram-agent plugin: Claude Code offers it when you trust the repo (.claude/settings.json); or /plugin install instagram-agent@instagram-agent-skill")
notes.append("After Effects and Higgsfield MCP servers (optional): declared in .mcp.json; Claude Code asks you to approve them the first time. In After Effects: "
             "Settings (Preferences) → Scripting & Expressions → \"Allow Scripts to Write Files and Access Network\". Higgsfield asks for its login the first time and is always quoted before spending")
notes.append("ElevenLabs (optional, voice): connect the ElevenLabs connector in claude.ai → Settings → Connectors. Adobe Podcast (optional): your own session in Chrome with Claude in Chrome")

# ---------------------------------------------------------------- 7. Instagram tokens (the person sets them)
try:
    accounts = json.loads((PROD / "instagram.json").read_text(encoding="utf-8")).get("accounts", {})
except Exception:  # noqa: BLE001
    accounts = {}
for brand_ig, data_ig in accounts.items():
    var = f"{brand_ig.upper().replace('-', '_')}_INSTAGRAM_TOKEN"
    has = bool(os.environ.get(var)) or bool(system.read_secret(f"{brand_ig}-instagram", "token"))
    if has:
        ok.append(f"Instagram token for @{data_ig.get('username', brand_ig)} (posting and reading results)")
    else:
        notes.append(f"No token for @{data_ig.get('username', brand_ig)}: only needed for posting (stage 12). "
                     f"The creator shares it through a secure link and saves it themselves in their own terminal: {system.PY} production/tools/save_token.py {brand_ig} "
                     f"(or in the variable {var}). See production/INSTAGRAM.md")

if accounts:
    try:
        watcher = system.hourly_task("status", "com.creator-os.metrics", PROD / "tools" / "instagram.py", ["watch"], Path.home())
    except SystemExit:
        watcher = "not installed"
    if watcher.startswith("no"):
        notes.append("Metrics watcher not installed (optional, asks for permission): saves the metrics on its own at 24 and 72 h. "
                     f"{system.PY} production/tools/instagram.py watcher install")


# ---------------------------------------------------------------- summary
def section(title, items):
    if items:
        print(f"\n{title}")
        for x in items:
            print(f"  - {x}")


print("Reels workflow setup" + (" (check only)" if CHECK else ""))
section("Ready:", ok)
section("Installed now:", done)
section("Needs the person's permission:", permission)
section("Failed or missing:", failed)
section("Good to know:", notes)
sys.exit(1 if failed else 2 if permission else 0)
