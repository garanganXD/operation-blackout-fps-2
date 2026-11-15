// textures.js — procedural canvas textures so the game ships with zero image
// assets. Each texture is painted onto a 2D canvas and wrapped for repetition.
import * as THREE from "three";

function canvasTex(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function speckle(g, w, h, n, min, max, alphaMin, alphaMax) {
  for (let i = 0; i < n; i++) {
    const v = min + Math.random() * (max - min);
    g.fillStyle = `rgba(${v | 0},${(v + 4) | 0},${(v - 6) | 0},${alphaMin + Math.random() * (alphaMax - alphaMin)})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
}

export function makeTextures() {
  const T = {};

  // Tarmac ground with painted lane marks.
  T.ground = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#555b50";
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 900, 34, 78, 0.2, 0.5);
    g.strokeStyle = "rgba(0,0,0,.32)";
    g.lineWidth = 2;
    for (let i = 0; i <= w; i += 64) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.moveTo(0, i); g.lineTo(w, i); g.stroke();
    }
    // worn tire track
    g.strokeStyle = "rgba(20,20,18,.25)";
    g.lineWidth = 10;
    g.beginPath(); g.moveTo(0, 90); g.bezierCurveTo(90, 70, 160, 160, 256, 130); g.stroke();
  });
  T.ground.repeat.set(10, 8);

  // Bomb-site pad: striped hazard zone.
  T.site = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#4a5146";
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 300, 40, 70, 0.15, 0.35);
    g.strokeStyle = "#c9a227";
    g.lineWidth = 6;
    g.strokeRect(8, 8, w - 16, h - 16);
    for (let i = -h; i < w; i += 32) {
      g.beginPath(); g.moveTo(i, 8); g.lineTo(i + h, h - 8); g.stroke();
    }
    g.lineWidth = 2;
  });
  T.site.repeat.set(2, 2);

  // Concrete perimeter wall.
  T.wall = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#6e7268";
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 600, 74, 112, 0.3, 0.55);
    g.strokeStyle = "rgba(0,0,0,.28)";
    g.lineWidth = 3;
    for (let y = 0; y <= h; y += 64) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    }
    // grime streaks from top
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * w;
      g.fillStyle = `rgba(40,42,38,${0.1 + Math.random() * 0.25})`;
      g.fillRect(x, 0, 4 + Math.random() * 12, 40 + Math.random() * 90);
    }
  });
  T.wall.repeat.set(12, 1);

  // Shipping container with corrugated ribs and rust.
  T.container = (base) => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      g.fillStyle = "rgba(0,0,0,.26)";
      g.fillRect(x, 0, 5, h);
      g.fillStyle = "rgba(255,255,255,.10)";
      g.fillRect(x + 8, 0, 4, h);
    }
    for (let i = 0; i < 26; i++) {
      g.fillStyle = `rgba(${70 + Math.random() * 60 | 0},${40 + Math.random() * 30 | 0},22,${0.1 + Math.random() * 0.25})`;
      g.fillRect(Math.random() * w, Math.random() * h, 3 + Math.random() * 10, 18 + Math.random() * 80);
    }
    g.fillStyle = "rgba(0,0,0,.45)";
    g.fillRect(0, 0, w, 10);
    g.fillRect(0, h - 10, w, 10);
    // corner casting block
    g.fillStyle = "rgba(20,20,20,.7)";
    g.fillRect(6, 6, 26, 26);
    g.fillRect(w - 32, h - 32, 26, 26);
  });

  // Wooden crate for low cover.
  T.crate = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = "#7a5a34";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(${50 + Math.random() * 40 | 0},${36 + Math.random() * 24 | 0},18,0.35)`;
      g.fillRect(Math.random() * w, 0, 2, h);
    }
    g.strokeStyle = "rgba(40,26,10,.7)";
    g.lineWidth = 6;
    g.strokeRect(3, 3, w - 6, h - 6);
    g.beginPath(); g.moveTo(3, 3); g.lineTo(w - 3, h - 3); g.moveTo(3, h - 3); g.lineTo(w - 3, 3); g.stroke();
  });

  // Metal floor plate for the central structure.
  T.metal = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = "#3f454c";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 120; i++) {
      g.fillStyle = `rgba(${60 + Math.random() * 40 | 0},${62 + Math.random() * 40 | 0},${66 + Math.random() * 40 | 0},0.3)`;
      g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    }
    g.strokeStyle = "rgba(0,0,0,.4)";
    g.lineWidth = 2;
    for (let i = 0; i <= w; i += 32) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.moveTo(0, i); g.lineTo(w, i); g.stroke();
    }
  });

  // Dusk sky gradient (non-repeating background).
  const skyCanvas = document.createElement("canvas");
  skyCanvas.width = 2; skyCanvas.height = 256;
  const sg = skyCanvas.getContext("2d");
  const gr = sg.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, "#0c1420");
  gr.addColorStop(0.55, "#1c2c3e");
  gr.addColorStop(1, "#3a4a55");
  sg.fillStyle = gr;
  sg.fillRect(0, 0, 2, 256);
  T.sky = new THREE.CanvasTexture(skyCanvas);
  T.sky.colorSpace = THREE.SRGBColorSpace;

  return T;
}
