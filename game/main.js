// OPERATION BLACKOUT — round-based tactical FPS vs bots (three.js 0.187)
// Two teams: VIPERS (player) vs SERPENTS (bots). Rounds, buy menu, accuracy-first gunplay.
import * as THREE from 'three';

// ---------- Audio (synth, no assets) ----------
const AC = new (window.AudioContext || window.webkitAudioContext)();
function sfx(type) {
  if (AC.state === 'suspended') AC.resume();
  const t = AC.currentTime, g = AC.createGain(); g.connect(AC.destination);
  if (type === 'shot') {
    const b = AC.createBuffer(1, 4410, 44100), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const s = AC.createBufferSource(); s.buffer = b;
    const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200;
    s.connect(f); f.connect(g); g.gain.setValueAtTime(.35, t); g.gain.exponentialRampToValueAtTime(.001, t + .1); s.start();
  } else if (type === 'hit') {
    const o = AC.createOscillator(); o.type = 'square'; o.frequency.value = 220;
    o.connect(g); g.gain.setValueAtTime(.15, t); g.gain.exponentialRampToValueAtTime(.001, t + .08); o.start(); o.stop(t + .1);
  } else if (type === 'kill') {
    const o = AC.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(500, t); o.frequency.exponentialRampToValueAtTime(900, t + .15);
    o.connect(g); g.gain.setValueAtTime(.2, t); g.gain.exponentialRampToValueAtTime(.001, t + .2); o.start(); o.stop(t + .25);
  } else if (type === 'round') {
    const o = AC.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(330, t); o.frequency.setValueAtTime(440, t + .15); o.frequency.setValueAtTime(550, t + .3);
    o.connect(g); g.gain.setValueAtTime(.25, t); g.gain.exponentialRampToValueAtTime(.001, t + .5); o.start(); o.stop(t + .55);
  }
}

// ---------- Weapons ----------
const WEAPONS = {
  pistol:     { name: 'SIDEARM',   dmg: 22, rpm: 300, mag: 12, reserve: 36, spread: .010, cost: 0 },
  smg:        { name: 'HORNET',    dmg: 18, rpm: 780, mag: 30, reserve: 90, spread: .028, cost: 1200 },
  rifle:      { name: 'RAPTOR',    dmg: 30, rpm: 600, mag: 30, reserve: 90, spread: .012, cost: 2700 },
  sniper:     { name: 'LONGSHADOW',dmg: 95, rpm: 50,  mag: 5,  reserve: 20, spread: .002, cost: 4750 },
};
const KEVLAR_COST = 650;
const START_MONEY = 800, KILL_REWARD = 300, ROUND_WIN = 3250, ROUND_LOSS = 1400;


