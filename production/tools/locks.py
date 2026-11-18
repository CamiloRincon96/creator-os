"""The quality lock of each /creator-reel stage: what has to have happened before a version reaches the person.
review.py --stage N uses it to write into the report (REVIEW.md):
  - the lock: the stage's tools and skills, checked against what they leave in the piece (not against what the AI says);
  - the axes the independent reviewer scores (the reel-reviewer agent, .claude/agents/reel-reviewer.md), from 1 to 10.
Montage won't publish the version if anything is missing or if an axis is under 8 (montage/shared/review.js). It's strict
but never a dead end: only the person can decide to skip something, and it's written down with their words.

It was born from a creator's reel: the rules were written down but nothing made anyone follow them, the AI used the skills
late or halfway, and the creator ended up being the quality control ("let's set restrictions… review… score every iteration").

    python3 production/tools/locks.py              # what each stage requires
    python3 production/tools/locks.py <video> N    # how stage N's lock stands for that video
"""
import system

system.prepare()
import glob, json, os, re, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]


def project_of(P):
    """The piece's Montage project: the one its STATUS.md names, or <brand>-reel-<name> while it hasn't been created."""
    m = re.search(r"Montage project:\s*`([^`]+)`", (P / "STATUS.md").read_text(encoding="utf-8"))
    if m:
        return m.group(1)
    name = P.name.split("-", 3)[-1] if P.name[:4].isdigit() else P.name
    return f"{P.parent.parent.name}-reel-{name}"


def piece_of(video):
    """The piece's folder: the first one upwards that has STATUS.md. Variations live in
    brands/<brand>/finals/<project>/variations/: their piece is the one with that Montage project."""
    v = Path(video).resolve()
    for parent in v.parents:
        if (parent / "STATUS.md").exists():
            return parent
    try:
        parts = v.relative_to(REPO).parts
    except ValueError:
        return None
    if len(parts) > 4 and parts[0] == "brands" and parts[2] == "finals":
        for status in sorted((REPO / "brands" / parts[1] / "pieces").glob("*/STATUS.md")):
            if project_of(status.parent) == parts[3]:
                return status.parent
    return None


def _newest(P, pattern):
    found = sorted(glob.glob(str(P / pattern)), key=os.path.getmtime)
    return Path(found[-1]) if found else None


def _rel(p):
    try:
        return str(Path(p).resolve().relative_to(REPO))
    except ValueError:
        return str(p)


# ---------------------------------------------------------------- checks (they return (ok, proof or what's missing))
def exists(pattern, command):
    def f(P, video, N):
        a = _newest(P, pattern)
        return (True, _rel(a)) if a else (False, f"{pattern} isn't there: {command}")
    return f


def status_says_stage(P, video, N):
    t = (P / "STATUS.md").read_text(encoding="utf-8")
    m = re.search(r"\*\*Current stage:\*\*\s*(\d+)", t)
    if m and int(m.group(1)) == N:
        return True, f"{_rel(P / 'STATUS.md')} · stage {N}"
    return False, f"STATUS.md says stage {m.group(1) if m else '?'}: bring it up to date (stage {N}, what was done and what the person said)"


def effects_reviewed(P, video, N):
    rev = _newest(P, "work/effects/*/review.md")
    if not rev:
        return False, "missing: effects.py mix and then effects.py review (on the final mix, with the music)"
    t = rev.read_text(encoding="utf-8")
    covered = [int(x) for x in re.findall(r"(\d+) word\(s\) really covered", t)]
    if not covered:
        return False, f"{_rel(rev)} doesn't have the word-by-word proof: run effects.py review again"
    if any(covered):
        return False, f"{_rel(rev)}: an effect covers {max(covered)} word(s): lower it with \"adjust\" or use a shorter whoosh"
    return True, _rel(rev)


def effects_at_level(P, video, N):
    lev = _newest(P, "work/effects/*/levels.json")
    if not lev:
        return False, "missing: effects.py mix (it measures each effect against the voice)"
    m = json.loads(lev.read_text(encoding="utf-8")).get("median_vs_voice_dB")
    if m is None or m < -5:
        return False, f"the effects sit at {m} dB from the voice (the version that \"couldn't be heard\" was at −7.3; the niche, at +2.6)"
    return True, f"{_rel(lev)} · median {m:+.1f} dB against the voice"


def faces_clear(P, video, N):
    r = subprocess.run([sys.executable, str(HERE / "faces.py"), "check", str(video)], capture_output=True, text=True)
    if "nothing covers the face" in r.stdout:
        return True, "faces.py check: nothing covers the face"
    out = (r.stdout + r.stderr).strip()
    return False, f"faces.py check warns: {out.splitlines()[-1] if out else 'no answer'}"


