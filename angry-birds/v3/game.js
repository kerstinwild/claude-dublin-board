/* Angry Birds — v3
   Canvas + matter.js. Menu + level select, multi-bird abilities, best/stars persistence, sound toggle, polish. */
(() => {
'use strict';
const { Engine, World, Bodies, Body, Composite, Events, Vector } = Matter;

// ---------- World constants ----------
const W = 1280, H = 720;
const GROUND_Y = H - 70;
const SLING = { x: 220, y: GROUND_Y - 130 };   // fork rest point
const MAX_PULL = 130;                           // max drag radius
const LAUNCH_POWER = 0.32;                       // pull -> speed multiplier

// ---------- Canvas ----------
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
canvas.width = W; canvas.height = H;
function fit() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = (W * s) + 'px';
  canvas.style.height = (H * s) + 'px';
}
window.addEventListener('resize', fit); fit();

// ---------- Persistence ----------
function bestKey(l){ return 'ab_v3_best_'+l; }
function starsKey(l){ return 'ab_v3_stars_'+l; }
function getBest(l){ try{ return parseInt(localStorage.getItem(bestKey(l))||'0',10)||0; }catch(e){ return 0; } }
function setBest(l,v){ try{ localStorage.setItem(bestKey(l), String(v)); }catch(e){} }
function getStars(l){ try{ return parseInt(localStorage.getItem(starsKey(l))||'0',10)||0; }catch(e){ return 0; } }
function setStars(l,v){ try{ if(v>getStars(l)) localStorage.setItem(starsKey(l), String(v)); }catch(e){} }

// ---------- Sound toggle ----------
let soundOn = true;
try{ soundOn = localStorage.getItem('ab_v3_sound') !== 'off'; }catch(e){}
function toggleSound(){ soundOn = !soundOn; try{ localStorage.setItem('ab_v3_sound', soundOn?'on':'off'); }catch(e){} }

// ---------- Audio (procedural, no files) ----------
let AC = null;
function ac(){ if(!AC){ try{ AC = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } return AC; }
function tone(freq, dur, type='sine', vol=0.2, slideTo=null){
  if(!soundOn) return;
  const a = ac(); if(!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq;
  if(slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + dur);
  g.gain.value = vol; g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
  o.connect(g); g.connect(a.destination);
  o.start(); o.stop(a.currentTime + dur);
}
function noise(dur, vol=0.3){
  if(!soundOn) return;
  const a = ac(); if(!a) return;
  const buf = a.createBuffer(1, a.sampleRate*dur, a.sampleRate);
  const d = buf.getChannelData(0);
  for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length);
  const src = a.createBufferSource(); src.buffer = buf;
  const g = a.createGain(); g.gain.value = vol;
  src.connect(g); g.connect(a.destination); src.start();
}
const SFX = {
  launch: () => tone(200, 0.25, 'sawtooth', 0.15, 520),
  thud:   () => tone(90, 0.18, 'square', 0.25, 50),
  glass:  () => { noise(0.18, 0.25); tone(1400, 0.12, 'triangle', 0.12, 700); },
  wood:   () => tone(150, 0.15, 'square', 0.2, 80),
  oink:   () => { tone(420, 0.12, 'sawtooth', 0.2, 260); setTimeout(()=>tone(300,0.12,'sawtooth',0.18,180),90); },
  cheer:  () => { [523,659,784,1046].forEach((f,i)=>setTimeout(()=>tone(f,0.25,'triangle',0.2),i*90)); },
  fail:   () => { [400,300,200].forEach((f,i)=>setTimeout(()=>tone(f,0.3,'sawtooth',0.2),i*140)); },
  dash:   () => tone(600, 0.15, 'square', 0.18, 1200),
  split:  () => { [500,700,900].forEach((f,i)=>setTimeout(()=>tone(f,0.1,'triangle',0.15),i*40)); },
  boom:   () => { noise(0.35, 0.4); tone(80, 0.4, 'sawtooth', 0.3, 30); },
};

// ---------- Engine ----------
const engine = Engine.create();
engine.world.gravity.y = 1;
let world = engine.world;

// ---------- Game state ----------
const MATERIALS = {
  wood:  { color:'#b8763e', dark:'#8a5628', hp: 55,  density:0.0016, sfx:SFX.wood },
  ice:   { color:'#a9d6e8', dark:'#7fb8cf', hp: 32,  density:0.0011, sfx:SFX.glass },
  stone: { color:'#9e9e9e', dark:'#6f6f6f', hp: 120, density:0.0030, sfx:SFX.thud },
};
let state, level = 0, particles = [], shake = 0, cam = { x:0, tx:0 };
let birds = [], blocks = [], pigs = [], slingBird = null;
let dragging = false, mouse = { x:0, y:0 }, launched = false, launchWatch = 0;
let score = 0, timeScale = 1, slowmoT = 0;
let speckles = [];

// ---------- Level definitions ----------
function LEVELS(){
  return [
    // Level 1 — gentle intro, extra block + yellow bird
    () => {
      addStructure(760, [
        {t:'wood', w:26, h:150, dx:-70}, {t:'wood', w:26, h:150, dx:70},
        {t:'wood', w:190, h:26, dy:-88},
        {t:'wood', w:24, h:70, dx:0, dy:-135},
      ]);
      addPig(760, GROUND_Y-30);
      addStructure(560, [ {t:'wood', w:24, h:70, dx:0} ]);
      addPig(560, GROUND_Y-90);
      return ['red','yellow','red'];
    },
    // Level 2 — glass house + three pigs, blue bird
    () => {
      addStructure(820, [
        {t:'ice', w:24, h:120, dx:-80}, {t:'ice', w:24, h:120, dx:80},
        {t:'ice', w:200, h:24, dy:-72}, {t:'wood', w:150, h:22, dy:-108},
        {t:'wood', w:22, h:80, dx:-50, dy:-160}, {t:'wood', w:22, h:80, dx:50, dy:-160},
        {t:'wood', w:140, h:20, dy:-208},
        {t:'ice', w:20, h:60, dx:0, dy:-250},
      ]);
      addPig(790, GROUND_Y-30); addPig(850, GROUND_Y-30);
      addPig(820, GROUND_Y-96);
      return ['blue','red','red','red'];
    },
    // Level 3 — fortress, stone core, black bomb bird
    () => {
      addStructure(700, [
        {t:'stone', w:30, h:160, dx:-90}, {t:'stone', w:30, h:160, dx:90},
        {t:'stone', w:230, h:28, dy:-96},
        {t:'wood', w:26, h:80, dx:-40, dy:-150}, {t:'wood', w:26, h:80, dx:40, dy:-150},
        {t:'stone', w:150, h:24, dy:-200},
      ]);
      addPig(700, GROUND_Y-30); addPig(700, GROUND_Y-124);
      addStructure(1000, [
        {t:'wood', w:24, h:120, dx:-60}, {t:'wood', w:24, h:120, dx:60},
        {t:'ice', w:160, h:22, dy:-72}, {t:'wood', w:24, h:90, dx:0, dy:-120},
      ]);
      addPig(1000, GROUND_Y-30); addPig(970, GROUND_Y-90);
      return ['red','black','blue','yellow','red'];
    },
  ];
}

// ---------- Builders ----------
function addGroundAndSling(){
  const ground = Bodies.rectangle(W/2, GROUND_Y + 200, W*3, 400, { isStatic:true, label:'ground', friction:1 });
  Composite.add(world, ground);
}
function addStructure(baseX, parts){
  for(const p of parts){
    const m = MATERIALS[p.t];
    const x = baseX + (p.dx||0);
    const y = (GROUND_Y - p.h/2) + (p.dy||0);
    const b = Bodies.rectangle(x, y, p.w, p.h, {
      density:m.density, friction:0.6, frictionStatic:0.8, restitution:0.05,
      label:'block'
    });
    b.mat = p.t; b.hp = m.hp; b.maxhp = m.hp; b.bw = p.w; b.bh = p.h;
    blocks.push(b); Composite.add(world, b);
  }
}
function addPig(x, y){
  const r = 26;
  const b = Bodies.circle(x, y, r, { density:0.0012, friction:0.6, restitution:0.2, label:'pig' });
  b.hp = 45; b.maxhp = 45; b.r = r;
  pigs.push(b); Composite.add(world, b);
}
const BIRD_TYPES = {
  red:    { r:22, color:'#d62b1f', belly:'#f0776b', density:0.0028 },
  yellow: { r:20, color:'#f4c542', belly:'#fce39a', density:0.0030 },
  blue:   { r:16, color:'#4aa3e0', belly:'#bfe3f7', density:0.0024 },
  black:  { r:23, color:'#2b2b2b', belly:'#555555', density:0.0034 },
};
function makeBird(type, x, y){
  const t = BIRD_TYPES[type] || BIRD_TYPES.red;
  const b = Bodies.circle(x, y, t.r, { density:t.density, friction:0.5, restitution:0.35, label:'bird' });
  b.btype = type; b.r = t.r; b.launched = false; b.dead = false; b.abilityUsed = false;
  return b;
}

// ---------- Level control ----------
function loadLevel(i){
  World.clear(world, false); Engine.clear(engine);
  blocks = []; pigs = []; birds = []; particles = []; slingBird = null;
  launched = false; dragging = false; cam.x = 0; cam.tx = 0; shake = 0;
  timeScale = 1; slowmoT = 0;
  makeSpeckles();
  addGroundAndSling();
  const queue = LEVELS()[i]();
  birds = queue.map(t => makeBird(t, 0, 0)); // positions set in loadNextBird
  state = 'aim';
  score = 0;
  loadNextBird();
}
function makeSpeckles(){
  speckles = [];
  for(let i=0;i<160;i++){
    speckles.push({ x:-200 + Math.random()*(W+1400), y:GROUND_Y+8+Math.random()*(H-GROUND_Y-10), r:1+Math.random()*2.2, c:Math.random()<0.5?'#5d9433':'#6ca038' });
  }
}
function loadNextBird(){
  const next = birds.find(b => !b.launched && !b.dead && !b.onSling);
  if(!next){
    slingBird = null;
    if(pigs.length > 0) checkEnd();
    return;
  }
  next.onSling = true;
  slingBird = next;
  Body.setStatic(slingBird, true);
  Body.setPosition(slingBird, { x:SLING.x, y:SLING.y });
  Body.setVelocity(slingBird, {x:0,y:0});
  Composite.add(world, slingBird);
  launched = false;
  cam.tx = 0;
}

// ---------- Star rating ----------
const STAR_THRESH = [ [6000,12000,20000], [10000,20000,32000], [15000,28000,45000] ];
function starsFor(sc){
  const t = STAR_THRESH[level] || [8000, 20000, 35000];
  return sc >= t[2] ? 3 : sc >= t[1] ? 2 : sc >= t[0] ? 1 : 0;
}

// ---------- Menu / level select ----------
const LEVEL_BTNS = [];
function buildMenuButtons(){
  LEVEL_BTNS.length = 0;
  const n = LEVELS().length;
  const sz = 130, gap = 40;
  const totalW = n*sz + (n-1)*gap;
  const startX = W/2 - totalW/2;
  const y = H/2 - sz/2 + 20;
  for(let i=0;i<n;i++){
    LEVEL_BTNS.push({ x:startX + i*(sz+gap), y, w:sz, h:sz, level:i });
  }
}
buildMenuButtons();

// ---------- Input ----------
function toWorld(e){
  const r = canvas.getBoundingClientRect();
  const sx = W / r.width, sy = H / r.height;
  const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
  const cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
  return { x: cx * sx + cam.x, y: cy * sy };
}
function toScreen(e){
  const r = canvas.getBoundingClientRect();
  const sx = W / r.width, sy = H / r.height;
  const src = e.touches ? (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0] : e.touches[0]) : e;
  const cx = src.clientX - r.left;
  const cy = src.clientY - r.top;
  return { x: cx * sx, y: cy * sy };
}
// HUD button hitboxes (screen space)
const HUD_MENU_BTN = { x: W/2-60, y: 54, w: 120, h: 34 };
const HUD_SOUND_BTN = { x: W-58, y: 82, w: 44, h: 44 };
function inRect(p, r){ return p.x>=r.x && p.x<=r.x+r.w && p.y>=r.y && p.y<=r.y+r.h; }

function onDown(e){
  ac();
  const sp = toScreen(e);

  // Menu phase
  if(state === 'menu'){
    for(const b of LEVEL_BTNS){ if(inRect(sp, b)){ level = b.level; loadLevel(level); return; } }
    if(inRect(sp, HUD_SOUND_BTN)){ toggleSound(); }
    e.preventDefault(); return;
  }

  // Sound toggle (always available in-game)
  if(inRect(sp, HUD_SOUND_BTN)){ toggleSound(); e.preventDefault(); return; }
  // Menu button
  if(inRect(sp, HUD_MENU_BTN)){ state='menu'; e.preventDefault(); return; }

  if(state === 'win' || state === 'lose'){
    if(state==='win' && level < LEVELS().length-1){ level++; loadLevel(level); }
    else { state='menu'; }
    return;
  }

  // Mid-air ability tap
  if(state === 'fly'){
    const flying = birds.find(b => b.launched && !b.dead);
    if(flying && !flying.abilityUsed){ useAbility(flying); e.preventDefault(); return; }
  }

  if(state !== 'aim' || !slingBird) return;
  const m = toWorld(e);
  const d = Vector.magnitude(Vector.sub(m, SLING));
  if(d < 90){ dragging = true; mouse = m; }
  e.preventDefault();
}
function onMove(e){ if(dragging){ mouse = toWorld(e); e.preventDefault(); } }
function onUp(e){
  if(!dragging || !slingBird) return;
  dragging = false;
  let d = Vector.sub(SLING, mouse);
  const mag = Vector.magnitude(d);
  if(mag < 12){ return; } // too small, keep bird
  if(mag > MAX_PULL){ d = Vector.mult(Vector.normalise(d), MAX_PULL); }
  Body.setStatic(slingBird, false);
  const v = Vector.mult(d, LAUNCH_POWER);
  Body.setVelocity(slingBird, v);
  slingBird.launched = true; slingBird.onSling = false;
  launched = true; launchWatch = 0;
  state = 'fly';
  SFX.launch();
  squash(slingBird);
  const flying = slingBird; slingBird = null;
  cam.tx = clampCam(flying.position.x - 400);
  e.preventDefault();
}
canvas.addEventListener('mousedown', onDown);
window.addEventListener('mousemove', onMove);
window.addEventListener('mouseup', onUp);
canvas.addEventListener('touchstart', onDown, {passive:false});
window.addEventListener('touchmove', onMove, {passive:false});
window.addEventListener('touchend', onUp, {passive:false});

function clampCam(x){ return Math.max(0, Math.min(x, 900)); }

// ---------- Bird abilities ----------
function useAbility(b){
  b.abilityUsed = true;
  const v = b.velocity;
  if(b.btype === 'yellow'){
    Body.setVelocity(b, { x:v.x*1.9, y:v.y*1.9 });
    SFX.dash();
    burst(b.position.x, b.position.y, '#fce39a', 8);
  } else if(b.btype === 'blue'){
    SFX.split();
    const speed = Vector.magnitude(v);
    const ang = Math.atan2(v.y, v.x);
    const offs = [-14, 0, 14].map(d => d*Math.PI/180);
    Body.setVelocity(b, { x:Math.cos(ang)*speed, y:Math.sin(ang)*speed });
    for(const o of offs){
      if(o===0) continue;
      const nb = Bodies.circle(b.position.x, b.position.y, 15, { density:BIRD_TYPES.blue.density, friction:0.5, restitution:0.35, label:'bird' });
      nb.btype='blue'; nb.r=15; nb.launched=true; nb.dead=false; nb.abilityUsed=true; nb.onSling=false;
      Body.setVelocity(nb, { x:Math.cos(ang+o)*speed, y:Math.sin(ang+o)*speed });
      birds.push(nb); Composite.add(world, nb);
    }
    burst(b.position.x, b.position.y, '#bfe3f7', 10);
  } else if(b.btype === 'black'){
    explode(b);
  }
}
function explode(b){
  if(b._exploded) return; b._exploded = true;
  const ex = b.position.x, ey = b.position.y, R = 150;
  SFX.boom();
  burst(ex, ey, '#ff9800', 24); burst(ex, ey, '#ffeb3b', 16); burst(ex, ey, '#444', 12);
  shake = Math.min(shake + 16, 26);
  for(const blk of blocks.slice()){
    const dx = blk.position.x-ex, dy = blk.position.y-ey, dist = Math.hypot(dx,dy);
    if(dist < R){
      const f = (1 - dist/R);
      Body.applyForce(blk, blk.position, { x:(dx/(dist||1))*f*0.6, y:(dy/(dist||1))*f*0.6 - f*0.2 });
      blk.hp -= 90 * f;
      if(blk.hp <= 0) destroyBlock(blk);
    }
  }
  for(const p of pigs.slice()){
    const dx = p.position.x-ex, dy = p.position.y-ey, dist = Math.hypot(dx,dy);
    if(dist < R){
      const f = (1 - dist/R);
      Body.applyForce(p, p.position, { x:(dx/(dist||1))*f*0.6, y:(dy/(dist||1))*f*0.6 - f*0.2 });
      p.hp -= 80 * f;
      if(p.hp <= 0) popPig(p);
    }
  }
  b.dead = true; Composite.remove(world, b);
}

// ---------- Squash / particles ----------
function squash(b){ b._squash = 1; }
function burst(x, y, color, n=10){
  for(let i=0;i<n;i++){
    const a = Math.random()*Math.PI*2, s = 2+Math.random()*5;
    particles.push({ x, y, vx:Math.cos(a)*s, vy:Math.sin(a)*s-2, life:1, color, r:2+Math.random()*3 });
  }
}
function dustPuff(x, y){
  for(let i=0;i<8;i++){
    const a = Math.random()*Math.PI*2, s = 0.5+Math.random()*2;
    particles.push({ x, y, vx:Math.cos(a)*s, vy:Math.sin(a)*s-1, life:0.8, color:'rgba(200,190,170,0.8)', r:3+Math.random()*4 });
  }
}
function popPig(p){
  burst(p.position.x, p.position.y, '#7cb342', 16);
  burst(p.position.x, p.position.y, '#ffffff', 6);
  SFX.oink();
  Composite.remove(world, p);
  pigs = pigs.filter(x => x !== p);
  score += 5000;
  shake = Math.min(shake + 8, 16);
  // slow-mo on final pig kill
  if(pigs.length === 0){ slowmoT = 450; }
}
function destroyBlock(b){
  const m = MATERIALS[b.mat];
  burst(b.position.x, b.position.y, m.color, 12);
  m.sfx();
  Composite.remove(world, b);
  blocks = blocks.filter(x => x !== b);
  score += 500;
  shake = Math.min(shake + 4, 12);
}

// ---------- Damage on collision ----------
Events.on(engine, 'collisionStart', ev => {
  for(const pair of ev.pairs){
    const a = pair.bodyA, b = pair.bodyB;
    const rel = Vector.magnitude(Vector.sub(a.velocity, b.velocity));
    if(rel < 3) continue;
    // black bird explodes on hard impact
    [a,b].forEach(body => {
      if(body.label==='bird' && body.btype==='black' && !body.abilityUsed && body.launched && !body.dead && rel>7){
        body.abilityUsed = true; explode(body);
      }
    });
    const dmg = rel * rel * 0.9;
    [a,b].forEach(body => {
      if(body.label === 'block'){
        body.hp -= dmg * 0.5;
        if(rel > 6){ MATERIALS[body.mat].sfx(); }
        if(rel > 9) dustPuff(body.position.x, body.position.y);
        if(body.hp <= 0) destroyBlock(body);
      } else if(body.label === 'pig'){
        body.hp -= dmg * 0.6;
        if(body.hp <= 0) popPig(body);
        else if(rel > 8) SFX.oink();
      }
    });
    if((a.label==='block'||b.label==='block') && rel>7) shake=Math.min(shake+2,10);
  }
});

// ---------- End conditions ----------
function checkEnd(){
  if(state==='win'||state==='lose'||state==='menu') return;
  if(pigs.length === 0){
    const left = birds.filter(x => !x.launched && !x.dead).length;
    score += left * 10000;
    state = 'win'; SFX.cheer(); starBurst();
    if(score > getBest(level)) setBest(level, score);
    setStars(level, starsFor(score));
  } else {
    const anyLeft = slingBird || birds.some(x => !x.launched && !x.dead);
    if(!anyLeft){ state = 'lose'; SFX.fail(); }
  }
}
function starBurst(){ for(let i=0;i<40;i++){ const a=Math.random()*Math.PI*2,s=3+Math.random()*6; particles.push({x:W/2+cam.x,y:H/2,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1.4,color:['#ffd54f','#fff59d','#ffb300'][i%3],r:3+Math.random()*4}); } }

// ---------- Update loop ----------
let last = performance.now();
function update(now){
  let dt = Math.min(33, now - last); last = now;

  if(state === 'menu'){ render(); requestAnimationFrame(update); return; }

  // slow-motion handling
  if(slowmoT > 0){ slowmoT -= dt; timeScale += (0.35 - timeScale)*0.2; }
  else { timeScale += (1 - timeScale)*0.15; }

  Engine.update(engine, dt * timeScale);
  cam.x += (cam.tx - cam.x) * 0.08;
  if(shake > 0) shake *= 0.9;

  // particles
  for(const p of particles){ p.x+=p.vx; p.y+=p.vy; p.vy+=0.25; p.life-=0.02; }
  particles = particles.filter(p => p.life > 0);

  // squash relax
  for(const b of birds){ if(b._squash) b._squash *= 0.85; }

  // flight resolution
  if(state === 'fly'){
    launchWatch += dt;
    const flying = birds.find(b => b.launched && !b.dead);
    if(flying){
      cam.tx = clampCam(flying.position.x - 400);
      const slow = Vector.magnitude(flying.velocity) < 0.6;
      const off = flying.position.y > H + 200 || flying.position.x > W + 400 || flying.position.x < -200;
      if(off){ flying.dead = true; Composite.remove(world, flying); }
      if((slow && launchWatch > 900) || off){
        if(!off){ flying.dead = true; }
        state = 'aim';
        cam.tx = 0;
        if(pigs.length === 0){ checkEnd(); }
        else { loadNextBird(); if(!slingBird) checkEnd(); }
      }
    } else {
      state = 'aim';
      if(pigs.length===0) checkEnd(); else { loadNextBird(); if(!slingBird) checkEnd(); }
    }
  }
  if(pigs.length === 0 && state !== 'win' && state !== 'menu') checkEnd();

  render();
  requestAnimationFrame(update);
}

// ---------- Rendering ----------
function render(){
  if(state === 'menu'){ drawMenu(); return; }
  ctx.save();
  const sx = (shake>0.4)?(Math.random()-0.5)*shake:0;
  const sy = (shake>0.4)?(Math.random()-0.5)*shake:0;
  ctx.clearRect(0,0,W,H);
  drawSky();
  ctx.translate(-cam.x + sx, sy);
  drawHills();
  drawSpeckles();
  drawSlingBack();
  for(const b of blocks) drawBlock(b);
  for(const p of pigs) drawPig(p);
  for(const b of birds){ if((b.onSling || b.launched) && !b.dead) drawBird(b); }
  drawSlingFront();
  drawTrajectory();
  drawParticles();
  ctx.restore();
  drawHUD();
}

function drawSky(){
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#8ec7f0'); g.addColorStop(0.6,'#bfe3f7'); g.addColorStop(1,'#e8f6ff');
  ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  const cl = [[200,110,60],[520,80,45],[880,140,70],[1180,100,50],[1500,120,60]];
  for(const [x,y,r] of cl){ cloud(x - cam.x*0.3, y, r); }
}
function cloud(x,y,r){ ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.arc(x+r,y+8,r*0.8,0,7); ctx.arc(x-r,y+10,r*0.7,0,7); ctx.arc(x+r*0.4,y-r*0.5,r*0.7,0,7); ctx.fill(); }

function drawHills(){
  ctx.fillStyle = '#8bc34a';
  ctx.beginPath(); ctx.moveTo(-200, GROUND_Y);
  for(let x=-200;x<=W+900;x+=40){ ctx.lineTo(x, GROUND_Y - 30*Math.sin(x*0.004) - 10); }
  ctx.lineTo(W+900, H); ctx.lineTo(-200, H); ctx.fill();
  ctx.fillStyle = '#7cb342'; ctx.fillRect(-200, GROUND_Y, W+1200, H-GROUND_Y);
  ctx.fillStyle = '#5d9433'; ctx.fillRect(-200, GROUND_Y, W+1200, 10);
  ctx.strokeStyle='#5d9433'; ctx.lineWidth=3;
  for(let x=-200;x<W+900;x+=26){ ctx.beginPath(); ctx.moveTo(x,GROUND_Y); ctx.lineTo(x+4,GROUND_Y-10); ctx.stroke(); }
}
function drawSpeckles(){
  for(const s of speckles){ ctx.fillStyle=s.c; ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,7); ctx.fill(); }
}
function shadowEllipse(x, w){
  ctx.fillStyle='rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.ellipse(x, GROUND_Y-2, w, 6, 0, 0, 7); ctx.fill();
}

