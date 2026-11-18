"""One stage, one command: what /creator-reel does at each stage of a piece, in order, so nothing gets skipped. It was born
from a creator's reel ("make it super strict about going through the steps and following the plugin"): the tools, the
review and the reviewer were chained by hand, and that's where steps got lost.

    python3 production/tools/stage.py <piece>                     # which stage it's at, what it requires and what's next (the exact command)
    python3 production/tools/stage.py <piece> run                 # runs the stage's automatic part (cut, voice, mix, faces…)
    python3 production/tools/stage.py <piece> close <video>       # review.py --stage N with its lock, and what's next
    python3 production/tools/stage.py <piece> ready <video>       # after the reviewer: does it pass? If so, the Montage command
    python3 production/tools/stage.py <piece> approve <N> "what the person said"   # records their approval and opens the next stage
    python3 production/tools/stage.py <piece> not-applicable <N> "why"              # the stage doesn't apply to this piece

Approvals are recorded with the person's words, never the AI's: "approve" only runs when they said yes in the chat or in
Montage. The creative part (the script, the animation, the effects sheet) isn't here: the AI does it with the stage's
skills, which this command reminds it of.
"""
import system

system.prepare(args=1)
import datetime as dt
import glob
import os
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import locks  # noqa: E402

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
DONE = ("approved", "n/a")
VIDEOS = ("*.mp4", "*.mov")


def today():
    d = dt.date.today()
    return f"{MONTHS[d.month - 1]} {d.day}, {d.year}"


def rel(p):
    try:
        return str(Path(p).resolve().relative_to(REPO))
    except ValueError:
        return str(p)


# ---------------------------------------------------------------- the piece's STATUS.md
def read_status(P):
    """{"current": N or None, "done": bool, "rows": {N: {stage, status, approved, output, i}}, "project": id, "lines": […]}."""
    text = (P / "STATUS.md").read_text(encoding="utf-8")
    lines = text.split("\n")
    rows = {}
    for i, l in enumerate(lines):
        m = re.match(r"^\|\s*(\d+)\s*\|", l)
        if m:
            cells = [c.strip() for c in l.strip().strip("|").split("|")]
            cells += [""] * (5 - len(cells))
            rows[int(m.group(1))] = {"stage": cells[1], "status": cells[2], "approved": cells[3], "output": " | ".join(cells[4:]).strip(" |"), "i": i}
    m = re.search(r"\*\*Current stage:\*\*\s*(\d+)?", text)
    current = int(m.group(1)) if m and m.group(1) else None
    pm = re.search(r"Montage project:\s*`([^`]+)`", text)
    brand = P.parent.parent.name
    name = P.name.split("-", 3)[-1] if P.name[:4].isdigit() else P.name
    return {"current": current, "done": bool(re.search(r"\*\*Current stage:\*\*[^\n]*\bDone\b", text)), "rows": rows,
            "project": pm.group(1) if pm else f"{brand}-reel-{name}", "lines": lines}


def status_problems(P):
    """What doesn't add up in the table: stages left behind without approval, approvals without a date or words."""
    e = read_status(P)
    out = []
    for n, f in sorted(e["rows"].items()):
        status = f["status"].lower()
        if e["current"] is not None and n < e["current"] and not status.startswith(DONE):
            out.append(f"stage {n} ({f['stage']}) was left behind as \"{f['status'] or 'empty'}\": approve it with the person's words "
                       f"(stage.py <piece> approve {n} \"…\") or mark it with not-applicable")
        if status.startswith("approved") and not f["approved"]:
            out.append(f"stage {n} ({f['stage']}) says \"approved\" but not when or what the person said")
    return out


def write(P, lines):
    """Writes STATUS.md without losing anything: a temporary file, then replaced in one go."""
    target = P / "STATUS.md"
    tmp = target.with_suffix(".md.tmp")
    tmp.write_text("\n".join(lines), encoding="utf-8")
    os.replace(tmp, target)


def set_row(lines, f, status, approved):
    cells = [c.strip() for c in lines[f["i"]].strip().strip("|").split("|")]
    cells += [""] * (5 - len(cells))
    cells[2], cells[3] = status, approved
    lines[f["i"]] = "| " + " | ".join(cells) + " |"


def log(lines, text):
    i = next((k for k, l in enumerate(lines) if l.strip() == "## Log"), None)
    if i is None:
        lines += ["", "## Log", "", text]
        return
    j = i + 1
    while j < len(lines) and not lines[j].startswith(("- ", "## ")):
        j += 1
    if j < len(lines) and lines[j].startswith("## "):  # empty log: it goes before the next heading
        lines[j:j] = [text, ""]
    else:
        lines.insert(j, text)