def final_folder(P, video, N):
    parts = P.relative_to(REPO).parts
    brand = parts[1] if parts[0] == "brands" else None
    d = REPO / "brands" / str(brand) / "finals" / project_of(P)  # this piece's, not the brand's newest
    if not brand or not (d / "PUBLISH.md").exists():
        return False, f"this piece's final folder is missing: {_rel(d)}/ with the video, copy.txt, suggested-cover.jpg and PUBLISH.md"
    missing = [x for x in ("copy.txt", "suggested-cover.jpg") if not (d / x).exists()] + ([] if list(d.glob("*.mp4")) else ["the video"])
    if missing:
        return False, f"{_rel(d)}: missing {', '.join(missing)}"
    copy = (d / "copy.txt").read_text(encoding="utf-8").strip().splitlines()
    if len(copy) > 2 or "#" in " ".join(copy):
        return False, f"{_rel(d / 'copy.txt')}: two lines and no hashtags"
    return True, _rel(d)


def variations_approved(P, video, N):
    if video and "drafts" in Path(video).parts:
        return True, "draft: shown to get the plan approved"
    v = P / "variations.json"
    if not v.exists():
        return False, "variations.json with the plan is missing"
    if not json.loads(v.read_text(encoding="utf-8")).get("plan_approved"):
        return False, f"the variations plan isn't approved by the person: stage.py {_rel(P)} variations-plan \"their words\""
    return True, _rel(v)


def quote_approved(P, video, N):
    """Stage 8: no Higgsfield (or any other paid tool) without a quote the person approved in their own words."""
    sec = section_of((P / "STATUS.md").read_text(encoding="utf-8"), "Higgsfield quotes") or ""
    done = [l.strip() for l in sec.split("\n") if l.strip().startswith("- ") and 'approved: "' in l]
    if not done:
        return False, (f"there's no approved quote in {_rel(P / 'STATUS.md')}: stage.py {_rel(P)} quote \"what, with what and how many "
                       f"credits\" \"their words\" (if the retouch is free, say so: 0 credits)")
    return True, done[-1][:160]


# ---------------------------------------------------------------- the stages
STAGES = {
    3: {"name": "Voice cut", "skills": ["cut.py", "gaze.py", "review.py"],
        "lock": [("cut.py made the cut (never the transcriber's timings)", exists("voice/cut-v*.json", "python3 production/tools/cut.py <piece>")),
                 ("gaze.py said in which pieces the person looks at the lens", exists("voice/gaze-v*.json", "python3 production/tools/gaze.py <piece>"))],
        "axes": ["no cut eats a word", "the person is on screen only where they look at the lens", "even pace, no dead pauses", "it's understood in one go"]},
    4: {"name": "Voice", "skills": ["voice.py", "match_timbre.py", "listen.py"],
        "lock": [],
        "axes": ["every word is clear", "even timbre between takes", "even volume between phrases", "it sounds natural"]},
    5: {"name": "Visual script", "skills": ["visual_script.py", "mockup.py", "REELS-QUALITY.md (recipes)"],
        "lock": [("visual_script.py left the plan per phrase, with its real material", exists("visual-script.json", "python3 production/tools/visual_script.py <piece>"))],
        "axes": ["each phrase with real, specific material", "nothing abstract", "the visual hook in the first 3 s", "it's understood without knowing the tool"]},
    6: {"name": "Base image", "skills": ["blocks.py", "match_color.py", "gaze.py"],
        "lock": [],
        "axes": ["even color from take to take", "skin and framing", "nothing they don't want to show (the house)"]},
    7: {"name": "Animation", "skills": ["Remotion or HyperFrames", "the brand's style (production/styles/)", "REELS-QUALITY.md", "review.py"],
        "lock": [],
        "axes": ["hook (0 to 3 s)", "constant stimulus (something every 0.5 to 1 s)", "it's understood without knowing the tool", "visual before text, and the text can be read",
                 "one world: the identity from start to end", "the person: looks at the lens and nothing covers their face"]},
    8: {"name": "AI and retouching", "skills": ["Higgsfield (only with an approved quote)", "quote.py"],
        "lock": [("the quote approved by the person before generating", quote_approved)],
        "axes": ["it looks real, not \"made with AI\"", "consistent with the person and the place"]},
    9: {"name": "Sound", "skills": ["sound_study.py (the niche)", "effects.py (real-sfx)", "SOUNDS.md", "listen.py"],
        "lock": [("effects.py review on the final mix, with no covered words", effects_reviewed),
                 ("the effects at the voice's level, measured on the final mix", effects_at_level)],
        "axes": ["sound hook (something on frame 0)", "the effects can be heard (at the voice's level)", "nothing childish or \"laser beams\"", "the voice is always clear",
                 "the music low and even, no surges"]},
    10: {"name": "Review", "skills": ["review.py", "faces.py", "listen.py"],
         "lock": [("faces.py check: nothing covers the face", faces_clear)],
         "axes": ["hook", "pace", "clarity", "sound", "identity", "voice"]},
    11: {"name": "Delivery", "skills": ["instagram-agent:ig-caption + caption.py", "faces.py cover", "PUBLISH.md"],
         "lock": [("faces.py check: nothing covers the face", faces_clear),
                  ("the final folder with the video, copy.txt (two lines, no hashtags), the cover and PUBLISH.md", final_folder)],
         "axes": ["the copy hooks in its first line", "the cover can be read and has the face", "what gets published is the approved version"]},
    12: {"name": "Variations", "skills": ["variations.py", "production/variations/ (PROMPT, MUSIC, CALENDAR)"],
         "lock": [("the variations plan approved by the person", variations_approved)],
         "axes": ["each variation really changes the first 3 s", "no label on top", "the hook is understood without sound"]},
}
ALL = [("the piece's STATUS.md says this stage", status_says_stage)]

