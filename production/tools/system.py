"""What changes between macOS, Windows and Linux, in one place.

Which Python runs each tool, where Chrome is, how Remotion is called, where secrets, the cache and the logs are
kept, how a task is scheduled every hour and how a process that keeps running on its own is launched.
It only uses the standard library (and works from Python 3.9): it is imported before numpy and friends.

Every tool starts like this (venv=True if it uses the libraries in production/.venv):

    import system
    system.prepare(venv=True)

Nothing specific to one operating system goes outside this file: production/tests/portability.py checks it.
"""
import os
import shlex
import shutil
import subprocess
import sys
from pathlib import Path

MAC = sys.platform == "darwin"
WINDOWS = os.name == "nt"
LINUX = not MAC and not WINDOWS
PRODUCTION = Path(__file__).resolve().parents[1]
REPO = PRODUCTION.parent
VENV = PRODUCTION / ".venv"
PY = "python" if WINDOWS else "python3"  # what Python is called in this system's terminal


# ---------------------------------------------------------------- Python
def venv_python(create=False):
    """The Python in production/.venv: bin/python on macOS and Linux, Scripts/python.exe on Windows.
    With create=True it returns the path even if it does not exist yet (to create the environment)."""
    for p in (VENV / "Scripts" / "python.exe", VENV / "bin" / "python"):
        if p.exists():
            return p
    if create:
        return VENV / ("Scripts/python.exe" if WINDOWS else "bin/python")
    return None


def prepare(venv=False, args=0):
    """Relaunches the tool, if needed, so it runs the same on every system:
    - with the Python in production/.venv (venv=True): so `python3 production/tools/x.py` works on macOS, Windows
      and Linux, without typing the path of the environment, which differs from one system to another;
    - on Windows, in UTF-8 mode: without it, Python reads and writes text in cp1252 and accents and quotes break.
    With fewer than `args` arguments (or with -h, --help), it prints how to use the tool and exits."""
    caller = sys._getframe(1).f_globals
    if caller.get("__name__") == "__main__":
        if any(a in ("-h", "--help") for a in sys.argv[1:2]):
            print((caller.get("__doc__") or "").strip())
            sys.exit(0)
        if len(sys.argv) - 1 < args:
            sys.exit((caller.get("__doc__") or "Missing arguments.").strip())
    py = None
    if venv:
        py = venv_python()
        if py is None:
            sys.exit(f"The tools' Python environment is missing. Run first: {PY} production/install.py")
        if Path(sys.prefix).resolve() == VENV.resolve():
            py = None
    if py is None and (not WINDOWS or sys.flags.utf8_mode):
        return
    env = dict(os.environ, PYTHONUTF8="1")
    try:
        r = subprocess.run([str(py or sys.executable), *sys.argv], env=env)
    except KeyboardInterrupt:
        sys.exit(130)
    sys.exit(r.returncode)


def program(name):
    """The full path of a program on the PATH (on Windows, npm and npx are npm.cmd and npx.cmd), or the name as is."""
    return shutil.which(name) or name


