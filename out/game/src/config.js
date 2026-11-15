// config.js — every tuning constant in one place. No imports, no side effects.
// OPERATION BLACKOUT — round-based tactical FPS vs bots (three.js 0.187).

export const TEAM_PLAYER = "RAIDERS"; // attacking team (the player)
export const TEAM_ENEMY = "WARDENS";  // defending team (bots)

// Weapon table. cost 0 = always owned sidearm.
export const WEAPONS = {
  mantis: {
    name: "MANTIS", kind: "pistol", dmg: 24, rpm: 300, mag: 12, reserve: 48,
    spread: 0.010, recoil: 0.028, reload: 1.5, auto: false, cost: 0,
  },
  wasp: {
    name: "WASP", kind: "smg", dmg: 19, rpm: 780, mag: 30, reserve: 90,
    spread: 0.026, recoil: 0.014, reload: 2.1, auto: true, cost: 1200,
  },
  falcon: {
    name: "FALCON", kind: "rifle", dmg: 32, rpm: 600, mag: 30, reserve: 90,
    spread: 0.011, recoil: 0.022, reload: 2.4, auto: true, cost: 2700,
  },
  nightwing: {
    name: "NIGHTWING", kind: "sniper", dmg: 96, rpm: 48, mag: 5, reserve: 20,
    spread: 0.0015, recoil: 0.085, reload: 3.0, auto: false, cost: 4750,
  },
};
export const PISTOL_ID = "mantis";
export const HEADSHOT_MULT = 2.5;

// Buy menu / loadout.
export const KEVLAR_COST = 650;
export const GRENADE_COST = 300;
export const GRENADE_MAX = 2;
export const GRENADE_DAMAGE = 85;
export const GRENADE_RADIUS = 7.5;
export const GRENADE_FUSE = 1.6;
export const GRENADE_THROW = 13.5;   // forward speed
export const GRENADE_UP = 5.5;        // upward speed
export const GRAVITY = -18;           // world gravity for grenade physics

// Economy.
export const ECON = {
  start: 800,
  kill: 300,
  plant: 300,
  win: 3250,
  loss: 1400,
};

export const MATCH_WIN = 8; // first to 8 rounds wins the match

// Round timings (seconds).
export const ROUND = {
  buyTime: 15,
  liveTime: 115,
  interTime: 3.0,
  plantTime: 3.0,
  bombFuse: 40,
  defuseTime: 5.0,
};

// Player movement / body.
export const PLAYER = {
  radius: 0.5,
  eyeHeight: 1.62,
  crouchEye: 1.05,
  walkSpeed: 5.6,
  crouchSpeed: 2.8,
  accel: 46,       // ground acceleration (units/s^2)
  friction: 14,    // ground deceleration when no input
  maxHp: 100,
  kevlarMult: 0.6,
};

// Bot tuning.
export const BOT = {
  radius: 0.45,
  hp: 100,
  eye: 1.55,
  walkSpeed: 3.1,
  engageSpeed: 4.2,
  sightRange: 42,
  fovHalf: 1.05,          // ~60° half-angle view cone
  hearRange: 26,          // base hearing radius
  reactMin: 0.30,         // reaction delay before first shot (s)
  reactMax: 0.80,
  shootMin: 0.45,         // time between bot shots (s)
  shootMax: 1.0,
  accuracyBase: 0.55,     // base hit chance at close range
  dmgMin: 8,              // damage a bot bullet deals
  dmgMax: 18,
  strafe: 0.7,
};
