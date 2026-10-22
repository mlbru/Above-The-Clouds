// Procedural pixel-art texture factory. Everything is generated at boot so the
// game has no external art dependencies; hand-made sheets can replace any key.
import { PixelGrid, makeCanvas } from '../utils/pixelGrid.js';
import { darken, lighten, lerpColor, bayer, rgb } from '../utils/color.js';
import { SeededRandom, makeNoise2D } from '../utils/seededRandom.js';
import { drawClimberSheet, FRAME_NAMES, FRAME_W, FRAME_H, POSES } from './climberArt.js';
import { BIOMES } from '../data/biomes.js';
import { ridgeHeights, buildBackdropTextures } from './backdropArt.js';
import { buildShopTextures } from './shopArt.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';

const OUT = 0x16141f;

function addGrid(scene, key, grid) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const c = makeCanvas(grid.w, grid.h);
  grid.drawTo(c.getContext('2d'));
  scene.textures.addCanvas(key, c);
}

function addFramesFromGrids(scene, key, grids) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const w = grids[0].w, h = grids[0].h;
  const c = makeCanvas(w * grids.length, h);
  const ctx = c.getContext('2d');
  grids.forEach((g, i) => g.drawTo(ctx, i * w, 0));
  const tex = scene.textures.addCanvas(key, c);
  grids.forEach((g, i) => tex.add(i, 0, i * w, 0, w, h));
}

export function buildClimberTexture(scene, look) {
  const key = 'climber';
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const c = makeCanvas(FRAME_W * FRAME_NAMES.length, FRAME_H);
  drawClimberSheet(c.getContext('2d'), look);
  const tex = scene.textures.addCanvas(key, c);
  FRAME_NAMES.forEach((name, i) => tex.add(name, 0, i * FRAME_W, 0, FRAME_W, FRAME_H));
  return POSES;
}

// Preview sheet used by the wardrobe (separate key so it never disturbs gameplay).
export function buildPreviewTexture(scene, key, look) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const c = makeCanvas(FRAME_W * FRAME_NAMES.length, FRAME_H);
  drawClimberSheet(c.getContext('2d'), look);
  const tex = scene.textures.addCanvas(key, c);
  FRAME_NAMES.forEach((name, i) => tex.add(name, 0, i * FRAME_W, 0, FRAME_W, FRAME_H));
}

function holdGrid(biome, kind, hazard) {
  const base = lerpColor(biome.rock[3], biome.holdTint, 0.45);
  let body = base, light = lighten(base, 0.35), dark = darken(base, 0.65);
  if (hazard === 'loose') { body = 0xa8743e; light = 0xd09a5a; dark = 0x6e4422; }
  if (hazard === 'icy') { body = 0x9fd2f2; light = 0xeaf8ff; dark = 0x5a8fc0; }
  if (hazard === 'crumbling') { body = 0x8a7f74; light = 0xb8ab9a; dark = 0x4e463e; }
  const w = kind === 'jug' ? 16 : 12, h = kind === 'jug' ? 9 : 8;
  const g = new PixelGrid(w + 2, h + 3);
  const cx = (w + 2) / 2, cy = h / 2 + 1;
  g.ellipse(cx, cy, w / 2, h / 2 - 0.3, body);
  for (let x = 2; x < w; x++) for (let y = 1; y < 4; y++) {
    if (g.get(x, y) !== null && g.get(x, y - 1) === null) { g.set(x, y, light); g.set(x, y + 1, lerpColor(light, body, 0.5)); }
  }
  for (let x = 1; x < w + 1; x++) for (let y = h; y > 2; y--) {
    if (g.get(x, y) !== null && g.get(x, y + 1) === null) { g.set(x, y, dark); break; }
  }
  if (kind === 'jug') { g.ellipse(cx, cy - 0.5, w / 2 - 3, 1.6, darken(base, 0.4)); }
  if (hazard === 'loose') { g.line(cx - 1, 2, cx + 1, h - 1, 0x3e2612); g.set(cx + 3, h, 0x8a5a2e); }
  if (hazard === 'crumbling') {
    g.line(cx - 3, 2, cx - 1, h - 1, 0x2a2420); g.line(cx + 1, 2, cx + 3, h - 2, 0x2a2420);
    g.set(cx - 4, h + 1, 0x8a7f74); g.set(cx + 4, h + 2, 0x8a7f74); g.set(cx, h + 1, 0x6e655c);
  }
  if (hazard === 'icy') { g.set(cx - 2, 2, 0xffffff); g.set(cx + 2, 3, 0xffffff); g.set(cx + 1, h + 1, 0x8ec5f0); g.set(cx + 1, h + 2, 0x8ec5f0); }
  // Chalk marks: the tell for "this is a real hold".
  if (hazard !== 'icy') { g.set(cx - 2, 2, 0xf6f3ea); g.set(cx, 2, 0xf6f3ea); g.set(cx + 2, 3, 0xe8e4da); g.set(cx - 1, 3, 0xe8e4da); }
  g.outline(OUT);
  return g;
}

