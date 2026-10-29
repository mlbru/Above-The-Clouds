// The Clockwork Bastion's rule: some arrows sit on a turning cog. A gear note
// ticks one step clockwise (left, up, right, left...) on every beat as it
// slides in, and lands on the arrow to press one beat before the line. Pips
// above it count the ticks still to come, so you can read it early or wait.
export const GEARS = {
  minWeight: 0.5,
  // Chance per note, how many a route may carry, and the chance of a two-tick gear.
  noteChance: 0.3,
  maxPerRoute: 3,
  twoTickChance: 0.4,
};

// Clockwise round the three arrows you can press.
const CYCLE = ['L', 'U', 'R'];

// Ticks a gear note still has to turn at `now`: the last one lands a beat
// before the note reaches the line.
export function gearTicks(note, now, beatMs) {
  if (!note.gear) return 0;
  const left = Math.ceil((note.time - now) / beatMs) - 1;
  return Math.max(0, Math.min(note.gear, left));
}

// The arrow a gear note shows with `ticks` still to turn.
export function gearDir(dir, ticks) {
  const i = CYCLE.indexOf(dir);
  return i < 0 ? dir : CYCLE[(((i - ticks) % 3) + 3) % 3];
}

export class Gears {
  constructor(rng, cfg = GEARS) {
    this.rng = rng;
    this.cfg = cfg;
    this.inside = 0;
  }

  update(dt, weight) { this.inside = weight; return null; }

  decorateRoutes(routes) {
    if (this.inside < this.cfg.minWeight) return;
    for (const r of routes) {
      if (r.gears) continue;
      let count = 0;
      const notes = r.notes.map((n, i) => {
        // The very first note has no beats to tick on; doubles and mirrors keep their own look.
        if (i === 0 || n.still || n.chord || n.mirror || count >= this.cfg.maxPerRoute) return n;
        if (!this.rng.chance(this.cfg.noteChance)) return n;
        count++;
        return { ...n, gear: this.rng.chance(this.cfg.twoTickChance) ? 2 : 1 };
      });
      if (!count) continue;
      r.notes = notes;
      r.gears = true;
      r.tags = [...(r.tags || []), 'GEARS'];
    }
  }

  weather() { return { snow: 0, mist: 0, wind: 0 }; }
}
