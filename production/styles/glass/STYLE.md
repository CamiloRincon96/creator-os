# Style: glass

An example identity for **to-camera reels with animation**. A brand can have several identities, one per type of video: the account where this one was born uses another for its covers, and each brand says which goes with which in its `BRAND.md` ("Identities"). It sits between corporate and premium, like presenting a company, but with the person on camera as the protagonist. It was born in the hook of a personal account's piece (November 17, 2026), from the 8 reference reels the creator chose. One of them, with a video inside a glass panel, is where the glass comes from.

**Status: approved** (Nov 17, 2026, with v23 of the first stretch of that piece). The creator: "That's our style… we're going to work with that… you can innovate… but more or less like this, I won't accept less than this". It's the floor for to-camera reels with animation; each piece can innovate on top of it. Still to do: the sound.

What it taught became **the floor every identity meets** (`production/REELS-QUALITY.md`: the floor, the knobs, the method, the recipes and the first-version traps). To use glass in another brand, keep the structure and the motion and put in the brand's own colors and type; to make your own identity, change the look and keep the floor.

## The patterns (what works and what doesn't)

**Yes:**
- Zoom punches on the key words and a slow push-in in each scene; on a capture, moving in to the part that matters and traveling along it (v27).
- Real logos and images of what's named, instead of its written name (v25).
- The real and specific: their photos, their timelapses, their numbers, their notes, their files, their team.
- Dark glass with video inside, the size of what it shows.
- Pieces that come out from behind the person, and the previous one that moves back.
- Animation born from their gesture: if they point, something opens there.
- Few words, and big, one per scene, that can be read in time.
- Always moving: the camera pushes in, pulls back, turns or goes through.
- Something new every 0.5 to 1 s.
- The generic only on purpose, when the script talks about the generic: the feed of identical reels.
- Even color from take to take, by eye.
- Film grain.

**No:**
- Filling the supporting material with their face (v27): reels, photos, sound. It uses the brand's material without their face; the face, only for a second when it adds something.
- Marks or boxes that only someone who has already used the tool understands.
- Abstract things that "stand for" something: boxes with a play button, bars, waveforms, little colored squares (v26). Show the thing itself.
- Writing the name of an app or AI when its logo can be shown.
- Joined cursive or tightly tracked type.
- "Emoji-like" white cards.
- Small type or labels that can't be read in time.
- Lists of steps on screen.
- A big window with a little piece inside.
- Invented screens: windows with lines instead of text, ✦ sparkles, clocks, flying windows, decorative lights.
- Blurring the person.
- Micro cuts.
- Cutting them while they point.
- Anything that looks like home (a couch, the kitchen), unless the brand wants it.
- Covering their face.
- A color grade that turns the person "red".

## The idea in one line

More picture than text. Pieces of dark, transparent glass, with video inside, that come out from behind the person and move with them.

## Person

