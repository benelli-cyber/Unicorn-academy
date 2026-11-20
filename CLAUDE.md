# Unicorn Academy — 4th grade math practice

## Project Overview
A game-style math practice app for one or more children (4th grade, New York
State, Bridges in Mathematics at school). Played mostly on an iPad in Safari,
added to the Home Screen. The server runs on the same Proxmox LXC as the Family
Dashboard (`benelli-cyber/calendarboard`), as a separate app on port **8081**.

It started as a claude.ai artifact; this repo is the self-hosted version. The
claude.ai version can still export progress (Grown-ups → Copy progress), which
this version imports (Grown-ups → Paste progress).

## Tech Stack (decided — do not substitute without asking)
- **Backend:** Node.js (LTS) + Express 5, CommonJS
- **Storage:** SQLite via `better-sqlite3`: one row per rider with the whole app state as JSON
- **Homework photos:** Anthropic API via `@anthropic-ai/sdk`, model from `config.json` (default `claude-opus-5-5`), server-side refusal fallback on
- **Front end:** a single `public/index.html` (vanilla HTML/CSS/JS). **No frameworks, no build step, no bundler.**
- **Fonts and icons served locally** (`public/fonts`, `public/icons`): the app must work without internet, except homework photo reading
- **Process management:** systemd service on the LXC (`deploy/unicorn-academy.service`)

## Architecture
```
iPad / any browser on the LAN ──> http://<lxc-ip>:8081/
                                     ├─ GET /                       app (public/index.html)
                                     ├─ /api/status                 homework on/off
                                     ├─ /api/riders[...]            riders + saved progress (SQLite)
                                     └─ POST /api/homework ──> api.anthropic.com (photos only)
```
- The browser owns the shape of the state; the server stores it per rider and
  refuses a save older than the stored one (409 with the newer state, which the
  page adopts).
- Each browser keeps a copy of the last progress in localStorage, so play
  continues during a server outage and syncs when it's back.

## Security
- The Anthropic API key lives only in `config.json` (git-ignored, chmod 600) or
  the `ANTHROPIC_API_KEY` environment variable. Never commit, log, or send it
  to the browser.
- LAN-only. Never suggest port forwarding. Remote access, if ever wanted, is
  via Tailscale (as for the dashboard).
- No login: access is controlled at the network layer. The Grown-ups PIN is a
  kid-proof lock, not security.
- Everything shown from stored or AI-generated text is escaped (`esc()`) or set
  with `textContent`.

## Project Structure
```
unicorn-academy/
├── CLAUDE.md, README.md, package.json, config.example.json, .gitignore
├── server/
│   ├── index.js      # Express app, routes
│   ├── config.js     # config.json + env overrides
│   ├── riders.js     # SQLite store for riders and their progress
│   └── homework.js   # Claude call for worksheet photos, prompt, error codes
├── public/
│   ├── index.html    # the whole app
│   ├── manifest.json, icons/, fonts/
├── test/             # node --test
└── deploy/
    ├── INSTALL.md
    └── unicorn-academy.service
```

## Working Style
- Explain briefly what you're about to change before large edits
- Prefer small, reviewable commits with clear messages
- Ask before adding any new dependency beyond those listed above
- Run `npm test` before committing; check the page in a browser at iPad size (1024×768 and 768×1024)
