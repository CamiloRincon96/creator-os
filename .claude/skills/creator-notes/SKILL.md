---
name: creator-notes
description: Processes the notes the creator sent from Montage (exact frame, drawn area and comment). Reads the captures, replies with the plan on each note, makes the changes with After Effects / HTML engines / Higgsfield / ElevenLabs / ffmpeg, publishes the new version and marks what it resolved. Use it when a Montage submission arrives, when a notice says there are pending notes, when the creator says "review my notes" / "I left you comments", or types "/creator-notes". It also responds when the user writes the same in another language.
argument-hint: "[project]"
allowed-tools: Bash(node montage/cli.mjs:*)
---

# Work through Montage notes

Speak the person's language: every question, instruction (log in here, paste this, click that), approval request and summary goes in the language they write to you in; translate tool messages when you relay them. Commands, code and file names stay in English.

House rule (`WORKFLOW.md`): **Claude prepares, the creator approves, Claude publishes.** Never mark a version as FINAL or publish to social networks from here.

Whoever writes the notes may not be technical. Everything you tell them, in the chat or in a note, follows `production/GUIDING.md`: simple words, one idea per line, and no bare tool names (no "comp", "layer" or `ae_do`).

## 1. Understand
- When the submission arrives, say it in the chat in one line: "3 notes came in from <name> on "<project>". First I'll leave the plan on each note, then I'll make the changes."
- `node montage/cli.mjs pending` (or `--project $ARGUMENTS`). For each note, read with Read the `.jpg` capture and, if it exists, the `-zone.png` (crop of the drawn area at full resolution).
- Before changing anything, read the **project context** (the brief the team writes in the Context tab; `pending` prints it) and the **brand rules** it lists (`brands/<brand>/BRAND.md` and `PROFILE.md`). What the context says wins over your assumptions.
- To know what has been tried: `node montage/cli.mjs history <project>` (versions, what each one resolved, notes by state, and activity).
- Notes come signed: the creator or someone else on the team may have written them. Reply to whoever wrote each one, in their language.
- A reopened note carries in its thread what was missing or didn't come out right: start there.
- The drawing coordinates are in pixels of the original frame: the same as the After Effects composition. Time comes as timecode, seconds and frame number.
- Need more context? `node montage/cli.mjs view <project> --t 3.2,4.4` (full frames) or `--sheet 12` (contact sheet).
- The `origin` of the project and of the version says how it was produced: `.aep` + comp, `render.mjs <piece>`, Higgsfield prompt, editor.

## 2. State the plan before touching anything
- `node montage/cli.mjs reply <project> <n,n> "Plan: …" --state in_progress`. Use one concrete line per note, or group related ones. Say what changes and where, the way the person would say it: "Plan: I'm moving the text up so it doesn't cover your face, from 0:03 to 0:05."
- If something is ambiguous, or the change spends Higgsfield credits, ask in the note with `--state question`, giving concrete options and the cost, and carry on with the rest. The question says what the decision is for; each option, what it's for and what it costs ("Free" or "Paid:" with what gets paid), with the recommended one first. For example: "How do we fix the light? A) With color grading, free, in a few minutes (Recommended). B) With AI (Higgsfield): paid, N credits; I'll wait for your yes before spending."
- In Montage, that note says "Claude needs your answer to continue" and has a box to reply. Tell them in the chat in one line: "I left you a question on note #4: answer it in Montage, under the note." The creator answers from the editor and that reaches you as another submission.
- Leave progress notices visible in the editor, in simple words and with the time if it takes a while: `node montage/cli.mjs activity <project> "Making the new video (about 3 minutes)…"`.

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
- **If something fails** (a render that won't come out, a change that can't be made): don't publish a broken version. Reply on the note with what happened, in simple words, and the step you propose (or ask it with `--state question`). Say it in the chat in one line too.

## 4. Verify and publish
- **Mandatory review of the whole video**, not just the note's frame: `python3 production/tools/review.py <render> --stage N [--cut <piece>]` (N, the piece's stage). Look at all its images, read what is heard and write "## What I saw" in its `REVIEW.md`. A change in one spot can break another.
- **The quality lock** (`/creator-reel`, "The quality lock"): the lock lines in order; the `reel-reviewer` agent scores the version with only the report's path, the stage and the project; nothing under 8. Without it, Montage won't publish. When you reply, the reviewer's score and "Give it your stars in Montage".
- Pull frames from the new render at the notes' times and compare them with the captures.
- Publish:
  `node montage/cli.mjs publish <project> <file> --note "what changed, in one line" --resolves <n,n> --origin "<how it was produced: .aep/comp, piece, prompt…>" [--markers "0:Hook,2.5:Logo"]`
- If a note was not fully resolved, do not put it in `--resolves`: reply to it explaining what is missing.
- If it helps, give per-note detail: `node montage/cli.mjs reply <project> <n> "Moved the logo to 0:02, on the hit" --state resolved --version vN`.
- What the person sees in Montage: the new version lands in the versions list by itself; resolved notes move to the **To verify** tab, with "Applied in vN: check it, then approve or reopen" and the **Approve** and **Reopen** buttons.

## 5. Close
- If you learned something useful for the next versions (a preference, something to avoid, a fact about the piece), add it to the context: read the current one with `node montage/cli.mjs context <project>`, add the line and save it whole with `--file <path.md>` or `--set "…"`.
- Summarize in the chat, in 2 to 4 lines: which version is up and the file as a link that opens in the editor (`production/GUIDING.md`, point 5), what you resolved, what you asked, and what the person does now. For example:
  > Done: v4 is in Montage, in "<project>". The file: [<name>.mp4](<the render's path in the repo>).
  > I resolved #1, #2 and #3: they're in **To verify**. If it looks right, click **Approve**; if not, **Reopen** and write what's missing.
  > On #4 I left you a question.
- If no open notes are left, remind them in one line that they mark the FINAL themselves, with the version's star ("Mark as FINAL"). You never mark it.
- If the listener was active (`/creator-montage`), set it up again: `node montage/cli.mjs wait` with `run_in_background: true`. Do not set it up again if they asked to stop listening or if Montage was turned off.
