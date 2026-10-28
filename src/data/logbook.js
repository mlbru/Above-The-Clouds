// Bram's logbook: stamps (achievements) for things you did on the mountain.
// Every stamp pays a few gems once and has a goal you can see progress on.
// `value` gets { d, run, c } and returns how far you are:
//   d    the save data (records, finds, gems found...)
//   run  the current run (maxHeight, perfects, bestStreak, flawless, gems,
//        falls, riskyRow, whiteoutClimbs, mode, bare); null outside a run
//   c    lifetime counters (progression.bump): dodges, thermals, prisms,
//        darkLedges, greatCatches, nightPhotos, summits
// perRun stamps count within one run; the logbook shows your best run so far.
// `secret` stamps show as ??? until earned.
import { BIOMES } from './biomes.js';
import { GEM_ORDER } from './gems.js';

export const LOGBOOK_PAGES = [
  { id: 'height', title: 'HEIGHT', color: 0x9fd8ff },
  { id: 'rhythm', title: 'RHYTHM', color: 0xf2c14e },
  { id: 'mountain', title: 'MOUNTAIN', color: 0x8fd16a },
  { id: 'finds', title: 'FINDS', color: 0xd8a6ff },
  { id: 'daring', title: 'DARING', color: 0xf0644b },
];

const perRun = (fn) => ({ perRun: true, value: ({ run }) => (run ? fn(run) : 0) });
const lifetime = (fn) => ({ value: fn });
const height = (fn = () => true) => perRun((r) => (fn(r) ? Math.floor(r.maxHeight || 0) : 0));
const counter = (key) => lifetime(({ c }) => c[key] || 0);

