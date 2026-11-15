# Montage

A local editor to review and edit this repo's videos and images with Claude. Every result is saved as a version, and this is where you decide which one is the FINAL.

**Install with Claude:** in Claude Code, inside the repo, type `/creator-install-montage` or "install Montage". Claude checks what's missing (Node.js, ffmpeg, Chrome), explains what each thing is for, asks for permission and installs it.

**Install by hand** (once per computer, with Node 22.12+ and ffmpeg):
- `cd montage && npm run install-app`. Installs the dependencies, builds the interface and creates the **Montage** app (`~/Applications/Montage.app` on macOS, a Desktop shortcut on Windows, a launcher on Linux).
- To remove the app: `node montage/install.mjs --remove` (it doesn't delete projects).

**Open:**
- The Montage app (Launchpad, Spotlight or the Dock). It opens as its own Chrome window.
- In Claude Code: `/creator-montage`. Starts the server, opens the window and leaves Claude listening.
- Without Claude: double-click `montage/open.command` or run `node montage/cli.mjs open`.
- Address: http://localhost:38420 (if it's taken, Montage uses the next free port up to 38429).

**Stop and quit:**
- **Stop listening**: click Claude's pill (top right) and "Stop listening". Claude doesn't listen again until someone types `/creator-montage`.
- **Shut down**: the power button in the header, or `node montage/cli.mjs stop`. Closes the server and the listening; everything saved stays intact.

**Team:** the first time, Montage asks your name. It signs your notes, versions and replies. Change it in the circle with your initials.

## The flow

1. Claude publishes each render as a new version of the project. It shows up in the editor on its own.
2. In **Review**:
   - Pause on the exact frame (←/→ step one frame).
   - Draw on the frame: rectangle, circle, arrow, pencil, text or pin.
   - Write the note and press Enter.
   - **I / O** mark a range.
3. Press **Send to Claude**:
   - If Claude is listening, it starts on its own.
   - If not, type `/creator-notes` in Claude Code.
4. Claude replies on each note and publishes the next version, saying what it resolved.
5. Check each note marked "to verify": look at it with **Compare** (curtain or side by side), then approve or reopen it.
6. When a version is right: **★ Final** and **Deliver**. It copies the original and makes the `-ig`, `-fb`, `-web` and `-no-audio` variants in `brands/<brand>/finals/<project>/`.

## Project context

The **Context** tab (right panel) is the piece's brief: goal, audience, platforms, tone, what it must have and what to avoid. It saves itself to `projects/<id>/context.md`. Claude reads it with every submission, along with the brand rules (`brands/<brand>/BRAND.md` and `PROFILE.md`, plus the shared root `WORKFLOW.md`), and can also update it. The **Activity** tab shows who did what.

## Social

The **Social** tab shows the piece inside an approximate Instagram interface (Reels, Story, Feed and Profile), TikTok, YouTube Shorts and Facebook (Reels and Feed), all in sync. Use it to see what each app covers, how it's cropped in the feed (4:5) and in the profile grid (3:4), and how it looks next to the brand's other pieces. Click a phone to see it large. The account and the post text can be changed; the brand safe zone is turned on in the Post panel.

## Edit

- **Video** (Edit tab): a timeline with video, text and audio tracks.
  - Drag media in from the library.
  - Cut with **S** or with the blade.
  - Trim from the clip edges.
  - Set scale, position, opacity, volume, fades and speed in the inspector.
  - **Export as version** renders with ffmpeg.
- **Image** (Edit tab):
  - Crop to social formats, rotate and flip.
  - Exposure, contrast, saturation, temperature, tint, sharpness, blur and vignette adjustments.
  - Text layers with the brand fonts and a per-line background, brand logos and shapes.
  - **Save as version** renders at full resolution.

Press `?` inside a project to see every shortcut.

## Where things are

- `projects/<id>/`: `project.json` (versions), `notes/`, `captures/`, `versions/vN/`, `timeline.json` and `image.json`.
  - Versions are APFS clones: they take no extra space and are read-only.
- `.cache/`: previews, thumbnails and waveforms. Delete them with `node montage/cli.mjs clear-cache`; they regenerate on their own.
- `cli.mjs`: commands for Claude. See `node montage/cli.mjs help`.
- Development:
  - `npm start`: the server.
  - `npm run dev`: the interface with hot reload; needs the server running.
  - `npm test`, `npm run check`.
