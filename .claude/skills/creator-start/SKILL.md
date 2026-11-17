---
name: creator-start
description: First time with this repo (or on a new computer). Checks what is installed, explains what is required and what is optional (and what costs money), installs what is missing with permission, and finishes by creating the first brand. Use it when the user says "get started", "set up", "install", "first time", "what do I need", "how do I connect X", or types "/creator-start". It also responds when the user writes the same in another language.
---

# Start: get the system ready

Speak the person's language: every question, instruction (log in here, paste this, click that), approval request and summary goes in the language they write to you in; translate tool messages when you relay them. Commands, code and file names stay in English.

The person may not be technical. Lead them by the hand, as `production/GUIDING.md` says:
- before each step, what you're doing, why, and how long it takes;
- every decision with options: what it's for, where it's used and what it costs (the texts in `GUIDING.md`, as they are);
- whatever they do with their hands, one step per message: where, what to click or type, what they'll see, and “tell me "done"”;
- afterwards, what was produced and the location of what was created (each version, not every intermediate file) as a link that opens in the editor (`[name](path)`); if something fails, what happened and one step to fix it.

**Do not install anything that touches the system without their yes.** Anything that stays inside the repo can be installed without asking.

## When you start

A short first message, for example:
> I'll get your computer ready to make your videos, in 4 steps: I check what you have, install what's missing, you pick the optional tools, and we create your first brand.
> Before each step I'll tell you what I'm doing and how long it takes. Nothing that touches your system gets installed without your yes, and nothing paid gets used without your approval.

## 0. Are you inside the repo?

If `production/install.py` isn't in the working directory, the skill arrived on its own (from a skills directory or the plugin) and the repo is missing.
1. Say in one line what it contains: the commands, the tools, Montage (the editor where you review your videos), an example brand and free sounds.
2. Ask "Where should I put your workspace folder?": **`~/creator-os` (Recommended)**, "in your user folder (on Windows, `C:\Users\<you>\creator-os`), outside OneDrive", or **Another folder**, "you tell me which one; it has to be empty". Never over a folder that already has files: propose another name.
3. If git is missing (`git --version`): "git, the one that downloads the repo and its updates. Free." With their yes: `xcode-select --install` on macOS (a window opens: "Install", then "Agree"; it takes a few minutes), `winget install --id Git.Git -e` on Windows (if a permission window opens, the person accepts it; afterwards, close and reopen the terminal and Claude Code) or `sudo apt install git` on Linux, which the person pastes in their own terminal.
4. With their yes, `git clone https://github.com/CamiloRincon96/creator-os "<folder>"`: "Done: your folder is at `<full path>`."
5. The commands load when the agent opens in that folder. One message:
   > Open the Terminal app (on Windows, PowerShell) and paste `cd "<folder>"`, Enter; then `claude`, Enter.
   > It asks whether you trust the folder: say yes. The servers and plugins it offers are optional.
   > When you see the chat, type `/creator-start` and we'll continue.

   In VS Code or the desktop app: open the folder, start a session there and type `/creator-start`.

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

Before: "I'm checking what your computer has. I only look, I don't install anything (under a minute)."

`python3 production/install.py --check` answers in sections ("Ready", "Needs the person's permission", "Failed or missing", "Good to know"). Don't paste the raw output: a short table with each item and what it does ("Node.js, which runs Montage and the animations"), required or optional, and ✓ ready or ✗ missing. Close with one line: what's missing and that you'll now ask whether to install it. If nothing is missing, say so and skip to step 3.

The required items are in `GETTING-STARTED.md` §1:
- Node 22.12 or newer;
- Python 3.10 or newer;
- ffmpeg;
- Chrome is optional: Remotion downloads its own browser;
- disk space for the transcription model.

## 2. Install the required items

