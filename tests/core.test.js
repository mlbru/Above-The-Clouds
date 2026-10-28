import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/config/balanceConfig.js';
import { ComboSystem, RESULT, timingWindows } from '../src/systems/ComboSystem.js';
import { GripSystem } from '../src/systems/GripSystem.js';
import { Mountain, generateSegment } from '../src/systems/SegmentGenerator.js';
import { ProgressionSystem } from '../src/systems/ProgressionSystem.js';
import { COMBO_PATTERNS, isValidPattern } from '../src/data/comboPatterns.js';
import { biomeAt, biomeMixAt } from '../src/data/biomes.js';
import { difficultyAt } from '../src/systems/DifficultySystem.js';
import { choosePattern } from '../src/data/comboPatterns.js';
import { SeededRandom } from '../src/utils/seededRandom.js';

const combo = (pattern, opts = {}) => new ComboSystem({ pattern, beatMs: 600, perfectMs: 90, goodMs: 180, earlyGraceMs: 220, leadInMs: 1000, startTime: 0, ...opts });

test('perfect, good, early, late and wrong-direction judgements', () => {
  const c = combo(['L', 'U', 'R', 'U', 'L']);
  assert.equal(c.press('L', 1000 + 40).judged.result, RESULT.PERFECT);
  assert.equal(c.press('U', 1600 - 150).judged.result, RESULT.GOOD);
  const early = c.press('R', 2200 - 300).judged;
  assert.equal(early.result, RESULT.MISS);
  assert.equal(early.reason, 'early');
  const wrong = c.press('L', 2800).judged;
  assert.equal(wrong.result, RESULT.MISS);
  assert.equal(wrong.reason, 'wrong');
  // Nothing pressed for note 5: it becomes a late miss.
  const late = c.update(3400 + 181);
  assert.equal(late.length, 1);
  assert.equal(late[0].reason, 'late');
  assert.ok(c.done);
  assert.deepEqual({ ...c.summary(), allPerfect: undefined }, { perfect: 1, good: 1, miss: 3, total: 5, allPerfect: undefined });
});

test('presses far too early are ignored, not punished', () => {
  const c = combo(['U', 'U', 'L']);
  const r = c.press('U', 100);
  assert.equal(r.judged, null);
  assert.equal(c.index, 0);
});

test('late press within window is good; just past window becomes a late miss', () => {
  const c = combo(['L', 'R', 'U']);
  assert.equal(c.press('L', 1000 + 170).judged.result, RESULT.GOOD);
  const r = c.press('R', 1600 + 200);
  assert.equal(r.auto.length, 1);
  assert.equal(r.auto[0].reason, 'late');
  // The same press is then judged against the next note (too early for it).
  assert.equal(r.judged, null);
});

test('shifting notes (pause/resume) moves the windows', () => {
  const c = combo(['L', 'U', 'R']);
  c.shift(5000);
  assert.equal(c.update(1600).length, 0);
  assert.equal(c.press('L', 6000).judged.result, RESULT.PERFECT);
});

test('timing windows scale and respect minimums', () => {
  const w = timingWindows(BALANCE, { windowScale: 1 });
  assert.deepEqual(w, { perfectMs: 90, goodMs: 180 });
  const f = timingWindows(BALANCE, { windowScale: 1, forgiving: true });
  assert.ok(f.goodMs > w.goodMs && f.perfectMs > w.perfectMs);
  const tiny = timingWindows(BALANCE, { windowScale: 0.1 });
  assert.equal(tiny.goodMs, BALANCE.timing.minGoodMs);
});

test('grip: perfect costs less than good, miss costs more, loose holds hurt more', () => {
  const g = new GripSystem(BALANCE);
  const route = { gripCost: 6, inputs: 4, hazard: null };
  const p = g.noteCost(route, RESULT.PERFECT), gd = g.noteCost(route, RESULT.GOOD), m = g.noteCost(route, RESULT.MISS);
  assert.ok(p < gd && gd < m);
  assert.ok(g.noteCost({ ...route, hazard: 'loose' }, RESULT.MISS) > m);
  g.set(5);
  g.applyNote(route, RESULT.MISS);
  assert.equal(g.value, 0);
  assert.ok(g.isEmpty);
});

