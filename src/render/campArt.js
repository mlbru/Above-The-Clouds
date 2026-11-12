// Procedural art for base camp (campfire, bench, firewood, grass, butterflies)
// and the mountain huts, which take the colours of the biome they stand in.
import { PixelGrid, makeCanvas } from '../utils/pixelGrid.js';
import { darken, lighten } from '../utils/color.js';
import { SeededRandom } from '../utils/seededRandom.js';
import { BIOMES } from '../data/biomes.js';
import { shade, makeRamp } from './pixelKit.js';

const OUT = 0x16141f;
const WOOD = 0x8a5a32, WOOD_D = 0x5e3c20, WOOD_L = 0xa8744a, END = 0xd8b07a, RING = 0x9a6a3a;

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

// ---------------------------------------------------------------- base camp
function fireFrame(f) {
  const g = new PixelGrid(18, 16);
  const rng = new SeededRandom(70 + f);
  // Flames: three tongues that change height and lean per frame.
  const tongues = [[6, 6 + f, -1], [9, 2 + ((f + 1) % 3), f === 1 ? 1 : 0], [12, 6 + ((f + 2) % 3), 1]];
  for (const [cx, top, lean] of tongues) {
    for (let y = top; y < 13; y++) {
      const t = (y - top) / (13 - top);
      const half = 1 + t * 2.4;
      const x0 = cx + lean * (1 - t) * 2;
      for (let x = Math.round(x0 - half); x <= Math.round(x0 + half); x++) {
        const edge = Math.abs(x - x0) > half - 1;
        g.set(x, y, t < 0.3 || edge ? 0xf0644b : t < 0.65 ? 0xff9a3c : 0xffd25a);
      }
    }
  }
  g.rect(8, 10, 3, 3, 0xfff1a0);
  for (let i = 0; i < 2; i++) g.set(rng.int(5, 13), rng.int(0, 3), 0xffd25a);
  // Crossed logs and a ring of stones.
  g.line(3, 14, 14, 11, WOOD_D, 2); g.line(4, 11, 15, 14, WOOD, 2);
  g.set(3, 14, END); g.set(15, 14, END);
  [[1, 14], [5, 15], [9, 15], [13, 15], [16, 14]].forEach(([x, y]) => { g.rect(x, y, 2, 1, 0x8a8f99); g.set(x, y - 1, 0xb8bcc4); });
  g.outline(OUT);
  return g;
}

function benchGrid() {
  const g = new PixelGrid(24, 8);
  g.rect(1, 1, 22, 4, WOOD); g.rect(1, 1, 22, 1, WOOD_L); g.rect(1, 4, 22, 1, WOOD_D);
  g.line(5, 2, 9, 2, WOOD_D); g.line(14, 3, 18, 3, WOOD_D);
  g.rect(0, 1, 2, 4, END); g.set(0, 2, RING); g.set(1, 3, RING);
  g.rect(4, 5, 2, 3, WOOD_D); g.rect(18, 5, 2, 3, WOOD_D);
  g.outline(OUT);
  return g;
}

function woodGrid() {
  const g = new PixelGrid(16, 11);
  const logs = [[3, 8], [8, 8], [13, 8], [5.5, 4], [10.5, 4], [8, 0.5]];
  for (const [x, y] of logs) {
    g.ellipse(x, y + 2, 2.6, 2.4, END);
    g.set(Math.round(x - 0.5), Math.round(y + 1.5), RING);
    g.set(Math.round(x + 1), Math.round(y + 3), WOOD);
  }
  g.outline(OUT);
  return g;
}

function crateGrid() {
  const g = new PixelGrid(12, 11);
  g.rect(1, 1, 10, 9, 0xb08a58); g.rect(1, 1, 10, 1, 0xc8a46e); g.rect(1, 9, 10, 1, 0x7a5a38);
  g.line(1, 1, 10, 9, 0x8a6a44); g.rect(1, 5, 10, 1, 0x8a6a44);
  g.rect(1, 1, 1, 9, 0x7a5a38); g.rect(10, 1, 1, 9, 0x7a5a38);
  g.outline(OUT);
  return g;
}

