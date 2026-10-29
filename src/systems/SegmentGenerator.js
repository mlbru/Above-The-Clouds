import { BALANCE } from '../config/balanceConfig.js';
import { levelToY, levelToMeters, METERS_PER_LEVEL } from '../config/gameConfig.js';
import { SeededRandom, hashInts } from '../utils/seededRandom.js';
import { SEGMENT_TEMPLATES } from '../data/segments.js';
import { biomeAt } from '../data/biomes.js';
import { choosePattern } from '../data/comboPatterns.js';
import { difficultyAt } from './DifficultySystem.js';
import { gemForBiome } from '../data/gems.js';
import { GEM_INCOME } from '../data/shop.js';

const WALL_MIN_X = 36;
const WALL_MAX_X = 444;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function pickTemplate(rng, biomeId, prevId, index) {
  if (index === 0) return SEGMENT_TEMPLATES[0];
  let pool = SEGMENT_TEMPLATES.filter((t) => t.biomes.includes(biomeId) && t.id !== prevId);
  if (!pool.length) pool = SEGMENT_TEMPLATES.filter((t) => t.id !== prevId);
  return rng.pick(pool);
}

function pickRest(rng, biome, viewpointCount) {
  const options = [
    { type: 'viewpoint', w: 0.32 },
    { type: 'hut', w: biome.rest.hut ?? 0.18 },
    { type: 'tool', w: biome.rest.tool ?? 0.12 },
    { type: 'ledge', w: 0.38 },
  ];
  const type = rng.weighted(options, (o) => o.w).type;
  const rest = { type, name: null, discovery: null, viewpoint: null };
  if (type === 'viewpoint') {
    const names = biome.rest.viewpoints;
    rest.viewpoint = names[viewpointCount % names.length];
    rest.name = rest.viewpoint;
    rest.discovery = biome.rest.discovery || null;
  } else if (type === 'hut') {
    rest.name = 'OLD SHELTER';
    rest.discovery = 'old-shelter';
  } else if (type === 'tool') {
    rest.name = 'LEDGE';
    rest.discovery = 'abandoned-axe';
  } else {
    rest.name = 'LEDGE';
  }
  return rest;
}

