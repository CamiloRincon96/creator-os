# Posting to Instagram through the API (once per account)

With this, Claude uploads the reels and their copies at the batch's times. `production/tools/instagram.py` uses Meta's official API. Claude only posts batches the creator approves in the chat.

## What the creator does only once (about 25 minutes)

`/creator-connect` does these steps with the person, one by one. For each step, `python3 production/tools/connect.py open <step>` opens the exact page. Checked on Nov 16, 2026 against Meta's official documentation (sources at the end).

**Why this path.** It's the one Meta calls "Instagram API with Facebook Login", with a system user.
- **It uploads the video from the computer.** The other path, "with Instagram Login", needs the video hosted on a public server.
- **The key doesn't expire.**
- **The same key also posts to the Facebook Page** (`production/FACEBOOK.md`).
- **It doesn't need Meta's review** to post to your own accounts: standard access is enough.

1. **Professional account.**
   - Open: `connect.py open instagram-professional`.
   - In the Instagram app: Profile → ☰ → **For professionals** → **Account type and tools** → **Switch to professional account** → category → **Creator** or **Business**.
2. **Link the Facebook Page to Instagram.**
   - Open: `connect.py open facebook-link`.
   - On a computer, switch to the Page (your photo → **See all profiles** → the Page).
   - Then: the Page's photo → **Settings & privacy** → **Settings** → **Linked accounts** → **Instagram** → **Connect account**.
   - It's not Accounts Center: that one links personal profiles.
3. **The business portfolio.**
   - Open: `connect.py open meta-portfolio`.
   - In Meta Business Suite → **Settings** → **Accounts**, add the Page (**Pages** → **Add**) and the Instagram account (**Instagram accounts** → **Add**).
   - An Instagram account can only be in one portfolio.
4. **The Meta app.**
   - Open: `connect.py open meta-app`.
   - Name and email → **Next**.
   - Use case: **Manage messaging & content on Instagram** → **Next**.
   - The portfolio from step 3 → **Next** → **Go to dashboard**.
   - In **Use cases** → that use case → **Customize** → **API setup with Facebook Login** → **Add all required permissions**.
   - In **Permissions and features**, also add `instagram_manage_insights`.
   - An app uses a single type of login: if you picked the Instagram one, create another app.
5. **The system user and its key.** A key that doesn't expire.
   1. Open: `connect.py open meta-system-user`. Go to **Settings** → **Users** → **System users** → **Add new system user**, with the **Admin** role → **Create system user**.
   2. **Assign assets:**
      - the app, with **Full control**;
      - the Page and the Instagram account, with **Content** and **Insights** (and **Community Activity** if comments will be answered).
   3. **Generate new token** → the app → expiration **Never** → these permissions:
      - `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`, `pages_show_list`, `pages_read_engagement` and `business_management`;
      - if you'll also post to Facebook, add these now: `pages_manage_posts`, `read_insights` and `pages_manage_engagement`.
   4. Copy the key: Meta shows it only once.
   5. If posting gives a permissions error, generate the key again adding `ads_read`: Meta sometimes asks for it when the permission over the Page comes through the portfolio.
6. **Save the key in the system's secure store.** Never in the repo or in the chat. In your own terminal, inside the repo folder (`cd <your repo folder>`):
   - macOS (the Terminal app): `python3 production/tools/save_token.py example`. It goes in the Keychain.
   - Windows (PowerShell or Windows Terminal, not Git Bash): `python production/tools/save_token.py example`. It goes in the Credential Manager.
   - Linux: `python3 production/tools/save_token.py example`. It goes in secret-tool (package `libsecret-tools`); if you don't have it, use the `EXAMPLE_INSTAGRAM_TOKEN` environment variable.

   Then:
   - When it asks, and only then, copy the token in the browser with the copy button, paste it and press Enter. It isn't shown.
   - Don't save it by hand with macOS's `security` command: it cuts what you paste at 128 characters, and the token is about 200 long. Nor with a command copied from the chat that reads the clipboard: the clipboard ends up holding the command, not the token.
   - The tool checks that what you pasted is a Meta token (it starts with EA and is long) and that it can be read back.
7. **Tell Claude "done".** It runs `instagram.py connect example` and `instagram.py test example`, which show the account, the followers and the day's quota.

**So it doesn't switch off:** Meta deactivates an app that goes 90 days without calls, and all its keys with it. The metrics watcher (below) keeps it active.