test('grip: hanging drains after grace, jugs recover up to cap', () => {
  const g = new GripSystem(BALANCE);
  g.set(50);
  g.hang(BALANCE.grip.hangGraceSec - 0.1);
  assert.equal(g.value, 50);
  g.hang(10);
  assert.ok(g.value < 50);
  g.set(40);
  g.hang(100, { onJug: true });
  assert.equal(g.value, BALANCE.grip.jugRecoverCap);
});

test('one missed input on a safe route does not end the climb', () => {
  const g = new GripSystem(BALANCE);
  const route = { gripCost: 3.2, inputs: 3, hazard: null };
  g.applyNote(route, RESULT.MISS);
  assert.ok(g.value > 80);
  assert.ok(BALANCE.combo.maxMissesForSuccess >= 1);
});

test('combo pattern library is valid', () => {
  for (const [len, list] of Object.entries(COMBO_PATTERNS)) {
    for (const p of list) {
      assert.equal(p.dirs.length, Number(len));
      assert.ok(isValidPattern(p.dirs), p.id);
    }
  }
});

test('same seed reproduces the same segment sequence', () => {
  const a = new Mountain(12345), b = new Mountain(12345), c = new Mountain(999);
  a.ensureLevel(400); b.ensureLevel(400); c.ensureLevel(400);
  const sig = (m) => [...m.segments.values()].map((s) => `${s.templateId}|${s.levels.map((l) => l.nodes.map((n) => n.x).join(',')).join(';')}`).join('\n');
  assert.equal(sig(a), sig(b));
  assert.notEqual(sig(a), sig(c));
});

test('generator never creates an impossible route (many seeds, long climbs)', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const m = new Mountain(seed * 7919);
    m.ensureLevel(700);
    for (const [level, lv] of m.levels) {
      if (level > 650) continue;
      const below = m.getLevel(level - 1), below2 = m.getLevel(level - 2);
      const afterLedge = [below, below2].some((b) => b && b.nodes.length && b.nodes[0].kind === 'ledge');
      assert.ok(lv.nodes.length >= 1 || afterLedge, `level ${level} empty only right above a ledge`);
      for (const node of lv.nodes) {
        assert.ok(node.x > lv.bounds.l && node.x < lv.bounds.r, `node inside wall seed ${seed} lv ${level}`);
        const routes = m.computeRoutes(node);
        assert.ok(routes.length >= 1, `node ${node.id} seed ${seed} has a route`);
        assert.ok(routes.some((r) => r.type === 'safe'), `safe route from ${node.id}`);
        for (const r of routes) {
          assert.ok(r.target.level > node.level);
          assert.ok(Math.abs(r.target.x - node.x) <= BALANCE.routes[r.type].maxReach);
          assert.equal(r.pattern.length, r.inputs);
          assert.ok(r.inputs >= BALANCE.routes[r.type].inputs && r.inputs <= BALANCE.routes[r.type].inputs + 2);
          assert.ok(isValidPattern(r.pattern));
          assert.ok(m.getLevel(r.target.level).nodes.includes(r.target));
        }
        // Routes never skip over a rest ledge (checkpoints are mandatory).
        const ledge = m.nextLedgeAbove(node.level);
        for (const r of routes) assert.ok(ledge === null || r.target.level <= ledge);
      }
    }
  }
});

test('levels are contiguous and rest ledges appear regularly', () => {
  const m = new Mountain(42);
  m.ensureLevel(600);
  let lastLedge = 0;
  for (let l = 0; l <= 600; l++) {
    const lv = m.getLevel(l);
    assert.ok(lv, `level ${l} exists`);
    if (lv.nodes.length && lv.nodes[0].kind === 'ledge') {
      assert.ok(l - lastLedge <= 5 * 15, `ledge gap ${l - lastLedge}`);
      lastLedge = l;
    }
  }
});

