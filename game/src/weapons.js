// weapons.js — the player's arsenal: firing, reloading, recoil/spread, bullet
// hit detection (headshot vs body), weapon switching and frag grenades.
import * as THREE from "three";
import { S, curAmmo } from "./state.js";
import { WEAPONS, HEADSHOT_MULT, GRENADE_DAMAGE, GRENADE_RADIUS, GRENADE_FUSE, GRENADE_THROW, GRENADE_UP, GRAVITY, ECON, BOT } from "./config.js";
import { blocked } from "./collision.js";
import { input } from "./input.js";
import { sfx } from "./audio.js";
import { removeBot, hasLOS } from "./bots.js";

const SWITCH_KEYS = { Digit1: "falcon", Digit2: "wasp", Digit3: "nightwing", Digit4: "mantis" };

// Preallocated ray/vector scratch — no allocations in the fire hot path.
const _ray = new THREE.Raycaster();
const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();

export function update(dt) {
  if (S.phase !== "live") return;
  const p = S.player;
  if (!p || !p.alive) return;

  // Weapon switching.
  for (const code of Object.keys(SWITCH_KEYS)) {
    if (input.hit(code)) switchWeapon(SWITCH_KEYS[code]);
  }
  if (input.hit("KeyR")) startReload();
  if (input.hit("KeyG")) throwGrenade();

  // Sustained-fire recoil decays over time.
  S.heat = Math.max(0, S.heat - dt * 1.6);
  if (S.fireCooldown > 0) S.fireCooldown -= dt;

  // Auto-fire while the trigger is held.
  if (input.firing) tryFire();

  // Reload progress.
  if (S.reloading) {
    S.reloadT -= dt;
    if (S.reloadT <= 0) finishReload();
  }
}

export function switchWeapon(id) {
  if (!S.owned.has(id) || id === S.weapon) return;
  S.weapon = id;
  S.reloading = false;
  S.reloadT = 0;
  S.heat = 0;
}

export function startReload() {
  const w = WEAPONS[S.weapon];
  const a = curAmmo();
  if (S.reloading || a.mag >= w.mag || a.reserve <= 0) return;
  S.reloading = true;
  S.reloadT = w.reload;
}

function finishReload() {
  const w = WEAPONS[S.weapon];
  const a = curAmmo();
  const need = w.mag - a.mag;
  const take = Math.min(need, a.reserve);
  a.mag += take;
  a.reserve -= take;
  S.reloading = false;
  sfx("reload");
}

function eyeHeight(p) {
  return p.crouch ? 1.05 : 1.62;
}

// Aim direction from the player's yaw/pitch, with a random spread cone.
function aimDir(spread) {
  const p = S.player;
  const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw);
  const cp = Math.cos(p.pitch), sp_ = Math.sin(p.pitch);
  _dir.set(
    -sy * cp + (Math.random() - 0.5) * spread,
    cy * sp_ + (Math.random() - 0.5) * spread,
    -cy * cp + (Math.random() - 0.5) * spread
  );
  _dir.normalize();
  return _dir;
}

function tryFire() {
  const p = S.player;
  if (!p || !p.alive) return;
  const w = WEAPONS[S.weapon];
  if (S.reloading || S.fireCooldown > 0) return;
  const a = curAmmo();

  if (a.mag <= 0) {
    S.fireCooldown = 0.15;
    sfx("dry");
    if (a.reserve > 0) startReload();
    return;
  }

  // Consume a round and start the cooldown.
  a.mag--;
  S.fireCooldown = 60 / w.rpm;
  S.recoil = w.recoil;
  S.flash = 9;
  S.heat = Math.min(1, S.heat + (w.auto ? 0.10 : 0.16));
  sfx("shot");

  // Bots hear the shot.
  S.lastNoise = { x: p.x, z: p.z, t: S.time, loud: 34 };

  // Spread: base × movement × crouch × sustained-fire heat.
  const moving = S.moving > 0.3;
  const spread = w.spread * (moving ? 2.4 : 1) * (p.crouch ? 0.6 : 1) * (1 + S.heat * 1.5);

  // Trace the bullet from the eye.
  _origin.set(p.x, eyeHeight(p), p.z);
  _ray.set(_origin, aimDir(spread));
  _ray.far = 120;
  const hits = _ray.intersectObjects(S.scene.children, true);
  for (const h of hits) {
    if (!h.object.userData.hittable) continue; // ground / sky / fx
    const botId = h.object.userData.botId;
    if (botId != null) applyHit(botId, h.object.userData.part);
    break; // the first hittable stops the bullet (obstacle or body)
  }
}

