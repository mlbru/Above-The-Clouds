import { Mountain } from './SegmentGenerator.js';
import { BALANCE } from '../config/balanceConfig.js';
import { levelToY, levelToMeters, METERS_PER_LEVEL } from '../config/gameConfig.js';
import { SeededRandom, hashInts } from '../utils/seededRandom.js';
import { biomeAt } from '../data/biomes.js';
import { gemForBiome } from '../data/gems.js';

const WALL_MIN_X = 36, WALL_MAX_X = 444;
const LINE_MIN_X = 100, LINE_MAX_X = 380;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DECOR = { green: ['grass', 'flowers', 'fern', 'pine'], stone: ['rocks', 'grass'], frozen: ['icicles', 'snowdrift'], clouds: ['crystals', 'rocks'], volcano: ['rocks'] };
const HAZARD = { l: 'loose', i: 'icy', c: 'crumbling' };

// '-12j' -> { dx: -12, rise: 2, kind: 'jug', hazard: null, gem: false }
export function parseHold(token) {
  const m = /^([+-]?\d+)([jlicg^_]*)$/.exec(token);
  if (!m) throw new Error(`bad hold token "${token}"`);
  const f = m[2];
  const hazard = [...f].map((c) => HAZARD[c]).find(Boolean) || null;
  return { dx: Number(m[1]), rise: f.includes('^') ? 3 : f.includes('_') ? 1 : 2, kind: f.includes('j') && !hazard ? 'jug' : 'hold', hazard, gem: f.includes('g') };
}

// 'L U- R= U?' -> notes for the ComboSystem, plus the route tags they imply.
export function parseRhythm(str) {
  const tags = new Set();
  const notes = str.trim().split(/\s+/).map((tok) => {
    const n = { dir: tok[0], gap: 1, hold: 0, hidden: false, gust: false };
    if (!'LUR'.includes(n.dir)) throw new Error(`bad arrow "${tok}"`);
    for (const c of tok.slice(1)) {
      if (c === '-') { n.gap = 0.5; tags.add('OFFBEAT'); }
      else if (c === '+') { n.gap = 1.5; tags.add('OFFBEAT'); }
      else if (c === '=') { n.hold = 1.5; tags.add('HOLD'); }
      else if (c === '?') { n.hidden = true; tags.add('BLIND'); }
      else if (c === '!') { n.gust = true; tags.add('GUST'); }
      else throw new Error(`bad arrow flag "${tok}"`);
    }
    return n;
  });
  // A held note needs room before the next one.
  notes.forEach((n, i) => { if (n.hold && notes[i + 1]) notes[i + 1].gap = Math.max(notes[i + 1].gap, 0.75); });
  return { notes, tags: [...tags] };
}

// Lays out an expedition: base camp, one segment per pitch (ending on its
// ledge, the last one on the summit) and an empty cap of sky-high rock above,
// so the wall renderer can draw the summit. Routes follow the authored line:
// from hold n, SAFE goes to n+1, NORMAL to n+2, RISKY to n+3 (never past the ledge).
export class ExpeditionMountain extends Mountain {
  constructor(exp, balance = BALANCE) {
    super(exp.seed, balance, 'normal');
    this.exp = exp;
    this.plan = this.layout();
    this.summitLevel = this.plan.summit.level;
  }

  layout() {
    const gap = this.balance.generation.ledgeExitGap;
    const segs = [];
    let x = 240, level = 0;
    const base = { id: '0:0', level: 0, x, y: levelToY(0), kind: 'ledge', hazard: null, main: true };
    segs.push({ start: 0, end: gap, nodes: [base], rest: { type: 'camp', name: 'BASE CAMP' }, width: 300 });
    let summit = null;
    this.exp.pitches.forEach((p, pi) => {
      const holds = p.line.trim().split(/\s+/).map(parseHold);
      const nodes = [];
      const start = level + 1;
      holds.forEach((h, k) => {
        level += k === 0 ? Math.max(gap + 1, h.rise) : h.rise;
        x = clamp(x + h.dx, LINE_MIN_X, LINE_MAX_X);
        nodes.push({ id: `${level}:0`, level, x, y: levelToY(level), kind: h.kind, hazard: h.hazard, main: true, gem: h.gem, pitch: pi, index: k });
      });
      level += 2;
      const last = pi === this.exp.pitches.length - 1;
      const ledge = { id: `${level}:0`, level, x, y: levelToY(level), kind: 'ledge', hazard: null, main: true, pitch: pi, index: holds.length, summit: last };
      nodes.push(ledge);
      if (last) summit = ledge;
      segs.push({ start, end: level, nodes, pitch: p, pitchIndex: pi, rest: { type: last ? 'summit' : pi % 3 === 2 ? 'hut' : 'ledge', name: p.ledge, journal: last ? null : pi }, width: p.width || 260 });
    });
    // The empty top: the wall narrows to a point above the summit.
    segs.push({ start: level + 1, end: level + 14, nodes: [], rest: null, width: 120, cap: true });
    return { segs, summit };
  }

  generateNext() {
    const index = this.last ? this.last.index + 1 : 0;
    const spec = this.plan.segs[index];
    if (!spec) {
      // Past the cap: more empty sky so lookups above never fail.
      const start = this.last.endLevel + 1;
      return this.addSegment({ start, end: start + 10, nodes: [], rest: null, width: 60, cap: true }, index);
    }
    return this.addSegment(spec, index);
  }