def advance(lines, e, after):
    """The "Current stage" line moves to the next stage still missing; if none is missing, the piece is done."""
    nxt = [n for n, f in sorted(e["rows"].items()) if n > after and not f["status"].lower().startswith(DONE)]
    i = next(k for k, l in enumerate(lines) if l.startswith("**Current stage:**"))
    if nxt:
        n = nxt[0]
        lines[i] = f"**Current stage:** {n} · {e['rows'][n]['stage']}"
        if e["rows"][n]["status"].lower() in ("", "pending"):
            set_row(lines, e["rows"][n], "in progress", e["rows"][n]["approved"])
        return n
    lines[i] = f"**Current stage:** {max(e['rows'])} · Done"
    return None


def mark(P, N, status, words):
    e = read_status(P)
    if N not in e["rows"]:
        sys.exit(f"The table in {rel(P / 'STATUS.md')} has no stage {N}.")
    if not words.strip():
        sys.exit("The person's words (or the reason) are missing: they go in quotes, just as they said them.")
    lines = list(e["lines"])
    approved = f"{today()} · \"{words.strip()}\"" if status == "approved" else f"{today()} · {words.strip()}"
    set_row(lines, e["rows"][N], status, approved)
    e2 = dict(e, rows={**e["rows"], N: {**e["rows"][N], "status": status}})
    nxt = advance(lines, e2, N) if e["current"] is None or N >= e["current"] else e["current"]
    what = "approved" if status == "approved" else "n/a"
    log(lines, f"- **{today()} · stage {N} ({e['rows'][N]['stage']}) {what}:** {chr(34) + words.strip() + chr(34) if status == 'approved' else words.strip()}")
    write(P, lines)
    print(f"Recorded in {rel(P / 'STATUS.md')}: stage {N} {what}.")
    if nxt is None:
        print("No stage left: the piece is done. If the person says so, cleanup comes next (clean.py, with their yes).")
    elif nxt != e["current"]:
        print(f"Next is stage {nxt} · {e['rows'][nxt]['stage']}: {system.PY} production/tools/stage.py {rel(P)}")


# ---------------------------------------------------------------- what's in the piece
def newest_video(P):
    found = [Path(x) for pattern in VIDEOS for x in glob.glob(str(P / "output" / pattern))]
    return max(found, key=lambda x: x.stat().st_mtime) if found else None


def newest_sheet(P):
    found = sorted(P.glob("work/effects-v*-sheet.json"), key=lambda x: x.stat().st_mtime)
    return found[-1] if found else None


def review_options(P, N):
    if N >= 5 and (P / "visual-script.json").exists():
        return ["--script", str(P / "visual-script.json")]
    return ["--cut", str(P)]


def lessons_block(N):
    text = (REPO / "production" / "LESSONS.md").read_text(encoding="utf-8")
    title = None
    for l in text.split("\n"):
        if l.startswith("## ") and re.match(r"Stages?\s+[\d\s,and]+", l[3:]) and N in {int(x) for x in re.findall(r"\d+", l.split("·")[0])}:
            title = l[3:].strip()
    return title


def show(P):
    e = read_status(P)
    N = e["current"]
    print(f"Piece: {rel(P)} · Montage: {e['project']}")
    if e["done"] or N is None:
        print("It's done." if e["done"] else "STATUS.md doesn't say the current stage (**Current stage:** N).")
        for p in status_problems(P):
            print(f"  ! {p}")
        return
    row = e["rows"].get(N, {})
    name = row.get("stage") or locks.STAGES.get(N, {}).get("name", "?")
    print(f"Stage {N} · {name} ({row.get('status') or 'not in the STATUS.md table'})")
    s = locks.STAGES.get(N)
    if s:
        print(f"  tools and skills: {', '.join(s['skills'])}")
        if s["lock"]:
            print(f"  lock: {'; '.join(c[0] for c in s['lock'])}")
        print(f"  what the reviewer scores: {', '.join(s['axes'])}")
    if locks.RUN.get(N):
        print(f"  the automatic part (stage.py {rel(P)} run): {'; '.join(' '.join(c) for c in locks.RUN[N])}")
    b = lessons_block(N)
    if b:
        print(f"  before showing anything: go over \"{b}\" in production/LESSONS.md")
    for p in status_problems(P):
        print(f"  ! {p}")
    v = newest_video(P)
    print()
    if not v:
        print("What's next: make this stage's version (the video goes straight into output/) and then:")
        print(f"  {system.PY} production/tools/stage.py {rel(P)} close <video>")
        return
    lacking, r = locks.video_status(v)
    print(f"Newest video: {rel(v)}")
    if r is None:
        print(f"What's next: {system.PY} production/tools/stage.py {rel(P)} close {rel(v)}")
        return
    print(next_step(P, e, v, lacking, r))