function tuftGrid(v) {
  const g = new PixelGrid(9, 6);
  const rng = new SeededRandom(90 + v);
  for (let i = 0; i < 5; i++) {
    const x = 1 + i * 1.6 + rng.range(-0.4, 0.4), h = rng.int(2, 5);
    g.line(Math.round(x), 5, Math.round(x + rng.range(-1, 1)), 5 - h, i % 2 ? 0x8fc85a : 0x6fae4a);
  }
  if (v === 1) { g.set(2, 1, 0xf4efe4); g.set(6, 2, 0xf2c14e); }
  if (v === 2) { g.set(4, 0, 0xf07ab8); g.set(4, 1, 0xf07ab8); }
  return g;
}

function butterflyFrame(open) {
  const g = new PixelGrid(5, 4);
  const W = 0xffffff;
  if (open) { g.rect(0, 0, 2, 2, W); g.rect(3, 0, 2, 2, W); g.set(1, 2, W); g.set(3, 2, W); }
  else { g.rect(1, 0, 1, 2, W); g.rect(3, 0, 1, 2, W); }
  g.rect(2, 0, 1, 4, 0x2a2030);
  return g;
}

// ---------------------------------------------------------------- huts
// A stone mountain hut with a timber gable, shuttered windows, a lantern by
// the door, a chimney and a woodpile; snow on the roof in the cold biomes.
function hutGrid(biome) {
  const g = new PixelGrid(54, 40);
  const rock = biome.rock;
  const snowy = biome.weather && biome.weather.snow > 0.3;
  const roof = snowy ? 0x5a4a5e : 0x8a3a2e, roofL = lighten(roof, 0.25), roofD = darken(roof, 0.7);
  const ox = 4; // the woodpile sits to the left of the walls
  // Chimney (behind the roof).
  g.rect(ox + 33, 2, 6, 12, rock[2]); g.rect(ox + 33, 2, 6, 1, rock[4]); g.rect(ox + 32, 1, 8, 2, rock[1]);
  for (let y = 4; y < 14; y += 3) g.rect(ox + 33 + ((y / 3) % 2) * 2, y, 3, 1, rock[3]);
  // Stone walls.
  for (let y = 20; y < 39; y++) for (let x = ox + 3; x < ox + 45; x++) g.set(x, y, rock[1]);
  for (let row = 0; row < 7; row++) {
    const y = 20 + row * 3, off = row % 2 ? 3 : 0;
    for (let x = ox + 3 - off; x < ox + 45; x += 6) {
      for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) if (x + i >= ox + 3 && x + i < ox + 45) g.set(x + i, y + j, (x + row) % 4 ? rock[2] : rock[3]);
      if (x >= ox + 3) g.set(x, y, rock[4]);
    }
  }
  // Roof: a steep gable with rows of shingles.
  for (let y = 1; y < 21; y++) {
    const half = Math.round(2 + (y - 1) * 1.33);
    for (let x = ox + 24 - half; x <= ox + 24 + half; x++) {
      const inner = Math.abs(x - (ox + 24)) < half - 4 && y > 7;
      if (inner) continue;
      g.set(x, y, y % 3 === 0 ? roofD : (x + Math.floor(y / 3)) % 4 === 0 ? roofL : roof);
    }
  }
  // Timber gable with an attic window.
  for (let y = 8; y < 20; y++) {
    const half = Math.round(2 + (y - 1) * 1.33) - 4;
    for (let x = ox + 24 - half; x <= ox + 24 + half; x++) g.set(x, y, (x - ox) % 3 === 0 ? WOOD_D : WOOD);
  }
  g.ellipse(ox + 24.5, 14, 2, 2, WOOD_D); g.rect(ox + 23, 13, 3, 3, 0xffd25a); g.set(ox + 24, 14, 0xfff1a0);
  g.rect(ox + 2, 19, 44, 2, WOOD_D); g.rect(ox + 2, 19, 44, 1, WOOD_L);
  if (snowy) {
    for (let y = 1; y < 21; y++) {
      const half = Math.round(2 + (y - 1) * 1.33);
      g.set(ox + 24 - half, y, 0xffffff); g.set(ox + 24 + half, y, 0xffffff);
      if (y < 4) for (let x = ox + 24 - half; x <= ox + 24 + half; x++) g.set(x, y, 0xffffff);
    }
    g.rect(ox + 32, 0, 8, 1, 0xffffff);
    [[ox + 4, 3], [ox + 9, 2], [ox + 40, 3], [ox + 45, 2]].forEach(([x, len]) => g.line(x, 21, x, 21 + len, 0xbfe4ff));
  }
  // Door with a lantern beside it.
  g.rect(ox + 20, 28, 9, 11, WOOD); g.rect(ox + 21, 27, 7, 1, WOOD);
  for (let x = ox + 22; x < ox + 28; x += 2) g.line(x, 28, x, 38, WOOD_D);
  g.rect(ox + 20, 27, 9, 1, WOOD_D); g.set(ox + 27, 33, 0xf2c14e);
  g.rect(ox + 31, 27, 3, 4, 0xffd25a); g.rect(ox + 31, 26, 3, 1, OUT); g.set(ox + 32, 28, 0xffffff);
  // Two shuttered, lit windows.
  for (const wx of [ox + 8, ox + 36]) {
    g.rect(wx - 2, 24, 2, 7, 0x3f7a45); g.rect(wx + 6, 24, 2, 7, 0x3f7a45);
    g.rect(wx, 24, 6, 7, WOOD_D);
    g.rect(wx + 1, 25, 4, 5, 0xffd25a); g.rect(wx + 1, 25, 2, 2, 0xfff1a0);
    g.rect(wx + 3, 25, 1, 5, WOOD_D); g.rect(wx + 1, 27, 4, 1, WOOD_D);
    g.rect(wx - 1, 31, 8, 1, WOOD_L);
  }
  // Woodpile against the left wall.
  [[2, 36], [5, 36], [3.5, 33], [1, 33]].forEach(([x, y]) => { g.ellipse(x + 0.5, y + 1, 1.8, 1.8, END); g.set(Math.round(x), Math.round(y + 1), RING); });
  g.outline(OUT);
  return g;
}