- On screen for 40 to 50 % of the piece (`person_target: 0.45` in the brand's `BRAND.md`), only where they look at the lens (`gaze.py`).
- Nothing over their face and nothing blurred over them. No more background blur with the cutout, because it blurred their face.
- If they point or make a gesture, don't cut: the animation is born from their gesture. The camera goes with them with a slow push-in, about 4 % in 1.5 s.
- Color: the takes (retouched with FLUX in that piece, stage 8, optional and paid), matched from take to take with `match_color.py`. No ffmpeg "cinema grade", because it left the person "red".

## Glass

- **Dark and transparent:** the background is the same take, blurred (28 px), darkened and aligned with the frame. On top it carries a soft white gradient, a 1.5 px white border at 32 %, a highlight at the top and a large shadow. `backdrop-filter` doesn't come out in Remotion's render.
- **With video inside** whenever possible: thumbnails of the takes, the reel playing on a phone.
- **The size of what it shows.** A big window with a little piece inside looks empty. The creator: "a giant transparent thing to show just a little piece". If there are two things, they go in two panes.
- **No white cards.** They looked "emoji-like".

## Type

- **A wide, heavy display face, uppercase, normal tracking** (in the kit: Unbounded 800 or 900, `DISPLAY` and `disp()` in `src/glass/theme.ts`). It goes on numbers and big words: "3 WEEKS", "+100 ERRORS", "4–5 HOURS", "$0", "LIKE YOU".
  - The creator, Nov 17, 2026: "that typeface like joined-up writing, no… something more attractive, that hooks".
  - Out go the serif italic and tightly tracked letters (negative `letterSpacing`).
  - Anton, Bricolage Grotesque, Unbounded and Archivo Black were tested over the person's take. Anton hooks, but it's the usual one.
- **Captions:** a heavy sans (Montserrat 800 where it was born; the brand's sans in the kit), normal tracking, the spoken word in yellow, 1 to 3 words that never join two phrases.
- Wide type takes more room: a big word goes at 150 px or less. Measure that it fits in 1080.
- **Nothing that can't be read in time.** What doesn't fit is said with a logo or an icon.
- Text goes below y≈270, out of Instagram's top bar.

## Colors

The ones of the account where it was born; each brand puts in its own.

- Ice blue `#7DE3F4`: what's good, what moves forward, and the accent.
- Red `#E5484D`: errors.
- Green `#34C759`: "✓ Done".
- Yellow: the word being spoken and the strong number in the stack.

## Motion

- **They come out from behind the person.** Each piece starts small behind their head: the front layer, which is their cutout, covers it. It comes out with a spring and a 3D turn into its place.
  - Check the cutout on those frames first: at night, with a dark t-shirt and movement, it fails.
- **The previous one moves back**, smaller and blurred, while the next one comes in. It never disappears all at once.
- **Stacks that grow:** when something piles up (errors, warnings), the one in front stays still and readable. Each new one comes out from behind and pushes the others further back, with a shake and a counter that jumps.
- **The reveal is born from the gesture.** A flash at the fingertip, measured frame by frame, a ring and a beam. The glass panes open from there. When the phrase closes, "✓ Done", a shine that sweeps across and the bar in green.
- Motion blur (`CameraMotionBlur`, 200°, 6 samples) on everything that moves. Inside the blur, numbers are counted with `Math.floor(frame)` (`LESSONS.md`, "Technical").
- Numbers that are seen at the same time say the same thing, frame by frame.

## Full-screen scenes (approved with v23)

When the person isn't looking at the lens, the screen is all animation, and all of it is real material.

**v22, with real material:** the photo of them editing, with the camera traveling across it; their hands and them working, in timelapse (from the brand's `stock/`); their data in glass (the hours a reel takes them, the 0:30 reel and the time the photo was taken); film grain; a hard cut to the wall of identical reels, which is the only generic thing and goes in on purpose.

**v23, the feed:** when the script talks about "everything out there" on social media, it's shown as a feed. Reels with a generic interface (heart, comments, share, user, caption and progress bar, no network's logo), in columns that spin like a slot machine and stop on the same reel. Team members can appear if the person says so (here the creator asked to give a teammate the spotlight). From archive footage, use only what doesn't look like home (no couch, no kitchen), checked frame by frame.

**What failed in v21:** the screens were invented (fake windows, sparkles, a spinning clock, flying windows), over blurred lights: today's template. What stays is the camera always moving, one protagonist per scene, something new every ~1 s and entering by pulling focus. What changes is the content, which becomes real and specific (`LESSONS.md`, stage 7).

The recipe comes from one of the references (a 3D interface over a dark background with shallow depth of field). The creator's question: how to keep retention "without losing professionalism".
- **The same world.** Behind goes their own footage, blurred (in that piece, their night with the city lights in warm and ice-blue bokeh), and it moves slower than the camera. Never switch to a background from somewhere else.
- **The camera is never still:** it pushes in, pulls back, turns a little and goes through things.
- **One big glass protagonist per scene**, filling the frame from y≈250 to y≈1250. It carries video inside when possible: their take in the editor's preview, or a reel.
- **Something new every 0.4 to 1 s, on the word that names it:** a cut in the timeline, a number that jumps, a window passing by.
- **One big word per scene,** in the display face, at y≈250. While it's on screen there's no caption, so it isn't repeated.
- **Captions lower** (y≈1400), below the protagonist. Over busy backgrounds they get a dark band behind.
- **Enter by pulling focus:** the person blurs out over about 4 frames while the glass comes into focus, in the pause after the word, never inside it.
- **Come back to the person through the glass:** the camera goes into a reel that already shows their take, and that reel becomes the screen.

## Recipes for step scenes (v26)

Each step is told with the thing itself, not with a symbol:
- **research:** a phone with real reels swiped by a finger (one of theirs for a second, then the brand's, without their face), hearts and shares;
- **script:** the AI's logo, big, and the real text being typed, big;
- **cutting the voice:** a film strip with frames of their raw take; scissors cut out the silences and the strip closes up;
- **retouching:** their raw take and the retouched one, with a wipe;
- **animation:** the real layers of one frame (take, cutout, result) separating in 3D;
- **sound:** their desk; the camera goes into the microphone and waves come out (no photo of them);
- **review:** a capture of their editor, with a zoom to the timeline that travels along it; "marking" is pause, a red pen circling a frame, and their real note;
- **learning:** the old versions with their mistake, falling with ✕ into the book with the total;
- **installing:** the logos of the AIs and of what gets installed, each with its ✓;
- **sharing:** the comments sheet with the link.

When the person is on camera between steps, the key word goes behind their head (with their cutout) or in glass under the chin, never over the face.

## Kit

A generic, brand-neutral version lives in the example brand: `brands/example/reel/src/glass/` (its `README.md` says what each piece is and the part of the floor it serves; the `GlassDemo` composition shows it in motion with no footage). Colors and the main font come from the brand's `src/brand.ts`; the identity's own choices are in `src/glass/theme.ts`.

| Piece | What it is | In the kit |
|---|---|---|
| Glass pane | The dark, transparent panel, sized to what it shows, with a video inside when possible | `GlassPanel` (frosting from a blurred, aligned copy of the take), `GlassWindow` (comes in pulling focus), `glassStyle()` |
| The world behind | Their own footage, blurred, behind every full-screen scene | `World` |
| Comes from behind | Wraps any piece so it starts small behind the head and comes out with a spring and a 3D turn; the previous one moves back | `ComeFromBehind`, with the person's cutout on top (`cutout-person.mjs` and the kit's `Person` piece) |
| Big word, number and word | One word per scene; "4–5 HOURS" | `BigWord`, `NumberWord` |
| Type | The wide, heavy display face, uppercase, normal tracking | `DISPLAY`, `disp()` in `theme.ts` |
| Logos | What's named, shown with its real logo from `public/logos/` (from `simple-icons` and `@lobehub/icons-static-svg`; the repo ships none); an app tile with letters when there's no logo | `Logo`, `AppIcon` |
| Word under the chin | One word in glass that never covers the face | `GlassPill` |
| Captions | 1 to 3 words, the spoken one highlighted, never across two phrases | `GlassCaptions`, from the cut's map |
| Grain | Fine film grain on full-screen scenes | `FilmGrain` |
| Terminal | The real command and the real check | `Terminal`, `Typed`, `CheckLines` |
| Reel feed | The slot-machine wall of identical reels, and the dive into the center one | `ReelFeed`, `ReelUI` |

Built per piece, with the piece's real material: panes with motion inside (a calendar whose days fill up, versions that pile up), the growing stack of warnings, the reveal from the fingertip and the number stack under the chin.

## History

- **Nov 17, 2026, v19:** glass with video inside instead of the white cards, and the reveal almost without text. The creator: "much better".
- **Nov 17, 2026, v20:** the pieces come out from behind the person and the previous one moves back. The errors stack up behind the warning, with no small type. The final window is two panes the size of what they show, with big type, and the flash follows the finger. The creator's request: "more dynamism… that they could come out from behind… a better distribution of the space".
- **Nov 17, 2026, v21-v24:** full-screen scenes. Invented screens were dropped for real material (v22), the reel feed was added (v23) and the creator approved the style: "I won't accept less than this". The full reel (v24) added the recipes for step scenes. Its standard went into `production/REELS-WORKFLOW.md` and the generic kit into `brands/example/reel/src/glass/`.
- **Nov 17, 2026, v25:** real logos instead of names, icons instead of words, "$0", errors that turn into lessons; the type moves to a wide, heavy display face (Unbounded). The kit got `Logo`, `AppIcon` and `disp()`.
- **Nov 17, 2026, v26:** nothing abstract. Now there's a phone with real reels, the film strip of their takes cut by scissors, the real layers of the hook, their headphones and their old versions with their mistake falling into the book.
- **Nov 17, 2026, v27:** less of the person in the supporting material (the brand's reels without their face, one of their own reels for a second), the microphone instead of their photo, a zoom to the editor's timeline, "marking" anyone understands (pause, pen, note) and zoom punches on the key words.
