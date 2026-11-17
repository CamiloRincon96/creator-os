# The quality floor of a reel

The creator, Nov 17, 2026, closing the picture of the first approved piece (v27): "that's the closest to perfection of the style I'm after… if tomorrow I give you a 3-minute video, or 2 videos because I made a mistake… you'll know what to do… and in the public repository, if someone brings you something, you deliver something of this quality… don't focus on it having to be exactly the details, but on how to capture all of that".

This document captures that quality, for any video and any identity. It has five parts:

1. **The floor:** what never goes down.
2. **The knobs:** what changes from piece to piece.
3. **The method:** from the raw videos to the reel.
4. **The recipes:** what to show for what is said.
5. **The first-version traps:** what the creator corrected from v17 to v27, so it comes out right the first time.

`/creator-reel` reads it in stages 5 and 7. `review.py` leaves its list in every review ("## Visual floor"), and Montage won't publish an AI's video while that list is unresolved: each line ticked `[x]` after looking, or marked "n/a" with why.

## 1 · The floor (it holds for any identity)

Each brand or each person picks their identity: colors, type, the shape of the panels (`production/styles/<style>/STYLE.md`; "glass" is the approved example, and its generic kit is in `brands/example/reel/src/glass/`, with its README and its `Logo` piece for the logos in `public/logos/`). But every identity meets this:

1. **Real and specific, never invented.** What's on screen comes from the person and their work:
   - their takes, their `stock/` (photos and timelapses of them working) and captures of the tools they really use;
   - their numbers (from the repo or said by them), their notes, their files, their old versions and their team.
   - Fake screens (windows with lines instead of text, sparkles, clocks) look "generic AI". Something generic only goes in on purpose, when the script talks about the generic.
2. **The thing itself, not a symbol.** Nothing abstract: boxes with a play button, bars, waveforms or little squares that "stand for" something don't hook. Show what is named: a phone with reels swiped by a finger, a film strip of their takes being cut, their old versions with their mistake. The creator: "people's brains are fried and they need visual stimuli all the time".
3. **Visual before text.**
   - An app, an AI or a network goes with its real logo (`simple-icons`, CC0, and `@lobehub/icons-static-svg`, MIT, copied to `public/logos/`).
   - A number goes with its icon: scissors for cuts, an eye for views, a book for lessons, "$0" for free.
   - Higgsfield comes last, for an image that doesn't exist, and with an approved quote.
   - Text is left for what has no image: one word per scene, big, in a type that hooks (wide or heavy, never joined cursive or tightly tracked letters).
   - A phrase already written big on screen gets no caption.
4. **Understood by someone who has never seen it.** An action is shown the way anyone would do it: the playhead moves, it pauses, a pen circles the frame and the note appears. A loose box is only understood by someone who has already used the tool.
5. **Constant stimulus.** Something happens in the picture every 0.5 to 1 s, on the word that names it: a finger swiping, a heart, something falling, being cut or flipping over.
   - The camera is never still: it pushes in slowly in every scene and punches in with a zoom on every key word.
   - On a capture (an editor, a page), the camera moves in to the part that matters and travels along it.
   - Pieces come from somewhere (from behind the person, from their gesture) and the previous one leaves.
6. **Each thing the size of what it shows,** filling the screen, never half an empty frame.
   - A big window with a little piece inside looks empty.
   - A wide word is measured so it fits in 1,080.
   - Everything stays inside the safe zone: below y ≈ 270 and above 76 % of the height, with x < 980.
7. **The person rules, but isn't everything.**
   - They appear where they look at the lens (`gaze.py`). Nothing covers their face or blurs it.
   - If they point, the animation is born there; they're never cut in the middle of a gesture.
   - Supporting material (example reels, photos, the sound) uses material from the brand or from their work **without their face**. The face appears only when it adds something, for example one second of one of their reels ("very me-centric… not everything has to be my photo").
8. **One world.**
   - Full-screen scenes go over their own footage, blurred, not over a background from somewhere else.
   - Nothing that looks like home unless the brand wants it: check it frame by frame.
   - The color is even from take to take, and archive material gets fine grain.
9. **The voice says what it has to say.** A word said wrong is fixed in the voice without moving it (`LESSONS.md`, stage 7), and the person approves it by ear.
10. **Reviewed in full** with `review.py`, looking at every image, with "## Visual floor" resolved and "## What I saw" written.
11. **Sounds like the niche:** about 7 real effects every 10 s, a full hook, no synthesized interface sounds or dings, and each effect at the voice's level measured in the final mix with the music in (`effects.py`, recipe in `production/SOUNDS.md`). With fewer or quieter ones it was "bland"; with many interface sounds, "laser beams".

## 2 · The knobs (they change from piece to piece without lowering the floor)

| Knob | Where it's set | Examples |
|---|---|---|
| How much the person appears | `person_target` in `scenes.json` and in the brand's `BRAND.md` | 20 % (almost all animation), 45 % (the first approved piece), 80 % ("show me most of the time") |
| The identity | "Identities" in the brand's `BRAND.md` | glass, or another one created scene by scene |
| The pace | `cut.json` (air between sentences, `pace`) | YouTube (0.12 s) or slower (0.45 s) |
| How much custom animation | stage 0, in the brief | sober, medium, high |
| What may be shown | the brand's `BRAND.md` | team or not, home or not, numbers or not |
| Type and color | the identity's `STYLE.md` | Unbounded and ice blue in glass |

**When the person is on screen most of the video** (a high knob), the floor is met on top of their take:
- zoom punches on the key words;
- logos and objects that come out from behind their head, or in a panel under the chin;
- cutaways of 1 to 2 s of real material, full screen, on the phrases where they don't look at the lens or where something is named that can be shown.

The person is never left just talking for more than 3 or 4 s without something happening.

