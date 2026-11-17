# The map

Everything has one place. No folders are created outside this map: a new brand copies the shape of `brands/example/` (`/creator-brand` does it).

```
./
├── README.md · GETTING-STARTED.md   what it is and how to install it (required and optional)
├── AGENTS.md                   instructions for any agent (CLAUDE.md and GEMINI.md point here)
├── WORKFLOW.md                 how we work, for every brand
├── MAP.md                      this map
│
├── docs/                       guide.html (the interactive map), how-it-works.png (the same map, in the README), the Montage screenshots and the logo
├── brands/
│   └── example/                the shape of a brand (copy it with /creator-brand)
│       ├── NICHE.md            who it's really for and the content wheel (used by /creator-ideas)
│       ├── BRAND.md · PROFILE.md   the brand's rules and its accounts
│       ├── OWN-STYLE.md        the style that worked, drawn from what was posted (created by /creator-pulse)
│       ├── ideas/ · pieces/ · finals/   chosen ideas, pieces in production and what's ready to post
│       ├── pulse/              metrics and cards for what was posted (filled by the watcher)
│       ├── sounds/             CC0 effects and music, with credits
│       └── reel/               the brand's Remotion project: kit, explainer (express reel) and mockup
│
├── library/                    your own footage for any piece (catalog in git; videos not)
│
├── production/                 the reels workflow, the same for every brand
│   ├── REELS-WORKFLOW.md       the stages, from the idea to the post
│   ├── LESSONS.md              what has already gone wrong and how to avoid it
│   ├── INSTAGRAM.md            connecting Instagram through the API, giving access, the metrics watcher
│   ├── SOUNDS.md               which effect goes at each moment
│   ├── DISTRIBUTION.md         what goes on each account and the plan (template)
│   ├── variations/             variations of a video: PROMPT, MUSIC, CALENDAR, LEARNED
│   ├── tools/                  the scripts: cut, voice, listen, variations, note, pulse, library, faces, instagram…
│   ├── tests/                  portability.py (nothing specific to a single system) and smoke.py (runs everything on this system)
│   ├── styles/ · templates/    video styles and piece templates
│   └── install.py              sets up a computer
│
├── montage/                    the local review editor (http://localhost:38420)
│
└── .claude/skills/             the commands: /creator-start, /creator-brand, /creator-ideas, /creator-reel, /creator-pulse, /creator-notes, /creator-montage
    (.agents/skills points here, for other agents)
```

## What doesn't go in git

Videos, working audio, renders, models and keys. Git holds the code, the rules, the catalogs and the example CC0 sound library.
