// Trail Boons: three shrine ledges per Normal endless run. At each one you
// take one of three gifts for the rest of the run. Every gift has a price.
// Everything here is pure and seeded, so the balance sim and tests use it too
// and a Daily Climb can hand everyone the same shrines and offers.
import { BIOMES, SEQUENCE, LOOP_START, LOOP, LOOP_SPAN } from './biomes.js';
import { SeededRandom, hashInts } from '../utils/seededRandom.js';

// group: grip | rhythm | route | carry | legendary
export const BOONS = [
  { id: 'deepbreath', name: 'DEEP BREATH', group: 'grip', gift: 'LEDGES FILL YOUR GRIP TO 120.', price: 'ONLY 1.5 S OF HANGING BEFORE GRIP DRAINS.', bram: 'BIG LUNGS, SHORT PATIENCE.' },
  { id: 'flask', name: "BRAM'S FLASK", group: 'grip', gift: 'PRESS ↓ ON A HOLD: +30 GRIP. ONCE PER BIOME.', price: 'LEDGES ONLY FILL YOUR GRIP TO 90.', bram: 'MY OWN RECIPE. DO NOT ASK WHAT IS IN IT.' },
  { id: 'drummer', name: 'DRUMMER', group: 'grip', gift: 'A PERFECT OFF-BEAT NOTE GIVES +2 GRIP.', price: 'HOLD NOTES COST 2 GRIP MORE.', bram: 'FEEL THE GAPS BETWEEN THE BEATS.' },
  { id: 'ironnerve', name: 'IRON NERVE', group: 'grip', gift: 'A GOOD HIT COSTS HALF AS MUCH GRIP.', price: 'NO FLAWLESS BONUS ON ALL-PERFECT CLIMBS.', bram: 'GOOD IS GOOD ENOUGH. MOSTLY.' },
  { id: 'echo', name: 'ECHO', group: 'rhythm', gift: 'EVERY PERFECT COUNTS DOUBLE FOR YOUR STREAK.', price: 'EVERY MISS COSTS 2 GRIP MORE.', bram: 'THE MOUNTAIN ANSWERS TWICE.' },
  { id: 'steadypace', name: 'STEADY PACE', group: 'rhythm', gift: 'THE BEAT IS 5% SLOWER.', price: 'LEDGES ONLY FILL YOUR GRIP TO 75.', bram: 'SLOW FEET, TIRED HANDS.' },
  { id: 'songbird', name: 'SONGBIRD', group: 'rhythm', gift: 'A BIRD SINGS EVERY ARROW: HIGH →, MIDDLE ↑, LOW ←.', price: 'NOTES SHOW UP LATER ON THE TRACK.', bram: 'LISTEN. SHE KNOWS THE WAY.' },
  { id: 'gambler', name: 'GAMBLER', group: 'route', gift: 'RISKY ROUTES COST 10% LESS GRIP.', price: 'NO MORE SAFE ROUTES.', bram: 'FORTUNE FAVOURS THE BOLD. MOSTLY THE BOLD.' },
  { id: 'magpie', name: 'MAGPIE', group: 'route', gift: 'A GEM WAITS ON EVERY ROUTE.', price: 'A FALL DROPS 25% OF THIS RUN\'S GEMS.', bram: 'SHINY! NOW DO NOT DROP IT.' },
  { id: 'cartographer', name: 'CARTOGRAPHER', group: 'route', gift: 'SEE WHERE EACH ROUTE LEADS NEXT.', price: 'GRIP DRAINS THE MOMENT YOU HANG.', bram: 'A GOOD MAP COSTS TIME.' },
  { id: 'featherweight', name: 'FEATHERWEIGHT', group: 'route', gift: 'EVERY 3RD CLEAN CLIMB IN A ROW LIFTS YOU ONE HOLD HIGHER.', price: 'GUSTS BLOW HALF AGAIN AS OFTEN.', bram: 'LIGHT AS A FEATHER. AND AS EASY TO BLOW AWAY.' },
  { id: 'warmlungs', name: 'WARM LUNGS', group: 'carry', gift: 'THERMALS RISE IN EVERY BIOME.', price: 'MISSING A THERMAL NOTE COSTS 4 GRIP.', bram: 'YOU BREATHE OUT, THE MOUNTAIN BREATHES IN.' },
  { id: 'catseyes', name: "CAT'S EYES", group: 'carry', gift: 'BLIND AND DARK NOTES NEVER FADE ALL THE WAY.', price: 'NIGHTS LAST TWICE AS LONG.', bram: 'THE NIGHT WILL WANT TO STAY AND WATCH.' },
  { id: 'icefingers', name: 'ICE FINGERS', group: 'carry', gift: 'ICY HOLDS ARE EASY, AND COUNT DOUBLE FOR YOUR STREAK.', price: 'A MISS ON LOOSE ROCK COSTS EVEN MORE.', bram: 'COLD HANDS, WARM HEART, LOOSE ROCK.' },
  // Idea sheet 1.13 (the ones that were about sound are made to be seen).
  { id: 'metronome', name: 'METRONOME', group: 'rhythm', gift: 'A PENDULUM SWINGS OVER THE TRACK AND FLASHES ON EVERY BEAT.', price: 'THE BEAT IS 5% FASTER.', bram: 'WATCH IT SWING. YOUR HANDS WILL FOLLOW.' },
  { id: 'sherpa', name: 'SHERPA', group: 'grip', gift: 'ONCE PER BIOME A MISSED NOTE IS CAUGHT FOR YOU.', price: 'GEMS ARE WORTH 30% LESS.', bram: 'A FRIEND ON THE ROPE. FRIENDS TAKE A CUT.' },
  { id: 'stormcaller', name: 'STORMCALLER', group: 'carry', gift: 'EVERY BOLT OF LIGHTNING GIVES YOU +10 GRIP.', price: 'STORMS COME IN EVERY BIOME.', bram: 'DANCE WITH THE STORM. IT LEADS.' },
  { id: 'goathooves', name: 'GOAT HOOVES', group: 'route', gift: 'LEDGES ARE TWICE AS COMMON.', price: 'LEDGES ONLY FILL YOUR GRIP TO 60.', bram: 'A GOAT NEVER CLIMBS FAR WITHOUT A PLACE TO STAND.' },
  { id: 'crow', name: 'OLD CROW', group: 'route', gift: 'AFTER EVERY LEDGE A CROW LEAVES A GEM ON ONE OF YOUR ROUTES.', price: 'IT STEALS ONE GEM BACK IN EVERY BIOME.', bram: 'IT KNOWS WHERE THE SHINY THINGS ARE. YOURS TOO.' },
  { id: 'lastlight', name: 'LAST LIGHT', group: 'legendary', gift: 'WHEN YOUR GRIP RUNS OUT, TIME STOPS FOR A BEAT AND YOU HOLD ON. ONCE PER BIOME.', price: 'ONLY ONE SLIP IN THE WHOLE RUN.', bram: 'THE LAST LIGHT OF THE DAY LASTS LONGEST.' },
  { id: 'phoenix', name: 'PHOENIX', group: 'legendary', gift: 'THE FALL THAT ENDS YOUR RUN LIFTS YOU BACK TO YOUR LEDGE. ONCE.', price: 'YOU LOSE EVERY OTHER GIFT.', bram: 'FROM THE ASHES. ALONE.' },
  { id: 'secondrope', name: 'SECOND ROPE', group: 'legendary', gift: 'ONE EXTRA SLIP IN EVERY STRETCH OF THREE BIOMES.', price: 'ALL GEMS ARE WORTH 25% LESS.', bram: 'A SPARE LIFE. IT COSTS A FORTUNE.' },
  { id: 'wildroute', name: 'WILD ROUTE', group: 'legendary', gift: 'A FOURTH ROUTE CLIMBS TWICE AS HIGH.', price: 'MISSES ON IT COST DOUBLE GRIP.', bram: 'NOBODY KNOWS WHERE IT GOES. THAT IS THE POINT.' },
];
export const BOON_BY_ID = Object.fromEntries(BOONS.map((b) => [b.id, b]));

