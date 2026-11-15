# How we work on social media content

The shared workflow for every brand in the repo (agreed with the creator on November 12, 2026). Each brand's own rules are in `brands/<brand>/BRAND.md` and `PROFILE.md`; if they clash with this document, the brand's wins.

**Reels in stages:** pieces with a person on camera (and animated ones you want to run the same way) follow `production/REELS-WORKFLOW.md`: every stage ends in something the creator approves before moving on to the next.

## The workflow, in order

1. **Facts first.** Before writing, gather what can be claimed: the tagline, the figures and the official logo, taken from the brand's repo or website. Tax or legal content needs an official source and a review by an accountant or a lawyer. No made-up figures or features.
2. **Script and voice.** Write the script and record the voice. The voice rules: every timing in the video comes from its words, and it isn't sped up to make it fit.
3. **Test the hard parts.** The two or three hardest moments are made first, on their own, and shown to the creator. If they don't convince, change the idea before building everything.
4. **Build in code.** The video is assembled in Remotion (with three.js inside Remotion when it's 3D). A single list of moments drives both picture and sound.
5. **Review at full size.** Before showing anything, look at the frames at full size: transitions, readable text, odd stray frames. Small-scale tests hide flaws.
6. **Sound.** Real effects with the `real-sfx` skill (sounds found with `openverse-audio`), mixed to -14 LUFS, with the voice above everything.
7. **Show with links.** Every result is published in Montage as a new version and the creator gets the links: Montage, the desktop copy and the file in the repo.
8. **Notes and fixes.** The creator leaves notes in Montage on the exact frame. Claude fixes them, publishes the next version and says what it resolved.
9. **Accept.** Only the creator marks the FINAL version. That's when the variants for each network are delivered.
10. **Post.** Claude posts to social media only when the creator asks for it in that message. Texts with a limited number of changes (names, usernames) are confirmed letter by letter before saving.
11. **Keep a record.** What was posted, the captions and what's pending are written down in the brand's `PROFILE.md` or `BRAND.md`.

## Which tool for what

| Tool | What for | Not for |
|---|---|---|
| Remotion (code, in `brands/<brand>/reel/`) | Building the video: text, the real app, 3D, voice | Last-minute trims |
| Montage (`montage/`, our own editor) | Reviewing, leaving notes on the frame, comparing versions, approving and delivering; trims and simple changes on its timeline | Building animation |
| Remotion Studio (Remotion's editor) | Preview for whoever is building | Reviewing with the creator: it doesn't keep notes or versions |
| After Effects | Only if a specific effect doesn't come out well in code | The everyday workflow: it isn't as easy to repeat or fix |
| ElevenLabs | Each brand's voice | Images, video or music (the current connector doesn't do them) |

Review and editing happen in Montage, not in Remotion's editor: Montage already has the notes, the versions, the comparison and the per-network delivery.

## Rules that came from mistakes

- **The first frame can't be empty.** Instagram uses it as the cover for stories and highlights. If the video opens on black, prepare a separate cover.
- **Covers that differ from each other.** The grid can't show three that look the same; each piece gets its own object and color.
- **Nothing grows bigger than the screen.** A layer scaled up many times breaks into repeated frames when rendered at full size.
- **Store badges and third-party logos:** use the official files, unchanged.
- **What you promise has to exist.** If the piece says "pre-register" or "download it", the link must lead there. If not, flag it before posting.
- **Instagram from the computer:** stories are uploaded through Meta Business Suite; highlights are built on the phone or from the archive 24 hours later; a reel's cover can only be chosen when uploading it.
- **The Instagram caption** is cut after about 118 characters. The call to action goes on the last visible line.
- **Reels, especially with a person on camera:** cut, voice, image, animation, sound and cleanup each have their checklist in `production/LESSONS.md`. Read it before starting and go over it at each stage.
