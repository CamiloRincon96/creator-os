# Music for the variations

**How it's refined:** whatever happens with the music in each batch (which one retained more, whether Instagram muted something) is written down in `LEARNED.md`. If it repeats, it moves up here.

## The reality (November 2026)

- **Commercial songs aren't downloaded to put them in the video.** Instagram matches every video against a song database and detects them even when the content isn't an ad. It mutes the audio or blocks the video (sometimes only in some countries) and, if it keeps happening, removes features or suspends the account. On top of that, every song has two rights: the composition and the recording.
- **There is a trending-audio API (Meta's Audio API, checked on Nov 17, 2026).** `instagram.py audios <brand>` lists the trending music authorized for third parties and the viral original sounds. In a batch, `"audio"` adds it when posting: the license is Instagram's and the song doesn't go inside the file. Only with Facebook Login, which is the one this repo uses. What the app has and the API doesn't (the commercial hits) is added by hand from the app.
- **Business accounts have a trimmed library:** mostly royalty-free music, not the hits of the moment.

## What we do

0. **First, Instagram's trend through the API.**
   - `instagram.py audios <brand>` (and `--type original_sound`): pick 3 or 4 that fit the piece, for example "Before and After" for a before-and-after story.
   - Download their previews and build a listening test: the reel's opening with each one, at a fixed level about 15 LU under the voice, which is how Instagram mixes it.
   - The creator chooses by ear. The reel is posted without music, with `"audio"` in the batch.
   - For TikTok and YouTube, where it doesn't apply, the version with CC0 music goes out (below).

1. **Read the trend, use the style.** For each batch, Claude looks up the audio dominating this week and notes its style (genre, energy, BPM, whether it's in Spanish). Then it searches Openverse for a **CC0** track in a similar style and confirms the license on the source page. It uses the `openverse-audio` skill, and the credits go in `brands/<brand>/sounds/music/credits.json`.
2. **Each variation can have a different track**, with its hit aligned to the key moment (`align`) and the usual gentle ducking: about 3 dB under the voice, with no rises. The music plays about 15 LU below the voice, because on the phone speaker it sounds louder.
3. **The "trend" variation, by hand and optional.** If the creator wants to try a song of the moment, Claude leaves it ready without music (`<id>-no-music.mp4`) with its copy. The creator uploads it from the app as a trial reel and adds the audio from Instagram's library. That way the license is Instagram's. It's marked in the batch as `"manual": true`, and `instagram.py` doesn't post it.
4. **At most one track per batch is repeated** from one batch to the next. Variety counts too.

## Licensed library

- Effects: `brands/example/sounds/openverse/` (CC0, with credits).
- Music: `brands/example/sounds/music/`. Right now there's "Upbeat loop" (mistermender), with its hit at 9.881 s into the track, and "Disco funk" (josefpres).
- To get more: the `openverse-audio` skill searches and downloads from Openverse. Then confirm the license on Freesound, and whatever fails is marked `DO_NOT_USE`.
