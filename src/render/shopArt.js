// Procedural art for gems, trader goods and the base camp trader.
import { PixelGrid, makeCanvas } from '../utils/pixelGrid.js';
import { darken, lighten } from '../utils/color.js';
import { GEMS } from '../data/gems.js';

const OUT = 0x16141f;

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

// A small cut stone: flat table on top, pointed below.
function gemGrid(color) {
  const g = new PixelGrid(9, 7);
  const light = lighten(color, 0.45), dark = darken(color, 0.62);
  const rows = [[1, 5], [0, 6], [1, 5], [2, 4], [3, 3]];
  rows.forEach(([a, b], y) => { for (let x = a; x <= b; x++) g.set(x + 1, y + 1, color); });
  for (let x = 1; x <= 3; x++) g.set(x + 1, 1, light);
  for (let x = 0; x <= 2; x++) g.set(x + 1, 2, light);
  for (let y = 3; y <= 5; y++) for (let x = 4; x <= 6; x++) if (g.get(x + 1, y + 1) !== null) g.set(x + 1, y + 1, dark);
  g.set(5, 3, dark); g.set(6, 3, dark);
  g.set(3, 1, 0xffffff); g.set(2, 2, 0xffffff);
  g.outline(OUT);
  return g;
}

function icon(draw) {
  const g = new PixelGrid(11, 11);
  draw(g);
  g.outline(OUT);
  return g;
}

// A lift ticket: a paper stub with a coloured band and a tiny mountain.
function ticket(g, band, peak) {
  g.rect(0, 2, 11, 7, 0xf4efe4);
  g.rect(0, 2, 11, 2, band);
  g.set(0, 6, null); g.set(10, 6, null);
  g.set(5, 5, peak); g.rect(4, 6, 3, 1, peak); g.rect(3, 7, 5, 1, peak);
  for (let x = 1; x <= 9; x += 2) g.set(x, 8, 0xbdb6a6);
}

const ITEM_ICONS = {
  item_crampons: (g) => {
    g.rect(2, 1, 7, 1, 0xc8463b); g.rect(2, 1, 1, 3, 0xc8463b); g.rect(8, 1, 1, 3, 0xc8463b);
    g.rect(1, 4, 9, 2, 0xb8c0cc); g.rect(1, 4, 9, 1, 0xe2e8f0);
    for (let x = 1; x <= 9; x += 2) { g.set(x, 6, 0x8a94a4); g.set(x, 7, 0x8a94a4); }
    g.set(0, 4, 0x8a94a4);
  },
  item_chalk: (g) => {
    g.ellipse(5.5, 6.5, 3.6, 3.4, 0xe8e4da);
    g.rect(2, 3, 7, 2, 0xc8463b);
    g.set(4, 1, 0xffffff); g.set(6, 1, 0xffffff); g.set(5, 2, 0xffffff);
    g.set(7, 7, 0xbdb6a6); g.set(6, 8, 0xbdb6a6);
  },
  item_energy: (g) => {
    g.rect(1, 3, 9, 5, 0xe0802a); g.rect(1, 5, 9, 1, 0xf2c14e); g.rect(1, 3, 9, 1, 0xf0a050);
    g.rect(8, 3, 2, 5, 0x6a4428); g.set(9, 3, null); g.set(9, 4, null);
  },
  item_rope: (g) => {
    g.ellipse(5.5, 5.5, 4.6, 4.6, 0xc8463b);
    g.ellipse(5.5, 5.5, 2.4, 2.4, null);
    for (let a = 0; a < 6; a++) g.set(5.5 + Math.cos(a) * 3.6, 5.5 + Math.sin(a) * 3.6, 0x3b6fb6);
    g.line(8, 8, 10, 10, 0xc8463b);
  },
  item_quickdraws: (g) => {
    const biner = (x, y) => { g.rect(x, y, 3, 1, 0xc0c8d4); g.rect(x, y + 4, 3, 1, 0xc0c8d4); g.rect(x, y, 1, 5, 0xc0c8d4); g.rect(x + 2, y + 1, 1, 3, 0xe2e8f0); };
    biner(1, 0); biner(6, 5);
    g.line(3, 4, 7, 6, 0x4fb0e0);
  },
  item_charm: (g) => {
    const leaf = 0x4fb35a, lite = 0x7fd98a;
    g.ellipse(3.5, 3.5, 2.2, 2.2, leaf); g.ellipse(7.5, 3.5, 2.2, 2.2, leaf);
    g.ellipse(3.5, 7, 2.2, 2.2, leaf); g.ellipse(7.5, 7, 2.2, 2.2, leaf);
    g.set(3, 3, lite); g.set(7, 3, lite); g.set(5, 5, 0x2f7a3a);
    g.line(6, 8, 8, 10, 0x2f7a3a);
  },
  item_ticket_stone: (g) => ticket(g, 0x8a8478, 0xf2a03c),
  item_ticket_frozen: (g) => ticket(g, 0x9fd8ff, 0x4f86f0),
  perk_rubyheart: (g) => {
    const r = 0xe0344f;
    g.ellipse(3.5, 4, 2.4, 2.4, r); g.ellipse(7.5, 4, 2.4, 2.4, r);
    g.rect(2, 4, 7, 2, r); g.rect(3, 6, 5, 1, r); g.rect(4, 7, 3, 1, r); g.set(5, 8, r);
    g.set(3, 3, 0xff9aa8); g.set(4, 3, 0xff9aa8);
  },
  perk_diamondeye: (g) => {
    g.ellipse(5.5, 5.5, 4.8, 2.8, 0xffffff);
    g.rect(4, 3, 3, 1, 0xd8fbff); g.rect(3, 4, 5, 1, 0x9fe8ff); g.rect(4, 5, 3, 1, 0x6fc8e8); g.set(5, 6, 0x4fa8d0);
  },
  perk_gemsense: (g) => {
    g.ellipse(5.5, 5.5, 4.8, 2.8, 0xffffff);
    g.rect(4, 4, 3, 3, 0x4f86f0); g.set(5, 3, 0x4f86f0); g.set(5, 7, 0x4f86f0); g.set(4, 4, 0xbfe0ff);
  },
  perk_irongrip: (g) => {
    g.rect(2, 3, 7, 6, 0x9aa4b0); g.rect(2, 3, 7, 1, 0xd0d8e2);
    for (let x = 4; x <= 8; x += 2) g.set(x, 4, 0x6a7280);
    g.rect(1, 5, 2, 3, 0x9aa4b0); g.rect(3, 9, 5, 1, 0x6a7280);
  },
  perk_steady: (g) => {
    const s = 0xe8b48a;
    g.rect(2, 4, 7, 5, s); g.rect(2, 1, 1, 4, s); g.rect(4, 0, 1, 4, s); g.rect(6, 0, 1, 4, s); g.rect(8, 1, 1, 4, s); g.rect(0, 5, 2, 2, s);
    g.rect(2, 8, 7, 1, 0xc98e68);
  },
  perk_streaksaver: (g) => {
    g.ellipse(5.5, 6.5, 3.6, 3.8, 0xf0644b);
    g.ellipse(5.5, 7.5, 2, 2.2, 0xf2c14e);
    g.set(5, 1, 0xf0644b); g.set(5, 2, 0xf0644b); g.set(4, 3, 0xf0644b); g.set(7, 2, 0xff9a3c);
    g.set(5, 8, 0xffffff);
  },
};

