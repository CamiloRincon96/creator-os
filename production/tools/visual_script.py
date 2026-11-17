"""Stage 5: puts the real timings on the scenes and gets everything ready for the mockup.
Usage: python3 production/tools/visual_script.py <piece>

Reads <piece>/scenes.json (Claude writes it from script.md: the visual plan, with a "recipe" and a "material" per scene
following production/REELS-QUALITY.md) and the latest cut (voice/cut-vN.json):
  {"voice": "voice/cut-v2-voice-elevenlabs.wav", "lead": 0.1, "extra_end": 0.4,
   "scenes": [{"n": 1, "shot": "CAMERA", "starts": "start", "shows": "…", "text": "LAZY",
               "camera": "snap", "accent": "T01-02:2"}, …]}
- "starts": "start", "end" (after the last word), "T01-03:0" (phrase and word number) or "T01-03:5:end" (right after that
  word ends: a cut after the phrase, so a person still talking to the camera is never cut mid-sentence).
- Optional: "person_target": 0.45 (the agreed share of the person on screen), and per scene "gaze_ok": "why" when a
  person scene keeps a piece that gaze.py did not mark as fit (after looking at its sheet).
- "accent": the word where the push-in lands, or "accents": several, in order ("camera": "snap" | "slow" | "still").
- Optional: "cut": N uses voice/cut-vN.json instead of the latest.
Each scene starts `lead` seconds before its first word: the picture arrives a little before the voice.

Leaves: visual-script.json (read by the Remotion mockup), visual-script.md (to read), image/blocks.json
(the stretches where the person appears) and the brief's counts: percentage of person and how often the picture changes."""
import system

system.prepare(args=1)

import glob, json, os, re, sys

FPS = 30
PERSON = {"CAMERA", "CAMEO", "CAMERA + CARD"}
if len(sys.argv) < 2:
    sys.exit(__doc__)
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
P = sys.argv[1] if os.path.isabs(sys.argv[1]) else os.path.join(root, sys.argv[1])
spec = json.load(open(os.path.join(P, "scenes.json")))
vs = sorted(int(m.group(1)) for m in (re.search(r"cut-v(\d+)\.json$", p) for p in glob.glob(f"{P}/voice/cut-v*.json")) if m)
cut = json.load(open(f"{P}/voice/cut-v{spec.get('cut', vs[-1])}.json"))
by_id = {f["id"]: f for f in cut["phrases"]}
lead, extra = spec.get("lead", 0.1), spec.get("extra_end", 0.0)
dur = cut["duration"] / FPS + extra
last = cut["phrases"][-1]["words"][-1]["end"]


def word(ref):
    fid, i = ref.split(":")[:2]
    return by_id[fid]["words"][int(i)]


def instant(ref):
    if ref == "start":
        return 0.0
    if ref == "end":
        return last + 0.1
    if ref.endswith(":end"):  # "T01-58:6:end": right after that word ends (a cut after the phrase)
        return word(ref)["end"] + 0.08
    return max(0.0, word(ref)["start"] - lead)


# where each piece of the cut starts (each jump cut or take change), in seconds of the piece
piece_starts = []
for s in cut["segments"]:
    t = s["start"]
    for (q0, q1), v in zip(s.get("pieces") or [[s["in"], s["out"]]], s.get("speeds") or [1.0] * 9999):
        piece_starts.append(t / FPS)
        t += int(round((q1 - q0) / v))


sc = spec["scenes"]
for k, e in enumerate(sc):
    e["start"] = round(instant(e["starts"]), 3)
    # where the person appears, the lead can't show another take: the scene starts at the cut of its first word
    if e["shot"] in PERSON and e["starts"] not in ("start", "end"):
        w0 = word(e["starts"])["start"]
        cut_before = max((t for t in piece_starts if t <= w0 + 1e-3), default=0.0)
        if e["start"] < cut_before:
            e["start"] = round(cut_before, 3)
for k, e in enumerate(sc):
    e["end"] = round(sc[k + 1]["start"] if k + 1 < len(sc) else dur, 3)
    # nor at the end: if another piece (another moment of the take) starts in the last stretch of a person scene,
    # the scene ends at that cut and the next one starts there (a few frames of "a take that has nothing to do with it")
    if e["shot"] in PERSON and k + 1 < len(sc):
        stray = [t for t in piece_starts if e["start"] + 0.3 < t < e["end"] - 1e-3 and e["end"] - t < 0.4]
        if stray:
            e["end"] = sc[k + 1]["start"] = round(min(stray), 3)
    if e["shot"] in PERSON and e["end"] - e["start"] < 0.6:
        print(f"WARNING scene {e['n']}: the person appears only {e['end'] - e['start']:.2f} s, a micro cut (it only shows bad editing)")
    if e["end"] <= e["start"]:
        sys.exit(f"Scene {e['n']} ends up with no duration: check the order of \"starts\"")
    if e["shot"] not in PERSON and not e.get("material"):
        print(f"WARNING scene {e['n']}: no \"material\". What real thing tells it? (a file, a fact, a capture or a logo; "
              "recipes in production/REELS-QUALITY.md). Without real material it comes out generic or abstract")
    accents = e.get("accents") or ([e["accent"]] if e.get("accent") else [])
    if accents:
        e["accents_t"] = [round(word(r)["start"], 3) for r in accents]
        e["accent_t"] = e["accents_t"][-1]
    # what is said in the scene
    e["says"] = " ".join(w["t"] for f in cut["phrases"] for w in f["words"] if e["start"] <= w["start"] < e["end"])

