// Camp requests: notes pinned on the corkboard at base camp. Three at a
// time; each asks for one thing on the mountain and pays gems. A finished
// note gets a red thumbprint and pays out the next time you open the board,
// then a new note takes its place.
//
// Kinds: 'find' (stones, discoveries, viewpoints), 'do' (streaks, clean
// climbs, dodges), 'reach' (heights) and 'people' (story notes from named
// people at camp; each is done only once, and they sit at the fire after).
//
// check({ run, d, c, base }) returns how far you are (a number up to `goal`):
//   run   the current run (maxHeight, bestStreak, flawless, perfects, stones,
//         finds, riskyBest, whiteoutClimbs, slips, falls, dodges, gems, wishes)
//   d     the save data;  c  lifetime counters;  base  counters when pinned
// Only Normal endless runs count (Thin Air included).
import { BIOMES } from './biomes.js';
import { GEMS } from './gems.js';
import { DISCOVERIES } from './discoveries.js';
import { hashInts } from '../utils/seededRandom.js';

export const PEOPLE = {
  bram: { name: 'BRAM', color: 0xc8463b },
  ines: { name: 'INES', title: 'THE PHOTOGRAPHER', color: 0x4f86f0 },
  pim: { name: 'DR PIM', title: 'THE GEOLOGIST', color: 0xa8743e },
  marta: { name: 'MARTA', title: 'THE OLD WOMAN', color: 0xb48ae0 },
  noor: { name: 'NOOR', title: 'THE CHILD', color: 0xf2c14e },
  tenzin: { name: 'TENZIN', title: 'THE MONK', color: 0xe8762a },
};

const best = (d) => (d.bestByMode && d.bestByMode.normal) || 0;
const runH = (run) => Math.floor((run && run.maxHeight) || 0);
const stone = (type) => ({ run }) => (run && run.stones && run.stones[type]) || 0;
const delta = (key) => ({ c, base }) => Math.max(0, (c[key] || 0) - ((base && base[key]) || 0));
// A height that is a stretch but in reach: a biome start below 85% of your record.
const reachBiome = (d, k) => {
  const ids = Object.values(BIOMES).filter((b) => b.from > 0 && b.from < Math.max(80, best(d) * 0.85) && !['volcano', 'sky'].includes(b.id));
  return ids.length ? ids[Math.min(ids.length - 1, Math.max(0, ids.length - 1 - (k % 3)))] : BIOMES.stone;
};
const gemFor = (d, k) => {
  const ok = Object.values(GEMS).filter((g) => BIOMES[g.biome] && BIOMES[g.biome].from < Math.max(60, best(d) * 0.8));
  return ok[Math.max(0, ok.length - 1 - (k % 3))] || GEMS.emerald;
};

