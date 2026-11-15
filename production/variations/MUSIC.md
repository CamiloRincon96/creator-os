# Music for the variations

**How it's refined:** whatever happens with the music in each batch (which one retained more, whether Instagram muted something) is written down in `LEARNED.md`. If it repeats, it moves up here.

## The reality (November 2026)

- **Commercial songs aren't downloaded to put them in the video.** Instagram matches every video against a song database and detects them even when the content isn't an ad. It mutes the audio or blocks the video (sometimes only in some countries) and, if it keeps happening, removes features or suspends the account. On top of that, every song has two rights: the composition and the recording.
- **The API can't add audio from Instagram's library** to the reels it posts: the music has to come inside the file.
- **There's no official "trending audio" API.** What exists are public trackers updated every week.
- **Business accounts have a trimmed library:** mostly royalty-free music, not the hits of the moment.

## What we do

1. **Read the trend, use the style.** For each batch, Claude looks up the audio dominating this week and notes its style (genre, energy, BPM, whether it's in Spanish). Then it searches Openverse for a **CC0** track in a similar style and confirms the license on the source page. It uses the `openverse-audio` skill, and the credits go in `brands/<brand>/sounds/music/credits.json`.
2. **Each variation can have a different track**, with its hit aligned to the key moment (`align`) and the usual gentle ducking: about 3 dB under the voice, with no rises. The music plays about 15 LU below the voice, because on the phone speaker it sounds louder.
3. **The "trend" variation, by hand and optional.** If the creator wants to try a song of the moment, Claude leaves it ready without music (`<id>-no-music.mp4`) with its copy. The creator uploads it from the app as a trial reel and adds the audio from Instagram's library. That way the license is Instagram's. It's marked in the batch as `"manual": true`, and `instagram.py` doesn't post it.
4. **At most one track per batch is repeated** from one batch to the next. Variety counts too.

## Licensed library

- Effects: `brands/example/sounds/openverse/` (CC0, with credits).
- Music: `brands/example/sounds/music/`. Right now there's "Upbeat loop" (mistermender), with its hit at 9.881 s into the track, and "Disco funk" (josefpres).
- To get more: the `openverse-audio` skill searches and downloads from Openverse. Then confirm the license on Freesound, and whatever fails is marked `DO_NOT_USE`.