## How it's used (stage 12 of /creator-reel)

1. `variations.py <piece> <variations.json>` builds 4 to 6 variations and the `batch.json`, with each one's copy, time and cover.
2. The creator watches them in Montage and approves the batch **in the chat**: videos, copies, day and times.
3. Claude runs `instagram.py approve <batch> --message "<what the creator said>"` and `instagram.py schedule <batch>`.
   - The computer has to stay **on and connected** until the last time slot: the process runs there. While it waits, it keeps the computer from sleeping (macOS, Windows, and Linux with systemd); closing a laptop's lid does put it to sleep.
4. `instagram.py status <batch>` shows what went out. `instagram.py results <batch>` brings views, reach, saves, shares and watch time for each one. Run it at 24 and at 72 hours.

## What the API doesn't do

- **It doesn't add music from Instagram's library or trending songs.** The music goes inside the video: Claude picks it from the licensed library. A trending song can only be added by hand from the app.
- **It doesn't schedule on Instagram's side:** that's why the computer has to stay on.
- How many posts the API allows in 24 hours is shown by `instagram.py test` (Meta gives it in `quota_total`; its documentation says 100 on one page and 50 on another).

## Giving access to someone else on the team

Whoever clones the repo can schedule posts if they have a token. The token is the key to the account: it can post, read insights and reply to comments on @example. It doesn't expire.

**One key per person, from the same system user.** With standard access, Meta allows only one system user per portfolio (plus one admin).
1. The creator, in the system user (step 5), clicks **Generate new token** again, with the same permissions. Each time it's a different key, and the earlier ones keep working.
2. They send it through a secure, self-deleting link from a password manager (1Password, Bitwarden Send). **Never by WhatsApp, email or the chat.**
3. If someone leaves the team: in the system user → **Revoke tokens** removes every key, and the creator generates a new one for each person who stays.

**What the other person does, once:**
1. Clone the repo, open Claude Code there and type `/creator-reel`. Whatever is missing gets installed: `python3 production/install.py`.
2. Save the token:
   - In their own terminal: `python3 production/tools/save_token.py example` (on Windows, `python …` in PowerShell). When it asks, copy the token from the link and paste it.
   - Another option, on any system: the `EXAMPLE_INSTAGRAM_TOKEN` environment variable, in the user variables and never in a file in the repo.
3. `python3 production/tools/instagram.py test example` must show @example, the followers and the quota.

`production/instagram.json` goes in the repo: it only has the account id, not the token.

**Rules for several people:**
- **Only one computer schedules each batch.** If two run `schedule` with the same batch, it goes out twice.
- Only a batch the creator approved in the chat is posted.
- The daily posting quota belongs to the account, not to each person.

## Metrics without Claude waiting

`python3 production/tools/instagram.py watcher install` sets up a system task that runs every hour: launchd on macOS, Task Scheduler on Windows (task `com.creator-os.metrics`, without opening windows) and cron on Linux. That task:
- it checks every posted batch;
- at 24 and 72 hours it saves each reel's metrics in its `batch.json`;
- it sends a notification.

It doesn't use Claude. If the computer is off, it fetches them the next time it runs.

- See how it's going: `instagram.py watcher status`. The log is at `~/Library/Logs/creator-os-metrics.log` (macOS), `%LOCALAPPDATA%\creator-os\Logs\` (Windows) or `~/.local/state/creator-os/` (Linux).
- Remove it: `instagram.py watcher remove`.
- If the repo moves to another folder, run `watcher install` again: the task stores the script's path.

Installed on the creator's computer on Nov 15, 2026.

## Official sources (checked on Nov 16, 2026)

- The Instagram API's paths: https://developers.facebook.com/documentation/instagram-platform/overview
- Publishing content and uploading from the computer (only with Facebook Login): https://developers.facebook.com/documentation/instagram-platform/content-publishing/resumable-uploads
- App review (not needed for your own accounts): https://developers.facebook.com/documentation/instagram-platform/app-review
- Creating the app with use cases: https://developers.facebook.com/documentation/development/create-an-app/instagram-use-case
- System users: https://www.facebook.com/business/help/503306463479099
- Linking the Page to Instagram: https://www.facebook.com/help/1148909221857370
- Professional account: https://help.instagram.com/502981923235522
- Reels metrics: https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media/insights
