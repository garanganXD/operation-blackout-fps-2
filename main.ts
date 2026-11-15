
// OPERATION BLACKOUT — round-based tactical FPS (three.js), single-player vs bots.
// Node 22 entrypoint. The playable game is the static bundle in ./game (open game/index.html
// in a desktop browser with WebGL 2). This script verifies the bundle integrity and,
// when run with --serve, serves it on http://localhost:8080 for easy play-testing.
import { readFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { join, extname } from "node:path";

const ROOT = new URL(".", import.meta.url).pathname;
const GAME = join(ROOT, "game");

const REQUIRED = ["index.html", "main.js", "vendor/three.module.min.js", "vendor/three.core.min.js"];
let ok = true;
for (const f of REQUIRED) {
  const p = join(GAME, f);
  if (!existsSync(p)) { console.error(`MISSING: game/${f}`); ok = false; }
}
if (!ok) process.exit(1);

const manifest = {
  name: "OPERATION BLACKOUT",
  genre: "round-based tactical FPS (Counter-Strike-style, original assets)",
  engine: "three.js 0.187.0 (kit build, unmodified)",
  entry: "game/index.html",
  controls: "WASD move, mouse aim (click to lock), LMB fire, R reload, B buy menu, 1-4 buy",
  features: ["two teams", "rounds", "bots", "buy menu", "economy", "headshots", "procedural textures", "synth audio"],
};
console.log(JSON.stringify(manifest, null, 2));

if (process.argv.includes("--serve")) {
  const TYPES = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".json": "application/json" };
  createServer((req, res) => {
    const p = join(GAME, req.url === "/" ? "index.html" : decodeURIComponent(req.url.split("?")[0].replace(/^\//, "")));
    try {
      const data = readFileSync(p);
      res.writeHead(200, { "content-type": TYPES[extname(p)] ?? "application/octet-stream" });
      res.end(data);
    } catch { res.writeHead(404); res.end("not found"); }
  }).listen(8080, () => console.log("playing at http://localhost:8080"));
}
