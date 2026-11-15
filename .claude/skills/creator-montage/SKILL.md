---
name: creator-montage
description: Opens Montage (this repo's local review editor for videos and images) and leaves Claude listening, so that when the creator presses "Send to Claude", Claude wakes up and works through their notes. Use it when the creator says "open the editor", "open Montage", "listen to my notes", "let's review", types "/creator-montage", or at the start of a review session. It also responds when the user writes the same in another language.
argument-hint: "[project]"
allowed-tools: Bash(node montage/cli.mjs:*)
---

# Montage: open and listen

Speak the person's language: every question, instruction (log in here, paste this, click that), approval request and summary goes in the language they write to you in; translate tool messages when you relay them. Commands, code and file names stay in English.

0. If Montage is not installed on this computer (`montage/node_modules` does not exist, or `node --version` / `ffmpeg -version` fail), follow the `/creator-install-montage` skill first.
1. Start the server (if it is not running) and open the editor in Chrome:
   `node montage/cli.mjs open $ARGUMENTS`
2. Check whether work is already waiting: `node montage/cli.mjs pending`.
   If there are sent notes, work through them now following `/creator-notes` before going on.
3. Set up the listener with Bash **in the background** (`run_in_background: true`):
   `node montage/cli.mjs wait`
   - If it prints that "another Claude session is already listening", do not set it up again.
4. Tell the creator in one line that the editor is open and that you are listening.

When `wait` finishes, you get the notification. Read its output: it carries the full submission (who sent it, notes, frames, drawn areas, capture paths, the project context and the brand's rules). Follow the `/creator-notes` flow and, when you are done, set up `wait` in the background again. Repeat until the creator says to stop.

**When not to set it up again:** if the output says someone on the team asked to stop listening (the "Stop listening" button) or that Montage is off (the power button or `node montage/cli.mjs stop`), do not set up `wait` again. Say so in one line and wait until they ask for `/creator-montage` again.

Montage uses port 38420 (or the next free one up to 38429); the CLI finds it by itself.