// ---------- Procedural textures (canvas, no assets) ----------
function canvasTex(draw, w = 256, h = 256) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const TEX = {};
TEX.ground = canvasTex((g, w, h) => {
  g.fillStyle = '#565b50'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${30+Math.random()*40|0},${32+Math.random()*38|0},${28+Math.random()*30|0},${.25+Math.random()*.3})`;
    g.fillRect(Math.random()*w, Math.random()*h, 2+Math.random()*4, 2+Math.random()*4);
  }
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2;
  for (let i = 0; i <= w; i += 64) { g.beginPath(); g.moveTo(i,0); g.lineTo(i,h); g.moveTo(0,i); g.lineTo(w,i); g.stroke(); }
});
TEX.ground.repeat.set(10, 8);
function containerTex(base) {
  return canvasTex((g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    // vertical corrugation ribs
    for (let x = 0; x < w; x += 16) {
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x, 0, 5, h);
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x + 8, 0, 4, h);
    }
    // grime & rust streaks
    for (let i = 0; i < 26; i++) {
      g.fillStyle = `rgba(${60+Math.random()*60|0},${35+Math.random()*25|0},20,${.1+Math.random()*.25})`;
      g.fillRect(Math.random()*w, Math.random()*h, 3+Math.random()*10, 20+Math.random()*80);
    }
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, w, 10); g.fillRect(0, h-10, w, 10);
  });
}
TEX.wall = canvasTex((g, w, h) => {
  g.fillStyle = '#6e7268'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 600; i++) {
    g.fillStyle = `rgba(${70+Math.random()*40|0},${72+Math.random()*40|0},${64+Math.random()*36|0},.4)`;
    g.fillRect(Math.random()*w, Math.random()*h, 2, 2);
  }
});
TEX.wall.repeat.set(12, 1);

// ---------- Map (own design: "Container Yard") ----------
function buildMap(scene) {
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const gmat = new THREE.MeshLambertMaterial({ map: TEX.ground });
  const wmat = new THREE.MeshLambertMaterial({ map: TEX.wall });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), gmat);
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  // perimeter walls
  const wall = (x, z, w, d, h = 4, c = 0x6b6f66) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wmat);
    m.position.set(x, h / 2, z); scene.add(m); return m;
  };
  wall(0, -30, 80, 1); wall(0, 30, 80, 1); wall(-40, 0, 1, 60); wall(40, 0, 1, 60);
  // shipping containers (cover), red/teal/rust
  const cols = [0xa33b2e, 0x2e6e73, 0x8a6d3b, 0x3d5a3d];
  const boxes = [
    [-14, -12, 8, 3], [12, -10, 10, 3], [-4, -2, 6, 3], [8, 6, 8, 3],
    [-18, 10, 7, 3], [16, 14, 6, 3], [-8, 20, 9, 3], [4, -20, 8, 3],
  ];
  boxes.forEach(([x, z, w, d], i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 2.8, d), new THREE.MeshLambertMaterial({ map: containerTex(cols[i % 4] === 0xa33b2e ? '#a33b2e' : cols[i % 4] === 0x2e6e73 ? '#2e6e73' : cols[i % 4] === 0x8a6d3b ? '#8a6d3b' : '#3d5a3d') }));
    m.position.set(x, 1.4, z); scene.add(m);
  });
  // central tower
  const tower = new THREE.Mesh(new THREE.BoxGeometry(4, 7, 4), mat(0x555c52));
  tower.position.set(0, 3.5, 8); scene.add(tower);
  // lamps
  scene.add(new THREE.HemisphereLight(0xcfd9e2, 0x3a3d34, 1.05));
  const sun = new THREE.DirectionalLight(0xffdca8, 1.15); sun.position.set(25, 35, 12); scene.add(sun);
  scene.add(new THREE.DirectionalLight(0x8899bb, .3));
  // sky
  {const sc=document.createElement('canvas');sc.width=2;sc.height=256;const sg=sc.getContext('2d');
  const gr=sg.createLinearGradient(0,0,0,256);gr.addColorStop(0,'#0d1522');gr.addColorStop(.55,'#1d2c3f');gr.addColorStop(1,'#3a4a55');
  sg.fillStyle=gr;sg.fillRect(0,0,2,256);scene.background=new THREE.CanvasTexture(sc);}
  scene.fog = new THREE.Fog(0x1a2533, 55, 140);
  const colliders = boxes.map(([x, z, w, d]) => ({ min: [x - w / 2, z - d / 2], max: [x + w / 2, z + d / 2] }));
  colliders.push({ min: [-2, 6], max: [2, 10] });
  return colliders;
}

const BLOCKED = (c, x, z) => c.some(b => x > b.min[0] - .5 && x < b.max[0] + .5 && z > b.min[1] - .5 && z < b.max[1] + .5);

// ---------- Bot ----------
function makeBot(team, pos) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({
    color: team === 'SERPENTS' ? 0xd0482e : 0x2e7bb5,
    emissive: team === 'SERPENTS' ? 0x3a0f06 : 0x061a30, emissiveIntensity: 1
  });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.46, 1.25, 6, 12), bodyMat);
  body.position.y = 1.05; g.add(body);
  // chest rig / accent stripe so bots read at distance
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(.62, .22, .5),
    new THREE.MeshLambertMaterial({ color: 0x1a1c1f }));
  stripe.position.y = 1.25; g.add(stripe);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.31, 12, 12),
    new THREE.MeshLambertMaterial({ color: 0xd9c9a8 }));
  head.position.y = 1.85; g.add(head);
  g.position.set(pos[0], 0, pos[1]);
  return { mesh: g, team, hp: 100, alive: true, state: 'patrol', target: null, nextShot: 0, wp: 0, reactAt: 0 };
}

// ---------- Game state ----------
const S = {
  round: 1, phase: 'buy', phaseT: 12, timer: 115,
  score: { VIPERS: 0, SERPENTS: 0 }, money: START_MONEY, kevlar: false,
  weapon: 'pistol', owned: new Set(['pistol']),
  mag: WEAPONS.pistol.mag, reserve: WEAPONS.pistol.reserve,
  lastShot: 0, reloading: false, msg: '', msgT: 0,
};

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, .1, 200);
const colliders = buildMap(scene);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch (e) {
  document.getElementById('msg').textContent = 'WEBGL ERROR: ' + e.message;
  document.getElementById('msg').style.color = '#ff5555';
  throw e;
}
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);
if (!renderer.getContext()) {
  document.getElementById('msg').textContent = 'NO WEBGL CONTEXT';
  document.getElementById('msg').style.color = '#ff5555';
}

// muzzle flash
const flash = new THREE.PointLight(0xffcc66, 0, 12); scene.add(flash);

// ---------- Viewmodel (first-person weapon) ----------
const vmGroup = new THREE.Group();
const gunMat = new THREE.MeshLambertMaterial({ color: 0x2a2d31 });
const gunAccent = new THREE.MeshLambertMaterial({ color: 0x55595f });
const vmBody = new THREE.Mesh(new THREE.BoxGeometry(.10, .12, .52), gunMat);
vmBody.position.set(.20, -.17, -.55); vmGroup.add(vmBody);
const vmBarrel = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .34, 8), gunAccent);
vmBarrel.rotation.x = Math.PI / 2; vmBarrel.position.set(.20, -.155, -.92); vmGroup.add(vmBarrel);
const vmGrip = new THREE.Mesh(new THREE.BoxGeometry(.07, .19, .09), gunMat);
vmGrip.position.set(.20, -.30, -.42); vmGrip.rotation.x = -.25; vmGroup.add(vmGrip);
const vmMag = new THREE.Mesh(new THREE.BoxGeometry(.06, .16, .13), gunAccent);
vmMag.position.set(.20, -.29, -.55); vmGroup.add(vmMag);
const vmSight = new THREE.Mesh(new THREE.BoxGeometry(.03, .06, .05), gunAccent);
vmSight.position.set(.20, -.085, -.70); vmGroup.add(vmSight);
// hands (simple)
const handMat = new THREE.MeshLambertMaterial({ color: 0xb98a63 });
const handR = new THREE.Mesh(new THREE.BoxGeometry(.09, .11, .16), handMat);
handR.position.set(.20, -.27, -.40); vmGroup.add(handR);
camera.add(vmGroup); scene.add(camera);

// player spawn (VIPERS side, south) / bot spawns (north)
const SPAWN_P = [-20, 18], SPAWNS_B = [[-14, -2], [0, -7], [9, -4], [-8, -12], [6, -11]];

let bots = [], player = { hp: 100, alive: true, x: SPAWN_P[0], z: SPAWN_P[1], yaw: 0, pitch: 0, vy: 0, onGround: true };

const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (S.phase === 'buy') buyKey(e.code);
  if (e.code === 'KeyR' && S.phase === 'live') startReload();
  if (e.code === 'KeyB' && S.phase === 'live') openBuy();
});
addEventListener('keyup', e => keys[e.code] = false);
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement && S.phase === 'live') {
    player.yaw -= e.movementX * .0022;
    player.pitch = Math.max(-1.5, Math.min(1.5, player.pitch - e.movementY * .0022));
  }
});
addEventListener('mousedown', () => { if (S.phase === 'live' && !document.pointerLockElement) try{renderer.domElement.requestPointerLock()}catch(e){} else S.firing = true; });
addEventListener('mouseup', () => S.firing = false);

function openBuy() {
  S.phase = 'buy'; S.phaseT = 20;
  document.getElementById('buy').style.display = 'block';
  try{document.exitPointerLock()}catch(e){}
}
function closeBuy() {
  document.getElementById('buy').style.display = 'none';
  S.phase = 'live'; S.timer = 115;
  try{renderer.domElement.requestPointerLock()}catch(e){}
}
function buyKey(code) {
  const map = { Digit1: 'rifle', Digit2: 'smg', Digit3: 'sniper' };
  if (map[code]) {
    const w = WEAPONS[map[code]];
    if (S.money >= w.cost) {
      S.money -= w.cost; S.owned.add(map[code]);
      S.weapon = map[code]; S.mag = w.mag; S.reserve = w.reserve; S.reloading = false;
      flashMsg(w.name + ' EQUIPPED');
    }
  } else if (code === 'Digit4' && !S.kevlar && S.money >= KEVLAR_COST) {
    S.money -= KEVLAR_COST; S.kevlar = true; flashMsg('KEVLAR ON');
  } else if (code === 'KeyB') closeBuy();
}

function startReload() {
  const w = WEAPONS[S.weapon];
  if (S.reloading || S.mag === w.mag || S.reserve === 0) return;
  S.reloading = true; setTimeout(() => {
    const need = w.mag - S.mag, take = Math.min(need, S.reserve);
    S.mag += take; S.reserve -= take; S.reloading = false;
  }, 1400);
}

function flashMsg(m) { S.msg = m; S.msgT = 2.2; }

function startRound() {
  bots.forEach(b => scene.remove(b.mesh));
  if (location.search.includes('demo')) { S.phase = 'live'; S.timer = 60; }
  bots = SPAWNS_B.map(p => { const b = makeBot('SERPENTS', p); scene.add(b.mesh); return b; });
  player = { ...player, hp: 100, alive: true, x: SPAWN_P[0], z: SPAWN_P[1], yaw: 0, pitch: 0 };
  S.phase = 'buy'; S.phaseT = 12; S.timer = 115;
  document.getElementById('buy').style.display = 'block';
  sfx('round');
  if (location.search.includes('demo')) { document.getElementById('buy').style.display='none'; S.phase='live'; S.timer=95; }
}

function endRound(winner) {
  S.score[winner]++;
  S.money += winner === 'VIPERS' ? ROUND_WIN : ROUND_LOSS;
  if (S.score.VIPERS >= 8 || S.score.SERPENTS >= 8) {
    flashMsg(S.score.VIPERS >= 8 ? 'MATCH WON! 🏆' : 'MATCH LOST');
    S.phase = 'over'; try{document.exitPointerLock()}catch(e){}
    return;
  }
  flashMsg(winner === 'VIPERS' ? 'ROUND WON!' : 'ROUND LOST');
  setTimeout(startRound, 2500);
  S.phase = 'inter';
}

function fire() {
  const now = performance.now(), w = WEAPONS[S.weapon];
  if (now - S.lastShot < 60000 / w.rpm || S.reloading || S.mag === 0) return;
  S.lastShot = now; S.mag--; sfx('shot');
  vmKick = .06; vmGroup.position.z += .04;
  flash.position.set(camera.position.x, camera.position.y - .2, camera.position.z);
  flash.intensity = 2; setTimeout(() => flash.intensity = 0, 60);
  // accuracy: spread grows with movement
  const moving = keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD;
  const sp = w.spread * (moving ? 2.2 : 1) * (player.onGround ? 1 : 2.5);
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  dir.x += (Math.random() - .5) * sp * 2; dir.y += (Math.random() - .5) * sp * 2; dir.z += (Math.random() - .5) * sp * 2;
  dir.normalize();
  const ray = new THREE.Raycaster(camera.position.clone(), dir, 0, 100);
  const hits = ray.intersectObjects(scene.children, true)
    .filter(h => h.object !== flash && h.object.parent?.type !== 'Group' || h.object.type === 'Mesh' && h.object.geometry?.type === 'CapsuleGeometry');
  const botHit = hits.find(h => h.object.geometry?.type === 'CapsuleGeometry' || h.object.geometry?.type === 'SphereGeometry');
  if (botHit) {
    const bot = bots.find(b => b.mesh.children.includes(botHit.object));
    if (bot && bot.alive) {
      const dmg = botHit.object.geometry.type === 'SphereGeometry' ? w.dmg * 2.5 : w.dmg; // headshot
      bot.hp -= dmg; sfx('hit');
      if (bot.hp <= 0) { bot.alive = false; scene.remove(bot.mesh); S.money += KILL_REWARD; sfx('kill'); flashMsg('ELIMINATED'); }
    }
  }
}

// ---------- Bot AI ----------
function botThink(b, dt, now) {
  if (!b.alive) return;
  const px = player.x, pz = player.z, bx = b.mesh.position.x, bz = b.mesh.position.z;
  const dist = Math.hypot(px - bx, pz - bz);
  const los = hasLOS(bx, 1.5, bz, px, 1.5, pz);
  if (los && dist < 45 && player.alive) {
    b.state = 'engage';
    if (b.reactAt === 0) b.reactAt = now + 350 + Math.random() * 500; // reaction time — accuracy first
    if (now > b.reactAt) {
      // strafe + shoot with inaccuracy
      b.mesh.position.x += Math.sin(now / 400 + b.wp) * .02;
      if (now > b.nextShot) {
        b.nextShot = now + 400 + Math.random() * 500;
        const acc = Math.max(0, 1 - dist / 50) * .5; // hit chance falls with distance
        if (Math.random() < acc) {
          hurtPlayer(8 + Math.random() * 10);
        }
        sfx('shot');
      }
    }
  } else {
    b.state = 'patrol'; b.reactAt = 0;
    // waypoint patrol
    const t = (now / 3000 + b.wp) % 6.28;
    const cx = 0 - bx, cz = 10 - bz, cl = Math.hypot(cx, cz) || 1;
    const tx = bx + (cx / cl) * .04 + Math.cos(t) * .02, tz = bz + (cz / cl) * .04 + Math.sin(t) * .02;
    if (!BLOCKED(colliders, tx, tz)) { b.mesh.position.x = tx; b.mesh.position.z = tz; }
  }
}

function hasLOS(x1, y1, z1, x2, y2, z2) {
  const dir = new THREE.Vector3(x2 - x1, y2 - y1, z2 - z1), len = dir.length(); dir.normalize();
  const ray = new THREE.Raycaster(new THREE.Vector3(x1, y1, z1), dir, 0, len);
  return ray.intersectObjects(scene.children, true).filter(h => h.object.type === 'Mesh' && h.object.geometry?.type === 'BoxGeometry').length === 0;
}

function hurtPlayer(d) {
  if (!player.alive || S.phase !== 'live') return;
  player.hp -= S.kevlar ? d * .6 : d;
  if (player.hp <= 0) { player.alive = false; flashMsg('YOU DIED'); setTimeout(() => endRound('SERPENTS'), 1200); }
}

// ---------- HUD ----------
const $ = id => document.getElementById(id);
if (location.search.includes('debug')) setInterval(() => {
  let d=document.getElementById('dbg')||(()=>{const e=document.createElement('div');e.id='dbg';document.body.appendChild(e);return e;})();
  d.style.cssText='position:fixed;top:100px;left:10px;color:#0f0;font-size:14px;z-index:99';
  d.textContent = 'BOTS ' + bots.length + ' alive:' + bots.filter(b=>b.alive).map(b=>Math.round(b.mesh.position.x)+','+Math.round(b.mesh.position.z)).join(' ') + ' | P ' + Math.round(player.x)+','+Math.round(player.z)+' | cam z '+Math.round(camera.position.z);
}, 400);
function hud() {
  $('round').textContent = 'ROUND ' + S.round;
  const m = Math.floor(Math.max(0, S.timer) / 60), s = Math.floor(Math.max(0, S.timer) % 60);
  $('timer').textContent = m + ':' + String(s).padStart(2, '0');
  $('timer').style.color = S.timer < 15 ? '#d84a3a' : '#e8e6e3';
  $('score').textContent = `VIPERS ${S.score.VIPERS} — ${S.score.SERPENTS} SERPENTS`;
  $('bottom').textContent = 'HP ' + Math.max(0, Math.ceil(player.hp));
  $('bottom').style.color = player.hp < 30 ? '#d84a3a' : '#e8e6e3';
  $('money').textContent = '$ ' + S.money;
  $('ammo').textContent = S.reloading ? '—' : `${S.mag} / ${S.reserve}`;
  $('msg').textContent = S.msgT > 0 ? S.msg : '';
}

// ---------- Loop ----------
let vmKick = 0;
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (S.msgT > 0) S.msgT -= dt;

  if (S.phase === 'buy') {
    S.phaseT -= dt;
    $('timer').textContent = 'BUY ' + Math.ceil(S.phaseT);
    if (S.phaseT <= 0) closeBuy();
  } else if (S.phase === 'live') {
    S.timer -= dt;
    // player move
    if (player.alive) {
      const sp = 6.2 * dt, f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), r = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
      const nx = player.x + Math.sin(player.yaw) * -f * sp + Math.cos(player.yaw) * r * sp;
      const nz = player.z + Math.cos(player.yaw) * -f * sp - Math.sin(player.yaw) * r * sp;
      if (!BLOCKED(colliders, nx, player.z)) player.x = nx;
      if (!BLOCKED(colliders, player.x, nz)) player.z = nz;
      if (S.firing) fire();
      // reload hint
      if (S.mag === 0 && !S.reloading && S.reserve > 0) startReload();
    }
    bots.forEach(b => botThink(b, dt, now));
    // round end checks
    const left = bots.filter(b => b.alive).length;
    if (left === 0 && player.alive && !location.search.includes('demo')) endRound('VIPERS');
    else if (S.timer <= 0 && !location.search.includes('demo')) endRound(bots.filter(b => b.alive).length > 0 ? 'SERPENTS' : 'VIPERS');
    S.round += (S.phase === 'live' ? 0 : 0);
  }

  // viewmodel recoil recovery + walk bob
  vmKick = Math.max(0, vmKick - dt * .5);
  vmGroup.rotation.x = vmKick;
  const bobT = performance.now() / 220;
  const bobAmt = (keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD) ? 1 : .3;
  vmGroup.position.y = Math.sin(bobT) * .006 * bobAmt;
  vmGroup.position.x = Math.cos(bobT * .5) * .004 * bobAmt;
  if (location.search.includes('aim') && player.alive) {
    let best=null,bd=1e9;
    bots.forEach(b=>{if(!b.alive)return;const d=Math.hypot(b.mesh.position.x-player.x,b.mesh.position.z-player.z);if(d<bd){bd=d;best=b;}});
    if(best){const dx=best.mesh.position.x-player.x,dz=best.mesh.position.z-player.z;
      player.yaw=Math.atan2(-dx,-dz); player.pitch=0;}
  }
  camera.position.set(player.x, player.alive ? 1.62 + Math.sin(bobT) * .012 * bobAmt : .4, player.z);
  camera.rotation.set(0, 0, 0); camera.rotateY(player.yaw); camera.rotateX(player.pitch);
  hud();
  renderer.render(scene, camera);
}
// round counter fix: increment on new round
const _sr = startRound; startRound = function () { S.round++; _sr(); };
startRound();
loop(last);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
