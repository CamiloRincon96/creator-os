# Own footage library

Your own footage, not stock: the street, your phone, the office, you talking, your product on screen. It works for any piece of any brand.

- Drop whatever you record into `library/inbox/`.
- `production/.venv/bin/python production/tools/library.py add` moves it to `videos/`, leaves a contact sheet in `sheets/` and transcribes what's said.
- The AI looks at each sheet and tags it: `library.py tag <id> --what "…" --tags "a,b"`.
- To use it: `library.py search "<words>" --vertical`.

The videos and the sheets don't go in git; `index.json` does.