// A pine bough reaching into the bottom corner of the view (foreground depth):
// a crooked brown branch with side twigs, dense fans of needles that are dark
// underneath and catch the light at their tips, and a couple of cones.
function branchGrid() {
  const W = 96, H = 48;
  const g = new PixelGrid(W, H);
  const DK = 0x0e2416, MD = 0x18391f, LT = 0x275a2c, TIP = 0x4a8a3c, SUN = 0x7ab850;
  const at = (t) => [t * 92, 44 - t * 30 - Math.sin(t * 3.2) * 3];
  // Needles: fan out from the branch and from each side twig.
  const fan = (bx, by, len, dirUp, k0) => {
    for (let k = 1; k < len; k++) {
      const f = k / len;
      const x = bx + k * (dirUp ? 0.35 : 0.5), y = by + (dirUp ? -k * 0.95 : k * 0.62);
      const c = f > 0.78 ? (dirUp ? TIP : LT) : f > 0.45 ? (dirUp ? LT : MD) : MD;
      g.set(x, y, c);
      g.set(x + 1, y, dirUp ? MD : DK);
      if (dirUp && f > 0.86 && (k + k0) % 3 === 0) g.set(x, y - 1, SUN);
    }
  };
  for (let i = 0; i < 90; i++) {
    const t = i / 90;
    const [bx, by] = at(t);
    const len = 17 - t * 10 + ((i * 7) % 4);
    fan(bx, by, len, true, i);
    fan(bx, by, len * 0.8, false, i);
  }
  // Side twigs with their own needle tufts.
  for (const [t0, dx, dy] of [[0.28, 10, -12], [0.5, 9, 9], [0.7, 8, -9]]) {
    const [x0, y0] = at(t0);
    g.line(x0, y0, x0 + dx, y0 + dy, 0x3a2616);
    for (let i = 0; i < 10; i++) {
      const u = i / 10;
      fan(x0 + dx * u, y0 + dy * u, 7 - u * 4, dy < 0, i);
    }
  }
  // The branch itself on top, lit along its upper side.
  for (let i = 0; i <= 92; i++) {
    const [x, y] = at(i / 92);
    const thick = i < 30 ? 3 : i < 65 ? 2 : 1;
    for (let k = 0; k < thick; k++) g.set(x, y + k, k === 0 ? 0x6a4a2a : 0x3a2616);
  }
  // Two hanging cones.
  for (const [t, len] of [[0.36, 7], [0.58, 6]]) {
    const [x, y] = at(t);
    for (let k = 0; k < len; k++) {
      const w = k < 2 ? 1 : k < len - 2 ? 2 : 1;
      for (let j = -w + 1; j < w; j++) g.set(x + j, y + 2 + k, (k + j) % 2 ? 0x5a3a20 : 0x8a5a30);
    }
  }
  return g;
}

