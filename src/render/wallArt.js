// Paints a segment's rock face into a canvas. Noise is sampled in world space so
// neighbouring segments join seamlessly. Painting is sliced into row batches.
import { levelToY, LEVEL_PX, yToMeters } from '../config/gameConfig.js';
import { makeNoise2D, hashInts, SeededRandom } from '../utils/seededRandom.js';
import { biomeMixAt } from '../data/biomes.js';
import { overlaysFor, ledgeTopColor } from './wallOverlays.js';
import { rgb, bayer, lerpColor } from '../utils/color.js';
import { makeCanvas } from '../utils/pixelGrid.js';

const W = 480;
export const BASE_GROUND_PX = 150;

export class WallPainter {
  constructor(seed) {
    this.seed = seed;
    this.stepNoise = makeNoise2D(hashInts(seed, 1));
    this.detail = makeNoise2D(hashInts(seed, 2));
    this.edge = makeNoise2D(hashInts(seed, 3));
    this.overlay = makeNoise2D(hashInts(seed, 4));
    this.ice = makeNoise2D(hashInts(seed, 5));
  }

  // Returns a job object; call job.step(maxRows) until job.done.
  createJob(segment, mountain) {
    const top = levelToY(segment.endLevel) - LEVEL_PX / 2;
    let bottom = levelToY(segment.startLevel) + LEVEL_PX / 2;
    if (segment.index === 0) bottom = BASE_GROUND_PX;
    const h = bottom - top;
    const canvas = makeCanvas(W, h);
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(W, h);
    const ledges = segment.levels.filter((lv) => lv.nodes.length && lv.nodes[0].kind === 'ledge').map((lv) => ({ y: lv.nodes[0].y, bounds: lv.bounds }));
    const cracks = this.makeCracks(segment);
    let waterfallX = null;
    if (segment.waterfall) {
      const xs = segment.levels.map((lv) => (segment.waterfall.side < 0 ? lv.bounds.l + 14 : lv.bounds.r - 14));
      waterfallX = segment.waterfall.side < 0 ? Math.max(...xs) : Math.min(...xs);
    }
    const job = {
      segment, canvas, ctx, img, top, h, row: 0, done: false, waterfallX,
      prevRows: [this.heightRow(top - 3), this.heightRow(top - 2), this.heightRow(top - 1)],
      step: (maxRows) => {
        const end = Math.min(h, job.row + maxRows);
        for (; job.row < end; job.row++) this.paintRow(job, mountain, ledges);
        if (job.row >= h) {
          this.paintCracks(job, cracks);
          ctx.putImageData(img, 0, 0);
          job.done = true;
        }
        return job.done;
      },
    };
    return job;
  }

  heightRow(wy) {
    const row = new Float32Array(W);
    for (let x = 0; x < W; x++) row[x] = this.stepNoise.fbm(x * 0.02, wy * 0.028, 3);
    return row;
  }

  makeCracks(segment) {
    const rng = new SeededRandom(hashInts(segment.seed, 5));
    const cracks = [];
    const n = segment.features.includes('crack') ? 3 : rng.int(1, 3);
    for (let i = 0; i < n; i++) {
      const lv = segment.levels[rng.int(0, segment.levels.length - 1)];
      const pts = [];
      let x = rng.range(lv.bounds.l + 20, lv.bounds.r - 20), y = levelToY(lv.level) + 10;
      const len = segment.features.includes('crack') && i === 0 ? segment.levels.length * LEVEL_PX : rng.int(30, 90);
      for (let s = 0; s < len; s += 2) {
        pts.push([Math.round(x), Math.round(y)]);
        x += rng.range(-1.2, 1.2);
        y -= 2;
      }
      cracks.push(pts);
    }
    return cracks;
  }

