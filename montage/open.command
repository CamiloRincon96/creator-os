#!/bin/bash
# Double-click: starts Montage (if it is not running) and opens it in Chrome.
cd "$(dirname "$0")/.." || exit 1
node montage/cli.mjs open
