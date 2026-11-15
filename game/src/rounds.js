// rounds.js — the match state machine: rounds, economy, the buy menu, and the
// bomb objective (plant / defuse / detonate). It drives phase transitions and
// evaluates win/lose conditions for the live round.
import * as THREE from "three";
import { S, resetAmmo } from "./state.js";
import { WEAPONS, PISTOL_ID, ECON, ROUND, KEVLAR_COST, GRENADE_COST, GRENADE_MAX, MATCH_WIN, TEAM_PLAYER, TEAM_ENEMY } from "./config.js";
import { spawnPlayer, inSite } from "./player.js";
import { spawnBots, aliveBots } from "./bots.js";
import { sfx } from "./audio.js";
import { input, lockPointer, unlockPointer } from "./input.js";

export function startMatch() {
  S.score[TEAM_PLAYER] = 0;
  S.score[TEAM_ENEMY] = 0;
  S.round = 0;
  S.money = ECON.start;
  S.kevlar = false;
  S.owned = new Set([PISTOL_ID]);
  S.nades = 0;
  resetAmmo();
  startRound();
}

export function startRound() {
  S.round++;
  spawnPlayer();
  spawnBots();
  clearTransients();

  // Reset the objective.
  S.bomb = "carried";
  S.plantProgress = 0;
  S.bombTimer = ROUND.bombFuse;
  S.defuseProgress = 0;
  removeBombDevice();

  // Top up magazines from the player's reserves.
  for (const id of S.owned) S.ammo[id].mag = WEAPONS[id].mag;
  if (!S.owned.has(S.weapon)) S.weapon = PISTOL_ID;

  S.phase = "buy";
  S.phaseT = ROUND.buyTime;
  sfx("round");
}

function clearTransients() {
  for (const b of S.bots) S.scene.remove(b.mesh);
  for (const g of S.grenades) S.scene.remove(g.mesh);
  for (const f of S.fx) { S.scene.remove(f.mesh); S.scene.remove(f.light); }
  S.bots = [];
  S.grenades = [];
  S.fx = [];
  S.reloading = false;
  S.reloadT = 0;
  S.fireCooldown = 0;
  S.recoil = 0;
  S.flash = 0;
  S.heat = 0;
}

export function startLive() {
  S.phase = "live";
  S.timer = ROUND.liveTime;
  S.msg = "";
  S.msgT = 0;
  input.firing = false;
  lockPointer();
}

export function update(dt) {
  if (S.msgT > 0) S.msgT -= dt;

  switch (S.phase) {
    case "buy":
      handleBuyInput();
      S.phaseT -= dt;
      if (S.phaseT <= 0) startLive();
      break;
    case "live":
      S.timer -= dt;
      updateObjective(dt);
      if (S.phase === "live") checkEndConditions();
      break;
    case "inter":
      S.phaseT -= dt;
      if (S.phaseT <= 0) {
        if (matchOver()) {
          S.phase = "over";
          S.msg = S.score[TEAM_PLAYER] >= MATCH_WIN ? "MATCH WON — YOU TOOK THE TERMINAL" : "MATCH LOST — THE WARDENS HELD";
          S.msgT = 1e9;
        } else {
          startRound();
        }
      }
      break;
    case "over":
      if (input.hit("Enter") || input.hit("KeyR") || input.clicked) startMatch();
      break;
    default:
      break;
  }
}

function matchOver() {
  return S.score[TEAM_PLAYER] >= MATCH_WIN || S.score[TEAM_ENEMY] >= MATCH_WIN;
}

// ---------- Buy menu ----------
function handleBuyInput() {
  if (input.hit("Digit1")) buyItem(1);
  else if (input.hit("Digit2")) buyItem(2);
  else if (input.hit("Digit3")) buyItem(3);
  else if (input.hit("Digit4")) buyItem(4);
  else if (input.hit("Digit5")) buyItem(5);
  else if (input.hit("KeyB") || input.hit("Enter") || input.hit("Space") || input.clicked) startLive();
}

export function buyItem(i) {
  if (S.phase !== "buy") return;
  if (i === 1) buyWeapon("falcon");
  else if (i === 2) buyWeapon("wasp");
  else if (i === 3) buyWeapon("nightwing");
  else if (i === 4) buyKevlar();
  else if (i === 5) buyGrenade();
}