function applyHit(botId, part) {
  const bot = S.bots.find((b) => b.id === botId);
  if (!bot || !bot.alive) return;
  const w = WEAPONS[S.weapon];
  const head = part === "head";
  const dmg = w.dmg * (head ? HEADSHOT_MULT : 1);
  bot.hp -= dmg;
  sfx(head ? "headshot" : "hit", { vol: head ? 0.7 : 0.5 });
  if (bot.hp <= 0) {
    bot.hp = 0;
    removeBot(bot);
    S.money += ECON.kill;
    sfx("kill");
  }
}

// ---------- Grenades ----------
export function throwGrenade() {
  const p = S.player;
  if (!p || !p.alive || S.nades <= 0) return;
  S.nades--;
  sfx("nade");
  const d = aimDir(0);
  const g = {
    x: p.x, y: eyeHeight(p), z: p.z,
    vx: d.x * GRENADE_THROW, vy: d.y * GRENADE_THROW + GRENADE_UP, vz: d.z * GRENADE_THROW,
    fuse: GRENADE_FUSE,
  };
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshLambertMaterial({ color: 0x2a2d31, emissive: 0x441100 })
  );
  mesh.position.set(g.x, g.y, g.z);
  S.scene.add(mesh);
  g.mesh = mesh;
  S.grenades.push(g);
}

export function updateGrenades(dt) {
  for (let i = S.grenades.length - 1; i >= 0; i--) {
    const g = S.grenades[i];
    g.fuse -= dt;
    g.vy += GRAVITY * dt;
    g.x += g.vx * dt;
    g.z += g.vz * dt;
    g.y += g.vy * dt;
    if (g.y < 0.12 && g.vy < 0) {
      g.y = 0.12;
      g.vy = -g.vy * 0.4;
      g.vx *= 0.7; g.vz *= 0.7;
    }
    if (blocked(S.colliders, g.x, g.z, 0.12)) {
      g.x -= g.vx * dt;
      g.z -= g.vz * dt;
      g.vx *= -0.5; g.vz *= -0.5;
    }
    g.mesh.position.set(g.x, g.y, g.z);
    if (g.fuse <= 0) {
      explodeGrenade(g);
      S.scene.remove(g.mesh);
      S.grenades.splice(i, 1);
    }
  }
}

function explodeGrenade(g) {
  sfx("boom");
  S.lastNoise = { x: g.x, z: g.z, t: S.time, loud: 50 };
  spawnFx(g.x, 1.0, g.z);
  for (const bot of S.bots) {
    if (!bot.alive) continue;
    const dx = bot.mesh.position.x - g.x;
    const dz = bot.mesh.position.z - g.z;
    const d = Math.hypot(dx, dz);
    if (d > GRENADE_RADIUS) continue;
    if (!hasLOS(g.x, 1.2, g.z, bot.mesh.position.x, BOT.eye, bot.mesh.position.z)) continue;
    const dmg = GRENADE_DAMAGE * (1 - d / GRENADE_RADIUS);
    bot.hp -= dmg;
    if (bot.hp <= 0) {
      bot.hp = 0;
      removeBot(bot);
      S.money += ECON.kill;
      sfx("kill");
    }
  }
}

// ---------- Explosion visual ----------
function spawnFx(x, y, z) {
  const light = new THREE.PointLight(0xffa040, 80, 18, 2);
  light.position.set(x, y, z);
  S.scene.add(light);
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9 })
  );
  sphere.position.set(x, y, z);
  S.scene.add(sphere);
  S.fx.push({ mesh: sphere, light, t: 0, life: 0.35 });
}

export function updateFx(dt) {
  for (let i = S.fx.length - 1; i >= 0; i--) {
    const f = S.fx[i];
    f.t += dt;
    const k = f.t / f.life;
    f.mesh.scale.setScalar(1 + k * 7);
    f.mesh.material.opacity = 1 - k;
    f.light.intensity = 80 * (1 - k);
    if (f.t >= f.life) {
      S.scene.remove(f.mesh);
      S.scene.remove(f.light);
      S.fx.splice(i, 1);
    }
  }
}
