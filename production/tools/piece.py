"""Creates and lists the repo's pieces (reels).
Usage:
  python3 production/tools/piece.py new <brand> <short-name> [--type on-camera|animated|mixed] [--style scenes-and-cameos]
  python3 production/tools/piece.py list

A piece lives in brands/<brand>/pieces/<date>-<short-name>/ and starts with brief.md, script.md and STATUS.md
copied from production/templates/."""
import system

system.prepare()

import datetime, glob, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEMPLATES = os.path.join(ROOT, "production", "templates")


def option(name, default):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


if len(sys.argv) >= 4 and sys.argv[1] == "new":
    brand, short = sys.argv[2], re.sub(r"[^a-z0-9-]", "", sys.argv[3].lower().replace(" ", "-"))
    if not os.path.isdir(os.path.join(ROOT, "brands", brand)):
        sys.exit(f"The brand \"{brand}\" does not exist in the repo")
    kind, style = option("--type", "on-camera"), option("--style", "scenes-and-cameos")
    if not os.path.isdir(os.path.join(ROOT, "production", "styles", style)):
        sys.exit(f"The style \"{style}\" does not exist in production/styles/")
    today = datetime.date.today().isoformat()
    folder = os.path.join(ROOT, "brands", brand, "pieces", f"{today}-{short}")
    if os.path.exists(folder):
        sys.exit(f"Already exists: {folder}")
    for d in ("source", "work", "voice", "image", "output"):
        os.makedirs(os.path.join(folder, d))
    for name in ("brief.md", "script.md", "STATUS.md"):
        text = open(os.path.join(TEMPLATES, name)).read()
        for a, b in (("{{brand}}", brand), ("{{name}}", short), ("{{date}}", today), ("{{type}}", kind), ("{{style}}", style)):
            text = text.replace(a, b)
        open(os.path.join(folder, name), "w").write(text)
    print(os.path.relpath(folder, ROOT))
elif len(sys.argv) >= 2 and sys.argv[1] == "list":
    for status in sorted(glob.glob(os.path.join(ROOT, "brands", "*", "pieces", "*", "STATUS.md"))):
        m = re.search(r"\*\*Current stage:\*\*\s*(.+)", open(status).read())
        print(f"{os.path.relpath(os.path.dirname(status), ROOT)} · {m.group(1).strip() if m else 'no status'}")
else:
    sys.exit(__doc__)