export const GROUPS = {
  grip: { label: 'GRIP', color: 0x8fd16a },
  rhythm: { label: 'RHYTHM', color: 0xff9ae6 },
  route: { label: 'ROUTE', color: 0x9fd8ff },
  carry: { label: 'CARRY-OVER', color: 0xffb45a },
  souvenir: { label: 'SOUVENIR', color: 0xd8a6ff },
  legendary: { label: '★ LEGENDARY', color: 0xffd24a },
};

// A biome twist you can take along: `souvenir:<biome>`. Bone Garden and the
// dragon need their dragon, so they stay home.
export const SOUVENIR_MECHANICS = {
  stone: { mechanic: 'rockfall', name: 'FALLING ROCK', gift: 'ROCKFALL FOLLOWS YOU UP THE MOUNTAIN.' },
  frozen: { mechanic: 'whiteout', name: 'POCKET BLIZZARD', gift: 'WHITEOUTS FOLLOW YOU UP THE MOUNTAIN.' },
  clouds: { mechanic: 'thermals', name: 'BOTTLED WIND', gift: 'THERMALS FOLLOW YOU UP THE MOUNTAIN.' },
  hive: { mechanic: 'swarm', name: 'A JAR OF BEES', gift: 'THE SWARM FOLLOWS YOU UP THE MOUNTAIN.' },
  obsidian: { mechanic: 'darkness', name: 'BLACK GLASS', gift: 'THE DARKNESS FOLLOWS YOU UP THE MOUNTAIN.' },
  crystal: { mechanic: 'prismLight', name: 'A SHARD OF PRISM', gift: 'THE PRISM LIGHT FOLLOWS YOU UP THE MOUNTAIN.' },
  clockwork: { mechanic: 'gears', name: 'A LOOSE COG', gift: 'GEAR NOTES FOLLOW YOU UP THE MOUNTAIN.' },
  storm: { mechanic: 'storm', name: 'A CAUGHT STORM', gift: 'STORMS FOLLOW YOU UP THE MOUNTAIN.' },
  aurora: { mechanic: 'swing', name: 'A STRAND OF AURORA', gift: 'THE SWING FOLLOWS YOU UP THE MOUNTAIN.' },
};

