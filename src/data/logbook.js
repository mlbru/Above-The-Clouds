// Bram's logbook: stamps (achievements) for things you did on the mountain.
// Every stamp pays a few gems once. `test` gets { d, run, c }:
//   d    the save data (records, finds, gems found...)
//   run  the current run (maxHeight, perfects, bestStreak, flawless, gems,
//        falls, riskyRow, whiteoutClimbs, mode); null outside a run
//   c    lifetime counters (progression.bump): dodges, thermals, quickHands,
//        darkLedges, greatCatches, nightPhotos
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

const reach = (m) => ({ run }) => !!run && (run.maxHeight || 0) >= m;
const reachIn = (mode, m) => ({ run }) => !!run && run.mode === mode && (run.maxHeight || 0) >= m;

export const STAMPS = [
  { id: 'first-pitch', page: 'height', name: 'FIRST PITCH', text: 'CLIMB 50 M IN ONE RUN.', gems: 5, test: reach(50) },
  { id: 'stone-wall', page: 'height', name: 'THE STONE WALL', text: `REACH ${BIOMES.stone.from} M.`, gems: 8, test: reach(BIOMES.stone.from) },
  { id: 'into-the-cold', page: 'height', name: 'INTO THE COLD', text: `REACH THE FROZEN REACH AT ${BIOMES.frozen.from} M.`, gems: 12, test: reach(BIOMES.frozen.from) },
  { id: 'above-clouds', page: 'height', name: 'ABOVE THE CLOUDS', text: `REACH ${BIOMES.clouds.from} M.`, gems: 18, test: reach(BIOMES.clouds.from) },
  { id: 'black-glass', page: 'height', name: 'BLACK GLASS', text: `REACH THE OBSIDIAN SPIRES AT ${BIOMES.obsidian.from} M.`, gems: 25, test: reach(BIOMES.obsidian.from) },
  { id: 'crystal-heights', page: 'height', name: 'CRYSTAL HEIGHTS', text: `REACH ${BIOMES.crystal.from} M.`, gems: 35, test: reach(BIOMES.crystal.from) },
  { id: 'off-the-map', page: 'height', name: 'OFF THE MAP', text: 'REACH 1500 M. NOBODY HAS DRAWN THIS PART.', gems: 50, test: reach(1500) },

  { id: 'groove', page: 'rhythm', name: 'IN THE GROOVE', text: '10 PERFECT MOVES IN A ROW.', gems: 5, test: ({ run }) => !!run && run.bestStreak >= 10 },
  { id: 'metronome', page: 'rhythm', name: 'METRONOME', text: '25 PERFECT MOVES IN A ROW.', gems: 10, test: ({ run }) => !!run && run.bestStreak >= 25 },
  { id: 'heartbeat', page: 'rhythm', name: 'HEARTBEAT OF THE MOUNTAIN', text: '50 PERFECT MOVES IN A ROW.', gems: 25, test: ({ run }) => !!run && run.bestStreak >= 50 },
  { id: 'hundred', page: 'rhythm', name: 'A HUNDRED PERFECTS', text: '100 PERFECT MOVES IN ONE RUN.', gems: 15, test: ({ run }) => !!run && run.perfects >= 100 },
  { id: 'flawless-ten', page: 'rhythm', name: 'NOT A SINGLE SLIP', text: '10 FLAWLESS CLIMBS IN ONE RUN.', gems: 12, test: ({ run }) => !!run && run.flawless >= 10 },

  { id: 'rock-dodger', page: 'mountain', name: 'ROCK DODGER', text: 'DODGE 10 FALLING ROCKS.', gems: 10, test: ({ c }) => (c.dodges || 0) >= 10 },
  { id: 'by-feel', page: 'mountain', name: 'BY FEEL', text: 'MAKE 8 CLIMBS DURING WHITEOUTS IN ONE RUN.', gems: 12, test: ({ run }) => !!run && run.whiteoutClimbs >= 8 },
  { id: 'hawk', page: 'mountain', name: 'HAWK', text: 'RIDE 5 THERMALS.', gems: 12, test: ({ c }) => (c.thermals || 0) >= 5 },
  { id: 'headlamp', page: 'mountain', name: 'HEADLAMP', text: 'REACH A LEDGE IN THE OBSIDIAN SPIRES.', gems: 15, test: ({ c }) => (c.darkLedges || 0) >= 1 },
  { id: 'quick-hands', page: 'mountain', name: 'QUICK HANDS', text: 'TAKE 5 RISKY ROUTES BEFORE THE CRYSTAL SEALS THEM.', gems: 15, test: ({ c }) => (c.quickHands || 0) >= 5 },
  { id: 'great-catch', page: 'mountain', name: 'GREAT CATCH', text: 'CATCH A SLIP WITH A PERFECT GRAB.', gems: 5, test: ({ c }) => (c.greatCatches || 0) >= 1 },

  { id: 'gem-pockets', page: 'finds', name: 'GEM POCKETS', text: 'FIND 25 GEMS IN ONE RUN.', gems: 8, test: ({ run }) => !!run && run.gems >= 25 },
  { id: 'geologist', page: 'finds', name: 'GEOLOGIST', text: 'FIND ALL SIX KINDS OF STONE.', gems: 25, test: ({ d }) => GEM_ORDER.every((k) => (d.gemsFound[k] || 0) > 0) },
  { id: 'explorer', page: 'finds', name: 'EXPLORER', text: 'MAKE 5 DISCOVERIES.', gems: 10, test: ({ d }) => d.discoveries.length >= 5 },
  { id: 'sightseer', page: 'finds', name: 'SIGHTSEER', text: 'VISIT 10 VIEWPOINTS.', gems: 10, test: ({ d }) => d.viewpoints.length >= 10 },
  { id: 'night-shot', page: 'finds', name: 'NIGHT SHOT', text: 'TAKE A PHOTO UNDER THE STARS.', gems: 5, secret: true, test: ({ c }) => (c.nightPhotos || 0) >= 1 },

  { id: 'no-safe-way', page: 'daring', name: 'NO SAFE WAY', text: 'TAKE 5 RISKY ROUTES IN A ROW.', gems: 10, test: ({ run }) => !!run && run.riskyRow >= 5 },
  { id: 'clean-ascent', page: 'daring', name: 'CLEAN ASCENT', text: `REACH ${BIOMES.clouds.from} M WITHOUT A SINGLE FALL.`, gems: 20, test: ({ run }) => !!run && run.falls === 0 && (run.maxHeight || 0) >= BIOMES.clouds.from },
  { id: 'hard-as-rock', page: 'daring', name: 'HARD AS ROCK', text: 'REACH 300 M IN HARD MODE.', gems: 15, test: reachIn('hard', 300) },
  { id: 'summit-fever', page: 'daring', name: 'SUMMIT FEVER', text: `REACH ${BIOMES.clouds.from} M IN SUMMIT MODE.`, gems: 30, test: reachIn('summit', BIOMES.clouds.from) },
  { id: 'bare-hands', page: 'daring', name: 'BARE HANDS', text: 'REACH 200 M IN NORMAL WITH NO GEAR OR PERK.', gems: 12, secret: true, test: ({ run }) => !!run && run.mode === 'normal' && run.bare && (run.maxHeight || 0) >= 200 },
];

export const STAMP_BY_ID = Object.fromEntries(STAMPS.map((s) => [s.id, s]));