// The pool. `make(d, k)` fills in the goal and text for this save (k varies it).
export const REQUESTS = [
  // ---- reach
  { id: 'reach-biome', kind: 'reach', who: 'bram', make: (d, k) => { const b = reachBiome(d, k); return { goal: b.from, text: `REACH ${b.name.replace(/^THE /, '')} (${b.from} M) IN ONE RUN.`, gems: 20 + Math.round(b.from / 40) }; }, check: ({ run }) => runH(run) },
  { id: 'reach-clean', kind: 'reach', who: 'bram', make: (d) => { const g = Math.max(120, Math.min(600, Math.round((best(d) * 0.3) / 20) * 20)); return { goal: g, text: `CLIMB ${g} M WITHOUT A SINGLE SLIP.`, gems: 25 + g / 20 }; }, check: ({ run }) => (run && !run.slips ? runH(run) : 0) },
  { id: 'reach-record', kind: 'reach', who: 'bram', need: (d) => best(d) >= 300, make: (d) => { const g = Math.round((best(d) * 0.9) / 10) * 10; return { goal: g, text: `GET WITHIN SIGHT OF YOUR RECORD: ${g} M.`, gems: 45 }; }, check: ({ run }) => runH(run) },
  // ---- do
  { id: 'streak', kind: 'do', who: 'bram', make: (d, k) => { const g = [15, 25, 35, 50][Math.min(3, Math.floor(best(d) / 500) + (k % 2))]; return { goal: g, text: `HIT ${g} PERFECTS IN A ROW.`, gems: 10 + g }; }, check: ({ run }) => (run && run.bestStreak) || 0 },
  { id: 'flawless', kind: 'do', who: 'bram', make: (d, k) => { const g = 5 + (k % 3) * 3; return { goal: g, text: `MAKE ${g} FLAWLESS CLIMBS IN ONE RUN.`, gems: 12 + g * 3 }; }, check: ({ run }) => (run && run.flawless) || 0 },
  { id: 'perfects', kind: 'do', who: 'bram', make: (d, k) => { const g = [60, 100, 150][k % 3]; return { goal: g, text: `LAND ${g} PERFECT MOVES IN ONE RUN.`, gems: 15 + g / 4 }; }, check: ({ run }) => (run && run.perfects) || 0 },
  { id: 'risky', kind: 'do', who: 'bram', make: (d, k) => { const g = 4 + (k % 3); return { goal: g, text: `TAKE ${g} RISKY ROUTES IN A ROW.`, gems: 15 + g * 4 }; }, check: ({ run }) => (run && run.riskyBest) || 0 },
  { id: 'dodges', kind: 'do', who: 'bram', need: (d) => best(d) >= 80, make: () => ({ goal: 5, text: 'DODGE 5 FALLING ROCKS IN ONE RUN.', gems: 30 }), check: ({ run }) => (run && run.dodges) || 0 },
  { id: 'catches', kind: 'do', who: 'bram', make: () => ({ goal: 2, text: 'MAKE 2 GREAT CATCHES. SLIP, AND GRAB THE WALL PERFECTLY.', gems: 30 }), check: delta('greatCatches') },
  { id: 'thermals', kind: 'do', who: 'bram', need: (d) => best(d) >= BIOMES.clouds.from, make: () => ({ goal: 3, text: 'RIDE 3 THERMALS ABOVE THE CLOUDS.', gems: 30 }), check: delta('thermals') },
  { id: 'prisms', kind: 'do', who: 'bram', need: (d) => best(d) >= BIOMES.crystal.from, make: () => ({ goal: 3, text: 'CLIMB 3 ROUTES IN THE PRISM LIGHT.', gems: 40 }), check: delta('prisms') },
  // ---- find
  { id: 'stones', kind: 'find', who: 'pim', make: (d, k) => { const g = gemFor(d, k); const n = 2 + (k % 2); return { goal: n, gem: g.id, text: `BRING ME ${n} ${g.name}${n > 1 ? 'S' : ''} FROM ONE RUN.`, gems: 15 + g.value * 4 * n }; }, check: (s, r) => stone(r.gem)(s) },
  { id: 'gems', kind: 'find', who: 'bram', make: (d, k) => { const g = Math.max(20, Math.round((best(d) / 25 + (k % 3) * 10) / 5) * 5); return { goal: g, text: `EARN ${g} GEMS IN ONE RUN.`, gems: 20 }; }, check: ({ run }) => (run && run.gems) || 0 },
  { id: 'finds', kind: 'find', who: 'ines', make: () => ({ goal: 2, text: 'FIND 2 VIEWPOINTS OR WONDERS IN ONE RUN.', gems: 25 }), check: ({ run }) => (run && run.finds ? run.finds.length : 0) },
  { id: 'nightphoto', kind: 'find', who: 'ines', make: () => ({ goal: 1, text: 'TAKE A PHOTO FROM A LEDGE AT NIGHT. THE STARS, PLEASE.', gems: 20 }), check: delta('nightPhotos') },
  // ---- people (story notes: once each)
  { id: 'ines-dragon', kind: 'people', who: 'ines', story: true, need: (d) => best(d) >= BIOMES.dragon.from, make: () => ({ goal: 1, text: "A PHOTO FROM THE DRAGON'S SPINE. I WILL PAY ANYTHING. WELL, 80 GEMS.", gems: 80, thanks: 'INES PINNED YOUR DRAGON PHOTO ABOVE HER BED.' }), check: delta('dragonPhotos') },
  { id: 'pim-topaz', kind: 'people', who: 'pim', story: true, need: (d) => best(d) >= BIOMES.storm.from, make: () => ({ goal: 3, text: 'THREE STORM TOPAZES IN ONE RUN. THEY HUM IN THE RAIN, YOU KNOW.', gems: 90, thanks: 'DR PIM HAS NOT SLEPT SINCE. THE TOPAZES HUM ALL NIGHT.' }), check: stone('topaz') },
  { id: 'marta-axe', kind: 'people', who: 'marta', story: true, need: (d) => best(d) >= 40, make: () => ({ goal: 1, text: 'MY HUSBAND LEFT HIS ICE AXE WEDGED IN THE ROCK UP THERE, LONG AGO. FIND IT FOR ME?', gems: 50, thanks: 'MARTA HELD THE AXE A LONG TIME. THEN SHE SMILED.' }), check: ({ run }) => (run && run.finds && run.finds.includes(DISCOVERIES['abandoned-axe'].name) ? 1 : 0) },
  { id: 'noor-feather', kind: 'people', who: 'noor', story: true, make: () => ({ goal: 1, text: 'BRING ME A GOAT FEATHER!!', gems: 30, thanks: 'GOATS HAVE NO FEATHERS. BUT ONE FOLLOWED YOU UP THE WALL, AND NOOR SAW IT.' }), check: delta('goatFriends') },
  { id: 'noor-wish', kind: 'people', who: 'noor', story: true, make: () => ({ goal: 1, text: 'MAKE A WISH ON A SHOOTING STAR. FOR ME. DO NOT TELL ME WHAT.', gems: 30, thanks: 'NOOR SAYS THE WISH ALREADY CAME TRUE. SHE WILL NOT SAY WHAT IT WAS.' }), check: delta('wishes') },
  { id: 'tenzin-whiteout', kind: 'people', who: 'tenzin', story: true, need: (d) => best(d) >= BIOMES.frozen.from + 40, make: () => ({ goal: 6, text: 'CLIMB SIX TIMES INSIDE ONE WHITEOUT. LISTEN, DO NOT LOOK.', gems: 60, thanks: 'TENZIN BOWED. HE SAYS YOU CLIMB LIKE SNOW FALLS.' }), check: ({ run }) => (run && run.whiteoutClimbs) || 0 },
  { id: 'tenzin-dark', kind: 'people', who: 'tenzin', story: true, need: (d) => best(d) >= BIOMES.obsidian.from + 40, make: () => ({ goal: 3, text: 'REST ON 3 LEDGES IN THE DARK OF THE OBSIDIAN SPIRES.', gems: 60, thanks: 'TENZIN LIT A CANDLE FOR YOU. IT IS STILL BURNING.' }), check: delta('darkLedges') },
];
export const REQUEST_BY_ID = Object.fromEntries(REQUESTS.map((r) => [r.id, r]));
export const ACTIVE = 3;

