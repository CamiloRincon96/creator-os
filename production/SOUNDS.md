# Sound vocabulary

Which effect goes at each moment of a reel, with which file from the library, how many and how loud. It comes from the CapCut sound guide the creator shared (Nov 14, 2026), from what they corrected in "Sin anotar" (the example reel), and from the three rounds of the first full reel made in "glass" (Nov 17, 2026): 106 interface sounds were "laser beams", 19 measured before the music were "bland, you can't hear anything", and 41 real ones at the voice's level were "exactly that".

Used in stage 9 (sound, with `production/tools/effects.py`) and in stage 12 (the sound of each variation's hook).

**How it's refined:** if a sound isn't liked or sounds over the top, it moves to "What we don't use" with the date. If a new one works, it's added to its row.

**Sounds from CapCut's library are only used inside CapCut:** they're not taken out for our videos. We use CC0 equivalents, with the license confirmed on their page and a credit in `credits.json`.

## The recipe: how many, how loud and where

This is what v33 of that reel left, measured against the niche study (`brands/<brand>/sounds/study/`, made by `sound_study.py`). `effects.py mix` checks each point and warns.

- **How many:** about 7 every 10 s (between 5 and 9). With 3 it was bland; with 12 interface sounds, "laser beams". No gap longer than 3.5 s without an effect.
- **Where:** on what really changes: the hook, scene changes, pieces that come in big, reveals, real objects on screen (a stamp, a camera, papers, a book). Not on every little thing that moves.
- **A full hook:** a hit and a whoosh on frame 0; one whoosh per piece that comes in; paper or cards if they stack; a short rise that ends on the reveal's hit. About 4 or more sounds before the hook ends.
- **How loud (peak against the voice, measured in the final mix with the music in):**

  | level in the sheet | peak against the voice | what for |
  |---|---|---|
  | `hook` | +3 dB | the frame-0 hit and the reveal's hit |
  | `hit` | +1.5 dB | words that land (a key word, a price, "and that's it") |
  | `transition` | 0 dB | the whooshes on scene changes |
  | `object` | −1.5 dB | stamp, shutter, book |
  | `small` | −4 dB | pieces coming in, papers, a phone swipe |
  | `rise` | −3 dB | the rise before a hit |

  In the niche an effect's peak sits about +2.6 dB over the voice. v31, with the effects at −7 dB, "couldn't be heard".
- **Without covering the voice:** they go in the gaps between phrases (0.15 to 0.2 s is enough). If a whoosh's tail touches the next word, lower it with `"adjust": -3` to `-7`, or swap it for a short one (`fast-whoosh/…bamboo…`, 0.21 s). Whisper, word by word, says whether any of them really covers a word.
- **Hits with body:** a mid layer (`punch-impact/dull-decompression…`), which is what a phone plays, and a low layer (`impact/hit-impact.mp3`, level `layer`) with a 60 to 120 Hz high-pass. At 170 Hz the hit loses its body.
- **Variety:** no recording more than twice; the whooshes take turns among about 13 in the library.
- **What doesn't reach, goes:** a recording so quiet that not even +30 dB gets it to its level (the library's scissors and marker) isn't heard; swap it or drop it.

## When each one goes

Files in `brands/example/sounds/openverse/`.

