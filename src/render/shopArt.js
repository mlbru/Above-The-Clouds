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

// The base camp trader: an old mountaineer with an overloaded pack and a lantern staff.
function traderGrid(blink) {
  const g = new PixelGrid(22, 33);
  const skin = 0xe2a87e, skinDark = 0xb8805e, coat = 0x8a5a32, coatDark = 0x5e3c20, beard = 0xd8d0c0;
  // Overloaded pack behind the body: rounded, with side pockets, a bedroll and a pot.
  const pk = 0x8a7448, pkL = 0xa88e5a, pkD = 0x5e4e30;
  g.rect(4, 9, 13, 14, pk); g.rect(5, 8, 11, 1, pk);
  g.rect(4, 9, 1, 14, pkL); g.rect(16, 9, 1, 14, pkD); g.rect(4, 22, 13, 1, pkD);
  g.rect(3, 14, 2, 6, pkD); g.rect(16, 14, 2, 6, pkD);
  g.rect(4, 5, 13, 3, 0xc8463b); g.rect(4, 7, 13, 1, 0x8a2a24); g.set(4, 5, null); g.set(16, 5, null);
  g.line(7, 5, 7, 7, 0x3a2414); g.line(13, 5, 13, 7, 0x3a2414);
  g.rect(1, 16, 3, 3, 0x9aa4b0); g.set(1, 16, 0xd0d8e2); g.set(2, 15, 0x6a7280);
  // Legs and boots.
  g.rect(7, 27, 2, 4, 0x343c52); g.rect(11, 27, 2, 4, 0x343c52);
  g.rect(6, 30, 3, 2, 0x6a4428); g.rect(11, 30, 3, 2, 0x6a4428);
  // Coat.
  g.rect(6, 16, 8, 12, coat); g.rect(6, 27, 8, 1, coatDark); g.rect(10, 16, 1, 11, coatDark); g.rect(6, 22, 8, 1, 0x3a2414);
  g.set(8, 22, 0xf2c14e);
  // Arms.
  g.rect(4, 17, 2, 8, coat); g.rect(4, 25, 2, 2, skin);
  g.rect(14, 17, 2, 5, coat); g.rect(14, 22, 2, 2, skin);
  // Staff with a lantern.
  g.line(17, 5, 17, 31, 0x8a6a4a);
  g.rect(18, 8, 3, 4, 0xf2c14e); g.set(19, 9, 0xffffff); g.rect(18, 7, 3, 1, 0x3a2a1a); g.rect(18, 12, 3, 1, 0x3a2a1a);
  // Head, beard and hat.
  g.ellipse(10, 12, 3.2, 3.6, skin);
  g.rect(7, 13, 7, 4, beard); g.ellipse(10.5, 16.5, 3, 2, beard); g.set(10, 18, beard);
  g.set(10, 12, skinDark);
  if (blink) { g.set(8, 11, 0x2a2030); g.set(9, 11, 0x2a2030); g.set(11, 11, 0x2a2030); g.set(12, 11, 0x2a2030); } else { g.set(9, 11, 0x2a2030); g.set(11, 11, 0x2a2030); }
  g.rect(5, 8, 11, 1, 0x4a3a2a); g.rect(7, 5, 7, 3, 0x5a4632); g.rect(7, 7, 7, 1, 0xc8463b);
  g.set(8, 5, 0x6e5840);
  g.outline(OUT);
  return g;
}

// Bram's head and shoulders for the tutorial speech bubble (cut from the trader sprite).
function portraitGrid(blink) {
  const src = traderGrid(blink);
  const g = new PixelGrid(18, 20);
  for (let y = 0; y < 20; y++) for (let x = 0; x < 18; x++) g.set(x, y, src.get(x + 2, y + 3));
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
  addFrames(scene, 'npc_trader', [traderGrid(false), traderGrid(true)]);
  addFrames(scene, 'bram_face', [portraitGrid(false), portraitGrid(true)]);
  add(scene, 'decor_stall', stallGrid());
}
