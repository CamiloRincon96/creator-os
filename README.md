<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/logo-dark.png">
    <img src="docs/logo-light.png" alt="Dirac Core" width="340">
  </picture>
</p>

# Creator OS

[![tests](https://github.com/CamiloRincon96/creator-os/actions/workflows/tests.yml/badge.svg)](https://github.com/CamiloRincon96/creator-os/actions/workflows/tests.yml)

**by Dirac Core** · **Your AI content team for growing on social media.** An open system for Claude Code, Codex, Gemini or Grok: it decides what to post, produces reels at editor quality and learns from your metrics.

A system so your AI helps you **grow on social media**: decide what to post, produce reels at editor quality (voice-based cuts, word-by-word captions, motion graphics, measured sound), test variations and learn from your own metrics. It is built to work **in stages, with your approval at each one**: the AI prepares, you decide.

It works with agents that read and edit files and run commands on your computer: **Claude Code**, **Codex CLI** (ChatGPT), **Gemini CLI**, **Grok CLI** or any other that reads `AGENTS.md`. With a chat-only AI (ChatGPT or Claude in the browser) it works as a guide, but it can't produce the videos.

**macOS, Windows 10/11 and Linux.** It works the same on all three. Every change is tested on the three systems by GitHub Actions ([`.github/workflows/tests.yml`](.github/workflows/tests.yml)): the install, every tool, the secret store, the hourly metrics task, Montage and the Remotion kit.

**Use it in your language.** The repo is in English, but the AI talks to you, asks you things and walks you through every setup step (logins, connections, approvals) in whatever language you write to it in.


![Creator OS: a glass phone playing a reel, surrounded by its team: the cut, the sound, the reviewer's check and your stars](docs/ill-hero.webp)

**The step-by-step guide, illustrated** (Español / English): **[diraccore.com/creator-os](https://diraccore.com/creator-os)**. It walks you through the four phases, with the exact thing to paste at every step.

## Four phases, one step at a time

1. **Install it** (once). Paste one message to Claude Code and it installs the plugin for you (below).
2. **Set up your brand** (once). `/creator-start` gets your computer ready, `/creator-brand` finds what you really talk about and to whom, `/creator-connect` links your networks when you want to publish.
3. **Make your reel** (every reel). `/creator-ideas` brings ideas with their hook, `/creator-reel` writes the script, cuts, animates and adds sound, you review in Montage (`/creator-montage`, `/creator-notes`) and it publishes only what you approved.
4. **Grow** (every week). `/creator-pulse` reads how each post did and writes down your own style; next week's ideas start from there.

Lost at any point? Ask your AI "what's next?": it knows where you are and tells you the next step.

**Nothing reaches you half done.** Every version passes a quality lock: the stage's tools are checked by what they leave in the piece, the whole video is reviewed frame by frame, and an independent reviewer (a second AI that didn't make it) scores it from 1 to 10. Nothing under 8 reaches you; you add your stars, and every hour it compares the reviewer and you with how the audience actually watched. **Automatic checks** (Claude Code hooks in `.claude/settings.json`) make sure no step gets skipped: a turn can't end with a video left unreviewed, a stage without your approval recorded or a correction without its lesson.

## What's inside

| Command (skill) | What it's for |
|---|---|
| `/creator-start` | The first time: checks your computer, tells you what's required and what's optional, and sets it up step by step |
| `/creator-brand` | Create or edit a brand: its real niche (from your product's repo or website), its tone and its content wheel |
| `/creator-connect` | Connect Instagram, Facebook, YouTube and TikTok step by step, with the official page for each step; keys go to your system's secure store |
| `/creator-ideas` | What to post: researches what's trending in your niche this week and crosses it with your metrics. It proposes ideas by network and format (reel, story, carousel) and you iterate together |
| `/creator-reel` | Produce a reel in stages: script, voice cut, voice, visual script, animation (Remotion), sound, review and variations. It has an **express mode** for the daily reel from a voice note |
| `/creator-pulse` | How it's going: metrics for everything you've posted (stories too), the card for each reel and your **own style**, drawn from what worked |
| `/creator-notes`, `/creator-montage` | Review in **Montage**, the repo's local editor: you draw on the frame, write the note and the AI fixes it |

Python and Node tools live in `production/tools/`. Among others:
- a voice cut that never splits a word;
- local transcription (Whisper);
- variations with 540p drafts;
- automatic check that nothing covers the face, and an automatic cover;
- posting through the official APIs: Instagram, Facebook and YouTube, plus TikTok drafts you finish on your phone;
- the metrics watcher.

## Getting started

**What you need:** Claude Code, which comes with a Claude plan. Pro is US$20 a month, or US$17 billed yearly; the free plan doesn't include it ([claude.com/pricing](https://claude.com/pricing), checked Nov 17, 2026). Other AI apps can read the repo (see below), without the plugin or its automatic checks.

**In Claude Code you only install one plugin, and Claude Code installs it for you.** Open Claude Code and paste this message:

```
Install the Creator OS plugin: run claude plugin marketplace add CamiloRincon96/creator-os and then claude plugin install creator-os@creator-os. If the claude command doesn't work here, tell me to type /plugin marketplace add CamiloRincon96/creator-os and /plugin install creator-os@creator-os myself
```

Then open a **new chat** (a freshly installed plugin shows up there) and type **`/creator-os:start`**. It asks where to put the folder, clones the repo with your yes, gets your computer ready (asking before installing anything) and hands over to `/creator-start`.

Already know how to install plugins? Paste these yourself, one at a time, and then `/creator-os:start`:

```
/plugin marketplace add CamiloRincon96/creator-os
/plugin install creator-os@creator-os
```

**With any other agent (or if you'd rather do it by hand):**

1. Clone this repo and open it with your agent (for example, `claude` in the folder).
2. Type **`/creator-start`**, or ask it to "read `GETTING-STARTED.md` and walk me through it". It takes you step by step.
3. Create your brand with **`/creator-brand`** and plan the week with **`/creator-ideas`**.

**On Windows:** type `python` where the docs say `python3`, close and reopen the terminal and Claude Code after any `winget install`, and keep the repo out of OneDrive (for example `C:\Users\<you>\creator-os`). Details in [`GETTING-STARTED.md`](GETTING-STARTED.md#on-windows).

**You don't need to know how to code.** Ask your AI to walk you through the installation and to explain what each command does before it runs it. The skills come with the repo: in Claude Code they show up as the `/creator-…` commands, and Codex, Gemini and Grok find them through `AGENTS.md`. Nothing gets installed or paid for without your yes.

What's required and what's optional, in detail: [`GETTING-STARTED.md`](GETTING-STARTED.md). The folder map: [`MAP.md`](MAP.md).

## Montage, the review editor

Every video, image or carousel the AI makes lands in Montage as a new version (`/creator-montage`). It runs on your computer: nothing gets uploaded anywhere.

**1. Point at the exact frame.** Pause, draw a box, arrow or pin over what you want changed, pick the kind (change, add, remove, fix, idea) and write it. *Send to Claude* sends all your notes at once.

![Montage: a reel paused on its first frame, a red box over the words "2 hours" and a note being written](docs/montage-1-note.jpg)

**2. The AI answers with a new version.** Type `/creator-notes` in your AI: it takes each change one by one, replies to the note with its plan, makes it and publishes v2, marking what it fixed. You approve or reopen. The star marks the FINAL, and only you can mark it.

![Montage: v2 resolved the note, the AI replied with its plan, with Approve and Reopen buttons](docs/montage-2-versions.jpg)

**3. See it on every network.** The same piece inside Reels, TikTok, Shorts, Stories, the feed and the profile grid, so you see what gets covered and cropped before posting.

![Montage social view: the reel inside eight phone mockups for Instagram, TikTok, YouTube and Facebook](docs/montage-3-social.jpg)

## Principles

- **Every stage ends in something you see or hear and approve.** Nothing is posted without your explicit approval.
- **The AI can't hear:** sound is measured (LUFS, intelligibility) and you approve it by ear.
- **Nothing paid without a quote.** After Effects, Higgsfield and ElevenLabs are optional and are never used without asking you.
- **Keys and tokens never go in the repo or in the chat.** You save them yourself in your system's secure store (macOS Keychain, Windows Credential Manager, secret-tool on Linux) or in environment variables. One exception: on Windows, and on Linux without `pass`, the ScrapeCreators key goes in an unencrypted file in your user folder (`~/.config/last30days/.env`): on those systems it's the only place last30days reads it from.
- **Music only with a verified license:** CC0 with its credit. Commercial songs never go inside the file.
- **A quality floor for every reel** (`production/REELS-QUALITY.md`): real material instead of invented screens, the thing itself instead of symbols, something happening every second. Your identity changes the look (colors, type, panels), never the floor.
- What goes wrong is written down in `production/LESSONS.md` so it doesn't happen again.

## License

MIT (see `LICENSE`). The sounds in `brands/example/sounds/` are CC0 and come with their credits. Remotion has its own license: it is free for individuals and for companies of up to 3 employees ([terms](https://www.remotion.dev/license)).

## Found it useful?

We'd appreciate your ⭐ on GitHub, the like of repos: it helps more creators find Creator OS.

**[Star Creator OS on GitHub](https://github.com/CamiloRincon96/creator-os)** · by Dirac Core
