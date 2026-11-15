---
name: creator-install-montage
description: Installs Montage (this repo's review editor) on a new computer, checking what is missing (Node.js, ffmpeg, Chrome), explaining what each thing is for and asking permission before installing. Use it when someone says "install Montage", "set up the editor", "Montage won't open", when `/creator-montage` fails because something is missing, when someone types "/creator-install-montage", or the first time someone on the team uses the repo on their computer. It also responds when the user writes the same in another language.
---

# Install Montage on this computer

Speak the person's language: every question, instruction (log in here, paste this, click that), approval request and summary goes in the language they write to you in; translate tool messages when you relay them. Commands, code and file names stay in English.


The person talking to you may not be technical. Explain in plain words, in the user's language, and **do not install anything without their permission**. Each installation is theirs to approve: tell them what it is, why Montage needs it, and that without it Montage does not work (or what stops working).

## 1. Check what is there (without installing anything)

Detect the system (macOS, Windows or Linux) and check, without asking permission because these are only reads:

| What | How to check | Why Montage needs it | Required? |
|---|---|---|---|
| Node.js 22.12 or newer | `node --version` | It is the engine that runs Montage (the server and the editor). | Yes |
| ffmpeg and ffprobe | `ffmpeg -version` and `ffprobe -version` | Reads the videos and makes the previews for frame-by-frame review, the note captures, the export and the deliveries for each network. | Yes. Without it, videos do not show. |
| Google Chrome | macOS: `/Applications/Google Chrome.app`. Windows: `where chrome`. Linux: `which google-chrome`. | Opens Montage as an app with its own window. | No. Without Chrome it opens in the regular browser. |
| Package manager | macOS: `brew --version`. Windows: `winget --version`. | The simplest way to install everything above. | Only if something is missing. |

If everything is there, skip to step 3.

## 2. Ask permission and explain

Ask **one** question with AskUserQuestion. List only what is missing and, in one line each, what it is for. For example: "ffmpeg is missing: it is the program that reads the videos so you can review them frame by frame. Without it Montage does not show the videos."

Options:
- Install everything that is missing (recommended)
- Go one by one
- Not now

If they say no, explain what will not work and finish without installing anything.

Commands by system:

- **macOS**
  - If Homebrew is missing: **do not install it yourself**, because it asks for the computer's password and Claude's terminal cannot type it. Ask them to open the Terminal app and paste the official command from https://brew.sh. When it finishes, they let you know.
  - Node.js: `brew install node`
  - ffmpeg: `brew install ffmpeg`
  - Chrome: `brew install --cask google-chrome`
- **Windows** (winget comes with Windows 10 and 11):
  - Node.js: `winget install OpenJS.NodeJS.LTS`
  - ffmpeg: `winget install Gyan.FFmpeg`
  - Chrome: `winget install Google.Chrome`
  - After installing, the current terminal does not see the new programs. Ask them to close and reopen Claude Code, or use the full path.
- **Linux** (Debian/Ubuntu)
  - Node.js: `sudo apt install nodejs` and `ffmpeg` ask for a password. Just like with Homebrew, give them the commands to paste in their own terminal.
  - If apt's Node version is lower than 22.12, suggest nvm (https://github.com/nvm-sh/nvm) and then `nvm install 22`.

If a command fails, show the error in plain words and propose the alternative. Do not keep retrying the same command.

## 3. Install Montage

Explain: "Now I'll install Montage: it downloads its parts, prepares the editor and creates the Montage app so you can open it like any other."

Then, from the repo root: `cd montage && npm run install-app`

The installer:
- checks Node and ffmpeg again;
- runs `npm install` and builds the interface;
- creates the shortcut:
  - macOS: `~/Applications/Montage.app`;
  - Windows: `Montage.cmd` on the Desktop;
  - Linux: a launcher in the menu.

## 4. Test it and explain how to use it

1. Open Montage: `node montage/cli.mjs open`. Ask them to confirm they see the window and to type their name. Their name signs their notes.
2. Tell them in a few lines:
   - It opens with the **Montage** app: Launchpad or Spotlight on a Mac, the Desktop shortcut on Windows.
   - For Claude to work through their notes, they type `/creator-montage` in Claude Code. To process them by hand, `/creator-notes`.
   - To stop, Montage's power button turns everything off. The Claude pill has "Stop listening".
   - Montage uses the projects on **this** computer (`montage/projects/`). What someone else does on another computer does not show up here, unless they share that folder.
3. If they want, leave Claude listening: follow the `/creator-montage` skill.

Never mark versions as FINAL or publish to social networks. That is the creator's decision.
