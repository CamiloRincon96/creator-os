"""What the reel tools share: paths, ffmpeg, voice measurement and transcription.
Claude cannot hear: "listening" here means measuring (loudness, noise, voice energy) and transcribing."""
import json, os, re, subprocess, sys, unicodedata
import numpy as np
import soundfile as sf
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
PRODUCTION = os.path.dirname(HERE)
ROOT = os.path.dirname(PRODUCTION)
MODELS = os.path.join(PRODUCTION, "models")
RNNOISE = os.path.join(MODELS, "rnnoise", "std.rnnn")
FPS = 30
VIDEOS = (".mp4", ".mov", ".m4v")
AUDIOS = (".wav", ".mp3", ".m4a", ".aac", ".flac")  # voice-only recordings
LANGUAGE = None  # language of the recorded voice: None = Whisper detects it; prepare.py takes --language es/en/… to force it


def piece(arg):
    """The piece's folder (absolute path or relative to the repo), with its subfolders."""
    p = arg if os.path.isabs(arg) else os.path.join(ROOT, arg)
    if not os.path.isdir(p):
        sys.exit(f"The piece does not exist: {p}")
    for d in ("source", "work", "voice", "output"):
        os.makedirs(os.path.join(p, d), exist_ok=True)
    return os.path.abspath(p)


def ff(*args, cwd=None):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-y", "-v", "error", *map(str, args)], capture_output=True, text=True, cwd=cwd)
    if r.returncode:
        sys.exit("ffmpeg failed:\n" + r.stderr[-1500:])
    return r


def probe(path, entries, stream=None):
    cmd = ["ffprobe", "-v", "error"] + (["-select_streams", stream] if stream else []) + ["-show_entries", entries, "-of", "json", path]
    return json.loads(subprocess.run(cmd, capture_output=True, text=True).stdout or "{}")


def read(path):
    x, sr = sf.read(path, dtype="float64")
    return (x.mean(axis=1) if x.ndim > 1 else x), sr


def save(obj, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# ---------- voice measurement ----------

STEP = 0.01  # the envelope is measured every 10 ms


def envelope(x, sr):
    """Level of the voice band (150 to 6,000 Hz), in dB, every 10 ms."""
    y = signal.sosfiltfilt(signal.butter(4, [150, 6000], "bandpass", fs=sr, output="sos"), x)
    n, v = int(sr * STEP), int(sr * 0.03)
    cs = np.concatenate(([0.0], np.cumsum(y * y)))
    idx = np.arange(0, max(1, len(y) - v), n)
    return 10 * np.log10((cs[idx + v] - cs[idx]) / v + 1e-18)


def floor(env):
    """Background noise of the take: the quietest it gets when it is not digital silence."""
    live = env[env > -95]
    return float(np.percentile(live, 10)) if len(live) else -95.0


def level(env, a, b):
    i, j = max(0, int(a / STEP)), max(int(a / STEP) + 1, int(b / STEP))
    seg = env[i:j]
    return float(10 * np.log10(np.mean(10 ** (seg / 10)) + 1e-18)) if len(seg) else -120.0


def loudness(x, sr):
    """Loudness in LUFS; very short chunks are approximated with the average level."""
    import pyloudnorm as pyln
    if len(x) >= int(0.45 * sr):
        v = pyln.Meter(sr, block_size=0.4).integrated_loudness(x)
        if np.isfinite(v):
            return float(v)
    return float(20 * np.log10(np.sqrt(np.mean(x * x)) + 1e-9) - 0.7)


def bands(x, sr):
    """Voice balance: bass, presence and air, in dB relative to 300-600 Hz."""
    f, P = signal.welch(x, sr, nperseg=4096)
    b = lambda lo, hi: 10 * np.log10(np.mean(P[(f >= lo) & (f < hi)]) + 1e-20)
    ref = b(300, 600)
    return {"bass": b(150, 300) - ref, "presence": b(2500, 5000) - ref, "air": b(5000, 8000) - ref}


# ---------- transcription ----------

_model = None


def transcribe(x, sr, language=LANGUAGE, hint=None):
    """Words with timings. No script sentences in the initial prompt: the model skips what it has already "read"."""
    global _model
    from faster_whisper import WhisperModel
    from scipy.signal import resample_poly
    if _model is None:
        _model = WhisperModel("large-v3", device="cpu", compute_type="int8", download_root=MODELS)
    x16 = resample_poly(x, 16000, sr).astype(np.float32) if sr != 16000 else x.astype(np.float32)
    segs, _ = _model.transcribe(x16, language=language, word_timestamps=True, beam_size=5, vad_filter=False,
                                condition_on_previous_text=False, temperature=0, initial_prompt=hint)
    return [{"t": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3), "prob": round(w.probability, 3)}
            for s in segs for w in s.words]


def normalize(text):
    # keeps the Spanish n-tilde (U+00F1) as its own letter: it changes the word
    t = unicodedata.normalize("NFD", text.lower())
    return re.sub("[^a-z0-9\u00f1 ]", "", "".join(c for c in t if unicodedata.category(c) != "Mn" or c == "\u0303"))


def compare(expected, heard):
    """How many words of the expected text are still there, and which ones changed."""
    import difflib
    a, b = [normalize(w) for w in expected], [normalize(w) for w in heard]
    a, b = [w for w in a if w], [w for w in b if w]
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    ok = sum(m.size for m in sm.get_matching_blocks())
    changes = [f"\"{' '.join(a[i1:i2])}\" -> \"{' '.join(b[j1:j2])}\"" for op, i1, i2, j1, j2 in sm.get_opcodes() if op != "equal"]
    return (ok / max(1, len(a))), changes
