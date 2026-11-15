"""Stage 3: builds the voice cut so the creator can hear it before anything is animated.
Usage: production/.venv/bin/python production/tools/cut.py <piece>

Reads <piece>/cut.json: {"phrases": ["T01-01", "T01-02", "T03", ...], "corrections": {"T05-01": {"0": "Example"}}}.
Phrases go in the piece's order; a bare "T03" means every phrase of that take. Corrections replace a
mistranscribed word (by its position in the phrase) for captions and checks.
Optional: "margin_in" (0.12 s), "margin_out" (0.20 s), "final_tail" (0.7 s after the last word) and
"pause_between_segments" (0.45 s): the minimum air between the last word of one segment and the first of the next. If
the margins give less, it is filled with silence and a held frame (the creator, on "Sin anotar", a Spanish-language
example: between one take and the next "it all went boom, straight through"; the gaps were 0.28 to 0.31 s).
Consecutive phrases of the same take stay in a single segment, with their natural pause.
Each cut goes where the voice has already dropped to the background noise, with a margin, never at the transcriber's timing.
Leaves voice/cut-vN.mp4 (the raw takes cut together, with the original audio leveled) and voice/cut-vN.json
(the map: segments, frames and words with their time in the piece)."""
import glob, os, re, sys
import numpy as np
from common import FPS, envelope, ff, level, load, loudness, piece, read, save

if len(sys.argv) < 2:
    sys.exit(__doc__)
P = piece(sys.argv[1])
data = load(f"{P}/work/phrases.json")
request = load(f"{P}/cut.json")
MARGIN_IN, MARGIN_OUT = request.get("margin_in", 0.12), request.get("margin_out", 0.20)
FINAL_TAIL = request.get("final_tail", 0.7)  # air after the piece's last word, so it does not end abruptly
PAUSE = request.get("pause_between_segments", 0.45)  # minimum air between segments (voice to voice)
by_id = {f["id"]: f for f in data["phrases"]}
of_take = {}
for f in data["phrases"]:
    of_take.setdefault(f["take"], []).append(f)
# a bare "T02" means every phrase of that take
request["phrases"] = [x["id"] for i in request["phrases"] for x in (of_take[i] if i in of_take else [{"id": i}])]
missing = [i for i in request["phrases"] if i not in by_id]
if missing:
    sys.exit("Phrases that do not exist in work/phrases.json: " + ", ".join(missing))
# corrections to the transcriber's text: {"T05-01": {"0": "Example"}} replaces word 0 of that phrase
for fid, changes in request.get("corrections", {}).items():
    for k, text in changes.items():
        by_id[fid]["words"][int(k)]["t"] = text
    by_id[fid]["text"] = " ".join(w["t"] for w in by_id[fid]["words"])

# segments: consecutive phrases of the same take go together
segments = []
for fid in request["phrases"]:
    f = by_id[fid]
    lst = of_take[f["take"]]
    if segments and segments[-1][-1]["take"] == f["take"] and lst.index(f) == lst.index(segments[-1][-1]) + 1:
        segments[-1].append(f)
    else:
        segments.append([f])

audio, env_of, noise_of = {}, {}, {}
for t in data["takes"]:
    x, sr = read(f"{P}/work/audio/{t['id']}.wav")
    audio[t["id"]], env_of[t["id"]], noise_of[t["id"]] = (x, sr), envelope(x, sr), t["noise_dB"]

segs, cursor, warnings = [], 0, []
for tr in segments:
    take, lst = tr[0]["take"], of_take[tr[0]["take"]]
    i, j = lst.index(tr[0]), lst.index(tr[-1])
    previous = lst[i - 1]["voice_end"] if i > 0 else 0.0
    following = lst[j + 1]["voice_start"] if j + 1 < len(lst) else audio[take][0].shape[0] / audio[take][1]
    a = max(previous + 0.03, tr[0]["voice_start"] - MARGIN_IN, 0)
    b = min(following - 0.03, tr[-1]["voice_end"] + (FINAL_TAIL if tr is segments[-1] else MARGIN_OUT))
    ca, cb = int(np.ceil(a * FPS - 1e-6)), int(np.floor(b * FPS + 1e-6))  # snapped to the frame, within the margin
    if ca / FPS > tr[0]["voice_start"] - 0.02:
        ca = int(np.floor((tr[0]["voice_start"] - 0.02) * FPS))
    if cb / FPS < tr[-1]["voice_end"] + 0.04:
        cb = int(np.ceil((tr[-1]["voice_end"] + 0.04) * FPS))
    env, noise = env_of[take], noise_of[take]
    tail = level(env, cb / FPS - 0.06, cb / FPS) - noise
    head = level(env, ca / FPS, ca / FPS + 0.04) - noise
    if tail > 6:
        warnings.append(f"{tr[-1]['id']}: the out cut falls with the voice {tail:.0f} dB above the noise (the next phrase is too close)")
    if head > 8:
        warnings.append(f"{tr[0]['id']}: the in cut falls with sound {head:.0f} dB above the noise (tight start)")
    for f in tr:
        warnings += [f"{f['id']}: {x}" for x in f["warnings"]]
    pauses = [round(y["voice_start"] - x["voice_end"], 2) for x, y in zip(tr, tr[1:])]
    pause_before = 0
    if segs:  # air between the previous segment and this one: that one's out margin + this one's in margin
        gap = segs[-1]["margin_after_ms"] / 1000 + (tr[0]["voice_start"] - ca / FPS)
        if gap < PAUSE:
            pause_before = int(round((PAUSE - gap) * FPS))
    cursor += pause_before
    segs.append({"take": take, "phrases": [f["id"] for f in tr], "in": ca, "out": cb, "start": cursor, "length": cb - ca, "pause_before": pause_before,
                 "margin_before_ms": round((tr[0]["voice_start"] - ca / FPS) * 1000), "margin_after_ms": round((cb / FPS - tr[-1]["voice_end"]) * 1000),
                 "inner_pauses": pauses})
    cursor += cb - ca

