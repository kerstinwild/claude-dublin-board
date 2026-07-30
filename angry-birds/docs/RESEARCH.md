# Angry Birds Clone — Research

## MECHANICS
Core game mechanics for an Angry Birds clone, with concrete tunable values.

**Slingshot control**
- Mouse down on bird in slingshot, drag back, release to fire.
- Launch velocity = (anchor − releasePoint) × powerFactor (~0.15–0.25); clamp drag distance to ~100px max.
- Gravity ≈ 0.4–0.5 px/frame²; velocity damping/air ~0.99/frame.
- Trajectory preview: simulate projectile, plot ~15–25 dots at fixed timesteps while aiming.

**Bird types (tap-ability mid-flight)**
- Red: plain, no ability. Mass 1.
- Yellow/Chuck: on tap, speed boost — multiply current velocity ×1.8–2.0 in travel direction.
- Blue: on tap, splits into 3 birds fanned ±15°, each ~0.4 mass.
- Black (bomb): on tap or impact, explosion radius ~120px, high area damage (~150).
- White: on tap, drops an egg (downward projectile, explodes on impact); bird boosts up/forward.

**Targets & structures**
- Pigs: primary targets. Small HP ~30–50, killed by ~50 impact damage. Pop when hit hard enough.
- Blocks by material (HP): Wood ≈ 50, Ice/Glass ≈ 30, Stone ≈ 100. Shapes: beams, squares, planks.
- Damage = impactSpeed × massFactor × materialModifier; e.g. damage = speed × 1.0, subtract from HP; block destroyed at HP ≤ 0.
- Collisions transfer momentum (use a physics lib like Matter.js for speed).

**Scoring**
- Per pig destroyed: 5,000 points.
- Per block destroyed: 500 points.
- Leftover-bird bonus: 10,000 per unused bird.
- Level score = pigs + blocks + bonus.

**Star thresholds (per level)**
- 1 star: clear level (kill all pigs).
- 2 stars: score ≥ ~30,000.
- 3 stars: score ≥ ~50,000. (Set per-level; scale to available points.)

**Win / lose**
- Win: all pigs destroyed (any birds remaining).
- Lose: birds run out and pigs still alive.

**Progression**
- Sequential levels; completing one unlocks the next. Store best score/stars per level (localStorage). Typical 3–5 levels for a 15-min build.

## PHYSICS
This is research only, no tools needed. Here's the spec.

## Matter.js Angry Birds — Implementation Spec

**Setup**
```js
const { Engine, Runner, Composite, Bodies, Body, Events } = Matter;
const engine = Engine.create();
engine.gravity.y = 1;           // default ~1, feels right at 60fps
const world = engine.world;
Runner.run(Runner.create(), engine);
```
Fixed timestep runner is fine. Render manually (below), not with Matter.Render.

**Material properties** (`{ restitution, friction, density }`)
- Bird: `0.4, 0.5, 0.008` (light-ish, small bounce)
- Wood: `0.3, 0.6, 0.004` (light, breaks easily)
- Stone: `0.1, 0.9, 0.02` (heavy, tough)
- Ice: `0.2, 0.05, 0.003` (slippery, fragile)
- Ground/slingshot base: `Bodies.rectangle(..., { isStatic:true, friction:1 })`

**Slingshot launch**
Track drag from anchor `(ax,ay)`. On mouseup, `dx=ax-mx, dy=ay-my`. Apply velocity proportional to drag, capped:
```js
const power = 0.25;
let vx = dx*power, vy = dy*power;
const max = 30, sp = Math.hypot(vx,vy);
if (sp > max){ vx*=max/sp; vy*=max/sp; }
Body.setVelocity(bird, {x:vx, y:vy});
```

**Sleeping**: `Engine.create({ enableSleeping:true })`; set `bird.isSleeping=false` on launch. Reduces jitter and CPU on settled stacks.

**Impact damage** (`collisionStart`)
```js
Events.on(engine,'collisionStart', e => {
  for (const {bodyA,bodyB} of e.pairs){
    const rv = Vector.magnitude(Vector.sub(bodyA.velocity, bodyB.velocity));
    if (rv > 6){
      const dmg = rv * (bodyA.mass + bodyB.mass) * 0.5;
      [bodyA,bodyB].forEach(b => { if(b.hp!==undefined){ b.hp-=dmg; }});
    }
  }
});
```
Store `hp` on each block (wood ~30, ice ~15, stone ~120). Ignore pairs with a static body if you only want block damage.

**Removing bodies**: never remove inside the event loop. Flag `b.dead=true`, then after the tick: `Composite.remove(world, b)`. Sweep a `deadList` each frame.

**Manual canvas render**
```js
function draw(){
  ctx.clearRect(0,0,W,H);
  for (const b of Composite.allBodies(world)){
    ctx.beginPath();
    if (b.circleRadius){
      ctx.arc(b.position.x, b.position.y, b.circleRadius, 0, 7);
    } else {
      const v = b.vertices;
      ctx.moveTo(v[0].x, v[0].y);
      for (let i=1;i<v.length;i++) ctx.lineTo(v[i].x, v[i].y);
      ctx.closePath();
    }
    ctx.fillStyle = b.render.fillStyle || '#888';
    ctx.fill();
  }
  requestAnimationFrame(draw);
}
```
Stash color/type in `b.render.fillStyle` at creation. Draw the slingshot band as a separate line from anchor to bird while dragging.