// The counters a note watches from the moment it is pinned.
const COUNTERS = ['greatCatches', 'thermals', 'prisms', 'nightPhotos', 'dragonPhotos', 'goatFriends', 'wishes', 'darkLedges'];

function newNote(d, salt) {
  const st = d.requests;
  const taken = new Set(st.active.map((n) => n.id));
  const pool = REQUESTS.filter((r) => !taken.has(r.id) && !(r.story && st.storyDone.includes(r.id)) && (!r.need || r.need(d)));
  if (!pool.length) return null;
  // Story notes turn up a bit more often while there are any left.
  const weights = pool.map((r) => (r.story ? 2 : 1));
  let roll = hashInts(st.serial + salt, (d.runs || 0) + 7, 0x7e4) % weights.reduce((a, b) => a + b, 0);
  let r = pool[0];
  for (let i = 0; i < pool.length; i++) { roll -= weights[i]; if (roll < 0) { r = pool[i]; break; } }
  const k = st.serial;
  st.serial++;
  const made = r.make(d, k);
  const c = d.counters || {};
  return { id: r.id, ...made, base: Object.fromEntries(COUNTERS.map((key) => [key, c[key] || 0])), best: 0, done: false };
}

// Makes sure the save has a board with three notes. Returns the state.
export function ensureRequests(d) {
  if (!d.requests || !Array.isArray(d.requests.active)) d.requests = { active: [], storyDone: [], serial: 0, paid: 0 };
  const st = d.requests;
  st.storyDone = st.storyDone || [];
  // Notes that no longer exist in the pool (an update) are dropped.
  st.active = st.active.filter((n) => REQUEST_BY_ID[n.id]);
  let guard = 0;
  while (st.active.length < ACTIVE && guard++ < 10) {
    const n = newNote(d, guard * 31);
    if (!n) break;
    st.active.push(n);
  }
  return st;
}

// Checks every open note against the run so far. Returns the notes that were
// finished just now (to announce them).
export function checkRequests(d, run) {
  const st = ensureRequests(d);
  const c = d.counters || {};
  const fresh = [];
  for (const n of st.active) {
    if (n.done) continue;
    const r = REQUEST_BY_ID[n.id];
    const v = Math.min(n.goal, r.check({ run, d, c, base: n.base }, n));
    n.best = Math.max(n.best || 0, v);
    if (v >= n.goal) { n.done = true; fresh.push(n); }
  }
  return fresh;
}

// Pays every finished note and pins new ones in their place.
// Returns [{ note, gems }] for the board to animate.
export function collectRequests(d) {
  const st = ensureRequests(d);
  const paid = [];
  st.active = st.active.map((n) => {
    if (!n.done) return n;
    const r = REQUEST_BY_ID[n.id];
    if (r.story) st.storyDone.push(n.id);
    st.paid++;
    paid.push({ note: n, gems: Math.round(n.gems) });
    return null;
  }).filter(Boolean);
  return paid;
}

export const whoOf = (n) => PEOPLE[REQUEST_BY_ID[n.id].who] || PEOPLE.bram;