// A small pine clinging to the edge of the wall: roots in a rock crack, a
// crooked trunk leaning out and flat layered pads of needles (snow optional).
// The root sits at the bottom right; it grows up and out to the left.
function cliffPineGrid(snow) {
  const g = new PixelGrid(24, 22);
  g.ellipse(18, 20, 4.5, 2, 0x5a5650); g.rect(15, 18, 6, 1, 0x7a7670);
  g.line(18, 19, 13, 12, 0x5a3a24, 2); g.line(13, 12, 9, 6, 0x5a3a24, 2); g.line(14, 13, 10, 7, 0x7a5232);
  const pad = (cx, cy, rx) => {
    g.ellipse(cx, cy + 1, rx, 2.2, 0x2e5236);
    g.ellipse(cx - 0.5, cy, rx - 1, 1.4, 0x3f6a44);
    for (let x = Math.round(cx - rx + 2); x < cx + 1; x += 2) g.set(x, Math.round(cy - 1), snow ? 0xffffff : 0x5f9a48);
    if (snow) for (let x = Math.round(cx - rx + 1); x < cx + rx - 1; x++) if (g.get(x, Math.round(cy - 1))) g.set(x, Math.round(cy - 1), 0xeef6ff);
  };
  pad(7, 4, 6.5); pad(12, 9, 6); pad(16, 14, 4.5);
  g.outline(OUT);
  return g;
}

// Chalk smudges left on used holds (three shapes, tinted with the chalk colour).
function chalkGrid(v) {
  const g = new PixelGrid(16, 8);
  const rng = new SeededRandom(120 + v);
  // Fingertip smears around the top of the hold, dusting onto the rock.
  for (let i = 0; i < 26; i++) {
    const a = rng.range(0, Math.PI), d = rng.range(3, 7.5);
    g.set(8 + Math.cos(a) * d, 6 - Math.sin(a) * d * 0.8, 0xffffff);
  }
  for (const fx of [4, 7, 10]) { g.set(fx + v % 2, 1 + (fx % 3), 0xffffff); g.set(fx + v % 2, 2 + (fx % 3), 0xffffff); }
  return g;
}

export const HUT_SIZE = { w: 54, h: 40, chimney: { x: 40, y: 0 }, lantern: { x: 36, y: 28 } };

