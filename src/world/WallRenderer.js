import { DEPTH, LEVEL_PX, levelToY, levelToMeters, GAME_WIDTH, GAME_HEIGHT, CAMERA_ANCHOR, WORLD_WIDTH } from '../config/gameConfig.js';
import { WallPainter } from '../render/wallArt.js';
import { holdKey, BONE_HOLD_VARIANTS } from '../render/textures.js';
import { biomeAt } from '../data/biomes.js';
import { holdShapeKey, shapesFor, SHAPED_BIOMES_SKIP } from '../render/holdArt.js';
import { SeededRandom, hashInts } from '../utils/seededRandom.js';
import { HUT_SIZE } from '../render/campArt.js';
import { lerpColor } from '../utils/color.js';
import { currentSeason } from '../data/seasons.js';
import { BIOMES } from '../data/biomes.js';
import { PEOPLE } from '../data/requests.js';
import { PETS, activePet, petStage } from '../data/pets.js';
import { buildPetTextures } from '../render/petArt.js';
import { PixelGrid, makeCanvas } from '../utils/pixelGrid.js';
import { stroke, shade } from '../render/pixelKit.js';
import { MASTERY_BIOMES, STARS } from '../data/mastery.js';

// Decorations that give light at night: [texture key part, colour, size, strength].
const LIGHT_OF = [
  ['vent', 0xff7a2a, 1.6, 0.45], ['crystal', 0xd8a6ff, 1.3, 0.35], ['tent', 0xffb060, 1.2, 0.2],
  ['hut', 0xffb060, 2.2, 0.35], ['pipe', 0xffa040, 1.0, 0.25], ['comb', 0xffc040, 1.0, 0.2],
  ['lantern_far', 0xff8a40, 1.5, 0.5], ['glowcap', 0x7af0c8, 1.3, 0.5],
];

const DECOR_TEX = {
  grass: 'decor_grass', flowers: 'decor_flowers', fern: 'decor_fern', rocks: 'decor_rocks',
  icicles: 'decor_icicles', snowdrift: 'decor_snowdrift', crystals: 'decor_crystals',
  pine: 'decor_cliffpine',
  piton: 'decor_piton', nest: 'decor_nest', vent: 'decor_vent', chain: 'decor_chain',
  frostfern: 'decor_frostfern', bones: 'decor_bones', coins: 'decor_coins', comb: 'decor_comb', pipe: 'decor_pipe',
  lantern: 'decor_lantern_far', wheel: 'decor_wheel', glowcap: 'decor_glowcap', rootcurtain: 'decor_rootcurtain',
};

// What sits under each hold, per biome: a dark drop shadow (offset down-right)
// or, on glassy and icy rock, a soft coloured glow around it.
const HOLD_SHADOW = {
  default: { tint: 0x0a0812, alpha: 0.35, dx: 1, dy: 2 },
  stone: { tint: 0x0a0812, alpha: 0.45, dx: 2, dy: 3 },
  frozen: { tint: 0x9fd8ff, alpha: 0.22, dx: 0, dy: 0, glow: true },
  clouds: { tint: 0x2a3050, alpha: 0.22, dx: 1, dy: 3 },
  obsidian: { tint: 0x000000, alpha: 0.6, dx: 1, dy: 3 },
  crystal: { tint: 0xffb8ec, alpha: 0.3, dx: 0, dy: 0, glow: true },
  storm: { tint: 0x05060c, alpha: 0.5, dx: -1, dy: 3 },
  aurora: { tint: 0x5af0a0, alpha: 0.22, dx: 0, dy: 0, glow: true },
  dragon: { tint: 0x2a0606, alpha: 0.5, dx: 1, dy: 2 },
  hive: { tint: 0xffb840, alpha: 0.2, dx: 0, dy: 1, glow: true },
  clockwork: { tint: 0x0a0806, alpha: 0.5, dx: 1, dy: 3 },
  bones: { tint: 0x0c0a0a, alpha: 0.45, dx: 1, dy: 2 },
  cascade: { tint: 0x020606, alpha: 0.55, dx: 1, dy: 3 },
  monastery: { tint: 0x140806, alpha: 0.45, dx: 2, dy: 3 },
  moss: { tint: 0xb8ff6a, alpha: 0.12, dx: 0, dy: 1, glow: true },
  volcano: { tint: 0xff6a1a, alpha: 0.25, dx: 0, dy: 1, glow: true },
};

// Milliseconds per frame spent painting walls ahead of the climber.
const WALL_BUDGET_MS = 3;

// Owns all per-segment visuals and releases them when segments are pruned.
// Other climbers' tents at camp: the orange tent with its colour channels
// swapped round, so each one is a clean blue, green or rose.
function tentVariant(scene, i) {
  const key = `decor_tent_v${i}`;
  if (scene.textures.exists(key)) return key;
  const src = scene.textures.get('decor_tent').getSourceImage();
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height), p = img.data;
  const order = [[2, 1, 0], [1, 0, 2], [0, 2, 1], [2, 0, 1]][i % 4];
  for (let k = 0; k < p.length; k += 4) {
    const r = p[k], g = p[k + 1], b = p[k + 2];
    if (p[k + 3] === 0 || !(r > g + 30 && g >= b)) continue;
    const ch = [r, g, b];
    p[k] = ch[order[0]]; p[k + 1] = ch[order[1]]; p[k + 2] = ch[order[2]];
  }
  ctx.putImageData(img, 0, 0);
  scene.textures.addCanvas(key, c);
  return key;
}

// The Dragon's Gate pillar and the skull on its chain (see placeGate).
function buildGateTextures(scene) {
  if (scene.textures.exists('gate_pillar')) return;
  const W = 22, H = 74;
  const g = new PixelGrid(W, H);
  const OB = 1, BONE = 2, CROWN = 3, IRON = 4, PLINTH = 5;
  // Plinth, shaft (slightly tapered), capital.
  g.rect(1, H - 7, W - 2, 7, PLINTH); g.rect(2, H - 9, W - 4, 2, PLINTH);
  for (let y = 12; y < H - 9; y++) { const w = 12 + Math.round((y - 12) / (H - 21) * 2); g.rect(Math.round(W / 2 - w / 2), y, w, 1, OB); }
  g.rect(3, 9, W - 6, 4, PLINTH);
  // Bone spiralling up the shaft.
  for (let y = 14; y < H - 10; y++) {
    const x = Math.round(W / 2 + Math.sin(y * 0.32) * 6.5);
    if (Math.cos(y * 0.32) > -0.2) { g.set(x, y, BONE); g.set(x + 1, y, BONE); }
  }
  // Horned crown and an iron brazier bowl.
  stroke(g, [4, 10], [0, 5], [2, 0], 3, 1, CROWN);
  stroke(g, [W - 5, 10], [W - 1, 5], [W - 3, 0], 3, 1, CROWN);
  g.rect(5, 5, W - 10, 4, IRON); g.rect(4, 4, W - 8, 1, IRON);
  shade(g, OB, [0x0a0610, 0x160c1c, 0x24142c, 0x3a2244, 0x6a3a7a], { r: 3, base: 0.42, light: [0.83, -0.55], bias: (x, y) => ((y % 9) === 0 ? -0.2 : 0) });
  shade(g, PLINTH, [0x120c14, 0x22182a, 0x34283c, 0x4c3c54], { r: 2, base: 0.5, light: [0.83, -0.55] });
  shade(g, BONE, [0x8a7a62, 0xc8bca0, 0xece2cc], { r: 1, base: 0.6 });
  shade(g, CROWN, [0x8a7a62, 0xc8bca0, 0xf4ecd8], { r: 1, base: 0.6 });
  shade(g, IRON, [0x1a1416, 0x3a3236, 0x6a5e60], { r: 1, base: 0.5 });
  // Glowing cracks in the obsidian.
  for (const [x, y0] of [[8, 30], [13, 48], [10, 58]]) for (let k = 0; k < 6; k++) g.set(x + (k % 3 === 2 ? 1 : 0), y0 + k, k % 2 ? 0xc84a1a : 0xff9a3c);
  g.outline(0x08040a);
  const c = makeCanvas(W, H); g.drawTo(c.getContext('2d')); scene.textures.addCanvas('gate_pillar', c);
  // A dragon skull: brow, eye sockets, a row of teeth.
  const k = new PixelGrid(15, 12);
  k.ellipse(7.5, 4.5, 6.5, 4.5, BONE);
  k.rect(4, 7, 7, 4, BONE);
  stroke(k, [2, 3], [0, 1], [0, 4], 2, 1, BONE); stroke(k, [12, 3], [14, 1], [14, 4], 2, 1, BONE);
  shade(k, BONE, [0x7a6a52, 0xb8ac90, 0xe8dec8], { r: 2, base: 0.6 });
  k.rect(4, 4, 2, 2, 0x0a0406); k.rect(9, 4, 2, 2, 0x0a0406); k.set(5, 5, 0xff7a2a); k.set(9, 5, 0xff7a2a);
  for (let x = 5; x < 11; x += 2) k.set(x, 10, 0xf4ecd8);
  k.rect(5, 9, 6, 1, 0x2a1a14);
  k.outline(0x08040a);
  const c2 = makeCanvas(15, 12); k.drawTo(c2.getContext('2d')); scene.textures.addCanvas('gate_skull', c2);
}

