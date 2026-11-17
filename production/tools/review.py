"""Mandatory review of every result before showing it to the person. Run it after ANY edit that changes the video
(a cut, a render, a version, resolved notes), on the file that is about to be shown.
Usage: python3 production/tools/review.py <video> [--cut <piece> | --text "what is said" | --script <visual-script.json|.txt>]
                                          [--every 0.5]

The AI doesn't watch the video playing and doesn't hear. This leaves it the whole video to look at and the sound measured:
  walkthrough-NN.jpg  the whole video, one frame every 0.5 s with its second, to see it from start to end
  cuts-NN.jpg         every cut: the last frame before and the first one after
  eyes-NN.jpg         the face up close every 0.5 s: is the person looking at the camera?
  colors-NN.jpg       one face per take, side by side: is the color even? (and it warns about the take that jumps)
  faces.jpg           (when needed) where something covers the face
  REVIEW.md           what was measured: black, frozen frames, cuts, loudness, dead pauses, what is heard
                      (transcribed and compared with the text) and whether a cut lands inside a word
Everything goes to <video>-review/. The AI opens ALL the images, reads the report and writes in "## What I saw" what it
looked at, what it found and what it fixed. Montage won't publish an AI's video without that section written.
It was born from a creator who saw the edits being done "with scripts" without checking whether the video came out right."""
import system

system.prepare(venv=True, args=1)

import datetime, json, os, re, shutil, subprocess, sys
from pathlib import Path

import cv2
import numpy as np
from common import compare, read, transcribe

HERE = Path(__file__).resolve().parent
video = Path(sys.argv[1]).resolve()
if not video.exists():
    sys.exit(f"{video} does not exist")
op = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
EVERY = float(op("--every", 0.5))
out_dir = video.with_name(video.stem + "-review")
out_dir.mkdir(exist_ok=True)
for old in out_dir.glob("*.jpg"):
    old.unlink()

# ── Data ──────────────────────────────────────────────────────────────────────────────────────
probe = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height,r_frame_rate,duration:format=duration",
                                   "-of", "json", str(video)], capture_output=True, text=True).stdout)
vs = next((s for s in probe["streams"] if s["codec_type"] == "video"), None)
au = next((s for s in probe["streams"] if s["codec_type"] == "audio"), None)
if not vs:
    sys.exit("It has no picture: for audio alone use listen.py")
num, den = (int(x) for x in vs["r_frame_rate"].split("/"))
FPS = num / den
DUR = float(probe["format"]["duration"])
dur_v = float(vs.get("duration", DUR))
dur_a = float(au.get("duration", DUR)) if au else None
warnings = []


def warn(t, text):
    warnings.append((t, text))


if au and abs(dur_v - dur_a) > 0.1:
    warn(None, f"the audio lasts {dur_a:.2f} s and the picture {dur_v:.2f} s: something is out of sync or ends early")

# ── Black, frozen and cuts (ffmpeg) ───────────────────────────────────────────────────────────
r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(video), "-an", "-vf",
                    "blackdetect=d=0.06:pix_th=0.08,freezedetect=n=0.002:d=0.7,select='gt(scene,0.1)',metadata=print:file=-",
                    "-f", "null", "-"], capture_output=True, text=True)
for m in re.finditer(r"black_start:([\d.]+) black_end:([\d.]+)", r.stderr):
    warn(float(m.group(1)), f"black screen from {float(m.group(1)):.2f} to {float(m.group(2)):.2f} s")
for m in re.finditer(r"freeze_start: ([\d.]+)[\s\S]*?freeze_end: ([\d.]+)", r.stderr):
    a, b = float(m.group(1)), float(m.group(2))
    warn(a, f"still picture from {a:.2f} to {b:.2f} s ({b - a:.1f} s): on purpose, or did it freeze?")
cuts = sorted({round(float(t), 3) for t in re.findall(r"pts_time:([\d.]+)", r.stdout)})
cuts = [t for i, t in enumerate(cuts) if t > 0.05 and (i == 0 or t - cuts[i - 1] > 0.12)]

# ── Frames ────────────────────────────────────────────────────────────────────────────────────
cap = cv2.VideoCapture(str(video))
TOTAL = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))


def frame(t):
    cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, min(TOTAL - 1, round(t * FPS))))
    ok, img = cap.read()
    return img if ok else np.zeros((1920, 1080, 3), np.uint8)


