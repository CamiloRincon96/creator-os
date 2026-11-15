---
name: creator-reel
description: Takes a reel for any brand in the repo stage by stage (idea, scene-by-scene script, recording, voice cut, voice, visual script, image, animation, optional AI and retouching with a quote, sound, review and delivery), with the creator's approval at the end of each stage. Use it when the creator says "let's make a reel", "I have a recorded video", "edit this video", "let's continue the reel", "what stage are we at", types "/creator-reel", or wants to create or change a video style. It knows which tool and which skill is used at each stage. It also responds when the user writes the same in another language.
argument-hint: "[piece or brand]"
allowed-tools: Bash(python3 production/tools/piece.py:*), Bash(python3 production/tools/quote.py:*), Bash(zsh production/tools/codex.sh:*), Bash(production/.venv/bin/python production/tools/:*), Bash(node montage/cli.mjs:*)
---

# Reel by stages

Speak the person's language: every question, instruction (log in here, paste this, click that), approval request and summary goes in the language they write to you in; translate tool messages when you relay them. Commands, code and file names stay in English.

The why and the overview are in `production/REELS-WORKFLOW.md`. This is the procedure.

## Rules that are never skipped

1. **Every stage ends in something the creator sees or hears and approves.** The next one does not start without their go-ahead, unless they say for that piece "keep going without asking me until stage N"; that is noted in `STATUS.md`.
2. **Claude cannot hear.** Sound is measured with `listen.py` and approved by the creator by ear. Never write "sounds good".
3. **A cut never lands on the voice.** Cuts are placed by `cut.py`, not by the transcriber's timings.
4. **Nothing paid and no uploading material without telling them.** Higgsfield is never used without a quote the creator approved for that piece (stage 8). ElevenLabs, Adobe and Codex are announced before sending them any material.
5. **Never FINAL and never publish on your own:** the creator marks FINAL. Only a batch they approved in the chat goes out to Instagram (stage 12, `instagram.py approve`).
6. The brand's rules (`brands/<brand>/BRAND.md`) rule over the style.
7. **Before showing each stage, go over its block in `production/LESSONS.md`**: it is what has already gone wrong and how to avoid it. If a new lesson comes up, it goes there.

## Before anything: prepare the computer

Always, when starting `/creator-reel` in a session:

1. Run `python3 production/install.py --check`. It only checks; if it exits with 0, everything is there and you go on.
2. If something is missing that does not need permission, run `python3 production/install.py` without asking. That covers: the Python libraries in `production/.venv`, the rnnoise model, the projects' `npm`, the real-sfx and openverse-audio skills, and the sound library. Tell the creator in one line what was installed.
3. If items remain under "needs permission", ask **a single** question with AskUserQuestion. Include only what is missing, each item in one line with what it is for. With the yes:
   - **System programs** (ffmpeg, Node, Python): install them as the `creator-install-montage` skill says. The creator installs Homebrew in their own Terminal, because it asks for their password.
   - **Whisper model** (2.9 GB): `python3 production/install.py --with-whisper`, in the background. If they do not give permission, it downloads by itself the first time something is transcribed (stage 3).
   - **instagram-agent plugin:** Claude Code offers it when the repo is trusted; if not, `/plugin install instagram-agent@instagram-agent-skill`. It is needed for the script and the copy.
4. Logins and MCP servers are not requested in advance: mention them when their stage needs them.
   - After Effects (stage 6) and Higgsfield (stage 8, always with a quote) are declared in `.mcp.json`, and Claude Code asks to approve them the first time. After Effects needs "Allow Scripts to Write Files and Access Network" turned on.
   - ElevenLabs (stage 4, optional) is the claude.ai connector.
   - Adobe Podcast (optional) is the creator's own session in Chrome.

If a stage does not have its tool, say which one is missing and offer the alternative (for example, the local voice instead of ElevenLabs). Never make up the result.

## Start or resume

