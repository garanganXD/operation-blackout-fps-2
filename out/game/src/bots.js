// bots.js — the WARDENS: creation, routing, perception (sight + hearing) and
// combat AI. Bots patrol routes, hold positions, investigate noise, react to
// what they see, and rush the bomb to defuse it once planted.
import * as THREE from "three";
import { S } from "./state.js";
import { BOT, PLAYER } from "./config.js";
import { blocked } from "./collision.js";
import { hurtPlayer } from "./player.js";
import { sfx } from "./audio.js";

const _ray = new THREE.Raycaster();
const _a = new THREE.Vector3();
const _dir = new THREE.Vector3();

let nextBotId = 0;

export function spawnBots() {
  for (const b of S.bots) S.scene.remove(b.mesh);
  S.bots = [];
  for (const sp of S.map.spawns.bots) {
    const bot = makeBot(sp);
    S.scene.add(bot.mesh);
    S.bots.push(bot);
  }
}

function makeBot(sp) {
  const id = nextBotId++;
  const mesh = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.46, 1.25, 6, 12),
    new THREE.MeshLambertMaterial({ color: 0xd0482e, emissive: 0x3a0f06 })
  );
  body.position.y = 1.05;
  body.userData = { hittable: true, botId: id, part: "body" };
  mesh.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.31, 12, 12),
    new THREE.MeshLambertMaterial({ color: 0xd9c9a8 })
  );
  head.position.y = 1.85;
  head.userData = { hittable: true, botId: id, part: "head" };
  mesh.add(head);

  // Held weapon, offset forward so facing is readable.
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.08, 0.9),
    new THREE.MeshLambertMaterial({ color: 0x1a1c1f })
  );
  gun.position.set(0.2, 1.45, -0.55);
  mesh.add(gun);

  mesh.position.set(sp.pos[0], 0, sp.pos[1]);

  return {
    id, mesh,
    hp: BOT.hp, alive: true,
    role: sp.role,
    route: sp.route != null ? S.map.routes[sp.route] : null,
    wp: 0,
    yaw: Math.PI, // face south, toward the player spawn
    state: sp.role === "hold" ? "hold" : "patrol",
    holdUntil: 0,
    reactUntil: 0,
    nextShot: 0,
    strafeDir: Math.random() < 0.5 ? -1 : 1,
  };
}

export function removeBot(bot) {
  bot.alive = false;
  bot.mesh.visible = false;
}

export function aliveBots() {
  return S.bots.reduce((n, b) => n + (b.alive ? 1 : 0), 0);
}

export function updateBots(dt) {
  for (const bot of S.bots) {
    if (bot.alive) botThink(bot, dt);
  }
}

// Line of sight between two world points, blocked by solid geometry.
export function hasLOS(x1, y1, z1, x2, y2, z2) {
  _a.set(x1, y1, z1);
  _dir.set(x2 - x1, y2 - y1, z2 - z1);
  const len = _dir.length();
  if (len < 0.01) return true;
  _dir.normalize();
  _ray.set(_a, _dir);
  _ray.far = len - 0.1;
  return _ray.intersectObjects(S.losBlockers, false).length === 0;
}

function botThink(bot, dt) {
  const p = S.player;
  const bx = bot.mesh.position.x, bz = bot.mesh.position.z;
  const px = p.x, pz = p.z;
  const dist = p.alive ? Math.hypot(px - bx, pz - bz) : Infinity;

  // Defuse the bomb if it is planted (highest priority).
  if (S.bomb === "planted") {
    const [tx, tz] = S.map.site.bombPos;
    const dSite = Math.hypot(tx - bx, tz - bz);
    if (dSite < 1.6) {
      bot.state = "defuse";
      bot.yaw = Math.atan2(-(tx - bx), -(tz - bz));
      bot.mesh.rotation.y = bot.yaw;
    } else if (p.alive && S.phase === "live" && canSee(bot, bx, bz, px, pz, dist)) {
      bot.state = "engage";
      engage(bot, dt, dist);
    } else {
      bot.state = "defuse";
      moveToward(bot, tx, tz, BOT.engageSpeed, dt);
    }
    return;
  }

  // Engage a visible player.
  if (p.alive && S.phase === "live" && canSee(bot, bx, bz, px, pz, dist)) {
    bot.state = "engage";
    engage(bot, dt, dist);
    return;
  }
  bot.reactUntil = 0; // lost sight → reset reaction

  // Investigate recent noise.
  if (hearNoise(bot, bx, bz)) {
    bot.state = "investigate";
    const reached = moveToward(bot, S.lastNoise.x, S.lastNoise.z, BOT.engageSpeed, dt);
    if (reached) {
      S.lastNoise.t = -1e9;
      bot.state = bot.role === "hold" ? "hold" : "patrol";
    }
    return;
  }

  // Default: hold position or patrol a route.
  if (bot.role === "hold") {
    bot.state = "hold";
    holdBot(bot);
  } else {
    bot.state = "patrol";
    patrolBot(bot, dt);
  }
}

