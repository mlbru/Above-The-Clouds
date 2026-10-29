// Procedural pixel-art texture factory. Everything is generated at boot so the
// game has no external art dependencies; hand-made sheets can replace any key.
import { PixelGrid, makeCanvas } from '../utils/pixelGrid.js';
import { darken, lighten, lerpColor, bayer, rgb } from '../utils/color.js';
import { SeededRandom, makeNoise2D } from '../utils/seededRandom.js';
import { drawClimberSheet, FRAME_NAMES, FRAME_W, FRAME_H, POSES } from './climberArt.js';
import { BIOMES } from '../data/biomes.js';
import { ridgeHeights, buildBackdropTextures } from './backdropArt.js';
import { buildShopTextures } from './shopArt.js';
import { buildCampTextures } from './campArt.js';
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
  if (scene.textures.exists('climber_mask')) scene.textures.remove('climber_mask');
  const c = makeCanvas(FRAME_W * FRAME_NAMES.length, FRAME_H);
  const m = makeCanvas(FRAME_W * FRAME_NAMES.length, FRAME_H);
  drawClimberSheet(c.getContext('2d'), look, m.getContext('2d'));
  const tex = scene.textures.addCanvas(key, c);
  const mask = scene.textures.addCanvas('climber_mask', m);
  FRAME_NAMES.forEach((name, i) => {
    tex.add(name, 0, i * FRAME_W, 0, FRAME_W, FRAME_H);
    mask.add(name, 0, i * FRAME_W, 0, FRAME_W, FRAME_H);
  });
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

// Holds with a shape of their own: the Amber Hive's wax nubs, the Clockwork
// Bastion's brass rungs and the Bone Garden's bones (the cracked ones snap).
// Same frame size as the round holds so everything lines up the same.
function specialHoldGrid(biome, kind, hazard) {
  const jug = kind === 'jug';
  const w = jug ? 16 : 12, h = jug ? 9 : 8;
  const g = new PixelGrid(w + 2, h + 3);
  const cx = (w + 2) / 2, cy = h / 2 + 1;
  if (biome.id === 'hive' && !hazard) {
    // A six-sided wax cap, honey pooled in its middle.
    const r = jug ? 7 : 5.4, ry = r * 0.8;
    const hex = [0, 1, 2, 3, 4, 5].map((i) => [cx + Math.cos((i / 6) * Math.PI * 2) * r, cy + Math.sin((i / 6) * Math.PI * 2) * ry]);
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      let inside = false;
      for (let i = 0, j = 5; i < 6; j = i++) {
        const [xi, yi] = hex[i], [xj, yj] = hex[j];
        if ((yi > y + 0.5) !== (yj > y + 0.5) && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) g.set(x, y, y < cy - ry * 0.4 ? 0xf8d890 : y > cy + ry * 0.5 ? 0x9a5c18 : 0xd8a048);
    }
    g.ellipse(cx, cy + 0.5, r * 0.45, ry * 0.4, 0xe88a14);
    g.set(cx - 1, cy, 0xffe8a0);
    g.set(cx + 1, cy + ry + 1, 0xe88a14);
    g.set(cx + 1, cy + ry + 2, 0xffb840);
  } else if (biome.id === 'clockwork' && !hazard) {
    // A brass rung bolted to an iron plate.
    g.rect(1, 2, w, h - 2, 0x2a2420);
    g.rect(2, 3, w - 2, h - 4, 0x3e3428);
    const bar = jug ? 3 : 2;
    g.rect(3, cy - 1, w - 4, bar + 1, 0xb8863a);
    g.rect(3, cy - 1, w - 4, 1, 0xf0c870);
    g.rect(3, cy + bar - 1, w - 4, 1, 0x7a5420);
    for (const bx of [2, w - 1]) { g.set(bx, 3, 0x9a9aa4); g.set(bx, h - 1, 0x9a9aa4); }
    g.set(cx, cy - 1, 0xffffff);
  } else if (biome.id === 'bones' && (!hazard || hazard === 'crumbling')) {
    // A bone: a shaft with knobbly ends. A jug is a vertebra with a spike.
    const bone = 0xe4d8bc, shade = 0xa89878, lit = 0xfff6e0;
    if (jug) {
      g.ellipse(cx, cy + 1, 6.5, 3, bone);
      fillTri(g, cx - 2, cy - 1, cx + 2, cy - 1, cx, 0, bone);
      g.ellipse(cx - 4, cy + 1, 1.4, 1.2, 0x3a3028); g.ellipse(cx + 4, cy + 1, 1.4, 1.2, 0x3a3028);
    } else {
      g.rect(3, cy - 1, w - 4, 3, bone);
      for (const ex of [2.5, w - 0.5]) { g.ellipse(ex, cy - 1.2, 1.8, 1.6, bone); g.ellipse(ex, cy + 1.6, 1.8, 1.6, bone); }
    }
    for (let x = 0; x < g.w; x++) for (let y = 0; y < g.h; y++) {
      if (g.get(x, y) !== bone) continue;
      if (g.get(x, y - 1) === null) g.set(x, y, lit);
      else if (g.get(x, y + 1) === null) g.set(x, y, shade);
    }
    if (hazard === 'crumbling') {
      // Cracked through: the tell that it will not hold for long.
      g.line(cx - 1, cy - 2, cx + 1, cy + 2, 0x3a2a22);
      g.set(cx + 2, cy - 1, 0x3a2a22); g.set(cx - 3, cy + 1, 0x8a7a64);
      g.set(cx + 4, h + 1, shade); g.set(cx - 4, h + 2, shade);
    } else {
      g.set(cx - 2, cy, 0xf6f3ea); g.set(cx + 1, cy - 1, 0xf6f3ea);
    }
  } else return null;
  g.outline(OUT);
  return g;
}

