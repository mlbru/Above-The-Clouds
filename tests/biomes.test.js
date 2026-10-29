import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BIOMES, SEQUENCE, LOOP_START, biomeStretchAt, nextBiomeAbove } from '../src/data/biomes.js';
import { Storm, STORM } from '../src/systems/mechanics/Storm.js';
import { applySwing } from '../src/systems/mechanics/Swing.js';
import { DragonEye, DRAGON_EYE } from '../src/systems/mechanics/DragonEye.js';
import { DISCOVERIES } from '../src/data/discoveries.js';
import { WALL_OVERLAYS, ledgeTopColor } from '../src/render/wallOverlays.js';
import { Whiteout, WHITEOUT } from '../src/systems/mechanics/Whiteout.js';
import { BiomeMechanics } from '../src/systems/mechanics/index.js';
import { SeededRandom } from '../src/utils/seededRandom.js';
import { Rockfall, ROCKFALL } from '../src/systems/mechanics/Rockfall.js';
import { addThermal, THERMALS } from '../src/systems/mechanics/Thermals.js';
import { Mountain } from '../src/systems/SegmentGenerator.js';
import { Darkness, DARKNESS, darkAlpha } from '../src/systems/mechanics/Darkness.js';
import { PrismLight, PRISM_LIGHT, litIndex } from '../src/systems/mechanics/PrismLight.js';
import { ProgressionSystem, sandboxCopy } from '../src/systems/ProgressionSystem.js';
import { Swarm, SWARM, addSwarm } from '../src/systems/mechanics/Swarm.js';
import { Gears, GEARS, gearTicks, gearDir } from '../src/systems/mechanics/Gears.js';
import { BoneGarden, BONE_GARDEN } from '../src/systems/mechanics/BoneGarden.js';
import { ComboSystem } from '../src/systems/ComboSystem.js';
import { gemForBiome } from '../src/data/gems.js';
import { SEGMENT_TEMPLATES } from '../src/data/segments.js';

test('every biome definition is complete', () => {
  for (const b of Object.values(BIOMES)) {
    assert.ok(b.wall.overlays.every((n) => WALL_OVERLAYS[n]), `${b.id} overlays`);
    assert.equal(typeof ledgeTopColor(b), 'number', `${b.id} ledge colour`);
    assert.ok(b.rest.viewpoints.length > 0, `${b.id} viewpoints`);
    if (b.rest.discovery) assert.ok(DISCOVERIES[b.rest.discovery], `${b.id} discovery`);
    for (const l of b.backdrop?.layers || []) assert.ok(l.key && l.paint && l.h > 0, `${b.id} backdrop layer`);
  }
});

test('whiteout only builds inside its biome and runs warning, storm, clear', () => {
  const w = new Whiteout(new SeededRandom(1));
  for (let i = 0; i < 100; i++) assert.equal(w.update(1000, 0), null);
  assert.equal(w.phase, 'calm');
  const events = [];
  for (let t = 0; t < 70000; t += 100) {
    const e = w.update(100, 1);
    if (e) events.push(e);
    if (w.phase === 'storm' && w.left < WHITEOUT.stormSec * 500) {
      assert.ok(w.active);
      const mods = w.routeMods();
      assert.equal(mods.gemScale, WHITEOUT.gemScale);
      assert.ok(mods.revealMs > 0);
    }
  }
  assert.deepEqual(events.slice(0, 3), ['warning', 'storm', 'clear']);
  assert.ok(events.length >= 3);
});

test('whiteout fades when you climb out of the biome', () => {
  const w = new Whiteout(new SeededRandom(2));
  while (w.phase !== 'storm') w.update(100, 1);
  for (let i = 0; i < 40; i++) w.update(100, 1);
  assert.ok(w.intensity > 0.9);
  for (let i = 0; i < 60; i++) w.update(100, 0);
  assert.ok(w.intensity < 0.05);
  assert.equal(w.routeMods(), null);
});

test('biome mechanics manager weighs mechanics by biome mix', () => {
  const m = new BiomeMechanics(new SeededRandom(3));
  const green = { a: BIOMES.green, b: BIOMES.green, t: 0 };
  for (let i = 0; i < 1000; i++) m.update(100, green);
  assert.equal(m.get('whiteout').phase, 'calm');
  assert.deepEqual(m.weather(), { snow: 0, mist: 0, wind: 0 });
  const frozen = { a: BIOMES.frozen, b: BIOMES.frozen, t: 0 };
  const seen = [];
  for (let i = 0; i < 800; i++) m.update(100, frozen).forEach((e) => seen.push(e.event));
  assert.ok(seen.includes('storm'));
});