1. **System programs that are missing** (Node, Python, ffmpeg, Chrome):
   - One question, "Should I install what your computer is missing?", with each missing program and its text from `GUIDING.md` ("What the computer is missing"), and its options: "Install everything (Recommended)", "One by one" and "Not now".
   - Before each one: what it is, where it comes from (Homebrew, winget or the package manager) and that it's free. The command is the one `install.py` gives for their system.
   - If it asks for a password (Homebrew on macOS, `sudo` on Linux), the person runs it. One message:
     > Open the Terminal app (on a Mac: Cmd + Space, type "Terminal", Enter) and paste: `<command>`.
     > It asks for your computer's password: nothing shows while you type it, that's normal. If it asks you to press Enter to continue, press it.
     > It's done when the typing line comes back; if "Next steps" shows up with commands first, paste those too.
     > Tell me "done". If an error shows up, copy it to me or send me a screenshot.
   - On Windows, if a permission window opens, the person accepts it. When it finishes: "Close Claude Code and the terminal, open them again in this folder and type `/creator-start`: that way your computer sees the new programs." Continue from step 1.
   - If they say "Not now": say in one line what won't work (the "without it…" in `GUIDING.md`) and go on with what can be done.
2. **What goes inside the repo.** Before: "Now I'm getting your computer ready to edit: I install what's missing inside this folder and two sound skills in your Claude skills folder (about 5 minutes). It doesn't touch anything else on your system." Then `python3 production/install.py`.
3. **Whisper, its own question:** "Should I download Whisper now, the one that turns your voice into text on your computer, without uploading it?"
   - **Now (Recommended):** your first reel won't wait for the download. Free; it's 2.9 GB and takes as long as your internet needs.
   - **Later:** it downloads itself the first time it's needed, when your first voice gets cut.

   With their yes: `python3 production/install.py --with-whisper`.
4. **Montage.** Before: "Now I'm installing Montage, the editor where you review your videos and leave notes on the exact frame (a few minutes). Free." Then `cd montage && npm run install-app`, or the `creator-install-montage` skill. Afterwards, where it is: on macOS, the Montage app in `~/Applications`; on Windows, the "Montage" shortcut on the Desktop and in the Start menu; on Linux, the applications menu.
5. At the end, run `install.py --check` again: every required item "ready". Say it like this: "Done: your computer can make videos now. Next, you pick the optional tools."

**If something fails:** what happened, in plain words (never the raw error alone); why, if you know; and one step to fix it. Don't repeat the same command hoping for a different result.

## 3. The optional tools, in a single call

Before: "Now you pick the optional tools. The free ones save you work; the paid ones are always quoted before spending. Whatever you don't pick today you can turn on whenever you want: just ask me."

