// Mountain events (idea sheet 1.10): one run-wide surprise per endless run,
// picked from the run's seed and announced by Bram as you leave base camp.
// Everything about them can be seen; nothing has to be heard.
//   avalanche  once in every biome a slide comes: be on a ledge when it does
//   migration  cranes fly north all run; a perfect hit may bring down a feather (gems)
//   eclipse    for one biome the sun goes out and the notes only flash on the beat
//   meteors    shooting stars land on the wall and leave a gem on a route
//   rival      another climber races you up the same mountain, ledge to ledge
// Rescues (idea sheet 1.8) are not an event: a stranded climber can turn up
// on any run (see RESCUE).
import { hashInts, SeededRandom } from '../utils/seededRandom.js';
import { stretchAt, stretchIndexAt } from './boons.js';

export const EVENTS = {
  avalanche: {
    name: 'AVALANCHE SEASON', color: '#e8f4ff',
    bram: 'THE SNOW IS LOOSE. ONCE IN EVERY BIOME A\nSLIDE COMES: BE ON A LEDGE WHEN IT DOES.',
  },
  migration: {
    name: 'THE MIGRATION', color: '#f4efe4',
    bram: 'THE CRANES FLY NORTH TODAY. HIT A PERFECT\nAND ONE MAY DROP YOU A FEATHER.',
  },
  eclipse: {
    name: 'THE ECLIPSE', color: '#d8a6ff',
    bram: 'THE MOON EATS THE SUN TODAY. ONE STRETCH\nGOES DARK: THE NOTES ONLY FLASH ON THE BEAT.',
  },
  meteors: {
    name: 'METEOR SHOWER', color: '#ffd870',
    bram: 'STARS ARE FALLING ON THE MOUNTAIN. WHERE\nTHEY LAND THEY LEAVE A GEM.',
  },
  rival: {
    name: 'THE RIVAL', color: '#ff9a7a',
    bram: 'KESTREL IS RACING YOU UP TODAY. GET TO\nEACH LEDGE FIRST AND I PAY YOU FOR IT.',
  },
};
export const EVENT_IDS = Object.keys(EVENTS);

export const EVENT_CFG = {
  // A run has an event this often (the rest are quiet).
  chance: 0.7,
  avalanche: { warnSec: 15, grip: 30 },
  migration: { featherChance: 0.1, flockSec: [3, 7] },
  // The eclipse comes this many biomes after the start.
  eclipse: { after: [1, 3] },
  meteors: { chance: 0.3 },
  rival: { secPerLevel: 1.15, lead: 8, ledgeGems: 2, name: 'KESTREL', look: { coat: 0x9a4ad8, skin: 0xe0b090, helm: 0xf2c14e } },
};

// The event of a run on this seed, or null.
export function runEvent(seed) {
  const rng = new SeededRandom(hashInts(seed | 0, 9091));
  if (rng.next() >= EVENT_CFG.chance) return null;
  return EVENT_IDS[rng.int(0, EVENT_IDS.length - 1)];
}

// Where the avalanche comes down in the biome stretch that starts at `from`
// and is `len` metres long: somewhere in its middle three fifths.
export function avalancheAt(seed, from, len = 173) {
  return from + Math.round(len * 0.2) + (hashInts(seed | 0, from, 5113) % Math.max(1, Math.round(len * 0.6)));
}

// The biome stretch the eclipse darkens: { biome, from } (startMeters: where the run starts).
export function eclipseStretch(seed, startMeters = 0) {
  const s = stretchIndexAt(startMeters);
  const [a, b] = EVENT_CFG.eclipse.after;
  return stretchAt(s + a + (hashInts(seed | 0, 6007) % (b - a + 1)));
}

// Stranded climbers (1.8): rare, never twice at once. Each has a name and a
// jacket of their own; bring them to a ledge and their flag flies at camp.
export const RESCUE = {
  // Chance per route choice (above minMeters) that someone hangs on one of the routes.
  chance: 0.012,
  minMeters: 60,
  // Misses they copy before they give up and rope down to camp.
  strikes: 3,
  // A pouch of the biome's gem, this many stones.
  pouch: 3,
  people: [
    { name: 'ARNE', coat: 0x3ab8a8, skin: 0xf0c8a0, helm: 0xe84a3a },
    { name: 'SOLVEIG', coat: 0xe86a2a, skin: 0xe8b48a, helm: 0xf4efe4 },
    { name: 'YUKI', coat: 0x4f86f0, skin: 0xf0d0b0, helm: 0xf2c14e },
    { name: 'DAWA', coat: 0xc8342a, skin: 0xb07a50, helm: 0x3a3a48 },
    { name: 'MILO', coat: 0x8fd16a, skin: 0xe0b090, helm: 0x9a4ad8 },
    { name: 'ROSA', coat: 0xf2c14e, skin: 0xc8946a, helm: 0x4f86f0 },
    { name: 'IVO', coat: 0xd86ac4, skin: 0xf0c8a0, helm: 0x2a2a30 },
  ],
};
