// Scenery for the dragon's crossing (ui/DragonFlight.js), painted once:
//   flt_cloud_0..5   cumulus clouds lit from the upper right, flat dark bases
//   flt_sea_0..1     a seamless strip of the cloud sea (far and near rows)
//   flt_peak_0..2    snowy peaks poking up through the clouds, far away
//   flt_old          the Dragon's Spine, the mountain you leave behind
//   flt_new          the Far Range: green-black rock, moss, snowy twin
//                    summits, forests, waterfall gullies and a lit ledge
// Everything is painted pale-neutral where it should take the light of the
// hour, so the scene tints it (dawn, day, dusk, night).
import { PixelGrid, makeCanvas } from '../utils/pixelGrid.js';
import { makeNoise2D } from '../utils/seededRandom.js';
import { lcg } from './dragonArt.js';
import { rampAt, makeRamp, poly } from './pixelKit.js';

const CLOUD = [0x8a90b8, 0xa8aed0, 0xc8cce4, 0xe4e6f2, 0xf8f8fc, 0xffffff];
const SEA = [0xa4a8cc, 0xbcc0dc, 0xd4d8ea, 0xe8eaf4, 0xf8f8fc];
const SUN = [0.55, -0.62, 0.56];
const len3 = (v) => Math.hypot(v[0], v[1], v[2]);
const L = SUN.map((c) => c / len3(SUN));

function addGrid(scene, key, g) {
  if (scene.textures.exists(key)) return;
  const c = makeCanvas(g.w, g.h);
  g.drawTo(c.getContext('2d'));
  scene.textures.addCanvas(key, c);
}

// Shades a heap of spheres (circles) as one lit, puffy mass: each pixel
// takes the normal of the circle it is deepest inside.
function puffs(g, circles, { flatAt = null, ramp = CLOUD, ao = 0.35, wrapW = 0 } = {}) {
  const depth = new Float32Array(g.w * g.h), nxb = new Float32Array(g.w * g.h), nyb = new Float32Array(g.w * g.h);
  for (const c of circles) {
    for (const cx of wrapW ? [c.x - wrapW, c.x, c.x + wrapW] : [c.x]) {
      for (let y = Math.max(0, Math.floor(c.y - c.r)); y <= Math.min(g.h - 1, Math.ceil(c.y + c.r)); y++) {
        for (let x = Math.max(0, Math.floor(cx - c.r)); x <= Math.min(g.w - 1, Math.ceil(cx + c.r)); x++) {
          if (flatAt !== null && y > flatAt + Math.round(Math.sin(x * 0.35) * 1.5 + Math.sin(x * 0.11) * 2)) continue;
          const d = c.r - Math.hypot(x + 0.5 - cx, y + 0.5 - c.y);
          const i = y * g.w + x;
          if (d <= 0 || d <= depth[i]) continue;
          depth[i] = d; nxb[i] = (x + 0.5 - cx) / c.r; nyb[i] = (y + 0.5 - c.y) / c.r;
        }
      }
    }
  }
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const i = y * g.w + x;
      if (depth[i] <= 0) continue;
      const nx = nxb[i], ny = nyb[i], nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      let k = 0.18 + 0.82 * Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
      k -= ao * Math.max(0, (y - g.h * 0.45) / (g.h * 0.55));
      g.set(x, y, rampAt(ramp, k, x, y));
    }
  }
}

function cumulus(seed, w, h) {
  const rnd = lcg(seed);
  const g = new PixelGrid(w, h);
  const base = h - 6;
  const circles = [];
  // A row of small puffs along the base, a big tower of them in the middle.
  for (let x = 10; x < w - 10; x += 9 + rnd() * 6) circles.push({ x, y: base - 4 - rnd() * 4, r: 8 + rnd() * 5 });
  const n = 4 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const cx = w * (0.22 + t * 0.56) + (rnd() - 0.5) * 10;
    const r = (h * 0.28) * (1 - Math.abs(t - 0.5) * 0.9) + rnd() * 6;
    circles.push({ x: cx, y: base - r * 0.8 - rnd() * h * 0.18, r });
  }
  puffs(g, circles, { flatAt: base, ao: 0.5 });
  return g;
}

