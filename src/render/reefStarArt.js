// Props and effects for the Far Range's two highest biomes:
//   The Fossil Reef       shells on the ledges, stone sea fans, the ghost
//                         tide's caustic light, ghost fish
//   The Starfall Crater   lumps of star-metal, splash glass (tektites), the
//                         glowing crater a fallen star leaves on the wall
import { PixelGrid, makeCanvas } from '../utils/pixelGrid.js';
import { lerpColor, rgb } from '../utils/color.js';
import { SeededRandom } from '../utils/seededRandom.js';

function add(scene, key, grid) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const c = makeCanvas(grid.w, grid.h);
  grid.drawTo(c.getContext('2d'));
  scene.textures.addCanvas(key, c);
}

function addCanvas(scene, key, c) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, c);
}

// A spiral shell (ammonite) of radius R into grid g at (cx, cy).
function ammonite(g, cx, cy, R, base, light, dark) {
  for (let y = -R - 1; y <= R + 1; y++) for (let x = -R - 1; x <= R + 1; x++) {
    const r = Math.hypot(x, y);
    if (r > R + 0.4) continue;
    const a = Math.atan2(y, x);
    const u = (Math.log(Math.max(0.6, r) / 0.5) / 0.38 - a) / (Math.PI * 2), f = u - Math.floor(u);
    let c = f < 0.2 ? dark : Math.sin(a * 8) > 0.4 ? light : base;
    if (y < -R * 0.4) c = lerpColor(c, 0xffffff, 0.3);
    if (y > R * 0.4) c = lerpColor(c, dark, 0.4);
    g.set(cx + x, cy + y, c);
  }
}

// ---------------------------------------------------------------- the reef
// Shells washed up on the ledge long ago: a scallop fan, a cone, a small
// ammonite, a broken piece of coral.
function shellsGrid() {
  const g = new PixelGrid(22, 9);
  // Scallop: a fan of ribs, coral pink with cream ribs.
  for (let y = 0; y < 6; y++) for (let x = -5; x <= 5; x++) {
    if (Math.hypot(x, (5 - y) * 1.1) > 5.5) continue;
    g.set(5 + x, 2 + y, Math.abs(x) % 2 ? 0xe8806a : 0xfff0dc);
  }
  g.rect(3, 8, 5, 1, 0xb85a4a);
  // Cone shell lying on its side.
  for (let x = 0; x < 6; x++) for (let y = 0; y <= Math.floor(x / 2); y++) {
    g.set(10 + x, 7 - y, (x + y) % 2 ? 0xd8b088 : 0xf8e8c8);
    g.set(10 + x, 7 + Math.min(1, y), 0xa8784a);
  }
  // A little ammonite.
  ammonite(g, 18, 6, 2.6, 0xf0dcc0, 0xfff8ec, 0x8a6a5a);
  // Coral rubble.
  g.set(8, 8, 0xf09078); g.set(9, 8, 0xd06a58); g.set(16, 8, 0xf09078);
  g.outline(0x2a1418);
  return g;
}

// A stone sea fan standing on the ledge: a stalk and a lattice spread wide,
// lit pink on the left, a few cream polyps on the edge.
function seafanGrid() {
  // Branches fork up from a short trunk; a fine net is strung between
  // them. Lit on the left, darker toward the back.
  const g = new PixelGrid(20, 24);
  const rng = new SeededRandom(433);
  const tips = [];
  const grow = (x, y, ang, len, depth) => {
    for (let k = 0; k < len; k++) {
      g.set(x, y, depth < 2 ? 0xa84e48 : 0xd86a5a);
      x += Math.sin(ang) * 0.9; y -= Math.cos(ang) * 0.9;
      ang += rng.range(-0.08, 0.08);
    }
    if (depth < 3) { grow(x, y, ang - rng.range(0.3, 0.55), len * 0.75, depth + 1); grow(x, y, ang + rng.range(0.3, 0.55), len * 0.75, depth + 1); }
    else tips.push([Math.round(x), Math.round(y)]);
  };
  grow(10, 23, rng.range(-0.1, 0.1), 6, 0);
  // The net between the branches: a sparse mesh, see-through.
  for (let y = 2; y < 18; y++) for (let x = 1; x < 19; x++) {
    if (g.get(x, y) != null) continue;
    const l = [...Array(4)].some((_, i) => g.get(x - 1 - i, y) != null), r = [...Array(4)].some((_, i) => g.get(x + 1 + i, y) != null);
    if (l && r && (x + y) % 3 === 0) g.set(x, y, 0xe8907a);
  }
  for (const [x, y] of tips) g.set(x, y, 0xffd0b8);
  for (let x = 0; x < 20; x++) for (let y = 0; y < 24; y++) if (g.get(x, y) != null && x < 9 && g.get(x - 1, y) == null) g.set(x, y, 0xf4a890);
  return g;
}

