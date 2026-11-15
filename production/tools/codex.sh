#!/bin/zsh
# Hands a task to Codex (the creator's ChatGPT app) and waits for its reply.
# Usage: zsh production/tools/codex.sh <piece> <task.md> [image…]
#
# Codex works inside the piece's folder and leaves its reply in <piece>/codex/reply-<time>.md.
# It is for what Codex has and Claude does not in this session: generating images with the ChatGPT subscription
# and driving the computer's apps (CapCut) with its computer control.
# What it receives (task and images) goes out to OpenAI under the creator's account.
set -e
CODEX=/Applications/ChatGPT.app/Contents/Resources/codex
[[ -x $CODEX ]] || { echo "Codex is not at $CODEX (it comes with the ChatGPT app)"; exit 1; }
(( $# >= 2 )) || { echo "Usage: codex.sh <piece> <task.md> [image…]"; exit 1; }
PIECE=${1:A}; TASK=${2:A}; shift 2
[[ -d $PIECE && -f $TASK ]] || { echo "Usage: codex.sh <piece> <task.md> [image…]"; exit 1; }
mkdir -p "$PIECE/codex"
TIME=$(date +%Y%m%d-%H%M%S)
IMAGES=()
for i in "$@"; do IMAGES+=(-i "${i:A}"); done
$CODEX exec --skip-git-repo-check -C "$PIECE" -s workspace-write \
  -o "$PIECE/codex/reply-$TIME.md" "${IMAGES[@]}" - < "$TASK"
echo "Codex's reply: $PIECE/codex/reply-$TIME.md"