export class WallRenderer {
  constructor(scene, mountain, seed) {
    this.scene = scene;
    this.mountain = mountain;
    this.painter = new WallPainter(seed);
    this.visuals = new Map();
    this.jobs = [];
    this.animated = [];
    // How worn each biome's holds are from all your climbs: { [biomeId]: climbs }.
    const prog = scene.registry && scene.registry.get('progression');
    this.wear = (prog && prog.data.wear) || {};
    this.onRemove = (seg) => this.removeSegment(seg.index);
    mountain.on('remove', this.onRemove);
  }

  get activeCount() { return this.visuals.size; }

  update(dt, renderUpToLevel, viewTopY, viewBottomY) {
    for (const seg of this.mountain.segments.values()) {
      if (this.visuals.has(seg.index)) continue;
      if (seg.startLevel > renderUpToLevel) continue;
      if (!this.mountain.getSegment(seg.index + 1)) continue;
      this.createSegment(seg);
    }
    // Paint queued walls within a small per-frame budget; finish immediately
    // anything that is about to scroll into view. Rows are painted in small
    // slices (a row costs ~0.15 ms on a laptop, several times that on a phone)
    // so the budget is not overshot, and the texture upload waits for a frame
    // with time to spare.
    const start = performance.now();
    const left = () => WALL_BUDGET_MS - (performance.now() - start);
    for (const job of this.jobs) {
      const v = this.visuals.get(job.segment.index);
      const urgent = v && job.top + job.h > viewTopY - 40 && job.top < viewBottomY + 40;
      while (!job.done && (urgent || left() > 0)) job.step(urgent ? 400 : 3);
      if (job.done && v && !v.image && (urgent || left() > 0)) this.finishWall(v, job);
      if (!urgent && left() <= 0) break;
    }
    // Painted jobs stay queued until their texture has been uploaded.
    this.jobs = this.jobs.filter((j) => {
      const v = this.visuals.get(j.segment.index);
      return !j.done || (v && !v.image);
    });
    const t = this.scene.time.now;
    for (const a of this.animated) {
      if (a.type === 'waterfall') a.obj.tilePositionY -= dt * 0.09;
      if (a.type === 'shine') { a.obj.tilePositionY -= dt * 0.16; a.obj.setAlpha(0.14 + 0.1 * Math.sin(t / 300)); }
      if (a.type === 'foam') a.obj.setFrame(Math.floor(t / 150 + a.phase) % 2);
      if (a.type === 'flags') a.obj.setFrame(Math.floor(t / 350 + a.phase) % 2);
      if (a.type === 'trader') a.obj.setFrame(Math.floor(t / 140) % 26 === 0 ? 1 : Math.floor(t / 900) % 2 ? 2 : 0);
      if (a.type === 'fire') a.obj.setFrame(Math.floor(t / 110) % 3);
      if (a.type === 'grass') a.obj.setFrame(Math.sin(t / 900 + a.phase) > 0.2 ? 1 : 0);
      if (a.type === 'person') a.obj.setFrame(Math.floor(t / 1300 + a.phase) % 4 === 0 ? 1 : 0);
      if (a.type === 'pet') {
        if (a.fly) a.obj.setFrame(Math.floor(t / 60 + a.phase) % 2).setY(Math.round(a.y0 + Math.sin(t / 300 + a.phase) * 3));
        else a.obj.setFrame(Math.floor(t / 900 + a.phase) % 5 === 0 ? 1 : 0);
      }
      // Fire and lamps glow brighter as night falls.
      if (a.type === 'flicker') a.obj.setAlpha((a.base + Math.sin(t / 90 + a.phase) * 0.06 + Math.sin(t / 37 + a.phase) * 0.04) * (0.6 + (this.night || 0) * 1.1));
      // Pools of light from fires, lamps, vents and crystals: only at night.
      if (a.type === 'nightlight') a.obj.setAlpha((a.base + Math.sin(t / 110 + a.phase) * 0.05 + Math.sin(t / 43 + a.phase) * 0.03) * Math.max(0, (this.night || 0) - 0.15) * 1.3);
      if (a.type === 'blink') a.obj.setAlpha(Math.floor(t / 520 + a.phase) % 2 ? 1 : 0.25);
      // The Far Range: rainbows in the spray fade at night; shafts of light
      // breathe; prayer wheels turn; flags flutter.
      if (a.type === 'bow') a.obj.setAlpha((0.22 + 0.1 * Math.sin(t / 1300 + a.phase)) * Math.max(0, 1 - (this.night || 0) * 1.6));
      if (a.type === 'shaft') a.obj.setAlpha((a.base + Math.sin(t / 2100 + a.phase) * a.base * 0.4) * Math.max(0.15, 1 - (this.night || 0)));
      if (a.type === 'wheel') a.obj.setFrame(Math.floor(t / 260 + a.phase) % 3);
      if (a.type === 'pennant') a.obj.setY(a.y + (Math.floor(t / 300 + a.phase) % 2)).setScale(1, Math.floor(t / 300 + a.phase) % 2 ? 0.8 : 1);
      if (a.type === 'pumpkin') a.obj.setFrame(Math.floor(t / 140 + a.phase) % 5 === 0 ? 1 : 0);
      if (a.type === 'butterfly') {
        const u = t / 1000 + a.phase;
        a.obj.setPosition(Math.round(a.x + Math.sin(u * 0.7) * 34 + Math.sin(u * 2.3) * 6), Math.round(a.y + Math.sin(u * 1.3) * 8 - Math.abs(Math.sin(u * 4)) * 4));
        a.obj.setFrame(Math.floor(t / 110 + a.phase * 10) % 2);
      }
    }
  }

