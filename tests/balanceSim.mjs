// Monte-Carlo balance check: how far do players of different skill get?
// Run: node tests/balanceSim.mjs
import { BALANCE } from '../src/config/balanceConfig.js';
import { Mountain } from '../src/systems/SegmentGenerator.js';
import { ComboSystem, timingWindows } from '../src/systems/ComboSystem.js';
import { GripSystem } from '../src/systems/GripSystem.js';
import { biomeAt, biomeStretchAt } from '../src/data/biomes.js';
import { WHITEOUT } from '../src/systems/mechanics/Whiteout.js';
import { ROCKFALL } from '../src/systems/mechanics/Rockfall.js';
import { addThermal } from '../src/systems/mechanics/Thermals.js';
import { STORM } from '../src/systems/mechanics/Storm.js';
import { applySwing } from '../src/systems/mechanics/Swing.js';
import { DRAGON_EYE } from '../src/systems/mechanics/DragonEye.js';

import { SeededRandom } from '../src/utils/seededRandom.js';
import { GEMS } from '../src/data/gems.js';
import { GEM_INCOME, GEAR, PERKS } from '../src/data/shop.js';
import { LIFTS } from '../src/data/lifts.js';
import { COSMETICS } from '../src/data/cosmetics.js';
import { MASTERY_BIOMES, masteryGoals } from '../src/data/mastery.js';

// Share of time a whiteout is raging while you climb in the Frozen Reach.
const W = WHITEOUT;
const STORM_SHARE = W.stormSec / ((W.calmSec[0] + W.calmSec[1]) / 2 + W.warnSec + W.stormSec + W.clearSec);
const NO_MECHANICS = process.argv.includes('--no-mechanics');
// Share of time a storm rages on the Storm Crown, and the dragon is awake.
const THUNDER_SHARE = STORM.stormSec / ((STORM.calmSec[0] + STORM.calmSec[1]) / 2 + STORM.warnSec + STORM.stormSec + STORM.clearSec);
const D = DRAGON_EYE;
const WATCH_SHARE = D.watchSec / ((D.sleepSec[0] + D.sleepSec[1]) / 2 + D.openSec + D.watchSec + D.closeSec);
const BREATH_PER_MOVE = Math.min(1, 5 / ((D.breathSec[0] + D.breathSec[1]) / 2));
// --classic: without the high mountain's new notes, to compare against.
if (process.argv.includes('--classic')) Object.assign(BALANCE.ramp, { mirror: null, chord: null, roll: null, extraInputs: BALANCE.ramp.extraInputs.slice(0, 2) });
const MAX_MOVES = Number((process.argv.find((a) => a.startsWith('--moves=')) || '--moves=900').slice(8));
// A move takes roughly 5 s, so this is the chance a rockfall greets a new hold.
const ROCK_PER_MOVE = 5 / ((ROCKFALL.calmSec[0] + ROCKFALL.calmSec[1]) / 2);

function gauss() { return Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(2 * Math.PI * Math.random()); }

