"""The automatic checks: what gets done even if the AI forgets. Claude Code runs them on its own (hooks in
.claude/settings.json), not the AI. They were born from a creator's reel: "I think you skip a lot of the plugin's steps".

    start     (when the session starts)    tells the AI which pieces are open, what stage they're at and which lessons are missing
    message   (when the person writes)     if they reject or correct something, or confirm a taste, reminds it to leave the lesson
    after     (after each step)            records the output/ videos this session made and warns if a key file shrank
    end       (when each turn ends)        won't let the turn end if a video from this session is left without its full review,
                                           if a stage was left behind without the approval recorded, or if a rejection has no
                                           lesson. It stops once; if nothing changes, it tells the person and doesn't insist.

Ways out that the person leaves, in their own words (never the AI on its own):
    python3 production/tools/guard.py skip <video> "what they said"   # that video isn't reviewed (written down next to it)
    python3 production/tools/guard.py no-lesson "why"                 # what they said wasn't a rejection

Each check reads the JSON Claude Code sends and answers in JSON. It never breaks the session: if something fails, it says nothing.
The person talks to the AI in their own language, so the rejection and taste phrases are matched in English and Spanish.
"""
import system

system.prepare(args=1)
import datetime as dt
import glob
import json
import re
import subprocess
import sys
import time
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import lessons  # noqa: E402
import locks  # noqa: E402
import stage  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
CACHE = system.cache_dir("creator-os", "guard")
WATCHED = ["AGENTS.md", "CLAUDE.md", "WORKFLOW.md", "MAP.md", "production/*.md", ".claude/skills/*/SKILL.md", ".claude/agents/*.md",
           "brands/*/BRAND.md", "brands/*/NICHE.md", "brands/*/PROFILE.md", "brands/*/OWN-STYLE.md", "brands/*/pieces/*/STATUS.md"]
WHERE_A_TASTE_GOES = ["production/LESSONS.md", "brands/*/BRAND.md", "brands/*/OWN-STYLE.md", "montage/projects/*/context.md",
                      "production/SOUNDS.md", "production/REELS-QUALITY.md"]
HELPERS = ("[Subagent hand-back]", "<agent-message", "<task-notification>")  # messages that aren't from the person
REJECTION = re.compile(
    # English
    r"\b(i (dont|do not|didnt) like|dont like (it|this|that)|(cant|cannot|can not) (hear|read|understand|see)|cant be heard|"
    r"hard to (hear|read|understand)|disappoint|doesnt work|ugly|awful|terrible|childish|laser|abstract|generic|"
    r"same (thing )?again|i told you|i already (told|said)|not what i|thats wrong|its wrong|(looks|sounds|feels) (off|weird|wrong|strange)|"
    r"too (loud|quiet|soft|harsh|slow|fast|long|short|cramped)|boring|bland|you skip|you didnt (review|check)|"
    # Spanish
    r"no me gust|no se (escucha|oye|entiende|lee|ve bien)|no se escuchan|decepcion|no sirve|feo|horrible|infantil|"
    r"rayos? laser|otra vez lo mismo|te dije|ya te (habia|dije)|no era eso|esta mal|quedo mal|"
    r"muy (duro|duros|suave|suaves|lento|rapido|largo|corto|pegad)|no me convence|insipid|aburrid|te saltas|"
    r"no lo revisaste|ni al inicio|no se nota|se ve raro|suena raro|extran)")
TASTE = re.compile(
    r"\b(exactly (that|what)|finally (it|you|got|works|nailed)|at last|i love (it|this)|loved it|perfect like this|thats it|thats what i need|nailed it|"
    r"exactamente (eso|lo que)|por fin|me encanto|me gusto mucho|asi si|perfecto asi|eso es lo que necesito|casi la perfeccion)")


def normal(s):
    """Lowercase, no accents and no apostrophes ("don't" → "dont"), so the phrases match however they're typed."""
    return unicodedata.normalize("NFKD", s.lower()).encode("ascii", "ignore").decode().replace("'", "")


def rel(p):
    try:
        return str(Path(p).resolve().relative_to(REPO))
    except ValueError:
        return str(p)


# ---------------------------------------------------------------- what each session remembers
def state_file(sid):
    return CACHE / f"{re.sub(r'[^A-Za-z0-9_-]', '', sid or '') or 'no-session'}.json"


