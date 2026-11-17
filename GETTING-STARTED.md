# Getting started

**Talk to your AI in any language.** The repo is in English, but the AI guides you, asks you things and explains every step in the language you write to it in.


The easy way is to open the repo with your agent and type **`/creator-start`** (or "walk me through GETTING-STARTED.md"). This is the same thing, in writing.

**In Claude Code you can skip the clone.** Install the plugin and it sets up the workspace for you:

```
/plugin marketplace add CamiloRincon96/creator-os
/plugin install creator-os@creator-os
```

Then type `/creator-os:start`. It asks where to put the folder, clones the repo with your yes and hands over to `/creator-start`.

It suggests `~/creator-os`: on Windows that's `C:\Users\<you>\creator-os`, outside OneDrive. To open Claude Code there later on Windows, in PowerShell or Windows Terminal: `cd "C:\Users\<you>\creator-os"`, then `claude`. On macOS and Linux: `cd ~/creator-os && claude`.

## 1. What's required

It works the same on **macOS, Windows 10/11 and Linux**. Every change to the repo is tested on all three automatically (see "Tests" below).

| What | What for | macOS | Windows | Linux (Debian/Ubuntu) |
|---|---|---|---|---|
| An agent that runs commands | So the AI can work on your files | Claude Code (recommended), Codex CLI, Gemini CLI, Grok CLI… | Claude Code (it brings what it needs: Git for Windows) | same as macOS |
| **git** | Download the repo and its updates | `xcode-select --install` | `winget install --id Git.Git -e` | `sudo apt install git` |
| **Node.js 22.12+** | Remotion (the videos) and Montage (the review editor) | `brew install node` | `winget install --id OpenJS.NodeJS.LTS -e` | nvm or `sudo apt install nodejs` |
| **Python 3.10+** | The tools: cut, voice, variations, metrics | `brew install python` | `winget install --id Python.Python.3.12 -e` | `sudo apt install python3 python3-venv` |
| **ffmpeg** | Cutting, mixing and measuring audio and video | `brew install ffmpeg` | `winget install --id Gyan.FFmpeg -e` | `sudo apt install ffmpeg` |
| Google Chrome (optional) | Montage opens as an app; Remotion uses it if it's there (if not, it downloads its own browser) | `brew install --cask google-chrome` | `winget install --id Google.Chrome -e` (without Chrome, Montage opens in Edge) | google.com/chrome |
| ~6 GB free | The local transcription model (Whisper, 2.9 GB) and the renders | | | |

Then: **`python3 production/install.py`** (on Windows, `python production/install.py`). It checks everything, installs what's missing inside the repo, and asks before anything that touches the system or before the big download. To only check: `--check`. If a system program is missing, it gives you the exact command for yours.

### On Windows

- **`python` instead of `python3`.** Wherever the docs say `python3`, type `python` (or `py`). On Windows, `python3` often opens the Microsoft Store.
- **After installing with winget, close and reopen the terminal and Claude Code.** The window that was already open doesn't see the new programs. If Windows asks for permission in a pop-up, you accept it.
- **Keep the repo out of OneDrive.** Your user folder (`C:\Users\<you>\creator-os`) is better than the Desktop or Documents if those are synced: OneDrive locks files while it syncs and would upload gigabytes of dependencies.
- **Save tokens and keys in PowerShell or Windows Terminal,** not in Git Bash (it can't take a hidden paste). They go in the Windows Credential Manager.
- **Montage** is a shortcut on the Desktop and in the Start menu. The metrics watcher is a Task Scheduler task.

### What changes from one system to another (the repo already handles it)

| | macOS | Windows | Linux |
|---|---|---|---|
| Tokens and keys (`save_token.py`) | the Keychain | the Credential Manager | secret-tool, or an environment variable |
| Hourly metrics watcher | launchd | Task Scheduler | cron |
| Montage | app in `~/Applications` | shortcut on the Desktop and in the Start menu | launcher in the menu |

All of that lives in one file, `production/tools/system.py`.

## 2. Your first brand

`/creator-brand`, option "new brand". It asks for the name, what it is, **your product's repository or website**, your social accounts and your goal. It builds `NICHE.md` (who it's really for and what those people talk about), `BRAND.md` (tone and rules) and `PROFILE.md` (accounts). It uses `brands/example/` as the shape.

## 3. What's optional (turn it on when you need it)

| What | What for | Cost | How |
|---|---|---|---|
| **Instagram via API** | Post scheduled batches, trial reels and automatic metrics (`/creator-pulse`) | Free | Meta app and a system user: `production/INSTAGRAM.md` |
| **last30days** (plugin) | See what's trending in your niche on TikTok, Instagram, YouTube and Reddit (`/creator-ideas`) | Free. TikTok and Instagram need a ScrapeCreators key (10,000 free requests) | Declared in `.claude/settings.json`. You save the key yourself with `python3 production/tools/save_token.py --scrapecreators`; see the `creator-ideas` skill |
| **marketingskills** (plugin) | Strategy, the psychology of why people share, formats per network | Free | Declared in `.claude/settings.json` |
| **instagram-agent** (plugin) | Hooks, copies, profile, stories and carousels | Free | Declared in `.claude/settings.json` |
| **HyperFrames** (official plugin) | About 450 motion graphics blocks and transition rules, plus `media-use`: sound effects and music placed on their frame, with the mix | Free | `claude plugin install hyperframes@claude-plugins-official` |
| **`openverse-audio`** and **`real-sfx`** (bundled) | Get CC0 sounds with their credit, decide which one goes at each moment, and place them on their frame at a measured level | Free | `production/install.py` installs them |
| **Remotion skills** | Remotion best practices for the agent | Free | `npx skills add remotion-dev/skills` |
| **After Effects** (MCP) | Color and reframing of the takes, effects that don't come out well in code | Paid (Adobe) | Declared in `.mcp.json`. Without it, color is done with ffmpeg or Remotion |
| **ElevenLabs** | Clean up the voice or generate a brand voice | Paid, with a limited free plan | Your agent's connector. You're told before any audio is uploaded |
| **Higgsfield** (MCP) | Regenerate or retouch the person with AI | Paid. Always quoted first | Declared in `.mcp.json` |
| **Codex** | Reference images (clothes, light) with your ChatGPT account | Your ChatGPT plan | `production/tools/codex.py` (the Codex CLI: `npm install -g @openai/codex`) |

**For other agents:** the MCP servers (`.mcp.json`) and the plugins (`.claude/settings.json`) are Claude Code's. In Codex, Gemini or Grok you set them up in their own format. Skills are `SKILL.md` files and any agent can read them.

## 4. The week

- **Monday:** `/creator-pulse` (what worked), `/creator-ideas` (what to post this week) and batch recording.
- **Every day:** the express reel (`/creator-reel`, express mode, from a voice note or your own footage) and stories.
- **Whatever you record**, even if it's not used today, goes to `library/inbox/`: `library.py add` catalogs it.
- **Each big piece:** the full `/creator-reel`, review in Montage and, afterwards, variations.

The rhythm and what goes on each account: `production/DISTRIBUTION.md` (a template to fill in).

## Tests

On GitHub, every change to the repo runs automatically on Windows, macOS and Linux (`.github/workflows/tests.yml`):
- the installation (`production/install.py`, without the big download);
- every tool, with its help and with a test voice;
- the secret store and the hourly task;
- Montage (its tests, the editor and a real published version) and the Remotion kit.

`python3 production/tests/portability.py` checks that nothing specific to a single system slips in.
