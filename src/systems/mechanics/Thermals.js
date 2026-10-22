// Above the Clouds' rule: warm air rises along the wall. Sometimes one offered
// route carries a thermal: one of its up-notes rides the updraft. Hit that note
// perfectly and, after the climb, the air lifts you a few metres higher. A
// non-perfect hit is just a normal climb: a reward for precision, never a penalty.
import { METERS_PER_LEVEL } from '../../config/gameConfig.js';

export const THERMALS = {
  // Chance that a set of offered routes includes one thermal route.
  chance: 0.35,
  minWeight: 0.5,
  // Levels the lift adds (2 levels = 3 m), and how far sideways it may drift.
  liftLevels: 2,
  maxDrift: 44,
};

// Marks at most one route as a thermal route. Pure, so the balance sim uses it too.
// Returns the route that got the thermal, or null.
export function addThermal(routes, mountain, rng, cfg = THERMALS) {
  if (!rng.chance(cfg.chance)) return null;
  const options = routes.filter((r) => !r.toLedge && r.type !== 'safe' && r.target.kind !== 'ledge');
  const start = options.length ? rng.int(0, options.length - 1) : 0;
  for (let k = 0; k < options.length; k++) {
    const r = options[(start + k) % options.length];
    const ups = r.notes.map((n, i) => i).filter((i) => i > 0 && r.notes[i].dir === 'U' && !r.notes[i].hold && !r.notes[i].hidden);
    if (!ups.length) continue;
    // The lift ends on a real hold, never past a rest ledge.
    const level = r.target.level + cfg.liftLevels;
    if (mountain.nextLedgeAbove(r.target.level, cfg.liftLevels) !== null) continue;
    mountain.ensureLevel(level);
    const lv = mountain.getLevel(level);
    if (!lv) continue;
    const to = lv.nodes.filter((n) => n.kind !== 'ledge' && Math.abs(n.x - r.target.x) <= cfg.maxDrift)
      .sort((a, b) => Math.abs(a.x - r.target.x) - Math.abs(b.x - r.target.x))[0];
    if (!to) continue;
    const note = ups[ups.length - 1];
    r.notes = r.notes.map((n, i) => (i === note ? { ...n, thermal: true } : n));
    r.thermal = { note, to, gain: cfg.liftLevels * METERS_PER_LEVEL };
    return r;
  }
  return null;
}

export class Thermals {
  constructor(rng, cfg = THERMALS) {
    this.rng = rng;
    this.cfg = cfg;
    this.inside = 0;
  }

  update(dt, weight) { this.inside = weight; return null; }

  decorateRoutes(routes, { mountain }) {
    if (this.inside < this.cfg.minWeight) return;
    addThermal(routes, mountain, this.rng, this.cfg);
  }

  weather() { return { snow: 0, mist: 0, wind: 0 }; }
}
