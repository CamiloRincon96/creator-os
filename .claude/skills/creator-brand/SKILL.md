---
name: creator-brand
description: Create or edit what the repo's brands talk about. Use it for a new brand or project (almost always tied to the repository of its app or product), a new topic or line inside a brand (for example, a sub-topic of Example), changing a brand's niche, tone or content wheel, or connecting and changing its social accounts. It asks the relevant questions, reads the product repo, validates the niche with last30days and proposes the changes in the chat. It only writes with the creator's yes. Use it when the creator says "new brand", "new project", "new niche", "add a topic", "change what we talk about", "edit the brand", or types "/creator-brand". It also responds when the user writes the same in another language.
---

# Brand: create and edit brands, niches and topics

Speak the person's language: every question, instruction (log in here, paste this, click that), approval request and summary goes in the language they write to you in; translate tool messages when you relay them. Commands, code and file names stay in English.

Lead the person by the hand (`production/GUIDING.md`): before each step, what you are about to do and what it is for; after it, what was produced, with its path, and what comes next. If something fails, what happened in plain words and a single step to fix it. One idea per line, no jargon.

This is the editing part of the system. It owns what defines a brand, which `/creator-ideas` and `/creator-reel` read:

| File | What it defines |
|---|---|
| `brands/<brand>/NICHE.md` | Who it is really for, their topics, what it is not, what the product does today, the content wheel and what has already worked |
| `brands/<brand>/BRAND.md` | The brand's rules: tone, colors and fonts, what can and cannot be shown, how it is named, and its **identities**: which style from `production/styles/` each type of video uses. A brand can have several (for example, one for to-camera reels and another for covers) |
| `brands/<brand>/PROFILE.md` | Social accounts, bio, highlights, series and how its lines live together |

The reference shape is `brands/example/`. A new brand copies that shape, and no folders are created outside the map in `MAP.md`.

**Rules:**
- **Nothing is written while you are talking it through.** The draft is shown in the chat, with the changes marked, and it is written with the creator's yes.
- **Every change carries a date and a reason**, in the "History" section at the end of the file that changes. That way everyone knows where each rule came from.
- **Secrets never go in the repo or in the chat:** tokens, keys and passwords. The creator saves them in their own terminal with `python3 production/tools/save_token.py` (macOS Keychain, Windows Credential Manager or secret-tool on Linux). Claude does not write them. If the person pastes one in the chat, tell them to replace it with a new one.
- The real niche is not the generic category. You find it in the product and in the people. For example: "people who don't know where their money goes and live out of Nequi (a Colombian digital wallet)", not "financial education".

## 0. What they want to do (AskUserQuestion, with options)

The question: "What do you want to do with your brand?". Each option says what it gets them, in one sentence. Everything here is free. If the person has no brand yet, option 1 goes first with "(Recommended)".
1. **New brand or project:** so the system knows what your brand talks about and who it talks to, starting from your product or your website.
2. **New topic or line inside a brand**, for example a sub-topic of Example: to add a topic without changing what already works.
3. **Change what a brand talks about:** to adjust the niche, the tone, the wheel or what is never said.
4. **Social accounts:** to change the bio, the highlights or the series. Connecting a network to publish is `/creator-connect`, free.

---

## A. New brand or project

### A1. Questions (in two rounds, each one says why it is asked)

Before: "I'll ask you a few questions to understand your brand. Then I read your product and show you a draft. I don't write anything without your yes."

**First round, in the chat** (they have no options):
- **Name:** "What is your brand called? I'll use it to create its folder." The folder is `brands/<id>`, lowercase with hyphens.
- **Where the product lives:** "Send me the folder or the GitHub link of your product. I'll read what it does today from there, so you don't have to explain it." Its local path (for example `~/projects/<repo>`) or its link. If there is no repo, its website or a document.

**Second round, a single AskUserQuestion call:**
- **What it is** (an app, a service, a person or personal brand, a business): "so I know where to look for who it talks to".
- **Networks** (multiple choice: Instagram, TikTok, Facebook, YouTube): "to think in their formats and connect them later". Then, in the chat, the username on each.
- **Goal for this stage** (grow, get pre-registrations, sell, launch): "so the draft aims at it: growing is not the same as selling".
- **What cannot be said or shown** (multiple choice: promises, competitors, sensitive data, nothing in particular): "so no idea ever touches it".

### A2. Read and understand (without writing)

Before: "Now I read your product and look up what your people are talking about this month (a few minutes). I'm not writing anything yet."

1. **From the product repo**, whatever exists among:
   - `README.md`, `PRODUCT.md`, `DESIGN.md` and `CLAUDE.md`;
   - `docs/`, with the backlog and the phases, to know what is coming;
   - the visual identity: logos, colors and fonts.

   From there come who it is for, what it does today, what it does not do and how it feels.
2. **From the niche**, with `last30days`: 2 or 3 searches on the pains and topics of those people, in their language and their country. You are looking for two things:
   - what those people talk about and share today;
   - which accounts already cover it and how.

   Without the ScrapeCreators key, it searches YouTube, Reddit and the web, and you say so in one line: "Without your ScrapeCreators key I can't see TikTok or Instagram. It's free; if you want, I'll help you add it at the end." The steps are in the `creator-ideas` skill, "Set up".
3. **From the accounts**, if they are already connected: `python3 production/tools/instagram.py reels <brand> 10`.

### A3. Draft in the chat

