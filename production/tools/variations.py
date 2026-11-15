"""Stage 12 of /creator-reel: builds the variations of a finished video to post them as trial reels on the same day.

    python3 production/tools/variations.py <piece> <variations.json> [--draft]

--draft: 540p versions, fast and with no batch, in variations/drafts/: they are what the creator watches to approve the
plan (12a) before anything is produced at final quality.

Each variation comes from the final video WITHOUT music (brands/<brand>/finals/<project>/<name>-no-music.mp4: picture, voice and
effects). Instagram punishes repeated content, so each one really changes the first seconds:
  - "open_with": [start, end] (seconds of the original video) or "scene": n. That moment goes first (a teaser) and then
    the video from the beginning.
  - "remove": scenes (numbers) or stretches [start, end] that are taken out (short version). The cuts fall on the scene
    changes, where there is already a whoosh and no caption gets split.
  - "segments": [...]: the full order of the variation, to re-edit the structure (the main way to make a
    variation, see PROMPT.md). Each segment is a scene (n), a group of consecutive scenes ("2-3") or [start, end] in
    seconds of the original; {"segment": ..., "pause": 0.3} holds the last frame and leaves that silence after it (so
    two phrases that end up joined can breathe: about 0.45 s goes between phrases); "freeze_at": t holds the frame of
    that second from there on (so the pause does not show the start of the next transition; the audio plays on). It
    replaces "open_with" and "remove". The tool warns if a cut splits a word.
  - "remotion_hook": {"composition": "MyPieceHook", "props": {"variant": "b"}, "until_scene": 1}: a new hook made in
    the brand's Remotion project (motion graphics, the person with something else on top). The frames of the scenes up
    to "until_scene" are rendered and replace those frames of the base video; the audio is still the base's.
    It is the way to IMPROVE the opening instead of only reordering it (PROMPT.md).
  - "remotion_video": {"composition": "MyPieceRewind", "props": {}}: the variation's whole picture comes from a Remotion
    composition (a rearrangement built with transitions, e.g. the teaser with a rewind). The sound is built with
    "segments" over the base (voice and effects), which must last as long as the composition.
  - "keep": true: the variation already exists in variations/<id>.mp4 and is used as is (it only goes into the batch).
  - "music": {"file", "align": [second_in_the_track, second_of_the_original_video]}. Adds the music with the usual gentle
    ducking (2:1, about 3 dB under the voice), lining up a hit in the track with a moment of the video
    (if that moment appears twice, with the second one). "at": t places the hit at second t of the variation instead.
    Without "music", the variation has no music.
  - "hook": {"text": "...", "until": 2.5}: a big line at the top in the first seconds (*word* in mint). It is
    rendered by the HookText composition of the brand's Remotion project (brands/<brand>/reel) with a transparent background.
  - "effects": [{"file", "t", "level", "anchor"}]: standalone sound effects (repo paths), mostly for the
    hook. "t" is the second of the variation; "anchor": "peak" puts the sound's loudest point on "t" (hits,
    risers) and "start" starts it at "t" (pops, dings); "level" is the peak in dBFS (default -15). Which ones to use and
    what for: production/SOUNDS.md. One per hook; never the over-the-top ones.
  - "manual": true: instagram.py does not post this variation; the creator uploads it from the app (e.g. with a
    trending song from Instagram's library). It has no music.
  - "cover_s": second of the variation for the cover (used by instagram.py).
Which variations to propose and why: production/variations/PROMPT.md. Music: MUSIC.md. Schedule: CALENDAR.md.
Leaves each variation in brands/<brand>/finals/<project>/variations/<id>.mp4 at -14 LUFS, plus batch.json for instagram.py
(copies, times, cover; not approved). The voice that drives the ducking is the piece's final voice (voice/*-v*.wav).
"""
import json
import re
import subprocess
import sys
from pathlib import Path

if len(sys.argv) < 3:
    sys.exit(__doc__)
