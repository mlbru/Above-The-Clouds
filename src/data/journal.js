// Bram's field journal: everything you have seen on the mountain, one chapter
// per kind of thing (like an explorer's notebook). Entries you have not met yet
// show as a dark silhouette with a hint.
//   known(prog)  true once you have seen it
//   pic          { key, frame, tint, scale } or { thumb: biomeId } (see JournalScene)
//   stat(prog)   one short line of numbers for the detail page (optional)
import { BIOMES } from './biomes.js';
import { GEMS, GEM_ORDER } from './gems.js';
import { GEAR, PERKS } from './shop.js';
import { DISCOVERIES } from './discoveries.js';
import { holdKey } from '../render/textures.js';
import { LOGBOOK_PAGES, STAMPS, stampProgress } from './logbook.js';
import { MASTERY_BIOMES, STARS, starText, starLabel } from './mastery.js';
import { COSMETICS } from './cosmetics.js';

const seenTip = (id) => (p) => p.data.tipsSeen.includes(id);
const found = (id) => (p) => p.data.discoveries.includes(id);
const count = (key) => (p) => (p.data.counters && p.data.counters[key]) || 0;

const PLACE_TEXT = {
  green: 'MEADOWS, A WINDING RIVER AND PINE FOREST BELOW. THE GENTLE START OF EVERY CLIMB.',
  stone: 'GREY ROCK AND LOOSE STONE. ROCKS COME DOWN AS YOU GRAB A HOLD: DODGE THEM ON THE BEAT.',
  frozen: 'ICE AND BLIZZARDS. IN A WHITEOUT THE NOTES SHOW LATE, BUT GEMS TURN UP TWICE AS OFTEN.',
  clouds: 'THE WORLD BELOW IS GONE. WARM THERMALS LIFT YOU HIGHER IF YOU HIT THEM PERFECTLY.',
  obsidian: 'BLACK GLASS THAT SWALLOWS THE LIGHT. THE NOTES ONLY FLASH ON THE BEAT.',
  crystal: 'A BEAM OF SPLIT SUNLIGHT SWEEPS THE ROUTES. CLIMB THE LIT ONE FOR FREE.',
  storm: 'THUNDER ON THE SUMMIT RIDGE. IN A STORM, EVERY SECOND YOU HANG COSTS GRIP.',
  aurora: 'GREEN LIGHTS SWAY OVER THE ICE, AND THE RHYTHM SWAYS WITH THEM: LONG-SHORT, LONG-SHORT.',
  dragon: 'A DRAGON SLEEPS AROUND THE PEAK. WHEN IT WAKES THE WHOLE MOUNTAIN SHAKES, AND IT BREATHES FIRE AT YOU. SWING CLEAR ON THE BEAT.',
};
const TWIST = { green: 'NO TWIST', stone: 'ROCKFALL', frozen: 'WHITEOUT', clouds: 'THERMALS', obsidian: 'DARKNESS', crystal: 'PRISM LIGHT', storm: 'STORMS', aurora: 'SWING', dragon: 'DRAGON FIRE' };

const places = Object.values(BIOMES).filter((b) => !b.special).sort((a, b) => a.from - b.from).map((b) => ({
  id: `place-${b.id}`,
  name: b.name,
  text: PLACE_TEXT[b.id],
  hint: `SOMEWHERE ABOVE ${b.from} M.`,
  pic: { thumb: b.id },
  known: (p) => p.data.biomes.includes(b.id),
  stat: () => `STARTS AT ${b.from} M  •  ${TWIST[b.id]}`,
  color: b.accentA,
}));

