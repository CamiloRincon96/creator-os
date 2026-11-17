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

- **After editing, the whole result is reviewed before it is shown.** This is strict. `review.py` leaves the full video in frames, every cut, the face up close, what is heard against the text, the pauses, the loudness and whether a cut lands inside a word. Claude looks at everything and writes "What I saw"; without that Montage won't publish. The creator: "you make the cuts, run the script… and then you don't check whether the video came out right… whenever you do something, review it".
- **In Montage, a video shows only the first file of each version.** Several tests go in a single video with `--markers`, never as several files in one version. Four clips were once published together and the creator saw the same one three times and never the other three.
- **The creator approves each stage before the next one is built.** v1 of "Sin anotar" (the example reel, Spanish for "Not written down") was made in full without them hearing the cut or seeing the plan, and it came out "one of the worst".
- **Claude can't hear.** The measurements (`listen.py`, `critique.py`) are a floor, not the goal. In v13 everything scored 9 or 10 and the creator said nothing could be heard. Never write "it sounds good": say what was measured and what they should listen for.
- **Visuals are shown as video**, not as stray frames ("you showed me some photos").
- **When the creator appears, always looking at the camera,** in a gesture or an action that frames well, or at a precise moment. The person blocks are chosen by looking for that frame by frame, not only by the sentence. A stretch where they look at the computer or read never goes in. The creator asked for it on 16 Nov 2026 ("I always keep that").
- **Screens are recreated as motion graphics, not recorded.** A real reference screenshot is taken (the Claude app, Montage, the terminal) and animated with HyperFrames or Remotion with the same elements. It is faster, looks better and doesn't fill the disk. The creator, 16 Nov 2026: "take a screenshot… and animate it as motion graphics… faster than recording and using up a lot of space". VS Code is never shown, and neither is the sidebar with the creator's chats.
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
- **Highlights and fixed pieces also carry real material, movement and voice, not text cards:** four highlight covers in terminal type on black (v1, Nov 16, 2026) "I didn't like them"; the creator asked for "epic" ones, in the glass style, with their own stock and a natural voice.
- **On the personal account, the script comes from what the creator lived through, not from what's trending:** the problem, the hard part, the outcome (that it works, with its real number) and a genuine piece of advice at the end. No "comment X", no "let's see if this one lands" and no "do this" tutorials. On Nov 16, 2026, three rounds built from trends felt generic to them: "I'm not going to beg for your like".

## Stage 2 · Recording

- Two seconds of silence after hitting record and before stopping: with the Bluetooth microphone the audio comes in late.
- The same distance to the microphone in every take. Closer = more lows; in "Sin anotar", take 2 made an audible jump.
- Leave a breath between phrases, half a second. The cut guarantees it anyway (stage 3).

## Stage 3 · Voice cut

- **The cut is decided by the voice and by the picture.** `gaze.py` says in which pieces the person looks at the lens; its sheet is looked at, and the ones that don't work on camera are marked for animation. The whole cut is reviewed with `review.py` before it is shown. The creator: "don't cut only by the voice, but also by the person… so the person is certain you did your best work".
- **The cut never lands on the voice.** It's placed by `cut.py` measuring the audio, never by the transcriber's timings. In v1 two cuts ate the end of a word.
- **Air at the end:** `final_tail` 0.7 s. Without it, the ending stops dead.
- **A phrase can't carry long silences inside.** `prepare.py` also splits where the audio goes quiet for more than 0.7 s, even without punctuation. In "Tres semanas" one "phrase" carried 19 s of silence, and another had the sentence said twice mixed into one.
- **Background noise fools where the voice starts.** A balcony at night sits about 10 dB above silence, and measuring by energy stretched starts by up to 4 s. That's why Silero makes the cuts (below). The `adjustments` in `cut.json` stay for when the transcriber mixes two versions of a sentence.
- **The air between sentences, by default, is a jump cut:** 0.12 s, the style approved in "Tres semanas" (16 Nov 2026). A brand that wants more air puts it in its `cut.json`. Example preferred 0.45 s, because with 0.3 s "it was all like boom".
- **Voice cuts are decided by Silero VAD,** the trained speech detector that ships with faster-whisper. It's what `cut.py` uses by default. Each segment is trimmed to what is voice, without breaths, traffic or echo, and stretched over the "s" at the start and the end, which Silero leaves out. Before, cuts were measured by energy and pitch, and in "Tres semanas" that left 0.85 s of background before "Corta tu voz" and then ate consonants.
- **Sentences said slowly or "sung" are sped up in parts** with `pace` in `cut.json`: a target in syllables per second and a cap. The creator's voice runs at about 5.7 syllables per second, and in "Tres semanas" several sentences were at 4.2 and sounded read. The default became 5.8 syllables per second with a 1.2× cap, which is what they approved. Above 1.3× it starts to sound rushed. If they want something else, offer two intensities to choose by ear.
- **Every cut checks itself:** `cut.py` looks for gaps without voice longer than 0.3 s and transcribes the result to compare it word by word with what it should say. The differences come out as warnings. Read them before showing anything to the creator: a different word can be a clipped one, or how they said it.
- The transcriber's `initial_prompt` only gets the proper names. With the whole script in it, Whisper skipped the first phrase.

