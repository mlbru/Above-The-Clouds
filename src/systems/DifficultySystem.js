import { BALANCE } from '../config/balanceConfig.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ramp01 = ([from, to, max], h) => clamp((h - from) / (to - from), 0, 1) * max;

export function modeConfig(mode, balance = BALANCE) {
  return balance.modes[mode] || balance.modes.normal;
}

// Difficulty parameters at a given height for a mode. Pure.
export function difficultyAt(meters, mode = 'normal', balance = BALANCE) {
  const r = balance.ramp;
  const m = modeConfig(mode, balance);
  const h = Math.max(0, meters) * m.rampSpeed;
  const warm = (r.warmStart || 0) * Math.max(0, 1 - h / r.fullAt);
  const t = clamp((h + warm) / r.fullAt, 0, 1);
  const eased = t * t * (3 - 2 * t);
  let extraInputs = 0;
  for (const e of r.extraInputs) if (h >= e.from) extraInputs = e.add;
  let rollTaps = 3;
  for (const e of r.rollTaps || []) if (h >= e.from) rollTaps = e.taps;
  let restEvery = 3;
  for (const e of r.restEvery) if (h >= e.from) restEvery = e.every;
  return {
    effectiveHeight: h,
    beatScale: 1 + (r.beatScaleAtFull - 1) * eased,
    windowScale: (1 + (r.windowScaleAtFull - 1) * t) * m.windowScale,
    extraInputs,
    restEvery,
    syncopation: ramp01(r.syncopation, h),
    hold: ramp01(r.hold, h),
    fade: ramp01(r.fade, h),
    gust: ramp01(r.gust, h),
    crumbling: ramp01(r.crumbling, h),
    mirror: r.mirror ? ramp01(r.mirror, h) : 0,
    chord: r.chord ? ramp01(r.chord, h) : 0,
    roll: r.roll ? ramp01(r.roll, h) : 0,
    rollTaps,
  };
}