def thumb(img, w, label, color=(255, 255, 255)):
    h = round(img.shape[0] * w / img.shape[1])
    im = cv2.resize(img, (w, h), interpolation=cv2.INTER_AREA)
    bar = np.full((34, w, 3), 18, np.uint8)
    cv2.putText(bar, label, (8, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.62, color, 2, cv2.LINE_AA)
    return np.vstack([bar, im])


def sheets(cells, columns, name, per_sheet):
    paths = []
    for k in range(0, len(cells), per_sheet):
        group = cells[k:k + per_sheet]
        height, width = group[0].shape[:2]
        while len(group) % columns:
            group.append(np.zeros((height, width, 3), np.uint8))
        rows = [np.hstack(group[i:i + columns]) for i in range(0, len(group), columns)]
        path = out_dir / f"{name}-{k // per_sheet + 1:02d}.jpg"
        cv2.imwrite(str(path), np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 85])
        paths.append(path)
    return paths


times = list(np.arange(0, DUR - 0.02, EVERY))
walkthrough = sheets([thumb(frame(t), 230, f"{t:.1f} s") for t in times], 8, "walkthrough", 32)
pairs = []
for i, t in enumerate(cuts, 1):
    before, after = frame(t - 1 / FPS), frame(t)
    pairs.append(np.hstack([thumb(before, 170, f"{i}: {t - 1 / FPS:.2f}"), thumb(after, 170, f"-> {t:.2f} s", (125, 227, 244))]))
cut_sheets = sheets(pairs, 4, "cuts", 24) if pairs else []

