---
name: creator-start
description: First time with this repo (or on a new computer). Checks what is installed, explains what is required and what is optional (and what costs money), installs what is missing with permission, and finishes by creating the first brand. Use it when the user says "get started", "set up", "install", "first time", "what do I need", "how do I connect X", or types "/creator-start". It also responds when the user writes the same in another language.
---

# Start: get the system ready

Speak the person's language: every question, instruction (log in here, paste this, click that), approval request and summary goes in the language they write to you in; translate tool messages when you relay them. Commands, code and file names stay in English. Explain each thing in one line: what it is, what it is for, and whether it costs money. **Do not install anything that touches the system without their yes.** Anything that stays inside the repo can be installed without asking.

## 1. Check

`python3 production/install.py --check` says what is there and what is missing. Show it as a short table: required and optional, and the state of each item (ready or missing).

The required items are in `GETTING-STARTED.md` §1:
- Node 18 or newer;
- Python 3.10 or newer;
- ffmpeg;
- Chrome;
- disk space for the transcription model.

## 2. Install the required items

1. If something system-level is missing (Node, Python, ffmpeg, Chrome): give the exact command for their operating system and ask before running it.
2. Then: `python3 production/install.py`. Ask before the Whisper download (2.9 GB) and before anything that touches the system.
3. Montage: `cd montage && npm run install-app`, or the `creator-install-montage` skill.
4. At the end, run `install.py --check` again: every required item should be "ready".

## 3. The optional items, one question at a time

Ask what they want to turn on now (AskUserQuestion, multiple choice). Explain each option with the table in `GETTING-STARTED.md` §3, **making it clear what is paid**: After Effects, Higgsfield and ElevenLabs. For each one:

- **Instagram via the API:** walk them through `production/INSTAGRAM.md`:
  - the Meta app;
  - the system user;
  - the token, which the creator saves themselves with `save-token.sh <brand>`;
  - `instagram.py connect <brand>`;
  - the watcher (`instagram.py watcher install`).

  The creator accepts the policies and types the passwords themselves.
- **last30days:** the plugin is already declared.
  - For TikTok and Instagram, the creator creates their key at scrapecreators.com and saves it: `security add-generic-password -U -a "$USER" -s last30days-SCRAPECREATORS_API_KEY -w` on a Mac, or the `SCRAPECREATORS_API_KEY` environment variable on other systems.
  - The safe configuration in `~/.config/last30days/.env`: `BROWSER_CONSENT=false`, `FROM_BROWSER=off`, `INCLUDE_SOURCES=tiktok,instagram,youtube_comments,tiktok_comments,instagram_comments`, `LAST30DAYS_MEMORY_DIR=`.
  - `yt-dlp` for YouTube.
- **HyperFrames:** `claude plugin install hyperframes@claude-plugins-official`, or the equivalent for their agent.
- **Remotion skills:** `npx skills add remotion-dev/skills`.
- **After Effects, ElevenLabs, Higgsfield:** only if they have them and want them. Remind them these are never used without telling them first (Higgsfield, never without an approved quote).

## 4. The first brand

Finish with `/creator-brand` (new brand), starting from the repo or the website of their product. Then offer `/creator-ideas` for their first week.

## If their agent is not Claude Code

- The skills are `SKILL.md` files: their agent reads them from `.claude/skills/` or `.agents/skills/`.
- The MCP servers in `.mcp.json` and the plugins in `.claude/settings.json` are set up in their agent's format. For example, Codex uses `~/.codex/config.toml`.
- With a chat-only AI, explain that they can use the documents as a guide, but producing the videos needs an agent that can run commands.
