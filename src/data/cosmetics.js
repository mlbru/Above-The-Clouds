// Purely cosmetic unlocks. requirement: { height } | { viewpoints } | { discovery } | { discoveries } | { streak }
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
    { id: 'pack-gold', name: 'GOLD PACK', color: 0xf2c14e, requirement: { price: 150, gem: 'opal', count: 3 } },
  ],
  accessory: [
    { id: 'acc-none', name: 'NONE', style: 'none', requirement: null },
    { id: 'acc-scarf', name: 'LONG SCARF', style: 'scarf', requirement: { discoveries: 3 } },
    { id: 'acc-feather', name: 'EAGLE FEATHER', style: 'feather', requirement: { discovery: 'rare-bird' } },
    { id: 'acc-axe', name: 'OLD ICE AXE', style: 'axe', requirement: { discovery: 'abandoned-axe' } },
    { id: 'acc-goggles', name: 'GLACIER GOGGLES', style: 'goggles', requirement: { price: 70 } },
  ],
  // Colour of your chalk bag and of every chalk puff.
  chalk: [
    { id: 'chalk-white', name: 'WHITE CHALK', color: 0xe8e4da, requirement: null },
    { id: 'chalk-pink', name: 'PINK CHALK', color: 0xf5a0c8, requirement: { price: 20 } },
    { id: 'chalk-blue', name: 'BLUE CHALK', color: 0x9fd8ff, requirement: { price: 20 } },
    { id: 'chalk-gold', name: 'GOLD DUST', color: 0xf2c14e, requirement: { price: 80 } },
    { id: 'chalk-rainbow', name: 'RAINBOW CHALK', color: 0xffffff, rainbow: true, requirement: { price: 150, gem: 'sapphire', count: 1 } },
  ],
};

export const DEFAULT_LOOK = { jacket: 'jacket-red', hat: 'hat-beanie', pack: 'pack-orange', accessory: 'acc-none', chalk: 'chalk-white' };
export const SLOT_NAMES = { jacket: 'JACKET', hat: 'HAT', pack: 'PACK', accessory: 'EXTRA', chalk: 'CHALK' };

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
  if (req.price) return `BUY AT THE TRADER`;
  return '???';
}
