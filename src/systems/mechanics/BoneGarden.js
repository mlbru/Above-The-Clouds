// The Bone Garden's rule. Many holds here are old bone, and bone snaps if you
// hang on it too long (the crumbling hazard; see SegmentGenerator and the
// biome's hazards). And the skulls in their niches listen: every miss rattles
// one. On the third rattle the dragon above growls, and dread tightens the
// timing of the next few climbs. A ledge quiets the skulls again.
export const BONE_GARDEN = {
  minWeight: 0.5,
  rattlesToGrowl: 3,
  // Climbs that start in dread, and how much their timing window shrinks.
  dreadClimbs: 3,
  dreadWindow: 0.85,
};

export class BoneGarden {
  constructor(rng, cfg = BONE_GARDEN) {
    this.cfg = cfg;
    this.inside = 0;
    this.rattles = 0;
    this.dread = 0;
  }

  update(dt, weight) {
    this.inside = weight;
    // Out of the garden the skulls fall silent and the dread lifts.
    if (weight < this.cfg.minWeight) { this.rattles = 0; this.dread = 0; }
    return null;
  }

  get active() { return this.inside >= this.cfg.minWeight; }

  // A miss in the garden. Returns 'rattle' or 'growl' (the third), or null outside it.
  onMiss() {
    if (!this.active) return null;
    this.rattles++;
    if (this.rattles < this.cfg.rattlesToGrowl) return 'rattle';
    this.rattles = 0;
    this.dread = this.cfg.dreadClimbs;
    return 'growl';
  }

  // A ledge: the skulls quiet down (the dread stays until it has run out).
  rest() { this.rattles = 0; }

  // Routes offered while in dread are tighter; each climb started uses one up.
  decorateRoutes(routes) {
    if (!this.active || this.dread <= 0) return;
    for (const r of routes) {
      if (r.dread) continue;
      r.dread = true;
      r.windowScale *= this.cfg.dreadWindow;
      r.tags = [...(r.tags || []), 'DREAD'];
    }
  }

  // A climb has started (in dread or not).
  onClimb(route) { if (route.dread && this.dread > 0) this.dread--; }

  weather() { return { snow: 0, mist: 0.1 * Math.min(1, this.dread), wind: 0 }; }
}