FPS = 30
P = Path(sys.argv[1]).resolve()
spec = json.loads(Path(sys.argv[2]).read_text())
DRAFT = "--draft" in sys.argv[3:]
QUALITY = ["-crf", "23", "-preset", "ultrafast"] if DRAFT else ["-crf", "18", "-preset", "medium"]
REPO = Path(__file__).resolve().parents[2]
brand = P.parent.parent.name
piece_name = P.name.split("-", 3)[-1] if P.name[:4].isdigit() else P.name
project = f"{brand}-reel-{piece_name}"
BRAND_DIR = P.parent.parent  # brands/<brand>
FINAL = BRAND_DIR / "finals" / project
base = FINAL / f"{piece_name}-no-music.mp4"
if not base.exists():
    sys.exit(f"{base.relative_to(REPO)} is missing: the final version without music (picture, voice and effects) is the base of the variations")
voices = sorted((p for p in P.glob("voice/*-v*.wav") if "to-enhance" not in p.name), key=lambda p: p.stat().st_mtime)
if not voices:
    sys.exit("The piece's final voice is missing (voice/*-v*.wav)")
VOICE = voices[-1]
# words with their timing (same clock as the video): to warn if a cut splits a word
_cj = sorted(P.glob("voice/cut-v*.json"), key=lambda p: int(re.search(r"-v(\d+)", p.name).group(1)))
WORDS = []
if _cj:
    _d = json.loads(_cj[-1].read_text())
    WORDS = _d.get("words") or [w for fr in _d.get("phrases", []) for w in fr.get("words", [])]
G = json.loads((P / "visual-script.json").read_text())
f = lambda s: round(s * FPS)  # noqa: E731
DUR = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(base)], capture_output=True, text=True).stdout)
SC = {e["n"]: (f(e["start"]) / FPS, f(e["end"]) / FPS) for e in G["scenes"]}
last = max(SC)
SC[last] = (SC[last][0], DUR)  # the outro was stretched beyond the voice


def segment(x):
    if isinstance(x, int):
        return SC[x]
    if isinstance(x, str):  # "2-3": from scene 2 to scene 3
        a, b = (int(y) for y in x.split("-"))
        return (SC[a][0], SC[b][1])
    return (float(x[0]), float(x[1]))


def split_word(t):
    for w in WORDS:
        if w["start"] + 0.02 < t < w["end"] - 0.02:
            return w.get("t") or w.get("text") or "?"
    return None