test('rockfall waits for its biome, then plans one or two dodges', () => {
  const r = new Rockfall(new SeededRandom(4));
  for (let i = 0; i < 200; i++) r.update(1000, 0);
  assert.equal(r.due, false);
  for (let i = 0; i < 20; i++) r.update(1000, 1);
  assert.ok(r.due);
  const low = r.start(120);
  assert.equal(low.length, 1);
  assert.ok(['L', 'R'].includes(low[0]));
  assert.equal(r.due, false);
  assert.equal(r.start(ROCKFALL.doubleFrom + 10).length, 2);
});

test('thermals lift a route to a real hold two levels above its target', () => {
  const m = new Mountain(7);
  m.ensureLevel(500);
  let found = 0;
  for (let lv = 330; lv < 480 && found < 5; lv++) {
    const level = m.getLevel(lv);
    const node = level && level.nodes[0];
    if (!node || node.kind === 'ledge') continue;
    const routes = m.computeRoutes(node);
    const r = addThermal(routes, m, new SeededRandom(lv), { ...THERMALS, chance: 1 });
    if (!r) continue;
    found++;
    assert.notEqual(r.type, 'safe');
    assert.equal(r.notes[r.thermal.note].dir, 'U');
    assert.ok(r.notes[r.thermal.note].thermal);
    assert.equal(r.thermal.to.level, r.target.level + THERMALS.liftLevels);
    assert.notEqual(r.thermal.to.kind, 'ledge');
    assert.ok(Math.abs(r.thermal.to.x - r.target.x) <= THERMALS.maxDrift);
    assert.equal(routes.filter((x) => x.thermal).length, 1);
  }
  assert.ok(found > 0);
});

test('darkness marks routes and flashes notes on the beat', () => {
  const d = new Darkness(new SeededRandom(5));
  const routes = [{}, {}];
  d.decorateRoutes(routes);
  assert.equal(routes[0].mods, undefined);
  d.update(100, 1);
  d.decorateRoutes(routes);
  assert.equal(routes[0].mods.tag, 'DARK');
  assert.equal(darkAlpha(DARKNESS, 1000, 1000, 600, false), 0.85);
  assert.equal(darkAlpha(DARKNESS, 1400, 1000, 600, false), DARKNESS.dimAlpha);
  assert.equal(darkAlpha(DARKNESS, 1400, 1000, 600, true), DARKNESS.currentAlpha);
  assert.equal(darkAlpha(DARKNESS, 1600, 1000, 600, true), 1);
});

test('prism light sweeps across the routes and bounces at the ends', () => {
  const p = new PrismLight(new SeededRandom(1));
  const routes = [{ type: 'safe' }, { type: 'normal' }, { type: 'risky' }];
  p.decorateRoutes(routes);
  assert.equal(routes[0].prism, undefined);
  p.update(100, 1);
  p.decorateRoutes(routes);
  assert.ok(routes.every((r) => r.prism && r.prism.start === routes[0].prism.start));
  const d = PRISM_LIGHT.dwellMs;
  const seq = [0, 1, 2, 3, 4, 5, 6].map((k) => litIndex(k * d + 1, 3, 0));
  assert.deepEqual(seq, [0, 1, 2, 1, 0, 1, 2]);
  assert.equal(litIndex(0, 3, 2), 2);
  assert.equal(litIndex(5000, 1, 0), 0);
  // Two routes just alternate.
  assert.deepEqual([0, 1, 2, 3].map((k) => litIndex(k * d, 2, 0)), [0, 1, 0, 1]);
});

test('dev save copy never writes the real save', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const real = new ProgressionSystem(storage);
  real.recordHeight(50);
  const before = store.get([...store.keys()][0]);
  const dev = sandboxCopy(real);
  dev.recordHeight(900);
  dev.discover('crystal-sealed');
  assert.equal(store.get([...store.keys()][0]), before);
  assert.ok(dev.data.bestHeight >= 900);
  assert.ok(real.data.bestHeight < 900);
  assert.equal(dev.settings, real.settings);
  assert.equal(real.redeemCode('warpzone').ok, true);
  assert.ok(real.data.cheats.devTeleport);
});

test('biome stretches tell repeat visits in the high loop apart', () => {
  assert.equal(biomeStretchAt(100), 'stone@55');
  assert.equal(biomeStretchAt(200), 'stone@55');
  assert.notEqual(biomeStretchAt(215), biomeStretchAt(200));
  const loopA = biomeStretchAt(1880), loopB = biomeStretchAt(1880 + 173 * 8);
  assert.equal(loopA.split('@')[0], loopB.split('@')[0]);
  assert.notEqual(loopA, loopB);
});

