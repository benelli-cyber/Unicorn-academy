# Unicorn Academy

A self-hosted, game-style 4th grade math practice app for an iPad. It runs on
the Proxmox LXC next to the Family Dashboard and is opened at
`http://<lxc-ip>:8081/` from any browser on the home network.

**Installing on the LXC:** see [`deploy/INSTALL.md`](deploy/INSTALL.md).

## What's in it
- **Trail Ride:** 8 adaptive problems a day, leaning toward weak skills and the
  skills marked "In class now"
- **Number Reader, Area Model Builder, Teach the Foals, Fact Gallop, Story Workshop**
- **Homework Helper:** photos of a worksheet are read by Claude (optional API
  key), giving step-by-step hints and a warm-up, never the answers
- **Stable Shop:** coins buy coats, markings, saddles, reins and gear
- **Grown-ups area (PIN):** time on the app (practicing vs. in the app, per
  day), skill progress, mistakes, rewards, "Match her class" settings,
  copy/paste progress, more than one rider
- **Study time:** a daily practice goal and/or a one-off session ("20 minutes
  now"), shown as a countdown on her side; optionally locks the shop until done

Skills follow the NY Next Generation standards and the class's Bridges in
Mathematics units (place value, multiplying with tens and hundreds, area
models, factors and primes, ratio tables, division with remainders, word
problems).

## Requirements
- Node.js 20+ (LTS)

## Quick start

```bash
npm install
npm start
```

Open <http://localhost:8081/>. Progress is saved in `data/unicorn-academy.db`.

To turn on homework photo reading, copy `config.example.json` to `config.json`
and set `anthropicApiKey` (see `deploy/INSTALL.md`).

## Tests

```bash
npm test
```