  paintRow(job, mountain, ledges) {
    const { img, top, segment } = job;
    const row = job.row;
    const wy = top + row;
    const levelF = -wy / LEVEL_PX;
    const meters = yToMeters(wy);
    const mix = biomeMixAt(meters);
    const useB = (x) => mix.t > 0 && bayer(x, row) < mix.t;
    const b = mountain.boundsAt(levelF);
    const el = (this.edge(wy * 0.05, 1.3) - 0.5) * 16 + (this.edge(wy * 0.4, 9.1) - 0.5) * 4;
    const er = (this.edge(wy * 0.05, 5.7) - 0.5) * 16 + (this.edge(wy * 0.4, 2.2) - 0.5) * 4;
    const l = Math.round(b.l - 10 + el);
    const r = Math.round(b.r + 10 + er);
    // Height field for this row (cached rows give cheap lighting).
    const hRow = this.heightRow(wy);
    const hUp = job.prevRows[0];
    const hUp1 = job.prevRows[2];
    const base = row * W * 4;
    const overlaysA = overlaysFor(mix.a, segment), overlaysB = overlaysFor(mix.b, segment);
    const p = { wy, painter: this };

    // Ground below base camp.
    if (segment.index === 0 && wy > 0) {
      for (let x = 0; x < W; x++) {
        const d = wy;
        let c = d < 2 ? 0x8fc85a : d < 6 ? 0x6fa84a : 0x4f8a3c;
        if (d > 6) c = lerpColor(0x4f8a3c, 0x2c4a2a, Math.min(1, d / 120));
        const n = this.detail(x * 0.2, wy * 0.2);
        if (d > 3 && n > 0.72 && bayer(x, wy) < 0.6) c = 0x79b24c;
        if (d > 3 && n < 0.18) c = 0x3c6a34;
        if (d > 8 && this.overlay(x * 0.05, wy * 0.07) > 0.78) c = 0x7a7f8a;
        this.put(img, base + x * 4, c);
      }
      job.prevRows = [job.prevRows[1], job.prevRows[2], hRow];
      return;
    }

    for (let x = Math.max(0, l); x <= Math.min(W - 1, r); x++) {
      const pal = useB(x) ? mix.b : mix.a;
      const rock = pal.rock;
      const h = hRow[x];
      const hUL = hUp[Math.max(0, x - 3)];
      const dn = this.detail(x * 0.09, wy * 0.09);
      // Light from the upper left: compare with the height field up-left.
      const grain = this.detail(x * 0.31, wy * 0.31) - 0.5;
      const slope = Math.max(-0.28, Math.min(0.28, (h - hUL) * 12));
      let v = 0.56 + slope + (h - 0.5) * 0.3 + (dn - 0.5) * 0.18 + grain * 0.22;
      // Broad rock plates with a dark seam where a plate drops away.
      const s = Math.floor(h * 5), sUp = Math.floor(hUp1[x] * 5);
      const seam = s < sUp && dn > 0.35;
      const dEdge = Math.min(x - l, r - x);
      if (dEdge < 6) v -= (6 - dEdge) * (x - l < r - x ? 0.03 : 0.07);
      let idx = Math.floor(v * 3.4 + 0.3 + (bayer(x, wy) - 0.5) * 0.7);
      if (seam) idx = 0;
      else if (s > sUp) idx = Math.max(idx, 3);
      let c = rock[Math.max(0, Math.min(4, idx))];
      if (dEdge < 1) c = pal.outline;

      // Biome overlays
      p.x = x; p.c = c; p.idx = idx; p.lit = idx >= 3; p.seam = seam; p.dEdge = dEdge; p.dn = dn; p.pal = pal;
      p.ov = this.overlay(x * 0.05, wy * 0.05);
      for (const fn of pal === mix.a ? overlaysA : overlaysB) fn(p);
      c = p.c;
      if (job.waterfallX !== null && Math.abs(x - job.waterfallX) < 9) c = lerpColor(c, 0x2a4a6a, 0.45);
      this.put(img, base + x * 4, c);
    }

    // Rest ledges protrude past the wall.
    for (const lg of ledges) {
      const d = wy - lg.y;
      if (d < -3 || d > 11) continue;
      const pal = mix.a;
      const ll = Math.round(lg.bounds.l - 16 + el * 0.5), lr = Math.round(lg.bounds.r + 16 + er * 0.5);
      for (let x = Math.max(0, ll); x <= Math.min(W - 1, lr); x++) {
        let c;
        const lip = Math.min(x - ll, lr - x);
        if (d < 0) c = lip < 2 ? pal.outline : ledgeTopColor(pal);
        else if (d === 0) c = pal.rock[4];
        else if (d < 7) c = d === 6 ? pal.outline : pal.rock[d < 3 ? 3 : 2];
        else c = bayer(x, wy) < (11 - d) / 6 ? pal.rock[0] : null;
        if (d < 0 && pal.wall.ledgeFringe && ((x * 7) % 5 === 0) && d === -3) c = pal.accentA;
        if (lip < 1 && d >= 0 && d < 7) c = pal.outline;
        if (c !== null) this.put(img, base + x * 4, c);
      }
    }
    job.prevRows = [job.prevRows[1], job.prevRows[2], hRow];
  }

  paintCracks(job, cracks) {
    const { img, top, h } = job;
    for (const pts of cracks) {
      for (const [x, y] of pts) {
        const row = y - top;
        if (row < 0 || row >= h - 1 || x < 1 || x >= W - 1) continue;
        const i = (row * W + x) * 4;
        if (img.data[i + 3] === 0) continue;
        this.put(img, i, 0x14121a);
        this.put(img, i + W * 4, 0x14121a);
        const j = (row * W + x + 1) * 4;
        if (img.data[j + 3]) {
          const r = Math.min(255, img.data[j] + 30), g = Math.min(255, img.data[j + 1] + 30), b = Math.min(255, img.data[j + 2] + 30);
          img.data[j] = r; img.data[j + 1] = g; img.data[j + 2] = b;
        }
      }
    }
  }

  put(img, i, c) {
    const [r, g, b] = rgb(c);
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
}
