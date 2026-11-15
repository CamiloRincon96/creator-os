# Posting to Instagram through the API (once per account)

With this, Claude uploads the reels and their copies at the batch's times. `production/tools/instagram.py` uses Meta's official API. Claude only posts batches the creator approves in the chat.

## What the creator does only once (about 20 minutes)

1. **Professional account and page.** In Instagram, set @example to "Professional account" (business or creator) and link it to the Example Facebook page: Accounts Center → Accounts.
2. **Meta app.**
   1. At developers.facebook.com → My Apps → Create App, type "Business".
   2. Add the "Instagram" product → "API setup with Facebook login".
   3. The app stays in development mode; to post to your own accounts you don't need Meta's review.
3. **A token that doesn't expire (recommended).** The normal token lasts 60 days.
   1. At business.facebook.com → Business Settings → System Users → Add, with the admin role.
   2. Assign it the app and the Example page.
   3. "Generate token" with these permissions: `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`, `pages_show_list`, `pages_read_engagement` and `business_management`.
4. **Save the token in the Mac keychain.** Never in the repo or in the chat. In the Terminal app:
   ```
   zsh <repo>/production/tools/save-token.sh example
   ```
   - When it asks, and only then, copy the token in Chrome with the copy button, paste it and press Enter. It isn't shown.
   - Don't use a bare `security add-generic-password ... -w`: it cuts what you paste at 128 characters, and the token is about 200 long. Nor `-w "$(pbpaste)"` copying the command from the chat: the clipboard ends up holding the command, not the token.
   - The script checks that what you pasted is a Meta token (it starts with EA and is long) before saving it.
5. **Tell Claude "done".** It runs `instagram.py connect example` and `instagram.py test example`, which show the account, the followers and the day's quota.

## How it's used (stage 12 of /creator-reel)

1. `variations.py <piece> <variations.json>` builds 4 to 6 variations and the `batch.json`, with each one's copy, time and cover.
2. The creator watches them in Montage and approves the batch **in the chat**: videos, copies, day and times.
3. Claude runs `instagram.py approve <batch> --message "<what the creator said>"` and `instagram.py schedule <batch>`.
   - The Mac has to stay **on and connected** until the last time slot: the process runs on the computer.
4. `instagram.py status <batch>` shows what went out. `instagram.py results <batch>` brings views, reach, saves, shares and watch time for each one. Run it at 24 and at 72 hours.

## What the API doesn't do

- **It doesn't add music from Instagram's library or trending songs.** The music goes inside the video: Claude picks it from the licensed library. A trending song can only be added by hand from the app.
- **It doesn't schedule on Instagram's side:** that's why the Mac has to stay on.
- At most 100 posts through the API in 24 hours.

## Giving access to someone else on the team

Whoever clones the repo can schedule posts if they have a token. The token is the key to the account: it can post, read insights and reply to comments on @example. It doesn't expire.

**Recommended: one token per person.** That way, if someone leaves the team, access is removed for that person only.
1. The creator, at business.facebook.com → System Users → Add: `example-<name>`, admin role.
2. Assign it the same assets as `publisher`: the Example page, the Example app and the @example account, with content, community and insights.
3. "Generate token": Example app, expiration "Never" and the 8 permissions (the ones from the section above plus `instagram_manage_comments` and `read_insights`).
4. Send it through a secure, self-deleting link from a password manager (1Password, Bitwarden Send). **Never by WhatsApp, email or the chat.**
5. To remove access: System Users → `example-<name>` → "Revoke tokens".

**Quick (less secure): the creator's own token.** It's sent the same way, through a secure link. If it leaks it has to be revoked and everyone has to save a new one.

**What the other person does, once:**
1. Clone the repo, open Claude Code there and type `/creator-reel`. Whatever is missing gets installed: `python3 production/install.py`.
2. Save the token:
   - **Mac:** `zsh production/tools/save-token.sh example`. When it asks, copy the token from the link and paste it.
   - **Windows or Linux:** an `EXAMPLE_INSTAGRAM_TOKEN` environment variable with the token, in the system's user variables and never in a file in the repo.
3. `python3 production/tools/instagram.py test example` must show @example, the followers and the quota.

`production/instagram.json` goes in the repo: it only has the account id, not the token.

**Rules for several people:**
- **Only one computer schedules each batch.** If two run `schedule` with the same batch, it goes out twice.
- Only a batch the creator approved in the chat is posted.
- The quota of 100 posts a day belongs to the account, not to each person.

## Metrics without Claude waiting

`python3 production/tools/instagram.py watcher install` sets up a Mac task (launchd) that runs every hour:
- it checks every posted batch;
- at 24 and 72 hours it saves each reel's metrics in its `batch.json`;
- it sends a notification.

It doesn't use Claude or tokens. If the Mac is off, it fetches them the next time it runs.

- See how it's going: `instagram.py watcher status`. The log is at `~/Library/Logs/creator-os-metrics.log`.
- Remove it: `instagram.py watcher remove`.
- If the repo moves to another folder, run `watcher install` again: the task stores the script's path.

Installed on the creator's Mac on Nov 15, 2026.
