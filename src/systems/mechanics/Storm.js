// The Storm Crown's rule: thunderstorms roll over the summit ridge. While a
// storm rages there is no time to dither: hanging on a hold drains grip several
// times faster, with no grace period. Lightning lights up the wall. Climb on
// quickly, or sit it out on a ledge (ledges never drain).
export const STORM = {
  firstCalmSec: 14,
  calmSec: [30, 50],
  warnSec: 6,
  stormSec: 22,
  clearSec: 5,
  minWeight: 0.5,
  // How much faster grip drains while you hang and choose during a storm.
  hangScale: 5,
  // Seconds between lightning strikes while the storm rages.
  strikeSec: [2.2, 5],
  weather: { snow: 0, mist: 0.4, wind: 0.9 },
};

export class Storm {
  constructor(rng, cfg = STORM) {
    this.rng = rng;
    this.cfg = cfg;
    this.phase = 'calm';
    this.left = cfg.firstCalmSec * 1000;
    this.total = this.left;
    this.weight = 0;
    this.inside = 0;
    this.strikeIn = 0;
  }

  get phaseMs() {
    const c = this.cfg;
    return { warning: c.warnSec, storm: c.stormSec, clearing: c.clearSec }[this.phase] * 1000;
  }

  get raw() {
    if (this.phase === 'calm') return 0;
    const p = 1 - this.left / this.phaseMs;
    if (this.phase === 'warning') return 0.3 * p;
    if (this.phase === 'storm') return Math.min(1, 0.3 + p * 6);
    return 1 - p;
  }

  get intensity() { return this.raw * this.weight; }
  get active() { return this.phase === 'storm' && this.intensity > 0.5 && this.inside >= this.cfg.minWeight; }
  // Multiplier for grip drain while hanging (1 when calm).
  get hangScale() { return this.active ? this.cfg.hangScale : 1; }

  // Returns 'warning', 'storm', 'clear' on phase changes and 'strike' for lightning.
  update(dt, weight) {
    this.inside = weight;
    this.weight += (weight - this.weight) * Math.min(1, dt / 600);
    if (this.phase === 'calm' && weight < this.cfg.minWeight) return null;
    this.left -= dt;
    if (this.left > 0) {
      if (this.phase !== 'storm' || this.intensity < 0.4) return null;
      this.strikeIn -= dt;
      if (this.strikeIn > 0) return null;
      this.strikeIn = this.rng.range(this.cfg.strikeSec[0], this.cfg.strikeSec[1]) * 1000;
      return 'strike';
    }
    const next = { calm: 'warning', warning: 'storm', storm: 'clearing', clearing: 'calm' }[this.phase];
    this.phase = next;
    if (next === 'calm') this.left = this.rng.range(this.cfg.calmSec[0], this.cfg.calmSec[1]) * 1000;
    else this.left = this.phaseMs;
    this.total = this.left;
    if (next === 'storm') this.strikeIn = 600;
    return next === 'clearing' ? 'clear' : next === 'calm' ? null : next;
  }

  // For the HUD's storm meter: how far the current phase has run (0..1).
  get progress() { return 1 - Math.max(0, this.left) / this.total; }

  weather() {
    const k = this.intensity, w = this.cfg.weather;
    return { snow: w.snow * k, mist: w.mist * k, wind: w.wind * k };
  }

  decorateRoutes(routes) {
    if (!this.active) return;
    const mods = { tag: 'STORM', hint: 'STORM: GRIP DRAINS FAST WHILE YOU HANG', discovery: 'thunderstorm' };
    routes.forEach((r) => { r.mods = mods; });
  }
}