  createSegment(seg) {
    const v = { seg, image: null, texKey: `wall_${seg.index}_${this.mountain.seed}`, holds: new Map(), objects: [] };
    this.visuals.set(seg.index, v);
    const job = this.painter.createJob(seg, this.mountain);
    this.jobs.push(job);
    const rng = new SeededRandom(seg.seed);

    for (const lv of seg.levels) {
      for (const node of lv.nodes) {
        if (node.kind === 'ledge') continue;
        const biome = biomeAt(levelToMeters(node.level));
        let key = holdKey(biome.id, node.kind, node.hazard);
        // Bone holds: one of several shapes, either way round.
        const hsh = hashInts(Math.round(node.x), Math.round(node.y), 83);
        const boneHold = biome.id === 'bones' && node.kind === 'hold' && (!node.hazard || node.hazard === 'crumbling');
        if (boneHold && hsh % BONE_HOLD_VARIANTS) key += `_v${hsh % BONE_HOLD_VARIANTS}`;
        // Every other plain hold and jug: one of the biome's hold shapes.
        let jx = 0, jy = 0;
        if (!node.hazard && !SHAPED_BIOMES_SKIP.includes(biome.id)) {
          const shapes = shapesFor(biome.id, node.kind);
          key = holdShapeKey(biome.id, shapes[(hsh >>> 3) % shapes.length]);
          // Nudged a pixel off the grid so the rows don't line up so neatly.
          jx = ((hsh >>> 7) % 3) - 1; jy = ((hsh >>> 9) % 3) - 1;
        }
        // A soft shadow under each hold so it sits on the rock instead of on top
        // of it; ice, crystal and aurora holds glow faintly instead.
        const look = HOLD_SHADOW[biome.id] || HOLD_SHADOW.default;
        const shadow = this.scene.add.image(node.x + jx + look.dx, node.y + 3 + jy + look.dy, key).setDepth(DEPTH.holds - 1).setTintFill(look.tint).setAlpha(look.alpha);
        if (look.glow) shadow.setBlendMode('ADD').setScale(1.3);
        else (v.shadows || (v.shadows = [])).push({ img: shadow, x: node.x + jx, y: node.y + 3 + jy, alpha: look.alpha, len: 1 });
        const s = this.scene.add.image(node.x + jx, node.y + 3 + jy, key).setDepth(DEPTH.holds);
        if (boneHold && (hsh >> 4) % 2) { s.setFlipX(true); shadow.setFlipX(true); }
        v.holds.set(node.id, s);
        v.objects.push(shadow, s);
        // Polished by a thousand hands: in biomes you climb a lot, some holds
        // wear smooth and catch the light (a sheen and one bright pixel).
        const worn = Math.min(0.55, (this.wear[biome.id] || 0) / 700);
        if (worn > 0 && !node.hazard && ((hsh >>> 12) % 100) / 100 < worn) {
          const sheen = this.scene.add.image(s.x, s.y, key).setDepth(DEPTH.holds + 0.1).setTintFill(0xfff8e8).setAlpha(0.16).setBlendMode('ADD').setFlipX(s.flipX);
          const glint = this.scene.add.rectangle(s.x - 1 + ((hsh >>> 5) % 3) - 1, s.y - Math.round(s.height / 2) + 1, 2, 1, 0xffffff, 0.75).setDepth(DEPTH.holds + 0.2);
          v.objects.push(sheen, glint);
        }
      }
    }
    for (const d of seg.decor) {
      const biome = biomeAt(levelToMeters(d.level));
      const key = (biome.decor && biome.decor[d.type]) || DECOR_TEX[d.type];
      if (!key) continue;
      const img = this.scene.add.image(d.x, d.y, key).setDepth(DEPTH.decor).setFlipX(d.side > 0);
      // Things that hang (icicles, chains) hang from their top.
      if (key === 'decor_icicles' || key === 'decor_chain' || key === 'decor_rootcurtain') img.setOrigin(0.5, 0);
      // Cliff pines root in the rock and lean out over the edge.
      else if (key.startsWith('decor_cliffpine')) img.setOrigin(d.side > 0 ? 0.25 : 0.75, 0.95);
      else img.setOrigin(0.5, 1);
      v.objects.push(img);
    }
    if (seg.rest) this.placeRestDecor(seg, v, rng);
    this.placeFarDressing(seg, v, rng);
    this.addShadowsAndLights(v, seg);
    if (seg.waterfall) {
      const top = levelToY(seg.endLevel) - LEVEL_PX / 2;
      const bottom = levelToY(seg.startLevel) + LEVEL_PX / 2;
      const xs = seg.levels.map((lv) => (seg.waterfall.side < 0 ? lv.bounds.l + 14 : lv.bounds.r - 14));
      const x = seg.waterfall.side < 0 ? Math.max(...xs) : Math.min(...xs);
      // In the Cascade the falls are big: twice as wide, with a rainbow in
      // the spray at their foot.
      const big = biomeAt(levelToMeters(seg.startLevel)).id === 'cascade';
      const wf = this.scene.add.tileSprite(x, top, big ? 20 : 10, bottom - top, 'waterfall').setOrigin(0.5, 0).setDepth(DEPTH.wall + 1).setAlpha(0.9);
      if (big) {
        const bow = this.scene.add.image(x, bottom - 4, 'far_rainbow').setOrigin(0.5, 1).setDepth(DEPTH.wall + 3).setBlendMode('ADD').setAlpha(0.32).setScale(0.9);
        v.objects.push(bow);
        this.animated.push({ type: 'bow', obj: bow, phase: seg.index, seg: seg.index });
      }
      // A source at the top and a foaming shelf with spray at the bottom, so
      // the water never starts or stops in mid-air.
      const head = this.scene.add.sprite(x, top + 6, 'waterfall_top', 0).setOrigin(0.5, 1).setDepth(DEPTH.wall + 2);
      const foot = this.scene.add.sprite(x, bottom, 'waterfall_splash', 0).setOrigin(0.5, 12 / 20).setDepth(DEPTH.wall + 2);
      const reduced = this.scene.effects && this.scene.effects.reduced;
      const spray = this.scene.add.particles(x, bottom - 6, 'px2', {
        frequency: reduced ? 220 : 90, lifespan: 600, speedX: { min: -22, max: 22 }, speedY: { min: -38, max: -12 }, gravityY: 110,
        alpha: { start: 0.85, end: 0 }, tint: [0xffffff, 0xd8eeff, 0x8ec5f0],
      }).setDepth(DEPTH.wall + 3);
      // Light running down the water, and mist rolling off the plunge pool.
      const shine = this.scene.add.tileSprite(x, top, 10, bottom - top, 'waterfall').setOrigin(0.5, 0).setDepth(DEPTH.wall + 1).setBlendMode('ADD').setAlpha(0.22).setFlipX(true);
      const mist = this.scene.add.particles(x, bottom - 4, 'puff', {
        frequency: reduced ? 600 : 260, lifespan: 2600, speedX: { min: -10, max: 10 }, speedY: { min: -10, max: -3 },
        alpha: { start: 0.32, end: 0 }, scale: { start: 0.6, end: 2.2 }, tint: [0xffffff, 0xe0f0ff],
      }).setDepth(DEPTH.wall + 3);
      v.objects.push(wf, head, foot, spray, shine, mist);
      this.animated.push({ type: 'shine', obj: shine, seg: seg.index });
      v.waterfallX = x;
      this.animated.push({ type: 'waterfall', obj: wf, seg: seg.index });
      this.animated.push({ type: 'foam', obj: head, seg: seg.index, phase: 0 });
      this.animated.push({ type: 'foam', obj: foot, seg: seg.index, phase: 1 });
    }
    // Foreground outcrops with stronger parallax frame the scene.
    if (seg.index > 0 && !seg.islands && rng.chance(0.6)) {
      const biome = biomeAt(levelToMeters(seg.startLevel));
      const left = rng.chance(0.5);
      const midY = levelToY((seg.startLevel + seg.endLevel) / 2);
      const img = this.scene.add.image(left ? -rng.int(4, 18) : WORLD_WIDTH + rng.int(4, 18), midY * 1.35, `fg_${biome.id}_${rng.int(0, 2)}`)
        .setOrigin(0, 0.5).setScrollFactor(1, 1.35).setDepth(DEPTH.foreground).setFlipX(!left);
      if (!left) img.setOrigin(1, 0.5);
      v.objects.push(img);
    }
  }

  // The Far Shore: where the dragon sets you down on the new mountain. An old
  // standing stone with a dragon carved round it (the carving glows at
  // night), a stone lantern that is always lit, your flag planted in the moss,
  // ferns and glowing caps along the edge.
  placeFarShore(node, side, spot, add, si) {
    const sc = this.scene, y = node.y;
    const stoneX = spot(58), lampX = spot(32), flagX = node.x - side * 34;
    add(sc.add.image(stoneX, y + 1, 'far_stone').setOrigin(0.5, 1).setDepth(DEPTH.decor));
    const carve = add(sc.add.image(stoneX, y + 1, 'far_stone_glow').setOrigin(0.5, 1).setDepth(DEPTH.decor + 0.1).setBlendMode('ADD').setAlpha(0.5));
    this.animated.push({ type: 'flicker', obj: carve, base: 0.35, phase: 2, seg: si });
    add(sc.add.image(lampX, y + 1, 'far_tlantern').setOrigin(0.5, 1).setDepth(DEPTH.decor));
    const lamp = add(sc.add.image(lampX, y - 14, 'glow').setDepth(DEPTH.decor + 1).setBlendMode('ADD').setTint(0xffb050).setScale(0.9).setAlpha(0.4));
    this.animated.push({ type: 'flicker', obj: lamp, base: 0.4, phase: 1, seg: si });
    add(sc.add.image(flagX, y + 1, 'flag').setOrigin(0.1, 1).setDepth(DEPTH.decor + 1));
    for (const [dx, key] of [[78, 'decor_fern'], [92, 'decor_glowcap'], [-60, 'decor_fern'], [-76, 'decor_glowcap']]) {
      add(sc.add.image(spot(Math.abs(dx)) + (dx < 0 ? -2 * side * Math.abs(dx) : 0), y + 1, key).setOrigin(0.5, 1).setDepth(DEPTH.decor).setFlipX(dx < 0));
    }
  }

