# Sound vocabulary

Which effect goes at each moment of a reel, and with which file from the library. It comes from the CapCut sound guide the creator shared (Nov 14, 2026) and from what they corrected in "Sin anotar" (the example reel).

Used in stage 9 (sound) and in stage 12 (the sound of each variation's hook).

**How it's refined:** if a sound isn't liked or sounds over the top, it moves to "What we don't use" with the date. If a new one works, it's added to its row.

**Sounds from CapCut's library are only used inside CapCut:** they're not taken out for our videos. We use CC0 equivalents, with the license confirmed on their page and a credit in `credits.json`.

## When each one goes

Files in `brands/example/sounds/openverse/`.

| Moment | Sound | Our file | Rule |
|---|---|---|---|
| **A text or a key word appears** | Soft pop | `ui-pop/ui-series-hollow-pop.mp3`, `bubble-pop/` | Quiet; for text and light elements |
| **Before and after, a result, a photo or a screenshot** | Camera flash / shutter | `camera-shutter/camera-shutter.mp3` | The hit lands exactly when the new image appears |
| **Breaking a belief or a common mistake** | Short glitch | `glitch/glitched-sound-1-wav.mp3` (soft) | Under half a second. `glitch-01` is heavier: only if the moment calls for it |
| **Before revealing something** | Riser | `riser/riser.mp3` | Ends exactly on the reveal; better if it lands on a hit |
| **A word that drops, a visual hit, a stamp** | Hit / impact | `thud/`, `impact/hit-impact.mp3`, `punch-impact/`, `stamp/stamp.mp3` | With a high-pass (about 170 Hz) under the voice; only for the big moments |
| **Movement, swipe, zoom, something enters or leaves** | Whoosh | `whoosh/`, `swoosh/`, `whoosh-transition/`, `fast-whoosh/` | In the same direction and on the same frame as the movement |
| **Quick cut** | Quick whoosh | `fast-whoosh/fast-whoosh-bamboo-…`, `card-slide/` | In reels under 30 s |
| **Solution, tip, positive point** | Ding / chime | `chime/chime-notification.mp3`, `chime/loading-chime.mp3` | Clean and unobtrusive |
| **A message or an alert arrives** | Notification | `notification/` | For phone alerts on screen |
| **Money, prices, cash** | Coin | `coin/coin-get.mp3` | Not on every figure: on the one that matters |
| **Something improves, ends up clean or tidy** | Sparkle / shimmer | `sparkle/`, `shimmer/` | Short (trim the tail) |
| **Going from one screen to another** | Swipe | `card-slide/`, `whoosh/swipe-whoosh.mp3` | |
| **Typing or dictating text** | Keyboard | `typing/` | Stops when the text ends |

## Combinations that work

- **Grab attention at frame 0:** hit + camera move (like the opening of "Sin anotar").
- **Reveal:** riser, a short pause and the hit.
- **Before and after:** camera flash + hit.
- **List of steps:** a pop or a ding on each point, always the same one.

## Rules

1. **The sound's peak goes on the frame of the action** (`anchor: "peak"` in `variations.py`; real-sfx does it on its own).
2. **Not on every cut:** the strong ones are saved for the hook, the big changes and the ending.
3. **The voice always on top:** effects sit about 5 dB below the voice.
4. **Short:** long tails are trimmed.
5. **Sound with movement:** a whoosh without movement or a hit without a visual change is too much.
6. **A single family per video.** Ours is clean and dynamic: pops, whooshes, hits with body and dings.
7. **Silence counts too:** a pause before the strong fact.
8. **In the variations, a single sound for the hook,** the one that matches its principle.

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

**Nov 17, 2026, "Tres semanas" v30:** "you put laser beams everywhere… the most childish and nerdy stuff". These don't go either:
- synthesized interface sounds (the Kenney Interface pack: appear, icon, done, alert, swipe, click);
- dings, notifications, sparkles and shimmer (`chime/`, `notification/`, `sparkle/`, `shimmer/`);
- a sound on every little thing that moves.

Ban them in real-sfx (`taste.py ban`). A study of the 12 most-viewed reels in the niche showed how they sound: about 4 effects every 10 s, on 1 of every 4 picture changes; whoosh, a soft low hit and a short pop; almost nothing tonal; and often a low music bed that carries the movement.