export function buildHoldTextures(scene) {
  for (const biome of Object.values(BIOMES)) {
    for (const kind of ['hold', 'jug']) {
      for (const hazard of [null, 'loose', 'icy', 'crumbling']) {
        if (kind === 'jug' && hazard) continue;
        addGrid(scene, holdKey(biome.id, kind, hazard), holdGrid(biome, kind, hazard));
      }
    }
  }
}
export const holdKey = (biomeId, kind, hazard) => `hold_${biomeId}_${kind}_${hazard || 'none'}`;

function arrowGrid(dir, size) {
  const g = new PixelGrid(size, size);
  const c = 0xffffff, m = Math.floor(size / 2);
  // Draw an up arrow then rotate into place.
  const up = new PixelGrid(size, size);
  const head = Math.floor(size / 2);
  for (let y = 1; y <= head; y++) for (let x = m - (y - 1); x <= m + (y - 1); x++) up.set(x, y, c);
  const sw = Math.max(1, Math.floor(size / 5));
  up.rect(m - sw, head, sw * 2 + 1, size - head - 1, c);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const v = up.get(x, y);
    if (v === null) continue;
    if (dir === 'U') g.set(x, y, v);
    if (dir === 'D') g.set(x, size - 1 - y, v);
    if (dir === 'L') g.set(y, x, v);
    if (dir === 'R') g.set(size - 1 - y, x, v);
  }
  g.outline(OUT);
  return g;
}

