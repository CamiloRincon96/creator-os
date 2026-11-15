"""Stage 4: versions of the voice so the creator can choose by ear.
Usage:
  production/.venv/bin/python production/tools/voice.py <piece> [--cut N]
      "local" version: cleans each take (peaks, bass, noise), matches the tone between takes and levels phrase by phrase.
      Also leaves voice/cut-vN-to-enhance.wav, which is what gets uploaded to an external enhancer.
  production/.venv/bin/python production/tools/voice.py <piece> --external <name> <file.wav> [--cut N]
      Brings in what an external enhancer returned (ElevenLabs, Adobe Podcast, CapCut), levels it the same way and builds its video.

Each version is saved as voice/cut-vN-voice-<name>.wav and .mp4 (the same picture as the cut) and is measured with listen.py.
Leveling phrase by phrase is what corrects the mic having been closer or farther."""
import os, sys
import numpy as np
import soundfile as sf
from common import FPS, RNNOISE, bands, ff, load, loudness, piece, read
from listen import latest_cut, listen, report

if len(sys.argv) < 2:
    sys.exit(__doc__)
P = piece(sys.argv[1])
n = int(sys.argv[sys.argv.index("--cut") + 1]) if "--cut" in sys.argv else None
cut_map = latest_cut(P, n)
N = cut_map["version"]
data = load(f"{P}/work/phrases.json")
TARGET, MAXIMUM = -16.0, 8.0  # LUFS per phrase; how far a phrase may move relative to its take
os.makedirs(f"{P}/voice/takes", exist_ok=True)


def level_phrases(x, sr, phrases, t0=lambda f: f["voice_start"], t1=lambda f: f["voice_end"]):
    """Raises or lowers each phrase to the same loudness, with the change spread over the silences."""
    g = [TARGET - loudness(x[int(t0(f) * sr):int(t1(f) * sr)], sr) for f in phrases]
    med = float(np.median(g))
    g = [float(np.clip(v, med - MAXIMUM, med + MAXIMUM)) for v in g]
    curve = np.full(len(x), med)
    edges = [0] + [int((t1(a) + t0(b)) / 2 * sr) for a, b in zip(phrases, phrases[1:])] + [len(x)]
    for v, a, b in zip(g, edges, edges[1:]):
        curve[a:b] = v
    k = int(0.08 * sr)
    curve = np.convolve(np.pad(curve, k, mode="edge"), np.ones(2 * k + 1) / (2 * k + 1), mode="valid")
    return x * 10 ** (curve / 20), [round(v, 1) for v in g]


def build(name, x, sr):
    """Saves the version, limits it and builds its video with the cut's picture."""
    tmp, wav, mp4 = f"{P}/voice/_tmp.wav", f"{P}/voice/cut-v{N}-voice-{name}.wav", f"{P}/voice/cut-v{N}-voice-{name}.mp4"
    sf.write(tmp, x, sr, subtype="PCM_24")
    ff("-i", tmp, "-af", "alimiter=limit=-1.5dB:level=false:attack=3:release=60", "-c:a", "pcm_s24le", wav)
    os.remove(tmp)
    ff("-i", f"{P}/voice/cut-v{N}.mp4", "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", mp4)
    y, _ = read(wav)
    report(name, listen(y, sr, cut_map))


def splice(track_of):
    """Joins the cut's segments taking the audio of each take, with 12 ms fades."""
    parts = []
    for s in cut_map["segments"]:
        x, sr = track_of[s["take"]]
        seg = x[int(s["in"] / FPS * sr):int(s["out"] / FPS * sr)].copy()
        seg = np.pad(seg, (0, max(0, int(s["length"] / FPS * sr) - len(seg))))
        f = int(0.012 * sr)
        seg[:f] *= np.linspace(0, 1, f); seg[-f:] *= np.linspace(1, 0, f)
        parts.append(seg)
    return np.concatenate(parts), sr


