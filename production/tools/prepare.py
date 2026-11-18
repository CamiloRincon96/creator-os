"""Stage 3, first step: gets the recording ready to cut.
Usage: python3 production/tools/prepare.py <piece> [--language es] [--names "Example."]

For each video in <piece>/source (in name order):
  - converts it to a fixed 30 fps with the audio starting at zero  -> work/takes/T01.mov and work/audio/T01.wav
  - transcribes it word by word                                    -> work/transcript/T01.json
  - splits it into phrases and measures where each phrase's voice really starts and ends
Leaves work/phrases.json and work/TRANSCRIPT.md, which is what you read to choose the cut."""
import system

system.prepare(venv=True, args=1)

import glob, os, sys
import numpy as np
from common import AUDIOS, FPS, LANGUAGE, STEP, VIDEOS, compare, envelope, ff, floor, level, load, loudness, piece, probe, read, save, transcribe

if len(sys.argv) < 2:
    sys.exit(__doc__)
P = piece(sys.argv[1])
language = sys.argv[sys.argv.index("--language") + 1] if "--language" in sys.argv else LANGUAGE
hint = sys.argv[sys.argv.index("--names") + 1] if "--names" in sys.argv else None  # proper names, e.g. "Example."
sources = sorted(f for f in glob.glob(os.path.join(P, "source", "*")) if f.lower().endswith(VIDEOS + AUDIOS))
if not sources:
    sys.exit("There are no videos or audio files in source/")
for d in ("takes", "audio", "transcript"):
    os.makedirs(os.path.join(P, "work", d), exist_ok=True)