export const SYNERGIES = [
  { id: 'hoardsong', name: 'HOARD SONG', pair: ['echo', 'magpie'], text: 'EVERY 10-STREAK DROPS A GEM.' },
  { id: 'highroller', name: 'HIGH ROLLER', pair: ['gambler', 'magpie'], text: 'GEMS ON RISKY ROUTES ARE WORTH DOUBLE.' },
  { id: 'tailwind', name: 'TAILWIND', pair: ['warmlungs', 'featherweight'], text: 'A THERMAL RIDE COUNTS TWICE TOWARDS THE 3 CLEAN CLIMBS.' },
  { id: 'moonsong', name: 'MOON SONG', pair: ['catseyes', 'songbird'], text: 'AT NIGHT THE SONGBIRD SHOWS NOTES AS EARLY AS EVER.' },
  { id: 'secondwind', name: 'SECOND WIND', pair: ['flask', 'deepbreath'], text: 'THE FLASK FILLS YOUR GRIP RIGHT UP.' },
  { id: 'nightshift', name: 'NIGHT SHIFT', pair: ['catseyes', 'stormcaller'], text: 'STORMS ONLY COME AT NIGHT, AND LIGHTNING LIGHTS UP EVERY NOTE ON THE TRACK.' },
];

export const SHRINE = {
  // Biome stretches after the start biome that can hold each shrine.
  bands: [[1, 2], [3, 5], [6, 8]],
  legendaryChance: 0.1,
  rerollPrice: 60,
  pairWeight: 2,
  maxSouvenirs: 3,
  salt: 0x5a1e,
};

