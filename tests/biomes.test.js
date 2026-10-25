import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BIOMES, biomeStretchAt } from '../src/data/biomes.js';
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
  const low = r.start(150);
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
  assert.equal(biomeStretchAt(130), 'stone@120');
  assert.equal(biomeStretchAt(290), 'stone@120');
  assert.notEqual(biomeStretchAt(310), biomeStretchAt(290));
  const loopA = biomeStretchAt(1310), loopB = biomeStretchAt(1310 + 750);
  assert.equal(loopA.split('@')[0], loopB.split('@')[0]);
  assert.notEqual(loopA, loopB);
});
