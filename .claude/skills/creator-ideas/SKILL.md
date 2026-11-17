---
name: creator-ideas
description: The command for growing a brand's account in the repo, reaching more people and selling without everything being a sales pitch. It asks for the social network, the format (reel, story, carousel, post, series) and the piece's role in the content wheel (shareable, useful, connection or product). It researches what is buzzing in the brand's real niche with last30days (TikTok, Instagram, YouTube, Reddit, the web), adds what has already worked on the account and proposes ideas with a hook and evidence. It iterates with the creator without writing anything to the repo until they pick one. Use it when the creator says "what do we post", "ideas", "I want to grow", "brainstorm", "what reel/story do we make", types "/creator-ideas", or before /creator-reel without a clear idea. It also responds when the user writes the same in another language.
---

# Ideas: the command for growing

Speak the person's language: every question, instruction (log in here, paste this, click that), approval request and summary goes in the language they write to you in; translate tool messages when you relay them. Commands, code and file names stay in English.


The creator asked for it on 15 Nov 2026: "the ultimate command to grow my account, to sell, to post interesting content… not focusing only on selling… prioritizing content people share because they like it".

**Golden rule: while iterating, nothing is written to the repo.** The rounds live in the chat; drafts, sketches and research, in the session's scratchpad. Write only when the creator says "this one" (step 6).

**Always:**
- reply in the user's language; the content itself goes in the language of the brand's audience;
- in the brand's tone, nothing exaggerated;
- two-line copy, no hashtags;
- never name the AI the app uses.

## 0. Kickoff: three questions, with options (AskUserQuestion, in a single call)

1. **Brand:** the folders in `brands/`.
2. **Social network:** Instagram, TikTok, Facebook or YouTube Shorts.
3. **What they want to put out:** a reel, a story (or a sequence of stories), a carousel, a post, a series of several pieces, or "the whole week" (a plan of several pieces with their roles).

If the creator already said it in their message, do not ask again.

## 1. The brand's real niche (`brands/<brand>/NICHE.md`)

Read `NICHE.md`:
- who it is really for;
- what topics those people live with;
- what it is not;
- what the app does today;
- the **content wheel**;
- what has already worked.

Also read:
- the brand's `BRAND.md` and `PROFILE.md`;
- the brand's `OWN-STYLE.md` and the 3 things for the week from the last `/creator-pulse`;
- `production/DISTRIBUTION.md`: which account carries what, and at what pace;
- what is already in `ideas/`, so nothing repeats;
- `production/variations/LEARNED.md`.

**If the brand has no `NICHE.md`**, `/creator-brand` goes first, option C (or A if the brand is new). As a guide, the niche is built like this:
- with the product document from the app's repo (for example `PRODUCT.md`), its `PROFILE.md` and its metrics;
- with the shape of Example's;
- the real niche is not the generic category: it is not "financial education", it is "people who don't know where their money goes and live out of Nequi (a Colombian digital wallet)".

Show it to the creator and write it with their yes: it is a decision, not an iteration.

## 2. What is buzzing: last30days takes the lead

Three sources, in parallel, from this week and never from memory:

1. **`last30days`**, the skill installed as a plugin, with 2 or 3 searches on the topics in `NICHE.md`, in the language and country of the niche. For example, for Example (a Colombian personal-finance app), the searches are in Spanish:
   - «quincena Colombia» (payday);
   - «gastos hormiga» (small everyday leaks);
   - «no me alcanza la plata» (my money doesn't stretch);
   - «Nequi gastos» (Nequi spending);
   - «factura electrónica independientes DIAN» (e-invoicing for freelancers).

   It brings what people are watching and commenting on in TikTok, Instagram reels (with what they say), YouTube, Reddit and the web, ranked by real engagement. Use it with its safe configuration (`~/.config/last30days/.env`):
   - **it never reads browser cookies**;
   - it does not save reports to disk.

   TikTok and Instagram need the ScrapeCreators key saved (see "Set up"). If it is not there, run with YouTube, Reddit and the web, and say so.
2. **The account:** `python3 production/tools/instagram.py reels <brand> 10` brings views, reach, % that skip in 3 s, shares and saves. What won and why; to read it, `instagram-agent:ig-audit`.
3. **The calendar:** the dates of the coming week and month in the niche's country (bonuses, paydays, taxes, seasons).

Summarize in 5 to 8 lines: the topic, which format is moving it, and the source with its date. **What matters most is what the niche's people are sharing**, not what is trending in general.

## 3. Open up: 8 to 10 ideas, each with its role in the wheel

| # | Role | Idea in one sentence | Hook: what is heard or read and what is seen in the first second | Why they would share or save it | Evidence (step 2) | What needs to be made |
|---|---|---|---|---|---|---|

**Role** is shareable, useful, connection or product. The proportions in `NICHE.md` rule: most of them shareable; product, 1 or 2 out of 10 at most.

**First ask why someone would send it to another person.** If the answer is "because it's about the app", it is product, not shareable.

**By format:**
- **Reel:** the topic is seen and heard before second 1. "Sin anotar" (an earlier Spanish-language reel) lost 59% of viewers to a 2.7 s intro.
- **Story:** give the sequence frame by frame, with its stickers (poll, question, slider, link), following `instagram-agent:ig-story`. Stories are seen by followers: that is where connection and product go.
- **Carousel:** the cover that makes people swipe and one idea per slide (`instagram-agent:ig-carousel`). They are what gets saved the most.
- **Series:** the series name and the first 3 installments. Series give people a reason to follow the account.
- **The week:** at the pace in `DISTRIBUTION.md` (Example: one reel a day, 1 big one and the rest express, plus stories), each piece with its role, its account and whether it is a collaboration. For each one, what to record: a voice note or footage (`instagram-agent:ig-plan`).

**Tools for thinking better:**
- marketingskills, the installed plugin:
  - `social`: which format each network favors;
  - `content-strategy`: the pillars;
  - `marketing-psychology`: why people share and follow;
  - `marketing-ideas`;
- `instagram-agent:ig-reel` for hooks and their score;
- `instagram-agent:ig-viral` to see concrete reels from the niche with the creator's Chrome (Claude does not type passwords).

## 4. Iterate (as many rounds as the creator wants)

The creator answers however it comes out: "3 and 7", "more like 2", "combine 4 and 6", "another round", "wilder" or "simpler". In each round:
- change only what was asked and show the short table;
- say what you learned about their taste. For example, "you like the ones with a figure in pesos, not the trend ones".

**If an idea is visual**, show a cheap sketch before deciding: 3 to 5 frames in Remotion or a card, in the scratchpad. A visual idea is never approved from text alone.

## 5. Close the chosen one: a menu to build from, not a single version

The creator builds the piece by picking parts, not by correcting a single version round after round. They asked for it on 16 Nov 2026: "it gives a single call to action… several calls to action, several bodies… between 5 or 7 options every time you generate one". Show all of this at once, **5 to 7 options of each**, and again every time a single part is redone:

- **Hooks** (1, 2, 3…), each with its first second, or the cover if it is a carousel.
- **Bodies** (A, B, C…): different ways of telling the middle, in the creator's voice (`instagram-agent:ig-human`), with what is seen in each part. For example:
  - the steps, said out loud;
  - a single take that transforms step by step;
  - what the person does versus what the tool does.
- **Calls to action** (I, II, III…), the kind used today:
  - one that asks for nothing: "I'm not going to ask you to follow me…";
  - one that invites people in and really shapes what comes next: "tell me what… and that's the next thing I make";
  - a reveal at the end;
  - an ending that loops back to the hook;
  - the pinned comment;
  - the community one: "if you improve it, it belongs to everyone";
  - a line that sticks and gets it saved without saying so.

  Never "like this", "comment X" or "if you know someone who…": they sounded two years old to the creator. On TikTok those calls also count as engagement bait and lower the video's reach.
- The creator answers with something like "2 + B + III".
- **The piece carries one hook, one body and one call to action.** Whatever was not chosen is saved in the idea file for the variations (stage 12).
- The duration, or the number of slides or frames.
- Whether it is a **collaboration** with the creator's personal account: it is what helps a new account grow the most.
- **What to record**, if there is a person on camera: the main take and 2 or 3 alternate openings for the variations.

Before showing it, five questions:
1. Is it understood without sound in the first second?
2. Why would someone send it to another person?
3. Why would they follow the account afterwards?
4. Is it different from what has already been published?
5. Can it be made this week with what there is?

## 6. Write, only with "this one"

Write one file: `brands/<brand>/ideas/<YYYY-MM-DD>-<short-name>.md`.

```markdown
# "<Name>" (<date>) · <network> · <format> · role: <shareable/useful/connection/product>

<One line: what it is and who it is for.> Call to action: <share / save / follow / pre-register>.

## Why this one
<Evidence from step 2, with source and date.>

## Hook
- Chosen: "…". First second: <what is seen>.
- Alternates (for variations): "…", "…".

## What was not chosen (for variations)
<The other bodies and calls to action from the menu, exactly as they were shown.>

## Script or sequence
| Part | What is said or read | What is seen |
|---|---|---|

## Make
<What to record or design; collaboration yes/no; two-line copy, no hashtags.>
```

Ideas the creator liked but are not for today go to `brands/<brand>/ideas/BANK.md`, and only if the creator asks.

**Then, by format:**
- reel → `/creator-reel`, which starts from this file in stages 0 and 1;
- story → the brand's story engine (`brands/<brand>/stories/`) or the sequence for the creator to upload;
- carousel or post → `instagram-agent:ig-carousel` and Montage.

## Set up (once per computer)

- The `last30days` and `marketing-skills` plugins are declared in `.claude/settings.json`. Claude Code asks to approve them the first time.
- **The ScrapeCreators key** (TikTok and Instagram in last30days, 10,000 free queries) is saved by the creator in their own terminal (on Windows, PowerShell). Claude does not write it:

  ```bash
  python3 production/tools/save_token.py --scrapecreators
  ```

  It asks for the key without showing it. On macOS it goes in the Keychain; on Windows and Linux, in `~/.config/last30days/.env`, which is where last30days looks for it. On Windows, type `python` instead of `python3`.
- **Safe config** in `~/.config/last30days/.env`:
  - `BROWSER_CONSENT=false` and `FROM_BROWSER=off`: never browser cookies;
  - `INCLUDE_SOURCES=tiktok,instagram,youtube_comments,tiktok_comments,instagram_comments`;
  - `LAST30DAYS_MEMORY_DIR=`: no reports on disk.
- `yt-dlp` installed, for YouTube: `brew install yt-dlp` (macOS), `winget install --id yt-dlp.yt-dlp -e` (Windows) or `uv tool install yt-dlp` (any system).

## How it gets refined

- When a piece that came from here has metrics (`instagram.py reels`), add a result line to its idea file: shares, followers and saves relative to reach.
- An angle or format that wins twice for the brand moves up to "What has already worked" in its `NICHE.md`, with the creator's yes.
- One that loses twice is noted there as "doesn't land".
