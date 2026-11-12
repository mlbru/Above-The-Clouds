// Pixel art for Trail Boons: a 14x14 emblem per gift (drawn on a 12x12 area
// with a dark outline), a souvenir pouch per biome, the cairn that marks a
// shrine ledge on the wall, and the songbird that rides on your shoulder.
import { PixelGrid, makeCanvas } from '../utils/pixelGrid.js';
import { BOONS, SOUVENIR_MECHANICS } from '../data/boons.js';
import { gemForBiome } from '../data/gems.js';

const OUT = 0x16141f;

// Each draws on a 14x14 grid; keep to x/y 1..12 so the outline fits.
const ICONS = {
  // Two lungs and a windpipe, pale blue air rising out.
  deepbreath: (g) => {
    g.rect(6, 1, 2, 5, 0xe8e0f0);
    g.ellipse(4, 8, 3, 4, 0xe86a8a); g.ellipse(10, 8, 3, 4, 0xe86a8a);
    g.ellipse(3.6, 7.2, 1.6, 2.2, 0xff9ab2); g.ellipse(9.6, 7.2, 1.6, 2.2, 0xff9ab2);
    g.rect(5, 5, 4, 1, 0xe8e0f0);
    g.set(4, 6, 0xffd0dc); g.set(9, 6, 0xffd0dc);
  },
  // A hip flask with a cork and a label.
  flask: (g) => {
    g.rect(5, 1, 4, 2, 0xa8743e);
    g.rect(6, 3, 2, 1, 0xd8d0c0);
    g.ellipse(7, 8.5, 4.5, 4.5, 0xc0c8d8);
    g.ellipse(6, 7.5, 2, 2.5, 0xe8eef8);
    g.rect(4, 8, 6, 3, 0xd84a3a);
    g.rect(5, 9, 4, 1, 0xf2c14e);
  },
  // A drum with two crossed sticks.
  drummer: (g) => {
    g.ellipse(7, 6, 5, 2, 0xf4efe4);
    g.rect(2, 6, 11, 5, 0xc8402e);
    g.ellipse(7, 11, 5, 1.5, 0x8a2a1e);
    for (const x of [3, 6, 9, 12]) g.line(x, 7, x - 1, 10, 0xf2c14e);
    g.ellipse(7, 6, 5, 2, 0xf4efe4);
    g.line(1, 1, 6, 5, 0xa8743e); g.line(13, 1, 8, 5, 0xa8743e);
    g.set(1, 1, 0xf4efe4); g.set(12, 1, 0xf4efe4);
  },
  // A riveted iron shield.
  ironnerve: (g) => {
    for (let y = 1; y <= 12; y++) {
      const half = y < 8 ? 5 : Math.max(0, 5 - (y - 7));
      g.rect(7 - half, y, half * 2, 1, y < 4 ? 0xb8c0d0 : 0x8890a4);
    }
    g.rect(6, 2, 2, 9, 0x5a6278);
    g.rect(3, 5, 8, 1, 0x5a6278);
    for (const [x, y] of [[3, 2], [10, 2], [3, 8], [10, 8]]) g.set(x, y, 0xf4efe4);
  },
  // Rings of sound spreading from a dot.
  echo: (g) => {
    g.ellipse(3, 7, 1.5, 1.5, 0xff9ae6);
    for (const [r, c] of [[4, 0xff9ae6], [7, 0xd86ac4], [10, 0xa848a0]]) {
      for (let a = -0.9; a <= 0.9; a += 0.08) g.set(3 + Math.cos(a) * r, 7 + Math.sin(a) * r, c);
    }
  },
  // A climbing boot with two slow, curling motion lines.
  steadypace: (g) => {
    g.rect(4, 2, 5, 6, 0x8a5a36);
    g.rect(4, 7, 8, 3, 0x8a5a36);
    g.rect(3, 10, 10, 2, 0x3a3046);
    g.rect(5, 3, 3, 1, 0xd8c070); g.rect(5, 5, 3, 1, 0xd8c070);
    g.rect(9, 8, 3, 1, 0xa8744a);
    g.set(1, 4, 0x9fd8ff); g.set(2, 4, 0x9fd8ff); g.set(1, 7, 0x9fd8ff); g.set(2, 6, 0x9fd8ff);
  },
  // A little yellow songbird with a note above it.
  songbird: (g) => {
    g.ellipse(6, 8, 4, 3, 0xffd24a);
    g.ellipse(9.5, 5.5, 2.5, 2.5, 0xffd24a);
    g.ellipse(5, 8.5, 2.5, 1.5, 0xd89a2a);
    g.set(12, 5, 0xf08a2a); g.set(12, 6, 0xf08a2a);
    g.set(10, 5, OUT);
    g.line(1, 7, 3, 9, 0xd89a2a);
    g.rect(5, 11, 1, 1, 0xf08a2a); g.rect(7, 11, 1, 1, 0xf08a2a);
    g.rect(3, 1, 1, 4, 0xff9ae6); g.rect(4, 1, 2, 1, 0xff9ae6); g.rect(2, 4, 2, 1, 0xff9ae6);
  },
  // A die showing five.
  gambler: (g) => {
    g.rect(2, 2, 10, 10, 0xf4efe4);
    g.rect(2, 10, 10, 2, 0xc8c0b0); g.rect(10, 2, 2, 10, 0xc8c0b0);
    for (const [x, y] of [[4, 4], [8, 4], [6, 6], [4, 8], [8, 8]]) g.rect(x, y, 2, 2, 0xd83a3a);
  },
  // A magpie holding a gem in its beak.
  magpie: (g) => {
    g.ellipse(6, 7, 4, 3, 0x22202e);
    g.ellipse(5.5, 7.8, 2.6, 1.6, 0xf4efe4);
    g.ellipse(9, 4.5, 2.4, 2.2, 0x22202e);
    g.line(1, 9, 3, 7, 0x3a4a8a);
    g.set(9, 4, 0xf4efe4);
    g.rect(11, 5, 1, 1, 0xf2c14e);
    g.ellipse(12, 7.5, 1.4, 1.6, 0x6ad8ff); g.set(12, 7, 0xe8ffff);
    g.rect(6, 10, 1, 2, 0xf2c14e); g.rect(8, 10, 1, 2, 0xf2c14e);
  },
  // A rolled map with a red X and a dotted path.
  cartographer: (g) => {
    g.rect(2, 2, 10, 10, 0xe8d8a8);
    g.rect(1, 2, 2, 10, 0xc8a870); g.rect(11, 2, 2, 10, 0xc8a870);
    for (const [x, y] of [[4, 10], [5, 9], [6, 8], [6, 6], [7, 5]]) g.set(x, y, 0x6a4a2a);
    g.set(8, 3, 0xd83a3a); g.set(10, 3, 0xd83a3a); g.set(9, 4, 0xd83a3a); g.set(8, 5, 0xd83a3a); g.set(10, 5, 0xd83a3a);
  },
  // A white feather, drifting.
  featherweight: (g) => {
    g.line(3, 12, 10, 1, 0xa8a0b8);
    for (let i = 0; i < 9; i++) {
      const x = 3.6 + i * 0.8, y = 11 - i * 1.2;
      g.line(x, y, x - 2.2, y - 1.8, 0xf4efe4);
      g.line(x, y, x + 1.8, y + 0.6, 0xe0e4f0);
    }
    g.line(3, 12, 10, 1, 0xa8a0b8);
  },
  // Warm air: three rising orange curls and an up arrow.
  warmlungs: (g) => {
    for (const [x0, c] of [[3, 0xffb45a], [7, 0xff8a3c], [11, 0xffb45a]]) {
      for (let y = 12; y >= 4; y--) g.set(x0 + Math.round(Math.sin(y * 0.9) * 1.2), y, c);
    }
    g.rect(6, 1, 3, 1, 0xfff1a0); g.rect(5, 2, 5, 1, 0xfff1a0); g.rect(7, 3, 1, 2, 0xfff1a0);
  },
  // A cat's eye: green almond with a slit.
  catseyes: (g) => {
    for (let x = 1; x <= 12; x++) {
      const h = Math.round(Math.sin(((x - 1) / 11) * Math.PI) * 4);
      g.rect(x, 7 - h, 1, h * 2 + 1, 0x9ae84a);
    }
    g.ellipse(6.5, 7, 3, 3.6, 0xd8f05a);
    g.rect(6, 3, 2, 9, OUT);
    g.set(4, 5, 0xffffff);
  },
  // A snowflake.
  icefingers: (g) => {
    const c = 0xcfeeff, d = 0x7ac8f0;
    g.line(7, 1, 7, 12, c); g.line(2, 4, 12, 10, c); g.line(2, 10, 12, 4, c);
    for (const [x, y] of [[6, 2], [8, 2], [6, 11], [8, 11], [3, 3], [11, 11], [3, 11], [11, 3]]) g.set(x, y, d);
    g.rect(6, 6, 3, 3, 0xffffff);
  },
  // A firebird rising, wings up.
  phoenix: (g) => {
    g.line(1, 3, 6, 7, 0xffd24a, 2); g.line(13, 3, 8, 7, 0xffd24a, 2);
    g.line(2, 2, 5, 5, 0xff8a3c); g.line(12, 2, 9, 5, 0xff8a3c);
    g.ellipse(7, 7.5, 2, 2.5, 0xff8a3c);
    g.ellipse(7, 5, 1.4, 1.4, 0xfff1a0);
    g.line(7, 9, 5, 12, 0xd84a2a); g.line(7, 9, 9, 12, 0xd84a2a); g.line(7, 9, 7, 12, 0xffb45a);
  },
  // A coiled rope with a golden carabiner.
  secondrope: (g) => {
    for (const r of [5, 3.5, 2]) {
      for (let a = 0; a < Math.PI * 2; a += 0.15) g.set(7 + Math.cos(a) * r, 7 + Math.sin(a) * r * 0.9, r > 4 ? 0xe07a2e : r > 3 ? 0xf2a24a : 0xffc46a);
    }
    g.rect(10, 1, 3, 4, 0xffd24a); g.rect(11, 2, 1, 2, null);
  },
  // A forked, wandering path in a wild green.
  wildroute: (g) => {
    for (let y = 12; y >= 2; y--) g.set(4 + Math.round(Math.sin(y * 0.8) * 1.5), y, 0x8fd16a);
    for (let y = 8; y >= 2; y--) g.set(9 + Math.round(Math.cos(y * 0.9) * 1.5), y, 0xd8ff8a);
    g.line(5, 9, 9, 7, 0xd8ff8a);
    g.rect(3, 1, 3, 1, 0xf4efe4); g.rect(8, 1, 3, 1, 0xf4efe4);
  },
};