## Stage 4 · Voice

- **The voice follows the same map as the video:** the silence before each segment, its pieces and their speeds. On 16 Nov 2026 `voice.py` assembled the whole segments and the track came out at 93 s for a 54 s cut. Before showing a voice, check that it lasts as long as the cut and doesn't drift.

- **The chosen version always goes through `match_timbre.py`:**
  - it matches the timbre per take, never per phrase;
  - it gives presence: +2.5 dB at 3.5 kHz, de-esser and 3:1 compression.
- Without it, the ElevenLabs voice had a jump at 8 s and sounded dull and monotone.
- **Don't flatten the voice:** between phrases the natural difference is 1.5 to 2 LU, not 0.2.
- **Against a monotone voice:** offer the video at 1.08× and 1.12× (`setpts` + `atempo`). The timbre doesn't change.

## Stage 6 · The person's image

- **To match one take to another, measure the face on the same shot, not the whole take.** On Nov 17, 2026 the light in a hook changed when the creator moved closer to the lamp. `match_color.py --reference` took the median of the whole hook and darkened a take that sits like the end of the hook. The face was measured in that stretch (3-4.3 s) and the same LUT was applied with those values.
- **Natural color:** soft contrast, open shadows, beard and hair with detail. "Epic" comes from what happens on screen, not from harsh color: crushed blacks looked "super bad".
- **Blocks come out of a master version of the cut,** with the same pieces, speeds and silences. `blocks.py` builds it by itself. Working out the second of the take as if the cut were continuous took the blocks from elsewhere: in "Tres semanas", "Te retoca" came out 8 s earlier in the take and another block came from the wrong take. Before grading, check that the master and the cut show the same frame at the same second.
- **The background is never treated differently from the person** when the cutout is used. Darkening or blurring it leaves a halo in the hair and blotches on the clothes. The cutout is only for putting something behind the head. It was tried again on "Tres semanas" and the same happened: the cutout loses a dark t-shirt at night, and when the creator moves or leans in their face shows up blurred.
- **A "cinema" grade made with ffmpeg** (curves plus a warm balance) turned the creator "red" and they dropped it. The person's color isn't changed without first showing a frame of their face next to the original.
- A difference map against the original take across all frames: only what was added on purpose changes.

## Stage 5 · Visual script

- **In scenes where the person appears, the picture doesn't arrive before the voice:** it starts right at the cut of their first word. The 0.1 s lead showed the end of the previous take before the close-up ("you cut me badly, at the end of a take"). `visual_script.py` does it by itself.
- **A person shot never ends with frames from another moment, and never lasts under 0.6 s.** 0.10 s of another moment at the end of a take was "a take that has nothing to do with it", and a 0.47 s shot was "a micro cut that only shows bad editing". `visual_script.py` ends the scene at that piece and warns about micro cuts.
- **If the person keeps talking and looking at the camera, the take isn't cut mid-sentence.** The cut goes after it ends. That's what `"starts": "<phrase>:<i>:end"` in `scenes.json` is for.
- **The gaze is checked on the eyes, enlarged, frame by frame (every 0.2 s)** in every scene where the person appears, before showing the mockup (`gaze.py`). A sheet of full frames at 2 or 4 per second doesn't show a downward look. Three stretches of reading slipped through once, and the creator saw them. Where the eyes go down, their picture doesn't go: what they point at or what they say goes there, big. If another take of the same phrase has them looking at the lens, use that one.
- **How much the person appears is agreed per brand** (`person_target`) or decided from the best takes, and `visual_script.py` warns when the cut drifts more than 10 points from it.
- **No flat scenes,** like a lone clock. Every scene without the person is composed and has depth, and every change carries a transition that holds attention. The hook has to land from frame 0.
- **The edit flows with the person's gestures.** If they point or gesture while looking at the camera, don't cut there: the animation appears where they point ("flow with me when I point at something").

