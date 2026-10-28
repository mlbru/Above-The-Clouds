// Every tunable gameplay number lives here.
export const BALANCE = {
  grip: {
    max: 100,
    start: 100,
    lowThreshold: 30,
    criticalThreshold: 15,
    // Grip drained per second while hanging and deciding (after a short grace).
    hangDrainPerSec: 0.55,
    hangGraceSec: 3,
    // Big "jug" holds let the climber shake out and slowly recover.
    jugRecoverPerSec: 2.2,
    jugRecoverCap: 70,
    restRecoverPerSec: 45,
    afterRecovery: 35,
    afterPerfectRecovery: 45,
    afterRespawn: 100,
  },

  timing: {
    perfectMs: 90,
    goodMs: 180,
    // Presses up to this long before the good window count as "early" misses;
    // anything earlier is ignored so a stray key doesn't ruin a note.
    earlyGraceMs: 220,
    leadInMs: 950,
    forgivingMultiplier: 1.4,
    minGoodMs: 90,
    minPerfectMs: 45,
    resumeShiftMs: 700,
  },

  routes: {
    safe: { label: 'SAFE', inputs: 3, levels: 1, gripCost: 3.2, beatMs: 700, windowScale: 1.15, maxReach: 96, difficulty: 1 },
    normal: { label: 'NORMAL', inputs: 4, levels: 2, gripCost: 6, beatMs: 610, windowScale: 1.0, maxReach: 112, difficulty: 2 },
    risky: { label: 'RISKY', inputs: 5, levels: 3, gripCost: 9.5, beatMs: 540, windowScale: 0.85, maxReach: 130, difficulty: 3 },
  },
  routeOrder: ['safe', 'normal', 'risky'],

  notes: {
    // Fraction of the per-note base cost actually paid.
    perfectCostFactor: 0.15,
    goodCostFactor: 1,
    missExtraCost: 6,
  },

  combo: {
    perfectComboBonus: 4,
    // A climb succeeds with up to this many misses (it just looks shakier).
    maxMissesForSuccess: 1,
    failExtraCost: 3,
  },

  hazards: {
    loose: { missMultiplier: 1.7, label: 'LOOSE' },
    icy: { windowScale: 0.8, label: 'ICY' },
    // Crumbling holds break if you hang on them too long.
    crumbling: { label: 'CRUMBLING' },
  },

  // How the mountain gets harder with height (meters, before the mode's rampSpeed).
  ramp: {
    fullAt: 800,
    // Tempo and timing start as if you were already this high, fading out by fullAt.
    // The rhythm tricks below keep their own heights.
    warmStart: 100,
    beatScaleAtFull: 0.62,
    windowScaleAtFull: 0.74,
    extraInputs: [{ from: 300, add: 1 }, { from: 700, add: 2 }, { from: 1700, add: 3 }],
    restEvery: [{ from: 0, every: 3 }, { from: 300, every: 4 }, { from: 700, every: 5 }],
    // [start height, height where the maximum is reached, maximum chance]
    syncopation: [40, 440, 0.45],
    hold: [180, 780, 0.3],
    fade: [380, 980, 0.35],
    gust: [250, 750, 0.55],
    crumbling: [150, 750, 0.22],
    // The high mountain keeps adding new kinds of notes after the tempo tops out:
    // mirrored arrows (press the other way), doubles (two arrows at once) and
    // rolls (tap the same arrow again and again before the tail ends).
    // They keep growing long after everything else has topped out, so the
    // climb never flattens: ~30% by the first loop, still rising until 3500 m.
    mirror: [950, 3200, 0.5],
    chord: [1200, 3400, 0.45],
    roll: [1450, 3500, 0.5],
    rollTaps: [{ from: 0, taps: 3 }, { from: 2200, taps: 4 }, { from: 3000, taps: 5 }],
    rollBeats: 1.5,
    // A press of a chord's second arrow may come this much after the first.
    chordSpreadMs: 90,
    minGapMs: 260,
    holdReleaseGraceMs: 120,
    gustWindowScale: 0.72,
  },

  // Consecutive perfect moves. Milestones give grip (and unlock cosmetics, see cosmetics.js).
  streak: {
    milestones: [{ at: 10, grip: 5 }, { at: 20, grip: 8 }, { at: 30, grip: 12 }],
    // After the last milestone, every further `every` perfects gives `laterGrip`.
    every: 10,
    laterGrip: 8,
  },

  modes: {
    normal: {
      label: 'NORMAL', rampSpeed: 1, windowScale: 1, costScale: 1, drainScale: 1,
      perfectCostFactor: 0.15, perfectComboBonus: 4, catchScale: 1, crumbleMs: 3400, permadeath: false, allowForgiving: true,
      blurb: 'THE MOUNTAIN GROWS HARDER AS YOU CLIMB.',
    },
    hard: {
      label: 'HARD', rampSpeed: 1.6, windowScale: 0.82, costScale: 1.3, drainScale: 1.6,
      perfectCostFactor: 0.5, perfectComboBonus: 0, catchScale: 0.72, crumbleMs: 2600, permadeath: false, allowForgiving: false,
      blurb: 'TIGHTER TIMING, HUNGRY GRIP, NO FREE REFILLS.',
    },
    summit: {
      label: 'SUMMIT', rampSpeed: 1.6, windowScale: 0.82, costScale: 1.3, drainScale: 1.6,
      perfectCostFactor: 0.5, perfectComboBonus: 0, catchScale: 0.72, crumbleMs: 2600, permadeath: true, allowForgiving: false,
      blurb: 'HARD RULES. ONE FALL AND THE RUN IS OVER.',
    },
  },
  modeOrder: ['normal', 'hard', 'summit'],

  slip: {
    slideLevels: 2,
    leadInMs: 1150,
    goodMs: 230,
    perfectMs: 110,
    firstSlipBonusMs: 70,
  },

  generation: {
    restEverySegments: 3,
    extraOffsetMin: 34,
    extraOffsetMax: 60,
    maxWander: 30,
    minNodeSpacing: 26,
    wallMargin: 18,
    // Levels directly above a ledge have no holds; routes from a ledge start this much higher.
    ledgeExitGap: 2,
  },
};

export const ROUTE_COLORS = {
  safe: 0x8fd16a,
  normal: 0xf2c14e,
  risky: 0xf0644b,
  ledge: 0x9fd8ff,
};
