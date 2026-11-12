// The Hanging Monastery's rule: bells, a call and response you can see. Now
// and then a monk on a balcony beside the route rings a bell before you
// climb: as he strikes it, the route's arrows light up one by one in the
// row above the track (the call). Then they turn into blank bells, and the
// notes come down the track as blank bells too: climb the phrase from memory
// (the response). The safe route is never rung, so you can always say no.
export const BELLS = {
  minWeight: 0.5,
  every: [1, 3],
  // How long each arrow of the call stays lit (beats), and the pause after.
  stepBeats: 0.75,
  pauseMs: 500,
  // Longest phrase a monk will ring.
  maxNotes: 8,
};

// How long the call takes for a route with n notes (ms), at beatMs.
export function callMs(n, beatMs, cfg = BELLS) {
  return Math.round(n * cfg.stepBeats * beatMs + cfg.pauseMs);
}

export class Bells {
  constructor(rng, cfg = BELLS) {
    this.rng = rng;
    this.cfg = cfg;
    this.inside = 0;
    this.wait = this.rng.int(0, 1);
  }

  update(dt, weight) { this.inside = weight; return null; }

  get active() { return this.inside >= this.cfg.minWeight; }

  decorateRoutes(routes) {
    if (!this.active || routes.some((r) => r.echo)) return;
    if (this.wait-- > 0) return;
    this.wait = this.rng.int(this.cfg.every[0], this.cfg.every[1]);
    for (const r of routes) {
      if (r.type === 'safe') continue;
      // Every note an echo: shown blank, its arrow only in the call. Double
      // notes, gear turns and still beats would fight the memory game, so a
      // rung route drops them (and a phrase never runs longer than maxNotes).
      const notes = r.notes.filter((n) => !n.still).slice(0, this.cfg.maxNotes);
      r.echo = true;
      r.notes = notes.map((n) => ({ ...n, echo: true, hidden: false, mirror: false, chord: null, gear: 0, swap: 0 }));
      r.tags = [...(r.tags || []).filter((t) => !['DOUBLE', 'GEARS', 'SWARM', 'ROPED', 'MIRROR', 'BLIND'].includes(t)), 'BELLS'];
    }
  }

  weather() { return { snow: 0, mist: 0, wind: 0 }; }
}