  // The Far Range's set dressing, per segment: walkways and prayer flags in
  // the Hanging Monastery, shafts of light and roots in the Moss Cathedral.
  placeFarDressing(seg, v, rng) {
    const biome = biomeAt(levelToMeters(seg.startLevel));
    const sc = this.scene;
    const add = (o) => { v.objects.push(o); return o; };
    const mid = seg.levels.slice(2, -2);
    if (!mid.length) return;
    if (biome.id === 'monastery') {
      // Plank walkways bolted along the cliff, out from one edge.
      if (seg.features.includes('walkway')) {
        for (let k = 0; k < 2; k++) {
          const lv = rng.pick(mid);
          if (lv.nodes.some((n) => n.kind === 'ledge')) continue;
          const side = rng.chance(0.5) ? -1 : 1;
          const len = rng.int(5, 9) * 12;
          const edge = side < 0 ? lv.bounds.l - 6 : lv.bounds.r + 6;
          const x0 = side < 0 ? edge : edge - len;
          const y = levelToY(lv.level) + 14;
          add(sc.add.tileSprite(x0, y, len, 14, 'far_walkway').setOrigin(0, 0).setDepth(DEPTH.decor - 1).setFlipX(side > 0));
        }
      }
      // A string of prayer flags across the wall, sagging, fluttering.
      if (rng.chance(0.75)) {
        const lv = rng.pick(mid), b = lv.bounds;
        const y0 = levelToY(lv.level) - 18, x0 = b.l + rng.int(0, 30), x1 = b.r - rng.int(0, 30);
        const g = add(sc.add.graphics().setDepth(DEPTH.decor - 1));
        const cols = [0x4a8ae8, 0xf4f0e4, 0xe84a3a, 0x5ac86a, 0xf2c252];
        const sag = rng.int(10, 22);
        const yAt = (x) => y0 + Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * sag;
        g.lineStyle(1, 0x2a1a12, 1);
        g.beginPath(); g.moveTo(x0, y0);
        for (let x = x0; x <= x1; x += 4) g.lineTo(x, yAt(x));
        g.strokePath();
        let i = 0;
        for (let x = x0 + 6; x < x1 - 4; x += 9) {
          const f = add(sc.add.rectangle(x, Math.round(yAt(x)) + 1, 6, 7, cols[i % 5]).setOrigin(0.5, 0).setDepth(DEPTH.decor - 0.9));
          this.animated.push({ type: 'pennant', obj: f, y: f.y, phase: i * 0.37, seg: seg.index });
          i++;
        }
      }
      // A turning prayer wheel on the odd ledge-side spot.
      for (const d of seg.decor) {
        if (d.type !== 'wheel') continue;
        const w = v.objects.find((o) => o.texture && o.texture.key === 'decor_wheel' && o.x === d.x && o.y === d.y);
        if (w) { w.setTexture('far_wheel', 0); this.animated.push({ type: 'wheel', obj: w, phase: d.x % 7, seg: seg.index }); }
      }
    } else if (biome.id === 'moss') {
      // Long shafts of light falling in through the roots, slanting.
      if (seg.features.includes('shafts')) {
        const n = rng.int(1, 2);
        for (let k = 0; k < n; k++) {
          const lv = rng.pick(mid), b = lv.bounds;
          const x = rng.range(b.l + 20, b.r - 20), y = levelToY(lv.level) - 60;
          const base = rng.range(0.16, 0.26);
          const shaft = add(sc.add.image(x, y, 'far_shaft').setOrigin(0.5, 0).setDepth(DEPTH.light).setBlendMode('ADD')
            .setTint(0xfff0b0).setScale(rng.range(1.2, 1.8), rng.range(1.4, 2)).setRotation(-0.38).setAlpha(base));
          this.animated.push({ type: 'shaft', obj: shaft, base, phase: x, seg: seg.index });
          // Motes turning in the light.
          if (!(sc.effects && sc.effects.reduced)) {
            const motes = add(sc.add.particles(x + 30, y + 90, 'px2', {
              frequency: 420, lifespan: 3600, speedX: { min: -4, max: 4 }, speedY: { min: -3, max: 4 },
              alpha: { onEmit: () => 0, onUpdate: (p, k, t) => Math.sin(t * Math.PI) * 0.8 }, x: { min: -24, max: 24 }, y: { min: -60, max: 60 }, tint: 0xfff4c0,
            }).setDepth(DEPTH.light + 0.5));
            motes.setBlendMode('ADD');
          }
        }
      }
    }
  }

  placeRestDecor(seg, v, rng) {
    const lv = seg.levels.find((l) => l.nodes.length && l.nodes[0].kind === 'ledge');
    if (!lv) return;
    const node = lv.nodes[0];
    const { l, r } = lv.bounds;
    const side = node.x - l > r - node.x ? -1 : 1;
    const spot = (dist) => Math.round(Math.max(l + 16, Math.min(r - 16, node.x + side * dist)));
    const add = (img) => { v.objects.push(img); return img; };
    const type = seg.rest.type;
    if (type === 'camp' && seg.index === 0 && !this.scene.tutorial) {
      // The base camp trader with goods laid out on a rug.
      const tx = spot(40);
      this.trader = add(this.scene.add.sprite(tx, node.y + 1, 'npc_trader', 0).setOrigin(0.5, 1).setDepth(DEPTH.decor).setFlipX(side > 0));
      add(this.scene.add.image(tx - side * 2, node.y + 2, 'decor_stall').setOrigin(0.5, 1).setDepth(DEPTH.decor + 1));
      this.animated.push({ type: 'trader', obj: this.trader, seg: seg.index });
      this.traderLamp = { x: tx + (side > 0 ? -10 : 10), y: node.y - 23 };
      const lamp = add(this.scene.add.image(tx + (side > 0 ? -10 : 10), node.y - 23, 'glow_small').setDepth(DEPTH.decor + 1).setBlendMode('ADD').setTint(0xffc060).setScale(1.4).setAlpha(0.45));
      this.animated.push({ type: 'flicker', obj: lamp, base: 0.45, phase: 3, seg: seg.index });
    }
    if (type === 'camp') {
      add(this.scene.add.image(spot(84), node.y, 'decor_tent').setOrigin(0.5, 1).setDepth(DEPTH.decor));
      add(this.scene.add.image(node.x - side * 40, node.y, 'decor_sign').setOrigin(0.5, 1).setDepth(DEPTH.decor));
      // Where things stand at camp (the title screen uses them as its menu).
      this.campSpots = { ...(this.campSpots || {}), tent: { x: spot(84), y: node.y }, sign: { x: node.x - side * 40, y: node.y }, fire: { x: node.x - side * 84, y: node.y } };
      if (this.trader) this.campSpots.trader = { x: this.trader.x, y: node.y, lamp: this.traderLamp };
      add(this.scene.add.image(spot(114), node.y, 'decor_pine').setOrigin(0.5, 1).setDepth(DEPTH.decor));
      add(this.scene.add.image(spot(128), node.y, 'decor_pine').setOrigin(0.5, 1).setDepth(DEPTH.decor).setFlipX(true));
      if (seg.index === 0) this.placeCampLife(node, side, rng, add);
      if (seg.index === 0 && !this.scene.tutorial) this.placeSeason(node, side, spot, rng, add);
      if (seg.index === 0 && !this.scene.tutorial) this.placeCampGrowth(node, side, spot, rng, add);
    } else if (type === 'farshore') {
      this.placeFarShore(node, side, spot, add, seg.index);
    } else if (type !== 'gate' && biomeAt(levelToMeters(node.level)).id === 'monastery') {
      // A temple balcony: a monk with tea on a low table, a lantern.
      const mx = spot(54), tx = spot(36);
      add(this.scene.add.sprite(mx, node.y + 1, 'far_monk', 3).setOrigin(0.5, 1).setDepth(DEPTH.decor).setFlipX(side < 0));
      const g = add(this.scene.add.graphics().setDepth(DEPTH.decor));
      g.fillStyle(0x16100c, 1).fillRect(tx - 7, node.y - 6, 15, 3).fillRect(tx - 6, node.y - 3, 2, 3).fillRect(tx + 5, node.y - 3, 2, 3);
      g.fillStyle(0x8a3a24, 1).fillRect(tx - 6, node.y - 5, 13, 1);
      g.fillStyle(0xf4f0e4, 1).fillRect(tx - 1, node.y - 8, 3, 2);
      g.fillStyle(0x2a6a50, 1).fillRect(tx + 3, node.y - 9, 3, 3);
      add(this.scene.add.image(spot(84), node.y, 'decor_lantern_far').setOrigin(0.5, 1).setDepth(DEPTH.decor));
      seg.rest.tea = { x: tx };
      if (type === 'hut') this.placeHut(spot(110), node, add);
    } else if (type === 'hut') {
      this.placeHut(spot(66), node, add);
    } else if (type === 'viewpoint') {
      add(this.scene.add.image(spot(48), node.y, 'decor_cairn').setOrigin(0.5, 1).setDepth(DEPTH.decor));
      if (seg.rest.discovery === 'prayer-flags' || rng.chance(0.4)) {
        const flags = add(this.scene.add.sprite(spot(46), node.y - 34, 'decor_flags', 0).setDepth(DEPTH.decor));
        this.animated.push({ type: 'flags', obj: flags, phase: rng.next() * 2, seg: seg.index });
      }
    } else if (type === 'tool') {
      add(this.scene.add.image(spot(40), node.y - 14, 'decor_axe_stuck').setDepth(DEPTH.decor));
    } else if (type === 'gate') {
      this.placeGate(node, lv.bounds, add, seg.index);
    } else if (type === 'summit') {
      // The top of an expedition: a cairn, prayer flags and a flag on the very top.
      add(this.scene.add.image(node.x - side * 22, node.y, 'decor_cairn').setOrigin(0.5, 1).setDepth(DEPTH.decor));
      const flags = add(this.scene.add.sprite(node.x + side * 26, node.y - 30, 'decor_flags', 0).setDepth(DEPTH.decor));
      this.animated.push({ type: 'flags', obj: flags, phase: rng.next() * 2, seg: seg.index });
      add(this.scene.add.image(node.x - side * 22, node.y - 14, 'flag').setOrigin(0.1, 1).setDepth(DEPTH.decor + 1));
    }
    // An expedition ledge with one of Bram's journal pages: a little cairn holds it down.
    if (seg.rest.journal != null) add(this.scene.add.image(spot(36), node.y, 'decor_cairn').setOrigin(0.5, 1).setDepth(DEPTH.decor).setScale(0.75));
  }

