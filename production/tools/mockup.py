"""Stage 5: renders a piece's mockup (pace, no design) with Remotion.
Usage: python3 production/tools/mockup.py <piece> [--remotion brands/example/reel]

Copies the visual script, the chosen voice and the cut's video to <remotion>/public/pieces/<name>/, and
renders the `Mockup` composition to <piece>/output/mockup-vN.mp4 (at half resolution: it is for seeing the
pace, not the picture). The default Remotion project is the piece's brand's (brands/<brand>/reel)."""
import system

system.prepare(args=1)

import glob, json, os, re, shutil, subprocess, sys

if len(sys.argv) < 2:
    sys.exit(__doc__)
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
P = sys.argv[1] if os.path.isabs(sys.argv[1]) else os.path.join(root, sys.argv[1])
P = os.path.abspath(P)
brand_dir = os.path.dirname(os.path.dirname(P))  # brands/<brand>
brand = os.path.basename(brand_dir)
remo = os.path.join(root, sys.argv[sys.argv.index("--remotion") + 1]) if "--remotion" in sys.argv else os.path.join(brand_dir, "reel")
name = os.path.basename(P)
vs = json.load(open(os.path.join(P, "visual-script.json")))

target = os.path.join(remo, "public", "pieces", name)
os.makedirs(target, exist_ok=True)
for rel in (vs["voice"], vs["cut_video"]):
    shutil.copy2(os.path.join(P, rel), os.path.join(target, os.path.basename(rel)))
props = dict(vs, folder=f"pieces/{name}")
props_path = os.path.join(P, "work", "mockup-props.json")
json.dump(props, open(props_path, "w"), ensure_ascii=False)

os.makedirs(os.path.join(P, "output"), exist_ok=True)
n = 1 + max([int(m.group(1)) for m in (re.search(r"mockup-v(\d+)\.mp4$", p) for p in glob.glob(f"{P}/output/mockup-v*.mp4")) if m] or [0])
output = os.path.join(P, "output", f"mockup-v{n}.mp4")
r = subprocess.run([*system.remotion(remo), "render", "Mockup", output, f"--props={props_path}", "--scale=0.5", "--codec=h264", "--crf=23",
                    *system.remotion_browser(), "--log=error"],
                   cwd=remo, capture_output=True, text=True)
if r.returncode:
    sys.exit(r.stdout[-2000:] + r.stderr[-2000:])
print(output)