// The ghost tide's light: a seamless web of bright lines like sunlight
// through waves on a seabed (white on clear, for an ADD tile).
function caustics(size = 64, seed = 9) {
  const rng = new SeededRandom(seed);
  const pts = Array.from({ length: 11 }, () => [rng.range(0, size), rng.range(0, size)]);
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let f1 = 1e9, f2 = 1e9;
    for (const [px, py] of pts) {
      let dx = Math.abs(x - px), dy = Math.abs(y - py);
      dx = Math.min(dx, size - dx); dy = Math.min(dy, size - dy);
      const d = Math.hypot(dx, dy);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    const e = f2 - f1;
    const a = e < 1 ? 0.85 : e < 2.2 ? 0.4 : e < 4 ? 0.12 : 0;
    const i = (y * size + x) * 4;
    img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255; img.data[i + 3] = Math.round(a * 255);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// A ghost fish: a pale shape of the old sea, two frames of a tail flick.
function fishFrame(f) {
  const g = new PixelGrid(12, 6);
  g.ellipse(5, 3, 4.4, 2.2, 0xd8fff4);
  g.ellipse(5, 2, 3, 1, 0xffffff);
  const t = f ? 1 : 0;
  g.set(10, 1 + t, 0xb8f0e8); g.set(10, 4 - (1 - t), 0xb8f0e8); g.set(9, 2, 0xb8f0e8); g.set(9, 3, 0xb8f0e8); g.set(11, t ? 2 : 1, 0x9ae0d8); g.set(11, t ? 4 : 5, 0x9ae0d8);
  g.set(2, 2, 0x2a6a6a);
  return g;
}

// ---------------------------------------------------------------- the crater
// A lump of star-metal on the ledge: rounded, pitted, the crossed lattice
// on its face, gold-lit on top.
function starmetalGrid() {
  const g = new PixelGrid(16, 11);
  g.ellipse(8, 6, 7, 4.6, 0xb8863a);
  for (let y = 0; y < 11; y++) for (let x = 0; x < 16; x++) {
    if (g.get(x, y) == null) continue;
    const dx = x - 8, dy = y - 6;
    const lat = (dx + 50) % 3 === 0 || (Math.round(dx * 0.5 + dy * 0.87) + 50) % 3 === 0 || (Math.round(dx * 0.5 - dy * 0.87) + 50) % 3 === 0;
    let c = lat ? 0xe8b850 : 0xb8863a;
    if (dy < -2) c = lerpColor(c, 0xfff6d8, 0.6);
    if (dy > 2) c = lerpColor(c, 0x5a3a1a, 0.5);
    g.set(x, y, c);
  }
  g.set(5, 3, 0xffffff); g.set(6, 3, 0xfff6d8);
  g.set(11, 6, 0x3a2414); g.set(4, 7, 0x3a2414);
  g.outline(0x140a04);
  return g;
}

// Splash glass: green tektite drops and a dark buttoned one, glossy.
function tektiteGrid() {
  const g = new PixelGrid(14, 8);
  const drop = (cx, cy, r, c, hi) => {
    g.ellipse(cx, cy, r, r * 0.8, c);
    g.set(Math.round(cx), Math.round(cy - r * 1.4), c);
    g.set(Math.round(cx - r * 0.4), Math.round(cy - r * 0.3), hi);
  };
  drop(3, 5, 2.2, 0x2a9a6a, 0xd8ffe8);
  drop(8, 5.5, 1.6, 0x3ac88a, 0xffffff);
  drop(11.5, 5, 2, 0x14141f, 0x8a7ad8);
  g.rect(0, 7, 14, 1, 0x0a2014);
  g.outline(0x020806);
  return g;
}

// The crater a fallen star leaves on the wall: a ring of thrown rock round
// a white-hot heart. Drawn white (tinted and ADDed by the scene).
function craterGlow() {
  const S = 40;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const r = Math.hypot(x - S / 2 + 0.5, (y - S / 2 + 0.5) * 1.5);
    const core = Math.max(0, 1 - r / 6);
    const ring = Math.max(0, 1 - Math.abs(r - 11) / 2.2) * 0.55;
    const halo = Math.max(0, 1 - r / 19) * 0.25;
    const a = Math.min(1, core * core * 1.6 + ring + halo);
    const i = (y * S + x) * 4;
    const [cr, cg, cb] = rgb(lerpColor(0xffd890, 0xffffff, core));
    img.data[i] = cr; img.data[i + 1] = cg; img.data[i + 2] = cb; img.data[i + 3] = Math.round(a * 255);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function buildReefStarTextures(scene) {
  add(scene, 'decor_shells', shellsGrid());
  add(scene, 'decor_seafan', seafanGrid());
  add(scene, 'decor_starmetal', starmetalGrid());
  add(scene, 'decor_tektite', tektiteGrid());
  addCanvas(scene, 'reef_caustic', caustics());
  const frames = [0, 1].map(fishFrame);
  if (scene.textures.exists('reef_fish')) scene.textures.remove('reef_fish');
  const c = makeCanvas(24, 6);
  frames.forEach((g, i) => g.drawTo(c.getContext('2d'), i * 12, 0));
  const tex = scene.textures.addCanvas('reef_fish', c);
  frames.forEach((_, i) => tex.add(i, 0, i * 12, 0, 12, 6));
  addCanvas(scene, 'star_crater', craterGlow());
}