# ---------------------------------------------------------------- Chrome and Remotion
def chrome():
    """Installed Google Chrome, or None. Remotion uses it if it is there; if not, it downloads its own browser."""
    if MAC:
        candidates = [Path(b) / "Google Chrome.app/Contents/MacOS/Google Chrome" for b in ("/Applications", Path.home() / "Applications")]
    elif WINDOWS:
        bases = [os.environ.get(v) for v in ("PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA")]
        candidates = [Path(b) / "Google" / "Chrome" / "Application" / "chrome.exe" for b in bases if b]
    else:
        candidates = [Path(p) for p in (shutil.which(n) for n in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser")) if p]
    return next((str(p) for p in candidates if p.exists()), None)


def remotion(project):
    """The Remotion CLI command of a project (brands/<brand>/reel): node and its entry file.
    No npx: on Windows npx is a .cmd, which goes through cmd.exe and mangles quoted arguments (the JSON in --props)."""
    cli = Path(project) / "node_modules" / "@remotion" / "cli" / "remotion-cli.js"
    node = shutil.which("node")
    if not node:
        sys.exit("Node.js is missing (see production/install.py).")
    if not cli.exists():
        sys.exit(f"The Remotion dependencies are missing in {project}: run {PY} production/install.py")
    return [node, str(cli)]


def remotion_browser():
    """The Remotion argument to use the installed Chrome, if there is one (an empty list if not)."""
    c = chrome()
    return [f"--browser-executable={c}"] if c else []


# ---------------------------------------------------------------- folders outside the repo
def cache_dir(app, *parts):
    """The app's cache: ~/Library/Caches (macOS), %LOCALAPPDATA% (Windows), ~/.cache (Linux)."""
    if MAC:
        base = Path.home() / "Library" / "Caches" / app
    elif WINDOWS:
        base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / app / "Cache"
    else:
        base = Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache")) / app
    return base.joinpath(*parts)


def logs_dir(app):
    """The app's logs: ~/Library/Logs (macOS), %LOCALAPPDATA%\\<app>\\Logs (Windows), ~/.local/state (Linux)."""
    if MAC:
        return Path.home() / "Library" / "Logs"
    if WINDOWS:
        return Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / app / "Logs"
    return Path(os.environ.get("XDG_STATE_HOME", Path.home() / ".local" / "state")) / app


# ---------------------------------------------------------------- secrets (tokens and keys)
# macOS: the keychain (security). Windows: the Credential Manager. Linux: secret-tool (libsecret), if present.
# On all of them, an environment variable wins over what is stored.

def _windows_credentials():
    import ctypes
    from ctypes import wintypes

    class CREDENTIAL(ctypes.Structure):
        _fields_ = [("Flags", wintypes.DWORD), ("Type", wintypes.DWORD), ("TargetName", wintypes.LPWSTR),
                    ("Comment", wintypes.LPWSTR), ("LastWritten", wintypes.FILETIME), ("CredentialBlobSize", wintypes.DWORD),
                    ("CredentialBlob", ctypes.POINTER(ctypes.c_char)), ("Persist", wintypes.DWORD),
                    ("AttributeCount", wintypes.DWORD), ("Attributes", ctypes.c_void_p), ("TargetAlias", wintypes.LPWSTR),
                    ("UserName", wintypes.LPWSTR)]

    advapi = ctypes.WinDLL("advapi32", use_last_error=True)
    advapi.CredWriteW.argtypes = [ctypes.POINTER(CREDENTIAL), wintypes.DWORD]
    advapi.CredWriteW.restype = wintypes.BOOL
    advapi.CredReadW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, ctypes.POINTER(ctypes.POINTER(CREDENTIAL))]
    advapi.CredReadW.restype = wintypes.BOOL
    advapi.CredDeleteW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD]
    advapi.CredDeleteW.restype = wintypes.BOOL
    advapi.CredFree.argtypes = [ctypes.c_void_p]
    return ctypes, CREDENTIAL, advapi


def _test(service, account):
    """Only in the tests (SECRETS_TEST=<temp folder>): one file per secret, so the real store is never touched."""
    folder = os.environ.get("SECRETS_TEST")
    return Path(folder) / f"{service}--{account}" if folder else None


