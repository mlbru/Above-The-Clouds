import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forecastLines, goldenCityAhead } from '../src/data/forecast.js';
import { shrinePlan, boonOffer, boonCard, stretchAt } from '../src/data/boons.js';
import { goldenCityAt } from '../src/data/goldenCity.js';
import { BIOMES } from '../src/data/biomes.js';

const short = (id) => BIOMES[id].name.replace(/^THE /, '');

test('Bram only dreams of gold where the seed really hides the Golden City', () => {
  let dreams = 0;
  for (let seed = 1; seed < 20000; seed++) {
    const lines = forecastLines(seed);
    const gold = lines.find((l) => l.gold);
    const city = goldenCityAhead(seed);
    assert.equal(!!gold, !!city, `seed ${seed}`);
    if (!city) continue;
    dreams++;
    assert.ok(goldenCityAt(seed, city.from));
    assert.ok(gold.text.includes(short(city.biome)));
    // Nothing nearer hides it.
    for (let k = 1; k < city.index; k++) assert.equal(goldenCityAt(seed, stretchAt(k).from), false);
  }
  // About 1 mountain in 200.
  assert.ok(dreams > 20000 / 200 * 0.6 && dreams < 20000 / 200 * 1.5, `dreams ${dreams}`);
});

test("Bram's cairns and first offer match the run's shrines", () => {
  for (let seed = 1; seed < 300; seed++) {
    const lines = forecastLines(seed).filter((l) => !l.gold);
    const plan = shrinePlan(seed, 0);
    assert.equal(lines[0].text, `THE CAIRNS STAND IN ${short(plan[0].biome)}, ${short(plan[1].biome)} AND ${short(plan[2].biome)}.`);
    const offer = boonOffer(seed, plan[0].index, { biome: plan[0].biome }).map((id) => boonCard(id).name);
    for (const name of offer) assert.ok(lines[1].text.includes(name), `seed ${seed}: ${name}`);
  }
});

test('no cairn talk when the run has no Trail Boons', () => {
  const lines = forecastLines(7, { boons: false });
  assert.ok(lines.every((l) => !l.text.includes('CAIRN')));
});
