import test from 'node:test';
import assert from 'node:assert/strict';
import { THIN_AIR, TIER_RULES, thinAirConfig, thinAirTop, activeThinAir, mountainMode } from '../src/data/thinAir.js';
import { BALANCE } from '../src/config/balanceConfig.js';
import { difficultyAt } from '../src/systems/DifficultySystem.js';
import { GripSystem } from '../src/systems/GripSystem.js';
import { ensureRequests, checkRequests, collectRequests, REQUESTS, ACTIVE } from '../src/data/requests.js';
import { bramGreeting } from '../src/data/bramTalk.js';

const save = (over = {}) => ({ runs: 3, bestByMode: { normal: 0, hard: 0, summit: 0 }, counters: {}, settings: { mode: 'normal', dares: [], thinAir: 0 }, ...over });

test('thin air: locked until the dragon, then one tier at a time', () => {
  assert.equal(thinAirTop(save()), 0);
  assert.equal(thinAirTop(save({ bestByMode: { normal: THIN_AIR.unlockAt } })), 1);
  assert.equal(thinAirTop(save({ bestByMode: { normal: 2000 }, thinAirBest: { 1: THIN_AIR.nextAt, 2: 500 } })), 2);
  assert.equal(thinAirTop(save({ bestByMode: { normal: 2000 }, thinAirBest: Object.fromEntries([...Array(10)].map((_, i) => [i + 1, 900])) })), 10);
});

test('thin air: never above what is open, never with dares or outside Normal', () => {
  const d = save({ bestByMode: { normal: 1800 }, settings: { mode: 'normal', dares: [], thinAir: 5 } });
  assert.equal(activeThinAir(d), 1);
  d.settings.dares = ['night'];
  assert.equal(activeThinAir(d), 0);
  d.settings.dares = [];
  d.settings.mode = 'hard';
  assert.equal(activeThinAir(d), 0);
  assert.equal(mountainMode(d), 'hard');
});

test('thin air: every tier is harder than the one below, and stacks', () => {
  assert.equal(TIER_RULES.length, THIN_AIR.tiers);
  const n = BALANCE.modes.normal;
  const t10 = thinAirConfig(10);
  assert.ok(t10.drainScale > n.drainScale && t10.windowScale < n.windowScale && t10.rampSpeed > n.rampSpeed);
  assert.ok(t10.perfectCostFactor > n.perfectCostFactor && t10.noStreakGrip && t10.tempo < 1 && t10.ledgeFill < 1);
  // The base mode is never changed by building a tier.
  assert.equal(BALANCE.modes.normal.drainScale, n.drainScale);
  // Difficulty and grip read the tier config.
  assert.ok(difficultyAt(600, thinAirConfig(3)).windowScale < difficultyAt(600, 'normal').windowScale);
  assert.equal(difficultyAt(400, thinAirConfig(9)).extraInputs, difficultyAt(400, 'normal').extraInputs + 1);
  const route = { gripCost: 6, inputs: 4 };
  assert.ok(new GripSystem(BALANCE, thinAirConfig(4)).noteCost(route, 'miss') > new GripSystem(BALANCE, n).noteCost(route, 'miss'));
});

test('requests: three notes, finished on the mountain, paid at the board', () => {
  const d = save({ bestByMode: { normal: 900 } });
  const st = ensureRequests(d);
  assert.equal(st.active.length, ACTIVE);
  assert.equal(new Set(st.active.map((n) => n.id)).size, ACTIVE);
  // A run that does everything a run can do finishes the run-based notes.
  const run = { maxHeight: 5000, bestStreak: 99, flawless: 99, perfects: 999, riskyBest: 9, dodges: 9, gems: 9999, slips: 0, whiteoutClimbs: 9, finds: ['A', 'B', 'OLD ICE AXE'], stones: Object.fromEntries(['emerald', 'amber', 'sapphire', 'opal', 'honeystone', 'ruby', 'diamond', 'topaz'].map((g) => [g, 9])) };
  d.counters = { greatCatches: 9, thermals: 9, prisms: 9, nightPhotos: 9, dragonPhotos: 9, goatFriends: 9, wishes: 9, darkLedges: 9 };
  const done = checkRequests(d, run);
  assert.equal(done.length, ACTIVE);
  assert.equal(checkRequests(d, run).length, 0, 'announced once');
  const paid = collectRequests(d);
  assert.equal(paid.length, ACTIVE);
  assert.ok(paid.every((p) => p.gems > 0));
  assert.equal(ensureRequests(d).active.length, ACTIVE);
});

test('requests: counters only count from when the note was pinned', () => {
  const d = save({ bestByMode: { normal: 100 }, counters: { wishes: 5 } });
  d.requests = { active: [], storyDone: [], serial: 0, paid: 0 };
  ensureRequests(d);
  d.requests.active = d.requests.active.slice(0, 0);
  const note = { id: 'noor-wish', goal: 1, gems: 30, base: { wishes: 5 }, best: 0, done: false };
  d.requests.active.push(note);
  assert.equal(checkRequests(d, {}).length, 0);
  d.counters.wishes = 6;
  assert.equal(checkRequests(d, {}).length, 1);
});

test('requests: story notes are done once, and every note can be made', () => {
  for (const r of REQUESTS) {
    const made = r.make(save({ bestByMode: { normal: 2500 } }), 1);
    assert.ok(made.goal > 0 && made.gems > 0 && made.text, r.id);
  }
  const d = save({ bestByMode: { normal: 2500 } });
  d.requests = { active: [], storyDone: REQUESTS.filter((r) => r.story).map((r) => r.id), serial: 0, paid: 0 };
  assert.ok(ensureRequests(d).active.every((n) => !REQUESTS.find((r) => r.id === n.id).story));
});

test("bram's greeting knows the last run", () => {
  assert.match(bramGreeting({ runs: 0 }).text, /FIRST TIME/);
  assert.match(bramGreeting({ runs: 4, bestByMode: { normal: 900 }, lastRun: { reached: 900, record: true } }).text, /900/);
  assert.ok(bramGreeting({ runs: 9, bestByMode: { normal: 900 }, lastRun: { reached: 12 } }).text.length < 50);
});
