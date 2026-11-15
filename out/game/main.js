// main.js — entry point. Builds the renderer, scene and camera, wires the
// modules together, then runs a fixed-step simulation separated from rendering.
import * as THREE from "three";
import { S } from "./src/state.js";
import { PLAYER } from "./src/config.js";
import { makeTextures } from "./src/textures.js";
import { buildMap } from "./src/map.js";
import { initInput, input } from "./src/input.js";
import { initAudio } from "./src/audio.js";
import * as player from "./src/player.js";
import * as weapons from "./src/weapons.js";
import * as bots from "./src/bots.js";
import * as rounds from "./src/rounds.js";
import * as hud from "./src/hud.js";
import * as viewmodel from "./src/viewmodel.js";

// Renderer.
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch (e) {
  const m = document.getElementById("msg");
  m.textContent = "WEBGL ERROR: " + e.message;
  m.style.color = "#ff5555";
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Scene & camera.
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
scene.add(camera);

S.scene = scene;
S.camera = camera;
S.renderer = renderer;

// World.
const T = makeTextures();
const map = buildMap(scene, T);
S.map = map;
S.colliders = map.colliders;
S.losBlockers = map.losBlockers;

// Subsystems.
viewmodel.init(camera);
hud.init((i) => rounds.buyItem(i));
initInput(renderer.domElement);
initAudio();

// Start the match.
rounds.startMatch();

// Fixed-step simulation, kept apart from rendering.
const FIXED = 1 / 60;
let acc = 0;
let last = performance.now();

function step(dt) {
  S.time += dt;
  rounds.update(dt);
  if (S.phase === "live") {
    player.updatePlayer(dt);
    weapons.update(dt);
    bots.updateBots(dt);
  }
  weapons.updateGrenades(dt);
  weapons.updateFx(dt);
  input.pressed.clear();
  input.clicked = false;
  input.mouseDX = 0;
  input.mouseDY = 0;
}

function render() {
  const p = S.player;
  if (p) {
    const eye = !p.alive ? 0.5 : (p.crouch ? PLAYER.crouchEye : PLAYER.eyeHeight);
    camera.position.set(p.x, eye, p.z);
    camera.rotation.set(0, 0, 0);
    camera.rotateY(p.yaw);
    camera.rotateX(p.pitch);
  }
  viewmodel.update(FIXED);
  hud.update();

  // Steady-aim narrows the field of view slightly (smooth zoom).
  const targetFov = S.focus && S.phase === "live" ? 55 : 75;
  camera.fov += (targetFov - camera.fov) * 0.18;
  camera.updateProjectionMatrix();

  renderer.render(scene, camera);
}

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  acc += dt;
  while (acc >= FIXED) {
    step(FIXED);
    acc -= FIXED;
  }
  render();
}

requestAnimationFrame(frame);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
