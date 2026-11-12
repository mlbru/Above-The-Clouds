// Pets (idea sheet 3.10): one companion at a time, chosen in the pen at base
// camp (scenes/PetScene.js). It comes along on every run, grows with the
// metres you climb together (baby, young, grown), and has one small habit
// that hints at what you can already see; none of them changes grip or timing.
import { BIOMES } from './biomes.js';

const best = (d) => (d.bestByMode && d.bestByMode.normal) || 0;

export const PETS = [
  {
    id: 'kid', name: 'GOAT KID', home: 'hay',
    hint: 'A GOAT HAS TO FOLLOW YOU UP THE WALL FIRST.',
    habit: 'RIDES ON YOUR PACK. BLEATS WHEN YOU PICK A ROUTE WITH LOOSE OR CRUMBLING ROCK.',
    bram: 'FOLLOWED YOU HOME, DID IT? THEY ALWAYS DO.',
    unlocked: (d) => ((d.counters && d.counters.goatFriends) || 0) >= 1,
  },
  {
    id: 'bee', name: 'HIVE BEE', home: 'hive',
    hint: `REACH THE AMBER HIVE (${BIOMES.hive.from} M).`,
    habit: 'BUZZES ROUND YOU, AND HOVERS OVER A ROUTE WITH A GEM ON IT WHILE YOU CHOOSE.',
    bram: 'SHE KNOWS WHERE THE SWEET THINGS ARE. SO DOES EVERY BEE.',
    unlocked: (d) => best(d) >= BIOMES.hive.from,
  },
  {
    id: 'moth', name: 'CRYSTAL MOTH', home: 'lantern',
    hint: `REACH THE CRYSTAL HEIGHTS (${BIOMES.crystal.from} M).`,
    habit: 'FLUTTERS BY YOUR HEAD. AT NIGHT IT GLOWS AND LIGHTS THE ROCK AROUND YOU.',
    bram: 'IT DRINKS STARLIGHT. DO NOT ASK ME HOW.',
    unlocked: (d) => best(d) >= BIOMES.crystal.from,
  },
  {
    id: 'dragonling', name: 'DRAGONLING', home: 'stone',
    hint: "CROSS THE DRAGON'S GATE.",
    habit: 'SITS ON YOUR SHOULDER AND PUFFS SMOKE. HIDES BEHIND YOUR HEAD WHEN THE BIG ONE WAKES.',
    bram: 'IT HATCHED IN YOUR PACK SOMEWHERE OVER THE CLOUD SEA. NOBODY IS MORE SURPRISED THAN ME.',
    unlocked: (d) => ((d.counters && d.counters.gates) || 0) >= 1,
  },
];
export const PET_BY_ID = Object.fromEntries(PETS.map((p) => [p.id, p]));

// Metres climbed together to reach each size.
export const STAGES = [{ at: 0, name: 'BABY' }, { at: 1500, name: 'YOUNG' }, { at: 6000, name: 'GROWN' }];

export function petState(d) {
  if (!d.pets || typeof d.pets !== 'object') d.pets = { active: null, m: {} };
  d.pets.m = d.pets.m || {};
  return d.pets;
}

export const petMeters = (d, id) => (petState(d).m[id] || 0);
export function petStage(d, id) {
  const m = petMeters(d, id);
  let s = 0;
  STAGES.forEach((st, i) => { if (m >= st.at) s = i; });
  return s;
}

// The pet coming along on the next run, or null.
export function activePet(d) {
  const id = petState(d).active;
  const p = id && PET_BY_ID[id];
  return p && p.unlocked(d) ? p : null;
}

// Metres climbed with the active pet. Returns the new stage if it just grew.
export function growPet(d, meters) {
  const p = activePet(d);
  if (!p || meters <= 0) return null;
  const before = petStage(d, p.id);
  petState(d).m[p.id] = petMeters(d, p.id) + meters;
  const after = petStage(d, p.id);
  return after > before ? after : null;
}
