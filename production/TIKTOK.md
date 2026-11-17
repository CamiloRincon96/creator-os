# Connecting TikTok (once per account, about 20 minutes)

With this, Claude sends the video to the account's **TikTok drafts** and brings its metrics: `production/tools/tiktok.py`. From the phone, the person finishes it: writes the text, picks the sound (a trending one too) and posts. Only a video the creator approved in the chat gets sent. `/creator-connect` does these steps with you, one by one.

Checked on Nov 16, 2026 against TikTok for Developers' official documentation (sources at the end).

## Why this way, and not posting directly

- **TikTok doesn't approve apps for personal use.** Its rules say so explicitly: "A utility tool to help upload contents to the account(s) you or your team manages" is "Not acceptable" for review. That's why each person uses their app in **Sandbox mode** (for testing), which needs no review and accepts up to 10 of your own accounts.
- **Posting directly without review** only lets you post privately ("Only me"), and with the account set to private. That doesn't help you grow.
- **Sending to drafts** (Upload) doesn't have that restriction in the documentation. The video lands in the TikTok app and the person posts it from there, with the usual editor.
- **Limits:** up to 5 pending drafts every 24 hours. This way of uploading doesn't carry the text, so the tool shows it for you to copy.

**What to check with the first upload.** No official page says in so many words that a draft sent from Sandbox can be posted as public. With the first video, check on your phone whether posting lets you choose "Everyone". If it only allows "Only me", that's the Sandbox limit: write it down in `production/LESSONS.md` and, meanwhile, the video gets uploaded by hand from the phone.

## Before you start

- **A website of yours.** TikTok asks for one for desktop apps: the brand's website, or any public page of yours (Linktree, a profile). In Sandbox nobody reviews it.
- **Your phone with the TikTok app,** signed in to the brand's account.

## The steps

The button names are the ones in TikTok's documentation. If something is called differently on your screen, tell Claude what you see. What you fill in from step 4 to 8 gets saved all together in step 10, with **Apply changes**.

**1. Developer account.**
- Open: `python3 production/tools/connect.py open tiktok-account`.
- Sign up with an email. It's an account separate from the TikTok on your phone.
- **Done when:** you're signed in to TikTok for Developers with that email.

**2. Create the app.**
- Open: `connect.py open tiktok-apps`.
- Click **Connect an app** (or **Create app**).
- In **Select the app owner**, pick your individual account and click **Confirm**.
- **Done when:** the app opens in **Production**, with the status **Draft**.

**3. Switch to Sandbox.**
- Next to the app's name, switch **Production | Sandbox** to **Sandbox**.
- Click **Create Sandbox**, give it a name and click **Confirm**.
- From here on, everything is done in the Sandbox.
- **Done when:** the app's name has **Sandbox** next to it.

**4. The app's details** (App details → Basic information).
- **App icon:** 1024 × 1024 px, JPG or PNG.
- **App name:** without "TikTok" or other networks' names, for example "Example Publisher".
- **Category.**
- **Description:** it's shown when connecting.
- **Terms of Service URL** and **Privacy Policy URL:** if it asks for them, put your website's page. You can publish the template `production/templates/privacy-policy.md` on your website or in a public document.

**5. Platform.** Check **Desktop** and enter your website's URL.

**6. Products** (Products → Add products). Add these three and click **Done**:
- **Login Kit**;
- **Content Posting API:** leave the **Direct Post** switch **off**;
- **TikTok API** (it brings the Display API, the one for metrics).

**Done when:** all three show up in the app.

**7. Login Kit → Desktop → Redirect URI.** Type exactly:
```
http://127.0.0.1:8370/callback/
```
**Done when:** the address is exactly that, with the trailing slash.

**8. Permissions** (Scopes → Add Scopes). Check:
- `user.info.basic`;
- `user.info.profile`;
- `user.info.stats`;
- `video.upload`;
- `video.list`.

**Done when:** all five are checked.

**9. Your account as a test user** (Sandbox settings → Target users).
- Click **Add account**, sign in with the brand's TikTok account and accept the developer terms.
- **Done when:** your account shows up in **Target users**. It can take up to an hour.

**10. Save the changes** with **Apply changes**. Don't click **Submit for review**.

**11. The key and the secret.**
- In App details → **Credentials** (in the Sandbox) you'll find the **Client key** and the **Client secret**.
- Save them yourself, in your own terminal (macOS: Terminal; Windows: PowerShell; Linux: your terminal):
  ```
  python3 production/tools/save_token.py --tiktok <brand>
  ```
- It asks for the key and then the secret, without showing them.
- **Done when:** the terminal says "Saved in …".

**12. Connect.** Tell Claude "I saved the key". It runs `tiktok.py connect <brand>`:
- TikTok opens in the browser;
- you sign in with the brand's account and click **Authorize**;
- the browser says TikTok is connected.

**13. Check.** `tiktok.py test <brand>` shows the account, the followers and the videos.

## How it's used

1. Claude runs `tiktok.py upload <brand> <video> --approved "<what the creator said>" --copy "the text"`.
2. On your phone, open TikTok and tap the "your video is ready" notification (or Profile → Drafts).
3. Pick the sound, paste the text and post.
4. `tiktok.py status <brand> <publish_id>` says whether it's been posted.
5. `tiktok.py videos <brand> 10` brings views, likes, comments and shares. Only for public videos: TikTok's API doesn't give watch time or reach.

The connection renews itself every time it's used. If it goes more than about 6 months unused, run `connect` again.

## If something fails

| Message | What's happening | What to do |
|---|---|---|
| `redirect_uri` doesn't match | The address from step 7 isn't exact | Copy it as is, with the trailing slash |
| `scope_not_authorized` / missing permissions | They weren't checked in step 8, or Apply changes wasn't clicked | Steps 8 and 10, and connect again |
| The account can't authorize | It isn't in Target users, or it doesn't show up yet | Step 9; wait up to an hour |
| `spam_risk_too_many_pending_share` | There are already 5 pending drafts in 24 h | Post or delete drafts in the app |
| "did not renew the connection" | A long time went by without using it | `tiktok.py connect` again |
| Credentials that don't work | The Production ones were copied, not the Sandbox ones | Step 11 in the Sandbox |

## Official sources (checked on Nov 16, 2026)

- Content Posting API, getting started: https://developers.tiktok.com/doc/content-posting-api-get-started-upload-content
- Uploading to drafts (Upload): https://developers.tiktok.com/doc/content-posting-api-reference-upload-video
- Direct Post and its limits without review: https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
- Content sharing guidelines (personal use not acceptable): https://developers.tiktok.com/doc/content-sharing-guidelines
- Login Kit for desktop (127.0.0.1 with a port): https://developers.tiktok.com/doc/login-kit-desktop
- Access tokens (updated on Nov 5, 2026): https://developers.tiktok.com/doc/oauth-user-access-token-management
- Sandbox: https://developers.tiktok.com/doc/add-a-sandbox
- Creating the app: https://developers.tiktok.com/doc/getting-started-create-an-app
- Video list (metrics): https://developers.tiktok.com/doc/tiktok-api-v2-video-list
