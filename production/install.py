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
  With --check, whatever of this is missing shows up under "To install".
Asks for permission (this script only says so; Claude asks and does it if the person says yes):
  - missing system programs: git, ffmpeg 7+, Node.js (the version montage/package.json asks for) and Python 3.10+
    (Homebrew on macOS, winget on Windows, the package manager on Linux; this script gives the exact command and, on
    macOS without Homebrew, how to install it first)
  - the Whisper large-v3 model (2.9 GB): --with-whisper
  - logins: Higgsfield, ElevenLabs, Adobe; and approving the MCP servers and the plugins the repo declares
Only notes: the free disk space (under 6 GB), secret-tool on Linux, Chrome, uv and the optional plugins.
Exits with 0 if everything required is there, 2 if something is missing (that needs permission or that gets installed by
running without --check), 1 if something failed.
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
MAC, WINDOWS, LINUX = system.MAC, system.WINDOWS, system.LINUX
# Homebrew (macOS): the official command from https://brew.sh. The person pastes it in the Terminal app, because it asks for their password.
HOMEBREW = '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
# on a Mac with Apple silicon, brew lives in /opt/homebrew and the terminal doesn't see it until this runs (its "Next steps")
HOMEBREW_PATH = """echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile"""
HAS_BREW = not MAC or bool(shutil.which("brew"))


def node_minimum():
    """The Node version montage/package.json asks for ("engines"), for example (22, 12)."""
    try:
        wants = json.loads((REPO / "montage" / "package.json").read_text(encoding="utf-8"))["engines"]["node"]
        m = re.search(r"(\d+)\.(\d+)", wants)
        return (int(m.group(1)), int(m.group(2)))
    except Exception:  # noqa: BLE001
        return (22, 12)


NODE_MIN = node_minimum()
NODE_TXT = f"{NODE_MIN[0]}.{NODE_MIN[1]}"
# how to install each system program, per system (Claude runs it only with the person's yes).
# The same commands as .claude/skills/creator-install-montage/SKILL.md.
HOW = {
    "git": ("xcode-select --install", "winget install --id Git.Git -e", "sudo apt install git"),
    "ffmpeg": ("brew install ffmpeg", "winget install --id Gyan.FFmpeg -e", "sudo apt install ffmpeg"),
    "ffmpeg7": ("brew install ffmpeg", "winget install --id Gyan.FFmpeg -e",
                "a static ffmpeg from johnvansickle.com/ffmpeg and the FFMPEG variable with its path: the apt one on Ubuntu 22.04 and 24.04 is older"),
    "node": ("brew install node", "winget install --id OpenJS.NodeJS.LTS -e",
             f"nvm (https://github.com/nvm-sh/nvm) and then nvm install {NODE_MIN[0]}: the apt nodejs is older"),
    "python": ("brew install python", "winget install --id Python.Python.3.12 -e", "sudo apt install python3 python3-venv"),
    "uv": ("brew install uv", "winget install --id astral-sh.uv -e", "curl -LsSf https://astral.sh/uv/install.sh | sh"),
    "chrome": ("brew install --cask google-chrome", "winget install --id Google.Chrome -e", "the google-chrome package from google.com/chrome"),
}
needs_brew = []  # on macOS without Homebrew: the missing programs that get installed with it


def how(program):
    mac, win, linux = HOW[program]
    if MAC and not HAS_BREW and mac.startswith("brew "):
        needs_brew.append(program)
        return f"Homebrew first; then {mac}"
    return mac if MAC else win if WINDOWS else linux


ok, done, to_install, permission, failed, notes = [], [], [], [], [], []


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
    except OSError:
        return None


# ---------------------------------------------------------------- 1. system programs (need permission)
gitv = version(["git", "--version"], r"(\d+)\.(\d+)")
(ok if gitv else permission).append(f"git {gitv[0]}.{gitv[1]}" if gitv else f"git: downloads the repo and its updates ({how('git')})")
ff = shutil.which("ffmpeg") and shutil.which("ffprobe")
if not ff:
    permission.append(f"ffmpeg: cuts, mixing and videos ({how('ffmpeg')})")
