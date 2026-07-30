The PRD is complete. Returning the markdown.

---

# PRD — Browser Angry Birds Clone (matter.js)

## 1. Goal & Scope
Build a **playable** browser Angry Birds clone in ~15 minutes. v1 must let a player drag-and-release a red bird from a slingshot, smash block structures with realistic physics, pop pigs, clear 3 levels, and see score + stars + win/lose + restart. No accounts, no backend, no mobile touch (mouse only). Ship it running on a local static server.

**Definition of done (v1):** launch bird → physics collisions damage blocks/pigs → all pigs cleared = win → score & stars shown → next level / restart works across 3 levels.

## 2. Tech Stack
- **Single-page, 3 files:** `index.html`, `game.js`, plus matter.js from CDN.
- matter.js via CDN: `<script src="https://cdn.jsdelivr.net/npm/matter-js@0.19.0/build/matter.min.js"></script>`
- **Rendering:** manual `<canvas>` 2D draw loop (NOT `Matter.Render`). Fixed canvas ~1000×600.
- **Control:** mouse only (`mousedown`/`mousemove`/`mouseup`).
- **Persistence:** `localStorage` for best score/stars per level.
- **Run:** any static server, e.g. `python3 -m http.server 8000` → open `localhost:8000`.
- No build step, no bundler, no framework.

## 3. Core Features Checklist (v1)
- [ ] Slingshot: mousedown on bird → drag back (clamp ~100px) → release fires; elastic band drawn while dragging.
- [ ] Trajectory preview: ~15 fading dots plotted while aiming.
- [ ] Red bird (mass 1, no ability). 3 birds per level, queued at slingshot.
- [ ] Pigs (targets) with HP; pop when destroyed.
- [ ] Blocks: wood, stone, ice — as squares/beams/planks.
- [ ] Physics damage on `collisionStart` (relative velocity × mass → subtract HP).
- [ ] 3 hand-authored levels; sequential unlock.
- [ ] Score: pigs 5,000 / block 500 / leftover-bird bonus 10,000 each.
- [ ] Stars: 1★ = cleared, 2★ = ≥30k, 3★ = ≥50k (tune per level).
- [ ] Win (all pigs dead) / Lose (birds out, pigs alive) overlays.
- [ ] Restart level + Next level buttons.

## 4. Physics Params

**Engine**
| Setting | Value |
|---|---|
| `engine.gravity.y` | 1 |
| `enableSleeping` | true (wake bird on launch) |
| Runner | `Runner.run(Runner.create(), engine)` |
| Canvas | 1000 × 600 |
| Ground | static rectangle, `friction: 1` |

**Material `{ restitution, friction, density }` + HP**
| Element | restitution | friction | density | HP |
|---|---|---|---|---|
| Bird | 0.4 | 0.5 | 0.008 | — |
| Wood | 0.3 | 0.6 | 0.004 | 50 |
| Stone | 0.1 | 0.9 | 0.02 | 100 |
| Ice | 0.2 | 0.05 | 0.003 | 30 |
| Pig | 0.3 | 0.4 | 0.006 | 40 |

**Launch**
| Param | Value |
|---|---|
| power factor | 0.25 |
| drag clamp | 100 px |
| max launch speed | 30 |
| formula | `vx=(ax-mx)*0.25, vy=(ay-my)*0.25`, clamp magnitude to 30 |

**Damage** (in `collisionStart`)
- `rv = |velocityA − velocityB|`; ignore if `rv < 6`.
- `dmg = rv * (massA + massB) * 0.5`; subtract from `b.hp` where defined.
- Ignore pairs where both bodies are static.
- **Never remove bodies inside the event.** Flag `b.dead = true`, sweep a `deadList` after each tick with `Composite.remove(world, b)`.

## 5. Art Recipe (hex per element)
Bright cartoon, bold ~2px black outlines, rounded shapes, soft radial highlights. Stash color in `body.render.fillStyle` at creation.

| Element | Colors |
|---|---|
| Sky | vertical gradient `#5bc0e8` → `#afe4f5` |
| Hills | front `#7cb342`, back `#8bc34a`, rim `#689f38` |
| Clouds | `#ffffff`, underside `#e8f4f8` |
| Red bird | body `#d62b1f`, belly `#f04e3e`, beak `#f39200`, white eyes + black pupils, angry black brows |
| Green pig | body `#7cb342`, snout `#8bc34a`, nostrils `#4e7d29`, rim `#689f38` |
| Wood | `#b8763e`, edges `#8f5a2c`, grain `#9c6533` |
| Ice | fill `rgba(169,214,232,0.55)`, edge `#d4eef7`, outline `#7fbcd6` |
| Stone | `#9e9e9e`, edges `#7a7a7a`, top `#bdbdbd` |
| Slingshot | fork `#6b4423`, band `#c62828` |
| Stars | gold `#ffca28`, outline `#f9a825`, empty grey |

## 6. Juice & Audio Quick-Wins
Prioritize the cheapest, highest-impact for v1: trajectory dots, screen shake, particle bursts.

**Visual**
- **Screen shake:** `ctx.translate(rand(-m,m), rand(-m,m))` before draw; `m *= 0.9` decay, scale to impact force.
- **Particles:** one array `{x,y,vx,vy,life,color,size}`; spawn 8–15 on collision (wood=brown rects, ice=cyan tris, pig=green puffs). Gravity + `life--`, cull at 0.
- **Squash-stretch:** bird `scaleX 1.3 / scaleY 0.7` on release + impact, lerp back over ~150ms.
- **Slow-mo:** on final pig death, `timeScale = 0.25` for ~500ms, ease to 1.
- **Star burst on win:** radial particles + expanding ring; pop stars with staggered scale-bounce (~120ms).

**Audio (Web Audio, procedural, no files)** — one `AudioContext`, `osc → gain → destination`, envelope `gain.exponentialRampToValueAtTime(0.001, t+d)`.
- Whoosh (launch): noise + bandpass 400→2000Hz, 0.2s.
- Thud (impact): sine 120→40Hz, 0.15s.
- Glass break (ice): 3–4 square osc, 2–5kHz, 0.08s staggered.
- Pig oink (pop): sawtooth 300→150Hz wobble, 0.2s.
- Cheer (win): highpassed noise, slow 0.8s attack/decay.

## 7. Roadmap
**v1 (this build):** everything in §3 — red bird, 3 levels, damage, score, stars, win/lose, restart, dots + shake + basic sound.

**v2 (feel & content):**
- Bird types with mid-flight tap abilities: yellow (×1.9 speed boost), blue (splits into 3, ±15°), black (bomb, ~120px radius explosion ~150 dmg).
- Full particle/squash-stretch/slow-mo/star-burst juice pass.
- Complete procedural audio set + a music loop.
- Camera pan to structure after release, then back to slingshot.
- 5 levels + level-select screen with saved stars.

**v3 (polish & depth):**
- White bird (egg drop), material variety (glass shards, TNT crates).
- Combo/chain scoring, on-screen score popups, high-score table.
- Sprite/gradient art upgrade over primitive shapes; parallax background.
- Level editor + shareable level codes; more levels.
- Mobile touch controls + responsive canvas scaling.

## 8. File Structure
```
angry-birds/
├── index.html      # canvas, matter.js CDN <script>, UI overlays, loads game.js
├── game.js         # engine setup, levels[], input, damage, render loop, scoring, UI
└── (matter.js loaded from CDN — no local file)
```
`levels` = array of level defs (bird count, pig positions, block layout `{type,x,y,w,h}`, star thresholds). `game.js` boot: create engine → load level[0] → run loop.