Show the three files (`NICHE.md`, `BRAND.md`, `PROFILE.md`) in the shape of Example's, **one per message**, starting with `NICHE.md`, the most important one:
- who it is really for;
- their life with the problem (the topics);
- what it is not;
- what the product does today;
- the **content wheel** with its weights (shareable, useful, connection, product);
- what gets measured.

Each one ends the same way: "Is this your brand? If so, write 'yes'. If something is off, tell me what to change (for example, 'the audience is younger')." Iterate until the creator says yes.

### A4. Create (with the yes)

Before: "With your yes, I create the brand's folder and add it to Montage, the editor where you review your videos."

1. **The folders:** `brands/<id>/` with `NICHE.md`, `BRAND.md` and `PROFILE.md`. Plus `identity/{logo,profile,covers}`, `ideas/`, `pieces/`, `finals/`, `sounds/` (with an empty `sounds/credits.json`, `[]`) and `stock/`, for the person's real material: photos, timelapses of them working and screenshots. That material stays out of git.
2. **The brand's Remotion project (`reel/`) is not created now.** It is built in its first `/creator-reel`, with `remotion-create`, starting from Example's kit with the brand's colors and fonts.
3. **Montage** knows about the brand in two places:
   - `montage/shared/formats.js` (the `BRANDS` list);
   - the social view component in `montage/web/src/components/` (the `ACCOUNTS` map: brand → Instagram username).

   Then: `cd montage && npm run build && npm test`.
4. **`MAP.md`:** add the brand to the map, in one line.
5. **The networks** are connected with `/creator-connect`, free, which walks through each step by the hand. Offer it in the close and do not start it without their yes. For Instagram, in short:
   - The creator saves the token in their own terminal: `python3 production/tools/save_token.py <id>`;
   - Claude connects the account: `python3 production/tools/instagram.py connect <id>`;
   - and checks it: `instagram.py test <id>`.

   See `production/INSTAGRAM.md`.
6. **The close**, in 3 to 5 lines:
   > The brand is ready: it is in `brands/<id>/` (`NICHE.md`, `BRAND.md` and `PROFILE.md`) and it already shows up in Montage.
   > Type `/creator-ideas` for its first week.
   > If its networks are not connected yet, `/creator-connect` does it with you step by step (free).

   And a single question: "Shall we start with the ideas?"

---

## B. New topic or line inside a brand

1. **Questions** (with options when possible; each one says why it is asked):
   - what the topic is and why now, in the chat: "to see whether people are already looking for it";
   - whether it is for **the same people** as the niche or for different people: "if it's other people, it may deserve its own account";
   - its role in the wheel (shareable, useful, connection or product): "to know what it asks of whoever sees it: share it, save it, get to know you or try the product";
   - how often it comes out and whether it is a named series: "series give people a reason to follow the account";
   - its color or tag (like Example's green and black): "so it is recognized at a glance".
2. **Does it have traction?** `last30days` with 2 searches on the topic within the niche. Say in one line whether people are sharing it or whether it is a topic only the brand cares about, with the source and its date.
3. **If the audience does not overlap with the brand's,** say so. The rule in Example's `PROFILE.md` applies to every brand: when a line grows with a different audience, it gets its own account.
4. **Draft of the changes** in the chat, marked as before and after:
   - in `NICHE.md`: the topic and its place in the wheel;
   - in `PROFILE.md`: the series, the highlights and the tag.

   End with: "Shall I save it like this? Write 'yes' or tell me what to change."
5. With the yes, write it, with its line in the "History". Then: "Done: the topic is in `brands/<brand>/NICHE.md` and `PROFILE.md`. For its first piece, type `/creator-ideas`."

## C. Change what a brand talks about

1. Show a summary of `NICHE.md` in 6 to 8 lines, with the data from `instagram.py reels <brand>`: what worked and what did not, in plain words. For example: "'Payday leaks': out of every 100 people it reached, 4 shared it; your typical reel, 1."
2. **Ask what changes** (AskUserQuestion, multiple choice): "What do you want to change about your brand?"
   - **Who it talks to and about what:** to reach other people or add topics.
   - **The tone and what is never said:** so it sounds different, or to protect what is off limits.
   - **How much of each kind of piece:** the weights of the wheel (shareable, useful, connection, product).
   - **What the product already does:** because the repo moved forward. Read its `PRODUCT.md` and its phases again.
3. If the change is big, validate it with `last30days` before proposing it. Before: "I'll check whether people really talk about this (a few minutes)."
4. **The change in the chat**, marked as before and after, with "Shall I save it like this? Write 'yes' or tell me what to change." With the yes, write it with a date and a reason in the "History", and say: "Done: it is in `brands/<brand>/NICHE.md`."
5. Point out what is affected:
   - the ideas in `ideas/` that no longer fit (list them, do not delete them);
   - the rules in `BRAND.md` that need to move.

## D. Social accounts

- **Connect a network:** with `/creator-connect` (Instagram, Facebook, YouTube and TikTok, free), which walks through each step by the hand; Instagram, in short, as in A4, point 5. Note each account in `PROFILE.md`.
- **Bio, highlights, pinned posts and series:** work on them with `instagram-agent:ig-profile`, which scores and rewrites them. The draft goes in the chat. With the yes, write it in `PROFILE.md`, and the creator makes the change in the app, one change per message. For example, the bio:
  > Open Instagram on your phone, go to your profile and tap "Edit profile".
  > In the bio, delete what is there and paste this text: "…".
  > Save. You'll see the new bio on your profile. When you see it, write me "done".

## How it gets refined

If a question in this command never changes anything, remove it. If a new brand needed something that was not here, add it in its section, with a date.
