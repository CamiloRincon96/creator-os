"""Creator OS up to date: checks whether there's a new version of the repo and applies it without losing anything of the person's.
The creator, Nov 18, 2026: "it should constantly check whether there's a new version… and apply it… whenever you think it's best".

    python3 production/tools/update.py status        # is there a new version? (looks online if the last check is over 3 h old)
    python3 production/tools/update.py check         # the same, looking right now
    python3 production/tools/update.py apply         # applies it and does whatever comes after (npm, building Montage)
    python3 production/tools/update.py auto yes|no   # when each session starts: apply it on its own (yes, the default) or just say so (no)

When it runs on its own (guard.py, the automatic checks in .claude/settings.json):
  - when the session starts it checks and, if it can do so without touching anything of the person's, applies it; the AI tells
    them in one line;
  - while you work, it checks in the background every 3 hours (without stopping anything) and, if there's a new one, tells the
    AI to apply it at the next safe pause: with the stage closed and no render, post or Montage wait half done.

It never loses anything of the person's:
  - it only moves forward (git merge --ff-only): if the new version changes a file the person also changed, or if this copy has
    saved changes that aren't upstream, it touches nothing and says which ones, so they can be merged with their yes;
  - their brands, ideas, pieces and videos are their own files: the update doesn't touch them.
"""
import system

system.prepare()
import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CACHE = system.cache_dir("creator-os", "update") / (hashlib.sha1(str(REPO).encode()).hexdigest()[:12] + ".json")
EVERY = 3 * 3600  # how often it checks in the background while you work
MONTAGE = "montage"
INSTALLER = "production/install.py"


def git(*args, timeout=30):
    env = dict(os.environ, GIT_TERMINAL_PROMPT="0", LC_ALL="C")  # never asks for a password: without a stored credential, it fails quietly
    try:
        return subprocess.run(["git", *args], cwd=REPO, capture_output=True, text=True, timeout=timeout, env=env)
    except (OSError, subprocess.TimeoutExpired) as e:
        return subprocess.CompletedProcess(args, 1, "", str(e))


def output(*args, timeout=30):
    r = git(*args, timeout=timeout)
    return r.stdout.strip() if r.returncode == 0 else None


