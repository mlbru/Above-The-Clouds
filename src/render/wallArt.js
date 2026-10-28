// Paints a segment's rock face into a canvas. Noise is sampled in world space so
// neighbouring segments join seamlessly. Painting is sliced into row batches.
import { levelToY, LEVEL_PX, yToMeters } from '../config/gameConfig.js';
import { makeNoise2D, hashInts, SeededRandom } from '../utils/seededRandom.js';
import { biomeMixAt } from '../data/biomes.js';
import { overlaysFor, ledgeTopColor } from './wallOverlays.js';
import { rgb, bayer, lerpColor } from '../utils/color.js';
import { makeCanvas } from '../utils/pixelGrid.js';

const W = 480;
// Deep enough for a tall portrait screen looking down at base camp.
export const BASE_GROUND_PX = 260;

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
    // Sky islands: no wall, every hold and ledge is a rock floating in the sky.
    const islands = segment.islands ? segment.levels.flatMap((lv) => lv.nodes).map((n) => (n.kind === 'ledge'
      ? { x: n.x, top: n.y, rx: 56, depth: 30 }
      : { x: n.x, top: n.y - 5, rx: n.kind === 'jug' ? 17 : 14, depth: 22 })) : null;
    const job = {
      segment, canvas, ctx, img, top, h, row: 0, done: false, waterfallX, islands,
      prevRows: [this.heightRow(top - 3), this.heightRow(top - 2), this.heightRow(top - 1)],
      step: (maxRows) => {
        const end = Math.min(h, job.row + maxRows);
        for (; job.row < end; job.row++) this.paintRow(job, mountain, ledges);
        if (job.row >= h) {
          if (!job.islands) this.paintCracks(job, cracks);
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
    const { el, er } = this.edgeOffsets(wy, mix.a.wall.edge);
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
      this.paintGround(job, base, wy);
      job.prevRows = [job.prevRows[1], job.prevRows[2], hRow];
      return;
    }
    if (job.islands) {
      this.paintIslands(job, base, wy, mix.a);
      job.prevRows = [job.prevRows[1], job.prevRows[2], hRow];
      return;
    }

    const gap = segment.chasm ? {
      x: 240 + (this.edge(wy * 0.03, 3.3) - 0.5) * 16,
      half: 40 + (this.edge(wy * 0.06, 7.7) - 0.5) * 14,
    } : null;
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
      // Big soft patches of light and shade break up the face.
      v += (this.edge(x * 0.011 + 40, wy * 0.009) - 0.5) * 0.32;
      // Sun from the left: the left edge catches light, the right falls into shade.
      const fromL = x - l, fromR = r - x;
      if (fromL < 12) v += (12 - fromL) * 0.018;
      if (fromR < 22) v -= (22 - fromR) * 0.012;
      // Broad rock plates with a dark seam where a plate drops away.
      const s = Math.floor(h * 5), sUp = Math.floor(hUp1[x] * 5);
      const seam = s < sUp && dn > 0.35;
      const dEdge = Math.min(x - l, r - x);
      if (dEdge < 6) v -= (6 - dEdge) * (x - l < r - x ? 0.03 : 0.07);
      let idx = Math.floor(v * 3.4 + 0.3 + (bayer(x, wy) - 0.5) * 0.7);
      if (seam) idx = 0;
      else if (s > sUp) idx = Math.max(idx, 3);
      // Gentle rock layers: a darker band with a lit lip every ~40 px, wavy.
      const band = ((wy + Math.round((this.edge(x * 0.03, wy * 0.004) - 0.5) * 14)) % 41 + 41) % 41;
      if (dEdge > 3 && !seam) {
        if (band === 0) idx = Math.min(idx, 1);
        else if (band === 1) idx = Math.max(0, idx - 1);
        else if (band === 40 && idx < 4) idx += 1;
      }
      let c = rock[Math.max(0, Math.min(4, idx))];
      if (dEdge < 1) c = pal.outline;
      else if (fromL === 1) c = rock[4];

      // Biome overlays
      p.x = x; p.c = c; p.idx = idx; p.lit = idx >= 3; p.seam = seam; p.dEdge = dEdge; p.dn = dn; p.pal = pal;
      p.ov = this.overlay(x * 0.05, wy * 0.05);
      for (const fn of pal === mix.a ? overlaysA : overlaysB) fn(p);
      c = p.c;
      if (job.waterfallX !== null && Math.abs(x - job.waterfallX) < 9) c = lerpColor(c, 0x2a4a6a, 0.45);
      if (gap) {
        // The Crevasse: a deep blue gap between the two ice walls.
        const d = Math.abs(x - gap.x);
        if (d < gap.half) {
          const k = Math.pow(1 - d / gap.half, 0.6);
          c = lerpColor(0x2a4a78, 0x060c1a, k);
          if (bayer(x, wy) < 0.08 * (1 - k) || (d > gap.half - 3 && bayer(x, wy) < 0.4)) c = 0x5a8ac0;
        } else if (d < gap.half + 2) c = x < gap.x ? pal.rock[4] : pal.outline;
      }
      this.put(img, base + x * 4, c);
    }

    this.paintEdge(img, base, wy, l, r, mix.a);

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

  // How far the wall's outline wanders from its bounds on this row. Each biome
  // has its own outline: rounded (default), stepped blocks, or sharp facets.
  edgeOffsets(wy, style) {
    if (style === 'blocks') {
      // Stacked granite blocks: the outline holds for a block, then steps.
      const q = Math.floor(wy / 12) * 12;
      const step = (v) => Math.round(v / 4) * 4;
      return {
        el: step((this.edge(q * 0.05, 1.3) - 0.5) * 18),
        er: step((this.edge(q * 0.05, 5.7) - 0.5) * 18),
      };
    }
    let el = (this.edge(wy * 0.05, 1.3) - 0.5) * 16 + (this.edge(wy * 0.4, 9.1) - 0.5) * 4;
    let er = (this.edge(wy * 0.05, 5.7) - 0.5) * 16 + (this.edge(wy * 0.4, 2.2) - 0.5) * 4;
    if (style === 'jagged') {
      // Sharp glassy facets: each band slants outwards, then snaps back.
      // Warped and with varying depth, so no two facets are alike.
      const saw = (v, p) => (((v % p) + p) % p) / p - 0.5;
      const wl = wy + this.edge(wy * 0.02, 3.3) * 40, wr = wy + this.edge(wy * 0.02, 8.8) * 40;
      el = el * 0.6 + saw(wl, 14) * (4 + this.edge(wy * 0.03, 4.4) * 12);
      er = er * 0.6 - saw(wr, 17) * (4 + this.edge(wy * 0.03, 6.6) * 12);
    }
    return { el, er };
  }

  // Things growing out of (or hanging off) the wall's outline, per biome:
  // icicles, rime feathers, crystal shards, dragon spines, cloud puffs, vines.
  paintEdge(img, base, wy, l, r, pal) {
    const style = pal.wall.edge;
    if (!style || style === 'blocks' || style === 'jagged') return;
    const seed = this.seed;
    for (const side of [-1, 1]) {
      const ex = side < 0 ? l : r;
      const set = (dx, c) => {
        const x = ex + side * dx;
        if (x < 0 || x >= W || c === null) return;
        const i = base + x * 4;
        if (!img.data[i + 3]) this.put(img, i, c);
      };
      if (style === 'icicles') {
        // A little snow shelf juts out, and a row of icicles hangs from it.
        const P = 26, off = side < 0 ? 0 : 13;
        const k = ((wy + off) % P + P) % P;
        const hsh = hashInts(Math.floor((wy + off) / P), side, seed);
        if (hsh % 3 === 0) continue;
        const shelf = 5 + (hsh >> 3) % 3;
        if (k === 0) { for (let dx = 1; dx <= shelf; dx++) set(dx, 0xffffff); set(shelf + 1, pal.rock[1]); continue; }
        if (k === 1) { for (let dx = 1; dx <= shelf; dx++) set(dx, dx === shelf ? pal.rock[1] : pal.accentA); set(shelf + 1, pal.rock[1]); continue; }
        for (let sp = 0; sp < 3; sp++) {
          const dx = 2 + sp * 2;
          if (dx > shelf) break;
          const len = 5 + ((hsh >> (5 + sp * 3)) % 11);
          const d = k - 2;
          if (d >= len) continue;
          set(dx, d === len - 1 ? 0xffffff : d < len / 2 ? pal.accentB : pal.accentC);
          set(dx + 1, d < len / 3 ? pal.accentC : pal.rock[1]);
        }
      } else if (style === 'rime') {
        // Wind-blown rime: short feathers of frost pointing away from the wall.
        const hsh = hashInts(wy, side, seed);
        if (hsh % 3) continue;
        const len = 1 + (hsh >> 3) % 5;
        for (let dx = 1; dx <= len; dx++) set(dx, dx === len ? 0xffffff : pal.accentB);
        set(len + 1, pal.rock[1]);
      } else if (style === 'shards') {
        // Crystal shards jut out and up from the wall, two-tone facets.
        const P = 30, k = ((wy + (side < 0 ? 0 : 15)) % P + P) % P;
        const hsh = hashInts(Math.floor((wy + (side < 0 ? 0 : 15)) / P), side, seed + 9);
        const len = 10 + (hsh % 8);
        if ((hsh >> 5) % 3 === 0 || k >= len) continue;
        const off = Math.round((len - k) * 0.7);
        for (let w = 0; w < 4; w++) set(off + w - 1, k === 0 ? 0xffffff : w === 0 ? 0xffffff : w < 2 ? pal.accentB : w < 3 ? pal.accentA : pal.accentC);
        set(off + 3, pal.outline);
        if (off > 1) set(off - 2, pal.outline);
      } else if (style === 'spines') {
        // The dragon's spines: curved ivory horns sticking out of the rock.
        const P = 26, k = ((wy + (side < 0 ? 0 : 13)) % P + P) % P;
        const hsh = hashInts(Math.floor((wy + (side < 0 ? 0 : 13)) / P), side, seed + 3);
        if ((hsh >> 3) % 3 === 0 || k > 9) continue;
        const len = Math.round((9 - Math.abs(k - 5) * 1.8) * (0.8 + (hsh % 4) * 0.12));
        for (let dx = 1; dx <= len; dx++) set(dx, k > 6 ? 0x8a6a4a : dx === len ? 0xfff4d8 : k < 3 ? 0xf0e0c0 : 0xd8c0a0);
        set(len + 1, pal.outline);
      } else if (style === 'puffs') {
        // Clouds hug the wall: soft bumps of white clinging to the outline.
        const P = 22, k = ((wy + (side < 0 ? 0 : 11)) % P + P) % P;
        const hsh = hashInts(Math.floor((wy + (side < 0 ? 0 : 11)) / P), side, seed + 5);
        if (hsh % 3 === 0) continue;
        const rr = 7 + (hsh >> 2) % 5;
        const dy = k - rr;
        if (Math.abs(dy) > rr) continue;
        const w = Math.round(Math.sqrt(rr * rr - dy * dy));
        for (let dx = 1; dx <= w; dx++) set(dx, dy < -rr * 0.4 ? 0xffffff : dy > rr * 0.5 ? 0xc8c0e2 : 0xece8f6);
        set(w + 1, 0xa8a0c8);
      } else if (style === 'vines') {
        // Ivy hangs off the edge: a dark strand with bright leaves, now and then.
        const P = 34, k = ((wy + (side < 0 ? 0 : 17)) % P + P) % P;
        const hsh = hashInts(Math.floor((wy + (side < 0 ? 0 : 17)) / P), side, seed + 7);
        const len = 10 + (hsh % 16);
        if (hsh % 2 || k >= len) continue;
        const sway = Math.round(Math.sin(k * 0.5 + hsh) * 1.2) + 2;
        set(sway, pal.accentA);
        if (k % 3 === 1) set(sway + 1, pal.accentC);
        if (k % 4 === 2) set(sway - 1, pal.accentB);
      }
    }
  }

  // Cracks: a black core with a shadowed left lip and a lit right lip, and
  // now and then a plant (or snow, or a glint) growing out of them.
  paintCracks(job, cracks) {
    const { img, top, h, segment } = job;
    const shade = (i, d) => {
      if (!img.data[i + 3]) return;
      for (let k = 0; k < 3; k++) img.data[i + k] = Math.max(0, Math.min(255, img.data[i + k] + d));
    };
    const rng = new SeededRandom(hashInts(segment.seed, 77));
    for (const pts of cracks) {
      pts.forEach(([x, y], n) => {
        const row = y - top;
        if (row < 0 || row >= h - 1 || x < 2 || x >= W - 2) return;
        const i = (row * W + x) * 4;
        if (img.data[i + 3] === 0) return;
        this.put(img, i, 0x14121a);
        this.put(img, i + W * 4, 0x14121a);
        shade(i - 4, -38);
        shade(i + 4, 34);
        shade(i + 8, 12);
        if (n % 6 === 3 && rng.chance(0.35)) this.paintSprout(img, x, row, h, biomeMixAt(yToMeters(y)).a, rng);
      });
    }
  }

  paintSprout(img, x, row, h, pal, rng) {
    const set = (dx, dy, c) => {
      const rr = row + dy, xx = x + dx;
      if (rr < 0 || rr >= h || xx < 0 || xx >= W) return;
      const i = (rr * W + xx) * 4;
      if (img.data[i + 3]) this.put(img, i, c);
    };
    const id = pal.id;
    if (id === 'frozen') { set(0, -1, 0xffffff); set(1, -1, 0xeef6ff); set(-1, 0, 0xeef6ff); return; }
    if (id === 'obsidian' || id === 'crystal' || id === 'storm' || id === 'dragon') { set(1, 0, pal.accentC); set(1, -1, 0xffffff); return; }
    if (id === 'aurora') { set(0, -1, 0xffffff); set(1, -1, pal.accentB); set(-1, 0, pal.accentA); return; }
    const leaf = pal.accentC || 0x86ad58, dark = pal.accentA || 0x3f6a3c;
    const side = rng.chance(0.5) ? 1 : -1;
    set(side, 0, dark); set(side * 2, -1, leaf); set(side * 3, -1, leaf); set(side, -2, leaf); set(side * 2, -3, dark);
    if (id === 'green' && rng.chance(0.4)) set(side * 3, -3, rng.chance(0.5) ? 0xf2c14e : 0xf4efe4);
  }

  // One row of floating islands: a grassy top, rock that tapers to a rounded
  // underside (lit from the left), and roots dangling below.
  paintIslands(job, base, wy, pal) {
    const { img } = job;
    for (const isl of job.islands) {
      const d = wy - isl.top;
      if (d < -3 || d > isl.depth + 6) continue;
      const x0 = Math.max(0, Math.round(isl.x - isl.rx - 1)), x1 = Math.min(W - 1, Math.round(isl.x + isl.rx + 1));
      for (let x = x0; x <= x1; x++) {
        const dx = x - isl.x;
        const seed = (x * 7919 + isl.top * 31) >>> 0;
        let c = null;
        if (d < 0) {
          // Grass blades and the odd flower sticking up over the top edge.
          if (Math.abs(dx) < isl.rx - 2 && seed % 5 === 0 && -d <= 1 + (seed % 3)) c = seed % 23 === 0 ? 0xf2c14e : pal.accentC;
        } else {
          const t = Math.max(0, (d - 3) / (isl.depth - 3));
          const half = isl.rx * (d < 3 ? 1 : Math.sqrt(Math.max(0, 1 - Math.pow(t, 1.5))));
          if (Math.abs(dx) <= half) {
            const edge = half - Math.abs(dx) < 1.2;
            if (d === 0) c = edge ? pal.accentA : pal.accentC;
            else if (d < 3) c = edge ? pal.outline : (seed % 4 ? pal.accentB : pal.accentA);
            else {
              const n = this.detail(x * 0.2, wy * 0.2);
              let idx = 3 - Math.floor(t * 3) + (dx < -half * 0.3 ? 1 : dx > half * 0.4 ? -1 : 0) + (n > 0.62 ? 1 : n < 0.3 ? -1 : 0);
              if (d === 3) idx = 0;
              c = edge ? pal.outline : pal.rock[Math.max(0, Math.min(4, idx))];
            }
          }
          // Roots hanging out of the underside.
          if (c === null && seed % 11 === 0 && d > isl.depth * 0.5 && d < isl.depth + 6) {
            const tip = isl.depth * Math.sqrt(Math.max(0, 1 - Math.pow(dx / isl.rx, 2)));
            if (d > tip && d < tip + 2 + (seed % 5)) c = seed % 2 ? pal.accentA : pal.outline;
          }
        }
        if (c !== null) this.put(img, base + x * 4, c);
      }
    }
  }

  // The meadow under base camp: a bright grass lip, blades and wild flowers,
  // a dirt path winding down from the camp and small rounded stones, all
  // sinking into shade further down.
  paintGround(job, base, wy) {
    const { img, segment } = job;
    if (job.campX === undefined) { job.campX = segment.levels[0].nodes[0].x; job.ground = biomeMixAt(0).a.ground || null; }
    const prev = job.stonePrev || new Uint8Array(W);
    const cur = new Uint8Array(W);
    const shade = Math.min(1, wy / 125) * 0.78;
    const px = job.campX + Math.sin(wy / 22) * 16 + Math.sin(wy / 9) * 3;
    const pw = 6 + wy * 0.05;
    for (let x = 0; x < W; x++) {
      let c;
      const dp = Math.abs(x - px);
      if (wy < 2) c = (x * 7 + 3) % 5 === 0 ? 0xb8e070 : 0x9ad65f;
      else if (wy > 2 && dp < pw) {
        c = dp > pw - 1.5 ? 0x7a5a38 : 0xa8865a;
        if (this.detail(x * 0.5, wy * 0.5) > 0.74) c = 0x8a6a44;
        if (this.detail(x * 0.9 + 9, wy * 0.9) > 0.84) c = 0xc8a878;
      } else {
        const n = this.detail(x * 0.15, wy * 0.22);
        c = wy < 5 ? 0x7cbc50 : n > 0.55 ? 0x5f9a44 : 0x4f8a3c;
        if (wy > 4 && (x * 13 + Math.floor(wy / 3) * 7) % 11 === 0) c = n > 0.55 ? 0x76b450 : 0x5f9a44;
        if (wy > 4 && wy < 80 && this.overlay(x * 0.9, wy * 0.9) > 0.84 && bayer(x, wy) < 0.3) {
          c = [0xf4efe4, 0xf2c14e, 0xf07ab8, 0x9fd8ff][(x * 3 + wy) % 4];
        }
        if (wy > 8 && this.overlay(x * 0.14 + 50, wy * 0.22) > 0.87) {
          cur[x] = 1;
          c = prev[x] ? (this.detail(x * 0.4, wy * 0.4) > 0.6 ? 0x9a9fa8 : 0x7a7f8a) : 0xc4c8d0;
        } else if (prev[x]) c = 0x2e4a2a;
      }
      // An expedition theme can recolour the meadow (ash below the volcano).
      if (job.ground) c = lerpColor(c, job.ground, 0.7);
      this.put(img, base + x * 4, lerpColor(c, 0x1f3326, shade));
    }
    job.stonePrev = cur;
  }

  put(img, i, c) {
    const [r, g, b] = rgb(c);
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
}
