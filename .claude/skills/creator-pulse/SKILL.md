---
name: creator-pulse
description: Reads how each account is doing and learns each brand's own style from what it has already published. It gathers the metrics of reels, posts and stories, builds the card of each piece (hook in the first 3 s, pace, loudness, first sentence), crosses them with shares, saves and skip rate relative to reach, and proposes what to repeat, what to drop and what to try. It maintains each brand's OWN-STYLE.md and feeds /creator-ideas and /creator-reel. Use it when the creator says "how are we doing", "what worked", "metrics", "analyze my style", "the pulse", types "/creator-pulse", or every Monday before planning the week with /creator-ideas. It also responds when the user writes the same in another language.
---

# Pulse: how we are doing and what we learned

Speak the person's language: every question, instruction (log in here, paste this, click that), approval request and summary goes in the language they write to you in; translate tool messages when you relay them. Commands, code and file names stay in English.

It closes the loop: `/creator-brand` defines what is talked about, `/creator-ideas` decides what to publish, `/creator-reel` produces it and **`/creator-pulse` says what worked** so the other three get better. Run it once a week (on Mondays) or whenever the creator wants.

**Rules:**
- Judge **relative to reach**, never by views alone. In order: shares, new followers, saves and the % that skip the first 3 s.
- **A style rule only goes in if it shows up in 2 or more pieces and has data behind it.** Something that happened once is a hint, not a rule.
- Colors, timings and figures **are measured**, not assumed.
- Nothing in `OWN-STYLE.md`, `NICHE.md` or `LEARNED.md` changes without the creator's yes. The proposal goes in the chat first.
- With few pieces (fewer than 6 of a type), say that the reading is weak.

## 1. Gather (no Claude needed, the Mac already does it)

- The Mac's watcher (`instagram.py watcher`, every hour) runs `pulse.py collect` for each connected account. It saves a snapshot of the metrics in each age bucket, **stories every hour while they are live** (their metrics disappear after 24 h) and the day's followers.
- At the start: `python3 production/tools/pulse.py collect <brand>`, to bring in the latest.
- Then: `production/.venv/bin/python production/tools/pulse.py cards <brand>`. It downloads each new reel and measures:
  - duration;
  - cuts per minute;
  - LUFS;
  - the hook sheet (first 3 s);
  - the first sentence and the second at which it is said;
  - words per second.

## 2. Look

1. Run `python3 production/tools/pulse.py report <brand> --days 28`: the tables by type, with the account's medians.
2. Read with Read the **hook sheet** of the 2 or 3 best and the 2 or 3 worst of each type. It is in `card.hook_sheet`, in the cache.
3. **Tag what you judge:** `pulse.py tag <brand> <id> --role <shareable|useful|connection|product> --topic "…" --hook "<type: pain, belief, figure, question, demo…>" --format "<on-camera, animated, mixed, carousel…>"`. That way it is already there next time.
4. To read the why behind a specific reel, `instagram-agent:ig-audit`.

## 3. Conclude (in the chat)

In 6 to 10 lines, with numbers:
- **what worked and why**, compared with the account's median;
- **what did not**;
- **the wheel:** how much was published of each role, against the weights in `NICHE.md`;
- **followers:** from how many to how many, and which pieces line up with the jumps;
- **stories:** average reach, exits and replies;
- **cadence:** how much was published against the plan (`production/DISTRIBUTION.md`).

Then, **3 things for next week**: one to repeat, one to stop doing and one to try. They go to `/creator-ideas`.

## 4. Own style (`brands/<brand>/OWN-STYLE.md`)

It is the brand's style guide **drawn from what the brand itself published and how it did**. It does not come from role models. With the creator's yes, it is created or updated with this shape:

```markdown
# Own style of <brand>
Drawn from <n> pieces published between <date> and <date> (pulse). Each rule says which pieces it comes from.

## Essence
<One sentence and 3 to 5 words.>

## What works (seen in 2 or more pieces, with data)
- **Hook:** <rule> — pieces: <ids/dates> · <share% or skip% vs. the median>
- **Pace:** <cuts per minute that work, duration>
- **Captions and on-screen text:** <measured>
- **Color and graphics:** <measured hex values>
- **Sound:** <LUFS, music yes/no>
- **Structure and call to action:** <…>

## What does not work
- <rule> — pieces: <…>

## Hints (a single piece, to be confirmed)
- <…>

## History
- <date>: <what changed and why>
```

**For the first version, or when there are fewer than 6 pieces**, you can add an analysis of role models:
- The creator passes ~5 videos from accounts they like; download them with `uvx yt-dlp` to `production/references/videos/`, only to study them, never to publish them.
- For each one, measure the hook in the first 3 s, the cuts per minute, the captions (font or the closest free one, size, position, animation), the palette in hex, the sound, the framing and the structure.
- To study a role model frame by frame, `hyperframes:reverse-any-video` helps.
- What comes from role models is marked "from role models", separate from what came out of the brand's own metrics. When the brand's own metrics contradict it, its own metrics win.

## 5. Feed the other commands

- `/creator-ideas` reads `OWN-STYLE.md` and the 3 things for the week.
- `/creator-reel` reads it in stage 5 (visual script) and stage 7 (animation).
- What is confirmed in two readings in a row moves up to "What has already worked" in `NICHE.md`, with the creator's yes.
- Variation batches stay in `production/variations/LEARNED.md`.

## How it gets refined

If a metric never changes a decision, remove it from the report. If one is missing that would have changed something (for example, followers per piece, once Meta provides it for reels), add it to `pulse.py`.
