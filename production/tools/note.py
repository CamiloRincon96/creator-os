"""The daily reel from a voice note: the creator's voice + scenes animated with the brand's kit (Explainer composition).

    python3 production/tools/note.py render <piece> [--draft] [--music <file> --align <track_s>,<video_s>] [--brand b]

Before that, with /creator-reel in express mode (see .claude/skills/creator-reel/SKILL.md):
  1. The voice note goes in <piece>/source/ (a phone recording works) -> prepare.py, cut.py and voice.py as usual
     (removes pauses and filler words, levels). That leaves voice/cut-vN.json (words with timings) and the final voice .wav.
  2. Claude writes <piece>/explainer.json: {"scenes": [...], "noCaptions": [i, …]} with the words' timings.
     Types (brands/<brand>/reel/src/explainer/Explainer.tsx):
       title {text, kicker?} · number {value, prefix?, label, tone?} · list {title?, items, at?}
       · clip {clip: <library id> | video, from?, text?} · app {screen: balance|transactions|log, …}
       · outro {cta, sub?}
     `*word*` comes out in the accent color. The outro can last longer than the voice (so the call to action can be read).
render:
  - copies the voice and the library clips to public/pieces/<piece>/ of the brand's Remotion project and writes the data there;
  - renders Explainer (540p with --draft) to <piece>/output/explainer-vN.mp4;
  - sound: a soft hit on frame 0, a whoosh on each scene change and, if asked, music with ducking;
    all at -14 LUFS. The effects come from brands/<brand>/sounds/openverse (CC0, with credits);
  - checks the cover (faces.py) and leaves 3 candidates.
"""
import system

system.prepare()

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
P = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else None
FPS = 30