function decorGrids() {
  const d = {};
  // Pine tree
  const pine = (snow) => {
    const g = new PixelGrid(17, 28);
    g.rect(7, 22, 3, 6, 0x5a3a24);
    const greens = [0x2d5a34, 0x3d7442, 0x4f8a4a];
    for (let tier = 0; tier < 4; tier++) {
      const top = 2 + tier * 5, w = 3 + tier * 2;
      for (let y = 0; y < 7; y++) {
        const hw = Math.round((y / 6) * w);
        for (let x = 8 - hw; x <= 8 + hw; x++) g.set(x, top + y, x < 8 ? greens[2] : x > 9 ? greens[0] : greens[1]);
      }
      if (snow) for (let x = 8 - w + 2; x <= 8 + w - 2; x++) g.set(x, top + 4, 0xeef6ff);
    }
    g.set(8, 1, greens[1]);
    g.outline(OUT);
    return g;
  };
  d.pine = pine(false);
  d.pine_snow = pine(true);
  const grass = new PixelGrid(9, 6);
  [[1, 3], [2, 1], [3, 2], [4, 0], [5, 2], [6, 1], [7, 3]].forEach(([x, y]) => g2line(grass, x, y, x, 5, x % 2 ? 0x79b24c : 0x4f8a3c));
  d.grass = grass;
  const flowers = new PixelGrid(9, 6);
  [[1, 3], [3, 2], [5, 3], [7, 2]].forEach(([x, y]) => g2line(flowers, x, y, x, 5, 0x4f8a3c));
  [[1, 2, 0xf2d04e], [3, 1, 0xf0f0f0], [5, 2, 0xe86a8a], [7, 1, 0xa8c8ff]].forEach(([x, y, c]) => flowers.set(x, y, c));
  d.flowers = flowers;
  const fern = new PixelGrid(11, 7);
  for (let i = 0; i < 5; i++) { fern.line(5, 6, 1 + i * 2, 1 + Math.abs(2 - i), i % 2 ? 0x5f9a48 : 0x3f7a3a); }
  d.fern = fern;
  const rocks = new PixelGrid(12, 7);
  rocks.ellipse(4, 4, 3.5, 2.6, 0x8a8f99); rocks.ellipse(8.5, 4.5, 3, 2.2, 0x6f7480); rocks.set(3, 2, 0xb8bcc4); rocks.set(8, 3, 0x9aa0aa);
  rocks.outline(OUT); d.rocks = rocks;
  const icicles = new PixelGrid(13, 11);
  icicles.rect(0, 0, 13, 2, 0xeef6ff);
  [[1, 6], [3, 9], [5, 4], [7, 10], [9, 5], [11, 7]].forEach(([x, len]) => { icicles.line(x, 1, x, len, 0xbfe4ff); icicles.set(x, 1, 0xffffff); });
  d.icicles = icicles;
  const drift = new PixelGrid(16, 6);
  drift.ellipse(8, 5, 8, 4, 0xeef6ff); drift.ellipse(6, 4, 4, 2, 0xffffff);
  for (let x = 0; x < 16; x++) if (drift.get(x, 5) !== null) drift.set(x, 5, 0xc8dcf0);
  d.snowdrift = drift;
  const crystal = new PixelGrid(9, 13);
  crystal.line(3, 12, 2, 4, 0xb8a8f0, 2); crystal.line(5, 12, 6, 1, 0xd8c8ff, 2); crystal.line(7, 12, 8, 6, 0x9a88e0, 1);
  crystal.set(6, 1, 0xffffff); crystal.set(2, 4, 0xffffff);
  crystal.outline(0x2a2050); d.crystals = crystal;
  // Base-camp tent
  const tent = new PixelGrid(28, 16);
  for (let y = 0; y < 13; y++) for (let x = 13 - y; x <= 14 + y; x++) tent.set(x, y + 2, x < 14 ? 0xe07a2e : 0xb85a1e);
  for (let y = 7; y < 15; y++) for (let x = 14 - (y - 7) / 2; x <= 14 + (y - 7) / 2; x++) tent.set(x, y, 0x3a2418);
  tent.line(13, 0, 13, 2, 0x5a3a24);
  tent.outline(OUT); d.tent = tent;
  const sign = new PixelGrid(16, 16);
  sign.rect(7, 5, 2, 11, 0x6a4428); sign.rect(1, 2, 14, 5, 0x9a6a3a); sign.rect(1, 6, 14, 1, 0x6a4428); sign.rect(3, 4, 9, 1, 0xd8c8a8);
  sign.outline(OUT); d.sign = sign;
  const cairn = new PixelGrid(11, 15);
  [[5.5, 12, 4.5, 2.4], [5, 8.5, 3.6, 2], [6, 5.5, 2.8, 1.7], [5.5, 3, 2, 1.3]].forEach(([x, y, rx, ry], i) => cairn.ellipse(x, y, rx, ry, [0x7a7f8a, 0x8f949e, 0x6f7480, 0xa4a8b0][i]));
  cairn.outline(OUT); d.cairn = cairn;
  const hut = new PixelGrid(42, 30);
  hut.rect(4, 12, 34, 17, 0x7d7a74);
  for (let y = 12; y < 29; y += 4) for (let x = 4 + ((y / 4) % 2) * 3; x < 38; x += 6) hut.rect(x, y, 5, 3, 0x908c84);
  hut.rect(17, 18, 8, 11, 0x4a3020); hut.rect(18, 19, 6, 10, 0x6a4428); hut.set(22, 24, 0xd8b060);
  hut.rect(29, 16, 5, 4, 0x2a2a3a); hut.set(30, 17, 0xf2c14e);
  for (let y = 0; y < 11; y++) hut.rect(1 + Math.floor(y / 2), 2 + y, 40 - Math.floor(y / 2) * 2, 1, y < 2 ? 0x5a5650 : 0x4a4640);
  hut.rect(30, 0, 4, 6, 0x6a6660);
  hut.outline(OUT); d.hut = hut;
  const axe = new PixelGrid(12, 14);
  axe.line(3, 13, 8, 3, 0x7a5a3a, 2); axe.rect(5, 1, 7, 2, 0x9aa4b0); axe.set(11, 3, 0x9aa4b0); axe.set(5, 3, 0x6a7480);
  axe.outline(OUT); d.axe_stuck = axe;
  const floatRock = new PixelGrid(26, 22);
  floatRock.ellipse(13, 8, 11, 6, 0x63578a); floatRock.ellipse(13, 6, 9, 3.5, 0x8d7fb0);
  for (let y = 12; y < 18; y++) floatRock.rect(13 - (17 - y), y, (17 - y) * 2, 1, 0x443a62);
  floatRock.line(8, 13, 7, 19, 0x79b24c); floatRock.line(18, 12, 19, 17, 0x4f8a3c); floatRock.set(13, 4, 0xfff1d6);
  floatRock.outline(0x17132a); d.float_rock = floatRock;
  return d;
}

