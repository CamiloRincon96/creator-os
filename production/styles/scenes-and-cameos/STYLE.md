# Style: scenes and cameos

The first style in the library (November 13, 2026). It comes from the reel the creator chose as a reference, `Dfs3AAmjmqH` (analysis in `production/references/2026-11-13-reference-reels.md`). The structure is the reference's; the colors, the typeface and the motion are each brand's.

**Status:** defined on paper. The Remotion kit is built in the first piece that uses it, starting with its hard moments.

## Structure

| Part | Length | What's seen |
|---|---|---|
| Hook | 3 to 4 s | The person on camera. Behind the head, a huge word that the head covers. On the chest, a small card that's already moving |
| Scenes | 2 to 4 s each | Full screen with no person, with the voice on top: a big title at the top left with its number, a single protagonist in the center, a caption at the bottom |
| Cameos | 2 s, three or four of them | The person comes back. They enter with a blurred swipe, not a hard cut. An icon with its label next to the face |
| Ending | 3 to 4 s | The person, again with the big word behind and a card on top with what you're asked to do |

## Numbers

- Person on screen: a third of the piece, never more than 4 s in a row.
- A visual change every 2 to 3 s.
- One protagonist per scene.
- On-screen text: at most six words per title.
- **Zooms (the creator's request, Nov 13, 2026):** in scenes and cameos, to hold attention, without overdoing it. A hard zoom (in one frame) to mark the key word; a slow push-in or pull-out to accompany a whole scene. Never two hard zooms in a row in different scenes. The hook gets two, staggered (the creator's request when approving the "Sin anotar" mockup).
- **It has to look good:** what's shown has to look finished; it can cover the face or take up half the screen. No dot patterns, dotted borders or effects that look cheap.

## Current version of the style

**v1, saved as the base on Nov 13, 2026** with "Sin anotar" (the example reel). The creator: "save more or less this style for now, it has some things to improve, it's not that visually attractive yet, but we can work with it". So v1 is the floor, not the ceiling: every new piece should look more attractive than this.

- Kit code: `brands/example/reel/src/kit/scenes.tsx` (`LightBackground`, `DarkFloor`, `Shine`, `FloorShadow`, `Float`, `Glass`, `Phone`, `SceneTitle`, `Waves`) and `brands/example/reel/src/kit/Person.tsx` (word behind).
- Full example: `brands/example/reel/src/pieces/sinAnotar/` (one file per group of scenes).
- Recipes that already work:
  - Punchy typography for a contrast phrase: word by word, the key one drops with blur and gets crossed out. No captions there.
  - Real-life objects (sticky notes, a banknote, a spreadsheet) that move with simple physics.
  - The brand's hummingbird as the one who solves it.
  - The floating phone as the stage, with what matters coming out of the screen large: inside the phone the text is too small to read.
  - A stamp that drops to close a step.

## Kit pieces

| Piece | What it is | How it's made |
|---|---|---|
| Word behind | Huge text that the head only partly covers: the word must stay readable. It appears 3 or 4 frames before it's said, already in its color, and not earlier (the creator's note: "right on it or just a bit before, not for so long") | Local cutout with `cutout-person.mjs` and the kit's `Person` piece (tested on Nov 13, 2026) |
| Epic person | Natural, soft color; the background the same as the person (neither darkened nor blurred) and the vignette over everything evenly. What's epic comes from the word behind, the zooms and the animation, not from the color | The kit's `Person` piece, on top of the block with color from After Effects |
| Card over the person | A small interface piece, never over the face or the captions: between the chin and the captions, fully inside the frame and before Instagram's buttons (x < 980), outside the zoom so it doesn't grow or move. Check it on the frames of the whole scene, because the face moves. If it's something people do by hand (logging expenses), show it the way people do it (a spreadsheet), not with the app | Remotion |
| Scene with title | A background with light and depth (soft light behind the protagonist, vignette) and the support element as an object with volume: a glass card tilted in 3D, with a shadow on the "floor". No line-pattern backgrounds or flat cards in a row: that "looks like a slide" (the creator's note, "Sin anotar" v9) | Remotion (`week.tsx` from "Sin anotar" as the example) |
| Swipe to cameo | The person's entrance and exit with motion blur | Remotion (`motion-blur.md`, `transitions.md`) or After Effects |
| Icon with label | A detail next to the face in the cameos | Remotion |
| Captions | Small, word by word, with the key word highlighted | Remotion, from the cut's map |
| Label ("Example", "Coming soon", "Demo") | Only if the creator asks for it for that piece | Remotion. What doesn't exist yet is noted in the brief, and the creator decides how it's shown |

## What doesn't go

- Hard cuts between two takes of the person.
- The same visual aid mounted twice over the camera (it happened with the week strip in "Sin anotar"): a visual idea is a scene of its own, once.
- More animation than the reference `Dfmt5VSOqjb`, which the creator finds too much.
- Scenes that look like a slide: a flat or line-patterned background and flat elements in a row.
- Interface over the face or the captions.

## By brand

- **Example:** banknote green and mint, Figtree in every weight (no second typeface: what the reference sets in italic serif is highlighted here with color and weight), the spring and the motion rules from ADR-0035. Safe zones from `brands/example/BRAND.md`.