def save_secret(service, account, value):
    """Saves a secret in the system's store. Returns where it went, or None if this system has no store."""
    if _test(service, account):
        _test(service, account).parent.mkdir(parents=True, exist_ok=True)
        _test(service, account).write_text(value, encoding="utf-8")
        return "the test store"
    if MAC:
        r = subprocess.run(["security", "add-generic-password", "-U", "-s", service, "-a", account, "-w", value], capture_output=True, text=True)
        if r.returncode:
            raise RuntimeError(r.stderr.strip() or "the keychain did not save it")
        return "the macOS keychain"
    if WINDOWS:
        ctypes, CREDENTIAL, advapi = _windows_credentials()
        blob = value.encode("utf-16-le")
        buf = ctypes.create_string_buffer(blob, len(blob))
        c = CREDENTIAL(Type=1, TargetName=service, UserName=account, CredentialBlobSize=len(blob),
                       CredentialBlob=ctypes.cast(buf, ctypes.POINTER(ctypes.c_char)), Persist=2)  # generic, on this machine
        if not advapi.CredWriteW(ctypes.byref(c), 0):
            raise RuntimeError(f"the Credential Manager did not save it (error {ctypes.get_last_error()})")
        return "the Windows Credential Manager"
    if shutil.which("secret-tool"):
        r = subprocess.run(["secret-tool", "store", f"--label={service}", "service", service, "account", account],
                           input=value, capture_output=True, text=True)
        if r.returncode:
            raise RuntimeError(r.stderr.strip() or "secret-tool did not save it")
        return "the system keyring (secret-tool)"
    return None


def read_secret(service, account):
    """The stored secret, or None."""
    if _test(service, account):
        f = _test(service, account)
        return f.read_text(encoding="utf-8") if f.exists() else None
    try:
        if MAC:
            r = subprocess.run(["security", "find-generic-password", "-s", service, "-a", account, "-w"], capture_output=True, text=True)
            return r.stdout.strip() if r.returncode == 0 and r.stdout.strip() else None
        if WINDOWS:
            ctypes, CREDENTIAL, advapi = _windows_credentials()
            p = ctypes.POINTER(CREDENTIAL)()
            if not advapi.CredReadW(service, 1, 0, ctypes.byref(p)):
                return None
            try:
                c = p.contents
                return ctypes.string_at(c.CredentialBlob, c.CredentialBlobSize).decode("utf-16-le").strip() or None
            finally:
                advapi.CredFree(p)
        if shutil.which("secret-tool"):
            r = subprocess.run(["secret-tool", "lookup", "service", service, "account", account], capture_output=True, text=True)
            return r.stdout.strip() if r.returncode == 0 and r.stdout.strip() else None
    except (OSError, ValueError):
        return None
    return None


def delete_secret(service, account):
    """Removes the secret, if it was there. The tests use it."""
    if _test(service, account):
        _test(service, account).unlink(missing_ok=True)
    elif MAC:
        subprocess.run(["security", "delete-generic-password", "-s", service, "-a", account], capture_output=True)
    elif WINDOWS:
        ctypes, _, advapi = _windows_credentials()
        advapi.CredDeleteW(service, 1, 0)
    elif shutil.which("secret-tool"):
        subprocess.run(["secret-tool", "clear", "service", service, "account", account], capture_output=True)


# ---------------------------------------------------------------- processes that keep running on their own
_NO_WINDOW = 0x08000000  # CREATE_NO_WINDOW (Windows)


def launch_detached(cmd, log_file):
    """Launches a process that keeps going even if the terminal or the Claude session closes. Returns its pid."""
    log = open(log_file, "a", encoding="utf-8")
    if WINDOWS:
        detached, group, breakaway = 0x00000008, 0x00000200, 0x01000000  # DETACHED_PROCESS, CREATE_NEW_PROCESS_GROUP, BREAKAWAY
        env = dict(os.environ, PYTHONUTF8="1")
        try:
            p = subprocess.Popen(cmd, stdout=log, stderr=log, stdin=subprocess.DEVNULL, env=env,
                                 creationflags=detached | group | breakaway)
        except OSError:  # the session does not allow leaving the job: without that flag
            p = subprocess.Popen(cmd, stdout=log, stderr=log, stdin=subprocess.DEVNULL, env=env, creationflags=detached | group)
    else:
        p = subprocess.Popen(cmd, stdout=log, stderr=log, stdin=subprocess.DEVNULL, start_new_session=True)
    return p.pid


