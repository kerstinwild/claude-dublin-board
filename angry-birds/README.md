# Angry Birds — Browser Clone (Workshop Build)

A faithful, mouse-controlled Angry Birds clone built in the browser with HTML5 Canvas + [matter.js](https://brm.io/matter-js/) rigid-body physics. Everything is drawn with canvas shapes (no image assets) and all sound is generated procedurally with the Web Audio API (no audio files). Fully offline — matter.js is vendored locally.

Built live in a **25-minute** workshop using a multi-agent (ultracode) workflow: parallel research + PRD, a hand-built v1 core, then v2/v3 upgrades built in parallel.

## How to play
Click and drag the bird on the slingshot back, aim with the trajectory dots, and release to launch. Knock out all the green pigs before you run out of birds. Click after a win/loss to continue or retry.

## Versions
Each version is self-contained and runs on its own static server.

| Version | Port | What's new |
|---------|------|-----------|
| **v1** | 8101 | Core game: slingshot + mouse control, trajectory preview, matter.js physics, wood/ice/stone blocks with an impact-velocity damage model, pigs, 3 levels, score, 3-star ratings, win/lose/restart, particles, screen shake, procedural SFX. |
| **v2** | 8102 | Multiple bird types with mid-air tap abilities (yellow dash, blue split, black bomb), slow-motion on the final kill, dust puffs, per-level best score in localStorage. |
| **v3** | 8103 | Everything in v2 + a start/level-select menu with persisted stars, sound on/off toggle, richer levels and art polish. |

## Run it
```bash
python3 -m http.server 8101 --directory angry-birds/v1
python3 -m http.server 8102 --directory angry-birds/v2
python3 -m http.server 8103 --directory angry-birds/v3
```
Then open `http://localhost:8101` (or 8102 / 8103).

## Structure
```
angry-birds/
  v1/  v2/  v3/     index.html + game.js + matter.min.js (each independent)
  shared/           matter.min.js source
  docs/             RESEARCH.md, PRD.md
  README.md
```

## Tech notes
- **Physics:** matter.js `Engine`/`World`, gravity 1. Bodies rendered manually on a 2D canvas (circles for birds/pigs, rounded rects for blocks). Damage on `collisionStart` scales with relative impact velocity².
- **Control:** drag vector from the slingshot fork drives launch velocity, capped at a max pull.
- **No dependencies to install** — matter.js is a single vendored file.
