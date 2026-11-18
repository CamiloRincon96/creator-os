---
name: creator-connect
description: Connects a brand's networks (Instagram, Facebook, YouTube and TikTok), walking the person through it step by step with today's official pages. It opens each page, says exactly what to click, checks that the step worked before moving on, and the keys go in the system's secure store, never in the chat or the repo. Use it when the person says "connect", "connect my YouTube", "connect TikTok", "connect Facebook", "connect Instagram", "the integrations", "post to other networks", "/creator-connect", or when a tool says a network isn't connected.
---

# Connecting the networks, hand in hand

Whoever is connecting may not be technical. Every message follows `production/GUIDING.md`: in their language, in simple words, one idea per line. Go **one step per message**: say where, what to click, what they'll see, and ask them to type "done"; wait, check, and only then move on. Never give them ten steps at once.

## Rules that don't break

- **Passwords, keys and secrets are typed by the person,** on the official page or with `save_token.py` in their own terminal. You never ask for them, never type them and never read them in the chat. If they paste one in the chat, tell them to delete it on that network and generate a new one.
- **Accepting terms, granting permissions and logging in to an account is done by the person.** You open the page and explain what each thing means.
- **Nothing paid.** All of this is free. If a page asks for a card, something is wrong: stop and check.
- **Connecting isn't posting.** Once a network is connected, only what the person approves in the chat gets posted, with `--approved`.
- Don't submit the app for review on any network: it isn't needed to use it on your own accounts.

## 0. What's there and what's missing

1. Say it in one line: "I'm checking which of <brand>'s networks are already connected. Nothing changes."
2. Run `python3 production/tools/connect.py status [brand]`. On Windows, `python` instead of `python3`, here and everywhere else.
3. Tell them the result in words, one line per network: "Instagram: connected (@account)." or "YouTube: not yet.". Don't paste the raw output. If it says there are no brands, offer to create one first with `/creator-brand`.
4. Ask with AskUserQuestion, multiple choice: **"Which networks do you want to connect now?"**. Offer only the missing ones. The name goes in `label`. The `description` is the text from `production/GUIDING.md`, as is, plus the time:

| Option | `description` |
|---|---|
| Instagram | To post your reels and trial reels at the time you choose, and see what worked. Used when each video is finished and every Monday in `/creator-pulse`. Free. About 25 minutes. |
| Facebook | To post the same reels to your Page; Facebook publishes them on its own at the time you schedule. Used when each video is finished. Free. Comes after Instagram. About 15 minutes. |
| YouTube | To upload your videos as Shorts, public or scheduled, and see how much they're watched. Used when each video is finished. Free (up to 100 videos a day). About 15 minutes. |
| TikTok | To send the video to your TikTok drafts; you post it from your phone with the sound you want. Used when each video is finished. Free. About 20 minutes. |

Put first, with "(Recommended)", the network they use most; if you don't know, Instagram. If they pick Facebook without Instagram, tell them in one line that Facebook uses the same app and the same key, and start with Instagram.

## 1. Before each network

One short message: what gets connected, what it's for, how many steps, how long, that it's free, and what to have at hand. Wait for their "done" to start. For example:

> Now we connect Instagram: 7 steps, about 25 minutes. When we're done, I can post your reels at the time you choose and read how they did. It's free.
> Have your phone at hand, with the Instagram app open on the brand's account.
> Type "done" when you're at your computer.

What to have at hand:
- **Instagram (7 steps):** the phone with the Instagram app and the brand's account, and a Facebook Page for the brand, because step 2 links it. If they have no Page, it gets created in Facebook first (it's free). Walk them through it with Facebook's official help, without making up buttons.
- **Facebook (6 steps):** Instagram connected; an icon for the app (512 to 1024 px) and a public page with their privacy policy (step 5).
- **YouTube (8 steps):** the Google account that owns the channel, with 2-Step Verification on (see "Before you start" in the guide).
- **TikTok (13 steps):** a website of theirs or any public page of theirs (Linktree, a profile); the phone with TikTok and the brand's account; a 1024 × 1024 px icon, JPG or PNG.

**The privacy policy** (Facebook step 5; TikTok step 4, if it asks): if they don't have one, fill in `production/templates/privacy-policy.md` with their app's name, their brand, the date and the email they want to show (ask them). Give them the text ready to paste on a public page of theirs (their website or a public document). That page's address is what they paste into the network.

## 2. Each step, one message

Each network has its guide with the numbered steps, the official pages and the sources. Follow it to the letter:
- `production/INSTAGRAM.md` (section "What the creator does only once");
- `production/FACEBOOK.md`;
- `production/YOUTUBE.md`;
- `production/TIKTOK.md`.

