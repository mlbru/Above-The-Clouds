// The expedition picker's panorama: one long painted landscape in which the
// three expedition mountains flow into each other. Bram's alpine peak runs
// down through forest into a burnt saddle, the saddle climbs into Mount
// Ember, and the volcano's far flank breaks apart into rocks that drift up
// and become the Sky Islands. Painted like the climbing wall: noise-textured
// rock lit from the left, dithered between the biome palette's shades.
import { PixelGrid, makeCanvas } from '../utils/pixelGrid.js';
import { lerpColor, bayer } from '../utils/color.js';
import { makeNoise2D, SeededRandom } from '../utils/seededRandom.js';
import { BIOMES } from '../data/biomes.js';

export const PANO_W = 1520, PANO_H = 260;
const BASE = 200; // the row where the mountains meet the ground
// Where each mountain stands in the panorama (Bram's peak, Ember, the islands,
// and past the islands the glacier with the Crevasse).
export const PANO_CENTERS = { peak: 200, volcano: 540, islands: 880, glacier: 1250 };

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function shade(pal, v, x, y) {
  const i = Math.floor(v * (pal.length - 0.01) + (bayer(x, y) - 0.5) * 0.9);
  return pal[Math.max(0, Math.min(pal.length - 1, i))];
}

const GREEN = BIOMES.green.rock;
const ASH = BIOMES.volcano.rock;
const SNOW = [0x7a8aae, 0xa8b8d6, 0xcfdcf0, 0xeef4fe, 0xffffff];
const ICE = [0x4a6a98, 0x6a8ab8, 0x9fc0e0, 0xcfe4f6, 0xeef8ff];
const FOREST = [0x10261a, 0x16301e, 0x1f3a26, 0x2e5236, 0x3f6a44];
const MEADOW = [0x3f6a3c, 0x4f8a3c, 0x6fa84a, 0x8fc85a];
const LAVA = [0xa8243a, 0xf0644b, 0xff9a3c, 0xffd25a, 0xfff1a0];
const ISLE_GRASS = [0x2e6a3a, 0x3f8a4a, 0x6fc25a, 0xa8e878];

