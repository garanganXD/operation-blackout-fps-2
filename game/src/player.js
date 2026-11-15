// player.js — the human-controlled entity: look, acceleration-based movement,
// crouching and collision. The camera transform itself is applied by main.js's
// render pass; this module only advances the player's world state.
import { S } from "./state.js";
import { PLAYER } from "./config.js";
import { blocked } from "./collision.js";
import { input } from "./input.js";
import { sfx } from "./audio.js";

const PITCH_LIMIT = 1.5;
const MOUSE_SCALE = 0.0022;

export function spawnPlayer() {
  const [x, z] = S.map.spawns.player;
  S.player = {
    x, z,
    yaw: 0,           // 0 faces north (-Z), toward the bomb site
    pitch: 0,
    velX: 0,
    velZ: 0,
    hp: PLAYER.maxHp,
    alive: true,
    crouch: false,
    kevlar: S.kevlar,
    stepT: 0,
  };
  return S.player;
}

function approach(a, b, amt) {
  if (a < b) return Math.min(a + amt, b);
  return Math.max(a - amt, b);
}

export function updatePlayer(dt) {
  const p = S.player;
  if (!p) return;

  // Mouse look (deltas only accumulate while the pointer is locked).
  p.yaw -= input.mouseDX * MOUSE_SCALE;
  p.pitch -= input.mouseDY * MOUSE_SCALE;
  p.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, p.pitch));

  if (!p.alive || S.phase !== "live") {
    S.moving = 0;
    return;
  }

  const f = (input.down("KeyW") ? 1 : 0) - (input.down("KeyS") ? 1 : 0);
  const r = (input.down("KeyD") ? 1 : 0) - (input.down("KeyA") ? 1 : 0);
  p.crouch = input.down("KeyC") || input.down("ControlLeft");

  const speed = p.crouch ? PLAYER.crouchSpeed : PLAYER.walkSpeed;
  const sin = Math.sin(p.yaw);
  const cos = Math.cos(p.yaw);
  let mx = -f * sin + r * cos;
  let mz = -f * cos - r * sin;
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }

  const targetVX = mx * speed;
  const targetVZ = mz * speed;
  const acc = PLAYER.accel * dt;
  p.velX = approach(p.velX, targetVX, acc);
  p.velZ = approach(p.velZ, targetVZ, acc);

  // Axis-separated movement with collision.
  const nx = p.x + p.velX * dt;
  if (!blocked(S.colliders, nx, p.z, PLAYER.radius)) p.x = nx;
  else p.velX = 0;
  const nz = p.z + p.velZ * dt;
  if (!blocked(S.colliders, p.x, nz, PLAYER.radius)) p.z = nz;
  else p.velZ = 0;

  S.moving = Math.min(1, Math.hypot(p.velX, p.velZ) / PLAYER.walkSpeed);

  // Footstep ticks (cosmetic).
  if (S.moving > 0.2) {
    p.stepT += dt * (p.crouch ? 5 : 9);
    if (p.stepT > 1) {
      p.stepT = 0;
      sfx("footstep", { vol: 0.5 });
    }
  }
}

export function hurtPlayer(dmg) {
  const p = S.player;
  if (!p || !p.alive || S.phase !== "live") return;
  p.hp -= dmg * (p.kevlar ? PLAYER.kevlarMult : 1);
  S.damageFlash = Math.min(1, S.damageFlash + 0.5);
  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
  }
}

// Is the player inside the bomb-site zone?
export function inSite() {
  const p = S.player;
  if (!p) return false;
  const s = S.map.site;
  return p.x >= s.minX && p.x <= s.maxX && p.z >= s.minZ && p.z <= s.maxZ;
}
