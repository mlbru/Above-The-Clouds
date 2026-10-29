import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProgressionSystem } from '../src/systems/ProgressionSystem.js';
import { COSMETICS } from '../src/data/cosmetics.js';
import { MASTERY_BIOMES, STARS, masteryGoals } from '../src/data/mastery.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('mastery: every biome on the way up has goals', () => {
  for (const id of MASTERY_BIOMES) {
    const g = masteryGoals(id);
    assert.ok(g.streak > 0 && g.gems > 0, id);
  }
});

test('mastery: every biome has exactly one reward', () => {
  for (const id of MASTERY_BIOMES) {
    const rewards = Object.values(COSMETICS).flat().filter((c) => c.requirement && c.requirement.mastery === id);
    assert.equal(rewards.length, 1, id);
  }
});

test('mastery: stars are kept once, survive a reload, and three free the reward', () => {
  const storage = memory();
  const p = new ProgressionSystem(storage);
  assert.equal(p.earnStar('storm', 'flawless').isNew, true);
  assert.equal(p.earnStar('storm', 'flawless').isNew, false);
  assert.equal(p.earnStar('storm', 'streak').unlocks.length, 0);
  assert.deepEqual(p.earnStar('storm', 'gems').unlocks.map((u) => u.id), ['jacket-bolt']);
  const again = new ProgressionSystem(storage);
  assert.deepEqual([...again.stars('storm')].sort(), [...STARS].sort());
  assert.ok(again.isUnlocked('jacket-bolt'));
});

test('mastery: the GRANDMASTER code masters every biome and frees every reward', () => {
  const p = new ProgressionSystem(memory());
  const r = p.redeemCode('grandmaster');
  assert.ok(r.ok);
  for (const id of MASTERY_BIOMES) assert.equal(p.stars(id).length, STARS.length, id);
  const rewards = Object.values(COSMETICS).flat().filter((c) => c.requirement && c.requirement.mastery);
  assert.equal(rewards.length, MASTERY_BIOMES.length);
  rewards.forEach((c) => assert.ok(p.isUnlocked(c.id), c.id));
  assert.match(p.redeemCode('GRANDMASTER').message, /ALREADY/);
});