// The new gifts (idea sheet 1.13).
Object.assign(ICONS, {
  // A brass metronome, its pendulum swung over, a flash at the end of the swing.
  metronome: (g) => {
    for (let y = 3; y <= 12; y++) { const half = Math.round(1 + (y - 3) * 0.45); g.rect(7 - half, y, half * 2 + 1, 1, y > 10 ? 0x6a4428 : 0xa8743e); }
    g.rect(6, 6, 3, 5, 0x5a3a20);
    g.line(7, 11, 11, 2, 0xf2c14e);
    g.rect(9, 5, 2, 2, 0xffd870);
    g.set(12, 1, 0xffffff); g.set(13, 2, 0xfff1a0); g.set(11, 0, 0xfff1a0);
  },
  // A rope hand reaching down to catch a slipping glove.
  sherpa: (g) => {
    g.line(3, 1, 3, 6, 0xe0503a); g.line(4, 1, 4, 6, 0xf4efe4);
    g.rect(2, 6, 4, 3, 0xe8b48a); g.rect(2, 9, 4, 2, 0x8a5a36);
    g.rect(8, 7, 4, 3, 0xe8b48a); g.rect(8, 10, 4, 2, 0x4f86f0);
    g.line(5, 8, 8, 8, 0xf2c14e);
    g.set(10, 6, 0xffffff); g.set(12, 6, 0xffffff);
  },
  // A thundercloud with a bolt, a green spark of grip where it lands.
  stormcaller: (g) => {
    g.ellipse(5, 4, 3, 2.4, 0x6a7a98); g.ellipse(9, 3.6, 3.4, 2.6, 0x8a98b8); g.ellipse(7, 5, 4.6, 2, 0x5a6684);
    g.rect(7, 6, 2, 2, 0xffe45a); g.rect(6, 8, 2, 2, 0xffe45a); g.rect(7, 10, 2, 1, 0xffe45a); g.set(8, 11, 0xffffff);
    g.set(10, 11, 0x8fd16a); g.set(11, 10, 0x8fd16a); g.set(11, 12, 0x8fd16a); g.set(12, 11, 0xd8ff8a);
  },
  // A mountain goat's head: curled horns, pale face, a little beard, on a ledge.
  goathooves: (g) => {
    for (const sx of [-1, 1]) for (let a = 0; a < 3.6; a += 0.18) g.set(7 + sx * (2 + Math.sin(a) * 2.6 + a * 0.4), 3 + Math.cos(a) * 2.4, 0xc8b48a);
    g.ellipse(7, 7, 2.6, 3.2, 0xf4efe4);
    g.rect(5, 9, 5, 2, 0xe0d8c8);
    g.set(3, 6, 0xf4efe4); g.set(11, 6, 0xf4efe4);
    g.set(6, 6, 0x2a2436); g.set(8, 6, 0x2a2436);
    g.rect(6, 11, 3, 1, 0xd8d0c0); g.set(7, 12, 0xd8d0c0);
    g.rect(1, 13, 12, 1, 0x8a8478);
  },
  // A black crow with a gem in its beak, one bright eye.
  crow: (g) => {
    g.ellipse(6, 8, 4, 3, 0x2a2436); g.ellipse(9, 5, 2.4, 2.2, 0x2a2436);
    g.line(2, 9, 0, 12, 0x2a2436); g.line(3, 10, 1, 13, 0x2a2436);
    g.rect(5, 7, 3, 1, 0x4a4060);
    g.rect(11, 5, 2, 1, 0xd8a040);
    g.set(9, 4, 0xffffff);
    g.ellipse(12.5, 7, 1.3, 1.3, 0x6ad8ff); g.set(12, 6, 0xffffff);
    g.line(6, 11, 5, 13, 0xd8a040); g.line(8, 11, 8, 13, 0xd8a040);
  },
  // A candle burnt to a stub, still lit: a golden halo round the flame.
  lastlight: (g) => {
    for (let a = 0; a < Math.PI * 2; a += 0.2) g.set(7 + Math.cos(a) * 5, 5 + Math.sin(a) * 4.4, 0xffd24a);
    g.ellipse(7, 5, 1.4, 2.4, 0xff9a3c); g.ellipse(7, 5.6, 0.8, 1.2, 0xfff1a0);
    g.rect(5, 8, 5, 4, 0xf4efe4); g.rect(5, 8, 1, 4, 0xffffff); g.rect(9, 8, 1, 4, 0xc8c0b0);
    g.rect(4, 12, 7, 1, 0xa8743e); g.set(7, 7, 0x3a3046);
  },
});

