"""Stage 3: builds the voice cut so the creator can hear it before anything is animated.
Usage: python3 production/tools/cut.py <piece>

By default it edits the way that was approved on "Tres semanas" (16 Nov 2026), unless cut.json or the brand say otherwise:
  - Silero VAD decides what is voice; each segment is trimmed to it and stretched over the "s" at the edges;
  - YouTube jump cuts: 0.12 s of air between sentences, no breaths or silences;
  - even pace: what was said slowly ("sung") is sped up to 5.8 syllables per second, capped at 1.2x;
  - automatic check of the result: gaps without voice longer than 0.3 s, and word by word against what was expected.

Reads <piece>/cut.json: {"phrases": ["T01-01", "T01-02", "T03", ...], "corrections": {"T05-01": {"0": "Example"}}}.
Phrases go in the piece's order; a bare "T03" means every phrase of that take. Consecutive phrases of the same take go
in a single segment. Corrections replace a mistranscribed word (by its position in the phrase) for captions and
checks. Optional:
  "pause_between_segments" (0.12 s): the minimum air between one segment and the next; if it falls short, it is filled
      with silence and a held frame. A brand that wants more air raises it here (Example preferred 0.45 s: with 0.3 s
      "it all went boom").
  "final_tail" (0.7 s): air after the piece's last word, so it does not end abruptly.
  "vad" (true; or {"pad_in": 0.06, "pad_out": 0.08, "min_gap": 0.1}; false turns it off): Silero VAD, the trained speech
      detector that ships with faster-whisper, tells the voice apart from breaths, traffic and echo. Each segment is
      trimmed to what is voice, with a margin so the first and last letters are not clipped, and stretched over an "s"
      at the edge (Silero leaves it out). Built because measuring by energy and pitch left 0.85 s of background before
      "Corta tu voz…".
  "pace" ({"target": 5.8, "cap": 1.2}; false turns it off): speeds up only the parts said slowly to "target" syllables
      per second, never past "cap" times; the timbre does not change (atempo). The creator: "I say it a bit sung… make
      it even faster".
  "check_words" (true), "names", "language" (auto), "check_model" ("large-v3"): at the end the cut is transcribed and
      compared word by word with what it should say; the differences come out as warnings.
  "adjustments": {"T01-06": {"voice_start": 16.02, "words": [...]}}: corrects by hand where a phrase's voice starts or
      ends, and its words, when the transcriber mixed two versions of a sentence.
  Without "vad": "margin_in" (0.05 s), "margin_out" (0.09 s), "max_pause" (splits segments at long silences) and
      "remove_breaths" ({"threshold": 0.18, "keep": 0.04}: removes what has no pitch inside the segment).
Leaves voice/cut-vN.mp4 (the raw takes cut together, with the original audio leveled) and voice/cut-vN.json
(the map: segments with their pieces and speeds, frames and words with their time in the piece)."""
import system

system.prepare(venv=True, args=1)

import glob, os, re, sys
import numpy as np
from common import FPS, MODELS, envelope, ff, level, load, loudness, piece, read, save

if len(sys.argv) < 2:
    sys.exit(__doc__)
P = piece(sys.argv[1])
data = load(f"{P}/work/phrases.json")
request = load(f"{P}/cut.json")
MARGIN_IN, MARGIN_OUT = request.get("margin_in", 0.05), request.get("margin_out", 0.09)
FINAL_TAIL = request.get("final_tail", 0.7)  # air after the piece's last word, so it does not end abruptly
PAUSE = request.get("pause_between_segments", 0.12)  # minimum air between segments (voice to voice): jump cut
MAX_PAUSE = request.get("max_pause")  # longest silence inside a segment; beyond that, separate segments
by_id = {f["id"]: f for f in data["phrases"]}
for fid, adj in request.get("adjustments", {}).items():  # hand corrections to a phrase's measurement
    by_id[fid].update({k: v for k, v in adj.items() if k in ("voice_start", "voice_end", "words")})
    if "words" in adj:
        by_id[fid]["text"] = " ".join(w["t"] for w in adj["words"])
    by_id[fid]["warnings"] = [x for x in by_id[fid]["warnings"] if not x.startswith("start possibly")]
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
    joined = segments and segments[-1][-1]["take"] == f["take"] and lst.index(f) == lst.index(segments[-1][-1]) + 1
    # with "vad" segments are not split at pauses: Silero removes the silences inside, and two adjacent segments would overlap
    if joined and MAX_PAUSE is not None and request.get("vad", True) is False and f["voice_start"] - segments[-1][-1]["voice_end"] > MAX_PAUSE:
        joined = False
    if joined:
        segments[-1].append(f)
    else:
        segments.append([f])

