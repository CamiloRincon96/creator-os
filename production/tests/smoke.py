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
        if f.name in ("system.py", "common.py", "oauth.py", "networks.py"):
            continue
        rc, out = run([sys.executable, f, "--help"])
        if rc != 0 or "Traceback" in out or len(out.strip()) < 20:
            bad.append(f"{f.name} (code {rc}): {out.strip()[-300:]}")
        rc, out = run([sys.executable, f])  # without arguments: its usage, never a Python error
        if "Traceback" in out:
            bad.append(f"{f.name} without arguments: {out.strip()[-300:]}")
    if bad:
        raise RuntimeError("\n    ".join(bad))
    return f"{len(list(TOOLS.glob('*.py'))) - 4} tools"


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


def fake_server():
    """Imitates the TikTok, YouTube and Meta APIs (and their sign-in pages) on 127.0.0.1, to test
    connect -> test -> upload -> metrics without real accounts. Returns (base_url, what_it_received, stop)."""
    import threading
    import urllib.parse
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
    seen = {"chunks": [], "uploads": 0}

    class Fake(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def reply(self, data, code=200, headers=None):
            body = json.dumps(data).encode("utf-8")
            self.send_response(code)
            for k, v in (headers or {}).items():
                self.send_header(k, v)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def body(self):
            n = int(self.headers.get("Content-Length") or 0)
            return self.rfile.read(n) if n else b""

        def do_GET(self):  # noqa: N802
            u = urllib.parse.urlsplit(self.path)
            q = dict(urllib.parse.parse_qsl(u.query))
            ok = {"error": {"code": "ok"}}
            if u.path in ("/tt/auth", "/yt/auth"):  # the "sign-in page": accepts and comes back with the code
                target = q["redirect_uri"] + ("&" if "?" in q["redirect_uri"] else "?") + urllib.parse.urlencode({"code": "code-1", "state": q["state"]})
                seen[u.path] = q
                self.send_response(302)
                self.send_header("Location", target)
                self.end_headers()
            elif u.path == "/tt/v2/user/info/":
                self.reply({"data": {"user": {"display_name": "Test", "username": "test", "follower_count": 7, "video_count": 1}}, **ok})
            elif u.path.endswith("/me/accounts"):
                self.reply({"data": [{"id": "pg1", "name": "Test page", "tasks": ["CREATE_CONTENT", "ANALYZE"]}]})
            elif u.path.endswith("/pg1"):
                self.reply({"access_token": "page-token", "name": "Test page", "followers_count": 3})
            elif u.path.endswith("/pg1/video_reels"):
                self.reply({"data": [{"id": "fbv1", "description": "hello", "created_time": "2026-11-16T10:00:00+0000"}]})
            elif u.path.endswith("/fbv1/video_insights"):
                self.reply({"data": [{"name": "fb_reels_total_plays", "values": [{"value": 12}]}]})
            elif u.path.endswith("/fbv1"):
                self.reply({"status": {"video_status": "ready"}, "permalink_url": "/reel/fbv1"})
            elif u.path == "/yt/api/channels":
                self.reply({"items": [{"id": "UC1", "snippet": {"title": "Test channel"}, "statistics": {"subscriberCount": "5"},
                                       "contentDetails": {"relatedPlaylists": {"uploads": "UU1"}}}]})
            elif u.path == "/yt/api/playlistItems":
                self.reply({"items": [{"contentDetails": {"videoId": "ytv1"}}]})
            elif u.path == "/yt/api/videos":
                self.reply({"items": [{"id": "ytv1", "snippet": {"title": "Test", "publishedAt": "2026-11-16T10:00:00Z"}, "statistics": {"viewCount": "9"}}]})
            elif u.path == "/yt/analytics":
                self.reply({"columnHeaders": [{"name": "video"}, {"name": "views"}, {"name": "averageViewDuration"}], "rows": [["ytv1", 9, 4]]})
            else:
                self.reply({"error": f"undefined fake route: {u.path}"}, 404)

        def do_POST(self):  # noqa: N802
            u = urllib.parse.urlsplit(self.path)
            data = self.body()
            ok = {"error": {"code": "ok"}}
            base = f"http://127.0.0.1:{self.server.server_port}"
            if u.path == "/tt/v2/oauth/token/":
                form = dict(urllib.parse.parse_qsl(data.decode()))
                seen.setdefault("tt_token", []).append(form)
                self.reply({"access_token": "tt-a", "refresh_token": "tt-r", "open_id": "o1", "expires_in": 7200, "refresh_expires_in": 15552000,
                            "scope": "user.info.basic,user.info.profile,user.info.stats,video.upload,video.list"})
            elif u.path == "/tt/v2/post/publish/inbox/video/init/":
                seen["tt_init"] = json.loads(data)
                self.reply({"data": {"publish_id": "p1", "upload_url": f"{base}/upload/tt"}, **ok})
            elif u.path == "/tt/v2/post/publish/status/fetch/":
                self.reply({"data": {"status": "SEND_TO_USER_INBOX"}, **ok})
            elif u.path == "/tt/v2/video/list/":
                self.reply({"data": {"videos": [{"id": "t1", "create_time": 1763300000, "title": "hello", "view_count": 11}]}, **ok})
            elif u.path == "/yt/token":
                form = dict(urllib.parse.parse_qsl(data.decode()))
                seen.setdefault("yt_token", []).append(form)
                self.reply({"access_token": "yt-a", "refresh_token": "yt-r", "expires_in": 3600, "scope": " ".join(
                    "https://www.googleapis.com/auth/" + x for x in ("youtube.upload", "youtube.readonly", "yt-analytics.readonly"))})
            elif u.path == "/yt/upload":
                seen["yt_meta"] = json.loads(data)
                self.reply({}, 200, {"Location": f"{base}/upload/yt"})
            elif u.path.endswith("/pg1/video_reels"):
                form = dict(urllib.parse.parse_qsl(data.decode()))
                seen.setdefault("fb", []).append(form)
                self.reply({"video_id": "fbv1", "upload_url": f"{base}/upload/fb"} if form.get("upload_phase") == "start" else {"success": True})
            elif u.path == "/upload/fb":
                seen["uploads"] += 1
                seen["fb_bytes"] = len(data)
                self.reply({"success": True})
            else:
                self.reply({"error": f"undefined fake route: {u.path}"}, 404)

        def do_PUT(self):  # noqa: N802
            data = self.body()
            if self.path == "/upload/tt":
                seen["chunks"].append((self.headers.get("Content-Range"), len(data)))
                self.reply({}, 201)
            elif self.path == "/upload/yt":
                seen["uploads"] += 1
                seen["yt_bytes"] = len(data)
                self.reply({"id": "ytv1"}, 201)
            else:
                self.reply({}, 404)

    srv = ThreadingHTTPServer(("127.0.0.1", 0), Fake)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{srv.server_port}", seen, srv.shutdown


@test("the networks with a fake server: connect, test, upload and metrics on TikTok, YouTube and Facebook")
def _networks():
    import oauth
    base, seen, stop = fake_server()
    brand = "smoke-networks"
    env = dict(os.environ, SECRETS_TEST=str(TMP / "secrets"), NETWORKS_CONFIG_TEST=str(TMP / "networks.json"),
               NETWORKS_LOG_TEST=str(TMP / "brands"), OAUTH_BROWSER_TEST="1",
               TIKTOK_AUTH_TEST=f"{base}/tt/auth", TIKTOK_API_TEST=f"{base}/tt", TIKTOK_REDIRECT_TEST=f"http://127.0.0.1:{oauth.free_port()}/callback/",
               YOUTUBE_AUTH_TEST=f"{base}/yt/auth", YOUTUBE_TOKEN_TEST=f"{base}/yt/token", YOUTUBE_API_TEST=f"{base}/yt/api",
               YOUTUBE_UPLOAD_TEST=f"{base}/yt/upload", YOUTUBE_ANALYTICS_TEST=f"{base}/yt/analytics",
               IG_GRAPH_TEST=base, IG_TOKEN_TEST="instagram-token")
    video = TMP / "test reel.mp4"
    video.write_bytes(os.urandom(300_000))
    client = TMP / "client_secret test.json"
    client.write_text(json.dumps({"installed": {"client_id": "cid", "client_secret": "csecret"}}), encoding="utf-8")
    (TMP / "secrets").mkdir(exist_ok=True)
    (TMP / "secrets" / f"{brand}-tiktok-app--oauth").write_text(json.dumps({"client_key": "ckey1234", "client_secret": "tt-long-secret-1234"}), encoding="utf-8")

    def step(tool, *args):
        rc, out = run([sys.executable, TOOLS / tool, *args], env=env, timeout=120)
        if rc or "Traceback" in out:
            raise RuntimeError(f"{tool} {' '.join(map(str, args[:2]))}: {out[-700:]}")
        return out

    try:
        step("tiktok.py", "connect", brand)
        step("tiktok.py", "test", brand)
        step("tiktok.py", "upload", brand, video, "--approved", "yes, upload it (test)", "--copy", "Text «test» ñ")
        step("tiktok.py", "videos", brand, "5")
        step("youtube.py", "connect", brand, "--client", client)
        step("youtube.py", "test", brand)
        step("youtube.py", "upload", brand, video, "--title", "Test ñ", "--privacy", "unlisted", "--approved", "yes (test)")
        step("youtube.py", "videos", brand, "5")
        step("facebook.py", "connect", brand)
        step("facebook.py", "test", brand)
        step("facebook.py", "upload", brand, video, "--approved", "yes (test)", "--copy", "hello")
        step("facebook.py", "reels", brand, "5")
        status = step("connect.py", "status", brand)
        rc, out = run([sys.executable, TOOLS / "youtube.py", "upload", brand, video, "--title", "x", "--privacy", "public"], env=env)
        if rc == 0 or "approved" not in out:
            raise RuntimeError("youtube.py uploaded without --approved")
    finally:
        stop()
    tt = seen.get("tt_token", [{}])[0]
    import hashlib
    if hashlib.sha256(tt.get("code_verifier", "").encode()).hexdigest() != seen.get("/tt/auth", {}).get("code_challenge"):
        raise RuntimeError("TikTok: the PKCE challenge is not the hexadecimal SHA-256 of the verifier")
    if seen["chunks"] != [(f"bytes 0-{300_000 - 1}/300000", 300_000)]:
        raise RuntimeError(f"TikTok: chunks sent wrong: {seen['chunks']}")
    if seen.get("yt_bytes") != 300_000 or seen.get("fb_bytes") != 300_000:
        raise RuntimeError(f"the whole video did not arrive: YouTube {seen.get('yt_bytes')}, Facebook {seen.get('fb_bytes')}")
    if seen.get("yt_meta", {}).get("status", {}).get("privacyStatus") != "unlisted":
        raise RuntimeError(f"YouTube: privacy sent wrong: {seen.get('yt_meta')}")
    if [f.get("upload_phase") for f in seen.get("fb", [])] != ["start", "finish"]:
        raise RuntimeError(f"Facebook: phases sent wrong: {seen.get('fb')}")
    log = (TMP / "brands" / brand / "pulse" / "uploads.jsonl").read_text(encoding="utf-8").splitlines()
    if len(log) != 3 or not all("approved" in json.loads(x) for x in log):
        raise RuntimeError(f"the upload log did not record the 3 with their approval: {log}")
    if status.count("✓") != 3:
        raise RuntimeError(f"connect.py status does not see the 3 networks connected:\n{status}")
    return "TikTok (PKCE hex, draft), YouTube (resumable upload, privacy), Facebook (start -> upload -> finish), log and status"


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
        for attempt in (1, 2):  # a cold Chrome on a busy machine can miss Remotion's 25 s connect window once
            rc, out = run([*system.remotion(reel), "still", "src/index.ts", comp, png, "--frame=30", *system.remotion_browser(),
                           "--log=error"], cwd=reel, timeout=900)
            if not rc and png.exists():
                break
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
            server_log = TMP / "state" / "server.log"
            tail = server_log.read_text(encoding="utf-8", errors="replace")[-1500:] if server_log.exists() else "(no server.log)"
            raise RuntimeError(f"Montage did not start in the temporary folders; the real one is left alone. {out[-400:]}\n{tail}")
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
            names = sorted(set((m.group(1) or "") + m.group(2) for m in re.finditer(r"brew install (--cask )?([a-z0-9][\w@.+\-]*)", text)))
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
