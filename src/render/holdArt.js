// Holds with character: instead of one oval per biome, every plain hold is
// one of several shapes (picked per hold from its position, so the same
// mountain always looks the same), each lit from the upper left with a dark
// underside and a chalk smudge, and some biomes have shapes of their own:
// blades of ice, crystal clusters, black glass, dragon scales.
// Hazard holds (loose, icy, crumbling) and the hive, clockwork and bone holds
// keep their own looks so they stay readable.
import { PixelGrid } from '../utils/pixelGrid.js';
import { darken, lighten, lerpColor } from '../utils/color.js';

const OUT = 0x16141f;
const CHALK = 0xf6f3ea, CHALK2 = 0xe8e4da;

// Which shapes each biome uses for plain holds and for jugs.
export const HOLD_SHAPES = {
  default: { hold: ['round', 'crimp', 'pocket', 'sloper', 'flake'], jug: ['bucket', 'horn'] },
  green: { hold: ['round', 'crimp', 'pocket', 'sloper', 'mossy'], jug: ['bucket', 'horn'] },
  stone: { hold: ['crimp', 'flake', 'pocket', 'round', 'crimp'], jug: ['bucket', 'horn'] },
  frozen: { hold: ['blade', 'blade', 'crimp', 'sloper', 'round'], jug: ['bucket', 'blade_jug'] },
  aurora: { hold: ['blade', 'crimp', 'sloper', 'round', 'blade'], jug: ['bucket', 'blade_jug'] },
  crystal: { hold: ['shard', 'shard', 'round', 'crimp', 'shard'], jug: ['shard_jug', 'bucket'] },
  obsidian: { hold: ['glass', 'glass', 'crimp', 'flake', 'glass'], jug: ['glass_jug', 'bucket'] },
  dragon: { hold: ['scale', 'scale', 'crimp', 'round', 'scale'], jug: ['bucket', 'horn'] },
  storm: { hold: ['crimp', 'flake', 'sloper', 'round', 'pocket'], jug: ['bucket', 'horn'] },
  clouds: { hold: ['sloper', 'round', 'pocket', 'crimp', 'sloper'], jug: ['bucket', 'horn'] },
};
export const SHAPED_BIOMES_SKIP = ['hive', 'clockwork', 'bones'];
export const holdShapeKey = (biomeId, shape) => `holdshape_${biomeId}_${shape}`;
export const shapesFor = (biomeId, kind) => (HOLD_SHAPES[biomeId] || HOLD_SHAPES.default)[kind === 'jug' ? 'jug' : 'hold'];

// Fill a polygon into the grid.
function poly(g, pts, c) {
  const ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    for (let x = 0; x < g.w; x++) {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y + 0.5) !== (yj > y + 0.5) && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) g.set(x, y, c);
    }
  }
}

// Light the shape: the top edge catches light, the bottom edge falls dark,
// the left edge a little lighter than the right.
function shade(g, body, light, dark) {
  const at = (x, y) => g.get(x, y);
  const out = new Map();
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (at(x, y) !== body) continue;
    if (at(x, y - 1) === null) out.set(`${x},${y}`, light);
    else if (at(x, y - 2) === null) out.set(`${x},${y}`, lerpColor(light, body, 0.5));
    else if (at(x, y + 1) === null) out.set(`${x},${y}`, dark);
    else if (at(x + 1, y) === null) out.set(`${x},${y}`, lerpColor(body, dark, 0.5));
    else if (at(x - 1, y) === null) out.set(`${x},${y}`, lerpColor(body, light, 0.4));
  }
  out.forEach((c, k) => { const [x, y] = k.split(',').map(Number); g.set(x, y, c); });
}

