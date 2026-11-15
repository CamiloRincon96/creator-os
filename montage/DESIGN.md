---
name: Montage
description: Montage's review editor, where the frame rules, surrounded by pure black.
colors:
  black: "#000000"
  surface: "#141517"
  surface-2: "#1a1c20"
  surface-3: "#212328"
  surface-4: "#2a2d33"
  field: "#0e0f11"
  viewer: "#0b0c0e"
  ice: "#7de3f4"
  ice-hover: "#9deefa"
  ice-soft: "rgba(125, 227, 244, 0.14)"
  on-ice: "#0b0b0c"
  text: "#f0f0f0"
  text-2: "#a1a4a5"
  text-3: "#8a8e92"
  border: "rgba(214, 235, 253, 0.1)"
  border-2: "rgba(214, 235, 253, 0.19)"
  claude: "#d97757"
  claude-2: "#ea9a7f"
  claude-soft: "rgba(217, 119, 87, 0.14)"
  ok: "#3ecf8e"
  warning: "#f5a524"
  error: "#ff5c5c"
typography:
  headline:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Helvetica Neue, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  brand:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Helvetica Neue, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Helvetica Neue, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    letterSpacing: "-0.01em"
  tab:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Helvetica Neue, sans-serif"
    fontSize: "14px"
    fontWeight: 500
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Helvetica Neue, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "'cv11', 'ss01'"
  body-sm:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Helvetica Neue, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Helvetica Neue, sans-serif"
    fontSize: "12px"
    fontWeight: 500
  caption:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Helvetica Neue, sans-serif"
    fontSize: "11.5px"
    fontWeight: 400
  data-lg:
    fontFamily: "JetBrains Mono, ui-monospace, Menlo, monospace"
    fontSize: "16px"
    fontWeight: 500
    letterSpacing: "0.01em"
    fontFeature: "'tnum'"
  data:
    fontFamily: "JetBrains Mono, ui-monospace, Menlo, monospace"
    fontSize: "11.5px"
    fontWeight: 400
    fontFeature: "'tnum'"
  data-badge:
    fontFamily: "JetBrains Mono, ui-monospace, Menlo, monospace"
    fontSize: "10.5px"
    fontWeight: 700
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  modal: "14px"
  pill: "999px"
spacing:
  hair: "2px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  2xl: "16px"
  bar: "56px"
components:
  button:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 13px"
    height: "32px"
  button-hover:
    backgroundColor: "{colors.surface-4}"
  button-primary:
    backgroundColor: "{colors.ice}"
    textColor: "{colors.on-ice}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "34px"
  button-primary-hover:
    backgroundColor: "{colors.ice-hover}"
  button-sm:
    height: "28px"
    padding: "0 10px"
    rounded: "{rounded.md}"
  button-mini:
    height: "24px"
    padding: "0 8px"
    rounded: "{rounded.sm}"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    rounded: "{rounded.md}"
    size: "32px"
  tool:
    textColor: "{colors.text-2}"
    rounded: "{rounded.md}"
    size: "34px"
  tool-active:
    backgroundColor: "{colors.ice}"
    textColor: "{colors.on-ice}"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    rounded: "{rounded.pill}"
    padding: "0 10px"
    height: "26px"
  chip-active:
    backgroundColor: "{colors.surface-4}"
    textColor: "{colors.text}"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "7px 10px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
  card:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.lg}"
    padding: "12px"
  version-card:
    rounded: "{rounded.lg}"
    padding: "8px"
  version-card-selected:
    backgroundColor: "{colors.surface-2}"
  modal:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.modal}"
---

# Design System: Montage

## Overview

**Creative North Star: "The frame rules"**

Montage is an edit suite in low light. The video lives in the center, surrounded by pure black, and the whole interface steps aside: graphite panels floating over the black canvas, separated by 8 px of empty space, with a cool, almost invisible border. It's the standard of professional dark editors (the bar is Frame.io for review and desktop CapCut for editing) executed with the Montage brand and without quirks.

The system is dense and tool-like. 13 px body, 14 px panel titles, 32 px tall buttons. Hierarchy comes from weight, text tone (three levels of gray) and position, not from size or color. Color is almost absent on purpose: the eye has to judge the video's color without the interface contaminating it. That's why there's a single accent, Ice, and it only appears where something is active. Claude has its own color, terracotta, and nobody else uses it.

Confirmed rejection: the generic graphite dashboard with blue accents everywhere.