def alive(pid):
    """Is that process still running? (On Windows, os.kill(pid, 0) does not ask: it kills it.)"""
    if not pid:
        return False
    if WINDOWS:
        import ctypes
        k = ctypes.WinDLL("kernel32", use_last_error=True)
        h = k.OpenProcess(0x1000, False, int(pid))  # PROCESS_QUERY_LIMITED_INFORMATION
        if not h:
            return False
        try:
            code = ctypes.c_ulong()
            return bool(k.GetExitCodeProcess(h, ctypes.byref(code))) and code.value == 259  # STILL_ACTIVE
        finally:
            k.CloseHandle(h)
    try:  # if it is a child of this process that already finished, reap it (otherwise it stays a zombie and looks alive)
        if os.waitpid(int(pid), os.WNOHANG)[0]:
            return False
    except ChildProcessError:
        pass
    try:
        os.kill(int(pid), 0)
        return True
    except PermissionError:  # it exists, but belongs to another user
        return True
    except OSError:
        return False


def terminate(pid):
    """Ends the process and whatever it launched."""
    if not alive(pid):
        return
    if WINDOWS:
        subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], capture_output=True)
        return
    import signal
    try:
        os.killpg(int(pid), signal.SIGTERM)
    except OSError:
        try:
            os.kill(int(pid), signal.SIGTERM)
        except OSError:
            pass


