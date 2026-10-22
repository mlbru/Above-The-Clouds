// Browser fullscreen (Chrome, Edge, Firefox, Safari). Must be triggered by a
// real user gesture, so it is also wired to a native keydown listener.
//
// Esc is the game's pause/back key, but browsers leave fullscreen on Esc. Where
// the Keyboard Lock API exists (Chrome, Edge, Opera) we lock Esc while in
// fullscreen: a tap reaches the game, and holding Esc still leaves fullscreen.
export function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

export const canLockEscape = () => typeof navigator !== 'undefined' && !!(navigator.keyboard && navigator.keyboard.lock);

function lockEscape() {
  if (!canLockEscape()) return;
  try { Promise.resolve(navigator.keyboard.lock(['Escape'])).catch(() => {}); } catch { /* not allowed */ }
}

function unlockEscape() {
  try { if (canLockEscape()) navigator.keyboard.unlock(); } catch { /* ignore */ }
}

export function toggleFullscreen() {
  try {
    if (isFullscreen()) {
      unlockEscape();
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      return Promise.resolve(false);
    }
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    const p = req.call(el, { navigationUI: 'hide' });
    return Promise.resolve(p).then(() => { lockEscape(); return true; }).catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
}

// F toggles fullscreen anywhere in the game. Entering fullscreen any other way
// (browser menu, F11 in some browsers) also gets the Esc lock.
export function installFullscreenKey() {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyF' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !window.__atcTyping) toggleFullscreen();
  });
  const onChange = () => (isFullscreen() ? lockEscape() : unlockEscape());
  document.addEventListener('fullscreenchange', onChange);
  document.addEventListener('webkitfullscreenchange', onChange);
}
