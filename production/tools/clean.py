"""Cleanup when a piece is finished (the creator's rule, Nov 14, 2026: "once we say we're done with the video,
delete almost all the work in progress, so the computer doesn't fill up").

    python3 production/tools/clean.py <piece>                          # only shows what it would delete and how much it frees
    python3 production/tools/clean.py <piece> --yes                    # deletes (cannot be undone)
    python3 production/tools/clean.py <piece> --yes --also-source      # also deletes the raw takes

Stays (what is useful later):
  - Everything in the piece that is text or code: brief, script, STATUS, scenes, visual script, cut, maps, sound
    sheets, critiques, credits (.md .json .py .txt .csv) and the After Effects project (.aep).
  - The final voice (the latest `voice/*-v*.wav` that is not "to-enhance").
  - The raw takes in `source/`, unless --also-source.
  - What was delivered: the FINAL in Montage and in `brands/<brand>/finals/<project>/` (it is outside the piece).
Deleted: the rest of the piece's media (intermediate renders, blocks, cutouts, sound rounds, review
screenshots) and the Remotion copy in `brands/<brand>/reel/public/pieces/<piece>/`.

Without a FINAL in Montage it deletes nothing (unless --no-final). After deleting, Montage still has to be archived:
    node montage/cli.mjs archive <project> --yes
"""
import system

system.prepare()

import json
import sys
from pathlib import Path

args = sys.argv[1:]
yes, source, no_final = "--yes" in args, "--also-source" in args, "--no-final" in args
args = [a for a in args if not a.startswith("--")]
if not args:
    sys.exit(__doc__)
P = Path(args[0]).resolve()
REPO = Path(__file__).resolve().parents[2]
if not (P / "STATUS.md").exists():
    sys.exit(f"{P} does not look like a piece (it has no STATUS.md)")
brand = P.parent.parent.name
name = P.name.split("-", 3)[-1] if P.name[:4].isdigit() else P.name
project = f"{brand}-reel-{name}"
pj = REPO / "montage/projects" / project / "project.json"
final = json.loads(pj.read_text()).get("final") if pj.exists() else None
if not final and not no_final:
    sys.exit(f"Project {project} has no FINAL version in Montage: the creator marks it first (or use --no-final if they asked for it).")

TEXT = {".md", ".json", ".jsonl", ".py", ".txt", ".csv", ".aep", ".tsv", ".srt"}
voices = sorted((p for p in P.glob("voice/*-v*.wav") if "to-enhance" not in p.name), key=lambda p: p.stat().st_mtime)
final_voice = voices[-1] if voices else None

delete, keep = [], []
for f in sorted(P.rglob("*")):
    if not f.is_file() and not f.is_symlink():
        continue
    rel = f.relative_to(P)
    if f.suffix.lower() in TEXT or f == final_voice or (rel.parts[0] == "source" and not source):
        keep.append(f)
    else:
        delete.append(f)
remotion_copy = P.parent.parent / "reel/public/pieces" / P.name
if remotion_copy.exists():
    delete += [f for f in sorted(remotion_copy.rglob("*")) if f.is_file()]


def size(fs):
    return sum(f.lstat().st_size for f in fs)


def mb(b):
    return f"{b / 1e6:.0f} MB"


print(f"Piece {P.relative_to(REPO)} · project {project} · FINAL in Montage: {final or '—'}")
groups = {}
for f in delete:
    try:
        key = str(f.relative_to(P).parent)
    except ValueError:
        key = str(f.relative_to(REPO).parent)
    groups.setdefault(key, []).append(f)
total = size(delete)
print(f"\n{'Would delete' if not yes else 'Deleting'} {len(delete)} files, {mb(total)}:")
for k, fs in sorted(groups.items(), key=lambda kv: -size(kv[1])):
    print(f"  {k}/  {len(fs)} files, {mb(size(fs))}")
print(f"\n{len(keep)} files stay, {mb(size(keep))}" + (f" (final voice: {final_voice.relative_to(P)})" if final_voice else ""))
if not source and (P / "source").exists():
    print(f"  source/ (raw takes): {mb(size(list((P / 'source').rglob('*'))))}; deleted with --also-source")
if not yes:
    print("\nNothing was deleted. To delete (cannot be undone): --yes. Then: node montage/cli.mjs archive " + project + " --yes")
    sys.exit(0)
for f in delete:
    f.unlink()
for d in sorted({f.parent for f in delete}, key=lambda d: -len(d.parts)):
    while d not in (P, remotion_copy.parent) and d.exists() and not any(d.iterdir()):
        d.rmdir()
        d = d.parent
print(f"\nDone: {len(delete)} files deleted. Montage still has to be archived: node montage/cli.mjs archive {project} --yes")
