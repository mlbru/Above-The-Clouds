// The Amber Hive's rule: now and then the swarm flies past while you climb.
// A route can carry a short run of swarm beats in the middle: on those beats
// you must hang perfectly still. Press anything near one and the bees sting
// (a miss); let one pass untouched and it counts as a perfect. Built on the
// still beats of ComboSystem.
export const SWARM = {
  minWeight: 0.5,
  // Chance that a route carries a swarm, and of a long swarm (3 beats, not 2).
  chance: 0.5,
  longChance: 0.35,
  // A safe route is a little calmer.
  safeChance: 0.3,
};

// Puts a run of `beats` swarm beats into a route's notes after note `after`.
// Pure, so tests and the sim can use it.
export function addSwarm(notes, after, beats) {
  const swarm = Array.from({ length: beats }, () => ({ dir: 'U', gap: 1, still: true, swarm: true }));
  return [...notes.slice(0, after + 1), ...swarm, ...notes.slice(after + 1)];
}

export class Swarm {
  constructor(rng, cfg = SWARM) {
    this.rng = rng;
    this.cfg = cfg;
    this.inside = 0;
  }

  update(dt, weight) { this.inside = weight; return null; }

  decorateRoutes(routes) {
    if (this.inside < this.cfg.minWeight) return;
    for (const r of routes) {
      if (r.swarm || r.notes.length < 3) continue;
      if (!this.rng.chance(r.type === 'safe' ? this.cfg.safeChance : this.cfg.chance)) continue;
      // Somewhere in the middle: never first (you need the beat) nor after the last.
      const after = this.rng.int(0, r.notes.length - 2);
      if (r.notes[after].hold || r.notes[after].roll) continue;
      r.notes = addSwarm(r.notes, after, this.rng.chance(this.cfg.longChance) ? 3 : 2);
      r.swarm = true;
      r.tags = [...(r.tags || []), 'SWARM'];
    }
  }

  weather() { return { snow: 0, mist: 0, wind: 0 }; }
}
