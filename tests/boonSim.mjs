// Trail Boons balance check: how far players get holding one gift (or a set),
// taken at the run's first shrine. Uses the game's own boonEffects() numbers.
// Run: node tests/balanceSim.mjs --boons   (or node tests/boonSim.mjs [runs])
import { BALANCE } from '../src/config/balanceConfig.js';
import { Mountain } from '../src/systems/SegmentGenerator.js';
import { ComboSystem, timingWindows } from '../src/systems/ComboSystem.js';
import { GripSystem } from '../src/systems/GripSystem.js';
import { biomeAt, biomeStretchAt } from '../src/data/biomes.js';
import { WHITEOUT } from '../src/systems/mechanics/Whiteout.js';
import { ROCKFALL } from '../src/systems/mechanics/Rockfall.js';
import { addThermal, THERMALS } from '../src/systems/mechanics/Thermals.js';
import { STORM } from '../src/systems/mechanics/Storm.js';
import { applySwing } from '../src/systems/mechanics/Swing.js';
import { DRAGON_EYE } from '../src/systems/mechanics/DragonEye.js';
import { SeededRandom } from '../src/utils/seededRandom.js';
import { GEMS } from '../src/data/gems.js';
import { BOONS, boonEffects, shrinePlan, stretchIndexAt } from '../src/data/boons.js';
import { difficultyAt } from '../src/systems/DifficultySystem.js';

const W = WHITEOUT, D = DRAGON_EYE;
const share = (m) => m.stormSec / ((m.calmSec[0] + m.calmSec[1]) / 2 + m.warnSec + m.stormSec + m.clearSec);
const WHITE_SHARE = share(W), THUNDER_SHARE = share(STORM);
const WATCH_SHARE = D.watchSec / ((D.sleepSec[0] + D.sleepSec[1]) / 2 + D.openSec + D.watchSec + D.closeSec);
const BREATH_PER_MOVE = Math.min(1, 5 / ((D.breathSec[0] + D.breathSec[1]) / 2));
const ROCK_PER_MOVE = 5 / ((ROCKFALL.calmSec[0] + ROCKFALL.calmSec[1]) / 2);
const gauss = () => Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(2 * Math.PI * Math.random());