function simulate({ sd, wrong, decide = 2 }, seed, mode = 'normal', maxMoves = MAX_MOVES) {
  const m = new Mountain(seed, BALANCE, mode);
  const modeCfg = BALANCE.modes[mode];
  const grip = new GripSystem(BALANCE, modeCfg);
  let node = m.getLevel(0) ? m.getLevel(0).nodes[0] : (m.ensureLevel(10), m.getLevel(0).nodes[0]);
  let checkpoint = node, best = 0, slips = 0, falls = 0, moves = 0;
  // Economy (--economy): gems earned in the run and progress per biome pass.
  let gems = 0, streak = 0, pass = null;
  const passes = {};
  const stars = {};
  const star = (biome, kind) => { (stars[biome] || (stars[biome] = new Set())).add(kind); };
  const enterPass = (h) => {
    const key = biomeStretchAt(h);
    if (pass && pass.key === key) return;
    const from = Number(key.split('@')[1]);
    const next = !!pass && biomeStretchAt(from - 0.01) === pass.key;
    if (next && pass.full && !pass.slipped) star(pass.biome, 'flawless');
    if (pass) pass.run = 0;
    pass = passes[key] || (passes[key] = { key, biome: biomeAt(h).id, full: pass ? next : from === 0, slipped: false, perfects: 0, run: 0, streak: 0, gems: 0 });
  };
  const goal = (kind) => { const g = MASTERY_BIOMES.includes(pass.biome) && masteryGoals(pass.biome); if (g && pass[kind] >= g[kind]) star(pass.biome, kind); };
  const onResult = (res) => {
    if (res === 'perfect') {
      streak++; pass.perfects++;
      pass.run++; pass.streak = Math.max(pass.streak, pass.run); goal('streak');
      const ms = BALANCE.streak.milestones.find((x) => x.at === streak);
      const last = BALANCE.streak.milestones[BALANCE.streak.milestones.length - 1].at;
      if (ms || (streak > last && (streak - last) % BALANCE.streak.every === 0)) gems += GEM_INCOME.streak[streak] || GEM_INCOME.streak.later;
    } else { streak = 0; pass.run = 0; }
  };
  enterPass(0);
  const mrng = new SeededRandom(seed * 7 + 1);
  // One free fall per biome; a second fall in the same biome ends the run.
  const biomeFalls = {};
  const RULE = !process.argv.includes('--old-falls');
  while (moves++ < maxMoves) {
    m.ensureLevel(node.level + 80);
    if (node.kind === 'ledge') { grip.restoreFull(); checkpoint = node; }
    const routes = m.computeRoutes(node);
    const biome = biomeAt(node.level * 1.5);
    if (!NO_MECHANICS && biome.mechanic === 'thermals') addThermal(routes, m, mrng);
    // Rockfall: dodge one or two rocks; each hit costs grip.
    if (!NO_MECHANICS && biome.mechanic === 'rockfall' && node.kind !== 'ledge' && Math.random() < ROCK_PER_MOVE) {
      const n = node.level * 1.5 >= ROCKFALL.doubleFrom ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const dodged = Math.abs(gauss() * sd) <= ROCKFALL.goodMs * modeCfg.catchScale && Math.random() > wrong;
        if (!dodged) grip.change(-ROCKFALL.hitGrip * modeCfg.costScale);
      }
    }
    const thunder = !NO_MECHANICS && biome.mechanic === 'storm' && node.kind !== 'ledge' && Math.random() < THUNDER_SHARE;
    grip.hang(decide, { drainMultiplier: thunder ? STORM.hangScale : 1, onJug: node.kind === 'jug', noGrace: thunder });
    if (!NO_MECHANICS && biome.mechanic === 'swing') routes.forEach((rt) => { rt.notes = rt.notes.map((n) => ({ ...n })); applySwing(rt.notes); });
    // Dragon fire: while it watches, most new holds bring a breath to dodge.
    if (!NO_MECHANICS && biome.mechanic === 'dragonEye' && node.kind !== 'ledge' && Math.random() < WATCH_SHARE * BREATH_PER_MOVE) {
      const n = node.level * 1.5 >= D.doubleFrom ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const dodged = Math.abs(gauss() * sd) <= D.goodMs * modeCfg.catchScale && Math.random() > wrong;
        if (!dodged) grip.change(-D.breathGrip * modeCfg.costScale);
      }
    }
    let want = grip.value > 65 ? 'risky' : grip.value > 35 ? 'normal' : 'safe';
    const route = routes.find((r) => r.type === want) || routes[0];
    // Prism light: about one climb in three starts on the lit route and pays no note grip.
    const lit = !NO_MECHANICS && biome.mechanic === 'prismLight' && mrng.next() < 0.33;
    if (node.hazard === 'crumbling' && decide * 1000 > modeCfg.crumbleMs) { grip.set(0); }
    // Whiteout: notes appear late (read less accurately) but blind notes stay visible.
    const whiteout = !NO_MECHANICS && biome.mechanic === 'whiteout' && Math.random() < STORM_SHARE;
    // Darkness: notes only flash on the beat.
    const dark = !NO_MECHANICS && biome.mechanic === 'darkness';
    const w = timingWindows(BALANCE, { windowScale: route.windowScale });
    const r = BALANCE.ramp;
    const c = new ComboSystem({ notes: route.notes, beatMs: route.beatMs, ...w, leadInMs: 900, minGapMs: r.minGapMs, gustWindowScale: r.gustWindowScale, rollBeats: r.rollBeats, chordSpreadMs: r.chordSpreadMs });
    let empty = grip.isEmpty;
    for (const n of c.notes) {
      if (empty) break;
      // A still beat: the player presses on it by reflex now and then.
      if (n.still) {
        if (Math.random() < 0.1 + sd / 1000) { const rs = c.press('U', n.time + gauss() * 40); if (rs.judged) { grip.applyNote(route, 'miss'); grip.change(-D.snapGrip); } }
        continue;
      }
      // Blind notes and off-beats are read less accurately.
      const spread = sd * (n.hidden && !whiteout && !dark ? 1.35 : 1) * (whiteout ? 1.15 : 1) * (dark ? 1.12 : 1) * (route.tags.includes('OFFBEAT') ? 1.1 : 1) * (route.swing ? 1.1 : 1) * (n.chord ? 1.15 : 1);
      // Mirrored arrows fool players far more often than plain ones.
      const dir = Math.random() < wrong * (n.mirror ? 3 : 1) ? (n.dir === 'L' ? 'R' : 'L') : n.dir;
      const at = n.time + gauss() * spread;
      const judged = [];
      const res = c.press(dir, at);
      judged.push(...res.auto, res.judged);
      if (n.chord && !n.result) { const r2 = c.press(n.chord, at + Math.abs(gauss() * 30)); judged.push(...r2.auto, r2.judged); }
      // A roll: the taps land with a gap that grows with the player's sloppiness.
      if (n.roll && n.holding) for (let k = 1; k < n.roll; k++) c.press(n.dir, at + k * (110 + Math.abs(gauss() * sd * 1.5)));
      if (n.roll) { const failed = []; c.updateHolds(n.time + n.rollMs + 1, failed); judged.push(...failed); }
      judged.filter((x) => x && !x.still).forEach((x) => {
        if (!lit || x.result === 'miss') grip.applyNote(route, x.result);
        onResult(x.result);
      });
      if (res.judged && res.judged.holding && Math.random() < wrong * 2) { c.release(n.dir, n.time + 50); grip.applyNote(route, 'miss'); }
      if (grip.isEmpty) { empty = true; break; }
    }
    const s = c.summary();
    if (!empty) {
      const ok = s.miss <= BALANCE.combo.maxMissesForSuccess;
      grip.applyComboEnd(s, ok);
      if (ok) {
        const gem = m.routeGem(route);
        if (gem) { m.takeGem(gem); gems += GEMS[gem.type].value; if (GEMS[gem.type].biome === pass.biome) { pass.gems++; goal('gems'); } }
        node = route.target;
      }
      if (ok && route.thermal && c.notes[route.thermal.note].result === 'perfect') node = route.thermal.to;
      if (grip.isEmpty) empty = true;
    }
    if (empty) {
      slips++;
      streak = 0;
      pass.run = 0;
      pass.slipped = true;
      const rec = Math.abs(gauss() * sd) <= BALANCE.slip.goodMs * modeCfg.catchScale && Math.random() > wrong;
      if (modeCfg.permadeath && !rec) { falls++; break; }
      if (RULE && !rec) {
        const k = biomeStretchAt(node.level * 1.5);
        biomeFalls[k] = (biomeFalls[k] || 0) + 1;
        if (biomeFalls[k] >= 2) { falls++; break; }
      }
      if (rec) {
        const lv = m.catchLevelBelow(node.level - 2, checkpoint.level);
        node = lv === null ? checkpoint : m.getLevel(lv).nodes[0];
        grip.set(BALANCE.grip.afterRecovery);
      } else { falls++; node = checkpoint; grip.restoreFull(); }
    }
    best = Math.max(best, node.level * 1.5);
    enterPass(node.level * 1.5);
  }
  gems += Math.floor(best / GEM_INCOME.heightEvery);
  return { best, slips, falls, gems, stars, passes, moves };
}

