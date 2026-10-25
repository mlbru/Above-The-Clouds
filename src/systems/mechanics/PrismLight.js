// The Crystal Heights' rule: sunlight splits in the crystal and a beam sweeps
// slowly across the offered routes while you decide. Start a climb on the
// route the beam is lighting and that climb costs no grip for its hits, and a
// gem on it is worth double. Nothing is ever taken away: a well-timed choice
// is rewarded, a slow or unlucky one is just a normal climb.
export const PRISM_LIGHT = {
  minWeight: 0.5,
  // How long the beam rests on each route before moving on (ms).
  dwellMs: 1100,
  // Share of a lit climb's note cost that is still paid (misses still cost).
  costScale: 0,
  gemScale: 2,
};

export class PrismLight {
  constructor(rng, cfg = PRISM_LIGHT) {
    this.rng = rng;
    this.cfg = cfg;
    this.inside = 0;
  }

  update(dt, weight) { this.inside = weight; return null; }

  // Every route takes part; the beam starts on a random one.
  decorateRoutes(routes) {
    if (this.inside < this.cfg.minWeight || routes.length < 2) return;
    const start = this.rng.int(0, routes.length - 1);
    routes.forEach((r) => { r.prism = { start }; });
  }

  weather() { return { snow: 0, mist: 0, wind: 0 }; }
}

// Which route the beam lights after `elapsedMs`: it moves one route at a time
// and bounces at the ends (0 1 2 1 0 1 ...), starting at `start`.
export function litIndex(elapsedMs, count, start = 0, cfg = PRISM_LIGHT) {
  if (count < 2) return 0;
  const period = 2 * (count - 1);
  const k = (Math.floor(Math.max(0, elapsedMs) / cfg.dwellMs) + start) % period;
  return k < count ? k : period - k;
}
