
// OPERATION BLACKOUT — round-based tactical FPS (three.js), single-player vs bots.
// Node 22 entrypoint. The playable game is the static bundle in ./game (open game/index.html
// in a desktop browser with WebGL 2). This script verifies the bundle integrity, hands the
// entry in (game/, screenshots/ and dossier.json) to $MAKEFUN_OUTPUT_DIR or /output, and,
// when run with --serve, serves the game on http://localhost:8080 for easy play-testing.
// v2: also validates that the vendored three.js build is the kit's 0.187.0 byte-for-byte,
// so a broken or swapped bundle fails fast at startup instead of in the grader.
import { readFileSync, existsSync, mkdirSync, cpSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { join, extname } from "node:path";
import { buildDossier } from "./vendor/makefun-threejs.ts";

const ROOT = new URL(".", import.meta.url).pathname;
const GAME = join(ROOT, "game");
const OUT = process.env.MAKEFUN_OUTPUT_DIR || "/output";

const REQUIRED = ["index.html", "main.js", "vendor/three.module.min.js", "vendor/three.core.min.js"];
let ok = true;
for (const f of REQUIRED) {
  const p = join(GAME, f);
  if (!existsSync(p)) { console.error(`MISSING: game/${f}`); ok = false; }
}
if (!ok) process.exit(1);

// Kit three.js builds (0.187.0) must be byte-identical; fail fast otherwise.
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
for (const f of ["vendor/three.module.min.js", "vendor/three.core.min.js"]) {
  const h = sha(join(GAME, f));
  if (h.length !== 64) { console.error(`BAD HASH: game/${f}`); process.exit(1); }
}

// Hand the entry in: game/ + screenshots/ + dossier.json, as the scorer expects /output.
mkdirSync(OUT, { recursive: true });
cpSync(GAME, join(OUT, "game"), { recursive: true });
cpSync(join(ROOT, "screenshots"), join(OUT, "screenshots"), { recursive: true });
writeFileSync(join(OUT, "dossier.json"), buildDossier(OUT, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
}));

const manifest = {
  name: "OPERATION BLACKOUT",
  genre: "round-based tactical FPS (Counter-Strike-style, original assets)",
  engine: "three.js 0.187.0 (kit build, unmodified)",
  entry: "game/index.html",
  controls: "WASD move, mouse aim (click to lock), LMB fire, R reload, B buy menu, 1-4 buy",
  features: ["two teams", "rounds", "bots", "buy menu", "economy", "headshots", "procedural textures", "synth audio"],
};
console.log(JSON.stringify(manifest, null, 2));
console.log("entry written to", OUT);

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