test('pruning removes old segments and keeps memory bounded on a long run', () => {
  const m = new Mountain(7);
  let removedCount = 0;
  m.on('remove', () => removedCount++);
  for (let level = 0; level < 5000; level += 10) {
    m.ensureLevel(level + 70);
    m.prune(level - 22);
    assert.ok(m.segments.size <= 12, `segments alive ${m.segments.size}`);
    assert.ok(m.levels.size <= 160, `levels alive ${m.levels.size}`);
  }
  assert.ok(removedCount > 150);
});

test('biome lookup and blending', () => {
  assert.equal(biomeAt(0).id, 'green');
  assert.equal(biomeAt(200).id, 'stone');
  assert.equal(biomeAt(350).id, 'frozen');
  assert.equal(biomeAt(600).id, 'clouds');
  assert.ok(biomeAt(5000).id);
  const mix = biomeMixAt(75);
  assert.equal(mix.a.id, 'green');
  assert.equal(mix.b.id, 'stone');
  assert.ok(mix.t > 0 && mix.t < 0.5);
});

test('progression persists, unlocks cosmetics and survives bad storage', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const p = new ProgressionSystem(storage);
  const { newBest, unlocks } = p.recordHeight(160);
  assert.ok(newBest);
  assert.ok(unlocks.some((u) => u.id === 'jacket-sun'));
  assert.ok(unlocks.some((u) => u.id === 'jacket-teal'));
  assert.ok(p.discover('rare-bird').isNew);
  assert.ok(!p.discover('rare-bird').isNew);
  const p2 = new ProgressionSystem(storage);
  assert.equal(p2.data.bestHeight, 160);
  assert.ok(p2.isUnlocked('acc-feather'));
  store.set('above-the-clouds-save-v1', '{broken json');
  const p3 = new ProgressionSystem(storage);
  assert.equal(p3.data.bestHeight, 0);
});

test('routes from a ledge start above the empty gap so the climber clears the ledge', () => {
  const m = new Mountain(5);
  const camp = m.getLevel(0) || (m.ensureLevel(10), m.getLevel(0));
  const routes = m.computeRoutes(camp.nodes[0]);
  assert.ok(routes.length >= 1);
  for (const r of routes) assert.ok(r.target.level >= 1 + BALANCE.generation.ledgeExitGap);
  assert.equal(m.getLevel(1).nodes.length, 0);
  assert.equal(m.getLevel(2).nodes.length, 0);
});

test('base segment starts with a camp ledge checkpoint at level 0', () => {
  const s = generateSegment(1, 0, null);
  assert.equal(s.startLevel, 0);
  assert.equal(s.levels[0].nodes[0].kind, 'ledge');
  assert.equal(s.rest.type, 'camp');
});

test('hold notes: holding through succeeds, letting go early is a miss', () => {
  const c = new ComboSystem({ notes: [{ dir: 'U', hold: 2 }, { dir: 'L', gap: 1 }], beatMs: 500, perfectMs: 90, goodMs: 180, leadInMs: 1000 });
  assert.equal(c.notes[0].holdMs, 1000);
  assert.equal(c.notes[1].time, 1000 + 1000 + 500);
  assert.equal(c.press('U', 1000).judged.result, RESULT.PERFECT);
  assert.ok(c.notes[0].holding);
  assert.equal(c.release('U', 1500).reason, 'release');
  assert.equal(c.notes[0].result, RESULT.MISS);

  const d = new ComboSystem({ notes: [{ dir: 'U', hold: 2 }], beatMs: 500, perfectMs: 90, goodMs: 180, leadInMs: 1000 });
  d.press('U', 1010);
  assert.ok(!d.done, 'combo waits for the hold to finish');
  assert.equal(d.updateHolds(1900).length, 0);
  assert.equal(d.updateHolds(2010).length, 1);
  assert.ok(d.done);
  assert.equal(d.release('U', 2050), null);
  assert.equal(d.summary().miss, 0);
});

test('releasing within the grace period at the end of a hold is fine', () => {
  const c = new ComboSystem({ notes: [{ dir: 'R', hold: 2 }], beatMs: 500, perfectMs: 90, goodMs: 180, leadInMs: 1000, holdReleaseGraceMs: 120 });
  c.press('R', 1000);
  assert.equal(c.release('R', 1900), null);
  assert.equal(c.notes[0].result, RESULT.PERFECT);
});

