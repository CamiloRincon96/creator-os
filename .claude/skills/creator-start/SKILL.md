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

**Do not install anything that touches the system without their yes.** Anything that stays inside the repo can be installed without asking. Only two things get written outside it, and you say so in one line first: the real-sfx and openverse-audio skills in `~/.claude/skills/` (step 2) and last30days's safe configuration in `~/.config/last30days/.env` (step 4, only if they pick it).

## When you start

A short first message, for example:
> I'll get your computer ready to make your videos, in 4 steps: I check what you have, install what's missing, we create your first brand, and you pick the optional tools (its networks, among others).
> Before each step I'll tell you what I'm doing and how long it takes. Nothing that touches your system gets installed without your yes, and nothing paid gets used without your approval.

## 0. Are you inside the repo?

If `production/install.py` isn't in the working directory, the skill arrived on its own (from a skills directory or the plugin) and the repo is missing.
1. Say in one line what it contains: the commands, the tools, Montage (the editor where you review your videos), an example brand and free sounds.
2. Ask "Where should I put your workspace folder?": **`~/creator-os` (Recommended)**, "in your user folder (on Windows, `C:\Users\<you>\creator-os`), outside OneDrive", or **Another folder**, "you tell me which one; it has to be empty". Never over a folder that already has files: propose another name.
3. If git is missing (`git --version`): "git, the one that downloads the repo and its updates. Free." With their yes: `xcode-select --install` on macOS (a window opens: "Install", then "Agree"; it takes a few minutes), `winget install --id Git.Git -e` on Windows (if a permission window opens, the person accepts it; afterwards, close and reopen the terminal and Claude Code) or `sudo apt install git` on Linux, which the person pastes in their own terminal.
4. With their yes, `git clone https://github.com/CamiloRincon96/creator-os "<folder>"`: "Done: your folder is at `<full path>`."
5. The commands load when the agent opens in that folder. When it opens, Claude Code asks several questions: beforehand, in **a single message**, tell them which ones they'll see, whether each is free or paid, and what to answer:
   > Open the Terminal app (on Windows, PowerShell) and paste `cd "<folder>"`, Enter; then `claude`, Enter.
   > When it opens, Claude Code asks you a few questions. Here's what you'll see and what to answer:
   > - **Do you trust this folder?** Yes: that's how the `/creator-…` commands load.
   > - **A few plugin marketplaces and their plugins** (instagram-agent, last30days, marketingskills and HyperFrames): accept them. They're free: scripts and copy, ideas, strategy and animations.
   > - **The "aftereffects" and "higgsfield" MCP servers:** say no, unless you already pay for After Effects (the Adobe subscription) or Higgsfield credits. Both are paid and can be turned on later.
   > When you see the chat, type `/creator-start` and we'll continue.

   In VS Code or the desktop app: open the folder and start a session there; the questions and the answers are the same. Then `/creator-start`.

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

`python3 production/install.py --check` answers in sections ("Ready", "To install", "Needs the person's permission", "Failed", "Good to know"). Don't paste the raw output: a short table with each item and what it does ("Node.js, which runs Montage and the animations"), required or optional, and ✓ ready or ✗ missing. Close with one line: what's missing and that you'll now ask whether to install it. If nothing is missing, say so and skip to step 3.
- **"To install"** is what goes inside the repo and isn't there yet: it gets installed in step 2, without asking. On a freshly downloaded repo that's normal.
- **"Failed"** is a real error: say it as in "If something fails", below.

The required items are in `GETTING-STARTED.md` §1:
- git;
- on macOS, Homebrew, to install whatever is missing;
- Node 22.12 or newer (the version `montage/package.json` asks for);
- Python 3.10 or newer;
- ffmpeg 7 or newer (Montage needs it to export);
- Chrome is optional: Remotion downloads its own browser;
- about 6 GB free: Whisper, the transcription model, takes 2.9 GB.

On Linux, secret-tool is optional: it's only needed to keep the networks' keys (`sudo apt install libsecret-tools`, free).

## 2. Install the required items

