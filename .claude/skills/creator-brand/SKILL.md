---
name: creator-brand
description: Create or edit what the repo's brands talk about. Use it for a new brand or project (almost always tied to the repository of its app or product), a new topic or line inside a brand (for example, a sub-topic of Example), changing a brand's niche, tone or content wheel, or connecting and changing its social accounts. It asks the relevant questions, reads the product repo, validates the niche with last30days and proposes the changes in the chat. It only writes with the creator's yes. Use it when the creator says "new brand", "new project", "new niche", "add a topic", "change what we talk about", "edit the brand", or types "/creator-brand". It also responds when the user writes the same in another language.
---

# Brand: create and edit brands, niches and topics

Speak the person's language: every question, instruction (log in here, paste this, click that), approval request and summary goes in the language they write to you in; translate tool messages when you relay them. Commands, code and file names stay in English.

This is the editing part of the system. It owns what defines a brand, which `/creator-ideas` and `/creator-reel` read:

| File | What it defines |
|---|---|
| `brands/<brand>/NICHE.md` | Who it is really for, their topics, what it is not, what the product does today, the content wheel and what has already worked |
| `brands/<brand>/BRAND.md` | The brand's rules: tone, colors and fonts, what can and cannot be shown, how it is named |
| `brands/<brand>/PROFILE.md` | Social accounts, bio, highlights, series and how its lines live together |

The reference shape is `brands/example/`. A new brand copies that shape, and no folders are created outside the map in `MAP.md`.

**Rules:**
- **Nothing is written while you are talking it through.** The draft is shown in the chat, with the changes marked, and it is written with the creator's yes.
- **Every change carries a date and a reason**, in the "History" section at the end of the file that changes. That way everyone knows where each rule came from.
- **Secrets never go in the repo or in the chat:** tokens, keys and passwords. The creator saves them in the keychain (`production/tools/save-token.sh`). Claude does not write them.
- The real niche is not the generic category. You find it in the product and in the people. For example: "people who don't know where their money goes and live out of Nequi (a Colombian digital wallet)", not "financial education".

## 0. What they want to do (AskUserQuestion, with options)

1. **New brand or project.**
2. **New topic or line inside a brand**, for example a sub-topic of Example.
3. **Change what a brand talks about:** the niche, the tone, the wheel or what is never said.
4. **Social accounts:** connect an account or change the bio, the highlights or the series.

---

## A. New brand or project

### A1. Questions (in one or two rounds, with options when possible)

- **Name and folder:** `brands/<id>`, lowercase with hyphens.
- **What it is:** an app, a service, a person (personal brand) or a business.
- **The product repository:** its local path (for example `~/projects/<repo>`) or its GitHub link. If there is no repo, ask for its website or a document.
- **Networks:** Instagram, TikTok, Facebook or YouTube, with the username on each.
- **Goal for this stage:** grow, get pre-registrations, sell or launch.
- **What cannot be said or shown:** promises, competitors, sensitive data.

### A2. Read and understand (without writing)

1. **From the product repo**, whatever exists among:
   - `README.md`, `PRODUCT.md`, `DESIGN.md` and `CLAUDE.md`;
   - `docs/`, with the backlog and the phases, to know what is coming;
   - the visual identity: logos, colors and fonts.

   From there come who it is for, what it does today, what it does not do and how it feels.
2. **From the niche**, with `last30days`: 2 or 3 searches on the pains and topics of those people, in their language and their country. You are looking for two things:
   - what those people talk about and share today;
   - which accounts already cover it and how.
3. **From the accounts**, if they are already connected: `python3 production/tools/instagram.py reels <brand> 10`.

### A3. Draft in the chat

Show the three files (`NICHE.md`, `BRAND.md`, `PROFILE.md`) in the shape of Example's. The most important one is `NICHE.md`:
- who it is really for;
- their life with the problem (the topics);
- what it is not;
- what the product does today;
- the **content wheel** with its weights (shareable, useful, connection, product);
- what gets measured.

Iterate until the creator says yes.

### A4. Create (with the yes)

1. **The folders:** `brands/<id>/` with `NICHE.md`, `BRAND.md` and `PROFILE.md`. Plus `identity/{logo,profile,covers}`, `ideas/`, `pieces/`, `finals/` and `sounds/`, with an empty `sounds/credits.json` (`[]`).
2. **The brand's Remotion project (`reel/`) is not created now.** It is built in its first `/creator-reel`, with `remotion-create`, starting from Example's kit with the brand's colors and fonts.
3. **Montage** knows about the brand in two places:
   - `montage/shared/formats.js` (the `BRANDS` list);
   - the social view component in `montage/web/src/components/` (the `ACCOUNTS` map: brand → Instagram username).

   Then: `cd montage && npm run build && npm test`.
4. **`MAP.md`:** add the brand to the map, in one line.
5. **Instagram:**
   - The creator saves the token: `zsh production/tools/save-token.sh <id>`;
   - Claude connects the account: `python3 production/tools/instagram.py connect <id>`;
   - and checks it: `instagram.py test <id>`.

   See `production/INSTAGRAM.md`.
6. **The close:** "The brand is ready. Type `/creator-ideas` for its first week."

---

## B. New topic or line inside a brand

1. **Questions:**
   - what the topic is and why now;
   - whether it is for **the same people** as the niche or for different people;
   - its role in the wheel (shareable, useful, connection or product);
   - how often it comes out and whether it is a named series;
   - its color or tag (like Example's green and black).
2. **Does it have traction?** `last30days` with 2 searches on the topic within the niche. Say whether people are sharing it or whether it is a topic only the brand cares about.
3. **If the audience does not overlap with the brand's,** say so. The rule in Example's `PROFILE.md` applies to every brand: when a line grows with a different audience, it gets its own account.
4. **Draft of the changes** in the chat:
   - in `NICHE.md`: the topic and its place in the wheel;
   - in `PROFILE.md`: the series, the highlights and the tag.
5. With the yes, write it, with its line in the "History".

## C. Change what a brand talks about

1. Show a summary of `NICHE.md` in 6 to 8 lines, with the data from `instagram.py reels <brand>`: what worked and what did not.
2. **Ask what changes:**
   - the audience;
   - the topics;
   - the tone;
   - the weights of the wheel;
   - what is never said;
   - what the product already does, because the repo moved forward: read its `PRODUCT.md` and its phases again.
3. If the change is big, validate it with `last30days` before proposing it.
4. **The change in the chat**, marked as before and after. With the yes, write it with a date and a reason in the "History".
5. Point out what is affected:
   - the ideas in `ideas/` that no longer fit (list them, do not delete them);
   - the rules in `BRAND.md` that need to move.

## D. Social accounts

- **Connect Instagram:** as in A4, point 5. Other networks: note the account in `PROFILE.md`. Publishing via the API only exists for Instagram (`production/INSTAGRAM.md`).
- **Bio, highlights, pinned posts and series:** work on them with `instagram-agent:ig-profile`, which scores and rewrites them. The draft goes in the chat. With the yes, write it in `PROFILE.md`, and the creator makes the change in the app.

## How it gets refined

If a question in this command never changes anything, remove it. If a new brand needed something that was not here, add it in its section, with a date.