test('off-beat gaps respect the minimum gap and gusts narrow windows', () => {
  const c = new ComboSystem({ notes: [{ dir: 'L' }, { dir: 'U', gap: 0.5, gust: true }, { dir: 'R', gap: 1.5 }], beatMs: 400, perfectMs: 90, goodMs: 180, leadInMs: 1000, minGapMs: 260, gustWindowScale: 0.7 });
  assert.equal(c.notes[1].time - c.notes[0].time, 260);
  assert.equal(c.notes[2].time - c.notes[1].time, 600);
  assert.equal(c.notes[1].goodMs, 126);
  assert.equal(c.notes[0].goodMs, 180);
  // A press 150ms late is good on a calm note but a late miss on the gust note.
  c.press('L', 1000);
  const r = c.press('U', c.notes[1].time + 150);
  assert.equal(r.auto[0].reason, 'late');
});

test('difficulty ramps with height and faster in hard mode', () => {
  const low = difficultyAt(0), mid = difficultyAt(500), high = difficultyAt(1500);
  assert.ok(low.beatScale > mid.beatScale && mid.beatScale > high.beatScale);
  assert.ok(low.windowScale > mid.windowScale && mid.windowScale >= high.windowScale);
  assert.equal(low.extraInputs, 0);
  assert.equal(high.extraInputs, 2);
  assert.equal(low.hold, 0);
  assert.ok(high.hold > 0 && high.fade > 0 && high.gust > 0 && high.crumbling > 0);
  assert.ok(difficultyAt(300, 'hard').effectiveHeight > difficultyAt(300, 'normal').effectiveHeight);
  assert.ok(difficultyAt(0, 'hard').windowScale < difficultyAt(0, 'normal').windowScale);
});

test('long patterns (6-7 inputs) stay valid', () => {
  const rng = new SeededRandom(3);
  for (let i = 0; i < 300; i++) {
    const p = choosePattern(rng, 6 + (i % 2), (i % 3) - 1, 'balanced');
    assert.equal(p.length, 6 + (i % 2));
    assert.ok(isValidPattern(p), p.join(''));
  }
});

test('high routes have more inputs, faster beats and rhythm tricks', () => {
  const m = new Mountain(11);
  m.ensureLevel(900);
  let tricks = 0, crumbling = 0;
  for (const [level, lv] of m.levels) {
    for (const n of lv.nodes) if (n.hazard === 'crumbling') crumbling++;
    if (level < 600 || !lv.nodes.length || lv.nodes[0].kind === 'ledge') continue;
    for (const r of m.computeRoutes(lv.nodes[0])) {
      assert.equal(r.notes.length, r.inputs);
      assert.ok(r.inputs >= BALANCE.routes[r.type].inputs + 2);
      assert.ok(r.beatMs < BALANCE.routes[r.type].beatMs);
      tricks += r.tags.length;
    }
  }
  assert.ok(tricks > 20, `tricks ${tricks}`);
  assert.ok(crumbling > 5, `crumbling ${crumbling}`);
  const low = new Mountain(11);
  low.ensureLevel(20);
  for (const r of low.computeRoutes(low.getLevel(0).nodes[0])) assert.deepEqual(r.tags, []);
});

test('rests get further apart higher up', () => {
  const m = new Mountain(21);
  m.ensureLevel(800);
  const gaps = [];
  let last = 0;
  for (let l = 1; l <= 800; l++) {
    const lv = m.getLevel(l);
    if (lv.nodes.length && lv.nodes[0].kind === 'ledge') { gaps.push([l, l - last]); last = l; }
  }
  const avg = (arr) => arr.reduce((a, [, g]) => a + g, 0) / arr.length;
  const lowGaps = gaps.filter(([l]) => l < 150), highGaps = gaps.filter(([l]) => l > 520);
  assert.ok(avg(highGaps) > avg(lowGaps) * 1.3, `${avg(lowGaps)} vs ${avg(highGaps)}`);
});

