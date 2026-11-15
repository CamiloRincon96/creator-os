# The brand's Remotion

The brand's videos in code (1080 × 1920, 30 fps).
- `npm install`
- `npx remotion studio` to preview them;
- `npx remotion render <Composition> <output.mp4>` to render.

- `src/brand.ts`: **change your colors, your font (Google Fonts) and your logo here.** Everything else takes them from here.
- `src/kit/`: the person with text behind their head (`Person`, using the cutout from `production/tools/cutout-person.mjs`), scenes, the phone and the hook text.
- `src/explainer/`: the express reel from a voice note (`production/tools/note.py`). `screens.tsx` holds YOUR product's screens inside the phone: swap them for yours.
- `src/mockup/`: the gray mockup from stage 5 of `/creator-reel`.
- Each new piece is a composition in `src/pieces/<name>/`, registered in `src/Root.tsx`.
