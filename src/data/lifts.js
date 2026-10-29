// Lift tickets: start a Normal run on the first ledge of a higher biome.
// A biome's ticket goes on sale once you master the biome below it (all
// three stars, data/mastery.js); it is paid with gems and used up by the run
// it starts. Tickets have their own place: they never take a pack slot.
// Picked on the mountain map (scenes/MapScene.js).
import { BIOMES } from './biomes.js';
import { gemForBiome } from './gems.js';

const PRICES = { stone: 35, frozen: 75, clouds: 105, hive: 150, obsidian: 195, crystal: 255, clockwork: 330 };

export const LIFTS = Object.entries(PRICES).map(([id, price], i, all) => ({
  id,
  price,
  // The biome you master to open this ticket.
  after: i ? all[i - 1][0] : 'green',
  icon: `item_ticket_${id}`,
}));

export const LIFT_BY_ID = Object.fromEntries(LIFTS.map((l) => [l.id, l]));

export function liftHeight(id) { return BIOMES[id].from; }

export function liftName(id) { return `${BIOMES[id].name.replace(/^THE /, '')} TICKET`; }

// Ticket art: a paper stub in the biome's colours with its own stone as the peak.
export function liftColors(id) {
  const b = BIOMES[id];
  return { band: b.accentA, peak: gemForBiome(id).color };
}
