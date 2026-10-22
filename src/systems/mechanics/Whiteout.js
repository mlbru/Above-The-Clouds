// The Frozen Reach's rule: now and then a blizzard rolls in. During a
// whiteout the notes only appear shortly before the hit line (blind notes stay
// visible, so nothing is ever unreadable), but gems turn up twice as often.
// Wait it out on a ledge, or climb through it by feel.
export const WHITEOUT = {
  firstCalmSec: 16,
  calmSec: [38, 62],
  warnSec: 7,
  stormSec: 24,
  clearSec: 6,
  // The storm only builds while you are mostly inside the biome.
  minWeight: 0.5,
  revealMs: 650,
  gemScale: 2,
  weather: { snow: 1.1, mist: 0.35, wind: 0.8 },
};

export class Whiteout {
  constructor(rng, cfg = WHITEOUT) {
    this.rng = rng;
    this.cfg = cfg;
    this.phase = 'calm';
    this.left = cfg.firstCalmSec * 1000;
    this.weight = 0;
    this.inside = 0;
  }

  get phaseMs() {
    const c = this.cfg;
    return { warning: c.warnSec, storm: c.stormSec, clearing: c.clearSec }[this.phase] * 1000;
  }

  // Storm strength 0..1 (before the biome weight is applied).
  get raw() {
    if (this.phase === 'calm') return 0;
    const p = 1 - this.left / this.phaseMs;
    if (this.phase === 'warning') return 0.35 * p;
    if (this.phase === 'storm') return Math.min(1, 0.35 + p * 6);
    return 1 - p;
  }

  get intensity() { return this.raw * this.weight; }
  // Routes chosen now are climbed in the whiteout.
  get active() { return this.phase === 'storm' && this.intensity > 0.5 && this.inside >= this.cfg.minWeight; }

  // weight: how much of the view belongs to this mechanic's biome (0..1).
  // Returns 'warning', 'storm' or 'clear' when the phase changes.
  update(dt, weight) {
    this.inside = weight;
    this.weight += (weight - this.weight) * Math.min(1, dt / 600);
    if (this.phase === 'calm' && weight < this.cfg.minWeight) return null;
    this.left -= dt;
    if (this.left > 0) return null;
    const next = { calm: 'warning', warning: 'storm', storm: 'clearing', clearing: 'calm' }[this.phase];
    this.phase = next;
    if (next === 'calm') this.left = this.rng.range(this.cfg.calmSec[0], this.cfg.calmSec[1]) * 1000;
    else this.left = this.phaseMs;
    return next === 'clearing' ? 'clear' : next === 'calm' ? null : next;
  }

  weather() {
    const k = this.intensity, w = this.cfg.weather;
    return { snow: w.snow * k, mist: w.mist * k, wind: w.wind * k };
  }

  decorateRoutes(routes) {
    const mods = this.routeMods();
    if (mods) routes.forEach((r) => { r.mods = mods; });
  }

  routeMods() {
    if (!this.active) return null;
    return { tag: 'WHITEOUT', hint: 'WHITEOUT: NOTES SHOW LATE  \u2022  GEMS X2', revealMs: this.cfg.revealMs, gemScale: this.cfg.gemScale, discovery: 'whiteout' };
  }
}
