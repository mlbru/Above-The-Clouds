// The Bone Garden's rule: the dragon's lullaby. The old ribs here ring like
// a xylophone, and the dragon asleep just above knows one song. Every
// perfect note plays the next note of its lullaby; a good one only knocks
// on the bone; a miss is a sour clack that starts the song over and stirs
// the dragon. Play the whole lullaby and it sinks into a deeper sleep.
// Stir it to half and it grows restless (tighter timing); stir it all the
// way and it wakes for a moment and breathes fire down the wall: a taste of
// the Dragon's Spine. Bone holds still snap if you hang too long (the
// crumbling hazard; see the biome's hazards).
export const BONE_GARDEN = {
  minWeight: 0.5,
  // The lullaby, in semitones over the biome's root (its scale: 0 1 3 7 8).
  melody: [12, 8, 7, 8, 12, 8, 7, 3, 7, 8, 7, 3, 1, 3, 1, 0],
  // How each thing moves the dragon's sleep (0 deep asleep .. 100 awake).
  stir: { miss: 22, good: 2, perfect: -2, ledge: -20, song: -50 },
  restless: 50,
  wakes: 100,
  // Where the meter settles after it has woken and breathed.
  afterWake: 40,
  restlessWindow: 0.9,
  // Gems for finishing the lullaby (before the mode's and dares' scale).
  songGems: 4,
};

export class BoneGarden {
  constructor(rng, cfg = BONE_GARDEN) {
    this.cfg = cfg;
    this.inside = 0;
    this.stir = 0;
    this.step = 0;
  }

  update(dt, weight) {
    this.inside = weight;
    // Out of the garden the song and the meter start over.
    if (weight < this.cfg.minWeight) { this.stir = 0; this.step = 0; }
    return null;
  }

  get active() { return this.inside >= this.cfg.minWeight; }
  get restless() { return this.active && this.stir >= this.cfg.restless; }

  // The note of the lullaby a perfect hit plays now.
  get nextNote() { return this.cfg.melody[this.step]; }

  // A judged note in the garden ('perfect' | 'good' | 'miss'). Returns
  // { note, event }: note is the lullaby's semitone (perfect hits only);
  // event is 'song' (the lullaby is done), 'restless', 'wake', 'calm' or null.
  onNote(result) {
    if (!this.active) return { note: null, event: null };
    const c = this.cfg;
    const before = this.stir;
    let note = null, event = null;
    if (result === 'perfect') {
      note = c.melody[this.step];
      this.step++;
      this.add(c.stir.perfect);
      if (this.step >= c.melody.length) { this.step = 0; this.add(c.stir.song); event = 'song'; }
    } else if (result === 'good') this.add(c.stir.good);
    else { this.step = 0; this.add(c.stir.miss); }
    if (!event) event = this.crossed(before);
    if (event === 'wake') this.stir = c.afterWake;
    return { note, event };
  }

  // A ledge: the dragon settles a little (the song is kept).
  rest() {
    const before = this.stir;
    this.add(this.cfg.stir.ledge);
    return this.crossed(before);
  }

  add(v) { this.stir = Math.max(0, Math.min(this.cfg.wakes, this.stir + v)); }

  crossed(before) {
    const c = this.cfg;
    if (this.stir >= c.wakes) return 'wake';
    if (before < c.restless && this.stir >= c.restless) return 'restless';
    if (before >= c.restless && this.stir < c.restless) return 'calm';
    return null;
  }

  // While it is restless the routes are a little tighter.
  decorateRoutes(routes) {
    if (!this.restless) return;
    for (const r of routes) {
      if (r.restless) continue;
      r.restless = true;
      r.windowScale *= this.cfg.restlessWindow;
      r.tags = [...(r.tags || []), 'RESTLESS'];
    }
  }

  weather() { return { snow: 0, mist: this.active ? 0.15 * (this.stir / this.cfg.wakes) : 0, wind: 0 }; }
}