# words with their time in the piece (for captions and moments)
piece_phrases = []
for s in segs:
    for fid in s["phrases"]:
        f = by_id[fid]
        move = lambda t: round(s["start"] / FPS + (t - s["in"] / FPS), 3)
        ws = [{"t": w["t"], "start": move(max(w["start"], f["voice_start"]) if k == 0 else w["start"]),
               "end": move(f["voice_end"] if k == len(f["words"]) - 1 else w["end"]), "prob": w["prob"]} for k, w in enumerate(f["words"])]
        piece_phrases.append({"id": fid, "text": f["text"], "start": move(f["voice_start"]), "end": move(f["voice_end"]), "words": ws})

# version
n = 1 + max([int(m.group(1)) for m in (re.search(r"cut-v(\d+)\.json$", p) for p in glob.glob(f"{P}/voice/cut-v*.json")) if m] or [0])
base = f"{P}/voice/cut-v{n}"

# render: raw takes cut together; original audio with each segment at the same loudness and 12 ms fades
ins, fc = [], []
used = sorted({s["take"] for s in segs})
for k, t in enumerate(used):
    ins += ["-i", f"{P}/work/takes/{t}.mov"]
for k, s in enumerate(segs):
    e = used.index(s["take"])
    a, d = s["in"] / FPS, s["length"] / FPS
    x, sr = audio[s["take"]]
    g = -16.0 - loudness(x[int(a * sr):int((a + d) * sr)], sr)
    s["original_gain_dB"] = round(g, 1)
    hold = s.get("pause_before", 0)  # silence and held frame before the segment (its own name: `n` is the cut version)
    pv = f",tpad=start={hold}:start_mode=clone" if hold else ""
    pa = f",adelay={round(hold / FPS * 1000)}:all=1" if hold else ""
    fc.append(f"[{e}:v]trim=start_frame={s['in']}:end_frame={s['out']},setpts=PTS-STARTPTS,scale=720:-2{pv}[v{k}]")
    fc.append(f"[{e}:a]atrim={a:.5f}:{a + d:.5f},asetpts=PTS-STARTPTS,volume={g:.2f}dB,afade=t=in:d=0.012,afade=t=out:st={d - 0.012:.5f}:d=0.012{pa}[a{k}]")
fc.append("".join(f"[v{k}][a{k}]" for k in range(len(segs))) + f"concat=n={len(segs)}:v=1:a=1[v][a0];[a0]alimiter=limit=-1.5dB:level=false[a]")
ff(*ins, "-filter_complex", ";".join(fc), "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
   "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", f"{base}.mp4")
save({"version": n, "fps": FPS, "duration": cursor, "segments": segs, "phrases": piece_phrases, "warnings": warnings}, f"{base}.json")

print(f"cut v{n}: {cursor} frames = {cursor / FPS:.1f} s, {len(segs)} segments -> {base}.mp4")
print("segment | take | in-out (s) | length | margin before / after the voice | silence added before | inner pauses")
for k, s in enumerate(segs, 1):
    print(f"  {k} | {s['take']} | {s['in'] / FPS:.2f}-{s['out'] / FPS:.2f} | {s['length'] / FPS:.2f} s | {s['margin_before_ms']} / {s['margin_after_ms']} ms | {s['pause_before'] / FPS:.2f} s | {s['inner_pauses']}")
left_out = [f for t in sorted({x["take"] for x in segs}) for f in of_take[t] if f["id"] not in request["phrases"]]
if left_out:
    print("\nPhrases from the takes used that are NOT in the cut:")
    for f in left_out:
        print(f"  {f['id']}: {f['text']}")
unused = [t["id"] for t in data["takes"] if t["id"] not in {x["take"] for x in segs}]
if unused:
    print("Unused takes: " + ", ".join(unused))
print("\nWARNINGS:" if warnings else "\nNo warnings: no cut falls on the voice.")
for a in warnings:
    print("  -", a)
