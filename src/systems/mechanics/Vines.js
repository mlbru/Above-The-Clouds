// The Moss Cathedral's rule: vines. Some notes are tied together by a vine:
// the first is held along the vine, and where it bends the next arrow takes
// over. Hold, and switch on the bend without letting go early (built on the
// hold notes of ComboSystem: a vine is a hold whose tail ends right on the
// next note, which is always a different arrow).
export const VINES = {
  minWeight: 0.5,
  // Chance a route carries a vine, and of a long one (three notes, not two).
  chance: 0.55,
  safeChance: 0.25,
  longChance: 0.35,
  // How long each stretch of vine is held (beats).
  holdBeats: [1, 1.5],
};

const OTHER = { L: ['U', 'R'], U: ['L', 'R'], R: ['U', 'L'] };

// Ties notes from..from+len-1 into a vine. Pure, so tests can use it.
export function addVine(notes, from, len, holdBeats = 1, pick = (a) => a[0]) {
  const out = notes.map((n) => ({ ...n }));
  for (let i = from; i < from + len - 1; i++) {
    out[i].hold = holdBeats;
    out[i].vine = true;
    out[i + 1].gap = 0;
    if (out[i + 1].dir === out[i].dir) out[i + 1].dir = pick(OTHER[out[i].dir]);
  }
  out[from + len - 1].vineEnd = true;
  return out;
}

export class Vines {
  constructor(rng, cfg = VINES) {
    this.rng = rng;
    this.cfg = cfg;
    this.inside = 0;
  }

  update(dt, weight) { this.inside = weight; return null; }

  decorateRoutes(routes) {
    if (this.inside < this.cfg.minWeight) return;
    for (const r of routes) {
      if (r.vines || r.notes.length < 3) continue;
      if (!this.rng.chance(r.type === 'safe' ? this.cfg.safeChance : this.cfg.chance)) continue;
      const len = r.type !== 'safe' && r.notes.length >= 4 && this.rng.chance(this.cfg.longChance) ? 3 : 2;
      const plain = (n) => !n.hold && !n.roll && !n.still && !n.chord && !n.gear && !n.swap && !n.gust && !n.echo && !n.mirror && !n.hidden;
      const starts = [];
      for (let i = 0; i + len <= r.notes.length; i++) if (r.notes.slice(i, i + len).every(plain)) starts.push(i);
      if (!starts.length) continue;
      const from = this.rng.pick(starts);
      r.notes = addVine(r.notes, from, len, this.rng.pick(this.cfg.holdBeats), (a) => this.rng.pick(a));
      // Whatever follows the vine waits a beat for it.
      if (r.notes[from + len]) r.notes[from + len].gap = Math.max(1, r.notes[from + len].gap);
      r.vines = true;
      r.tags = [...(r.tags || []), 'VINES'];
    }
  }

  weather() { return { snow: 0, mist: 0, wind: 0 }; }
}
