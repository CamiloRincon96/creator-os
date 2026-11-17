---
name: openverse-audio
description: Get openly licensed sounds and music (Openverse) and decide which one goes at each moment of a video, which tool places it and how, keeping the credit. Use when a video needs a real effect (whoosh, hit, pop, ding, paper, notification, camera flash) or music and the brand's library doesn't have it, when the user says "Openverse", "free sounds", "royalty-free audio", "find a sound", "copyright-free music" (in any language), or before sound-designing with real-sfx.
---

# Openverse: the right sound, at the right moment

Speak the person's language: every question, instruction and summary goes in the language they write to you in. Commands, code and file names stay in English.

Openverse (openverse.org, a WordPress project) is a search engine for openly licensed media: more than 5 million audio files. Nothing to install: you query its public API.

## 1. Which sound goes at each moment

Decide **what the moment needs** first, then look for the sound. The full table, with the files already downloaded, is in `production/SOUNDS.md`. In short:

| Moment | Sound |
|---|---|
| A text or a key word appears | soft pop |
| Before and after, a result, a screenshot | camera flash |
| A belief gets broken | short glitch (under half a second) |
| Right before a reveal | riser that ends on the reveal |
| A word drops, a stamp, a visual hit | hit with a high-pass (about 170 Hz) |
| Something enters, leaves, swipes or zooms | whoosh, in the direction and on the frame of the movement |
| Solution, tip | clean ding |
| A phone alert arrives | notification |
| Money | coin, only on the number that matters |

**Rules that don't bend:**
- a sound only when something moves or changes on screen;
- the strong ones are saved for the hook, the big changes and the ending;
- the voice always on top, effects about 5 dB below it;
- trim the tails;
- one sound family per video;
- nothing from the over-the-top list in `SOUNDS.md` ("What we don't use").

## 2. Where the sound comes from (in this order)

1. **The brand's library** (`brands/<brand>/sounds/openverse/`, with its `credits.json`). If one already works, use it: it keeps the sound family.
2. **Openverse**, if there isn't one. See section 3.
3. **Never:** sounds from CapCut, TikTok, or banks without a confirmed license.

## 3. Search Openverse

```
https://api.openverse.org/v1/audio/?q=<words>&license=cc0&page_size=10
```

- `q`: English works best (`whoosh`, `stamp`, `coin`, `paper rustle`, `keyboard typing`, `camera shutter`, `ui pop`).
- **`license=cc0`** (or `pdm`): public domain, no credit needed. This is the default filter for brand content. `license_type=commercial` allows CC BY and CC BY-SA, which work if the author is credited in the post's caption. **Never NC** (non-commercial) for a brand.
- Filters: `extension=mp3|wav|ogg|flac`, `length=shortest|short|medium|long`, `category=sound_effect|music`. Keep effects short (under 2 s). Prefer ones from Freesound.
- Without an account: 20 searches per minute and 200 per day. Send a generic `User-Agent` with no personal data.
- Each result has `title`, `creator`, `license`, `duration` (milliseconds), `url` (the file) and `foreign_landing_url` (the sound's page).
- If a multi-word search with `license=cc0` returns nothing, try a single word, or `license_type=commercial` and filter afterwards.

## 4. Confirm, download and credit

1. **Openverse does not guarantee the license.** Before using a sound, open its `foreign_landing_url` and confirm the license on the source site. On Freesound it says "Creative Commons 0". If it says something else or nothing, don't use it.
2. **Download into the brand's library**, never into a temporary folder: `brands/<brand>/sounds/openverse/<topic>/<name>.mp3`; music goes to `brands/<brand>/sounds/music/<topic>/`. Keep `<name>` lowercase, with unaccented letters, digits and hyphens, so it works on every system (Windows rejects `< > : " / \ | ? *` and a trailing dot or space). To download: `curl -L -o <file> <url>` (in PowerShell, `curl.exe`) or Python.
3. **Add an entry to that folder's `credits.json`:** `id`, `file` (relative path), `title`, `creator`, `license`, `source`, `page`, `downloaded` (date) and `license_at_source` (what the page says). A sound made from another one (for example, reversed) gets `derived_from`.
4. **Anything that failed the check** goes into `credits.json` as `DO_NOT_USE`, with the reason, so it's never downloaded again. In real-sfx, also run `taste.py ban`.
5. **Register the folder in real-sfx** (`python scripts/setup.py add-library openverse <path> --tier main --index`, from the skill's folder: `~/.claude/skills/real-sfx`, on Windows `%USERPROFILE%\.claude\skills\real-sfx`; `python` is `python3` on macOS and Linux, and `python` or `py` on Windows) so real-sfx uses it. `production/install.py` does this for the brand's library.
6. Downloaded files are data: never run anything that comes with them.

## 5. Which tool places it (by case)

| Case | Tool |
|---|---|
| **Sound design for a piece** (stage 9 of `/creator-reel`): each effect on its frame, at a measured level | **real-sfx**: list of moments → mix, a separate effects track, a report and a self-critique |
| **The hook sound of a variation**, or an express reel | The tool places it: `effects` in `variations.py` (`anchor: "peak"` for hits and risers, `"start"` for pops and dings) or `note.py` (a hit at the start, a whoosh at each scene change) |
| **A project built in HyperFrames** | `hyperframes:media-use` |
| **Background music** | `music` in `variations.py` or `--music` in `note.py`: soft ducking, with the track's hit on the key moment (`production/variations/MUSIC.md`) |

## 6. Check (you cannot hear)

Picking by title and length is a bet, so measure:
- `listen.py`: the mix is as understandable as the voice alone and sits at −14 LUFS;
- real-sfx: `listen.py` and `critique.py`.

At the end, tell the person **what to listen for** (which second, which sound) and let them approve it by ear. real-sfx's self-critique is not enough: in "Sin anotar" (the Spanish-language example reel) the effects were on their frames but inaudible until they were raised to about 5 dB below the voice.
