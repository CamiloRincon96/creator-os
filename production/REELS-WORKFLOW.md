# Reels workflow, in stages

Version 2 (November 13, 2026), to keep refining with the creator. It runs with the `/creator-reel` command (`.claude/skills/creator-reel/SKILL.md`), which takes each piece stage by stage. It comes from what failed in the "Sin anotar" reel (Spanish for "Not written down"): everything was built before the creator heard the cut or saw what was going to be on screen.

**The idea:** every stage ends in something the creator sees or hears and approves. If something doesn't convince, that stage is repeated and only what depends on it is redone. Claude can't hear: it measures and transcribes. That's why anything about sound is always approved by the creator, by ear.

The general rules are still in `WORKFLOW.md`, and each brand's in its `BRAND.md`. **Everything that has already gone wrong, and how to avoid it, is in `production/LESSONS.md`**, by stage: go over it before showing each one.

## Quality (it holds for any identity)

The floor no piece goes below, the knobs that change from piece to piece, the method from the raw videos to the reel, the recipes (what to show for what is said) and the first-version traps are in **`production/REELS-QUALITY.md`**. It came out of the first full reel made in "glass" (v17 to v27, Nov 17, 2026): "I won't accept less than this". Picking another identity changes the look, not that floor. The brand's Remotion project has a kit that serves it (`brands/example/reel/src/glass/`, with its README and its `Logo` piece for the logos in `public/logos/`).

## Stage 0: what piece is it

Before writing anything, four things are chosen. Not every piece is the same.

| What's chosen | Options |
|---|---|
| Type | **On camera** (a person talks) · **Animated** (no person, with the brand voice) · **Mixed** |
| Identity | The one the brand uses for this type of video (its `BRAND.md`, "Identities"), or a new one |
| How much the person appears | Hook and 2 s cameos (a third of the piece) · half · almost all of it |
| How much animation | Sober · medium · high |
| Voice | Which versions to try: local · ElevenLabs · Adobe Podcast · CapCut |
| AI and retouch (stage 8) | None · reference photo · light · clothes · angles · retouch in CapCut |

It goes in the piece's `brief.md`, with the references (`production/references/`).

**A brand can have several identities, one per type of video** (the creator, Nov 17, 2026). For example, a personal account uses "glass" for to-camera reels with animation, and another one for its covers. Each identity is a style in `production/styles/<style>/STYLE.md`, with its type, its color, its motion and its kit. The brand says in its `BRAND.md` which one goes with each type of video. An identity is built piece by piece and is written down once the creator says it's already "ours".

## The stages