# What each stage runs on its own (stage.py <piece> run): the tools that don't need to decide anything. {piece} is the
# piece's folder, {video} the newest video in output/, {sheet} the newest effects sheet in work/ and {name} its name without
# "-sheet" (effects-vN). The creative part (the script, the animation, the effects sheet) is the AI's work, with its skills.
RUN = {
    3: [["cut.py", "{piece}"], ["gaze.py", "{piece}"]],
    4: [["voice.py", "{piece}"]],
    5: [["visual_script.py", "{piece}"]],
    6: [["blocks.py", "{piece}"]],
    9: [["effects.py", "mix", "{piece}", "{sheet}", "--name", "{name}"], ["effects.py", "review", "{piece}", "--name", "{name}"]],
    10: [["faces.py", "check", "{video}"]],
    11: [["faces.py", "check", "{video}"], ["faces.py", "cover", "{video}"]],
}


# ---------------------------------------------------------------- the report (the same thing Montage reads)
# A Python copy of montage/shared/review.js: if one changes, change the other. stage.py uses it (does it pass yet?) and so
# does guard.py (the check that won't let a turn end with a video left unreviewed).
MIN_SCORE = 8


def _no_comments(s):
    return re.sub(r"<!--[\s\S]*?-->", "", s)


def section_of(text, title):
    """The text of a section (## or ###) up to the next one of the same or higher level; None if it's missing."""
    lines = text.split("\n")
    i = next((k for k, l in enumerate(lines) if re.match(r"^#{2,3}\s", l) and re.sub(r"^#+\s*", "", l).strip().startswith(title)), None)
    if i is None:
        return None
    level = len(re.match(r"^#+", lines[i]).group(0))
    end = next((k for k in range(i + 1, len(lines)) if re.match(r"^#+\s", lines[k]) and len(re.match(r"^#+", lines[k]).group(0)) <= level), None)
    return _no_comments("\n".join(lines[i + 1:end]))


def read_review(text):
    what_i_saw = (section_of(text, "What I saw") or "").strip()
    floor = [l.strip() for l in (section_of(text, "Visual floor") or "").split("\n")]
    floor_unresolved = [l for l in floor if l.startswith("- [ ]") and not re.search(r"\bn/a\b|not applicable", l, re.I)]
    m = re.search(r"^## Stage (\d+)\s*·?\s*(.*)$", text, re.M)
    stage = {"n": int(m.group(1)), "name": m.group(2).strip()} if m else None
    lock = [l.strip() for l in (section_of(text, "Lock") or "").split("\n") if re.match(r"^- \[[ x]\]", l.strip(), re.I)]
    lock_pending = [re.sub(r"^- \[ \]\s*", "", l) for l in lock if l.startswith("- [ ]") and not re.search(r"skipped", l, re.I)]
    skipped = [re.sub(r"^- \[[ x]\]\s*", "", l, flags=re.I) for l in lock if re.search(r"skipped", l, re.I)]
    axes = []
    for l in (section_of(text, "Independent reviewer score") or "").split("\n"):
        c = re.match(r"^\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|", l)
        if not c or re.match(r"^axis$", c.group(1), re.I) or re.match(r"^:?-{2,}", c.group(1)):
            continue
        try:
            n = float(c.group(2).replace(",", "."))
            score = n if 1 <= n <= 10 else None
        except ValueError:
            score = None
        axes.append({"axis": c.group(1), "score": score})
    scores = [a["score"] for a in axes if a["score"] is not None]
    return {"what_i_saw": what_i_saw, "floor_unresolved": floor_unresolved, "stage": stage, "lock_pending": lock_pending,
            "skipped": skipped, "axes": axes, "average": round(sum(scores) / len(scores), 1) if scores else None,
            "minimum": min(scores) if scores else None, "verdict": (section_of(text, "Reviewer verdict") or "").strip()}


