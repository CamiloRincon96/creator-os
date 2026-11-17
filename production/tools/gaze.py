"""Where can the person be shown? Checks every piece of the cut (every jump cut) by the picture, not only by the voice.
Usage: python3 production/tools/gaze.py <piece> [--cut N] [--every 0.2]

The voice cut decides where to cut so it is understood. Whether the person can appear in that stretch is decided by
the picture: looking at the lens, face visible and not blurry. For every piece of the cut, in frames every 0.2 s:
  looks       face from the front with both eyes visible
  away        face without the eyes visible: looking down or to a side, reading, eyes closed
  no face     there is no face (it left the frame, turned away)
  blurry      face moving or out of focus
  far         wide shot with a small face: the detector can't reach the eyes and it is decided by looking at the sheet
Leaves voice/gaze-vN.json (each piece: fit, check or unfit, and why) and voice/gaze-vN.jpg (the eyes up close, piece by
piece). The measurement is a help: what decides is looking at the sheet, and the AI always looks at it before
choosing where the person appears. visual_script.py warns if a person scene lands on a piece that is not fit.
It was born from "don't cut only by the voice, but also by the person"."""
import system

system.prepare(venv=True, args=1)

import glob, os, re, sys

import cv2
import numpy as np
from common import load, piece, save

P = piece(sys.argv[1])
op = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
vs = sorted(int(m.group(1)) for m in (re.search(r"cut-v(\d+)\.json$", p) for p in glob.glob(f"{P}/voice/cut-v*.json")) if m)
if not vs:
    sys.exit("There is no cut yet: run cut.py")
N = int(op("--cut", vs[-1]))
EVERY = float(op("--every", 0.2))
cut = load(f"{P}/voice/cut-v{N}.json")
FPS = cut.get("fps", 30)
source = next((f for f in (f"{P}/voice/cut-v{N}-master.mov", f"{P}/voice/cut-v{N}.mp4") if os.path.exists(f)), None)
if not source:
    sys.exit(f"The video of cut v{N} is missing (voice/cut-v{N}.mp4)")

# the pieces of the cut, in seconds of the finished piece (as in visual_script.py)
words = [w for f in cut["phrases"] for w in f["words"]]
pieces = []
for s in cut["segments"]:
    t = s["start"]
    for (q0, q1), v in zip(s.get("pieces") or [[s["in"], s["out"]]], s.get("speeds") or [1.0] * 9999):
        d = int(round((q1 - q0) / v))
        a, b = t / FPS, (t + d) / FPS
        pieces.append({"n": len(pieces) + 1, "start": round(a, 3), "end": round(b, 3), "take": s["take"],
                       "says": " ".join(w["t"] for w in words if a - 0.02 <= w["start"] < b - 0.02)})
        t += d

face_cv = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
eye_cv = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye_tree_eyeglasses.xml")
cap = cv2.VideoCapture(source)
fps_v = cap.get(cv2.CAP_PROP_FPS) or FPS