# the face up close: is the person looking at the camera?
face_cv = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
eyes = []
for t in times:
    img = frame(t)
    small = cv2.resize(img, (img.shape[1] // 2, img.shape[0] // 2))
    found = face_cv.detectMultiScale(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY), scaleFactor=1.1, minNeighbors=6, minSize=(70, 70))
    if len(found):
        x, y, w, h = (v * 2 for v in max(found, key=lambda c: c[2] * c[3]))
        zone = img[max(0, y + int(h * 0.15)):y + int(h * 0.62), max(0, x):x + w]
        if zone.size:
            eyes.append(thumb(cv2.resize(zone, (300, round(300 * zone.shape[0] / zone.shape[1]))), 300, f"{t:.1f} s"))
eye_sheets = []
if eyes:
    tallest = max(o.shape[0] for o in eyes)
    eyes = [np.vstack([o, np.zeros((tallest - o.shape[0], o.shape[1], 3), np.uint8)]) for o in eyes]
    eye_sheets = sheets(eyes, 6, "eyes", 36)

# the color from take to take: the skin (or the whole frame, with no face) of each take against the median. A take that
# jumps is noticed "as if it hadn't been corrected". Leaves colors-NN.jpg: one face per take, side by side.
takes = list(zip([0.0] + cuts, cuts + [DUR]))
take_colors, take_faces = [], []
for a, b in takes:
    if b - a < 0.2:
        continue
    skin, whole, sample = [], [], None
    for t in np.linspace(a + 0.05, b - 0.05, 6):
        img = frame(t)
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
        whole.append(lab.reshape(-1, 3).mean(0))
        small = cv2.resize(img, (img.shape[1] // 2, img.shape[0] // 2))
        found = face_cv.detectMultiScale(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY), 1.1, 6, minSize=(50, 50))
        if len(found):
            x, y, w, h = (v * 2 for v in max(found, key=lambda c: c[2] * c[3]))
            skin.append(lab[y + h // 4:y + 3 * h // 4, x + w // 4:x + 3 * w // 4].reshape(-1, 3).mean(0))
            if sample is None:
                sample = img[max(0, y - h // 4):y + h + h // 4, max(0, x - w // 4):x + w + w // 4]
    take_colors.append((a, b, np.median(skin, 0) if skin else None, np.median(whole, 0)))
    if sample is not None and sample.size:
        take_faces.append(thumb(cv2.resize(sample, (220, round(220 * sample.shape[0] / sample.shape[1]))), 220, f"{a:.1f} s"))
skins = [s for _, _, s, _ in take_colors if s is not None]
if len(skins) >= 2:
    med = np.median(skins, 0)
    for a, b, s, _ in take_colors:
        if s is None:
            continue
        dl, da_, db_ = s[0] - med[0], s[1] - med[1], s[2] - med[2]
        if abs(dl) > 12 or abs(da_) > 2.5 or abs(db_) > 2.5:
            warn(a, f"the take from {a:.2f} to {b:.2f} s has a different skin color (brightness {dl:+.0f}, red {da_:+.1f}, yellow {db_:+.1f}): "
                    "match it with match_color.py")
color_sheets = []
if take_faces:
    tallest = max(c.shape[0] for c in take_faces)
    take_faces = [np.vstack([c, np.zeros((tallest - c.shape[0], c.shape[1], 3), np.uint8)]) for c in take_faces]
    color_sheets = sheets(take_faces, 8, "colors", 32)

# something covering the face (faces.py)
r = subprocess.run([sys.executable, str(HERE / "faces.py"), "check", str(video), "--every", "0.25"], capture_output=True, text=True)
for m in re.finditer(r"WARNING ([\d.]+)–([\d.]+) s: (.+)", r.stdout):
    warn(float(m.group(1)), f"{m.group(3)} ({m.group(1)} to {m.group(2)} s)")
faces_sheet = video.with_suffix("").as_posix() + "-faces.jpg"
if os.path.exists(faces_sheet):
    shutil.move(faces_sheet, out_dir / "faces.jpg")

# ── Sound ─────────────────────────────────────────────────────────────────────────────────────
NUMBERS = {"one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10",
           "twelve": "12", "fifteen": "15", "twenty": "20", "thirty": "30", "fifty": "50", "hundred": "100", "thousand": "1000",
           "uno": "1", "dos": "2", "tres": "3", "cuatro": "4", "cinco": "5", "seis": "6", "siete": "7", "ocho": "8", "nueve": "9", "diez": "10",
           "doce": "12", "quince": "15", "veinte": "20", "treinta": "30", "cincuenta": "50", "cien": "100", "mil": "1000"}
as_number = lambda w: NUMBERS.get(re.sub(r"[^\w]", "", w.lower()), re.sub(r"[^\d]", "", w) if re.fullmatch(r"[+]?\d+[.,]?", w) else w)
heard, lufs, peak, pauses, compared = [], None, None, [], None
if au:
    wav = out_dir / "audio.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(video), "-vn", "-ac", "1", "-ar", "48000", str(wav)], check=True)
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(wav), "-af", "ebur128=peak=true,silencedetect=noise=-38dB:d=0.35",
                        "-f", "null", "-"], capture_output=True, text=True)
    m = re.search(r"Integrated loudness:\s+I:\s+(-?[\d.]+)", r.stderr)
    lufs = float(m.group(1)) if m else None
    m = re.search(r"True peak:\s+Peak:\s+(-?[\d.]+|-inf)", r.stderr)
    peak = float(m.group(1)) if m and m.group(1) != "-inf" else None
    for m in re.finditer(r"silence_start: (-?[\d.]+)[\s\S]*?silence_end: ([\d.]+)", r.stderr):
        a, b = max(0.0, float(m.group(1))), float(m.group(2))
        if a > 0.15 and b < DUR - 0.15:
            pauses.append((a, b))
    if lufs is not None and not (-18 <= lufs <= -11):
        warn(None, f"overall loudness {lufs:.1f} LUFS: reels aim for -16 to -13")
    if peak is not None and peak > -1.0:
        warn(None, f"peak of {peak:.1f} dBTP: it may clip when uploaded (max -1)")
    for a, b in pauses:
        warn(a, f"pause without voice from {a:.2f} to {b:.2f} s ({b - a:.2f} s): dead, or on purpose?")
    x, sr = read(str(wav))
    heard = transcribe(x, sr)
    for w in heard:
        if w["prob"] < 0.45:
            warn(w["start"], f"\"{w['t']}\" is hard to understand (confidence {w['prob']:.2f}): cut off or mispronounced?")
        for t in cuts:
            if w["start"] + 0.04 < t < w["end"] - 0.04:
                warn(t, f"the cut at {t:.2f} s lands inside \"{w['t']}\" ({w['start']:.2f}-{w['end']:.2f} s)")
    expected = op("--text")
    if op("--cut"):  # the text of the piece's latest cut
        cut_files = sorted(Path(op("--cut"), "voice").glob("cut-v*.json"), key=lambda f: int(re.search(r"v(\d+)\.json$", f.name).group(1)))
        if cut_files:
            expected = " ".join(w["t"] for f in json.loads(cut_files[-1].read_text())["phrases"] for w in f["words"])
    if op("--script"):
        s = Path(op("--script"))
        expected = " ".join(p["t"] for p in json.loads(s.read_text())["words"]) if s.suffix == ".json" else s.read_text()
    if expected:
        similarity, changes = compare([as_number(w) for w in expected.split()], [as_number(w["t"]) for w in heard])
        compared = (similarity, changes)
        if similarity < 0.97:
            warn(None, f"what is heard matches the expected text {similarity * 100:.0f} %")
    wav.unlink()

# ── Report ────────────────────────────────────────────────────────────────────────────────────
images = walkthrough + cut_sheets + eye_sheets + color_sheets + ([out_dir / "faces.jpg"] if (out_dir / "faces.jpg").exists() else [])
L = [f"# Review of {video.name}", "",
     f"Made by `review.py` on {datetime.datetime.now():%Y-%m-%d %H:%M}. What is measured below is the floor: the real review "
     "is looking at every image and writing \"What I saw\".", "",
     "## Data", "",
     f"- Length: {DUR:.2f} s · {vs['width']}x{vs['height']} · {FPS:.0f} frames per second" + (f" · audio {dur_a:.2f} s" if au else " · no audio"),
     f"- Cuts or scene changes: {len(cuts)}" + (f" ({', '.join(f'{t:.2f}' for t in cuts)})" if cuts else ""),
     ]
if au:
    L.append(f"- Loudness: {lufs if lufs is not None else '?'} LUFS · peak {peak if peak is not None else '?'} dBTP · pauses without voice over 0.35 s: {len(pauses)}")
L += ["", "## Measured warnings", ""]
if warnings:
    for i, (t, text) in enumerate(sorted(warnings, key=lambda a: (a[0] is not None, a[0] or 0)), 1):
        L.append(f"{i}. {'' if t is None else f'**{t:.2f} s** · '}{text}")
else:
    L.append("None. That doesn't mean it's right: it still has to be looked at.")
if au:
    L += ["", "## What is heard", ""]
    line, since = [], None
    for w in heard:
        since = w["start"] if since is None else since
        line.append(w["t"])
        if len(line) >= 9 or w["t"][-1:] in ".?!":
            L.append(f"- `{since:5.2f}` {' '.join(line)}")
            line, since = [], None
    if line:
        L.append(f"- `{since:5.2f}` {' '.join(line)}")
    if compared:
        L.append(f"\nAgainst the expected text: {compared[0] * 100:.0f} % the same." + (" Changes: " + "; ".join(compared[1][:12]) if compared[1] else ""))
L += ["", "## What to look at, all of it and in order", ""] + [f"- {p}" for p in images]
L += ["", "## Checklist by eye", "",
      "- [ ] Coherence: each scene makes sense with what is said at that moment, and the video is understood start to end.",
      "- [ ] No cut swallows a word or leaves a dead pause; nothing repeats by mistake.",
      "- [ ] Texts can be read, arrive with their word and don't leave the frame or the safe zone.",
      "- [ ] When the person appears, they look at the camera (eyes) and nothing covers their face.",
      "- [ ] Scene changes don't jump oddly (cuts): not one frame of another take, no flicker.",
      "- [ ] The color is even from take to take (colors): the skin with the same brightness and the same warmth.",
      "- [ ] The start hooks from frame 0 and the end closes cleanly.",
      "- [ ] What the person asked for in their notes is done, and nothing that was already right got broken.",
      "", "## Visual floor", "",
      "<!-- production/REELS-QUALITY.md. Tick each line [x] after looking at it, or write \"n/a\" and why (e.g. a voice",
      "     cut with no animation). Montage won't publish an AI's video while a line here is unresolved. -->",
      "- [ ] Real and specific: nothing invented (fake screens, sparkles, clocks); the generic only on purpose.",
      "- [ ] The thing itself: nothing abstract (boxes with a play button, bars, waves, little squares that \"stand for\" something).",
      "- [ ] Visual before text: real logos and icons; one word per scene, big, in a type that hooks.",
      "- [ ] Understood without knowing the tool: each action is shown the way anyone would do it.",
      "- [ ] Constant stimulus: something happens every 0.5 to 1 s; zoom punches on the key words; nothing sits still.",
      "- [ ] A full screen: each thing the size of what it shows, inside the safe zone, nothing leaves the frame.",
      "- [ ] The person rules but isn't everything: they look at the lens, nothing covers their face, and the supporting material goes without their face.",
      "- [ ] One world: nothing that looks like home, even color and the brand's identity from start to end.",
      "", "## What I saw", "",
      "<!-- The AI writes here, after looking at ALL the images: what it reviewed, what it found and what it fixed (or why",
      "     something stays as it is). Montage won't publish an AI's video while this section is empty. -->", ""]
(out_dir / "REVIEW.md").write_text("\n".join(L))

print(f"Review: {out_dir / 'REVIEW.md'}")
print(f"Measured warnings: {len(warnings)}")
for t, text in sorted(warnings, key=lambda a: (a[0] is not None, a[0] or 0))[:20]:
    print(f"  {'' if t is None else f'{t:6.2f} s  '}{text}")
print("Look at all these images before saying it's ready:")
for p in images:
    print(f"  {p}")
print("Then write \"## What I saw\" in the report; without it Montage won't publish.")