function canSee(bot, bx, bz, px, pz, dist) {
  if (dist > BOT.sightRange) return false;
  const dx = px - bx, dz = pz - bz;
  const inv = 1 / (dist || 1);
  const dot = (-Math.sin(bot.yaw) * dx + -Math.cos(bot.yaw) * dz) * inv;
  if (dot < Math.cos(BOT.fovHalf) && dist > 8) return false; // outside cone
  const pey = S.player.crouch ? PLAYER.crouchEye : PLAYER.eyeHeight;
  return hasLOS(bx, BOT.eye, bz, px, pey, pz);
}

function hearNoise(bot, bx, bz) {
  const n = S.lastNoise;
  if (S.time - n.t > 2.0) return false;
  return Math.hypot(n.x - bx, n.z - bz) < n.loud;
}

function engage(bot, dt, dist) {
  const p = S.player;
  const bx = bot.mesh.position.x, bz = bot.mesh.position.z;
  const dx = p.x - bx, dz = p.z - bz;
  bot.yaw = Math.atan2(-dx, -dz);
  bot.mesh.rotation.y = bot.yaw;

  if (bot.reactUntil === 0) {
    bot.reactUntil = S.time + BOT.reactMin + Math.random() * (BOT.reactMax - BOT.reactMin);
  }
  if (S.time < bot.reactUntil) return;

  // Strafe perpendicular to the aim line.
  const rightX = Math.cos(bot.yaw), rightZ = -Math.sin(bot.yaw);
  const nx = bx + rightX * bot.strafeDir * BOT.strafe * dt;
  const nz = bz + rightZ * bot.strafeDir * BOT.strafe * dt;
  if (blocked(S.colliders, nx, bz, BOT.radius)) bot.strafeDir *= -1;
  else bot.mesh.position.x = nx;
  if (blocked(S.colliders, bot.mesh.position.x, nz, BOT.radius)) bot.strafeDir *= -1;
  else bot.mesh.position.z = nz;

  // Close distance when far away.
  if (dist > 20) {
    const fx = -Math.sin(bot.yaw) * BOT.engageSpeed * dt;
    const fz = -Math.cos(bot.yaw) * BOT.engageSpeed * dt;
    const mx = bot.mesh.position.x + fx;
    const mz = bot.mesh.position.z + fz;
    if (!blocked(S.colliders, mx, bot.mesh.position.z, BOT.radius)) bot.mesh.position.x = mx;
    if (!blocked(S.colliders, bot.mesh.position.x, mz, BOT.radius)) bot.mesh.position.z = mz;
  }

  if (S.time >= bot.nextShot) {
    bot.nextShot = S.time + BOT.shootMin + Math.random() * (BOT.shootMax - BOT.shootMin);
    botShoot(bot, dist);
  }
}

function botShoot(bot, dist) {
  sfx("shot", { dist, vol: 0.6 });
  let acc = BOT.accuracyBase * Math.max(0, 1 - dist / (BOT.sightRange * 1.2));
  if (S.player.crouch) acc *= 0.6;
  if (S.moving > 0.5) acc *= 0.8;
  if (Math.random() < acc) {
    hurtPlayer(BOT.dmgMin + Math.random() * (BOT.dmgMax - BOT.dmgMin));
  }
}

function holdBot(bot) {
  // Slowly sweep the view cone to scan for threats.
  bot.yaw = Math.PI + Math.sin(S.time * 0.8 + bot.id) * 1.1;
  bot.mesh.rotation.y = bot.yaw;
}

function patrolBot(bot, dt) {
  const route = bot.route;
  if (!route || route.length === 0) { holdBot(bot); return; }
  if (S.time < bot.holdUntil) return;
  const [tx, tz] = route[bot.wp];
  const reached = moveToward(bot, tx, tz, BOT.walkSpeed, dt);
  if (reached) {
    bot.wp = (bot.wp + 1) % route.length;
    bot.holdUntil = S.time + 0.5 + Math.random() * 1.2;
  }
}

// Move toward (tx,tz); returns true when arrived.
function moveToward(bot, tx, tz, speed, dt) {
  const bx = bot.mesh.position.x, bz = bot.mesh.position.z;
  const dx = tx - bx, dz = tz - bz;
  const d = Math.hypot(dx, dz);
  if (d < 0.3) return true;
  const ux = dx / d, uz = dz / d;
  bot.yaw = Math.atan2(-ux, -uz);
  bot.mesh.rotation.y = bot.yaw;
  const nx = bx + ux * speed * dt;
  const nz = bz + uz * speed * dt;
  if (!blocked(S.colliders, nx, bz, BOT.radius)) bot.mesh.position.x = nx;
  if (!blocked(S.colliders, bx, nz, BOT.radius)) bot.mesh.position.z = nz;
  return false;
}
