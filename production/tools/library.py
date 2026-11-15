"""The library of own footage: everything the creator records is cataloged so it can be used in any piece.

    production/.venv/bin/python production/tools/library.py add [files…]   # no files: whatever is in library/inbox/
    python3 production/tools/library.py tag <id> --what "…" --tags "a,b" [--brand example] [--use broll|on-camera|ambience|screen]
    python3 production/tools/library.py search "<words>" [--brand example] [--vertical]
    python3 production/tools/library.py list [--untagged]

It is not stock: it is the creator's own footage (the street, the phone, the office, them talking, the app on screen). Drop
the material in library/inbox/ (or pass the paths) and `add`:
  - moves it to library/videos/<id>.<ext> (what is in inbox/) or copies it (what is elsewhere), without re-encoding;
  - measures duration, size, orientation, fps and recording date;
  - leaves an 8-frame sheet in library/sheets/<id>.jpg;
  - if there is a voice, transcribes it (what is said helps searching and using it as a cameo).
Then Claude looks at each sheet and tags it (what is seen, tags, brand, use). Videos and sheets do not go into git;
library/index.json does: that way any computer knows what exists, even if the video is on another one.
"""
import datetime as dt
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
L = REPO / "library"
INDEX = L / "index.json"
VIDEO_EXT = (".mp4", ".mov", ".m4v", ".mkv", ".webm")


def load():
    return json.loads(INDEX.read_text()) if INDEX.exists() else {"clips": {}}


def save(d):
    INDEX.parent.mkdir(parents=True, exist_ok=True)
    INDEX.write_text(json.dumps(d, indent=1, ensure_ascii=False))


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                        "format=duration:format_tags=creation_time,com.apple.quicktime.creationdate:stream=codec_type,width,height,avg_frame_rate:stream_tags=rotate",
                        "-of", "json", str(path)], capture_output=True, text=True)
    return json.loads(r.stdout or "{}")


def fingerprint(path):
    h = hashlib.sha1()
    with open(path, "rb") as f:
        h.update(f.read(4 * 1024 * 1024))
    h.update(str(path.stat().st_size).encode())
    return h.hexdigest()[:8]


def add(paths):
    d = load()
    inbox = L / "inbox"
    if not paths:
        paths = sorted(p for p in inbox.glob("*") if p.suffix.lower() in VIDEO_EXT) if inbox.exists() else []
    if not paths:
        sys.exit("No videos: drop them in library/inbox/ or pass the paths")
    (L / "videos").mkdir(parents=True, exist_ok=True)
    (L / "sheets").mkdir(parents=True, exist_ok=True)
    for src in map(Path, paths):
        info = probe(src)
        fmt = info.get("format", {})
        tags = fmt.get("tags", {})
        date = (tags.get("com.apple.quicktime.creationdate") or tags.get("creation_time") or "")[:19] or dt.datetime.fromtimestamp(src.stat().st_mtime).isoformat(timespec="seconds")
        cid = f"{date[:10].replace('-', '')}-{fingerprint(src)}"
        if cid in d["clips"]:
            print(f"{src.name}: already there as {cid}")
            continue
        target = L / "videos" / f"{cid}{src.suffix.lower()}"
        if src.resolve().parent == inbox.resolve():
            shutil.move(str(src), target)
        else:
            shutil.copy2(src, target)
        v = next((s for s in info.get("streams", []) if s.get("codec_type") == "video"), {})
        has_audio = any(s.get("codec_type") == "audio" for s in info.get("streams", []))
        w, h = v.get("width", 0), v.get("height", 0)
        if str(v.get("tags", {}).get("rotate", "0")) in ("90", "270", "-90"):
            w, h = h, w
        dur = float(fmt.get("duration") or 0)
        sheet = L / "sheets" / f"{cid}.jpg"
        step = max(dur / 8, 0.1)
        subprocess.run(["ffmpeg", "-hide_banner", "-v", "error", "-y", "-i", str(target), "-vf",
                        f"fps=1/{step:.3f},scale=200:-1,tile=8x1:padding=4:color=white", "-frames:v", "1", str(sheet)])
        c = {"original_file": src.name, "video": str(target.relative_to(REPO)), "sheet": str(sheet.relative_to(REPO)),
             "date": date, "duration": round(dur, 1), "width": w, "height": h, "vertical": h > w,
             "fps": v.get("avg_frame_rate"), "transcript": "", "what": "", "tags": [], "brand": None, "use": None, "used_in": []}
        if has_audio and dur > 1.5:
            try:
                sys.path.insert(0, str(Path(__file__).parent))
                from common import read, transcribe
                wav = L / "sheets" / f"{cid}.wav"
                subprocess.run(["ffmpeg", "-hide_banner", "-v", "error", "-y", "-i", str(target), "-vn", "-ac", "1", "-ar", "16000", str(wav)], check=True)
                x, sr = read(str(wav))
                words = [w_ for w_ in transcribe(x, sr) if w_["prob"] > 0.4]
                c["transcript"] = " ".join(w_["t"] for w_ in words)
                wav.unlink(missing_ok=True)
            except Exception as e:
                c["transcript"] = f"(not transcribed: {str(e)[:60]})"
        d["clips"][cid] = c
        save(d)
        said = f' · "{c["transcript"][:60]}"' if c["transcript"] else ""
        print(f"{cid}: {src.name} · {dur:.1f} s · {'vertical' if h > w else 'horizontal'} {w}×{h}{said}")
    print("Still to tag: Claude looks at each sheet (library/sheets/<id>.jpg) and runs `library.py tag`.")