if "--external" in sys.argv:
    i = sys.argv.index("--external")
    name, file = sys.argv[i + 1], sys.argv[i + 2]
    tmp = f"{P}/voice/_ext.wav"
    ff("-i", file, "-vn", "-ac", "1", "-ar", "48000", "-c:a", "pcm_s24le", tmp)
    x, sr = read(tmp); os.remove(tmp)
    # some services return the audio shifted by a few milliseconds: align it against what was uploaded
    ref_path = f"{P}/voice/cut-v{N}-to-enhance.wav"
    if os.path.exists(ref_path):
        from scipy import signal as _sig
        ref, _ = read(ref_path)
        seg = slice(int(1 * sr), int(min(len(ref), len(x)) / sr * 0.5 * sr))
        lag = int(np.argmax(_sig.correlate(x[seg], ref[seg], mode="full", method="fft")) - (len(ref[seg]) - 1))
        print(f"{name}: offset against the cut {lag / sr * 1000:.1f} ms" + (" (corrected)" if abs(lag) > sr * 0.002 else ""))
        if lag > sr * 0.002:
            x = x[lag:]
        elif lag < -sr * 0.002:
            x = np.concatenate([np.zeros(-lag), x])
    length = int(cut_map["duration"] / FPS * sr)
    x = np.pad(x, (0, max(0, length - len(x))))[:length]
    x, _ = level_phrases(x, sr, cut_map["phrases"], lambda f: f["start"], lambda f: f["end"])
    build(name, x, sr)
    sys.exit()

used = sorted({s["take"] for s in cut_map["segments"]})
in_cut = {fid for s in cut_map["segments"] for fid in s["phrases"]}
phrases_of = {t: [f for f in data["phrases"] if f["take"] == t and f["id"] in in_cut] for t in used}
noise = {t["id"]: t["noise_dB"] for t in data["takes"]}

# 1. clean each take: clipped peaks, bass, noise (more of the clean signal mixed in if the take is noisy)
clean, balance = {}, {}
for t in used:
    src, out = f"{P}/work/audio/{t}.wav", f"{P}/voice/takes/{t}-clean.wav"
    mix = 0.8 if noise[t] > -32 else 0.65
    ff("-i", src, "-af", f"adeclip=threshold=8,volume=-6dB,highpass=f=75:p=2,arnndn=m={RNNOISE}:mix={mix}", "-c:a", "pcm_s24le", out)
    x, sr = read(out)
    clean[t] = out
    balance[t] = bands(np.concatenate([x[int(f["voice_start"] * sr):int(f["voice_end"] * sr)] for f in phrases_of[t]]), sr)

# 2. match the tone between takes: each one moves toward the median, capped at 5 dB
goal = {k: float(np.median([balance[t][k] for t in used])) for k in ("bass", "presence", "air")}
track = {}
print("tone per take (dB against 300-600 Hz) and correction:")
for t in used:
    c = {k: float(np.clip(goal[k] - balance[t][k], -5, 5)) if len(used) > 1 else 0.0 for k in goal}
    c = {k: (v if abs(v) >= 1 else 0.0) for k, v in c.items()}
    print(f"  {t}: " + ", ".join(f"{k} {balance[t][k]:+.0f} ({c[k]:+.1f})" for k in goal))
    eq = (f"equalizer=f=260:t=q:w=1:g=-2,lowshelf=f=200:g={c['bass']:.1f},equalizer=f=3500:t=q:w=0.9:g={c['presence']:.1f},"
          f"highshelf=f=7000:g={c['air']:.1f},deesser=i=0.35:m=0.5:f=0.5:s=o,acompressor=threshold=-22dB:ratio=2.5:attack=8:release=140:knee=6:makeup=1")
    out = f"{P}/voice/takes/{t}-local.wav"
    ff("-i", clean[t], "-af", eq, "-c:a", "pcm_s24le", out)
    x, sr = read(out)
    # 3. level phrase by phrase
    x, g = level_phrases(x, sr, phrases_of[t])
    print(f"      gain per phrase (dB): {g}")
    sf.write(out, x, sr, subtype="PCM_24")
    track[t] = (x, sr)

x, sr = splice(track)
build("local", x, sr)

# the track to upload to an external enhancer: the original cut, with only the peaks repaired
raw = {}
for t in used:
    out = f"{P}/voice/takes/{t}-raw.wav"
    ff("-i", f"{P}/work/audio/{t}.wav", "-af", "adeclip=threshold=8,volume=-3dB", "-c:a", "pcm_s24le", out)
    raw[t] = read(out)
x0, sr = splice(raw)
sf.write(f"{P}/voice/cut-v{N}-to-enhance.wav", x0, sr, subtype="PCM_24")
y, _ = level_phrases(x0, sr, cut_map["phrases"], lambda f: f["start"], lambda f: f["end"])
build("original", y, sr)
print(f"\nFor an external enhancer, upload voice/cut-v{N}-to-enhance.wav and bring the result in with --external <name> <file>.")
