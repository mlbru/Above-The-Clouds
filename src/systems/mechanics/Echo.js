// The Crystal Heights' rule: some routes carry an echo crystal. Before you
// climb, the crystal plays the route's rhythm once (chimes and light); then you
// play it back with the notes hidden. A fully perfect echo pays out grip, and
// echo routes carry gems more often.
export const ECHO = {
  chance: 0.5,
  minWeight: 0.5,
  // Silence between the crystal's call and your answer, in beats.
  gapBeats: 1.5,
  // Echo routes are played from memory, so their timing windows are a bit wider.
  windowScale: 1.15,
  perfectGrip: 15,
  gemScale: 2.5,
};

// Marks at most one shorter route (safe or normal) as an echo route. Its hold
// notes become plain notes: the crystal sings single tones. Pure, so the
// balance sim uses it too. `force` skips the chance roll. Returns the route or null.
export function addEcho(routes, rng, cfg = ECHO, force = false) {
  if (!force && !rng.chance(cfg.chance)) return null;
  const options = routes.filter((r) => !r.toLedge && (r.type === 'safe' || r.type === 'normal'));
  if (!options.length) return null;
  const r = rng.pick(options);
  if (r.notes.some((n) => n.hold)) {
    r.notes = r.notes.map((n) => (n.hold ? { ...n, hold: 0 } : n));
    r.tags = r.tags.filter((t) => t !== 'HOLD');
  }
  r.echo = { gapBeats: cfg.gapBeats, windowScale: cfg.windowScale, perfectGrip: cfg.perfectGrip, gemScale: cfg.gemScale };
  return r;
}

// How long the crystal's call takes before your answer starts (ms).
export function echoCallMs(route) {
  const beats = route.notes.reduce((sum, n, i) => sum + (i > 0 ? (n.gap ?? 1) : 0), 0);
  return Math.round((beats + route.echo.gapBeats + 1) * route.beatMs);
}

export class Echo {
  constructor(rng, cfg = ECHO) {
    this.rng = rng;
    this.cfg = cfg;
    this.inside = 0;
  }

  update(dt, weight) { this.inside = weight; return null; }

  // The first routes you see in the biome always carry an echo, so you meet it.
  decorateRoutes(routes) {
    if (this.inside < this.cfg.minWeight) return;
    if (addEcho(routes, this.rng, this.cfg, !this.met)) this.met = true;
  }

  weather() { return { snow: 0, mist: 0, wind: 0 }; }
}