## 3 · The method: from the raw videos to the reel

It works for 30 s or for 3 minutes, with one video or with several: if they made a mistake and recorded again, everything goes in `source/`, and the cut picks the best version of each phrase by the voice and by the picture (stage 3).

1. **Cut by the voice and by the picture** (stage 3): `prepare.py`, `cut.py`, `gaze.py` and `review.py --cut`. Out comes the list of phrases where the person can't be on camera.
2. **The visual plan, phrase by phrase** (stage 5, `scenes.json`). For each phrase:
   - Does the person appear? Yes, if the piece is fit and the knob asks for it.
   - What kind of phrase is it? Look it up in the recipes below and write it in `recipe`.
   - What real material tells it? Write it in `material`: a file, a fact from the repo, a capture or a logo. If there is none, ask the person (their `stock/`) before inventing anything.
   - What is the key word? It goes in `accent`, and the zoom punch lands there.

   `visual_script.py` warns about every scene without the person that has no `material`.
3. **Gather the material** before animating:
   - Stock: look at all of it and set aside whatever looks like home.
   - Real captures: Montage with Playwright, pages with headless Chrome.
   - Logos from the libraries.
   - Frames from old versions.
   - The brand's reels: find the stretches without the person's face with a face detector.
4. **Build in sections**, each one approved:
   - the hook (the first 3 to 5 s) in the identity;
   - the first stretch of full-screen scenes;
   - the rest, with the components of the identity's kit.

   In a 3-minute video, one section every 30 to 40 s, and a new visual hook every 20 to 30 s: a big change of shot, of world or of scale.
5. **Self-critique before showing.** Go through the video with the "## Visual floor" list and with the traps below, scene by scene. Whatever fails is fixed before the creator sees it.
6. **Mandatory review** (`review.py`) and Montage, with "## Visual floor" and "## What I saw".

## 4 · The recipes: what to show for what is said

| What is said | What is seen (real material) | Example in the first approved piece |
|---|---|---|
| A number of effort (weeks, versions, mistakes) | The big number with its object: a calendar that fills up, real versions with ✕ and ✓, warnings that stack up | the hook |
| Something that used to be done by hand / the work | Photos and timelapses of the person and their team working; the icons of the programs they used | "I edited by hand", "the hours" |
| An amount of time | A big counter over their take or their desk, against the small measure (a 0:30 reel) | "4–5 hours" |
| "Everything is the same / generic" | A wall or feed of identical reels beating at once (the generic, on purpose) | "it all came out the same" |
| Research / what people share | A phone with real reels swiped by a finger, hearts, share, a magnifying glass | "what your people share" |
| Writing / a script | The AI's logo and the real text being written, big | "it writes the script" |
| Cutting / editing audio | A film strip with frames of their take; scissors that cut the silences | "it cuts your voice" |
| Retouching / before and after | The raw take and the retouched one with a wipe; a push-in on "framing" | "it retouches you" |
| Animating / layers | The real layers of a frame (take, cutout, result) separating in 3D | "it animates the scenes" |
| Sound | Their microphone or their headphones (the object, not their photo) with waves | "it adds the sound" |
| Reviewing in a tool | The real capture, which comes in whole and then moves in to what matters and travels along it | "its own editor" |
| Marking / correcting | Timeline, pause, a red pen that circles, a pin and the real note | "you mark it" |
| Learning from mistakes | Real frames of old versions with their ✕ falling into the book with the total | "it saves every mistake" |
| Free / price | "$0" or the price, big, in a panel under the chin | "free" |
| Naming the product | Its icon and its name in the identity's type, under the chin | the product's name |
| Asking an AI / installing | A chat with the AI's logo that changes; the logos of what gets installed, with ✓ | "ask your AI" |
| Several tools or brands | Their logos, big, one per word | "Claude, Codex…" |
| The call to action (comments, link) | They point, the icon appears where they point, and the comments sheet with the real link | "in the comments" |
| A strong idea said to camera | The person, with the word behind their head (cutout) or in a panel under the chin, and a zoom punch | "mine", "like you" |

If a phrase fits no recipe, look for its real object. What thing, file, person or place really exists and shows it? That new recipe is added here once the creator approves it.

## 5 · The first-version traps (v17 to v27 of the first approved piece)

Each one cost a round of changes. The first version already avoids them:

| Trap | What the creator said | What goes instead |
|---|---|---|
| Small type and an empty background | "it's almost all background" | Big type, a full screen |
| White emoji-like cards | "too emoji" | The identity (in glass: glass with video inside) |
| Blurring the person, or a grade that changes them | "I look red" | Their natural skin, even color |
| Cutting away when they point | "flow with me when I point" | The animation is born from the gesture |
| A huge window with a little piece inside | "just to show a little piece" | Panels the size of what they show |
| Pieces that appear and stay still | "more dynamism" | They come from behind, the previous one leaves |
| Invented screens | "generic, AI-made" | Real material |
| Names written instead of logos | "you're afraid of using logos" | Real logos and icons |
| Joined cursive | "more attractive, something that hooks" | Wide, heavy type |
| Abstract boxes | "specific visual things" | The thing itself |
| Their face on everything | "very me-centric" | Brand material without their face |
| A box only someone who has used the tool understands | "it's not understandable" | Pause, pen, note |
| Few zooms | "play more with the zooms" | Punches on the key words, moving in to what matters |
| A word said wrong in the voice | "by hands" (instead of "by hand") | Fix the voice without moving it |

## History

- **Nov 17, 2026:** created when the picture of the first approved piece was closed (v27). The floor came from the standard in `REELS-WORKFLOW.md`, which now points here.
- **Nov 17, 2026:** point 11, the sound, when that piece's sound was closed (v33, "exactly that").
