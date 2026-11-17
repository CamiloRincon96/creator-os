"""Opens in Finder (macOS) or File Explorer (Windows) the folder of a file in the repo, with the file selected; on Linux, its folder.

    python3 production/tools/show.py <path> [<path> ...]

So the person sees on their computer what was created (production/GUIDING.md, point 5: every file with its location).
The path can be relative to the repo or full."""
import system
system.prepare(args=1)
import os, sys
from pathlib import Path

for arg in sys.argv[1:]:
    path = Path(arg) if os.path.isabs(arg) else system.REPO / arg
    if not path.exists():
        sys.exit(f"It doesn't exist: {path}")
    system.show_in_folder(path)
    print(f"Opened in {'Finder' if system.MAC else 'File Explorer' if system.WINDOWS else 'the file manager'}: {path}")