// A seamless strip of the sea of clouds: rows of billows, small and far at
// the top, big and close at the bottom.
function seaStrip(seed, w, h, rows, big) {
  const rnd = lcg(seed);
  const g = new PixelGrid(w, h);
  const circles = [];
  for (let k = 0; k < rows; k++) {
    const t = k / Math.max(1, rows - 1);
    const y = 8 + t * (h - 16);
    const r0 = (big ? 16 : 9) + t * (big ? 26 : 14);
    // Billows of mixed sizes: a big one, then a few small ones tucked round it.
    for (let x = rnd() * r0; x < w; ) {
      const r = r0 * (0.55 + rnd() * 1.0);
      circles.push({ x, y: y + (rnd() - 0.3) * r0 * 0.7, r });
      if (rnd() < 0.6) circles.push({ x: x + r * 0.7, y: y - r * 0.35, r: r * (0.4 + rnd() * 0.25) });
      x += r * (0.9 + rnd() * 0.9);
    }
  }
  puffs(g, circles, { wrapW: w, ao: 0.3, ramp: SEA });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g.get(x, y) === null && y > h * 0.5) g.set(x, y, rampAt(CLOUD, 0.42 - (y / h) * 0.2, x, y));
  return g;
}

// A snowy peak far away, pale and blue.
function peak(seed, w, h) {
  const noise = makeNoise2D(seed);
  const g = new PixelGrid(w, h);
  const rock = makeRamp(0x4a5070, 0x7a82a4, 0xb0b8d0, 5), snow = [0xb8c2dc, 0xd8def0, 0xf4f6fc];
  const top = 4, cx = w * (0.4 + noise(1, 1) * 0.2);
  for (let x = 0; x < w; x++) {
    const d = Math.abs(x - cx) / (w / 2);
    const y0 = Math.round(top + d * (h - top) * 0.95 + (noise(x * 0.15, 3) - 0.5) * 6);
    for (let y = y0; y < h; y++) {
      const lit = x > cx;
      const snowy = y < y0 + 6 + (1 - d) * 10 + noise(x * 0.3, y * 0.3) * 4;
      g.set(x, y, snowy ? rampAt(snow, lit ? 0.9 : 0.4, x, y) : rampAt(rock, (lit ? 0.75 : 0.3) + (noise(x * 0.2, y * 0.2) - 0.5) * 0.3, x, y));
    }
  }
  return g;
}

// The Dragon's Spine from afar: black-crimson rock, pale bone ribs, glowing
// cracks, the Gate's two pillars on a ledge near the top.
function oldMountain() {
  const w = 230, h = 300;
  const noise = makeNoise2D(1700);
  const g = new PixelGrid(w, h);
  const rock = [0x14080c, 0x241014, 0x381a1c, 0x522824, 0x74382c, 0x9a4c34];
  const edge = (y) => {
    const t = y / h;
    const spikes = Math.max(0, Math.sin(y * 0.21)) ** 6 * 14;
    return Math.round(110 + t * 120 - Math.max(0, 1 - t * 3.5) * 70 + (noise(y * 0.04, 1) - 0.5) * 26 + (noise(y * 0.2, 2) - 0.5) * 6 + spikes);
  };
  const top = 18;
  for (let y = top; y < h; y++) {
    const e = edge(y);
    for (let x = 0; x < e; x++) {
      const strata = Math.sin(y * 0.22 + noise(x * 0.03, y * 0.03) * 4) * 0.12;
      const lit = Math.max(0, 1 - (e - x) / 26);
      g.set(x, y, rampAt(rock, 0.25 + lit * 0.6 + strata + (noise(x * 0.1, y * 0.1) - 0.5) * 0.25, x, y));
    }
    g.set(e - 1, y, rock[5]);
  }
  // A jagged summit.
  poly(g, [[60, top + 2], [92, 2], [104, top + 6], [120, top + 2], [128, top + 10], [60, top + 12]], rock[2]);
  // Bone ribs sticking out of the rock (the old dragons).
  const rnd = lcg(42);
  for (let i = 0; i < 9; i++) {
    const y = 60 + i * 26 + rnd() * 10, e = edge(Math.round(y));
    for (let k = 0; k < 14; k++) g.set(e - 10 + k, Math.round(y - Math.sin((k / 14) * Math.PI) * 6), k % 5 ? 0xd8ccb0 : 0xa89878);
  }
  // Lava cracks.
  for (let i = 0; i < 14; i++) {
    let x = 20 + rnd() * 150, y = 50 + rnd() * 230;
    for (let s = 0; s < 14; s++) { if (x < edge(Math.round(y)) - 2) g.set(x, y, s % 4 ? 0xc84a1a : 0xff9a3c); x += rnd() - 0.4; y += 1; }
  }
  // The Gate's ledge and pillars.
  const gy = 46, gx = edge(gy) - 26;
  OLD_GATE.x = gx; OLD_GATE.y = gy;
  g.rect(gx - 14, gy, 34, 3, rock[3]);
  for (const px of [gx - 8, gx + 10]) { g.rect(px, gy - 14, 3, 14, 0x0a0406); g.set(px + 1, gy - 15, 0xffc860); }
  return g;
}