test('nextBiomeAbove: the next stretch and where it starts', () => {
  assert.deepEqual([nextBiomeAbove(0).biome.id, nextBiomeAbove(0).from], ['stone', 55]);
  assert.deepEqual([nextBiomeAbove(207).biome.id, nextBiomeAbove(207).from], ['frozen', 208]);
  assert.deepEqual([nextBiomeAbove(400).biome.id, nextBiomeAbove(400).from], ['hive', 486]);
  assert.deepEqual([nextBiomeAbove(900).biome.id, nextBiomeAbove(900).from], ['clockwork', 1006]);
  assert.deepEqual([nextBiomeAbove(1400).biome.id, nextBiomeAbove(1400).from], ['bones', 1526]);
  assert.deepEqual([nextBiomeAbove(1600).biome.id, nextBiomeAbove(1600).from], ['dragon', 1700]);
  // The dragon stays the last biome of the way up; then the high loop starts.
  assert.deepEqual([nextBiomeAbove(1800).biome.id, nextBiomeAbove(1800).from], ['hive', 1873]);
  assert.deepEqual([nextBiomeAbove(1873).biome.id, nextBiomeAbove(1873).from], ['obsidian', 2046]);
});

test('every biome on the way up is about as long as the others', () => {
  const froms = SEQUENCE.map((id) => BIOMES[id].from).concat(LOOP_START);
  for (let i = 2; i < froms.length - 1; i++) {
    const len = froms[i + 1] - froms[i];
    assert.ok(len >= 120 && len <= 180, `${SEQUENCE[i]} is ${len} m long`);
  }
  assert.equal(SEQUENCE[SEQUENCE.length - 1], 'dragon');
  assert.equal(BIOMES.dragon.from, 1700);
});

test('every biome on the way up has its own gem, segments and backdrop', () => {
  for (const id of SEQUENCE) {
    assert.equal(gemForBiome(id).biome, id, `${id} gem`);
    assert.ok(SEGMENT_TEMPLATES.some((t) => t.biomes.includes(id)), `${id} segments`);
    if (id !== 'green') assert.ok(BIOMES[id].backdrop.layers.length, `${id} backdrop`);
  }
});

test('swarm: some routes get a run of still beats in the middle', () => {
  const s = new Swarm(new SeededRandom(9), { ...SWARM, chance: 1, safeChance: 1 });
  const mk = () => [{ type: 'normal', notes: [{ dir: 'L' }, { dir: 'U' }, { dir: 'R' }, { dir: 'U' }] }];
  const outside = mk();
  s.decorateRoutes(outside);
  assert.equal(outside[0].notes.length, 4);
  s.update(100, 1);
  const routes = mk();
  s.decorateRoutes(routes);
  const notes = routes[0].notes;
  const still = notes.filter((n) => n.still);
  assert.ok(still.length === 2 || still.length === 3);
  assert.ok(still.every((n) => n.swarm));
  assert.ok(!notes[0].still && !notes[notes.length - 1].still);
  assert.ok(routes[0].tags.includes('SWARM'));
  assert.deepEqual(addSwarm([{ dir: 'L' }, { dir: 'R' }], 0, 2).map((n) => (n.still ? 'S' : n.dir)).join(''), 'LSSR');
});

test('swarm beats: hang still for a perfect, move and you are stung', () => {
  const combo = new ComboSystem({ notes: addSwarm([{ dir: 'L' }, { dir: 'R' }], 0, 2), beatMs: 500, perfectMs: 60, goodMs: 120, leadInMs: 0 });
  assert.equal(combo.press('L', 0).judged.result, 'perfect');
  assert.equal(combo.update(500 + 200).map((n) => n.result).join(), 'perfect');
  const moved = combo.press('U', 1000).judged;
  assert.equal(moved.result, 'miss');
  assert.equal(moved.reason, 'moved');
  assert.ok(moved.swarm);
});

