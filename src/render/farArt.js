// Props and effects for the Far Range (the mountain across the cloud sea):
//   The Cascade        rainbow, the sweeping curtain of spray, wet glints
//   Hanging Monastery  paper lanterns, prayer wheels, walkway planks, bells,
//                      the monk (rings the bells, pours tea on the balconies)
//   Moss Cathedral     glowing mushrooms, curtains of roots, shafts of light
// plus the note icons their twists use (blank bell notes, vine leaves).
import { PixelGrid, makeCanvas } from '../utils/pixelGrid.js';
import { lerpColor } from '../utils/color.js';
import { SeededRandom } from '../utils/seededRandom.js';
import { shade, makeRamp, stroke, poly } from './pixelKit.js';

const OUT = 0x16100c;

function add(scene, key, grid) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const c = makeCanvas(grid.w, grid.h);
  grid.drawTo(c.getContext('2d'));
  scene.textures.addCanvas(key, c);
}

function addFrames(scene, key, grids) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const w = grids[0].w, h = grids[0].h;
  const c = makeCanvas(w * grids.length, h);
  grids.forEach((g, i) => g.drawTo(c.getContext('2d'), i * w, 0));
  const tex = scene.textures.addCanvas(key, c);
  grids.forEach((g, i) => tex.add(i, 0, i * w, 0, w, h));
}

// Raw RGBA canvas (for soft, alpha-graded effects).
function rgbaCanvas(w, h, fn) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = fn(x, y);
    if (!v) continue;
    const i = (y * w + x) * 4;
    img.data[i] = (v.c >> 16) & 255; img.data[i + 1] = (v.c >> 8) & 255; img.data[i + 2] = v.c & 255;
    img.data[i + 3] = Math.round(Math.max(0, Math.min(1, v.a)) * 255);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
function addCanvas(scene, key, c) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, c);
}

// ---------------------------------------------------------------- monastery
// A red paper lantern hanging from a carved bracket: ribbed paper lit from
// within, black caps, a gold tassel.
function paperLantern() {
  const g = new PixelGrid(16, 26);
  // The bracket: a beam out of the rock with an upturned end.
  g.rect(0, 2, 13, 3, 3); g.rect(12, 0, 2, 3, 3); g.set(14, 0, 3);
  g.rect(9, 5, 1, 4, 4);
  // The lantern.
  g.rect(6, 8, 7, 2, 4);
  g.ellipse(9.5, 15, 5.2, 6, 1);
  g.rect(6, 20, 7, 2, 4);
  g.rect(9, 22, 1, 3, 5); g.set(8, 25, 5); g.set(10, 25, 5);
  shade(g, 1, [0x8a1a12, 0xc8341e, 0xf05a30, 0xff9a50, 0xffd890], { r: 4, base: 0.62, depth: 0.5, light: [0.2, 0.1], bias: (x, y) => ((y - 9) % 3 === 0 ? -0.22 : 0) - Math.abs(x - 9.5) * 0.04 });
  shade(g, 3, [0x3a2014, 0x6a3a1e, 0x9a6232], { r: 1, base: 0.5 });
  shade(g, 4, [0x0c0a0a, 0x241c18, 0x4a3a30], { r: 1, base: 0.5 });
  shade(g, 5, [0x9a6a18, 0xf2c252, 0xfff0a8], { r: 1, base: 0.6 });
  g.set(9, 14, 0xfff4d0); g.set(10, 15, 0xfff4d0); g.set(9, 15, 0xffe8a0);
  g.outline(OUT);
  return g;
}