// Bram, the base camp trader: an old mountaineer in a felt hat with a feather,
// bushy brows and a big white beard, a fur-collared coat, an overloaded pack
// and a lantern on his staff. Frames: 0 idle, 1 blink, 2 breathing in.
function traderGrid(blink, breath = false) {
  const g = new PixelGrid(24, 34);
  const dy = breath ? -1 : 0;
  const skin = 0xe8ae84, skinD = 0xc08060, cheek = 0xe07a7a;
  const coat = 0x7a5a3a, coatD = 0x553c26, coatL = 0x9a7650;
  const beard = 0xeae4d8, beardD = 0xbab2a2, fur = 0xd8c8a8, furD = 0xb0a080;
  // The pack behind him (below his head, so it never frames the face): a
  // bedroll sticking out on both sides, a pot and a coil of rope.
  const pk = 0x6a6448, pkL = 0x847c58, pkD = 0x4a4632;
  g.rect(3, 16, 16, 9, pk); g.rect(3, 16, 1, 9, pkL); g.rect(18, 16, 1, 9, pkD); g.rect(3, 24, 16, 1, pkD);
  g.rect(1, 14, 21, 3, 0xc8463b); g.rect(1, 16, 21, 1, 0x8a2a24); g.rect(1, 14, 21, 1, 0xe06a5a);
  g.set(1, 15, 0x8a2a24); g.set(21, 15, 0x8a2a24);
  g.rect(0, 19, 3, 3, 0x9aa4b0); g.set(0, 19, 0xd0d8e2); g.set(1, 18, 0x6a7280);
  g.ellipse(18, 21.5, 1.6, 2, 0xc8a050); g.set(18, 21, 0x8a6a30);
  // Staff with a hanging lantern.
  g.line(20, 4, 20, 33, 0x8a6a4a); g.set(20, 4, 0xa88a68);
  g.rect(21, 6, 1, 2, 0x3a2a1a); g.rect(21, 8, 3, 5, 0x3a2a1a); g.rect(21, 9, 3, 3, 0xffd25a); g.set(22, 10, 0xffffff);
  // Legs and boots.
  g.rect(8, 27, 3, 4, 0x3a4258); g.rect(12, 27, 3, 4, 0x3a4258); g.set(10, 27, 0x2a3044);
  g.rect(7, 31, 4, 2, 0x5a3a22); g.rect(12, 31, 4, 2, 0x5a3a22); g.rect(7, 31, 4, 1, 0x7a5232); g.rect(12, 31, 4, 1, 0x7a5232);
  // Coat with a belt and patches.
  g.rect(6, 18, 11, 10, coat); g.rect(6, 18, 1, 10, coatL); g.rect(16, 18, 1, 10, coatD); g.rect(11, 19, 1, 9, coatD);
  g.rect(6, 23, 11, 1, 0x3a2414); g.set(11, 23, 0xf2c14e); g.rect(13, 25, 2, 2, coatL);
  g.set(10, 20, 0xd8b060); g.set(10, 25, 0xd8b060);
  // Arms: one at his side, one on the staff.
  g.rect(4, 18, 2, 8, coat); g.rect(4, 18, 1, 8, coatL); g.rect(4, 26, 2, 2, skin);
  g.rect(17, 18, 2, 4, coat); g.rect(18, 21, 2, 2, skin); g.set(19, 22, skinD);
  // Fur collar (moves with the breath).
  for (let x = 6; x <= 16; x++) { g.set(x, 17 + dy, fur); g.set(x, 18 + dy, x % 2 ? fur : furD); }
  // Head.
  g.ellipse(11.5, 12.5 + dy, 3.6, 3.6, skin);
  g.set(8, 12 + dy, skinD); g.set(15, 12 + dy, skinD);
  // Beard and moustache: full and white, shaded underneath.
  g.ellipse(11.5, 17 + dy, 4.4, 3.4, beard);
  g.rect(8, 14 + dy, 8, 1, beard);
  for (let x = 9; x <= 14; x++) g.set(x, 20 + dy, beardD);
  g.set(8, 18 + dy, beardD); g.set(15, 18 + dy, beardD); g.set(11, 21 + dy, beardD); g.set(12, 21 + dy, beard);
  g.set(10, 16 + dy, beardD); g.set(13, 17 + dy, beardD);
  g.rect(9, 14 + dy, 6, 1, 0xf6f2ea);
  // Face: brows, eyes, nose and rosy cheeks.
  g.rect(8, 10 + dy, 3, 1, beard); g.rect(13, 10 + dy, 3, 1, beard);
  if (blink) { g.rect(9, 11 + dy, 2, 1, 0x2a2030); g.rect(13, 11 + dy, 2, 1, 0x2a2030); }
  else { g.set(10, 11 + dy, 0x2a2030); g.set(13, 11 + dy, 0x2a2030); }
  g.rect(11, 12 + dy, 2, 2, skinD); g.set(11, 12 + dy, skin);
  g.set(9, 13 + dy, cheek); g.set(14, 13 + dy, cheek);
  // Felt hat with a red band and a feather.
  const hat = 0x5a4632, hatL = 0x7a6248, hatD = 0x3e3022;
  g.rect(5, 8 + dy, 14, 2, hat); g.rect(5, 9 + dy, 14, 1, hatD);
  g.rect(8, 4 + dy, 8, 4, hat); g.rect(8, 4 + dy, 8, 1, hatL); g.set(12, 4 + dy, hatD);
  g.rect(8, 7 + dy, 8, 1, 0xc8463b);
  g.line(16, 7 + dy, 18, 2 + dy, 0xf4efe4); g.set(17, 3 + dy, 0x6fae4a); g.set(18, 2 + dy, 0x6fae4a);
  g.outline(OUT);
  return g;
}

