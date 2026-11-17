# Getting started

**Talk to your AI in any language.** The repo is in English, but the AI guides you, asks you things and explains every step in the language you write to it in.

The easy way is to open the repo with your agent and type **`/creator-start`** (or "walk me through GETTING-STARTED.md"). This is the same thing, in writing.

The AI walks you through it step by step (`production/GUIDING.md`): before each step it tells you what it's doing, why and how long it takes; when it's your turn, it gives you one step at a time. Nothing that touches your system and nothing paid happens without your yes.

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
| **git** | To download the repo and its updates | `xcode-select --install` | `winget install --id Git.Git -e` | `sudo apt install git` |
| **Node.js 22.12+** | So Montage (the editor where you review the videos) and the animations (Remotion) run | `brew install node` | `winget install --id OpenJS.NodeJS.LTS -e` | nvm or `sudo apt install nodejs` |
| **Python 3.10+** | For the tools that cut, clean up and measure your voice, plus the variations and metrics ones | `brew install python` | `winget install --id Python.Python.3.12 -e` | `sudo apt install python3 python3-venv` |
| **ffmpeg** | To read, cut, mix and measure the videos and the audio | `brew install ffmpeg` | `winget install --id Gyan.FFmpeg -e` | `sudo apt install ffmpeg` |
| Google Chrome (optional) | To open Montage as an app with its own window; Remotion uses it if it's there (if not, it downloads its own browser) | `brew install --cask google-chrome` | `winget install --id Google.Chrome -e` (without Chrome, Montage opens in Edge) | google.com/chrome |
| ~6 GB free | Whisper, the one that turns your voice into text on your computer (2.9 GB), and the renders | | | |

Then: **`python3 production/install.py`** (on Windows, `python production/install.py`). It checks everything, installs what's missing inside the repo, and asks before anything that touches the system or before the big download. To only check: `--check`; to also download Whisper: `--with-whisper`. If a system program is missing, it gives you the exact command for yours.

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
| **Instagram via API** | To post your reels and trial reels at the time you choose, and see what worked. Used when each video is finished and every Monday in `/creator-pulse` | Free | `/creator-connect` walks you through it step by step: `production/INSTAGRAM.md` |
| **Facebook (Page)** | To post the same reels on your Page; Facebook posts them on its own at the time you schedule. Used when each video is finished. Brings its metrics | Free | `/creator-connect`, after Instagram (it's the same app): `production/FACEBOOK.md` |
| **YouTube** | To upload your videos as Shorts, public or scheduled, and see how much they're watched. Used when each video is finished | Free (up to 100 videos a day) | `/creator-connect`: `production/YOUTUBE.md` |
| **TikTok** | To send the video to your TikTok drafts; you post it from your phone with the sound you want. Used when each video is finished. Brings its metrics | Free | `/creator-connect`: `production/TIKTOK.md` |
| **last30days** (plugin) | To see what your niche is sharing this month on TikTok, Instagram, YouTube and Reddit. Used when looking for ideas (`/creator-ideas`) | Free; for TikTok and Instagram it needs a ScrapeCreators key, with 10,000 free requests | Declared in `.claude/settings.json`. You save the key yourself with `python3 production/tools/save_token.py --scrapecreators`; see the `creator-ideas` skill |
| **marketingskills** (plugin) | For strategy: why people share and which format goes on each network. Used when planning the week | Free | Declared in `.claude/settings.json` |
| **instagram-agent** (plugin) | To write hooks, scripts and copy that sound like you, plus your profile, stories and carousels. Used in the script and when posting | Free | Declared in `.claude/settings.json` |
| **HyperFrames** (official plugin) | To have hundreds of ready-made animations and transitions (about 450 blocks), and the sound effects and music placed on their frame, with the mix (`media-use`). Used when animating the video | Free | `claude plugin install hyperframes@claude-plugins-official` |
| **`openverse-audio`** and **`real-sfx`** (bundled) | To get CC0 sounds with their credit, decide which one goes at each moment and place them on their frame at a measured level. Used in the video's sound | Free | `production/install.py` installs them |
| **Remotion skills** | So the AI animates your videos better. Used when animating | Free | `npx skills add remotion-dev/skills` |
| **After Effects** (MCP) | For the color and framing of your takes, and effects that don't come out well in code (text behind you, glows). Used when fixing the picture | Paid: you need your Adobe subscription | Declared in `.mcp.json`. Without it, color is done for free with ffmpeg or Remotion |
| **Adobe Podcast** | So your voice sounds studio-quality in one click. Used when preparing the voice | Free with an Adobe account (about 1 hour of audio a day) | Your own session in Chrome, with Claude in Chrome |
| **ElevenLabs** | To clean up your voice or create a voice for your brand. Used when preparing the voice | Paid: it has a free plan with a few minutes a month; every use is announced first | Your agent's connector (on claude.ai: Settings → Connectors). You're told before any audio is uploaded |
| **Higgsfield** (MCP) | To change your clothes, the light or the angle of the video with AI. Used only in the video you ask for | Paid, by credits: you're always shown the price and your yes is awaited before spending | Declared in `.mcp.json` |
| **Codex** | To create reference photos (other clothes, other light) with your ChatGPT account. Used before Higgsfield | Paid: it uses your ChatGPT plan | `production/tools/codex.py` (the Codex CLI: `npm install -g @openai/codex`) |

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
