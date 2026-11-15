// hud.js — reads the game state and paints the on-screen HUD (health, ammo,
// money, timer, score, objective, crosshair, buy menu and progress bars).
import { S } from "./state.js";
import { WEAPONS, TEAM_PLAYER, TEAM_ENEMY, ROUND } from "./config.js";

let els = null;

export function init(onBuy) {
  els = {
    round: byId("round"), timer: byId("timer"), score: byId("score"),
    hp: byId("hp"), hpBar: byId("hpbar"), money: byId("money"),
    weapon: byId("weapon"), ammo: byId("ammo"), nades: byId("nades"),
    msg: byId("msg"), objective: byId("objective"),
    buy: byId("buy"), damage: byId("damage"),
    plantbar: byId("plantbar"), defusebar: byId("defusebar"),
    chT: byId("ch-t"), chB: byId("ch-b"), chL: byId("ch-l"), chR: byId("ch-r"),
  };
  if (onBuy) {
    els.buy.querySelectorAll(".row").forEach((row) => {
      row.addEventListener("click", () => onBuy(Number(row.dataset.i)));
    });
  }
}

function byId(id) { return document.getElementById(id); }

export function update() {
  if (!els) return;
  const p = S.player;
  const a = S.ammo[S.weapon];
  const w = WEAPONS[S.weapon];

  els.round.textContent = "ROUND " + S.round;
  els.score.textContent = `${TEAM_PLAYER} ${S.score[TEAM_PLAYER]} — ${S.score[TEAM_ENEMY]} ${TEAM_ENEMY}`;
  els.money.textContent = "$ " + S.money;

  const hp = p ? Math.max(0, Math.ceil(p.hp)) : 0;
  els.hp.textContent = "HP " + hp;
  els.hpBar.style.width = hp + "%";
  els.hpBar.style.background = hp < 30 ? "#d84a3a" : "#3a8f4a";

  els.weapon.textContent = w.name + (S.kevlar ? "  VEST" : "");
  els.ammo.textContent = S.reloading ? "— / " + a.reserve : a.mag + " / " + a.reserve;
  els.nades.textContent = "SHARD x" + S.nades;
  els.msg.textContent = S.msgT > 0 ? S.msg : "";

  // Objective line.
  let obj = "";
  if (S.phase === "live" || S.phase === "inter") {
    if (S.bomb === "carried") obj = "PLANT THE BOMB AT SITE A (hold E)";
    else if (S.bomb === "planted") obj = "BOMB ARMED — DEFEND IT";
    else if (S.bomb === "defused") obj = "BOMB DEFUSED";
    else if (S.bomb === "exploded") obj = "BOMB DETONATED";
  }
  els.objective.textContent = obj;

  // Progress bars.
  els.plantbar.style.width = (S.plantProgress / ROUND.plantTime * 100) + "%";
  els.defusebar.style.width = (S.defuseProgress / ROUND.defuseTime * 100) + "%";

  // Timer + buy menu visibility.
  if (S.phase === "buy") {
    els.timer.textContent = "BUY " + Math.ceil(S.phaseT);
    els.timer.style.color = "#7fd88f";
    els.buy.style.display = "block";
  } else {
    const t = Math.max(0, S.bomb === "planted" ? S.bombTimer : S.timer);
    if (S.phase === "over") els.timer.textContent = "END";
    else {
      const m = Math.floor(t / 60), s = Math.floor(t % 60);
      els.timer.textContent = m + ":" + String(s).padStart(2, "0");
    }
    els.timer.style.color = t < 15 ? "#d84a3a" : "#e8e6e3";
    els.buy.style.display = "none";
  }

  // Damage vignette.
  S.damageFlash = Math.max(0, S.damageFlash - 0.04);
  els.damage.style.opacity = String(Math.min(0.7, S.damageFlash));

  // Dynamic crosshair: gap widens with movement, recoil and sustained fire.
  const gap = Math.min(16, 6 + S.moving * 7 + S.recoil * 120 + S.heat * 6);
  els.chT.setAttribute("y2", String(20 - gap));
  els.chB.setAttribute("y2", String(20 + gap));
  els.chL.setAttribute("x2", String(20 - gap));
  els.chR.setAttribute("x2", String(20 + gap));
}