export function holdShapeGrid(biome, shape) {
  const base = lerpColor(biome.rock[3], biome.holdTint, 0.45);
  const body = base, light = lighten(base, 0.38), dark = darken(base, 0.62);
  const g = new PixelGrid(20, 14);
  const chalk = (pts) => pts.forEach(([x, y], i) => g.set(x, y, i % 2 ? CHALK2 : CHALK));
  switch (shape) {
    case 'crimp': {
      // A thin edge sticking out of the rock: an uneven lit top, a short
      // face, and a deep undercut shadow below it.
      poly(g, [[2, 7], [4, 5], [9, 4], [15, 5], [18, 7], [16, 8], [5, 9]], body);
      shade(g, body, light, dark);
      for (let x = 4; x < 17; x++) if (g.get(x, 9) === null) g.set(x, 9, darken(base, 0.35));
      for (let x = 6; x < 15; x++) if (g.get(x, 10) === null) g.set(x, 10, darken(base, 0.5));
      // Chalk worn onto the edge in a smudge.
      chalk([[8, 5], [9, 5], [10, 5], [12, 6]]);
      break;
    }
    case 'pocket': {
      // An uneven lump with a deep hole near its top and a lit lower lip.
      poly(g, [[3, 8], [5, 4], [10, 3], [15, 4], [17, 8], [14, 11], [6, 11]], body);
      shade(g, body, light, dark);
      poly(g, [[6, 6], [8, 5], [13, 5], [14, 7], [10, 8], [7, 8]], darken(base, 0.3));
      poly(g, [[7, 6], [9, 5.5], [12, 5.5], [13, 7], [9, 7.5]], OUT);
      for (let x = 7; x <= 13; x++) g.set(x, 8, light);
      chalk([[8, 9], [9, 9], [12, 9]]);
      break;
    }
    case 'sloper': {
      // A wide, smooth dome with a soft round highlight.
      g.ellipse(10, 8, 8, 4.6, body);
      shade(g, body, lerpColor(light, body, 0.3), dark);
      g.ellipse(8, 6.5, 3, 1.4, lerpColor(light, 0xffffff, 0.2));
      chalk([[9, 5], [12, 6]]);
      break;
    }
    case 'flake': {
      // An angled flake of rock, leaning up to the right.
      poly(g, [[3, 10], [8, 4], [15, 2], [17, 4], [13, 8], [6, 11]], body);
      shade(g, body, light, dark);
      for (let i = 0; i < 6; i++) g.set(8 + i, 6 + Math.round(i * -0.4), lerpColor(light, body, 0.3));
      chalk([[10, 4], [13, 3]]);
      break;
    }
    case 'mossy': {
      g.ellipse(10, 7.5, 6, 4.2, body);
      shade(g, body, light, dark);
      // A cushion of moss on top.
      for (let x = 5; x <= 15; x++) {
        const h = 1 + ((x * 7) % 3 === 0 ? 1 : 0);
        for (let y = 0; y < h; y++) if (g.get(x, 4 + y) !== null || y === 0) g.set(x, 4 + y - 1, y ? 0x4f8a4a : 0x8fc86a);
      }
      g.set(7, 3, 0xb8e890); g.set(12, 3, 0xb8e890);
      chalk([[9, 6], [11, 7]]);
      break;
    }
    case 'blade': {
      // A blade of blue ice with icicles hanging from it.
      const ice = 0x9fd2f2, iceL = 0xeaf8ff, iceD = 0x5a8fc0;
      poly(g, [[2, 7], [6, 4], [17, 3], [18, 5], [14, 8], [4, 9]], ice);
      shade(g, ice, iceL, iceD);
      for (const [x, len] of [[6, 3], [9, 2], [12, 4], [15, 2]]) for (let k = 0; k < len; k++) g.set(x, 9 + k, k === len - 1 ? 0xc8e8ff : iceD);
      g.set(9, 4, 0xffffff); g.set(13, 4, 0xffffff);
      break;
    }
    case 'blade_jug': {
      const ice = 0x9fd2f2, iceL = 0xeaf8ff, iceD = 0x5a8fc0;
      poly(g, [[1, 8], [4, 3], [16, 2], [19, 6], [16, 10], [3, 11]], ice);
      shade(g, ice, iceL, iceD);
      g.ellipse(10, 5.5, 5, 1.4, iceD);
      for (const [x, len] of [[5, 2], [9, 3], [14, 2]]) for (let k = 0; k < len; k++) g.set(x, 11 + k, iceD);
      g.set(7, 3, 0xffffff);
      break;
    }
    case 'shard': case 'shard_jug': {
      // A little cluster of crystals growing out of the rock.
      const c = lerpColor(biome.accentC, 0xffffff, 0.2), cl = 0xffffff, cd = darken(biome.accentA, 0.7);
      g.ellipse(10, 10, 6, 2.5, body);
      const tall = shape === 'shard_jug' ? 3 : 0;
      for (const [x, h, w] of [[6, 6 + tall, 2], [10, 9 + tall, 3], [14, 5 + tall, 2]]) {
        poly(g, [[x - w, 10], [x, 10 - h], [x + w, 10]], c);
        for (let y = 10 - h + 1; y < 10; y++) g.set(x, y, cl);
        for (let y = 10 - h + 2; y < 10; y++) g.set(x + w - 1, y, cd);
      }
      shade(g, body, light, dark);
      break;
    }
    case 'glass': case 'glass_jug': {
      // A jagged spur of black glass with a violet edge.
      const k = 0x241c34, kl = 0xb48aff, kd = 0x0e0a16;
      const big = shape === 'glass_jug' ? 2 : 0;
      poly(g, [[2, 10], [5, 5 - big], [9, 6], [12, 2 - big], [15, 6], [18, 9], [11, 11]], k);
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.get(x, y) === k && g.get(x, y - 1) === null) g.set(x, y, kl);
      for (let x = 3; x < 17; x++) if (g.get(x, 11) !== null || g.get(x, 10) === k) g.set(x, 10, kd);
      g.set(12, 3 - big, 0xffffff);
      break;
    }
    case 'scale': {
      // A dragon scale: a rounded plate with ridges, lit on its rim.
      const s = lerpColor(biome.accentA, 0x8a3a24, 0.4), sl = lighten(s, 0.45), sd = darken(s, 0.55);
      g.ellipse(10, 6, 7, 5.5, s);
      for (let x = 0; x < g.w; x++) for (let y = 0; y < 6; y++) g.set(x, y, null);
      g.ellipse(10, 6, 7, 1, s);
      poly(g, [[3, 6], [17, 6], [14, 11], [10, 12], [6, 11]], s);
      shade(g, s, sl, sd);
      for (const x of [7, 10, 13]) for (let y = 7; y < 11; y++) g.set(x, y, sd);
      g.set(9, 6, 0xffd8a0);
      break;
    }
    case 'horn': {
      // A big curved horn of rock you can wrap your hand round.
      poly(g, [[2, 11], [3, 6], [7, 3], [13, 2], [17, 3], [18, 6], [14, 5], [9, 6], [8, 11]], body);
      shade(g, body, light, dark);
      g.ellipse(11, 5, 3, 1, darken(base, 0.4));
      chalk([[11, 3], [14, 3], [5, 7]]);
      break;
    }
    case 'bucket': {
      // A deep jug: a thick lip and a dark inside.
      g.ellipse(10, 7, 8, 5, body);
      shade(g, body, light, dark);
      g.ellipse(10, 6.5, 5, 1.8, darken(base, 0.35));
      g.ellipse(10, 6.2, 3.5, 1, OUT);
      chalk([[7, 4], [10, 3], [13, 4]]);
      break;
    }
    default: { // round
      g.ellipse(10, 7, 6, 4, body);
      shade(g, body, light, dark);
      chalk([[8, 5], [10, 5], [12, 6]]);
    }
  }
  g.outline(OUT);
  return g;
}
