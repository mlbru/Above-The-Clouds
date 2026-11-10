// Gamepad / controller support. Like the touch swipes, the pad acts as a
// keyboard: each button dispatches keydown/keyup on window, so every scene,
// menu and hold note works exactly as with keys. Pads are polled every frame
// and a press is stamped with the pad's own timestamp (same clock as
// event.timeStamp), so the beat is judged on the press, not on the poll.
// Uses the browser's "standard" layout (Xbox names; PlayStation and Switch
// pads map to the same positions).
import { Audio } from '../systems/AudioSystem.js';

// Standard-layout button index -> key code.
const BUTTONS = {
  0: 'Enter', // A / Cross: confirm, start the climb
  1: 'Escape', // B / Circle: back
  2: 'KeyR', // X / Square: rest at a ledge
  3: 'KeyT', // Y / Triangle: trader
  4: 'KeyV', // LB: view
  5: 'KeyC', // RB: photo
  8: 'KeyL', // Back / Select: leaderboard
  9: 'Escape', // Start / Options: pause
  12: 'ArrowUp',
  13: 'ArrowDown',
  14: 'ArrowLeft',
  15: 'ArrowRight',
};
// Left stick: pushed past PRESS it counts as that arrow, released below LET_GO.
const PRESS = 0.55;
const LET_GO = 0.35;

function sendKey(type, code, timeStamp) {
  const e = new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true });
  if (timeStamp !== undefined) {
    try { Object.defineProperty(e, 'timeStamp', { value: timeStamp }); } catch { /* keep the real stamp */ }
  }
  window.dispatchEvent(e);
}

export const gamepadConnected = () => {
  try { return [...(navigator.getGamepads ? navigator.getGamepads() : [])].some((p) => p && p.connected); } catch { return false; }
};

// The arrow the left stick points at, or null. Keeps the current one until
// the stick drops below LET_GO, so a wobbly stick does not stutter.
function stickKey(pad, current) {
  const x = pad.axes[0] || 0, y = pad.axes[1] || 0;
  if (current) {
    const along = { ArrowLeft: -x, ArrowRight: x, ArrowUp: -y, ArrowDown: y }[current];
    if (along > LET_GO) return current;
  }
  if (Math.max(Math.abs(x), Math.abs(y)) < PRESS) return null;
  return Math.abs(x) > Math.abs(y) ? (x < 0 ? 'ArrowLeft' : 'ArrowRight') : (y < 0 ? 'ArrowUp' : 'ArrowDown');
}

export function installGamepadControls() {
  if (!navigator.getGamepads) return;
  // Per pad: the keys it holds down, each counted once even if two buttons
  // (d-pad and stick) send the same key.
  const pads = new Map();
  let polling = false;

  const poll = () => {
    const seen = new Set();
    for (const pad of navigator.getGamepads()) {
      if (!pad || !pad.connected) continue;
      seen.add(pad.index);
      const prev = pads.get(pad.index) || { held: new Set(), stick: null };
      const stick = stickKey(pad, prev.stick);
      const held = new Set();
      pad.buttons.forEach((b, i) => { if (BUTTONS[i] && b.pressed) held.add(BUTTONS[i]); });
      if (stick) held.add(stick);
      const t = pad.timestamp || undefined;
      for (const k of held) if (!prev.held.has(k)) { Audio.init(); sendKey('keydown', k, t); }
      for (const k of prev.held) if (!held.has(k)) sendKey('keyup', k);
      pads.set(pad.index, { held, stick });
    }
    // A pad that went away lets go of everything it held.
    for (const [i, p] of pads) {
      if (seen.has(i)) continue;
      for (const k of p.held) sendKey('keyup', k);
      pads.delete(i);
    }
    if (seen.size) requestAnimationFrame(poll);
    else polling = false;
  };
  const start = () => { if (!polling) { polling = true; requestAnimationFrame(poll); } };

  window.addEventListener('gamepadconnected', start);
  // A pad already plugged in (and pressed) before the page loaded.
  if (gamepadConnected()) start();
}
