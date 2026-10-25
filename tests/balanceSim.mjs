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

import { SeededRandom } from '../src/utils/seededRandom.js';

// Share of time a whiteout is raging while you climb in the Frozen Reach.
const W = WHITEOUT;
const STORM_SHARE = W.stormSec / ((W.calmSec[0] + W.calmSec[1]) / 2 + W.warnSec + W.stormSec + W.clearSec);
const NO_MECHANICS = process.argv.includes('--no-mechanics');
// A move takes roughly 5 s, so this is the chance a rockfall greets a new hold.
const ROCK_PER_MOVE = 5 / ((ROCKFALL.calmSec[0] + ROCKFALL.calmSec[1]) / 2);

function gauss() { return Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(2 * Math.PI * Math.random()); }

function simulate({ sd, wrong, decide = 2 }, seed, mode = 'normal', maxMoves = 500) {
  const m = new Mountain(seed, BALANCE, mode);
  const modeCfg = BALANCE.modes[mode];
  const grip = new GripSystem(BALANCE, modeCfg);
  let node = m.getLevel(0) ? m.getLevel(0).nodes[0] : (m.ensureLevel(10), m.getLevel(0).nodes[0]);
  let checkpoint = node, best = 0, slips = 0, falls = 0, moves = 0;
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
    grip.hang(decide, { drainMultiplier: 1, onJug: node.kind === 'jug' });
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
    const c = new ComboSystem({ notes: route.notes, beatMs: route.beatMs, ...w, leadInMs: 900, minGapMs: r.minGapMs, gustWindowScale: r.gustWindowScale });
    let empty = grip.isEmpty;
    for (const n of c.notes) {
      if (empty) break;
      // Blind notes and off-beats are read less accurately.
      const spread = sd * (n.hidden && !whiteout && !dark ? 1.35 : 1) * (whiteout ? 1.15 : 1) * (dark ? 1.12 : 1) * (route.tags.includes('OFFBEAT') ? 1.1 : 1);
      const dir = Math.random() < wrong ? (n.dir === 'L' ? 'R' : 'L') : n.dir;
      const res = c.press(dir, n.time + gauss() * spread);
      [...res.auto, res.judged].filter(Boolean).forEach((x) => { if (!lit || x.result === 'miss') grip.applyNote(route, x.result); });
      if (res.judged && res.judged.holding && Math.random() < wrong * 2) { c.release(n.dir, n.time + 50); grip.applyNote(route, 'miss'); }
      if (grip.isEmpty) { empty = true; break; }
    }
    const s = c.summary();
    if (!empty) {
      const ok = s.miss <= BALANCE.combo.maxMissesForSuccess;
      grip.applyComboEnd(s, ok);
      if (ok) node = route.target;
      if (ok && route.thermal && c.notes[route.thermal.note].result === 'perfect') node = route.thermal.to;
      if (grip.isEmpty) empty = true;
    }
    if (empty) {
      slips++;
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
  }
  return { best, slips, falls };
}

const players = { expert: { sd: 45, wrong: 0.01 }, good: { sd: 75, wrong: 0.03 }, average: { sd: 110, wrong: 0.05 }, novice: { sd: 150, wrong: 0.08 } };
for (const mode of ['normal', 'hard', 'summit']) {
  console.log(`--- ${mode.toUpperCase()} (500 moves max)`);
  for (const [name, p] of Object.entries(players)) {
    const runs = Array.from({ length: 30 }, (_, i) => simulate(p, 1000 + i, mode));
    const avg = (k) => (runs.reduce((a, r) => a + r[k], 0) / runs.length).toFixed(0);
    console.log(`${name.padEnd(8)} best ${avg('best').padStart(5)} m   slips ${avg('slips').padStart(3)}   falls ${avg('falls').padStart(3)}`);
  }
}