// Generates one segment. `prev` is the previous segment (or null for the base).
export function generateSegment(seed, index, prev, balance = BALANCE, mode = 'normal') {
  const gen = balance.generation;
  const rng = new SeededRandom(hashInts(seed, index, 7717));
  const startLevel = prev ? prev.endLevel + 1 : 0;
  const biome = biomeAt(levelToMeters(startLevel));
  const template = pickTemplate(rng, biome.id, prev && prev.templateId, index);
  const diff = difficultyAt(levelToMeters(startLevel), mode, balance);
  const sinceRest = prev ? prev.sinceRest + 1 : 0;
  const isRest = index > 0 && sinceRest >= diff.restEvery - 1;
  const count = rng.int(template.levels[0], template.levels[1]);
  const targetWidth = rng.range(template.width[0], template.width[1]);
  const hazardChance = {
    // Some biomes (the Bone Garden) have more crumbling holds on top of the height ramp.
    crumbling: diff.crumbling + (biome.hazards.crumbling || 0),
    loose: (biome.hazards.loose || 0) + ((template.hazardBoost && template.hazardBoost.loose) || 0),
    icy: (biome.hazards.icy || 0) + ((template.hazardBoost && template.hazardBoost.icy) || 0),
  };

  let x = prev ? prev.exitX : 240;
  let center = prev ? (prev.exitBounds.l + prev.exitBounds.r) / 2 : 240;
  let width = prev ? prev.exitBounds.r - prev.exitBounds.l : 300;
  const hasWaterfall = template.features.includes('waterfall');
  const waterfallSide = rng.chance(0.5) ? -1 : 1;

  const levels = [];
  const prevEndedOnLedge = prev ? prev.levels[prev.levels.length - 1].nodes.some((n) => n.kind === 'ledge') : false;
  let gapRemaining = prevEndedOnLedge ? gen.ledgeExitGap : 0;
  const totalLevels = index === 0 ? count + 1 : count;
  for (let i = 0; i < totalLevels; i++) {
    const level = startLevel + i;
    width += (targetWidth - width) * 0.3;
    center += (x - center) * 0.12 + (240 - center) * 0.06 + rng.range(-4, 4);
    let l = clamp(center - width / 2, WALL_MIN_X, WALL_MAX_X - 120);
    let r = clamp(center + width / 2, l + 120, WALL_MAX_X);
    const marginL = gen.wallMargin + (hasWaterfall && waterfallSide < 0 ? 26 : 0);
    const marginR = gen.wallMargin + (hasWaterfall && waterfallSide > 0 ? 26 : 0);

    const isBase = index === 0 && i === 0;
    const isLedge = isBase || (isRest && i === totalLevels - 1);
    if (!isBase) {
      // Step the main line, never further than maxWander from the previous level.
      const wander = Math.min(template.wander, gen.maxWander);
      const nx = x + rng.range(-wander, wander);
      x = clamp(nx, Math.max(l + marginL, x - wander), Math.min(r - marginR, x + wander));
    }
    // Make sure the wall always contains the main line.
    l = Math.min(l, x - marginL);
    r = Math.max(r, x + marginR);

    const nodes = [];
    const y = levelToY(level);
    if (isLedge) {
      nodes.push({ id: `${level}:0`, level, x: Math.round(x), y, kind: 'ledge', hazard: null, main: true });
      gapRemaining = gen.ledgeExitGap;
    } else if (gapRemaining > 0) {
      // Empty rock right above a ledge: the climber stands here, so no holds.
      gapRemaining--;
    } else {
      const crumbles = rng.chance(hazardChance.crumbling * 0.5);
      const main = { id: `${level}:0`, level, x: Math.round(x), y, kind: !crumbles && rng.chance(0.08) ? 'jug' : 'hold', hazard: crumbles ? 'crumbling' : null, main: true };
      nodes.push(main);
      let extras = 0;
      if (rng.chance(Math.min(0.95, template.density))) extras++;
      if (rng.chance(template.density * 0.35)) extras++;
      for (let e = 0; e < extras; e++) {
        for (let attempt = 0; attempt < 4; attempt++) {
          const off = rng.range(gen.extraOffsetMin, gen.extraOffsetMax) * (rng.chance(0.5) ? -1 : 1);
          const ex = Math.round(x + off);
          if (ex < l + marginL || ex > r - marginR) continue;
          if (nodes.some((n) => Math.abs(n.x - ex) < gen.minNodeSpacing)) continue;
          let hazard = null;
          if (rng.chance(hazardChance.crumbling)) hazard = 'crumbling';
          else if (rng.chance(hazardChance.icy)) hazard = 'icy';
          else if (rng.chance(hazardChance.loose)) hazard = 'loose';
          const kind = !hazard && rng.chance(0.1) ? 'jug' : 'hold';
          nodes.push({ id: `${level}:${nodes.length}`, level, x: ex, y, kind, hazard, main: false });
          break;
        }
      }
    }
    levels.push({ level, nodes, bounds: { l: Math.round(l), r: Math.round(r) } });
  }

  const viewpointCount = (prev ? prev.viewpointCount : 0);
  let rest = null;
  if (index === 0) rest = { type: 'camp', name: 'BASE CAMP', discovery: null, viewpoint: null };
  else if (isRest) rest = pickRest(rng, biome, viewpointCount);

  // Decorations hug the wall edges so they never cover holds.
  const decor = [];
  const decorCount = rng.int(6, 11);
  for (let d = 0; d < decorCount; d++) {
    const lv = levels[rng.int(0, levels.length - 1)];
    const side = rng.chance(0.5) ? -1 : 1;
    const type = rng.pick(template.decor);
    const edgeX = side < 0 ? lv.bounds.l : lv.bounds.r;
    decor.push({ type, side, level: lv.level, x: Math.round(edgeX - side * rng.range(2, 10)), y: Math.round(levelToY(lv.level) + rng.range(-10, 10)), v: rng.int(0, 3) });
  }

  const last = levels[levels.length - 1];
  return {
    index,
    templateId: template.id,
    name: template.name,
    style: template.style,
    difficulty: template.difficulty,
    features: template.features,
    biomeId: biome.id,
    startLevel,
    endLevel: startLevel + totalLevels - 1,
    levels,
    rest,
    decor,
    waterfall: hasWaterfall ? { side: waterfallSide } : null,
    exitX: Math.round(x),
    exitBounds: last.bounds,
    viewpointCount: viewpointCount + (rest && rest.type === 'viewpoint' ? 1 : 0),
    sinceRest: isRest || index === 0 ? 0 : sinceRest,
    seed: hashInts(seed, index, 99),
  };
}

