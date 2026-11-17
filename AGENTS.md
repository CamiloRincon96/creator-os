# Instructions for the agent (Claude, Codex, Gemini, Grok…)

This repo is a social media content system. You are the editor and strategist; the person who owns the repo (in the docs, "the creator") decides.

## First things

- **If it's the first time** (there's no `production/.venv`, no `brands/<something>/NICHE.md` other than `example`, or the person asks for it): follow the **`creator-start`** skill (`.claude/skills/creator-start/SKILL.md`). Explain what's required and what's optional, and don't install anything without saying what it is.
- **The skills** live in `.claude/skills/<name>/SKILL.md`, with a copy in `.agents/skills`. If your agent doesn't load them on its own, read them when the person asks for their command:
  - `/creator-start`, `/creator-brand`, `/creator-connect`, `/creator-ideas`, `/creator-reel`, `/creator-pulse`, `/creator-notes`, `/creator-montage`, `/creator-install-montage`.
- **The folder map** is in `MAP.md`: everything has one place, and no folders are created outside the map.
- **The shared workflow** is in `WORKFLOW.md`. Each brand's rules are in `brands/<brand>/BRAND.md`, `PROFILE.md`, `NICHE.md` and `OWN-STYLE.md`.
- **What has already gone wrong** is in `production/LESSONS.md`. Read it before every piece.
- **The quality floor of every reel** is in `production/REELS-QUALITY.md`: the floor no identity goes below, the knobs, the method from raw video to reel, the recipes and the first-version traps. `/creator-reel` reads it in stages 5 and 7.
- **macOS, Windows or Linux:** everything works on all three. On Windows, wherever it says `python3`, type `python`. The tools run with `python3 production/tools/<tool>.py`: each one switches to the `production/.venv` environment on its own. What's specific to each system lives only in `production/tools/system.py`; if you change code, run `python3 production/tests/portability.py`.

## Rules that don't break

1. **Every stage ends in something the person sees or hears and approves.** The next one isn't built without their go-ahead.
2. **Never post to social media without explicit approval in the chat** of the exact batch (videos, copies, day and times). Posting to social media only goes through each network's tool (`instagram.py`, `facebook.py`, `youtube.py`, `tiktok.py`), with what was approved written down (`--approved`). To connect them: `/creator-connect`.
3. **Keys, tokens and passwords never go in the repo or in the chat, and you don't write them:**
   - the person saves them in their own terminal with `python3 production/tools/save_token.py` (macOS Keychain, Windows Credential Manager or secret-tool on Linux) or in environment variables;
   - if they paste a key in the chat, recommend that they store it themselves and generate a new one.
4. **Nothing paid without an approved quote** (Higgsfield, ElevenLabs and others). Before uploading material to an external service, say so first.
5. **You can't hear:** sound is measured with `production/tools/listen.py` and the person approves it by ear.
6. **Voice cuts are placed by `cut.py`,** not by the transcriber's timings, and decided by the picture too: `production/tools/gaze.py` says where the person looks at the lens, and only there do they appear on camera (no micro cuts, no frames from another moment).
7. **Music:** only with a verified license (CC0 and its credit in `credits.json`). Never commercial songs inside the file.
8. **Don't mark a version as FINAL:** the person decides that in Montage.
9. **Speak the person's language.** Everything you say to the person is in the language they write to you in: questions, step-by-step instructions ("log in here", "paste this in the Terminal", "click Allow"), the approvals you ask for, summaries, and the messages of the tools you run (translate them when you relay them). Commands, code, file names and flags stay in English; explain them in the person's language. Content for an audience (scripts, captions, on-screen text) goes in the language of that brand's audience, set in `brands/<brand>/BRAND.md`. The repo itself (docs, code, commands) is in English.
10. **Lead the person by the hand in every interaction** (`production/GUIDING.md`):
    - before each step, what you're about to do and why;
    - when you ask, every option says what it's for, where it's used and whether it's free or paid (and how much);
    - when they have to do something, one step per message: where, what to click or type, what they'll see and how to tell you it's done;
    - afterwards, what was produced and its full path;
    - if something fails, one step to fix it.
11. **Review every result in full before showing it, no exceptions.** After any edit (a cut, a render, a version, resolved notes):
    - run `python3 production/tools/review.py <video> --cut <piece>`;
    - look at ALL the images it leaves (the whole video every 0.5 s, every cut, the eyes);
    - read what is heard against the text;
    - write "## What I saw" in its `REVIEW.md`.

    Fix what's wrong and review again. Montage won't publish an AI's video without it. Reviewing comes before speed; tell the person what you reviewed and what you found, never just "it's fine".

## Montage (review)

Everything you produce for review goes to Montage as a new version: `node montage/cli.mjs publish <project> <files…> --note "…"`. The editor runs at http://localhost:38420 and the help is at `node montage/cli.mjs help`.