function drawSlingBack(){
  ctx.strokeStyle='#5a3a1a'; ctx.lineWidth=10; ctx.lineCap='round';
  if(slingBird){
    ctx.beginPath(); ctx.moveTo(SLING.x-16, SLING.y-6);
    ctx.lineTo(slingBird.position.x, slingBird.position.y); ctx.stroke();
  }
}
function drawSlingFront(){
  ctx.strokeStyle='#7a4a1e'; ctx.lineCap='round';
  ctx.lineWidth=16;
  ctx.beginPath(); ctx.moveTo(SLING.x, GROUND_Y); ctx.lineTo(SLING.x, SLING.y-4); ctx.stroke();
  ctx.lineWidth=12;
  ctx.beginPath(); ctx.moveTo(SLING.x, SLING.y+6); ctx.lineTo(SLING.x-18, SLING.y-14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(SLING.x, SLING.y+6); ctx.lineTo(SLING.x+18, SLING.y-14); ctx.stroke();
  if(slingBird){
    ctx.strokeStyle='#5a3a1a'; ctx.lineWidth=10;
    ctx.beginPath(); ctx.moveTo(SLING.x+16, SLING.y-6);
    ctx.lineTo(slingBird.position.x, slingBird.position.y); ctx.stroke();
  }
}

function drawTrajectory(){
  if(!dragging || !slingBird) return;
  let d = Vector.sub(SLING, mouse);
  const mag = Vector.magnitude(d);
  if(mag > MAX_PULL) d = Vector.mult(Vector.normalise(d), MAX_PULL);
  const bx = SLING.x - d.x, by = SLING.y - d.y;
  Body.setPosition(slingBird, { x:bx, y:by });
  let vx = d.x * LAUNCH_POWER, vy = d.y * LAUNCH_POWER;
  let px = bx, py = by;
  ctx.fillStyle='rgba(255,255,255,.75)';
  for(let i=0;i<32;i++){
    px += vx; py += vy; vy += 1*0.5;
    if(i%2===0){ ctx.beginPath(); ctx.arc(px,py,3.5 - i*0.06,0,7); ctx.fill(); }
    if(py > GROUND_Y) break;
  }
}

function drawBlock(b){
  const m = MATERIALS[b.mat];
  ctx.save();
  ctx.translate(b.position.x, b.position.y); ctx.rotate(b.angle);
  const w=b.bw, h=b.bh;
  const dmg = 1 - b.hp/b.maxhp;
  ctx.fillStyle = m.color;
  roundRect(-w/2,-h/2,w,h,4); ctx.fill();
  ctx.strokeStyle = m.dark; ctx.lineWidth=2;
  if(b.mat==='wood'){
    for(let i=1;i<3;i++){ ctx.beginPath(); ctx.moveTo(-w/2+4, -h/2 + i*h/3); ctx.lineTo(w/2-4, -h/2+i*h/3); ctx.stroke(); }
  } else if(b.mat==='ice'){
    ctx.globalAlpha=0.5; ctx.fillStyle='#fff'; roundRect(-w/2+3,-h/2+3,w*0.3,h*0.5,3); ctx.fill(); ctx.globalAlpha=1;
  } else {
    ctx.fillStyle=m.dark; for(let i=0;i<3;i++){ ctx.beginPath(); ctx.arc(-w/4+i*w/4,0,2,0,7); ctx.fill(); }
  }
  ctx.strokeStyle='rgba(0,0,0,.25)'; ctx.lineWidth=2; roundRect(-w/2,-h/2,w,h,4); ctx.stroke();
  if(dmg>0.4){ ctx.strokeStyle='rgba(0,0,0,.4)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(-w/4,-h/2); ctx.lineTo(0,0); ctx.lineTo(w/6,h/2); ctx.stroke(); }
  ctx.restore();
}

function drawPig(p){
  const r=p.r, x=p.position.x, y=p.position.y;
  shadowEllipse(x, r*0.9);
  ctx.save(); ctx.translate(x,y);
  const dmg = 1 - p.hp/p.maxhp;
  ctx.fillStyle = dmg>0.5 ? '#8fbf5a' : '#7cb342';
  ctx.beginPath(); ctx.arc(0,0,r,0,7); ctx.fill();
  ctx.fillStyle='#6ca038';
  ctx.beginPath(); ctx.arc(-r*0.6,-r*0.7,r*0.28,0,7); ctx.arc(r*0.6,-r*0.7,r*0.28,0,7); ctx.fill();
  ctx.fillStyle='#8bc34a'; ctx.beginPath(); ctx.ellipse(0,r*0.15,r*0.5,r*0.4,0,0,7); ctx.fill();
  ctx.fillStyle='#5d8a2e'; ctx.beginPath(); ctx.arc(-r*0.18,r*0.15,r*0.09,0,7); ctx.arc(r*0.18,r*0.15,r*0.09,0,7); ctx.fill();
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(-r*0.32,-r*0.2,r*0.26,0,7); ctx.arc(r*0.32,-r*0.2,r*0.26,0,7); ctx.fill();
  ctx.fillStyle='#222'; ctx.beginPath(); ctx.arc(-r*0.28,-r*0.2,r*0.12,0,7); ctx.arc(r*0.36,-r*0.2,r*0.12,0,7); ctx.fill();
  if(dmg>0.4){ ctx.strokeStyle='#3c5a1e'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(-r*0.6,-r*0.55); ctx.lineTo(-r*0.1,-r*0.4); ctx.moveTo(r*0.6,-r*0.55); ctx.lineTo(r*0.1,-r*0.4); ctx.stroke(); }
  ctx.restore();
}

function drawBird(b){
  const t = BIRD_TYPES[b.btype]||BIRD_TYPES.red;
  const r=b.r, x=b.position.x, y=b.position.y;
  if(b.launched || b.onSling) shadowEllipse(x, r*0.8);
  ctx.save(); ctx.translate(x,y);
  const sq = b._squash||0; ctx.scale(1+sq*0.3, 1-sq*0.3);
  ctx.rotate(b.angle*0.4);
  ctx.fillStyle=t.color; ctx.beginPath(); ctx.arc(0,0,r,0,7); ctx.fill();
  ctx.fillStyle=t.belly; ctx.beginPath(); ctx.ellipse(0,r*0.35,r*0.55,r*0.45,0,0,7); ctx.fill();
  // tail
  ctx.fillStyle = b.btype==='black' ? '#111' : (b.btype==='yellow' ? '#d99e12' : (b.btype==='blue'?'#2c7cb5':'#7a1a12'));
  ctx.beginPath(); ctx.moveTo(-r,0); ctx.lineTo(-r*1.5,-r*0.4); ctx.lineTo(-r*1.5,r*0.4); ctx.fill();
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(r*0.15,-r*0.25,r*0.32,0,7); ctx.arc(r*0.6,-r*0.25,r*0.28,0,7); ctx.fill();
  ctx.fillStyle='#222'; ctx.beginPath(); ctx.arc(r*0.28,-r*0.25,r*0.13,0,7); ctx.arc(r*0.62,-r*0.25,r*0.12,0,7); ctx.fill();
  ctx.strokeStyle= b.btype==='yellow' ? '#8a5f05' : '#3a0d08'; ctx.lineWidth=r*0.18; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-r*0.1,-r*0.65); ctx.lineTo(r*0.5,-r*0.4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(r*0.55,-r*0.6); ctx.lineTo(r*0.85,-r*0.45); ctx.stroke();
  ctx.fillStyle='#f5a623'; ctx.beginPath(); ctx.moveTo(r*0.8,-r*0.05); ctx.lineTo(r*1.35,r*0.08); ctx.lineTo(r*0.8,r*0.25); ctx.fill();
  ctx.fillStyle='#e08e0b'; ctx.beginPath(); ctx.moveTo(r*0.8,r*0.12); ctx.lineTo(r*1.2,r*0.2); ctx.lineTo(r*0.8,r*0.32); ctx.fill();
  // fuse for black
  if(b.btype==='black'){ ctx.strokeStyle='#c98'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(0,-r); ctx.quadraticCurveTo(r*0.3,-r*1.4,r*0.5,-r*1.3); ctx.stroke(); ctx.fillStyle='#ff5722'; ctx.beginPath(); ctx.arc(r*0.5,-r*1.3,2.5,0,7); ctx.fill(); }
  ctx.restore();
}

function drawParticles(){
  for(const p of particles){
    ctx.globalAlpha = Math.max(0,p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,7); ctx.fill();
  }
  ctx.globalAlpha=1;
}

function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

// ---------- HUD ----------
function drawHUD(){
  ctx.fillStyle='#fff'; ctx.strokeStyle='rgba(0,0,0,.35)'; ctx.lineWidth=4;
  ctx.font='bold 34px Trebuchet MS'; ctx.textAlign='right';
  ctx.strokeText(String(score).padStart(6,'0'), W-24, 46);
  ctx.fillText(String(score).padStart(6,'0'), W-24, 46);
  // best
  ctx.font='bold 16px Trebuchet MS';
  const bestTxt = 'BEST '+String(getBest(level)).padStart(6,'0');
  ctx.strokeText(bestTxt, W-24, 68); ctx.fillText(bestTxt, W-24, 68);

  ctx.textAlign='left';
  const remaining = birds.filter(b => !b.launched && !b.dead && b !== slingBird);
  let bx = 40;
  for(const b of remaining){ miniBird(bx, 44, b.btype); bx += 34; }

  ctx.fillStyle='#fff'; ctx.font='bold 18px Trebuchet MS'; ctx.textAlign='center';
  ctx.strokeText('LEVEL '+(level+1), W/2, 34); ctx.fillText('LEVEL '+(level+1), W/2, 34);

  // MENU button
  drawHudButton(HUD_MENU_BTN, 'MENU');
  // sound toggle button
  drawSoundButton();

  if(state==='win') overlay('LEVEL CLEARED!', '#ffd54f');
  if(state==='lose') overlay('TRY AGAIN', '#ff7043');
}
function drawHudButton(r, label){
  ctx.fillStyle='rgba(0,0,0,0.35)'; roundRect(r.x, r.y, r.w, r.h, 8); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=2; roundRect(r.x, r.y, r.w, r.h, 8); ctx.stroke();
  ctx.fillStyle='#fff'; ctx.font='bold 16px Trebuchet MS'; ctx.textAlign='center';
  ctx.fillText(label, r.x + r.w/2, r.y + r.h/2 + 6);
}
function drawSoundButton(){
  const r = HUD_SOUND_BTN;
  ctx.fillStyle='rgba(0,0,0,0.35)'; roundRect(r.x, r.y, r.w, r.h, 8); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=2; roundRect(r.x, r.y, r.w, r.h, 8); ctx.stroke();
  const cx = r.x+16, cy = r.y+r.h/2;
  ctx.fillStyle='#fff';
  ctx.beginPath(); ctx.moveTo(cx-6,cy-4); ctx.lineTo(cx-2,cy-4); ctx.lineTo(cx+3,cy-9); ctx.lineTo(cx+3,cy+9); ctx.lineTo(cx-2,cy+4); ctx.lineTo(cx-6,cy+4); ctx.closePath(); ctx.fill();
  if(soundOn){
    ctx.strokeStyle='#fff'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(cx+3, cy, 9, -0.6, 0.6); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx+3, cy, 14, -0.6, 0.6); ctx.stroke();
  } else {
    ctx.strokeStyle='#ff6b6b'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(cx+8,cy-7); ctx.lineTo(cx+18,cy+7); ctx.moveTo(cx+18,cy-7); ctx.lineTo(cx+8,cy+7); ctx.stroke();
  }
}
function miniBird(x,y,type){
  const t = BIRD_TYPES[type]||BIRD_TYPES.red;
  ctx.fillStyle=t.color; ctx.beginPath(); ctx.arc(x,y,12,0,7); ctx.fill();
  ctx.strokeStyle= type==='yellow'?'#8a5f05':'#3a0d08'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(x-3,y-6); ctx.lineTo(x+6,y-2); ctx.stroke();
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(x+3,y-2,4,0,7); ctx.fill();
  ctx.fillStyle='#222'; ctx.beginPath(); ctx.arc(x+4,y-2,2,0,7); ctx.fill();
  ctx.fillStyle='#f5a623'; ctx.beginPath(); ctx.moveTo(x+9,y); ctx.lineTo(x+16,y+2); ctx.lineTo(x+9,y+5); ctx.fill();
}

function overlay(text, color){
  ctx.fillStyle='rgba(0,0,0,.45)'; ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';
  const s = state==='win' ? starsFor(score) : 0;
  for(let i=0;i<3;i++){ drawStar(W/2 + (i-1)*90, H/2-70, 34, i < s ? '#ffd54f' : 'rgba(255,255,255,.25)'); }
  ctx.fillStyle=color; ctx.font='bold 56px Trebuchet MS';
  ctx.strokeStyle='rgba(0,0,0,.4)'; ctx.lineWidth=6;
  ctx.strokeText(text, W/2, H/2+20); ctx.fillText(text, W/2, H/2+20);
  ctx.fillStyle='#fff'; ctx.font='22px Trebuchet MS';
  ctx.fillText('Score: '+score, W/2, H/2+64);
  ctx.fillText(state==='win' ? (level<LEVELS().length-1 ? 'Click to continue' : 'Click for menu') : 'Click to retry (MENU to exit)', W/2, H/2+100);
}
function drawStar(cx,cy,r,color){
  ctx.fillStyle=color; ctx.beginPath();
  for(let i=0;i<10;i++){ const a=Math.PI/5*i - Math.PI/2; const rr = i%2? r*0.45 : r; ctx.lineTo(cx+Math.cos(a)*rr, cy+Math.sin(a)*rr); }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.3)'; ctx.lineWidth=2; ctx.stroke();
}