1. **System programs that are missing** (git, Node, Python, ffmpeg, Chrome):
   - One question, "Should I install what your computer is missing?", with each missing program and its text from `GUIDING.md` ("What the computer is missing"), and its options: "Install everything (Recommended)", "One by one" and "Not now".
   - Before each one: what it is, where it comes from (Homebrew, winget or the package manager) and that it's free. The command is the one `install.py` gives for their system.
   - If it asks for a password (Homebrew on macOS, `sudo` on Linux), the person runs it. One message:
     > Open the Terminal app (on a Mac: Cmd + Space, type "Terminal", Enter) and paste: `<command>`.
     > It asks for your computer's password: nothing shows while you type it, that's normal. If it asks you to press Enter to continue, press it.
     > It's done when the typing line comes back; if "Next steps" shows up with commands first, paste those too.
     > Tell me "done". If an error shows up, copy it to me or send me a screenshot.
   - **On macOS without Homebrew, Homebrew goes first** (free). The person runs it, with the message above and the command `install.py` gives. When it finishes: "Close Claude Code, open it again in this folder and type `/creator-start`: until then it doesn't see Homebrew." Continue from step 1.
   - On Windows, if a permission window opens, the person accepts it. When it finishes: "Close Claude Code and the terminal, open them again in this folder and type `/creator-start`: that way your computer sees the new programs." Continue from step 1.
   - If they say "Not now": say in one line what won't work (the "without it…" in `GUIDING.md`) and go on with what can be done.
2. **What goes inside the repo** (the "To install" section). Before: "Now I'm getting your computer ready to edit: I install what's missing inside this folder and two sound skills in your Claude skills folder (about 5 minutes). It doesn't touch anything else on your system." Then `python3 production/install.py`.
3. **Whisper, its own question:** "Should I download Whisper now, the one that turns your voice into text on your computer, without uploading it?"
   - **Now (Recommended):** your first reel won't wait for the download. Free; it's 2.9 GB and takes as long as your internet needs.
   - **Later:** it downloads itself the first time it's needed, when your first voice gets cut.

   With their yes: `python3 production/install.py --with-whisper`.
4. **Montage.** Before: "Now I'm installing Montage, the editor where you review your videos and leave notes on the exact frame (a few minutes). Free." Then `cd montage && npm run install-app`, or the `creator-install-montage` skill. Afterwards, where it is: on macOS, the Montage app in `~/Applications`; on Windows, the "Montage" shortcut on the Desktop and in the Start menu; on Linux, the applications menu.
5. At the end, run `install.py --check` again: every required item "ready". Say it like this: "Done: your computer can make videos now. Next, we build your first brand."

**If something fails:** what happened, in plain words (never the raw error alone); why, if you know; and one step to fix it. Don't repeat the same command hoping for a different result.

## 3. The first brand

It comes before the optional tools: every network and every key belongs to a brand, so theirs has to exist first.

Before: "Now we'll build your first brand: who it's for, what it talks about and which accounts. It's a few questions; if you have your product's website or repository, keep it handy." Follow `/creator-brand` (new brand), starting from the repo or the website of their product. When it's done, come back here, to step 4, with the brand's name.

## 4. The optional tools, in a single call

Before: "Now you pick the optional tools. The free ones save you work; the paid ones are always quoted before spending. Whatever you don't pick today you can turn on whenever you want: just ask me."

**What was already asked when the folder opened doesn't get asked again as if it were new.** Claude Code offered the plugins (instagram-agent, last30days, marketingskills and HyperFrames) and the MCP servers (After Effects and Higgsfield) when the folder was trusted. Check in `install.py --check` which ones are there and say it in one line: "When you opened the folder you already chose: instagram-agent, last30days… are in." If one that would help them is missing, offer it once, saying they already saw it: "When you opened the folder, HyperFrames didn't get installed; if you want it now, it's free."