function g2line(g, x0, y0, x1, y1, c) { g.line(x0, y0, x1, y1, c); }

function flagsFrames() {
  const frames = [];
  const colors = [0x3b6fb6, 0xf0f0e8, 0xc8463b, 0x4f8a3c, 0xe6b230];
  for (let f = 0; f < 2; f++) {
    const g = new PixelGrid(46, 12);
    for (let x = 0; x < 46; x++) g.set(x, Math.round(2 + Math.sin(x / 46 * Math.PI) * 3), 0x8a7a6a);
    for (let i = 0; i < 7; i++) {
      const x = 3 + i * 6, y = Math.round(2 + Math.sin(x / 46 * Math.PI) * 3) + 1;
      const wave = (i + f) % 2;
      g.rect(x, y, 4, 4 - wave, colors[i % colors.length]);
      g.set(x + 3, y + 3 - wave, darken(colors[i % colors.length], 0.7));
    }
    frames.push(g);
  }
  return frames;
}

function birdFrames(big) {
  const frames = [];
  const c = big ? 0x3a2e28 : 0x2a2a34;
  for (let f = 0; f < 2; f++) {
    const w = big ? 20 : 7, h = big ? 9 : 4;
    const g = new PixelGrid(w, h);
    const m = Math.floor(w / 2);
    if (big) {
      g.rect(m - 2, 4, 5, 2, c); g.set(m + 3, 4, 0xe8c070); g.set(m - 3, 5, c); g.set(m - 4, 6, c);
      if (f === 0) { g.line(m - 2, 4, 1, 1, c, 2); g.line(m + 2, 4, w - 2, 1, c, 2); }
      else { g.line(m - 2, 5, 1, 7, c, 2); g.line(m + 2, 5, w - 2, 7, c, 2); }
    } else if (f === 0) { g.set(0, 1, c); g.set(1, 2, c); g.set(2, 2, c); g.set(3, 3, c); g.set(4, 2, c); g.set(5, 2, c); g.set(6, 1, c); }
    else { g.set(0, 3, c); g.set(1, 2, c); g.set(2, 2, c); g.set(3, 2, c); g.set(4, 2, c); g.set(5, 2, c); g.set(6, 3, c); }
    frames.push(g);
  }
  return frames;
}