  // Base camp grows with you: the requests board, an extra tent for every
  // 500 m of Normal record, bunting with a pennant for every mastered biome,
  // Bram's stall getting grander as you spend gems, and the people whose
  // story notes you finished sitting round the fire.
  placeCampGrowth(node, side, spot, rng, add) {
    const sc = this.scene, y = node.y;
    const prog = sc.registry && sc.registry.get('progression');
    const d = prog ? prog.data : {};
    const clampX = (x) => Math.max(10, Math.min(WORLD_WIDTH - 10, Math.round(x)));
    // The corkboard on its post, past the woodpile.
    const bx = clampX(node.x - side * 140);
    add(sc.add.image(bx, y + 1, 'camp_board').setOrigin(0.5, 1).setDepth(DEPTH.decor).setFlipX(side > 0));
    this.campSpots = { ...(this.campSpots || {}), board: { x: bx, y } };
    // The pets' pen, past the board: the ones you have and are not taking
    // along potter about inside it.
    const have = PETS.filter((p) => p.unlocked(d));
    if (have.length) {
      const px = clampX(node.x - side * 186);
      add(sc.add.image(px, y + 1, 'camp_pen').setOrigin(0.5, 1).setDepth(DEPTH.decor));
      this.campSpots = { ...(this.campSpots || {}), pen: { x: px, y } };
      buildPetTextures(sc);
      const away = activePet(d);
      have.filter((p) => !away || p.id !== away.id).forEach((p, i) => {
        const flying = p.id === 'bee' || p.id === 'moth';
        const pet = add(sc.add.sprite(px - 12 + i * 10, y - (flying ? 12 : 3), `pet_${p.id}_${petStage(d, p.id)}`, 0).setOrigin(0.5, 1).setDepth(DEPTH.decor + 0.5).setFlipX(i % 2 === 1));
        this.animated.push({ type: 'pet', obj: pet, phase: i * 1.3, fly: flying, y0: pet.y, frames: p.id === 'kid' || p.id === 'dragonling' ? 2 : 2, seg: 0 });
      });
    }
    // Tents: one more for every 500 m of record, pitched beyond the pines.
    const best = (d.bestByMode && d.bestByMode.normal) || 0;
    const tents = Math.min(4, Math.floor(best / 500));
    for (let i = 0; i < tents; i++) {
      const tx = clampX(node.x + side * (148 + i * 26));
      add(sc.add.image(tx, y + (i % 2), tentVariant(sc, i)).setOrigin(0.5, 1).setDepth(DEPTH.decor - 1 + (i % 2)).setScale(0.8).setFlipX(i % 2 === 1));
    }
    // Bunting from the tent to the pines: a pennant per mastered biome.
    const mastered = MASTERY_BIOMES.filter((id) => ((d.mastery && d.mastery[id]) || []).length >= STARS.length);
    if (mastered.length) {
      const g = add(sc.add.graphics().setDepth(DEPTH.decor + 1));
      const x0 = spot(70), x1 = spot(132), ly = y - 30;
      const n = mastered.length;
      const sag = (x) => ly + Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * 6;
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) g.fillStyle(0x4a4038, 1).fillRect(x, Math.round(sag(x)), 1, 1);
      mastered.forEach((id, i) => {
        const px = Math.round(x0 + ((i + 0.5) / n) * (x1 - x0));
        const py = Math.round(sag(px)) + 1;
        const b = BIOMES[id];
        g.fillStyle(0x16141f, 1).fillTriangle(px - 3, py - 1, px + 3, py - 1, px, py + 6);
        g.fillStyle(b.accentA, 1).fillTriangle(px - 2, py, px + 2, py, px, py + 4);
        g.fillStyle(b.accentB, 1).fillRect(px - 1, py, 2, 1);
      });
    }
    // Bram's stall, by gems spent: an awning, then a string of lanterns too.
    const spent = Math.max(0, (d.gemsEarned || 0) - (d.gems || 0));
    if (this.trader && spent >= 400) {
      const tx = this.trader.x, g = add(sc.add.graphics().setDepth(DEPTH.decor + 2));
      const ax = Math.round(tx - 15), ay = y - 30;
      g.fillStyle(0x3a2414, 1).fillRect(ax - 1, ay, 1, 30).fillRect(ax + 31, ay, 1, 30);
      for (let i = 0; i < 8; i++) g.fillStyle(i % 2 ? 0xf0e6cc : 0xc8463b, 1).fillRect(ax + i * 4, ay - 2, 4, 5);
      for (let i = 0; i < 8; i++) g.fillStyle(i % 2 ? 0xf0e6cc : 0xc8463b, 1).fillRect(ax + i * 4 + 1, ay + 3, 2, 1);
      g.fillStyle(0x16141f, 0.5).fillRect(ax, ay + 4, 32, 1);
      if (spent >= 2000) {
        for (let i = 0; i < 4; i++) {
          const lx = ax + 3 + i * 9, ly2 = ay + 6 + (i % 2);
          g.fillStyle(0x16141f, 1).fillRect(lx - 1, ly2, 3, 4);
          const l = add(sc.add.rectangle(lx, ly2 + 2, 1, 2, 0xffd070).setDepth(DEPTH.decor + 3));
          this.animated.push({ type: 'flicker', obj: l, base: 0.8, phase: i * 1.3, seg: 0 });
          const glow = add(sc.add.image(lx, ly2 + 2, 'glow_small').setDepth(DEPTH.decor + 2).setBlendMode('ADD').setTint(0xffb050).setScale(0.8).setAlpha(0.3));
          this.animated.push({ type: 'flicker', obj: glow, base: 0.3, phase: i * 1.3, seg: 0 });
        }
      }
    }
    // Friends at the fire.
    const friends = [...new Set(((d.requests && d.requests.storyDone) || []).map((rid) => rid.split('-')[0]))].filter((id) => PEOPLE[id] && sc.textures.exists(`camp_person_${id}`));
    const fx = node.x - side * 84;
    // On the bench first, then round the far side of the fire.
    const seats = [-15, 19, -23, 29, 12];
    friends.slice(0, seats.length).forEach((id, i) => {
      const px = clampX(fx + side * seats[i]);
      const p = add(sc.add.sprite(px, y + 1, `camp_person_${id}`, 0).setOrigin(0.5, 1).setDepth(DEPTH.decor + 1).setFlipX(px > fx));
      this.animated.push({ type: 'person', obj: p, phase: i * 1.7, seg: 0 });
    });
    // The flags of the climbers you brought down off the wall (idea sheet
    // 1.8): a pole each beyond the tent, a pennant in their jacket colour.
    (d.rescued || []).slice(0, 7).forEach((p, i) => {
      const px = clampX(node.x + side * (146 + i * 9)), tall = 30 + (i % 2) * 4;
      const pg = add(sc.add.graphics().setDepth(DEPTH.decor - 0.5));
      pg.fillStyle(0x16141f, 1).fillRect(px - 1, y - tall, 3, tall + 1);
      pg.fillStyle(0x9a7048, 1).fillRect(px, y - tall, 1, tall);
      pg.fillStyle(0xf2c14e, 1).fillRect(px - 1, y - tall - 1, 3, 1);
      const f = add(sc.add.triangle(px + 1, y - tall + 1, 0, 0, side > 0 ? 11 : 11, 3, 0, 7, p.coat).setOrigin(0, 0).setDepth(DEPTH.decor - 0.4));
      this.animated.push({ type: 'pennant', obj: f, y: f.y, phase: i * 0.6, seg: 0 });
    });
  }

  // The Dragon's Gate (data/gate.js): two carved obsidian pillars, centred
  // on the ledge, bone spiralling up them, horned crowns with braziers
  // burning on top, and a heavy chain sagging between them with a dragon
  // skull hung in the middle.
  placeGate(node, bounds, addIn, si) {
    let add = addIn;
    const sc = this.scene, y = node.y;
    buildGateTextures(sc);
    const own = add;
    this.gateObjs = [];
    add = (o) => { this.gateObjs.push(o); return own(o); };
    this.gateSpot = { x: Math.round((bounds.l + bounds.r) / 2), y, add: own, si };
    const mid = Math.round((bounds.l + bounds.r) / 2);
    const half = Math.round(Math.min(78, Math.max(40, (bounds.r - bounds.l) / 2 - 22)));
    const tops = [];
    for (const s of [-1, 1]) {
      const px = mid + s * half;
      add(sc.add.image(px, y + 2, 'gate_pillar').setOrigin(0.5, 1).setDepth(DEPTH.decor).setFlipX(s > 0));
      const top = y + 2 - sc.textures.get('gate_pillar').getSourceImage().height;
      tops.push([px, top]);
      const fire = add(sc.add.sprite(px, top + 4, 'camp_fire', 0).setOrigin(0.5, 1).setDepth(DEPTH.decor + 1));
      this.animated.push({ type: 'fire', obj: fire, seg: si });
      const glow = add(sc.add.image(px, top - 4, 'glow').setDepth(DEPTH.decor - 1).setBlendMode('ADD').setTint(0xff7a2c).setScale(1.4).setAlpha(0.45));
      this.animated.push({ type: 'flicker', obj: glow, base: 0.45, phase: s + 2, seg: si });
      const pool = add(sc.add.image(px, top + 16, 'glow').setDepth(DEPTH.light + 1).setBlendMode('ADD').setTint(0xff6a20).setScale(2.8, 2.4).setAlpha(0));
      this.animated.push({ type: 'nightlight', obj: pool, base: 0.5, phase: s, seg: si });
    }
    // The chain between the crowns, and a skull hung from its lowest link.
    const g = add(sc.add.graphics().setDepth(DEPTH.decor - 0.5));
    const [[x0, t0], [x1]] = tops;
    const cy = t0 + 12;
    for (let x = x0 + 6; x <= x1 - 6; x += 3) {
      const u = (x - x0 - 6) / (x1 - x0 - 12);
      const yy = Math.round(cy + Math.sin(u * Math.PI) * 12);
      const odd = Math.floor((x - x0) / 3) % 2;
      g.fillStyle(0x0e0a10, 1).fillRect(x - 1, yy - 1, 4, odd ? 3 : 4);
      g.fillStyle(odd ? 0x5a5460 : 0x8a8494, 1).fillRect(x, yy, 2, odd ? 1 : 2);
      g.fillStyle(0xc8c2d0, 1).fillRect(x, yy, 1, 1);
    }
    add(sc.add.image(mid, cy + 13, 'gate_skull').setOrigin(0.5, 0).setDepth(DEPTH.decor - 0.4));
  }

  // After the crossing: the Gate is gone (you are on another mountain now);
  // the Far Shore has a lantern on a post and a red flag, as seen from the air.
  // After the flight the Gate's fires go out (the dragon has left). The Far
  // Shore ledge itself is dressed by placeFarShore.
  farShore() {
    (this.gateObjs || []).forEach((o) => o.active && o.setVisible(false));
  }

  // Halloween and Christmas at base camp (data/seasons.js): carved pumpkins
  // and bats, or snow, fairy lights on the tent and baubles in the pines.
  placeSeason(node, side, spot, rng, add) {
    const season = currentSeason();
    if (!season) return;
    const sc = this.scene, y = node.y;
    if (season === 'halloween') {
      [spot(24), spot(70), node.x - side * 62, node.x - side * 132].forEach((x, i) => {
        const p = add(sc.add.sprite(x, y + 1, 'season_pumpkin', 0).setOrigin(0.5, 1).setDepth(DEPTH.decor + 1).setFlipX(i % 2 === 1));
        this.animated.push({ type: 'pumpkin', obj: p, phase: i * 1.7, seg: 0 });
        const glow = add(sc.add.image(x, y - 4, 'glow_small').setDepth(DEPTH.decor + 1).setBlendMode('ADD').setTint(0xff8a20).setScale(1.2).setAlpha(0.4));
        this.animated.push({ type: 'flicker', obj: glow, base: 0.4, phase: i * 2.1, seg: 0 });
      });
      for (let i = 0; i < 4; i++) {
        const b = add(sc.add.sprite(0, 0, 'bird', 0).setDepth(DEPTH.decor + 2).setTint(0x1a1222));
        this.animated.push({ type: 'butterfly', obj: b, x: node.x + (i - 1.5) * 60 + rng.int(-10, 10), y: y - 46 - i * 9, phase: rng.next() * 10, seg: 0 });
      }
    } else if (season === 'christmas') {
      // Fairy lights along the tent's ridge, baubles in the two pines.
      const tx = spot(84);
      const colors = [0xff4a4a, 0xffd25a, 0x5ad0ff, 0x7ae07a];
      for (let i = 0; i < 7; i++) {
        const lx = tx - 15 + i * 5, ly = y - 15 + Math.abs(i - 3) * 2;
        const l = add(sc.add.rectangle(lx, ly, 2, 2, colors[i % 4]).setDepth(DEPTH.decor + 1));
        this.animated.push({ type: 'blink', obj: l, phase: i % 2, seg: 0 });
      }
      [spot(114), spot(128)].forEach((px, k) => {
        for (let i = 0; i < 5; i++) {
          const b = add(sc.add.rectangle(px + rng.int(-6, 6), y - 8 - rng.int(0, 22), 2, 2, colors[(i + k) % 4]).setDepth(DEPTH.decor + 1));
          this.animated.push({ type: 'blink', obj: b, phase: i + k, seg: 0 });
        }
        add(sc.add.rectangle(px, y - 36, 3, 3, 0xffe070).setDepth(DEPTH.decor + 1).setAngle(45));
      });
      for (let i = 0; i < 9; i++) {
        const x = rng.int(10, WORLD_WIDTH - 10);
        if (Math.abs(x - node.x) < 18) continue;
        add(sc.add.image(x, y + rng.int(2, 40), 'decor_snowdrift').setOrigin(0.5, 1).setDepth(DEPTH.decor - 1).setFlipX(rng.chance(0.5)));
      }
    }
  }

  // Base camp comes alive: a campfire with a bench and firewood, crates by
  // the trader, grass along the edge of the meadow and a few butterflies.
  placeCampLife(node, side, rng, add) {
    const sc = this.scene;
    const y = node.y;
    const fx = node.x - side * 84;
    add(sc.add.image(fx - side * 18, y, 'camp_bench').setOrigin(0.5, 1).setDepth(DEPTH.decor).setFlipX(side > 0));
    add(sc.add.image(node.x - side * 116, y, 'camp_wood').setOrigin(0.5, 1).setDepth(DEPTH.decor - 1));
    const glow = add(sc.add.image(fx, y - 6, 'glow').setDepth(DEPTH.decor - 1).setBlendMode('ADD').setTint(0xff9a3c).setScale(1.3).setAlpha(0.35));
    this.animated.push({ type: 'flicker', obj: glow, base: 0.35, phase: 0, seg: 0 });
    const fire = add(sc.add.sprite(fx, y + 1, 'camp_fire', 0).setOrigin(0.5, 1).setDepth(DEPTH.decor + 1));
    this.animated.push({ type: 'fire', obj: fire, seg: 0 });
    // At night the fire lights a big warm pool on the meadow and the rock.
    const pool = add(sc.add.image(fx, y - 14, 'glow').setDepth(DEPTH.light + 1).setBlendMode('ADD').setTint(0xff8a3c).setScale(4.2, 3).setAlpha(0));
    this.animated.push({ type: 'nightlight', obj: pool, base: 0.42, phase: 1, seg: 0 });
    const reduced = sc.effects && sc.effects.reduced;
    add(sc.add.particles(fx, y - 12, 'puff', {
      frequency: reduced ? 700 : 320, lifespan: 2600, speedX: { min: -4, max: 6 }, speedY: { min: -16, max: -9 },
      alpha: { start: 0.35, end: 0 }, scale: { start: 0.6, end: 2 }, tint: 0xb8b4c0,
    }).setDepth(DEPTH.decor));
    add(sc.add.particles(fx, y - 8, 'px2', {
      frequency: reduced ? 600 : 260, lifespan: 1100, speedX: { min: -10, max: 10 }, speedY: { min: -36, max: -18 },
      alpha: { start: 1, end: 0 }, scale: { start: 0.5, end: 0.5 }, tint: [0xffd25a, 0xff9a3c], blendMode: 'ADD',
    }).setDepth(DEPTH.decor + 2));
    // Crates stacked behind the trader's stall.
    const cx = Math.round(node.x + side * 54);
    add(sc.add.image(cx, y, 'camp_crate').setOrigin(0.5, 1).setDepth(DEPTH.decor - 1));
    add(sc.add.image(cx + side * 4, y - 9, 'camp_crate').setOrigin(0.5, 1).setDepth(DEPTH.decor - 1).setFlipX(true));
    // Grass tufts and flowers along the edge of the meadow, clear of the climber.
    for (let x = 4; x < WORLD_WIDTH; x += rng.int(9, 17)) {
      if (Math.abs(x - node.x) < 14) continue;
      const front = rng.chance(0.35);
      add(sc.add.image(x, y + (front ? 3 : 1), 'camp_tuft', rng.int(0, 2)).setOrigin(0.5, 1).setDepth(front ? DEPTH.climber + 1 : DEPTH.decor - 1).setFlipX(rng.chance(0.5)));
    }
    // Bushes, rocks and flowers dotted over the meadow (off the path).
    for (let i = 0; i < 14; i++) {
      const dy = rng.int(14, 88);
      const x = rng.int(10, WORLD_WIDTH - 10);
      const pathX = node.x + Math.sin(dy / 22) * 16 + Math.sin(dy / 9) * 3;
      if (Math.abs(x - pathX) < 16) continue;
      const kind = rng.pick(['decor_rocks', 'decor_fern', 'camp_tuft', 'camp_tuft', 'decor_flowers', 'decor_grass']);
      const img = sc.add.image(x, y + dy, kind, kind === 'camp_tuft' ? rng.int(0, 2) : undefined).setOrigin(0.5, 1).setDepth(DEPTH.decor).setFlipX(rng.chance(0.5));
      // Sink into the same shade as the meadow further down.
      img.setTint(lerpColor(0xffffff, 0x1f3326, Math.min(1, dy / 125) * 0.78));
      add(img);
    }
    // The meadow in bloom: drifts of wildflowers, tall grass swaying in the
    // breeze, mossy boulders, mushrooms, and pollen drifting in the sun.
    if (sc.textures.exists('meadow_flowers_0')) {
      // Drifts: a handful of patches, each one kind of flower, thinning out.
      const place = (key, x, dy, grass = false) => {
        const pathX = node.x + Math.sin(dy / 22) * 16 + Math.sin(dy / 9) * 3;
        if (Math.abs(x - pathX) < 14 || x < 4 || x > WORLD_WIDTH - 4) return;
        const img = sc.add.sprite(x, y + dy, key, 0).setOrigin(0.5, 1).setDepth(DEPTH.decor + dy * 0.001).setFlipX(rng.chance(0.5));
        img.setTint(lerpColor(0xffffff, 0x1f3326, Math.min(1, dy / 125) * 0.7));
        add(img);
        if (grass) this.animated.push({ type: 'grass', obj: img, phase: x * 0.07, seg: 0 });
      };
      for (let d = 0; d < 11; d++) {
        const cx = rng.int(20, WORLD_WIDTH - 20), cy = rng.int(10, 92), kind = d % 5;
        const n = rng.int(3, 6);
        for (let k = 0; k < n; k++) place(`meadow_flowers_${kind}`, Math.round(cx + rng.range(-16, 16)), Math.round(cy + rng.range(-6, 8)));
      }
      for (let i = 0; i < 16; i++) place('meadow_grass', rng.chance(0.5) ? rng.int(4, 120) : rng.int(WORLD_WIDTH - 120, WORLD_WIDTH - 4), rng.int(8, 100), true);
      for (let i = 0; i < 4; i++) place(i % 2 ? 'meadow_stone' : 'meadow_mush', rng.int(20, WORLD_WIDTH - 20), rng.int(14, 90));
      const reducedP = sc.effects && sc.effects.reduced;
      add(sc.add.particles(0, y + 30, 'px2', {
        x: { min: 0, max: WORLD_WIDTH }, y: { min: -30, max: 50 }, frequency: reducedP ? 900 : 260, lifespan: 6000,
        speedX: { min: -5, max: 8 }, speedY: { min: -6, max: -1 }, scale: { start: 0.5, end: 0.5 },
        alpha: { onEmit: () => 0, onUpdate: (p, k, t) => Math.sin(t * Math.PI) * 0.7 }, tint: [0xfff4c8, 0xffffff, 0xf0e8a0],
      }).setDepth(DEPTH.decor + 3));
    }
    // Pine boughs in the near foreground: they slide away faster than the wall
    // as you leave base camp.
    const camY0 = node.y - 50 - GAME_HEIGHT * CAMERA_ANCHOR;
    const by = Math.round(GAME_HEIGHT + 6 + camY0 * 1.35);
    add(sc.add.image(-6, by, 'fg_branch').setOrigin(0, 1).setScrollFactor(1, 1.35).setDepth(DEPTH.foreground + 1));
    add(sc.add.image(WORLD_WIDTH + 6, by - 4, 'fg_branch').setOrigin(0, 1).setFlipX(true).setOrigin(1, 1).setScrollFactor(1, 1.35).setDepth(DEPTH.foreground + 1));
    [0xf2c14e, 0xf4efe4, 0x9fd8ff].forEach((tint, i) => {
      const b = add(sc.add.sprite(0, 0, 'butterfly', 0).setDepth(DEPTH.decor + 2).setTint(tint));
      this.animated.push({ type: 'butterfly', obj: b, x: node.x + (i - 1) * 90 + rng.int(-10, 10), y: y - 14 - i * 5, phase: rng.next() * 10, seg: 0 });
    });
  }

  // A mountain hut in the colours of its biome, with smoke from the chimney
  // and a warm glow at the lantern and windows.
  placeHut(x, node, add) {
    const sc = this.scene;
    const biome = biomeAt(levelToMeters(node.level));
    const left = x - HUT_SIZE.w / 2, top = node.y - HUT_SIZE.h;
    add(sc.add.image(x, node.y + 1, `hut_${biome.id}`).setOrigin(0.5, 1).setDepth(DEPTH.decor));
    const lamp = add(sc.add.image(left + HUT_SIZE.lantern.x, top + HUT_SIZE.lantern.y, 'glow_small').setDepth(DEPTH.decor + 1).setBlendMode('ADD').setTint(0xffc060).setScale(1.6).setAlpha(0.5));
    this.animated.push({ type: 'flicker', obj: lamp, base: 0.5, phase: x, seg: this.mountain.getLevel(node.level).segIndex });
    const reduced = sc.effects && sc.effects.reduced;
    add(sc.add.particles(left + HUT_SIZE.chimney.x, top + HUT_SIZE.chimney.y, 'puff', {
      frequency: reduced ? 900 : 450, lifespan: 3000, speedX: { min: 2, max: 9 }, speedY: { min: -14, max: -8 },
      alpha: { start: 0.4, end: 0 }, scale: { start: 0.5, end: 1.8 }, tint: 0xd8d4dc,
    }).setDepth(DEPTH.decor - 1));
  }

  finishWall(v, job) {
    const tm = this.scene.textures;
    if (tm.exists(v.texKey)) tm.remove(v.texKey);
    tm.addCanvas(v.texKey, job.canvas);
    v.image = this.scene.add.image(0, job.top, v.texKey).setOrigin(0, 0).setDepth(DEPTH.wall);
    if (job.rim) {
      v.rims = ['l', 'r'].map((side) => {
        const key = `${v.texKey}_rim${side}`;
        if (tm.exists(key)) tm.remove(key);
        tm.addCanvas(key, job.rim[side]);
        return this.scene.add.image(0, job.top, key).setOrigin(0, 0).setDepth(DEPTH.wall + 1).setBlendMode('ADD').setAlpha(0);
      });
      this.applyRim(v);
      v.shades = ['sl', 'sr'].map((side) => {
        const key = `${v.texKey}_${side}`;
        if (tm.exists(key)) tm.remove(key);
        tm.addCanvas(key, job.rim[side]);
        return this.scene.add.image(0, job.top, key).setOrigin(0, 0).setDepth(DEPTH.wall + 1).setTint(0x0a0814).setAlpha(0);
      });
      if (this.sun) this.applySun(v);
    }
  }

  // Every flat decoration (trees, huts, cairns, tents, rocks...) gets a dark
  // copy of itself as a cast shadow, moved by the sun (see setSun). Things that
  // give light (fires, lamps, vents, crystals) get a pool of light at night.
  addShadowsAndLights(v, seg) {
    const sc = this.scene;
    const list = v.shadows || (v.shadows = []);
    for (const o of v.objects.slice()) {
      if (!o.active || o.type !== 'Image' || o.blendMode !== 0 || o.depth !== DEPTH.decor) continue;
      const key = o.texture.key;
      if (!key || key.startsWith('glow')) continue;
      if (o.originY < 0.5) continue; // hanging things (icicles, chains)
      const sh = sc.add.image(o.x, o.y, key, o.frame.name).setOrigin(o.originX, o.originY).setFlipX(o.flipX)
        .setScale(o.scaleX, o.scaleY * 0.55).setTintFill(0x0a0814).setAlpha(0).setDepth(DEPTH.decor - 2);
      v.objects.push(sh);
      list.push({ img: sh, x: o.x, y: o.y, alpha: 0.32, len: 3, skew: true });
      const glow = LIGHT_OF.find(([k]) => key.includes(k));
      if (glow) {
        const g = sc.add.image(o.x, o.y - o.displayHeight * 0.4, 'glow').setBlendMode('ADD').setTint(glow[1]).setScale(glow[2]).setAlpha(0).setDepth(DEPTH.light + 1);
        v.objects.push(g);
        this.animated.push({ type: 'nightlight', obj: g, base: glow[3], phase: o.x, seg: seg.index });
      }
    }
    if (this.sun) this.applySun(v);
  }

  // The sun's (or moon's) direction and strength: { dx, dy, shadow, shade, side }.
  setSun(sun) {
    const key = `${sun.dx.toFixed(1)}|${sun.dy.toFixed(1)}|${sun.shadow.toFixed(2)}`;
    this.sun = sun;
    if (key === this.sunKey) return;
    this.sunKey = key;
    for (const v of this.visuals.values()) this.applySun(v);
  }

  applySun(v) {
    const sun = this.sun;
    for (const s of v.shadows || []) {
      const len = s.len;
      s.img.setPosition(Math.round(s.x + sun.dx * len), Math.round(s.y + sun.dy * (s.skew ? 0.6 : len)));
      if (s.skew) s.img.setAngle(-sun.dx * 6);
      s.img.setAlpha(s.alpha * sun.shadow);
    }
    if (v.shades) {
      v.shades[0].setAlpha(sun.side === 'r' ? sun.shade : sun.shade * 0.25);
      v.shades[1].setAlpha(sun.side === 'l' ? sun.shade : sun.shade * 0.25);
    }
  }

  // The light of the hour along the wall's edges: { l: [color, alpha], r: [color, alpha] }.
  setRim(light) {
    this.rimLight = light;
    for (const v of this.visuals.values()) this.applyRim(v);
  }

  applyRim(v) {
    if (!v.rims || !this.rimLight) return;
    ['l', 'r'].forEach((side, i) => {
      const [color, alpha] = this.rimLight[side];
      v.rims[i].setTint(color).setAlpha(alpha).setVisible(alpha > 0.01);
    });
  }

  // Forces every queued wall to finish (used at startup / respawn).
  flush() {
    for (const job of this.jobs) {
      while (!job.done) job.step(1000);
      const v = this.visuals.get(job.segment.index);
      if (v && !v.image) this.finishWall(v, job);
    }
    this.jobs = [];
  }

  // A chalky handprint on a hold you have used (once per hold).
  addChalk(nodeId, tint) {
    const lv = this.mountain.getLevel(parseInt(nodeId, 10));
    const v = lv && this.visuals.get(lv.segIndex);
    const hold = v && v.holds.get(nodeId);
    if (!hold) return;
    v.chalked = v.chalked || new Set();
    if (v.chalked.has(nodeId)) return;
    v.chalked.add(nodeId);
    const mark = this.scene.add.image(hold.x + Math.round(Math.random() * 2 - 1), hold.y - 3, 'chalk_mark', Math.floor(Math.random() * 3))
      .setDepth(DEPTH.holds + 1).setTint(tint).setAlpha(0);
    this.scene.tweens.add({ targets: mark, alpha: 0.85, duration: 300 });
    v.objects.push(mark);
  }

  // CHALK MARKS: YOUR LINE. A faint dotted chalk line from the hold you left
  // to the one you reached, so looking down shows the way you came.
  addChalkLine(from, to, tint) {
    const lv = this.mountain.getLevel(to.level);
    const v = lv && this.visuals.get(lv.segIndex);
    if (!v) return;
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    if (len < 12 || len > 220) return;
    const g = this.scene.add.graphics().setDepth(DEPTH.holds - 1).setAlpha(0);
    // Leave a gap around each hold so the dots never cover one. Each dot has
    // a dark pixel under it so it reads on pale rock and dark rock alike.
    for (let d = 8; d <= len - 8; d += 4) {
      const x = Math.round(from.x + (dx * d) / len), y = Math.round(from.y + (dy * d) / len);
      g.fillStyle(0x16141f, 0.45).fillRect(x, y + 1, 1, 1);
      g.fillStyle(tint, 1).fillRect(x, y, 1, 1);
    }
    this.scene.tweens.add({ targets: g, alpha: 0.85, duration: 500 });
    v.objects.push(g);
  }

  getHold(nodeId) {
    const lv = this.mountain.getLevel(parseInt(nodeId, 10));
    if (!lv) return null;
    const v = this.visuals.get(lv.segIndex);
    return v ? v.holds.get(nodeId) || null : null;
  }

  waterfallNear(y) {
    for (const v of this.visuals.values()) {
      if (v.waterfallX === undefined) continue;
      const top = levelToY(v.seg.endLevel), bottom = levelToY(v.seg.startLevel);
      if (y > top - 200 && y < bottom + 200) return true;
    }
    return false;
  }

  removeSegment(index) {
    const v = this.visuals.get(index);
    if (!v) return;
    v.objects.forEach((o) => o.destroy());
    if (v.image) v.image.destroy();
    [...(v.rims || []), ...(v.shades || [])].forEach((img) => { const key = img.texture.key; img.destroy(); if (this.scene.textures.exists(key)) this.scene.textures.remove(key); });
    if (this.trader && !this.trader.active) this.trader = null;
    if (this.scene.textures.exists(v.texKey)) this.scene.textures.remove(v.texKey);
    this.animated = this.animated.filter((a) => a.seg !== index);
    this.jobs = this.jobs.filter((j) => j.segment.index !== index);
    this.visuals.delete(index);
  }

  destroy() {
    for (const index of [...this.visuals.keys()]) this.removeSegment(index);
    const list = this.mountain.listeners.remove;
    const i = list.indexOf(this.onRemove);
    if (i >= 0) list.splice(i, 1);
  }
}
