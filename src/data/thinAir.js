// THIN AIR: a ladder of ten harder versions of Normal, for climbers who have
// seen the dragon. Pure difficulty: each tier keeps every rule of the tiers
// below it and adds one more. No new rewards, only a record per tier.
//
// Unlock: reach the Dragon's Spine (UNLOCK_AT) in Normal. Tier n+1 opens when
// you reach NEXT_AT on tier n. Gear, perks and Trail Boons still work (it is
// still Normal); dares never mix with it. Thin Air runs keep their own record
// and are not sent to the leaderboard.
import { BALANCE } from '../config/balanceConfig.js';
import { cleanDares } from './dares.js';

export const THIN_AIR = {
  tiers: 10,
  unlockAt: 1700, // Normal record that opens tier 1 (the Dragon's Spine)
  nextAt: 832, // height on tier n that opens tier n+1 (the Crystal Heights)
};

// One rule per tier. apply(cfg) changes the derived mode config.
export const TIER_RULES = [
  { text: 'GRIP DRAINS 15% FASTER WHILE YOU HANG.', short: 'HUNGRY HANDS', apply: (c) => { c.drainScale *= 1.15; } },
  { text: 'TIMING WINDOWS ARE 8% TIGHTER.', short: 'NARROW BEAT', apply: (c) => { c.windowScale *= 0.92; } },
  { text: 'THE MOUNTAIN RAMPS UP 25% SOONER.', short: 'STEEP START', apply: (c) => { c.rampSpeed *= 1.25; } },
  { text: 'MISSES COST 2 GRIP MORE.', short: 'HEAVY MISSES', apply: (c) => { c.missExtra = (c.missExtra || 0) + 2; } },
  { text: 'LEDGES ONLY FILL YOUR GRIP TO 85.', short: 'COLD LEDGES', apply: (c) => { c.ledgeFill = 0.85; } },
  { text: 'PERFECTS COST TWICE AS MUCH GRIP.', short: 'NO FREE MOVES', apply: (c) => { c.perfectCostFactor *= 2; } },
  { text: 'NO GRIP BACK FROM STREAK MILESTONES.', short: 'NO APPLAUSE', apply: (c) => { c.noStreakGrip = true; } },
  { text: 'CRUMBLING HOLDS BREAK 25% SOONER. CATCHES ARE 15% NARROWER.', short: 'BRITTLE ROCK', apply: (c) => { c.crumbleMs *= 0.75; c.catchScale *= 0.85; } },
  { text: 'FROM 300 M EVERY CLIMB HAS ONE MORE MOVE.', short: 'LONG REACH', apply: (c) => { c.extraInputs = { from: 300, add: 1 }; } },
  { text: 'THE BEAT IS 6% FASTER.', short: 'RACING HEART', apply: (c) => { c.tempo = (c.tempo || 1) * 0.94; } },
];

const cache = new Map();
// The mode config for a tier (1..10): Normal plus every rule up to that tier.
export function thinAirConfig(tier) {
  const t = Math.max(1, Math.min(THIN_AIR.tiers, tier | 0));
  if (cache.has(t)) return cache.get(t);
  const c = { ...BALANCE.modes.normal, label: `THIN AIR ${t}`, thinAir: t };
  TIER_RULES.slice(0, t).forEach((r) => r.apply(c));
  cache.set(t, c);
  return c;
}

// The highest tier this save may pick (0: Thin Air is still locked).
export function thinAirTop(data) {
  if (((data.bestByMode && data.bestByMode.normal) || 0) < THIN_AIR.unlockAt) return 0;
  const best = data.thinAirBest || {};
  let top = 1;
  while (top < THIN_AIR.tiers && (best[top] || 0) >= THIN_AIR.nextAt) top++;
  return top;
}

// The tier the next endless run climbs on (0: plain Normal). Only Normal
// without dares, and never above what is unlocked.
export function activeThinAir(data) {
  const s = data.settings || {};
  if ((s.mode || 'normal') !== 'normal' || cleanDares(s.dares).length) return 0;
  return Math.min(s.thinAir | 0, thinAirTop(data));
}

// What builds the mountain: the mode name, or the tier's config. The title
// camp and the run must use the same one, so they show the same mountain.
export function mountainMode(data) {
  const t = activeThinAir(data);
  const s = data.settings || {};
  return t ? thinAirConfig(t) : (BALANCE.modes[s.mode] ? s.mode : 'normal');
}
