# Style: glass

An example identity for **to-camera reels with animation**. A brand can have several identities, one per type of video: the account where this one was born uses another for its covers, and each brand says which goes with which in its `BRAND.md` ("Identities"). It sits between corporate and premium, like presenting a company, but with the person on camera as the protagonist. It was born in the hook of a personal account's piece (November 17, 2026), from the 8 reference reels the creator chose. One of them, with a video inside a glass panel, is where the glass comes from.

**Status:** in progress. The creator, on v20: "we're very close… keep saving all this as the style". Still to test: full-screen scenes, transitions between scenes and the sound.

To use it in another brand, keep the structure and the motion and put in the brand's own colors and type.

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

- Numbers and titles in Inter Tight 800, with tight letter spacing. The words that go with them, in Instrument Serif italic. Examples: "**3** *weeks*", "**21** *days*", "**Creator OS**" and "*from idea to reel*".
- Under the chin, a stack of a number and a word, which fades out before the next phrase. Yellow is for the number that carries the weight.
- Captions: white Montserrat 800, the spoken word in yellow, 1 to 3 words. They don't show while the stack is on screen.
- **Nothing that can't be read in time.** Out go type under about 36 px at 1080 wide, labels ("EDITOR · now", "v13", the calendar's numbers) and lists of steps. What can't be read in time is said with shapes, like the red icon, ✕ and ✓, or the days that fill up.
- Text goes below y≈270, so Instagram's top bar doesn't cover it.

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

## Kit pieces

The Remotion kit is built in the brand's project (`brands/<brand>/reel/`) in the first piece that uses it.

| Piece | What it is | How it's made |
|---|---|---|
| Glass pane | The dark, transparent panel, sized to what it shows, with a video inside when possible | Remotion: a blurred, darkened and aligned copy of the take, plus gradient, border, highlight and shadow |
| Comes from behind | Wraps any piece so it starts small behind the head and comes out with a spring and a 3D turn; the previous one moves back | Remotion, with the person's cutout on top (`cutout-person.mjs` and the kit's `Person` piece) |
| Panes with motion inside | A calendar whose days fill up, versions that pile up | Remotion |
| Growing stack | Warnings or errors that pile up: the front one readable, the others as edges, with a shake and a counter | Remotion |
| Reveal | Two panes that open from the flash at the fingertip | Remotion, with the fingertip measured frame by frame |
| Number stack | Number and word under the chin | Remotion |
| Captions | 1 to 3 words, the spoken one in yellow | Remotion, from the cut's map |

## History

- **Nov 17, 2026, v19:** glass with video inside instead of the white cards, and the reveal almost without text. The creator: "much better".
- **Nov 17, 2026, v20:** the pieces come out from behind the person and the previous one moves back. The errors stack up behind the warning, with no small type. The final window is two panes the size of what they show, with big type, and the flash follows the finger. The creator's request: "more dynamism… that they could come out from behind… a better distribution of the space".
