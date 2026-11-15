# OPERATION BLACKOUT — rebuild plan (three.js tactical FPS)

You are working in /home/agentuser/fps2, a git repository that will be entered in make.fun's
threejs-fps-02 bounty ("Make the best three.js tactical FPS", deadline 2026-11-16 21:30 UTC).

## What exists
- game/vendor/three.module.min.js and game/vendor/three.core.min.js — the kit's three.js
  0.187.0 builds, UNCHANGED (do not touch or rename them; the gate checks their bytes).
- vendor/makefun-threejs.ts — the kit's dossier library, UNCHANGED (do not touch).
- /home/agentuser/fps2ref/reference_main.js and reference_index.html — an earlier prototype
  of the same game (round-based tactical FPS vs bots). Read them for gameplay math and ideas,
  but WRITE THE GAME YOURSELF as fresh files; do not copy them verbatim. The final game must
  be YOUR OWN code (the transcript gate checks that the agent sessions wrote it).
- main.ts — the Node 22 entrypoint (verify + optional --serve). It already works; you may
  refine it (it must run with plain `node main.ts`, exit 0, standard library only).
- LICENSE (MIT, SPDX line), .makefun/owner.json — leave as they are.
- screenshots/ — placeholder shots from the prototype; you will re-take them later against
  your rebuilt game (4 PNG/JPEG, long side ≤1280, short side ≥480, ≤256 KiB each).

## What to build (judge criteria, most important first)
1. COMPLETE GAME: first-person view with mouse look + WASD, a weapon that fires/reloads/runs
   out of ammo, opponents that move/see/shoot back, rounds won or lost that start again, HUD
   with health/ammo/round-timer/score. Screenshots and code must agree.
2. GUNPLAY & MOVEMENT: hits checked against bodies with headshot multiplier, recoil and
   spread that punish firing on the move, movement with acceleration/crouching/collision,
   so stopping to aim pays.
3. TACTICS: objective beyond killing (e.g. bomb plant/defuse OR area hold), money earned each
   round and spent in a buy menu, more than one weapon and at least one grenade, bots that
   follow routes, hold positions and react to what they see/hear.
4. MAP & LOOK: original map with lanes/corners/sightlines, lighting and materials in a chosen
   palette, a scene that reads at a glance (procedural canvas textures are fine — no assets).
5. CODE: modules with one job each (game/src/*.js ES modules), fixed-step simulation kept
   apart from rendering, no new objects made every frame in hot loops, state in one place,
   no duplicated blocks or dead code.

## Rules
- game/index.html: one `<script type="importmap">` mapping "three" to
  ./vendor/three.module.min.js; every reference relative or mapped, resolving inside game/;
  nothing loads over the network. No build step; game is static ES modules.
- Style it Counter-Strike-STYLE, never a copy: original names/map/art (the prototype's
  "Container Yard" map and weapon names are a good base to re-work, not copy).
- Do NOT modify: game/vendor/*, vendor/makefun-threejs.ts, LICENSE, .makefun/owner.json.
- Keep every source file readable; total source text the judge reads is capped at 160 KiB —
  aim for well-factored modules totalling roughly 1500-2500 lines.
- Commit your work to git as you go (small commits are fine).

## Workflow
1. Plan the module layout, then write the game module by module (world/map, player, weapons,
   bots, rounds/economy, HUD, main loop). Test after each big module with `node main.ts`
   (it only checks the bundle files exist, so real testing is `node main.ts --serve` + a
   headless browser screenshot via shot.js — ask the operator to run browser checks if you
   cannot) — at minimum run `node --check` on each JS file and keep the console clean of
   syntax errors.
2. Improve at least one module through revision (write → test/inspect → refine → final).
3. When the game is complete, tell the operator: which modules you wrote, what to test in
   the browser, and any tuning constants worth adjusting.