**Key Characteristics:**
- Pure black canvas with floating #141517 panels, 12 px radius and 8 px apart.
- A single accent, Ice, with black text on top, exclusive to what is active.
- Terracotta exclusive to Claude: its avatar, its working presence, its replies and its markers.
- Inter for the interface; JetBrains Mono only for data (timecode, frames, counters, note numbers).
- Depth through black separation and a cool border, not shadows.
- A single authored motion moment: the Ice sweep of the freshly arrived version.

## Colors

Black and cool graphites with almost no chroma, an icy accent that marks what is active, and a terracotta that means "Claude".

### Primary
- **Ice** (ice): Montage's accent. Only in active states: the primary button ("Send to Claude", confirm in dialogs), the active tab underline (header and side panel), the active tool of the drawing rail, the playhead in the timeline and in the editor, the border of the selected version, clip, note or platform, the transport's current timecode, field focus, and the progress of bars and sliders.
- **Bright Ice** (ice-hover): only the hover of the primary button and of the play button.
- **Soft Ice** (ice-soft): 3 px focus halo around fields, background of ranges and active drop zones, hover of the play button.
- **Ink on Ice** (on-ice): every text or icon sitting on Ice or on a state-color pill. Never white on Ice.

### Secondary
- **Claude Terracotta** (claude): Claude's avatar, the dot of its working presence, the dot of its markers on the timeline and of its toasts.
- **Light Terracotta** (claude-2): Claude's text: its name in threads, "Claude" as the author of a version, the "Claude working" pill.
- **Soft Terracotta** (claude-soft): background of the working presence and of Claude's markers on the timeline.

### Tertiary
- **Approved Green** (ok): FINAL version, approved note, Claude listening (with a pulse), the Approve and Deliver buttons.
- **Question Amber** (warning): note with a pending question, delivery conflicts.
- **Reopened Red** (error): reopened note, errors, offline, danger actions.

### Neutral
- **Canvas Black** (black): the background of the app and the header; the empty space between panels.
- **Panel Graphite** (surface): every floating panel, the transport, the session card, the dialogs.
- **Card Graphite** (surface-2): note cards, composer, popovers, toasts; hover and selection of versions and platforms.
- **Control Graphite** (surface-3): button background, hover of icons and tools, `code` and `kbd`.
- **Raised Graphite** (surface-4): button hover, active chip and segment, version pill inside a note.
- **Field Well** (field): background of text fields and of the segmented control; darker than the panel that holds it.
- **Viewer Well** (viewer): background of the viewer panel and of the social stage; almost black and neutral so it doesn't tint the frame.
- **Text** (text), **Secondary text** (text-2), **Tertiary text** (text-3): primary, metadata and labels, hints and counters.
- **Cool Border** (border): 1 px border of panels, cards and internal dividers.
- **Strong Cool Border** (border-2): fields, chips, popovers, dialogs, tool rail, vertical separators.

### Named Rules

**The Ice Is Active Rule.** Ice marks what is active and nothing else: primary button, active tab, active tool, playhead, selected element (1 px border, 1.5 px on clips and layers) and current timecode. An element at rest is never Ice. Test: if you remove the active state and the Ice is still there, it doesn't belong.

**The Terracotta Belongs To Claude Rule.** Terracotta only appears where Claude speaks, works or signs. No button, state or decoration borrows it; team members sign in gray.

**The Neutral Frame Rule.** Everything around the frame is black or chroma-free graphite. State colors live in pills tinted at 13-16% (`color-mix` over transparent) or in 6-8 px dots, never on large surfaces.

## Typography

**Display Font:** none; the app has no display headlines.
**Body Font:** Inter (with -apple-system, BlinkMacSystemFont, Helvetica Neue), with `cv11` and `ss01` on.
**Label/Mono Font:** JetBrains Mono (with ui-monospace, Menlo).

**Character:** neutral, compact Inter for everything that is read; JetBrains Mono with tabular figures for everything that is measured. The pair separates words from data at a glance.