def tag(cid, fields):
    d = load()
    if cid not in d["clips"]:
        sys.exit(f"Clip {cid} is not there")
    c = d["clips"][cid]
    if "tags" in fields:
        fields["tags"] = [e.strip() for e in fields["tags"].split(",") if e.strip()]
    c.update(fields)
    save(d)
    print(f"{cid}: {c['what']} · {', '.join(c['tags'])} · {c.get('brand') or 'all'} · {c.get('use') or '—'}")


def search(text, brand=None, vertical_only=False):
    d = load()
    words = [p.lower() for p in text.split()]
    found = []
    for cid, c in d["clips"].items():
        if brand and c.get("brand") not in (None, brand):
            continue
        if vertical_only and not c.get("vertical"):
            continue
        field = " ".join([c.get("what", ""), " ".join(c.get("tags", [])), c.get("transcript", "")]).lower()
        score = sum(field.count(p) for p in words)
        if score:
            found.append((score, cid, c))
    for score, cid, c in sorted(found, reverse=True)[:15]:
        print(f"{cid} · {c['duration']} s · {'V' if c.get('vertical') else 'H'} · {c.get('what') or '(untagged)'} · {', '.join(c.get('tags', []))} · used {len(c.get('used_in', []))} times")
    if not found:
        print("Nothing. If it's missing, record it: note it under \"What to record\" in the idea.")


def list_clips(untagged=False):
    d = load()
    for cid, c in sorted(d["clips"].items()):
        if untagged and c.get("what"):
            continue
        print(f"{cid} · {c['duration']} s · {'V' if c.get('vertical') else 'H'} · {c.get('what') or '(untagged)'} · {c['sheet']}")
    print(f"{len(d['clips'])} clips")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    command = sys.argv[1]
    if command == "add":
        add(sys.argv[2:])
    elif command == "tag":
        fields = {k: sys.argv[sys.argv.index(f"--{k}") + 1] for k in ("what", "tags", "brand", "use") if f"--{k}" in sys.argv}
        tag(sys.argv[2], fields)
    elif command == "search":
        search(sys.argv[2], sys.argv[sys.argv.index("--brand") + 1] if "--brand" in sys.argv else None, "--vertical" in sys.argv)
    elif command == "list":
        list_clips("--untagged" in sys.argv)
    else:
        sys.exit(__doc__)
