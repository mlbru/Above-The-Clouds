// On-screen touch controls for phones and tablets. Each button acts as a real
// key: it dispatches keydown/keyup on window, so every scene, menu and hold
// note works exactly as with a keyboard (including precise timestamps).
import { Audio } from '../systems/AudioSystem.js';
import { toggleFullscreen, isFullscreen } from '../utils/fullscreen.js';
import { IS_TOUCH } from '../config/gameConfig.js';

export function isTouchDevice() {
  return IS_TOUCH;
}

const KEYS = { L: 'ArrowLeft', U: 'ArrowUp', R: 'ArrowRight', PAUSE: 'Escape' };
const LABEL = { L: '◀', U: '▲', R: '▶' };

function sendKey(type, code) {
  window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }));
}

const CSS = `
#touch-ui { position: fixed; inset: 0; pointer-events: none; z-index: 10; user-select: none; -webkit-user-select: none; }
#touch-ui .pad { position: absolute; bottom: max(10px, env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 2vh; pointer-events: none; }
#touch-ui .pad.left { left: max(10px, env(safe-area-inset-left)); }
#touch-ui .pad.right { right: max(10px, env(safe-area-inset-right)); }
#touch-ui .row { display: flex; gap: 2vh; }
#touch-ui .btn { pointer-events: auto; width: 19vh; height: 19vh; min-width: 56px; min-height: 56px; border-radius: 22%;
  background: rgba(22, 20, 31, 0.38); border: 2px solid rgba(244, 239, 228, 0.45); color: rgba(244, 239, 228, 0.9);
  font: 700 7vh/1 system-ui, sans-serif; display: flex; align-items: center; justify-content: center;
  touch-action: none; -webkit-tap-highlight-color: transparent; }
#touch-ui .btn.down { background: rgba(242, 193, 78, 0.55); border-color: #f2c14e; color: #16141f; }
#touch-ui .top { position: absolute; top: max(8px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); display: flex; gap: 10px; }
#touch-ui .small { pointer-events: auto; padding: 6px 12px; border-radius: 8px; background: rgba(22, 20, 31, 0.55);
  border: 1px solid rgba(244, 239, 228, 0.4); color: #f4efe4; font: 600 13px/1 system-ui, sans-serif; touch-action: none; }
#rotate-hint { display: none; position: fixed; inset: 0; z-index: 20; background: #0d0f1a; color: #f4efe4;
  font: 600 18px/1.5 system-ui, sans-serif; align-items: center; justify-content: center; text-align: center; padding: 24px; }
@media (orientation: portrait) { #rotate-hint { display: flex; } }
`;

function makeButton(dir) {
  const b = document.createElement('div');
  b.className = 'btn';
  b.textContent = LABEL[dir];
  const active = new Set();
  const down = (e) => {
    e.preventDefault();
    Audio.init();
    if (active.size === 0) { sendKey('keydown', KEYS[dir]); b.classList.add('down'); }
    active.add(e.pointerId);
    try { b.setPointerCapture(e.pointerId); } catch { /* not supported */ }
  };
  const up = (e) => {
    if (!active.has(e.pointerId)) return;
    active.delete(e.pointerId);
    if (active.size === 0) { sendKey('keyup', KEYS[dir]); b.classList.remove('down'); }
  };
  b.addEventListener('pointerdown', down);
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('lostpointercapture', up);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  return b;
}

function makeSmall(label, onTap) {
  const b = document.createElement('div');
  b.className = 'small';
  b.textContent = label;
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); Audio.init(); onTap(b); });
  return b;
}

export function installTouchControls() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const ui = document.createElement('div');
  ui.id = 'touch-ui';
  // Two clusters so either thumb can reach UP; LEFT on the left, RIGHT on the right.
  const left = document.createElement('div');
  left.className = 'pad left';
  left.append(makeButton('U'), makeButton('L'));
  const right = document.createElement('div');
  right.className = 'pad right';
  right.append(makeButton('U'), makeButton('R'));
  const top = document.createElement('div');
  top.className = 'top';
  top.append(makeSmall('II  PAUSE', () => { sendKey('keydown', KEYS.PAUSE); sendKey('keyup', KEYS.PAUSE); }));
  const fsSupported = document.fullscreenEnabled || document.webkitFullscreenEnabled;
  if (fsSupported) top.append(makeSmall('FULLSCREEN', (b) => toggleFullscreen().then(() => { b.textContent = isFullscreen() ? 'EXIT FULLSCREEN' : 'FULLSCREEN'; })));
  ui.append(left, right, top);
  document.body.appendChild(ui);

  const rotate = document.createElement('div');
  rotate.id = 'rotate-hint';
  rotate.innerHTML = '<div><div style="font-size:44px">↻</div>Turn your phone sideways<br>to start climbing</div>';
  document.body.appendChild(rotate);

  // Stop the page from scrolling, zooming or bouncing while playing.
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
}
