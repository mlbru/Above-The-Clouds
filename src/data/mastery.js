// Biome mastery: three stars per biome, each earned within one pass through
// that biome (one stretch, in one run). All three unlock that biome's reward
// (a cosmetic with requirement { mastery: biomeId }) and the lift ticket to
// the biome above it (data/lifts.js).
//   flawless  climb the whole stretch, from its first metre, without a slip
//   streak    a streak of this many perfect moves inside the stretch
//   gems      this many of the biome's own gem inside the stretch
// The goals were set with `node tests/balanceSim.mjs --economy --passes`.
import { BIOMES, SEQUENCE } from './biomes.js';
import { gemForBiome } from './gems.js';

const GOALS = {
  green: { streak: 12, gems: 3 },
  stone: { streak: 16, gems: 6 },
  frozen: { streak: 18, gems: 5 },
  clouds: { streak: 22, gems: 5 },
  hive: { streak: 25, gems: 5 },
  obsidian: { streak: 28, gems: 4 },
  crystal: { streak: 30, gems: 4 },
  clockwork: { streak: 30, gems: 3 },
  storm: { streak: 32, gems: 3 },
  aurora: { streak: 32, gems: 3 },
  bones: { streak: 35, gems: 2 },
  dragon: { streak: 35, gems: 2 },
};

// The streak star was once 'perfects' (a count, not a streak); old saves keep it.
export const STARS = ['flawless', 'streak', 'gems'];

export function masteryGoals(biomeId) {
  return GOALS[biomeId] || GOALS.dragon;
}

// One line per star, for the mountain map, the run summary and the toast.
export function starLabel(biomeId, star) {
  const g = masteryGoals(biomeId);
  if (star === 'flawless') return 'NO SLIPS';
  if (star === 'streak') return `${g.streak} PERFECTS IN A ROW`;
  return `${g.gems} ${gemForBiome(biomeId).name}${g.gems > 1 ? 'S' : ''}`;
}

export function starText(biomeId) {
  const b = BIOMES[biomeId];
  return `IN ONE PASS: CLIMB ALL OF ${b.name.replace(/^THE /, '')} WITHOUT A SLIP, ${starLabel(biomeId, 'streak')}, ${starLabel(biomeId, 'gems')}.`;
}

export const MASTERY_BIOMES = SEQUENCE;
