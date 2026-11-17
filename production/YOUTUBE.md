# Connecting YouTube (once per channel, about 15 minutes)

With this, Claude uploads Shorts to the brand's channel and brings their metrics: `production/tools/youtube.py`. It only uploads a video the creator approved in the chat. `/creator-connect` does these steps with you, one by one.

**What you get:**
- **Upload Shorts:** vertical or square video of up to 3 minutes.
- **Choose how it goes out:** public, unlisted or private.
- **Schedule it:** YouTube publishes it on its own at the chosen time, even with the computer off.
- **See metrics:** views, view duration, percentage viewed, shares and subscribers gained.

**What it costs:** nothing. The quota is 100 uploads a day per project.

Checked on Nov 16, 2026 against Google's official documentation (sources at the end). Since Nov 2, 2026, what an unverified app uploads is no longer forced to private: no audit is needed.

## Before you start

- **Sign in with the Google account that owns the channel.** If the channel belongs to a Brand Account, sign in with someone who manages it. People invited only from YouTube Studio (Settings → Permissions) can't use the API.
- **Turn on 2-Step Verification** on that account: Google Cloud requires it. Open the page with `python3 production/tools/connect.py open google-2fa`.
- **Optional:** if you want custom thumbnails or videos longer than 15 minutes, verify the channel with your phone in YouTube Studio → Settings → Channel → Feature eligibility.

## The steps

**1. Create the project.**
- Open: `connect.py open google-project`.
- **Project name:** for example "Creator OS Example".
- **Location:** "No organization".
- Click **Create**.
- **Done when:** you can pick the new project at the top of the console (step 2 uses it).

**2. Turn on the two APIs.**
- Open: `connect.py open google-apis`.
- Pick the project you created at the top.
- Open **YouTube Data API v3** and click **Enable**.
- Go back, open **YouTube Analytics API** and click **Enable**.
- **Done when:** neither of the two offers **Enable** anymore.

**3. The consent screen (Google Auth Platform).**
- Open: `connect.py open google-branding`.
- If it says it isn't configured yet, click **Get started**.
- **App Information:** the app's name and your support email. Don't put "YouTube" in the name, because Google rejects it; use something like "Example Publisher".
- **Audience:** pick **External**.
- **Contact Information:** your email.
- Accept the Google API Services User Data Policy and click **Create**.
- Don't upload a logo: with a logo, Google asks to verify the brand.
- **Done when:** the page no longer asks you to **Get started**.

**4. Publish the app** (the step people forget most).
- Open: `connect.py open google-audience`.
- Click **Publish app** and confirm.
- **Done when:** it says "In production", unverified. It's your own app and it doesn't need verifying while fewer than 100 people use it.
- If you leave it in "Testing", the connection expires every 7 days.

**5. The permissions (Data Access): no need to touch them.** The tool asks for its own when connecting: upload videos, see the channel and see YouTube Analytics. Don't submit anything for verification.

**6. Create the client.**
- Open: `connect.py open google-client`.
- Click **Create client**.
- **Application type:** **Desktop app**. Give it a name.
- Click **Create** and then **Download JSON**.
- **Do it right away:** Google only shows the full secret this once.
- **Done when:** the `client_secret_….json` file is in Downloads.

**7. Connect.** Tell Claude "I downloaded the JSON". It runs:
```
python3 production/tools/youtube.py connect <brand> --client ~/Downloads/client_secret_….json
```
(On Windows, `python` and the path of your Downloads folder.) Google opens in the browser:
1. Choose the account and, if it asks, the channel.
2. "Google hasn't verified this app" comes up. It's yours: click **Advanced** and then **Go to <your app> (unsafe)**.
3. **Check all the permission boxes** and click **Continue**.
4. The browser says YouTube is connected. You can now delete the JSON from Downloads: its content is in the system's secure store (Keychain, Credential Manager or secret-tool).

**8. Check.** `youtube.py test <brand>` shows the channel, the subscribers and the videos.

## How it's used

- **Upload:** `youtube.py upload <brand> <video> --title "…" --privacy public|unlisted|private --approved "<what the creator said>" [--copy "description"] [--schedule 2026-11-20T18:00:00-05:00] [--ai]`.
  - The creator chooses `--privacy` for each video.
  - `--ai` marks realistic synthetic content; cloning your own voice for the narration doesn't need it.
  - Everything is logged in `brands/<brand>/pulse/uploads.jsonl`.
- **Metrics:** `youtube.py videos <brand> 10`. Analytics arrives 2 or 3 days late; views, right away.

## If something fails

| Message | What's happening | What to do |
|---|---|---|
| `invalid_grant` / "no longer accepts the connection" | The permission was removed, 6 months went by without using it, or the app was left in "Testing" | Step 4 and `connect` again |
| `redirect_uri_mismatch` | The client isn't a "Desktop app" | Step 6 with the right type |
| `access_denied` / "did not give permission" | It was canceled in the browser | `connect` again and check everything |
| "has no YouTube channel" | The Google account has no channel | Create the channel at youtube.com |
| `insufficientPermissions` | A box was left unchecked | `connect` again and check all of them |
| `uploadLimitExceeded` | The channel hit its daily limit (lower if it isn't verified with a phone) | Wait 24 h |
| `quotaExceeded` | The project's 100 uploads for the day are used up | Wait until midnight Pacific time |

## Official sources (checked on Nov 16, 2026)

- Uploading videos (`videos.insert`, updated on Nov 12, 2026): https://developers.google.com/youtube/v3/docs/videos/insert
- The API's revision history (Nov 2, 2026: no longer forced to private): https://developers.google.com/youtube/v3/revision_history
- Resumable upload: https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
- OAuth for desktop apps: https://developers.google.com/identity/protocols/oauth2/native-app
- When the keys expire (7 days in Testing, 6 months unused): https://developers.google.com/identity/protocols/oauth2
- Google Auth Platform: https://support.google.com/cloud/answer/15544987
- Personal use without verification: https://support.google.com/cloud/answer/13464323
- Shorts of up to 3 minutes: https://support.google.com/youtube/answer/15424877
- YouTube Analytics: https://developers.google.com/youtube/analytics/reference/reports/query
