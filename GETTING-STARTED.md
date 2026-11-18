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

## 0. Your AI app

Creator OS runs inside an AI app that can run commands on your computer.
- **Claude Code (recommended)** needs a paid Claude plan: Pro is US$20 a month, or US$17 a month billed yearly. The free Claude plan doesn't include Claude Code. Plans: https://claude.com/pricing (checked on 17 Nov 2026).
- **Other AI apps** (Codex CLI, Gemini CLI…) read the same instructions (`AGENTS.md`, `GEMINI.md`) and the skills. They work without the Creator OS plugin, without the automatic checks (the ones that won't let a turn end with a video left unreviewed) and without the independent reviewer that scores each version.

## 1. What's required

It works the same on **macOS, Windows 10/11 and Linux**. Every change to the repo is tested on all three automatically (see "Tests" below).

| What | What for | macOS | Windows | Linux (Debian/Ubuntu) |
|---|---|---|---|---|
| An agent that runs commands | So the AI can work on your files | Claude Code (recommended), Codex CLI, Gemini CLI, Grok CLI… | Claude Code (it brings what it needs: Git for Windows) | same as macOS |
| **git** | To download the repo and its updates | `xcode-select --install` | `winget install --id Git.Git -e` | `sudo apt install git` |
| **Homebrew** (macOS only) | To install the programs below on a Mac | `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`, in the Terminal app (it asks for your password). Then paste the "Next steps" lines it shows (on Apple silicon, the one that adds `eval "$(/opt/homebrew/bin/brew shellenv)"` to `~/.zprofile`) and close and reopen Claude Code | winget comes with Windows | your package manager (`apt`) |
| **Node.js 22.12+** | So Montage (the editor where you review the videos) and the animations (Remotion) run | `brew install node` | `winget install --id OpenJS.NodeJS.LTS -e` | nvm (https://github.com/nvm-sh/nvm), then `nvm install 22`: the apt `nodejs` is too old |
| **Python 3.10+** | For the tools that cut, clean up and measure your voice, plus the variations and metrics ones | `brew install python` | `winget install --id Python.Python.3.12 -e` | `sudo apt install python3 python3-venv` |
| **ffmpeg 7+** | To read, cut, mix and measure the videos and the audio | `brew install ffmpeg` | `winget install --id Gyan.FFmpeg -e` | `sudo apt install ffmpeg`; exporting from Montage needs 7 or newer and the apt one on Ubuntu 22.04 and 24.04 is older: a static ffmpeg (johnvansickle.com/ffmpeg) and the `FFMPEG` variable with its path |
| Google Chrome (optional) | To open Montage as an app with its own window; Remotion uses it if it's there (if not, it downloads its own browser) | `brew install --cask google-chrome` | `winget install --id Google.Chrome -e` (without Chrome, Montage opens in Edge) | google.com/chrome |
| ~6 GB free | Whisper, the one that turns your voice into text on your computer (2.9 GB), and the renders | | | |

Then: **`python3 production/install.py`** (on Windows, `python production/install.py`). It checks everything, installs what's missing inside the repo, and asks before anything that touches the system or before the big download. To only check: `--check`; to also download Whisper: `--with-whisper`. If a system program is missing, it gives you the exact command for yours.

### On Windows

- **`python` instead of `python3`.** Wherever the docs say `python3`, type `python` (or `py`). On Windows, `python3` often opens the Microsoft Store.
- **After installing with winget, close and reopen the terminal and Claude Code.** The window that was already open doesn't see the new programs. If Windows asks for permission in a pop-up, you accept it.
- **Keep the repo out of OneDrive.** Your user folder (`C:\Users\<you>\creator-os`) is better than the Desktop or Documents if those are synced: OneDrive locks files while it syncs and would upload gigabytes of dependencies.
- **Save tokens and keys in PowerShell or Windows Terminal,** not in Git Bash (it can't take a hidden paste). They go in the Windows Credential Manager. The exception is the ScrapeCreators key: it goes in an unencrypted file in your user folder (`~/.config/last30days/.env`), because last30days doesn't read the Credential Manager.
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

It comes after your brand: every network and every key belongs to a brand. The plugins and MCP servers in this table are offered by Claude Code when you open the folder; accept the free plugins and say no to After Effects and Higgsfield unless you already pay for them.

| What | What for | Cost | How |
|---|---|---|---|
| **Instagram via API** | To post your reels and trial reels at the time you choose, and see what worked. Used when each video is finished and every Monday in `/creator-pulse` | Free | `/creator-connect` walks you through it step by step: `production/INSTAGRAM.md` |
| **Facebook (Page)** | To post the same reels on your Page; Facebook posts them on its own at the time you schedule. Used when each video is finished. Brings its metrics | Free | `/creator-connect`, after Instagram (it's the same app): `production/FACEBOOK.md` |
| **YouTube** | To upload your videos as Shorts, public or scheduled, and see how much they're watched. Used when each video is finished | Free (up to 100 videos a day) | `/creator-connect`: `production/YOUTUBE.md` |
| **TikTok** | To send the video to your TikTok drafts; you post it from your phone with the sound you want. Used when each video is finished. Brings its metrics | Free | `/creator-connect`: `production/TIKTOK.md` |
| **A message to whoever comments** | Someone comments a word you choose ("link", "want") and gets your link in a private message, plus a public reply to their comment. Used to hand out a guide or a gift from any post | Free (Meta Business Suite; about 10 minutes). Paid tools such as ManyChat do more, on a monthly plan | `/creator-connect`, after Instagram: `production/MESSAGES.md` |
| **last30days** (plugin) | To see what your niche is sharing this month on TikTok, Instagram, YouTube and Reddit. Used when looking for ideas (`/creator-ideas`) | Free. For TikTok and Instagram it needs a ScrapeCreators key: 100 free credits when you sign up, no card, and up to 1,200 more you can claim from its dashboard (one credit is one request for almost everything). After that, paid: from US$47 for 25,000 credits, which never expire | Declared in `.claude/settings.json`. You save the key yourself with `python3 production/tools/save_token.py --scrapecreators`; see the `creator-ideas` skill |
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
