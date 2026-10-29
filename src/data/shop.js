// What the base camp trader sells besides clothes.
// Gear is used up: pack up to PACK_SLOTS items, and they are spent when you
// leave base camp at the start of a Normal run. Perks are bought once; one can
// be active at a time. Gear and perks only work in Normal mode. Lift tickets
// live in data/lifts.js and have a place of their own.
export const PACK_SLOTS = 3;

export const GEAR = [
  { id: 'chalk', name: 'CHALK BAG', price: 35, icon: 'item_chalk', text: 'SLIGHTLY WIDER TIMING WINDOWS UNTIL 100 M.' },
  { id: 'energy', name: 'ENERGY BAR', price: 60, icon: 'item_energy', text: 'WHEN YOUR GRIP RUNS OUT, EAT IT: +25 GRIP. ONCE.' },
  { id: 'crampons', name: 'CRAMPONS', price: 85, icon: 'item_crampons', text: 'ICY HOLDS ARE AS EASY AS NORMAL HOLDS.' },
  { id: 'quickdraws', name: 'QUICKDRAWS', price: 60, icon: 'item_quickdraws', text: 'CRUMBLING HOLDS LAST 50% LONGER.' },
  { id: 'rope', name: 'SPARE ROPE', price: 150, icon: 'item_rope', text: 'CATCHES YOU ONCE WHEN YOU MISS A SLIP RECOVERY.' },
  { id: 'charm', name: 'LUCKY CHARM', price: 120, icon: 'item_charm', text: 'THE NEXT 5 GEMS YOU GRAB COUNT DOUBLE.' },
];

export const PERKS = [
  { id: 'gemsense', name: 'GEM SENSE', price: 600, icon: 'perk_gemsense', text: 'GEMS SHOW UP 25% MORE OFTEN.' },
  { id: 'irongrip', name: 'IRON GRIP', price: 680, icon: 'perk_irongrip', text: 'GRIP DRAINS 10% SLOWER WHILE YOU HANG.' },
  { id: 'steady', name: 'STEADY HANDS', price: 820, icon: 'perk_steady', text: 'THE FIRST MISS ON EACH CLIMB COSTS HALF GRIP.' },
  { id: 'streaksaver', name: 'STREAK SAVER', price: 1050, icon: 'perk_streaksaver', text: 'ONE GOOD HIT PER STREAK DOES NOT BREAK IT.' },
  // Bought with gems, but only for climbers who found the rare stones up high.
  { id: 'rubyheart', name: 'RUBY HEART', price: 1200, icon: 'perk_rubyheart', needs: { gem: 'ruby', count: 3 }, text: 'EVERY PERFECT HIT GIVES 1 GRIP BACK.' },
  { id: 'diamondeye', name: 'DIAMOND EYE', price: 1650, icon: 'perk_diamondeye', needs: { gem: 'diamond', count: 2 }, text: 'TIMING WINDOWS 8% WIDER, ALL THE WAY UP.' },
];

export const GEAR_BY_ID = Object.fromEntries(GEAR.map((g) => [g.id, g]));
// Strength of each item (kept here so the shop texts and the game agree).
export const GEAR_FX = { chalkWindow: 1.1, chalkUntil: 100, energyGrip: 25, quickdrawScale: 1.5, charmGems: 5, gemSense: 1.25, ironGrip: 0.9, rubyGrip: 1, diamondWindow: 1.08 };

export const PERK_BY_ID = Object.fromEntries(PERKS.map((p) => [p.id, p]));

// Gem income besides the stones on the wall.
export const GEM_INCOME = {
  heightEvery: 60, // +1 for every 60 m of new height in a run
  streak: { 10: 2, 20: 3, 30: 5, later: 3 },
  record: 5,
  modeScale: { normal: 1, hard: 1.5, summit: 2 },
  // Chance that a route's target hold carries a gem, by route type.
  chance: { safe: 0.02, normal: 0.1, risky: 0.32 },
};
