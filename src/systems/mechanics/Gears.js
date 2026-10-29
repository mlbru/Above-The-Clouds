// The Clockwork Bastion's rule: some arrows sit on a turning cog. A gear note
// comes in pointing the wrong way and turns a quarter clockwise on a beat
// (left -> up -> right) until it clicks into place, well before the line:
// watch it turn, wait for the click, then press. It never turns past right,
// so it always ends on an arrow you can press. Safe routes have no gears.
export const GEARS = {
  minWeight: 0.5,
  // Chance per note, and how many a route may carry (never two in a row).
  noteChance: 0.3,
  maxPerRoute: 2,
  // Chance that a right arrow turns twice (from left) instead of once.
  twoTickChance: 0.4,
  // The last turn lands this many beats before the line.
  settleBeats: 2,
};

// Clockwise round the three arrows you can press.
const CYCLE = ['L', 'U', 'R'];

// Quarter turns a gear note still has to make at `now`: one per beat, the
// last one `settleBeats` before the note reaches the line.
export function gearTicks(note, now, beatMs, cfg = GEARS) {
  if (!note.gear) return 0;
  const left = Math.ceil((note.time - now) / beatMs) - cfg.settleBeats;
  return Math.max(0, Math.min(note.gear, left));
}

// The arrow a gear note shows with `ticks` still to turn.
export function gearDir(dir, ticks) {
  const i = CYCLE.indexOf(dir);
  return i < 0 ? dir : CYCLE[Math.max(0, i - ticks)];
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
      if (r.gears || r.type === 'safe') continue;
      let count = 0, prev = false;
      const notes = r.notes.map((n, i) => {
        // How far it can turn without passing right: up once, right up to twice.
        const room = CYCLE.indexOf(n.dir);
        const skip = i === 0 || prev || room < 1 || n.still || n.chord || n.mirror || count >= this.cfg.maxPerRoute;
        if (skip || !this.rng.chance(this.cfg.noteChance)) { prev = false; return n; }
        count++;
        prev = true;
        return { ...n, gear: room === 2 && this.rng.chance(this.cfg.twoTickChance) ? 2 : 1 };
      });
      if (!count) continue;
      r.notes = notes;
      r.gears = true;
      r.tags = [...(r.tags || []), 'GEARS'];
    }
  }

  weather() { return { snow: 0, mist: 0, wind: 0 }; }
}