def look(t):
    cap.set(cv2.CAP_PROP_POS_FRAMES, round(t * fps_v))
    ok, img = cap.read()
    if not ok:
        return "no face", None
    scale = 720 / img.shape[1]
    small = cv2.resize(img, None, fx=scale, fy=scale)
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    faces = face_cv.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=6, minSize=(60, 60))
    if not len(faces):
        return "no face", None
    x, y, w, h = max(faces, key=lambda c: c[2] * c[3])
    top = gray[y + int(h * 0.15):y + int(h * 0.58), x:x + w]
    eyes = eye_cv.detectMultiScale(top, scaleFactor=1.1, minNeighbors=5, minSize=(max(8, w // 10), max(8, w // 10)))
    sharp = cv2.Laplacian(gray[y:y + h, x:x + w], cv2.CV_64F).var()
    X, Y, W, H = (int(v / scale) for v in (x, y, w, h))
    crop = img[max(0, Y + int(H * 0.12)):Y + int(H * 0.62), max(0, X):X + W]
    if sharp < 18:
        return "blurry", crop
    if w < 110:  # small face (wide shot): the detector can't reach the eyes, decide by eye
        return "far", crop
    return ("looks" if len(eyes) >= 2 else "away"), crop


COLOR = {"looks": (90, 200, 90), "away": (60, 60, 230), "no face": (120, 120, 120), "blurry": (40, 170, 230), "far": (200, 200, 200)}
rows, summary = [], []
for p in pieces:
    states, samples = [], []
    for t in np.arange(p["start"] + 0.03, p["end"] - 0.02, EVERY):
        e, crop = look(float(t))
        states.append(e)
        samples.append((float(t), e, crop))
    total = max(1, len(states))
    judged = [e for e in states if e != "far"]
    looks = judged.count("looks") / max(1, len(judged))
    run = best = 0
    for e in states:
        run = run + 1 if e not in ("looks", "far") else 0
        best = max(best, run)
    best *= EVERY
    length = p["end"] - p["start"]
    reasons = []
    if length < 0.6:
        reasons.append(f"lasts {length:.2f} s: on camera it would be a micro cut")
    if looks < 0.6:
        reasons.append(f"looks at the lens only {looks * 100:.0f} % of the time")
    if best >= 0.6:
        reasons.append(f"spends {best:.1f} s not looking at the lens")
    if states.count("no face") / total > 0.3:
        reasons.append("the face leaves the frame")
    if states.count("blurry") / total > 0.3:
        reasons.append("the face is moving or out of focus")
    far = states.count("far") / total > 0.4
    if far:
        reasons.append("wide shot: the face is small and the gaze is decided by eye")
    fit = "fit" if not reasons else ("check" if (looks >= 0.45 or far) and length >= 0.6 else "unfit")
    p.update({"looks": round(looks, 2), "away_s": round(best, 1), "fit": fit, "reasons": reasons})
    summary.append(p)
    idx = np.linspace(0, len(samples) - 1, min(8, len(samples))).round().astype(int) if samples else []
    cells = []
    for i in idx:
        t, e, crop = samples[i]
        cell = np.full((110, 230, 3), 25, np.uint8)
        if crop is not None and crop.size:
            cell[:] = cv2.resize(crop, (230, 110))
        cv2.rectangle(cell, (0, 0), (229, 109), COLOR[e], 4)
        cv2.putText(cell, f"{t:.1f}", (6, 102), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2, cv2.LINE_AA)
        cells.append(cell)
    while len(cells) < 8:
        cells.append(np.full((110, 230, 3), 12, np.uint8))
    bar = np.full((34, 230 * 8, 3), 18, np.uint8)
    text_color = {"fit": (110, 220, 110), "check": (60, 200, 240), "unfit": (90, 90, 240)}[fit]
    label = f"P{p['n']:02d}  {p['start']:.2f}-{p['end']:.2f} s  {fit.upper()}  {p['says'][:70]}"
    cv2.putText(bar, label.encode("ascii", "replace").decode(), (8, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.6, text_color, 2, cv2.LINE_AA)
    rows.append(np.vstack([bar, np.hstack(cells)]))

sheet = f"{P}/voice/gaze-v{N}.jpg"
cv2.imwrite(sheet, np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 82])
save({"cut": N, "source": os.path.basename(source), "every": EVERY, "pieces": summary}, f"{P}/voice/gaze-v{N}.json")
count = {k: sum(1 for p in summary if p["fit"] == k) for k in ("fit", "check", "unfit")}
print(f"Gaze of cut v{N} ({len(summary)} pieces): {count['fit']} fit, {count['check']} to check, {count['unfit']} unfit")
for p in summary:
    if p["fit"] != "fit":
        print(f"  P{p['n']:02d} {p['start']:6.2f}-{p['end']:6.2f} s  {p['fit']:6}  {'; '.join(p['reasons'])}  \"{p['says'][:50]}\"")
print(f"Sheet (look at it before choosing where the person appears; green = looks at the lens, red = doesn't): {sheet}")
