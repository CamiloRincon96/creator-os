# What doesn't happen twice

A checklist of everything that went wrong in this repo and how to avoid it. It applies to every brand. It matters most in reels with a person on camera.

**When to read it:**
- before starting a piece;
- when closing each stage: go over that stage's block before showing the creator anything.

Each rule says where it came from. When a new rule comes up, add it here in one line, under its stage, and not in any other document.

Where everything else is:
- how each stage is done: `production/REELS-WORKFLOW.md` and the `/creator-reel` command;
- the visual style: `production/styles/<style>/STYLE.md`;
- each brand's rules: `brands/<brand>/BRAND.md`.

## Always

- **The creator approves each stage before the next one is built.** v1 of "Sin anotar" (the example reel, Spanish for "Not written down") was made in full without them hearing the cut or seeing the plan, and it came out "one of the worst".
- **Claude can't hear.** The measurements (`listen.py`, `critique.py`) are a floor, not the goal. In v13 everything scored 9 or 10 and the creator said nothing could be heard. Never write "it sounds good": say what was measured and what they should listen for.
- **Visuals are shown as video**, not as stray frames ("you showed me some photos").
- **Review at full size and in motion before publishing:**
  - frames at every scene change;
  - 100 % crops;
  - the whole scene, because what moves (the face, the camera) changes from frame to frame.
- **Never mark FINAL or post to social media:** the creator decides that.
- **Nothing paid and no uploading material without saying so.** Higgsfield only with an approved quote. ElevenLabs, Adobe and Codex are announced first.
- **Licenses:** music and effects only with the license confirmed on the source page, because Openverse gets it wrong: it marked as CC0 a sound that is CC BY on Freesound. Credits go in `credits.json`, next to the file. Whatever fails is banned (`taste.py ban`).
- **Trending songs:** never go inside the video. Deliver a version without music and the creator adds the song from Instagram. If the account is a business account, Instagram only allows its royalty-free library.

## Stages 0 and 1 · Piece and script

- **Little of the creator on screen:** hook and cameos of about 2 s, around a third of the piece; the rest, animated scenes with their voice. v1 had them on camera almost the whole time.
- **Labels like "Coming soon" only if the creator asks for them.** They decide how something that doesn't exist yet is shown ("I'm the one in charge here").
- **What you promise has to exist:** if the piece says "pre-register", the link leads there.
- **The hook is designed in the script:** what's seen and what's heard at frame 0. In v13, "the zero hook".

## Stage 2 · Recording

- Two seconds of silence after hitting record and before stopping: with the Bluetooth microphone the audio comes in late.
- The same distance to the microphone in every take. Closer = more lows; in "Sin anotar", take 2 made an audible jump.
- Leave a breath between phrases, half a second. The cut guarantees it anyway (stage 3).

## Stage 3 · Voice cut

- **The cut never lands on the voice.** It's placed by `cut.py` measuring the audio, never by the transcriber's timings. In v1 two cuts ate the end of a word.
- **Air at the end:** `final_tail` 0.7 s. Without it, the ending stops dead.
- **Air between takes:** `pause_between_segments` 0.45 s. If the margins give less, `cut.py` adds silence. In "Sin anotar" the gaps were 0.3 s and "it was all like boom, it went straight through".
- The transcriber's `initial_prompt` only gets the proper names. With the whole script in it, Whisper skipped the first phrase.

## Stage 4 · Voice

- **The chosen version always goes through `match_timbre.py`:**
  - it matches the timbre per take, never per phrase;
  - it gives presence: +2.5 dB at 3.5 kHz, de-esser and 3:1 compression.
- Without it, the ElevenLabs voice had a jump at 8 s and sounded dull and monotone.
- **Don't flatten the voice:** between phrases the natural difference is 1.5 to 2 LU, not 0.2.
- **Against a monotone voice:** offer the video at 1.08× and 1.12× (`setpts` + `atempo`). The timbre doesn't change.

## Stage 6 · The person's image

- **Natural color:** soft contrast, open shadows, beard and hair with detail. "Epic" comes from what happens on screen, not from harsh color: crushed blacks looked "super bad".
- **The background is never treated differently from the person** when the cutout is used. Darkening or blurring it leaves a halo in the hair and blotches on the clothes. The cutout is only for putting something behind the head.
- A difference map against the original take across all frames: only what was added on purpose changes.

## Stage 7 · Animation

- **The interface never covers the face or the captions:**
  - it goes between the chin and the captions;
  - fully inside the frame and with x < 980, because of Instagram's buttons;
  - outside the zoom.
  - Check it on several frames of the scene.
- **Nothing that looks like a slide:** no line-pattern backgrounds and no flat cards in a row. A background with light and objects with volume (kit `brands/example/reel/src/kit/scenes.tsx`).
- **The word behind the head** appears 3 or 4 frames before it's said, not earlier.
- **Measure big text at full size:** "HONESTOS" (Spanish for "HONEST") at 190 px went out of frame with the zoom.
- **Inside the phone, text ends up small:** what matters comes out of the screen, large.
- **Captions:**
  - never carry over from one scene to another, not even with the tail;
  - don't go where the phrase is already written large.