A single AskUserQuestion call, multiple choice: one question per group, each option with its name in `label` and its text from `GUIDING.md` in `description` (what it's for · where · what it costs):
1. "Where do you want to post and measure?": Instagram, Facebook, YouTube and TikTok. All free; connected with `/creator-connect`.
2. "What do you want to use for ideas and copy?": last30days, instagram-agent and marketingskills. Free.
3. "What do you want to use to improve your voice?": only what's in the repo (Recommended), Adobe Podcast and ElevenLabs.
4. "What do you want to use to animate and fix the picture?": HyperFrames, Remotion skills, After Effects and Higgsfield. Almost everything paid is here: each option says so.

Codex (reference photos) and CapCut retouching don't go here: they're offered in each piece, at stage 0 of `/creator-reel`, with their cost.

With what they pick, one thing at a time. Before each one: what you're turning on and whether the person has to do something. Afterwards: "Done: <what's set up>. Next: <what's next>."

- **The networks (Instagram, Facebook, YouTube, TikTok):** follow the `creator-connect` skill (`/creator-connect`), which opens each official page, says what to click and checks each step. Before: "We'll connect them one by one; Instagram takes about 25 minutes." Instagram, in short (`production/INSTAGRAM.md`): the Meta app; the system user; the token, which the creator saves in their own terminal with `python3 production/tools/save_token.py <brand>` (on Windows, `python …` in PowerShell) and goes in the Keychain, the Credential Manager or secret-tool; `instagram.py connect <brand>`; and the watcher (`instagram.py watcher install`). The creator accepts the policies and types the passwords themselves.
- **The plugins** (last30days, instagram-agent, marketingskills and HyperFrames) are already declared in `.claude/settings.json`: Claude Code offers them when the folder is trusted. If one didn't get installed, `claude plugin install <name>` with the name from that file (HyperFrames: `claude plugin install hyperframes@claude-plugins-official`), or the equivalent for their agent.
- **last30days, the ScrapeCreators key** (for TikTok and Instagram; 10,000 free requests). Two steps for the person, one per message:
  1. > Open scrapecreators.com, create your account and copy your key (API key). Don't paste it here. When you've copied it, tell me "done".
  2. > Open the Terminal app (on Windows, PowerShell or Windows Terminal) and paste `cd "<repo folder>"`, Enter. Then paste `python3 production/tools/save_token.py --scrapecreators` (on Windows, `python …`), Enter.
     > It asks you to paste the key: nothing shows while you paste, that's normal. Press Enter.
     > If it says "Saved in …", tell me "done".

  On macOS it goes in the Keychain; on Windows and Linux, in `~/.config/last30days/.env`, where last30days looks for it.
  - You set the safe configuration yourself in `~/.config/last30days/.env` ("I'm putting last30days in safe mode: it doesn't use your browser's cookies"): `BROWSER_CONSENT=false`, `FROM_BROWSER=off`, `INCLUDE_SOURCES=tiktok,instagram,youtube_comments,tiktok_comments,instagram_comments`, `LAST30DAYS_MEMORY_DIR=`.
  - `yt-dlp`, the one that downloads videos: last30days uses it for YouTube, and it downloads the references they send. Free; ask first, because it installs on the system: `brew install yt-dlp` (macOS), `winget install --id yt-dlp.yt-dlp -e` (Windows) or `uv tool install yt-dlp` (any system).
- **Remotion skills:** `npx skills add remotion-dev/skills`.
- **After Effects** (paid: their Adobe subscription). Claude Code asks to approve its MCP server (`.mcp.json`). One step for the person:
  > In After Effects, open Preferences (on a Mac, After Effects → Settings) → Scripting & Expressions, and check "Allow Scripts to Write Files and Access Network". Tell me "done".
- **Higgsfield** (paid, by credits). Claude Code asks to approve its MCP server; the first time it asks for its login, which the person types. Never used without an approved quote.
- **ElevenLabs** (paid, with a free plan of a few minutes a month). One step for the person:
  > On claude.ai, open Settings → Connectors, find ElevenLabs and connect it with your account. Tell me "done".

  Every use is announced before any audio is uploaded.
- **Adobe Podcast** (free with an Adobe account). It's used with their own session in Chrome and Claude in Chrome:
  > Open Chrome, go to podcast.adobe.com and sign in with your Adobe account. Tell me "done".

## 4. The first brand

Before: "Now we'll build your first brand: who it's for, what it talks about and which accounts. It's a few questions; if you have your product's website or repository, keep it handy." Follow `/creator-brand` (new brand), starting from the repo or the website of their product.

## When you finish

In 3 to 5 lines, with full paths:
> Done: your computer makes videos now. Montage opens from <where>.
> You turned on: <the optional tools>. Anything paid, I always quote first.
> Your brand is in [brands/<brand>](brands/<brand>/) (on your computer: `<full path>/brands/<brand>/`).
> Shall we find the ideas for your first week with `/creator-ideas`?

## If their agent is not Claude Code

- The skills are `SKILL.md` files: their agent reads them from `.claude/skills/` or `.agents/skills/`.
- The MCP servers in `.mcp.json` and the plugins in `.claude/settings.json` are set up in their agent's format. For example, Codex uses `~/.codex/config.toml`.
- With a chat-only AI, explain that they can use the documents as a guide, but producing the videos needs an agent that can run commands.