function buyWeapon(id) {
  const w = WEAPONS[id];
  if (S.money < w.cost) { sfx("deny"); return; }
  S.money -= w.cost;
  S.owned.add(id);
  S.ammo[id] = { mag: w.mag, reserve: w.reserve };
  S.weapon = id;
  S.reloading = false;
  sfx("buy");
  flash(w.name + " EQUIPPED");
}

function buyKevlar() {
  if (S.kevlar || S.money < KEVLAR_COST) { sfx("deny"); return; }
  S.money -= KEVLAR_COST;
  S.kevlar = true;
  sfx("buy");
  flash("KEVLAR VEST ON");
}

function buyGrenade() {
  if (S.nades >= GRENADE_MAX || S.money < GRENADE_COST) { sfx("deny"); return; }
  S.money -= GRENADE_COST;
  S.nades++;
  sfx("buy");
  flash("SHARD +1");
}

function flash(m) {
  S.msg = m;
  S.msgT = 1.5;
}

// ---------- Objective ----------
function updateObjective(dt) {
  const p = S.player;

  if (S.bomb === "carried") {
    if (p.alive && inSite() && input.down("KeyE")) {
      S.plantProgress += dt;
      if (S.plantProgress >= ROUND.plantTime) plantBomb();
    } else {
      S.plantProgress = Math.max(0, S.plantProgress - dt * 2);
    }
    return;
  }

  if (S.bomb === "planted") {
    S.bombTimer -= dt;
    // Pulse the bomb light for readability.
    if (S.bombLight) S.bombLight.intensity = 4 + Math.sin(S.time * 10) * 2;

    // Bots defuse by standing on the bomb.
    const [tx, tz] = S.map.site.bombPos;
    let defusing = false;
    for (const b of S.bots) {
      if (!b.alive) continue;
      const dx = b.mesh.position.x - tx;
      const dz = b.mesh.position.z - tz;
      if (dx * dx + dz * dz < 1.8 * 1.8) { defusing = true; break; }
    }
    if (defusing) S.defuseProgress += dt;
    else S.defuseProgress = Math.max(0, S.defuseProgress - dt);

    if (S.defuseProgress >= ROUND.defuseTime) {
      S.bomb = "defused";
      endRound(TEAM_ENEMY, "BOMB DEFUSED");
    } else if (S.bombTimer <= 0) {
      S.bomb = "exploded";
      sfx("boom");
      endRound(TEAM_PLAYER, "BOMB DETONATED");
    }
  }
}

function plantBomb() {
  S.bomb = "planted";
  S.plantProgress = 0;
  S.money += ECON.plant;
  sfx("plant");
  flash("BOMB PLANTED — DEFEND IT");
  // Loud event: every bot rushes the site.
  S.lastNoise = { x: S.map.site.bombPos[0], z: S.map.site.bombPos[1], t: S.time, loud: 999 };
  showBombDevice();
}

function showBombDevice() {
  const [bx, bz] = S.map.site.bombPos;
  const g = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.3, 0.4),
    new THREE.MeshBasicMaterial({ color: 0x2a2d31 })
  );
  const led = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff2222 })
  );
  led.position.y = 0.18;
  g.add(box); g.add(led);
  g.position.set(bx, 0.55, bz);
  S.scene.add(g);
  S.bombDevice = g;

  const light = new THREE.PointLight(0xff2222, 6, 9, 2);
  light.position.set(bx, 1.2, bz);
  S.scene.add(light);
  S.bombLight = light;
}

function removeBombDevice() {
  if (S.bombDevice) { S.scene.remove(S.bombDevice); S.bombDevice = null; }
  if (S.bombLight) { S.scene.remove(S.bombLight); S.bombLight = null; }
}

function checkEndConditions() {
  const p = S.player;
  if (!p.alive) {
    endRound(TEAM_ENEMY, "YOU WERE ELIMINATED");
  } else if (aliveBots() === 0) {
    endRound(TEAM_PLAYER, "HOSTILES ELIMINATED");
  } else if (S.bomb === "carried" && S.timer <= 0) {
    endRound(TEAM_ENEMY, "TIME RAN OUT — NO PLANT");
  }
}

function endRound(winner, reason) {
  if (S.phase !== "live") return;
  S.score[winner]++;
  if (winner === TEAM_PLAYER) S.money += ECON.win;
  else {
    S.money += ECON.loss;
    S.kevlar = false; // armor is lost when you die
  }
  S.msg = reason;
  S.msgT = 2.5;
  S.phase = "inter";
  S.phaseT = ROUND.interTime;
  unlockPointer();
  clearTransients();
  removeBombDevice();
}