function particleTextures(scene) {
  const one = new PixelGrid(1, 1); one.set(0, 0, 0xffffff); addGrid(scene, 'px', one);
  const two = new PixelGrid(2, 2); two.rect(0, 0, 2, 2, 0xffffff); addGrid(scene, 'px2', two);
  const leaf = new PixelGrid(3, 2); leaf.rect(0, 0, 2, 1, 0x79b24c); leaf.set(1, 1, 0x4f8a3c); leaf.set(2, 1, 0x4f8a3c); addGrid(scene, 'leaf', leaf);
  const pebble = new PixelGrid(3, 3); pebble.rect(0, 0, 2, 2, 0x8a8478); pebble.set(2, 1, 0x5a554c); pebble.set(1, 2, 0x5a554c); addGrid(scene, 'pebble', pebble);
  const spark = new PixelGrid(5, 5); spark.line(2, 0, 2, 4, 0xffffff); spark.line(0, 2, 4, 2, 0xffffff); addGrid(scene, 'spark', spark);
  const puff = new PixelGrid(6, 5); puff.ellipse(3, 2.5, 3, 2.5, 0xffffff); addGrid(scene, 'puff', puff);
  const dust = new PixelGrid(4, 4); dust.ellipse(2, 2, 2, 2, 0xd8d0c0); addGrid(scene, 'dust', dust);
  // A falling boulder for the Stone Wall's rockfall.
  const rock = new PixelGrid(13, 11);
  rock.ellipse(6.5, 5.5, 6, 5, 0x8a6446); rock.ellipse(5.5, 4.5, 4, 3, 0xb08458); rock.set(4, 3, 0xe0b880);
  rock.line(8, 3, 10, 7, 0x4a3020); rock.outline(OUT); addGrid(scene, 'rock_fall', rock);
  const drop = new PixelGrid(1, 3); drop.rect(0, 0, 1, 3, 0xbfe4ff); addGrid(scene, 'drop', drop);
}

// Grey-scale-ish soft disc with ordered dithering (used for headlamp and glows).
function glowTexture(scene, key, r) {
  const size = r * 2;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x + 0.5 - r, y + 0.5 - r) / r;
    const a = Math.max(0, 1 - d);
    const v = a * a;
    const lvl = Math.floor(v * 4 + bayer(x, y)) / 4;
    const i = (y * size + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = Math.round(Math.min(1, lvl) * 255);
  }
  ctx.putImageData(img, 0, 0);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, c);
}

function uiTextures(scene) {
  for (const d of ['L', 'U', 'R', 'D']) {
    addGrid(scene, `arrow_${d}`, arrowGrid(d, 11));
    addGrid(scene, `arrow_s_${d}`, arrowGrid(d, 7));
  }
  const check = new PixelGrid(7, 7);
  check.line(1, 3, 3, 5, 0xffffff); check.line(3, 5, 6, 1, 0xffffff); check.outline(OUT); addGrid(scene, 'icon_check', check);
  const cross = new PixelGrid(7, 7);
  cross.line(1, 1, 5, 5, 0xffffff); cross.line(5, 1, 1, 5, 0xffffff); cross.outline(OUT); addGrid(scene, 'icon_cross', cross);
  const ring = new PixelGrid(21, 21);
  for (let a = 0; a < 96; a++) {
    const c = Math.cos(a / 96 * Math.PI * 2), sn = Math.sin(a / 96 * Math.PI * 2);
    ring.set(10 + c * 9, 10 + sn * 9, 0xffffff);
    ring.set(10 + c * 8, 10 + sn * 8, 0xffffff);
  }
  ring.outline(OUT);
  addGrid(scene, 'ring', ring);
  const flag = new PixelGrid(12, 18);
  flag.line(1, 0, 1, 17, 0xd8d0c0);
  for (let y = 0; y < 7; y++) for (let x = 2; x < 2 + Math.round(9 - Math.abs(y - 3) * 2.2); x++) flag.set(x, y + 1, y < 3 ? 0xf2c14e : 0xd89a2a);
  flag.set(4, 3, 0xffffff);
  flag.outline(OUT); addGrid(scene, 'flag', flag);
  const wind = new PixelGrid(9, 7);
  wind.line(0, 1, 5, 1, 0xffffff); wind.set(6, 0, 0xffffff); wind.line(0, 3, 7, 3, 0xffffff); wind.set(8, 2, 0xffffff); wind.line(1, 5, 5, 5, 0xffffff); wind.set(6, 6, 0xffffff);
  wind.outline(OUT); addGrid(scene, 'icon_wind', wind);
  const hand = new PixelGrid(7, 7);
  hand.rect(1, 2, 5, 4, 0xffffff); hand.rect(1, 0, 1, 3, 0xffffff); hand.rect(3, 0, 1, 3, 0xffffff); hand.rect(5, 1, 1, 2, 0xffffff); hand.outline(OUT);
  addGrid(scene, 'icon_grip', hand);
  const mtn = new PixelGrid(9, 7);
  for (let y = 0; y < 6; y++) for (let x = 4 - y; x <= 4 + y; x++) mtn.set(x, y + 1, y < 2 ? 0xffffff : 0xb8c4d8);
  mtn.outline(OUT); addGrid(scene, 'icon_mtn', mtn);
}