- With no argument: `python3 production/tools/piece.py list`, and ask which one is next or whether it is new. If there is no clear idea, `/creator-ideas` goes first: it is the creative stage.
- If the piece comes from `/creator-ideas`, its file `brands/<brand>/ideas/<date>-<name>.md` is the starting point for stages 0 and 1: the chosen hook, the alternates and what to record.
- Existing piece: read its `STATUS.md`, `brief.md`, `script.md`, the style (`production/styles/<style>/STYLE.md`) and the brand's rules. Continue at the **Current stage**.
- New piece: do stage 0 and create it with `python3 production/tools/piece.py new <brand> <short-name> --type on-camera|animated|mixed --style <style>`.

When closing each stage: update the table and the log in `STATUS.md` (what was shown, what the creator said) and the **Current stage** line.

## Montage

One project per piece: `<brand>-reel-<short-name>` (`node montage/cli.mjs new …`, with `brief.md` as the context). Everything the creator approves is published there as a new version, with the note starting with the stage: "Stage 3 · voice cut v2: …". The creator's notes are handled with the `creator-notes` skill.

## Stage 0 · What piece it is

Ask (with options, not open-ended): type, style, how much the person appears, how much animation, duration, which voice versions to try and what is wanted from stage 8 (nothing, reference photo, light, clothes, angles, retouching). Gather references: if they send links, download them with `uvx yt-dlp` to `production/references/videos/`, make a contact sheet, measure shot changes and transcribe, as in `production/references/2026-11-13-reference-reels.md`. Fill in `brief.md`.

## Stage 1 · Idea and script

- Talk through the idea: propose three hooks and, for each sentence, what could be seen. Remind the creator of what they said they wanted to see. Skills: `instagram-agent:ig-reel` (hooks and spoken script), `instagram-agent:ig-human` (so it sounds like them), `instagram-agent:ig-viral` if they ask to see what is working.
- Check the facts against the brand's repo. Whatever does not exist yet is noted in the brief and you ask the creator how to show it; they decide (no label by default).
- The script's "Camera" column says where each push-in goes.
- Write `script.md` with the full scene table (shot, says, shows, on-screen text, camera, sound, seconds) and the counts: percentage of person on screen, number of scenes, average visual change.
- **Approves:** the script.

## Stage 2 · Recording (only if there is a person)

Give the creator the script's "What to record" list and the guide: one continuous take; two seconds of silence after pressing record and before stopping; if a sentence comes out wrong, repeat it right there. The footage goes in `source/`, untouched.

## Stage 3 · Voice cut

```bash
production/.venv/bin/python production/tools/prepare.py <piece> --names "<the brand's proper names>"
```

1. Read `work/TRANSCRIPT.md` and check it against the script. Pick the best version of each sentence (if it was repeated, the last complete one with no slip). Note in the log what was said differently from the script.
2. Write `<piece>/cut.json` (`phrases` in order; `corrections` for mistranscribed words).
3. `production/.venv/bin/python production/tools/cut.py <piece>`. Read the warnings: a clipped start or a cut on the voice is told to the creator, not hidden. Between takes it leaves at least 0.45 s of air (`pause_between_segments` in `cut.json`). The creator asked for more space between sentences.
4. Publish `voice/cut-vN.mp4` to Montage (raw takes cut together, original audio leveled).
- **Approves, by ear:** nothing missing or extra, and no word clipped. If they ask for changes, edit `cut.json` and `cut-v(N+1)` comes out.

## Stage 4 · Voice

```bash
production/.venv/bin/python production/tools/voice.py <piece>
```

It leaves two versions (`original`, leveled, and `local`, cleaned) and `voice/cut-vN-to-enhance.wav`. It levels **sentence by sentence** (it corrects the mic being closer or farther) and matches the tone between takes.

External versions, only the ones the brief picks for that piece:

