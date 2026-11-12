// The Cascade's rule: spray. Every couple of climbs a waterfall swings across
// the wall and a curtain of spray sweeps across the note track while you
// climb: notes behind it ripple and bob, so you read them through moving
// water (all of it seen, nothing heard). Those holds are wet: a climb in the
// spray costs a little more grip, but every perfect hit in it paints a band
// of the rainbow, and a full rainbow makes your next climb free.
export const SPRAY = {
  minWeight: 0.5,
  // Climbs between curtains: a random pick from this range.
  every: [1, 2],
  // Wet holds cost this much more grip.
  costScale: 1.2,
  // Perfect hits in the spray to fill the rainbow (one band each).
  rainbowNeed: 6,
  // How long (beats) the curtain takes to cross the whole track, and its width (px).
  sweepBeats: 8,
  width: 52,
};

export class Spray {
  constructor(rng, cfg = SPRAY) {
    this.rng = rng;
    this.cfg = cfg;
    this.inside = 0;
    this.wait = this.rng.int(cfg.every[0], cfg.every[1]);
    this.rainbow = 0;
  }

  update(dt, weight) {
    this.inside = weight;
    if (weight < this.cfg.minWeight) this.rainbow = 0;
    return null;
  }

  get active() { return this.inside >= this.cfg.minWeight; }

  decorateRoutes(routes) {
    if (!this.active || routes.some((r) => r.spray)) return;
    if (this.wait-- > 0) return;
    this.wait = this.rng.int(this.cfg.every[0], this.cfg.every[1]);
    // The curtain comes in from one side and sweeps across: from the right
    // (it meets the notes head on) or from the left (it chases them).
    const fromLeft = this.rng.chance(0.4);
    for (const r of routes) {
      r.spray = { fromLeft, sweepBeats: this.cfg.sweepBeats, width: this.cfg.width };
      r.gripCost = +(r.gripCost * this.cfg.costScale).toFixed(1);
      r.tags = [...(r.tags || []), 'SPRAY'];
    }
  }

  // A perfect hit in the spray: one more band. Returns true when the
  // rainbow is complete (it starts over).
  paint() {
    this.rainbow++;
    if (this.rainbow < this.cfg.rainbowNeed) return false;
    this.rainbow = 0;
    return true;
  }

  weather() { return { snow: 0, mist: this.active ? 0.15 : 0, wind: 0 }; }
}
