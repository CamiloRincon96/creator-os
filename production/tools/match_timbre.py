"""Matches the voice's timbre take by take and gives it presence. For when a take was recorded closer to or farther from
the mic (suddenly more bass and more brightness): each take is equalized toward the median timbre of all of them.

    python3 production/tools/match_timbre.py <piece> <voice.wav> <output.wav> [--no-presence]

1. Measures each TAKE (the phrases T01-.., T02-.. of voice/cut-vN.json) in third-octave bands, relative to its level: the
   distance to the mic changes between takes, not between phrases of the same take (matching per phrase changes the
   timbre in the middle of a breath).
2. Correction = median timbre of the takes - timbre of the take, smoothed and capped at ±12 dB (firequalizer).
3. Joins the takes with 40 ms crossfades at the midpoint of the gap between one take and the next.
4. Presence (unless --no-presence): 75 Hz high-pass, +2.5 dB at 3.5 kHz, +1.5 dB above 9 kHz, de-esser and
   gentle compression (3:1), and leaves the voice at the same integrated loudness it had.
Prints the timbre before and after: the spread between phrases should go down. Claude cannot hear: the creator approves by ear.
"""
import system

system.prepare(venv=True, args=3)

import io
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

args = sys.argv[1:]
presence = "--no-presence" not in args
args = [a for a in args if not a.startswith("--")]
if len(args) < 3:
    sys.exit(__doc__)
piece, src, dst = Path(args[0]), args[1], args[2]
cut = sorted(piece.glob("voice/cut-v*.json"), key=lambda p: int(p.stem.split("-v")[1]))[-1]
phrases = json.load(open(cut))["phrases"]
x, sr = sf.read(src, always_2d=True)
mono = x.mean(1)

CENTERS = [63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500]


def timbre(seg):
    n = 8192
    spec, k = np.zeros(n // 2 + 1), 0
    for i in range(0, len(seg) - n, n // 2):
        w = seg[i:i + n] * np.hanning(n)
        if np.sqrt(np.mean(w ** 2)) < 1e-3:
            continue
        spec += np.abs(np.fft.rfft(w)) ** 2
        k += 1
    fq = np.fft.rfftfreq(n, 1 / sr)
    e = np.array([10 * np.log10(spec[(fq >= c / 2 ** (1 / 6)) & (fq < c * 2 ** (1 / 6))].sum() / max(k, 1) + 1e-12) for c in CENTERS])
    return e - e.mean()


def spread(tims):
    t = np.array(tims)
    return float(np.mean(np.std(t, axis=0)))


tims = [timbre(mono[int(f["start"] * sr):int(f["end"] * sr)]) for f in phrases]
print(f"timbre before: spread between phrases {spread(tims):.2f} dB")

# the takes: consecutive phrases with the same prefix (T01, T02...)
takes = []
for f in phrases:
    t = f["id"].split("-")[0]
    if takes and takes[-1]["take"] == t:
        takes[-1]["phrases"].append(f)
    else:
        takes.append({"take": t, "phrases": [f]})
for t in takes:
    t["timbre"] = timbre(np.concatenate([mono[int(f["start"] * sr):int(f["end"] * sr)] for f in t["phrases"]]))
goal = np.median(np.array([t["timbre"] for t in takes]), axis=0)
for t in takes:
    dif = t["timbre"] - goal
    print(f"  {t['take']}: bass (63-250 Hz) {dif[:6].mean():+.1f} dB, brightness (4-12 kHz) {dif[18:].mean():+.1f} dB against the median")

# cut points: halfway through the gap between the last phrase of one take and the first of the next
edges = [0.0] + [(takes[i]["phrases"][-1]["end"] + takes[i + 1]["phrases"][0]["start"]) / 2 for i in range(len(takes) - 1)] + [len(mono) / sr]
X = 0.04
output = np.zeros_like(x)
weight = np.zeros(len(x))
for i, tk in enumerate(takes):
    tims_i = tk["timbre"]
    corr = np.clip(goal - tims_i, -12, 12)
    corr = np.convolve(np.pad(corr, 1, mode="edge"), np.ones(3) / 3, mode="valid")
    a, b = max(0.0, edges[i] - X), min(len(mono) / sr, edges[i + 1] + X)
    gain = ";".join(f"entry({c},{g:.2f})" for c, g in zip(CENTERS, corr))
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-ss", f"{a:.4f}", "-t", f"{b - a:.4f}", "-i", src,
         "-af", f"firequalizer=gain_entry='{gain}':delay=0.05:zero_phase=on", "-f", "wav", "-acodec", "pcm_f32le", "-"],
        capture_output=True, check=True).stdout
    y, _ = sf.read(io.BytesIO(raw), always_2d=True)
    i0 = int(round(a * sr))
    y = y[: len(x) - i0]
    env = np.ones(len(y))
    nf = int(X * 2 * sr)
    if i > 0:
        env[:nf] = np.linspace(0, 1, nf)
    if i < len(takes) - 1:
        env[-nf:] = np.linspace(1, 0, nf)[: len(env[-nf:])]
    output[i0:i0 + len(y)] += y * env[:, None]
    weight[i0:i0 + len(y)] += env
output /= np.maximum(weight, 1e-6)[:, None]
tmp = Path(dst).with_suffix(".tmp.wav")
sf.write(tmp, output, sr, subtype="FLOAT")

tims2 = [timbre(output.mean(1)[int(f["start"] * sr):int(f["end"] * sr)]) for f in phrases]
print(f"timbre after: spread between phrases {spread(tims2):.2f} dB")


def lufs(path):
    out = subprocess.run(["ffmpeg", "-nostats", "-i", str(path), "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
    return float([l for l in out.splitlines() if l.strip().startswith("I:")][-1].split()[1])


before = lufs(src)
if presence:
    chain = ("highpass=f=75,equalizer=f=3500:t=q:w=1.2:g=2.5,highshelf=f=9000:g=1.5,deesser=i=0.35,"
             "acompressor=threshold=-22dB:ratio=3:attack=6:release=90:makeup=1")
else:
    chain = "anull"
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(tmp), "-af", chain, "-c:a", "pcm_f32le", str(tmp) + ".2.wav"], check=True)
g = before - lufs(str(tmp) + ".2.wav")
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(tmp) + ".2.wav", "-af", f"volume={g:.2f}dB,alimiter=limit=0.89:level=false",
                "-c:a", "pcm_s24le", dst], check=True)
tmp.unlink()
Path(str(tmp) + ".2.wav").unlink()
print(f"loudness: {before:.1f} LUFS before, {lufs(dst):.1f} after; saved to {dst}")
