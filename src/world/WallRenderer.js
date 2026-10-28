import { DEPTH, LEVEL_PX, levelToY, levelToMeters, GAME_WIDTH, GAME_HEIGHT, CAMERA_ANCHOR, WORLD_WIDTH } from '../config/gameConfig.js';
import { WallPainter } from '../render/wallArt.js';
import { holdKey } from '../render/textures.js';
import { biomeAt } from '../data/biomes.js';
import { SeededRandom } from '../utils/seededRandom.js';
import { HUT_SIZE } from '../render/campArt.js';
import { lerpColor } from '../utils/color.js';
import { currentSeason } from '../data/seasons.js';

const DECOR_TEX = {
  grass: 'decor_grass', flowers: 'decor_flowers', fern: 'decor_fern', rocks: 'decor_rocks',
  icicles: 'decor_icicles', snowdrift: 'decor_snowdrift', crystals: 'decor_crystals',
  pine: 'decor_cliffpine',
  piton: 'decor_piton', nest: 'decor_nest', vent: 'decor_vent', chain: 'decor_chain',
  frostfern: 'decor_frostfern', bones: 'decor_bones', coins: 'decor_coins',
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
  volcano: { tint: 0xff6a1a, alpha: 0.25, dx: 0, dy: 1, glow: true },
};

// Milliseconds per frame spent painting walls ahead of the climber.
const WALL_BUDGET_MS = 3;

