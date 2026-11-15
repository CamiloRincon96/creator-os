# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- The creator (the studio owner) and their team of editors and designers. They produce and review social content for their brands. The pieces are 9:16 reels, 4:5 carousels, stories and covers.
- Their work in Montage:
  - review the versions Claude produces (After Effects via MCP, Higgsfield, HTML engines and ffmpeg);
  - point to the exact frame and zone of each change, comment and send the list to Claude;
  - verify what was resolved and decide the FINAL version.
- Scene: long sessions in low light, like an edit suite, in Chrome on a Mac, keyboard-heavy.

## Product Purpose

Montage is where every result is kept as a version, where you talk with Claude about exact frames, and where the final is decided and delivered.

Success:
- point out an exact change in seconds;
- Claude understands it without ambiguity;
- reach the final version without losing the history.

## Positioning

It's a review editor that talks to Claude Code through the studio's subscription, without using the API.

- Notes travel with the frame, the timecode, the zone in pixels of the original frame and a drawn capture.
- Claude replies in the same note and publishes the next version.

No generic review platform closes that loop with the agent that produces the pieces.

## Operating Context

- A local web app served from the repo (`montage/`) on an uncommon local port.
- It installs with one command on any team computer and opens like an app.
- Capabilities:
  - video review: frame-by-frame scrubbing, version comparison, brand and platform safe zones, social view;
  - image and carousel review;
  - a video editor with a timeline;
  - a layered image editor;
  - delivery of per-platform variants.
- Claude listens for submissions from a Claude Code session. From the interface you can stop listening, and also shut down and quit Montage.

## Capabilities and Constraints

- Every feature, keyboard shortcut and the flow are kept. The layout can be reorganized if that improves the experience without losing features.
- English interface, dense, tool-like: the aesthetic never hides states, times or controls.
- The interface color must not contaminate how the video's color reads: color and detail are reviewed in low light.
- Several team members sign their notes and replies.
- Easy to open, to stop and to quit.

## Brand Commitments

- Aesthetic (the creator's decision, 2026-10-29): the standard of professional dark editors, executed without irony or quirks.
  - The finish must be on par with Frame.io (frame-accurate review) and desktop CapCut (social editor).
- What belongs to Claude (sending, its replies, its presence) stands out with Claude's own color.
- Studio rule: Claude prepares, the creator approves, Claude publishes. A person decides the FINAL version.
- The brand identities (logos in `<brand>/logo/`, the Montserrat, Jost, Rajdhani, Playfair, Michroma, Inter, Geist and Bricolage fonts) belong to the content, not to the tool.

## Evidence on Hand

- Real projects imported in `montage/projects/`: the intro reel v1–v6, short reels R1–R3, three animations, Orbits (reel and post) and carousel 01.
- There are no testimonials, metrics or clients to show inside the tool.

## Product Principles

1. Precision before decoration: frame, time and zone always readable.
2. The video leads: the interface steps back around the frame.
3. Claude is a visible collaborator, never noise.
4. Nothing gets lost: every version, note and reply stays in the history.
5. Open, stop and quit without friction.

## Accessibility & Inclusion

- Long use in low light: enough contrast without glare.
- Visible focus, and everything works from the keyboard.
