// The Stone Wall's rule: now and then rocks come down. There is always a clear
// warning (rumble, dust, a falling rock), then you dodge with one or two quick
// left/right inputs. A hit costs grip but never throws you off by itself;
// clean dodges count towards your perfect streak.
export const ROCKFALL = {
  firstCalmSec: 14,
  calmSec: [28, 48],
  // The timer only runs while you are mostly inside the biome.
  minWeight: 0.5,
  // Delay after the routes appear before the first rock lands, then between rocks.
  warnMs: 1500,
  nextMs: 650,
  // From this height the wall drops two rocks in a row.
  doubleFrom: 145,
  perfectMs: 110,
  goodMs: 230,
  hitGrip: 12,
};

export class Rockfall {
  constructor(rng, cfg = ROCKFALL) {
    this.rng = rng;
    this.cfg = cfg;
    this.left = cfg.firstCalmSec * 1000;
    this.inside = 0;
  }

  update(dt, weight) {
    this.inside = weight;
    if (weight >= this.cfg.minWeight && this.left > 0) this.left -= dt;
    return null;
  }

  // A rockfall is ready to start on the next hold you hang from.
  get due() { return this.left <= 0 && this.inside >= this.cfg.minWeight; }

  // Plans the next rockfall: the directions to dodge, then restarts the timer.
  start(heightM) {
    this.left = this.rng.range(this.cfg.calmSec[0], this.cfg.calmSec[1]) * 1000;
    const first = this.rng.pick(['L', 'R']);
    if (heightM < this.cfg.doubleFrom) return [first];
    return [first, this.rng.chance(0.5) ? first : first === 'L' ? 'R' : 'L'];
  }

  weather() { return { snow: 0, mist: 0, wind: 0 }; }
}