| Moment | Sound | Our file | Level |
|---|---|---|---|
| **Frame 0 of the hook, a reveal** | Hit with body + low layer | `punch-impact/dull-decompression-punch-impact-explodes-96khz.mp3` + `impact/hit-impact.mp3` (layer, high-pass 60) | `hook` |
| **Before revealing something** | Short rise | `riser/riser.mp3` (the last 0.9 s: `"slice": [1.09, 0.91]`, `"anchor": "end"`) | `rise` |
| **A word that lands, a figure that matters** | Hit | `punch-impact/punch-impact-sound-wav.mp3`, `thud/medium-thud-1.mp3`, `thud/light-thud-1.mp3` | `hit` |
| **Scene change, zoom, wipe** | Whoosh | `whoosh/`, `swoosh/`, `whoosh-transition/` (`wipe2` for a wipe, `deep-whoosh` for a zoom in) | `transition` |
| **A piece comes in or out from behind** | Short whoosh | `whoosh/swipe-whoosh.mp3`, `whoosh/13th-whoosh-swing-sound.mp3`, `fast-whoosh/`, `swish/` | `small` |
| **From one screen or reel to another** | Swipe | `card-slide/playing-card-slide-left.mp3`, `fast-whoosh/` | `small` |
| **Something that spins (a slot machine, a rewind)** | Rewind | `rewind/rewind-reversed-whoosh.mp3` | `transition` |
| **A stamp, a label being put on** | Stamp | `stamp/stamp.mp3` | `object` |
| **A photo, a screenshot, a new layer** | Shutter | `camera-shutter/camera-shutter.mp3` | `object` |
| **Cards or papers stacking** | Paper | `paper/paper-flip-1/2/3-wav.mp3` | `small` |
| **Something gets saved, closed** | Book | `book-close/book-close.mp3` | `object` |
| **Breaking a belief or a common mistake** | Short glitch | `glitch/glitched-sound-1-wav.mp3` (soft) | `small` |
| **Typing or dictating text** | Keyboard | `typing/` | `small`, never over a word: a click sounds like a consonant (a short word was heard as another one) |

## Combinations that work

- **Grabbing attention on frame 0:** a hit with body + a whoosh + the camera move.
- **Reveal:** a short rise and the hit, on the same frame.
- **Before and after:** a wipe (`wipe2`) on the change.
- **A list of steps or logos:** one short whoosh when the list comes in, not one per item.

## Rules

1. **The sound's peak goes on the action's frame** (real-sfx does it on its own; `"anchor": "end"` for a rise that ends on the hit).
2. **Not on every little thing:** on what really changes, about 7 every 10 s.
3. **At the voice's level, in the gaps:** the effects are heard (peak from −4 to +3 dB against the voice) and the voice is still understood because they fall between phrases.
4. **They're measured in the final mix, with the music in** (`effects.py`). Measured before the music, the music covers them.
5. **Sound with movement:** a whoosh without movement or a hit without a visual change is too much.
6. **One family per video:** real recordings (air, hits, paper, objects); nothing synthesized or tonal.
7. **Silence counts too:** in the emotional part, only a soft whoosh on the changes.
8. **In variations, a single sound for the hook,** the one that matches its opening.

## What we don't use

At the creator's request, nothing over the top ("I don't want you to use over-the-top stuff"):
- FAHH;
- vine boom;
- crowd gasp;
- applause;
- crickets;
- record scratch;
- error buzzer;
- heartbeat;
- clock;
- drum roll.

They're for comedy or drama, and they don't fit the brands' tone. To be reconsidered if a comedy piece ever calls for it.

**Nov 17, 2026, v30 of the first full reel made in "glass":** "you put laser beams everywhere… the most childish and nerdy stuff". These don't go either:
- synthesized interface sounds (the Kenney Interface pack: appear, icon, done, alert, swipe, click);
- dings, notifications, sparkles and shimmer (`chime/`, `notification/`, `sparkle/`, `shimmer/`);
- the video-game coin (`coin/coin-get.mp3`): for a figure, a hit;
- a sound on every little thing that moves.

`effects.py` won't mix a sheet with these sounds; in real-sfx, ban them with `taste.py ban`. A niche sound study (`brands/<brand>/sounds/study/STUDY.md`) of 12 reels in an AI and video-editing niche found how the most-viewed reels sound: about 4 real effects every 10 s, on 1 of every 4 picture changes; whoosh, a soft low hit and a short pop; almost nothing tonal; an effect's peak about +2.6 dB over the voice; and often a low music bed that carries the movement.