// Bram's head and shoulders for his speech bubbles (cut from the trader sprite).
function portraitGrid(blink) {
  const src = traderGrid(blink);
  const g = new PixelGrid(18, 20);
  for (let y = 0; y < 20; y++) for (let x = 0; x < 18; x++) g.set(x, y, src.get(x + 3, y + 1));
  return g;
}

// A rug with goods spread out in front of the trader.
function stallGrid() {
  const g = new PixelGrid(30, 8);
  g.rect(1, 4, 28, 3, 0xa8243a); g.rect(1, 4, 28, 1, 0xc8463b);
  for (let x = 2; x < 28; x += 3) g.set(x, 5, 0xf2c14e);
  const dots = [[4, GEMS.emerald.color], [9, GEMS.amber.color], [14, GEMS.sapphire.color], [20, GEMS.ruby.color]];
  dots.forEach(([x, c]) => { g.rect(x, 2, 2, 2, c); g.set(x, 2, 0xffffff); });
  g.rect(23, 0, 5, 4, 0x8a6a4a); g.rect(23, 0, 5, 1, 0xa8845e); g.set(25, 2, 0x5e4630);
  g.outline(OUT);
  return g;
}

export function buildShopTextures(scene) {
  for (const gem of Object.values(GEMS)) add(scene, `gem_${gem.id}`, gemGrid(gem.color));
  add(scene, 'icon_gem', gemGrid(0x6fd6ff));
  for (const [key, draw] of Object.entries(ITEM_ICONS)) add(scene, key, icon(draw));
  addFrames(scene, 'npc_trader', [traderGrid(false), traderGrid(true), traderGrid(false, true)]);
  addFrames(scene, 'bram_face', [portraitGrid(false), portraitGrid(true)]);
  add(scene, 'decor_stall', stallGrid());
}
