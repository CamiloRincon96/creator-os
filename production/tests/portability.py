"""Checks that nothing specific to a single operating system slips into the repo: everything has to run on macOS, Windows and Linux.

    python3 production/tests/portability.py [folder]     # by default, the root of this repo

What is specific to each system lives only in production/tools/system.py. This looks, in the code and in the docs, for:
- paths and programs of a single system (the keychain with `security`, launchd, /Applications, ~/Library, zsh, `open`, sips…)
  without a system check next to them;
- `npm`/`npx` called without going through the Windows PATH, file paths inside an ffmpeg filter, and `os.kill`
  (on Windows it kills the process instead of asking whether it is still alive);
- tools that do not start with `system.prepare(...)` (without it, accents break on Windows and production/.venv
  is not found), and text reads without UTF-8 in what does not go through it;
- docs with a command for a single system and no Windows one nearby;
- file names Windows does not accept, that only differ in case, or that end up too long.
Exits with 1 and the list if it finds anything. GitHub runs it on every change (.github/workflows/tests.yml).
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[2]
SYSTEM = "production/tools/system.py"
TOOLS = "production/tools/"
SKIP = ("node_modules/", ".git/", "brands/example/pieces/", "montage/projects/", "montage/web/dist/",
        "production/tests/portability.py")
CODE = {".py", ".mjs", ".js", ".cjs", ".ts", ".tsx", ".sh"}
DOCS = {".md"}
GUARD = re.compile(r"darwin|process\.platform|sys\.platform|\bMAC\b|\bWINDOWS\b|win32|os\.name|platform\.system")
WINDOWS_NEARBY = re.compile(r"winget|Windows|PowerShell|%LOCALAPPDATA%|\.exe\b|choco", re.I)
NEGATION = re.compile(r"\bnever\b|don't use|do not use|\bbare\b|instead of", re.I)
THIRD_PARTY = re.compile(r"\b(numpy|scipy|soundfile|cv2|faster_whisper|pyloudnorm)\b|^from (common|listen) import")

# code: (pattern, what to do). Outside system.py, they are only fine with a system check in the 40 lines before.
ONE_SYSTEM_ONLY = [
    (r"""["']security["']|\blaunchctl\b|\bosascript\b|\bcaffeinate\b|\bpbcopy\b|\bpbpaste\b|\bsips\b|\biconutil\b|\bafplay\b""",
     "program that only exists on macOS"),
    (r"/Applications/|Library/(Caches|Logs|LaunchAgents)|/System/Library/", "path that only exists on macOS"),
    (r"os\.getuid|os\.killpg|os\.setsid|import fcntl|import resource|import pwd", "function that does not exist on Windows"),
    (r"""spawn(Sync)?\(\s*['"]open['"]|["']open["'],\s*\[|/bin/(cp|sh|bash|zsh)\b|['"]aac_at['"]|videotoolbox|audiotoolbox""",
     "command or codec that only exists on macOS"),
    (r"xdg-open|notify-send|['\"]/c['\"],\s*['\"]start['\"]|explorer\.exe|schtasks|taskkill", "command of a single system"),
]
PY_FORBIDDEN = [
    (r"\.venv/bin/python|\.venv\\\\Scripts|\.venv/Scripts", "use system.venv_python()"),
    (r"""\[\s*["'](npx|npm|yarn|pnpm)["']""", "on Windows npm and npx are .cmd: use system.program() or system.remotion()"),
    (r"os\.kill\(", "on Windows os.kill(pid, 0) kills the process: use system.alive() or system.terminate()"),
    (r"shell=True", "no shell: shell commands change from one system to another"),
    (r"""(fontfile|textfile|subtitles|amovie|movie|filename|arnndn=m)=['"]?\{(?!esc|os\.path\.basename|Path\(.*\)\.name)""",
     "path inside an ffmpeg filter: on Windows the \"C:\" splits the filter (escape it or run ffmpeg in its folder)"),
    (r"^#!/bin/(zsh|bash)", "the tools are Python: Windows has no zsh or bash"),
]
JS_NPM = re.compile(r"""(spawn|spawnSync|execFile|execFileSync)\(\s*['"](npm|npx)['"]""")
DOC_FORBIDDEN = [
    (r"\.venv/bin/python", "write `python3 production/tools/<tool>.py`: the tool finds its environment"),
    (r"\bzsh production/|save-token\.sh|codex\.sh", "there are no zsh scripts anymore: they are Python"),
    (r"security (add|find)-generic-password", "use `save_token.py`, which saves to each system's store"),
]
DOC_NEEDS_WINDOWS = re.compile(r"brew install|~/Library|LaunchAgents|\blaunchd\b|/Applications/|\bopen -a\b|`open [<\"~/\w]|\bpbcopy\b|\bpbpaste\b|xcode-select")
INVALID = re.compile(r'[<>:"|?*]|[. ]$')
RESERVED = re.compile(r"^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$", re.I)