// ---------- Background layers (drawn in natural colours, tinted by daylight) ----------

function paintRange(scene, key, { w, h, seed, base, amp, rough, body, shadow, snow, snowLine, trees }) {
  const rng = new SeededRandom(seed);
  const ridge = ridgeHeights(rng, w, base, amp, rough);
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const noise = makeNoise2D(seed);
  const smoothSlope = (x) => (ridge[(x + 5) % w] - ridge[(x - 5 + w) % w]) / 10;
  for (let x = 0; x < w; x++) {
    const top = Math.round(ridge[x]);
    const slope = smoothSlope(x);
    for (let y = Math.max(0, top); y < h; y++) {
      const depth = y - top;
      const n = noise(x * 0.04, y * 0.06);
      let col = body;
      // Right-facing slopes are in shadow; gullies run diagonally down-left.
      const gully = noise((x + depth * 0.6) * 0.07, depth * 0.02) > 0.62;
      const shadowSide = (slope > 0.12 && depth < 40 + n * 30) || (gully && depth > 4);
      if (shadowSide) col = shadow;
      if (snow && depth < 14 + n * 22 && y < snowLine + n * 24) {
        col = shadowSide ? lerpColor(snow, shadow, 0.35) : snow;
      }
      const fade = Math.min(1, depth / 70);
      if (fade > 0.6 && bayer(x, y) < (fade - 0.6) * 1.5) col = lerpColor(col, body, 0.5);
      const i = (y * w + x) * 4;
      const [r, g, b] = rgb(col);
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  if (trees) {
    const tg = new PixelGrid(w, h);
    for (let i = 0; i < trees.count; i++) {
      const x = rng.int(0, w - 1);
      const top = Math.round(ridge[x]) + rng.int(2, 26);
      const th = rng.int(6, 11);
      for (let y = 0; y < th; y++) {
        const hw = Math.floor((y / th) * 3.2);
        for (let xx = x - hw; xx <= x + hw; xx++) tg.set(((xx % w) + w) % w, top + y, xx < x ? trees.light : trees.dark);
      }
      tg.set(x, top + th, 0x2a2018);
    }
    tg.drawTo(ctx, 0, 0, true);
  }
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, c);
}

function paintCloud(scene, key, seed, w, h) {
  const rng = new SeededRandom(seed);
  const g = new PixelGrid(w, h);
  const puffs = rng.int(4, 7);
  for (let i = 0; i < puffs; i++) {
    const cx = rng.range(w * 0.2, w * 0.8), cy = rng.range(h * 0.45, h * 0.7);
    g.ellipse(cx, cy, rng.range(w * 0.12, w * 0.24), rng.range(h * 0.25, h * 0.42), 0xffffff);
  }
  g.ellipse(w / 2, h * 0.72, w * 0.46, h * 0.22, 0xffffff);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (g.get(x, y) === null) continue;
    if (g.get(x, y + 2) === null || y > h * 0.75) g.set(x, y, 0xdfe6f2);
    else if (g.get(x, y - 1) === null) g.set(x, y, 0xffffff);
  }
  addGrid(scene, key, g);
}