  addSegment(spec, index) {
    const rng = new SeededRandom(hashInts(this.seed, index, 7717));
    const byLevel = new Map(spec.nodes.map((n) => [n.level, n]));
    const levels = [];
    let cx = spec.nodes.length ? spec.nodes[0].x : (this.last ? this.last.exitX : 240);
    for (let level = spec.start; level <= spec.end; level++) {
      const node = byLevel.get(level);
      if (node) cx = node.x;
      // The Crevasse: both ice walls stay put around the gap in the middle.
      if (this.exp.chasm && !spec.cap) cx = 240;
      const k = spec.cap ? (level - spec.start) / Math.max(1, spec.end - spec.start) : 0;
      const w = spec.cap ? Math.max(30, spec.width * (1 - k)) : spec.width + Math.sin(level * 0.37) * 14;
      const l = clamp(cx - w / 2, WALL_MIN_X, WALL_MAX_X - 30);
      const r = clamp(cx + w / 2, l + 30, WALL_MAX_X);
      levels.push({ level, nodes: node ? [node] : [], bounds: { l: Math.round(Math.min(l, cx - 24)), r: Math.round(Math.max(r, cx + 24)) } });
    }
    const biome = biomeAt(levelToMeters(spec.start));
    const decor = [];
    if (!spec.cap && !this.exp.islands) {
      const types = DECOR[biome.id] || DECOR.stone;
      for (let d = rng.int(6, 10); d > 0; d--) {
        const lv = rng.pick(levels);
        const side = rng.chance(0.5) ? -1 : 1;
        decor.push({ type: rng.pick(types), side, level: lv.level, x: Math.round((side < 0 ? lv.bounds.l : lv.bounds.r) - side * rng.range(2, 10)), y: Math.round(levelToY(lv.level) + rng.range(-10, 10)), v: rng.int(0, 3) });
      }
    }
    const p = spec.pitch || {};
    const last = levels[levels.length - 1];
    const seg = {
      index, templateId: `expedition-${index}`, name: p.name || 'BASE CAMP', style: 'balanced', difficulty: 1 + Math.min(3, Math.floor((spec.pitchIndex || 0) / 3)),
      features: p.features || [], biomeId: biome.id, startLevel: spec.start, endLevel: spec.end, levels, rest: spec.rest, decor,
      waterfall: p.waterfall ? { side: p.waterfall } : null,
      islands: !!this.exp.islands,
      chasm: !!this.exp.chasm && !spec.cap && index > 0,
      exitX: last.nodes.length ? last.nodes[0].x : Math.round((last.bounds.l + last.bounds.r) / 2), exitBounds: last.bounds,
      viewpointCount: 0, sinceRest: 0, seed: hashInts(this.seed, index, 99), pitchIndex: spec.pitchIndex ?? null,
    };
    this.segments.set(index, seg);
    for (const lv of seg.levels) this.levels.set(lv.level, { ...lv, segIndex: index });
    this.last = seg;
    this.listeners.add.forEach((fn) => fn(seg));
    return seg;
  }

  // The holds of the pitch a node starts from, in climbing order (ledge last).
  lineFrom(node) {
    const pi = node.kind === 'ledge' && node.level !== this.summitLevel ? (node.pitch ?? -1) + 1 : node.pitch;
    const spec = this.plan.segs.find((s) => s.pitchIndex === pi);
    return spec ? { nodes: spec.nodes, pitch: spec.pitch, from: node.kind === 'ledge' ? -1 : node.index } : null;
  }

  // Gems are placed by hand: a route carries one when its target hold has one.
  routeGem(route) {
    const t = route.target;
    if (!t.gem) return null;
    const key = `exp>${t.id}`;
    if (this.takenGems.has(key)) return null;
    const biome = biomeAt(levelToMeters(t.level));
    return { type: gemForBiome(biome.gemFrom || biome.id).id, key };
  }

  computeRoutes(node, { forgiving = false } = {}) {
    const line = this.lineFrom(node);
    if (!line) return [];
    const b = this.balance;
    const routes = [];
    b.routeOrder.forEach((type, typeIndex) => {
      const idx = Math.min(line.from + typeIndex + 1, line.nodes.length - 1);
      const target = line.nodes[idx];
      if (!target || routes.some((r) => r.target === target)) return;
      this.ensureLevel(target.level);
      const cfg = b.routes[type];
      const bank = line.pitch.rhythm[type];
      const { notes, tags } = parseRhythm(bank[Math.max(0, idx) % bank.length]);
      const biome = biomeAt(levelToMeters(target.level));
      const levels = target.level - node.level;
      const hazardScale = target.hazard === 'icy' ? b.hazards.icy.windowScale : 1;
      routes.push({
        type,
        label: target.kind === 'ledge' ? (target.summit ? 'SUMMIT' : 'LEDGE') : cfg.label,
        toLedge: target.kind === 'ledge',
        from: node,
        target,
        levels,
        heightGain: levels * METERS_PER_LEVEL,
        inputs: notes.length,
        pattern: notes.map((n) => n.dir),
        notes,
        tags,
        beatMs: Math.round(cfg.beatMs * (line.pitch.tempo || 1)),
        gripCost: +(cfg.gripCost * (notes.length / cfg.inputs) * biome.costMultiplier).toFixed(1),
        windowScale: cfg.windowScale * biome.windowScale * hazardScale,
        hazard: target.hazard,
        difficulty: cfg.difficulty,
        forgiving,
      });
    });
    return routes;
  }
}