export const STAMPS = [
  { id: 'first-pitch', page: 'height', name: 'FIRST PITCH', text: 'CLIMB 50 M IN ONE RUN.', gems: 5, goal: 50, unit: 'M', ...height() },
  { id: 'stone-wall', page: 'height', name: 'THE STONE WALL', text: `REACH ${BIOMES.stone.from} M.`, gems: 8, goal: BIOMES.stone.from, unit: 'M', ...height() },
  { id: 'into-the-cold', page: 'height', name: 'INTO THE COLD', text: `REACH THE FROZEN REACH AT ${BIOMES.frozen.from} M.`, gems: 12, goal: BIOMES.frozen.from, unit: 'M', ...height() },
  { id: 'above-clouds', page: 'height', name: 'ABOVE THE CLOUDS', text: `REACH ${BIOMES.clouds.from} M.`, gems: 18, goal: BIOMES.clouds.from, unit: 'M', ...height() },
  { id: 'black-glass', page: 'height', name: 'BLACK GLASS', text: `REACH THE OBSIDIAN SPIRES AT ${BIOMES.obsidian.from} M.`, gems: 30, goal: BIOMES.obsidian.from, unit: 'M', ...height() },
  { id: 'crystal-heights', page: 'height', name: 'CRYSTAL HEIGHTS', text: `REACH ${BIOMES.crystal.from} M.`, gems: 45, goal: BIOMES.crystal.from, unit: 'M', ...height() },
  { id: 'thunderhead', page: 'height', name: 'THUNDERHEAD', text: `REACH THE STORM CROWN AT ${BIOMES.storm.from} M.`, gems: 55, goal: BIOMES.storm.from, unit: 'M', ...height() },
  { id: 'northern-lights', page: 'height', name: 'UNDER THE LIGHTS', text: `REACH THE AURORA RIDGE AT ${BIOMES.aurora.from} M.`, gems: 65, goal: BIOMES.aurora.from, unit: 'M', ...height() },
  { id: 'dragon-spine', page: 'height', name: 'HERE BE DRAGONS', text: `REACH THE DRAGON'S SPINE AT ${BIOMES.dragon.from} M.`, gems: 75, goal: BIOMES.dragon.from, unit: 'M', ...height() },
  { id: 'off-the-map', page: 'height', name: 'OFF THE MAP', text: 'REACH 2000 M. NOBODY HAS DRAWN THIS PART.', gems: 80, goal: 2000, unit: 'M', ...height() },

  { id: 'groove', page: 'rhythm', name: 'IN THE GROOVE', text: '10 PERFECT MOVES IN A ROW.', gems: 5, goal: 10, ...perRun((r) => r.bestStreak) },
  { id: 'metronome', page: 'rhythm', name: 'METRONOME', text: '30 PERFECT MOVES IN A ROW.', gems: 15, goal: 30, ...perRun((r) => r.bestStreak) },
  { id: 'heartbeat', page: 'rhythm', name: 'HEARTBEAT OF THE MOUNTAIN', text: '75 PERFECT MOVES IN A ROW.', gems: 40, goal: 75, ...perRun((r) => r.bestStreak) },
  { id: 'hundred', page: 'rhythm', name: 'PERFECT DAY', text: '200 PERFECT MOVES IN ONE RUN.', gems: 25, goal: 200, ...perRun((r) => r.perfects) },
  { id: 'flawless-ten', page: 'rhythm', name: 'NOT A SINGLE SLIP', text: '20 FLAWLESS CLIMBS IN ONE RUN.', gems: 20, goal: 20, ...perRun((r) => r.flawless) },

  { id: 'rock-dodger', page: 'mountain', name: 'ROCK DODGER', text: 'DODGE 25 FALLING ROCKS.', gems: 12, goal: 25, ...counter('dodges') },
  { id: 'by-feel', page: 'mountain', name: 'BY FEEL', text: 'MAKE 15 CLIMBS DURING WHITEOUTS IN ONE RUN.', gems: 15, goal: 15, ...perRun((r) => r.whiteoutClimbs) },
  { id: 'hawk', page: 'mountain', name: 'HAWK', text: 'RIDE 15 THERMALS.', gems: 18, goal: 15, ...counter('thermals') },
  { id: 'headlamp', page: 'mountain', name: 'HEADLAMP', text: 'REACH 5 LEDGES IN THE OBSIDIAN SPIRES.', gems: 22, goal: 5, ...counter('darkLedges') },
  { id: 'prism-climber', page: 'mountain', name: 'PRISM CLIMBER', text: 'CLIMB 15 ROUTES IN THE PRISM LIGHT.', gems: 25, goal: 15, ...counter('prisms') },
  { id: 'statue', page: 'mountain', name: 'FIREPROOF', text: "DODGE 15 OF THE DRAGON'S FIRE BREATHS.", gems: 35, goal: 15, ...counter('fireDodges') },
  { id: 'great-catch', page: 'mountain', name: 'GREAT CATCH', text: 'CATCH 5 SLIPS WITH A PERFECT GRAB.', gems: 10, goal: 5, ...counter('greatCatches') },

  { id: 'gem-pockets', page: 'finds', name: 'GEM POCKETS', text: 'FIND 50 GEMS IN ONE RUN.', gems: 10, goal: 50, ...perRun((r) => r.gems) },
  { id: 'geologist', page: 'finds', name: 'GEOLOGIST', text: `FIND ALL ${GEM_ORDER.length} KINDS OF STONE.`, gems: 30, goal: GEM_ORDER.length, ...lifetime(({ d }) => GEM_ORDER.filter((k) => (d.gemsFound[k] || 0) > 0).length) },
  { id: 'explorer', page: 'finds', name: 'EXPLORER', text: 'MAKE 10 DISCOVERIES.', gems: 20, goal: 10, ...lifetime(({ d }) => d.discoveries.length) },
  { id: 'sightseer', page: 'finds', name: 'SIGHTSEER', text: 'VISIT 20 VIEWPOINTS.', gems: 25, goal: 20, ...lifetime(({ d }) => d.viewpoints.length) },
  { id: 'night-shot', page: 'finds', name: 'NIGHT SHOT', text: 'TAKE A PHOTO UNDER THE STARS.', gems: 5, goal: 1, secret: true, ...counter('nightPhotos') },

  { id: 'no-safe-way', page: 'daring', name: 'NO SAFE WAY', text: 'TAKE 8 RISKY ROUTES IN A ROW.', gems: 12, goal: 8, ...perRun((r) => r.riskyBest || r.riskyRow) },
  { id: 'clean-ascent', page: 'daring', name: 'CLEAN ASCENT', text: `REACH ${BIOMES.obsidian.from} M WITHOUT A SINGLE FALL.`, gems: 35, goal: BIOMES.obsidian.from, unit: 'M', ...height((r) => r.falls === 0) },
  { id: 'hard-as-rock', page: 'daring', name: 'HARD AS ROCK', text: 'REACH 500 M IN HARD MODE.', gems: 25, goal: 500, unit: 'M', ...height((r) => r.mode === 'hard') },
  { id: 'summit-fever', page: 'daring', name: 'SUMMIT FEVER', text: `REACH ${BIOMES.obsidian.from} M IN SUMMIT MODE.`, gems: 60, goal: BIOMES.obsidian.from, unit: 'M', ...height((r) => r.mode === 'summit') },
  { id: 'brams-summit', page: 'daring', name: 'FOR BRAM', text: "STAND ON THE SUMMIT OF BRAM'S ROUTE.", gems: 30, goal: 1, ...counter('summits') },
  { id: 'bare-hands', page: 'daring', name: 'BARE HANDS', text: 'REACH 300 M IN NORMAL WITH NO GEAR OR PERK.', gems: 15, goal: 300, unit: 'M', secret: true, ...height((r) => r.mode === 'normal' && r.bare) },
];

// How far a stamp is: { now, goal } (now capped at goal; per-run stamps use
// the best run, which progression keeps in counters as best:<id>).
export function stampProgress(stamp, d) {
  const ctx = { d, run: null, c: d.counters || {} };
  const now = stamp.perRun ? (ctx.c[`best:${stamp.id}`] || 0) : stamp.value(ctx);
  return { now: Math.min(stamp.goal, now), goal: stamp.goal };
}

export const STAMP_BY_ID = Object.fromEntries(STAMPS.map((s) => [s.id, s]));