else:
    # Montage uses the one in the FFMPEG variable, if set; otherwise the one on the PATH
    ffv = version([os.environ.get("FFMPEG") or "ffmpeg", "-version"], r"ffmpeg version n?(\d+)\.(\d+)")
    if ffv and ffv[0] < 7:
        permission.append(f"ffmpeg {ffv[0]}.{ffv[1]}: fine for cutting and mixing, but Montage needs 7 or newer to export ({how('ffmpeg7')})")
    else:
        ok.append(f"ffmpeg {ffv[0]}.{ffv[1]} and ffprobe" if ffv else "ffmpeg and ffprobe")
node = version(["node", "--version"], r"v(\d+)\.(\d+)")
if node and node >= NODE_MIN:
    ok.append(f"Node.js {node[0]}.{node[1]}")
elif node:
    permission.append(f"Node.js {node[0]}.{node[1]}: Remotion and Montage need {NODE_TXT} or newer ({how('node')})")
else:
    permission.append(f"Node.js {NODE_TXT} or newer: Remotion and Montage ({how('node')})")
py = sys.version_info
(ok if py >= (3, 10) else permission).append(f"Python {py.major}.{py.minor}" if py >= (3, 10) else f"Python 3.10 or newer ({how('python')})")
if not system.chrome():
    notes.append(f"Google Chrome is not installed (optional: {how('chrome')}). Remotion downloads its own browser and Montage opens "
                 + ("in Edge" if WINDOWS else "in your regular browser"))
if not shutil.which("uv"):
    notes.append(f"uv is not installed: it is only needed to download reference reels (uvx yt-dlp); optional ({how('uv')})")
if needs_brew:
    if Path("/opt/homebrew/bin/brew").exists():
        brew = (f"Homebrew is already there, but this terminal doesn't see it: the person pastes the line from its \"Next steps\" in the "
                f"Terminal app ({HOMEBREW_PATH}) and closes and reopens Claude Code")
    else:
        brew = (f"Homebrew, the one that installs programs on macOS (free), goes before everything else. The person pastes it in the Terminal app, "
                f"because it asks for their password ({HOMEBREW}). When it finishes, they also paste the \"Next steps\" lines it shows "
                f"(on a Mac with Apple silicon, {HOMEBREW_PATH}) and close and reopen Claude Code: until then it doesn't see brew")
    (permission if any(p not in ("chrome", "uv") for p in needs_brew) else notes).insert(0, brew)
if WINDOWS and permission:
    notes.append("Windows: after installing with winget, close and reopen the terminal (and Claude Code) so the new "
                 "programs show up. If Windows asks for permission in a window, accept it yourself")
if LINUX and not shutil.which("secret-tool"):
    notes.append("secret-tool is not installed: it's only needed to keep the YouTube, TikTok and Instagram keys in the system's "
                 "keyring; free (sudo apt install libsecret-tools)")
free_gb = shutil.disk_usage(REPO).free / 1e9
if free_gb < 6:
    notes.append(f"{free_gb:.1f} GB free on the disk: about 6 GB is best, because Whisper takes 2.9 GB and the renders take more. "
                 "Free up some space before going on")
else:
    ok.append(f"{free_gb:.0f} GB free on the disk")

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
    to_install.append("production/.venv with the Python libraries (run without --check)")
elif py < (3, 10):
    to_install.append("production/.venv with the Python libraries: installed once Python 3.10 or newer is there")
else:
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
    to_install.append("voice cleanup model (rnnoise, 300 KB; run without --check)")
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
    elif CHECK:
        to_install.append(f"{rel}: Node dependencies (run without --check)")
    elif not node:
        to_install.append(f"{rel}: Node dependencies: installed once Node.js is there")
    else:
        try:
            run([system.program("npm"), "ci" if (d / "package-lock.json").exists() else "install", "--no-audit", "--no-fund"], cwd=d)
            done.append(f"{rel}: Node dependencies")
        except Exception as e:  # noqa: BLE001
            failed.append(f"{rel}: {e}")
dist = REPO / "montage" / "web" / "dist" / "index.html"
if dist.exists():
    ok.append("Montage: editor built")
elif CHECK:
    to_install.append("Montage: build the editor (run without --check)")
elif (REPO / "montage" / "node_modules").exists():
    try:
        run([system.program("npm"), "run", "build"], cwd=REPO / "montage")
        done.append("Montage: editor built")
    except Exception as e:  # noqa: BLE001
        failed.append(f"Montage (build): {e}")
else:
    to_install.append("Montage: build the editor: done once its Node dependencies are there")

