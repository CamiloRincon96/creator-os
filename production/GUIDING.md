# How to guide the person, by the hand

Whoever uses this may not be technical. Every time the system talks to them, the person has to know within seconds what's happening, why, what they have to do and what comes next. No jargon and no paragraphs. This applies to every skill and in the person's language (the texts below are in English; say them the same way in their language).

## The moments

**1. Before a step:** one line with what you're about to do and what it's for; if it takes a while, how long. For example: "Now I'm getting your computer ready to edit: I install what's missing inside this folder (about 5 minutes). It doesn't touch anything else on your system."

**2. When something has to be decided:** a question with options, in the format of "How to ask" (below). Never an open question if you can give options.

**3. When the person has to do something with their hands** (a web page, their terminal, their phone), one step per message, with:
- **where:** the exact page (open it for them) or the exact app ("the Terminal app"; on Windows, "PowerShell");
- **what to click or type:** the exact button names and the command ready to copy;
- **what they'll see:** what shows up if it went well;
- **how to tell you:** “When you see it, tell me "done"”. If they see something else, they describe it or send a screenshot.

**4. When something gets installed, uploaded or spent:** first, what it is, where it comes from, how big it is or what it costs, and what it touches on the computer. Passwords, keys, accepting terms and paying are done by the person; tell them exactly where.

**5. After a step:** one line with what was produced, **every version that was generated with its location** (the video or image of each version: what goes to Montage or gets delivered; not intermediate files like sheets, tracks or reports), and then what's next. The person doesn't see the files unless they're told where they are (the creator, Nov 17, 2026: "whenever you create something, give me the location… not every file, but every video generated for each version").
- **As a link that opens with one click:** in VS Code and in the Claude app, the path relative to the repo as a link, `[cut-v2.mp4](brands/example/pieces/…/voice/cut-v2.mp4)`: it opens the file in the editor (videos and images show right there). In the terminal, the full path.
- **Every version, not just the Montage link:** the Montage link goes too, never instead of the video's path. If a version leaves several videos, one per line, with a word on what each one is ("to listen", "the one to post").
- **Its score:** with every version, the independent reviewer's score per axis in one line, and that they rate it in Montage with stars (1 to 5): "Give it your stars in Montage". Their stars show where the reviewer gets it wrong.
- **To see it on the computer:** `python3 production/tools/show.py <path>` opens the folder in Finder (or Windows File Explorer) with the file selected. Offer it in one line, or do it if the person asks.

For example: "Done: your voice is in [cut-v2.mp4](brands/example/pieces/2026-11-16-example/voice/cut-v2.mp4). Now you listen to it and tell me whether every word comes through."

**6. When something fails:** what happened, in plain words; why (if known); and one single step to fix it. Never the raw error alone, and never repeat the same command hoping for a different result.

**7. When you finish:** what was achieved, where it is and what they can do now, in 3 to 5 lines. A single question to go on, if needed.

**Always:**
- in the person's language;
- one idea per line;
- technical names with what they do: "Whisper, the one that turns your voice into text";
- commands ready to copy, in their system's version: on Windows, `python` instead of `python3`.

## How to ask

1. **The question says what the decision is for.** For example "What do you want to use to improve your voice?", not "Which options do you turn on?".
2. **Each option, in one or two short sentences**, always in this order:
   - **What it's for:** what the person gains, in their words ("so your voice sounds clean").
   - **Where it's used:** in which part of the work ("when preparing the reel's voice").
   - **What it costs:** "Free", or "Paid:" with what gets paid (subscription, credits, limited free plan) and roughly how much a month, in US dollars. Anything paid is always quoted and waits for their yes before spending.
3. **If saying no takes something away, say it on the same line** ("without this, …"). If it takes nothing away, don't say it.
4. **Up to 4 options per question and up to 4 questions at a time** (AskUserQuestion). If there are more options, group them by what they're for (posting, ideas, voice, picture): one question per group, all in a single call.
5. **The recommended one goes first**, with "(Recommended)".
6. **No technical name on its own.** Always with what it does: "Whisper, the one that turns your voice into text".
7. **Use the texts below as they are**, in the person's language. In AskUserQuestion, the name goes in `label` and the sentences in `description`. If an option is missing, add it here in the same format.

Example:

> **What do you want to use to improve your voice?**
> - **Only what's in the repo (Recommended):** to clean up your voice on your computer, without uploading it anywhere. Used when preparing the reel's voice. Free.
> - **Adobe Podcast:** so your voice sounds studio-quality in one click. Used when preparing the voice. Free with an Adobe account (about 1 hour of audio a day).
> - **ElevenLabs:** to clean up your voice or create a voice for your brand. Used when preparing the voice. Paid: the free plan gives about 10 minutes a month, with no commercial license; the cheapest, Starter, costs US$6 a month (about 30 minutes). Every use is announced first.

The prices below are in US dollars (checked 17 Nov 2026). They change by country and over time: confirm them on each one's page before paying.

## Post and measure (all free, with /creator-connect)

| Option | Text |
|---|---|
| Instagram | To post your reels and trial reels at the time you choose, and see what worked. Used when each video is finished and every Monday in `/creator-pulse`. Free. |
| Facebook | To post the same reels on your Page; Facebook posts them on its own at the time you schedule. Used when each video is finished. Free. Comes after Instagram. |
| YouTube | To upload your videos as Shorts, public or scheduled, and see how much they're watched. Used when each video is finished. Free (up to 100 videos a day). |
| TikTok | To send the video to your TikTok drafts; you post it from your phone with the sound you want. Used when each video is finished. Free. |