### Hierarchy
- **Headline** (600, 20-22 px, -0.02em): only standalone screens: first run, shut down, empty welcome.
- **Brand** (600, 17 px, -0.015em): "Montage" next to the logo in the header.
- **Title** (600, 14-15 px, -0.01em): panel title, brand group title on the home screen, version number; note title at 13.5 px.
- **Tab** (500, 14 px): header tabs (Review · Edit · Social) and side panel tabs (Notes · Context · Activity).
- **Body** (400, 13 px, 1.45): note text and interface text.
- **Body small** (400, 12.5 px, 1.5): thread replies, version note, popovers.
- **Label** (500, 12 px): small buttons, chips, segments, metadata.
- **Caption** (400, 11.5 px): hints, author and date, helper text in tertiary text.
- **Data large** (Mono 500, 16 px, tabular): current timecode in Ice; the frames at 13 px in Ice dimmed to 62%.
- **Data** (Mono 400-500, 11-12 px, tabular): total timecode, durations, timeline ruler, tab and chip counters, fps.
- **Data badge** (Mono 700, 10-11.5 px): note number, pins, FINAL stamp, Send button badge, version inside a note.

### Named Rules

**The Mono Is Data Rule.** JetBrains Mono is only for measurable or countable values: timecode, frames, durations, counters, note and version numbers in badges, commands. Never for titles, labels or running text.

**The Quiet Labels Rule.** No sustained capitals and no open tracking in the interface; panel titles are 14 px in sentence case. Hierarchy comes from weight and tone. The only capitals are data of their own: the FINAL stamp (mono 700, 0.04em) and avatar initials.

## Layout

A 56 px black header on a three-column grid (brand and project, centered tabs, actions on the right). Below it, a body of floating panels 8 px apart with an 8 px margin to the window edge: versions 268 px, fluid viewer, notes 356 px at full height; the timeline spans the width of versions plus viewer. The social view repeats the formula (252 px · stage · 300 px), and so do the video and image editors.

Rhythm: spacing of 2, 4, 6, 8, 10, 12, 14 and 16 px; 8 px is the dominant step (panel separation, between cards, between buttons). 50 px panel headers with 16 px on the left; 56 px transport; panel bodies with 10 px on the sides. Long lists fade out at the top with a 22 px mask when scrolled.

Responsive: at 1500 px the fps hides; at 1320 px the sides narrow (232 / 320 px); at 1120 px the versions drop to a horizontal strip under the timeline and the notes panel becomes 312 px; at 760 px the header splits into two rows with the tabs below and the page flows in one column.

### Named Rules

**The Floating Panels Rule.** Every work zone is a 12 px-radius graphite panel floating over black with 8 px of empty space around it. Panels never touch or share a border.

## Elevation & Depth

The system is flat. Depth comes from three things: the black between panels, the 1 px cool border and the tone step between graphites (black, panel, card, control, raised; fields and the viewer drop below the panel). Shadows only exist on things that float transiently above everything else.

### Shadow Vocabulary
- **Floating** (`box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55)`): popovers, toasts and pop-up menus.
- **Dialog** (`box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6)`): modals, over a 66% black veil.
- **Focus ring** (`box-shadow: 0 0 0 3px` Soft Ice): focused fields, together with the Ice border.
- **Selection ring** (`box-shadow: 0 0 0 2px` panel, `0 0 0 3.5px` color): selected note pin (Ice) and active color swatch (text).

### Named Rules

**The Black Gap Rule.** Panels and cards carry no shadow. If something needs separation, it gets black around it or a tone step, not a shadow.

## Shapes

Soft corners stepped by size: 12 px for panels, the tool rail and project cards; 10 px for note cards, versions, platforms and toasts; 8 px for buttons, fields and icons; 6-7 px for mini controls, thumbnails and inner segments; 4 px for `code` and the version pill; 14 px for dialogs. Full pills for chips, states, presence, stamps, labels over the video and notes on the timeline. Circles for avatars, color swatches and the play button.

Borders are always 1 px and cool; the dashed border is reserved for what doesn't exist yet (new note) or for the version being compared. The playhead is a 2 px line topped by a pentagonal tip.

## Components

### Buttons
- **Shape:** soft corners (8 px; 6 px at the mini size).
- **Default:** control graphite with a cool border, primary text at 500; 32 px tall (28 px small, 24 px mini, 42 px large for the session).
- **Primary:** Ice with black ink at 600, no border; the one in the header, "Send to Claude", is 34 px and carries a mono Ice-on-black badge with the note count.
- **Hover / Focus:** the default rises to raised graphite and a strong border; the primary turns Bright Ice. 0.12 s transitions. Visible focus: a 2 px Ice outline with a 2 px offset.
- **Semantic:** danger, approve and deliver are 8-12% red or green tints with a border of the same color at 34-38%; never solid fills.
- **Icon button:** 32 px, transparent, a lucide line icon in secondary text; hover in control graphite. Play is a 40 px circle with the icon in Ice.