| Version | Who makes it and how | Cost and notice |
|---|---|---|
| ElevenLabs (voice isolator) | Claude, with the ElevenLabs connector: creates a flow, uploads `to-enhance.wav`, `voice-isolator` node, downloads the result to `voice/external/elevenlabs.wav` | Uploads the audio and spends credits: tell them first |
| Adobe Podcast (Enhance) | Claude, **driving the browser** (Claude in Chrome): opens podcast.adobe.com/enhance with the creator's session, uploads `to-enhance.wav`, waits and downloads the result to `voice/external/adobe.wav`. Adobe has no programmatic access | Free for about 1 hour a day. The creator must be signed in on Chrome; Claude does not type passwords |
| CapCut (enhance voice) | The creator by hand, or Codex with its computer use (see stage 8) | Their Pro plan |

Each one is brought in with `voice.py <piece> --external <name> <file>`, which levels it the same way and measures it. Publish all of them to Montage in a single version.
The chosen version always goes through `production/.venv/bin/python production/tools/match_timbre.py <piece> <voice.wav> <voice-v3.wav>`. It matches the timbre per take (mic closer = more bass) and gives it presence. Without it, in "Sin anotar" (an earlier Spanish-language reel) there was an audible jump in the voice at 8 s and the voice sounded dull and monotone. Check that the timbre spread goes down.
- **Approves, by ear:** which one stays. If they pick the same one two pieces in a row, note it as the usual one in `production/REELS-WORKFLOW.md`.

## Stage 5 · Visual script