## ART
I don't need any tools for this—it's a description task from my knowledge. Here's the recipe.

**Angry Birds visual style — canvas drawing recipe**

**Overall look:** Bright, saturated cartoon. Bold black outlines (2-3px), soft radial shading, no gritty textures. Everything rounded and friendly.

**Sky:** Vertical linear gradient, top `#5bc0e8` to bottom `#afe4f5`. Optionally warm `#bfe9f2` near horizon.

**Hills:** Overlapping rounded arcs, front `#7cb342`, back `#8bc34a`, darker rim `#689f38`. Flat-ish ellipse tops.

**Clouds:** White `#ffffff` clusters of 3-5 overlapping circles, flat bottoms, faint `#e8f4f8` underside.

**Red bird:** Circle body `#d62b1f` with radial highlight top-left. Lighter belly patch (lower oval) `#f04e3e`. Two white eye ovals side by side, black pupils, thick angled black eyebrows slanting inward (angry V). Orange beak `#f39200` (two stacked triangles, small gap). Three red tail feathers at back, black-tipped. Two small head feathers on top. 2px black outline.

**Green pig:** Circle `#7cb342`, radial highlight, darker rim `#689f38`. Raised round snout `#8bc34a` with two dark `#4e7d29` nostril ovals. Two triangular/rounded ears top. Two white eyes, black pupils, faint eyebrows. Subtle rosy cheeks.

**Wooden planks:** Rectangle `#b8763e`, darker edges `#8f5a2c`, 2-3 curved grain lines `#9c6533`, small end-grain dots. Slight rounded corners.

**Ice/glass blocks:** Translucent `rgba(169,214,232,0.55)` fill, white top-left highlight streak, brighter edge `#d4eef7`, thin `#7fbcd6` outline. Add a diagonal shine line.

**Stone blocks:** Grey `#9e9e9e`, darker `#7a7a7a` edges, lighter top face `#bdbdbd`, few speckle dots.

**Slingshot:** Brown `#6b4423` Y-shape (thick fork), darker grain, plus red elastic band `#c62828` stretched to bird.

**UI:** Score top-right, chunky rounded white numerals with dark outline. Stars: gold `#ffca28` five-point stars with `#f9a825` outline, empty = grey. Level select: rounded square buttons, blue-to-white gradient, number centered.

## JUICE
Screen shake, particle bursts, squash-and-stretch, slow-mo, trajectory dots, camera pan, and star bursts — all cheap on canvas. Here's the concise research.

## Visual juice (canvas, cheap)

**Screen shake** — on impact, offset the whole `ctx.translate(rand(-m,m), rand(-m,m))` before drawing; decay `m` each frame (`m *= 0.9`). Scale magnitude to impact force.

**Particle bursts** — one array of `{x,y,vx,vy,life,color,size}`. On collision spawn 8-15: wood = brown rects tumbling, ice = cyan triangles with alpha fade, pig = green circles puffing outward + shrinking. Update with gravity, `life--`, cull at 0. One update/draw loop handles all.

**Squash-and-stretch** — on slingshot release, scale bird `scaleX=1.3, scaleY=0.7` then lerp back to 1 over ~150ms. Squash on impact too (wide+flat).

**Dust puffs** — 3-5 low-alpha gray expanding circles at ground/collision contact; grow radius, fade alpha.

**Slow-motion on last hit** — when the final pig dies, set `timeScale=0.25` for ~500ms, ease back to 1. Multiply all physics deltas by it.

**Trajectory dots** — while aiming, simulate the launch in a cheap loop and plot ~10 fading dots along the arc. Recompute each drag frame.

**Camera pan** — after release, tween camera toward the structure, hold, then tween back to slingshot. Simple lerp on a `cam.x`.

**Star burst on win** — radial particles + expanding ring; pop the 3 stars in with scale-bounce, staggered ~120ms.

## Procedural audio (Web Audio, no files)

One `AudioContext`; helper wires `osc → gain → destination` with an envelope.

- **Whoosh** — white noise buffer through a bandpass sweeping 400→2000Hz, gain 0.3→0 over 0.2s.
- **Thud** — sine, 120Hz→40Hz pitch drop, gain 0.6→0 in 0.15s.
- **Glass break** — 3-4 square oscillators, random 2-5kHz, short 0.08s decays, staggered 10ms.
- **Pig oink** — sawtooth, 300→150Hz wobble (LFO on frequency), 0.2s, gain 0.4.
- **Cheer** — noise buffer, highpass ~1kHz, slow 0.8s attack/decay, layered for crowd.

Envelope: `gain.setValueAtTime(v,t); gain.exponentialRampToValueAtTime(0.001, t+d)`.