import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOONS, SYNERGIES, SHRINE, shrinePlan, boonOffer, boonEffects, activeSynergies, completesSynergy, boonCard, stretchAt, stretchIndexAt, isSouvenir } from '../src/data/boons.js';
import { goldenCityAt, GOLDEN_CITY } from '../src/data/goldenCity.js';
import { BIOMES } from '../src/data/biomes.js';

test('golden city is decided by the seed, never at base camp', () => {
  for (let seed = 1; seed < 50; seed++) {
    assert.equal(goldenCityAt(seed, 55), goldenCityAt(seed, 55));
    assert.equal(goldenCityAt(seed, 0), false);
  }
  // Roughly 1 in 150 stretches over many seeds.
  let hits = 0, n = 0;
  for (let seed = 1; seed < 3000; seed++) for (const from of [55, 208, 333, 486]) { n++; if (goldenCityAt(seed, from)) hits++; }
  assert.ok(hits / n > GOLDEN_CITY.chance * 0.5 && hits / n < GOLDEN_CITY.chance * 1.8, `rate ${hits / n}`);
});

test('stretches follow the biome sequence and then the high loop', () => {
  assert.equal(stretchAt(0).biome, 'green');
  assert.equal(stretchAt(1).biome, 'stone');
  assert.equal(stretchAt(1).from, BIOMES.stone.from);
  assert.equal(stretchIndexAt(0), 0);
  assert.equal(stretchIndexAt(BIOMES.frozen.from + 5), 2);
  assert.ok(stretchAt(12).from > stretchAt(11).from);
});

test('three shrines per run, one in each band, the same for the same seed', () => {
  for (let seed = 1; seed < 200; seed++) {
    const plan = shrinePlan(seed);
    assert.equal(plan.length, 3);
    SHRINE.bands.forEach(([a, b], i) => assert.ok(plan[i].index >= a && plan[i].index <= b, `seed ${seed} band ${i}`));
    assert.deepEqual(plan, shrinePlan(seed));
  }
  // A lift-ticket start counts the bands from its own biome.
  const lifted = shrinePlan(7, BIOMES.clouds.from);
  assert.ok(lifted[0].index >= 4 && lifted[0].index <= 5);
});

test('an offer is three different gifts, never one already held', () => {
  for (let seed = 1; seed < 300; seed++) {
    const held = ['echo', 'magpie'];
    const offer = boonOffer(seed, 1, { held, biome: 'clouds' });
    assert.equal(offer.length, 3);
    assert.equal(new Set(offer).size, 3);
    offer.forEach((id) => { assert.ok(!held.includes(id)); assert.ok(boonCard(id), id); });
    assert.deepEqual(offer, boonOffer(seed, 1, { held, biome: 'clouds' }));
  }
});

test('a shrine always offers its own biome as a souvenir, up to three', () => {
  assert.ok(boonOffer(3, 0, { biome: 'stone' }).includes('souvenir:stone'));
  // Bone Garden and the dragon stay home.
  assert.ok(!boonOffer(3, 0, { biome: 'bones' }).some(isSouvenir));
  const full = ['souvenir:stone', 'souvenir:frozen', 'souvenir:clouds'];
  assert.ok(!boonOffer(3, 2, { held: full, biome: 'hive' }).some(isSouvenir));
});

test('legendaries show up about one offer in ten, and rerolls change the offer', () => {
  let legend = 0, changed = 0;
  for (let seed = 1; seed < 2000; seed++) {
    const a = boonOffer(seed, 0, {});
    if (a.some((id) => BOONS.find((b) => b.id === id && b.group === 'legendary'))) legend++;
    if (a.join() !== boonOffer(seed, 0, { reroll: 1 }).join()) changed++;
  }
  assert.ok(legend > 120 && legend < 300, `legendary offers ${legend}`);
  assert.ok(changed > 1800);
});

test('synergies complete only with both halves', () => {
  assert.equal(activeSynergies(['echo']).length, 0);
  assert.deepEqual(activeSynergies(['echo', 'magpie']).map((s) => s.id), ['hoardsong']);
  assert.equal(completesSynergy('magpie', ['echo']).id, 'hoardsong');
  assert.equal(completesSynergy('magpie', []), null);
  SYNERGIES.forEach((s) => s.pair.forEach((p) => assert.ok(BOONS.find((b) => b.id === p), p)));
});

test('boon effects: every gift comes with its price', () => {
  const none = boonEffects([]);
  assert.equal(none.maxGrip, 100);
  assert.equal(none.ledgeFill, 1);
  assert.equal(none.gemScale, 1);
  const e = boonEffects(['deepbreath', 'flask', 'steadypace']);
  assert.equal(e.maxGrip, 120);
  assert.equal(e.hangGraceSec, 1.5);
  assert.equal(e.ledgeFill, 0.75); // the lowest refill wins
  assert.equal(e.flask, 'full'); // SECOND WIND
  assert.equal(boonEffects(['cartographer', 'deepbreath']).hangGraceSec, 0);
  assert.equal(boonEffects(['secondrope', 'souvenir:stone']).gemScale, 0.75 * 1.5);
  assert.deepEqual(boonEffects(['souvenir:frozen']).souvenirs, ['whiteout']);
  // Every non-souvenir boon has a gift and a price written out.
  BOONS.forEach((b) => { assert.ok(b.gift.length > 8, b.id); assert.ok(b.price.length > 8, b.id); });
});
