// The Crystal Heights' rule: crystals grow over the holds while you hang and
// decide. First the risky route seals, then the normal one; the safe route
// always stays open. Choosing quickly keeps every option; hesitating leaves
// only the safe way up. A sealed hold stays sealed until you climb on.
export const CRYSTAL_GROWTH = {
  minWeight: 0.5,
  // Time (ms) from the moment the routes appear until that route type seals.
  sealMs: { risky: 2600, normal: 4600 },
  // Hard and Summit grow faster.
  fastScale: 0.8,
};

export class CrystalGrowth {
  constructor(rng, cfg = CRYSTAL_GROWTH) {
    this.cfg = cfg;
    this.inside = 0;
  }

  update(dt, weight) { this.inside = weight; return null; }

  decorateRoutes(routes) {
    if (this.inside < this.cfg.minWeight) return;
    for (const r of routes) {
      const ms = this.cfg.sealMs[r.type];
      if (ms) r.seal = { ms };
    }
  }

  weather() { return { snow: 0, mist: 0, wind: 0 }; }
}

// How far each route has grown over (0..1) after `elapsedMs`; 1 = sealed.
export function growthOf(route, elapsedMs, scale = 1) {
  if (!route.seal) return 0;
  return Math.max(0, Math.min(1, elapsedMs / (route.seal.ms * scale)));
}