// The camp requests board: a shingled roof, a framed cork board on two
// posts, three notes pinned on it (cream, blue-lined, a child's yellow one).
function boardGrid() {
  const g = new PixelGrid(30, 38);
  const POST = 1, FRAME = 2, CORK = 3, ROOF = 4;
  g.rect(6, 18, 3, 20, POST); g.rect(21, 18, 3, 20, POST);
  g.rect(1, 5, 28, 17, FRAME);
  g.rect(3, 7, 24, 13, CORK);
  for (let y = 0; y < 5; y++) g.rect(0 + Math.max(0, 2 - y), y + 1, 30 - Math.max(0, 2 - y) * 2, 1, ROOF);
  shade(g, POST, makeRamp(0x2a160c, 0x5e3a1e, 0x8a5e38, 4), { r: 1, base: 0.5 });
  shade(g, FRAME, makeRamp(0x2a160c, 0x6a4422, 0xa8743e, 5), { r: 1, base: 0.5, bias: (x, y) => ((x * 3 + y) % 7 === 0 ? -0.15 : 0) });
  shade(g, CORK, makeRamp(0x7a4a24, 0xb4824a, 0xd8a868, 5), { r: 2, base: 0.55, bias: (x, y) => ((x * 7 + y * 5) % 6 === 0 ? -0.2 : (x + y * 3) % 5 === 0 ? 0.12 : 0) });
  shade(g, ROOF, [0x2a1210, 0x4a2018, 0x6a3020, 0x8a4428], { r: 1, base: 0.55, bias: (x, y) => ((x + y * 4) % 6 === 0 ? -0.3 : 0) });
  // The notes: shaded paper, writing lines, red pins.
  const note = (x, y, w, h, paper, shadow, line) => {
    g.rect(x + 1, y + 1, w, h, 0x5a3418);
    g.rect(x, y, w, h, paper);
    g.rect(x, y + h - 1, w, 1, shadow); g.rect(x + w - 1, y, 1, h, shadow);
    for (let ly = y + 2; ly < y + h - 1; ly += 2) g.rect(x + 1, ly, w - 3, 1, line);
    g.set(x + Math.floor(w / 2), y, 0xd83a22); g.set(x + Math.floor(w / 2), y - 1, 0xff8a7a);
  };
  note(4, 9, 6, 8, 0xf0e6cc, 0xc8b894, 0xa89878);
  note(12, 8, 7, 9, 0xe8eef4, 0xb8c4d0, 0x7a9ac8);
  note(21, 10, 5, 7, 0xf8e080, 0xd0b050, 0xd84a3a);
  g.outline(OUT);
  return g;
}

// People at the fire, sitting: the ones whose story notes you finished.
// look: [coat, coat dark, hat or hair, skin, extra]
const PEOPLE_LOOK = {
  ines: { coat: 0x4f86f0, dark: 0x2f5aa8, top: 0x2a2018, skin: 0xe8b48a, extra: 'camera' },
  pim: { coat: 0xa8743e, dark: 0x7a5228, top: 0x6a5a3a, skin: 0xf0c8a0, extra: 'hat' },
  marta: { coat: 0x8a6ab8, dark: 0x5a4288, top: 0xd8d4cc, skin: 0xe0b090, extra: 'shawl' },
  noor: { coat: 0xf2c14e, dark: 0xc8902a, top: 0x3a2418, skin: 0xc8946a, extra: 'small' },
  tenzin: { coat: 0xe8762a, dark: 0xa84a14, top: 0x2a2018, skin: 0xb07a50, extra: 'robe' },
};
function personFrame(id, f) {
  const p = PEOPLE_LOOK[id];
  const g = new PixelGrid(12, 16);
  const small = p.extra === 'small';
  const top = small ? 4 : 1, by = f ? 1 : 0;
  // Body (sitting: knees out front), arms, head.
  g.rect(3, top + 6 + by, 6, small ? 5 : 6, p.coat);
  g.rect(3, top + 6 + by, 1, small ? 5 : 6, p.dark);
  g.rect(4, 13, 6, 2, p.dark); g.rect(9, 13, 2, 3, 0x3a3440);
  if (p.extra === 'robe') g.rect(2, top + 9 + by, 9, 4, p.coat);
  g.rect(4, top + 1 + by, 4, 4, p.skin);
  g.rect(4, top + by, 4, 2, p.top);
  if (p.extra === 'hat') { g.rect(2, top - 1 + by, 8, 1, p.top); g.rect(4, top - 2 + by, 4, 2, p.top); }
  if (p.extra === 'shawl') g.rect(3, top + 5 + by, 6, 2, 0xc84a5a);
  if (p.extra === 'camera') { g.rect(7, top + 7 + by, 3, 2, 0x2a2a30); g.set(8, top + 7 + by, 0x9fd8ff); }
  g.set(7, top + 2 + by, OUT);
  g.outline(OUT);
  return g;
}

