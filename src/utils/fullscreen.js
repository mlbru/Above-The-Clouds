// Browser fullscreen (Chrome, Edge, Firefox, Safari). Must be triggered by a
// real user gesture, so it is also wired to a native keydown listener.
export function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

export function toggleFullscreen() {
  try {
    if (isFullscreen()) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      return Promise.resolve(false);
    }
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    const p = req.call(el, { navigationUI: 'hide' });
    return Promise.resolve(p).then(() => true).catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
}

// F toggles fullscreen anywhere in the game.
export function installFullscreenKey() {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyF' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !window.__atcTyping) toggleFullscreen();
  });
}
