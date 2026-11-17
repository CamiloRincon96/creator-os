---
name: creator-install-montage
description: Installs Montage (this repo's review editor) on a new computer, checking what is missing (Node.js, ffmpeg, Chrome), explaining what each thing is for and asking permission before installing. Use it when someone says "install Montage", "set up the editor", "Montage won't open", when `/creator-montage` fails because something is missing, when someone types "/creator-install-montage", or the first time someone on the team uses the repo on their computer. It also responds when the user writes the same in another language.
---

# Install Montage on this computer

Speak the person's language: every question, instruction (log in here, paste this, click that), approval request and summary goes in the language they write to you in; translate tool messages when you relay them. Commands, code and file names stay in English.

The person talking to you may not be technical. Lead them by the hand, in plain words, as `production/GUIDING.md` says: before each step, what you're doing and why; whatever they do with their hands, one step per message; afterwards, what was produced and where. **Do not install anything without their permission.** Each installation is theirs to approve: tell them what it is, why Montage needs it, and what stops working without it.

## 1. Check what is there (without installing anything)

Before: "I'm checking whether your computer has what Montage needs, the editor where you review your videos. I only look, I don't install anything."

Detect the system (macOS, Windows or Linux) and check, without asking permission because these are only reads:

| What | How to check | Why Montage needs it | Required? |
|---|---|---|---|
| Node.js 22.12 or newer | `node --version` | It is the engine that runs Montage (the server and the editor). | Yes |
| ffmpeg and ffprobe, version 7 or newer | `ffmpeg -version` and `ffprobe -version` (Windows: also `where ffmpeg`) | Reads the videos and makes the previews for frame-by-frame review, the note captures, the export and the deliveries for each network. | Yes. Without it, videos do not show. |
| Google Chrome | macOS: `/Applications/Google Chrome.app` exists. Windows: `chrome.exe` exists in `%ProgramFiles%\Google\Chrome\Application` or in `%LOCALAPPDATA%\Google\Chrome\Application`. Linux: `which google-chrome`. | Opens Montage as an app with its own window. | No. On Windows, without Chrome it uses Edge (it comes with Windows) as an app; on macOS and Linux it opens in the regular browser. |
| Package manager | macOS: `brew --version`. Windows: `winget --version`. | The simplest way to install everything above. | Only if something is missing. |

Show it as a short table: each item with what it does, and ✓ ready or ✗ missing. If everything is there: "Your computer already has everything. Now I'll install Montage." and skip to step 3.

## 2. Ask permission and explain

Ask **one** question with AskUserQuestion: "Should I install what Montage is missing?". List only what is missing. Each program goes on one line: what it's for, where it's used, whether it's free and what happens without it. The texts are in `production/GUIDING.md` ("What the computer is missing"). For example: "ffmpeg: to read, cut and mix the videos. Free. Without it, Montage doesn't show the videos."

Options (texts in `production/GUIDING.md`):
- **Install everything (Recommended):** "I install what's missing; it's all free. If the system asks for your password or shows a permission window, you type it or accept it."
- **One by one:** "I ask you about each program." Then one question per program, with its text and two options: "Install" and "Not now".
- **Not now:** say in one line what won't work.

If they say no, explain what will not work, finish without installing anything and tell them how to pick it up again: "Whenever you want, type `/creator-install-montage`."

Before each installation, one line: what it is, where it comes from (Homebrew, winget or the package manager), that it's free and that it installs on the system. Afterwards: "Done: <program> is installed."

Commands by system:

- **macOS**
  - If Homebrew is missing: **do not install it yourself**, because it asks for the computer's password and Claude's terminal cannot type it. The person runs it, in one message:
    > Open the Terminal app (Cmd + Space, type "Terminal", Enter) and paste the official command from https://brew.sh: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
    > It asks for your computer's password: nothing shows while you type it, that's normal. If it asks you to press Enter to continue, press it. It takes a few minutes.
    > It's done when the typing line comes back; if "Next steps" shows up with commands first, paste those too.
    > Tell me "done". If an error shows up, copy it to me or send me a screenshot.
  - Node.js: `brew install node`
  - ffmpeg: `brew install ffmpeg`
  - Chrome (optional): `brew install --cask google-chrome`
- **Windows** (winget comes with Windows 10 and 11):
  - Node.js: `winget install --id OpenJS.NodeJS.LTS -e`
  - ffmpeg: `winget install --id Gyan.FFmpeg -e` (brings ffmpeg 7 or newer, with ffprobe)
  - Chrome (optional): `winget install --id Google.Chrome -e`
  - If Windows opens a window asking for permission, the person accepts it: "If a window asks whether you allow changes, click "Yes"."
  - After installing, the current terminal does not see the new programs. One message: "Close Claude Code, open it again in the repo folder and type `/creator-install-montage`. That way it sees what we just installed." When they're back, check with `where ffmpeg`.
- **Linux** (Debian/Ubuntu)
  - Node.js: `sudo apt install nodejs` and `ffmpeg` ask for a password. Just like with Homebrew, give them the commands to paste in their own terminal, with the same message (a password that doesn't show, "done", the error or a screenshot).
  - If apt's Node version is lower than 22.12, suggest nvm (https://github.com/nvm-sh/nvm) and then `nvm install 22`.
  - Exporting from the video editor needs ffmpeg 7 or newer; the one in apt on Ubuntu 22.04 and 24.04 is older. Suggest a static ffmpeg build (johnvansickle.com/ffmpeg) and the `FFMPEG` variable with its path.

If a command fails: what happened, in plain words (not the raw error alone); why, if you know; and one step to fix it, which is usually the alternative above. Do not keep retrying the same command.

## 3. Install Montage

Before: "Now I'll install Montage: it downloads its parts, prepares the editor and creates the Montage app so you can open it like any other. It takes a few minutes and it's free. Everything stays in the `montage/` folder, plus the app's shortcut."

Then, from the repo root: `cd montage && npm run install-app`

The installer:
- checks Node and ffmpeg again;
- runs `npm install` and builds the interface;
- creates the shortcut:
  - macOS: `~/Applications/Montage.app`;
  - Windows: a "Montage" shortcut on the Desktop (the real one, even if it's in OneDrive) and in the Start menu. It is removed with `node montage/install.mjs --remove`;
  - Linux: a launcher in the menu.

Afterwards: "Done: Montage is at <the path the installer printed>." If the installer warns that it couldn't create the shortcut, say so and give the other way to open it: `node montage/cli.mjs open`.

## 4. Test it and explain how to use it

1. Open Montage: `node montage/cli.mjs open`. One message:
   > A Montage window opened asking "Who is reviewing?". Type your name in "Your name" and click "Enter Montage": your name signs your notes.
   > When you see the editor, tell me "done". If nothing opened, tell me what you see or send me a screenshot.
2. Tell them in a few lines:
   - It opens with the **Montage** app: Launchpad or Spotlight on macOS; on Windows, the Desktop shortcut or by searching "Montage" in Start. On any system: `node montage/cli.mjs open`.
   - On Windows, versions are full copies (on macOS they take no extra space): archiving a finished project frees the disk.
   - For Claude to work through their notes, they type `/creator-montage` in Claude Code. To process them by hand, `/creator-notes`.
   - To stop, Montage's power button turns everything off. The Claude pill has "Stop listening".
   - Montage uses the projects on **this** computer (`montage/projects/`). What someone else does on another computer does not show up here, unless they share that folder.
3. One question to go on: "Should I start listening to your notes now?". With their yes, follow the `/creator-montage` skill.

Never mark versions as FINAL or publish to social networks. That is the creator's decision.