def load(sid):
    try:
        return json.loads(state_file(sid).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        now = time.time()
        return {"start": now, "last": now, "videos": {}, "pieces": [], "rejection": None, "warned": {}}


def save(sid, st):
    CACHE.mkdir(parents=True, exist_ok=True)
    state_file(sid).write_text(json.dumps(st, ensure_ascii=False, indent=1), encoding="utf-8")


def answer(d):
    print(json.dumps(d, ensure_ascii=False))


def output_videos():
    return [Path(x) for pattern in ("*.mp4", "*.mov") for x in glob.glob(str(REPO / "brands" / "*" / "pieces" / "*" / "output" / pattern))]


def pieces():
    return [Path(x).parent for x in glob.glob(str(REPO / "brands" / "*" / "pieces" / "*" / "STATUS.md"))]


# ---------------------------------------------------------------- when the session starts
def start(data, st):
    for old in CACHE.glob("*.json"):
        if old.name != "no-lesson.json" and time.time() - old.stat().st_mtime > 14 * 86400:
            old.unlink()
    L = ["Automatic checks in this repo (production/tools/guard.py): when each turn ends, they check that every new video in "
         "output/ has its full review (review.py --stage N, \"What I saw\" and the reel-reviewer agent with every axis at 8 or more), "
         "that every stage left behind has the person's approval recorded and that every rejection of theirs leaves its lesson. "
         f"Each stage is worked with `{system.PY} production/tools/stage.py <piece>` (what's next), `… run`, `… close <video>`, "
         "`… ready <video>` and `… approve N \"their words\"`."]
    open_ = []
    for P in pieces():
        try:
            e = stage.read_status(P)
        except OSError:
            continue
        if e["done"] or e["current"] is None or time.time() - (P / "STATUS.md").stat().st_mtime > 30 * 86400:
            continue
        name = e["rows"].get(e["current"], {}).get("stage") or locks.STAGES.get(e["current"], {}).get("name", "?")
        open_.append(f"{rel(P)}: stage {e['current']} · {name}")
    if open_:
        L.append("Open pieces: " + "; ".join(open_) + ".")
    try:
        lacking = lessons.pending(show=False)
    except OSError:
        lacking = []
    if lacking:
        L.append("Low-star versions that haven't left a lesson yet: " + "; ".join(
            f"{x['version']} of \"{x['project']}\" ({x['stars']}★)" for x in lacking[:5]) +
                 ". Write them with lessons.py add <stage> \"…\" --from \"<project> <vN>\".")
    for cal in sorted(REPO.glob("brands/*/pulse/CALIBRATION.md")):
        line = next((l for l in cal.read_text(encoding="utf-8").split("\n") if l.startswith("**In short:**")), None)
        if line:
            L.append(f"Calibration of {cal.parts[-3]} (the reviewer and the person against the audience): {line.replace('**In short:**', '').strip()}")
    answer({"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": "\n".join(L)}})


# ---------------------------------------------------------------- when the person writes
def message(data, st):
    text = data.get("prompt") or ""
    if any(m in text for m in HELPERS):  # a subagent's report or a system notice: the person didn't write it
        return
    t = normal(text)
    if REJECTION.search(t):
        kind = "rejects or corrects something"
    elif TASTE.search(t):
        kind = "confirms something they liked"
    else:
        return
    st["rejection"] = {"ts": time.time(), "text": re.sub(r"\s+", " ", text).strip()[:140], "kind": kind}
    answer({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext":
            f"Automatic check: it looks like the person {kind}. Before this turn ends, leave the lesson in one line, with their "
            f"words: {system.PY} production/tools/lessons.py add <stage|always> \"what happened and how it's avoided (or what worked, "
            f"with its numbers)\" --said \"their words\" [--from \"<project> vN\"]. If it's only about this piece, it goes in Montage's "
            f"context; if it's about the brand, in its BRAND.md or OWN-STYLE.md. If it wasn't that: {system.PY} production/tools/guard.py "
            f"no-lesson \"why\"."}})


# ---------------------------------------------------------------- after each step
def lines_in_head(r):
    p = subprocess.run(["git", "show", f"HEAD:{r}"], cwd=REPO, capture_output=True)
    return p.stdout.decode("utf-8", "ignore").count("\n") if p.returncode == 0 else None


def after(data, st):
    now = time.time()
    input_txt = json.dumps(data.get("tool_input") or {}, ensure_ascii=False)
    text = input_txt + json.dumps(data.get("tool_response") or "", ensure_ascii=False)
    # the output/ videos this step made: named in the command or in what it answered, or from a piece it named
    for v in output_videos():
        mt = v.stat().st_mtime
        if mt < st["start"] - 2:
            continue
        P = v.parent.parent
        # the piece has to be named: another piece's "reel-v1.mp4" (from another chat) isn't this session's
        if P.name in text and (v.name in text or mt >= st["last"] - 2):
            st["videos"][rel(v)] = mt
    # the pieces whose STATUS.md this step touched
    for P in pieces():
        if (P / "STATUS.md").stat().st_mtime >= st["last"] - 2 and P.name in input_txt and rel(P) not in st["pieces"]:
            st["pieces"].append(rel(P))
    # a key file that shrank a lot (once a script emptied LESSONS.md)
    warnings = []
    for pattern in WATCHED:
        for f in REPO.glob(pattern):
            if f.stat().st_mtime < st["last"] - 2:
                continue
            r = rel(f)
            before = lines_in_head(r)
            now_n = f.read_text(encoding="utf-8", errors="ignore").count("\n")
            k = f"shrank:{r}:{now_n}"
            if before and before >= 20 and now_n < 0.7 * before and k not in st["warned"]:
                st["warned"][k] = 1
                warnings.append(f"{r} had {before} lines in the last commit and now has {now_n}")
    st["last"] = now
    if warnings:
        answer({"decision": "block", "reason": "Automatic check: a key file shrank a lot — " + "; ".join(warnings) +
                ". If it wasn't on purpose, recover what's missing (git diff and git show HEAD:<file>; the lessons also have a copy "
                "in lessons.py's cache) before going on. If it was on purpose, go on."})


