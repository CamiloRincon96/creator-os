---
name: creator-connect
description: Connects a brand's networks (Instagram, Facebook, YouTube and TikTok), walking the person through it step by step with today's official pages. It opens each page, says exactly what to click, checks that the step worked before moving on, and the keys go in the system's secure store, never in the chat or the repo. Use it when the person says "connect", "connect my YouTube", "connect TikTok", "connect Facebook", "connect Instagram", "the integrations", "post to other networks", "/creator-connect", or when a tool says a network isn't connected.
---

# Connecting the networks, hand in hand

Speak the person's language, in simple words. Go **one step at a time**: say what to open and what to click, wait for them to say "done" (or tell you what they see) and check before moving on. Never give them ten steps at once.

## Rules that don't break

- **Passwords, keys and secrets are typed by the person,** on the official page or with `save_token.py` in their own terminal. You never ask for them, never type them and never read them in the chat. If they paste one in the chat, tell them to delete it on that network and generate a new one.
- **Accepting terms, granting permissions and logging in to an account is done by the person.** You open the page and explain what each thing means.
- **Nothing paid.** All of this is free. If a page asks for a card, something is wrong: stop and check.
- **Connecting isn't posting.** Once a network is connected, only what the person approves in the chat gets posted, with `--approved`.
- Don't submit the app for review on any network: it isn't needed to use it on your own accounts.

## 0. What's there and what's missing

```
python3 production/tools/connect.py status [brand]
```
On Windows, `python` instead of `python3`, here and everywhere else.

It shows each network with ✓ or with the next step. Ask, with AskUserQuestion and multiple choice, which networks they want to connect now. Explain in one line what each one gives:

| Network | What you get | Time |
|---|---|---|
| Instagram | Reels and trial reels at the batch's times, and metrics | ~25 min |
| Facebook | Reels on the Page, scheduled by Facebook, and metrics. It comes after Instagram: it's the same app | ~15 min |
| YouTube | Public, unlisted or scheduled Shorts, and metrics | ~15 min |
| TikTok | The video lands in TikTok drafts and the person posts it from their phone, with the sound they want; metrics | ~20 min |

Recommend starting with the one they use most. If they pick Facebook without Instagram, Instagram goes first.

## 1. How to walk each step

Each network has its guide with the numbered steps, the official pages and the sources. Follow it to the letter:
- `production/INSTAGRAM.md` (section "What the creator does only once");
- `production/FACEBOOK.md`;
- `production/YOUTUBE.md`;
- `production/TIKTOK.md`.

For each step:
1. **Open the page:** `python3 production/tools/connect.py open <step>` (the list: `connect.py steps`). Also give the address, in case the browser doesn't open.
2. **Say what to click,** with the exact names from the guide. The guides give the names of the English screens; if the person's screens are in another language, say the English name and where it is, and ask what they see.
3. **Wait** for them to say "done". If something doesn't match what they see, ask them to tell you what they see (or send a screenshot) and adjust. Don't make up buttons. If the page really changed, go on with what's there and note the change in the guide at the end.
4. **Check** with the tool when the step allows it:
   - `connect.py status <brand>` after saving a key;
   - `<network>.py test <brand>` after connecting.

### Keys: always in their own terminal

When the guide gets to saving a key or a secret, tell them exactly what to do:

> Open your terminal (on a Mac, the Terminal app; on Windows, PowerShell or Windows Terminal, not Git Bash), go into the repo folder and type:
> `python3 production/tools/save_token.py <brand>` (Instagram and Facebook) or `save_token.py --tiktok <brand>` (TikTok).
> It asks you to paste the key; nothing shows while you paste. Press Enter.

To go into the folder, give them the command with the repo's real path. On Windows it's `cd "C:\Users\<you>\creator-os"`.

YouTube doesn't use `save_token.py`: its `client_secret_….json` file is imported with `youtube.py connect <brand> --client <path>`, and the tool saves its content in the store.

### Logging in with the browser (YouTube and TikTok)

1. Run `youtube.py connect <brand> …` or `tiktok.py connect <brand>` **in the background** (`run_in_background`).
2. The tool opens the browser and waits up to 10 minutes.
3. Meanwhile, explain what they're going to see.
   - **YouTube:** choosing the account and the channel. Then "Google hasn't verified this app", which is normal because it's their own app: **Advanced** → **Go to … (unsafe)**. After that, **check all the boxes** → **Continue**.
   - **TikTok:** log in with the brand's account and **Authorize**.
4. When the browser says it's connected, the tool finishes on its own. Read its output.

## 2. At the end

1. `<network>.py test <brand>` on each connected network, and `connect.py status <brand>`.
2. Sum up in 3 to 5 lines:
   - what got connected;
   - what can be done now;
   - what to keep an eye on: TikTok asks you to post from the phone, the Meta app switches off after 90 days without use, and Google keys expire if they go unused for 6 months.
3. **TikTok:** propose a first test with a short video. On the phone, the person checks whether, when posting the draft, they can choose "Everyone". If it only allows "Only me", write it down in `production/LESSONS.md`: it's the point TikTok's documentation doesn't confirm.
4. If a page or a button was different from the guide, fix the guide (`production/<NETWORK>.md`) and the step's page in `connect.py` (its list of steps), with the date.

## If something fails

Each guide has its "If something fails" table with the common errors. If the error isn't there:
1. Show the message in simple words.
2. Look it up in that network's official documentation.
3. Propose a single step to fix it.

Don't repeat the same command expecting a different result.
