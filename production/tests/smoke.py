"""Smoke test: really runs the pieces of the workflow on THIS system (macOS, Windows or Linux) and says what fails.

    python3 production/tests/smoke.py                   # the quick part: tools, system.py, ffmpeg and the voice
    python3 production/tests/smoke.py --all             # also Remotion (downloads its browser) and Montage
    python3 production/tests/smoke.py --all --system    # and the secret store and the hourly task (always on GitHub)

It needs what `production/install.py` sets up (without Whisper). It touches nothing real:
- Montage runs on a separate port, with projects, state and cache in a temporary folder;
- the test secret and the test hourly task are deleted at the end.
GitHub runs it on every change, on Windows, macOS and Linux (.github/workflows/tests.yml).
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
TOOLS = REPO / "production" / "tools"
sys.path.insert(0, str(TOOLS))
import system  # noqa: E402

system.prepare()
ALL = "--all" in sys.argv
# the test secret and the test task touch the system (they are deleted at the end): only on GitHub or with --system
TOUCHES_SYSTEM = bool(os.environ.get("CI")) or "--system" in sys.argv
failures, passed = [], []
TMP = Path(tempfile.mkdtemp(prefix="smoke-"))


def test(name):
    def wrapper(fn):
        try:
            r = fn()
            passed.append(f"{name}{': ' + r if r else ''}")
        except Exception as e:  # noqa: BLE001
            failures.append(f"{name}: {e}")
        return fn
    return wrapper


def run(cmd, **kw):
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True, encoding="utf-8", errors="replace", **kw)
    return r.returncode, (r.stdout or "") + (r.stderr or "")


@test("every tool shows its help (and the ones that use production/.venv find it)")
def _help():
    bad = []
    for f in sorted(TOOLS.glob("*.py")):
        if f.name in ("system.py", "common.py"):
            continue
        rc, out = run([sys.executable, f, "--help"])
        if rc != 0 or "Traceback" in out or len(out.strip()) < 20:
            bad.append(f"{f.name} (code {rc}): {out.strip()[-300:]}")
        rc, out = run([sys.executable, f])  # without arguments: its usage, never a Python error
        if "Traceback" in out:
            bad.append(f"{f.name} without arguments: {out.strip()[-300:]}")
    if bad:
        raise RuntimeError("\n    ".join(bad))
    return f"{len(list(TOOLS.glob('*.py'))) - 2} tools"


@test("the Python environment (production/.venv) and its libraries")
def _venv():
    py = system.venv_python()
    if not py:
        raise RuntimeError("production/.venv does not exist: run production/install.py")
    rc, out = run([py, "-c", "import numpy, scipy, soundfile, cv2, faster_whisper; print('ok')"])
    if rc:
        raise RuntimeError(out[-400:])
    return str(py.relative_to(REPO))


@test("a tool that uses the environment switches to it on its own, in UTF-8")
def _reentry():
    rc, out = run([sys.executable, TOOLS / "faces.py", "--help"])
    if rc or "OpenCV" not in out:
        raise RuntimeError(out[-300:])
    script = TMP / "reentry.py"
    script.write_text(f"import sys\nsys.path.insert(0, {str(TOOLS)!r})\nimport system\nsystem.prepare(venv=True)\n"
                      "import numpy\nprint(sys.prefix, bool(sys.flags.utf8_mode or not system.WINDOWS))\n", encoding="utf-8")
    rc, out = run([sys.executable, script])
    if rc or not out.strip().endswith("True") or ".venv" not in out:
        raise RuntimeError(out[-300:])


@test("system.py: folders, Chrome, detached processes")
def _system():
    c = system.cache_dir("creator-os-smoke", "x")
    c.mkdir(parents=True, exist_ok=True)
    (c / "á.txt").write_text("ñandú «hello» →", encoding="utf-8")
    shutil.rmtree(system.cache_dir("creator-os-smoke"))
    if not system.alive(os.getpid()) or system.alive(4_000_000):
        raise RuntimeError("system.alive() does not tell a live process from one that does not exist")
    pid = system.launch_detached([sys.executable, "-c", "import time; time.sleep(60)"], TMP / "detached.log")
    time.sleep(1)
    if not system.alive(pid):
        raise RuntimeError("the detached process was not left running")
    system.terminate(pid)
    for _ in range(20):
        if not system.alive(pid):
            break
        time.sleep(0.25)
    else:
        raise RuntimeError("system.terminate() did not end it")
    return f"Chrome: {system.chrome() or 'not installed (Remotion downloads its own)'}"


@test("ffmpeg: voice cleanup with the rnnoise model (the model path does not go inside the filter)")
def _voice():
    script = TMP / "voice test.py"
    script.write_text(f"""import sys