## Ideas and copy

| Option | Text |
|---|---|
| last30days | To see what your niche is sharing this month on TikTok, Instagram, YouTube and Reddit. Used when looking for ideas (`/creator-ideas`). Free. For TikTok and Instagram it needs a ScrapeCreators key: 100 free credits when you sign up, no card, and up to 1,200 more you can claim from its dashboard. Each search spends some, and what you have left shows in that dashboard. After that, paid: from US$47 for 25,000 credits, which never expire. |
| instagram-agent | To write hooks, scripts and copy that sound like you. Used in the script and when posting. Free. |
| marketingskills | For strategy: why people share and which format goes on each network. Used when planning the week. Free. |

## Voice

| Option | Text |
|---|---|
| Only what's in the repo | To clean up your voice on your computer, without uploading it anywhere. Used when preparing the reel's voice. Free. |
| Adobe Podcast | So your voice sounds studio-quality in one click. Used when preparing the voice. Free with an Adobe account (about 1 hour of audio a day). |
| ElevenLabs | To clean up your voice or create a voice for your brand. Used when preparing the voice. Paid: the free plan gives about 10 minutes a month, with no commercial license; the cheapest, Starter, costs US$6 a month (about 30 minutes). Every use is announced first. |
| CapCut (enhance voice) | To clean up the voice with CapCut's tool. You do it in CapCut. Paid: CapCut Pro, about US$20 a month (US$19.99, or US$179.99 a year; it varies by country). |

## Picture and animation

| Option | Text |
|---|---|
| HyperFrames | To have hundreds of ready-made animations and transitions, and the sound effects placed on their frame. Used when animating the video. Free. |
| Remotion skills | So the AI animates your videos better. Used when animating. Free: Remotion, the one that animates in code, is free for individuals and companies of up to 3 people. A bigger company pays for its license, from US$25 a month per seat (remotion.dev/license). |
| After Effects | For the color of your takes and effects that don't come out well in code (text behind you, glows). Used when fixing the picture. Paid: After Effects on its own costs about US$23 a month (US$22.99, on the annual plan paid monthly). Without it, color is done for free with ffmpeg. |
| Higgsfield | To change your clothes, the light or the angle of the video with AI. Used only in the video you ask for. Paid, by credits: according to Higgsfield, the cheapest plan costs US$15 to US$19 a month (200 to 270 credits) and it varies by country; today's price is at higgsfield.ai/pricing. You're always shown the exact price and your yes is awaited before spending. |
| Codex | To create reference photos (other clothes, other light) with your ChatGPT account. Used before Higgsfield. Paid: it uses your ChatGPT plan. Free and Go (US$8 a month) come with limited Codex; Plus costs US$20 a month. |
| CapCut (retouch) | For face retouching with your saved adjustment. Used at the end of the picture. Paid: CapCut Pro, about US$20 a month (US$19.99, or US$179.99 a year; it varies by country). |
| None of these | The video is made with what comes in the repo. Free. |

## What the computer is missing

| Option | Text |
|---|---|
| Node.js | So Montage (the editor where you review the videos) and the animations run. Used throughout the workflow. Free. Without it, nothing video-related works. |
| Python | For the tools that cut, clean up and measure your voice. Used throughout the workflow. Free. |
| ffmpeg | To read, cut and mix the videos and the audio. Used throughout the workflow. Free. Without it, Montage doesn't show the videos. |
| git | To download the repo and its updates. Used at the start and when updating. Free. |
| Google Chrome | To open Montage as an app with its own window. Free and optional: without it, it opens in Edge (Windows) or in your browser. |
| Whisper (2.9 GB) | To turn your voice into text on your computer, without uploading it. Used when cutting the voice. Free; it's a 2.9 GB download. If you say no now, it downloads itself the first time it's needed. |
| yt-dlp | To download the reference videos you send me. Used when starting a piece. Free and optional. |

To ask permission to install, the options are:
- **Install everything (Recommended):** "I install what's missing; it's all free. If the system asks for your password or shows a permission window, you type it or accept it."
- **One by one:** "I ask you about each program."
- **Not now:** say in one line what won't work.

## What gets decided in each piece (creator-reel, stage 0)

| Option | Text |
|---|---|
| No AI on the person (Recommended) | Your video as you recorded it, with color and framing. Free. |
| Reference photo | A photo of you with other clothes or light, to decide before paying for anything. With Codex: it uses your ChatGPT plan (Free gives a little; Plus, US$20 a month). |
| Light, clothes or angle with AI | Changed in the video with Higgsfield. Paid, by credits (plans from about US$15 to US$19 a month): I show you the exact price first. |
| Face retouching | With your CapCut adjustment. Paid: CapCut Pro, about US$20 a month. |

## Ideas (creator-ideas)

| Option | Text |
|---|---|
| Reel | A short video: what reaches the most people who don't follow you yet. |
| Story | For your followers: connection and soft sales. Lasts 24 hours. |
| Carousel | Several images you swipe through: they get saved and shared; good for teaching. |
| The week | A plan of several pieces, each with its role: some to reach new people, others to sell. |

And the network ("Where are you going to post it?"):

| Option | Text |
|---|---|
| Instagram | Reels to reach new people; stories and carousels for your followers. |
| TikTok | Short videos; you post them from your phone, with any sound you want. |
| Facebook | The same reels, on your Page. |
| YouTube Shorts | Short videos on your channel. |
