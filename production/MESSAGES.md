# A message to whoever comments (free, about 10 minutes)

Someone comments a word on one of the account's posts, for example "want". They get a private message with the link, and their comment gets a public reply. It's how you hand out a gift, a guide or a link without "link in bio".

It's set up in **Meta Business Suite**, free and immediate. It doesn't go through the repo's API. Tested on 17 Nov 2026 on a creator account, with Business Suite's comment-reply template.

## The options (easiest to hardest)

| Option | What it's for | Cost |
|---|---|---|
| **Business Suite → Automations** (Recommended) | A private message and a public reply to whoever comments one of your words, on every post of the account. | Free. About 10 minutes. |
| A messaging tool (for example, ManyChat) | The same, plus flows with several questions, one per reel, and statistics. | Paid, on a monthly plan. Claude tells you today's price before you decide. |
| The repo's API | Claude answering the messages. | Not for now: messaging people who have no role on your app needs Meta's advanced access (app review and business verification, weeks of paperwork). |

## What to know first

- **It applies to every post of the account**, including the ones you post later: you can't pick one reel. When the gift changes, edit it; when it no longer applies, turn it off.
- **One message per comment**, within 7 days of the comment. If the person answers, there are 24 hours to keep the conversation going: the first message must already carry the link.
- **The words have to match.** Avoid short words that show up in any comment ("yes", "ok"). Add variants: with and without accents, singular and plural.
- **Only on the computer:** automations are created in Business Suite in the browser, not in the phone app.
- It can take a few minutes to arrive.

## What you need

- The Instagram account set to professional (Creator or Business) and in the same Business Suite portfolio as its Facebook Page. It's the same thing connecting Instagram asks for (steps 1 to 3 of `production/INSTAGRAM.md`).
- The text of the message (2 or 3 lines and the link), the public reply (one line) and the words. Claude proposes them and the person approves them.

## The steps

Claude goes one step per message, as in `/creator-connect`. It opens the page with `connect.py open <step>`, says what to click and waits for "done".

**1. Allow access to messages** (on the phone).
- In the Instagram app, with the brand's account: **Settings and privacy** → **Messages and story replies** → **Message controls** → **Connected tools** → turn on **Allow access to messages**.
- What for: without it, Business Suite can't see Instagram messages or send them.
- **Done when:** the switch turns blue.

**2. Open the automations** (on the computer).
- Open: `python3 production/tools/connect.py open meta-automations` (https://business.facebook.com/latest/inbox/automations). If Business Suite has several portfolios, pick the brand's at the top left.
- **Done when:** you see the list of automations (it may be empty).

**3. Pick the template.**
- Click **Create automation** and pick the comment-reply template (*Comment to message* or *Reply to comments*). Pick **Instagram**.
- **Done when:** the editor opens with the trigger (comments) and the replies.

**4. The words that trigger it.**
- Type the words you approved, one by one.
- **Done when:** they all show in the list.

**5. The private message.**
- Paste the approved text. To greet people by name, use the commenter's name variable (it shows as **Recipient's name** or *First name*). Put the full link.
- **Done when:** the preview shows the message with the link.

**6. The public reply.**
- Turn on the comment reply and paste the approved line, for example "Done! I sent it to you by message 📩".
- **Done when:** it shows under the private message.

**7. Save and turn on.**
- Give it a name that says what it hands out and click **Save**. Check in the list that it's **on**: saving doesn't always turn it on.
- The person confirms this step: it's a rule that keeps running on its own in their account.
- **Done when:** the automation shows in the list with the switch on.

**8. Test it.**
- From another account (a friend's or a second account), comment one of the words on a post.
- **Done when:** in a few minutes the private message and the public reply arrive. If they don't, see "If something fails".

## With the browser

If the person would rather Claude clicked for them, and Claude has the browser (Claude in Chrome), it can do steps 2 to 6 in their Chrome, with their session already open. The person logs in to their account and Claude never types passwords. Step 7 (turning it on) happens with their yes in the chat. Step 1 is always on their phone.

## If something fails

| What happens | What to do |
|---|---|
| Instagram doesn't show in Business Suite | The account isn't in the brand's portfolio: steps 2 and 3 of `production/INSTAGRAM.md`. |
| There's no comment template | The account isn't professional, or step 1 is missing. If it still doesn't show, Meta hasn't opened it for that account yet: use a messaging tool or wait. |
| The message doesn't arrive | Check that it's on, that the word matches exactly, and that the test account hasn't already received one for that comment. Wait 15 minutes. |
| It replies to almost everything | There's a word that is too short or too common: remove it. |

## Sources (checked 17 Nov 2026)

- Automated responses in the Business Suite inbox: https://www.facebook.com/business/help/395965998733706
- The Business Suite inbox (Facebook and Instagram messages and comments): https://www.facebook.com/business/help/294426838452244
- Private replies to comments (one message, within 7 days): https://developers.facebook.com/documentation/business-messaging/instagram-messaging/features/private-replies
- Instagram messaging rules (the 24-hour window): https://developers.facebook.com/documentation/business-messaging/messenger-platform/policy