| # | Stage | What Claude does | What the creator approves | With what, exactly |
|---|---|---|---|---|
| 0 | What piece is it | Asks the type, style, how much the person appears, which voices to try and what's wanted from AI; analyzes the references | The brief | `piece.py new`; `yt-dlp` and ffmpeg to look at the references |
| 1 | Idea and script | Talks the idea through, proposes hooks and what's seen on each line, checks the facts | The script, by scene | Skills `ig-reel`, `ig-human`, `ig-viral`; the `script.md` template |
| 2 | Recording | Gives the list of what to record and the guide | (records) | Camera and microphone |
| 3 | Voice cut | Transcribes, picks the best version of each phrase by the voice and by the picture (looks at the lens, gesture complete) and cuts with Silero VAD: jump cuts, no breaths, even pace. Reviews the whole cut by picture and voice before showing it | The cut, by ear | `prepare.py` (local Whisper), `cut.py`, `gaze.py`, `review.py`, Montage |
| 4 | Voice | Cleans up, matches the tone between takes and levels phrase by phrase; brings in the chosen external versions | Which one sounds best | `voice.py`; ElevenLabs (connector), Adobe Podcast (Claude driving Chrome), CapCut |
| 5 | Visual script | Agrees how much the person appears (or decides it from the best takes), puts the real timings in, marks the blocks where they appear only in pieces where they look at the lens, and builds a mockup | The mockup | `visual_script.py`, `gaze.py`, Remotion, `quote.py` (informational), Montage |
| 6 | Base image | Color and framing of the person's blocks, and separating them from the background for the epic look | Before and after | `blocks.py`, After Effects via MCP, `cutout-person.mjs`, the kit's `Person` piece |
| 7 | Animation | First the two or three hard moments; then all the scenes | The hard moments and then the edit | Remotion (`remotion-*` skills), After Effects for one-off effects |
| 8 | AI and retouch (optional) | Reference photo, quote, draft, final and retouch | The photo, the quote, the draft and the retouch | Codex (images), Higgsfield, CapCut |
| 9 | Sound | Effects like the niche's (about 7 every 10 s, at the voice's level), a low music bed and the mix, measured in the final mix | The mix, by ear | `effects.py` (with the `real-sfx` skill), `sound_study.py` (once per brand), skill `openverse-audio` (or `hyperframes:media-use` in HyperFrames projects); `listen.py` |
| 10 | Review | Mandatory full review (`review.py` and "What I saw"), two passes, publishes the version and sends each note back to its stage | Notes on the frame | `review.py`, Montage, the `creator-notes` skill |
| 11 | Delivery and cleanup | Final folder `brands/<brand>/finals/<project>/` with video, copy, cover and posting time; variants per network; then frees up the disk | Marks FINAL, posts and says yes to the cleanup | Skills `ig-caption` and `ig-human`; `clean.py`, `montage archive` |
| 12 | Variations | 12a plan of 4 to 6 hooks (one principle each, the week's trend, licensed music) · 12b production · 12c batch · 12d posting as trial reels · 12e results that refine the prompt | The plan and then the exact batch (videos, copies, day and times), in the chat | `production/variations/` (PROMPT, MUSIC, CALENDAR, LEARNED); `variations.py`, `instagram.py` |

The repo's own tools are in `production/tools/` and run with `python3 production/tools/<tool>.py` (on Windows, `python`): each one switches to the `production/.venv` environment on its own if it needs it. What changes between macOS, Windows and Linux lives in one file, `production/tools/system.py`, and `production/tests/portability.py` checks that nothing specific to one system slips in anywhere else.

An **animated** piece has no stages 2, 3, 6 or 8, and the stage 4 voice is the brand's ElevenLabs voice.

## Recording guide (stage 2)

- One continuous take. If a phrase comes out wrong, repeat it right there without stopping the recording.
- Two seconds of silence after hitting record and before stopping. With DJI Mimo and a Bluetooth microphone the audio comes in late and the start gets lost.
- The same distance to the microphone in every take. If one is recorded closer, the voice comes out deeper and the jump is noticeable.
- Breathe for half a second between phrases.
- If the piece is hook and cameos, you only need good picture in those blocks; the rest can be voice only (an audio file in `source/` works too).

## How the voice is matched and what Claude "hears"

Claude can't hear. What `listen.py` does on any audio or video of the piece:

- **It measures the loudness of each phrase.** If the microphone was closer for one phrase and farther for another, it shows up as phrases at different loudness. `voice.py` raises or lowers each phrase to the same level, with the change spread across the silences. In the test with the "Sin anotar" takes, the phrases ended up within 0.2 LU of each other.
- **It measures the tone of each take** (lows, presence and air). With the microphone close the voice comes out deeper; each take is brought closer to the tone of the whole, capped at 5 dB so the timbre doesn't change.
- **It matches the timbre per take in the external versions too** (ElevenLabs, Adobe): `match_timbre.py <piece> <voice.wav> <output.wav>`. In "Sin anotar" the ElevenLabs version went out unmatched and the creator heard the jump at 8 s: take 2 had 4.8 dB more lows and the hook 6.7 dB less brightness. It's matched per take, never per phrase, because matching per phrase changes the timbre in the middle of a breath. The script also gives the voice presence: high-pass, +2.5 dB at 3.5 kHz, de-esser and 3:1 compression. That way the voice doesn't sound dull or monotone.
- **Don't flatten the voice:** leaving phrases within 0.2 LU of each other makes it monotone. A natural difference between phrases is 1.5 to 2 LU.
- **It measures how loud what's between phrases is** (noise, music or effects) against the voice.
- **It transcribes again and compares word by word.** If a cleanup or a mix eats a word, the transcript changes. That's the check that the voice is still understandable.

What it can't know: whether the voice sounds natural, metallic or "robotic", and whether the music is liked. The creator decides that by ear in stages 3, 4 and 9.

## Automatic checks

- No cut lands where the voice is still sounding: the audio is measured at each cut point; the transcriber's word end isn't used.
- No caption carries over from one take to the next.
- The person doesn't exceed the screen time chosen in stage 0.
- There's a visual change every two to three seconds, unless stage 0 says otherwise.
- Safe zones, mix at −14 LUFS and a first frame with content.
- Before publishing a version, Claude checks the final file twice: once for cuts and captions, once for the hook and the pacing.
- The person's image (stages 6 and 8): 100 % crops of face, hair and clothes in each block, and a difference map against the original image across all frames. Only what was added on purpose may change.

## Sound rules (stage 9)

They come from "Sin anotar" (effects nearly inaudible on the first pass) and from the three rounds of the first full reel made in "glass" (Nov 17, 2026): with 106 interface sounds, "laser beams"; with 19 measured before the music, "you can't hear anything"; with 41 real ones at the voice's level, measured in the final mix, "exactly that".

1. **The niche first:** if the brand has no `brands/<brand>/sounds/study/`, make it with `sound_study.py` (search, download with permission, separate, measure, listen, style). It says how many effects they use, of what kind and how loud.
2. **The sheet** comes from the moments in the animation's code, with a level per effect: the recipe and the vocabulary are in `production/SOUNDS.md` (about 7 every 10 s, a full hook, no interface sounds or dings).
3. **`effects.py mix`** mixes with the voice and the music inside and brings each effect to its level against the voice, measured in the final mix.
4. **`effects.py review`** runs real-sfx's tools (critique against the niche style, verify, the mix picture and the hook zoom, which get looked at) and Whisper word by word, with the window test that tells what an effect covers apart from what only confuses the transcriber.
5. **The creator approves by ear,** on headphones and on the phone. real-sfx's "ears" (`hear.py`, YAMNet) don't work with a continuous voice on top.

The music levels, the sonic hook and what gets delivered are in `production/LESSONS.md` (stage 9).

## Tools

| Tool | What for | Cost |
|---|---|---|
| Claude Code | Runs the workflow | Already paid for |
| Remotion | Animation, captions and editing | Free for up to 3 people |
| After Effects | Color, framing and one-off effects | Already paid for |
| Montage | Reviewing and approving each stage | Our own |
| ffmpeg, local Whisper, rnnoise | Cuts, transcription and voice cleanup | Free |
| `real-sfx`, `openverse-audio` and Openverse | CC0-licensed effects and music | Free |
| Higgsfield | Light, clothes, angles and retouch of the person (stage 8, optional) | Plus plan, by credits; always with a quote |
| Codex (ChatGPT app) | Reference photos; driving CapCut through the screen | The creator's ChatGPT subscription |
| ElevenLabs | Brand voice, isolating the voice from noise | Paid, by credits |
| Adobe Podcast (Enhance) | Improving the voice; Claude drives it from Chrome | Free for about 1 hour a day; Premium about 10 dollars a month. No programmatic access |
| CapCut | Face retouch | The creator has the paid version |
| Descript | Cutting by editing the text | Very limited free tier; from about 16 dollars a month |
| Submagic | Animated captions | Paid, with a 7-day trial |

The prices come from third-party 2026 reviews and don't agree with each other: confirm on each one's page before paying. Descript and Submagic aren't needed: what they do is already covered by the workflow.

## Stage 8: AI and retouch, always with a quote

Decided by the creator (Nov 13, 2026): Higgsfield is optional and comes after the animation, once it's known how many seconds the person appears. Nothing is ever generated without an approved quote for that piece.

**The order:**

1. **Reference photo with Codex.** From a frame of the video, Codex generates how the creator wants to look (clothes, light, angle) with their ChatGPT subscription. The creator approves it. It serves as the guide for Higgsfield.
2. **Quote.** `quote.py` adds up the blocks where the person appears (minimum 4 s per job) and Claude confirms the real price of each job in Higgsfield before presenting it.
3. **Draft** of a single block at 480p. If it convinces, finish it at the final resolution.
4. **Final** of the other blocks with the same instruction.
5. **Retouch in CapCut** at the end, because any regeneration would erase it.

**What it costs** (checked in the connector on Nov 13, 2026, without generating anything). Video editing with Seedance 2.5 is charged per second and by resolution, not by how many things are changed:

| Option | Per second | 30 s (max per job) | 1 minute (two jobs) |
|---|---|---|---|
| 480p draft | 3.5 credits | 105 | 210 |
| 720p final | 7.5 credits | 225 | 450 |
| 1080p final | 20 credits | 600 | 1,200 |

- A credit bought on its own costs about 5.5 US cents: one minute at 1080p is about 65 dollars per pass.
- Clothes, light and retouch in a single instruction are one pass; done separately, one pass each.
- The draft isn't deducted from the final: it's a small expense (about 15 credits for a 4 s block) so you don't spend 80 on a final that doesn't work. It's always worth it when you're going to pay for 1080p or more than one block.
- With the scenes-and-cameos style the person appears for about 13 s in five blocks, which are charged as 22 s: about 77 credits for the draft, 165 at 720p and 440 at 1080p.

**Camera angles from a single take** (the idea from reel `DfGItsCvxaa`). Two paths, for cameos only:

- Ask for the new shot (close-up, from above, from the side) in a Seedance edit: same per-second price as above.
- Generate the angle photo with Codex and give Higgsfield that photo plus the original block as motion (Genjutsu, motion transfer). Its price can only be checked with the clip uploaded.

In both, the new shot is generated: check that lips and face stay the same.

**Be careful:** the result comes out without sound and at 24 frames per second (the original audio is put back and it's converted to 30); it may change the face a little; and two jobs from the same take may not come out identical to each other.

## Face retouch: CapCut

Decided by the creator (Nov 13, 2026): visual retouches are done in CapCut, which they have in the paid version. CapCut has no official programmatic interface; community projects only write drafts, don't touch the retouch and leave the export to be done by hand. It's driven through the screen, in one of three ways:

1. **Claude with computer use** (what the creator prefers). It's done by a session of the Claude desktop app, opened on this repo in the code tab, with Computer use turned on (Settings → This computer; it's off by default). VS Code has no computer use, but the VS Code session can hand the task to the desktop app session, which shows up as another session on this computer, and check the files it leaves. What's needed only once: turn on Computer use in the app and give CapCut permission when it asks.
2. **Codex with its computer use.** Codex is installed with the ChatGPT app and has computer use and image generation turned on. Claude hands it the task in writing with `production/tools/codex.py` and reads its reply. The first time, with the creator watching.
3. **The creator, by hand.**

In all three cases: the blocks come from `image/to-capcut/`, the creator's saved retouch preset is applied (always the same one) and they're exported with the same name to `image/from-capcut/`: 1080 × 1920, 30 fps, no text or music. Claude checks frames and duration. That's four or five short clips per piece.

## Where everything lives

```
.claude/skills/creator-reel/   the /creator-reel command
production/
  REELS-WORKFLOW.md       this document
  tools/                  install.py (in production/), variations.py, instagram.py, piece.py, prepare.py, cut.py, voice.py, match_timbre.py, listen.py, review.py (the mandatory review of every result), gaze.py (where the person can appear: looks at the lens), match_color.py (the same skin color from take to take), visual_script.py, clean.py, mockup.py, blocks.py, cutout-person.mjs, quote.py, codex.py, save_token.py, system.py (what's specific to each operating system)
  templates/              brief.md, script.md, STATUS.md
  styles/<style>/         the library of video identities: one STYLE.md each (a brand can use several)
  references/             reference reels and their analysis
brands/<brand>/pieces/<date>-<name>/
  brief.md                stage 0
  script.md               stage 1: the scene table
  source/                 the recording, untouched
  work/                   takes at 30 fps, transcript and phrases
  cut.json                which phrases go in and in what order
  voice/                  voice cuts and versions
  scenes.json             stage 5: the script's scenes with the word where each one starts
  visual-script.md        stage 5: the scenes with their real timings (and .json for the mockup)
  image/                  blocks.json, blocks/ (B01-vN.mp4), reference/, to-capcut/, from-capcut/
  codex/                  tasks for Codex and its replies
  output/                 renders
  STATUS.md               which stage it's at, what was approved, and the log
brands/<brand>/reel/      the brand's Remotion project
```

The "Sin anotar" reel stayed in `brands/example/brand-edit/`, with the old structure. It isn't moved.

## Still to build

Review of Nov 13, 2026, in order of priority:

1. ~~**Automatic mockup (stage 5)**~~: done on Nov 13, 2026 (`visual_script.py`, `mockup.py` and the `Mockup` composition).
2. **Kit for the scenes-and-cameos style (stage 7):** scene with title, cameo with a swipe, card over the person, captions and word behind. Built in the first piece.
3. ~~**Mix with music (stage 9)**~~: done on Nov 17, 2026 (`effects.py`: the low bed with soft ducking, the effects at their level in the final mix and the no-music version for Instagram).
4. **Cover (stage 10):** choose or compose each reel's cover, different from the previous ones in the grid, and check that the first frame isn't empty.
5. **Ideas (before stage 0):** an `IDEAS.md` per brand where ideas are jotted down while talking, and where each piece comes from.
6. **Learning (after posting):** a week later, review how it did with the `ig-audit` skill and write down in the style what to repeat and what not.
7. **Test take (stage 2):** 10 s recorded and run through `prepare.py` before recording everything, to catch the microphone's clipped start.
8. **Cleanup on delivery (stage 11):** delete `work/` and the intermediate versions when the creator marks FINAL; the disk is almost full.

## To decide

- Which voice version becomes the usual one, once the creator hears the options in the first piece.
- The values of the CapCut retouch preset, so they're written down here.
- Whether Codex can drive CapCut from a task without the app open in the foreground: to be tested with the creator watching.
- ~~What to use for the word behind the head~~: local cutout with `@remotion/video-matting` (`cutout-person.mjs`), tested on Nov 13, 2026.