test('hard mode costs more grip and gives no perfect refill', () => {
  const normal = new GripSystem(BALANCE, BALANCE.modes.normal);
  const hard = new GripSystem(BALANCE, BALANCE.modes.hard);
  const route = { gripCost: 6, inputs: 4, hazard: null };
  for (const r of [RESULT.PERFECT, RESULT.GOOD, RESULT.MISS]) assert.ok(hard.noteCost(route, r) > normal.noteCost(route, r));
  normal.set(50); hard.set(50);
  normal.applyComboEnd({ allPerfect: true }, true);
  hard.applyComboEnd({ allPerfect: true }, true);
  assert.ok(normal.value > 50);
  assert.equal(hard.value, 50);
  assert.ok(BALANCE.modes.summit.permadeath);
});

test('early Normal is harder: off-beats from 40 m, full ramp by 800 m', () => {
  assert.equal(difficultyAt(30).syncopation, 0);
  assert.ok(difficultyAt(60).syncopation > 0);
  assert.equal(difficultyAt(800).beatScale, BALANCE.ramp.beatScaleAtFull);
  assert.ok(Math.abs(difficultyAt(800).windowScale - BALANCE.ramp.windowScaleAtFull) < 1e-9);
});

test('perfect streaks unlock streak cosmetics and keep the best streak', () => {
  const store = new Map();
  const p = new ProgressionSystem({ getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) });
  assert.deepEqual(p.recordStreak(12), []);
  assert.ok(p.recordStreak(20).some((u) => u.id === 'hat-gold'));
  assert.ok(p.recordStreak(30).some((u) => u.id === 'jacket-blaze'));
  assert.deepEqual(p.recordStreak(25), []);
  assert.equal(p.data.bestStreak, 30);
  const ms = BALANCE.streak.milestones.map((m) => m.at);
  assert.deepEqual(ms, [10, 20, 30]);
});

test('tutorial: every lesson route targets a real hold above its start, lines fit the bubble', async () => {
  const { buildTutorialSteps, whenTexts } = await import('../src/data/tutorial.js');
  const { TutorialMountain } = await import('../src/systems/TutorialMountain.js');
  const { measureLine, hasGlyph } = await import('../src/utils/pixelFont.js');
  const { COACH } = await import('../src/ui/coachLayout.js');
  const m = new TutorialMountain();
  m.ensureLevel(120);
  const steps = buildTutorialSteps();
  const glyphs = (line) => { for (const ch of line) assert.ok(hasGlyph(ch), `font has no glyph for "${ch}" in: ${line}`); };
  for (const step of steps) {
    const startId = step.from || step.at;
    const start = m.findNode(startId);
    assert.ok(start, `start ${startId}`);
    for (const r of step.routes || []) {
      const t = m.findNode(r.to);
      assert.ok(t, `target ${r.to}`);
      assert.ok(t.level > start.level, `${startId} -> ${r.to} goes up`);
      assert.ok(r.notes.every((x) => ['L', 'U', 'R'].includes(x.dir)));
      const route = TutorialMountain.makeRoute(start, t, r);
      assert.equal(route.inputs, r.notes.length);
    }
    // Bram speaks in short bites: at most two lines that fit the bubble.
    const said = [...(step.say || []), step.combo, step.win, step.lose].filter(Boolean).map((l) => (typeof l === 'string' ? l : l.t));
    assert.ok((step.say || []).length <= 3, `${startId}: at most 3 lines per step`);
    for (const text of said) {
      const lines = text.split('\n');
      assert.ok(lines.length <= 2, `max 2 lines: ${text}`);
      lines.forEach((line) => { assert.ok(measureLine(line) <= COACH.textW, `too wide for the bubble: ${line}`); glyphs(line); });
    }
    for (const chip of [step.lesson, step.goal && `GOAL: ${step.goal.text}`, step.when && `IN REAL RUNS: ${step.when}`].filter(Boolean)) {
      assert.ok(measureLine(chip) <= COACH.w, `chip too wide: ${chip}`);
      glyphs(chip);
    }
  }
  // Lessons cover every feature, and the "when" texts follow the balance config.
  const lessons = steps.map((s) => s.lesson || '').join(' ');
  for (const word of ['BEAT', 'PERFECT', 'GRIP', 'JUGS', 'ROUTES', 'LEDGES', 'SLIPPING', 'STREAKS', 'OFF-BEAT', 'HOLD NOTES', 'LOOSE', 'ICE', 'CRUMBLING', 'WIND', 'BLIND', 'REAL MOUNTAIN', 'GEMS']) {
    assert.ok(lessons.includes(word), `lesson about ${word}`);
  }
  assert.ok(whenTexts().offbeat.includes(`${BALANCE.ramp.syncopation[0]} M`));
  // Special holds are where the lessons say they are.
  assert.equal(m.findNode('6:0').kind, 'jug');
  assert.equal(m.findNode('20:0').hazard, 'loose');
  assert.equal(m.findNode('22:0').hazard, 'icy');
  assert.equal(m.findNode('23:0').hazard, 'crumbling');
  assert.equal(m.findNode('30:0').kind, 'ledge');
  // After the crag the mountain continues normally.
  assert.ok(m.getLevel(100).nodes.length >= 0 && m.segments.size > 3);
});

