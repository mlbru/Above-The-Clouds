// The Starfall Crater's rule: stars still fall here. Every half a minute or
// so one comes down onto one of the routes offered (you watch it land).
// Climb that route and its star-metal pays by your streak: the longer the
// streak you carry onto it, the more it gives. Its notes shine brighter as
// your streak grows.
export const STARFALL = {
  minWeight: 0.5,
  everyMs: [20000, 32000],
  // Gems: 1, plus one per `streakStep` of streak at the start, up to `maxGems`.
  streakStep: 8, maxGems: 4,
};

export const starGems = (streak, cfg = STARFALL) => Math.min(cfg.maxGems, 1 + Math.floor(Math.max(0, streak) / cfg.streakStep));

export class Starfall {
  constructor(rng, cfg = STARFALL) {
    this.rng = rng;
    this.cfg = cfg;
    this.inside = 0;
    this.wait = rng.range(6000, 12000);
    this.ready = false;
  }

  update(dt, weight) {
    this.inside = weight;
    if (weight < this.cfg.minWeight || this.ready) return null;
    this.wait -= dt;
    if (this.wait > 0) return null;
    this.ready = true;
    return 'ready';
  }

  // A star waiting to fall lands on one route that climbs (never a ledge).
  decorateRoutes(routes) {
    if (this.inside < this.cfg.minWeight || !this.ready) return;
    const ok = routes.filter((r) => r.type !== 'safe' && !(r.target && r.target.kind === 'ledge') && !r.cave && !r.star);
    if (!ok.length) return;
    const r = this.rng.pick(ok);
    r.star = true;
    r.notes = r.notes.map((n) => ({ ...n, star: true }));
    r.tags = ['STAR-METAL', ...(r.tags || [])];
    this.ready = false;
    this.wait = this.rng.range(...this.cfg.everyMs);
  }

  weather() { return { snow: 0, mist: 0, wind: 0 }; }
}
