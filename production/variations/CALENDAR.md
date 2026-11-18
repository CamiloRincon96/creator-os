# When to post

**How it's refined:** after 4 weeks, look at the insights: at what times the most people who don't follow the account were reached, and on which days. Adjust this file with that data, which outranks any guide. Every change gets a date.

## Base rhythm (from Nov 17, 2026, new accounts like @example)

**One new video a week**, with its batch of variations. It's what production in stages can sustain without lowering the quality. When there's material for two, it's two batches a week (Tuesday and Friday).

| Day | What happens |
|---|---|
| Monday | The creator approves the variations plan (12a) and then the batch (12c) |
| **Tuesday** | **The day's batch:** 4 to 6 trial reels every 2 or 3 hours, from 9:00 a.m. to 7:00 p.m., in the brand's time (the time zone in its `PROFILE.md`, or the computer's) |
| Wednesday | Results at 24 hours: the computer's watcher (`instagram.py watcher`) saves them on its own, without Claude |
| Thursday, 7:00 p.m. | The variation that did best with non-followers goes out to the followers. The creator graduates it in the app |
| Friday | Results at 72 hours, written down in `LEARNED.md`, and the prompt is refined |

Typical batch times: 9:00, 11:30, 2:00 p.m., 4:30 p.m. and 7:00 p.m. With 6 variations, also 12:30 p.m.

## Before each batch: does the account have trial reels?

Not every account has trial reels. The 2026 guides ask for a public, professional and recommendable account with about **200 followers**; some say 1,000. Instagram may also not have turned them on yet. @example had 40 followers on Nov 14, 2026.

- **How to confirm:** in the app, when sharing a reel, the "Trial reel" toggle shows up. The creator checks it. It also shows if the API rejects the first one.
- **If it has them:** the day's batch, as above.
- **If it doesn't: they're not posted.** The creator, Nov 15, 2026: "I need the trial one or nothing". The variations stay ready in `finals/<project>/variations/` with the batch unapproved. Every week the creator checks whether the "Trial" toggle has appeared, and the batch is scheduled that day. Meanwhile, the account is grown with new pieces:
  - one new reel a week;
  - sharing it in stories from their personal account with a mention;
  - collaborations (Collab) with their personal account;
  - inviting contacts.

## Why this way

- The creator chose 4 to 6 trial reels on the same day, every 2 or 3 hours. Trial reels are only shown to people who don't follow the account, so they don't saturate the followers.
- The 2026 guides agree on about 3 to 5 reels a week to grow, and that consistency matters more than volume. With this, followers see 1 or 2 reels a week (the winner) and non-followers, 4 to 6.
- The account doesn't have its own data yet. The times are a starting point and change with what its insights say.

## Limits

- 100 posts through the API every 24 hours: more than enough.
- The computer that schedules stays **on and connected** until the batch's last time slot.
- **Only one computer schedules each batch.** If two people run `schedule` with the same batch, it goes out twice.
