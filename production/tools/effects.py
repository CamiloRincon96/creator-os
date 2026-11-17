"""Stage 9 of /creator-reel: a reel's sound effects the way the niche does them, measured in the final mix (with the voice and the music).

    python3 production/tools/effects.py mix <piece> <sheet.json> [--name effects-vN]
    python3 production/tools/effects.py review <piece> [--name effects-vN]

Why this way (the first full reel made in "glass", Nov 17, 2026, three rounds with the creator):
  - v30: 106 sounds, many of them synthesized interface sounds, one on every little thing → "laser beams everywhere… childish".
  - v31: 19 sounds measured BEFORE the music went in; in the final mix they sat 7 dB under the voice → "you can't hear anything… bland".
  - v33: 41 real sounds (about 7 every 10 s), each brought to its level against the voice in the final mix, with a full hook
    → "exactly that". In the niche's reels an effect's peak sits about +2.6 dB over the voice (sound_study.py).

The sheet (Claude writes it from the moments in the animation's code; which sound goes where: production/SOUNDS.md):
  {"video": "output/scenes/reel-v4.mp4",                  the approved picture; its audio is the voice (relative to the piece)
   "music": {"file": "<path>", "from": 10.54},            optional: the low bed (15 LU under the voice, 3 dB less in the hook)
   "hook": 4.3,                                            second where the hook ends
   "effects": [{"t": 0.0, "what": "hit", "sound": "brands/example/sounds/openverse/punch-impact/....mp3", "level": "hook"}]}
  level (peak against the voice): hook +3 · hit +1.5 · transition 0 · object −1.5 · small −4 · rise −3
         · layer: sits under another sound at the same instant (not leveled) · fixed: keeps its "gain" (dB).
  Optional per effect: "adjust" (dB on top of its level: −3 to −7 if a whoosh's tail touches the next word), "highpass" (Hz; on a
  low hit, 60 to 120: at 170 it loses its body), "slice" [from, length], "anchor" (peak, start, end), "role" (whoosh, hit, paper,
  camera, riser… otherwise real-sfx's index says), "gain".

mix:
  1. the base: the voice (the video's audio) and the music bed with soft 2:1 ducking, in work/effects/<name>/;
  2. checks the sheet: nothing banned (synthesized interface sounds, dings, sparkles, the game coin), about 5 to 9 sounds every 10 s,
     a full hook (4 or more and the first before 0.6 s), no gap longer than 3.5 s and no recording used more than twice;
  3. mixes with real-sfx (the voice and the music inside the mix, --voice-safe --voice-depth light, −14 LUFS) and brings each effect
     to its level measured against the voice on the ducked track, in up to 6 rounds. Says which ones don't reach it (a recording that
     is too quiet: swap it or drop it; an effect 20 dB under the voice is not heard);
  4. leaves the videos in output/ (where all of the piece's videos go): <name>-with-music.mp4 (to listen; with CC0 music it's the
     TikTok and YouTube one) and <name>-no-music.mp4 (Instagram: the song is added by the Audio API at publishing). The working files
     (the effects track, the levels, the review and its pictures) stay in work/effects/<name>/.

review (always on the final mix, never before the music):
  - real-sfx: critique.py against the brand's niche style (brands/<brand>/sounds/study/style.json), verify.py, review.py and
    zoom.py of the hook. Both pictures get looked at;
  - Whisper word by word, voice alone against each mix. A word that changes is tried again in a 3 s window (reading the whole file
    the model gets things wrong, with no effect involved) and only counts if it changes there too;
  - writes work/effects/<name>/review.md with what was measured and the moments the person has to listen to.
real-sfx's "ears" (hear.py, YAMNet) don't work with a continuous voice on top: they get it wrong and only say "Speech". Decide with
the measurement against the voice, with Whisper and with the person's ears.
"""
import system
system.prepare(venv=True, args=2)
import difflib, json, os, re, shutil, subprocess, sys
from collections import Counter
from pathlib import Path

import numpy as np
from common import ROOT, load, normalize, piece, save, transcribe

SKILL = Path.home() / ".claude" / "skills" / "real-sfx"
LEVELS = {"hook": 3.0, "hit": 1.5, "transition": 0.0, "object": -1.5, "small": -4.0, "rise": -3.0}
BANNED = ("kenney/interfaz/", "kenney/interface/", "/chime/", "/notification/", "/sparkle/", "/shimmer/", "/coin/")   # "laser beams" (SOUNDS.md)
SR = 22050


