// audio.js — zero-asset synthesized sound effects via the Web Audio API.
// The context is created lazily on the first user gesture (browsers require
// this). Every effect is generated from oscillators / noise buffers.

let ctx = null;

export function initAudio() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
}

function ready() {
  if (!ctx) return false;
  if (ctx.state === "suspended") ctx.resume();
  return true;
}

function noiseBuffer(seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function out(vol, t) {
  const g = ctx.createGain();
  g.connect(ctx.destination);
  g.gain.value = vol;
  if (vol > 0.001) {
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  }
  return g;
}

// type -> synth. opt: { vol, dist } (dist scales volume down with distance).
export function sfx(type, opt = {}) {
  if (!ready()) return;
  const t = ctx.currentTime;
  const dist = opt.dist || 0;
  const fall = 1 / (1 + dist * 0.06); // quieter with distance
  const vol = (opt.vol ?? 1) * fall;
  if (vol <= 0.01) return;
  const g = out(vol, t);

  switch (type) {
    case "shot": {
      const s = ctx.createBufferSource();
      s.buffer = noiseBuffer(0.12);
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(2400, t);
      f.frequency.exponentialRampToValueAtTime(400, t + 0.12);
      s.connect(f); f.connect(g); s.start();
      break;
    }
    case "dry": { // empty click
      const o = ctx.createOscillator();
      o.type = "square"; o.frequency.value = 900;
      const gg = ctx.createGain();
      gg.gain.setValueAtTime(vol * 0.5, t);
      gg.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      o.connect(gg); gg.connect(ctx.destination); o.start(); o.stop(t + 0.05);
      break;
    }
    case "reload": {
      for (let i = 0; i < 2; i++) {
        const o = ctx.createOscillator();
        o.type = "square"; o.frequency.value = 700 - i * 250;
        const gg = ctx.createGain();
        gg.gain.setValueAtTime(vol * 0.25, t + i * 0.12);
        gg.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.05);
        o.connect(gg); gg.connect(ctx.destination); o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.06);
      }
      break;
    }
    case "hit": {
      const o = ctx.createOscillator();
      o.type = "square"; o.frequency.value = 220;
      const gg = ctx.createGain();
      gg.gain.setValueAtTime(vol * 0.4, t);
      gg.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.connect(gg); gg.connect(ctx.destination); o.start(); o.stop(t + 0.1);
      break;
    }
    case "headshot": {
      const o = ctx.createOscillator();
      o.type = "square"; o.frequency.value = 1600;
      const gg = ctx.createGain();
      gg.gain.setValueAtTime(vol * 0.4, t);
      gg.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      o.connect(gg); gg.connect(ctx.destination); o.start(); o.stop(t + 0.08);
      break;
    }
    case "kill": {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(500, t);
      o.frequency.exponentialRampToValueAtTime(950, t + 0.15);
      const gg = ctx.createGain();
      gg.gain.setValueAtTime(vol * 0.5, t);
      gg.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      o.connect(gg); gg.connect(ctx.destination); o.start(); o.stop(t + 0.25);
      break;
    }
    case "round": {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(330, t);
      o.frequency.setValueAtTime(440, t + 0.15);
      o.frequency.setValueAtTime(550, t + 0.3);
      const gg = ctx.createGain();
      gg.gain.setValueAtTime(vol * 0.6, t);
      gg.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      o.connect(gg); gg.connect(ctx.destination); o.start(); o.stop(t + 0.6);
      break;
    }
    case "plant": {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(180, t);
      o.frequency.linearRampToValueAtTime(90, t + 0.5);
      const gg = ctx.createGain();
      gg.gain.setValueAtTime(vol * 0.4, t);
      gg.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      o.connect(gg); gg.connect(ctx.destination); o.start(); o.stop(t + 0.6);
      break;
    }
    case "boom": {
      const s = ctx.createBufferSource();
      s.buffer = noiseBuffer(0.7);
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(1600, t);
      f.frequency.exponentialRampToValueAtTime(120, t + 0.7);
      const gg = ctx.createGain();
      gg.gain.setValueAtTime(vol, t);
      gg.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      s.connect(f); f.connect(gg); gg.connect(ctx.destination); s.start();
      break;
    }
    case "nade": { // grenade pin / toss
      const o = ctx.createOscillator();
      o.type = "square"; o.frequency.value = 500;
      const gg = ctx.createGain();
      gg.gain.setValueAtTime(vol * 0.3, t);
      gg.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.connect(gg); gg.connect(ctx.destination); o.start(); o.stop(t + 0.09);
      break;
    }
    case "buy": {
      const o = ctx.createOscillator();
      o.type = "square"; o.frequency.value = 800;
      const gg = ctx.createGain();
      gg.gain.setValueAtTime(vol * 0.3, t);
      gg.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      o.connect(gg); gg.connect(ctx.destination); o.start(); o.stop(t + 0.07);
      break;
    }
    case "deny": { // can't afford / invalid
      const o = ctx.createOscillator();
      o.type = "square"; o.frequency.value = 180;
      const gg = ctx.createGain();
      gg.gain.setValueAtTime(vol * 0.3, t);
      gg.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(gg); gg.connect(ctx.destination); o.start(); o.stop(t + 0.14);
      break;
    }
    case "footstep": {
      const s = ctx.createBufferSource();
      s.buffer = noiseBuffer(0.05);
      const f = ctx.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = 300;
      const gg = ctx.createGain();
      gg.gain.setValueAtTime(vol * 0.12, t);
      gg.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      s.connect(f); f.connect(gg); gg.connect(ctx.destination); s.start();
      break;
    }
    default:
      break;
  }
}
