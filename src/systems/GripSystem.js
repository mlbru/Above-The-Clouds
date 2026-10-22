import { RESULT } from './ComboSystem.js';

// The single climbing resource. Pure logic.
export class GripSystem {
  constructor(balance, mode = balance.modes.normal) {
    this.b = balance;
    this.mode = mode;
    this.max = balance.grip.max;
    this.value = balance.grip.start;
    this.hangTime = 0;
  }
  get ratio() { return this.value / this.max; }
  get isLow() { return this.value <= this.b.grip.lowThreshold; }
  get isCritical() { return this.value <= this.b.grip.criticalThreshold; }
  get isEmpty() { return this.value <= 0; }

  set(v) { this.value = Math.max(0, Math.min(this.max, v)); return this.value; }
  change(delta) { return this.set(this.value + delta); }
  restoreFull() { this.hangTime = 0; return this.set(this.max); }

  // Cost of a single judged note on a route (negative cost never happens here).
  noteCost(route, result) {
    const base = (route.gripCost / route.inputs) * this.mode.costScale;
    const n = this.b.notes;
    if (result === RESULT.PERFECT) return base * this.mode.perfectCostFactor;
    if (result === RESULT.GOOD) return base * n.goodCostFactor;
    const mult = route.hazard === 'loose' ? this.b.hazards.loose.missMultiplier : 1;
    return base + n.missExtraCost * mult * this.mode.costScale;
  }

  applyNote(route, result) {
    return this.change(-this.noteCost(route, result));
  }

  // Applied once the combo finishes. Returns the delta applied.
  applyComboEnd(summary, succeeded) {
    let delta = 0;
    if (summary.allPerfect) delta += this.mode.perfectComboBonus;
    if (!succeeded) delta -= this.b.combo.failExtraCost;
    this.change(delta);
    return delta;
  }

  // Called every frame while hanging on the wall and choosing a route.
  hang(dtSec, { drainMultiplier = 1, onJug = false } = {}) {
    this.hangTime += dtSec;
    const g = this.b.grip;
    if (onJug) {
      if (this.value < g.jugRecoverCap) this.set(Math.min(g.jugRecoverCap, this.value + g.jugRecoverPerSec * dtSec));
      return this.value;
    }
    if (this.hangTime > g.hangGraceSec) this.change(-g.hangDrainPerSec * drainMultiplier * this.mode.drainScale * dtSec);
    return this.value;
  }

  resetHang() { this.hangTime = 0; }
}