def lufs(path, extra=()):
    out = subprocess.run(["ffmpeg", "-nostats", *extra, "-i", str(path), "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
    return float([l for l in out.splitlines() if l.strip().startswith("I:")][-1].split()[1])


def peak_of(path):
    """second of a sound's loudest point (decoded at 8 kHz, 10 ms windows)"""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", "8000", "-f", "s16le", "-"], capture_output=True).stdout
    import array
    a = array.array("h", raw)
    best, idx = 0.0, 0
    for i in range(0, len(a), 80):
        v = sum(x * x for x in a[i:i + 80]) / 80
        if v > best:
            best, idx = v, i
    return idx / 8000


def ff(*a):
    r = subprocess.run(["ffmpeg", "-y", "-v", "error", *map(str, a)], capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(r.stderr[-1500:])


output = FINAL / "variations"
output.mkdir(parents=True, exist_ok=True)
target_dir = output / "drafts" if DRAFT else output
target_dir.mkdir(exist_ok=True)
# never overwrite a batch: an approved or scheduled one is never touched; a draft one is kept as batch.previous.json
previous = output / "batch.json"
if previous.exists() and not DRAFT:
    old = json.loads(previous.read_text())
    if old.get("approved") or any(x.get("status") not in ("pending", "manual") for x in old.get("posts", [])):
        sys.exit(f"{previous.relative_to(REPO)} is already approved or posted: it is not touched. Use another folder or cancel it first.")
    previous.replace(output / "batch.previous.json")
tmp = target_dir / "_tmp"
tmp.mkdir(exist_ok=True)
batch = {"brand": brand, "project": project, "day": spec.get("day"), "timezone": "America/Bogota", "trial": spec.get("trial", True),
         "graduation": spec.get("graduation", "MANUAL"), "approved": None, "posts": []}


def entry(v, video):
    return {"id": v["id"], "video": str(video.relative_to(REPO)), "copy": v.get("copy", ""), "time": v.get("time"),
            "cover_ms": int(round(v.get("cover_s", 0.5) * 1000)), "tests": v.get("tests", ""),
            "hook": (v.get("hook") or {}).get("text", ""), "manual": bool(v.get("manual")),
            "status": "manual" if v.get("manual") else "pending"}


for v in spec["variations"]:
    if v.get("keep"):
        done = output / f"{v['id']}.mp4"
        if not done.exists():
            sys.exit(f"{v['id']}: it says keep but {done.relative_to(REPO)} does not exist")
        if DRAFT:
            ff("-i", done, "-vf", "scale=540:-2", "-c:v", "libx264", "-crf", "28", "-preset", "veryfast", "-c:a", "aac", "-b:a", "160k",
               "-movflags", "+faststart", target_dir / done.name)
        batch["posts"].append(entry(v, done))
        print(f"{v['id']}: kept as is")
        continue
    # 1. the timeline: the order in "segments", or teaser + video without what is removed
    if "segments" in v:
        parts, pauses, freeze, remove, opens = [], [], [], [], []
        for x in v["segments"]:
            d = x if isinstance(x, dict) else {"segment": x}
            parts.append(segment(d["segment"]))
            pauses.append(float(d.get("pause", 0)))
            freeze.append(float(d["freeze_at"]) if "freeze_at" in d else None)
    else:
        remove = sorted(segment(x) for x in v.get("remove", []))
        body, t = [], 0.0
        for a, b in remove:
            if a > t:
                body.append((t, a))
            t = max(t, b)
        if t < DUR:
            body.append((t, DUR))
        opens = [segment(v["open_with"] if "open_with" in v else v["scene"])] if ("open_with" in v or "scene" in v) else []
        parts = opens + body
        pauses = [0.0] * len(parts)
        freeze = [None] * len(parts)
    total = sum(b - a for a, b in parts) + sum(pauses)
    # 0. a new hook made in Remotion: its frames replace the opening frames in this variation's base
    base_v = base
    rh = v.get("remotion_hook")
    if rh:
        until_f = f(SC[rh.get("until_scene", 1)][1])
        layer_h = tmp / f"{v['id']}-hook-remotion.mp4"
        props_h = json.dumps(rh.get("props", {}), ensure_ascii=False)
        cmd = ["npx", "remotion", "render", rh["composition"], str(layer_h), f"--props={props_h}", f"--frames=0-{until_f - 1}", "--muted", "--log=error"]
        if DRAFT:
            cmd.append("--scale=0.5")
        chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        if Path(chrome).exists():
            cmd.append(f"--browser-executable={chrome}")
        r = subprocess.run(cmd, cwd=BRAND_DIR / "reel", capture_output=True, text=True)
        if r.returncode:
            raise SystemExit(f"{v['id']}: Remotion could not render the hook: {r.stderr[-800:]}")
        base_v = tmp / f"{v['id']}-base.mp4"
        ff("-i", layer_h, "-i", base, "-filter_complex",
           f"[0:v]scale=1080:1920,fps={FPS},setpts=PTS-STARTPTS[g];[1:v]trim=start_frame={until_f},setpts=PTS-STARTPTS[r];[g][r]concat=n=2:v=1:a=0[v]",
           "-map", "[v]", "-map", "1:a", "-c:v", "libx264", *QUALITY, "-pix_fmt", "yuv420p", "-r", FPS, "-c:a", "copy", base_v)
    for a, b in parts:
        for t_cut in (a, b):
            w = split_word(t_cut)
            if w:
                print(f"  WARNING {v['id']}: the cut at {t_cut:.2f} s splits the word \"{w}\"")

    def new_time(t_orig):
        """second of the variation where a second of the original video lands (the last time it appears)"""
        acc, found = 0.0, None
        for (a, b), pa in zip(parts, pauses):
            if a <= t_orig < b:
                found = acc + (t_orig - a)
            acc += b - a + pa
        return found

    # 2. picture and audio (voice + effects) cut; the voice alone to drive the ducking
    fc, n = [], len(parts)
    # each input is used several times: it has to be split first (ffmpeg does not let you read the same one twice)
    fc.append(f"[0:v]split={n}" + "".join(f"[vs{i}]" for i in range(n)))
    fc.append(f"[0:a]asplit={n}" + "".join(f"[as{i}]" for i in range(n)))
    fc.append(f"[1:a]aresample=48000,apad=whole_dur={DUR:.4f},asplit={n}" + "".join(f"[ks{i}]" for i in range(n)))
    for i, (a, b) in enumerate(parts):
        fade = f"afade=t=in:d=0.008,afade=t=out:st={b - a - 0.008:.4f}:d=0.008"
        pa, fz = pauses[i], freeze[i]
        vb, still = (fz, b - fz + pa) if fz else (b, pa)
        hold = f",tpad=stop_mode=clone:stop_duration={still:.4f}" if still > 0 else ""
        sil = f",apad=pad_dur={pa:.4f}" if pa else ""
        fc.append(f"[vs{i}]trim={a:.4f}:{vb:.4f},setpts=PTS-STARTPTS{hold}[v{i}]")
        fc.append(f"[as{i}]atrim={a:.4f}:{b:.4f},asetpts=PTS-STARTPTS,{fade}{sil}[a{i}]")
        fc.append(f"[ks{i}]atrim={a:.4f}:{b:.4f},asetpts=PTS-STARTPTS,{fade}{sil}[k{i}]")
    fc.append("".join(f"[v{i}][a{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=1[v][a]")
    fc.append("".join(f"[k{i}]" for i in range(n)) + f"concat=n={n}:v=0:a=1[k]")
    cut = tmp / f"{v['id']}-cut.mp4"
    voice = tmp / f"{v['id']}-voice.wav"
    ff("-i", base_v, "-i", VOICE, "-filter_complex", ";".join(fc),
       "-map", "[v]", "-map", "[a]", "-c:v", "libx264", *QUALITY, "-pix_fmt", "yuv420p", "-r", FPS,
       "-c:a", "pcm_s24le", cut.with_suffix(".mov"), "-map", "[k]", "-ac", "2", "-ar", "48000", voice)
    cut = cut.with_suffix(".mov")

    # 2a. the whole picture made in Remotion (a rearrangement with transitions): replaces the cut's picture
    rv = v.get("remotion_video")
    if rv:
        layer_v = tmp / f"{v['id']}-video-remotion.mp4"
        cmd = ["npx", "remotion", "render", rv["composition"], str(layer_v), f"--props={json.dumps(rv.get('props', {}), ensure_ascii=False)}", "--muted", "--log=error"]
        if DRAFT:
            cmd.append("--scale=0.5")
        chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        if Path(chrome).exists():
            cmd.append(f"--browser-executable={chrome}")
        r = subprocess.run(cmd, cwd=BRAND_DIR / "reel", capture_output=True, text=True)
        if r.returncode:
            raise SystemExit(f"{v['id']}: Remotion could not render {rv['composition']}: {r.stderr[-800:]}")
        with_v = tmp / f"{v['id']}-cut-remotion.mov"
        ff("-i", layer_v, "-i", cut, "-map", "0:v", "-map", "1:a", "-vf", "scale=1080:1920", "-c:v", "libx264", *QUALITY, "-pix_fmt", "yuv420p",
           "-r", FPS, "-c:a", "copy", "-shortest", with_v)
        cut = with_v

    # 2b. hook text over the first seconds (the HookText composition of the brand's Remotion project)
    hk = v.get("hook")
    if hk:
        reel = BRAND_DIR / "reel"
        layer = tmp / f"{v['id']}-hook.mov"
        props = json.dumps({"text": hk["text"], "seconds": float(hk.get("until", 2.5))}, ensure_ascii=False)
        chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        cmd = ["npx", "remotion", "render", "HookText", str(layer), "--codec=prores", "--prores-profile=4444",
               "--pixel-format=yuva444p10le", "--image-format=png", f"--props={props}", "--log=error"]
        if Path(chrome).exists():
            cmd.append(f"--browser-executable={chrome}")
        r = subprocess.run(cmd, cwd=reel, capture_output=True, text=True)
        if r.returncode:
            raise SystemExit(f"HookText: {r.stderr[-800:]}")
        with_hook = tmp / f"{v['id']}-cut-hook.mov"
        ff("-i", cut, "-i", layer, "-filter_complex", "[0:v][1:v]overlay=0:0:eof_action=pass[v]", "-map", "[v]", "-map", "0:a",
           "-c:v", "libx264", *QUALITY, "-pix_fmt", "yuv420p", "-r", FPS, "-c:a", "copy", with_hook)
        cut = with_hook

    # 2c. standalone effects (the hook's sound): each one at its peak in dBFS, anchored by its start or by its peak
    efs = v.get("effects", [])
    if efs:
        ins, fc, et = ["-i", cut], [], []
        for k, e in enumerate(efs):
            path = (REPO / e["file"]).resolve()
            if not path.exists():
                raise SystemExit(f"{v['id']}: the effect {e['file']} does not exist")
            ins += ["-i", path]
            ini = float(e["t"]) - (peak_of(path) if e.get("anchor") == "peak" else 0.0)
            pre = f"atrim=start={-ini:.4f},asetpts=PTS-STARTPTS," if ini < 0 else (f"adelay={int(ini * 1000)}:all=1," if ini > 0 else "")
            vol = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True).stderr
            pk = float([l for l in vol.splitlines() if "max_volume" in l][0].split(":")[1].split()[0])
            g = float(e.get("level", -15)) - pk
            fc.append(f"[{k + 1}:a]aresample=48000,aformat=channel_layouts=stereo,{pre}volume={g:.2f}dB[e{k}]")
            et.append(f"[e{k}]")
        fc.append("[0:a]" + "".join(et) + f"amix=inputs={len(efs) + 1}:normalize=0:duration=first[a]")
        with_fx = tmp / f"{v['id']}-cut-effects.mov"
        ff(*ins, "-filter_complex", ";".join(fc), "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "pcm_s24le", with_fx)
        cut = with_fx

    # 3. music with gentle ducking, lined up with a hit in the video
    mix = tmp / f"{v['id']}-mix.wav"
    m = v.get("music")
    if m:
        track = (REPO / m["file"]).resolve()
        hit_track, hit_video = m.get("align", [0.0, 0.0])
        dest = float(m["at"]) if "at" in m else new_time(hit_video)
        ini = hit_track - (dest if dest is not None else 0.0)
        pre = f"atrim=start={ini:.4f}," if ini >= 0 else f"adelay={int(-ini * 1000)}:all=1,"
        L_base = lufs(cut)
        raw = tmp / f"{v['id']}-music.wav"
        ff("-i", track, "-af", f"{pre}asetpts=PTS-STARTPTS,aresample=48000,apad,atrim=end={total:.4f},afade=t=in:d=0.05,"
           f"afade=t=out:st={total - 1.2:.4f}:d=1.2", "-ac", "2", "-ar", "48000", raw)
        g = (L_base - 13.1) - lufs(raw, ("-t", f"{min(total, 30):.2f}"))
        ff("-i", cut, "-i", raw, "-i", voice, "-filter_complex",
           f"[1:a]volume={g:.2f}dB[m];[m][2:a]sidechaincompress=threshold=0.12:ratio=2:attack=30:release=700:makeup=1[md];"
           f"[0:a][md]amix=inputs=2:normalize=0:duration=first[o]", "-map", "[o]", "-c:a", "pcm_s24le", mix)
    else:
        ff("-i", cut, "-map", "0:a", "-c:a", "pcm_s24le", mix)

    # 4. to -14 LUFS with a -1.5 dB ceiling, and the final video
    g = -14.0 - lufs(mix)
    final = target_dir / f"{v['id']}.mp4"
    picture = ["-vf", "scale=540:-2", "-c:v", "libx264", "-crf", "28", "-preset", "veryfast"] if DRAFT else ["-c:v", "copy"]
    ff("-i", cut, "-i", mix, "-map", "0:v", "-map", "1:a", *picture, "-af", f"volume={g:.2f}dB,alimiter=limit=0.84:level=false",
       "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-movflags", "+faststart", final)
    batch["posts"].append(entry(v, final))
    timeline = ("order " + str(v["segments"])) if "segments" in v else ("opens with " + str(opens[0] if opens else "the start") + " · removes " + str(remove or "—"))
    print(f"{v['id']}: {total:.1f} s · effects {', '.join(Path(e['file']).stem for e in efs) or '—'} · hook {(chr(34) + hk['text'] + chr(34)) if hk else '—'}"
          f"{' · MANUAL' if v.get('manual') else ''} · {timeline} · music {Path(m['file']).stem if m else 'none'} · {lufs(final):.1f} LUFS")

for x in tmp.iterdir():
    x.unlink()
tmp.rmdir()
if DRAFT:
    print(f"\ndrafts in {target_dir.relative_to(REPO)} (540p, no batch): to approve the plan")
else:
    (output / "batch.json").write_text(json.dumps(batch, indent=1, ensure_ascii=False))
    print(f"\nbatch: {(output / 'batch.json').relative_to(REPO)} (not approved: the creator approves it in the chat)")