def missing(r, show_low=False):
    """What keeps the version from being shown (empty = it passes), in the same words as Montage."""
    f = []
    if not r["what_i_saw"]:
        f.append("\"## What I saw\" isn't written (what you looked at, what you found and what you fixed)")
    if r["floor_unresolved"]:
        f.append(f"{len(r['floor_unresolved'])} unresolved \"## Visual floor\" line(s)")
    if not r["stage"]:
        return f + ["the stage is missing: run review.py with --stage N"]
    f += [f"stage {r['stage']['n']} lock: {c}" for c in r["lock_pending"]]
    if not r["axes"] or any(a["score"] is None for a in r["axes"]):
        f.append("the independent reviewer's score is missing: run the reel-reviewer agent on this report")
    elif not show_low and r["minimum"] < MIN_SCORE:
        low = ", ".join(f"{a['axis']} ({a['score']:g})" for a in r["axes"] if a["score"] < MIN_SCORE)
        f.append(f"axes under {MIN_SCORE}: {low}")
    if not r["verdict"]:
        f.append("the independent reviewer's verdict is missing")
    return f


def report_of(video):
    """The path of a video's REVIEW.md (review.py leaves it in <video without extension>-review/)."""
    v = Path(video)
    return v.with_name(v.stem + "-review") / "REVIEW.md"


def video_status(video):
    """(list of what's missing, the report read or None). A report older than the video doesn't count: the video changed after it."""
    rev = report_of(video)
    if not rev.exists():
        return ["it has no review: run review.py <video> --stage N (or stage.py <piece> close <video>)"], None
    if rev.stat().st_mtime < Path(video).stat().st_mtime:
        return ["the video changed after its review: review it again"], None
    r = read_review(rev.read_text(encoding="utf-8"))
    return missing(r), r


def rounds(P, N):
    """How many stage-N versions the reviewer already sent back with "Fix" (the rule: after 2, talk to the person)."""
    n = 0
    for rev in P.glob("output/*-review/REVIEW.md"):
        r = read_review(rev.read_text(encoding="utf-8"))
        if r["stage"] and r["stage"]["n"] == N and r["verdict"].lstrip("*_ ").lower().startswith("fix"):
            n += 1
    return n


def check(video, N):
    """[(line, ok, proof)] of stage N's lock for that video."""
    if N not in STAGES:
        sys.exit(f"Unknown stage {N}: they go from {min(STAGES)} to {max(STAGES)} (python3 production/tools/locks.py)")
    P = piece_of(video)
    if P is None:
        return [("the video is inside a piece (with STATUS.md)", False, "the video isn't inside brands/<brand>/pieces/<piece>/")]
    out = []
    for line, f in STAGES[N]["lock"] + ALL:
        try:
            ok, proof = f(P, video, N)
        except Exception as e:  # a check that breaks doesn't pass
            ok, proof = False, f"couldn't check it: {e}"
        out.append((line, ok, proof))
    return out


def section(video, N):
    """What review.py adds to the report: the stage, its lock, the reviewer's table and its verdict."""
    s = STAGES[N]
    L = ["", f"## Stage {N} · {s['name']}", "",
         f"The stage's tools and skills: {', '.join(s['skills'])}.", "",
         "### Lock", "",
         "<!-- review.py checks it against what the tools leave in the piece. A line in [ ] is fixed by running the tool",
         "     and reviewing again. Only the person can skip one: it's written on the line as \"skipped: <name> said \"…\"\". -->"]
    for line, ok, proof in check(video, N):
        L.append(f"- [{'x' if ok else ' '}] {line} · {proof}")
    L += ["", "### Independent reviewer score", "",
          "<!-- The reel-reviewer agent (.claude/agents/reel-reviewer.md) fills it with fresh eyes, not whoever made the version:",
          "     1 to 10 per axis, with its proof (the second, the image, the measure). With an axis under 8, Montage won't publish. -->",
          "| axis | score | proof |", "|---|---|---|"] + [f"| {x} | — | |" for x in s["axes"]]
    L += ["", "### Reviewer verdict", "",
          "<!-- \"Show\" or \"Fix\", and the 3 worst problems, each with its second and how it's fixed. -->", ""]
    return L


if __name__ == "__main__":
    if len(sys.argv) == 3:
        for line, ok, proof in check(sys.argv[1], int(sys.argv[2])):
            print(f"[{'x' if ok else ' '}] {line} · {proof}")
    else:
        for n, s in STAGES.items():
            print(f"Stage {n} · {s['name']}\n  tools: {', '.join(s['skills'])}\n  lock: {'; '.join(c[0] for c in s['lock']) or '—'}"
                  f"\n  reviewer's axes: {', '.join(s['axes'])}")