const creatures = [
  { id: 'bram', name: 'BRAM', text: 'THE OLD TRADER AT BASE CAMP. HE CLIMBED THIS MOUNTAIN LONG AGO AND NEVER QUITE LEFT.', pic: { key: 'npc_trader', scale: 1.5 }, known: () => true },
  { id: 'songbirds', name: 'SONGBIRDS', text: 'LITTLE FLOCKS THAT FOLLOW THE CLIMBERS UP THE LOWER SLOPES.', hint: 'LISTEN ON A SUNNY MORNING.', pic: { key: 'bird', frame: 0, scale: 3, tint: 0x4a4560 }, known: (p) => p.data.runs > 0 },
  { id: 'butterflies', name: 'MEADOW BUTTERFLIES', text: 'THEY DANCE AROUND THE CAMPFIRE AND NEVER CLIMB HIGHER THAN THE TENT.', hint: 'AT BASE CAMP.', pic: { key: 'butterfly', frame: 0, scale: 4, tint: 0xf2c14e }, known: (p) => p.data.runs > 0 },
  { id: 'lammergeier', name: 'LAMMERGEIER', text: DISCOVERIES['rare-bird'].text, hint: 'A RARE BIRD. LOOK UP NOW AND THEN.', pic: { key: 'eagle', frame: 0, scale: 2 }, known: found('rare-bird') },
  { id: 'elsa', name: 'ELSA', text: "BRAM'S OLD CLIMBING PARTNER. SHE LEFT A NOTE UNDER THE SUMMIT STONE.", hint: "FINISH BRAM'S ROUTE.", pic: { key: 'flag', scale: 3 }, known: (p) => !!(p.data.expeditions['brams-route'] && p.data.expeditions['brams-route'].summits) },
];

const gems = GEM_ORDER.map((id) => {
  const g = GEMS[id];
  const home = BIOMES[g.biome];
  return {
    id: `gem-${id}`, name: g.name,
    text: `FOUND IN ${home.name}. WORTH ${g.value} GEM${g.value > 1 ? 'S' : ''} AT THE TRADER.`,
    hint: `HIDDEN SOMEWHERE IN ${home.name}.`,
    pic: { key: `gem_${id}`, scale: 4 },
    known: (p) => p.found(id) > 0,
    stat: (p) => `FOUND ${p.found(id)}`,
    color: g.color,
  };
});

const gear = [...GEAR, ...PERKS].map((it) => {
  const perk = PERKS.includes(it);
  return {
    id: `gear-${it.id}`, name: it.name, text: it.text,
    hint: `BRAM SELLS ONE FOR ◆${it.price}.`,
    pic: { key: it.icon, scale: 4 },
    known: (p) => (perk ? p.hasPerk(it.id) : p.data.inventory[it.id] !== undefined),
    stat: (p) => (perk ? (p.data.activePerk === it.id ? 'PERK  •  ACTIVE' : 'PERK  •  LEARNED') : `GEAR  •  ${p.owned(it.id)} IN STOCK`),
  };
});