// The pets' pen at base camp: split rails on posts round a bed of straw,
// a little water trough in the corner.
function penGrid() {
  const g = new PixelGrid(44, 18);
  const POST = 1, RAIL = 2, STRAW = 3, TROUGH = 4;
  g.rect(1, 13, 42, 4, STRAW);
  for (const px of [1, 15, 29, 41]) g.rect(px, 3, 3, 14, POST);
  g.rect(1, 6, 43, 2, RAIL); g.rect(1, 10, 43, 2, RAIL);
  g.rect(31, 12, 8, 4, TROUGH);
  shade(g, STRAW, makeRamp(0x8a6020, 0xd8b048, 0xf8e088, 5), { r: 1, base: 0.55, bias: (x, y) => ((x * 3 + y * 5) % 4 === 0 ? 0.2 : (x + y) % 5 === 0 ? -0.2 : 0) });
  shade(g, POST, makeRamp(0x2a160c, 0x5e3a1e, 0x9a6a3a, 4), { r: 1, base: 0.5 });
  shade(g, RAIL, makeRamp(0x3a2010, 0x7a5028, 0xb8844a, 4), { r: 1, base: 0.55 });
  shade(g, TROUGH, makeRamp(0x2a1a10, 0x5a3a20, 0x7a5a38, 3), { r: 1, base: 0.5 });
  g.rect(32, 12, 6, 1, 0x6ab8e8); g.set(33, 12, 0xd8f0ff);
  for (const px of [1, 15, 29, 41]) { g.set(px, 3, 0xc89a5a); g.set(px + 1, 3, 0xc89a5a); }
  g.outline(OUT);
  return g;
}