def option(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


def run(script, *args):
    if not (SKILL / "scripts" / script).exists():
        sys.exit(f"The real-sfx skill is missing from {SKILL}. Run: {system.PY} production/install.py")
    r = subprocess.run([sys.executable, str(SKILL / "scripts" / script), *map(str, args)], capture_output=True, text=True, cwd=str(SKILL))
    if r.returncode not in (0, 1):
        sys.exit(f"real-sfx {script} failed:\n{(r.stdout + r.stderr)[-2000:]}")
    return r.stdout + r.stderr


def ff(*a):
    r = subprocess.run(["ffmpeg", "-y", "-v", "error", "-nostdin", *map(str, a)], capture_output=True, text=True)
    if r.returncode:
        sys.exit("ffmpeg failed:\n" + r.stderr[-1500:])


def lufs(p, extra=()):
    r = subprocess.run(["ffmpeg", "-nostats", "-nostdin", *extra, "-i", str(p), "-af", "ebur128", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    return float([l for l in r.splitlines() if l.strip().startswith("I:")][-1].split()[1])


def mono(p):
    r = subprocess.run(["ffmpeg", "-v", "error", "-nostdin", "-i", str(p), "-vn", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                       capture_output=True, check=True).stdout
    return np.frombuffer(r, dtype=np.float32).copy()


def envelope20(x):
    h = int(0.02 * SR)
    k = len(x) // h
    return 10 * np.log10(np.mean(x[:k * h].reshape(k, h) ** 2, 1) + 1e-10)


def brand_of(P):
    parts = Path(P).resolve().relative_to(Path(ROOT).resolve()).parts
    return parts[1] if len(parts) > 1 and parts[0] == "brands" else None


def duration(p):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                                capture_output=True, text=True).stdout)


# ---------------------------------------------------------------- the sheet
def check_sheet(h):
    """What already went wrong, checked before mixing. Returns warnings; anything banned stops everything."""
    ef = sorted(h["effects"], key=lambda e: e["t"])
    for e in ef:
        if any(b in e["sound"].replace("\\", "/") for b in BANNED):
            sys.exit(f"Banned: {e['sound']} ({e['t']} s). Synthesized interface sounds, dings and sparkles sound like \"laser beams\" (SOUNDS.md).")
        if not (Path(ROOT) / e["sound"]).exists():
            sys.exit(f"The sound at {e['t']} s doesn't exist: {e['sound']}")
        if e.get("level", "transition") not in (*LEVELS, "layer", "fixed"):
            sys.exit(f"Unknown level at {e['t']} s: {e['level']} (use {', '.join(LEVELS)}, layer or fixed)")
    gestures = []
    for e in ef:
        if not gestures or e["t"] - gestures[-1] > 0.25:
            gestures.append(e["t"])
    dur = h["_duration"]
    warnings = []
    per10 = 10 * len(gestures) / dur
    if per10 < 5:
        warnings.append(f"{per10:.1f} sounds every 10 s: too few (v31 had 3 and was \"bland\"; the middle is about 7)")
    if per10 > 9:
        warnings.append(f"{per10:.1f} sounds every 10 s: too many (v30 had 12 and was \"laser beams\"; the middle is about 7)")
    hook = float(h.get("hook", 4.0))
    in_hook = [t for t in gestures if t < hook]
    if len(in_hook) < 4 or not gestures or gestures[0] > 0.6:
        warnings.append(f"weak hook: {len(in_hook)} sounds before {hook} s and the first at {gestures[0] if gestures else '—'} s "
                        f"(it takes 4 or more and one on frame 0)")
    for a, b in zip([0.0] + gestures, gestures + [dur]):
        if b - a > 3.5:
            warnings.append(f"a {b - a:.1f} s gap with no effect ({a:.1f}–{b:.1f} s): attention drops there")
    uses = Counter(e["sound"] for e in ef if e.get("level") != "layer")
    for s, n in uses.items():
        if n > 2:
            warnings.append(f"{Path(s).name} sounds {n} times: the same sound over and over gives the pack away (2 at most)")
    return warnings, per10


def realsfx_sheet(h, base, with_music, gains):
    cues = []
    for i, e in enumerate(sorted(h["effects"], key=lambda e: e["t"])):
        c = {"t": float(e["t"]), "label": e.get("what", "effect"), "file": str((Path(ROOT) / e["sound"]).resolve())}
        if e.get("role"):
            c["role"] = e["role"]
        if e.get("highpass"):
            c["highpass"] = e["highpass"]
        if e.get("slice"):
            c["slice"] = e["slice"]
        if e.get("anchor"):
            c["anchor"] = e["anchor"]
        c["gain_db"] = round(gains.get(i, e.get("gain", 0.0)), 1)
        cues.append(c)
    bases = [{"file": str(base / "voice.wav"), "keep_level": True}]
    if with_music:
        bases.append({"file": str(base / "music-bed.wav"), "keep_level": True})
    return {"video": h["_video"], "keep_audio": "yes", "base_audio": bases, "cues": cues}


# ---------------------------------------------------------------- base: voice and music bed
def make_base(h, base):
    base.mkdir(parents=True, exist_ok=True)
    voice = base / "voice.wav"            # "voice" in the name: real-sfx recognizes it as the voice (--voice-safe)
    ff("-i", h["_video"], "-vn", "-ac", "2", "-ar", "48000", "-c:a", "pcm_s24le", voice)
    m = h.get("music")
    if not m:
        return voice, False
    dur = duration(voice)
    track = Path(ROOT) / m["file"]
    if not track.exists():
        sys.exit(f"The music doesn't exist: {track}")
    raw = base / "music-raw.wav"
    ff("-ss", f"{float(m.get('from', 0)):.3f}", "-i", track, "-af",
       f"asetpts=PTS-STARTPTS,aresample=48000,apad,atrim=end={dur:.4f},afade=t=in:d=0.03,afade=t=out:st={dur - 1.2:.4f}:d=1.2",
       "-ac", "2", "-ar", "48000", raw)
    g = (lufs(voice) - float(m.get("under_voice", 15.0))) - lufs(raw, ("-t", "30"))
    hk = float(h.get("hook", 4.0))
    env = f"if(lt(t,{hk - 0.3:.2f}),0.708,if(lt(t,{hk + 0.3:.2f}),0.708+(t-{hk - 0.3:.2f})/0.6*0.292,1))"   # −3 dB in the hook
    ff("-i", raw, "-i", voice, "-filter_complex",
       f"[0:a]volume={g:.2f}dB,volume='{env}':eval=frame[m];"
       f"[m][1:a]sidechaincompress=threshold=0.12:ratio=2:attack=30:release=700:makeup=1[o]",
       "-map", "[o]", "-c:a", "pcm_s24le", base / "music-bed.wav")
    return voice, True


def measure(work, voice, effects):
    """Each effect's peak (20 ms windows, from t−0.12 to t+0.30) against the voice's median while it speaks."""
    ev, es = envelope20(mono(voice)), envelope20(mono(work / "mix_sfx_ducked.wav"))
    voice_db = float(np.median(ev[ev > np.percentile(ev, 95) - 25]))
    measured = {}
    for i, e in enumerate(effects):
        i0, i1 = int(max(0, e["t"] - 0.12) / 0.02), int((e["t"] + 0.30) / 0.02)
        measured[i] = float(es[i0:i1].max()) - voice_db
    return measured


def mix():
    P = piece(sys.argv[2])
    sheet = Path(sys.argv[3]) if os.path.isabs(sys.argv[3]) else Path(P) / sys.argv[3]
    h = load(str(sheet))
    name = option("--name", sheet.stem.replace("-sheet", ""))
    h["_video"] = str((Path(P) / h["video"]).resolve())
    h["_duration"] = duration(h["_video"])
    effects = sorted(h["effects"], key=lambda e: e["t"])
    h["effects"] = effects
    warnings, per10 = check_sheet(h)
    print(f"{len(effects)} sounds, {per10:.1f} every 10 s" + ("" if warnings else " · the sheet passes"))
    for w in warnings:
        print("  WARNING", w)
    work = Path(P) / "work" / "effects" / name
    voice, has_music = make_base(h, work / "base")
    gains, measured = {}, {}
    rs_sheet = work / "realsfx-sheet.json"
    args = ["--voice-safe", "--voice-depth", "light", "--target-lufs", "-14"]
    for rnd in range(1, 7):
        save(realsfx_sheet(h, work / "base", has_music, gains), str(rs_sheet))
        run("mix.py", rs_sheet, "--out", work / "mix.mp4", *args)
        measured = measure(work, voice, effects)
        off = 0
        for i, e in enumerate(effects):
            lv = e.get("level", "transition")
            if lv in LEVELS:
                d = LEVELS[lv] + float(e.get("adjust", 0.0)) - measured[i]
                if abs(d) > 1.0:
                    off += 1
                    gains[i] = round(max(-24.0, min(30.0, gains.get(i, 0.0) + max(-12.0, min(12.0, d)))), 1)
        print(f"  round {rnd}: {off} sounds more than 1 dB from their level · median {np.median(list(measured.values())):+.1f} dB vs the voice")
        if off == 0:
            break
    save(realsfx_sheet(h, work / "base", has_music, gains), str(rs_sheet))
    run("mix.py", rs_sheet, "--out", work / "mix.mp4", *args)
    measured = measure(work, voice, effects)
    rows, short = [], []
    for i, e in enumerate(effects):
        lv = e.get("level", "transition")
        target = LEVELS[lv] + float(e.get("adjust", 0.0)) if lv in LEVELS else None
        rows.append({"t": e["t"], "what": e.get("what"), "level": lv, "target_dB": target, "measured_dB": round(measured[i], 1),
                     "gain_dB": gains.get(i, e.get("gain", 0.0))})
        if target is not None and measured[i] < target - 3:
            short.append(f"{e['t']} s {e.get('what')} ({Path(e['sound']).name}): sits at {measured[i]:+.1f} dB (should be {target:+.1f})")
    out = Path(P) / "output"
    out.mkdir(parents=True, exist_ok=True)
    if has_music:
        shutil.copy2(work / "mix.mp4", out / f"{name}-with-music.mp4")
        save(realsfx_sheet(h, work / "base", False, gains), str(work / "realsfx-sheet-no-music.json"))
        run("mix.py", work / "realsfx-sheet-no-music.json", "--out", work / "no-music" / "mix.mp4", *args)
        shutil.copy2(work / "no-music" / "mix.mp4", out / f"{name}-no-music.mp4")
    else:
        shutil.copy2(work / "mix.mp4", out / f"{name}-no-music.mp4")
    shutil.copy2(work / "mix_sfx_track.wav", work / f"{name}.wav")
    med = float(np.median([r["measured_dB"] for r in rows if r["target_dB"] is not None]))
    save({"sheet": os.path.relpath(sheet, P), "sounds": len(effects), "per_10_s": round(per10, 1), "median_vs_voice_dB": round(med, 1),
          "warnings": warnings, "short": short, "effects": rows}, str(work / "levels.json"))
    print(f"\nEffects median: {med:+.1f} dB against the voice (the niche: about +2.6; v31, which \"couldn't be heard\": −7.3).")
    for x in short:
        print("  SHORT", x, "→ swap the recording or drop the effect")
    for f in (out / f"{name}-with-music.mp4", out / f"{name}-no-music.mp4", work / "levels.json"):
        if f.exists():
            print(" ", f)
    print(f"Next: {system.PY} production/tools/effects.py review {os.path.relpath(P, ROOT)} --name {name}")


# ---------------------------------------------------------------- review
def audio16(p, a=None, b=None):
    cmd = ["ffmpeg", "-v", "error", "-nostdin"] + (["-ss", f"{a:.2f}", "-t", f"{b - a:.2f}"] if a is not None else []) + \
          ["-i", str(p), "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"]
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, dtype=np.float32).copy()


def word_by_word(voice, mixed):
    """Voice alone against the mix. Each word that changes is heard again in a 3 s window: it only counts if it changes there too."""
    a, b = transcribe(audio16(voice), 16000), transcribe(audio16(mixed), 16000)
    sa, sb = [normalize(w["t"]) for w in a], [normalize(w["t"]) for w in b]
    sm = difflib.SequenceMatcher(None, sa, sb, autojunk=False)
    same = sum(m.size for m in sm.get_matching_blocks()) / max(1, len(sa))
    changes = []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal" or i1 >= len(a):
            continue
        t = a[i1]["start"]
        before, after = " ".join(sa[i1:i2]), " ".join(sb[j1:j2])
        if re.fullmatch(r"[0-9 ]+", before or "x") or re.fullmatch(r"[0-9 ]+", after or "x"):
            changes.append((t, before, after, "a number written differently"))
            continue
        w0, w1 = max(0.0, t - 1.5), t + 1.5
        va = " ".join(normalize(w["t"]) for w in transcribe(audio16(voice, w0, w1), 16000))
        vb = " ".join(normalize(w["t"]) for w in transcribe(audio16(mixed, w0, w1), 16000))
        real = difflib.SequenceMatcher(None, va.split(), vb.split()).ratio() < 0.9
        changes.append((t, before, after, "REAL: an effect covers the word" if real else "only the transcriber (the same in the window)"))
    return same, changes


def review():
    P = piece(sys.argv[2])
    name = option("--name")
    if not name:
        done = sorted((Path(P) / "work" / "effects").glob("*/mix.mp4"), key=lambda p: p.stat().st_mtime)
        if not done:
            sys.exit("There's no mix: run effects.py mix first")
        name = done[-1].parent.name
    work = Path(P) / "work" / "effects" / name
    out = Path(P) / "output"
    levels = load(str(work / "levels.json"))
    resolved, track = work / "mix_resolved_cues.json", work / "mix_sfx_track.wav"
    report = [f"# Sound review: {name}", "",
              f"- **Effects:** {levels['sounds']} ({levels['per_10_s']} every 10 s); median **{levels['median_vs_voice_dB']:+.1f} dB** "
              f"against the voice (the niche: about +2.6; \"can't be heard\": −7)."]
    for w in levels["warnings"]:
        report.append(f"- WARNING {w}")
    for x in levels["short"]:
        report.append(f"- SHORT {x}")
    brand = brand_of(P)
    style = Path(ROOT) / "brands" / str(brand) / "sounds" / "study" / "style.json"
    style_args = []
    if style.exists():
        dest = SKILL / "styles" / f"{brand}-niche.json"
        dest.parent.mkdir(exist_ok=True)
        shutil.copy2(style, dest)
        style_args = ["--style", f"{brand}-niche"]
    else:
        report.append(f"- WARNING the brand has no niche sound study ({style.relative_to(ROOT)}): make it with sound_study.py")
    critique = run("critique.py", resolved, track, "--list", *style_args)
    (work / "critique.md").write_text(critique, encoding="utf-8")
    axes = [l for l in critique.splitlines() if re.match(r"\| (hook|sync|pacing|balance|audibility|speech|low_end|variety) \|", l)]
    report += ["", "## real-sfx (on the final mix)", "", "| axis | score | basis |", "|---|---|---|", *axes]
    ver = run("verify.py", resolved, track)
    report.append(f"\n`verify.py`: {next((l for l in ver.splitlines() if 'cues:' in l), ver.strip().splitlines()[-1] if ver.strip() else '')}")
    run("review.py", resolved, track, "--out", work / "mix.png")
    hook = 4.3
    try:
        hook = float(load(str(Path(P) / levels["sheet"])).get("hook", 4.3))
    except (OSError, ValueError, KeyError):
        pass
    final = out / f"{name}-with-music.mp4"
    if not final.exists():
        final = out / f"{name}-no-music.mp4"
    run("zoom.py", resolved, track, "--at", round(hook / 2, 2), "--span", round(hook + 0.4, 2), "--video", final,
        "--out", work / "hook.png")
    voice = work / "base" / "voice.wav"
    report += ["", "## The voice, word by word (Whisper)", ""]
    for kind in ("with-music", "no-music"):
        m = out / f"{name}-{kind}.mp4"
        if not m.exists():
            continue
        same, changes = word_by_word(voice, m)
        real = [c for c in changes if c[3].startswith("REAL")]
        report.append(f"- **{kind}:** {same:.3f} the same as the voice alone; {len(real)} word(s) really covered.")
        for t, x, y, why in changes:
            report.append(f"  - {t:.2f} s: \"{x}\" → \"{y}\" · {why}")
    loud = sorted((r for r in levels["effects"] if r["level"] in ("hook", "hit")), key=lambda r: r["t"])[:5]
    report += ["", "## To listen to (the person, on headphones and on the phone)", "",
               f"- the hook (0 to {hook} s);", *[f"- {r['t']} s, {r['what']};" for r in loud],
               "", f"Pictures to look at: `{work / 'mix.png'}` (the whole reel) and `{work / 'hook.png'}` (the hook up close)."]
    (work / "review.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    print("\n".join(report))
    print(f"\n{work / 'review.md'}")


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "mix":
        if len(sys.argv) < 4:
            sys.exit(__doc__)
        mix()
    elif cmd == "review":
        review()
    else:
        sys.exit(__doc__)