// A prayer wheel on a post: a red drum banded in gold, rows of carved marks,
// a little gold finial on top. Frames turn the drum.
function prayerWheel(f) {
  const g = new PixelGrid(14, 24);
  g.rect(6, 2, 2, 20, 3);
  g.rect(2, 6, 10, 12, 1);
  g.ellipse(7, 6, 5, 1.6, 2); g.ellipse(7, 18, 5, 1.6, 2);
  g.rect(2, 11, 10, 1, 2);
  g.ellipse(7, 1.5, 1.4, 1.6, 2);
  g.rect(3, 22, 8, 2, 4);
  shade(g, 1, [0x5a120c, 0x9a2418, 0xc8402a, 0xe8704a], { r: 4, base: 0.55, depth: 0.55, light: [-0.9, -0.3] });
  shade(g, 2, [0x8a5a10, 0xd8a03a, 0xffe08a], { r: 2, base: 0.55, depth: 0.5, light: [-0.9, -0.3] });
  shade(g, 3, [0x2a1810, 0x4a2c18], { r: 1, base: 0.4 });
  shade(g, 4, [0x3a2a20, 0x6a5240, 0x8a7058], { r: 1, base: 0.5 });
  // Carved marks: two rows of little gold glyphs that slide round as it turns.
  for (const y of [8, 14]) for (let k = 0; k < 4; k++) {
    const x = 3 + ((k * 3 + f) % 9);
    if (x < 3 || x > 10) continue;
    g.set(x, y, 0xf2c252); g.set(x, y + 1, 0xb8862a);
  }
  g.outline(OUT);
  return g;
}

// Walkway planks bolted to the cliff: one tile, repeated along a span.
function walkwayTile() {
  const g = new PixelGrid(12, 14);
  // Rail and posts.
  g.rect(0, 1, 12, 1, 2); g.rect(0, 0, 12, 1, 3);
  g.rect(1, 1, 1, 7, 2);
  // The planks, each its own shade, with a nail at each end.
  for (let x = 0; x < 12; x++) g.rect(x, 8, 1, 3, x % 4 === 3 ? 4 : 1);
  g.rect(0, 11, 12, 1, 4);
  // A bracket under every tile, into the rock.
  g.line(2, 11, 6, 13, 2); g.set(6, 13, 4);
  shade(g, 1, [0x4a2a16, 0x7a4a26, 0xa8703a, 0xd8a060], { r: 2, base: 0.55, bias: (x) => ((x * 7) % 5) * 0.03 });
  shade(g, 2, [0x2a1810, 0x5a3418, 0x8a5428], { r: 1, base: 0.5 });
  g.set(1, 9, 0xf2c252); g.set(10, 9, 0xb8862a);
  return g;
}

// A temple bell under a little roof, for the monk to ring.
function bellGrid() {
  const g = new PixelGrid(22, 26);
  // Roof: dark tiles sweeping up at both ends.
  poly(g, [[0, 6], [3, 3], [19, 3], [22, 6], [17, 5], [5, 5]], 3);
  g.rect(3, 2, 16, 2, 3); g.rect(9, 0, 4, 2, 2);
  g.rect(3, 6, 2, 19, 4); g.rect(17, 6, 2, 19, 4);
  g.rect(5, 6, 12, 1, 4);
  // The bell: bronze, flaring at the mouth, with a lit band.
  poly(g, [[8, 8], [14, 8], [15, 13], [17, 19], [5, 19], [7, 13]], 1);
  g.rect(10, 7, 2, 1, 1);
  g.rect(5, 19, 13, 2, 1);
  shade(g, 1, [0x3a2410, 0x6a4a1e, 0xa87a30, 0xe8b850, 0xfff0a0], { r: 3, base: 0.5, depth: 0.55, light: [-0.8, -0.4] });
  shade(g, 3, [0x1a0e0a, 0x3a1c14, 0x5a2a1c], { r: 1, base: 0.45 });
  shade(g, 4, [0x5a120c, 0x9a2418, 0xc8402a], { r: 1, base: 0.5 });
  shade(g, 2, [0x9a6a18, 0xf2c252], { r: 1, base: 0.6 });
  g.rect(7, 15, 9, 1, 0x8a5a20);
  g.set(9, 11, 0xfff4c8);
  g.outline(OUT);
  return g;
}