One guide step per message. If the step goes through several screens (each one ending in **Next**), one screen per message. Each message has:
1. **Where:** open the page with `python3 production/tools/connect.py open <step>` (the list: `connect.py steps`) and also write the address, in case the browser doesn't open. If the step happens on the phone, say so: "on your phone, in the Instagram app".
2. **What to click:** the exact names from the guide, in bold and in order. The guides give the names of the English screens; if the person's screens are in another language, say the English name and where it is, and ask what they see.
3. **What they'll see:** that step's "Done when" line.
4. **How to tell you:** "When you see it, type 'done'. If you see something else, tell me what you see or send me a screenshot." For the screenshot: on a Mac, ⌘ + Shift + 4 and drag the image into the chat; on Windows, Windows key + Shift + S and paste it here.

For example:

> **Step 3 of 7: the business portfolio.** It puts your Page and your Instagram in the same place in Meta.
> I opened Meta Business Suite for you (if it didn't open: https://business.facebook.com/latest/settings).
> Go to **Settings** → **Accounts**. Under **Pages**, click **Add** and pick your Page. Under **Instagram accounts**, click **Add** and pick your account.
> You'll see the Page and the account in those two lists. Type "done" when you see them.

When they type "done":
- **Check** when the step allows it: `connect.py status <brand>` after saving a key; `<network>.py test <brand>` after connecting.
- **Say what's in place and what's next,** in one line: "Done: your Page and your Instagram are in the portfolio. Now we create the Meta app (step 4 of 7)."
- If it doesn't match what they see, adjust with what they tell you. Don't make up buttons. If the page really changed, go on with what's there and note the change at the end (section 5).

**What scares people, with its reason in one line:**
- **"Google hasn't verified this app":** that's normal; the app is theirs and only they use it.
- **"Publish app" in Google** (YouTube, step 4): it doesn't publish anything to their channel; it keeps the connection from expiring every 7 days.
- **The "Live" mode in Meta** (Facebook, step 5): it doesn't publish anything; it makes what they post to their Page visible to everyone, not just to them.
- **TikTok's Sandbox:** it's the test mode, the only one that needs no review to use the app on their own accounts.
- **The key doesn't show while pasting:** that's on purpose.
- **Creator or Business?** (Instagram, step 1): both work for this. Business for a brand or a company; Creator for a person.

## 3. Keys: always in their own terminal

When the guide gets to saving a key or a secret (Instagram step 6, Facebook step 4, TikTok step 11), it takes three messages. If the person already uses the terminal, merge the first two.

The command:
- Instagram and Facebook: `save_token.py <brand>`;
- TikTok: `save_token.py --tiktok <brand>`.

The repo's path is the folder this session runs in (if in doubt, `git rev-parse --show-toplevel`). Write it in quotes, because it can have spaces, and give them only the line for their system.

**Message 1, open the terminal:**
> Now you save the key in your computer's secure store. That way it isn't in any file and I never see it.
> Open the terminal:
> - On a Mac: press ⌘ + Space, type Terminal and press Enter.
> - On Windows: press the Windows key, type PowerShell and press Enter. Don't use Git Bash: it doesn't let you paste hidden.
> A window opens with some text and a line to type on. Type "done".

**Message 2, run the tool** (with the real path and brand):
> Copy this line, paste it in that window (⌘ + V on a Mac; Ctrl + V or right-click on Windows) and press Enter:
> `cd "/path/to/repo"; python3 production/tools/save_token.py <brand>`
> (On Windows: `cd "C:\path\to\repo"; python production/tools/save_token.py <brand>`.)
> You'll see "Paste the Instagram token for <brand> (it is not shown while you paste) and press Enter". Type "done".

For TikTok the line has `--tiktok` and what they see is "Paste the TikTok app's "Client key" (Credentials)".

**Message 3, paste the key:**
> Now, and only now, copy the key with the copy button on Meta's page. If you copy it earlier, the clipboard keeps the command line.
> Go back to the terminal, paste it the same way and press Enter. Nothing shows while you paste: that's normal.
> You'll see "Saved in … (about 200 characters)". Type "done".

For TikTok they paste twice: first the **Client key** and Enter; then it asks for the **Client secret**: they copy it, paste it and press Enter. They see "Saved in …".

Then run `connect.py status <brand>`: if that network no longer asks to save the key, it's in. Tell them where it went: "Done: your key is in your Mac's Keychain, not in the repo." (On Windows, in the Credential Manager; on Linux, in secret-tool.)

**If the terminal says something else:**

| What they see | What happened | The step to fix it |
|---|---|---|
| "Run this in your own terminal, not in Claude's" | It ran inside Claude Code | Message 1: open the Terminal app (on Windows, PowerShell) |
| "That does not look like a Meta token…" or "That does not look like TikTok's key and secret…" | Something else got pasted, almost always the command line | Copy the key again with the page's button and repeat messages 2 and 3. If they closed Meta's window, generate another key (Instagram step 5; Facebook step 3): Meta shows it only once |
| "can't open file" or "No such file or directory" | They weren't in the repo folder | Paste the whole line again, with the `cd` |
| `python3` doesn't exist, or on Windows the Microsoft Store opens | On Windows it's `python`, or Python is missing | The Windows line; if Python is missing, `/creator-start` |

YouTube doesn't use `save_token.py`: its `client_secret_….json` file is imported with `youtube.py connect <brand> --client <path>`, and the tool saves its content in the store. For the path, look the file up by name in Downloads (`~/Downloads/client_secret_*.json`) without opening it: what's inside is a secret. If there are several, take the newest and confirm it with the person.

## 4. Logging in with the browser (YouTube and TikTok)

1. Say it in one line: "Now I'm opening YouTube in your browser so you let your app upload to your channel. You have 10 minutes."
2. Run `youtube.py connect <brand> --client <path>` or `tiktok.py connect <brand>` **in the background** (`run_in_background`). The tool opens the browser and waits up to 10 minutes. If the browser doesn't open, its output has the address to copy: give it to them.
3. Walk each screen with a message:
   - **YouTube:**
     1. "Choose the Google account that owns the channel and, if it asks, the channel. Then a warning comes up: 'Google hasn't verified this app'. Type 'done' when you see it."
     2. "That's normal: the app is yours. Click **Advanced** and then **Go to <their app> (unsafe)**. You'll see the permissions, with boxes. Type 'done'."
     3. "**Check all the boxes** and click **Continue**. You'll see 'YouTube is connected'. Close that tab: I'll know on my own."
   - **TikTok:** "Sign in with the brand's TikTok account (the one you added in Target users) and click **Authorize**. You'll see 'TikTok is connected'. Close that tab: I'll know on my own."
4. When the tool finishes, read its output and tell them in words: "Done: YouTube is connected to your channel "…"." For YouTube, tell them they can now delete the `client_secret_….json` from Downloads: its content is in the system's secure store.
5. If the output says something else:
   - "10 minutes went by without an answer…": time ran out. When they have the browser at hand, run `connect` again.
   - "… did not give permission" or "you did not tick these permissions": it was canceled or a box was left unchecked. Run `connect` again and ask them to check them all.
   - The rest is in the guide's "If something fails" table.

## 5. At the end

1. Run `<network>.py test <brand>` on each connected network, and `connect.py status <brand>`.
2. Sum up in 3 to 5 lines:
   - what got connected, with the account, channel or Page;
   - where things went: the keys, in the system's secure store; in the repo, only the account's public data (`production/instagram.json` and `production/networks.json`, with their full path);
   - what can be done now: post what they approve in the chat;
   - what to keep an eye on: TikTok asks you to post from the phone, the Meta app switches off after 90 days without use, and Google keys expire if they go unused for 6 months.
3. **TikTok:** propose a first test with a short video. On the phone, the person checks whether, when posting the draft, they can choose "Everyone". If it only allows "Only me", write it down in `production/LESSONS.md`: it's the point TikTok's documentation doesn't confirm.
4. If a page or a button was different from the guide, fix the guide (`production/<NETWORK>.md`) and the step's page in `connect.py` (its list of steps), with the date.

## 6. Optional: a message to whoever comments

With Instagram connected, offer it once, with AskUserQuestion: **"Do you want people who comment a word to get your link in a private message?"**

| Option | `description` |
|---|---|
| Yes, in Business Suite (Recommended) | Someone comments "want" on any post and gets your link in a private message, plus a public reply to their comment. Free. About 10 minutes. |
| Not now | It can be done later with `/creator-connect`. |
| With a paid tool | The same, with multi-question flows and one per reel (ManyChat and similar). Paid, on a monthly plan: look up today's price and say it before they decide. |

If they say yes, follow `production/MESSAGES.md`, one step per message, as in section 2:
- **Before step 3, propose the texts and wait for their yes:**
  - the private message: 2 or 3 lines, with their name and the full link;
  - the public reply: one line;
  - the words that trigger it, with variants.

  Follow the brand's copy rules (`brands/<brand>/BRAND.md`).
- **Step 7 (turning it on) happens with their yes in the chat:** it's a rule that keeps running on its own in their account.
- **The browser:** if you have Claude in Chrome and they'd rather you click, do steps 2 to 6 in their Chrome, with their session open. They log in to their account, and you never type passwords. Step 1 is always theirs, on the phone.
- **At the end:** run the step 8 test from another account. Write down in `brands/<brand>/PROFILE.md` what the automation hands out and with which words. Remind them it applies to every post, and that when the gift changes it has to be edited or turned off.

**Replying to comments and messages:** Claude doesn't send them on its own. With the `instagram-agent:ig-reply`, `ig-comment` and `ig-dm` skills it writes drafts, and the person pastes and sends them.

## If something fails

Each guide has its "If something fails" table with the common errors. If the error isn't there:
1. Say what happened in simple words and, if known, why. Never the raw error alone.
2. Look it up in that network's official documentation.
3. Propose a single step to fix it, in the format of section 2.

Don't repeat the same command expecting a different result.