// Turns a direction pattern into a rhythm with the tricks unlocked at this
// height: off-beat gaps, held notes, notes that fade out, and wind gusts.
export function buildRhythm(rng, pattern, ramp, biome, typeIndex = 1) {
  const notes = pattern.map((dir) => ({ dir, gap: 1, hold: 0, hidden: false, gust: false }));
  const tags = new Set();
  // Safe routes get fewer tricks than risky ones.
  const k = [0.6, 1, 1.25][typeIndex] ?? 1;
  for (let i = 1; i < notes.length; i++) {
    if (rng.chance(ramp.syncopation * k)) { notes[i].gap = rng.pick([0.5, 1.5]); tags.add('OFFBEAT'); }
  }
  for (let i = 0; i < notes.length; i++) {
    if (rng.chance(ramp.hold * k)) {
      notes[i].hold = rng.pick([1, 1.5]);
      if (notes[i + 1]) notes[i + 1].gap = Math.max(notes[i + 1].gap, 0.75);
      tags.add('HOLD');
      i++;
    }
  }
  for (let i = 1; i < notes.length; i++) {
    if (rng.chance(ramp.fade * k)) { notes[i].hidden = true; tags.add('BLIND'); }
  }
  if (notes.length >= 3 && rng.chance(ramp.gust * k * (0.4 + biome.weather.wind))) {
    const start = rng.int(1, notes.length - 2);
    notes[start].gust = true;
    notes[start + 1].gust = true;
    tags.add('GUST');
  }
  // The high mountain's notes. Each keeps clear of the other tricks so a note
  // never asks two new things at once.
  const plain = (n) => !n.hold && !n.hidden && !n.gust && !n.mirror && !n.chord && !n.roll;
  if (ramp.mirror) {
    for (let i = 0; i < notes.length; i++) {
      if (notes[i].dir !== 'U' && plain(notes[i]) && rng.chance(ramp.mirror * k)) { notes[i].mirror = true; tags.add('MIRROR'); }
    }
  }
  if (ramp.chord && rng.chance(ramp.chord * k * 1.6)) {
    const options = notes.map((n, i) => i).filter((i) => plain(notes[i]));
    if (options.length) {
      const i = rng.pick(options);
      notes[i].chord = notes[i].dir === 'U' ? rng.pick(['L', 'R']) : notes[i].dir === 'L' ? 'R' : 'L';
      tags.add('DOUBLE');
    }
  }
  if (ramp.roll && rng.chance(ramp.roll * k * 1.6)) {
    // Never the last note: the tail needs the next beat to land on.
    const options = notes.map((n, i) => i).filter((i) => i < notes.length - 1 && plain(notes[i]));
    if (options.length) {
      const i = rng.pick(options);
      notes[i].roll = ramp.rollTaps || 3;
      // The next note waits for the tail and is a different arrow, so extra
      // taps can never be mistaken for it.
      notes[i + 1].gap = Math.max(notes[i + 1].gap, 1);
      if (notes[i + 1].dir === notes[i].dir) notes[i + 1].dir = notes[i].dir === 'U' ? rng.pick(['L', 'R']) : 'U';
      tags.add('ROLL');
    }
  }
  return { notes, tags: [...tags] };
}

// The live mountain: a window of generated segments plus route queries.
export class Mountain {
  constructor(seed, balance = BALANCE, mode = 'normal') {
    this.seed = seed;
    this.balance = balance;
    this.mode = mode;
    this.segments = new Map();
    this.levels = new Map();
    this.last = null;
    this.listeners = { add: [], remove: [] };
    this.takenGems = new Set();
  }

  on(evt, fn) { this.listeners[evt].push(fn); }

  generateNext() {
    const index = this.last ? this.last.index + 1 : 0;
    const seg = generateSegment(this.seed, index, this.last, this.balance, this.mode);
    this.segments.set(index, seg);
    for (const lv of seg.levels) this.levels.set(lv.level, { ...lv, segIndex: index });
    this.last = seg;
    this.listeners.add.forEach((fn) => fn(seg));
    return seg;
  }

  ensureLevel(level) {
    while (!this.last || this.last.endLevel < level) this.generateNext();
  }

  getLevel(level) { return this.levels.get(level) || null; }
  getSegment(index) { return this.segments.get(index) || null; }
  segmentForLevel(level) {
    const lv = this.levels.get(level);
    return lv ? this.segments.get(lv.segIndex) : null;
  }

  // Interpolated wall bounds at a fractional level.
  boundsAt(levelFloat) {
    const a = Math.floor(levelFloat), b = a + 1;
    const la = this.levels.get(a), lb = this.levels.get(b);
    if (la && lb) {
      const t = levelFloat - a;
      return { l: la.bounds.l + (lb.bounds.l - la.bounds.l) * t, r: la.bounds.r + (lb.bounds.r - la.bounds.r) * t };
    }
    const any = la || lb;
    if (any) return { ...any.bounds };
    return { l: 90, r: 390 };
  }

  nextLedgeAbove(level, limit = 80) {
    for (let l = level + 1; l <= level + limit; l++) {
      this.ensureLevel(l);
      const lv = this.levels.get(l);
      if (lv && lv.nodes.length && lv.nodes[0].kind === 'ledge') return l;
    }
    return null;
  }

  findNode(id) {
    const level = parseInt(id, 10);
    const lv = this.levels.get(level);
    return lv ? lv.nodes.find((n) => n.id === id) || null : null;
  }