A single AskUserQuestion call, multiple choice: one question per group, each option with its name in `label` and its text from `GUIDING.md` in `description` (what it's for · where · what it costs):
1. "Where do you want to post <brand>'s videos and measure how they do?": Instagram, Facebook, YouTube and TikTok. All free; connected with `/creator-connect`, for the brand from step 3.
2. "Do you also want to see TikTok and Instagram when looking for ideas?" (only if last30days is in): the ScrapeCreators key, with its cost (below), or "Not now", which searches YouTube, Reddit and the web.
3. "What do you want to use to improve your voice?": only what's in the repo (Recommended), Adobe Podcast and ElevenLabs.
4. "What else do you want to animate and fix the picture?": Remotion skills, and only what didn't get turned on when the folder opened (HyperFrames, After Effects, Higgsfield), saying they already saw it. After Effects and Higgsfield are paid: each option says so.

Codex (reference photos) and CapCut retouching don't go here: they're offered in each piece, at stage 0 of `/creator-reel`, with their cost.

With what they pick, one thing at a time. Before each one: what you're turning on and whether the person has to do something. Afterwards: "Done: <what's set up>. Next: <what's next>."

- **The networks (Instagram, Facebook, YouTube, TikTok):** follow the `creator-connect` skill (`/creator-connect`) with the brand from step 3, which opens each official page, says what to click and checks each step. Before: "We'll connect them one by one; Instagram takes about 25 minutes." Instagram, in short (`production/INSTAGRAM.md`): the Meta app; the system user; the token, which the creator saves in their own terminal with `python3 production/tools/save_token.py <brand>` (on Windows, `python …` in PowerShell) and goes in the Keychain, the Credential Manager or secret-tool; `instagram.py connect <brand>`; and the watcher (`instagram.py watcher install`). The creator accepts the policies and types the passwords themselves.
- **The plugins** (last30days, instagram-agent, marketingskills and HyperFrames) are already declared in `.claude/settings.json`, and Claude Code offered them when the folder was trusted. If one didn't get installed and they want it now, `claude plugin install <name>` with the name from that file (HyperFrames: `claude plugin install hyperframes@claude-plugins-official`), or the equivalent for their agent.
- **last30days, the ScrapeCreators key** (for TikTok and Instagram). What it costs (checked on 17 Nov 2026): free to start, with 100 credits when you sign up, no card, and up to 1,200 more you can claim from its dashboard; for almost everything, one credit is one request. After that, paid: from US$47 for 25,000 credits, which never expire. Two steps for the person, one per message:
  1. > Open scrapecreators.com, create your account and copy your key (API key). Don't paste it here. When you've copied it, tell me "done".
  2. > Open the Terminal app (on Windows, PowerShell or Windows Terminal) and paste `cd "<repo folder>"`, Enter. Then paste `python3 production/tools/save_token.py --scrapecreators` (on Windows, `python …`), Enter.
     > It asks you to paste the key: nothing shows while you paste, that's normal. Press Enter.
     > If it says "Saved in …", tell me "done".

  On macOS it goes in the Keychain. On Linux, in pass, if they use it. Otherwise, and on Windows, in `~/.config/last30days/.env`, an unencrypted file in their user folder: last30days doesn't read the Credential Manager or secret-tool. Say it that way, without calling it a secure store.
  - You set the safe configuration yourself in `~/.config/last30days/.env`. First, one line: "I'm putting last30days in safe mode: I write its configuration file in your user folder so it doesn't use your browser's cookies." Add these lines without deleting or showing the key's line: `BROWSER_CONSENT=false`, `FROM_BROWSER=off`, `INCLUDE_SOURCES=tiktok,instagram,youtube_comments,tiktok_comments,instagram_comments`, `LAST30DAYS_MEMORY_DIR=`.
  - `yt-dlp`, the one that downloads videos: last30days uses it for YouTube, and it downloads the references they send. Free; ask first, because it installs on the system: `brew install yt-dlp` (macOS), `winget install --id yt-dlp.yt-dlp -e` (Windows) or `uv tool install yt-dlp` (any system).
- **Remotion skills:** `npx skills add remotion-dev/skills`.
- **After Effects** (paid: their Adobe subscription). Claude Code already asked about its MCP server (`.mcp.json`) when the folder opened. If they said no and want it now: `claude mcp reset-project-choices` in their terminal, and Claude Code asks again the next time it opens. One step for the person:
  > In After Effects, open Preferences (on a Mac, After Effects → Settings) → Scripting & Expressions, and check "Allow Scripts to Write Files and Access Network". Tell me "done".
- **Higgsfield** (paid, by credits). Claude Code already asked about its MCP server when the folder opened (if they said no: same as After Effects); the first time it asks for its login, which the person types. Never used without an approved quote.
- **ElevenLabs** (paid, with a free plan of a few minutes a month). One step for the person:
  > On claude.ai, open Settings → Connectors, find ElevenLabs and connect it with your account. Tell me "done".

  Every use is announced before any audio is uploaded.
- **Adobe Podcast** (free with an Adobe account). It's used with their own session in Chrome and Claude in Chrome:
  > Open Chrome, go to podcast.adobe.com and sign in with your Adobe account. Tell me "done".

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