- **What people do by hand is shown the way people do it:** logging expenses is a spreadsheet, not the app.
- **Hook:** something happens at frame 0, for example the camera dropping with blur and a word behind. Never just the person talking.

## Stage 8 · AI and retouch

- Higgsfield: quote (`quote.py` + `get_cost`), a 480p draft of a single block, and then the final.
- CapCut Pro: the creator doesn't have access for now (Nov 2026). Without retouch, the image keeps the stage 6 color.

## Stage 9 · Sound

- **Effects you can hear without covering:**
  - the typical event sits about 5 dB below the voice (`balance` around −5, not −10);
  - `--voice-safe --voice-depth light`;
  - voice and music at their real level (`keep_level`).
- **Hits with body without muddying:** high-pass at 170 Hz and 1.5 dB less than the rest. A higher high-pass took away their punch; lower, it muddied the music's bass.
- **Sonic hook:** hit and whoosh at frame 0. Riser before the big hit. If the music has a break, its drop goes on that hit.
- **Music:**
  - Our own gentle ducking: `sidechaincompress` 2:1 with the voice, so it dips about 3 dB.
  - Never `mix.py`'s `--duck-music`: it dips about 10 dB and the music jumps when the voice ends ("the swell at the end").
  - No automatic rises.
  - The music sits about 15 LU below the voice (track at −29 LUFS before ducking). At 11 LU, the creator heard it as "way too harsh", and even more so on the phone speaker, which boosts it.
  - In the hook, 3 dB lower still, because the hit and the word are already sounding there (the creator's note, v14).
- **Variety:** if the library is small, download more CC0 recordings. The same whoosh five times gives the pack away.
- **The sound sheet names each sound by file**, not by its index number: the index is renumbered when sounds are added.
- **Always deliver:**
  - the main version;
  - one without music;
  - if the voice sounds monotone, the 1.08× and 1.12× ones.
- Check with `listen.py`: the voice is as understandable as on its own, and the mix sits at −14 LUFS.

## Stage 12 · Variations

- **4 to 6 trial reels on the same day, every 2 or 3 hours.** It's the creator's strategy (Nov 14, 2026). My first proposal, 3 variations spaced 48 hours apart, came from old sources and they rejected it: "I said current".
- **A variation is the same video re-edited from another perspective,** to fix the failure the diagnosis shows (another order, without the filler, shorter, the result first). On Nov 14, 2026 the creator rejected an entire batch that only put a big sign on top of each one: "you did it like just to sidestep it". Only v2 was saved.
- **The diagnosis comes from the finished video and its data, not from the script.** On paper "Sin anotar" opened well. Once posted, 59 % skipped in the first 3 s, because «Seamos honestos» ("Let's be honest") takes 2.7 s and the topic arrives at 2.8 s.
- **No empty frame in the first 3 s of a re-edit.** In the v4 draft, the pause fell on the transition and left half a second of empty screen; it was fixed with `freeze_at`.
- **The API doesn't add Instagram music or trending songs.** The music goes inside the video, from the licensed library.
- **Claude only posts batches approved in the chat,** with what the creator said saved in the batch (`instagram.py approve`). The token lives in the system's secure store (Keychain, Credential Manager or secret-tool), never in the repo or in the chat.
- **Cleanup comes after the variations.** In "Sin anotar" it was cleaned up before, and the variations had to come out of the final video, with no way to change texts inside the scenes.
- **Variations improve the video; they don't trim it.** Most get a new hook made in Remotion (`remotion_hook`) and at most 2 rearrange content, built in Remotion with a swipe and sound. The creator, Nov 15, 2026: the trims of the final video "were really badly edited".
- **During recording (stage 2), record 2 or 3 extra openings:** another phrase, another shot or another place. That way the variations have their own material and don't depend on reordering the only take.
- **The plan is approved by watching drafts, not by reading a table.** The creator, Nov 14, 2026: "visually it was hard… to approve all that for you". `variations.py --draft` renders them at 540p in seconds.
- **Before a batch of trial reels, confirm that the account has them.** The 2026 guides ask for about 200 followers on professional accounts, and @example had 40 on Nov 14, 2026. Without trial reels, 6 variations on the same day reach the followers as repeated content.
- **Commercial songs never inside the file:** use the trending style with a CC0 track (for example, Christmas sleigh bells mixed with the funk at the same BPM) or the `manual` variation, which the creator uploads from the app.
- **The big hook sign (`hook`) is no longer used as a variation.** It only remains in v2 of "Sin anotar", which the creator approved that way. If it ever comes back, the band covers the whole title zone (y = 150 to 460).

## Stages 10 and 11 · Review, delivery and cleanup

- **A fixed final checklist before every delivery** (editing guide revised on Nov 15, 2026). Check duration and resolution, the topic in the first second with no sound, the captions (that they don't fall on a light background), `faces.py check`, −14 LUFS, spelling, that there's nothing that doesn't belong, and the cover with `faces.py cover`.

- Each of the creator's notes goes back to its stage: a cut is stage 3, a voice stage 4, a color stage 6, an animation stage 7, a sound stage 9.
- **The copy is short and has no hashtags:** two lines, the problem and the call to the link in bio. The first version of "Sin anotar" had six paragraphs and five hashtags: "it looked so long… hashtags aren't even used anymore".
- **When it's done there's a final folder and the creator is told where it is:** `brands/<brand>/finals/<project>/`, with the video to post, `copy.txt`, `suggested-cover.jpg` and `PUBLISH.md` (day and time, Colombia time). In "Sin anotar" they couldn't find the video: it was only inside Montage.
- **Cleanup when done:** when the creator says the video is finished and marks FINAL, the disk is freed up (the creator's rule, Nov 14, 2026). This computer is always almost full.
  1. `python3 production/tools/clean.py <piece>` shows what it would delete and what stays.
  2. Show the summary to the creator. With their yes: `clean.py <piece> --yes` and `node montage/cli.mjs archive <project> --yes`.
  - **Stays:** the piece's text and code, the final voice, the raw takes (unless `--also-source`), the FINAL in Montage and in `brands/<brand>/finals/`.
  - **Deleted:** everything intermediate.
  - Deleting can't be undone: always with their yes.
- **The earlier versions go** (the creator, Nov 14, 2026: "the video and a couple of little things stay… the earlier versions go").
  - In Montage only the FINAL keeps its files; that's what `archive` does without `--keep`.
  - Anything useful on the side, like the no-music version for the trending song, is copied first to `brands/<brand>/finals/<project>/`.
  - Rejected attempts of the same piece and their media are deleted too: old folders, takes and renders in `brands/<brand>/reel/public` and `out/`.
  - The code the final piece uses isn't deleted.
- **Only a piece the creator called finished gets cleaned up.** The others (other brands, highlights without a FINAL) aren't touched, even if they have intermediate renders.

## Technical (for Claude)

- **Face detection with OpenCV 4, not 5.** Version 5 removed `CascadeClassifier`, and `faces.py` uses it. `requirements.txt` pins `<5`.
- **The face zone for `faces.py check` goes from the eyes to the chin, without the edges.** Stretching it toward the neck flagged as "covered" the expense sheet and the counter, which sit below the chin.

- **The After Effects raw files (`image/blocks/B0N-raw.mov`) were deleted by the cleanup, and the `.aep` was left pointing to the path from before the repo was reorganized.** They're recreated from `source/`: the cut starts at `source_from` and lasts as long as the comp, at 30 fps and in ProRes. Then they're relinked with `footage.replace` (Nov 15, 2026).

- **`source_from` in `image/blocks.json` is already the start of the block's file, margin included.** The scene starts `margin_before` later. On Nov 15, 2026 I subtracted the margin again when redoing B01, and the lips ended up 0.5 s off from the voice ("they don't match one bit"). To check it: compare the mouth and the pose frame by frame against the posted video.

- **In zsh, `$var[...]` inside an ffmpeg filter is a subscript:** write `${var}[vo]`. It has already broken three commands.
- `@remotion/video-matting` and similar packages are loaded through their ESM entry (`package.json`), not through the internal path.
- VFR takes from the phone: convert them to 30 fps CFR with the audio aligned to zero (`aresample=async=1:first_pts=0`).
- **Meta token in the Keychain:** with `save_token.py`, never with a bare `security ... -w`, because it cuts at 128 characters and the token is about 200 long. Tokens start with EA (EAA, EAB…). It happened while connecting @example, Nov 15, 2026.
- **A tool's tests are never run on real folders** (`finals/`, batches, Montage). On Nov 14, 2026 a test of `variations.py` overwrote a draft `batch.json`. Now the script keeps the previous one and never touches an approved one.
- Disk: check the free space before long renders (`df -h`) and warn if less than 10 GB is left.
- **Everything has to run on macOS, Windows and Linux.** On Nov 16, 2026 someone downloaded the public repo, found it "Mac-only" and had to adapt it to Windows themselves. Since then:
  - what's specific to each system (Keychain, launchd, Chrome, cache, detached processes) lives only in `production/tools/system.py`;
  - every tool starts with `system.prepare(...)` and is documented as `python3 production/tools/x.py`, never with `.venv/bin/python`;
  - no `zsh`, no `npx` from Python, no fixed paths to `/Applications` and no file paths inside an ffmpeg filter;
  - `python3 production/tests/portability.py` checks all of that;
  - GitHub tests every change on Windows, macOS and Linux (`.github/workflows/tests.yml`).
