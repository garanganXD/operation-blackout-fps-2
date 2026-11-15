// viewmodel.js — the first-person weapon seen attached to the camera. It reads
// combat state (recoil, flash, reloading, movement) and animates the gun mesh
// and muzzle light; gameplay logic lives in weapons.js.
import * as THREE from "three";
import { S } from "./state.js";

const ACCENT = {
  mantis: 0x8a8a8a,
  wasp: 0x8899aa,
  falcon: 0x3a8f4a,
  nightwing: 0x6655aa,
};

const BASE = { x: 0.20, y: -0.17, z: -0.55 };

let group = null;
let accentMat = null;
let muzzleLight = null;

export function init(camera) {
  group = new THREE.Group();
  const gunMat = new THREE.MeshLambertMaterial({ color: 0x2a2d31 });
  accentMat = new THREE.MeshLambertMaterial({ color: ACCENT.mantis });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.12, 0.52), gunMat);
  group.add(body);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.34, 8), accentMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.015, -0.37);
  group.add(barrel);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.19, 0.09), gunMat);
  grip.position.set(0, -0.13, 0.13);
  grip.rotation.x = -0.25;
  group.add(grip);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.13), accentMat);
  mag.position.set(0, -0.12, 0.0);
  group.add(mag);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.05), accentMat);
  sight.position.set(0, 0.085, -0.15);
  group.add(sight);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.2), gunMat);
  stock.position.set(0, -0.02, 0.3);
  group.add(stock);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.16),
    new THREE.MeshLambertMaterial({ color: 0xb98a63 }));
  hand.position.set(0, -0.10, 0.15);
  group.add(hand);

  group.position.set(BASE.x, BASE.y, BASE.z);
  camera.add(group);

  muzzleLight = new THREE.PointLight(0xffcc66, 0, 9, 2);
  muzzleLight.position.set(0, 0.02, -0.55);
  group.add(muzzleLight);
}

export function update(dt) {
  if (!group) return;

  S.recoil = Math.max(0, S.recoil - dt * 0.7);
  S.flash = Math.max(0, S.flash - dt * 40);
  muzzleLight.intensity = S.flash;

  accentMat.color.set(ACCENT[S.weapon] ?? 0x8a8a8a);

  const reloadTilt = S.reloading ? 0.6 : 0;
  const bob = S.moving;

  group.position.x = BASE.x + Math.cos(S.time * 5.5) * 0.004 * bob;
  group.position.y = BASE.y + Math.sin(S.time * 11) * 0.006 * bob;
  group.position.z = BASE.z + S.recoil * 0.5 + reloadTilt * 0.08;
  group.rotation.x = S.recoil * 4 + reloadTilt;
}
