---
name: creator-reel
description: Takes a reel for any brand in the repo stage by stage (idea, scene-by-scene script, recording, voice cut, voice, visual script, image, animation, optional AI and retouching with a quote, sound, review and delivery), with the creator's approval at the end of each stage, guiding them by the hand (what is done and why, what they review, where, and how to answer). Use it when the creator says "let's make a reel", "I have a recorded video", "edit this video", "let's continue the reel", "what stage are we at", types "/creator-reel", or wants to create or change a video style. It knows which tool and which skill is used at each stage. It also responds when the user writes the same in another language.
argument-hint: "[piece or brand]"
allowed-tools: Bash(python3 production/tools/piece.py:*), Bash(python3 production/tools/quote.py:*), Bash(python3 production/tools/codex.py:*), Bash(python3 production/tools/:*), Bash(python production/tools/:*), Bash(node montage/cli.mjs:*)
---

# Reel by stages

Speak the person's language: every question, instruction (log in here, paste this, click that), approval request and summary goes in the language they write to you in; translate tool messages when you relay them. Commands, code and file names stay in English.

The why and the overview are in `production/REELS-WORKFLOW.md`. This is the procedure. On Windows, `python` instead of `python3`, here and everywhere else.

## Rules that are never skipped

1. **Every stage ends in something the creator sees or hears and approves.** The next one does not start without their go-ahead, unless they say for that piece "keep going without asking me until stage N"; that is noted in `STATUS.md`.
2. **Claude cannot hear.** Sound is measured with `listen.py` and approved by the creator by ear. Never write "sounds good".
3. **A cut never lands on the voice.** Cuts are placed by `cut.py`, not by the transcriber's timings.
4. **Nothing paid and no uploading material without telling them.** Higgsfield is never used without a quote the creator approved for that piece (stage 8). ElevenLabs, Adobe and Codex are announced before sending them any material.
5. **Never FINAL and never publish on your own:** the creator marks FINAL. Only a batch they approved in the chat goes out to Instagram (stage 12, `instagram.py approve`).
6. The brand's rules (`brands/<brand>/BRAND.md`) rule over the style.
7. **Before showing each stage, go over its block in `production/LESSONS.md`**: it is what has already gone wrong and how to avoid it. If a new lesson comes up, it goes there.
8. **Every result is reviewed in full before it is shown, no exceptions.** After every cut, render, version or resolved note:
   - run `python3 production/tools/review.py <video> --cut <piece>` (or `--script <piece>/visual-script.json`, `--text "…"`);
   - look at all its images: the walkthrough, the cuts and the eyes;
   - read what is heard and the warnings;
   - write "## What I saw" in its `REVIEW.md`.

   If something is wrong, fix it and review again. Montage blocks publishing without that review. A script that "passed" is not a review: the review is looking at the result. Reviewing comes before speed.
9. **By the hand** (`production/GUIDING.md`): the creator may not be technical. Every message says what is happening, why, what they have to do and what comes next, in short lines and without jargon. How, below.

## How you talk to the creator

It comes from `production/GUIDING.md`. In this command:

- **When a stage opens,** one line: what is done, what it is for and how long it takes if it takes a while. "Stage 3: I'm cutting your recording down to the best version of each sentence. It takes a few minutes and deletes nothing you recorded."
- **When asking for an approval,** four short lines:
  1. **What you review:** "voice cut v2 (48 s)".
  2. **Where:** the Montage link, the editor where you review (`node montage/cli.mjs open <project>` opens it and prints the link), or the file's full path.
  3. **What to look or listen for:** that stage's "Check" points, no more than three.
  4. **How to answer:** "If it's fine, type “approved”. If something isn't, leave me a note in Montage at the exact moment (you can draw on it) and press “Send to Claude”, or tell me here."
- **When the creator has to do something with their hands** (record, move a file, sign in, open an app): one step per message, with where, what to tap or type (the command ready to copy), what they will see, and "when you see it, type “done”". If they see something else, they describe it or send a screenshot.
- **Before uploading material or spending** (Higgsfield, ElevenLabs, Codex, Adobe Podcast, CapCut, After Effects): what is uploaded, where to, and what it costs, stated in the option itself, and wait for their yes. Each tool's text is in `GUIDING.md`.
- **When a step closes:** what was made, with its full path (`brands/<brand>/pieces/<piece>/…`), and what comes next.
- **If something fails:** what happened, in plain words, and a single step to fix it. Never the raw error alone, and never the same command again hoping for a different result.
- **Technical names with what they do:** "Whisper, the one that turns your voice into text"; "Montage, the editor where you review the videos".

## Before anything: prepare the computer

Always, when starting `/creator-reel` in a session:

1. Say: "I'm checking that your computer has what it needs to edit. I'm only looking; I'm not installing anything yet." Run `python3 production/install.py --check`. It only checks; if it exits with 0, everything is there ("All set.") and you go on.
2. If something is missing that does not need permission, run `python3 production/install.py` without asking. That covers: the Python libraries in `production/.venv`, the rnnoise model, the projects' `npm`, the real-sfx and openverse-audio skills, and the sound library. Tell the creator in one line what was installed: "I installed what was missing inside this folder (voice tools and sounds). I didn't touch anything else on your system."
3. If items remain under "needs permission", ask **a single** question with AskUserQuestion ("Shall I install what's missing to edit your reel?"). Include only what is missing. Each item says, in one or two short sentences, what it does for the creator, where it is used, and whether it is free or paid (and how much). The ready-made texts and the answers (install everything, recommended; one by one; not now, saying what won't work) are in the missing-programs table of `production/GUIDING.md`. With the yes:
   - **System programs** (ffmpeg, Node, Python): install them as the `creator-install-montage` skill says. The creator installs Homebrew in their own Terminal, because it asks for their password: one step per message, with the command ready to copy, what they will see, and "type “done”".
   - **Whisper model** (2.9 GB): `python3 production/install.py --with-whisper`, in the background. Say: "I'm downloading Whisper, the one that turns your voice into text (2.9 GB, free). It runs in the background: we can keep going." If they do not give permission, it downloads by itself the first time something is transcribed (stage 3), and you tell them then.
   - **instagram-agent plugin:** Claude Code offers it when the repo is trusted; if not, `/plugin install instagram-agent@instagram-agent-skill`. It is needed for the script and the copy. If they install it: "Type this in the Claude Code chat and accept: `/plugin install instagram-agent@instagram-agent-skill`. When it says it's installed, type “done”."
4. Logins and MCP servers are not requested in advance: mention them when their stage needs them, as a hands-on step.
   - After Effects (stage 6) and Higgsfield (stage 8, always with a quote) are declared in `.mcp.json`, and Claude Code asks to approve them the first time ("Claude Code will ask whether you approve “aftereffects”: choose approve"). After Effects needs "Allow Scripts to Write Files and Access Network" turned on; the step: "In After Effects, open Preferences (on a Mac, After Effects → Settings) → Scripting & Expressions, and check “Allow Scripts to Write Files and Access Network”. Type “done”."
   - ElevenLabs (stage 4, optional) is the claude.ai connector.
   - Adobe Podcast (optional) is the creator's own session in Chrome.

If a stage does not have its tool, say which one is missing and offer the alternative (for example, the local voice instead of ElevenLabs, or color with ffmpeg, free, if there is no After Effects). Never make up the result.

## Start or resume

- With no argument: `python3 production/tools/piece.py list`, and ask with AskUserQuestion "Which reel do we continue?": up to 3 open pieces (in the description, the brand, the stage it is at and what comes next) and "A new one". If there is no clear idea, `/creator-ideas` goes first: it is the creative stage. "Not sure what it's about yet? Let's find the idea with `/creator-ideas`."
- If the piece comes from `/creator-ideas`, its file `brands/<brand>/ideas/<date>-<name>.md` is the starting point for stages 0 and 1: the chosen hook, the alternates and what to record.
- Existing piece: read its `STATUS.md`, `brief.md`, `script.md`, the style (`production/styles/<style>/STYLE.md`) and the brand's rules. Continue at the **Current stage**, and say so in two lines: "We're continuing with <piece>. We're at stage 5, the visual script: I'll build a mockup so you can see the pace."
- New piece: do stage 0 and create it with `python3 production/tools/piece.py new <brand> <short-name> --type on-camera|animated|mixed --style <style>`.

When closing each stage: update the table and the log in `STATUS.md` (what was shown, what the creator said) and the **Current stage** line. To the creator, two lines: what was approved, with its path, and what comes next. "Stage 3 done: the cut is in `brands/<brand>/pieces/<piece>/voice/cut-v2.mp4`. Next is stage 4: making your voice clean and even."

## Montage

One project per piece: `<brand>-reel-<short-name>` (`node montage/cli.mjs new …`, with `brief.md` as the context). Everything the creator approves is published there as a new version, with the note starting with the stage: "Stage 3 · voice cut v2: …". The creator's notes are handled with the `creator-notes` skill.

- The first time in the piece, say what it is and how it is used: "I'm opening Montage, the editor where you review each version. Press play; if something isn't right, pause, write a note (you can draw on it) and press “Send to Claude”." Open it with `node montage/cli.mjs open <project>` and give them the link it prints.
- If Montage is not installed (there is no `montage/node_modules`, or `node`/`ffmpeg` do not respond): "To review the videos, Montage still needs installing (free). Shall I install it?", and with the yes, `/creator-install-montage`.

## Stage 0 · What piece it is

Say: "Before recording or editing, let's decide what this reel is: a few questions with options. Nothing is spent."

Ask (with options, not open-ended; up to 4 questions per call, so they go in two): type, style, how much the person appears, how much animation, duration, which voice versions to try and what is wanted from stage 8 (nothing, reference photo, light, clothes, angles, retouching). The voice and stage 8 options carry their texts from `production/GUIDING.md` (the voice table and the per-piece decisions table): what each one is for, where it is used and what it costs. Anything paid is said in the option itself. The rest, one line each:
- **Type** ("What kind of reel is this?"): on camera (you talking; it needs recording) · animated (no camera: a voice note of yours or the brand's ElevenLabs voice, paid, announced first) · mixed (recorded parts and animated parts).
- **How much the person appears:** little goes first, with "(Recommended)": the hook and cameos of about 2 s, around a third; the rest, animated scenes over their voice (`LESSONS.md`).
- **Style (identity):** first the one the brand already uses for this type of video ("Identities" in its `BRAND.md`), marked "(Recommended)". Then the others in `production/styles/` and the option to create a new one, each with one line on how it looks. A brand can have several identities, one per type of video.

Gather references: "Do you have a reel you like as a reference? Paste me the link." If they send links, download them with `uvx yt-dlp` (yt-dlp, the one that downloads videos; free) to `production/references/videos/`, make a contact sheet, measure shot changes and transcribe, as in `production/references/2026-11-13-reference-reels.md`. Fill in `brief.md`.
- **Approves:** the brief. Show it in 3 to 5 lines, with its path (`brands/<brand>/pieces/<piece>/brief.md`): "Does this work?".

## Stage 1 · Idea and script

- Talk through the idea: propose **5 to 7 options** of hook, body and call to action, as in step 5 of `/creator-ideas`, and, for each sentence, what could be seen. If the piece comes from an idea that is already closed, only redo what the creator asks for, also with 5 to 7 options. Remind the creator of what they said they wanted to see. Skills: `instagram-agent:ig-reel` (hooks and spoken script), `instagram-agent:ig-human` (so it sounds like them), `instagram-agent:ig-viral` if they ask to see what is working.
  - They go numbered, one line each, and you ask them to answer with the numbers ("hook 3, ending 1") or with what they would change. AskUserQuestion does not work here: it takes up to 4.
- Check the facts against the brand's repo. Whatever does not exist yet is noted in the brief and you ask the creator how to show it, with options; they decide (no label by default).
- The script's "Camera" column says where each push-in goes.
- Write `script.md` with the full scene table (shot, says, shows, on-screen text, camera, sound, seconds) and the counts: percentage of person on screen, number of scenes, average visual change.
- **Approves:** the script. Where: the table summarized in the chat and `brands/<brand>/pieces/<piece>/script.md`. **Check:** that it sounds like you when read aloud; what is seen and heard on frame 0 (the hook); that whatever is promised exists.

## Stage 2 · Recording (only if there is a person)

This is a hands-on step. In one message, the script's "What to record" list and the short guide (it comes from `LESSONS.md`):

> **While recording**
> - One continuous take.
> - Press record and stay silent for 2 seconds before talking; at the end, another 2 before stopping.
> - The same distance to the microphone in every take.
> - Look at the camera while you talk, not at the screen or a sheet of paper.
> - Half a second of air between sentences.
> - If a sentence comes out wrong, repeat it right there, in full.
> - At the end, 2 or 3 extra openings: another first sentence, another shot or another place (they are for the variations).
>
> When you finish, type “done”.

In the next message: "Move the video to the computer and drop it in this folder, which I'm opening now: `brands/<brand>/pieces/<piece>/source/`. When it's there, type “done”." Open the folder for them (macOS `open <folder>`, Windows `start "" <folder>`, Linux `xdg-open <folder>`). The footage goes in `source/`, untouched. When it arrives: "I got `<file>` (2 min 14 s). Now I'm cutting the voice."

**Real material for the scenes.** If `brands/<brand>/stock/` is empty or not enough for the script, ask for it in a separate message, with what's useful for this piece:
- photos of them working;
- 10 to 30 s timelapses with the phone (their hands, their desk, their team);
- captures of the tools they name;
- videos they cite.

It goes in `brands/<brand>/stock/`. Before using anything, watch all of it: only what doesn't look like home, unless the brand wants it. Team members can appear if the person says so.

## Stage 3 · Voice cut

Say: "I'm turning your voice into text with Whisper, on your computer (nothing is uploaded), and building the cut with the best version of each sentence. It takes a few minutes." If Whisper is not there yet, first the notice about its download (2.9 GB, free).

```bash
python3 production/tools/prepare.py <piece> --names "<the brand's proper names>"
```

1. Read `work/TRANSCRIPT.md` and check it against the script. Pick the best version of each sentence **by the voice and by the picture**. If it was repeated, take the one heard complete with no slip and where the person looks at the lens with the gesture complete (not reading or looking down). If the best voice doesn't work on camera, keep the voice and mark that sentence to be covered with animation in stage 5. Note in the log what was said differently from the script, and tell the creator in a short list ("Three sentences came out different from the script; they stay as you said them: …").
2. Write `<piece>/cut.json`:
   - `phrases` in order;
   - `corrections` for mistranscribed words;
   - `names` for the word check;
   - and, only if needed, `adjustments` (where a phrase really starts when the transcriber mixed it with another).

   If a phrase lasts long for its words, it was most likely said twice inside: transcribe that stretch again and use the clean version.
3. `python3 production/tools/cut.py <piece>`. By default it edits the way that was approved on "Tres semanas" (16 Nov 2026):
   - **Silero VAD,** the speech detector that ships with Whisper, decides what is voice. Each segment is trimmed to it, without breaths, noise or echo, and stretched over the "s" at the edges.
   - **YouTube jump cuts:** 0.12 s of air between sentences.
   - **Even pace:** what was said slowly or "sung" is sped up to 5.8 syllables per second, capped at 1.2x. The timbre doesn't change.
   - **Automatic check:** it looks for gaps without voice longer than 0.3 s and transcribes the finished cut to compare it word by word with what was expected.

   Read the warnings before showing anything. Tell each one to the creator in plain words and with the second ("At second 12 you can hear “hands”: that's how you said it"), and don't hide it. If the creator or the brand want another pace, change it in `cut.json` (`pause_between_segments`, `pace`, `vad`). Example, for instance, preferred 0.45 s of air.
4. **Review the cut by the picture and by the voice, always, before showing it:**
   - `python3 production/tools/gaze.py <piece>` checks every piece of the cut and leaves `voice/gaze-vN.jpg`: the eyes up close, piece by piece, green when looking at the lens and red when not. Claude looks at the whole sheet. Pieces where the person doesn't look, reads, leaves the frame or is blurry can't go on camera.
   - `python3 production/tools/review.py <piece>/voice/cut-vN.mp4 --cut <piece>` reviews the whole cut:
     - the walkthrough, every cut and the eyes;
     - what is heard against what was expected;
     - dead pauses, clipped words and cuts inside a word.

     Look at all its images and write "## What I saw".
   - Fix whatever is wrong (a clipped word, a cut in the middle of a gesture, a stretch where they read) in `cut.json` and review again.
5. Publish `voice/cut-vN.mp4` to Montage (raw takes cut together, original audio leveled). With it, in one line: what was reviewed and which sentences can't go on camera and why ("In “I always edited…” you look down: it goes with animation").
- **Approves, by ear:** nothing missing or extra, and no word clipped. **Check:** listen all the way through, with headphones if you can: no sentence missing or extra, no word clipped at the start or the end, and a pace that sounds neither rushed nor sung. If they want it faster or slower, offer two `pace` intensities to compare. If they ask for changes, edit `cut.json` and `cut-v(N+1)` comes out.

## Stage 4 · Voice

Say: "I'm making your voice clean and even, on your computer. If you chose to try Adobe Podcast or ElevenLabs, I'll tell you before uploading anything."

```bash
python3 production/tools/voice.py <piece>
```

It leaves two versions (`original`, leveled, and `local`, cleaned) and `voice/cut-vN-to-enhance.wav`. It levels **sentence by sentence** (it corrects the mic being closer or farther) and matches the tone between takes.

External versions, only the ones the brief picks for that piece:

| Version | Who makes it and how | Cost and notice |
|---|---|---|
| ElevenLabs (voice isolator) | Claude, with the ElevenLabs connector: creates a flow, uploads `to-enhance.wav`, `voice-isolator` node, downloads the result to `voice/external/elevenlabs.wav` | Uploads the audio and spends credits: tell them first. Paid: it has a free plan with a few minutes a month |
| Adobe Podcast (Enhance) | Claude, **driving the browser** (Claude in Chrome): opens podcast.adobe.com/enhance with the creator's session, uploads `to-enhance.wav`, waits and downloads the result to `voice/external/adobe.wav`. Adobe has no programmatic access | Free for about 1 hour a day. The creator must be signed in on Chrome; Claude does not type passwords |
| CapCut (enhance voice) | The creator by hand, or Codex with its computer use (see stage 8) | Their Pro plan |

What you tell them, one step per message:
- **ElevenLabs:** "To clean your voice with ElevenLabs I'll upload `voice/cut-vN-to-enhance.wav` (40 s) to your account; it spends credits from your plan. Shall I upload it?"
- **Adobe Podcast:** "Open Chrome at podcast.adobe.com/enhance and sign in with your Adobe account. When you're in, type “done”: I'll upload the audio."
- **CapCut by hand:** open CapCut; import `brands/<brand>/pieces/<piece>/voice/cut-vN-to-enhance.wav`; apply "Enhance voice"; export the audio to `voice/external/capcut.wav`; "done".

Each one is brought in with `voice.py <piece> --external <name> <file>`, which levels it the same way and measures it. Publish all of them to Montage in a single version.
The chosen version always goes through `python3 production/tools/match_timbre.py <piece> <voice.wav> <voice-v3.wav>`. It matches the timbre per take (mic closer = more bass) and gives it presence. Without it, in "Sin anotar" (an earlier Spanish-language reel) there was an audible jump in the voice at 8 s and the voice sounded dull and monotone. Check that the timbre spread goes down.
- **Approves, by ear:** which one stays. **Check:** the versions one after another, with headphones: every word understood, not metallic or dull, no change from one take to the next. They answer with the name ("original", "local", "adobe"…). If they pick the same one two pieces in a row, note it as the usual one in `production/REELS-WORKFLOW.md`.

## Stage 5 · Visual script

Say: "I'm building a mockup: your voice with gray cards where each animation will go, so you approve the pace before anything is built."

- **How much the person appears.** If `brands/<brand>/BRAND.md` doesn't say, ask once per brand, with options:
  - a lot, 60 to 70 % (the person tells it and the animations support);
  - half, 40 to 50 %;
  - little, 20 to 30 % (mostly animation);
  - "you decide from the takes".

  Save it in the brand's `BRAND.md` and in `scenes.json` as `person_target` (0.45 = 45 %). With "you decide", the person appears in their best moments: the hook, what they tell first-hand and the call to action. Always in pieces that `gaze.py` marks as fit.
- **Where the person appears, by the picture and not only by the voice:**
  - only in pieces where they look at the lens (`voice/gaze-vN.jpg`);
  - never a shot of them shorter than 0.6 s (a micro cut);
  - never frames from another moment at the start or end of the take (`visual_script.py` cuts at the piece);
  - if they keep talking and looking at the camera, they're not cut mid-sentence: the cut goes after (`"starts": "<phrase>:<i>:end"`);
  - if they point or make a gesture, the edit follows it: the animation appears where they point.
- Write `<piece>/scenes.json` from the table in `script.md`. It is the **visual plan, phrase by phrase**, with the method and the recipes in `production/REELS-QUALITY.md` (parts 3 and 4). Per scene:
  - `shot`, `starts` (phrase and word, e.g. `T03-01:0`), `shows`, `text` and `camera` (`snap`, `slow` or `still`);
  - `recipe`: the kind of phrase, from the recipes table;
  - `material`: the real file, fact, capture or logo that tells it. If there is none, ask the person for it before inventing anything;
  - `accent` or `accents`: the key words, where the zoom punch lands.

  And `voice`: the version chosen in stage 4. `visual_script.py` warns about every scene without the person that has no `material`.
- `python3 production/tools/visual_script.py <piece>` puts in the real timings and leaves `visual-script.md`, `visual-script.json`, `image/blocks.json` and the counts.
- `visual_script.py` warns when a person scene lands on a piece that isn't fit and when the share drifts more than 10 points from the agreed one. Resolve each warning:
  - change the scene;
  - or look at the sheet and write in `gaze_ok` why it stays ("squints while talking, but looks at the lens").

  Don't move on with unresolved warnings.
- Check the counts against the brief: percentage of person on screen and a visual change every two to three seconds. Also check that each scene lasts as long as what it shows takes to be seen (stage 7 block of `LESSONS.md`): mark the ones too short for their text or shot right away.
- Write `image/blocks.json`: one block for each `CAMERA` or `CAMEO` row (`id`, `start`, `end` in piece seconds, `what`). From here on you know how many seconds the person appears; run `python3 production/tools/quote.py <piece>` and note the result in `STATUS.md`, for information only. If the brief asked for something from stage 8, tell them in one line: "You're on screen for 9 s. With AI, that would cost about N credits; it's just so you know, nothing is spent now."
- Make the **mockup**: `python3 production/tools/mockup.py <piece>` (the `Mockup` composition in the brand's Remotion project: the voice, the real take in the blocks, gray cards in the scenes, push-ins and captions; at half resolution). Review it in full with `review.py <mockup> --cut <piece>` (all its images and "What I saw") and publish it with one marker per scene.
- **Approves:** the pace and what is seen on each sentence. **Check:** in Montage, that every sentence has something to look at, that something changes every 2 or 3 s, and that you appear where the brief says. The gray cards mark places, not the design yet.

## Stage 6 · Base image of the person (only if there is a person)

Say: "I'm adjusting the color and framing of your takes so they look natural, only in the moments where you appear." After Effects is paid (the creator's Adobe subscription): if they do not have it or it is not connected, say so and offer color with ffmpeg, free. If it is there, the hands-on step: "Open After Effects and leave it open. If Claude Code asks whether you approve “aftereffects”, approve it. Type “done”." (and, if needed, the scripts permission from "Before anything", in another message).

Only the blocks in `image/blocks.json`, with half a second of tail on each side: `python3 production/tools/blocks.py <piece>` cuts them to `image/blocks/B01-raw.mov`… and notes which take and second each one comes from.

- **Color and framing:** After Effects via MCP (`aftereffects`): one composition per block, Lumetri Color and reframing, render through the queue. The project stays in `image/<name>.aep`. Verify with `ae_render_frame` before rendering.
- **Separate the person from the background:** `node production/tools/cutout-person.mjs <piece>` (local, `@remotion/video-matting`; nothing is uploaded) leaves `B01-v1-front.webm` with transparency. With that, the kit's `Person` piece (`brands/<brand>/reel/src/kit/Person.tsx`) puts the big word behind the head. The background is not treated differently from the person: darkening or blurring it makes the cutout's errors visible (blotches on clothes, a halo in the hair). Any image effect goes on top of everything, evenly. The person's color stays natural: the epic feel comes from the word, the push-ins and the animation, not from a harsh grade.
- **Check at full size before showing:** 100% crops of the face, the beard and the hair edge of each block, against the raw. No crushed blacks, no halo around the hair, no blotches on clothes. To check every frame: a difference map (`blend=all_mode=difference`) between the color-graded block and the result; only what was added on purpose should change.
- **Show it as video, not as stills:** the blocks back to back with their voice, one side by side (before and after) and another with only the after (the `PersonTest` composition with `frames` in the props, joined with ffmpeg). The creator does not take a sheet of still frames as a deliverable.
- Avoid AE's Glow effect to "add shine": it makes the image milky.
- The animation always uses the highest version of each block (`B01-vN.mp4`): whatever is done later in stage 8 goes in by swapping the file and rendering again, without touching the animation.
- **Approves:** the before and after, in those two videos. **Check:** that skin and color look natural, with no crushed blacks, no halo around the hair and no blotches on clothes.

## Stage 7 · Animation

**The default rhythm is YouTube's** (the creator, 16 Nov 2026, "like MrBeast, Germán Garmendia"), unless the brand says otherwise:
- the scene changes every 1 to 2 s;
- every time the person is on camera, the cut jumps with an alternating zoom (100 % and 115 %), so the jump feels deliberate; always looking at the lens;
- texts are 1 to 3 words and come in with a hit and a sound;
- screens (apps, editor, terminal) are recreated as motion graphics from a screenshot, not recorded;
- everything is fast, but each thing stays just long enough to be read (rhythm pass, below).

Say: "Now I'm animating the reel. First I'll show you the 2 or 3 hardest moments on their own; with your go-ahead, I'll do the rest."

**Build it in sections, each one approved:** the hook, the first stretch of full-screen scenes and the rest. In a long video, one section every 30 to 40 s, with a new visual hook every 20 to 30 s. **Before showing each section**, do the self-critique: the video scene by scene against "## Visual floor" and against the traps in `REELS-QUALITY.md`, and fix whatever fails first.

**Before animating, read three things; they rule over everything below:**
- all of `production/REELS-QUALITY.md` (the floor, the recipes and the first-version traps), which is the floor of every identity;
- the `STYLE.md` of the brand's identity for this type of video ("Identities" in its `BRAND.md`), with its list of yes and no;
- its kit in `brands/<brand>/reel/` (for "glass", the generic one is in `brands/example/reel/src/glass/`, with its README).

What's named is shown with its real logo or image, which go in `brands/<brand>/reel/public/logos/` and come from `simple-icons` or `@lobehub/icons-static-svg` (the glass kit's `Logo` draws them). Higgsfield comes last, with a quote. With an approved identity, the person only gives their video and their opinions; Claude builds the full reel in that style. For each scene, find the real material that tells it: the `stock/`, the repo's data, real captures (Montage with Playwright, pages with headless Chrome). Only then build it.

If the brand doesn't have an identity for this type of video yet, find it with the person scene by scene. Start with the hook and save what they approve in a new `STYLE.md`.

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
- **Rhythm pass, before showing the full edit.** Go scene by scene:
  - every text, number and shot gets its time on screen to be read and understood;
  - no dead pauses are left.

  Where it falls short, hold the shot, cut the text or move the cut. Note what was adjusted and why in `STATUS.md`. The starting values are in the stage 7 block of `LESSONS.md` (the creator, 16 Nov 2026).
- **Approves:** the hard moments; then the full edit without the final sound (tell them the sound arrives in stage 9). **Check:** that everything comes in with intent, that nothing covers the face or the captions, and that the text reads at phone size.

## Stage 8 · AI and retouching of the person (optional)

It goes here because by now you know exactly how many seconds the person appears. Skip it entirely if the brief asks for nothing, and say so in one line: "Stage 8 (AI and retouching) is skipped: you chose your video without AI. Moving on to sound." Order matters: first what regenerates the video (Higgsfield), retouching (CapCut) last, because a regeneration wipes the retouching.

### 8a · How they want to look (reference photo, with Codex)

If the creator wants different clothes, different light or a different angle:

1. Claude pulls a clean frame from each block (`image/reference/frame-B01.png`).
2. Writes the task in `image/reference/task.md`: what to change (clothes, light, angle), what not to touch (face, features, hair, expression), 9:16 format, and where to save the images.
3. First, the notice: "For the reference photo I'll send a frame of you to Codex, which uses your ChatGPT plan: the photo goes out to OpenAI under your account. Shall I send it?" With the yes: `python3 production/tools/codex.py <piece> image/reference/task.md image/reference/frame-B01.png`. Codex generates the images with the creator's ChatGPT subscription. The photo goes out to OpenAI under their account.
4. Show them to the creator, in Montage and with the `image/reference/` path. **Approves:** the photo of how they want to look. **Check:** that it is them (face, features, hair, expression) and that the clothes, light or angle are the ones they want.

### 8b · Quote (required before any generation)

1. `python3 production/tools/quote.py <piece>` gives the billed seconds and the price per option.
2. Upload the blocks to Higgsfield (`media_upload`) and confirm the real price of each job with `generate_video` and `get_cost: true`. Uploading means sending the video to Higgsfield: say so in the same message, before uploading ("To give you the exact price I'll upload your N blocks (X s of video) to Higgsfield. I'm not generating anything yet").
3. Present the quote: blocks, billed seconds, draft and final at 720p and 1080p, credits and approximate dollars, and the remaining balance (`balance`). Clothes, light and retouching in a single instruction are one pass. It goes as a question ("What do we do with AI on your image?"): each option with its price in credits and approximate dollars, and last "Nothing for now: the video keeps the stage 6 color. Free".
4. **Approves:** the option and the spend. Without that yes, nothing is generated. If the balance is not enough, say so and wait.

### 8c · Draft and final

- **Draft first** (480p, `draft: true`, about 3.5 credits per second) of a single block, usually the hook. Review it: face, lips and movement the same as the original. **Approves** the draft, watching it side by side with the original in Montage.
- **Final:** finish that draft (`draft_job_id`, billed at the full final resolution) and make the other blocks with the same instruction. If a block comes out different, say so and offer a single retry, quoted.
- Tools: `seedance_2_5` with `mode: video_edit` for light, clothes described in words, and retouching (the `lighting-hf` workflow for the 62 lights); `hf_mult_replace_object` to swap the clothes for the ones in the 8a photo; for a new angle, `seedance_2_5` in `video_edit` asking for the shot (close-up, from above) or `hf_mult_motion_control` with the 8a angle photo and the original block as the motion. The result comes back without sound and at 24 frames: put the original audio back on and convert it to 30 fps.
- Results in `image/blocks/B01-v(N+1).mp4`, and the stage 7 render is repeated.

### 8d · Retouching in CapCut

Paid: CapCut's Pro plan. Ask first whether they have it (`LESSONS.md`: the creator did not, in Nov 2026); without it, skip this and say so: the image keeps the stage 6 color.

Claude leaves the blocks in `image/to-capcut/`. The creator's saved retouch preset is applied and they are exported with the same name to `image/from-capcut/` (1080 × 1920, 30 fps, no text or music). Who does it, in this order of preference:

1. **Claude with computer use** (what the creator prefers). From VS Code or the terminal there is no computer use, so it is done by a session of the Claude desktop app:
   - If this session already runs in the desktop app with Computer use turned on, it does it itself: it asks for access to CapCut (`request_access`) and works with the background tools (`app_*`) so it does not take over the creator's screen.
   - If this session runs in VS Code: Claude writes the task in `image/to-capcut/TASK.md` (files, retouch preset, export format, output folder) and asks the creator to open the desktop app in the code tab, on this repo, with Computer use turned on. It can open the app for them (macOS: `open -a Claude`; Windows: `start "" claude:` or from the Start menu), but it cannot create the session or turn on computer use for them. One step per message: "I opened the Claude app for you: go to the code tab" · "Open this folder: <repo path>" · "Turn on Computer use and type “done”". When the session shows up in `ListAgents`, Claude sends it the task with `SendMessage`. A desktop app session does not report when it is done: Claude checks `image/from-capcut/` until all the files are there, and says so ("The other session is in CapCut; I'll tell you when the N blocks are in").
2. **Codex with its computer use:** the same task with `codex.py`. The first time, with the creator watching.
3. **The creator by hand**, one step per message: open CapCut; import the videos in `brands/<brand>/pieces/<piece>/image/to-capcut/`; apply their saved retouch preset; export them with the same name to `image/from-capcut/` (1080 × 1920, 30 fps, no text or music); "done".

Claude checks that each file has the same frames and duration, copies it as `B01-v(N+1).mp4` and repeats the render.

- **Approves:** the before and after of each step, as side-by-side video (not loose stills).

## Stage 9 · Sound

Say: "I'm adding the effects and the music. I can't hear: I measure, and you approve by ear."

**The order** (how the first full reel made in "glass" came out, Nov 17, 2026):
1. The effects with `real-sfx`, from the code's list of moments (not guessed from the video) and in self-critique rounds.
2. Compare word by word the voice alone against the mix (Whisper). No effect may cover a word.
3. A listening test with 3 or 4 trending Instagram songs (`instagram.py audios`, see `production/variations/MUSIC.md`). The creator chooses and the reel is posted with the song added through the API.
4. The version with CC0 music for TikTok and YouTube.

- Effects with the `real-sfx` skill (which sound for which moment and where to get it: `openverse-audio`; in HyperFrames projects, `hyperframes:media-use`) (list of moments from the map). Which sound goes at each moment and which ones we do not use: `production/SOUNDS.md`. Music only with a verified license: the `openverse-audio` skill, credits next to the file.
- Rules: a sound on everything that moves; none in the emotional part; they must be heard on a phone without covering the voice.
- Levels and hook: follow "Sound rules" in `production/REELS-WORKFLOW.md`. Summary:
  - effects about 5 dB below the voice (`balance` around −5);
  - a hit on frame 0;
  - a riser before the big hit;
  - music with its own 2:1 ducking (about 3 dB), never `--duck-music`, and no automatic swells at the end;
  - a sheet with the sounds per file.

  All of `critique.py`'s axes scoring 9 does not mean the creator will like it: in v13 everything was at 9 or 10 and they said nothing could be heard.
- Also deliver the video at 1.08× and 1.12× (`setpts` + `atempo`) if the voice sounds monotone, and a version without music so the trending song can be added from Instagram. With the speeds, the question is "Which speed stays?": normal, 1.08× or 1.12×.
- `python3 production/tools/listen.py <piece> <mix>`: the mix must be understood as well as the voice alone (same percentage of words) and land at −14 LUFS. Tell them what was measured, not a verdict: "Measured: −14 LUFS, and the same percentage of words is understood as with the voice alone. Your ear is what's left."
- **Approves, by ear:** the mix. **Check:** on speakers and with headphones (and on the phone, if they can): the voice always understood, every effect heard without covering it, and no music swell at the end.

## Stage 10 · Review

Before publishing each version, the **full review** with `review.py <final video> --cut <piece>`:
- look at all its images: the walkthrough, every cut, the eyes and the faces;
- read what is heard;
- write "## What I saw".

Montage won't publish without it. On top of that come two passes: one for cuts and captions (frames at every shot change, at full size) and another for hook and pace.

Plus a **fixed final checklist**:
1. Duration and resolution (1080×1920, 30 fps).
2. The topic is seen and heard before second 1, also without sound.
3. Captions are in time with the voice, readable on a phone and never over a light background.
4. Nothing covers the face: `python3 production/tools/faces.py check <video>`. If there is a warning, look at the sheet it leaves and fix it.
5. Loudness at −14 LUFS and the voice above the music (`listen.py`).
6. Zero spelling mistakes, and proper names written correctly.
7. No third-party logos, brands or material.
8. **Cover:** `faces.py cover <video> --n 3` leaves 3 candidates with their second.
9. **Time on screen:** watch the whole video at normal speed.
   - Every text, number and shot can be read and understood.
   - Nothing goes by so fast that you have to pause.
   - There are no gaps without voice or movement.

Do not hand the creator the whole list: one line with the result ("I checked the 8 points of the final checklist: all good") or only what failed and how it gets fixed ("A caption sits over a light background at second 14; I'm fixing it"). The cover goes as a question ("Which cover?"): the 3 candidates, with their second and their path.

Then publish to Montage. **Approves:** the full video, with the usual answer ("approved" or notes). Remind them: "When you consider it done, mark it FINAL in Montage or tell me here: that's your call." Each of the creator's notes goes back to its stage (a cut they don't like is stage 3; a color, stage 6; a face, stage 8) and only what depends on it is redone.

## Stage 11 · Delivery

When the creator calls the video done (they say it in the chat or mark FINAL), build **the final folder** `brands/<brand>/finals/<project>/`. It is the only place where they look for the video. Give them the path and open it for them (macOS `open <folder>`, Windows `start "" <folder>`, Linux `xdg-open <folder>`): "Your finished video is in `brands/<brand>/finals/<project>/`, with the text to post it, the cover and when to upload it. I'm opening the folder."
- **The video to publish,** with a clear name (`<name>.mp4`). If there is a version without music, it goes next to it (`<name>-no-music.mp4`).
- **`copy.txt`:** the description, with `instagram-agent:ig-caption`, reviewed with `ig-human` and `caption.py`. **Short: two lines and no hashtags** (the creator, 14 Nov 2026). One sentence that names the problem in the words people search for, and the call to the link in bio. No links in the text. When the copy is not in English, `caption.py`'s "no call to action" warning is a false alarm. Show the two lines in the chat: "approved" or what to change.
- **`suggested-cover.jpg`:** a sharp frame with the key text and the face looking at the camera.
- **`PUBLISH.md`:** which file to upload, when (day and time in the audience's time zone, with the reason), what to check first (the link in bio), and replying to comments in the first hour. While the account has no data of its own, the time is a general recommendation (weekdays 12:30 p.m. or 7:00 p.m.). If the topic names a day, that day. After that, the time comes from Insights.
- With FINAL marked, Montage also generates the per-network variants (deliver). It is recorded in the brand's `BRAND.md`.

**Other networks.** If the brand has Facebook, YouTube or TikTok connected (`python3 production/tools/connect.py status <brand>`), offer to upload the FINAL there. It goes with the creator's yes for each network, the privacy and the time, and what they said goes in `--approved`:
- `facebook.py upload <brand> <video> --copy "…" [--schedule <time>]`;
- `youtube.py upload <brand> <video> --title "…" --privacy public|unlisted|private [--schedule <time>]`;
- `tiktok.py upload <brand> <video> --copy "…"`: it lands in drafts and the creator posts it from their phone, with the sound they want.

How to ask: "Where else shall I upload it?", multiple choice and only the connected networks, with their texts from `GUIDING.md` (publishing and measuring; all three are free). Then, for each chosen network, the time (now or scheduled) and, on YouTube, the privacy: public (anyone can see it) · unlisted (only people with the link) · private (only you). On TikTok, after uploading, the hands-on step: "On your phone, open TikTok and tap the “your video is ready” notification (or Profile → Drafts). Pick the sound, paste the text and post."

If a network isn't connected, `/creator-connect`.

After stage 12 (variations), the **cleanup** (the creator's rule: the computer must not fill up):
1. `python3 production/tools/clean.py <piece>` shows what it would delete and what stays: the piece's text and code, the final voice, the raw takes and the FINAL.
2. Show the summary to the creator, as a question: "Shall I free up space on your computer?" · "Yes, clean up": I delete the in-between files (with the GB `clean.py` reports); the final video, the final voice, what you recorded and the script stay; it cannot be undone · "Not yet": I leave everything as it is.
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

Say when starting: "Now I'll make 3 to 5 versions of your video, each with a different opening, to test them with people who don't follow you. You see them as drafts first; nothing is posted without your yes."

### 12a · Diagnosis and drafts (the creator approves by watching the drafts)
1. Read `PROMPT.md`, `LEARNED.md` and `MUSIC.md` in full.
2. **Diagnosis of the finished video** (step 1 of `PROMPT.md`):
   - if it has already been published, real metrics from the API (skip rate, average watch time, shares) compared with the account's other reels, and the screenshot of the retention curve the creator sends (hands-on step: "In the Instagram app, open the reel, go to its insights and send me a screenshot of the retention graph here");
   - the contact sheet of the first 4 s;
   - this week's trends (`TRENDS.md`, renewed after 14 days).

   What comes out is **the earliest failure**, with its data point, said in plain words: "59% leave in the first 3 s: the topic arrives at second 2.8."
3. Write `<piece>/variations.json`: 3 to 5 re-edits, each one a different angle that fixes that failure (`segments`, `pause`, `freeze_at`, `open_with`, `music`, an effect), with its new voice script.
4. `python3 production/tools/variations.py <piece> <piece>/variations.json --draft`: 540p drafts in seconds, no batch. Look at the frames of each new join and the first 3 s; publish them to Montage (`<brand>-variations-<name>`) with the openings sheet.
5. **Approves:** the drafts, by watching them. With changes, only the one that changed is redone. A plan is never approved in text alone. **Check:** the first 3 s of each one: that they fix the failure and don't look alike. They answer "approved 1, 3 and 4" or with notes in Montage.

### 12b · Production
1. With the yes, fill in the `day` and the `time` of each one in `variations.json`.
2. `python3 production/tools/variations.py <piece> <piece>/variations.json` (without `--draft`). It leaves them at final quality in `brands/<brand>/finals/<project>/variations/`, with `batch.json`. The ones that already exist and were approved as they are carry `keep`.
3. Your own review (the stage 12 block in `LESSONS.md`):
   - the first 3 s of each one at full size;
   - no two alike in the first 2 s;
   - loudness at −14 LUFS.
4. Publish them to Montage in a single version, and say where they are (`brands/<brand>/finals/<project>/variations/`).

### 12c · Batch (the creator approves in the chat)
1. `python3 production/tools/instagram.py preview <batch>` shows what goes out and at what time.
2. The creator approves **the exact batch: videos, copies, day and times.** Without that message, nothing is scheduled. Show it as a short table (video · copy · day · time) and say: "If you approve it as is, type “I approve the batch”; if not, tell me what to change."

### 12d · Publishing
1. `instagram.py approve <batch> --message "<what the creator said>"` and `instagram.py schedule <batch>`. The computer stays on and connected until the last time slot, and only one computer schedules each batch. Say: "Leave this computer on and online until <last time>; if it shuts down, the remaining ones won't go out on time."
2. They go out as **trial reels**, for non-followers only, with manual graduation. Before scheduling, confirm the account has them (see `CALENDAR.md`). The creator checks it, as a hands-on step: "In the Instagram app, start sharing a reel (without posting it) and see whether the “Trial reel” toggle shows up. Tell me “yes” or “no”." **If it doesn't have them, they are not posted** (the creator, Nov 15, 2026: "I need the trial one or nothing"): the variations stay ready in `finals/<project>/variations/` with the batch unapproved, and you tell them so.
3. The ones marked `manual` (trending song) are uploaded by the creator from the app at their time: remind them with the file and the copy ("At <time>, upload `<video path>` from the Instagram app with this text: …, and add the song there").

### 12e · Results and learning
1. The 24- and 72-hour metrics are saved by the computer's watcher on its own (`instagram.py watcher status`): it runs every hour, does not use Claude, writes them into `batch.json` and sends a notification. Claude does not sit waiting: when the creator comes back, they are read from the batch (`instagram.py results <batch>` also fetches them on the spot).
2. At 72 h, fill in `LEARNED.md`: one row per variation and the batch's conclusion.
3. Tell the creator which one did best with non-followers, with its data point, so they graduate it to their followers in the app (Thursday, 7 p.m., per `CALENDAR.md`): "v3 won (<its data point>). On Thursday at 7 p.m., in the Instagram app, open that trial reel and share it with your followers."
4. What wins in two batches moves up as a rule to `PROMPT.md`, `MUSIC.md` or `CALENDAR.md`, with a date.
5. Only then, the stage 11 cleanup.

## Animated pieces

No stages 2, 3, 6 or 8. The voice is the brand's ElevenLabs voice and the map comes from that voice, as in `brands/example/reel/README.md`. Generating it spends ElevenLabs credits and sends them the script: announce it first, with how many seconds of voice it is, and wait for the yes.

## Express mode: the daily reel

For publishing almost every day without lowering quality. It has **two approvals**: the idea with its script, and the finished video. It is used with the ideas from `/creator-ideas` and with what `/creator-pulse` says. Big pieces, on camera and with custom animation, follow the full flow above.

Say when starting: "Express reel: you approve it twice, the script now and the finished video at the end."

**A · From a voice note** (no camera):
1. The creator records a voice note on their phone following the idea's script and drops it in `<piece>/source/`. The piece is created with `piece.py new <brand> <name> --type animated`. One step per message: "Record a voice note on your phone reading this script: 2 seconds of silence at the start and at the end; if a sentence comes out wrong, repeat it right there. Type “done”." · "Move it to the computer and drop it in `brands/<brand>/pieces/<piece>/source/` (I'll open the folder). Type “done”."
2. Cut and voice, as in stages 3 and 4, but without a separate approval: `prepare.py` (accepts audio files), `cut.py` and `voice.py`.
3. Claude writes `<piece>/explainer.json`: the scenes with the word timings. The types are title, number, list, clip (own footage), app and outro (`production/tools/note.py`).
4. `python3 production/tools/note.py render <piece> --draft` and then without `--draft`. It brings wipes, an opening hit, optional music (`--music … --align …`), −14 LUFS and 3 candidate covers.
5. The fixed final checklist from stage 10, and Montage. **Approves:** the video, as in stage 10.

**B · With the creator's footage** (them talking, or the street): the take goes in `source/`, and stages 3 and 4 follow. The image is the person with captions, plus 1 or 2 explainer scenes or clips from the library, with no custom animation. Same as before: final checklist and Montage.

**Everything that gets recorded**, even if it is not used today, is dropped into `library/inbox/` and catalogued with `library.py add`. That is how the own-footage base grows. Tell them: "Whatever you record, even if we don't use it today, drop it in `library/inbox/`: that's how your footage library grows."

## How this grows

- **New style** ("let's implement this style"): analyze the reference as in stage 0, write `production/styles/<name>/STYLE.md` using the existing one as the template, and build its Remotion kit in the first piece that uses it. While it's being found, what the creator approves is saved in its `STYLE.md`, scene by scene. When the creator calls it theirs, it's recorded under "Identities" in the brand's `BRAND.md`: which type of video carries that identity.
- **New rule from the creator:** if it is about visual quality (what is seen, how it moves), to `production/REELS-QUALITY.md` (the floor, a recipe or a trap); if it is about the process and applies to every piece, to `production/REELS-WORKFLOW.md`; if it belongs to a style, to its `STYLE.md`; if it belongs to a brand, to its `BRAND.md`. And to memory if it changes how the work is done.
- **New tool:** to the table in `production/REELS-WORKFLOW.md` and to the stage it belongs to here.
- **A stage that is unnecessary or missing:** change it here and in `production/templates/STATUS.md`.