function panorama() {
  const g = new PixelGrid(PANO_W, PANO_H);
  const n = makeNoise2D(101), m = makeNoise2D(102), k = makeNoise2D(103), q = makeNoise2D(104);
  const rng = new SeededRandom(105);
  const P = PANO_CENTERS;

  // ---- the skyline: alpine peaks, a saddle, the cone, and the broken edge
  const alp = [[P.peak, 8, 1.18], [P.peak - 82, 66, 0.95], [P.peak + 88, 54, 1.05], [P.peak - 160, 120, 0.9]];
  const coneTop = (x) => {
    const d = Math.max(0, Math.abs(x - P.volcano) - 24) / 150;
    return 34 + 166 * Math.pow(d, 0.8) + (Math.abs(x - P.volcano) < 24 ? 2 + Math.cos((x - P.volcano) / 7.5) * 2 : 0);
  };
  const edge = 732 + Math.round((n.fbm(3.3, 0.4) - 0.5) * 12);
  const top = (x) => {
    let y = 999, px = P.peak;
    for (const p of alp) { const v = p[1] + Math.abs(x - p[0]) * p[2]; if (v < y) { y = v; px = p[0]; } }
    y += (n.fbm(x * 0.07, 1.3) - 0.5) * 14;
    const saddle = 150 - Math.sin(((x - 330) / 120) * Math.PI) * 14 + (n.fbm(x * 0.05, 6) - 0.5) * 16;
    if (x > 320 && x < 460 && saddle < y) { y = saddle; px = x; }
    const c = coneTop(x) + (n.fbm(x * 0.08, 3) - 0.5) * 6;
    if (c < y) { y = c; px = P.volcano; }
    const foot = 176 + (n.fbm(x * 0.03, 9) - 0.5) * 18;
    if (foot < y) { y = foot; px = x + 20; }
    if (x < 12) y = Math.max(y, BASE - x * 4);
    return { y, px };
  };

  for (let x = 0; x < PANO_W; x++) {
    if (x > edge) continue;
    const t = top(x);
    const wV = smooth(330, 450, x); // 0 alpine .. 1 volcanic
    const alpine = wV < 0.98;
    const snowLine = 72 + n.fbm(x * 0.04, 4) * 34 + (x > P.peak + 100 ? (x - P.peak - 100) * 0.8 : 0);
    const forestLine = Math.max(t.y + 16, 138 + n.fbm(x * 0.035, 7) * 30);
    // The cliff where the ground ends: rock darkening as it falls into cloud.
    const cliffDepth = x > edge - 40 ? (x - (edge - 40)) / 40 : 0;
    for (let y = Math.max(0, Math.round(t.y)); y < PANO_H; y++) {
      // The ground breaks off in a jagged cliff that leans back as it drops.
      if (y > BASE - 40 && x > edge - Math.max(0, y - (BASE - 40)) * 0.6 + (k.fbm(y * 0.15, 5) - 0.5) * 14) continue;
      const din = y - t.y;
      const lit = x < t.px + (m.fbm(y * 0.05, 2) - 0.5) * 18 - (y - 10) * 0.04;
      // Craggy lighting from a height field, like the climbing wall.
      const h = n.fbm(x * 0.05, y * 0.05, 4), hUL = n.fbm((x - 2) * 0.05, (y - 2) * 0.05, 4);
      let v = (lit ? 0.66 : 0.32) + (h - hUL) * 7 + (m.fbm(x * 0.11, y * 0.11) - 0.5) * 0.25 + (din < 2 && lit ? 0.28 : 0);
      const crevice = Math.abs(k.fbm(x * 0.09, y * 0.022) - 0.5) < 0.011;
      let c;
      if (y >= BASE + (n.fbm(x * 0.06, 2) - 0.5) * 6) {
        // The ground: meadow below the peak, scorched ash below the volcano.
        const gy = y - BASE;
        const mc = gy < 2 ? 0x9ad65f : shade(MEADOW, 0.75 - gy / 80 + (q.fbm(x * 0.12, y * 0.2) - 0.5) * 0.4, x, y);
        let ac = shade(ASH, 0.6 - gy / 90 + (q.fbm(x * 0.1, y * 0.2) - 0.5) * 0.5, x, y);
        if (Math.abs(k.fbm(x * 0.05, y * 0.08) - 0.5) < 0.012) ac = LAVA[2];
        c = lerpColor(mc, ac, wV);
        if (wV < 0.5 && gy > 3 && q(x * 0.9, y * 0.9) > 0.86 && bayer(x, y) < 0.3) c = [0xf4efe4, 0xf2c14e, 0xf07ab8][(x + y) % 3];
        // The lava lake at Ember's foot.
        const lake = Math.abs(x - P.volcano - 20) < 70 + n.fbm(y * 0.1, 1) * 20 && gy < 14;
        if (lake) c = q.fbm(x * 0.15, y * 0.3) > 0.56 ? 0x2a1416 : LAVA[1 + ((x + y) % 3)];
        c = lerpColor(c, 0x1f2028, Math.min(1, gy / 70) * 0.7);
      } else if (alpine && (y < snowLine || (k.fbm(x * 0.12, y * 0.06) > 0.64 && y < snowLine + 14 && y < forestLine - 8))) {
        // Snow, with a glacier filling the bowl between the peak and its left shoulder.
        const bowl = x > P.peak - 70 && x < P.peak - 14 && y > 46 && y < 118 && din > 5;
        c = bowl ? (((y + Math.round(h * 8)) % 7 === 0) ? ICE[0] : shade(ICE, v + 0.15, x, y)) : shade(SNOW, v + 0.12, x, y);
        c = lerpColor(c, ASH[3], wV);
      } else if (alpine && y > forestLine) {
        c = shade(FOREST, v * 0.8 + (((x + y) % 5) === 0 ? 0.15 : 0), x, y);
        c = lerpColor(c, ASH[1], wV);
      } else {
        // Bare rock: grey granite turning to black volcanic glass across the saddle.
        if (((y + Math.round(h * 12)) % 15) === 0) v -= 0.18;
        if (alpine && y > forestLine - 14 && y < forestLine && bayer(x, y) < 0.35) v += 0.25; // scree
        const streak = n.fbm(x * 0.05 + (x - P.volcano) * 0.01, y * 0.16);
        const gc = shade(GREEN, v, x, y);
        const vc = shade(ASH, v * 0.85 + (streak - 0.5) * 0.45, x, y);
        c = lerpColor(gc, vc, wV);
        if (crevice) c = lerpColor(GREEN[0], ASH[0], wV);
      }
      if (cliffDepth > 0 && y > BASE - 30) c = lerpColor(c, 0x1a1418, cliffDepth * 0.5);
      g.set(x, y, c);
    }
  }

  // ---- Bram's peak: forest, waterfall, hut, summit flags
  for (let i = 0; i < 260; i++) {
    const x = rng.int(4, 380);
    const t = top(x);
    const fl = Math.max(t.y + 16, 138 + n.fbm(x * 0.035, 7) * 30);
    const by = Math.round(fl + rng.range(2, 46));
    if (by > BASE + 2) continue;
    const ht = rng.int(6, 12), shadeK = Math.min(1, (by - fl) / 46);
    const dark = lerpColor(FOREST[2], FOREST[0], shadeK * 0.6), light = lerpColor(FOREST[4], FOREST[2], shadeK * 0.6);
    for (let r = 0; r < ht; r++) {
      const half = Math.round((r / ht) * (ht * 0.38)) + (r % 3 === 2 ? 1 : 0);
      for (let dx = -half; dx <= half; dx++) g.set(x + dx, by - ht + r, dx < 0 ? light : dark);
    }
    g.set(x, by, 0x3a2414);
  }
  const wfx = P.peak - 46;
  for (let y = 112; y < 168; y++) {
    const x = wfx + Math.round(Math.sin(y / 9));
    g.set(x, y, 0xe4f2ff); g.set(x + 1, y, y % 3 ? 0x9fd0f0 : 0xffffff);
  }
  for (let i = 0; i < 12; i++) g.set(wfx - 4 + rng.int(0, 9), 166 + rng.int(0, 4), 0xffffff);
  const hx = P.peak + 26, hy = Math.round(top(P.peak + 26).y) + 50;
  g.rect(hx, hy, 8, 5, 0x8a8478); g.rect(hx + 1, hy + 2, 2, 3, 0x4a3020); g.set(hx + 5, hy + 2, 0xffd25a);
  for (let r = 0; r < 5; r++) g.rect(hx - 1 + r, hy - 1 - r, 10 - r * 2, 1, 0x8a3a2e);
  // Prayer flags strung from the summit.
  const flagC = [0x3b6fb6, 0xf0f0e8, 0xc8463b, 0x4f8a3c, 0xe6b230];
  for (let i = 0; i < 16; i++) {
    const x = P.peak + 2 + i, y = 10 + Math.round(i * 0.55 + Math.sin((i / 16) * Math.PI) * 2);
    g.set(x, y, 0x8a7a6a);
    if (i % 3 === 1) { const fc = flagC[Math.floor(i / 3) % 5]; g.set(x, y + 1, fc); g.set(x, y + 2, fc); }
  }

  // ---- Ember: charred trees on the saddle, rivers, cooled flows, a side vent
  for (let i = 0; i < 26; i++) {
    const x = rng.int(340, 440), y = Math.round(top(x).y) + rng.int(4, 30);
    if (y > BASE) continue;
    const ht = rng.int(5, 10);
    g.line(x, y, x, y - ht, 0x1a1012);
    g.set(x - 1, y - ht + 3, 0x1a1012); g.set(x + 1, y - ht + 2, 0x1a1012); g.set(x + 2, y - ht + 1, 0x1a1012);
  }
  const riverX = (r, y) => r[0] + (y - 34) * r[1] + Math.sin(y / 9 + r[0]) * 3;
  const flow = (r, hot) => {
    for (let y = 36; y < 36 + (BASE - 36) * r[2]; y++) {
      const cx = riverX(r, y);
      for (let dx = -5; dx <= 5; dx++) {
        const x = Math.round(cx + dx), d = Math.abs(cx - x);
        const cur = g.get(x, y);
        if (cur === null || cur === undefined) continue;
        if (hot) {
          if (d < 1.2) g.set(x, y, q.fbm(x * 0.3, y * 0.3) > 0.62 ? 0x5a1a1a : LAVA[y % 6 === 0 ? 2 : 3 + ((x + y) % 2)]);
          else if (d < 2.4) g.set(x, y, LAVA[1]);
          else g.set(x, y, lerpColor(cur, LAVA[0], 0.4 * (1 - d / 5)));
        } else if (d < 2) g.set(x, y, d < 0.7 && (x + y) % 4 === 0 ? 0x6a4a46 : 0x1c1214);
      }
    }
  };
  [[P.volcano - 44, -0.9, 0.85], [P.volcano + 40, 0.75, 0.8], [P.volcano + 30, 0.3, 0.6]].forEach((r) => flow(r, false));
  [[P.volcano - 12, -0.5, 0.92], [P.volcano + 6, 0.35, 0.78], [P.volcano + 16, 0.8, 1.0], [P.volcano - 4, -0.15, 0.6]].forEach((r) => flow(r, true));
  for (let x = P.volcano - 24; x <= P.volcano + 24; x++) {
    const y0 = Math.round(coneTop(x));
    for (let r = 0; r < 4 - Math.round((Math.abs(x - P.volcano) / 24) * 2); r++) g.set(x, y0 + r, LAVA[4 - r]);
    g.set(x, y0 - 1, LAVA[2]);
  }
  const vent = [P.volcano + 62, Math.round(coneTop(P.volcano + 62)) + 6];
  g.ellipse(vent[0], vent[1], 4, 2, LAVA[1]); g.ellipse(vent[0], vent[1], 2, 1, LAVA[4]);
  // Lava bombs scattered on the slopes.
  for (let i = 0; i < 30; i++) {
    const x = rng.int(450, 700), y = Math.round(top(x).y) + rng.int(6, 60);
    if (y >= BASE || x > edge - 4) continue;
    g.set(x, y, ASH[4]); g.set(x + 1, y, ASH[2]); g.set(x, y + 1, ASH[1]);
  }

  // ---- the broken edge and the Sky Islands
  // Rocks breaking off the volcano's flank and drifting up, greener as they rise.
  const chunks = [[edge + 8, 150, 6, 5], [edge + 22, 126, 5, 4], [edge + 10, 104, 4, 3], [edge + 34, 172, 7, 5], [edge + 30, 96, 3, 3], [edge + 46, 140, 5, 4],
    [edge - 6, 222, 8, 6], [edge - 28, 246, 6, 5], [edge + 14, 238, 5, 4]];
  const isl = [[P.islands - 54, 176, 40, 26], [P.islands + 64, 150, 34, 22], [P.islands - 30, 118, 32, 22], [P.islands + 68, 86, 28, 20], [P.islands - 46, 60, 26, 18], [P.islands + 20, 30, 34, 22]];
  const far = [[P.islands + 150, 70, 14, 9], [P.islands + 176, 120, 10, 7], [P.islands - 120, 40, 9, 6], [P.islands + 130, 170, 12, 8]];
  const islandAt = ([cx, cy, rx, depth], rock, grassy, haze = 0) => {
    for (let y = cy - 3; y < cy + depth + 8; y++) {
      for (let x = Math.round(cx - rx - 1); x <= Math.round(cx + rx + 1); x++) {
        const d = y - cy, dx = x - cx;
        const seed = (x * 7919 + cy * 31) >>> 0;
        let c = null;
        if (d < 0) {
          if (grassy && Math.abs(dx) < rx - 2 && seed % 4 === 0 && -d <= 1 + (seed % 3)) c = seed % 17 === 0 ? 0xf2c14e : seed % 13 === 0 ? 0xf07ab8 : ISLE_GRASS[3];
        } else {
          const t = Math.max(0, (d - 4) / (depth - 4));
          const half = rx * (d < 4 ? 1 : Math.sqrt(Math.max(0, 1 - Math.pow(t, 1.4)))) + (n.fbm(x * 0.2, y * 0.2) - 0.5) * 3;
          if (Math.abs(dx) <= half) {
            if (grassy && d < 4) c = shade(ISLE_GRASS, 0.95 - d * 0.22 + (dx < 0 ? 0.1 : -0.05), x, y);
            else {
              const v = 0.7 - t * 0.55 + (dx < -half * 0.25 ? 0.15 : dx > half * 0.35 ? -0.15 : 0) + (n.fbm(x * 0.12, y * 0.12, 3) - 0.5) * 0.4;
              c = d === 4 && grassy ? rock[0] : shade(rock, v, x, y);
              if (Math.abs(k.fbm(x * 0.2, y * 0.08) - 0.5) < 0.02) c = rock[0];
            }
          } else if (grassy && d > depth * 0.4 && seed % 7 === 0) {
            const tip = depth * Math.sqrt(Math.max(0, 1 - Math.pow(dx / rx, 2)));
            if (d > tip && d < tip + 3 + (seed % 7)) c = seed % 2 ? ISLE_GRASS[1] : 0x5a4252;
          }
        }
        if (c !== null) g.set(x, y, haze ? lerpColor(c, 0xc8d8f0, haze) : c);
      }
    }
  };
  for (const f of far) islandAt(f, BIOMES.sky.rock, true, 0.55);
  // Rope bridges (behind the near islands).
  for (let i = 0; i < isl.length - 1; i++) {
    const [ax, ay] = isl[i], [bx, by] = isl[i + 1];
    for (let s = 0; s <= 48; s++) {
      const t = s / 48;
      if (s % 3) g.set(Math.round(ax + (bx - ax) * t), Math.round(ay + (by - ay) * t + Math.sin(t * Math.PI) * 9), 0x8a6a48);
    }
  }
  chunks.forEach((c, i) => islandAt(c, i < 3 || i > 5 ? ASH : BIOMES.sky.rock.map((r) => lerpColor(r, ASH[2], 0.4)), i > 2 && i < 6));
  for (const i of isl) islandAt(i, BIOMES.sky.rock, true);
  for (const [x0, y0, len] of [[isl[1][0] + isl[1][2] - 4, isl[1][1] + 2, 28], [isl[3][0] - isl[3][2] + 5, isl[3][1] + 2, 22], [isl[0][0] + 20, isl[0][1] + 3, 30]]) {
    for (let y = y0; y < y0 + len; y++) {
      const a = 1 - (y - y0) / len;
      if (rng.next() < a + 0.2) g.set(x0, y, y % 3 ? 0x9fd0f0 : 0xffffff);
      if (rng.next() < a * 0.6) g.set(x0 + 1, y, 0xe4f2ff);
    }
  }
  const [tx, ty] = [isl[5][0] + 4, isl[5][1]];
  g.line(tx, ty, tx - 1, ty - 14, 0x5a3a24, 2); g.line(tx, ty - 8, tx + 5, ty - 13, 0x5a3a24);
  [[0, -22, 13, 8, 0x2e6a3a], [-1, -24, 11, 6, 0x3f8a4a], [-3, -26, 7, 4, 0x6fc25a], [3, -21, 6, 3, 0x3f8a4a]].forEach(([ox, oy, rx, ry, c]) => g.ellipse(tx + ox, ty + oy, rx, ry, c));
  [[-6, -21], [5, -24], [1, -18], [-2, -27], [8, -20]].forEach(([ox, oy]) => { g.set(tx + ox, ty + oy, 0xf0644b); g.set(tx + ox, ty + oy - 1, 0xff9a8a); });
  const [ix, iy] = [isl[2][0] - 8, isl[2][1] - 6];
  g.rect(ix, iy, 8, 5, 0xd8b898); g.rect(ix + 2, iy + 2, 2, 3, 0x5a3a24); g.set(ix + 5, iy + 1, 0xffd25a);
  for (let r = 0; r < 5; r++) g.rect(ix - 1 + r, iy - 1 - r, 10 - r * 2, 1, 0x8a3a2e);

  // ---- the glacier past the islands, split by the Crevasse
  const Gx = P.glacier;
  const gTop = (x) => 24 + Math.abs(x - Gx) * 0.82 + (n.fbm(x * 0.06, 11) - 0.5) * 16;
  const gLeft = 1060 + Math.round((n.fbm(0.7, 12) - 0.5) * 10);
  const crackX = (y) => Gx + 4 + Math.sin(y / 13) * 4 + (y - 30) * 0.06;
  for (let x = gLeft; x < PANO_W; x++) {
    const t = gTop(x);
    for (let y = Math.max(0, Math.round(t)); y < PANO_H; y++) {
      // The glacier's own foot drops away into cloud on the left, like Ember's cliff.
      if (y > BASE - 30 && x < gLeft + Math.max(0, y - (BASE - 30)) * 0.5 + (k.fbm(y * 0.15, 13) - 0.5) * 10) continue;
      const lit = x < Gx + (m.fbm(y * 0.05, 14) - 0.5) * 12;
      const h = n.fbm(x * 0.05, y * 0.05, 4), hUL = n.fbm((x - 2) * 0.05, (y - 2) * 0.05, 4);
      const v = (lit ? 0.72 : 0.4) + (h - hUL) * 6 + (m.fbm(x * 0.11, y * 0.11) - 0.5) * 0.2;
      let c;
      if (y >= BASE + (n.fbm(x * 0.06, 15) - 0.5) * 6) {
        const gy = y - BASE;
        c = lerpColor(shade(SNOW, 0.85 - gy / 70 + (q.fbm(x * 0.12, y * 0.2) - 0.5) * 0.4, x, y), 0x1f2028, Math.min(1, gy / 70) * 0.6);
      } else {
        c = y - t < 10 + n.fbm(x * 0.1, 16) * 8 ? shade(SNOW, v + 0.1, x, y) : shade(ICE, v, x, y);
        // Blue banding in the ice, and seracs breaking the slope.
        if (((y + Math.round(h * 10)) % 13) === 0) c = ICE[0];
        const cw = 0.8 + (y - t) / 40;
        const d = Math.abs(x - crackX(y));
        if (y > 34 && d < cw) c = d < cw - 1 ? 0x0a1428 : 0x2a4a78;
      }
      g.set(x, y, c);
    }
  }

  const paths = {
    peak: [[P.peak + 46, 196], [P.peak + 18, 172], [P.peak + 40, 150], [P.peak + 10, 128], [P.peak + 26, 104], [P.peak - 2, 80], [P.peak + 10, 52], [P.peak, 10]],
    volcano: [[P.volcano + 72, 196], [P.volcano + 36, 170], [P.volcano + 64, 146], [P.volcano + 26, 118], [P.volcano + 46, 92], [P.volcano + 16, 66], [P.volcano + 26, 44], [P.volcano + 6, 32]],
    islands: isl.map(([cx, cy]) => [cx, cy - 1]),
    glacier: [[Gx + 40, 196], [Gx + 12, 174], [Gx + 22, 150], [Gx + 2, 126], [Gx + 16, 100], [Gx + 0, 76], [Gx + 10, 52], [Gx + 2, 30]],
  };
  return { g, paths, spots: { summit: [P.peak, 10], crater: [P.volcano, 34], vent } };
}

// Builds the panorama texture once and returns the routes and effect spots.
let CACHE = null;
export function buildPanorama(scene) {
  if (!CACHE) {
    const { g, paths, spots } = panorama();
    const c = makeCanvas(g.w, g.h);
    g.drawTo(c.getContext('2d'));
    CACHE = { canvas: c, paths, spots };
  }
  if (!scene.textures.exists('exp_panorama')) scene.textures.addCanvas('exp_panorama', CACHE.canvas);
  return CACHE;
}
