// Touch controls for phones and tablets: swipe anywhere on the screen. A swipe
// left, up, right or down acts as that arrow key: it dispatches keydown/keyup
// on window, so every scene, menu and hold note works exactly as with a
// keyboard. The key goes down as soon as the finger has moved far enough and
// is stamped with the moment the finger touched the glass, so the beat is
// judged on the touch, not on the end of the swipe. Keep the finger down to
// hold a note; two fingers swipe two arrows at once. Taps still reach the
// game (route cards, menus, buttons) as before.
import { Audio } from '../systems/AudioSystem.js';
import { toggleFullscreen, isFullscreen } from '../utils/fullscreen.js';
import { IS_TOUCH, IS_PORTRAIT } from '../config/gameConfig.js';

export function isTouchDevice() {
  return IS_TOUCH;
}

const KEYS = { L: 'ArrowLeft', U: 'ArrowUp', R: 'ArrowRight', D: 'ArrowDown', PAUSE: 'Escape' };
const ARROW = { L: '◀', U: '▲', R: '▶', D: '▼' };
// How far (CSS px) a finger moves before it counts as a swipe.
const SWIPE_PX = 14;

function sendKey(type, code, timeStamp) {
  const e = new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true });
  // Backdate the key to the touch (ClimbScene.now() reads event.timeStamp).
  if (timeStamp !== undefined) {
    try { Object.defineProperty(e, 'timeStamp', { value: timeStamp }); } catch { /* keep the real stamp */ }
  }
  window.dispatchEvent(e);
}

const CSS = `
#touch-ui { position: fixed; inset: 0; pointer-events: none; z-index: 10; user-select: none; -webkit-user-select: none; }
#touch-ui .top { position: absolute; top: max(8px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); display: flex; gap: 10px; }
#touch-ui .small { pointer-events: auto; padding: 6px 12px; border-radius: 8px; background: rgba(22, 20, 31, 0.55);
  border: 1px solid rgba(244, 239, 228, 0.4); color: #f4efe4; font: 600 13px/1 system-ui, sans-serif; touch-action: none; }
#touch-ui.portrait .top { top: max(4px, env(safe-area-inset-top)); gap: 6px; }
#touch-ui.portrait .small { padding: 5px 9px; font-size: 13px; }
#touch-ui .mark { position: absolute; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; font: 700 22px/1 system-ui, sans-serif;
  color: #16141f; background: rgba(242, 193, 78, 0.85); opacity: 0.9; transition: transform 0.25s ease-out, opacity 0.25s ease-out; }
#touch-ui .mark.out { opacity: 0; }
#relayout { position: fixed; left: 50%; bottom: max(14px, env(safe-area-inset-bottom)); transform: translateX(-50%); z-index: 20;
  display: none; padding: 10px 16px; border-radius: 10px; background: #f2c14e; color: #16141f;
  font: 700 14px/1.2 system-ui, sans-serif; text-align: center; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4); }
`;

function makeSmall(label, onTap) {
  const b = document.createElement('div');
  b.className = 'small';
  b.textContent = label;
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); Audio.init(); onTap(b); });
  return b;
}

// A short-lived arrow where the swipe went, so you can see what the game got.
function showMark(ui, dir, x, y) {
  const m = document.createElement('div');
  m.className = 'mark';
  m.textContent = ARROW[dir];
  m.style.left = `${x}px`;
  m.style.top = `${y}px`;
  ui.appendChild(m);
  const d = { L: [-30, 0], R: [30, 0], U: [0, -30], D: [0, 30] }[dir];
  requestAnimationFrame(() => {
    m.style.transform = `translate(${d[0]}px, ${d[1]}px)`;
    m.classList.add('out');
  });
  setTimeout(() => m.remove(), 300);
}

function installSwipes(ui) {
  const fingers = new Map();
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    Audio.init();
    fingers.set(e.pointerId, { x0: e.clientX, y0: e.clientY, t0: e.timeStamp, key: null });
  }, true);
  window.addEventListener('pointermove', (e) => {
    const f = fingers.get(e.pointerId);
    if (!f || f.key) return;
    const dx = e.clientX - f.x0, dy = e.clientY - f.y0;
    if (Math.hypot(dx, dy) < SWIPE_PX) return;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'L' : 'R') : (dy < 0 ? 'U' : 'D');
    f.key = KEYS[dir];
    sendKey('keydown', f.key, f.t0);
    showMark(ui, dir, f.x0, f.y0);
  }, true);
  const end = (e) => {
    const f = fingers.get(e.pointerId);
    if (!f) return;
    fingers.delete(e.pointerId);
    if (f.key) sendKey('keyup', f.key);
  };
  window.addEventListener('pointerup', end, true);
  window.addEventListener('pointercancel', end, true);
}

// The layout (portrait or landscape) is fixed at start. Turning the phone
// keeps the game going, letterboxed, and offers a reload into the new layout.
function installRelayout() {
  const b = document.createElement('div');
  b.id = 'relayout';
  document.body.appendChild(b);
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); window.location.reload(); });
  const check = () => {
    const portrait = window.innerHeight > window.innerWidth;
    b.textContent = portrait ? 'TAP TO PLAY UPRIGHT' : 'TAP TO PLAY SIDEWAYS';
    b.style.display = portrait !== IS_PORTRAIT ? 'block' : 'none';
  };
  window.addEventListener('resize', check);
  check();
}

export function installTouchControls() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const ui = document.createElement('div');
  ui.id = 'touch-ui';
  const top = document.createElement('div');
  top.className = 'top';
  // Upright there is little room between the HUD's corners: icons only.
  if (IS_PORTRAIT) ui.classList.add('portrait');
  const fsLabel = () => (IS_PORTRAIT ? (isFullscreen() ? '⤡' : '⤢') : isFullscreen() ? 'EXIT FULLSCREEN' : 'FULLSCREEN');
  top.append(makeSmall(IS_PORTRAIT ? 'II' : 'II  PAUSE', () => { sendKey('keydown', KEYS.PAUSE); sendKey('keyup', KEYS.PAUSE); }));
  const fsSupported = document.fullscreenEnabled || document.webkitFullscreenEnabled;
  if (fsSupported) top.append(makeSmall(fsLabel(), (b) => toggleFullscreen().then(() => { b.textContent = fsLabel(); })));
  ui.append(top);
  document.body.appendChild(ui);
  installSwipes(ui);
  if (!new URLSearchParams(window.location.search).has('portrait')) installRelayout();

  // Stop the page from scrolling, zooming or bouncing while playing.
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
}