## Stage 7 · Animation

- **A style test copies the references for real, it doesn't reinterpret them for the brand.** The first tests came out with small type, a small card on an empty background and barely any animation, and the creator said they looked nothing like their references. What they asked for:
  - the hook text big and heavy, stacked, with one word in color;
  - animations that draw what is said and fill the frame;
  - transitions you can see.

  Measure against the reference frame, at the same size, before showing it.
- **Everything on screen gets its time to be seen.** Appearing is not enough: it has to be readable and understood, with no dead pauses that bore. The whole rhythm is tuned. Starting values, which the creator's eye adjusts:
  - a 1 to 3 word text stays at least 1 s, plus 0.25 s per extra word;
  - a screen or interface shot, 1.5 to 2.5 s, to understand what is happening;
  - a big number, at least 0.8 s still after it lands.
  - Nothing longer than 0.8 s without voice or visual change, unless it is a deliberate pause (a punchline).
  - If the voice goes faster than it can be read, hold the shot or cut the text. Don't let it slide.

  The creator asked for it on 16 Nov 2026: "what's on screen has enough time to be seen… no long pauses… tune it all".

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
- **Color is even from take to take, always.** Takes from different passes (After Effects, FLUX, another day) jump in color. On Nov 17, 2026 the last takes of a piece came out darker and colder, "as if you hadn't applied it", and the creator saw it before the review did. `match_color.py` brings them to the median skin, and `review.py` measures the color of each take (colors-NN.jpg) and warns about the one that jumps.
- **More picture than text: glass with video inside, not white cards.** On a personal account, white cards looked "emoji-like" and a list of steps on screen "can't be read in time". What works (Nov 17, 2026) is this:
  - dark, transparent glass panels with a video playing inside, as in the reference reel;
  - one or two words per panel, no more;
  - the warning that matters can be read and the ones behind stay as edges, with no letters piled on top of each other.
  - `backdrop-filter` doesn't render in Remotion: the frosting is made with a blurred, aligned copy of the take.
  - **The glass, the size of what it shows:** a big window with a little piece inside looks empty ("a giant transparent thing to show just a little piece"). If there are two things, they go in two panes.
  - **Don't let them sit still:** the pieces come out from behind the person (their cutout covers them) and the previous one moves back. They don't appear and disappear in place ("more dynamism").
  - The full style is in `production/styles/glass/STYLE.md`.
- **A misspoken word is fixed in the voice without moving it.** In a piece on Nov 17, 2026 the creator said one extra "s" at the end of a word. The "s" was found by its energy between 4 and 11 kHz (a tenth of a second), replaced with the noise of the same room with 8 ms fades, and checked with Whisper. Since the duration doesn't change, nothing drifts out of sync. The previous voice is kept aside.
- **Nothing abstract: show the thing itself.** In a full reel (Nov 17, 2026) "what your people share" was two boxes with a play button and their view counts. The creator: "I don't want abstract things… they need visual stimuli all the time". The next version swapped it for concrete material: real reels on a phone, the person's takes on a film strip being cut, the real layers and the old versions with their mistake.
- **What's named is shown with its logo or its image, not its written name.** In a full reel (Nov 17, 2026) the names of the AI tools and the install list came out as text. The creator: "you're afraid of using logos, images… as visual as possible". Real logos are in `simple-icons` (CC0) and `@lobehub/icons-static-svg` (MIT), and Higgsfield comes last. Four typefaces were also tested over the take before changing it: joined cursive doesn't hook.
- **Invented screens look generic AI.** Fake windows with lines instead of text, ✦ sparkles, spinning clocks, windows flying at the camera and backgrounds of blurred lights are the template that fills social media today. On Nov 17, 2026 the creator said: "it looks a bit generic, AI-made… don't let it look like that same old generic thing". It also contradicted the video, which says generic doesn't work. What can't be copied is the real and specific: their real notes in Montage, the real list of errors, the real versions, their numbers and the real names of what they tried. Something generic only goes in on purpose, where the script talks about the generic.

## Stage 8 · AI and retouch

- Higgsfield: quote (`quote.py` + `get_cost`), a 480p draft of a single block, and then the final.
- **FLUX returns the video at 24 fps and shifts the cuts by one frame.** On Nov 17, 2026:
  - Convert it to 30 fps by generating in-between frames (`minterpolate`), and always within each piece: across a cut it blends one take into the other or leaves a double exposure. Repeating frames stutters.
  - Never send FLUX a clip that crosses to another moment of the recording: it fails ("Something went wrong") or brings the change forward.
  - The same shot isn't run in two batches with different instructions, because the look jumps at the seam.
