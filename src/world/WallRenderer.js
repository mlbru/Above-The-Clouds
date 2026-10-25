import { DEPTH, LEVEL_PX, levelToY, levelToMeters, GAME_WIDTH } from '../config/gameConfig.js';
import { WallPainter } from '../render/wallArt.js';
import { holdKey } from '../render/textures.js';
import { biomeAt } from '../data/biomes.js';
import { SeededRandom } from '../utils/seededRandom.js';

const DECOR_TEX = {
  grass: 'decor_grass', flowers: 'decor_flowers', fern: 'decor_fern', pine: 'decor_pine', rocks: 'decor_rocks',
  icicles: 'decor_icicles', snowdrift: 'decor_snowdrift', crystals: 'decor_crystals',
};

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
    // anything that is about to scroll into view.
    const start = performance.now();
    for (const job of this.jobs) {
      const v = this.visuals.get(job.segment.index);
      const urgent = v && job.top + job.h > viewTopY - 40 && job.top < viewBottomY + 40;
      while (!job.done && (urgent || performance.now() - start < 5)) job.step(urgent ? 400 : 24);
      if (job.done && v && !v.image) this.finishWall(v, job);
      if (!urgent && performance.now() - start >= 5) break;
    }
    this.jobs = this.jobs.filter((j) => !j.done);
    const t = this.scene.time.now;
    for (const a of this.animated) {
      if (a.type === 'waterfall') a.obj.tilePositionY -= dt * 0.09;
      if (a.type === 'flags') a.obj.setFrame(Math.floor(t / 350 + a.phase) % 2);
      if (a.type === 'trader') a.obj.setFrame(Math.floor(t / 140) % 26 === 0 ? 1 : 0);
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
        const s = this.scene.add.image(node.x, node.y + 3, holdKey(biome.id, node.kind, node.hazard)).setDepth(DEPTH.holds);
        v.holds.set(node.id, s);
        v.objects.push(s);
      }
    }
    for (const d of seg.decor) {
      const biome = biomeAt(levelToMeters(d.level));
      const key = (biome.decor && biome.decor[d.type]) || DECOR_TEX[d.type];
      if (!key) continue;
      const img = this.scene.add.image(d.x, d.y, key).setDepth(DEPTH.decor).setFlipX(d.side > 0);
      if (d.type === 'icicles') img.setOrigin(0.5, 0);
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
      v.objects.push(wf);
      v.waterfallX = x;
      this.animated.push({ type: 'waterfall', obj: wf, seg: seg.index });
    }
    // Foreground outcrops with stronger parallax frame the scene.
    if (seg.index > 0 && rng.chance(0.6)) {
      const biome = biomeAt(levelToMeters(seg.startLevel));
      const left = rng.chance(0.5);
      const midY = levelToY((seg.startLevel + seg.endLevel) / 2);
      const img = this.scene.add.image(left ? -rng.int(4, 18) : GAME_WIDTH + rng.int(4, 18), midY * 1.35, `fg_${biome.id}`)
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
    }
    if (type === 'camp') {
      add(this.scene.add.image(spot(70), node.y, 'decor_tent').setOrigin(0.5, 1).setDepth(DEPTH.decor));
      add(this.scene.add.image(node.x - side * 40, node.y, 'decor_sign').setOrigin(0.5, 1).setDepth(DEPTH.decor));
      add(this.scene.add.image(spot(104), node.y, 'decor_pine').setOrigin(0.5, 1).setDepth(DEPTH.decor));
      add(this.scene.add.image(spot(118), node.y, 'decor_pine').setOrigin(0.5, 1).setDepth(DEPTH.decor).setFlipX(true));
    } else if (type === 'hut') {
      add(this.scene.add.image(spot(64), node.y, 'decor_hut').setOrigin(0.5, 1).setDepth(DEPTH.decor));
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