- Write `<piece>/scenes.json` from the table in `script.md`: per scene, `shot`, `starts` (phrase and word, e.g. `T03-01:0`), `shows`, `text`, `camera` (`snap`, `slow`, `still`) and `accent` (the word for the push-in). And `voice`: the version chosen in stage 4.
- `python3 production/tools/visual_script.py <piece>` puts in the real timings and leaves `visual-script.md`, `visual-script.json`, `image/blocks.json` and the counts.
- Check the counts against the brief: percentage of person on screen and a visual change every two to three seconds.
- Write `image/blocks.json`: one block for each `CAMERA` or `CAMEO` row (`id`, `start`, `end` in piece seconds, `what`). From here on you know how many seconds the person appears; run `python3 production/tools/quote.py <piece>` and note the result in `STATUS.md`, for information only.
- Make the **mockup**: `python3 production/tools/mockup.py <piece>` (the `Mockup` composition in the brand's Remotion project: the voice, the real take in the blocks, gray cards in the scenes, push-ins and captions; at half resolution). Check one frame per scene and publish it with one marker per scene.
- **Approves:** the pace and what is seen on each sentence.

## Stage 6 · Base image of the person (only if there is a person)

Only the blocks in `image/blocks.json`, with half a second of tail on each side: `production/.venv/bin/python production/tools/blocks.py <piece>` cuts them to `image/blocks/B01-raw.mov`… and notes which take and second each one comes from.

- **Color and framing:** After Effects via MCP (`aftereffects`): one composition per block, Lumetri Color and reframing, render through the queue. The project stays in `image/<name>.aep`. Verify with `ae_render_frame` before rendering.
- **Separate the person from the background:** `node production/tools/cutout-person.mjs <piece>` (local, `@remotion/video-matting`) leaves `B01-v1-front.webm` with transparency. With that, the kit's `Person` piece (`brands/<brand>/reel/src/kit/Person.tsx`) puts the big word behind the head. The background is not treated differently from the person: darkening or blurring it makes the cutout's errors visible (blotches on clothes, a halo in the hair). Any image effect goes on top of everything, evenly. The person's color stays natural: the epic feel comes from the word, the push-ins and the animation, not from a harsh grade.
- **Check at full size before showing:** 100% crops of the face, the beard and the hair edge of each block, against the raw. No crushed blacks, no halo around the hair, no blotches on clothes. To check every frame: a difference map (`blend=all_mode=difference`) between the color-graded block and the result; only what was added on purpose should change.
- **Show it as video, not as stills:** the blocks back to back with their voice, one side by side (before and after) and another with only the after (the `PersonTest` composition with `frames` in the props, joined with ffmpeg). The creator does not take a sheet of still frames as a deliverable.
- Avoid AE's Glow effect to "add shine": it makes the image milky.
- The animation always uses the highest version of each block (`B01-vN.mp4`): whatever is done later in stage 8 goes in by swapping the file and rendering again, without touching the animation.
- **Approves:** before and after frames.

## Stage 7 · Animation

- The brand's Remotion project (`brands/<brand>/reel/`), with the style's kit. Skills `remotion-best-practices`, `remotion-markup`, `remotion-create`, `remotion-render`. Design: the brand's (`DESIGN.md` in its repo).
- After Effects for what does not look right in code: text behind the person, blurred wipes, glows.
- **HyperFrames** (`hyperframes` plugin), as support:
  - about 450 ready-made blocks (`hyperframes-registry`: transitions, titles, kinetic type, charts, camera moves);
  - the motion rules (`motion-doctrine`, `cut-the-curve`: zoom-through, cut on the curve);
  - check there before building an effect from scratch.

  A HyperFrames block is rendered separately and goes into Remotion as video. The piece stays in Remotion.
- **Own footage** (`library/`): `library.py search "<what>" --vertical` before animating something that could be a real shot.
- **Motion blur:** whatever enters or leaves fast gets `CameraMotionBlur` (`@remotion/motion-blur`) or a blurred wipe. Nothing pops in without intent, and every big move gets its sound.
- The style comes from `brands/<brand>/OWN-STYLE.md` (what worked, according to `/creator-pulse`) and from `BRAND.md`.
- **First the two or three hard moments,** on their own, shown to the creator. Then all the scenes.
- Timings come from the cut map; nothing is placed by eye. If the animation changes a block's duration, update `image/blocks.json`.
- **Approves:** the hard moments; then the full edit without the final sound.

## Stage 8 · AI and retouching of the person (optional)

It goes here because by now you know exactly how many seconds the person appears. Skip it entirely if the brief asks for nothing. Order matters: first what regenerates the video (Higgsfield), retouching (CapCut) last, because a regeneration wipes the retouching.

### 8a · How they want to look (reference photo, with Codex)

If the creator wants different clothes, different light or a different angle:

1. Claude pulls a clean frame from each block (`image/reference/frame-B01.png`).
2. Writes the task in `image/reference/task.md`: what to change (clothes, light, angle), what not to touch (face, features, hair, expression), 9:16 format, and where to save the images.
3. `zsh production/tools/codex.sh <piece> image/reference/task.md image/reference/frame-B01.png`. Codex generates the images with the creator's ChatGPT subscription. The photo goes out to OpenAI under their account.
4. Show them to the creator. **Approves:** the photo of how they want to look.

### 8b · Quote (required before any generation)

1. `python3 production/tools/quote.py <piece>` gives the billed seconds and the price per option.
2. Upload the blocks to Higgsfield (`media_upload`) and confirm the real price of each job with `generate_video` and `get_cost: true`. Uploading means sending the video to Higgsfield: say so in the same message.
3. Present the quote: blocks, billed seconds, draft and final at 720p and 1080p, credits and approximate dollars, and the remaining balance (`balance`). Clothes, light and retouching in a single instruction are one pass.
4. **Approves:** the option and the spend. Without that yes, nothing is generated. If the balance is not enough, say so and wait.

### 8c · Draft and final

- **Draft first** (480p, `draft: true`, about 3.5 credits per second) of a single block, usually the hook. Review it: face, lips and movement the same as the original. **Approves** the draft.
- **Final:** finish that draft (`draft_job_id`, billed at the full final resolution) and make the other blocks with the same instruction. If a block comes out different, say so and offer a single retry, quoted.
- Tools: `seedance_2_5` with `mode: video_edit` for light, clothes described in words, and retouching (the `lighting-hf` workflow for the 62 lights); `hf_mult_replace_object` to swap the clothes for the ones in the 8a photo; for a new angle, `seedance_2_5` in `video_edit` asking for the shot (close-up, from above) or `hf_mult_motion_control` with the 8a angle photo and the original block as the motion. The result comes back without sound and at 24 frames: put the original audio back on and convert it to 30 fps.
- Results in `image/blocks/B01-v(N+1).mp4`, and the stage 7 render is repeated.

### 8d · Retouching in CapCut

Claude leaves the blocks in `image/to-capcut/`. The creator's saved retouch preset is applied and they are exported with the same name to `image/from-capcut/` (1080 × 1920, 30 fps, no text or music). Who does it, in this order of preference:

1. **Claude with computer use** (what the creator prefers). From VS Code or the terminal there is no computer use, so it is done by a session of the Claude desktop app:
   - If this session already runs in the desktop app with Computer use turned on, it does it itself: it asks for access to CapCut (`request_access`) and works with the background tools (`app_*`) so it does not take over the creator's screen.
   - If this session runs in VS Code: Claude writes the task in `image/to-capcut/TASK.md` (files, retouch preset, export format, output folder) and asks the creator to open the desktop app in the code tab, on this repo, with Computer use turned on. It can open the app for them with `open -a Claude`, but it cannot create the session or turn on computer use for them. When the session shows up in `ListAgents`, Claude sends it the task with `SendMessage`. A desktop app session does not report when it is done: Claude checks `image/from-capcut/` until all the files are there.
2. **Codex with its computer use:** the same task with `codex.sh`. The first time, with the creator watching.
3. **The creator by hand.**

Claude checks that each file has the same frames and duration, copies it as `B01-v(N+1).mp4` and repeats the render.

- **Approves:** before and after frames of each step.

## Stage 9 · Sound

- Effects with the `real-sfx` skill (which sound for which moment and where to get it: `openverse-audio`; in HyperFrames projects, `hyperframes:media-use`) (list of moments from the map). Which sound goes at each moment and which ones we do not use: `production/SOUNDS.md`. Music only with a verified license: the `creator-free-sounds` skill, credits next to the file.
- Rules: a sound on everything that moves; none in the emotional part; they must be heard on a phone without covering the voice.
- Levels and hook: follow "Sound rules" in `production/REELS-WORKFLOW.md`. Summary:
  - effects about 5 dB below the voice (`balance` around −5);
  - a hit on frame 0;
  - a riser before the big hit;
  - music with its own 2:1 ducking (about 3 dB), never `--duck-music`, and no automatic swells at the end;
  - a sheet with the sounds per file.

  All of `critique.py`'s axes scoring 9 does not mean the creator will like it: in v13 everything was at 9 or 10 and they said nothing could be heard.
- Also deliver the video at 1.08× and 1.12× (`setpts` + `atempo`) if the voice sounds monotone, and a version without music so the trending song can be added from Instagram.
- `production/.venv/bin/python production/tools/listen.py <piece> <mix>`: the mix must be understood as well as the voice alone (same percentage of words) and land at −14 LUFS.
- **Approves, by ear:** the mix.

## Stage 10 · Review

Before publishing each version, two passes over the final file: one for cuts and captions (frames at every shot change, at full size) and another for hook and pace.

Plus a **fixed final checklist**:
1. Duration and resolution (1080×1920, 30 fps).
2. The topic is seen and heard before second 1, also without sound.
3. Captions are in time with the voice, readable on a phone and never over a light background.
4. Nothing covers the face: `production/.venv/bin/python production/tools/faces.py check <video>`. If there is a warning, look at the sheet it leaves and fix it.
5. Loudness at −14 LUFS and the voice above the music (`listen.py`).
6. Zero spelling mistakes, and proper names written correctly.
7. No third-party logos, brands or material.
8. **Cover:** `faces.py cover <video> --n 3` leaves 3 candidates with their second.

Then publish to Montage. Each of the creator's notes goes back to its stage (a cut they don't like is stage 3; a color, stage 6; a face, stage 8) and only what depends on it is redone.

