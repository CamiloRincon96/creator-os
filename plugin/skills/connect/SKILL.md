---
name: connect
description: Connects a Creator OS brand's social networks (Instagram, Facebook, YouTube and TikTok) through their official APIs, step by step, opening the official page for each step. Use it when the person says "connect my YouTube", "connect my TikTok", "connect my Instagram", "connect my Facebook Page", "connect my networks", "post to YouTube/TikTok/Facebook from Creator OS", or types "/creator-os:connect" or "/creator-connect".
---

# Creator OS: connect the networks

This command is a door to the workspace's own `/creator-connect` skill, which holds the steps, the official pages and the checks for each network. The guides live in the workspace: `production/INSTAGRAM.md`, `FACEBOOK.md`, `YOUTUBE.md` and `TIKTOK.md`.

Speak the person's language: every question, instruction and summary goes in the language they write to you in. Commands, code and file names stay in English.

## 1. Is this a workspace?

Look in the working directory for `production/install.py` and `.claude/skills/creator-connect/SKILL.md`.

- **Both are there:** read `.claude/skills/creator-connect/SKILL.md` and follow it, running every command from this folder.
- **They aren't:** check `~/creator-os` (on Windows, `C:\Users\<you>\creator-os`). If a workspace is there, tell them: they can open that folder and type `/creator-connect`, or keep going in this session with every command run from that folder. If the workspace is there but has no `creator-connect` skill, it's an older copy: offer `git pull` inside it (ask first; if git reports a conflict, stop and explain it, and never discard their changes).
- **No workspace anywhere:** say in one line that the connections need the Creator OS workspace, then follow this plugin's `start` skill (`/creator-os:start`) to set it up. When the workspace is ready (it has a brand, from `/creator-start` and `/creator-brand`), come back here and go to the first case.

## Rules that don't bend

- Never type passwords, keys, tokens or secrets, and never ask for them in the chat. The person saves them in their own terminal (on Windows, PowerShell or Windows Terminal) with the workspace's `save_token.py`, or the tool saves them when they log in with the browser. They go in the system's secure store (macOS Keychain, Windows Credential Manager, secret-tool on Linux). If they paste one in the chat, tell them to delete it on that network and generate a new one.
- The person accepts the terms, grants the permissions and logs in to each account. You open the page and explain what each thing means.
- Connecting is free. If a page asks for a card, stop and check.
- Connecting isn't posting: nothing gets published without their yes on the exact video, caption, day and time.
