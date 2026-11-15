---
name: creator-notes
description: Processes the notes the creator sent from Montage (exact frame, drawn area and comment). Reads the captures, replies with the plan on each note, makes the changes with After Effects / HTML engines / Higgsfield / ElevenLabs / ffmpeg, publishes the new version and marks what it resolved. Use it when a Montage submission arrives, when a notice says there are pending notes, when the creator says "review my notes" / "I left you comments", or types "/creator-notes". It also responds when the user writes the same in another language.
argument-hint: "[project]"
allowed-tools: Bash(node montage/cli.mjs:*)
---

# Work through Montage notes

Speak the person's language: every question, instruction (log in here, paste this, click that), approval request and summary goes in the language they write to you in; translate tool messages when you relay them. Commands, code and file names stay in English.

House rule (`WORKFLOW.md`): **Claude prepares, the creator approves, Claude publishes.** Never mark a version as FINAL or publish to social networks from here.

## 1. Understand
- `node montage/cli.mjs pending` (or `--project $ARGUMENTS`). For each note, read with Read the `.jpg` capture and, if it exists, the `-zone.png` (crop of the drawn area at full resolution).
- Before changing anything, read the **project context** (the brief the team writes in the Context tab; `pending` prints it) and the **brand rules** it lists (`brands/<brand>/BRAND.md` and `PROFILE.md`). What the context says wins over your assumptions.
- To know what has been tried: `node montage/cli.mjs history <project>` (versions, what each one resolved, notes by state, and activity).
- Notes come signed: the creator or someone else on the team may have written them. Reply to whoever wrote each one.
- The drawing coordinates are in pixels of the original frame: the same as the After Effects composition. Time comes as timecode, seconds and frame number.
- Need more context? `node montage/cli.mjs view <project> --t 3.2,4.4` (full frames) or `--sheet 12` (contact sheet).
- The `origin` of the project and of the version says how it was produced: `.aep` + comp, `render.mjs <piece>`, Higgsfield prompt, editor.

## 2. State the plan before touching anything
- `node montage/cli.mjs reply <project> <n,n> "Plan: …" --state in_progress`. Use one concrete line per note, or group related ones.
- If something is ambiguous, or the change spends Higgsfield credits, ask in the note with `--state question`, giving concrete options and the cost, and carry on with the rest. The creator answers from the editor and that reaches you as another submission.
- Leave progress notices visible in the editor: `node montage/cli.mjs activity <project> "Rendering in AE…"`.

## 3. Make the changes according to the origin
- **After Effects** (MCP `aftereffects`):
  1. `ae_context`.
  2. Make the changes with `ae_do` (group them with `batch.run`).
  3. Verify with `ae_render_frame` at the notes' times, with `times` and `contactSheet`.
  4. Render with `render.add_to_queue` + `render.set_output` (outputPath) + `render.start`, with a high `timeoutMs`.
  5. If the piece has a separate mix, replace the audio with ffmpeg as in WORKFLOW.md (`-map 0:v -map 1:a -c:v copy`).
  6. If you version the `.aep`, save it as `-vN.aep`.
- **Remotion** (`brands/<brand>/reel`): edit the composition, check it with `npx remotion still <id> --frame=N` and render with `npx remotion render <id>`. Example's stories are an HTML engine (`brands/example/stories`, `node render.mjs`).
- **Higgsfield**: only after the creator approves the cost in the note. Download the result into the repo before publishing.
- **ElevenLabs (voice)**: the Robert voice (`AQkGeuTY47dqKKfZBMOO`, `eleven_multilingual_v2`), unless the creator asks for another.
- **ffmpeg / Montage editor**: for trims, audio and color. If the project has a `timeline.json`, edit it and export with `node montage/cli.mjs export <project>`.

## 4. Verify and publish
- Pull frames from the new render at the notes' times and compare them with the captures.
- Publish:
  `node montage/cli.mjs publish <project> <file> --note "what changed, in one line" --resolves <n,n> --origin "<how it was produced: .aep/comp, piece, prompt…>" [--markers "0:Hook,2.5:Logo"]`
- If a note was not fully resolved, do not put it in `--resolves`: reply to it explaining what is missing.
- If it helps, give per-note detail: `node montage/cli.mjs reply <project> <n> "Moved the logo to 0:02, on the hit" --state resolved --version vN`.

## 5. Close
- If you learned something useful for the next versions (a preference, something to avoid, a fact about the piece), add it to the context: read the current one with `node montage/cli.mjs context <project>`, add the line and save it whole with `--file <path.md>` or `--set "…"`.
- Summarize for the creator in the chat, in 2 to 4 lines: which version is up, what you resolved and what you asked.
- If the listener was active (`/creator-montage`), set it up again: `node montage/cli.mjs wait` with `run_in_background: true`. Do not set it up again if they asked to stop listening or if Montage was turned off.