test("Bram's tips: one or two lines that fit the bubble, and every tag tip exists", async () => {
  const { BRAM_TIPS, TAG_TIPS } = await import('../src/data/bramTips.js');
  const { measureLine, hasGlyph } = await import('../src/utils/pixelFont.js');
  const { COACH } = await import('../src/ui/coachLayout.js');
  for (const [id, text] of Object.entries(BRAM_TIPS)) {
    const lines = text.split('\n');
    assert.ok(lines.length <= 2, `${id}: max 2 lines`);
    for (const line of lines) {
      assert.ok(measureLine(line) <= COACH.textW, `${id} too wide: ${line}`);
      for (const ch of line) assert.ok(hasGlyph(ch), `${id}: no glyph for "${ch}"`);
    }
  }
  for (const id of Object.values(TAG_TIPS)) assert.ok(BRAM_TIPS[id], id);
});

test("Bram's logbook: stamps pay once, read the run and the lifetime counters", async () => {
  const { ProgressionSystem } = await import('../src/systems/ProgressionSystem.js');
  const { STAMPS, LOGBOOK_PAGES, stampProgress } = await import('../src/data/logbook.js');
  const { measureLine, hasGlyph } = await import('../src/utils/pixelFont.js');
  assert.equal(new Set(STAMPS.map((s) => s.id)).size, STAMPS.length);
  for (const s of STAMPS) {
    assert.ok(LOGBOOK_PAGES.some((p) => p.id === s.page), s.id);
    assert.ok(measureLine(s.text) <= 290, `${s.id} text too wide`);
    assert.ok(s.goal > 0 && typeof s.value === 'function', `${s.id} has a goal`);
    for (const ch of s.name + s.text) assert.ok(hasGlyph(ch), `${s.id}: no glyph for "${ch}"`);
  }
  const p = new ProgressionSystem({ getItem: () => null, setItem: () => {} });
  const run = { maxHeight: 130, mode: 'normal', bestStreak: 3, perfects: 0, flawless: 0, gems: 0, falls: 1, riskyRow: 0, whiteoutClimbs: 0, bare: false };
  const first = p.checkStamps(run).map((s) => s.id).sort();
  assert.deepEqual(first, ['first-pitch', 'stone-wall']);
  assert.equal(p.data.gems, 13);
  assert.deepEqual(p.checkStamps(run), []);
  for (let i = 0; i < 24; i++) p.bump('dodges');
  assert.deepEqual(p.checkStamps(null), []);
  const dodger = STAMPS.find((s) => s.id === 'rock-dodger');
  assert.deepEqual(stampProgress(dodger, p.data), { now: 24, goal: 25 });
  p.bump('dodges');
  assert.deepEqual(p.checkStamps(null).map((s) => s.id), ['rock-dodger']);
  // Per-run stamps remember the best run for the progress shown in the logbook.
  const groove = STAMPS.find((s) => s.id === 'metronome');
  p.checkStamps({ ...run, bestStreak: 12 });
  p.checkStamps({ ...run, bestStreak: 8 });
  assert.deepEqual(stampProgress(groove, p.data), { now: 12, goal: 30 });
});

