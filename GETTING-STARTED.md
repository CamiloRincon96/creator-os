# Getting started

**Talk to your AI in any language.** The repo is in English, but the AI guides you, asks you things and explains every step in the language you write to it in.


The easy way is to open the repo with your agent and type **`/creator-start`** (or "walk me through GETTING-STARTED.md"). This is the same thing, in writing.

## 1. What's required

| What | What for | How |
|---|---|---|
| An agent that runs commands | So the AI can work on your files | Claude Code (recommended), Codex CLI, Gemini CLI, Grok CLI… |
| **Node.js 18+** | Remotion (the videos) and Montage (the review editor) | nodejs.org or `brew install node` |
| **Python 3.10+** | The tools: cut, voice, variations, metrics | python.org or `brew install python` |
| **ffmpeg** | Cutting, mixing and measuring audio and video | `brew install ffmpeg` (Mac) · `winget install ffmpeg` (Windows) |
| **Google Chrome** | Remotion renders with Chrome | google.com/chrome |
| ~6 GB free | The local transcription model (Whisper, 2.9 GB) and the renders | — |

Then: **`python3 production/install.py`**. It checks everything, installs what's missing inside the repo, and asks before anything that touches the system or before the big download. To only check: `python3 production/install.py --check`.

**Mac is the most tested.** On Windows and Linux almost everything works. What changes:
- the keychain: use environment variables instead;
- the automatic metrics watcher: it's `launchd`; on other systems use the task scheduler or `cron`.

## 2. Your first brand

`/creator-brand`, option "new brand". It asks for the name, what it is, **your product's repository or website**, your social accounts and your goal. It builds `NICHE.md` (who it's really for and what those people talk about), `BRAND.md` (tone and rules) and `PROFILE.md` (accounts). It uses `brands/example/` as the shape.

## 3. What's optional (turn it on when you need it)

| What | What for | Cost | How |
|---|---|---|---|
| **Instagram via API** | Post scheduled batches, trial reels and automatic metrics (`/creator-pulse`) | Free | Meta app and a system user: `production/INSTAGRAM.md` |
| **last30days** (plugin) | See what's trending in your niche on TikTok, Instagram, YouTube and Reddit (`/creator-ideas`) | Free. TikTok and Instagram need a ScrapeCreators key (10,000 free requests) | Declared in `.claude/settings.json`. You store the key yourself in the keychain; see the `creator-ideas` skill |
| **marketingskills** (plugin) | Strategy, the psychology of why people share, formats per network | Free | Declared in `.claude/settings.json` |
| **instagram-agent** (plugin) | Hooks, copies, profile, stories and carousels | Free | Declared in `.claude/settings.json` |
| **HyperFrames** (official plugin) | About 450 motion graphics blocks and transition rules, plus `media-use`: sound effects and music placed on their frame, with the mix | Free | `claude plugin install hyperframes@claude-plugins-official` |
| **`openverse-audio`** and **`real-sfx`** (bundled) | Get CC0 sounds with their credit, decide which one goes at each moment, and place them on their frame at a measured level | Free | `production/install.py` installs them |
| **Remotion skills** | Remotion best practices for the agent | Free | `npx skills add remotion-dev/skills` |
| **After Effects** (MCP) | Color and reframing of the takes, effects that don't come out well in code | Paid (Adobe) | Declared in `.mcp.json`. Without it, color is done with ffmpeg or Remotion |
| **ElevenLabs** | Clean up the voice or generate a brand voice | Paid, with a limited free plan | Your agent's connector. You're told before any audio is uploaded |
| **Higgsfield** (MCP) | Regenerate or retouch the person with AI | Paid. Always quoted first | Declared in `.mcp.json` |
| **Codex** | Reference images (clothes, light) with your ChatGPT account | Your ChatGPT plan | `production/tools/codex.sh` |

**For other agents:** the MCP servers (`.mcp.json`) and the plugins (`.claude/settings.json`) are Claude Code's. In Codex, Gemini or Grok you set them up in their own format. Skills are `SKILL.md` files and any agent can read them.

## 4. The week

- **Monday:** `/creator-pulse` (what worked), `/creator-ideas` (what to post this week) and batch recording.
- **Every day:** the express reel (`/creator-reel`, express mode, from a voice note or your own footage) and stories.
- **Whatever you record**, even if it's not used today, goes to `library/inbox/`: `library.py add` catalogs it.
- **Each big piece:** the full `/creator-reel`, review in Montage and, afterwards, variations.

The rhythm and what goes on each account: `production/DISTRIBUTION.md` (a template to fill in).