test('gears: the arrow turns clockwise into place, two beats early, never past right', () => {
  assert.equal(gearDir('R', 0), 'R');
  assert.equal(gearDir('R', 1), 'U');
  assert.equal(gearDir('R', 2), 'L');
  assert.equal(gearDir('U', 1), 'L');
  const note = { gear: 2, time: 5000 };
  assert.equal(gearTicks(note, 1000, 500), 2);
  assert.equal(gearTicks(note, 3400, 500), 2);
  assert.equal(gearTicks(note, 3600, 500), 1);
  assert.equal(gearTicks(note, 4100, 500), 0, 'locked two beats before the line');
  assert.equal(gearTicks({ gear: 0, time: 5000 }, 0, 500), 0);
  const g = new Gears(new SeededRandom(2), { ...GEARS, noteChance: 1 });
  g.update(100, 1);
  const routes = [
    { type: 'normal', notes: [{ dir: 'L' }, { dir: 'R' }, { dir: 'U' }, { dir: 'L' }, { dir: 'R', chord: 'L' }, { dir: 'U' }, { dir: 'R' }] },
    { type: 'safe', notes: [{ dir: 'L' }, { dir: 'R' }, { dir: 'U' }] },
  ];
  g.decorateRoutes(routes);
  const notes = routes[0].notes;
  assert.equal(notes.filter((n) => n.gear).length, GEARS.maxPerRoute);
  assert.ok(!notes[0].gear, 'the first note has no beats to turn on');
  assert.ok(notes.every((n) => !n.gear || n.dir !== 'L'), 'a left arrow cannot turn into place clockwise');
  assert.ok(notes.every((n) => !n.gear || n.gear <= (n.dir === 'R' ? 2 : 1)), 'never turns past right');
  assert.ok(notes.every((n, i) => !(n.gear && notes[i - 1] && notes[i - 1].gear)), 'never two in a row');
  assert.ok(!notes[4].gear, 'doubles keep their own look');
  assert.ok(routes[1].notes.every((n) => !n.gear), 'safe routes have no gears');
});

test('bone garden: three rattles bring a growl and a few tighter climbs', () => {
  const b = new BoneGarden(new SeededRandom(1));
  assert.equal(b.onMiss(), null, 'quiet outside the garden');
  b.update(100, 1);
  assert.equal(b.onMiss(), 'rattle');
  b.rest();
  assert.equal(b.rattles, 0, 'a ledge quiets the skulls');
  assert.deepEqual([b.onMiss(), b.onMiss(), b.onMiss()], ['rattle', 'rattle', 'growl']);
  for (let i = 0; i < BONE_GARDEN.dreadClimbs; i++) {
    const routes = [{ windowScale: 1 }];
    b.decorateRoutes(routes);
    assert.equal(routes[0].windowScale, BONE_GARDEN.dreadWindow);
    b.onClimb(routes[0]);
  }
  const after = [{ windowScale: 1 }];
  b.decorateRoutes(after);
  assert.equal(after[0].windowScale, 1, 'the dread runs out');
  // Bone holds snap: the garden has extra crumbling holds.
  assert.ok(BIOMES.bones.hazards.crumbling > 0);
});

test('storm: hanging drains faster only while the storm rages', () => {
  const s = new Storm(new SeededRandom(3));
  assert.equal(s.hangScale, 1);
  const seen = [];
  for (let i = 0; i < 1200; i++) { const e = s.update(100, 1); if (e) seen.push(e); if (s.active) break; }
  assert.ok(seen.includes('warning') && seen.includes('storm'));
  assert.ok(s.active);
  assert.equal(s.hangScale, STORM.hangScale);
  const routes = [{ type: 'normal' }];
  s.decorateRoutes(routes);
  assert.equal(routes[0].mods.tag, 'STORM');
});

test('swing: straight beats become long-short pairs, other gaps stay', () => {
  const notes = [{ dir: 'L', gap: 1 }, { dir: 'U', gap: 1 }, { dir: 'R', gap: 1 }, { dir: 'U', gap: 0.5 }, { dir: 'L', gap: 1 }];
  assert.ok(applySwing(notes));
  assert.deepEqual(notes.map((n) => +n.gap.toFixed(2)), [1, 1.33, 0.67, 0.5, 0.67]);
  const held = [{ dir: 'L', gap: 1, hold: 1 }, { dir: 'U', gap: 1 }];
  applySwing(held);
  assert.equal(held[1].gap, 1, 'the note after a hold keeps its gap');
});

test("dragon's eye: opens, watches, puts on pressure and breathes fire", () => {
  const d = new DragonEye(new SeededRandom(5));
  const events = [];
  for (let i = 0; i < 600 && !d.active; i++) { const e = d.update(100, 1); if (e) events.push(e); }
  assert.deepEqual(events, ['open', 'watch']);
  assert.equal(d.openness, 1);
  assert.ok(d.pressure >= 0.6, 'watching puts on pressure');
  assert.ok(!d.breathDue, 'a moment to see it first');
  for (let i = 0; i < DRAGON_EYE.firstBreathSec * 10; i++) d.update(100, 1);
  assert.ok(d.breathDue);
  const dirs = d.startBreath(1750);
  assert.equal(dirs.length, 1);
  assert.ok(['L', 'R'].includes(dirs[0]));
  assert.ok(!d.breathDue, 'the timer restarts');
  // High up it breathes twice, the second sweep from the other side.
  const two = d.startBreath(2100);
  assert.equal(two.length, 2);
  assert.notEqual(two[0], two[1]);
  // Outside the biome there is no pressure.
  d.update(100, 0);
  assert.equal(d.pressure, 0);
});