// The monk: saffron robe, maroon sash, shaved head, a mallet. Frames: 0
// standing, 1 mallet back, 2 strike, 3 pouring tea (a teapot held out).
function monkFrame(f) {
  const g = new PixelGrid(18, 24);
  // Robe: a long A-line shape, the sash across it.
  poly(g, [[6, 9], [12, 9], [14, 23], [4, 23]], 1);
  poly(g, [[6, 9], [9, 9], [13, 20], [11, 21]], 2);
  // Head and neck.
  g.ellipse(9, 6, 3, 3.2, 3);
  g.rect(8, 9, 2, 1, 3);
  // Arms and what they hold.
  if (f === 3) {
    g.rect(11, 12, 4, 2, 1); g.rect(14, 11, 3, 3, 4); g.set(17, 11, 4); g.set(16, 10, 4);
  } else {
    const ang = f === 0 ? 2.2 : f === 1 ? -0.6 : 0.6;
    const hx = 9 + Math.cos(ang) * 4, hy = 12 + Math.sin(ang) * 4;
    stroke(g, [10, 11], [10, 11], [hx, hy], 2.4, 2, 1);
    const mx = hx + Math.cos(ang) * 4, my = hy + Math.sin(ang) * 4;
    stroke(g, [hx, hy], [hx, hy], [mx, my], 1.2, 1.2, 5);
    g.ellipse(mx, my, 1.6, 1.6, 5);
  }
  shade(g, 1, [0x8a3a08, 0xc86a10, 0xf09a28, 0xffc85a], { r: 3, base: 0.55, depth: 0.5 });
  shade(g, 2, [0x3a0c0c, 0x6a1a16, 0x9a2a20], { r: 2, base: 0.5 });
  shade(g, 3, [0x6a3a20, 0xa8683a, 0xd89a68, 0xf0c8a0], { r: 2, base: 0.6 });
  shade(g, 4, [0x1a3a30, 0x2a6a50, 0x5ab88a], { r: 1, base: 0.5 });
  shade(g, 5, [0x3a2010, 0x7a4a24], { r: 1, base: 0.5 });
  g.set(10, 6, 0x1a0e08);
  g.outline(OUT);
  return g;
}

// ---------------------------------------------------------------- moss cathedral
// A cluster of glowing mushrooms: pale stems, luminous caps lit from below
// with gills, a few dots on the caps.
function glowcapGrid() {
  const g = new PixelGrid(18, 14);
  const caps = [[5, 6, 4.2, 2.6, 13], [11, 4, 5, 3, 13], [15, 9, 2.6, 1.8, 13]];
  for (const [cx, cy, rx, ry] of caps) { g.rect(Math.round(cx - 0.5), Math.round(cy), 2, 13 - Math.round(cy), 2); }
  for (const [cx, cy, rx, ry] of caps) { g.ellipse(cx, cy, rx, ry, 1); g.rect(Math.round(cx - rx + 1), Math.round(cy + ry * 0.4), Math.round(rx * 2 - 1), 1, 3); }
  g.rect(0, 13, 18, 1, 4);
  shade(g, 1, [0x1a6a5a, 0x3ab89a, 0x7af0c8, 0xd8fff0], { r: 3, base: 0.62, depth: 0.5 });
  shade(g, 2, [0x8a9a80, 0xc8d8b8, 0xeef8e0], { r: 1, base: 0.55, light: [-1, 0] });
  shade(g, 3, [0x2a8a6a, 0x9affd8], { r: 1, base: 0.7 });
  shade(g, 4, [0x1a2a14, 0x3e6a26, 0x7aa848], { r: 1, base: 0.5 });
  for (const [x, y] of [[4, 5], [6, 6], [10, 3], [13, 3], [12, 5], [15, 8]]) g.set(x, y, 0xf4fff8);
  g.outline(0x081008);
  return g;
}

