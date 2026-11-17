# Connecting the Facebook Page (after Instagram, about 15 minutes)

With this, Claude posts Reels to the brand's Facebook Page and brings their metrics: `production/tools/facebook.py`. It uses **the same Meta app and the same system user as Instagram** (`production/INSTAGRAM.md`): Instagram gets connected first. Only a video the creator approved in the chat gets posted. `/creator-connect` does these steps with you.

**What you get:**
- **Reels on the Page:** 3 to 90 seconds, vertical 9:16.
- **Scheduling:** Facebook publishes them on its own, even with the computer off (from 10 minutes to 29 days ahead).
- **Leaving them as a draft** on the Page.
- **Metrics:** plays, reach, watch time and followers gained.

**Quota:** 30 reels a day per Page.

Checked on Nov 16, 2026 against Meta's official documentation (sources at the end).

## The steps

**1. Instagram first.** `python3 production/tools/connect.py status <brand>` must show Instagram with ✓. The Facebook Page is already linked to Instagram since step 2 of `INSTAGRAM.md`.

**2. Give the Page to the system user.**
- Open: `connect.py open meta-system-user`.
- In **Settings** → **Users** → **System users**, pick the user you created for Instagram.
- Click **Assign assets** → **Pages**, pick the Page and turn on **Content** and **Insights** (and **Community Activity** if you want to reply to comments).
- Save.
- **Done when:** the Page shows up among the system user's assets, with **Content** and **Insights**.

**3. Generate a new key with the Page's permissions.**
- In the same system user, click **Generate new token**.
- Pick the app and the expiration **Never**.
- Check the Instagram permissions (the ones from step 5 of `INSTAGRAM.md`) **and also** these three:
  - `pages_manage_posts`;
  - `read_insights`;
  - `pages_manage_engagement`.
- Copy the key: Meta shows it only once.
- **Done when:** Meta shows the new key, a long text that starts with EA. Don't close that window until you've saved it in step 4.
- If `pages_manage_posts` isn't in the list: at developers.facebook.com → your app → **Use cases** → **Add use case**, pick the one for managing the Page ("Manage everything on your Page"), and come back to this step.

**4. Save the new key** in your own terminal:
```
python3 production/tools/save_token.py <brand>
```
It replaces the Instagram one. It's the same key, now with more permissions, and Instagram keeps working the same.

**Done when:** the terminal says "Saved in … (N characters)".

**5. Publish the Meta app** (without this, what gets posted on the Page is only seen by people who have a role in the app).
- Open: `connect.py open meta-apps`, go into your app and go to **App settings** → **Basic**.
- Fill in these and save:
  - **App icon:** between 512 and 1024 px.
  - **Category.**
  - **Privacy policy URL:** publish the template `production/templates/privacy-policy.md` on your website or in a public document.
  - **User data deletion** (a URL or instructions): the same page works; the template has that section.
- At the top, switch the app mode from **Development** to **Live**. With standard access, no Meta review is needed to use it on your own accounts.
- **Done when:** at the top, the app mode says **Live**.

**6. Connect and check.** Tell Claude "done". It runs:
- `facebook.py connect <brand>`, which finds the Page linked to your Instagram;
- `facebook.py test <brand>`, which shows the Page and its followers.

## How it's used

- **Post:** `facebook.py upload <brand> <video> --approved "<what the creator said>" --copy "text with #hashtags" [--schedule 2026-11-20T18:00:00-05:00] [--draft] [--ai]`.
- **Log:** every post is written down in `brands/<brand>/pulse/uploads.jsonl`.
- **Metrics:** `facebook.py reels <brand> 10`.

## If something fails

| Message | What's happening | What to do |
|---|---|---|
| "The token sees no page" | The Page isn't assigned to the system user | Step 2 |
| "has no permission over the page" / error 10 or 200 | The key is missing `pages_manage_posts` | Steps 3 and 4 |
| It was posted but nobody sees it | The app is still in Development | Step 5 |
| 1363128 | The video isn't between 3 and 90 seconds long | Trim it |
| 1363040 / 1363127 | Format or resolution (minimum 540 × 960, 9:16) | Export at 1080 × 1920 |
| 1363129 | Frames per second outside 24 to 60 | Export at 30 fps |
| The Page asks for publishing authorization or two-step verification | The Page requires "Page Publishing Authorization" or 2FA | Complete it in Facebook |

## Official sources (checked on Nov 16, 2026)

- Publishing Reels to Pages: https://developers.facebook.com/documentation/video-api/guides/reels-publishing
- Video metrics: https://developers.facebook.com/docs/graph-api/reference/video/video_insights/
- App modes (what's in Development is only seen by the roles): https://developers.facebook.com/documentation/development/build-and-test/app-modes
- System users: https://www.facebook.com/business/help/503306463479099
- Assigning assets: https://www.facebook.com/business/help/325571851329683
- API version (v27.0, Nov 4, 2026): https://developers.facebook.com/docs/graph-api/changelog