function paintCloudSea(scene) {
  const w = 480, h = 90;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const noise = makeNoise2D(4242);
  for (let x = 0; x < w; x++) {
    // Periodic bumps so the strip tiles horizontally.
    const u = x / w * Math.PI * 2;
    const top = 14 + Math.sin(u * 3) * 4 + Math.sin(u * 7 + 1) * 3 + Math.sin(u * 13 + 2) * 2;
    for (let y = Math.floor(top); y < h; y++) {
      const d = y - top;
      const bump = Math.sin(u * 17 + y * 0.4) * 0.5 + 0.5;
      let col = d < 2 ? 0xffffff : d < 10 ? 0xf2f4fa : 0xdde3f0;
      if (d > 4 && bump > 0.8 && bayer(x, y) < 0.5) col = 0xc8d0e4;
      if (d > 30) col = lerpColor(0xd2d9ea, 0xbcc6de, Math.min(1, (d - 30) / 40));
      if (noise(x * 0.1, y * 0.2) > 0.7 && d > 8) col = lerpColor(col, 0xffffff, 0.5);
      const i = (y * w + x) * 4;
      const [r, g, b] = rgb(col);
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  if (scene.textures.exists('cloudsea')) scene.textures.remove('cloudsea');
  scene.textures.addCanvas('cloudsea', c);
}

function paintStars(scene) {
  const w = GAME_WIDTH, h = GAME_HEIGHT - 50;
  const g = new PixelGrid(w, h);
  const rng = new SeededRandom(99);
  for (let i = 0; i < 260; i++) g.set(rng.int(0, w - 1), rng.int(0, h - 1), rng.chance(0.3) ? 0xc8d4ff : 0xffffff);
  for (let i = 0; i < 14; i++) {
    const x = rng.int(2, w - 3), y = rng.int(2, h - 3);
    g.set(x, y, 0xffffff); g.set(x - 1, y, 0x8890c0); g.set(x + 1, y, 0x8890c0); g.set(x, y - 1, 0x8890c0); g.set(x, y + 1, 0x8890c0);
  }
  addGrid(scene, 'stars', g);
}

function paintSunMoon(scene) {
  const sun = new PixelGrid(18, 18);
  sun.ellipse(9, 9, 8.5, 8.5, 0xffe8a8); sun.ellipse(9, 9, 6.5, 6.5, 0xfff6d8);
  for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) {
    const d = Math.hypot(x - 8.5, y - 8.5);
    if (d > 7 && d < 9 && bayer(x, y) < 0.5) sun.set(x, y, null);
  }
  addGrid(scene, 'sun', sun);
  const moon = new PixelGrid(14, 14);
  moon.ellipse(7, 7, 6, 6, 0xf0f2ff);
  moon.ellipse(9.5, 5.5, 5, 5, null);
  moon.set(4, 7, 0xc8cce0); moon.set(5, 10, 0xc8cce0);
  addGrid(scene, 'moon', moon);
}

function paintMist(scene) {
  const w = 256, h = 48;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const noise = makeNoise2D(777);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w * Math.PI * 2;
    const band = Math.sin((y / h) * Math.PI);
    const n = (Math.sin(u * 2 + y * 0.05) * 0.5 + 0.5) * 0.5 + noise(x * 0.04, y * 0.12) * 0.5;
    const a = band * n;
    const i = (y * w + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = a > 0.35 + bayer(x, y) * 0.4 ? 255 : 0;
  }
  ctx.putImageData(img, 0, 0);
  if (scene.textures.exists('mist')) scene.textures.remove('mist');
  scene.textures.addCanvas('mist', c);
}

function paintVignette(scene) {
  const w = GAME_WIDTH, h = GAME_HEIGHT;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x - w / 2) / (w / 2), dy = (y - h / 2) / (h / 2);
    const d = Math.sqrt(dx * dx * 0.7 + dy * dy);
    const v = Math.max(0, d - 0.75) * 2.2;
    const i = (y * w + x) * 4;
    img.data[i] = 150; img.data[i + 1] = 20; img.data[i + 2] = 30;
    img.data[i + 3] = v > bayer(x, y) ? 255 : 0;
  }
  ctx.putImageData(img, 0, 0);
  if (scene.textures.exists('vignette')) scene.textures.remove('vignette');
  scene.textures.addCanvas('vignette', c);
}

