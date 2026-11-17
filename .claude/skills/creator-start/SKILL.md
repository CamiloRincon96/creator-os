---
name: creator-start
description: First time with this repo (or on a new computer). Checks what is installed, explains what is required and what is optional (and what costs money), installs what is missing with permission, and finishes by creating the first brand. Use it when the user says "get started", "set up", "install", "first time", "what do I need", "how do I connect X", or types "/creator-start". It also responds when the user writes the same in another language.
---

# Start: get the system ready

Speak the person's language: every question, instruction (log in here, paste this, click that), approval request and summary goes in the language they write to you in; translate tool messages when you relay them. Commands, code and file names stay in English. Explain each thing in one line: what it is, what it is for, and whether it costs money. **Do not install anything that touches the system without their yes.** Anything that stays inside the repo can be installed without asking.

## 0. Are you inside the repo?

If `production/install.py` isn't in the working directory, the skill arrived on its own (from a skills directory or the plugin) and the repo is missing. Explain in one line what it contains, ask where to put it (`~/creator-os` by default, which on Windows is `C:\Users\<you>\creator-os`, outside OneDrive; never over a folder that already has files) and, with their yes, `git clone https://github.com/CamiloRincon96/creator-os "<folder>"`. Then ask them to open their agent in that folder so the commands load, and continue here.

## First: which system they have

The whole flow works the same on macOS, Windows and Linux; only a few commands change. Check the system before giving one (`uname -s` or the `OS` variable) and use the ones in its column. `production/install.py` already gives the exact install command for each system.

| | macOS | Windows | Linux |
|---|---|---|---|
| Python in the terminal | `python3` | `python` (or `py`); `python3` often opens the Microsoft Store | `python3` |
| Installing programs | Homebrew (`brew install …`); the person installs Homebrew in their Terminal because it asks for their password | `winget install --id … -e`; if Windows opens a permission window, the person accepts it | the package manager (`sudo apt …`): the person pastes the `sudo` commands in their own terminal |
| After installing | nothing | close and reopen the terminal and Claude Code, so the new programs show up | nothing |
| Saving a token or a key | the Terminal app | PowerShell or Windows Terminal (Git Bash can't take a hidden paste) | their terminal |
| Where secrets go | the Keychain | the Credential Manager | secret-tool, or an environment variable |
| Montage | Montage app in `~/Applications` | shortcut on the Desktop and in the Start menu | launcher in the applications menu |
| Metrics watcher | launchd | Task Scheduler | cron |

On Windows, Claude Code runs commands in Git Bash: the repo's paths are written with `/` and work the same. If the repo is inside OneDrive (a synced Desktop or Documents), suggest moving it to the user folder (`C:\Users\<user>\creator-os`): OneDrive locks files while it syncs and uploads gigabytes of dependencies.

Wherever this document says `python3`, on Windows type `python`.

## 1. Check

`python3 production/install.py --check` says what is there and what is missing. Show it as a short table: required and optional, and the state of each item (ready or missing).

The required items are in `GETTING-STARTED.md` §1:
- Node 22.12 or newer;
- Python 3.10 or newer;
- ffmpeg;
- Chrome is optional: Remotion downloads its own browser;
- disk space for the transcription model.

## 2. Install the required items

1. If something system-level is missing (Node, Python, ffmpeg, Chrome): give the exact command `install.py` gives for their system and ask before running it. On Windows, when it finishes, ask them to close and reopen Claude Code and continue from step 1.
2. Then: `python3 production/install.py`. Ask before the Whisper download (2.9 GB) and before anything that touches the system.
3. Montage: `cd montage && npm run install-app` (on macOS it creates the Montage app, on Windows a shortcut on the Desktop), or the `creator-install-montage` skill.
4. At the end, run `install.py --check` again: every required item should be "ready".

## 3. The optional items, one question at a time

Ask what they want to turn on now (AskUserQuestion, multiple choice). Explain each option with the table in `GETTING-STARTED.md` §3, **making it clear what is paid**: After Effects, Higgsfield and ElevenLabs. For each one:

- **The networks (Instagram, Facebook, YouTube, TikTok):** follow the `creator-connect` skill (`/creator-connect`), which takes each step with its official page. For Instagram, in short (`production/INSTAGRAM.md`):
  - the Meta app;
  - the system user;
  - the token, which the creator saves in their own terminal with `python3 production/tools/save_token.py <brand>` (on Windows, `python …` in PowerShell): it goes in the Keychain, the Credential Manager or secret-tool, depending on the system;
  - `instagram.py connect <brand>`;
  - the watcher (`instagram.py watcher install`).

  The creator accepts the policies and types the passwords themselves.
- **last30days:** the plugin is already declared.
  - For TikTok and Instagram, the creator creates their key at scrapecreators.com and saves it themselves, in their own terminal: `python3 production/tools/save_token.py --scrapecreators`. On macOS it goes in the Keychain; on Windows and Linux, in `~/.config/last30days/.env`, where last30days looks for it.
  - The safe configuration in `~/.config/last30days/.env`: `BROWSER_CONSENT=false`, `FROM_BROWSER=off`, `INCLUDE_SOURCES=tiktok,instagram,youtube_comments,tiktok_comments,instagram_comments`, `LAST30DAYS_MEMORY_DIR=`.
  - `yt-dlp` for YouTube: `brew install yt-dlp` (macOS), `winget install --id yt-dlp.yt-dlp -e` (Windows) or `uv tool install yt-dlp` (any system).
- **HyperFrames:** `claude plugin install hyperframes@claude-plugins-official`, or the equivalent for their agent.
- **Remotion skills:** `npx skills add remotion-dev/skills`.
- **After Effects, ElevenLabs, Higgsfield:** only if they have them and want them. Remind them these are never used without telling them first (Higgsfield, never without an approved quote).

## 4. The first brand

Finish with `/creator-brand` (new brand), starting from the repo or the website of their product. Then offer `/creator-ideas` for their first week.

## If their agent is not Claude Code

- The skills are `SKILL.md` files: their agent reads them from `.claude/skills/` or `.agents/skills/`.
- The MCP servers in `.mcp.json` and the plugins in `.claude/settings.json` are set up in their agent's format. For example, Codex uses `~/.codex/config.toml`.
- With a chat-only AI, explain that they can use the documents as a guide, but producing the videos needs an agent that can run commands.
