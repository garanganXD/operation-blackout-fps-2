// input.js — keyboard / mouse / pointer-lock capture. Exposes a single `input`
// object that gameplay modules read, and edge-triggered `pressed` codes that
// main.js clears once per simulation step.
export const input = {
  keys: new Set(),       // codes currently held
  pressed: new Set(),    // codes pressed since the last step (edge-triggered)
  mouseDX: 0,
  mouseDY: 0,
  firing: false,
  clicked: false,     // edge-triggered click on the canvas (start round / restart)
  focus: false,       // right-mouse held (steady aim)
  locked: false,
  down(code) { return this.keys.has(code); },
  hit(code) { return this.pressed.has(code); },
};

export function initInput(canvas) {
  window.addEventListener("keydown", (e) => {
    if (e.code === "Tab") e.preventDefault();
    if (!input.keys.has(e.code)) input.pressed.add(e.code);
    input.keys.add(e.code);
  });
  window.addEventListener("keyup", (e) => {
    input.keys.delete(e.code);
  });
  window.addEventListener("blur", () => {
    input.keys.clear();
    input.firing = false;
  });
  document.addEventListener("mousemove", (e) => {
    if (input.locked) {
      input.mouseDX += e.movementX;
      input.mouseDY += e.movementY;
    }
  });
  document.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
      input.firing = true;
      if (e.target === canvas) input.clicked = true;
    } else if (e.button === 2) {
      input.focus = true;
    }
  });
  document.addEventListener("mouseup", (e) => {
    if (e.button === 0) input.firing = false;
    else if (e.button === 2) input.focus = false;
  });
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("pointerlockchange", () => {
    input.locked = document.pointerLockElement === canvas;
  });
}

export function lockPointer() {
  try {
    const p = document.body.requestPointerLock();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch (e) { /* ignore */ }
}

export function unlockPointer() {
  try {
    const p = document.exitPointerLock();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch (e) { /* ignore */ }
}
