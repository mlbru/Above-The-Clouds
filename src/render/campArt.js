// Procedural art for base camp (campfire, bench, firewood, grass, butterflies)
// and the mountain huts, which take the colours of the biome they stand in.
import { PixelGrid, makeCanvas } from '../utils/pixelGrid.js';
import { darken, lighten } from '../utils/color.js';
import { SeededRandom } from '../utils/seededRandom.js';
import { BIOMES } from '../data/biomes.js';

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

// The camp requests board: a cork board on a post with a little roof,
// three paper notes pinned on it (data/requests.js, scenes/RequestsScene.js).
function boardGrid() {
  const g = new PixelGrid(26, 34);
  g.rect(12, 14, 3, 20, WOOD_D); g.rect(12, 14, 1, 20, WOOD);
  // A little shingle roof against the rain.
  g.rect(1, 1, 24, 3, 0x5a3a22); g.rect(2, 0, 22, 1, 0x7a5232); g.rect(1, 3, 24, 1, 0x3a2414);
  // Frame and cork.
  g.rect(2, 4, 22, 15, WOOD_D);
  g.rect(3, 5, 20, 13, 0xb4824a);
  for (let i = 0; i < 26; i++) g.set(3 + ((i * 7) % 20), 5 + ((i * 5) % 13), i % 3 ? 0x9a6a3a : 0xc89660);
  // Three notes: cream, blue-lined, and a child's yellow one; red pins.
  g.rect(4, 7, 5, 6, 0xf0e6cc); g.rect(5, 9, 3, 1, 0xa8a090); g.rect(5, 11, 3, 1, 0xa8a090); g.set(6, 7, 0xd83a22);
  g.rect(10, 6, 6, 7, 0xe8eef4); g.rect(11, 8, 4, 1, 0x7a9ac8); g.rect(11, 10, 4, 1, 0x7a9ac8); g.set(12, 6, 0xd83a22);
  g.rect(17, 8, 5, 7, 0xf8e080); g.set(18, 10, 0xd84a3a); g.set(20, 11, 0x4a8ad8); g.set(19, 13, 0x4ab84a); g.set(19, 8, 0xd83a22);
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

// The pets' pen at base camp: a low split-rail fence round a bed of straw.
function penGrid() {
  const g = new PixelGrid(40, 16);
  g.rect(1, 12, 38, 3, 0xc8a050);
  for (let x = 2; x < 38; x += 3) g.set(x, 11 + (x % 2), 0xe8c870);
  for (const px of [1, 13, 26, 38]) { g.rect(px, 3, 2, 12, WOOD_D); g.set(px, 3, WOOD_L); }
  g.rect(1, 5, 39, 2, WOOD); g.rect(1, 5, 39, 1, WOOD_L);
  g.rect(1, 9, 39, 2, WOOD); g.rect(1, 9, 39, 1, WOOD_L);
  g.outline(OUT);
  return g;
}

export function buildCampTextures(scene) {
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
