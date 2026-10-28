// The Aurora Ridge's rule: the lights sway, and so does the music. Every route
// is played in swing time: long-short, long-short. Notes come in lilting pairs
// instead of a straight beat; the total length of a climb stays the same.
export const SWING = {
  minWeight: 0.5,
  // Gap (in beats) before the long and the short note of each pair.
  long: 4 / 3,
  short: 2 / 3,
};

// Swings a rhythm in place. Only straight one-beat gaps change; held notes,
// rolls and off-beats keep their own timing. Pure, so tests and the sim can use it.
export function applySwing(notes, cfg = SWING) {
  let changed = false;
  for (let i = 1; i < notes.length; i++) {
    const prev = notes[i - 1];
    if ((notes[i].gap ?? 1) !== 1 || prev.hold || prev.roll) continue;
    notes[i].gap = i % 2 ? cfg.long : cfg.short;
    changed = true;
  }
  return changed;
}

export class Swing {
  constructor(rng, cfg = SWING) {
    this.cfg = cfg;
    this.inside = 0;
  }

  update(dt, weight) { this.inside = weight; return null; }

  decorateRoutes(routes) {
    if (this.inside < this.cfg.minWeight) return;
    for (const r of routes) {
      if (r.swing) continue;
      r.notes = r.notes.map((n) => ({ ...n }));
      if (applySwing(r.notes, this.cfg)) {
        r.swing = true;
        r.tags = [...(r.tags || []), 'SWING'];
      }
    }
  }

  weather() { return { snow: 0, mist: 0, wind: 0 }; }
}
