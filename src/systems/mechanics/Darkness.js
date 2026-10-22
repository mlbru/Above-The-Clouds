// The Obsidian Spires' rule: the black glass swallows the light. Notes on the
// track are only faint shapes that flash up on every beat, so you read the
// rhythm from the pulse. Blind notes flash like the rest (never unseen), and
// the headlamp burns as at night.
export const DARKNESS = {
  minWeight: 0.5,
  // Brightness of a note between flashes (the next note a little brighter).
  dimAlpha: 0.12,
  currentAlpha: 0.24,
  // How long a beat flash takes to fade (ms).
  flashMs: 260,
  // How far the scene light drops towards this colour.
  shade: 0x2a2440,
  shadeAmount: 0.55,
};

export class Darkness {
  constructor(rng, cfg = DARKNESS) {
    this.cfg = cfg;
    this.inside = 0;
    this.level = 0;
  }

  update(dt, weight) {
    this.inside = weight;
    this.level += (weight - this.level) * Math.min(1, dt / 800);
    return null;
  }

  // 0..1: how dark the scene is right now.
  get intensity() { return this.level; }

  decorateRoutes(routes) {
    if (this.inside < this.cfg.minWeight) return;
    const mods = { tag: 'DARK', hint: 'DARK: NOTES FLASH ON THE BEAT', dark: this.cfg };
    routes.forEach((r) => { r.mods = mods; });
  }

  weather() { return { snow: 0, mist: 0, wind: 0 }; }
}

// Note brightness in the dark: a flash on every beat of the route's grid.
export function darkAlpha(cfg, now, firstNoteTime, beatMs, isCurrent) {
  const phase = (((now - firstNoteTime) % beatMs) + beatMs) % beatMs;
  const flash = Math.max(0, 1 - phase / cfg.flashMs);
  return Math.max(isCurrent ? cfg.currentAlpha : cfg.dimAlpha, flash * (isCurrent ? 1 : 0.85));
}
