"""Stage 6: cuts the blocks where the person appears out of the takes, at full quality and with a margin.
Usage: python3 production/tools/blocks.py <piece> [--margin 0.5]

Reads image/blocks.json (from visual_script.py) and the cut the visual script uses. Each block comes out of the cut's
full-quality master (voice/cut-vN-master.mov: the same pieces, speeds and silences as the cut; older cuts without
pieces use the take in work/takes/) with `margin` extra seconds on each side, to
image/blocks/B01-raw.mov, and blocks.json is updated with its source: take, second of the take where the
file starts and how much margin it has before (to line it up in the piece:
second in the file = second in the piece - start + margin_before)."""
import system

system.prepare(venv=True, args=1)

import json, os, sys
from common import FPS, ff, load, piece, probe, save

if len(sys.argv) < 2:
    sys.exit(__doc__)
P = piece(sys.argv[1])
margin = float(sys.argv[sys.argv.index("--margin") + 1]) if "--margin" in sys.argv else 0.5
vs = load(f"{P}/visual-script.json")
cut = load(f"{P}/{vs['cut_video'].replace('.mp4', '.json')}")
blocks = load(f"{P}/image/blocks.json")
os.makedirs(f"{P}/image/blocks", exist_ok=True)


def master():
    """The cut at full quality, with the same pieces, speeds and silences as cut.py, so a block cut from here lines up
    one to one with the piece. It's needed since the cut has jump cuts and an even pace: working out the second of the
    take as if the cut were continuous took the blocks from another part of the take."""
    out = f"{P}/{vs['cut_video'].replace('.mp4', '-master.mov')}"
    if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(f"{P}/{vs['cut_video']}"):
        return out
    used = sorted({s["take"] for s in cut["segments"]})
    ins, fc, k = [], [], 0
    for t in used:
        ins += ["-i", f"{P}/work/takes/{t}.mov"]
    for s in cut["segments"]:
        e = used.index(s["take"])
        for m, ((q0, q1), v) in enumerate(zip(s["pieces"], s["speeds"])):
            nf = int(round((q1 - q0) / v))
            vv = f",setpts=PTS/{v},fps={FPS},trim=end_frame={nf}" if v != 1.0 else ""
            pause = s.get("pause_before", 0) if m == 0 else 0
            pv = f",tpad=start={pause}:start_mode=clone" if pause else ""
            fc.append(f"[{e}:v]trim=start_frame={q0}:end_frame={q1},setpts=PTS-STARTPTS{vv}{pv}[v{k}]")
            k += 1
    fc.append("".join(f"[v{i}]" for i in range(k)) + f"concat=n={k}:v=1:a=0[v]")
    ff(*ins, "-filter_complex", ";".join(fc), "-map", "[v]", "-c:v", "libx264", "-preset", "medium", "-crf", "12", "-g", "15",
       "-pix_fmt", "yuv420p", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", out)
    return out


if cut["segments"] and "pieces" in cut["segments"][0]:
    source = master()
    total = float(probe(source, "format=duration")["format"]["duration"])
    for b in blocks:
        ini, end = max(0.0, b["start"] - margin), min(total, b["end"] + margin)
        takes = sorted({s["take"] for s in cut["segments"] if s["start"] / FPS < b["end"] and (s["start"] + s["length"]) / FPS > b["start"]})
        out = f"{P}/image/blocks/{b['id']}-raw.mov"
        ff("-ss", f"{ini:.4f}", "-i", source, "-t", f"{end - ini:.4f}", "-map", "0:v", "-c:v", "libx264", "-preset", "medium", "-crf", "12",
           "-pix_fmt", "yuv420p", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-an", out)
        b.pop("changed", None)
        b.update({"take": ",".join(takes), "source": os.path.basename(source), "source_from": round(ini, 3),
                  "margin_before": round(b["start"] - ini, 3), "file_length": round(end - ini, 3)})
        print(f"{b['id']} ({b['what']}): piece {b['start']:.2f}-{b['end']:.2f} s <- {os.path.basename(source)} ({','.join(takes)}); file {end - ini:.2f} s with {b['start'] - ini:.2f} s of margin before")
    save(blocks, f"{P}/image/blocks.json")
    sys.exit()

for b in blocks:
    # the silence added before a segment (pause_before, cut.py) counts as part of that segment
    seg = next(s for s in cut["segments"] if (s["start"] - s.get("pause_before", 0)) / FPS - 1e-6 <= b["start"] < (s["start"] + s["length"]) / FPS)
    take = f"{P}/work/takes/{seg['take']}.mov"
    length = float(probe(take, "format=duration")["format"]["duration"])
    a = seg["in"] / FPS + (b["start"] - seg["start"] / FPS)
    z = seg["in"] / FPS + (b["end"] - seg["start"] / FPS)
    ini, end = max(0.0, a - margin), min(length, z + margin)
    if z > length + 0.01:
        print(f"{b['id']}: the take ends {z - length:.2f} s before the block; the end has no picture")
    out = f"{P}/image/blocks/{b['id']}-raw.mov"
    ff("-ss", f"{ini:.4f}", "-i", take, "-t", f"{end - ini:.4f}", "-map", "0:v", "-c:v", "libx264", "-preset", "medium", "-crf", "12",
       "-pix_fmt", "yuv420p", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-an", out)
    b.update({"take": seg["take"], "source_from": round(ini, 3), "margin_before": round(a - ini, 3), "file_length": round(end - ini, 3)})
    print(f"{b['id']} ({b['what']}): piece {b['start']:.2f}-{b['end']:.2f} s <- {seg['take']} {a:.2f}-{z:.2f} s; file {end - ini:.2f} s with {a - ini:.2f} s of margin before")
save(blocks, f"{P}/image/blocks.json")
