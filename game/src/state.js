// state.js — the single source of truth for all mutable game state.
// Every gameplay module reads and writes this object; nothing else holds
// cross-module state. Framework references (scene/camera/renderer) are wired
// in by main.js after construction.
import { WEAPONS, PISTOL_ID, ECON, ROUND } from "./config.js";

function freshAmmo() {
  const a = {};
  for (const id of Object.keys(WEAPONS)) {
    a[id] = { mag: 0, reserve: 0 };
  }
  a[PISTOL_ID] = { mag: WEAPONS[PISTOL_ID].mag, reserve: WEAPONS[PISTOL_ID].reserve };
  return a;
}

export const S = {
  // Framework (set by main.js).
  scene: null,
  camera: null,
  renderer: null,

  // World data (set by map.js through main.js).
  map: null,          // { spawns, site, routes, bombPos }
  colliders: [],      // [{minX,minZ,maxX,maxZ}] 2D AABB for movement
  losBlockers: [],    // THREE.Object3D[] solids that block sight & bullets

  // Entities.
  player: null,
  bots: [],
  grenades: [],
  fx: [],             // short-lived explosion effects {mesh, light, t, life}

  // Round / economy.
  phase: "boot",      // 'buy' | 'live' | 'inter' | 'over'
  phaseT: 0,
  timer: ROUND.liveTime,
  round: 0,
  score: { RAIDERS: 0, WARDENS: 0 },
  money: ECON.start,
  kevlar: false,
  owned: new Set([PISTOL_ID]),
  weapon: PISTOL_ID,
  ammo: freshAmmo(),
  reloading: false,
  reloadT: 0,
  fireCooldown: 0,
  nades: 0,
  heat: 0,            // accumulated recoil from sustained fire, decays

  // Objective / bomb.
  bomb: "carried",    // 'carried' | 'planting' | 'planted' | 'exploded' | 'defused'
  plantProgress: 0,
  bombTimer: ROUND.bombFuse,
  defuseProgress: 0,
  bombDevice: null,   // visual bomb prop (created on plant)
  bombLight: null,

  // Combat feel (consumed by the viewmodel / render layer).
  recoil: 0,          // visual muzzle kick, decays
  flash: 0,           // muzzle light intensity, decays
  moving: 0,          // 0..1 movement amount for bob/spread
  damageFlash: 0,     // red screen vignette when the player is hurt

  // Messaging & sound.
  msg: "",
  msgT: 0,
  lastNoise: { x: 0, z: 0, t: -1e9, loud: 0 },

  // Clock.
  time: 0,
};

// Read current weapon's ammo block (convenience).
export function curAmmo() {
  return S.ammo[S.weapon];
}

// Reset every weapon's ammo to the starting state (pistol loaded, rest empty).
export function resetAmmo() {
  S.ammo = freshAmmo();
}