// A souvenir: a little tied pouch glowing with the biome's own stone.
function souvenirIcon(g, gemColor) {
  g.ellipse(7, 8.5, 4.5, 3.8, 0x8a6a4a);
  g.ellipse(6, 7.8, 2.4, 2, 0xa88a64);
  g.rect(5, 3, 4, 2, 0x8a6a4a);
  g.rect(4, 4, 6, 1, 0xd8c070);
  g.ellipse(7, 9, 2, 1.8, gemColor);
  g.set(6, 8, 0xffffff);
  g.set(4, 2, 0xd8c070); g.set(10, 2, 0xd8c070);
}

function addGrid(scene, key, grid) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const c = makeCanvas(grid.w, grid.h);
  grid.drawTo(c.getContext('2d'));
  scene.textures.addCanvas(key, c);
}

export const boonIconKey = (id) => `boon_${id}`;

// Builds every boon texture once per game.
export function buildBoonTextures(scene) {
  if (scene.textures.exists('shrine_cairn')) return;
  for (const b of BOONS) {
    const g = new PixelGrid(14, 14);
    ICONS[b.id](g);
    g.outline(OUT);
    addGrid(scene, boonIconKey(b.id), g);
  }
  for (const biome of Object.keys(SOUVENIR_MECHANICS)) {
    const g = new PixelGrid(14, 14);
    souvenirIcon(g, gemForBiome(biome).color);
    g.outline(OUT);
    addGrid(scene, boonIconKey(`souvenir:${biome}`), g);
  }
  // The cairn: five stacked stones, a rune carved in the middle one.
  const c = new PixelGrid(22, 28);
  const stones = [[11, 24, 9, 3.6, 0x6a6478], [10, 18.5, 7, 3, 0x7a7488], [12, 13.5, 5.6, 2.6, 0x6e687e], [10.5, 9, 4.2, 2.2, 0x847e94], [11.5, 5, 2.8, 1.8, 0x908aa0]];
  for (const [x, y, rx, ry, col] of stones) {
    c.ellipse(x, y, rx, ry, col);
    c.ellipse(x - rx * 0.3, y - ry * 0.35, rx * 0.5, ry * 0.4, 0xa8a2b8);
  }
  // Moss on the lower stones.
  for (const [x, y] of [[4, 24], [5, 25], [6, 26], [16, 25], [17, 24], [5, 19], [14, 20]]) c.set(x, y, 0x5a8a3a);
  c.shadeEdges(new Set([0x5a8a3a]), 0.7);
  c.outline(0x16141f);
  addGrid(scene, 'shrine_cairn', c);
  // The rune, drawn apart so it can glow.
  const r = new PixelGrid(7, 7);
  for (const [x, y] of [[3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [3, 6], [1, 1], [5, 1], [2, 2], [4, 2], [1, 5], [5, 5]]) r.set(x, y, 0xffffff);
  addGrid(scene, 'shrine_rune', r);
  // The songbird, beak shut and open.
  for (const open of [0, 1]) {
    const s = new PixelGrid(9, 7);
    s.ellipse(4, 4.2, 3, 2.2, 0xffd24a);
    s.ellipse(6.3, 2.6, 1.8, 1.8, 0xffd24a);
    s.ellipse(3.6, 4.6, 1.8, 1.1, 0xd89a2a);
    s.set(1, 3, 0xd89a2a); s.set(0, 3, 0xd89a2a);
    s.set(6, 2, 0x16141f);
    s.set(8, 2, 0xf08a2a);
    if (open) s.set(8, 4, 0xf08a2a); else s.set(8, 3, 0xf08a2a);
    s.set(3, 6, 0xf08a2a); s.set(5, 6, 0xf08a2a);
    addGrid(scene, `songbird_${open}`, s);
  }
}
