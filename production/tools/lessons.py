"""The lessons (production/LESSONS.md) are written with this tool, never by hand with a script: it adds one line to its
stage's block without touching the others, checks that nothing was lost and keeps a copy first. Once a script emptied the
whole list (it opened the file for writing before reading it).

Tastes are learned on their own: each rejection or correction from the creator, and each "exactly that", leaves its
lesson in the same turn; the automatic checks (guard.py) remind the AI and won't let the turn end without it.

    python3 production/tools/lessons.py add <stage|always|technical> "the lesson" [--said "their words"] [--from "<project> vN"]
    python3 production/tools/lessons.py pending    # versions with 1 to 3 stars in Montage that haven't left a lesson yet
    python3 production/tools/lessons.py blocks     # which block takes each stage

The lesson says what happened, in which piece and how it's avoided, in one line (like the rest). With --from, the line is
tied to that Montage version and no longer shows up in "pending".
"""
import system

system.prepare(args=1)
import datetime as dt
import json
import os
import re
import shutil
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
LESSONS = REPO / "production" / "LESSONS.md"
PROJECTS = REPO / "montage" / "projects"
PERSON = "the creator"
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def today():
    d = dt.date.today()
    return f"{MONTHS[d.month - 1]} {d.day}, {d.year}"


def blocks(text):
    """[(index of the title line, title, stages it covers)] for each "## …" block."""
    out = []
    for i, l in enumerate(text.split("\n")):
        if not l.startswith("## "):
            continue
        title = l[3:].strip()
        if title.lower().startswith("always"):
            stages = {"always"}
        elif title.lower().startswith("technical"):
            stages = {"technical"}
        else:
            m = re.match(r"Stages?\s+([\d\s,and]+)", title)
            stages = {int(x) for x in re.findall(r"\d+", m.group(1))} if m else set()
        out.append((i, title, stages))
    return out


def key(stage):
    s = stage.strip().lower()
    return int(s) if s.isdigit() else s


def tied(text, project, version):
    return f"{version} of \"{project}\"" in text


def add(stage, lesson, said=None, source=None):
    before = LESSONS.read_text(encoding="utf-8")  # read first; the file isn't opened for writing until the end
    k = key(stage)
    block = next((b for b in blocks(before) if k in b[2]), None)
    if block is None and k == 13:  # cleanup goes with delivery
        block = next((b for b in blocks(before) if "cleanup" in b[1].lower()), None)
    if block is None:
        sys.exit(f"LESSONS.md has no block for \"{stage}\". The ones there are: lessons.py blocks")
    lesson = lesson.strip().rstrip(".") + "."
    if lesson[:-1] in before:
        print(f"It was already in \"{block[1]}\": it isn't added twice.")
        return
    origin = [PERSON, today()]
    if source:
        project, _, version = source.rpartition(" ")
        origin.append(f"{version} of \"{project}\"" if project else source)
    quote = f': "{said.strip()}"' if said else ""
    line = f"- {lesson} ({', '.join(origin)}{quote})"
    lines = before.split("\n")
    end = next((b[0] for b in blocks(before) if b[0] > block[0]), len(lines))
    last = max((i for i in range(block[0] + 1, end) if lines[i].strip()), default=block[0])
    after = "\n".join(lines[:last + 1] + [line] + lines[last + 1:])
    # nothing is lost: every line from before is still there, and there is exactly one more
    if after.split("\n").count(line) != 1 or len(after.split("\n")) != len(lines) + 1 or \
            [l for l in after.split("\n") if l != line] != lines:
        sys.exit("Not written: the result didn't keep every lesson from before.")
    copies = system.cache_dir("creator-os", "lessons")
    copies.mkdir(parents=True, exist_ok=True)
    shutil.copy2(LESSONS, copies / f"LESSONS-{dt.datetime.now():%Y%m%d-%H%M%S}.md")
    for old in sorted(copies.glob("LESSONS-*.md"))[:-20]:
        old.unlink()
    tmp = LESSONS.with_suffix(".md.tmp")
    tmp.write_text(after, encoding="utf-8")
    os.replace(tmp, LESSONS)
    print(f"Lesson added to \"{block[1]}\" (line {last + 2}):\n{line}")


def pending(show=True):
    """Versions the person gave 1 to 3 stars that have no tied lesson (--from)."""
    text = LESSONS.read_text(encoding="utf-8")
    out = []
    for pj in sorted(PROJECTS.glob("*/project.json")):
        try:
            p = json.loads(pj.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        for v in p.get("versions", []):
            per = (v.get("rating") or {}).get("person") or {}
            if per.get("stars") and per["stars"] <= 3 and not tied(text, p["id"], v["id"]):
                rev = (v.get("rating") or {}).get("reviewer") or {}
                out.append({"project": p["id"], "version": v["id"], "stars": per["stars"], "reviewer": rev.get("average")})
    if show:
        if not out:
            print("No low-star versions without their lesson.")
        for x in out:
            r = f" (the reviewer had given it {x['reviewer']})" if x["reviewer"] else ""
            print(f"- {x['version']} of \"{x['project']}\": {x['stars']} out of 5 stars{r} → "
                  f"lessons.py add <stage> \"what failed and how it's avoided\" --from \"{x['project']} {x['version']}\"")
    return out


def option(args, name):
    if name in args:
        i = args.index(name)
        value = args[i + 1] if i + 1 < len(args) else None
        del args[i:i + 2]
        return value
    return None


if __name__ == "__main__":
    args = sys.argv[1:]
    command = args.pop(0)
    if command == "add":
        said, source = option(args, "--said"), option(args, "--from")
        if len(args) < 2:
            sys.exit(__doc__)
        add(args[0], args[1], said, source)
    elif command == "pending":
        pending()
    elif command == "blocks":
        for _, title, stages in blocks(LESSONS.read_text(encoding="utf-8")):
            print(f"{', '.join(str(s) for s in sorted(stages, key=str)) or '—'}: {title}")
    else:
        sys.exit(__doc__)
