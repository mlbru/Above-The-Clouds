import { BIOMES } from './biomes.js';
import { SEASONS } from './seasons.js';

// Purely cosmetic unlocks. requirement: { height } | { viewpoints } | { discovery } | { discoveries } | { streak }
// | { mastery: biomeId } (all three mastery stars of that biome, see mastery.js)
// or { price } (bought from the base camp trader), optionally with { gem, count }:
// you must have found that many of a regional gem before the trader sells it.
export const COSMETICS = {
  jacket: [
    { id: 'jacket-red', name: 'RED SHELL', color: 0xc8463b, requirement: null },
    { id: 'jacket-sun', name: 'SUNFLOWER', color: 0xe6b230, requirement: { height: 50 } },
    { id: 'jacket-teal', name: 'TEAL ANORAK', color: 0x2f9e9a, requirement: { height: 150 } },
    { id: 'jacket-plum', name: 'PLUM DOWN', color: 0x8a4fa8, requirement: { height: 300 } },
    { id: 'jacket-storm', name: 'STORM WHITE', color: 0xdfe6ee, requirement: { height: 500 } },
    { id: 'jacket-night', name: 'NIGHT SKY', color: 0x2c3a78, requirement: { height: 1000 } },
    { id: 'jacket-blaze', name: 'BLAZE', color: 0xff6a1a, requirement: { streak: 30 } },
    { id: 'jacket-mint', name: 'MINT FLEECE', color: 0x6fd6b0, requirement: { price: 25 } },
    { id: 'jacket-royal', name: 'ROYAL BLUE', color: 0x3456c8, requirement: { price: 35 } },
    { id: 'jacket-bubble', name: 'BUBBLEGUM', color: 0xf07ab8, requirement: { price: 35 } },
    { id: 'jacket-charcoal', name: 'CHARCOAL', color: 0x3a3a44, requirement: { price: 45 } },
    { id: 'jacket-sapphire', name: 'SAPPHIRE PARKA', color: 0x2f5fd0, requirement: { price: 90, gem: 'sapphire', count: 3 } },
    // The end boss of the wardrobe: the most expensive thing Bram sells.
    // Biome mastery rewards: each one does something on the mountain (OutfitFx).
    { id: 'jacket-rime', name: 'RIME COAT', color: 0xa8d4ec, pattern: 'rime', requirement: { mastery: 'frozen' } },
    { id: 'jacket-prism', name: 'PRISM SHELL', color: 0xe0dcec, pattern: 'prism', requirement: { mastery: 'crystal' } },
    { id: 'jacket-bolt', name: 'THUNDER JACKET', color: 0x24305a, pattern: 'bolt', requirement: { mastery: 'storm' } },
    { id: 'jacket-scales', name: 'DRAGONSCALE COAT', color: 0x8e2a2a, pattern: 'scales', requirement: { mastery: 'dragon' } },
    // Seasonal: Bram only sells these around that holiday (data/seasons.js).
    { id: 'jacket-pumpkin', name: 'PUMPKIN COAT', color: 0xe8761c, requirement: { price: 30, season: 'halloween' } },
    { id: 'jacket-arcteryx', name: "ARC'TERYX ALPHA SV", color: 0xd8262f, logo: 0x16141f, zip: 0x16141f, rarity: 'mythic', requirement: { price: 800, gem: 'diamond', count: 5 } },
  ],
  hat: [
    { id: 'hat-beanie', name: 'BEANIE', style: 'beanie', color: 0x3b6fb6, requirement: null },
    { id: 'hat-none', name: 'NO HAT', style: 'none', color: 0, requirement: null },
    { id: 'hat-helmet', name: 'HELMET', style: 'helmet', color: 0xf0f0e8, requirement: { height: 100 } },
    { id: 'hat-bobble', name: 'BOBBLE HAT', style: 'bobble', color: 0xd94f70, requirement: { height: 250 } },
    { id: 'hat-orange-helmet', name: 'ALPINE HELMET', style: 'helmet', color: 0xf08a2a, requirement: { viewpoints: 3 } },
    { id: 'hat-gold', name: 'GOLDEN BEANIE', style: 'beanie', color: 0xf2c14e, requirement: { streak: 20 } },
    { id: 'hat-cap', name: 'CLIMBING CAP', style: 'cap', color: 0x2f9e9a, requirement: { price: 30 } },
    { id: 'hat-cap-red', name: 'RED CAP', style: 'cap', color: 0xc8463b, requirement: { price: 30 } },
    { id: 'hat-bobble-mint', name: 'MINT BOBBLE', style: 'bobble', color: 0x6fd6b0, requirement: { price: 40 } },
    { id: 'hat-hood', name: 'ROCKFALL HOOD', style: 'hood', color: 0x7a7a84, requirement: { mastery: 'stone' } },
    { id: 'hat-santa', name: 'SANTA BOBBLE', style: 'bobble', color: 0xc8243a, requirement: { price: 30, season: 'christmas' } },
    { id: 'hat-crown', name: 'GEM CROWN', style: 'crown', color: 0xf2c14e, requirement: { price: 250, gem: 'diamond', count: 1 } },
  ],
  pack: [
    { id: 'pack-orange', name: 'ORANGE PACK', color: 0xe07a2e, requirement: null },
    { id: 'pack-forest', name: 'FOREST PACK', color: 0x3f7a45, requirement: { height: 200 } },
    { id: 'pack-slate', name: 'SLATE PACK', color: 0x5d6a7e, requirement: { height: 400 } },
    { id: 'pack-crimson', name: 'CRIMSON PACK', color: 0xa8243a, requirement: { viewpoints: 5 } },
    { id: 'pack-lilac', name: 'LILAC PACK', color: 0xb48ae0, requirement: { price: 25 } },
    { id: 'pack-black', name: 'BLACK PACK', color: 0x2a2a33, requirement: { price: 40 } },
    { id: 'pack-amber', name: 'AMBER PACK', color: 0xf2a03c, requirement: { price: 60, gem: 'amber', count: 5 } },
    { id: 'pack-moss', name: 'MOSSY PACK', color: 0x4a6a2a, style: 'moss', requirement: { mastery: 'green' } },
    { id: 'pack-gold', name: 'GOLD PACK', color: 0xf2c14e, requirement: { price: 150, gem: 'opal', count: 3 } },
  ],
  accessory: [
    { id: 'acc-none', name: 'NONE', style: 'none', requirement: null },
    { id: 'acc-scarf', name: 'LONG SCARF', style: 'scarf', requirement: { discoveries: 3 } },
    { id: 'acc-feather', name: 'EAGLE FEATHER', style: 'feather', requirement: { discovery: 'rare-bird' } },
    { id: 'acc-axe', name: 'OLD ICE AXE', style: 'axe', requirement: { discovery: 'abandoned-axe' } },
    { id: 'acc-goggles', name: 'GLACIER GOGGLES', style: 'goggles', requirement: { price: 70 } },
    { id: 'acc-kite', name: 'SKY KITE', style: 'kite', requirement: { mastery: 'clouds' } },
    { id: 'acc-collar', name: 'OBSIDIAN COLLAR', style: 'collar', requirement: { mastery: 'obsidian' } },
    { id: 'acc-aurora', name: 'AURORA SCARF', style: 'aurora', requirement: { mastery: 'aurora' } },
  ],
  // Colour of your chalk bag and of every chalk puff.
  chalk: [
    { id: 'chalk-white', name: 'WHITE CHALK', color: 0xe8e4da, requirement: null },
    { id: 'chalk-pink', name: 'PINK CHALK', color: 0xf5a0c8, requirement: { price: 20 } },
    { id: 'chalk-blue', name: 'BLUE CHALK', color: 0x9fd8ff, requirement: { price: 20 } },
    { id: 'chalk-gold', name: 'GOLD DUST', color: 0xf2c14e, requirement: { price: 80 } },
    { id: 'chalk-rainbow', name: 'RAINBOW CHALK', color: 0xffffff, rainbow: true, requirement: { price: 150, gem: 'sapphire', count: 1 } },
  ],
  // What you leave behind as you move (see Effects.trail).
  trail: [
    { id: 'trail-none', name: 'NO TRAIL', style: 'none', color: 0, requirement: null },
    { id: 'trail-chalk', name: 'CHALK CLOUD', style: 'chalk', color: 0xe8e4da, requirement: { price: 30 } },
    { id: 'trail-leaves', name: 'AUTUMN LEAVES', style: 'leaves', color: 0xe0802a, requirement: { height: 150 } },
    { id: 'trail-stardust', name: 'STARDUST', style: 'stardust', color: 0xf2d06a, requirement: { price: 70 } },
    { id: 'trail-snow', name: 'SNOWFALL', style: 'snow', color: 0xeef6ff, requirement: { height: 350 } },
    { id: 'trail-hearts', name: 'PIXEL HEARTS', style: 'hearts', color: 0xf07ab8, requirement: { price: 120 } },
    { id: 'trail-fire', name: 'WILDFIRE', style: 'fire', color: 0xff6a1a, requirement: { streak: 40 } },
    { id: 'trail-rainbow', name: 'RAINBOW ROAD', style: 'rainbow', color: 0xffffff, rainbow: true, requirement: { price: 260, gem: 'opal', count: 2 } },
  ],
  // What a perfect hit looks like (see Effects.hit).
  hit: [
    { id: 'hit-ring', name: 'CLASSIC RING', style: 'ring', color: 0xf2d06a, requirement: null },
    { id: 'hit-star', name: 'STAR BURST', style: 'star', color: 0xfff1a0, requirement: { price: 50 } },
    { id: 'hit-blast', name: 'PIXEL BLAST', style: 'blast', color: 0xff9a3c, requirement: { price: 65 } },
    { id: 'hit-notes', name: 'MUSIC NOTES', style: 'notes', color: 0x9fd8ff, requirement: { streak: 25 } },
    { id: 'hit-hearts', name: 'LOVE BURST', style: 'hearts', color: 0xf07ab8, requirement: { price: 110 } },
    { id: 'hit-bolt', name: 'LIGHTNING', style: 'bolt', color: 0xbfe4ff, requirement: { height: 800 } },
    { id: 'hit-shards', name: 'GEM SHARDS', style: 'shards', color: 0xe0344f, requirement: { price: 220, gem: 'ruby', count: 2 } },
  ],
};

