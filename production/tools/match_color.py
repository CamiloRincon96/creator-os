"""Matches the color of every take in a video: the same skin, the same warmth and the same brightness from take to take.
Usage: python3 production/tools/match_color.py <input> <output> [--cuts 4.37,5.10,…] [--strength 0.85]
                                               [--reference <another video> [--reference-cuts …]]
With --reference, the target is the median skin of that other video (e.g. a new take that has to match the ones that
were already matched).

Splits the video into its takes (at the cuts it's given, or the ones it finds by itself), measures the skin tone (the
face) and the brightness in each one, and applies a gentle correction to each take (one LUT per take) so they all end
up like the median: the same skin brightness and the same balance (a/b in Lab). With no face, it matches the whole frame.
Takes that come from different sources or passes (After Effects, FLUX, another recording day) stop jumping.
It was born on Nov 17, 2026: the last takes of a piece came out darker and colder, "as if you had cut them", and the
creator saw it before the review did."""
import system

system.prepare(venv=True, args=2)

import os, re, subprocess, sys, tempfile

import cv2
import numpy as np

source, output = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
op = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
STRENGTH = float(op("--strength", 0.85))
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", source],
                           capture_output=True, text=True).stdout)
if op("--cuts"):
    cuts = [float(x) for x in op("--cuts").split(",") if x.strip()]
else:
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", source, "-an", "-vf", "select='gt(scene,0.1)',metadata=print:file=-",
                        "-f", "null", "-"], capture_output=True, text=True)
    cuts = sorted({round(float(t), 3) for t in re.findall(r"pts_time:([\d.]+)", r.stdout)})
    cuts = [t for i, t in enumerate(cuts) if t > 0.05 and (i == 0 or t - cuts[i - 1] > 0.12)]
takes = list(zip([0.0] + cuts, cuts + [dur]))

cap = cv2.VideoCapture(source)
fps = cap.get(cv2.CAP_PROP_FPS) or 30
face_cv = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")


def measure(a, b):
    """Mean Lab of the skin (center of the face) and of the frame, over 8 frames of the take."""
    skin, whole = [], []
    for t in np.linspace(a + 0.05, b - 0.05, 8):
        cap.set(cv2.CAP_PROP_POS_FRAMES, round(t * fps))
        ok, img = cap.read()
        if not ok:
            continue
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
        whole.append(lab.reshape(-1, 3).mean(0))
        small = cv2.resize(img, (img.shape[1] // 2, img.shape[0] // 2))
        faces = face_cv.detectMultiScale(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY), 1.1, 6, minSize=(50, 50))
        if len(faces):
            x, y, w, h = (v * 2 for v in max(faces, key=lambda c: c[2] * c[3]))
            skin.append(lab[y + h // 4:y + 3 * h // 4, x + w // 4:x + 3 * w // 4].reshape(-1, 3).mean(0))
    return (np.median(skin, 0) if skin else None), np.median(whole, 0)


measures = [measure(a, b) for a, b in takes]
skins = [s for s, _ in measures if s is not None]
target_skin = np.median(skins, 0) if skins else None
target_frame = np.median([w for _, w in measures], 0)
if op("--reference"):  # the target comes from another video that was already matched
    ref_cap, ref_cuts = cv2.VideoCapture(op("--reference")), [float(x) for x in (op("--reference-cuts") or "").split(",") if x.strip()]
    ref_dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", op("--reference")],
                                   capture_output=True, text=True).stdout)
    cap, kept = ref_cap, cap
    ref = [measure(a, b) for a, b in zip([0.0] + ref_cuts, ref_cuts + [ref_dur])]
    cap = kept
    ref_skins = [s for s, _ in ref if s is not None]
    if ref_skins:
        target_skin = np.median(ref_skins, 0)
    target_frame = np.median([w for _, w in ref], 0)


def lut(gain, da, db, path, n=33):
    """3D LUT: in Lab, the brightness is multiplied (with blacks and whites held still) and a/b are shifted."""
    g = np.linspace(0, 1, n, dtype=np.float32)
    b_, g_, r_ = np.meshgrid(g, g, g, indexing="ij")  # .cube order: R changes fastest
    rgb = np.stack([r_, g_, b_], -1).reshape(-1, 1, 3)
    lab = cv2.cvtColor((rgb * 255).astype(np.float32)[..., ::-1] / 255.0, cv2.COLOR_BGR2LAB)  # L 0-100, a/b ±127
    L = lab[..., 0]
    weight = np.clip(L / 25, 0, 1) * np.clip((100 - L) / 25, 0, 1)  # the extremes don't move
    lab[..., 0] = L * (1 + (gain - 1) * weight)
    lab[..., 1] += da * weight
    lab[..., 2] += db * weight
    out = np.clip(cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)[..., ::-1], 0, 1).reshape(-1, 3)
    with open(path, "w") as f:
        f.write(f"LUT_3D_SIZE {n}\n")
        for r, gg, bb in out:
            f.write(f"{r:.5f} {gg:.5f} {bb:.5f}\n")


tmp = tempfile.mkdtemp()
filters, report = [], []
for i, ((a, b), (skin, whole)) in enumerate(zip(takes, measures)):
    if skin is not None and target_skin is not None:
        ref, target = skin, target_skin
    else:
        ref, target = whole, target_frame
    # OpenCV's 8-bit Lab: L 0-255 → 0-100, a/b centered on 128
    gain = float(np.clip(1 + STRENGTH * (target[0] / max(ref[0], 1) - 1), 0.8, 1.2))
    da = float(np.clip(STRENGTH * (target[1] - ref[1]), -8, 8))
    db = float(np.clip(STRENGTH * (target[2] - ref[2]), -8, 8))
    path = os.path.join(tmp, f"t{i}.cube")
    lut(gain, da, db, path)
    # only the file name inside the filter (ffmpeg runs in tmp): on Windows the "C:" of a full path splits the filter
    filters.append(f"[0:v]trim=start={a:.4f}:end={b:.4f},setpts=PTS-STARTPTS,lut3d=file={os.path.basename(path)}[v{i}]")
    report.append(f"take {i + 1} ({a:.2f}-{b:.2f} s): brightness ×{gain:.2f}, a {da:+.1f}, b {db:+.1f}" + ("" if skin is not None else " (no face: whole frame)"))
fc = ";".join(filters) + ";" + "".join(f"[v{i}]" for i in range(len(takes))) + f"concat=n={len(takes)}:v=1:a=0[v]"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", source, "-filter_complex", fc, "-map", "[v]", "-map", "0:a?", "-c:v", "libx264",
                "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "copy", output], check=True, cwd=tmp)
print(f"Matched {len(takes)} takes to the median skin:")
print("\n".join("  " + x for x in report))
print(f"Done: {output}  (check it with review.py: it compares the color from take to take)")