# ---------------------------------------------------------------- 5. user skills (no permission needed)
for name in ("real-sfx", "openverse-audio"):
    target = USER_SKILLS / name
    if not (PROD / "skills" / name).exists() and not (target / "SKILL.md").exists():
        ok.append(f"skill {name}: optional, not included in this repo")
        continue
    if (target / "SKILL.md").exists():
        ok.append(f"skill {name}")
    elif CHECK:
        to_install.append(f"skill {name}: copied from production/skills to ~/.claude/skills (run without --check)")
    else:
        shutil.copytree(PROD / "skills" / name, target, dirs_exist_ok=True)
        done.append(f"skill {name} in ~/.claude/skills (copied from production/skills)")
sfx = USER_SKILLS / "real-sfx"
if (PROD / "skills" / "real-sfx").exists() and (sfx / "SKILL.md").exists():
    cfg = sfx / "config.json"
    # compare the path normalized: on Windows the JSON stores it with "\\" or with "/" (and case doesn't matter)
    normal = lambda t: t.replace("\\\\", "/").replace("\\", "/").lower() if WINDOWS else t  # noqa: E731
    has_library = cfg.exists() and normal(str(SOUND_LIBRARY)) in normal(cfg.read_text(encoding="utf-8"))
    if has_library and (sfx / "library_index.json").exists():
        ok.append("real-sfx with the repo's CC0 sound library")
    elif CHECK:
        to_install.append("real-sfx: register the repo's CC0 sound library (run without --check)")
    elif not ff:
        to_install.append("real-sfx: register the repo's CC0 sound library: done once ffmpeg is there")
    else:
        try:
            if cfg.exists():
                run([sys.executable, "scripts/setup.py", "add-library", "openverse", str(SOUND_LIBRARY), "--tier", "main", "--index"], cwd=sfx)
            else:
                run([sys.executable, "scripts/setup.py", "init", "--library", f"openverse={SOUND_LIBRARY}", "--uisfx", "--index"], cwd=sfx)
            done.append("real-sfx: CC0 sound library registered and indexed")
        except Exception as e:  # noqa: BLE001
            failed.append(f"real-sfx (library): {e}")

# ---------------------------------------------------------------- 6. plugins and MCP servers (the person approves them in Claude Code)
# the plugins .claude/settings.json recommends; Claude Code offers them when the folder is trusted. They're all free.
# instagram-agent asks for permission because /creator-reel uses it for the script and the copy; the others are optional and only noted.
PLUGINS = {
    "instagram-agent": ("copy and scripts", "to write hooks, scripts and copy that sound like you; /creator-reel uses it for the script and the copy", True),
    "last30days": ("ideas", "to see what your niche is sharing this month, when looking for ideas", False),
    "marketing-skills": ("strategy", "for strategy: why people share and which format goes on each network", False),
    "hyperframes": ("animations", "to have hundreds of ready-made animations and transitions, when animating", False),
}
installed = Path.home() / ".claude" / "plugins" / "installed_plugins.json"
try:
    plug = json.loads(installed.read_text(encoding="utf-8"))
    plug = plug.get("plugins", plug)
except Exception:  # noqa: BLE001
    plug = {}
try:
    declared = [k for k, v in json.loads((REPO / ".claude" / "settings.json").read_text(encoding="utf-8")).get("enabledPlugins", {}).items() if v]
except Exception:  # noqa: BLE001
    declared = ["instagram-agent@instagram-agent-skill"]
for key in declared:
    name = key.split("@")[0]
    short, what_for, needed = PLUGINS.get(name, ("", "recommended by .claude/settings.json", False))
    if key in plug:
        ok.append(f"{name} plugin" + (f" ({short})" if short else ""))
    else:
        (permission if needed else notes).append(
            f"{name} plugin: {what_for}. Free{'' if needed else ' and optional'}. Claude Code offers it when you trust the folder; "
            f"if the answer was no: /plugin install {key}")
notes.append("After Effects MCP server (paid: the Adobe subscription) and Higgsfield MCP server (paid, by credits): declared in .mcp.json, "
             "and Claude Code asks whether to turn them on. If the person doesn't pay for them, they say no; they can be turned on later. "
             "In After Effects: Settings (Preferences) → Scripting & Expressions → \"Allow Scripts to Write Files and Access Network\". "
             "Higgsfield asks for its login the first time and is always quoted before spending")
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
section("To install (installed without asking):", to_install)
section("Needs the person's permission:", permission)
section("Failed:", failed)
section("Good to know:", notes)
sys.exit(1 if failed else 2 if permission or to_install else 0)