// A curtain of fine roots hanging off the rock, mossy at the top, the ends
// pale where they are still growing.
function rootCurtain(seed) {
  const g = new PixelGrid(22, 44);
  const rng = new SeededRandom(seed);
  for (let i = 0; i < 7; i++) {
    let x = 2 + i * 3 + rng.range(-1, 1);
    const end = 18 + rng.int(0, 24), sw = rng.range(0, 6);
    for (let y = 1; y < end; y++) {
      x += Math.sin(y / 7 + sw) * 0.22;
      g.set(x, y, y > end - 4 ? 3 : 1);
      if (i % 2 === 0 && y < end * 0.6) g.set(x + 1, y, 1);
    }
  }
  g.ellipse(11, 2, 11, 3, 2);
  for (let k = 0; k < 6; k++) g.ellipse(rng.range(3, 19), rng.range(3, 9), 2, 1.5, 2);
  shade(g, 1, [0x2a1e12, 0x4a3820, 0x6a5430, 0x8a7448], { r: 1, base: 0.5, light: [-1, 0] });
  shade(g, 2, [0x1e3a14, 0x3e7a26, 0x7ab848, 0xb8e070], { r: 2, base: 0.55, depth: 0.5 });
  shade(g, 3, [0xb8a888, 0xe8dcc0], { r: 1, base: 0.6 });
  return g;
}

// ---------------------------------------------------------------- the Far Shore
// A standing stone on the Far Shore: old, leaning a little, moss on its head
// and a dragon curled round it in a carved line that glows faintly (the
// glow is its own texture, laid on with ADD).
function standingStone() {
  const g = new PixelGrid(20, 38), glow = new PixelGrid(20, 38);
  poly(g, [[4, 37], [3, 14], [5, 5], [9, 1], [14, 3], [16, 12], [16, 37]], 1);
  g.ellipse(9.5, 4, 6, 3.4, 2);
  for (let k = 0; k < 7; k++) g.ellipse(4 + (k * 5) % 12, 6 + (k * 3) % 8, 1.8, 1.2, 2);
  shade(g, 1, [0x1a2420, 0x2e3c36, 0x46564e, 0x64766c, 0x8a9a90], { r: 4, base: 0.5, depth: 0.5, bias: (x, y) => ((x * 7 + y * 3) % 11 === 0 ? -0.15 : 0) });
  shade(g, 2, [0x1e3a14, 0x3e7a26, 0x7ab848, 0xb8e070], { r: 2, base: 0.55 });
  // The carving: a coiled dragon, a spiral with a head and a tail.
  for (let a = 0; a < Math.PI * 4.2; a += 0.08) {
    const r = 1 + a * 0.55, x = Math.round(10 + Math.cos(a) * r * 0.8), y = Math.round(22 + Math.sin(a) * r);
    g.set(x, y, 0x10180e); glow.set(x, y, 0x7af0c8);
  }
  g.set(15, 14, 0x10180e); g.set(16, 13, 0x10180e); glow.set(16, 13, 0xffffff);
  g.outline(0x070a08);
  return { g, glow };
}

// A stone lantern: a wide cap, a fire box with a lit window, a post and a
// foot, moss in the cracks.
function stoneLantern() {
  const g = new PixelGrid(14, 24);
  poly(g, [[0, 6], [3, 3], [11, 3], [14, 6]], 1);
  g.rect(6, 1, 2, 2, 1);
  g.rect(3, 7, 8, 6, 1);
  g.rect(5, 8, 4, 4, 3);
  g.rect(5, 13, 4, 7, 1);
  g.rect(2, 20, 10, 4, 1);
  shade(g, 1, [0x2a2a26, 0x4a4a42, 0x6e6c62, 0x96928a], { r: 2, base: 0.55 });
  shade(g, 3, [0xd86a20, 0xffb040, 0xfff0a0], { r: 2, base: 0.7, light: [0, 0] });
  for (const [x, y] of [[2, 6], [4, 20], [10, 21], [6, 14]]) g.set(x, y, 0x5a8a3a);
  g.outline(0x0a0a08);
  return g;
}

// ---------------------------------------------------------------- effects
// A shaft of light: a long soft beam, brightest in its core, fading at both
// ends. Drawn white, tinted and added (ADD) in use.
function lightShaft() {
  const w = 40, h = 160;
  return rgbaCanvas(w, h, (x, y) => {
    const t = y / h;
    const core = Math.max(0, 1 - Math.abs(x - w / 2) / (w / 2));
    const along = Math.min(1, t * 4) * Math.min(1, (1 - t) * 1.6);
    const a = core * core * along * 0.7;
    return a > 0.01 ? { c: 0xffffff, a } : null;
  });
}

