import test from 'node:test';
import assert from 'node:assert/strict';
import { Mountain, generateSegment } from '../src/systems/SegmentGenerator.js';
import { ComboSystem } from '../src/systems/ComboSystem.js';
import { BALANCE } from '../src/config/balanceConfig.js';
import { levelToMeters } from '../src/config/gameConfig.js';
import { BIOMES, LOOP_START, FAR_BIOMES, biomeAt } from '../src/data/biomes.js';
import { gemForBiome } from '../src/data/gems.js';
import { Spray, SPRAY } from '../src/systems/mechanics/Spray.js';
import { Bells, BELLS, callMs } from '../src/systems/mechanics/Bells.js';
import { Vines, addVine } from '../src/systems/mechanics/Vines.js';
import { SeededRandom } from '../src/utils/seededRandom.js';
import { EVENTS, EVENT_IDS, RESCUE, runEvent, avalancheAt, eclipseStretch } from '../src/data/events.js';
import { BOONS, SYNERGIES, boonEffects } from '../src/data/boons.js';
import { DARES } from '../src/data/dares.js';

const route = (type, notes) => ({ type, notes: notes.map((dir) => ({ dir, gap: 1 })), tags: [], gripCost: 6 });

test('far range: three new biomes start the high loop, each with gem, segments and backdrop', () => {
  assert.deepEqual(FAR_BIOMES.map((id) => biomeAt(BIOMES[id].from + 5).id), FAR_BIOMES);
  assert.equal(biomeAt(LOOP_START).id, 'cascade');
  for (const id of FAR_BIOMES) {
    const b = BIOMES[id];
    assert.ok(b.far && b.mechanic && b.backdrop.layers.length === 2, id);
    assert.equal(gemForBiome(id).biome, id);
  }
});

test('far range: the dragon always has a Far Shore ledge to set you down on', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const m = new Mountain(seed, BALANCE, 'normal');
    m.ensureLevel(Math.ceil(2000 / levelToMeters(1)));
    const shores = [...m.segments.values()].filter((s) => s.rest && s.rest.farShore);
    assert.equal(shores.length, 1, `seed ${seed}`);
    const lv = shores[0].levels.find((l) => l.nodes.length && l.nodes[0].kind === 'ledge');
    const h = levelToMeters(lv.level);
    assert.ok(h >= LOOP_START && h < LOOP_START + 60, `shore at ${h}`);
    assert.equal(biomeAt(h).id, 'cascade');
  }
});

test('spray: every couple of climbs the routes are wet; six perfects make a rainbow', () => {
  const sp = new Spray(new SeededRandom(5));
  sp.update(16, 1);
  let wet = 0;
  for (let i = 0; i < 12; i++) {
    const rs = [route('safe', ['L', 'U']), route('normal', ['L', 'U', 'R'])];
    sp.decorateRoutes(rs);
    if (rs[0].spray) { wet++; assert.ok(rs.every((r) => r.tags.includes('SPRAY') && r.gripCost > 6)); }
  }
  assert.ok(wet >= 3 && wet <= 8, `${wet} wet`);
  let full = false;
  for (let i = 0; i < SPRAY.rainbowNeed; i++) full = sp.paint();
  assert.equal(full, true);
  assert.equal(sp.rainbow, 0);
});

test('bells: the safe route is never rung, and the call fits before the notes', () => {
  const b = new Bells(new SeededRandom(3));
  b.update(16, 1);
  let rung = false;
  for (let i = 0; i < 8 && !rung; i++) {
    const rs = [route('safe', ['L', 'U', 'R']), route('normal', ['L', 'U', 'R', 'L', 'U', 'R', 'L', 'U', 'R', 'U'])];
    b.decorateRoutes(rs);
    if (rs[1].echo) {
      rung = true;
      assert.ok(!rs[0].echo);
      assert.ok(rs[1].notes.length <= BELLS.maxNotes && rs[1].notes.every((n) => n.echo && !n.chord));
    }
  }
  assert.ok(rung);
  assert.ok(callMs(8, 500) > 8 * 0.5 * 500);
});