def files():
    try:
        r = subprocess.run(["git", "ls-files", "-co", "--exclude-standard"], cwd=ROOT, capture_output=True, text=True, check=True)
        rels = r.stdout.splitlines()
    except (OSError, subprocess.CalledProcessError):
        rels = [str(p.relative_to(ROOT)).replace("\\", "/") for p in ROOT.rglob("*") if p.is_file()]
    return sorted(x for x in rels if not any(x.startswith(f) or f"/{f}" in f"/{x}" for f in SKIP) and (ROOT / x).is_file())


ALTERNATIVES = re.compile(r"WINDIR|Windows/Fonts|/usr/share/fonts", re.I)  # a list of paths for the three systems


def guarded(lines, i):
    return (any(GUARD.search(x) for x in lines[max(0, i - 40):i + 1])
            or any(ALTERNATIVES.search(x) for x in lines[max(0, i - 3):i + 4]))


def check():
    problems = []
    rels = files()

    def bad(rel, n, line, why):
        problems.append(f"{rel}:{n}: {why}\n      {line.strip()[:150]}")

    seen = {}
    for rel in rels:
        for part in rel.split("/"):
            if INVALID.search(part) or RESERVED.match(part):
                bad(rel, 0, rel, "a name Windows does not accept")
        if len(rel) > 180:
            bad(rel, 0, rel, f"a {len(rel)}-character path: on Windows, with the repo folder in front, it goes past 260")
        key = rel.lower()
        if key in seen:
            bad(rel, 0, rel, f"clashes with {seen[key]}: Windows and macOS do not tell upper and lower case apart")
        seen[key] = rel

    for rel in rels:
        ext = Path(rel).suffix.lower()
        if ext not in CODE | DOCS:
            continue
        try:
            text = (ROOT / rel).read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        lines = text.splitlines()

        if ext in DOCS:
            for i, line in enumerate(lines):
                if NEGATION.search(line):
                    continue
                for pattern, why in DOC_FORBIDDEN:
                    if re.search(pattern, line):
                        bad(rel, i + 1, line, why)
                if DOC_NEEDS_WINDOWS.search(line) and not any(WINDOWS_NEARBY.search(x) for x in lines[max(0, i - 4):i + 9]):
                    bad(rel, i + 1, line, "a macOS command or path without the Windows equivalent nearby")
            continue

        if rel == SYSTEM:
            continue
        in_tools = rel.startswith(TOOLS)
        for i, line in enumerate(lines):
            code = line.split("#", 1)[0] if ext == ".py" else re.sub(r"^\s*(//|\*).*", "", line)
            if not code.strip():
                continue
            for pattern, why in ONE_SYSTEM_ONLY:
                if re.search(pattern, code) and not guarded(lines, i):
                    bad(rel, i + 1, line, f"{why}, without checking the system (it goes in {SYSTEM} or next to a system `if`)")
            if ext == ".py":
                for pattern, why in PY_FORBIDDEN:
                    if re.search(pattern, line if pattern.startswith("^#!") else code) and not guarded(lines, i):
                        bad(rel, i + 1, line, why)
            elif JS_NPM.search(code) and "shell" not in " ".join(lines[i:i + 3]):
                bad(rel, i + 1, line, "on Windows npm and npx are .cmd: pass it `shell: process.platform === 'win32'`")
            if ext == ".sh" and in_tools:
                bad(rel, i + 1, line, "the tools are Python: Windows has no zsh or bash")
                break

        if ext == ".py":
            uses_prepare = "system.prepare(" in text
            if in_tools and Path(rel).name not in ("common.py", "oauth.py", "networks.py"):
                i_prep = next((i for i, x in enumerate(lines) if "system.prepare(" in x), None)
                i_third = next((i for i, x in enumerate(lines) if re.match(r"(import|from) ", x) and THIRD_PARTY.search(x)), None)
                if i_prep is None:
                    bad(rel, 1, lines[0] if lines else "", "the tool does not start with `system.prepare(...)`")
                elif i_third is not None and i_third < i_prep:
                    bad(rel, i_third + 1, lines[i_third], "imports libraries before `system.prepare(...)`")
            if not uses_prepare and Path(rel).name not in ("common.py", "oauth.py", "networks.py"):
                for i, line in enumerate(lines):
                    code = line.split("#", 1)[0]
                    if re.search(r"\.read_text\(\s*\)|\.write_text\([^)]*\)\s*$", code) and "encoding" not in code:
                        bad(rel, i + 1, line, "text without encoding=\"utf-8\": on Windows it is read as cp1252")
                    m = re.search(r"\bopen\(([^)]*)\)", code)
                    if m and "encoding" not in m.group(1) and not re.search(r"""['"][rwax]?b|b['"]|['"][rwa]\+?b""", m.group(1)) \
                            and not re.search(r"os\.open|\.open\(|urlopen|Image\.open|webbrowser", code):
                        bad(rel, i + 1, line, "text open() without encoding=\"utf-8\": on Windows it is read as cp1252")
    return problems


if __name__ == "__main__":
    problems = check()
    if problems:
        print(f"{len(problems)} portability problems (macOS, Windows and Linux):\n")
        print("\n".join(problems))
        sys.exit(1)
    print("Portable: nothing specific to a single system outside its place.")
