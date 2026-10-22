import { Mountain } from './SegmentGenerator.js';
import { BALANCE } from '../config/balanceConfig.js';
import { METERS_PER_LEVEL } from '../config/gameConfig.js';
import { SeededRandom, hashInts } from '../utils/seededRandom.js';
import { TUTORIAL_SEGMENTS, tutorialLevelNodes, pathX } from '../data/tutorial.js';

export const TUTORIAL_SEED = 1717;

// The Training Crag: hand-built segments first, then an ordinary mountain.
// Route offers come from the tutorial director when it has a lesson for the node.
export class TutorialMountain extends Mountain {
  constructor(balance = BALANCE) {
    super(TUTORIAL_SEED, balance, 'normal');
    this.scripted = null;
  }

  generateNext() {
    const index = this.last ? this.last.index + 1 : 0;
    if (index >= TUTORIAL_SEGMENTS.length) return super.generateNext();
    const [start, end, rest] = TUTORIAL_SEGMENTS[index];
    const rng = new SeededRandom(hashInts(TUTORIAL_SEED, index));
    const levels = [];
    for (let level = start; level <= end; level++) {
      const sway = Math.round(Math.sin(level * 0.3) * 10);
      levels.push({ level, nodes: tutorialLevelNodes(level), bounds: { l: 92 + sway, r: 388 + sway } });
    }
    const decor = [];
    for (let i = 0; i < 6 + levels.length / 3; i++) {
      const lv = rng.pick(levels);
      const side = rng.chance(0.5) ? -1 : 1;
      decor.push({
        type: rng.pick(['grass', 'flowers', 'fern', 'pine']), side, level: lv.level,
        x: (side < 0 ? lv.bounds.l : lv.bounds.r) - side * rng.int(2, 9), y: -lv.level * 24 + rng.int(-8, 8), v: 0,
      });
    }
    const last = levels[levels.length - 1];
    const seg = {
      index, templateId: 'training-crag', name: 'TRAINING CRAG', style: 'balanced', difficulty: 1,
      features: index === 1 ? ['crack'] : [], biomeId: 'green', startLevel: start, endLevel: end, levels, rest, decor,
      waterfall: index === 2 ? { side: 1 } : null,
      exitX: pathX(end), exitBounds: last.bounds, viewpointCount: 0, sinceRest: 0, seed: hashInts(TUTORIAL_SEED, index, 99),
    };
    this.segments.set(index, seg);
    for (const lv of seg.levels) this.levels.set(lv.level, { ...lv, segIndex: index });
    this.last = seg;
    this.listeners.add.forEach((fn) => fn(seg));
    return seg;
  }

  computeRoutes(node, opts = {}) {
    const scripted = this.scripted && this.scripted(node);
    return scripted || super.computeRoutes(node, opts);
  }

  // Builds a route object compatible with the climbing code.
  static makeRoute(from, target, { type = 'normal', label, notes, beatMs = 650, windowScale = 1 }, balance = BALANCE) {
    const cfg = balance.routes[type];
    const levels = target.level - from.level;
    return {
      type,
      label: label || (target.kind === 'ledge' ? 'LEDGE' : cfg.label),
      toLedge: target.kind === 'ledge',
      from,
      target,
      levels,
      heightGain: levels * METERS_PER_LEVEL,
      inputs: notes.length,
      pattern: notes.map((x) => x.dir),
      notes,
      tags: [],
      beatMs,
      gripCost: +(cfg.gripCost * 0.8).toFixed(1),
      windowScale,
      hazard: target.hazard,
      difficulty: cfg.difficulty,
      forgiving: false,
    };
  }
}