sys.path.insert(0, {str(TOOLS)!r})
import system
system.prepare(venv=True)
from pathlib import Path
import common
model = Path(common.RNNOISE)
if not model.exists():
    sys.exit("the rnnoise model is missing: run production/install.py")
tmp = Path({str(TMP)!r})
source, output = tmp / "tone with space.wav", tmp / "clean ñ.wav"
common.ff("-f", "lavfi", "-i", "sine=frequency=220:duration=2", "-f", "lavfi", "-i", "anoisesrc=d=2:a=0.02",
          "-filter_complex", "amix=inputs=2", "-ar", "48000", source)
common.ff("-i", source, "-af", "arnndn=m=" + model.name + ":mix=0.8", "-c:a", "pcm_s24le", output, cwd=model.parent)  # by name, in its folder
x, sr = common.read(str(output))
if sr != 48000 or len(x) < sr:
    sys.exit("the clean voice came out empty")
common.save({{"text": "ñandú «hello» →"}}, str(tmp / "json" / "á.json"))
assert common.load(str(tmp / "json" / "á.json"))["text"] == "ñandú «hello» →"
print(f"{{common.loudness(x, sr):.1f}} LUFS")
""", encoding="utf-8")
    rc, out = run([sys.executable, script])
    if rc:
        raise RuntimeError(out[-600:])
    return out.strip().splitlines()[-1]


@test("piece.py creates and lists a piece (test brand, deleted afterwards)")
def _piece():
    brand = REPO / "brands" / "smoke-test"
    try:
        rc, out = run([sys.executable, TOOLS / "piece.py", "new", "smoke-test", "test", "--type", "animated", "--style", "scenes-and-cameos"])
        if rc and "Traceback" in out:
            raise RuntimeError(out[-400:])
        rc, out = run([sys.executable, TOOLS / "piece.py", "list"])
        if rc or "Traceback" in out:
            raise RuntimeError(out[-400:])
    finally:
        shutil.rmtree(brand, ignore_errors=True)


def only_with_all(fn):
    return fn if ALL else (lambda: None)


@only_with_all
def _all():
    @test("Remotion renders a frame with node (no npx)")
    def _remotion():
        reel = comp = None
        for p in sorted(REPO.glob("brands/*/reel/src/Root.tsx")):
            root = p.read_text(encoding="utf-8")
            if 'id="HookText"' in root:
                reel, comp = p.parents[1], "HookText"
                break
        if not reel:
            raise RuntimeError("the hook text composition was not found in brands/*/reel/src/Root.tsx")
        png = TMP / "test frame.png"
        rc, out = run([*system.remotion(reel), "still", "src/index.ts", comp, png, "--frame=30", *system.remotion_browser(),
                       "--log=error"], cwd=reel, timeout=900)
        if rc or not png.exists() or png.stat().st_size < 1000:
            raise RuntimeError(out[-800:])
        return f"{comp} in {reel.relative_to(REPO)}"

    @test("secrets: save, read and delete in the system's store")
    def _secrets():
        if not TOUCHES_SYSTEM:
            return "skipped here (runs on GitHub, or with --system)"
        value = "EA" + "smoke-test-" * 20
        where = system.save_secret("creator-os-smoke", "test", value)
        if where is None:
            return "this system has no store (the environment variable is used)"
        try:
            if system.read_secret("creator-os-smoke", "test") != value:
                raise RuntimeError(f"{where}: what was read is not what was saved")
        finally:
            system.delete_secret("creator-os-smoke", "test")
        if system.read_secret("creator-os-smoke", "test"):
            raise RuntimeError("it was not deleted")
        return where

    @test("the hourly task: install, check and remove (a test one)")
    def _task():
        if not TOUCHES_SYSTEM:
            return "skipped here (runs on GitHub, or with --system)"
        script = TMP / "task.py"
        script.write_text("import sys\nprint('ran', sys.argv[1:])\n", encoding="utf-8")
        name = "com.creator-os.smoke"
        try:
            how = system.hourly_task("install", name, script, ["test"], TMP / "task.log")
            status = system.hourly_task("status", name, script, ["test"], TMP / "task.log")
            if status.startswith("no"):
                raise RuntimeError(f"it was \"{status}\" after installing it with {how}")
        finally:
            system.hourly_task("remove", name, script, ["test"], TMP / "task.log")
        if not system.hourly_task("status", name, script, ["test"], TMP / "task.log").startswith("no"):
            raise RuntimeError("it was not removed")
        return how

    @test("Montage: server, project, published version, frames and shutdown (in temporary folders)")
    def _montage():
        cli = REPO / "montage" / "cli.mjs"
        env = dict(os.environ, MONTAGE_PROJECTS=str(TMP / "projects"), MONTAGE_STATE=str(TMP / "state"),
                   MONTAGE_CACHE=str(TMP / "cache"), MONTAGE_PORT="38470")
        video = TMP / "test video.mp4"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=540x960:rate=30:duration=3", "-f", "lavfi",
                        "-i", "sine=frequency=440:duration=3", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(video)], check=True)
        node = shutil.which("node")
        steps = [["new", "smoke", "--name", "Smoke test", "--brand", "example", "--type", "video", "--origin", "smoke.py"],
                 ["publish", "smoke", str(video), "--note", "test version"],
                 ["history", "smoke"],
                 ["view", "smoke", "--t", "1.5"]]
        rc, out = run([node, cli, "server"], env=env, cwd=REPO, timeout=120)
        state = TMP / "state" / "server.json"
        for _ in range(40):  # the server writes it once it finishes starting: give it up to 10 s
            if rc or state.exists():
                break
            time.sleep(0.25)
        if rc or not state.exists():
            # safety: if the CLI did not use the temporary folders, it would talk to the real Montage. Stop here.
            raise RuntimeError(f"Montage did not start in the temporary folders; the real one is left alone. {out[-400:]}")
        try:
            for step in steps:
                rc, out = run([node, cli, *step], env=env, cwd=REPO, timeout=300)
                if rc:
                    raise RuntimeError(f"{step[0]}: {out[-600:]}")
            port = json.loads((TMP / "state" / "server.json").read_text(encoding="utf-8"))["port"]
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/projects/smoke", timeout=10) as r:
                p = json.loads(r.read().decode("utf-8"))
            p = p.get("project", p)
            files = [a for v in p.get("versions", []) for a in v.get("files", [])]
            if not files:
                raise RuntimeError(f"the published version does not show up in the API: {json.dumps(p)[:300]}")
            # the path the web uses goes with "/"; "source" is the original path for display (on Windows, with "\\")
            if any("\\" in str(a.get("path", "")) for a in files):
                raise RuntimeError(f"the API returns paths with \"\\\" (they break on the web): {files[:2]}")
            if not list((TMP / "projects" / "smoke" / "versions").rglob("*.mp4")):
                raise RuntimeError("the video did not end up in the version's folder")
            return f"{len(files)} file in v1, port {port}"
        finally:
            run([node, cli, "stop"], env=env, cwd=REPO, timeout=60)

    # ---- what a person does by hand: only on GitHub's clean machines. On someone's own computer these would
    # overwrite their real ScrapeCreators key, their Montage app and their metrics watcher.
    ON_CI = bool(os.environ.get("CI"))

    @test("save_token.py: the pasted token lands in the system's store and instagram.py reads it back")
    def _save_token():
        if not ON_CI:
            return "skipped here (runs on GitHub only)"
        import getpass
        import importlib
        st = importlib.import_module("save_token")
        token = "EA" + "smoketoken" * 20

        class Terminal:  # what the person's own terminal looks like to the tool
            def isatty(self):
                return True

        old_stdin, old_getpass = sys.stdin, getpass.getpass
        sys.stdin, getpass.getpass = Terminal(), (lambda prompt="": " " + token + "\n")  # pasted with stray spaces
        env_file = Path.home() / ".config" / "last30days" / ".env"
        old_env = env_file.read_text(encoding="utf-8") if env_file.exists() else None
        try:
            if system.LINUX and not shutil.which("secret-tool"):
                try:
                    st.instagram("smoke-test")
                except SystemExit as e:
                    if "INSTAGRAM_TOKEN" not in str(e):
                        raise RuntimeError(f"without a store it should explain the environment variable: {e}")
                else:
                    raise RuntimeError("without a store it should save nothing and explain the environment variable")
                where = "no store on this Linux: it explains SMOKE_TEST_INSTAGRAM_TOKEN"
            else:
                try:
                    st.instagram("smoke-test")
                except SystemExit as e:
                    raise RuntimeError(f"save_token.py stopped: {e}")
                ig = importlib.import_module("instagram")
                if ig.token("smoke-test") != token:
                    raise RuntimeError("instagram.py read a different token")
                where = system.read_secret("smoke-test-instagram", "token") and "saved and read back"
            getpass.getpass = lambda prompt="": "sc_" + "smokekey" * 4
            try:
                st.scrapecreators()
            except SystemExit as e:
                raise RuntimeError(f"--scrapecreators stopped: {e}")
            if system.MAC:
                user = os.environ.get("USER") or getpass.getuser()
                ok = system.read_secret("last30days-SCRAPECREATORS_API_KEY", user) == "sc_" + "smokekey" * 4
            else:
                ok = "SCRAPECREATORS_API_KEY=sc_" + "smokekey" * 4 in env_file.read_text(encoding="utf-8")
            if not ok:
                raise RuntimeError("the ScrapeCreators key is not where last30days looks for it")
            return f"{where}; ScrapeCreators key where last30days reads it"
        finally:
            sys.stdin, getpass.getpass = old_stdin, old_getpass
            system.delete_secret("smoke-test-instagram", "token")
            if system.MAC:
                system.delete_secret("last30days-SCRAPECREATORS_API_KEY", os.environ.get("USER") or getpass.getuser())
            elif old_env is None:
                env_file.unlink(missing_ok=True)
            else:
                env_file.write_text(old_env, encoding="utf-8")

    @test("the metrics watcher: instagram.py watcher install, the system runs it, it logs, remove")
    def _watcher():
        if not ON_CI:
            return "skipped here (runs on GitHub only)"
        ig = [sys.executable, TOOLS / "instagram.py", "watcher"]
        log = system.logs_dir("creator-os") / "creator-os-metrics.log"
        log.unlink(missing_ok=True)
        try:
            rc, out = run([*ig, "install"], timeout=120)
            if rc:
                raise RuntimeError(f"install: {out[-500:]}")
            rc, status = run([*ig, "status"], timeout=60)
            if rc or status.strip().startswith("not"):
                raise RuntimeError(f"status after installing: {status[-300:]}")
            if not system.LINUX:  # launchd runs it at load and Task Scheduler on install; cron waits for the hour
                for _ in range(120):
                    if log.exists():
                        break
                    time.sleep(0.5)
                else:
                    raise RuntimeError(f"the system never ran it (no log at {log})")
                time.sleep(3)
                text = log.read_text(encoding="utf-8", errors="replace")
                if "Traceback" in text:
                    raise RuntimeError(f"it ran with an error: {text[-500:]}")
        finally:
            run([*ig, "remove"], timeout=60)
        rc, status = run([*ig, "status"], timeout=60)
        if not status.strip().startswith("not"):
            raise RuntimeError(f"still installed after remove: {status[-200:]}")
        return status.strip().splitlines()[0] + " after remove; it ran and logged" + (" (cron: at the hour)" if system.LINUX else "")

    @test("Montage's app or shortcut: npm run install-app creates it, --remove takes it away")
    def _montage_app():
        if not ON_CI:
            return "skipped here (runs on GitHub only)"
        node = shutil.which("node")
        rc, out = run([node, REPO / "montage" / "install.mjs"], cwd=REPO / "montage", timeout=900)
        if rc:
            raise RuntimeError(f"install: {out[-800:]}")
        if system.WINDOWS:
            ps = ("@([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs')) | "
                  "ForEach-Object { Test-Path (Join-Path $_ 'Montage.lnk') }")
            found = lambda: run(["powershell", "-NoProfile", "-Command", ps])[1].split()  # noqa: E731
            if found() != ["True", "True"]:
                raise RuntimeError(f"Montage.lnk is not on the Desktop and in the Start menu: {found()} · {out[-400:]}")
            where = "Montage.lnk on the Desktop and in the Start menu"
        else:
            app = Path.home() / ("Applications/Montage.app" if system.MAC else ".local/share/applications/montage.desktop")
            found = app.exists
            if not found():
                raise RuntimeError(f"{app} was not created: {out[-400:]}")
            where = str(app)
        rc, out = run([node, REPO / "montage" / "install.mjs", "--remove"], cwd=REPO / "montage", timeout=120)
        still = found() if not system.WINDOWS else "True" in found()
        if rc or still:
            raise RuntimeError(f"--remove left it there: {out[-300:]}")
        return where

    @test("every install command the docs give for this system names a real package")
    def _install_commands():
        if not ON_CI:
            return "skipped here (runs on GitHub only)"
        import re
        text = "\n".join(f.read_text(encoding="utf-8", errors="replace") for f in REPO.rglob("*")
                         if f.suffix in (".md", ".py") and f.is_file() and "node_modules" not in f.parts and ".git" not in f.parts)
        bad = []
        if system.WINDOWS:
            ids = sorted(set(re.findall(r"winget install (?:--id )?([A-Za-z0-9][\w.\-]+\.[\w.\-]+)", text)))
            for i in ids:
                rc, out = run(["winget", "show", "--id", i, "-e", "--accept-source-agreements", "--disable-interactivity"], timeout=180)
                if rc or "No package found" in out:
                    bad.append(f"winget {i}: {out.strip()[-200:]}")
            names = ids
        elif system.MAC:
            names = sorted(set(m.group(1) + m.group(2) for m in re.finditer(r"brew install (--cask )?([a-z0-9][\w@.+\-]*)", text)))
            for n in names:
                rc, out = run(["brew", "info", *n.split()], timeout=180)
                if rc:
                    bad.append(f"brew {n}: {out.strip()[-200:]}")
        else:
            names = sorted({w for m in re.finditer(r"sudo apt(?:-get)? install (?:-y )?([a-z0-9][a-z0-9.+\- ]*)", text) for w in m.group(1).split()})
            for n in names:
                rc, out = run(["apt-cache", "show", n], timeout=120)
                if rc:
                    bad.append(f"apt {n}: {out.strip()[-200:]}")
        if bad:
            raise RuntimeError("\n    ".join(bad))
        return ", ".join(names)


_all()
shutil.rmtree(TMP, ignore_errors=True)
print(f"System: {sys.platform} · Python {sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")
for x in passed:
    print(f"  ok    {x}")
for x in failures:
    print(f"  FAIL  {x}")
sys.exit(1 if failures else 0)