function paintWaterfall(scene) {
  const w = 10, h = 32;
  const g = new PixelGrid(w, h);
  const rng = new SeededRandom(3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const edge = x === 0 || x === w - 1;
    g.set(x, y, edge ? 0x5a8fc0 : 0x8ec5f0);
  }
  for (let i = 0; i < 14; i++) {
    const x = rng.int(1, w - 2), y = rng.int(0, h - 1), len = rng.int(3, 8);
    for (let j = 0; j < len; j++) g.set(x, (y + j) % h, j === 0 ? 0xffffff : 0xd8eeff);
  }
  addGrid(scene, 'waterfall', g);
}

// Big dark outcrop for the foreground parallax layer, with a lit rim in the
// biome's accent colour (grass, snow or crystal).
function foregroundRock(biome, seed) {
  const w = 110, h = 220;
  const g = new PixelGrid(w, h);
  const noise = makeNoise2D(seed);
  const body = darken(biome.rock[0], 0.5), rim = darken(biome.rock[1], 0.75);
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const edge = Math.round(30 + Math.sin(t * Math.PI) * 40 + (noise(y * 0.03, 1) - 0.5) * 40 + (noise(y * 0.15, 4) - 0.5) * 6);
    for (let x = 0; x < edge; x++) g.set(x, y, body);
    g.set(edge - 1, y, rim);
    if (noise(y * 0.08, 7) > 0.55) g.set(edge - 2, y, rim);
  }
  // Sparse tufts / snow caps where the silhouette steps outward.
  for (let y = 2; y < h; y++) {
    let ex = 0; while (ex < w && g.get(ex, y) !== null) ex++;
    let exUp = 0; while (exUp < w && g.get(exUp, y - 2) !== null) exUp++;
    if (ex - exUp >= 2 && noise(y * 0.2, 9) > 0.4) { g.set(ex - 1, y - 1, biome.accentB); g.set(ex - 2, y - 1, biome.accentA); g.set(ex, y - 1, biome.accentA); }
  }
  return g;
}

export function buildAllTextures(scene, look) {
  for (const biome of Object.values(BIOMES)) addGrid(scene, `fg_${biome.id}`, foregroundRock(biome, biome.from + 17));
  buildClimberTexture(scene, look);
  buildHoldTextures(scene);
  particleTextures(scene);
  uiTextures(scene);
  buildShopTextures(scene);
  glowTexture(scene, 'glow', 40);
  glowTexture(scene, 'glow_small', 10);
  const decor = decorGrids();
  for (const [k, g] of Object.entries(decor)) addGrid(scene, `decor_${k}`, g);
  addFramesFromGrids(scene, 'decor_flags', flagsFrames());
  addFramesFromGrids(scene, 'bird', birdFrames(false));
  addFramesFromGrids(scene, 'eagle', birdFrames(true));

  paintRange(scene, 'bg_summits', { w: 480, h: 110, seed: 11, base: 50, amp: 34, rough: 0.55, body: 0xdfe6f2, shadow: 0xc6d0e2, snow: 0xffffff, snowLine: 70 });
  paintRange(scene, 'bg_far', { w: 480, h: 160, seed: 21, base: 60, amp: 46, rough: 0.56, body: 0xaebbd2, shadow: 0x8e9cb8, snow: 0xf4f8ff, snowLine: 62 });
  paintRange(scene, 'bg_mid', { w: 480, h: 150, seed: 31, base: 52, amp: 36, rough: 0.6, body: 0x7f8ca6, shadow: 0x66728e, snow: 0xe6eef8, snowLine: 34 });
  paintRange(scene, 'bg_near', { w: 480, h: 120, seed: 41, base: 40, amp: 20, rough: 0.5, body: 0x5f8058, shadow: 0x4c6a4a, snow: null, snowLine: 0, trees: { count: 220, light: 0x3f6a44, dark: 0x2e5236 } });
  buildBackdropTextures(scene, BIOMES);
  [0, 1, 2, 3].forEach((i) => paintCloud(scene, `cloud${i}`, 500 + i, i % 2 ? 72 : 52, i % 2 ? 22 : 18));
  paintCloudSea(scene);
  paintStars(scene);
  paintSunMoon(scene);
  paintMist(scene);
  paintVignette(scene);
  paintWaterfall(scene);
}
