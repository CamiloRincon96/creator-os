---
name: connect
description: Connects a Creator OS brand's social networks (Instagram, Facebook, YouTube and TikTok) through their official APIs, step by step, opening the official page for each step. Use it when the person says "connect my YouTube", "connect my TikTok", "connect my Instagram", "connect my Facebook Page", "connect my networks", "post to YouTube/TikTok/Facebook from Creator OS", or types "/creator-os:connect" or "/creator-connect".
---

# Creator OS: connect the networks

This command is a door to the workspace's own `/creator-connect` skill, which holds the steps, the official pages and the checks for each network. The guides live in the workspace: `production/INSTAGRAM.md`, `FACEBOOK.md`, `YOUTUBE.md` and `TIKTOK.md`.

Speak the person's language: every question, instruction and summary goes in the language they write to you in. Commands, code and file names stay in English.

The person may not be technical: lead them by the hand, as the workspace's `production/GUIDING.md` says. Before each step, one line with what you're doing and why. Whatever they do with their hands, one step per message: where, what to click or type, what they'll see, and “tell me "done"”. If something fails, what happened in plain words and one step to fix it.

## 1. Is this a workspace?

Look in the working directory for `production/install.py` and `.claude/skills/creator-connect/SKILL.md`.

- **Both are there:** read `.claude/skills/creator-connect/SKILL.md` and follow it, running every command from this folder.
- **They aren't:** check `~/creator-os` (on Windows, `C:\Users\<you>\creator-os`). If a workspace is there, say so in one line ("Your Creator OS is in `<full path>`") and ask (AskUserQuestion) "Where do we connect your networks?":
  - **Open that folder (Recommended):** "The `/creator-…` commands load there. You open the folder and type `/creator-connect`." Then one message with how to open it: in the Terminal app (on Windows, PowerShell), `cd "<folder>"`, Enter, then `claude`, Enter; in VS Code or the desktop app, open the folder and start a new session there.
  - **Keep going here:** "I run every command from that folder; the commands show up the next time you open it."
- **The workspace is there but has no `creator-connect` skill:** it's an older copy. Ask in one line: "Should I update Creator OS (git pull)? It brings the connections and the other new tools; your brands, ideas and pieces stay as they are. Free." If git reports a conflict, stop, explain it in plain words, and never discard their changes.
- **No workspace anywhere:** say in one line that the connections need the Creator OS workspace ("the folder with the tools that post for you; it's free, about 20 MB"), then follow this plugin's `start` skill (`/creator-os:start`) to set it up. When the workspace is ready (it has a brand, from `/creator-start` and `/creator-brand`), come back here and go to the first case.

## Rules that don't bend

- Never type passwords, keys, tokens or secrets, and never ask for them in the chat. The person saves them in their own terminal (on Windows, PowerShell or Windows Terminal) with the workspace's `save_token.py`, or the tool saves them when they log in with the browser. They go in the system's secure store (macOS Keychain, Windows Credential Manager, secret-tool on Linux). If they paste one in the chat, tell them to delete it on that network and generate a new one.
- The person accepts the terms, grants the permissions and logs in to each account. You open the page and explain what each thing means.
- Connecting is free. If a page asks for a card, stop and check.
- Connecting isn't posting: nothing gets published without their yes on the exact video, caption, day and time.