takes, phrases = [], []
for n, src in enumerate(sources, 1):
    tid = f"T{n:02d}"
    mov, wav = f"{P}/work/takes/{tid}.mov", f"{P}/work/audio/{tid}.wav"
    voice_only = src.lower().endswith(AUDIOS)
    if voice_only and (not os.path.exists(mov) or os.path.getmtime(mov) < os.path.getmtime(src)):
        # voice-only recording: it gets a gray picture so it goes through the same cut as the videos
        ff("-f", "lavfi", "-i", f"color=c=0x2a2a2a:s=1080x1920:r={FPS}", "-i", src, "-map", "0:v", "-map", "1:a", "-shortest",
           "-c:v", "libx264", "-preset", "veryfast", "-crf", "30", "-pix_fmt", "yuv420p",
           "-af", "aresample=48000,pan=mono|c0=c0", "-c:a", "pcm_s24le", mov)
        ff("-i", mov, "-vn", "-c:a", "pcm_s24le", wav)
    elif not os.path.exists(mov) or os.path.getmtime(mov) < os.path.getmtime(src):
        ff("-i", src, "-map", "0:v:0", "-map", "0:a:0", "-vf", f"fps={FPS}", "-fps_mode", "cfr", "-c:v", "libx264", "-preset", "medium",
           "-crf", "12", "-g", "15", "-pix_fmt", "yuv420p", "-af", "aresample=48000:async=1:first_pts=0,pan=mono|c0=c0", "-c:a", "pcm_s24le", mov)
        ff("-i", mov, "-vn", "-c:a", "pcm_s24le", wav)
    v0 = probe(mov if voice_only else src, "stream=nb_frames,avg_frame_rate,width,height:format=duration", "v:0")
    a0 = probe(src, "stream=start_time", "a:0")["streams"][0]
    x, sr = read(wav)
    env = envelope(x, sr)
    noise = floor(env)
    first = float(np.argmax(env > -90) * STEP)  # where it stops being digital silence
    tr_path = f"{P}/work/transcript/{tid}.json"
    if os.path.exists(tr_path) and os.path.getmtime(tr_path) >= os.path.getmtime(wav):
        words = load(tr_path)
    else:
        words = transcribe(x, sr, language, hint)
        save(words, tr_path)

    # phrases: by the transcriber's punctuation (always a period; a comma once there are three words)
    groups, g = [], []
    for w in words:
        g.append(w)
        if w["t"][-1:] in ".?!" or (w["t"][-1:] in ",;:" and len(g) >= 3):
            groups.append(g); g = []
    if g:
        groups.append(g)
    if len(groups) > 1 and len(groups[-1]) < 2:
        groups[-2] += groups.pop()

    # a phrase of more than twelve words without punctuation is split at its deepest pause, if it has one
    def deepest(wa, wb):
        ts = np.arange(max(wa["start"] + 0.05, wa["end"] - 0.15), wb["start"] + 0.15, STEP)
        return min(level(env, u, u + 0.05) for u in ts) if len(ts) else 0.0
    again = True
    while again:
        again = False
        for gi, g in enumerate(groups):
            if len(g) > 12:
                cand = [(deepest(g[i], g[i + 1]), i) for i in range(3, len(g) - 4)]
                if cand and min(cand)[0] < noise + 8:
                    i = min(cand)[1]
                    groups[gi:gi + 1] = [g[:i + 1], g[i + 1:]]
                    again = True
                    break

    # a long silence (more than 0.7 s) also splits the phrase, even if the transcriber put no punctuation.
    # It is measured in the audio, not in the word times: the transcriber stretches a word over the pause.
    # On the first "glass" reel (16 Nov 2026) one phrase carried 19 s of silence inside and the cut would have kept it.
    def longest_silence(wa, wb):
        best = run = 0.0
        frm = max(wa["start"] + 0.05, wa["end"] - 0.25)  # a stretched word's sound sits at the end of its span
        for u in np.arange(frm, max(frm + 0.05, wb["end"] - 0.03), STEP):
            run = run + STEP if level(env, u, u + STEP) < noise + 8 else 0.0
            best = max(best, run)
        return best
    split = []
    for g in groups:
        current = [g[0]]
        for wa, wb in zip(g, g[1:]):
            if longest_silence(wa, wb) > 0.7:
                split.append(current)
                current = []
            current.append(wb)
        split.append(current)
    groups = split

    dur = len(x) / sr
    voice = lambda t, above=6: level(env, t, t + 0.03) > noise + above

    # start of the take: the first stretch of sustained voice (a stray sound shorter than 0.2 s does not count)
    start0, t = None, first
    while t < min(dur - 0.15, groups[0][-1]["end"] + 0.5):
        if voice(t, 12) and np.mean(env[int(t / STEP):int((t + 0.2) / STEP)] > noise + 12) >= 0.7:
            start0 = t
            break
        t += STEP
    start0 = groups[0][0]["start"] if start0 is None else start0
    back = start0
    while back - STEP > max(first, start0 - 0.15) and voice(back - STEP):
        back -= STEP
    start0 = back

    # end of the take: the transcriber marks the end before the voice is done; follow it until it drops to the noise
    we = groups[-1][-1]["end"]
    t, gap, take_end = we, 0.0, we
    while t < min(dur - 0.03, we + 1.2):
        if voice(t):
            take_end, gap = t + 0.03, 0.0
        else:
            gap += STEP
            if gap > 0.07:
                break
        t += STEP

    # boundaries between phrases: the quietest point of the audio near the word change
    bounds = []  # (end of phrase k, start of k+1, joined)
    for ga, gb in zip(groups, groups[1:]):
        a, b = max(ga[-1]["start"] + 0.05, ga[-1]["end"] - 0.2), min(gb[0]["end"] - 0.03, gb[0]["start"] + 0.2)
        ts = np.arange(a, max(a + STEP, b), STEP)
        levels = [level(env, u, u + 0.05) for u in ts]
        m = float(ts[int(np.argmin(levels))]) + 0.025
        if min(levels) < noise + 8:  # there is a pause: the voice ends before and comes back after
            fa, ib = m, m
            while fa - STEP > ga[-1]["start"] and not voice(fa - STEP):
                fa -= STEP
            while ib + STEP < gb[0]["end"] and not voice(ib):
                ib += STEP
            bounds.append((fa, ib, False))
        else:
            bounds.append((m, m, True))

    of_take = []
    for k, g in enumerate(groups):
        start = start0 if k == 0 else bounds[k - 1][1]
        end = take_end if k == len(groups) - 1 else bounds[k][0]
        i0, i1 = int(start * sr), int(end * sr)
        warnings = []
        if k == 0 and start - first < 0.2:
            warnings.append("start possibly clipped: the voice begins right at the start of the audio")
        elif k == 0 and level(env, first + 0.02, max(first + 0.05, start - 0.05)) > noise + 8:
            warnings.append("there is a stray sound before the first word: it may be the end of a word that was not recorded")
        if k < len(groups) - 1 and bounds[k][2]:
            warnings.append("runs into the next phrase: the two cannot be cut apart cleanly")
        doubtful = [w["t"] for w in g if w["prob"] < 0.6]
        if doubtful:
            warnings.append("doubtful words: " + ", ".join(doubtful))
        of_take.append({"id": f"{tid}-{k + 1:02d}", "take": tid, "text": " ".join(w["t"] for w in g),
                        "voice_start": round(start, 3), "voice_end": round(end, 3), "lufs": round(loudness(x[i0:i1], sr), 1),
                        "warnings": warnings, "words": g})
    phrases += of_take
    takes.append({"id": tid, "source": os.path.basename(src), "duration": round(dur, 3), "original_frames": int(v0["streams"][0].get("nb_frames", 0)),
                  "width": v0["streams"][0]["width"], "height": v0["streams"][0]["height"], "voice_only": voice_only, "noise_dB": round(noise, 1),
                  "audio_start_ms": round(float(a0.get("start_time", 0)) * 1000), "first_sound": round(first, 2)})
    print(f"{tid} {os.path.basename(src)}: {dur:.1f} s, {len(of_take)} phrases, noise {noise:.0f} dB", flush=True)

# repeated phrases: if a phrase is very similar to a later one, warn that there is another version
for i, f in enumerate(phrases):
    for g in phrases[i + 1:]:
        words_f = f["text"].split()
        if len(words_f) >= 3:
            ok, _ = compare(words_f, g["text"].split())
            if ok >= 0.7 and abs(len(words_f) - len(g["text"].split())) <= max(3, len(words_f) // 2):
                f["warnings"].append(f"repeated in {g['id']}: pick the best one (usually the last complete one)")
                g["warnings"].append(f"repeat of {f['id']}")
                break
save({"fps": FPS, "takes": takes, "phrases": phrases}, f"{P}/work/phrases.json")
with open(f"{P}/work/TRANSCRIPT.md", "w") as f:
    f.write("# The recording, phrase by phrase\n\nGenerated by `prepare.py`. Timings are the measured voice, not the transcriber's. "
            "Build `cut.json` with the identifiers.\n")
    for t in takes:
        f.write(f"\n## {t['id']} · {t['source']} ({t['duration']} s)\n\n| Phrase | Voice | LUFS | Text | Warnings |\n|---|---|---|---|---|\n")
        for fr in (x for x in phrases if x["take"] == t["id"]):
            f.write(f"| `{fr['id']}` | {fr['voice_start']:.2f} to {fr['voice_end']:.2f} | {fr['lufs']} | {fr['text']} | {'; '.join(fr['warnings'])} |\n")
print(f"Done: {P}/work/TRANSCRIPT.md ({len(phrases)} phrases in {len(takes)} takes)")