audio, env_of, noise_of = {}, {}, {}
for t in data["takes"]:
    x, sr = read(f"{P}/work/audio/{t['id']}.wav")
    audio[t["id"]], env_of[t["id"]], noise_of[t["id"]] = (x, sr), envelope(x, sr), t["noise_dB"]

REMOVE = request.get("remove_breaths")
REMOVE = {} if REMOVE is True else REMOVE
THRESHOLD, KEEP = (REMOVE or {}).get("threshold", 0.18), (REMOVE or {}).get("keep", 0.04)


def gaps_without_voice(take, a, b):
    """Breaths and silences between two voiced parts, inside [a, b] (seconds of the take)."""
    from scipy import signal as ss
    x, sr = audio[take]
    y = ss.resample_poly(x[int(a * sr):int(b * sr)], 1, 3)
    fs = sr / 3
    hop, win = int(0.01 * fs), int(0.03 * fs)
    n = max(0, (len(y) - win) // hop)
    if n < 10:
        return []
    env, noise = env_of[take], noise_of[take]
    lo, hi = int(fs / 400), int(fs / 70)
    hann, fr = np.hanning(win), np.fft.rfftfreq(win, 1 / fs)
    pitched, sharp, high, cen, per, lvs = np.zeros(n, bool), np.zeros(n, bool), np.zeros(n), np.zeros(n), np.zeros(n), np.zeros(n)
    band = fr >= 3500  # where the "s" lives: from 3.5 kHz to the edge (8 kHz)
    for i in range(n):
        f = y[i * hop:i * hop + win]
        f = f - f.mean()
        lv = env[min(len(env) - 1, int((a + i * 0.01) / 0.01))]
        F = np.fft.rfft(f, 2 * win)
        ac = np.fft.irfft(np.abs(F) ** 2)[:win]
        r = ac[lo:hi].max() / ac[0] if ac[0] > 0 else 0.0
        S = np.abs(np.fft.rfft(f * hann))
        per[i], lvs[i] = r, lv
        high[i] = 10 * np.log10(np.mean(S[band] ** 2) + 1e-18)
        cen[i] = (fr * S).sum() / (S.sum() + 1e-12)
    high_floor = np.percentile(high, 10)  # the noise of that band in this segment
    sharp[:] = (high > high_floor + 12) & (cen > 2500)  # an "s", "f" or "sh": high-pitched and above the noise
    # voice is what has some pitch, what is sharp (consonants) or what is loud. Conservative on purpose: with echo, a
    # soft vowel has little pitch (on "Tres semanas" the first attempt ate the "s" of "salió" and the "Se" of "Se llama")
    pitched[:] = ((per > 0.3) & (lvs > noise + 8)) | sharp | (lvs > noise + 20)

    def flip(v, value, minimum):  # runs of `value` shorter than `minimum` frames become the opposite
        i = 0
        while i < len(v):
            j = i
            while j < len(v) and v[j] == v[i]:
                j += 1
            if v[i] == value and j - i < minimum and i > 0 and j < len(v):
                v[i:j] = not value
            i = j
    flip(pitched, True, 2)   # a stray one-frame flash of pitch inside a breath does not count
    flip(pitched, False, 4)  # nor does a gap shorter than 40 ms inside the voice
    gaps, i = [], 0
    while i < n:
        if pitched[i]:
            i += 1
            continue
        j = i
        while j < n and not pitched[j]:
            j += 1
        if i > 0 and j < n and (j - i) * 0.01 >= THRESHOLD:
            t0, t1 = a + i * 0.01 + 0.015 + KEEP, a + j * 0.01 + 0.015 - KEEP
            if t1 - t0 >= 0.08:
                gaps.append((t0, t1))
        i = j
    return gaps


VAD = request.get("vad", True)  # by default Silero decides the cuts ("vad": false turns it off)
VAD = {} if VAD is True else (None if VAD is False else VAD)
PAD_IN, PAD_OUT, MIN_GAP = (VAD or {}).get("pad_in", 0.06), (VAD or {}).get("pad_out", 0.08), (VAD or {}).get("min_gap", 0.1)
speech_of = {}


def speech(x, sr):
    """Stretches with voice (in seconds) according to Silero VAD."""
    from scipy import signal as ss
    from faster_whisper.vad import get_speech_timestamps, VadOptions
    y = ss.resample_poly(x, 16000, sr).astype(np.float32)
    ts = get_speech_timestamps(y, VadOptions(threshold=0.5, min_silence_duration_ms=100, speech_pad_ms=0, min_speech_duration_ms=60))
    return [(t["start"] / 16000, t["end"] / 16000) for t in ts]


sharp_of = {}


def sharp_level(take):
    """Level of the high band (3.5 to 9 kHz, where the "s" lives) every 10 ms, and its background noise."""
    if take not in sharp_of:
        from scipy import signal as ss
        x, sr = audio[take]
        y = ss.sosfiltfilt(ss.butter(4, [3500, min(9000, sr / 2 - 100)], "bandpass", fs=sr, output="sos"), x)
        n, v = int(sr * 0.01), int(sr * 0.02)
        cs = np.concatenate(([0.0], np.cumsum(y * y)))
        idx = np.arange(0, max(1, len(y) - v), n)
        e = 10 * np.log10((cs[idx + v] - cs[idx]) / v + 1e-18)
        sharp_of[take] = (e, float(np.percentile(e, 10)))
    return sharp_of[take]


def vad_pieces(take, a, b, floor_a, ceil_b):
    """Voiced parts inside [a, b], with a margin. The first and the last may grow down to floor_a and up to ceil_b if the
    voice started earlier or went on after the measured segment (so the word is not clipped)."""
    if take not in speech_of:
        speech_of[take] = speech(*audio[take])
    rs = [(i, f) for i, f in speech_of[take] if f > a and i < b]
    if not rs:
        return [(a, b)]
    e, floor_e = sharp_level(take)
    sib = lambda t: e[min(len(e) - 1, max(0, int(t / 0.01)))] > floor_e + 12  # an "s", "f" or "sh" is sounding
    out = []
    for k, (i, f) in enumerate(rs):
        lo_i = floor_a if k == 0 else max(a, rs[k - 1][1])
        hi_f = ceil_b if k == len(rs) - 1 else min(b, rs[k + 1][0])
        while i - 0.01 > max(lo_i, i - 0.2) and sib(i - 0.01):  # Silero leaves out the "s" at the start
            i -= 0.01
        while f + 0.01 < min(hi_f, f + 0.25) and sib(f):  # and the one at the end
            f += 0.01
        i0 = max(i - PAD_IN, lo_i if k == 0 else a)
        f0 = min(f + PAD_OUT, hi_f if k == len(rs) - 1 else b)
        if out and i0 - out[-1][1] < MIN_GAP:
            out[-1] = (out[-1][0], f0)
        else:
            out.append((i0, f0))
    return out


PACE = request.get("pace", {"target": 5.8, "cap": 1.2})  # by default, even pace ("pace": false turns it off)
syllables = lambda t: max(1, len(re.findall(r"[aeiouyáéíóúü]+", t.lower()))) if re.search(r"[a-záéíóúñ]", t.lower()) else 2


def speeds(tr, pieces):
    """Speed factor of each piece: the ones slower than the target are sped up."""
    if not PACE:
        return [1.0] * len(pieces)
    target, cap = PACE.get("target", 5.8), PACE.get("cap", 1.2)
    ws = [w for f in tr for w in f["words"]]
    out = []
    for q0, q1 in pieces:
        t0, t1 = q0 / FPS, q1 / FPS
        n = sum(syllables(w["t"]) for w in ws if t0 < w["end"] <= t1 + 0.05)
        voiced = max(0.2, t1 - t0 - PAD_IN - PAD_OUT)
        r = n / voiced
        out.append(round(min(cap, target / r), 3) if n >= 3 and r < target else 1.0)
    return out


segs, cursor, warnings, removed = [], 0, [], []
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
    pieces, v0, v1 = [[ca, cb]], tr[0]["voice_start"], tr[-1]["voice_end"]
    if VAD is not None:  # the segment keeps what Silero hears as voice, with a margin
        parts = vad_pieces(take, ca / FPS, cb / FPS, previous + 0.03, following - 0.03)
        new = [[int(np.floor(p0 * FPS)), int(np.ceil(p1 * FPS))] for p0, p1 in parts]
        new = [q for q in new if q[1] - q[0] >= 2] or [[ca, cb]]
        if tr is segments[-1]:
            new[-1][1] = max(new[-1][1], cb)  # the piece's final tail is kept
        removed.append((tr[0]["id"], round(ca / FPS, 2), round((cb - ca - sum(q1 - q0 for q0, q1 in new)) / FPS, 2)))
        pieces = new
        ca, cb = pieces[0][0], pieces[-1][1]
        v0, v1 = ca / FPS + PAD_IN, cb / FPS - PAD_OUT
    env, noise = env_of[take], noise_of[take]
    tail = level(env, cb / FPS - 0.06, cb / FPS) - noise
    head = level(env, ca / FPS, ca / FPS + 0.04) - noise
    if VAD is None and tail > 6:
        warnings.append(f"{tr[-1]['id']}: the out cut falls with the voice {tail:.0f} dB above the noise (the next phrase is too close)")
    if VAD is None and head > 8:
        warnings.append(f"{tr[0]['id']}: the in cut falls with sound {head:.0f} dB above the noise (tight start)")
    for f in tr:
        warnings += [f"{f['id']}: {x}" for x in f["warnings"]]
    pauses = [round(y["voice_start"] - x["voice_end"], 2) for x, y in zip(tr, tr[1:])]
    pause_before = 0
    if segs:  # air between the previous segment and this one: that one's out margin + this one's in margin
        gap = segs[-1]["margin_after_ms"] / 1000 + (v0 - ca / FPS)
        if gap < PAUSE:
            pause_before = int(round((PAUSE - gap) * FPS))
    cursor += pause_before
    if VAD is None and REMOVE is not None:
        for t0, t1 in gaps_without_voice(take, ca / FPS, cb / FPS):
            r0, r1 = int(np.ceil(t0 * FPS)), int(np.floor(t1 * FPS))
            last = pieces[-1]
            if r1 - r0 >= 2 and last[0] < r0 and r1 < last[1]:
                pieces[-1:] = [[last[0], r0], [r1, last[1]]]
                removed.append((tr[0]["id"], round(t0, 2), round((r1 - r0) / FPS, 2)))
    spd = speeds(tr, pieces)
    length = sum(int(round((q1 - q0) / v)) for (q0, q1), v in zip(pieces, spd))
    segs.append({"take": take, "phrases": [f["id"] for f in tr], "in": ca, "out": cb, "start": cursor, "length": length, "pieces": pieces, "speeds": spd, "pause_before": pause_before,
                 "margin_before_ms": round((v0 - ca / FPS) * 1000), "margin_after_ms": round((cb / FPS - v1) * 1000),
                 "inner_pauses": pauses})
    cursor += length

# words with their time in the piece (for captions and moments)
piece_phrases = []
for s in segs:
    for fid in s["phrases"]:
        f = by_id[fid]
        def move(t, s=s):  # take time -> piece time, skipping what was removed
            tf, acc = t * FPS, 0
            for (q0, q1), v in zip(s["pieces"], s["speeds"]):
                if tf < q0:
                    break
                if tf <= q1:
                    return round((s["start"] + acc + (tf - q0) / v) / FPS, 3)
                acc += int(round((q1 - q0) / v))
            return round((s["start"] + acc) / FPS, 3)
        ws = [{"t": w["t"], "start": move(max(w["start"], f["voice_start"]) if k == 0 else w["start"]),
               "end": move(f["voice_end"] if k == len(f["words"]) - 1 else w["end"]), "prob": w["prob"]} for k, w in enumerate(f["words"])]
        piece_phrases.append({"id": fid, "text": f["text"], "start": move(f["voice_start"]), "end": move(f["voice_end"]), "words": ws})

# version
n = 1 + max([int(m.group(1)) for m in (re.search(r"cut-v(\d+)\.json$", p) for p in glob.glob(f"{P}/voice/cut-v*.json")) if m] or [0])
base = f"{P}/voice/cut-v{n}"

# render: raw takes cut together; original audio with each segment at the same loudness and short fades
ins, fc = [], []
used = sorted({s["take"] for s in segs})
for k, t in enumerate(used):
    ins += ["-i", f"{P}/work/takes/{t}.mov"]
k = 0
for s in segs:
    e = used.index(s["take"])
    x, sr = audio[s["take"]]
    g = -16.0 - loudness(x[int(s["in"] / FPS * sr):int(s["out"] / FPS * sr)], sr)
    s["original_gain_dB"] = round(g, 1)
    for m, ((q0, q1), v) in enumerate(zip(s["pieces"], s["speeds"])):
        a, d = q0 / FPS, (q1 - q0) / FPS
        nf = int(round((q1 - q0) / v))  # frames the piece lasts once sped up
        dv = nf / FPS
        hold = s.get("pause_before", 0) if m == 0 else 0  # silence and held frame before the segment
        pv = f",tpad=start={hold}:start_mode=clone" if hold else ""
        pa = f",adelay={round(hold / FPS * 1000)}:all=1" if hold else ""
        fd = 0.012 if len(s["pieces"]) == 1 else 0.006  # a short fade on every jump cut
        vv = f",setpts=PTS/{v},fps={FPS},trim=end_frame={nf}" if v != 1.0 else ""
        va = f",atempo={v},apad=whole_dur={dv:.5f},atrim=end={dv:.5f}" if v != 1.0 else ""
        fc.append(f"[{e}:v]trim=start_frame={q0}:end_frame={q1},setpts=PTS-STARTPTS{vv},scale=720:-2{pv}[v{k}]")
        fc.append(f"[{e}:a]atrim={a:.5f}:{a + d:.5f},asetpts=PTS-STARTPTS{va},volume={g:.2f}dB,afade=t=in:d={fd},afade=t=out:st={dv - fd:.5f}:d={fd}{pa}[a{k}]")
        k += 1
fc.append("".join(f"[v{i}][a{i}]" for i in range(k)) + f"concat=n={k}:v=1:a=1[v][a0];[a0]alimiter=limit=-1.5dB:level=false[a]")
ff(*ins, "-filter_complex", ";".join(fc), "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
   "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", f"{base}.mp4")
if VAD is not None:  # check the result with the same detector: no long gap without voice
    import subprocess, io
    import soundfile as sf
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", f"{base}.mp4", "-vn", "-ac", "1", "-ar", "16000", "-f", "wav", "-"], capture_output=True).stdout
    yo, so = sf.read(io.BytesIO(raw))
    vo = speech(yo, so)
    for (i0, f0), (i1, f1) in zip(vo, vo[1:]):
        if i1 - f0 > 0.3:
            warnings.append(f"check: a {i1 - f0:.2f} s gap without voice at second {f0:.2f} of the cut")
    # word check: the finished cut is transcribed and compared with what it should say. A clipped word comes out
    # different. Words added at the very end don't count (Whisper often invents a "thank you" in the silence)
    if request.get("check_words", True):
        import difflib, unicodedata
        from faster_whisper import WhisperModel
        def norm(t):
            t = unicodedata.normalize("NFD", t.lower())
            t = "".join(ch for ch in t if unicodedata.category(ch) != "Mn")
            nums = {"uno": "1", "one": "1", "dos": "2", "two": "2", "tres": "3", "three": "3", "cuatro": "4", "four": "4",
                    "cinco": "5", "five": "5", "seis": "6", "six": "6", "siete": "7", "seven": "7", "ocho": "8", "eight": "8",
                    "nueve": "9", "nine": "9", "diez": "10", "ten": "10", "quince": "15", "fifteen": "15", "veinte": "20",
                    "twenty": "20", "treinta": "30", "thirty": "30", "cien": "100", "hundred": "100", "mil": "1000", "thousand": "1000"}
            return [nums.get(w, w) for w in re.findall(r"[a-zñ0-9]+", t)]  # "fifteen" and "15" count the same
        model = WhisperModel(request.get("check_model", "large-v3"), device="cpu", compute_type="int8", download_root=MODELS)  # the repo's copy, not another 2.9 GB one
        names = request.get("names", "")
        heard, _ = model.transcribe(yo.astype(np.float32), language=request.get("language"), initial_prompt=names or None, condition_on_previous_text=False)
        ea, hb = norm(" ".join(f["text"] for f in piece_phrases)), norm(" ".join(z.text for z in heard))
        sm = difflib.SequenceMatcher(a=ea, b=hb, autojunk=False)
        print(f"\nWord check: {sm.ratio() * 100:.1f} % the same as expected ({len(ea)} words)")
        for op, i1, i2, j1, j2 in sm.get_opcodes():
            if op == "equal" or (op == "insert" and i1 == len(ea)):
                continue
            warnings.append(f"words: expected \"{' '.join(ea[max(0, i1 - 2):i2 + 2])}\", heard \"{' '.join(hb[max(0, j1 - 2):j2 + 2])}\"")
save({"version": n, "fps": FPS, "duration": cursor, "segments": segs, "phrases": piece_phrases, "warnings": warnings}, f"{base}.json")

print(f"cut v{n}: {cursor} frames = {cursor / FPS:.1f} s, {len(segs)} segments -> {base}.mp4")
print("segment | take | in-out (s) | length | margin before / after the voice | silence added before | inner pauses")
for k, s in enumerate(segs, 1):
    print(f"  {k} | {s['take']} | {s['in'] / FPS:.2f}-{s['out'] / FPS:.2f} | {s['length'] / FPS:.2f} s | {s['margin_before_ms']} / {s['margin_after_ms']} ms | {s['pause_before'] / FPS:.2f} s | {s['inner_pauses']}")
if PACE:
    print("\nParts sped up (even pace):")
    for s in segs:
        for (q0, q1), v in zip(s["pieces"], s["speeds"]):
            if v != 1.0:
                print(f"  {','.join(s['phrases'])} · {q0 / FPS:.2f}-{q1 / FPS:.2f} s of the take · {v:.2f}x")
if removed:
    print(f"\nWhat wasn't voice, removed from the segments: {sum(q[2] for q in removed):.1f} s in total")
    for fid, t0, d in removed:
        if d >= 0.05:
            print(f"  segment of {fid} (from {t0:.2f} s of the take): {d:.2f} s")
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