  // Removes segments that lie fully below minLevel. Returns removed segments.
  prune(minLevel) {
    const removed = [];
    for (const [index, seg] of this.segments) {
      if (seg.endLevel < minLevel && seg !== this.last) {
        this.segments.delete(index);
        for (const lv of seg.levels) this.levels.delete(lv.level);
        removed.push(seg);
      }
    }
    removed.forEach((seg) => this.listeners.remove.forEach((fn) => fn(seg)));
    return removed;
  }

  // Highest level in [minLevel, fromLevel] that has a hold, or null.
  catchLevelBelow(fromLevel, minLevel) {
    for (let l = fromLevel; l > minLevel; l--) {
      const lv = this.levels.get(l);
      if (lv && lv.nodes.length && lv.nodes[0].kind !== 'ledge') return l;
    }
    return null;
  }

  // Lists the 1-3 climbing routes available from a node.
  // Whether a route carries a gem on its target hold. The gem belongs to the
  // route: take that route to collect it. Riskier route types roll with a
  // higher chance; the stone depends on the region. Deterministic per seed and
  // route, and a collected gem never comes back (no farming after a slip).
  routeGem(route, chanceScale = 1) {
    const t = route.target;
    if (t.kind === 'ledge') return null;
    const key = `${route.from.id}>${t.id}`;
    if (this.takenGems.has(key)) return null;
    const meters = levelToMeters(t.level);
    if (meters < 3) return null;
    const gem = gemForBiome(biomeAt(meters).id);
    const p = (GEM_INCOME.chance[route.type] ?? 0.1) * gem.rarity * chanceScale;
    const u = new SeededRandom(hashInts(this.seed, route.from.level, route.from.x, t.level, t.x, 991)).next();
    return u < p ? { type: gem.id, key } : null;
  }

  takeGem(gem) { if (gem) this.takenGems.add(gem.key); }

  computeRoutes(node, { forgiving = false } = {}) {
    const b = this.balance;
    const ledgeLevel = this.nextLedgeAbove(node.level);
    const routes = [];
    b.routeOrder.forEach((type, typeIndex) => {
      const cfg = b.routes[type];
      const startLevel = node.kind === 'ledge' ? node.level + b.generation.ledgeExitGap : node.level;
      let targetLevel = startLevel + cfg.levels;
      let toLedge = false;
      if (ledgeLevel !== null && targetLevel >= ledgeLevel) {
        targetLevel = ledgeLevel;
        toLedge = true;
      }
      if (routes.some((r) => r.target.level === targetLevel)) return;
      this.ensureLevel(targetLevel);
      const lv = this.levels.get(targetLevel);
      if (!lv) return;
      const cands = lv.nodes.filter((n) => Math.abs(n.x - node.x) <= cfg.maxReach);
      if (!cands.length) return;
      const rng = new SeededRandom(hashInts(this.seed, node.level, node.x, typeIndex));
      let target;
      if (type === 'safe') {
        target = cands.slice().sort((p, q) => (p.hazard ? 200 : 0) + Math.abs(p.x - node.x) - ((q.hazard ? 200 : 0) + Math.abs(q.x - node.x)))[0];
      } else {
        // Prefer a target visually separated from the routes already offered.
        target = rng.weighted(cands, (n) => {
          const sep = routes.length ? Math.min(...routes.map((r) => Math.abs(r.target.x - n.x))) : 30;
          return 1 + Math.min(sep, 60) / 15;
        });
      }
      const seg = this.segments.get(lv.segIndex);
      const biome = biomeAt(levelToMeters(targetLevel));
      const levelsGained = targetLevel - node.level;
      const diff = seg ? seg.difficulty : 1;
      const ramp = difficultyAt(levelToMeters(node.level), this.mode, b);
      const inputs = cfg.inputs + ramp.extraInputs;
      const pattern = choosePattern(rng, inputs, target.x - node.x, seg ? seg.style : 'balanced');
      const rhythm = buildRhythm(rng, pattern, ramp, biome, typeIndex);
      const hazardScale = target.hazard === 'icy' ? b.hazards.icy.windowScale : 1;
      routes.push({
        type,
        label: toLedge ? 'LEDGE' : cfg.label,
        toLedge,
        from: node,
        target,
        levels: levelsGained,
        heightGain: levelsGained * METERS_PER_LEVEL,
        inputs,
        pattern,
        notes: rhythm.notes,
        tags: rhythm.tags,
        beatMs: Math.round(cfg.beatMs * ramp.beatScale),
        gripCost: +(cfg.gripCost * (inputs / cfg.inputs) * biome.costMultiplier * (1 + (diff - 1) * 0.06)).toFixed(1),
        windowScale: cfg.windowScale * biome.windowScale * hazardScale * (1 - (diff - 1) * 0.03) * ramp.windowScale,
        hazard: target.hazard,
        difficulty: cfg.difficulty,
        forgiving,
      });
    });
    return routes;
  }
}
