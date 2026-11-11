// Bram's forecast: what he tells you at base camp about the mountain you are
// about to climb. He never lies, so he only talks about what the seed fixes
// (where the cairns stand, what the first one offers, and, very rarely, the
// Golden City). Storms, showers, rockfall and the dragon depend on time, so
// he never forecasts those. Pure, so a test can check every line comes true.
import { BIOMES } from './biomes.js';
import { shrinePlan, boonOffer, boonCard, stretchAt, stretchIndexAt } from './boons.js';
import { goldenCityAt } from './goldenCity.js';

const short = (id) => BIOMES[id].name.replace(/^THE /, '');
// How far up Bram can see (biome stretches above the start).
const SIGHT = 12;

// Where the Golden City waits on this seed, if anywhere within sight:
// { index, biome, from } or null.
export function goldenCityAhead(seed, startMeters = 0) {
  const s = stretchIndexAt(startMeters);
  for (let k = Math.max(1, s + 1); k <= s + SIGHT; k++) {
    const st = stretchAt(k);
    if (goldenCityAt(seed, st.from)) return { index: k, ...st };
  }
  return null;
}

// The lines Bram says, in order: [{ text, gold }].
// boons: whether this run gets the Trail Boons (Normal, no dares, no tutorial).
export function forecastLines(seed, { startMeters = 0, boons = true } = {}) {
  const lines = [];
  const city = goldenCityAhead(seed, startMeters);
  if (city) {
    lines.push({ text: `I DREAMT OF GOLD WHERE ${short(city.biome)} SHOULD BE. TELL NO ONE.`, gold: true });
  }
  if (boons) {
    const plan = shrinePlan(seed, startMeters);
    const names = plan.map((p) => short(p.biome));
    lines.push({ text: `THE CAIRNS STAND IN ${names[0]}, ${names[1]} AND ${names[2]}.` });
    const first = plan[0];
    const offer = boonOffer(seed, first.index, { biome: first.biome }).map((id) => boonCard(id)).filter(Boolean);
    if (offer.length >= 2) lines.push({ text: `THE FIRST CAIRN HOLDS ${offer[0].name}, ${offer[1].name}${offer[2] ? ` AND ${offer[2].name}` : ''}.` });
  }
  if (!lines.length) lines.push({ text: 'THE MOUNTAIN IS QUIET TODAY. CLIMB WELL.' });
  return lines;
}
