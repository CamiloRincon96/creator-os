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


def piece_of(video):
    """The piece's folder: the first one upwards that has STATUS.md."""
    for parent in Path(video).resolve().parents:
        if (parent / "STATUS.md").exists():
            return parent
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
    pub = _newest(REPO / "brands" / str(brand) / "finals", "*/PUBLISH.md") if brand else None
    if not pub:
        return False, "the final folder is missing: brands/<brand>/finals/<project>/ with the video, copy.txt, suggested-cover.jpg and PUBLISH.md"
    d = pub.parent
    missing = [x for x in ("copy.txt", "suggested-cover.jpg") if not (d / x).exists()] + ([] if list(d.glob("*.mp4")) else ["the video"])
    if missing:
        return False, f"{_rel(d)}: missing {', '.join(missing)}"
    copy = (d / "copy.txt").read_text(encoding="utf-8").strip().splitlines()
    if len(copy) > 2 or "#" in " ".join(copy):
        return False, f"{_rel(d / 'copy.txt')}: two lines and no hashtags"
    return True, _rel(d)


def variations_approved(P, video, N):
    v = P / "variations.json"
    if not v.exists():
        return False, "variations.json with the plan is missing"
    if not json.loads(v.read_text(encoding="utf-8")).get("plan_approved"):
        return False, "the variations plan isn't approved (plan_approved) by the person"
    return True, _rel(v)


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
        "lock": [],
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