const hazards = [
  { id: 'loose', name: 'LOOSE ROCK', text: 'CRUMBLY HOLDS THAT RATTLE UNDER YOUR HAND. A MISS COSTS EXTRA GRIP.', pic: { key: holdKey('stone', 'hold', 'loose'), scale: 4 } },
  { id: 'icy', name: 'ICY HOLD', text: 'SLICK WITH ICE: A SMALLER TIMING WINDOW, AND IT DRAINS GRIP WHILE YOU HANG.', pic: { key: holdKey('frozen', 'hold', 'icy'), scale: 4 } },
  { id: 'crumbling', name: 'CRUMBLING HOLD', text: 'IT WILL NOT LAST. PICK A ROUTE BEFORE IT BREAKS AWAY.', pic: { key: holdKey('stone', 'hold', 'crumbling'), scale: 4 } },
  { id: 'rockfall', name: 'FALLING ROCKS', text: 'STONES COME DOWN AS YOU GRAB A HOLD. PRESS THE ARROW ON THE BEAT TO SWING CLEAR.', pic: { key: 'rock_fall', scale: 4 }, stat: (p) => `DODGED ${count('dodges')(p)}` },
  { id: 'gust', name: 'WIND GUST', text: 'A HARD GUST PUSHES AT YOU. THE TIMING GETS TIGHTER WHILE IT BLOWS.', pic: { key: 'icon_wind', scale: 4 } },
  { id: 'whiteout', name: 'WHITEOUT', text: 'A BLIZZARD SO THICK THE NOTES ONLY APPEAR AT THE LAST MOMENT.', pic: { key: 'puff', scale: 6, tint: 0xeef6ff } },
  { id: 'darkness', name: 'DARKNESS', text: 'IN THE OBSIDIAN SPIRES THE NOTES ARE FAINT SHAPES THAT FLASH ON EVERY BEAT.', pic: { key: 'moon', scale: 3 } },
  { id: 'offbeat', name: 'OFF-BEAT', text: 'A RHYTHM THAT SKIPS. WATCH THE GAPS BETWEEN THE NOTES, NOT THE CLOCK.', pic: { key: 'arrow_L', scale: 3, tint: 0xf2c14e } },
  { id: 'hold', name: 'LONG NOTE', text: 'KEEP THE ARROW HELD DOWN UNTIL THE TAIL HAS PASSED THE LINE.', pic: { key: 'arrow_U', scale: 3, tint: 0x9fd8ff } },
  { id: 'blind', name: 'BLIND NOTES', text: 'THEY FADE OUT BEFORE THEY ARRIVE. KEEP THE BEAT IN YOUR HEAD.', pic: { key: 'arrow_R', scale: 3, tint: 0x6a6480 } },
  { id: 'storm', name: 'THUNDERSTORM', text: 'ON THE STORM CROWN, HANGING ON A HOLD DRAINS GRIP FAST WHILE THE STORM RAGES.', pic: { key: 'icon_wind', scale: 4, tint: 0xffe45a } },
  { id: 'dragon', name: 'DRAGON FIRE', text: 'WHEN ITS THROAT GLOWS, IT IS DRAWING BREATH. PRESS THE ARROW ON THE BEAT TO SWING OUT OF THE FLAMES.', pic: { key: 'icon_still', scale: 4, tint: 0xff8a28 } },
  { id: 'swing', name: 'SWING', text: 'ON THE AURORA RIDGE THE NOTES COME IN PAIRS: LONG-SHORT, LONG-SHORT.', pic: { key: 'arrow_U', scale: 3, tint: 0x5af0a0 } },
  { id: 'mirror', name: 'MIRRORED NOTES', text: 'PINK ARROWS POINT THE WRONG WAY. PRESS THE OTHER DIRECTION.', pic: { key: 'arrow_L', scale: 3, tint: 0xff6ad8 } },
  { id: 'double', name: 'DOUBLE NOTES', text: 'TWO ARROWS STACKED ON ONE BEAT. PRESS BOTH AT ONCE.', pic: { key: 'arrow_R', scale: 3, tint: 0xf2c14e } },
  { id: 'roll', name: 'ROLLS', text: 'A DOTTED TAIL. TAP THE ARROW AGAIN AND AGAIN UNTIL EVERY DOT IS GONE.', pic: { key: 'arrow_U', scale: 3, tint: 0x9fffd0 } },
].map((h) => ({ ...h, id: `hazard-${h.id}`, hint: 'YOU WILL KNOW IT WHEN YOU MEET IT.', known: seenTip(h.id === 'hold' ? 'hold' : h.id) }));

const WONDER_PICS = {
  'abandoned-axe': { key: 'decor_axe_stuck', scale: 3 },
  'old-shelter': { key: 'hut_green', scale: 1.4 },
  'valley-reveal': { thumb: 'green' },
  'sea-of-clouds': { thumb: 'clouds' },
  'sunrise-above': { key: 'sun', scale: 2 },
  'northern-lights': { key: 'stars', scale: 1, tint: 0x8fffb0 },
  'floating-stones': { key: 'decor_float_rock', scale: 2 },
  'rockfall-dodged': { key: 'rock_fall', scale: 4 },
  'prism-light': { key: 'decor_crystals', scale: 3 },
  'thermal-ride': { key: 'icon_wind', scale: 4, tint: 0xffb45a },
  whiteout: { key: 'puff', scale: 6, tint: 0xffffff },
  'prayer-flags': { key: 'decor_flags', frame: 0, scale: 1.5 },
  thunderstorm: { thumb: 'storm' },
  'dragon-eye': { thumb: 'dragon' },
};
const wonders = Object.entries(DISCOVERIES)
  .filter(([id]) => id !== 'rare-bird')
  .map(([id, d]) => ({
    id: `wonder-${id}`, name: d.name, text: d.text,
    hint: 'KEEP YOUR EYES OPEN ON THE WAY UP.',
    pic: WONDER_PICS[id] || { key: 'icon_mtn', scale: 3 },
    known: found(id),
    // The old living crystals only show in saves that found them.
    hidden: id === 'crystal-sealed',
  }));