def ff(*a):
    r = subprocess.run(["ffmpeg", "-y", "-v", "error", *map(str, a)], capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(r.stderr[-1500:])


def lufs(path):
    out = subprocess.run(["ffmpeg", "-nostats", "-i", str(path), "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
    return float([l for l in out.splitlines() if l.strip().startswith("I:")][-1].split()[1])


def peak_of(path):
    import array
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", "8000", "-f", "s16le", "-"], capture_output=True).stdout
    a = array.array("h", raw)
    best, idx = 0.0, 0
    for i in range(0, len(a), 80):
        v = sum(x * x for x in a[i:i + 80]) / 80
        if v > best:
            best, idx = v, i
    return idx / 8000


def render(draft=False):
    brand = sys.argv[sys.argv.index("--brand") + 1] if "--brand" in sys.argv else P.parent.parent.name
    brand_dir = REPO / "brands" / brand
    reel = brand_dir / "reel"
    spec = json.loads((P / "explainer.json").read_text())
    cuts = sorted(P.glob("voice/cut-v*.json"), key=lambda p: int(re.search(r"-v(\d+)", p.name).group(1)))
    if not cuts:
        sys.exit("voice/cut-vN.json is missing: first run prepare.py and cut.py on the voice note")
    cj = json.loads(cuts[-1].read_text())
    words = cj.get("words") or [w for fr in cj.get("phrases", []) for w in fr.get("words", [])]
    voices = sorted((p for p in P.glob("voice/*.wav") if "to-enhance" not in p.name), key=lambda p: p.stat().st_mtime)
    if not voices:
        sys.exit("The voice is missing (voice/*.wav)")
    pub = reel / "public" / "pieces" / P.name
    pub.mkdir(parents=True, exist_ok=True)
    shutil.copy2(voices[-1], pub / "voice.wav")
    # library clips: they are copied, and the piece they were used in is noted
    index_path = REPO / "library" / "index.json"
    index = json.loads(index_path.read_text()) if index_path.exists() else {"clips": {}}
    for e in spec["scenes"]:
        if e["type"] == "clip" and e.get("clip"):
            t = index["clips"].get(e["clip"])
            if not t:
                sys.exit(f"Clip {e['clip']} is not in library/index.json")
            src = REPO / t["video"]
            if not src.exists():
                sys.exit(f"Clip {e['clip']} is cataloged but its video is not on this computer ({t['video']})")
            shutil.copy2(src, pub / src.name)
            e["video"] = src.name
            if P.name not in t.setdefault("used_in", []):
                t["used_in"].append(P.name)
    if index["clips"]:
        index_path.write_text(json.dumps(index, indent=1, ensure_ascii=False))
    data = {"folder": f"pieces/{P.name}", "voice": "voice.wav", "duration": spec["scenes"][-1]["end"],
            "words": [{"t": w["t"], "start": w["start"], "end": w["end"]} for w in words],
            "scenes": spec["scenes"], "noCaptions": spec.get("noCaptions", [])}
    (pub / "explainer.json").write_text(json.dumps(data, ensure_ascii=False))
    output = P / "output"
    output.mkdir(exist_ok=True)
    n = 1 + max([int(m.group(1)) for p in output.glob("explainer-v*.mp4") if (m := re.search(r"-v(\d+)", p.name))] or [0])
    raw = output / f"_explainer-v{n}-raw.mp4"
    cmd = [*system.remotion(reel), "render", "Explainer", str(raw), f"--props={json.dumps({'data': f'pieces/{P.name}/explainer.json'})}", "--log=error"]
    if draft:
        cmd.append("--scale=0.5")
    cmd += system.remotion_browser()
    r = subprocess.run(cmd, cwd=reel, capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"Remotion: {r.stderr[-1200:]}")
    # sound: a hit on frame 0 and a whoosh on each scene change, with its peak on the cut
    lib = brand_dir / "sounds" / "openverse"
    effects = [(lib / "punch-impact" / "punch-impact-sound-wav.mp3", 0.03, -18)]
    effects += [(lib / "whoosh" / "swipe-whoosh.mp3", e["start"], -21) for e in spec["scenes"][1:]]
    ins, fc, et = ["-i", raw], [], []
    for k, (path, t, lvl) in enumerate(effects):
        if not path.exists():
            continue
        ins += ["-i", path]
        ini = t - peak_of(path)
        pre = f"atrim=start={-ini:.4f},asetpts=PTS-STARTPTS," if ini < 0 else (f"adelay={int(ini * 1000)}:all=1," if ini > 0 else "")
        vol = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True).stderr
        pk = float([l for l in vol.splitlines() if "max_volume" in l][0].split(":")[1].split()[0])
        fc.append(f"[{len(et) + 1}:a]aresample=48000,aformat=channel_layouts=stereo,{pre}volume={lvl - pk:.2f}dB[e{len(et)}]")
        et.append(f"[e{len(et)}]")
    total = data["duration"]
    music = sys.argv[sys.argv.index("--music") + 1] if "--music" in sys.argv else None
    voice_and_fx = "[0:a]aresample=48000,aformat=channel_layouts=stereo[v0]"
    fc.insert(0, voice_and_fx)
    mix_in = "[v0]" + "".join(et)
    if music:
        at_track, at_video = (float(x) for x in sys.argv[sys.argv.index("--align") + 1].split(",")) if "--align" in sys.argv else (0.0, 0.0)
        ini = at_track - at_video
        ins += ["-i", REPO / music]
        m = len(et) + 1
        pre = f"atrim=start={ini:.4f}," if ini >= 0 else f"adelay={int(-ini * 1000)}:all=1,"
        fc.append(f"[{m}:a]{pre}asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,volume=-24dB,afade=t=out:st={total - 1.2:.3f}:d=1.2[mu]")
        fc.append("[v0]asplit=2[vA][vB]")
        fc.append("[mu][vB]sidechaincompress=threshold=0.12:ratio=2:attack=30:release=700:makeup=1[md]")
        mix_in = "[vA]" + "".join(et) + "[md]"
    fc.append(f"{mix_in}amix=inputs={mix_in.count('[')}:normalize=0:duration=first[mx]")
    mix = output / f"_explainer-v{n}-mix.wav"
    ff(*ins, "-filter_complex", ";".join(fc), "-map", "[mx]", "-c:a", "pcm_s24le", mix)
    final = output / f"explainer-v{n}.mp4"
    ff("-i", raw, "-i", mix, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
       "-af", f"volume={-14.0 - lufs(mix):.2f}dB,alimiter=limit=0.84:level=false", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", final)
    raw.unlink(missing_ok=True)
    mix.unlink(missing_ok=True)
    print(f"{final.relative_to(REPO) if final.is_relative_to(REPO) else final} · {total:.1f} s · {len(spec['scenes'])} scenes · {lufs(final):.1f} LUFS")
    py = system.venv_python()
    if py:
        subprocess.run([str(py), str(REPO / "production" / "tools" / "faces.py"), "cover", str(final), "--n", "3", "--until", "6"])
    return final


if __name__ == "__main__":
    if len(sys.argv) < 3 or sys.argv[1] != "render":
        sys.exit(__doc__)
    render("--draft" in sys.argv)