export const isSouvenir = (id) => typeof id === 'string' && id.startsWith('souvenir:');
export const souvenirBiome = (id) => (isSouvenir(id) ? id.slice(9) : null);

// The card for any boon id, souvenirs included.
export function boonCard(id) {
  if (isSouvenir(id)) {
    const b = souvenirBiome(id), s = SOUVENIR_MECHANICS[b];
    if (!s) return null;
    return { id, name: s.name, group: 'souvenir', gift: 'EVERY GEM IS WORTH 50% MORE, ALL RUN.', price: s.gift, bram: `A PIECE OF ${BIOMES[b].name} TO TAKE ALONG.`, biome: b };
  }
  return BOON_BY_ID[id] || null;
}

// The biome id of the k-th biome stretch (0 = the Green Rise) and where it starts.
export function stretchAt(k) {
  if (k < SEQUENCE.length) return { biome: SEQUENCE[k], from: BIOMES[SEQUENCE[k]].from };
  const j = k - SEQUENCE.length;
  return { biome: LOOP[j % LOOP.length], from: LOOP_START + j * LOOP_SPAN };
}

// Index of the stretch that starts at `fromMeters` (or holds it).
export function stretchIndexAt(meters) {
  let k = 0;
  while (k < 400 && stretchAt(k + 1).from <= meters) k++;
  return k;
}

// The three shrine biomes of a run on this seed: [{ index, biome, from }].
// startMeters: where the run starts (0, or a lift ticket's biome).
export function shrinePlan(seed, startMeters = 0) {
  const s = stretchIndexAt(startMeters);
  const rng = new SeededRandom(hashInts(seed | 0, s, SHRINE.salt));
  return SHRINE.bands.map(([a, b], band) => {
    const index = s + rng.int(a, b);
    return { band, index, ...stretchAt(index) };
  });
}

// The gifts on offer at a shrine. held: ids already taken. reroll: 0, 1, ...
export function boonOffer(seed, shrineIndex, { held = [], reroll = 0, biome = null } = {}) {
  const rng = new SeededRandom(hashInts(seed | 0, shrineIndex, reroll, SHRINE.salt + 1));
  const have = new Set(held);
  const souvenirs = held.filter(isSouvenir).length;
  const cards = [];
  const souvenir = biome && SOUVENIR_MECHANICS[biome] ? `souvenir:${biome}` : null;
  if (souvenir && !have.has(souvenir) && souvenirs < SHRINE.maxSouvenirs) cards.push(souvenir);
  const partner = (id) => SYNERGIES.some((s) => s.pair.includes(id) && s.pair.some((p) => p !== id && have.has(p)));
  const pool = BOONS.filter((b) => b.group !== 'legendary' && !have.has(b.id));
  const pick = (from) => {
    const weights = from.map((b) => (partner(b.id) ? SHRINE.pairWeight : 1));
    let u = rng.next() * weights.reduce((a, w) => a + w, 0);
    for (let i = 0; i < from.length; i++) { u -= weights[i]; if (u < 0) return from[i]; }
    return from[from.length - 1];
  };
  const legends = BOONS.filter((b) => b.group === 'legendary' && !have.has(b.id) && !(b.id === 'phoenix' && have.has('phoenix-used')));
  if (legends.length && rng.next() < SHRINE.legendaryChance) cards.push(legends[rng.int(0, legends.length - 1)].id);
  const left = pool.slice();
  while (cards.length < 3 && left.length) {
    const b = pick(left);
    cards.push(b.id);
    left.splice(left.indexOf(b), 1);
  }
  return cards;
}

