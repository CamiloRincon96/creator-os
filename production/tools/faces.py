"""Two automatic checks on a finished video, with local face detection (OpenCV, no internet):

    python3 production/tools/faces.py check <video> [--every 0.2]
    python3 production/tools/faces.py cover <video> [--n 3] [--until 10]

check: looks for frames where a text, a card or a graphic covers the face. In each detected face (from the eyes to
  the chin, where the mouth is) it measures what share is graphic pixels: card or paper white, or the brand's
  colors (dark green, mint, coral). More than 8 % is a warning. It leaves a sheet with the faces marked, to look at.
  It came from the notebook that covered the mouth in "Sin anotar" (Nov 15, 2026), which was spotted by eye.
cover: picks the best frames for the reel's cover: sharp (not in a transition), with the face large and
  uncovered, well exposed. It leaves the candidates as images and gives their second (for `cover_s`).
"""
import system

system.prepare(venv=True)

import sys
from pathlib import Path

import cv2
import numpy as np

CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
# graphic colors (BGR): dark green, panel green, mint, coral, ink
BRAND = np.array([[15, 23, 4], [31, 42, 7], [201, 242, 182], [106, 124, 244], [43, 58, 10]], dtype=np.int16)


def frames(video, every, until=None):
    cap = cv2.VideoCapture(str(video))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    step = max(1, round(every * fps))
    for n in range(0, total, step):
        t = n / fps
        if until and t > until:
            break
        cap.set(cv2.CAP_PROP_POS_FRAMES, n)
        ok, img = cap.read()
        if ok:
            yield t, img
    cap.release()


def faces_in(img):
    small = cv2.resize(img, (img.shape[1] // 2, img.shape[0] // 2))
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    faces = CASCADE.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=6, minSize=(70, 70))
    return [(x * 2, y * 2, w * 2, h * 2) for x, y, w, h in faces]


def covered(img, face):
    """Share of the face (from the eyes to the chin, without the edges or the background) that is graphic pixels."""
    x, y, w, h = face
    zone = img[y + int(h * 0.2):y + h, x + int(w * 0.15):x + int(w * 0.85)]
    hsv = cv2.cvtColor(zone, cv2.COLOR_BGR2HSV)
    white = (hsv[..., 2] > 232) & (hsv[..., 1] < 28)
    z = zone.astype(np.int16).reshape(-1, 1, 3)
    of_brand = (np.abs(z - BRAND[None]).sum(axis=2) < 45).any(axis=1).reshape(zone.shape[:2])
    return float((white | of_brand).mean())


def sharpness(img):
    return cv2.Laplacian(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var()


def check(video, every=0.2):
    warnings, seen = [], 0
    for t, img in frames(video, every):
        for face in faces_in(img):
            seen += 1
            f = covered(img, face)
            if f > 0.08:
                warnings.append((t, f, img.copy(), face))
    print(f"{video}: {seen} faces checked")
    if not warnings:
        print("OK: nothing covers the face")
        return 0
    # group consecutive warnings (the same cover lasts several frames)
    groups, previous = [], None
    for a in warnings:
        if previous is not None and a[0] - previous <= 0.45:
            groups[-1].append(a)
        else:
            groups.append([a])
        previous = a[0]
    thumbs = []
    for g in groups:
        t, f, img, (x, y, w, h) = max(g, key=lambda a: a[1])
        print(f"WARNING {g[0][0]:.1f}–{g[-1][0]:.1f} s: something covers the face (up to {f * 100:.0f} %)")
        marked = img.copy()
        cv2.rectangle(marked, (x + int(w * 0.15), y + int(h * 0.2)), (x + int(w * 0.85), y + h), (0, 0, 255), 8)
        thumbs.append(cv2.resize(marked, (270, 480)))
    sheet = Path(video).with_suffix("").as_posix() + "-faces.jpg"
    cv2.imwrite(sheet, np.hstack(thumbs[:8]))
    print(f"sheet: {sheet}")
    return len(groups)


def cover(video, n=3, until=None):
    cand = []
    for t, img in frames(video, 0.2, until):
        faces = faces_in(img)
        sharp = sharpness(img)
        light = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).mean()
        p = min(sharp / 300, 1.5) + (0.8 if 60 < light < 200 else 0)
        if faces:
            x, y, w, h = max(faces, key=lambda c: c[2])
            p += 1.0 + min(w / img.shape[1], 0.5) * 2 - covered(img, (x, y, w, h)) * 5
        cand.append((p, t, img))
    chosen = []
    for p, t, img in sorted(cand, key=lambda c: -c[0]):
        if all(abs(t - e[1]) > 1.0 for e in chosen):
            chosen.append((p, t, img))
        if len(chosen) == n:
            break
    base = Path(video).with_suffix("").as_posix()
    for i, (p, t, img) in enumerate(chosen, 1):
        path = f"{base}-cover-{i}.jpg"
        cv2.imwrite(path, img)
        print(f"{i}. {t:.1f} s (score {p:.2f}) -> {path}")
    return [t for _, t, _ in chosen]


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    command, video = sys.argv[1], sys.argv[2]
    if command == "check":
        sys.exit(1 if check(video, float(sys.argv[sys.argv.index("--every") + 1]) if "--every" in sys.argv else 0.2) else 0)
    elif command == "cover":
        cover(video, int(sys.argv[sys.argv.index("--n") + 1]) if "--n" in sys.argv else 3,
              float(sys.argv[sys.argv.index("--until") + 1]) if "--until" in sys.argv else None)
    else:
        sys.exit(__doc__)