test("expeditions: Bram's route is a climbable hand-built mountain with a summit", async () => {
  const { EXPEDITIONS } = await import('../src/data/expeditions.js');
  const { ExpeditionMountain, parseRhythm } = await import('../src/systems/ExpeditionMountain.js');
  const { measureLine, hasGlyph } = await import('../src/utils/pixelFont.js');
  const { levelToMeters } = await import('../src/config/gameConfig.js');
  const exp = EXPEDITIONS['brams-route'];
  const m = new ExpeditionMountain(exp);
  const summitM = levelToMeters(m.summitLevel);
  assert.ok(summitM >= 580 && summitM <= 640, `summit at ${summitM} m`);
  m.ensureLevel(m.summitLevel + 5);
  // Walk the line with SAFE routes only: every hold is reachable and routes go up.
  let node = m.getLevel(0).nodes[0];
  let ledges = 0, guard = 0;
  while (!node.summit && guard++ < 500) {
    const routes = m.computeRoutes(node);
    assert.ok(routes.length >= 1, `routes from ${node.id}`);
    for (const r of routes) {
      assert.ok(r.target.level > node.level, `${node.id} -> ${r.target.id} goes up`);
      assert.ok(r.notes.length >= 3 && r.notes.every((n) => 'LUR'.includes(n.dir)));
      const b = m.getLevel(r.target.level).bounds;
      assert.ok(r.target.x > b.l + 10 && r.target.x < b.r - 10, `${r.target.id} inside the wall`);
    }
    if (node.kind === 'ledge') assert.ok(routes[0].target.level - node.level >= 3, 'room above a ledge');
    node = routes[0].target;
    if (node.kind === 'ledge') ledges++;
  }
  assert.ok(node.summit, 'reached the summit');
  assert.equal(ledges, exp.pitches.length);
  // The risky route skips holds and never goes past a ledge.
  const r = m.computeRoutes(m.getLevel(0).nodes[0]);
  assert.deepEqual(r.map((x) => x.type), ['safe', 'normal', 'risky']);
  // Journal pages fit the paper and the font has every glyph.
  const pages = [...exp.pitches.filter((p) => p.page).map((p) => p.page), exp.summitPage];
  assert.equal(pages.length, exp.pitches.length);
  for (const page of pages) for (const line of page) {
    assert.ok(measureLine(line) <= 276, `too wide: ${line}`);
    for (const ch of line) assert.ok(hasGlyph(ch), `no glyph "${ch}" in ${line}`);
  }
  for (const p of exp.pitches) for (const bank of Object.values(p.rhythm)) bank.forEach((s) => parseRhythm(s));
});

test('expeditions: every expedition reaches its summit and its pages fit', async () => {
  const { EXPEDITIONS, EXPEDITION_ORDER } = await import('../src/data/expeditions.js');
  const { ExpeditionMountain, parseRhythm } = await import('../src/systems/ExpeditionMountain.js');
  const { measureLine, hasGlyph } = await import('../src/utils/pixelFont.js');
  const { BIOMES } = await import('../src/data/biomes.js');
  for (const id of EXPEDITION_ORDER) {
    const exp = EXPEDITIONS[id];
    if (exp.theme) assert.ok(BIOMES[exp.theme] && BIOMES[exp.theme].special, `${id} theme`);
    const m = new ExpeditionMountain(exp);
    m.ensureLevel(m.summitLevel + 5);
    let node = m.getLevel(0).nodes[0], guard = 0;
    while (!node.summit && guard++ < 500) {
      const routes = m.computeRoutes(node);
      assert.ok(routes.length >= 1, `${id}: routes from ${node.id}`);
      node = routes[0].target;
    }
    assert.ok(node.summit, `${id}: reached the summit`);
    const pages = [...exp.pitches.filter((p) => p.page).map((p) => p.page), exp.summitPage];
    for (const page of pages) for (const line of page) {
      assert.ok(measureLine(line) <= 276, `${id} too wide: ${line}`);
      for (const ch of line) assert.ok(hasGlyph(ch), `${id}: no glyph "${ch}" in ${line}`);
    }
    for (const p of exp.pitches) for (const bank of Object.values(p.rhythm)) bank.forEach((s) => parseRhythm(s));
  }
});