// How rare an item is: common, rare, epic or legendary. Set on an item with
// `rarity`, otherwise worked out from how hard it is to get.
export const RARITY = {
  common: { name: 'COMMON', color: 0xb8b4c8 },
  rare: { name: 'RARE', color: 0x6fb8ff },
  epic: { name: 'EPIC', color: 0xc07af0 },
  legendary: { name: 'LEGENDARY', color: 0xffb43c },
  mythic: { name: 'MYTHIC', color: 0xff3a5c },
};

export function rarityOf(item) {
  if (item.rarity) return item.rarity;
  const r = item.requirement;
  if (!r) return 'common';
  if (r.gem) return r.price >= 150 ? 'legendary' : 'epic';
  if (r.price) return r.price >= 100 ? 'epic' : r.price >= 50 ? 'rare' : 'common';
  if (r.height) return r.height >= 800 ? 'legendary' : r.height >= 300 ? 'epic' : r.height >= 150 ? 'rare' : 'common';
  if (r.streak) return r.streak >= 30 ? 'legendary' : 'epic';
  if (r.viewpoints) return r.viewpoints >= 5 ? 'epic' : 'rare';
  if (r.mastery) return 'legendary';
  return 'rare';
}

export const DEFAULT_LOOK = { jacket: 'jacket-red', hat: 'hat-beanie', pack: 'pack-orange', accessory: 'acc-none', chalk: 'chalk-white', trail: 'trail-none', hit: 'hit-ring' };
export const SLOT_NAMES = { jacket: 'JACKET', hat: 'HAT', pack: 'PACK', accessory: 'EXTRA', chalk: 'CHALK', trail: 'TRAIL', hit: 'HIT EFFECT' };

export function findCosmetic(slot, id) {
  return COSMETICS[slot].find((c) => c.id === id) || COSMETICS[slot][0];
}

export function describeRequirement(req) {
  if (!req) return '';
  if (req.height) return `REACH ${req.height}M`;
  if (req.viewpoints) return `FIND ${req.viewpoints} VIEWPOINTS`;
  if (req.streak) return `HIT ${req.streak} PERFECTS IN A ROW`;
  if (req.discoveries) return `MAKE ${req.discoveries} DISCOVERIES`;
  if (req.discovery === 'rare-bird') return 'SPOT A RARE BIRD';
  if (req.discovery === 'abandoned-axe') return 'FIND AN OLD ICE AXE';
  if (req.season) return `SOLD AROUND ${SEASONS[req.season].name}`;
  if (req.price) return `BUY AT THE TRADER`;
  if (req.mastery) return `MASTER ${BIOMES[req.mastery].name.replace(/^THE /, '')} (3 STARS)`;
  return '???';
}