// Owns all per-segment visuals and releases them when segments are pruned.
export class WallRenderer {
  constructor(scene, mountain, seed) {
    this.scene = scene;
    this.mountain = mountain;
    this.painter = new WallPainter(seed);
    this.visuals = new Map();
    this.jobs = [];
    this.animated = [];
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
      if (a.type === 'foam') a.obj.setFrame(Math.floor(t / 150 + a.phase) % 2);
      if (a.type === 'flags') a.obj.setFrame(Math.floor(t / 350 + a.phase) % 2);
      if (a.type === 'trader') a.obj.setFrame(Math.floor(t / 140) % 26 === 0 ? 1 : Math.floor(t / 900) % 2 ? 2 : 0);
      if (a.type === 'fire') a.obj.setFrame(Math.floor(t / 110) % 3);
      // Fire and lamps glow brighter as night falls.
      if (a.type === 'flicker') a.obj.setAlpha((a.base + Math.sin(t / 90 + a.phase) * 0.06 + Math.sin(t / 37 + a.phase) * 0.04) * (0.6 + (this.night || 0) * 1.1));
      if (a.type === 'blink') a.obj.setAlpha(Math.floor(t / 520 + a.phase) % 2 ? 1 : 0.25);
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
        const key = holdKey(biome.id, node.kind, node.hazard);
        // A soft shadow under each hold so it sits on the rock instead of on top
        // of it; ice, crystal and aurora holds glow faintly instead.
        const look = HOLD_SHADOW[biome.id] || HOLD_SHADOW.default;
        const shadow = this.scene.add.image(node.x + look.dx, node.y + 3 + look.dy, key).setDepth(DEPTH.holds - 1).setTintFill(look.tint).setAlpha(look.alpha);
        if (look.glow) shadow.setBlendMode('ADD').setScale(1.3);
        const s = this.scene.add.image(node.x, node.y + 3, key).setDepth(DEPTH.holds);
        v.holds.set(node.id, s);
        v.objects.push(shadow, s);
      }
    }
    for (const d of seg.decor) {
      const biome = biomeAt(levelToMeters(d.level));
      const key = (biome.decor && biome.decor[d.type]) || DECOR_TEX[d.type];
      if (!key) continue;
      const img = this.scene.add.image(d.x, d.y, key).setDepth(DEPTH.decor).setFlipX(d.side > 0);
      // Things that hang (icicles, chains) hang from their top.
      if (key === 'decor_icicles' || key === 'decor_chain') img.setOrigin(0.5, 0);
      // Cliff pines root in the rock and lean out over the edge.
      else if (key.startsWith('decor_cliffpine')) img.setOrigin(d.side > 0 ? 0.25 : 0.75, 0.95);
      else img.setOrigin(0.5, 1);
      v.objects.push(img);
    }
    if (seg.rest) this.placeRestDecor(seg, v, rng);
    if (seg.waterfall) {
      const top = levelToY(seg.endLevel) - LEVEL_PX / 2;
      const bottom = levelToY(seg.startLevel) + LEVEL_PX / 2;
      const xs = seg.levels.map((lv) => (seg.waterfall.side < 0 ? lv.bounds.l + 14 : lv.bounds.r - 14));
      const x = seg.waterfall.side < 0 ? Math.max(...xs) : Math.min(...xs);
      const wf = this.scene.add.tileSprite(x, top, 10, bottom - top, 'waterfall').setOrigin(0.5, 0).setDepth(DEPTH.wall + 1).setAlpha(0.9);
      // A source at the top and a foaming shelf with spray at the bottom, so
      // the water never starts or stops in mid-air.
      const head = this.scene.add.sprite(x, top + 6, 'waterfall_top', 0).setOrigin(0.5, 1).setDepth(DEPTH.wall + 2);
      const foot = this.scene.add.sprite(x, bottom, 'waterfall_splash', 0).setOrigin(0.5, 12 / 20).setDepth(DEPTH.wall + 2);
      const reduced = this.scene.effects && this.scene.effects.reduced;
      const spray = this.scene.add.particles(x, bottom - 6, 'px2', {
        frequency: reduced ? 220 : 90, lifespan: 600, speedX: { min: -22, max: 22 }, speedY: { min: -38, max: -12 }, gravityY: 110,
        alpha: { start: 0.85, end: 0 }, tint: [0xffffff, 0xd8eeff, 0x8ec5f0],
      }).setDepth(DEPTH.wall + 3);
      v.objects.push(wf, head, foot, spray);
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
      const img = this.scene.add.image(left ? -rng.int(4, 18) : WORLD_WIDTH + rng.int(4, 18), midY * 1.35, `fg_${biome.id}`)
        .setOrigin(0, 0.5).setScrollFactor(1, 1.35).setDepth(DEPTH.foreground).setFlipX(!left);
      if (!left) img.setOrigin(1, 0.5);
      v.objects.push(img);
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
      const lamp = add(this.scene.add.image(tx + (side > 0 ? -10 : 10), node.y - 23, 'glow_small').setDepth(DEPTH.decor + 1).setBlendMode('ADD').setTint(0xffc060).setScale(1.4).setAlpha(0.45));
      this.animated.push({ type: 'flicker', obj: lamp, base: 0.45, phase: 3, seg: seg.index });
    }
    if (type === 'camp') {
      add(this.scene.add.image(spot(84), node.y, 'decor_tent').setOrigin(0.5, 1).setDepth(DEPTH.decor));
      add(this.scene.add.image(node.x - side * 40, node.y, 'decor_sign').setOrigin(0.5, 1).setDepth(DEPTH.decor));
      // Where things stand at camp (the title screen uses them as its menu).
      this.campSpots = { ...(this.campSpots || {}), tent: { x: spot(84), y: node.y }, sign: { x: node.x - side * 40, y: node.y }, fire: { x: node.x - side * 84, y: node.y } };
      if (this.trader) this.campSpots.trader = { x: this.trader.x, y: node.y };
      add(this.scene.add.image(spot(114), node.y, 'decor_pine').setOrigin(0.5, 1).setDepth(DEPTH.decor));
      add(this.scene.add.image(spot(128), node.y, 'decor_pine').setOrigin(0.5, 1).setDepth(DEPTH.decor).setFlipX(true));
      if (seg.index === 0) this.placeCampLife(node, side, rng, add);
      if (seg.index === 0 && !this.scene.tutorial) this.placeSeason(node, side, spot, rng, add);
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