# captions: words with their time in the piece
words = [{"t": w["t"], "start": w["start"], "end": w["end"]} for f in cut["phrases"] for w in f["words"]]
output = {"fps": FPS, "duration": round(dur * FPS), "voice": spec["voice"], "cut_video": f"voice/cut-v{cut['version']}.mp4",
          "scenes": sc, "phrases": [{"id": f["id"], "start": f["start"], "end": f["end"]} for f in cut["phrases"]], "words": words}
json.dump(output, open(os.path.join(P, "visual-script.json"), "w"), ensure_ascii=False, indent=1)

# blocks keep their id per scene (the B0N-… files already made still work); if the stretch changed, the data that
# blocks.py adds is dropped so it computes it again
os.makedirs(os.path.join(P, "image"), exist_ok=True)
blocks_path = os.path.join(P, "image", "blocks.json")
previous = {b["scene"]: b for b in json.load(open(blocks_path))} if os.path.exists(blocks_path) else {}
used = {int(b["id"][1:]) for b in previous.values()}
blocks = []
for e in (e for e in sc if e["shot"] in PERSON):
    b = previous.get(e["n"])
    if b and abs(b["start"] - e["start"]) < 1e-3 and abs(b["end"] - e["end"]) < 1e-3:
        blocks.append(b)
        continue
    if b:
        bid = b["id"]
    else:
        new = max(used, default=0) + 1
        used.add(new)
        bid = f"B{new:02d}"
    blocks.append({"id": bid, "scene": e["n"], "start": e["start"], "end": e["end"], "what": e["shot"].lower(), "changed": True})
json.dump(blocks, open(blocks_path, "w"), ensure_ascii=False, indent=1)
changed = [b["id"] for b in blocks if b.get("changed")]
if changed:
    print(f"Blocks with a new stretch (cut them again with blocks.py): {', '.join(changed)}")

# the picture counts as much as the voice: each person scene is checked against gaze.py (does the person look at the lens?)
gaze_path = f"{P}/voice/gaze-v{cut['version']}.json"
if not os.path.exists(gaze_path):
    print(f"MISSING gaze.py: run `python3 production/tools/gaze.py {os.path.relpath(P, root)}` and look at its sheet "
          "before choosing where the person appears.")
else:
    gaze = json.load(open(gaze_path))["pieces"]
    for e in sc:
        if e["shot"] not in PERSON or e.get("gaze_ok"):
            continue
        for q in gaze:
            overlap = min(e["end"], q["end"]) - max(e["start"], q["start"])
            if overlap > 0.15 and q["fit"] != "fit":
                print(f"WARNING scene {e['n']} (the person appears, {e['start']:.2f}-{e['end']:.2f} s): piece P{q['n']:02d} is "
                      f"\"{q['fit']}\" ({'; '.join(q['reasons'])}). Look at it in voice/gaze-v{cut['version']}.jpg; if it stays, "
                      "write why in that scene's \"gaze_ok\".")

person = sum(b["end"] - b["start"] for b in blocks)
target = spec.get("person_target")
if target is not None and abs(person / dur - target) > 0.1:
    print(f"WARNING: the person appears {person / dur * 100:.0f} % of the time and the agreed share is {target * 100:.0f} % (scenes.json, person_target)")
lengths = [e["end"] - e["start"] for e in sc]
with open(os.path.join(P, "visual-script.md"), "w") as f:
    f.write("# Visual script\n\nGenerated by `visual_script.py` from `scenes.json` and cut "
            f"v{cut['version']}. Timings in seconds of the piece.\n\n"
            "| # | Start | End | Length | Shot | Says | Shows | Real material | Text | Camera |\n|---|---|---|---|---|---|---|---|---|---|\n")
    for e in sc:
        refs = e.get("accents") or ([e["accent"]] if e.get("accent") else [])
        cam = e.get("camera", "") + (" on " + " and ".join(f"\"{word(r)['t'].strip('.,')}\" ({word(r)['start']:.2f})" for r in refs) if refs else "")
        f.write(f"| {e['n']} | {e['start']:.2f} | {e['end']:.2f} | {e['end'] - e['start']:.2f} | {e['shot']} | {e['says']} | {e.get('shows', '')} | {e.get('material', '')} | {e.get('text', '')} | {cam} |\n")
    f.write(f"\n## Counts\n\n- Duration: {dur:.1f} s.\n- Person on screen: {person:.1f} s ({person / dur * 100:.0f} %"
            + (f"; the agreed share is {target * 100:.0f} %" if target is not None else "") + f"), in {len(blocks)} blocks.\n"
            f"- Scenes: {len(sc)}. The picture changes every {dur / len(sc):.1f} s on average; the longest scene lasts {max(lengths):.1f} s.\n")
print(open(os.path.join(P, "visual-script.md")).read().split("## Counts")[1].strip())