## Stage 11 · Delivery

When the creator calls the video done (they say it in the chat or mark FINAL), build **the final folder** `brands/<brand>/finals/<project>/`. It is the only place where they look for the video. Give them the path and open it for them (`open <folder>`).
- **The video to publish,** with a clear name (`<name>.mp4`). If there is a version without music, it goes next to it (`<name>-no-music.mp4`).
- **`copy.txt`:** the description, with `instagram-agent:ig-caption`, reviewed with `ig-human` and `caption.py`. **Short: two lines and no hashtags** (the creator, 14 Nov 2026). One sentence that names the problem in the words people search for, and the call to the link in bio. No links in the text. When the copy is not in English, `caption.py`'s "no call to action" warning is a false alarm.
- **`suggested-cover.jpg`:** a sharp frame with the key text and the face looking at the camera.
- **`PUBLISH.md`:** which file to upload, when (day and time in the audience's time zone, with the reason), what to check first (the link in bio), and replying to comments in the first hour. While the account has no data of its own, the time is a general recommendation (weekdays 12:30 p.m. or 7:00 p.m.). If the topic names a day, that day. After that, the time comes from Insights.
- With FINAL marked, Montage also generates the per-network variants (deliver). It is recorded in the brand's `BRAND.md`.

After stage 12 (variations), the **cleanup** (the creator's rule: the computer must not fill up):
1. `python3 production/tools/clean.py <piece>` shows what it would delete and what stays: the piece's text and code, the final voice, the raw takes and the FINAL.
2. Show the summary to the creator.
3. With their yes: `clean.py <piece> --yes` and `node montage/cli.mjs archive <project> --yes`. The latter deletes the files of old versions in Montage; notes and history stay.
   - The earlier versions go: only the FINAL stays in Montage.
   - Anything useful on its own, like the version without music, is copied first to `brands/<brand>/finals/<project>/`.
   - The piece's rejected attempts and their media are deleted too.

Deleting cannot be undone: always with their yes, in this session.

## Stage 12 · Variations (trial reels for non-followers)

It comes after the FINAL and **before the cleanup**: the cleanup deletes what is needed to make variations. Everything adjustable lives in `production/variations/`, one file per topic, so it can be refined without touching the rest:
- `PROMPT.md`: which variations to propose and why (principles, the brand's touch, plan format).
- `MUSIC.md`: licensed music and trends.
- `CALENDAR.md`: which day and at what times.
- `LEARNED.md`: the results of each batch; the new rules come from there.

The account is connected once: `production/INSTAGRAM.md`.

### 12a · Diagnosis and drafts (the creator approves by watching the drafts)
1. Read `PROMPT.md`, `LEARNED.md` and `MUSIC.md` in full.
2. **Diagnosis of the finished video** (step 1 of `PROMPT.md`):
   - if it has already been published, real metrics from the API (skip rate, average watch time, shares) compared with the account's other reels, and the screenshot of the retention curve the creator sends;
   - the contact sheet of the first 4 s;
   - this week's trends (`TRENDS.md`, renewed after 14 days).

   What comes out is **the earliest failure**, with its data point.
3. Write `<piece>/variations.json`: 3 to 5 re-edits, each one a different angle that fixes that failure (`segments`, `pause`, `freeze_at`, `open_with`, `music`, an effect), with its new voice script.
4. `python3 production/tools/variations.py <piece> <piece>/variations.json --draft`: 540p drafts in seconds, no batch. Look at the frames of each new join and the first 3 s; publish them to Montage (`<brand>-variations-<name>`) with the openings sheet.
5. **Approves:** the drafts, by watching them. With changes, only the one that changed is redone. A plan is never approved in text alone.

### 12b · Production
1. With the yes, fill in the `day` and the `time` of each one in `variations.json`.
2. `python3 production/tools/variations.py <piece> <piece>/variations.json` (without `--draft`). It leaves them at final quality in `brands/<brand>/finals/<project>/variations/`, with `batch.json`. The ones that already exist and were approved as they are carry `keep`.
3. Your own review (the stage 12 block in `LESSONS.md`):
   - the first 3 s of each one at full size;
   - no two alike in the first 2 s;
   - loudness at −14 LUFS.
4. Publish them to Montage in a single version.

### 12c · Batch (the creator approves in the chat)
1. `python3 production/tools/instagram.py preview <batch>` shows what goes out and at what time.
2. The creator approves **the exact batch: videos, copies, day and times.** Without that message, nothing is scheduled.

### 12d · Publishing
1. `instagram.py approve <batch> --message "<what the creator said>"` and `instagram.py schedule <batch>`. The Mac stays on and connected until the last time slot, and only one computer schedules each batch.
2. They go out as **trial reels**, for non-followers only, with manual graduation. Before scheduling, confirm the account has them (see `CALENDAR.md`). If not, the batch is spread over different days as regular reels.
3. The ones marked `manual` (trending song) are uploaded by the creator from the app at their time: remind them with the file and the copy.

### 12e · Results and learning
1. The 24- and 72-hour metrics are saved by the Mac's watcher on its own (`instagram.py watcher status`): it runs every hour, does not use Claude, writes them into `batch.json` and sends a notification. Claude does not sit waiting: when the creator comes back, they are read from the batch (`instagram.py results <batch>` also fetches them on the spot).
2. At 72 h, fill in `LEARNED.md`: one row per variation and the batch's conclusion.
3. Tell the creator which one did best with non-followers, so they graduate it to their followers in the app (Thursday, 7 p.m., per `CALENDAR.md`).
4. What wins in two batches moves up as a rule to `PROMPT.md`, `MUSIC.md` or `CALENDAR.md`, with a date.
5. Only then, the stage 11 cleanup.

## Animated pieces

No stages 2, 3, 6 or 8. The voice is the brand's ElevenLabs voice and the map comes from that voice, as in `brands/example/reel/README.md`.

## Express mode: the daily reel

For publishing almost every day without lowering quality. It has **two approvals**: the idea with its script, and the finished video. It is used with the ideas from `/creator-ideas` and with what `/creator-pulse` says. Big pieces, on camera and with custom animation, follow the full flow above.

**A · From a voice note** (no camera):
1. The creator records a voice note on their phone following the idea's script and drops it in `<piece>/source/`. The piece is created with `piece.py new <brand> <name> --type animated`.
2. Cut and voice, as in stages 3 and 4, but without a separate approval: `prepare.py` (accepts audio files), `cut.py` and `voice.py`.
3. Claude writes `<piece>/explainer.json`: the scenes with the word timings. The types are title, number, list, clip (own footage), app and outro (`production/tools/note.py`).
4. `python3 production/tools/note.py render <piece> --draft` and then without `--draft`. It brings wipes, an opening hit, optional music (`--music … --align …`), −14 LUFS and 3 candidate covers.
5. The fixed final checklist from stage 10, and Montage. **Approves:** the video.

**B · With the creator's footage** (them talking, or the street): the take goes in `source/`, and stages 3 and 4 follow. The image is the person with captions, plus 1 or 2 explainer scenes or clips from the library, with no custom animation. Same as before: final checklist and Montage.

**Everything that gets recorded**, even if it is not used today, is dropped into `library/inbox/` and catalogued with `library.py add`. That is how the own-footage base grows.

## How this grows

- **New style** ("let's implement this style"): analyze the reference as in stage 0, write `production/styles/<name>/STYLE.md` using the existing one as the template, and build its Remotion kit in the first piece that uses it.
- **New rule from the creator:** if it applies to every piece, to `production/REELS-WORKFLOW.md`; if it belongs to a style, to its `STYLE.md`; if it belongs to a brand, to its `BRAND.md`. And to memory if it changes how the work is done.
- **New tool:** to the table in `production/REELS-WORKFLOW.md` and to the stage it belongs to here.
- **A stage that is unnecessary or missing:** change it here and in `production/templates/STATUS.md`.
