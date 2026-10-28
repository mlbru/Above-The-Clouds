import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProgressionSystem } from '../src/systems/ProgressionSystem.js';
import { DARE, DARES, MAX_DARES, cleanDares, dareKey, dareLabel, dareScale } from '../src/data/dares.js';
import { STAMP_BY_ID } from '../src/data/logbook.js';
import { FEEL_OPTIONS } from '../src/ui/SettingsMenu.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('dares: at most two known ones, in a fixed order, each adding to the gems', () => {
  assert.deepEqual(cleanDares(['night', 'mirror']), ['mirror', 'night']);
  assert.deepEqual(cleanDares(['nope', 'blind']), ['blind']);
  assert.equal(cleanDares(DARES.map((d) => d.id)).length, MAX_DARES);
  assert.equal(dareScale([]), 1);
  assert.equal(dareScale(['quick', 'light']), DARE.gemScale ** 2);
  assert.equal(dareKey(['night', 'mirror'], 'hard'), 'hard:mirror+night');
  assert.equal(dareLabel(['blind']), 'BLIND');
});

test('dares: a dared run keeps its own record and never touches the mode record', () => {
  const p = new ProgressionSystem(memory());
  const key = dareKey(['mirror'], 'normal');
  assert.equal(p.recordDareHeight(120, key).newBest, true);
  assert.equal(p.recordDareHeight(80, key).newBest, false);
  assert.equal(p.dareBestFor(key), 120);
  assert.equal(p.bestFor('normal'), 0);
  assert.equal(p.dareBestFor(dareKey(['mirror', 'night'], 'normal')), 0);
});

test('dares: every dare has a stamp for its height with it on', () => {
  for (const d of DARES) {
    const s = STAMP_BY_ID[`dare-${d.id}`];
    assert.ok(s, d.id);
    assert.equal(s.goal, DARE.stampAt);
    assert.equal(s.value({ run: { maxHeight: 600, dares: [d.id] } }), 600);
    assert.equal(s.value({ run: { maxHeight: 600, dares: [] } }), 0);
  }
});

test('feel settings: every option has a default that is one of its choices', () => {
  const p = new ProgressionSystem(memory());
  for (const [key, , values] of FEEL_OPTIONS) assert.ok(values.some(([v]) => v === p.settings[key]), key);
});

test('codes: the debug code is only a hash, and a wrong code unlocks nothing', async () => {
  const { codeHash } = await import('../src/systems/ProgressionSystem.js');
  assert.match(codeHash('ANYTHING'), /^[0-9a-f]{8}$/);
  const p = new ProgressionSystem(memory());
  assert.equal(p.redeemCode('DEBUG').ok, false);
  assert.equal(p.debugUnlocked, false);
  assert.deepEqual(p.data.cheats, {});
});