def keep_awake():
    """Keeps the computer from sleeping while this process is alive (a scheduled batch waits for hours)."""
    try:
        if MAC:
            subprocess.Popen(["caffeinate", "-is", "-w", str(os.getpid())], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        elif WINDOWS:
            import ctypes
            ctypes.WinDLL("kernel32").SetThreadExecutionState(0x80000001)  # ES_CONTINUOUS | ES_SYSTEM_REQUIRED
        elif shutil.which("systemd-inhibit"):
            subprocess.Popen(["systemd-inhibit", "--what=sleep:idle", "--why=scheduled batch", "tail", f"--pid={os.getpid()}", "-f", "/dev/null"],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except OSError:
        pass


def notify(title, text):
    """A system notification. If it cannot be shown, nothing happens: what matters stays in the log."""
    try:
        if MAC:
            import json
            subprocess.run(["osascript", "-e", f"display notification {json.dumps(text)} with title {json.dumps(title)}"], capture_output=True)
        elif WINDOWS:
            ps = ("[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null;"
                  "$x = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02);"
                  "$t = $x.GetElementsByTagName('text'); $t.Item(0).InnerText = $env:NOTIFY_TITLE; $t.Item(1).InnerText = $env:NOTIFY_TEXT;"
                  "$app = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe';"
                  "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($app).Show([Windows.UI.Notifications.ToastNotification]::new($x))")
            subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", ps], capture_output=True, timeout=20,
                           env=dict(os.environ, NOTIFY_TITLE=title, NOTIFY_TEXT=text), creationflags=_NO_WINDOW)
        elif shutil.which("notify-send"):
            subprocess.run(["notify-send", title, text], capture_output=True)
    except (OSError, subprocess.SubprocessError):
        pass


# ---------------------------------------------------------------- a task every hour
# macOS: launchd (~/Library/LaunchAgents). Windows: the Task Scheduler (schtasks). Linux: cron.

def _windowless_python():
    """On Windows, pythonw.exe: runs without opening a black window every hour."""
    exe = Path(sys.executable)
    w = exe.with_name("pythonw.exe")
    return str(w if WINDOWS and w.exists() else exe)


def hourly_task(action, name, script, args, log_file):
    """Installs, removes or checks a task that runs `python <script> <args…>` every hour, without Claude.
    action: "install" | "remove" | "status". The log file is passed to the script, which writes to it (--log)."""
    script = str(Path(script).resolve())
    log_file = Path(log_file)
    if MAC:
        plist = Path.home() / "Library" / "LaunchAgents" / f"{name}.plist"
        domain = f"gui/{os.getuid()}"
        if action == "install":
            plist.parent.mkdir(parents=True, exist_ok=True)
            log_file.parent.mkdir(parents=True, exist_ok=True)
            program_args = "".join(f"<string>{a}</string>" for a in [sys.executable, script, *args])
            plist.write_text(f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>{name}</string>
  <key>ProgramArguments</key><array>{program_args}</array>
  <key>StartInterval</key><integer>3600</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>{log_file}</string>
  <key>StandardErrorPath</key><string>{log_file}</string>
</dict></plist>
""", encoding="utf-8")
            subprocess.run(["launchctl", "bootout", domain, str(plist)], capture_output=True)
            r = subprocess.run(["launchctl", "bootstrap", domain, str(plist)], capture_output=True, text=True)
            if r.returncode:
                sys.exit(f"launchctl did not load it: {r.stderr.strip()}")
            return f"launchd ({plist})"
        if action == "remove":
            subprocess.run(["launchctl", "bootout", domain, str(plist)], capture_output=True)
            plist.unlink(missing_ok=True)
            return "removed"
        r = subprocess.run(["launchctl", "print", f"{domain}/{name}"], capture_output=True, text=True)
        return "installed and loaded" if r.returncode == 0 else ("installed but not loaded" if plist.exists() else "not installed")

    if WINDOWS:
        tn = name
        if action == "install":
            log_file.parent.mkdir(parents=True, exist_ok=True)
            tr = subprocess.list2cmdline([_windowless_python(), "-X", "utf8", script, *args, "--log", str(log_file)])
            if len(tr) > 261:
                sys.exit(f"The repo path is too long for the Task Scheduler ({len(tr)} of 261 characters): "
                         "move the repo to a shorter folder, such as C:\\creator-os")
            r = subprocess.run(["schtasks", "/Create", "/F", "/SC", "HOURLY", "/TN", tn, "/TR", tr], capture_output=True, text=True)
            if r.returncode:
                sys.exit(f"The Task Scheduler did not create it: {(r.stderr or r.stdout).strip()}")
            subprocess.run(["schtasks", "/Run", "/TN", tn], capture_output=True)
            return f"the Windows Task Scheduler (task \"{tn}\")"
        if action == "remove":
            subprocess.run(["schtasks", "/Delete", "/TN", tn, "/F"], capture_output=True)
            return "removed"
        r = subprocess.run(["schtasks", "/Query", "/TN", tn], capture_output=True, text=True)
        return "installed" if r.returncode == 0 else "not installed"

    if not shutil.which("crontab"):
        sys.exit("This system has no cron: schedule this by hand, every hour: " + " ".join([sys.executable, script, *args]))
    tag = f"# {name}"
    current = subprocess.run(["crontab", "-l"], capture_output=True, text=True)
    every = current.stdout.splitlines() if current.returncode == 0 else []
    lines = [x for x in every if not x.endswith(tag)]
    if action == "status":
        return "installed" if len(lines) != len(every) else "not installed"
    if action == "install":
        log_file.parent.mkdir(parents=True, exist_ok=True)
        lines.append(f"0 * * * * {shlex.join([sys.executable, script, *args, '--log', str(log_file)])} {tag}")
    subprocess.run(["crontab", "-"], input="\n".join(lines) + "\n", text=True, check=True)
    return "cron (crontab -l)" if action == "install" else "removed"


def log_to(argv):
    """If the hourly task passed --log <file>, everything printed goes to that file. Returns argv without it."""
    if "--log" not in argv:
        return argv
    i = argv.index("--log")
    path = Path(argv[i + 1])
    path.parent.mkdir(parents=True, exist_ok=True)
    f = open(path, "a", encoding="utf-8", buffering=1)
    sys.stdout = sys.stderr = f
    return argv[:i] + argv[i + 2:]
