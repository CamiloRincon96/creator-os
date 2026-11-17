---
name: creator-montage
description: Opens Montage (this repo's local review editor for videos and images) and leaves Claude listening, so that when the creator presses "Send to Claude", Claude wakes up and works through their notes. Use it when the creator says "open the editor", "open Montage", "listen to my notes", "let's review", types "/creator-montage", or at the start of a review session. It also responds when the user writes the same in another language.
argument-hint: "[project]"
allowed-tools: Bash(node montage/cli.mjs:*)
---

# Montage: open and listen

Speak the person's language: every question, instruction (log in here, paste this, click that), approval request and summary goes in the language they write to you in; translate tool messages when you relay them. Commands, code and file names stay in English. What you tell the person follows `production/GUIDING.md`: simple words, one idea per line.

0. If Montage is not installed on this computer (`montage/node_modules` does not exist, or `node --version` / `ffmpeg -version` fail), say so in one line ("Montage, the editor where you review your videos, isn't on this computer yet; I'll help you install it, it's free") and follow the `/creator-install-montage` skill first.
1. Say it in one line: "I'm opening Montage, the editor where you watch the videos and leave notes on them. It opens in a Chrome window (or your browser) in a few seconds." Then start the server (if it is not running) and open the editor:
   `node montage/cli.mjs open $ARGUMENTS`
   - If it fails, say what happened in simple words and a single step to fix it. If Node.js or ffmpeg is missing, that's `/creator-install-montage`.
2. Check whether work is already waiting: `node montage/cli.mjs pending`.
   If there are sent notes, tell them in one line ("You had already sent me 3 notes on "<project>": I'm working on them now") and work through them following `/creator-notes` before going on.
3. Set up the listener with Bash **in the background** (`run_in_background: true`):
   `node montage/cli.mjs wait`
   - If it prints that "another Claude session is already listening", do not set it up again. Tell them in one line that their notes reach the other Claude Code window. Only if they ask for this one to listen, `node montage/cli.mjs wait --take`.
4. Tell them the editor is open and that you are listening. The first time in the session, add how it's used, in a few lines:
   > Done: Montage is open and I'm listening.
   > - The first time, it asks for your name: it signs your notes.
   > - To leave a note: pause the video at the exact moment, draw on the frame if you want to point something out, write what to change and press Enter (**Save note**).
   > - When you're done, click **Send to Claude**, at the top. I start on my own: my replies show up on each note and the new version lands in the versions list by itself.
   > - At the top it says **Claude listening**. To make it stop listening, click it and then **Stop listening**.

When `wait` finishes, you get the notification. Read its output: it carries the full submission (who sent it, notes, frames, drawn areas, capture paths, the project context and the brand's rules). Follow the `/creator-notes` flow and, when you are done, set up `wait` in the background again. Repeat until the creator says to stop.

**When not to set it up again:** if the output says someone on the team asked to stop listening (the "Stop listening" button) or that Montage is off (the power button, "Shut down Montage", or `node montage/cli.mjs stop`), do not set up `wait` again. Say so in one line and wait until they ask for `/creator-montage` again:
- if they asked to stop listening: "I stopped listening, as you asked. To bring me back, type /creator-montage.";
- if Montage shut down: "Montage shut down; your notes and versions are saved. To come back, type /creator-montage or open the Montage app."

Montage uses port 38420 (or the next free one up to 38429); the CLI finds it by itself.