function fillTri(g, x0, y0, x1, y1, x2, y2, c) {
  const minY = Math.floor(Math.min(y0, y1, y2)), maxY = Math.ceil(Math.max(y0, y1, y2));
  for (let y = minY; y <= maxY; y++) for (let x = Math.floor(Math.min(x0, x1, x2)); x <= Math.ceil(Math.max(x0, x1, x2)); x++) {
    const px = x + 0.5, py = y + 0.5;
    const d1 = (px - x1) * (y0 - y1) - (x0 - x1) * (py - y1);
    const d2 = (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
    const d3 = (px - x0) * (y2 - y0) - (x2 - x0) * (py - y0);
    if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) g.set(x, y, c);
  }
}

function holdGrid(biome, kind, hazard) {
  const special = specialHoldGrid(biome, kind, hazard);
  if (special) return special;
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
  // Stone Wall: an old iron piton with a faded rope loop hanging from it.
  const piton = new PixelGrid(10, 11);
  piton.rect(3, 0, 5, 2, 0x8a5a3a); piton.set(4, 0, 0xc0884e); piton.rect(5, 2, 1, 2, 0x6a4a34);
  for (let a = 0; a < 20; a++) piton.set(Math.round(5 + Math.sin(a / 20 * Math.PI) * 3.5), 3 + Math.round(a / 20 * 7), a % 3 ? 0xd8b060 : 0xa87a3a);
  piton.outline(OUT); d.piton = piton;
  // Above the Clouds: a twig nest with two speckled eggs.
  const nest = new PixelGrid(12, 7);
  nest.ellipse(6, 5, 5.5, 2, 0x8a6a44); nest.set(6, 6, 0x5a4430);
  for (let x = 1; x < 11; x += 2) nest.set(x, 4 + (x % 3 ? 0 : 1), 0xb48a5a);
  nest.ellipse(4.5, 3, 1.6, 1.8, 0xe8f0f8); nest.ellipse(7.5, 2.8, 1.6, 1.8, 0xd8e8f8); nest.set(4, 2, 0x8aa0c0); nest.set(8, 3, 0x8aa0c0);
  nest.outline(OUT); d.nest = nest;
  // Obsidian Spires: a crack in the black glass with magma glowing inside.
  const vent = new PixelGrid(11, 8);
  vent.ellipse(5, 6, 5, 2, 0x1e1828); vent.line(2, 6, 8, 6, 0xd16a3c); vent.line(3, 5, 7, 5, 0xff9a3c); vent.set(5, 5, 0xffe08a);
  vent.set(4, 3, 0x5a4a6a); vent.set(6, 2, 0x4a3e5a); vent.set(5, 0, 0x3a3048);
  vent.outline(0x0b0a10); d.vent = vent;
  // Storm Crown: a lightning-blackened iron chain hanging from a bolt.
  const chain = new PixelGrid(7, 16);
  chain.rect(1, 0, 5, 2, 0x5a6278); chain.set(2, 0, 0x9aa4bc);
  for (let k = 0; k < 6; k++) { const y = 2 + k * 2; if (k % 2) { chain.set(2, y, 0x7a84a0); chain.set(4, y, 0x7a84a0); chain.set(3, y + 1, 0x4a5268); } else { chain.rect(3, y, 1, 2, 0x8a94b0); } }
  chain.set(3, 14, 0xffe45a); chain.outline(0x0c0e14); d.chain = chain;
  // Aurora Ridge: frost flowers, feathery ice fronds that catch the green light.
  const fern2 = new PixelGrid(11, 8);
  for (let i = 0; i < 5; i++) { fern2.line(5, 7, 1 + i * 2, 1 + Math.abs(2 - i), i % 2 ? 0xe8fff6 : 0x9ad8c8); fern2.set(1 + i * 2, 1 + Math.abs(2 - i), 0xffffff); }
  fern2.set(5, 3, 0x5af0a0); fern2.set(3, 2, 0x9a70f0);
  d.frostfern = fern2;
  // Dragon's Spine: old bones (a curved rib and a little skull) and spilled gold.
  const bones = new PixelGrid(14, 8);
  for (let a = 0; a < 10; a++) bones.set(1 + a, 6 - Math.round(Math.sin(a / 9 * Math.PI) * 4), 0xf0e0c0);
  bones.ellipse(11, 5, 2.4, 2, 0xe8d8b8); bones.set(10, 5, 0x3a1a18); bones.set(12, 5, 0x3a1a18); bones.rect(10, 7, 3, 1, 0xd8c0a0);
  bones.outline(0x100606); d.bones = bones;
  const coins = new PixelGrid(12, 6);
  coins.ellipse(6, 4.5, 5.5, 1.8, 0xd8a030); coins.ellipse(5, 3, 3, 1.4, 0xf0c050); coins.set(4, 2, 0xffe08a); coins.set(8, 4, 0xffe08a); coins.set(2, 4, 0xff6a4a);
  coins.outline(0x100606); d.coins = coins;
  // Amber Hive: a lump of comb, a few cells still capped, honey oozing out.
  const comb = new PixelGrid(15, 10);
  comb.ellipse(7, 6, 7, 4, 0xb87a2a);
  for (let k = 0; k < 6; k++) {
    const x = 2 + (k % 3) * 4 + (k > 2 ? 2 : 0), y = k > 2 ? 7 : 4;
    comb.rect(x, y, 3, 2, k % 2 ? 0xf0c060 : 0x6a3e10);
    comb.set(x + 1, y, k % 2 ? 0xfff0b0 : 0x8a5418);
  }
  comb.set(10, 9, 0xe88a14); comb.set(10, 8, 0xffb840);
  comb.outline(0x160c04); d.comb = comb;
  // Clockwork Bastion: a steam pipe coming out of the rock, with a valve wheel.
  const pipe = new PixelGrid(14, 14);
  pipe.rect(0, 9, 10, 4, 0x6a5440); pipe.rect(0, 9, 10, 1, 0xb89060); pipe.rect(9, 3, 4, 10, 0x6a5440); pipe.rect(9, 3, 1, 10, 0xb89060);
  pipe.rect(8, 8, 6, 6, 0x58452e); pipe.rect(8, 1, 6, 3, 0x86683e); pipe.rect(8, 1, 6, 1, 0xf0c870);
  pipe.ellipse(4, 6, 2.6, 2.6, 0xb8733a); pipe.set(4, 6, 0x2a2420); pipe.line(4, 3, 4, 9, 0xd8a050); pipe.line(1, 6, 7, 6, 0xd8a050);
  pipe.outline(0x0e0a06); d.pipe = pipe;
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
  // Still beats (the Dragon's Eye): a pause sign, "freeze".
  for (const [key, n, bw] of [['still', 11, 3], ['still_s', 7, 2]]) {
    const g = new PixelGrid(n, n);
    g.rect(1, 1, bw, n - 2, 0xffffff); g.rect(n - 1 - bw, 1, bw, n - 2, 0xffffff);
    g.outline(OUT); addGrid(scene, `icon_${key}`, g);
  }
  // Swarm beats (the Amber Hive): a bee, striped body and two wings.
  for (const [key, n] of [['swarm', 11], ['swarm_s', 7]]) {
    const g = new PixelGrid(n, n);
    const s = n / 11;
    g.ellipse(5.5 * s, 7 * s, 4.2 * s, 2.8 * s, 0xffffff);
    for (let x = 0; x < n; x++) if (Math.round(x / s) % 3 === 1) for (let y = 0; y < n; y++) if (g.get(x, y) !== null) g.set(x, y, 0x6a6a6a);
    g.ellipse(3.5 * s, 3 * s, 2 * s, 1.8 * s, 0xd8d8d8);
    g.ellipse(7 * s, 3 * s, 2 * s, 1.8 * s, 0xd8d8d8);
    g.outline(OUT); addGrid(scene, `icon_${key}`, g);
  }
  // Gear notes (the Clockwork Bastion): a cog behind the arrow, two sizes.
  for (const [key, n] of [['cog', 17], ['cog_s', 11]]) {
    const g = new PixelGrid(n, n);
    const c = (n - 1) / 2, r = n / 2 - 2.2, teeth = 8;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const a = Math.atan2(y - c, x - c), d = Math.hypot(x - c, y - c);
      const tooth = Math.cos(a * teeth) > 0.35;
      if (d <= r + (tooth ? 1.6 : 0) && d >= r * 0.62) g.set(x, y, 0xffffff);
    }
    g.outline(OUT); addGrid(scene, `icon_${key}`, g);
  }
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
  paintWaterfallEnds(scene);
}