def next_step(P, e, v, lacking, r):
    N = r["stage"]["n"] if r.get("stage") else e["current"]
    report = rel(locks.report_of(v))
    if not lacking:
        return (f"It passes (reviewer: average {r['average']:g}, minimum {r['minimum']:g}). What's next:\n"
                f"  1. node montage/cli.mjs publish {e['project']} {rel(v)} --note \"Stage {N} · …\" --origin \"…\"\n"
                f"  2. to the person: the video's link ([{v.name}]({rel(v)})), the reviewer's score in one line and \"give it your stars in Montage\";\n"
                f"  3. with their yes, in their words: {system.PY} production/tools/stage.py {rel(P)} approve {N} \"what they said\"")
    steps = [f"Missing, in {report}:"] + [f"  - {x}" for x in lacking]
    if any("What I saw" in x for x in lacking):
        steps.append(f"  → look at EVERY image in {rel(locks.report_of(v).parent)} and write \"## What I saw\".")
    if any("lock" in x for x in lacking):
        steps.append(f"  → run the missing tool ({system.PY} production/tools/stage.py {rel(P)} run) and close again.")
    if any("independent reviewer" in x for x in lacking):
        steps.append(f"  → launch the reel-reviewer agent with only: the report {report}, stage {N} and the project {e['project']}. Not your conclusions.")
    if any("axes under" in x for x in lacking):
        n = locks.rounds(P, N)
        if n >= 2:
            steps.append(f"  → {n} rounds of \"Fix\" already at stage {N}: don't do another one blind. Tell the person what's going on, with the "
                         f"reviewer's notes, and decide together (only they can decide to see it as is: --show-low \"what they said\").")
        else:
            steps.append(f"  → fix what the verdict says and close the new version ({n} round(s) of \"Fix\" so far; at 2, you talk to the person).")
    return "\n".join(steps)


# ---------------------------------------------------------------- the commands
def run(P):
    e = read_status(P)
    N = e["current"]
    cmds = locks.RUN.get(N)
    if not cmds:
        print(f"Stage {N} has nothing automatic: it's the AI's work with its skills ({', '.join(locks.STAGES.get(N, {}).get('skills', [])) or '—'}).")
        return
    v, sheet = newest_video(P), newest_sheet(P)
    values = {"piece": str(P), "video": str(v) if v else None, "sheet": str(sheet) if sheet else None,
              "name": sheet.name.replace("-sheet.json", "") if sheet else None}
    for c in cmds:
        lacking = [k for k in re.findall(r"\{(\w+)\}", " ".join(c)) if not values.get(k)]
        if lacking:
            what = {"video": "a video in output/", "sheet": "the effects sheet in work/effects-vN-sheet.json", "name": "the effects sheet"}
            print(f"Skipping {c[0]}: missing {', '.join(what.get(k, k) for k in lacking)}.")
            continue
        args = [x.format(**values) for x in c]
        print(f"\n$ {system.PY} production/tools/{' '.join(args)}", flush=True)
        r = subprocess.run([sys.executable, str(HERE / args[0]), *args[1:]])
        if r.returncode:
            sys.exit(f"{args[0]} failed (code {r.returncode}): fix it before going on; what comes next isn't run.")
    print(f"\nStage {N}'s automatic part is done. When the version is ready: {system.PY} production/tools/stage.py {rel(P)} close <video>")


def close(P, video, N=None):
    e = read_status(P)
    N = N or e["current"]
    video = Path(video).resolve()
    if video.parent != (P / "output").resolve():
        print(f"Note: each version's video goes straight into {rel(P / 'output')}/, with no subfolders.")
    r = subprocess.run([sys.executable, str(HERE / "review.py"), str(video), "--stage", str(N), *review_options(P, N)])
    if r.returncode:
        sys.exit("review.py didn't finish: fix it and close again.")
    report = rel(locks.report_of(video))
    print(f"""
Now, in this order (the automatic check won't let the turn end with this video half done):
  1. Look at EVERY image listed in {report} and write "## What I saw"; resolve the "## Visual floor".
  2. If the lock has a line in [ ], run what's missing (stage.py {rel(P)} run) and close again.
  3. Launch the reel-reviewer agent with only: the report {report}, stage {N} and the project {e['project']}.
  4. {system.PY} production/tools/stage.py {rel(P)} ready {rel(video)}""")


def ready(P, video):
    e = read_status(P)
    lacking, r = locks.video_status(Path(video).resolve())
    if r is None:
        sys.exit(f"{lacking[0]}: {system.PY} production/tools/stage.py {rel(P)} close {rel(video)}")
    print(next_step(P, e, Path(video).resolve(), lacking, r))
    if lacking:
        sys.exit(1)


def piece(arg):
    p = Path(arg).resolve()
    for x in [p, *p.parents]:
        if (x / "STATUS.md").exists():
            return x
    sys.exit(f"{arg} isn't a piece (it has no STATUS.md). The pieces: {system.PY} production/tools/piece.py list")


if __name__ == "__main__":
    a = sys.argv[1:]
    P = piece(a[0])
    command = a[1] if len(a) > 1 else "status"
    if command == "status":
        show(P)
    elif command == "run":
        run(P)
    elif command == "close" and len(a) > 2:
        close(P, a[2], int(a[a.index("--stage") + 1]) if "--stage" in a else None)
    elif command == "ready" and len(a) > 2:
        ready(P, a[2])
    elif command in ("approve", "not-applicable") and len(a) > 3:
        mark(P, int(a[2]), "approved" if command == "approve" else "n/a", a[3])
    else:
        sys.exit(__doc__)
