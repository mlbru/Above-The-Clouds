import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/config/balanceConfig.js';
import { Mountain } from '../src/systems/SegmentGenerator.js';
import { ProgressionSystem } from '../src/systems/ProgressionSystem.js';
import { GEMS, gemForBiome } from '../src/data/gems.js';
import { GEAR, PERKS, PACK_SLOTS } from '../src/data/shop.js';
import { COSMETICS } from '../src/data/cosmetics.js';
import { biomeAt } from '../src/data/biomes.js';
import { levelToMeters } from '../src/config/gameConfig.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

// Walks up the mountain taking the given route type, collecting route gems.
function climb(seed, type, meters) {
  const m = new Mountain(seed, BALANCE);
  m.ensureLevel(30);
  let node = m.getLevel(0).nodes[0];
  const gems = [];
  while (levelToMeters(node.level) < meters) {
    const routes = m.computeRoutes(node);
    const r = routes.find((x) => x.type === type) || routes[routes.length - 1];
    const gem = m.routeGem(r);
    if (gem) {
      assert.equal(gem.type, gemForBiome(biomeAt(levelToMeters(r.target.level)).id).id, 'stone matches the region');
      gems.push(gem);
      m.takeGem(gem);
      assert.equal(m.routeGem(r), null, 'a collected gem never comes back');
    }
    if (r.target.kind === 'ledge') assert.equal(gem, null, 'ledges carry no gems');
    node = r.target;
    m.ensureLevel(node.level + 30);
  }
  return gems;
}

test('gems: deterministic per seed and route, regional, never twice', () => {
  const a = climb(77, 'normal', 600).map((g) => g.key + g.type);
  const b = climb(77, 'normal', 600).map((g) => g.key + g.type);
  assert.ok(a.length > 0, 'some gems on 600 m');
  assert.deepEqual(a, b);
});

test('gems: risky climbing earns more gems per metre than safe climbing', () => {
  let safe = 0, risky = 0;
  for (let seed = 1; seed <= 12; seed++) {
    safe += climb(seed, 'safe', 400).reduce((n, g) => n + GEMS[g.type].value, 0);
    risky += climb(seed, 'risky', 400).reduce((n, g) => n + GEMS[g.type].value, 0);
  }
  assert.ok(risky > safe * 1.5, `risky ${risky} vs safe ${safe}`);
});

test('gems: higher stones are rarer and worth more', () => {
  const list = Object.values(GEMS);
  for (let i = 1; i < list.length; i++) {
    assert.ok(list[i].value > list[i - 1].value);
    assert.ok(list[i].rarity < list[i - 1].rarity);
  }
});

test('trader: wallet, gear, packing and using the pack', () => {
  const p = new ProgressionSystem(memory());
  assert.equal(p.gems, 0);
  assert.equal(p.buyGear('chalk'), false, 'cannot buy without gems');
  p.addGems(3, 'sapphire');
  assert.equal(p.gems, 3);
  assert.equal(p.found('sapphire'), 1);
  p.addGems(200);
  assert.ok(p.buyGear('chalk'));
  assert.equal(p.gems, 203 - GEAR.find((g) => g.id === 'chalk').price);
  assert.ok(p.isPacked('chalk'), 'bought gear is packed automatically');
  assert.ok(p.buyGear('chalk'));
  assert.equal(p.owned('chalk'), 2);
  ['energy', 'rope', 'charm'].forEach((id) => p.buyGear(id));
  assert.equal(p.data.packed.length, PACK_SLOTS, 'pack is full');
  assert.equal(p.togglePack('charm'), null, 'fourth item does not fit');
  assert.equal(p.togglePack('rope'), false, 'unpacking works');
  assert.equal(p.togglePack('charm'), true);
  const used = p.consumePack();
  assert.deepEqual(used.sort(), ['chalk', 'charm', 'energy']);
  assert.equal(p.owned('chalk'), 1);
  assert.equal(p.owned('energy'), 0);
  assert.deepEqual(p.data.packed, ['chalk'], 'items you still own stay packed');
});

test('trader: perks are bought once and one is active', () => {
  const p = new ProgressionSystem(memory());
  p.addGems(1000);
  const [a, b] = PERKS;
  assert.ok(p.buyPerk(a.id));
  assert.equal(p.buyPerk(a.id), false, 'no double purchase');
  assert.equal(p.data.activePerk, a.id, 'first perk becomes active');
  p.buyPerk(b.id);
  assert.equal(p.data.activePerk, a.id);
  p.setActivePerk(b.id);
  assert.equal(p.data.activePerk, b.id);
  p.setActivePerk(b.id);
  assert.equal(p.data.activePerk, null, 'selecting it again turns it off');
});

test('trader: cosmetics with prices and regional gem requirements', () => {
  const p = new ProgressionSystem(memory());
  const mint = COSMETICS.jacket.find((c) => c.id === 'jacket-mint');
  const crown = COSMETICS.hat.find((c) => c.id === 'hat-crown');
  assert.equal(p.cosmeticStatus(mint).state, 'poor');
  p.addGems(1000);
  assert.equal(p.cosmeticStatus(mint).state, 'buy');
  assert.ok(p.buyCosmetic('jacket', mint));
  assert.equal(p.data.look.jacket, 'jacket-mint');
  assert.equal(p.cosmeticStatus(mint).state, 'owned');
  assert.equal(p.cosmeticStatus(crown).state, 'locked', 'needs a diamond first');
  assert.equal(p.buyCosmetic('hat', crown), false);
  p.addGems(12, 'diamond');
  assert.equal(p.cosmeticStatus(crown).state, 'buy');
  // Achievement items cannot be bought.
  const blaze = COSMETICS.jacket.find((c) => c.id === 'jacket-blaze');
  assert.equal(p.cosmeticStatus(blaze).state, 'locked');
  // Every buyable item has a positive price.
  Object.values(COSMETICS).flat().filter((c) => c.requirement && 'price' in c.requirement).forEach((c) => assert.ok(c.requirement.price > 0));
});

test('trader: old saves without gem data still load', () => {
  const s = memory();
  s.setItem('above-the-clouds-save-v1', JSON.stringify({ version: 1, bestHeight: 300, unlocked: ['jacket-red', 'jacket-sun'], look: { jacket: 'jacket-red' } }));
  const p = new ProgressionSystem(s);
  assert.equal(p.gems, 0);
  assert.deepEqual(p.data.packed, []);
  assert.equal(p.data.look.chalk, 'chalk-white');
  assert.equal(p.owned('rope'), 0);
  assert.ok(p.isUnlocked('chalk-white'), 'new free items are owned');
  assert.ok(p.isUnlocked('jacket-sun'), 'earned items are kept');
});
