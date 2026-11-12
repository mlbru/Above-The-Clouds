import test from 'node:test';
import assert from 'node:assert/strict';
import { Mountain, buildRhythm } from '../src/systems/SegmentGenerator.js';
import { BALANCE } from '../src/config/balanceConfig.js';
import { levelToMeters } from '../src/config/gameConfig.js';
import { BIOMES, LOOP_START, biomeAt } from '../src/data/biomes.js';
import { GATE, isGateSegment } from '../src/data/gate.js';
import { DragonEye } from '../src/systems/mechanics/DragonEye.js';
import { SeededRandom } from '../src/utils/seededRandom.js';
import { difficultyAt } from '../src/systems/DifficultySystem.js';
import { PETS, STAGES, activePet, petStage, growPet } from '../src/data/pets.js';

test("dragon's gate: every mountain has exactly one Gate ledge, inside the first Spine", () => {
  for (let seed = 1; seed <= 60; seed++) {
    for (const mode of ['normal', 'hard']) {
      const m = new Mountain(seed, BALANCE, mode);
      m.ensureLevel(Math.ceil(2100 / levelToMeters(1)));
      const gates = [...m.segments.values()].filter((s) => s.rest && s.rest.gate);
      assert.equal(gates.length, 1, `seed ${seed} ${mode}`);
      const lv = gates[0].levels.find((l) => l.nodes.length && l.nodes[0].kind === 'ledge');
      const h = levelToMeters(lv.level);
      assert.ok(h >= GATE.ledgeAt && h < LOOP_START, `gate at ${h}`);
      assert.equal(biomeAt(h).id, 'dragon');
    }
  }
  assert.ok(GATE.wakeFrom >= BIOMES.dragon.from && GATE.wakeFrom < GATE.ledgeAt);
  assert.equal(isGateSegment(1820, 1835), true);
  assert.equal(isGateSegment(1835, 1840), false);
});

test("dragon's gate: held awake it never closes its eye, and settles once released", () => {
  const eye = new DragonEye(new SeededRandom(3));
  eye.holdAwake(GATE.breathSec);
  for (let i = 0; i < 2000; i++) eye.update(50, 1);
  assert.equal(eye.phase, 'watching');
  const dirs = eye.startBreath(1800);
  assert.ok(eye.breathIn <= GATE.breathSec[1] * 1000 && dirs.length >= 1);
  eye.release();
  assert.equal(eye.phase, 'closing');
  for (let i = 0; i < 200; i++) eye.update(50, 1);
  assert.notEqual(eye.phase, 'watching');
});

test('roped pairs: two plain, different arrows a beat apart, never the first note', () => {
  const ramp = { ...difficultyAt(3300, 'normal'), swap: 1 };
  let pairs = 0;
  for (let s = 0; s < 300; s++) {
    const rng = new SeededRandom(s);
    const { notes, tags } = buildRhythm(rng, ['L', 'U', 'R', 'U', 'L', 'R'], ramp, BIOMES.bones, 2);
    const i = notes.findIndex((n) => n.swap === 1);
    if (i < 0) continue;
    pairs++;
    assert.ok(tags.includes('ROPED'));
    assert.ok(i >= 1);
    assert.equal(notes[i + 1].swap, 2);
    assert.notEqual(notes[i].dir, notes[i + 1].dir);
    assert.ok(notes[i + 1].gap >= 1);
    for (const n of [notes[i], notes[i + 1]]) assert.ok(!n.hold && !n.hidden && !n.mirror && !n.chord && !n.roll && !n.gust);
  }
  assert.ok(pairs > 50, `only ${pairs} pairs`);
  assert.equal(difficultyAt(1000, 'normal').swap, 0);
});

test('pets: unlock on the mountain, one along at a time, growing with the metres', () => {
  const d = { bestByMode: { normal: 900 }, counters: {} };
  const open = PETS.filter((p) => p.unlocked(d)).map((p) => p.id);
  assert.deepEqual(open.sort(), ['bee', 'moth']);
  d.pets = { active: 'kid', m: {} };
  assert.equal(activePet(d), null, 'a locked pet never comes along');
  d.pets.active = 'bee';
  assert.equal(activePet(d).id, 'bee');
  assert.equal(growPet(d, STAGES[1].at - 1), null);
  assert.equal(growPet(d, 1), 1);
  assert.equal(petStage(d, 'bee'), 1);
  assert.equal(growPet(d, STAGES[2].at), 2);
  d.counters.gates = 1; d.counters.goatFriends = 1;
  assert.equal(PETS.filter((p) => p.unlocked(d)).length, PETS.length);
});