const ECONOMY = process.argv.includes('--economy');
const players = { expert: { sd: 45, wrong: 0.01 }, good: { sd: 75, wrong: 0.03 }, average: { sd: 110, wrong: 0.05 }, novice: { sd: 150, wrong: 0.08 } };
if (ECONOMY) {
  // Gems per Normal run, and how often a run earns each mastery star.
  const RUNS = 40;
  const income = {}, perHour = {};
  console.log('--- ECONOMY (NORMAL, one run, no gear)');
  for (const [name, p] of Object.entries(players)) {
    const runs = Array.from({ length: RUNS }, (_, i) => simulate(p, 2000 + i, 'normal'));
    const avg = (f) => runs.reduce((a, r) => a + f(r), 0) / runs.length;
    // A move (decide, climb the notes) takes about five seconds.
    const minutes = avg((r) => r.moves) * 5 / 60;
    console.log(`${name.padEnd(8)} best ${avg((r) => r.best).toFixed(0).padStart(5)} m   gems/run ${avg((r) => r.gems).toFixed(0).padStart(4)}   run ~${minutes.toFixed(0)} min   gems/hour ${(avg((r) => r.gems) / minutes * 60).toFixed(0)}`);
    perHour[name] = avg((r) => r.gems) / minutes * 60;
    const line = MASTERY_BIOMES.map((b) => {
      const pct = (k) => Math.round((100 * runs.filter((r) => r.stars[b] && r.stars[b].has(k)).length) / RUNS);
      return `${b.slice(0, 5)} ${pct('flawless')}/${pct('streak')}/${pct('gems')}`;
    }).filter((x) => !/ 0\/0\/0$/.test(x));
    console.log(`         stars % (flawless/streak/gems): ${line.join('  ')}`);
    if (process.argv.includes('--passes')) {
      // Median best perfect streak and gems in a full pass through each biome.
      const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : '-'; };
      const rows = MASTERY_BIOMES.map((b) => {
        const ps = runs.flatMap((r) => Object.values(r.passes).filter((q) => q.biome === b && q.full));
        return ps.length >= RUNS / 4 ? `${b.slice(0, 5)} ${med(ps.map((q) => q.streak))}s ${med(ps.map((q) => q.gems))}g` : null;
      }).filter(Boolean);
      console.log(`         median pass: ${rows.join('  ')}`);
    }
    income[name] = avg((r) => r.gems);
  }
  // What things cost in runs for each player (gems per run from above).
  const all = Object.values(COSMETICS).flat().filter((c) => c.requirement && c.requirement.price && !c.requirement.season);
  const prices = all.map((c) => c.requirement.price).sort((a, b) => a - b);
  const items = [
    ...GEAR.map((g) => [`gear ${g.id}`, g.price]),
    ...PERKS.map((q) => [`perk ${q.id}`, q.price]),
    ['cosmetic cheapest', prices[0]], ['cosmetic median', prices[Math.floor(prices.length / 2)]], ['cosmetic dearest', prices[prices.length - 1]],
    ['all cosmetics', prices.reduce((a, b) => a + b, 0)],
    ...LIFTS.map((l) => [`ticket ${l.id}`, l.price]),
  ];
  console.log('--- RUNS TO BUY (price / gems per run), then HOURS OF PLAY');
  console.log(`${''.padEnd(22)}${Object.keys(players).map((n) => n.padStart(9)).join('')}`);
  for (const [label, price] of items) console.log(`${`${label} ◆${price}`.padEnd(22)}${Object.keys(players).map((n) => (price / Math.max(1, income[n])).toFixed(1).padStart(9)).join('')}   ${Object.keys(players).map((n) => `${(price / perHour[n]).toFixed(1)}h`.padStart(7)).join('')}`);
  process.exit(0);
}
for (const mode of ['normal', 'hard', 'summit']) {
  console.log(`--- ${mode.toUpperCase()} (${MAX_MOVES} moves max)`);
  for (const [name, p] of Object.entries(players)) {
    const runs = Array.from({ length: 30 }, (_, i) => simulate(p, 1000 + i, mode));
    const avg = (k) => (runs.reduce((a, r) => a + r[k], 0) / runs.length).toFixed(0);
    console.log(`${name.padEnd(8)} best ${avg('best').padStart(5)} m   slips ${avg('slips').padStart(3)}   falls ${avg('falls').padStart(3)}`);
  }
}
