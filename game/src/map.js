// map.js — builds the "Rustline Terminal" level: geometry, materials, lights
// and sky, then returns the data the rest of the game needs (colliders,
// line-of-sight blockers, spawns, patrol routes and the bomb site).
//
// Original layout: a container terminal at dusk. The player (RAIDERS) attacks
// from the south; the WARDENS defend bomb site A in the north-west. A mid
// lane, a west container lane and an east crate lane all converge on the site.
import * as THREE from "three";

const CONTAINER_COLORS = ["#a33b2e", "#2e6e73", "#8a6d3b", "#3d5a3d"];

// Each entry: [x, z, w, d, h, colorIndex]. Height defaults to 2.8.
const CONTAINERS = [
  // Site complex (north-west) — the objective's cover.
  [-24, -18, 6, 3, 2.8, 0],
  [-18, -22, 4, 4, 2.8, 1],
  [-30, -2, 4, 8, 2.8, 2],
  // West lane — a long container wall with gaps.
  [-22, 8, 6, 3, 2.8, 3],
  [-26, 16, 4, 6, 2.8, 1],
  [-14, 14, 3, 4, 2.8, 2],
  // Mid lane — sparse cover around the central tower.
  [-6, -8, 3, 5, 2.8, 2],
  [6, 2, 3, 4, 2.8, 3],
  [0, 14, 4, 2.4, 2.8, 0],
  // East lane — crates and containers.
  [24, -16, 4, 8, 2.8, 1],
  [18, -4, 6, 3, 2.8, 0],
  [28, 10, 4, 6, 2.8, 2],
  [18, 20, 6, 3, 2.8, 3],
];

// Low crates (height 1.1) usable as crouch cover.
const CRATES = [
  [-12, -14, 2, 2],
  [10, -10, 2, 2],
  [-16, 2, 2.5, 2.5],
  [12, 16, 2.5, 2.5],
  [0, -16, 2.4, 2.4],
];

const MAP_W = 80; // x in [-40, 40]
const MAP_D = 60; // z in [-30, 30]

// Bomb site A — the north-west corner.
const SITE = { minX: -30, maxX: -14, minZ: -26, maxZ: -12, bombPos: [-22, -20] };

// Patrol routes (lists of [x,z] waypoints).
const ROUTES = [
  [[-12, -18], [-8, -6], [2, -4], [8, -10]],
  [[-26, -6], [-20, 2], [-10, 4], [-18, 12]],
  [[-6, -20], [-2, -10], [6, -16], [10, -4]],
];

// Bot spawns: a mix of holders (stand near the site) and patrollers.
const BOT_SPAWNS = [
  { pos: [-22, -14], role: "hold" },
  { pos: [-12, -18], role: "patrol", route: 0 },
  { pos: [-26, -6], role: "patrol", route: 1 },
  { pos: [-16, -8], role: "hold" },
  { pos: [-6, -20], role: "patrol", route: 2 },
];

export function buildMap(scene, T) {
  const colliders = [];
  const losBlockers = [];

  const addSolid = (mesh, x, z, w, d) => {
    scene.add(mesh);
    mesh.userData.hittable = true; // bullets stop here
    losBlockers.push(mesh);
    colliders.push({ minX: x - w / 2, minZ: z - d / 2, maxX: x + w / 2, maxZ: z + d / 2 });
  };

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_W, MAP_D),
    new THREE.MeshLambertMaterial({ map: T.ground })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Bomb-site pad (visual marker, thin plane above the ground).
  const pad = new THREE.Mesh(
    new THREE.PlaneGeometry(SITE.maxX - SITE.minX, SITE.maxZ - SITE.minZ),
    new THREE.MeshLambertMaterial({ map: T.site })
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set((SITE.minX + SITE.maxX) / 2, 0.02, (SITE.minZ + SITE.maxZ) / 2);
  scene.add(pad);

  // Perimeter walls.
  const wallMat = new THREE.MeshLambertMaterial({ map: T.wall }); // repeat 12,1 set in textures.js
  const blockMat = new THREE.MeshLambertMaterial({ map: T.wall.clone() });
  blockMat.map.repeat.set(2, 1);

  const wall = (x, z, w, d, h, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, h / 2, z);
    addSolid(m, x, z, w, d);
    return m;
  };
  wall(0, -MAP_D / 2, MAP_W, 1, 5, wallMat);
  wall(0, MAP_D / 2, MAP_W, 1, 5, wallMat);
  wall(-MAP_W / 2, 0, 1, MAP_D, 5, wallMat);
  wall(MAP_W / 2, 0, 1, MAP_D, 5, wallMat);

  // Shipping containers.
  CONTAINERS.forEach(([x, z, w, d, h, ci]) => {
    const mat = new THREE.MeshLambertMaterial({ map: T.container(CONTAINER_COLORS[ci]) });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, h / 2, z);
    addSolid(m, x, z, w, d);
  });

  // Low crates.
  const crateMat = new THREE.MeshLambertMaterial({ map: T.crate });
  CRATES.forEach(([x, z, w, d]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, d), crateMat);
    m.position.set(x, 1.1 / 2, z);
    addSolid(m, x, z, w, d);
  });

  // Central watch tower.
  const tower = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 4), blockMat);
  tower.position.set(0, 3, 4);
  addSolid(tower, 0, 4, 4, 4);

  // Lighting & atmosphere.
  scene.add(new THREE.HemisphereLight(0xcfd9e2, 0x3a3d34, 1.0));
  const sun = new THREE.DirectionalLight(0xffdca8, 1.35);
  sun.position.set(25, 35, 12);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x8899bb, 0.35);
  fill.position.set(-20, 15, -10);
  scene.add(fill);

  // Warm floodlights over the site and the mid tower (dusk mood).
  const lampSite = new THREE.PointLight(0xffb35a, 60, 26, 2);
  lampSite.position.set(-22, 7, -20);
  scene.add(lampSite);
  const lampMid = new THREE.PointLight(0x7f9fd8, 45, 22, 2);
  lampMid.position.set(0, 8, 4);
  scene.add(lampMid);

  scene.background = T.sky;
  scene.fog = new THREE.Fog(0x16202c, 55, 140);

  return {
    colliders,
    losBlockers,
    spawns: {
      player: [0, 24],
      bots: BOT_SPAWNS,
    },
    site: SITE,
    routes: ROUTES,
  };
}
