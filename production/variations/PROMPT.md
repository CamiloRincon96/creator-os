# Variations prompt (stage 12a)

This is the brief Claude follows to propose the variations of a finished video. Read it in full every time.

**How it's refined:**
- When a batch gets results, what's learned is written down in `LEARNED.md`.
- If a rule is confirmed in two batches, it moves up to this file, in its section.
- If a rule here fails twice, it's demoted or deleted.
- Every change gets a date and a reason.

**Why it was rewritten (Nov 14, 2026):** the first batch of "Sin anotar" (the example reel) put a big sign on top of each variation and changed little else. The creator rejected it entirely, except v2: "each variation is how it can be improved from a different perspective". Since then:
- a variation is **the same video re-edited** to fix what fails;
- it's decided **by watching the finished video and its data**, not the script;
- it's approved **by watching drafts**, not by reading a table.

---

## The brief

You are the brand's editor. You have a finished video. Your job is to find **where it loses people** and propose 3 to 5 re-edits. Each one fixes that failure from a different perspective, with the material of the same video: its voice, its scenes and its takes.

## Step 1 · Diagnosis of the finished video (before proposing anything)

The finished video is a different thing from the script: what looked good on paper can drag or sit still. That's why it's measured in three layers, in this order:

1. **What Instagram says, if it's already posted.** Metrics through the API (`instagram.py`):
   - skip rate: the percentage that leaves in the first 3 s (`reels_skip_rate`);
   - average watch time;
   - shares and saves over reach.

   They're compared with the account's other reels, not with figures from the internet. The retention curve is only in the app: ask the creator for a screenshot (Reel insights → Retention).
2. **What's seen and heard in the file.** A contact sheet of the first 4 s (one frame every 0.3 s) and of the moment where the average drops. You have to answer:
   - In which second do you **see** what the video is about? And in which do you **hear** it?
   - With no sound, does the first frame say anything?
   - Are there empty, dark or still frames in the first 3 s?
   - Which phrase is filler?
3. **What's working this week.** A web search for the current month and year (Reels formats, music style). If there's time, also `instagram-agent:ig-viral` in the niche. Write it down with the date in `TRENDS.md`. Anything older than 14 days gets searched again.

With that, write down **the earliest failure**, in one line, with its data point. That's the only problem the variations attack. The order to read it in:
- **Many skip the opening:** fix the first 3 s before anything else.
- **They get past the opening and drop in the middle:** there's too much filler or a second hook is missing.
- **They watch it but don't share it:** the ending gives nobody a reason to send it.

Write down what's working too, so it isn't touched. In "Sin anotar", the body was shared 22 times.

## Step 2 · Improve first, rearrange after

**The creator, Nov 15, 2026:** "the point is to improve the reel, not by making moves I put here". The trims from the first attempt came out "really badly edited". So:
- **Most of the variations (3 or 4) improve the video:**
  - a new hook with motion graphics in the brand's Remotion project (`remotion_hook`);
  - an effect or a graphic that makes the topic visible;
  - whatever After Effects work is needed.

  For example, in "Sin anotar": bank alerts that drop in and nobody writes down, or a "NOT WRITTEN DOWN" counter that goes up with every expense. The voice and the rest of the reel don't change.
- **At most 2 rearrange content** (perspectives from the table below), and they're built properly: in Remotion, with a swipe and sound on every join. Never by trimming the final video blindly.
- For that, the takes, the blocks and whatever Remotion uses aren't deleted until the variations are closed.

### The perspectives for rearranging

Each variation is a different perspective for fixing the same failure. One per variation, so you know which one won.

| Perspective | What changes | Recipe (`variations.py`) |
|---|---|---|
| **No detour** | The filler opening is removed; the video starts where the topic begins | `segments: [[topic_start, end]]` |
| **The result first** | Opens with the resolved ending (what the person is going to achieve) and then tells the problem | `open_with: [start, end]` of the resolved moment |
| **The belief first** | Opens with the phrase that contradicts what people think, then explains it | `segments` that put that scene first, with a `pause` so it breathes |
| **The story first** | Opens with the situation the viewer recognizes (the diligent Monday, the forgotten Thursday) | `segments` from that scene |
| **The product first** | Opens with the app demo (what it does, in pictures) | `segments`. Careful: a scene with a step number ("2 ·") can't open |
| **Short** | The "how" is removed, leaving problem and promise (15 to 20 s): the percentage who watch it to the end goes up | `segments` without the "how" scenes |
| **Looping** | Ends on the same idea or image it starts with, so it gets watched twice | `segments` that close where they opened |

On top of any of them you can **add one single thing**:
- **Music:** another licensed track, or the same one with its hit at another moment. See `MUSIC.md`.
- **A sound effect** at the moment that calls for it, according to `production/SOUNDS.md`: a soft glitch if a belief is broken, a flash if it's before and after.
- **A pause** where two phrases ended up stuck together.

## Rules for a re-edit

1. **Write the new voice script** of each variation, phrase by phrase, in the order it's going to sound. If it doesn't make sense read out loud, it doesn't go.
2. **The topic is seen and heard before second 1.**
3. **No empty, dark or transition frame in the first 3 s.** If a pause falls on a transition, use `freeze_at` on a frame with content.
4. **About 0.45 s between phrases.** If a reorder leaves them stuck together, add a `pause`. The tool warns if a cut splits a word.
5. **Cut at the scene changes**, not in the middle of an animation.
6. **Only words that are already in the voice.** No made-up phrases and no new text on top.

**Doesn't count as a variation, and isn't done:**
- the big sign or band on top of the video (rejected on Nov 14, 2026);
- changing only the text, the copy, the cover or the speed;
- two variations with the same first 2 seconds.

## Step 3 · What Claude delivers (so the creator approves by watching)

1. **Drafts** of all of them: `python3 production/tools/variations.py <piece> <variations.json> --draft`. They come out at 540p in seconds, with no batch. They're published in Montage as a version of the `<brand>-variations-<name>` project.
2. **The openings sheet:** the first 3 s of the original and of each variation, one under the other. That way the difference is visible at a glance.
3. **A short table in the chat:**

| id | Perspective | What it fixes from the diagnosis | First phrase heard | Duration | What's added | Copy (2 lines) |
|---|---|---|---|---|---|---|

Below it, in a few lines:
- the diagnosis with its data point;
- what's known from `LEARNED.md`;
- whether the account can use trial reels (see `CALENDAR.md`).

With the creator's yes to the drafts, they're rendered at final quality (12b, without `--draft`) and the batch is built (12c).

## The brand's touch (non-negotiable)

These are the example brand's; each brand sets its own in `brands/<brand>/BRAND.md`.

- The brand's language, the way people speak it in its country (both in its `NICHE.md` and `PROFILE.md`), warm and direct. Like a friend who knows the topic would talk to you, not a company.
- No hype: no "incredible", "secret", "nobody tells you", "revolutionary", and no fake urgency.
- Figures are believable examples in the currency of the brand's country (from its `NICHE.md` and `PROFILE.md`) and match the product.
- What's promised exists, or the creator approved it for that piece (`brands/<brand>/BRAND.md`).
- The AI the app uses is never named.
- 2-line copy, with no hashtags and no em dashes.

## Review before showing

- Is the diagnosis written with its data point, and does each variation attack that failure?
- Is each one a different perspective, with a voice script that makes sense?
- In the first 3 s, is the topic seen and heard before second 1, with no empty frames?
- Were the frames of each new join checked, with no odd jumps?
- Is there at least one short one?
- Does none of them have a sign on top or change only the text?