# ---------------------------------------------------------------- when each turn ends
def resolved(rej):
    for pattern in WHERE_A_TASTE_GOES:
        if any(f.stat().st_mtime > rej["ts"] for f in REPO.glob(pattern)):
            return True
    try:
        done = json.loads((CACHE / "no-lesson.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        done = []
    return any(x.get("ts", 0) > rej["ts"] for x in done)


def problems(st):
    out = []
    for r, _ in sorted(st["videos"].items()):
        v = REPO / r
        if not v.exists() or (locks.report_of(v).parent / "SKIPPED.md").exists():
            continue
        lacking, _ = locks.video_status(v)
        if lacking:
            out.append((f"video:{r}:{int(v.stat().st_mtime)}", f"{r}: " + "; ".join(lacking),
                        f"the video {v.name} doesn't have its full review"))
    for r in st["pieces"]:
        P = REPO / r
        if (P / "STATUS.md").exists():
            for p in stage.status_problems(P):
                out.append((f"piece:{r}:{p[:60]}", f"{r}/STATUS.md: {p}", f"\"{P.name}\" has a stage without your approval recorded"))
    rej = st.get("rejection")
    if rej and not resolved(rej):
        out.append((f"rejection:{int(rej['ts'])}", f"the person {rej.get('kind', 'rejected something')} (\"{rej['text']}\") and no lesson was left",
                    f"what you said (\"{rej['text'][:60]}\") wasn't recorded as a lesson"))
    return out


def end(data, st):
    found = problems(st)
    if not found:
        return
    w = st["warned"]
    if not data.get("stop_hook_active") and any(w.get(k, 0) == 0 for k, _, _ in found):
        for k, _, _ in found:
            w[k] = max(w.get(k, 0), 1)
        answer({"decision": "block", "reason": "Automatic check (guard.py), before ending:\n" + "\n".join(f"- {d}" for _, d, _ in found) +
                f"\nFix it now: each video is closed with `{system.PY} production/tools/stage.py <piece> close <video>`, \"What I saw\" "
                "and the reel-reviewer agent; each approval is recorded with `stage.py <piece> approve N \"their words\"`; each lesson with "
                "`lessons.py add`. If the person decided to skip it, in their words: `guard.py skip <video> \"what they said\"` or "
                "`guard.py no-lesson \"why\"`. If it depends on them, tell them in one line."})
        return
    pending = [(k, p) for k, _, p in found if w.get(k, 0) < 2]
    if pending:
        for k, _ in pending:
            w[k] = 2
        answer({"systemMessage": "Still pending: " + "; ".join(dict.fromkeys(p for _, p in pending)) + "."})


# ---------------------------------------------------------------- what the person decides
def skip(video, said):
    v = Path(video).resolve()
    d = locks.report_of(v).parent
    d.mkdir(parents=True, exist_ok=True)
    (d / "SKIPPED.md").write_text(f"# No review, the person's decision\n\n{dt.date.today().isoformat()}: \"{said.strip()}\"\n", encoding="utf-8")
    print(f"Recorded: {rel(v)} stays without a review because the person said \"{said.strip()}\".")


def no_lesson(why):
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / "no-lesson.json"
    try:
        done = json.loads(f.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        done = []
    done = (done + [{"ts": time.time(), "why": why.strip()}])[-50:]
    f.write_text(json.dumps(done, ensure_ascii=False, indent=1), encoding="utf-8")
    print("Recorded: it wasn't a rejection; the check won't insist.")


if __name__ == "__main__":
    command = sys.argv[1]
    if command == "skip" and len(sys.argv) > 3:
        skip(sys.argv[2], sys.argv[3])
    elif command == "no-lesson" and len(sys.argv) > 2:
        no_lesson(sys.argv[2])
    elif command in ("start", "message", "after", "end"):
        try:
            data = json.loads(sys.stdin.read() or "{}")
        except ValueError:
            data = {}
        sid = data.get("session_id")
        try:
            st = load(sid)
            {"start": start, "message": message, "after": after, "end": end}[command](data, st)
            save(sid, st)
        except Exception as e:  # a check never breaks the session
            print(f"guard.py {command}: {e}", file=sys.stderr)
        sys.exit(0)
    else:
        sys.exit(__doc__)