def read_cache():
    try:
        return json.loads(CACHE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def save_cache(d):
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    tmp = CACHE.with_suffix(".tmp")
    tmp.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(tmp, CACHE)


def auto():
    return (output("config", "--local", "--get", "creatoros.autoupdate") or "true") != "false"


def mid_operation():
    """A merge or a rebase half done in git: nothing gets touched."""
    g = output("rev-parse", "--git-dir")
    d = (REPO / g) if g else None
    return bool(d) and any((d / x).exists() for x in ("MERGE_HEAD", "rebase-merge", "rebase-apply", "CHERRY_PICK_HEAD"))


def upstream():
    return output("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}")


def measure(r, error=""):
    """What the new version brings, with what git already downloaded (no internet)."""
    d = {"date": time.time(), "upstream": r, "error": error}
    d["behind"] = int(output("rev-list", "--count", "HEAD..@{u}") or 0)
    d["ahead"] = int(output("rev-list", "--count", "@{u}..HEAD") or 0)
    d["head"] = output("rev-parse", "@{u}") or ""
    d["changes"] = (output("log", "--no-merges", "--format=%s", "HEAD..@{u}") or "").split("\n")[:8] if d["behind"] else []
    d["files"] = (output("diff", "--name-only", "HEAD...@{u}") or "").split("\n") if d["behind"] else []
    d["files"] = [a for a in d["files"] if a]
    # what the person changed that the new version also brings: there it doesn't move forward on its own
    touched = set()
    st = git("status", "--porcelain", "--untracked-files=all")  # no strip: the first column can be a space
    for l in (st.stdout if st.returncode == 0 else "").split("\n"):
        if len(l) > 3:
            touched.add(l[3:].split(" -> ")[-1].strip('"'))
    d["clashes"] = sorted(touched & set(d["files"]))
    return d


def check(force=False, timeout=20):
    """{"date", "upstream", "behind", "ahead", "head", "changes", "files", "clashes", "error"}, or None if it isn't a clone with its
    origin. It only goes online when asked (force) or when the last check is over 3 hours old."""
    c = read_cache()
    if not force and c and time.time() - c.get("date", 0) < EVERY:
        return c
    r = upstream()
    if not r:
        return None
    name, _, branch = r.partition("/")
    f = git("fetch", "--quiet", name, branch, timeout=timeout)
    d = measure(r, f.stderr.strip()[-300:] if f.returncode else "")
    save_cache(d)
    return d


def already_here(d):
    """The version that was seen is already here (the person updated by hand, or in another session)."""
    return not d.get("head") or git("merge-base", "--is-ancestor", d["head"], "HEAD").returncode == 0


def why_not(d):
    """Why it can't apply on its own (or None if it can)."""
    if mid_operation():
        return "git has a merge or a rebase half done"
    if d.get("ahead") and d.get("behind"):
        return f"this copy has {d['ahead']} saved change(s) that aren't upstream: they need merging"
    if d.get("clashes"):
        return "the new version changes files that also changed here: " + ", ".join(d["clashes"][:6])
    return None


def summary(d):
    items = "; ".join(x for x in d.get("changes", []) if x)
    return f"{d['behind']} change(s)" + (f": {items[:400]}" if items else "")


def after_steps(files, run=True):
    """What's needed after moving forward, based on what changed. With run=False it only says it (in the checks, which have little time)."""
    do, say = [], []
    npm = system.program("npm")
    montage = REPO / MONTAGE
    if any(a.startswith(f"{MONTAGE}/package") for a in files) and (montage / "node_modules").exists():
        do.append(("Montage's dependencies", [npm, "install", "--no-audit", "--no-fund"], montage))
    if any(a.startswith((f"{MONTAGE}/web/", f"{MONTAGE}/shared/", f"{MONTAGE}/package")) for a in files) and (montage / "web" / "dist").exists():
        do.append(("Montage's editor", [npm, "run", "build"], montage))
    if any(a.startswith(f"{MONTAGE}/server/") for a in files):
        say.append("Montage changed: if it's open, restart it (node montage/cli.mjs stop and then open)")
    if INSTALLER in files:
        say.append(f"the installer changed: run {system.PY} {INSTALLER} --check in case there's something new to install")
    if any(a.startswith(".claude/") for a in files):
        say.append("skills or checks changed: a new chat picks them up for sure")
    if any(a.startswith("plugin/") for a in files):
        say.append("the starter plugin changed: /plugin marketplace update creator-os (or /plugin's auto-update)")
    done = []
    for what, cmd, where in do:
        if not run:
            say.append(f"{what} still need updating: {' '.join(Path(cmd[0]).name if i == 0 else c for i, c in enumerate(cmd))} in {where.relative_to(REPO)}")
            continue
        r = subprocess.run(cmd, cwd=where, capture_output=True, text=True)
        (done if r.returncode == 0 else say).append(what if r.returncode == 0 else f"couldn't update {what}: {(r.stderr or r.stdout).strip()[-200:]}")
    return done, say


def apply(run_steps=True, fetch=True):
    """(applied, text for the person). With fetch=False it uses what git already downloaded (the checks have little time)."""
    r = upstream()
    d = check(force=True) if fetch else (measure(r) if r else None)
    if d is None:
        return False, "This folder isn't a git copy with its origin: there's nowhere to update from."
    if d.get("error") and not d.get("behind"):
        return False, f"I couldn't look for the new version (no internet?): {d['error']}"
    if not d.get("behind"):
        return False, "Creator OS is already up to date."
    reason = why_not(d)
    if reason:
        return False, f"There's a new version ({summary(d)}), but I didn't apply it on my own: {reason}. Nothing changed."
    before = output("rev-parse", "HEAD")
    r = git("merge", "--ff-only", "--quiet", d["upstream"], timeout=120)
    if r.returncode:
        return False, f"git couldn't move forward and nothing changed: {(r.stderr or r.stdout).strip()[-300:]}"
    files = [a for a in (output("diff", "--name-only", f"{before}..HEAD") or "").split("\n") if a]
    done, say = after_steps(files, run=run_steps)
    save_cache(dict(d, date=time.time(), behind=0, changes=[], files=[], clashes=[]))
    text = f"Creator OS up to date: {summary(d)}."
    if done:
        text += " I updated " + " and ".join(done) + "."
    if say:
        text += " Still to do: " + "; ".join(say) + "."
    return True, text


# ---------------------------------------------------------------- what the automatic checks use (guard.py)
def at_start():
    """When the session starts: always checks (with little time: without internet it fails fast and says nothing) and applies
    it if it can. Returns the line for the AI, or None."""
    if check(force=True, timeout=8) is None:
        return None
    d = measure(upstream())  # the current state, with what git already downloaded: the cache may be stale
    if not d.get("behind"):
        return None
    if auto() and not why_not(d):
        ok, text = apply(run_steps=False, fetch=False)
        if ok:
            return f"{text} Tell the person in one line, in their own words and without jargon, and do what \"Still to do\" says at a safe pause."
        return f"{text} Offer it with their yes: {system.PY} production/tools/update.py apply"
    reason = why_not(d) or "the person chose to only be told (update.py auto no)"
    return (f"There's a new version of Creator OS ({summary(d)}) that wasn't applied on its own: {reason}. Offer it in one line; with "
            f"their yes: {system.PY} production/tools/update.py apply (if there are clashes, merge them with the person, deleting nothing of theirs).")


def in_background(st):
    """While you work: checks in the background when it's time (without waiting) and, if there's a new version this session hasn't
    mentioned, returns the notice."""
    c = read_cache()
    if time.time() - c.get("date", 0) > EVERY and time.time() - st.get("background_check", 0) > 600:
        st["background_check"] = time.time()
        try:
            CACHE.parent.mkdir(parents=True, exist_ok=True)
            system.launch_detached([sys.executable, str(Path(__file__).resolve()), "check", "--quiet"],
                                   system.cache_dir("creator-os", "update") / "background.log")
        except OSError:
            pass
    if c.get("behind") and c.get("head") and st.get("version_noticed") != c["head"] and not already_here(c):
        st["version_noticed"] = c["head"]
        reason = why_not(c)
        return (f"There's a new version of Creator OS ({summary(c)}). Apply it at the next safe pause: when you finish what you're "
                f"doing, with the stage closed and no render, post or Montage wait half done: {system.PY} production/tools/update.py "
                f"apply. Then tell the person in one line what it brings."
                + (f" Heads-up: {reason}; merge it with them first, deleting nothing of theirs." if reason else ""))
    return None


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else "status"
    quiet = "--quiet" in sys.argv
    if command in ("status", "check"):
        d = check(force=command == "check")
        if quiet:
            sys.exit(0)
        if d is None:
            sys.exit("This folder isn't a git copy with its origin: there's nowhere to update from.")
        if d.get("error"):
            print(f"I couldn't look right now (no internet?): {d['error']}")
        if d.get("behind"):
            reason = why_not(d)
            print(f"There's a new version: {summary(d)}.")
            print(f"It doesn't apply on its own: {reason}." if reason else f"Apply it with: {system.PY} production/tools/update.py apply")
        else:
            print("Creator OS is up to date." + (f" (This copy has {d['ahead']} saved change(s) that aren't upstream.)" if d.get("ahead") else ""))
        print(f"Apply it on its own at the start: {'yes' if auto() else 'no'} (update.py auto yes|no).")
    elif command == "apply":
        ok, text = apply()
        print(text)
        sys.exit(0 if ok or "up to date" in text else 1)
    elif command == "auto" and len(sys.argv) > 2 and sys.argv[2] in ("yes", "no"):
        git("config", "--local", "creatoros.autoupdate", "false" if sys.argv[2] == "no" else "true")
        print("When each session starts: " + ("I only say so if there's a new version." if sys.argv[2] == "no" else "I apply it on my own if it doesn't touch anything of yours."))
    else:
        sys.exit(__doc__)
