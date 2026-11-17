---
name: start
description: Sets up Creator OS, an open-source content studio for Claude Code (each brand's real niche, ideas from what the niche is sharing, reels with motion graphics and real sound, review on the exact frame, Instagram trial reels, weekly metrics). Use it when the person says "set up Creator OS", "install Creator OS", "start Creator OS", or asks for a Creator OS command (/creator-start, /creator-brand, /creator-connect, /creator-ideas, /creator-reel, /creator-pulse, /creator-notes, /creator-montage) in a folder that isn't a Creator OS workspace yet.
---

# Creator OS: set up the workspace

Creator OS isn't one prompt. It's a folder, the workspace, with nine skills, Python and Node tools, a local review editor (Montage), an example brand and a library of CC0 sounds. This plugin brings that folder to the person's computer and hands over to `/creator-start`. Source: https://github.com/CamiloRincon96/creator-os (MIT).

Speak the person's language: every question, instruction and summary goes in the language they write to you in. Commands, code and file names stay in English. Explain each step in one line before running it.

## 0. Which system?

Check the system first (`uname -s`, or the `OS` variable, which is `Windows_NT` on Windows) and use its commands below. On Windows, Claude Code runs commands in Git Bash: `~` and paths with `/` work there, and `~/creator-os` is `C:\Users\<you>\creator-os`.

## 1. Is there a workspace already?

Look in the working directory for `AGENTS.md`, `production/install.py` and `.claude/skills/creator-start/SKILL.md`.

- **All three are there:** this is a workspace. Go to step 4.
- **They aren't:** check `~/creator-os`. If a workspace is there, tell them and go to step 3.
- **No workspace anywhere:** step 2.

## 2. Get the workspace (ask first)

1. Say in two lines what gets downloaded: about 20 MB from GitHub with the skills, the tools, Montage, an example brand and CC0 sounds. Nothing else gets installed in this step.
2. Ask where to put it and suggest `~/creator-os` (on Windows, `C:\Users\<you>\creator-os`). Never clone into a folder that already has files; propose another name. On Windows, steer away from the Desktop and Documents when OneDrive syncs them (the path has `OneDrive` in it): OneDrive locks files while it syncs and would upload gigabytes of dependencies.
3. Check `git --version`. If git is missing, give the command for their system and run it only with their yes:
   - macOS: `xcode-select --install`;
   - Windows: Claude Code usually brings Git for Windows already; if not, `winget install --id Git.Git -e`. If Windows opens a permission window, the person accepts it;
   - Linux: their package manager (for example `sudo apt install git`, which they paste in their own terminal because it asks for their password).
4. **On Windows, after any `winget install`:** the open terminal doesn't see the new program. Ask them to close and reopen the terminal and Claude Code, then check `git --version` again before going on.
5. With their yes: `git clone https://github.com/CamiloRincon96/creator-os "<folder>"`.

## 3. Open it

The `/creator-…` commands, the optional MCP servers and the recommended plugins load when the agent starts inside the workspace. Claude Code asks them to trust the folder and to approve each server and plugin; all of those are optional.

- **Terminal on macOS or Linux:** `cd "<folder>" && claude`, then type `/creator-start`.
- **Terminal on Windows** (PowerShell or Windows Terminal): `cd "<folder>"` (for example `cd "C:\Users\<you>\creator-os"`), then `claude`, then type `/creator-start`.
- **VS Code or the desktop app:** open the folder, start a new session there and type `/creator-start`.

If they'd rather keep going in this session, read `<folder>/.claude/skills/creator-start/SKILL.md` and follow it, running every command from `<folder>`. Tell them the `/creator-…` commands will show up the next time they open the folder.

## 4. Inside a workspace

Hand over to `/creator-start` the first time, or to the command they asked for. On Windows, the docs' `python3` is typed `python`; `/creator-start` explains the rest per system. If `/creator-start` doesn't show up, the session started in another folder: go back to step 3.

## Updates

Inside the workspace, `git pull` brings the new skills and tools. Their brands, ideas and pieces are their own files. Ask before pulling; if git reports a conflict, stop and explain it, and never discard their changes.

## Rules that don't bend

- Nothing gets installed, downloaded or paid for without their yes. The Whisper model (2.9 GB) gets its own question.
- Never type passwords, keys or tokens. The person saves them in their own terminal (on Windows, PowerShell or Windows Terminal) in the system's secure store (macOS Keychain, Windows Credential Manager, secret-tool on Linux) or in environment variables.
- The paid tools (After Effects, ElevenLabs, Higgsfield) are optional and never used without a quote they approved.
- Nothing gets published without their yes on the exact batch: videos, captions, day and time.