test('mirrored notes: shown flipped, judged on the direction you must press', () => {
  const c = new ComboSystem({ notes: [{ dir: 'R', mirror: true }], beatMs: 500, perfectMs: 90, goodMs: 180, leadInMs: 1000 });
  assert.equal(c.notes[0].mirror, true);
  assert.equal(c.press('R', 1000).judged.result, RESULT.PERFECT);
});

test('double notes need both arrows; one alone is a miss', () => {
  const mk = () => new ComboSystem({ notes: [{ dir: 'L', chord: 'R' }, { dir: 'U' }], beatMs: 500, perfectMs: 90, goodMs: 180, leadInMs: 1000 });
  const a = mk();
  assert.equal(a.press('R', 995).judged, null, 'first arrow waits for the second');
  assert.equal(a.press('L', 1010).judged.result, RESULT.PERFECT);
  const b = mk();
  b.press('L', 1000);
  const missed = b.update(1200);
  assert.equal(missed[0].reason, 'half');
  const w = mk();
  assert.equal(w.press('U', 1000).judged.reason, 'wrong');
});

test('rolls: tap the arrow again before the tail ends, or it is a miss', () => {
  const mk = () => new ComboSystem({ notes: [{ dir: 'U', roll: 3 }, { dir: 'L', gap: 1 }], beatMs: 400, perfectMs: 90, goodMs: 180, leadInMs: 1000, rollBeats: 1.5 });
  const a = mk();
  assert.equal(a.press('U', 1000).judged.result, RESULT.PERFECT);
  assert.ok(a.press('U', 1150).tap);
  assert.ok(a.press('U', 1300).tap);
  assert.ok(a.press('U', 1400).tap, 'extra taps are swallowed, never judged as the next note');
  const failed = [];
  assert.equal(a.updateHolds(1700, failed).length, 1);
  assert.equal(failed.length, 0);
  assert.equal(a.notes[1].time, 1000 + 600 + 400, 'the next note waits for the tail');
  const b = mk();
  b.press('U', 1000);
  b.press('U', 1200);
  const f2 = [];
  b.updateHolds(1700, f2);
  assert.equal(f2[0].reason, 'roll');
});

test('the high mountain keeps getting harder after the tempo tops out', () => {
  const at = (m) => difficultyAt(m);
  assert.equal(at(900).mirror, 0);
  assert.ok(at(1300).mirror > 0 && at(1300).chord > 0 && at(1300).roll === 0);
  assert.ok(at(2200).roll > at(1600).roll);
  assert.equal(at(1800).extraInputs, 3);
  assert.equal(at(2300).rollTaps, 4);
  // New notes really turn up on routes up there.
  const m = new Mountain(77);
  const tags = new Set();
  for (let l = 900; l < 1450; l += 3) {
    m.ensureLevel(l);
    const lv = m.getLevel(l);
    if (!lv || !lv.nodes.length) continue;
    m.computeRoutes(lv.nodes[0]).forEach((r) => r.tags.forEach((t) => tags.add(t)));
    m.prune(l - 40);
  }
  for (const t of ['MIRROR', 'DOUBLE', 'ROLL']) assert.ok(tags.has(t), `no ${t} routes found`);
});

test('still beats: freezing is perfect, pressing near the beat is a miss', () => {
  const mk = () => new ComboSystem({ notes: [{ dir: 'L' }, { dir: 'U', still: true }, { dir: 'R' }], beatMs: 500, perfectMs: 90, goodMs: 180, leadInMs: 1000 });
  const a = mk();
  a.press('L', 1000);
  // The next press comes on R's beat: the still beat passed untouched.
  const r = a.press('R', 2000);
  assert.equal(a.notes[1].result, RESULT.PERFECT);
  assert.equal(r.judged.result, RESULT.PERFECT, 'the press after a still beat is still judged');
  const b = mk();
  b.press('L', 1000);
  assert.equal(b.press('U', 1520).judged.reason, 'moved');
  const c = mk();
  c.press('L', 1000);
  assert.equal(c.press('R', 1220).judged, null, 'a press far from the still beat is ignored');
});
