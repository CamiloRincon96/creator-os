# The glass kit

The Remotion pieces of the «glass» identity (`production/styles/glass/STYLE.md`): dark, transparent glass with video inside, pieces that come out from behind the person, few words and big. They're brand-neutral: colors and the main font come from `src/brand.ts`, and the identity's own choices (the display face, the glass tint, the curves) are in `theme.ts`. **Change the look there; keep the floor.**

The floor every identity meets is in `production/REELS-QUALITY.md` (part 1, with the recipes and the first-version traps): real and specific, never invented screens; the thing itself, not a symbol; visual before text; understood by someone who has never seen it; constant stimulus; each thing the size of what it shows; the person rules, but isn't everything; one world; the voice says what it has to say; reviewed in full with `review.py`. Each piece below says which part it serves.

## The pieces

| Piece | What it is | The part of the floor it serves |
|---|---|---|
| `GlassPanel` | A glass panel at x, y, w, h. With `footage`, the frosting is the same take, blurred, darkened and aligned with the frame behind it (`backdrop-filter` doesn't render in Remotion). Gradient, 1.5 px border, highlight on top, large shadow. | Each thing the size of what it shows, with video inside. Size it to its content: a big pane with a little piece inside looks empty. |
| `GlassWindow` | A `GlassPanel` that comes in pulling focus (blurred and slightly larger → sharp) and then gets a slow push-in. `focusIn()` gives that entrance to anything else. | Constant stimulus. Enter in the pause after the word, never inside it. |
| `glassStyle()` | Just the glass surface, for panels over footage that's already blurred (full-screen scenes over `World`). | |
| `World` | The world behind every full-screen scene: a photo or timelapse of the person's own, very blurred and dark, drifting slowly. Without footage, the brand's dark gradient. | One world: never a background from somewhere else. |
| `ComeFromBehind` | Wraps any piece: it starts small behind the person's head and springs out to its place with a 3D turn. With `until`, it moves back (smaller, blurred) when the next one arrives. It also keeps the frosted footage inside it in sync. | Constant stimulus: pieces come from somewhere and the previous one leaves. |
| `BigWord` | One word in the display face (wide, heavy, uppercase, normal tracking) that focuses in and blurs out. 150 px or less. | Visual before text: one word, big. Behind the head with the kit's `Person` (`behind` prop), or at y ≈ 250-300 on full-screen scenes. Hide the captions while it's on screen. |
| `NumberWord` | A number and its word, both in the display face («4–5 HOURS»). With `count`, it climbs to the value. | Real and specific: the person's real numbers. It counts with `Math.floor(frame)`, so two numbers on screen never disagree inside the motion blur. |
| `GlassPill` | One or two words in glass under the chin, in the display face. | The person rules: it reads in full and never covers the face. |
| `Logo` | A real logo from `public/logos/`: colored SVGs (names ending in «-color») as they are, one-color SVGs painted with `color`. | Visual before text: what's named is shown as it is, not written. |
| `AppIcon` | A rounded app tile with its letters, for a tool with no logo file at hand. Needs no files. | Visual before text. |
| `DISPLAY`, `disp()` | The display face and the style of a big word or number (`disp(size)`), in `theme.ts`. | The type hooks: wide or heavy and legible, no joined cursive or tight tracking. |
| `GlassCaptions` | Captions of 1 to 3 words from the cut map, the spoken word in the highlight color. A group never crosses the end of a sentence or the start of a phrase. `hide` where the phrase is already written big. | Nothing that can't be read in time. |
| `FilmGrain` | Fine grain that changes every frame. | One world: it ties takes from different days together and separates real footage from a clean template. |
| `Terminal`, `Typed`, `CheckLines` | A terminal in glass; the real command typed big (a «\n» splits it in two lines); the real lines a check printed, each with ✓. | Real and specific: copy the command from the README or from what you ran. |
| `ReelFeed`, `ReelUI` | A feed of reels with a generic interface (heart, comments, share, a placeholder user, caption, progress bar, no network's logo). The columns spin like a slot machine and stop on the same reel; then the camera goes through the center one into the next shot. | The only generic thing in a piece, on purpose: when the script talks about «everything out there looks the same». The reel they all land on is the person's own take. |

## Type and logos

- **The type hooks.** The display face here is Unbounded (800–900, uppercase, normal tracking): wide and heavy, readable at a glance. No joined cursive, no serif italic, no negative `letterSpacing`. Wide type takes more room: a big word at 150 px or less, and check it fits in 1,080. To pick your identity's own face, try 3 or 4 over the person's take before changing it.
- **Visual before text.** An app, an AI or a network is shown with its real logo; a number carries its icon (scissors for cuts, an eye for views, a book for lessons, «$0» for free); text only for what has no image. Simple icons like an eye or scissors can be a small inline `<svg>`.
- **Getting the logos.** This repo ships none. In the brand's reel project, install the free libraries and copy only the SVGs the piece needs to `public/logos/`:

  ```
  npm install simple-icons @lobehub/icons-static-svg
  mkdir -p public/logos
  cp node_modules/simple-icons/icons/tiktok.svg public/logos/
  cp node_modules/@lobehub/icons-static-svg/icons/claude-color.svg public/logos/
  ```

  `simple-icons` is CC0 (one-color brand logos, by slug); `@lobehub/icons-static-svg` is MIT (AI logos, with «-color» versions). Then `<Logo name="tiktok" size={64} />` or `<Logo name="claude-color" size={120} />`. The licenses cover the files; the logos are still their owners' marks: use them to name what you really used, never to suggest an endorsement.
- **Last resort:** an image that doesn't exist anywhere can be generated with Higgsfield (stage 8 of `/creator-reel`), only with a quote the creator approved.

## How a scene is put together

- **The person on camera** (`src/kit/Person.tsx`): the take underneath, then whatever goes behind them (`ComeFromBehind` pieces, a `BigWord`), then their cutout on top (`production/tools/cutout-person.mjs`). Check the cutout on the frames where a piece starts: at night, with a dark t-shirt or fast movement, it fails.
- **A full-screen scene:** `World` (or the real photo or timelapse itself, moving), one big protagonist panel with the real thing inside (logos, not names), one `BigWord` or `NumberWord`, `FilmGrain` on top. Captions lower (y ≈ 1,400), with a dark band over busy footage.
- **Motion blur:** wrap what moves fast in `CameraMotionBlur` (`@remotion/motion-blur`, shutter angle 200, 6 samples).
- **Timings come from the cut map,** on the word that names each thing. Something new every 0.5 to 1 s.
- **Every slot carries real material:** the person's takes, their `brands/<brand>/stock/` (photos and timelapses of them working), captures of their real tools, their numbers. The `GlassDemo` composition uses colored placeholders only to show the motion with no footage, and no `Logo`, so it renders with no `public/logos/` at all.

Then review the render in full with `review.py`, as with every piece.