// ---------- Menu screen ----------
function drawMenu(){
  ctx.clearRect(0,0,W,H);
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#8ec7f0'); g.addColorStop(0.6,'#bfe3f7'); g.addColorStop(1,'#e8f6ff');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(255,255,255,.85)';
  cloud(300,120,60); cloud(760,90,50); cloud(1050,150,70);
  // ground strip
  ctx.fillStyle='#7cb342'; ctx.fillRect(0, H-90, W, 90);
  ctx.fillStyle='#5d9433'; ctx.fillRect(0, H-90, W, 8);

  // title
  ctx.textAlign='center';
  ctx.fillStyle='#d62b1f'; ctx.strokeStyle='#7a1a12'; ctx.lineWidth=8;
  ctx.font='bold 92px Trebuchet MS';
  ctx.strokeText('ANGRY BIRDS', W/2, 150); ctx.fillText('ANGRY BIRDS', W/2, 150);
  ctx.fillStyle='#333'; ctx.font='22px Trebuchet MS';
  ctx.fillText('Select a level', W/2, 200);

  // level buttons
  for(const b of LEVEL_BTNS){
    ctx.fillStyle='#f4c542'; ctx.strokeStyle='#8a5f05'; ctx.lineWidth=4;
    roundRect(b.x, b.y, b.w, b.h, 18); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#fff'; roundRect(b.x+8, b.y+8, b.w-16, b.h-40, 12); ctx.fill();
    ctx.fillStyle='#333'; ctx.font='bold 54px Trebuchet MS'; ctx.textAlign='center';
    ctx.fillText(String(b.level+1), b.x+b.w/2, b.y+b.h/2+2);
    // stars
    const st = getStars(b.level);
    for(let i=0;i<3;i++){ drawStar(b.x + b.w/2 + (i-1)*26, b.y+b.h-18, 11, i<st?'#ffd54f':'rgba(0,0,0,.15)'); }
  }
  // sound toggle also on menu (top-right)
  drawSoundButton();
}

// ---------- Boot ----------
state = 'menu';
requestAnimationFrame(update);
})();
