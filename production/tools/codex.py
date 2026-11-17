"""Hands a task to Codex (from OpenAI, with the creator's ChatGPT subscription) and waits for its reply.

    python3 production/tools/codex.py <piece> <task.md> [image…]

Codex works inside the piece's folder and leaves its reply in <piece>/codex/reply-<time>.md.
It is for what Codex has and Claude does not in this session: generating images with the ChatGPT subscription
and driving the computer's apps (CapCut) with its computer control.
What it receives (task and images) goes out to OpenAI under the creator's account.

It looks for Codex on the PATH (the CLI: `npm install -g @openai/codex`, on macOS, Windows or Linux) and, on macOS,
inside the ChatGPT app.
"""
import system

system.prepare()

import datetime as dt  # noqa: E402
import shutil  # noqa: E402
import subprocess  # noqa: E402
import sys  # noqa: E402
from pathlib import Path  # noqa: E402


def codex():
    on_path = shutil.which("codex")
    if on_path:
        return on_path
    if system.MAC:  # the CLI that comes inside the ChatGPT app
        app = Path("/Applications/ChatGPT.app/Contents/Resources/codex")
        if app.exists():
            return str(app)
    sys.exit("Codex was not found. Install it with: npm install -g @openai/codex (and sign in with your account: codex login)")


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    piece, task = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
    if not piece.is_dir() or not task.is_file():
        sys.exit(__doc__)
    (piece / "codex").mkdir(exist_ok=True)
    output = piece / "codex" / f"reply-{dt.datetime.now():%Y%m%d-%H%M%S}.md"
    images = [x for i in sys.argv[3:] for x in ("-i", str(Path(i).resolve()))]
    with open(task, "rb") as stdin:
        r = subprocess.run([codex(), "exec", "--skip-git-repo-check", "-C", str(piece), "-s", "workspace-write",
                            "-o", str(output), *images, "-"], stdin=stdin)
    if r.returncode:
        sys.exit(r.returncode)
    print(f"Codex's reply: {output}")


if __name__ == "__main__":
    main()