export function simulateBoons({ sd: sd0, wrong: wrong0, decide = 2 }, seed, held = []) {
  const fxOn = boonEffects(held), fxOff = boonEffects([]);
  const m = new Mountain(seed, BALANCE, 'normal');
  const mode = BALANCE.modes.normal;
  const grip = new GripSystem(BALANCE, mode);
  const shrineAt = shrinePlan(seed)[0].from;
  let node = (m.ensureLevel(10), m.getLevel(0).nodes[0]);
  let checkpoint = node, best = 0, moves = 0, gems = 0, streak = 0, clean = 0, phoenix = true;
  const mrng = new SeededRandom(seed * 7 + 1);
  const falls = {}, flask = {}, rope = {};
  let on = false, fx = fxOff;
  const apply = () => {
    grip.max = fx.maxGrip; grip.graceSec = fx.hangGraceSec; grip.looseMul = fx.looseMissMultiplier;
    grip.goodFactor = fx.goodCostFactor; grip.noFlawless = fx.noFlawlessBonus;
  };
  const refill = () => { grip.restoreFull(); grip.set(grip.max * fx.ledgeFill); };
  while (moves++ < 900) {
    m.ensureLevel(node.level + 80);
    const h = node.level * 1.5;
    if (!on && h >= shrineAt) { on = true; fx = fxOn; apply(); }
    // SONGBIRD: the bird calls each arrow, fewer wrong presses; STEADY PACE: a calmer beat.
    const sd = sd0 * (fx.beatScale > 1 ? 0.95 : 1) * (fx.songbird ? 1.05 : 1);
    const wrong = wrong0 * (fx.songbird ? 0.5 : 1);
    if (node.kind === 'ledge') { refill(); checkpoint = node; }
    let routes = m.computeRoutes(node);
    const biome = biomeAt(h);
    if (biome.mechanic === 'thermals') addThermal(routes, m, mrng);
    else if (fx.thermalsEverywhere) addThermal(routes, m, mrng, { ...THERMALS, chance: THERMALS.chance * fx.thermalsEverywhere });
    if (biome.mechanic === 'rockfall' && node.kind !== 'ledge' && Math.random() < ROCK_PER_MOVE) {
      for (let k = 0; k < (h >= ROCKFALL.doubleFrom ? 2 : 1); k++) if (!(Math.abs(gauss() * sd) <= ROCKFALL.goodMs && Math.random() > wrong)) grip.change(-ROCKFALL.hitGrip);
    }
    const thunder = biome.mechanic === 'storm' && node.kind !== 'ledge' && Math.random() < THUNDER_SHARE;
    grip.hang(decide, { drainMultiplier: thunder ? STORM.hangScale : 1, onJug: node.kind === 'jug', noGrace: thunder });
    const stretch = biomeStretchAt(h);
    if (fx.flask && node.kind !== 'ledge' && grip.value < 40 && !flask[stretch]) { flask[stretch] = true; grip.change(fx.flask === 'full' ? grip.max : 30); }
    if (biome.mechanic === 'swing') routes.forEach((rt) => { rt.notes = rt.notes.map((n) => ({ ...n })); applySwing(rt.notes); });
    if (biome.mechanic === 'dragonEye' && node.kind !== 'ledge' && Math.random() < WATCH_SHARE * BREATH_PER_MOVE) {
      for (let k = 0; k < (h >= D.doubleFrom ? 2 : 1); k++) if (!(Math.abs(gauss() * sd) <= D.goodMs && Math.random() > wrong)) grip.change(-D.breathGrip);
    }
    if (fx.noSafe && routes.some((r) => r.type !== 'safe')) routes = routes.filter((r) => r.type !== 'safe');
    routes.forEach((r) => { if (r.type === 'risky') r.gripCost *= fx.riskyCostScale; });
    if (fx.gustScale > 1) {
      const extra = difficultyAt(h).gust * (fx.gustScale - 1) * 0.6;
      routes.forEach((r) => { if (r.notes.length >= 3 && Math.random() < extra) { const i = 1 + Math.floor(Math.random() * (r.notes.length - 2)); r.notes = r.notes.map((n, k) => (k === i || k === i + 1 ? { ...n, gust: true } : n)); } });
    }
    const want = grip.value > grip.max * 0.65 ? 'risky' : grip.value > 35 ? 'normal' : 'safe';
    const route = routes.find((r) => r.type === want) || routes.find((r) => r.type === 'normal') || routes[0];
    if (node.hazard === 'crumbling' && decide * 1000 > mode.crumbleMs) grip.set(0);
    const whiteout = biome.mechanic === 'whiteout' && Math.random() < WHITE_SHARE;
    const dark = biome.mechanic === 'darkness';
    const cat = fx.minNoteAlpha > 0;
    let windowScale = route.windowScale;
    if (fx.icyEasy && route.hazard === 'icy') windowScale /= BALANCE.hazards.icy.windowScale;
    const w = timingWindows(BALANCE, { windowScale });
    const r = BALANCE.ramp;
    const c = new ComboSystem({ notes: route.notes, beatMs: route.beatMs * fx.beatScale, ...w, leadInMs: 900, minGapMs: r.minGapMs, gustWindowScale: r.gustWindowScale, rollBeats: r.rollBeats, chordSpreadMs: r.chordSpreadMs });
    let empty = grip.isEmpty;
    const judge = (x) => {
      grip.applyNote(route, x.result);
      if (x.result === 'miss') grip.change(-fx.missExtraCost);
      if (x.holdMs) grip.change(-fx.holdExtraCost);
      if (x.result === 'perfect' && x.gap !== 1 && fx.offbeatPerfectGrip) grip.change(fx.offbeatPerfectGrip);
      if (x.thermal && x.result !== 'perfect') grip.change(-fx.thermalMissCost);
      if (x.result === 'perfect') {
        const prev = streak;
        streak += fx.streakPerPerfect * (route.hazard === 'icy' ? fx.icyStreak : 1);
        for (const ms of BALANCE.streak.milestones) if (prev < ms.at && streak >= ms.at) grip.change(ms.grip);
      } else streak = 0;
    };
    for (const n of c.notes) {
      if (empty) break;
      if (n.still) { if (Math.random() < 0.1 + sd / 1000) { const rs = c.press('U', n.time + gauss() * 40); if (rs.judged) { judge({ result: 'miss' }); grip.change(-D.snapGrip); } } continue; }
      const hiddenMul = n.hidden && !whiteout && !dark ? (cat ? 1.15 : fx.songbird ? 1 : 1.35) : 1;
      const spread = sd * hiddenMul * (whiteout ? (cat ? 1.07 : 1.15) : 1) * (dark ? (cat ? 1.06 : 1.12) : 1) * (route.tags.includes('OFFBEAT') ? 1.1 : 1) * (route.swing ? 1.1 : 1) * (n.chord ? 1.15 : 1);
      const dir = Math.random() < wrong * (n.mirror ? 3 : 1) ? (n.dir === 'L' ? 'R' : 'L') : n.dir;
      const at = n.time + gauss() * spread;
      const res = c.press(dir, at);
      const judged = [...res.auto, res.judged];
      if (n.chord && !n.result) { const r2 = c.press(n.chord, at + Math.abs(gauss() * 30)); judged.push(...r2.auto, r2.judged); }
      if (n.roll && n.holding) for (let k = 1; k < n.roll; k++) c.press(n.dir, at + k * (110 + Math.abs(gauss() * sd * 1.5)));
      if (n.roll) { const failed = []; c.updateHolds(n.time + n.rollMs + 1, failed); judged.push(...failed); }
      judged.filter((x) => x && !x.still).forEach(judge);
      if (res.judged && res.judged.holding && Math.random() < wrong * 2) { c.release(n.dir, n.time + 50); judge({ result: 'miss' }); }
      if (grip.isEmpty) { empty = true; break; }
    }
    const s = c.summary();
    if (!empty) {
      const ok = s.miss <= BALANCE.combo.maxMissesForSuccess;
      grip.applyComboEnd(s, ok);
      if (ok) {
        const gem = m.routeGem(route, fx.gemOnEveryRoute ? 1000 : 1);
        if (gem) { m.takeGem(gem); gems += GEMS[gem.type].value * fx.gemScale; }
        node = route.target;
        const thermal = route.thermal && c.notes[route.thermal.note].result === 'perfect';
        if (thermal) node = route.thermal.to;
        clean = s.miss ? 0 : clean + (thermal && fx.tailwind ? 2 : 1);
        if (fx.featherEvery && !thermal && clean >= fx.featherEvery && node.kind !== 'ledge' && m.nextLedgeAbove(node.level, 1) === null) {
          clean = 0;
          const up = m.getLevel(node.level + 1);
          const to = up && up.nodes.find((x) => x.kind !== 'ledge');
          if (to) node = to;
        }
      } else clean = 0;
      if (grip.isEmpty) empty = true;
    }
    if (empty) {
      streak = 0; clean = 0;
      const caught = Math.abs(gauss() * sd) <= BALANCE.slip.goodMs && Math.random() > wrong;
      const k = biomeStretchAt(node.level * 1.5);
      if (falls[k]) {
        const group = Math.floor(stretchIndexAt(Number(k.split('@')[1])) / 3);
        if (fx.secondRope && !rope[group]) rope[group] = true;
        else if (fx.phoenix && phoenix) { phoenix = false; fx = fxOff; apply(); node = checkpoint; refill(); continue; }
        else break;
      }
      falls[k] = 1;
      if (caught) { const lv = m.catchLevelBelow(node.level - 2, checkpoint.level); node = lv === null ? checkpoint : m.getLevel(lv).nodes[0]; grip.set(BALANCE.grip.afterRecovery); }
      else { gems *= 1 - fx.fallGemLoss; node = checkpoint; refill(); }
    }
    best = Math.max(best, node.level * 1.5);
  }
  return { best, gems };
}