- **Real prices measured (Nov 2026):**
  - Topaz (`upscale_video`, 720p to 1080p): 3 credits for 2 s, and it doesn't change the face. It can't be quoted before generating, so check `transactions` right after launching it.
  - FLUX 3 Video Edit: `get_cost` quoted 15 credits for 3 s but charged 3 (1 per second, as its description says). It keeps the gestures, blurs the background and warms the light, but outputs 704x1248 and softens the face a little.
  - Seedance 2.5 `video_edit` for 5 s: 38 credits at 720p and 100 at 1080p.
  - Quote with `get_cost` with the clip already uploaded, then confirm the charge with `transactions`.
- CapCut Pro: the creator doesn't have access for now (Nov 2026). Without retouch, the image keeps the stage 6 color.

## Stage 9 · Sound

- **An effect over a word erases it, even if the self-critique gives it an 8.** On Nov 17, 2026 a whoosh on a cut covered the first word after it: Whisper heard it at 0.30 in the mix and 0.996 in the voice alone. Compare word by word the voice alone against the mix, and remove the effect or move it to the pause.
- **Even levels per family, measured:** in v28 of "Tres semanas" the hits sat at −19 dB and the icons at −32 (down to −41), 21 dB from end to end, and the creator heard them as "some very harsh, some very soft… strange" (Nov 17, 2026). Measure each sound's `loud_after_db` in `*_resolved_cues.json` and bring each family to its level (hit −23, transition −27, interface −28.5, icons −29.5, typing −39), from a single pack; a sound that needs more than 10 dB of lift is swapped for another of its family.
- **Typing erases words too:** three key clicks over a short word made Whisper hear a different word (v30). No clicks go over a word; they go in the pause or not at all.
- **Instagram's trending music is possible, through the Audio API** (`instagram.py audios`). The list changes with every call: download each song by its `audio_id`. It used to be believed there was no API (MUSIC.md said so).

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

- **`git add` of a whole folder takes another session's work.** On Nov 17, 2026, adding a whole source folder put into a commit the files another session was still making; it was undone before pushing. Add file by file what you changed, and look at `git status` before committing.

- **`open(p, "w").write(f(open(p).read()))` empties the file:** Python opens for writing (and truncates) before it reads. On Nov 17, 2026 it left the lessons file at zero bytes, with another session's unsaved edit inside; it was rebuilt from `git diff`. Read into a variable first, then write, and copy the file to the scratchpad beforehand.

- **To capture Montage with a project open** (without the "Who is reviewing?" screen), use Playwright: `localStorage.setItem('montage:person', '<name>')`, reload on `#/p/<project>` and then take the capture. Headless Chrome (`--headless --screenshot`) doesn't keep that value.
- **Frame sheets from a Remotion render are pulled with ffmpeg (`select=eq(n,N)`, `-fps_mode passthrough`), not with `cv2.CAP_PROP_POS_FRAMES`.** OpenCV seeks badly in those mp4s and the sheet showed frames from another moment.
- **The skin measure is fooled on close-ups with a beard or monitor light:** the center of the face includes beard and shadows. On Nov 17, 2026 a photo of the creator editing asked for b +23 and came out orange. The color of archive material is decided by eye, side by side with the reference take, and the measure is only a hint.
- **`CameraMotionBlur` draws its samples 0.45-0.9 frames ahead** (`Freeze` at `frame - offset + 1`). A number that changes inside the blur runs ahead of the one outside it. On Nov 17, 2026 a warning's counter said 23 while the big number said +15. Inside the blur, count with `Math.floor(frame)`.
- **ffmpeg: `unsharp` on `gbrp` tints the image magenta.** It only sharpens green. Sharpen in YUV before going to RGB; a glow with `blend` does go in `gbrp`.
- **After Effects' disk cache grows without warning:** it reached 12 GB with the grain-removal renders. When stage 6 closes: save, quit After Effects and empty the `Disk Cache` folder. It rebuilds itself.
- **Everything that uses Whisper points to the repo's model** (`download_root=MODELS`). Without it, `faster-whisper` downloads another 2.9 GB copy to `~/.cache/huggingface`; it happened with `cut.py`'s word check.
- **`faces.py` only counts neutral white and the light brand colors.** The dark ones match a beard, hair and a black t-shirt, and a shine on the forehead is white but warm: both gave false "covered" warnings on shots with no graphic at all.
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