// A rainbow arc (half a ring), soft-edged.
function rainbow() {
  const w = 120, h = 64, cx = 60, cy = 62, R = 56;
  const bands = [0xff4a4a, 0xff9a3a, 0xffe85a, 0x5ad86a, 0x4aa8ff, 0x8a6af0];
  return rgbaCanvas(w, h, (x, y) => {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    const k = (R - d) / 1.6;
    if (k < 0 || k >= bands.length) return null;
    const fadeEnds = Math.min(1, (cy - y) / 26);
    return { c: bands[Math.floor(k)], a: 0.85 * fadeEnds };
  });
}

// The curtain of spray that sweeps across the wall in the Cascade: a tall
// sheet of falling water, threads of white in it, soft at both sides.
function sprayCurtain() {
  const w = 56, h = 96;
  const rng = new SeededRandom(91);
  const threads = Array.from({ length: 18 }, () => ({ x: rng.range(4, w - 4), ph: rng.range(0, h), len: rng.range(10, 36) }));
  return rgbaCanvas(w, h, (x, y) => {
    const side = Math.min(1, Math.min(x, w - 1 - x) / 14);
    let a = 0.28 * side * side;
    let c = 0xe8faff;
    for (const t of threads) {
      if (Math.abs(x - t.x) < 0.8) {
        const k = ((y - t.ph) % h + h) % h;
        if (k < t.len) { a = Math.max(a, 0.75 * side * (1 - k / t.len * 0.5)); c = 0xffffff; }
      }
    }
    return { c, a };
  });
}

// ---------------------------------------------------------------- note icons
// A blank bell note (the monastery's echo): a little gold bell, no arrow.
function bellNote(size) {
  const g = new PixelGrid(size, size);
  const m = size / 2;
  const s = size / 13;
  poly(g, [[m - 2 * s, 2 * s], [m + 2 * s, 2 * s], [m + 3 * s, 6 * s], [m + 5 * s, 10 * s], [m - 5 * s, 10 * s], [m - 3 * s, 6 * s]], 0xffffff);
  g.rect(Math.round(m - 1), Math.round(10 * s), 2, Math.max(1, Math.round(2 * s)), 0xffffff);
  g.rect(Math.round(m - 0.5), Math.round(s), 1, 1, 0xffffff);
  return g;
}

// A vine leaf, to sit on the bend where a vine note hands over.
function leafGrid() {
  const g = new PixelGrid(7, 5);
  poly(g, [[0, 3], [3, 0], [7, 1], [4, 4]], 1);
  shade(g, 1, [0x2a6a1a, 0x5aa83a, 0x9ad860], { r: 1, base: 0.55 });
  g.line(1, 3, 5, 1, 0x2a5a14);
  return g;
}

export function buildFarTextures(scene) {
  add(scene, 'decor_lantern_far', paperLantern());
  add(scene, 'decor_wheel', prayerWheel(0));
  addFrames(scene, 'far_wheel', [0, 1, 2].map(prayerWheel));
  add(scene, 'far_walkway', walkwayTile());
  add(scene, 'far_bell', bellGrid());
  addFrames(scene, 'far_monk', [0, 1, 2, 3].map(monkFrame));
  add(scene, 'decor_glowcap', glowcapGrid());
  add(scene, 'decor_rootcurtain', rootCurtain(5));
  add(scene, 'far_roots2', rootCurtain(19));
  addCanvas(scene, 'far_shaft', lightShaft());
  addCanvas(scene, 'far_rainbow', rainbow());
  addCanvas(scene, 'far_curtain', sprayCurtain());
  add(scene, 'icon_bell', bellNote(11));
  add(scene, 'icon_bell_s', bellNote(7));
  add(scene, 'far_leaf', leafGrid());
  const st = standingStone();
  add(scene, 'far_stone', st.g);
  add(scene, 'far_stone_glow', st.glow);
  add(scene, 'far_tlantern', stoneLantern());
}

export { lerpColor, makeRamp };