export const PLAYERS = { expert: { sd: 45, wrong: 0.01 }, good: { sd: 75, wrong: 0.03 }, average: { sd: 110, wrong: 0.05 }, novice: { sd: 150, wrong: 0.08 } };

export function runBoonSim(runs = 200) {
  const sets = [[], ...BOONS.map((b) => [b.id]), ['ironnerve', 'flask', 'secondrope'], ['deepbreath', 'flask', 'ironnerve'], ['gambler', 'magpie', 'echo']];
  const base = {};
  console.log(`--- TRAIL BOONS (NORMAL, ${runs} runs each, gift taken at the first shrine): best height vs no gifts`);
  console.log('gifts'.padEnd(30) + Object.keys(PLAYERS).map((p) => p.padStart(15)).join(''));
  for (const set of sets) {
    const cells = Object.entries(PLAYERS).map(([name, p]) => {
      let sum = 0;
      for (let i = 0; i < runs; i++) sum += simulateBoons(p, 3000 + i, set).best;
      const avg = sum / runs;
      if (!set.length) base[name] = avg;
      const d = set.length ? ` ${avg >= base[name] ? '+' : ''}${Math.round(100 * (avg / base[name] - 1))}%` : '';
      return `${Math.round(avg)}m${d}`.padStart(15);
    });
    console.log((set.join('+') || 'none').padEnd(30) + cells.join(''));
  }
}

if ((process.argv[1] || "").endsWith("boonSim.mjs")) runBoonSim(Number(process.argv[2]) || 200);