// The Far Range: the mountain the dragon carries you to.
function farRange() {
  const w = 280, h = 320;
  const noise = makeNoise2D(2400);
  const g = new PixelGrid(w, h);
  const rock = [0x0a1412, 0x12221e, 0x1a3029, 0x264438, 0x38604a, 0x52805c];
  const moss = [0x1a3a20, 0x24502a, 0x346a34, 0x4a8640];
  const snow = [0x9aaabc, 0xc8d4e2, 0xeef2f8];
  const sm = (a0, b0, t) => { const k = Math.max(0, Math.min(1, (t - a0) / (b0 - a0))); return k * k * (3 - 2 * k); };
  // Twin summits, and flanks that run down and out to the edges.
  const ridge = (x) => {
    const a0 = 14 + Math.abs(x - 96) * 1.05, b0 = 40 + Math.abs(x - 190) * 1.15;
    const flank = h - Math.min(x, w - x) * 2.6;
    return Math.round(Math.max(Math.min(a0, b0), flank) + (noise(x * 0.08, 5) - 0.5) * 10);
  };
  for (let x = 0; x < w; x++) {
    const top = ridge(x);
    // Faces turned to the sun (upper right) are lit, the others in shade.
    const slope = ridge(x + 4) - ridge(x - 4);
    const face = Math.max(-1, Math.min(1, slope / 7));
    for (let y = Math.max(0, top); y < h; y++) {
      const d = y - top;
      const strata = Math.sin(y * 0.16 + noise(x * 0.02, y * 0.02) * 5);
      let k = 0.42 + face * 0.24 * (1 - sm(0, 140, d) * 0.5) + (noise(x * 0.09, y * 0.09) - 0.5) * 0.28 + strata * 0.08;
      let c = rampAt(rock, k, x, y);
      if (d < 16 + noise(x * 0.2, 9) * 12 && y < 130) c = rampAt(snow, k + 0.25, x, y);
      else if (y > 120 && strata > 0.86 && noise(x * 0.07, y * 0.07) > 0.5) c = rampAt(moss, k + 0.05, x, y);
      g.set(x, y, c);
    }
    // A bright rim where the ridge meets the sky on the lit side.
    if (face > 0.2 && top >= 0) g.set(x, top, top < 130 ? snow[2] : rock[5]);
  }
  // Forests of dark pines on the lower slopes.
  const rnd = lcg(77);
  for (let i = 0; i < 170; i++) {
    const x = Math.round(rnd() * w), y = Math.round(170 + rnd() * 140);
    if (g.get(x, y) === null || y < ridge(x) + 8) continue;
    const t = 4 + Math.round(rnd() * 4);
    for (let k = 0; k < t; k++) for (let j = -Math.floor(k / 2); j <= Math.floor(k / 2); j++) g.set(x + j, y - t + k, j < 0 ? 0x0c2016 : k === 0 ? 0x3a6a3c : 0x163a22);
  }
  // Waterfall gullies (the falling water itself is animated by the scene).
  for (const [fx, f0] of WATERFALLS) for (let y = f0; y < h; y++) { const xx = fx + Math.round(Math.sin(y * 0.05) * 1.5); g.set(xx - 1, y, 0x08100e); g.set(xx, y, 0x08100e); g.set(xx + 1, y, 0x08100e); }
  // The ledge with its lamp and a flag: where the dragon will land.
  const [lx, ly] = FAR_LEDGE;
  g.rect(lx - 18, ly, 38, 3, rock[4]);
  g.rect(lx - 18, ly, 38, 1, moss[3]);
  g.rect(lx + 12, ly - 14, 1, 14, 0x2a2018); g.rect(lx + 13, ly - 14, 7, 4, 0xc8463b); g.rect(lx + 13, ly - 14, 7, 1, 0xe8745a);
  g.rect(lx - 9, ly - 7, 3, 7, 0x2a2018); g.set(lx - 8, ly - 6, 0xffe0a0);
  return g;
}

export const WATERFALLS = [[70, 120], [168, 150], [236, 190]];
export const FAR_LEDGE = [118, 200];
export const OLD_GATE = { x: 0, y: 0 };

export function buildFlightArt(scene) {
  if (scene.textures.exists('flt_new')) return;
  [[120, 64], [150, 70], [96, 50], [170, 80], [110, 56], [140, 66]].forEach(([w, h], i) => addGrid(scene, `flt_cloud_${i}`, cumulus(31 + i * 17, w, h)));
  addGrid(scene, 'flt_sea_0', seaStrip(5, 480, 70, 4, false));
  addGrid(scene, 'flt_sea_1', seaStrip(9, 480, 90, 3, true));
  [[96, 52], [130, 64], [80, 44]].forEach(([w, h], i) => addGrid(scene, `flt_peak_${i}`, peak(300 + i * 11, w, h)));
  addGrid(scene, 'flt_old', oldMountain());
  addGrid(scene, 'flt_new', farRange());
}
