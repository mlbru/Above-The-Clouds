import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JOURNAL_CHAPTERS, chapterEntries, journalProgress } from '../src/data/journal.js';
import { ProgressionSystem } from '../src/systems/ProgressionSystem.js';

const fresh = () => {
  const store = new Map();
  return new ProgressionSystem({ getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) });
};

test('journal: every entry has a name, text, picture and a unique id', () => {
  const ids = new Set();
  for (const ch of JOURNAL_CHAPTERS) {
    for (const e of ch.entries) {
      assert.ok(e.name && e.text && e.pic, e.id);
      assert.ok(!ids.has(e.id), `duplicate ${e.id}`);
      ids.add(e.id);
    }
  }
});

test('journal: a new save knows only Bram, and entries fill in as you see things', () => {
  const p = fresh();
  assert.equal(journalProgress(p).seen, 1);
  p.discoverBiome('green');
  p.discover('rare-bird');
  p.data.tipsSeen.push('icy');
  const known = (chId) => chapterEntries(JOURNAL_CHAPTERS.find((c) => c.id === chId), p).filter((e) => e.known(p)).map((e) => e.id);
  assert.deepEqual(known('places'), ['place-green']);
  assert.ok(known('creatures').includes('lammergeier'));
  assert.deepEqual(known('hazards'), ['hazard-icy']);
  assert.ok(!chapterEntries(JOURNAL_CHAPTERS.find((c) => c.id === 'wonders'), p).some((e) => e.id === 'wonder-crystal-sealed'), 'legacy entry stays hidden');
});

test('journal: the OPENBOOK code turns every card face up and is not a cheat', async () => {
  const { ProgressionSystem } = await import('../src/systems/ProgressionSystem.js');
  const store = new Map();
  const p = new ProgressionSystem({ getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) });
  assert.ok(journalProgress(p).seen < journalProgress(p).total);
  assert.ok(p.redeemCode('openbook').ok);
  const { seen, total } = journalProgress(p);
  assert.equal(seen, total);
  assert.ok(!Object.values(p.data.cheats || {}).some(Boolean));
  assert.equal(p.gems, 0);
});

test("journal: OPENBOOK restores Maarten's record on his save only, without uploading it", async () => {
  const { ProgressionSystem } = await import('../src/systems/ProgressionSystem.js');
  const mk = (name) => {
    const store = new Map();
    const p = new ProgressionSystem({ getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) });
    p.data.playerName = name;
    p.recordHeight(1089, 'normal');
    return p;
  };
  const me = mk('MAARTEN');
  me.redeemCode('OPENBOOK');
  assert.equal(me.bestFor('normal'), 1867);
  assert.equal(me.data.lbSynced.normal, 1867, 'marked as already on the board');
  const other = mk('TJOMME');
  other.redeemCode('OPENBOOK');
  assert.equal(other.bestFor('normal'), 1089);
});
