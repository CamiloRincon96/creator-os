"""Listens to an audio or a video of the piece, by measuring. Claude cannot hear: this is what it can check.
Usage: python3 production/tools/listen.py <piece> <file> [--cut N]

Reports, against the cut map (voice/cut-vN.json):
  - overall loudness and peak;
  - the loudness of each phrase and how far apart they are (mic closer or farther);
  - how loud whatever sits between phrases is (noise, music or effects) compared with the voice;
  - whether what is said is still understood: it transcribes again and compares word by word.
Use it on the voice alone, on each enhanced version and on the final mix with music and effects."""
import system

system.prepare(venv=True, args=2)

import glob, os, re, subprocess, sys, tempfile
import numpy as np
from common import compare, envelope, level, load, loudness, piece, read, transcribe


def latest_cut(P, n=None):
    if n:
        return load(f"{P}/voice/cut-v{n}.json")
    vs = sorted(int(m.group(1)) for m in (re.search(r"cut-v(\d+)\.json$", p) for p in glob.glob(f"{P}/voice/cut-v*.json")) if m)
    if not vs:
        sys.exit("There is no cut yet: run cut.py")
    return load(f"{P}/voice/cut-v{vs[-1]}.json")


def listen(x, sr, cut_map, transcribe_it=True):
    env = envelope(x, sr)
    fr = cut_map["phrases"]
    lu = [loudness(x[int(f["start"] * sr):int(f["end"] * sr)], sr) for f in fr]
    gaps = [level(env, a["end"] + 0.05, b["start"] - 0.05) for a, b in zip(fr, fr[1:]) if b["start"] - a["end"] > 0.2]
    voice = [level(env, f["start"], f["end"]) for f in fr]
    r = {"lufs": round(loudness(x, sr), 1), "peak_dBFS": round(20 * np.log10(np.max(np.abs(x)) + 1e-9), 1),
         "phrases_lufs": [round(v, 1) for v in lu], "phrases_range_LU": round(max(lu) - min(lu), 1), "phrases_spread_LU": round(float(np.std(lu)), 1),
         "voice_over_rest_dB": round(float(np.median(voice) - np.median(gaps)), 1) if gaps else None}
    if transcribe_it:
        heard = [w["t"] for w in transcribe(x, sr)]
        ok, changes = compare([w["t"] for f in fr for w in f["words"]], heard)
        r["understood"] = round(ok * 100)
        r["changed_words"] = changes
    return r


def report(name, r):
    print(f"{name}: {r['lufs']} LUFS, peak {r['peak_dBFS']} dBFS | phrases between {min(r['phrases_lufs'])} and {max(r['phrases_lufs'])} LUFS "
          f"(range {r['phrases_range_LU']} LU) | voice {r['voice_over_rest_dB']} dB above what plays between phrases"
          + (f" | {r['understood']} % of the words are understood" if "understood" in r else ""))
    for c in r.get("changed_words", []):
        print("    changed:", c)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    P = piece(sys.argv[1])
    src = sys.argv[2] if os.path.isabs(sys.argv[2]) else os.path.join(P, sys.argv[2])
    n = int(sys.argv[sys.argv.index("--cut") + 1]) if "--cut" in sys.argv else None
    cut_map = latest_cut(P, n)
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, "a.wav")
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", src, "-vn", "-ac", "1", "-ar", "48000", wav], check=True)
        x, sr = read(wav)
    report(os.path.basename(src), listen(x, sr, cut_map))