test('vines: a vine is a hold that hands over exactly onto the next, different arrow', () => {
  const notes = addVine([{ dir: 'L', gap: 1 }, { dir: 'L', gap: 1 }, { dir: 'U', gap: 1 }], 0, 3, 1);
  assert.ok(notes[0].vine && notes[1].vine && notes[2].vineEnd);
  assert.notEqual(notes[1].dir, notes[0].dir);
  assert.notEqual(notes[2].dir, notes[1].dir);
  const c = new ComboSystem({ notes, beatMs: 500, perfectMs: 60, goodMs: 120, minGapMs: 260, leadInMs: 0 });
  assert.equal(c.notes[1].time, c.notes[0].time + c.notes[0].holdMs);
  // Hold the first, switch to the second on the bend, then the third.
  c.press(notes[0].dir, c.notes[0].time);
  c.press(c.notes[1].dir, c.notes[1].time - 20);
  assert.equal(c.release(notes[0].dir, c.notes[1].time - 10), null);
  c.updateHolds(c.notes[2].time);
  c.press(c.notes[2].dir, c.notes[2].time);
  c.updateHolds(c.notes[2].time + 10);
  assert.equal(c.summary().miss, 0);
  const v = new Vines(new SeededRandom(9));
  v.update(16, 1);
  const rs = Array.from({ length: 10 }, () => route('normal', ['L', 'U', 'R', 'U']));
  v.decorateRoutes(rs);
  assert.ok(rs.some((r) => r.vines));
});

test('events: seeded, one of five, avalanches land inside their biome', () => {
  assert.equal(EVENT_IDS.length, 5);
  for (const id of EVENT_IDS) assert.ok(EVENTS[id].name && EVENTS[id].bram);
  const seen = new Set();
  for (let seed = 1; seed < 400; seed++) {
    assert.equal(runEvent(seed), runEvent(seed));
    seen.add(runEvent(seed));
    const at = avalancheAt(seed, 55, 153);
    assert.ok(at >= 55 && at < 208, `avalanche at ${at}`);
  }
  assert.equal(seen.size, 6); // five events and quiet runs
  const e = eclipseStretch(7, 0);
  assert.ok(e.from >= 55 && BIOMES[e.biome]);
  assert.ok(RESCUE.people.length >= 5 && RESCUE.strikes > 0);
});

test('boons and dares: the new ones, made to be seen not heard', () => {
  for (const id of ['metronome', 'sherpa', 'stormcaller', 'goathooves', 'crow', 'lastlight']) assert.ok(BOONS.some((b) => b.id === id), id);
  for (const id of ['shortsight', 'fragile', 'pacifist', 'tourist', 'onerope']) assert.ok(DARES.some((d) => d.id === id), id);
  // Nothing on a card asks you to listen.
  for (const b of BOONS) assert.ok(!/\b(TICK|HEAR|MUSIC|SOUND)\b/.test(`${b.gift} ${b.price}`), b.id);
  for (const d of DARES) assert.ok(!/\b(TICK|HEAR|MUSIC|SOUND|SILENT)\b/.test(d.text), d.id);
  assert.ok(SYNERGIES.some((s) => s.id === 'nightshift'));
  const fx = boonEffects(['metronome', 'goathooves', 'lastlight', 'sherpa', 'stormcaller', 'catseyes']);
  assert.ok(fx.metronome && fx.beatScale < 1);
  assert.equal(fx.ledgeFill, 0.6);
  assert.equal(fx.restScale, 0.5);
  assert.ok(fx.lastLight && fx.oneSlip && fx.nightShift);
  assert.ok(fx.gemScale < 1 && fx.lightningGrip === 10 && fx.carry.includes('storm'));
});

test('goat hooves: ledges come twice as often on the same seed', () => {
  const count = (scale) => {
    let prev = null, rests = 0;
    for (let i = 0; i < 80; i++) { prev = generateSegment(11, i, prev, BALANCE, 'normal', scale); if (prev.rest) rests++; }
    return rests;
  };
  assert.ok(count(0.5) > count(1) * 1.4);
});

test('overhangs: some segments jut out over you, and the rest of the mountain is unchanged', async () => {
  const { ROOF } = await import('../src/systems/SegmentGenerator.js');
  let roofs = 0, segs = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const m = new Mountain(seed, BALANCE, 'normal');
    m.ensureLevel(600);
    for (const s of m.segments.values()) {
      segs++;
      if (!s.roof) continue;
      roofs++;
      const lv = s.levels.filter((l) => l.roof);
      assert.ok(lv.length >= ROOF.levels[0] && lv.length <= ROOF.levels[1]);
      assert.ok(!lv.some((l) => l.nodes.some((n) => n.kind === 'ledge')));
    }
  }
  assert.ok(roofs / segs > 0.05 && roofs / segs < 0.3, `${roofs} of ${segs}`);
});