### Chips
- **Style:** 26 px pill, strong border, transparent background, 12 px secondary text, tertiary mono counter.
- **State:** active in raised graphite with the cool border at 30% and primary text. Note states (draft, sent, Claude working, question, resolved, approved, reopened) are 20 px pills tinted at 13% with the text in their color.

### Cards / Containers
- **Corner Style:** 12 px for panels; 10 px for cards.
- **Background:** panels in panel graphite; note cards and the composer in card graphite.
- **Shadow Strategy:** none (see The Black Gap Rule).
- **Border:** 1 px cool border; strong on hover; Ice when the card is selected.
- **Internal Padding:** 12 px on notes; 8 px on versions; 11-13 px on project cards.

### Inputs / Fields
- **Style:** field well, 1 px strong cool border, 8 px radius, 7 px by 10 px padding; placeholder in tertiary text; Ice text cursor.
- **Focus:** Ice border plus a 3 px halo in Soft Ice.
- **Switch:** 32 by 18 px track in raised graphite; on, it turns primary text with the knob in black ink.
- **Segmented:** a channel in field well with 2 px padding; the active segment in raised graphite.

### Navigation
- **Header tabs:** Inter 500 at 14 px in secondary text, 30 px apart; the active one rises to primary text with a 2 px Ice underline with rounded ends. The side panel tabs repeat the pattern 24 px apart, with the mono counter next to them.
- **Mobile:** at 760 px the tabs drop to a second centered 44 px row.

### Versions
A 10 px card with a 42 by 75 px vertical thumbnail, version number at 14 px, date and author (Claude in light terracotta), a two-line note and the duration in tertiary mono. Selected: card graphite, Ice border and the number in Ice. Comparing: dashed border in secondary text. The actions appear in a capsule at the top right only on hover, focus or selection.

**The One Sweep Rule.** The freshly arrived version (`.version.fresh`) enters with a top-to-bottom sweep (clip-path) in Soft Ice with an Ice border for 1.1 s on the ease-out curve `cubic-bezier(0.16, 1, 0.3, 1)`. It's the only authored motion moment; the rest is state transitions (0.12-0.18 s), the entrance of floating elements (a 6 px rise with a fade, 0.18-0.4 s) and the presence pulse (green listening, terracotta working). With reduced motion everything collapses to 0.01 ms.

### Tool rail and transport
The rail floats inside the viewer, 14 px from the right edge: graphite at 94% with a strong border and a 12 px radius, 34 px tools. The active one is an Ice square with the icon in black ink. The drawing color swatches are 16 px circles: they are ink painted on the frame, not interface colors. The transport is a 56 px strip at the foot of the viewer: timecode on the left, controls in the center, speed, volume and zones on the right.

### Timeline
Tracks V1 (thumbnails), A1 (gray waveform) and N (note pills with the number in a badge of their state color and the truncated text). Mono ruler. The playhead is Ice. Note pins use their state color; the selected one carries the Ice ring. Claude's markers are soft terracotta pills with a terracotta dot.

### Social view
A list of platforms in 10 px cards (selected with an Ice border) and a stage over the viewer well with phones of 56 px radius and an inner cool border. Inside the phone screen, each platform's approximate interface rules, with its own colors; the Montage system ends at the phone frame.

## Do's and Don'ts

### Do:
- **Do** put every new zone in a 12 px-radius graphite panel over black, with 8 px of empty space around it.
- **Do** reserve Ice for the active state and always put black ink on top.
- **Do** use terracotta for everything Claude says, does or signs, and for nothing else.
- **Do** write timecode, frames, durations and counters in JetBrains Mono with tabular figures.
- **Do** express states with pills tinted at 13-16% of the state color and their text in the same color.
- **Do** separate by tone and by black; 1 px cool border on panels and cards.
- **Do** use 16-18 px lucide line icons in secondary text.

### Don't:
- **Don't** use Ice at rest, as decoration, in headlines or on large backgrounds.
- **Don't** use terracotta on buttons, states or accents that aren't Claude's.
- **Don't** put shadows on panels or cards; shadows are only for popovers, toasts, menus and dialogs.
- **Don't** use JetBrains Mono for titles, labels or running text.
- **Don't** tint the viewer or the social stage: the frame is judged on neutral black.
- **Don't** use sustained capitals or open tracking in interface labels or titles (the FINAL stamp and avatar initials are data, not labels).
- **Don't** fill buttons with solid green or red; semantic actions are tints with a border.
