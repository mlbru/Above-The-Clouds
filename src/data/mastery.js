// Biome mastery: three stars per biome, each earned within one pass through
// that biome (one stretch, in one run). All three unlock that biome's reward
// (a cosmetic with requirement { mastery: biomeId }).
//   flawless  climb the whole stretch, from its first metre, without a slip
//   perfects  this many perfect moves inside the stretch
//   gems      this many of the biome's own gem inside the stretch
import { BIOMES, SEQUENCE } from './biomes.js';
import { gemForBiome } from './gems.js';

const GOALS = {
  green: { perfects: 20, gems: 2 },
  stone: { perfects: 30, gems: 2 },
};
const DEFAULT_GOALS = { perfects: 35, gems: 3 };

export const STARS = ['flawless', 'perfects', 'gems'];

export function masteryGoals(biomeId) {
  return { ...DEFAULT_GOALS, ...GOALS[biomeId] };
}

// One line per star, for the collection card and the toast.
export function starLabel(biomeId, star) {
  const g = masteryGoals(biomeId);
  if (star === 'flawless') return 'NO SLIPS';
  if (star === 'perfects') return `${g.perfects} PERFECTS`;
  return `${g.gems} ${gemForBiome(biomeId).name}${g.gems > 1 ? 'S' : ''}`;
}

export function starText(biomeId) {
  const b = BIOMES[biomeId];
  return `IN ONE PASS: CLIMB ALL OF ${b.name.replace(/^THE /, '')} WITHOUT A SLIP, ${starLabel(biomeId, 'perfects')}, ${starLabel(biomeId, 'gems')}.`;
}

export const MASTERY_BIOMES = SEQUENCE;