// Synergies complete with these boons.
export const activeSynergies = (held) => SYNERGIES.filter((s) => s.pair.every((p) => held.includes(p)));

// The synergy a card would complete, given what is held.
export const completesSynergy = (id, held) => SYNERGIES.find((s) => s.pair.includes(id) && s.pair.every((p) => p === id || held.includes(p))) || null;

// Every number the boons change, combined. ClimbScene and the sim read this.
export function boonEffects(held = []) {
  const has = (id) => held.includes(id);
  const syn = new Set(activeSynergies(held).map((s) => s.id));
  const souvenirs = held.filter(isSouvenir);
  let ledgeFill = 1;
  if (has('steadypace')) ledgeFill = Math.min(ledgeFill, 0.75);
  if (has('flask')) ledgeFill = Math.min(ledgeFill, 0.9);
  if (has('goathooves')) ledgeFill = Math.min(ledgeFill, 0.6);
  return {
    maxGrip: has('deepbreath') ? 120 : 100,
    // Share of the normal grip (100) a ledge fills, before DEEP BREATH raises the cap.
    ledgeFill,
    hangGraceSec: has('cartographer') ? 0 : has('deepbreath') ? 1.5 : null,
    flask: has('flask') ? (syn.has('secondwind') ? 'full' : 30) : 0,
    offbeatPerfectGrip: has('drummer') ? 2 : 0,
    holdExtraCost: has('drummer') ? 2 : 0,
    goodCostFactor: has('ironnerve') ? 0.5 : 1,
    noFlawlessBonus: has('ironnerve'),
    streakPerPerfect: has('echo') ? 2 : 1,
    missExtraCost: has('echo') ? 2 : 0,
    beatScale: (has('steadypace') ? 1.05 : 1) * (has('metronome') ? 0.95 : 1),
    metronome: has('metronome'),
    sherpa: has('sherpa'),
    lightningGrip: has('stormcaller') ? 10 : 0,
    // Biome rules carried everywhere (biome ids, like the souvenirs).
    carry: has('stormcaller') ? ['storm'] : [],
    restScale: has('goathooves') ? 0.5 : 1,
    crow: has('crow'),
    lastLight: has('lastlight'),
    oneSlip: has('lastlight'),
    nightShift: syn.has('nightshift'),
    songbird: has('songbird'),
    lateReveal: has('songbird') ? 0.7 : 1,
    noSafe: has('gambler'),
    riskyCostScale: has('gambler') ? 0.9 : 1,
    gemOnEveryRoute: has('magpie'),
    fallGemLoss: has('magpie') ? 0.25 : 0,
    preview: has('cartographer'),
    featherEvery: has('featherweight') ? 3 : 0,
    gustScale: has('featherweight') ? 1.5 : 1,
    thermalsEverywhere: has('warmlungs') ? 0.5 : 0,
    thermalMissCost: has('warmlungs') ? 4 : 0,
    minNoteAlpha: has('catseyes') ? 0.3 : 0,
    nightScale: has('catseyes') ? 2 : 1,
    icyEasy: has('icefingers'),
    icyStreak: has('icefingers') ? 2 : 1,
    looseMissMultiplier: has('icefingers') ? 2.0 : null,
    phoenix: has('phoenix'),
    secondRope: has('secondrope'),
    wildRoute: has('wildroute'),
    gemScale: (has('secondrope') ? 0.75 : 1) * (has('sherpa') ? 0.7 : 1) * (1 + 0.5 * souvenirs.length),
    souvenirs: souvenirs.map((id) => SOUVENIR_MECHANICS[souvenirBiome(id)].mechanic),
    hoardSong: syn.has('hoardsong'),
    highRoller: syn.has('highroller'),
    tailwind: syn.has('tailwind'),
    nightOwl: syn.has('moonsong'),
  };
}
