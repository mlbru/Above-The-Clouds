// Paints a segment's rock face into a canvas. Noise is sampled in world space so
// neighbouring segments join seamlessly. Painting is sliced into row batches.
import { levelToY, LEVEL_PX, yToMeters } from '../config/gameConfig.js';
import { makeNoise2D, hashInts, SeededRandom } from '../utils/seededRandom.js';
import { biomeMixAt } from '../data/biomes.js';
import { overlaysFor, ledgeTopColor } from './wallOverlays.js';
import { hangKind, hangColor } from './roofArt.js';
import { rgb, bayer, lerpColor } from '../utils/color.js';
import { makeCanvas } from '../utils/pixelGrid.js';

const W = 480;

// PROTOTYPE (?rock=new): the rock face as big angled plates instead of
// dithered blotches. Each plate tilts its own way and takes the light from
// the upper left (lit, mid or shadowed), with a dark seam between plates, a
// lit lip along a plate's top edge and a shadow under the plate above.
// Per biome the plates have their own shape: layered blocks on the Stone
// Wall, tall black shards in the Obsidian Spires, riveted panels on the
// Clockwork Bastion...
export const ROCK_FACETS = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('rock') === 'new';
const FACET = {
  default: { cw: 42, ch: 30, jit: 0.9, cut: 0.5 },
  green: { cw: 40, ch: 30, jit: 0.95, cut: 0.4 },
  stone: { cw: 58, ch: 24, jit: 0.85, cut: 0.55 },
  frozen: { cw: 46, ch: 38, jit: 0.95, cut: 0.6 },
  clouds: { cw: 44, ch: 32, jit: 0.9, cut: 0.4 },
  hive: { cw: 20, ch: 17, jit: 0.35, stagger: true, cut: 0.9 },
  obsidian: { cw: 16, ch: 54, jit: 0.8, cut: 0.7 },
  crystal: { cw: 20, ch: 42, jit: 0.85, cut: 0.65 },
  clockwork: { cw: 38, ch: 24, jit: 0.06, stagger: true, cut: 1 },
  storm: { cw: 44, ch: 28, jit: 0.9, cut: 0.5 },
  aurora: { cw: 48, ch: 36, jit: 0.95, cut: 0.5 },
  bones: { cw: 30, ch: 24, jit: 0.9, cut: 0.5 },
  dragon: { cw: 26, ch: 20, jit: 0.6, stagger: true, cut: 0.8 },
  cascade: { cw: 16, ch: 56, jit: 0.4, stagger: true, cut: 0.7 },
  monastery: { cw: 34, ch: 22, jit: 0.3, stagger: true, cut: 0.8 },
  moss: { cw: 50, ch: 40, jit: 0.95, cut: 0.35 },
  reef: { cw: 44, ch: 24, jit: 0.8, cut: 0.45 },
  starfall: { cw: 26, ch: 34, jit: 0.9, cut: 0.85 },
};
const hash2 = (x, y, s) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
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
    // Ledges whose shelf or shadow reaches into this canvas, including the
    // neighbours' (a ledge's shadow can fall into the section below it).
    const ledges = [];
    for (let lvl = segment.startLevel - 2; lvl <= segment.endLevel + 2; lvl++) {
      const lv = segment.levels.find((x) => x.level === lvl) || (mountain.getLevel && mountain.getLevel(lvl));
      if (lv && lv.nodes.length && lv.nodes[0].kind === 'ledge' && lv.bounds) ledges.push({ y: lv.nodes[0].y, bounds: lv.bounds });
    }
    const cracks = this.makeCracks(segment);
    // Overhangs whose underside or shadow reaches into this canvas.
    const roofs = [segment, mountain.getSegment && mountain.getSegment(segment.index + 1)].filter((s) => s && s.roof).map((s) => s.roof);
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
      segment, canvas, ctx, img, top, h, row: 0, done: false, waterfallX, islands, roofs,
      // The wall's outline per row, for the rim light (see paintRim).
      edges: new Array(h),
      prevRows: [this.heightRow(top - 3), this.heightRow(top - 2), this.heightRow(top - 1)],
      step: (maxRows) => {
        const end = Math.min(h, job.row + maxRows);
        for (; job.row < end; job.row++) this.paintRow(job, mountain, ledges);
        if (job.row >= h) {
          if (!job.islands) this.paintCracks(job, cracks);
          ctx.putImageData(img, 0, 0);
          if (!job.islands) job.rim = this.paintRim(job);
          job.done = true;
        }
        return job.done;
      },
    };
    return job;
  }

  // Rim light: two white masks hugging the left and right outline of the
  // wall, brightest on the very edge and fading a few pixels in. The climb
  // tints them with the light of the hour and shows the side facing the sun.
  paintRim(job) {
    const make = (side) => {
      const c = makeCanvas(W, job.h);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      const fall = [1, 0.62, 0.32, 0.16, 0.07];
      for (let row = 0; row < job.h; row++) {
        const e = job.edges[row];
        if (!e) continue;
        const [l, r] = e;
        // Where the outline steps sideways (a ledge lip, an overhang), the
        // light catches the step too: widen the rim there.
        const prev = job.edges[row - 1];
        const step = prev ? Math.min(6, Math.abs((side < 0 ? prev[0] - l : prev[1] - r))) : 0;
        fall.forEach((a, k) => {
          ctx.globalAlpha = a;
          const x = side < 0 ? l + 1 + k : r - 1 - k;
          ctx.fillRect(x, row, 1, 1);
        });
        if (step > 1) {
          ctx.globalAlpha = 0.5;
          if (side < 0) ctx.fillRect(Math.min(l, prev[0]) + 1, row, step, 1);
          else ctx.fillRect(Math.max(r, prev[1]) - step, row, step, 1);
        }
      }
      ctx.globalAlpha = 1;
      return c;
    };
    // Shade: a wide soft band inside each edge, for the side turned away from
    // the light (the wall's own shadow on itself).
    const shade = (side) => {
      const c = makeCanvas(W, job.h);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      const depth = 26;
      for (let row = 0; row < job.h; row++) {
        const e = job.edges[row];
        if (!e) continue;
        const [l, r] = e;
        for (let k = 0; k < depth; k++) {
          ctx.globalAlpha = Math.pow(1 - k / depth, 1.6);
          ctx.fillRect(side < 0 ? l + k : r - k, row, 1, 1);
        }
      }
      ctx.globalAlpha = 1;
      return c;
    };
    return { l: make(-1), r: make(1), sl: shade(-1), sr: shade(1) };
  }

  // The plate under (x, wy): nearest of a jittered grid of plate centres,
  // stretched to the biome's plate shape. Returns its light (0..1) and
  // whether the pixel is on a seam, a plate's lit top lip, or in the shadow
  // under the plate above.
  facet(x, wy, st) {
    const iy0 = Math.floor(wy / st.ch);
    let d1 = 1e9, d2 = 1e9, b1 = null, b2 = null;
    for (let dy = -1; dy <= 1; dy++) {
      const iy = iy0 + dy;
      const shift = st.stagger && (iy & 1) ? 0.5 : 0;
      const ix0 = Math.floor(x / st.cw - shift);
      for (let dx = -1; dx <= 1; dx++) {
        const ix = ix0 + dx;
        const px = (ix + shift + 0.5 + (hash2(ix, iy, 1) - 0.5) * st.jit) * st.cw;
        const py = (iy + 0.5 + (hash2(ix, iy, 2) - 0.5) * st.jit) * st.ch;
        const u = (x - px) / st.cw, v = (wy - py) / st.ch;
        const d = u * u + v * v;
        const c = { ix, iy, px, py };
        if (d < d1) { d2 = d1; b2 = b1; d1 = d; b1 = c; } else if (d < d2) { d2 = d; b2 = c; }
      }
    }
    // Distance to the border between the two nearest plates, in pixels.
    const edge = (Math.sqrt(d2) - Math.sqrt(d1)) * Math.min(st.cw, st.ch) * 0.5;
    // The plate's tilt: lit when it faces up and left.
    const nx = hash2(b1.ix, b1.iy, 3) * 2 - 1, ny = hash2(b1.ix, b1.iy, 4) * 2 - 1;
    let v = 0.55 - nx * 0.16 - ny * 0.2;
    // Within a plate: lighter towards its top, falling into shade at its foot.
    v -= ((wy - b1.py) / st.ch) * 0.18;
    // Big soft patches of light and shade across many plates.
    v += (this.edge(x * 0.008 + 40, wy * 0.007) - 0.5) * 0.3;
    const above = b2.py < b1.py - st.ch * 0.25;
    const below = b2.py > b1.py + st.ch * 0.25;
    // Only some borders are cut deep (a crack with a lit lip and a shadow);
    // the rest are just a change of plane, so it reads as broken rock, not masonry.
    const lo = b1.ix * 7919 + b1.iy < b2.ix * 7919 + b2.iy ? b1 : b2, hi = lo === b1 ? b2 : b1;
    const cut = hash2(lo.ix * 31 + hi.ix, lo.iy * 31 + hi.iy, 5) < st.cut;
    const wob = (hash2(x >> 2, wy >> 2, 6) - 0.5) * 0.8;
    return {
      v,
      seam: cut && edge + wob < 0.9,
      lip: cut && edge < 2.2 && above,
      under: cut && edge < 4.5 && below,
    };
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
    // Where one biome meets the next, the new rock creeps in as organic
    // tongues (frost, moss, lava cracks...) rather than a flat dither: a noise
    // field decides which pixels have turned, with a lit rim along the front.
    const blending = mix.t > 0 && mix.a !== mix.b;
    const creep = (x) => 0.62 * this.ice(x * 0.045 + 7, wy * 0.03) + 0.2 * this.detail(x * 0.2 + 3, wy * 0.2) + 0.18 * bayer(x, row);
    const useB = (x) => blending && creep(x) < mix.t;
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

    job.edges[row] = [l, r];
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
      let facetSeam = false;
      if (ROCK_FACETS) {
        const f = this.facet(x, wy, FACET[pal.id] || FACET.default);
        // Broad light: the sunward edge brighter, the far edge in shade.
        let fv = f.v;
        if (fromL < 12) fv += (12 - fromL) * 0.012;
        if (fromR < 22) fv -= (22 - fromR) * 0.01;
        if (dEdge < 6) fv -= (6 - dEdge) * 0.04;
        idx = Math.max(1, Math.min(4, Math.round(fv * 3.2 + 0.4)));
        if (f.seam) { idx = 0; facetSeam = true; }
        else if (f.lip) idx = Math.min(4, idx + 1);
        else if (f.under) idx = Math.max(1, idx - 1);
        // Grain: a few loose single pixels, no dither.
        else if (hash2(x, wy, 7) < 0.05) idx = Math.max(1, Math.min(4, idx + (hash2(x, wy, 9) < 0.5 ? -1 : 1)));
      }
      // Gentle rock layers: a darker band with a lit lip every ~40 px, wavy.
      const band = ((wy + Math.round((this.edge(x * 0.03, wy * 0.004) - 0.5) * 14)) % 41 + 41) % 41;
      if (dEdge > 3 && !seam && !facetSeam && !ROCK_FACETS) {
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
      if (blending && dEdge > 1) {
        const f = creep(x) - mix.t;
        if (f < 0 && f > -0.035) c = mix.b.rock[4];
        else if (f >= 0 && f < 0.025) c = lerpColor(c, mix.a.outline, 0.4);
      }
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
    this.paintRoof(job, base, wy, l, r, mix.a);

    // Rest ledges: a real shelf of rock. A walkable top (pebbles, grass or
    // snow), a lit front lip, a shaded face with a ragged underside, ends that
    // taper and round off, and a soft shadow cast onto the wall below.
    for (const lg of ledges) {
      const d = wy - lg.y;
      if (d < -8 || d > 40) continue;
      const pal = mix.a;
      const rock = pal.rock;
      const snow = pal.weather && pal.weather.snow > 0.3;
      const grass = !!pal.wall.ledgeFringe;
      const top = ledgeTopColor(pal);
      const ll = Math.round(lg.bounds.l - 16 + el * 0.5), lr = Math.round(lg.bounds.r + 16 + er * 0.5);
      for (let x = Math.max(0, ll); x <= Math.min(W - 1, lr); x++) {
        const lip = Math.min(x - ll, lr - x);
        const t = Math.min(1, lip / 16);
        const ease = t * t * (3 - 2 * t);
        const n = this.edge(x * 0.09, lg.y * 0.013);
        const n2 = this.detail(x * 0.31, lg.y * 0.07);
        // The ends sit lower and thinner: a rounded tip instead of a plank end.
        const topD = -4 + Math.round((1 - ease) * 3);
        // Underneath: a thick lip of rock with chunky teeth hanging off it.
        const cell = Math.floor((x + Math.round(n * 5)) / 7);
        const tooth = hashInts(cell, lg.y, 61) % 4 === 0 ? Math.round((4 + (hashInts(cell, 9) % 7)) * (1 - Math.abs(((x + Math.round(n * 5)) % 7) - 3) / 4)) : 0;
        const bottomD = Math.round(3 + ease * (10 + n * 8 + tooth));
        let c = null;
        if (d < topD) {
          // Above the top: grass blades or snow that pokes up, sparse and uneven.
          if (grass && d >= topD - 2 && n2 > 0.62 && (x * 7 + lg.y) % 3 === 0) c = d === topD - 1 ? pal.accentB : pal.accentC;
          else if (snow && d === topD - 1 && n2 > 0.45) c = 0xf4f8ff;
        } else if (d < 0) {
          // The top: lit, speckled with small stones; snow lies on it up high.
          const k = (d - topD) / Math.max(1, -topD);
          c = snow ? (k < 0.5 ? 0xf4f8ff : 0xd8e4f4) : lerpColor(top, rock[4], 0.25 + 0.25 * (1 - k));
          if (!snow && n2 > 0.72) c = rock[2];
          else if (!snow && n2 < 0.12) c = rock[4];
          if (grass && d === -1 && n2 > 0.4) c = pal.accentA;
          if (d === topD && lip >= 2) c = snow ? 0xffffff : lerpColor(top, 0xffffff, 0.2);
        } else if (d === 0) {
          c = snow ? 0xe8f0fa : rock[4];
        } else if (d < bottomD) {
          // The face: lit from the upper left, darker as it goes under.
          const k = (d - 1) / Math.max(1, bottomD - 1);
          const v = 3.2 - k * 3 + (n2 - 0.5) * 1.2 + (x - ll < 24 ? 0.4 : 0) + (bayer(x, wy) - 0.5) * 0.6;
          c = rock[Math.max(0, Math.min(4, Math.round(v)))];
          // Icicles or snow drips hang over the lip up high.
          if (snow && d <= 2 + Math.round(n * 3) && (x + Math.round(n * 9)) % 7 === 0) c = 0xcfe6fa;
          // Grass strands hanging over the edge low down.
          if (grass && d <= 1 + Math.round(n2 * 4) && (x * 5 + lg.y) % 6 === 0) c = pal.accentB;
          if (d === bottomD - 1) c = pal.outline;
        } else if (x >= l + 1 && x <= r - 1) {
          // The shadow it throws on the wall, fading with distance.
          const k = (d - bottomD) / 14;
          if (k < 1 && bayer(x, wy) < (1 - k) * 0.55) c = rock[0];
        }
        if (c !== null && lip < 1 && d >= topD && d < bottomD) c = pal.outline;
        if (c !== null) this.put(img, base + x * 4, c);
      }
    }
    job.prevRows = [job.prevRows[1], job.prevRows[2], hRow];
  }

  // Overhangs (idea sheet 1.3): the rock here juts out over you, so what you
  // see is its underside. In shadow, crossed by the layers of the ceiling,
  // the lip at the bottom lit by the sky below and hung with drips, and a
  // soft shadow thrown onto the wall underneath.
  paintRoof(job, base, wy, l, r, pal) {
    const roofs = job.roofs;
    if (!roofs || !roofs.length) return;
    const { img } = job;
    for (const rf of roofs) {
      const d = wy - rf.top;
      if (d < 0 || d > rf.bottom - rf.top + 52) continue;
      for (let x = Math.max(0, l); x <= Math.min(W - 1, r); x++) {
        const i = base + x * 4;
        if (!img.data[i + 3]) continue;
        // A ragged lip: the roof ends a little higher or lower along its length.
        const span = rf.bottom - rf.top + Math.round((this.edge(x * 0.07, rf.bottom * 0.013) - 0.5) * 12);
        const c0 = (img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2];
        let c = c0;
        if (d <= span) {
          const prof = Math.sin(Math.max(0, Math.min(1, d / span)) * Math.PI);
          c = lerpColor(c0, pal.rock[0], 0.25 + 0.35 * prof);
          // Ceiling layers seen from below: wavy bands, each lit on its underside.
          const band = (wy + Math.round(this.edge(x * 0.04, rf.top * 0.01) * 10)) % 9;
          if (band === 0) c = lerpColor(c, pal.outline, 0.5);
          else if (band === 1) c = lerpColor(c, pal.rock[2], 0.4);
          // The lip: a thick edge of rock, its face lit by the sky below.
          if (span - d < 5) c = span - d < 1 ? lerpColor(pal.rock[4], 0xffffff, 0.25) : span - d < 3 ? pal.rock[3] : lerpColor(pal.rock[2], pal.rock[3], bayer(x, wy) < 0.5 ? 1 : 0);
        } else {
          // Below: drips hanging off the lip, and the roof's shadow on the wall.
          // Below: the biome's hangings off the lip (icicles, roots, honey,
          // glass), and the roof's shadow thrown down the wall.
          const k = d - span;
          if (k >= 40) continue;
          const col = Math.floor(x / 3), h = hashInts(col, rf.top, 31);
          const kind = hangKind(pal.id);
          const len = h % 3 === 0 ? 4 + (h >> 4) % (kind === 'root' ? 28 : 20) : 0;
          const cx = col * 3 + 1 + (kind === 'root' ? Math.round(Math.sin(k * 0.3 + col) * 1) : 0);
          const half = kind === 'root' ? 0 : Math.max(0, Math.round((1 - k / Math.max(1, len)) * 1.2));
          if (k < len && Math.abs(x - cx) <= half) c = hangColor(kind, pal, k, len, x, x < cx);
          else if (bayer(x, wy) < 0.62 * (1 - k / 40)) c = lerpColor(c0, pal.rock[0], 0.6);
          else continue;
        }
        this.put(img, i, c);
      }
    }
  }

  // How far the wall's outline wanders from its bounds on this row. Each biome
  // has its own outline: rounded (default), stepped blocks, or sharp facets.
  edgeOffsets(wy, style) {
    if (style === 'blocks' || style === 'cogs') {
      // Stacked granite blocks (or the bastion's masonry): the outline holds
      // for a block, then steps.
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
      } else if (style === 'honey') {
        // Honey oozes over the edge and hangs in long drips with a fat bead.
        const P = 30, k = ((wy + (side < 0 ? 0 : 15)) % P + P) % P;
        const hsh = hashInts(Math.floor((wy + (side < 0 ? 0 : 15)) / P), side, seed + 11);
        if (hsh % 3 === 0) continue;
        const len = 6 + (hsh >> 2) % 14, dx = 2 + (hsh >> 6) % 3;
        if (k === 0) { for (let d = 1; d <= dx + 2; d++) set(d, d === dx + 2 ? pal.outline : pal.accentB); continue; }
        if (k > len + 2) continue;
        if (k > len) { set(dx - 1, k === len + 1 ? pal.accentB : pal.accentA); set(dx, pal.accentA); set(dx + 1, pal.accentA); set(dx + 2, pal.outline); continue; }
        set(dx, k < 3 ? pal.accentB : pal.accentA);
        set(dx + 1, pal.outline);
      } else if (style === 'cogs') {
        // Half-sunk gears stick out of the bastion walls, teeth and all.
        const P = 38, k = ((wy + (side < 0 ? 0 : 19)) % P + P) % P;
        const hsh = hashInts(Math.floor((wy + (side < 0 ? 0 : 19)) / P), side, seed + 13);
        if (hsh % 3 === 0) continue;
        const rr = 7 + (hsh >> 2) % 5, dy = k - rr - 2;
        if (Math.abs(dy) > rr + 2) continue;
        for (let dx = 1; dx <= rr + 3; dx++) {
          const d = Math.hypot(dx - 1, dy), a = Math.atan2(dy, dx - 1);
          const outer = rr + (Math.cos(a * 9) > 0.3 ? 2 : 0);
          if (d > outer + 1) continue;
          set(dx, d > outer ? pal.outline : d < 2.5 ? pal.rock[0] : d > rr - 2 ? (dy < 0 ? pal.accentB : pal.accentA) : pal.rock[2]);
        }
      } else if (style === 'ribs') {
        // Bones jut out of the rock edge: long ribs curling up or down, short
        // broken stubs and now and then a knuckle of spine, all different.
        const P = 24, off = side < 0 ? 0 : 12, k = ((wy + off) % P + P) % P;
        const hsh = hashInts(Math.floor((wy + off) / P), side, seed + 17);
        const kind = hsh % 5;
        if (kind === 0) continue;
        const L = kind === 4 ? 5 : 6 + (hsh >> 3) % 12;
        if (k > L + 1) continue;
        if (kind === 4) {
          // A vertebra: a round knob with a spike.
          const dy = k - 3, w = Math.round(Math.sqrt(Math.max(0, 9 - dy * dy)));
          for (let dx = 1; dx <= w + 1; dx++) set(dx, dy < -1 ? 0xfff6e0 : dy > 1 ? 0xb8a888 : 0xe8dcc0);
          if (k === 3) { set(w + 2, 0xd8ccb0); set(w + 3, 0xd8ccb0); set(w + 4, pal.outline); }
          else set(w + 2, pal.outline);
          continue;
        }
        const reach = 5 + (hsh >> 8) % 10;
        const up = (hsh >> 12) % 2 === 0;
        const thick = (hsh >> 14) % 3 === 0 ? 2 : 1;
        const broken = (hsh >> 16) % 4 === 0;
        // Curl: up-ribs leave low and rise, down-ribs leave high and droop.
        const kk = up ? L - k : k;
        const curve = (q) => Math.round(reach * Math.sin(Math.min(1, q / L) * Math.PI / 2) ** (up ? 0.7 : 1.4));
        if (k > L) continue;
        const a = kk === 0 ? 1 : curve(kk - 1) + 1, b = curve(kk) + 1;
        const end = broken ? Math.round(reach * 0.6) : 99;
        for (let dx = Math.min(a, b); dx <= Math.min(end, Math.max(a, b) + thick); dx++) {
          set(dx, k === 0 ? 0xfff6e0 : k === L ? 0xa89878 : k < L / 2 ? 0xf0e4c8 : 0xd0c0a0);
        }
        set(Math.min(end, Math.max(a, b) + thick) + 1, broken && Math.max(a, b) > end ? 0x8a7a64 : pal.outline);
      } else if (style === 'falls') {
        // The Cascade: thin threads of water spill off the edge, a bright
        // lip where they leave the rock, falling a long way in a slight arc.
        const P = 40, off = side < 0 ? 0 : 20, k = ((wy + off) % P + P) % P;
        const hsh = hashInts(Math.floor((wy + off) / P), side, seed + 19);
        if (hsh % 3 === 0) continue;
        if (k === 0) { set(1, pal.accentC); set(2, 0xffffff); set(3, pal.outline); continue; }
        const dx = 2 + Math.min(4, Math.floor(Math.sqrt(k) * 0.9));
        set(dx, (k + (hsh >> 4)) % 5 === 0 ? 0xffffff : pal.accentC);
        if ((hsh >> 6) % 2 && k > 8) set(dx + 2, (k + (hsh >> 4)) % 3 === 0 ? 0xc8e8f0 : null);
        if (k % 9 === 4) set(dx - 1, 0x9ad0e0);
      } else if (style === 'eaves') {
        // The Hanging Monastery: a little temple roof built out from the edge
        // now and then, red posts under gold-tipped, upturned eaves.
        const P = 64, off = side < 0 ? 0 : 32, k = ((wy + off) % P + P) % P;
        const hsh = hashInts(Math.floor((wy + off) / P), side, seed + 23);
        if (hsh % 2) {
          // Prayer flags strung out from the rock instead.
          if (k < 2) for (let dx = 1; dx <= 9; dx++) set(dx, k === 0 ? 0x3a2418 : null);
          else if (k < 6) { const cols = [0x4a8ae8, 0xf0f0e8, 0xe84a3a, 0x5ac86a, 0xf2c252]; for (let dx = 2; dx <= 9; dx += 2) set(dx, cols[(dx / 2 + (hsh >> 3)) % 5]); }
          continue;
        }
        const len = 12;
        if (k === 0) { set(len + 1, pal.accentB); continue; }
        if (k < 4) {
          // The roof: dark tiles, sweeping up at the tip.
          for (let dx = 1; dx <= len - (k === 1 ? 0 : k); dx++) set(dx, k === 1 ? 0x5a2a1c : dx % 2 ? 0x3a1a12 : 0x2a120c);
          if (k === 1) set(len, pal.accentB);
          set(len + 1 - (k === 1 ? 0 : k), pal.outline);
          continue;
        }
        if (k < 18) {
          // Under the eaves: a red beam end, then the post.
          if (k === 4) { for (let dx = 1; dx <= 9; dx++) set(dx, pal.accentA); set(10, pal.outline); continue; }
          set(8, k % 6 === 0 ? pal.accentB : pal.accentA); set(9, 0x6a1812); set(10, pal.outline);
          if (k === 8) set(6, pal.accentB);
          if (k === 9) { set(6, 0xb8862a); set(5, 0xb8862a); }
        }
      } else if (style === 'roots') {
        // The Moss Cathedral: great roots arch out over the edge and back in,
        // bark with a lit top, moss on their backs, fine roots trailing.
        const P = 48, off = side < 0 ? 0 : 24, k = ((wy + off) % P + P) % P;
        const hsh = hashInts(Math.floor((wy + off) / P), side, seed + 29);
        const reach = 6 + (hsh >> 2) % 8, span = 16 + (hsh >> 5) % 16;
        if (hsh % 4 === 0) continue;
        if (k < span) {
          const dx0 = Math.round(Math.sin((k / span) * Math.PI) * reach);
          const th = 3;
          for (let t = 0; t < th; t++) set(dx0 + t, t === 0 && k < span / 2 ? pal.accentB : t === th - 1 ? 0x2a1c10 : 0x6a4e30);
          set(dx0 + th, pal.outline);
          if (k % 5 === 2) set(dx0 - 1, pal.accentA);
        } else if (k < span + 10 && (hsh >> 9) % 2) {
          set(2 + ((k + hsh) % 3 === 0 ? 1 : 0), 0x8a7048);
        }
      } else if (style === 'coral') {
        // The Fossil Reef: sea fans and branching coral, long turned to stone,
        // reach out from the edge; between them, clumps of tube coral.
        const P = 40, off = side < 0 ? 0 : 20, k = ((wy + off) % P + P) % P;
        const hsh = hashInts(Math.floor((wy + off) / P), side, seed + 31);
        if (hsh % 4 === 0) continue;
        if ((hsh >> 3) % 3) {
          // A fan: a stalk from the rock, then a lattice spreading out and up.
          const span = 18 + (hsh >> 6) % 12, reach = 8 + (hsh >> 10) % 8;
          if (k >= span) continue;
          const kk = span - 1 - k;
          const w = Math.round(Math.sin((kk / span) * Math.PI * 0.9 + 0.2) * reach);
          const col = (hsh >> 14) % 2 ? pal.accentA : lerpColor(pal.accentA, pal.accentC, 0.35);
          for (let dx = 1; dx <= w; dx++) {
            const lat = (dx + kk) % 3 === 0 || (dx - kk + 99) % 4 === 0;
            if (lat || dx === w) set(dx, dx === w ? lerpColor(col, 0xffffff, 0.4) : kk < 3 ? lerpColor(col, pal.rock[1], 0.4) : col);
          }
          if (w > 0 && kk % 3 === 0) set(w + 1, pal.outline);
        } else {
          // Tube coral: short round pipes pointing up and out.
          if (k > 12) continue;
          for (let t = 0; t < 3; t++) {
            const top = 3 + t * 3 + ((hsh >> (t * 2)) % 3), dx = 2 + t * 3;
            if (k < 12 - top) continue;
            const c = k === 12 - top ? pal.accentC : k === 13 - top ? lerpColor(pal.accentA, pal.rock[0], 0.5) : pal.accentB;
            set(dx, c); set(dx + 1, k === 12 - top ? pal.accentC : lerpColor(pal.accentB, pal.rock[1], 0.4)); set(dx + 2, pal.outline);
          }
        }
      } else if (style === 'glass') {
        // The Starfall Crater: black glass that ran and froze as it hit:
        // drips hanging off the edge with a green gleam, blades of glass
        // flung outward, and now and then a nugget of glowing star-metal.
        const P = 30, off = side < 0 ? 0 : 15, k = ((wy + off) % P + P) % P;
        const hsh = hashInts(Math.floor((wy + off) / P), side, seed + 37);
        const kind = hsh % 4;
        if (kind === 0) continue;
        if (kind === 1) {
          // A drip: a lip, then a narrowing tear with a bright bead.
          const len = 8 + (hsh >> 3) % 12, dx = 2 + (hsh >> 7) % 3;
          if (k === 0) { for (let d = 1; d <= dx + 2; d++) set(d, d === dx + 2 ? pal.outline : pal.rock[2]); continue; }
          if (k > len + 1) continue;
          if (k >= len) { set(dx, k === len ? 0xd8ffe8 : pal.accentA); set(dx + 1, pal.outline); continue; }
          set(dx, k % 4 === 1 ? pal.accentA : pal.rock[1]); set(dx + 1, k < len / 2 ? pal.rock[3] : pal.rock[2]); set(dx + 2, pal.outline);
        } else if (kind === 2) {
          // A blade of glass flung out and up.
          const len = 10 + (hsh >> 4) % 10;
          if (k >= len) continue;
          const o = Math.round((len - k) * 0.8);
          set(o, k === 0 ? 0xffffff : pal.accentB); set(o + 1, k < 2 ? pal.accentB : pal.rock[3]); set(o + 2, pal.rock[1]); set(o + 3, pal.outline);
          if (o > 1) set(o - 1, pal.rock[2]);
        } else {
          // A nugget of star-metal, round and lit.
          if (k > 6) continue;
          const dy = k - 3, w = Math.round(Math.sqrt(Math.max(0, 10 - dy * dy)));
          for (let dx = 1; dx <= w; dx++) set(dx, dy < -1 ? 0xfff6d8 : dy > 1 ? 0xb88a3a : 0xf2c252);
          set(w + 1, pal.outline);
        }
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
    // Honey seeping out of the crack, a gleam of copper, a splinter of bone.
    if (id === 'hive') { set(0, 1, pal.accentA); set(0, 2, pal.accentB); return; }
    if (id === 'clockwork') { set(1, 0, pal.accentC); set(1, -1, pal.accentB); return; }
    if (id === 'bones') { set(1, 0, pal.accentA); set(2, -1, pal.accentB); return; }
    // A drip of water, a flake of red plaster, a glowing sporecap.
    if (id === 'cascade') { set(0, 1, pal.accentC); set(0, 2, 0xffffff); set(1, -1, pal.accentB); return; }
    if (id === 'monastery') { set(1, 0, pal.accentA); set(1, -1, pal.accentB); return; }
    if (id === 'moss') { set(0, -1, pal.accentC); set(1, -1, pal.accentB); set(-1, 0, pal.accentA); return; }
    // A shell lodged in the crack; a glint of star-metal.
    if (id === 'reef') { set(0, -1, pal.accentC); set(1, -1, pal.accentC); set(1, 0, pal.accentA); return; }
    if (id === 'starfall') { set(1, 0, 0xf2c252); set(1, -1, 0xfff6d8); set(2, -2, pal.accentB); return; }
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