// Bram's logbook stamps, as cards. Their goal is always shown (they are
// challenges), except secret ones, which stay ??? until earned.
const PAGE_BY_ID = Object.fromEntries(LOGBOOK_PAGES.map((p) => [p.id, p]));
const stamps = STAMPS.map((s) => ({
  id: `stamp-${s.id}`, name: s.name, text: s.text,
  goal: !s.secret,
  hint: s.secret ? 'A SECRET. BRAM WILL NOT SAY.' : s.text,
  pic: { key: 'stamp_seal', tint: PAGE_BY_ID[s.page].color },
  color: PAGE_BY_ID[s.page].color,
  known: (p) => p.data.stamps.includes(s.id),
  stat: (p) => {
    if (p.data.stamps.includes(s.id)) return `STAMPED  •  PAID ◆${s.gems}`;
    const pr = stampProgress(s, p.data);
    return `${s.perRun ? 'BEST RUN ' : ''}${pr.now}/${pr.goal}${s.unit ? ' ' + s.unit : ''}  •  ◆${s.gems}`;
  },
}));

// Biome mastery: one card per biome, its three stars and what they unlock.
const rewardFor = (id) => Object.values(COSMETICS).flat().find((c) => c.requirement && c.requirement.mastery === id);
const mastery = MASTERY_BIOMES.map((id) => {
  const b = BIOMES[id];
  const reward = rewardFor(id);
  return {
    id: `mastery-${id}`, name: b.name,
    text: reward ? `MASTERED. YOUR REWARD: ${reward.name}.` : 'MASTERED.',
    goal: true,
    hint: starText(id),
    pic: { thumb: id },
    color: b.accentA,
    known: (p) => p.stars(id).length >= STARS.length,
    stat: (p) => {
      const got = p.stars(id);
      const next = STARS.find((s) => !got.includes(s));
      return STARS.map((s) => (got.includes(s) ? '★' : '☆')).join('') + (next ? `  NEXT: ${starLabel(id, next)}` : '');
    },
  };
});

// The OPENBOOK code (data.journalAll) turns every card face up. It gives
// nothing else: no gear, perks, gems or stamps paid out.
const openable = (e) => ({ ...e, found: e.known, known: (p) => !!p.data.journalAll || e.known(p) });

export const JOURNAL_CHAPTERS = [
  { id: 'places', title: 'PLACES', color: 0x4f8a3c, entries: places, note: 'THE MOUNTAIN CHANGES EVERY FEW HUNDRED METRES. ABOVE THE DRAGON IT STARTS AGAIN, OR SO ELSA SWORE.' },
  { id: 'creatures', title: 'CREATURES', color: 0xc8463b, entries: creatures, note: 'NOT MUCH LIVES UP HERE. WHAT DOES IS TOUGHER THAN YOU AND ME.' },
  { id: 'gems', title: 'GEMS', color: 0x4f86f0, entries: gems, note: 'EVERY PART OF THE MOUNTAIN HIDES ITS OWN STONE. THE HIGHER, THE RARER.' },
  { id: 'gear', title: 'GEAR', color: 0xa8743e, entries: gear, note: 'GOOD GEAR WILL NOT CLIMB FOR YOU. BUT IT HELPS.' },
  { id: 'hazards', title: 'HAZARDS', color: 0x6d6a5f, entries: hazards, note: 'I LEARNED EVERY ONE OF THESE THE HARD WAY. NOW YOU DO NOT HAVE TO.' },
  { id: 'wonders', title: 'WONDERS', color: 0xb48ae0, entries: wonders, note: 'THIS IS WHY WE CLIMB. WRITE DOWN EVERYTHING YOU SEE.' },
  { id: 'stamps', title: 'STAMPS', color: 0xf2c14e, entries: stamps, note: 'DO THESE AND I WILL PAY YOU IN GEMS.' },
  { id: 'mastery', title: 'MASTERY', color: 0xffb43c, entries: mastery, note: 'KNOW A PART OF THE MOUNTAIN SO WELL IT CANNOT SURPRISE YOU.' },
].map((c) => ({ ...c, entries: c.entries.map(openable) }));

// The entries a chapter shows for this save (hidden ones only once found).
export function chapterEntries(chapter, prog) {
  return chapter.entries.filter((e) => !e.hidden || e.found(prog));
}

export function journalProgress(prog) {
  let seen = 0, total = 0;
  for (const ch of JOURNAL_CHAPTERS) {
    for (const e of chapterEntries(ch, prog)) { total++; if (e.known(prog)) seen++; }
  }
  return { seen, total };
}