// Where the water comes from (a cleft under a rock lip) and where it lands (a
// foaming rock shelf with drips off the edges). Two frames each for the foam.
function paintWaterfallEnds(scene) {
  const rock = BIOMES.green.rock;
  const WATER = 0x8ec5f0, EDGE = 0x5a8fc0, FOAM = [0xffffff, 0xd8eeff];
  const tops = [0, 1].map((f) => {
    const g = new PixelGrid(24, 14);
    const rng = new SeededRandom(40 + f);
    // A jutting rock lip with a dark cleft under it that the water spills from.
    g.ellipse(12, 3, 11, 3, rock[2]);
    g.ellipse(12, 2, 10, 2, rock[3]);
    g.rect(5, 1, 14, 1, rock[4]);
    for (let x = 2; x < 22; x++) if (!g.get(x, 6)) g.set(x, 6, OUT);
    g.ellipse(12, 6, 7, 1.6, OUT);
    // Water sheeting out of the cleft and narrowing into the falling column.
    for (let y = 6; y < 14; y++) {
      const half = y < 8 ? 6 : y < 10 ? 6 - (y - 7) : 5;
      for (let x = 12 - half; x < 12 + half; x++) g.set(x, y, x === 12 - half || x === 11 + half ? EDGE : WATER);
    }
    for (let i = 0; i < 9; i++) g.set(rng.int(7, 16), rng.int(6, 9), FOAM[i % 2]);
    return g;
  });
  addFramesFromGrids(scene, 'waterfall_top', tops);
  const splashes = [0, 1].map((f) => {
    const g = new PixelGrid(34, 20);
    const rng = new SeededRandom(60 + f);
    // The falling column running into the foam.
    for (let y = 0; y < 8; y++) for (let x = 12; x < 22; x++) g.set(x, y, x === 12 || x === 21 ? EDGE : WATER);
    // The rock shelf it lands on.
    for (let x = 1; x < 33; x++) {
      const taper = x < 4 || x > 29 ? 1 : 0;
      g.set(x, 12 + taper, rock[4]);
      for (let y = 13 + taper; y < 16; y++) g.set(x, y, rock[2]);
      g.set(x, 16, OUT);
    }
    // A churning cloud of foam on the shelf: overlapping puffs, light blue
    // underneath and white on top, shifting between the two frames.
    const puffs = [[17, 9, 8, 4], [10 + f, 10, 5, 3], [24 - f, 10, 5, 3], [17 + (f ? 2 : -2), 6, 5, 3]];
    puffs.forEach(([cx, cy, rx, ry]) => g.ellipse(cx, cy + 1, rx, ry, FOAM[1]));
    puffs.forEach(([cx, cy, rx, ry]) => g.ellipse(cx - 0.5, cy, rx - 1, ry - 1, FOAM[0]));
    for (let i = 0; i < 10; i++) g.set(rng.int(4, 29), rng.int(3, 11), FOAM[rng.int(0, 1)]);
    // Drips off both ends of the shelf.
    [[2, 17 + f], [3, 19 - f], [31, 18 - f], [30, 17 + f * 2]].forEach(([x, y]) => g.set(x, y, WATER));
    return g;
  });
  addFramesFromGrids(scene, 'waterfall_splash', splashes);
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

// Animals on the wall (world/Critters.js). A perched bird, side view:
// 0 sitting, 1 head down pecking, 2 wings up as it takes off.
function perchFrames() {
  const body = 0x3a3440, belly = 0xb8a890, beak = 0xe8b040;
  return [0, 1, 2].map((f) => {
    const g = new PixelGrid(9, 8);
    g.ellipse(4, 5, 3, 2, body);
    g.rect(3, 5, 3, 2, belly);
    g.set(0, 4, body); g.set(1, 4, body);
    const hy = f === 1 ? 4 : 2;
    g.rect(6, hy, 2, 2, body);
    g.set(8, hy + 1, beak);
    g.set(7, hy, 0xf4f0e8);
    g.set(4, 7, beak); g.set(5, 7, beak);
    if (f === 2) { g.line(2, 3, 0, 0, body); g.line(5, 3, 4, 0, body); }
    g.outline(OUT);
    return g;
  });
}

// A mountain goat, side view: 0 standing, 1 head turned to look back, 2 jumping.
function goatFrames() {
  const fur = 0xf0ece0, shade = 0xc8c0b0, horn = 0x4a4038, hoof = 0x2a2420;
  return [0, 1, 2].map((f) => {
    const g = new PixelGrid(16, 14);
    const legY = f === 2 ? 8 : 9;
    g.rect(3, 5, 9, 4, fur);
    g.rect(3, 8, 9, 1, shade);
    g.set(2, 5, fur); g.set(2, 6, shade);
    if (f === 2) { g.line(4, 9, 2, 12, fur); g.line(10, 9, 13, 11, fur); g.set(2, 12, hoof); g.set(13, 11, hoof); }
    else {
      [4, 6, 9, 11].forEach((x) => { g.rect(x, legY, 1, 13 - legY, fur); g.set(x, 13, hoof); });
    }
    const hx = f === 1 ? 1 : 11;
    g.rect(hx, 2, 3, 3, fur);
    g.set(f === 1 ? hx : hx + 2, 5, fur);
    g.set(f === 1 ? hx + 1 : hx + 1, 3, OUT);
    g.line(hx + 1, 2, f === 1 ? hx + 3 : hx - 1, 0, horn);
    g.set(f === 1 ? hx + 1 : hx + 1, 6, shade);
    g.outline(OUT);
    return g;
  });
}

// A carved pumpkin for Halloween at base camp: 0 and 1 flicker the candle.
function pumpkinFrames() {
  return [0, 1].map((f) => {
    const g = new PixelGrid(11, 10);
    g.ellipse(5.5, 6, 5, 3.6, 0xe8761c);
    g.rect(4, 3, 3, 7, 0xf08a2a);
    g.set(2, 6, 0xb85a14); g.set(8, 6, 0xb85a14);
    g.rect(5, 0, 1, 3, 0x4a6a2a); g.set(6, 1, 0x6a9a3a);
    const lit = f ? 0xffe070 : 0xffc040;
    g.set(3, 5, lit); g.set(7, 5, lit);
    g.rect(3, 7, 5, 1, lit); g.set(4, 8, lit); g.set(6, 8, lit);
    g.outline(OUT);
    return g;
  });
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
  buildCampTextures(scene);
  addFramesFromGrids(scene, 'bird', birdFrames(false));
  addFramesFromGrids(scene, 'eagle', birdFrames(true));
  addFramesFromGrids(scene, 'critter_bird', perchFrames());
  addFramesFromGrids(scene, 'critter_goat', goatFrames());
  addFramesFromGrids(scene, 'season_pumpkin', pumpkinFrames());

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
  paintFxBits(scene);
}

// Small white particle shapes for trails and hit effects (tinted in use).
function paintFxBits(scene) {
  const W = 0xffffff;
  const heart = new PixelGrid(7, 6);
  [[1, 0], [2, 0], [4, 0], [5, 0]].forEach(([x, y]) => heart.set(x, y, W));
  heart.rect(0, 1, 7, 2, W); heart.rect(1, 3, 5, 1, W); heart.rect(2, 4, 3, 1, W); heart.set(3, 5, W);
  addGrid(scene, 'fx_heart', heart);
  const note = new PixelGrid(6, 8);
  note.rect(3, 0, 1, 6, W); note.rect(4, 0, 2, 1, W); note.set(5, 1, W); note.rect(0, 5, 3, 3, W); note.set(0, 5, null); note.set(2, 7, null);
  addGrid(scene, 'fx_note', note);
  const star = new PixelGrid(5, 5);
  star.rect(2, 0, 1, 5, W); star.rect(0, 2, 5, 1, W); star.rect(1, 1, 3, 3, W);
  addGrid(scene, 'fx_star', star);
  const shard = new PixelGrid(3, 5);
  shard.rect(1, 0, 1, 5, W); shard.rect(0, 1, 3, 2, W);
  addGrid(scene, 'fx_shard', shard);
  const leaf = new PixelGrid(4, 3);
  leaf.rect(1, 0, 2, 1, W); leaf.rect(0, 1, 4, 1, W); leaf.rect(1, 2, 2, 1, W);
  addGrid(scene, 'fx_leaf', leaf);
}
