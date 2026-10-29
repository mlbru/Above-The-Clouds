// The Dragon's Spine's rule: the dragon coiled around the peak is asleep, but
// now and then it wakes, rears its head beside the wall and watches you. While
// it watches the whole mountain is under pressure (the play box sways and the
// screen shakes), and every few seconds it breathes fire at you: its throat
// glows as it draws breath, then the flames come down on the beat. Swing clear
// with the arrow shown, like dodging a rock. A ledge is safe: it never breathes
// at a climber resting there.
import { LOOP_START } from '../../data/biomes.js';

export const DRAGON_EYE = {
  firstSleepSec: 10,
  sleepSec: [26, 42],
  openSec: 4,
  watchSec: 24,
  closeSec: 3,
  minWeight: 0.5,
  // Fire breath: the first comes soon after it wakes, then every few seconds.
  firstBreathSec: 2.5,
  breathSec: [5, 8],
  // How long it draws breath (the warning) before the flames land on the beat.
  breathLeadMs: 1500,
  // Above this height it breathes twice in a row (a second sweep the other way).
  doubleFrom: LOOP_START,
  perfectMs: 110,
  goodMs: 230,
  // Grip lost when the flames catch you.
  breathGrip: 14,
};

export class DragonEye {
  constructor(rng, cfg = DRAGON_EYE) {
    this.rng = rng;
    this.cfg = cfg;
    this.phase = 'sleep';
    this.left = cfg.firstSleepSec * 1000;
    this.inside = 0;
    this.breathIn = 0;
  }

  get phaseMs() {
    const c = this.cfg;
    return { opening: c.openSec, watching: c.watchSec, closing: c.closeSec }[this.phase] * 1000;
  }

  get active() { return this.phase === 'watching' && this.inside >= this.cfg.minWeight; }

  // 0 (shut) .. 1 (wide open): for drawing the eye.
  get openness() {
    if (this.phase === 'sleep') return 0;
    const p = 1 - this.left / this.phaseMs;
    if (this.phase === 'opening') return p;
    if (this.phase === 'watching') return 1;
    return 1 - p;
  }

  // 0..1: how much pressure the dragon puts on you right now (screen shake,
  // swaying play box). Builds while it opens, peaks while it watches.
  get pressure() {
    if (this.phase === 'sleep' || this.inside < this.cfg.minWeight) return 0;
    const p = 1 - this.left / this.phaseMs;
    if (this.phase === 'opening') return p * 0.5;
    if (this.phase === 'watching') return 0.6 + 0.4 * Math.min(1, p * 2);
    return 1 - p;
  }

  // A fire breath is ready on the next hold you hang from.
  get breathDue() { return this.active && this.breathIn <= 0; }

  // Plans the next breath: the directions to dodge, then restarts the timer.
  startBreath(heightM) {
    this.breathIn = this.rng.range(this.cfg.breathSec[0], this.cfg.breathSec[1]) * 1000;
    const first = this.rng.pick(['L', 'R']);
    if (heightM < this.cfg.doubleFrom) return [first];
    return [first, first === 'L' ? 'R' : 'L'];
  }

  // Returns 'open', 'watch' or 'close' when the phase changes.
  update(dt, weight) {
    this.inside = weight;
    if (this.active) this.breathIn -= dt;
    if (this.phase === 'sleep' && weight < this.cfg.minWeight) return null;
    this.left -= dt;
    if (this.left > 0) return null;
    const next = { sleep: 'opening', opening: 'watching', watching: 'closing', closing: 'sleep' }[this.phase];
    this.phase = next;
    if (next === 'sleep') this.left = this.rng.range(this.cfg.sleepSec[0], this.cfg.sleepSec[1]) * 1000;
    else this.left = this.phaseMs;
    if (next === 'watching') this.breathIn = this.cfg.firstBreathSec * 1000;
    return { opening: 'open', watching: 'watch', closing: 'close' }[next] || null;
  }

  weather() { return { snow: 0, mist: 0.15 * this.pressure, wind: 0.4 * this.pressure }; }
}
