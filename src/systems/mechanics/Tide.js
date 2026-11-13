// The Fossil Reef's rule: the ghost tide. The old sea still comes in and
// goes out, seen as a shimmering waterline climbing the screen. While the
// tide is in you float (climbs cost less grip) but the water bends the
// light: notes waver until they are close to the line. And at any tide some
// notes are ammonites: hit one perfect and the fossil gives you a gem.
export const TIDE = {
  minWeight: 0.5,
  // One cycle: out, rising, in, falling (ms).
  outMs: 15000, riseMs: 5000, inMs: 13000, fallMs: 5000,
  // While the tide is in: grip cost per climb, and where notes clear (ms
  // before the line; further out they waver and fade).
  gripScale: 0.75, clearMs: 520,
  shellChance: 0.5, safeShellChance: 0.2,
};

export class Tide {
  constructor(rng, cfg = TIDE) {
    this.rng = rng;
    this.cfg = cfg;
    this.inside = 0;
    this.t = rng.range(0, cfg.outMs);
    this.level = 0;
    this.phase = 'out';
  }

  get cycle() { const c = this.cfg; return c.outMs + c.riseMs + c.inMs + c.fallMs; }
  get high() { return this.level > 0.6; }

  update(dt, weight) {
    this.inside = weight;
    if (weight <= 0.01) { this.level = Math.max(0, this.level - dt / 2000); return null; }
    const c = this.cfg;
    this.t = (this.t + dt) % this.cycle;
    const t = this.t;
    let phase, level;
    if (t < c.outMs) { phase = 'out'; level = 0; }
    else if (t < c.outMs + c.riseMs) { phase = 'rising'; level = (t - c.outMs) / c.riseMs; }
    else if (t < c.outMs + c.riseMs + c.inMs) { phase = 'in'; level = 1; }
    else { phase = 'falling'; level = 1 - (t - c.outMs - c.riseMs - c.inMs) / c.fallMs; }
    this.level = level * level * (3 - 2 * level) * Math.min(1, weight * 1.4);
    const was = this.phase;
    this.phase = phase;
    return was !== phase && weight >= c.minWeight && (phase === 'rising' || phase === 'falling') ? phase : null;
  }

  decorateRoutes(routes) {
    if (this.inside < this.cfg.minWeight) return;
    for (const r of routes) {
      if (r.tide !== undefined) continue;
      r.tide = this.high;
      if (r.tide) {
        r.gripCost = Math.round(r.gripCost * this.cfg.gripScale * 10) / 10;
        r.tags = ['TIDE', ...(r.tags || [])];
      }
      // An ammonite on one plain note.
      if (r.notes.length >= 2 && this.rng.chance(r.type === 'safe' ? this.cfg.safeShellChance : this.cfg.shellChance)) {
        const plain = r.notes.map((n, i) => i).filter((i) => i > 0 && !r.notes[i].hold && !r.notes[i].still && !r.notes[i].echo && !r.notes[i].chord && !r.notes[i].hidden);
        if (plain.length) {
          const i = this.rng.pick(plain);
          r.notes = r.notes.map((n, j) => (j === i ? { ...n, shell: true } : n));
          r.tags = ['AMMONITE', ...(r.tags || [])];
        }
      }
    }
  }

  weather() { return { snow: 0, mist: 0, wind: 0 }; }
}