// ---------------------------------------------------------------- the meadow
// Clusters of wildflowers on stems with leaves (one kind per variant), tall
// grass in two sway frames, mossy boulders and a ring of mushrooms.
const FLOWERS = [
  { petal: [0xc8263a, 0xf04a4a], eye: 0x1a0a0a, size: 1, n: 6 }, // poppies
  { petal: [0xe8e4dc, 0xffffff], eye: 0xf2c14e, size: 1, n: 8 }, // daisies
  { petal: [0x5a6ad8, 0x8a9af0], eye: 0x3a46a8, size: 0, n: 9 }, // bluebells
  { petal: [0xe8b020, 0xffe060], eye: 0xc88a10, size: 0, n: 9 }, // buttercups
  { petal: [0x8a4ac8, 0xc08af0], eye: null, size: 2, n: 4 }, // lupines
];
function flowerGrid(v) {
  const f = FLOWERS[v];
  const g = new PixelGrid(20, 14);
  const rng = new SeededRandom(500 + v * 13);
  const leaf = [0x2e5a24, 0x4a8a34, 0x6ab048];
  // Leaves at the base.
  for (let i = 0; i < 9; i++) { const x = 3 + rng.int(0, 13), h = rng.int(2, 4); for (let k = 0; k < h; k++) g.set(x + (k > 1 ? (i % 2 ? 1 : -1) : 0), 13 - k, leaf[k % 3]); }
  for (let i = 0; i < f.n; i++) {
    const x = 2 + rng.int(0, 15), top = rng.int(f.size === 2 ? 1 : 3, 8);
    for (let y = top + 1; y < 14; y++) g.set(x + (y < top + 3 && i % 2 ? 1 : 0), y, y % 3 ? leaf[1] : leaf[0]);
    if (f.size === 2) { for (let k = 0; k < 6; k++) { g.set(x - 1, top + k, f.petal[k % 2]); g.set(x + 1, top + k, f.petal[(k + 1) % 2]); g.set(x, top + k - 1, f.petal[1]); } continue; }
    const r = f.size;
    g.set(x, top, f.eye ?? f.petal[1]);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.set(x + dx, top + dy, f.petal[dy < 0 || dx < 0 ? 1 : 0]);
    if (r) for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) if (rng.chance(0.5)) g.set(x + dx, top + dy, f.petal[0]);
  }
  g.outline(0x1a2a16);
  return g;
}
function tallGrass(f) {
  const g = new PixelGrid(14, 16);
  const cols = [0x2e5a24, 0x4a8a34, 0x6ab048, 0x8ac858];
  for (let i = 0; i < 9; i++) {
    const x0 = 2 + i * 1.2, h = 8 + ((i * 5) % 7), lean = (i % 2 ? 1 : -1) * 0.25 + (f ? 0.35 : 0);
    for (let k = 0; k < h; k++) g.set(Math.round(x0 + lean * k * (k / h)), 15 - k, cols[Math.min(3, Math.floor(k / 4)) ]);
  }
  for (const x of [4, 9]) { g.set(x + (f ? 2 : 1), 4, 0xd8c890); g.set(x + (f ? 2 : 1), 3, 0xe8dca0); }
  return g;
}
function mossyStone() {
  const g = new PixelGrid(16, 10);
  g.ellipse(8, 6, 7.5, 4.5, 0x6a6a74);
  for (let y = 0; y < 10; y++) for (let x = 0; x < 16; x++) {
    const c = g.get(x, y); if (c === null) continue;
    const k = (x - 8) * -0.06 + (y - 6) * -0.12;
    g.set(x, y, k > 0.25 ? 0xa8a8b0 : k > 0 ? 0x8a8a94 : k > -0.3 ? 0x6a6a74 : 0x4a4a54);
    if (y < 5 && ((x * 7 + y * 3) % 4 === 0 || y < 3)) g.set(x, y, (x + y) % 3 ? 0x4a8a34 : 0x6ab048);
  }
  g.outline(0x1a1a20);
  return g;
}
function mushrooms() {
  const g = new PixelGrid(14, 9);
  for (const [x, h, r] of [[3, 4, 2], [7, 6, 3], [11, 3, 2]]) {
    g.rect(x, 9 - h, 1, h, 0xf0e6d0);
    g.ellipse(x + 0.5, 9 - h, r, r * 0.7, 0xc8263a);
    g.set(x - 1, 9 - h - 1, 0xffffff); g.set(x + 1, 9 - h, 0xffffff);
  }
  g.outline(0x2a1a16);
  return g;
}

export function buildCampTextures(scene) {
  FLOWERS.forEach((_, v) => add(scene, `meadow_flowers_${v}`, flowerGrid(v)));
  addFrames(scene, 'meadow_grass', [tallGrass(0), tallGrass(1)]);
  add(scene, 'meadow_stone', mossyStone());
  add(scene, 'meadow_mush', mushrooms());
  add(scene, 'camp_pen', penGrid());
  add(scene, 'camp_board', boardGrid());
  for (const id of Object.keys(PEOPLE_LOOK)) addFrames(scene, `camp_person_${id}`, [personFrame(id, 0), personFrame(id, 1)]);
  addFrames(scene, 'camp_fire', [0, 1, 2].map(fireFrame));
  add(scene, 'camp_bench', benchGrid());
  add(scene, 'camp_wood', woodGrid());
  add(scene, 'camp_crate', crateGrid());
  addFrames(scene, 'camp_tuft', [0, 1, 2].map(tuftGrid));
  addFrames(scene, 'butterfly', [butterflyFrame(true), butterflyFrame(false)]);
  addFrames(scene, 'chalk_mark', [0, 1, 2].map(chalkGrid));
  add(scene, 'fg_branch', branchGrid());
  add(scene, 'decor_cliffpine', cliffPineGrid(false));
  add(scene, 'decor_cliffpine_snow', cliffPineGrid(true));
  for (const biome of Object.values(BIOMES)) add(scene, `hut_${biome.id}`, hutGrid(biome));
}
