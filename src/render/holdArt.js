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
  // The Far Range: wet rounded basalt; old stone under moss.
  cascade: { hold: ['sloper', 'round', 'pocket', 'mossy', 'sloper'], jug: ['bucket', 'horn'] },
  moss: { hold: ['mossy', 'mossy', 'round', 'pocket', 'sloper'], jug: ['bucket', 'horn'] },
  // Stone shells and coral heads; glass and lumps of meteoric iron.
  reef: { hold: ['shell', 'coralhead', 'pocket', 'shell', 'sloper'], jug: ['bucket', 'shell_jug'] },
  starfall: { hold: ['glass', 'iron', 'crimp', 'iron', 'glass'], jug: ['iron_jug', 'glass_jug'] },
};
export const SHAPED_BIOMES_SKIP = ['hive', 'clockwork', 'bones', 'monastery'];
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
      // An uneven lump with a slot worn into it: a dark gap under the lit
      // top edge, wider than tall, with a rounded lip below it.
      poly(g, [[3, 9], [4, 5], [8, 3], [14, 3], [17, 6], [16, 10], [11, 11], [6, 11]], body);
      shade(g, body, light, dark);
      for (let x = 7; x <= 14; x++) {
        const deep = x > 8 && x < 13;
        g.set(x, 6, OUT);
        if (deep) g.set(x, 7, darken(base, 0.25));
        g.set(x, deep ? 8 : 7, lerpColor(light, body, 0.35));
      }
      g.set(6, 6, darken(base, 0.4)); g.set(15, 6, darken(base, 0.4));
      chalk([[9, 9], [10, 9], [12, 10]]);
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
    case 'shell': case 'shell_jug': {
      // An ammonite standing out of the rock: a ribbed coil, lit on top,
      // the dark eye of the spiral where your fingers go.
      const big = shape === 'shell_jug' ? 1 : 0;
      const sc = lerpColor(biome.accentC, biome.rock[3], 0.35), sl = 0xfffaf0, sd = darken(sc, 0.55);
      g.ellipse(10, 7, 6 + big, 5 + big, sc);
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
        if (g.get(x, y) !== sc) continue;
        const dx = x - 10, dy = y - 7, a = Math.atan2(dy, dx), r = Math.hypot(dx, dy);
        const u = (Math.log(Math.max(0.7, r) / 0.6) / 0.42 - a) / (Math.PI * 2);
        const f = u - Math.floor(u);
        let c = f < 0.18 ? sd : Math.sin(a * 9) > 0.5 ? lerpColor(sc, 0xffffff, 0.25) : sc;
        if (dy < -3) c = lerpColor(c, sl, 0.45);
        if (dy > 3) c = lerpColor(c, sd, 0.5);
        g.set(x, y, c);
      }
      g.set(10, 7, OUT); g.set(11, 7, sd);
      for (let x = 5; x < 16; x++) if (g.get(x, 13 - (big ? 0 : 1)) === null && g.get(x, 12 - (big ? 0 : 1)) !== null) g.set(x, 13 - (big ? 0 : 1), darken(base, 0.4));
      chalk([[8, 3 - big], [12, 3 - big]]);
      break;
    }
    case 'coralhead': {
      // A brain coral dome: winding grooves, coral pink, lit on top.
      const cc = lerpColor(biome.accentA, biome.rock[4], 0.25), cl = lighten(cc, 0.4), cd = darken(cc, 0.6);
      g.ellipse(10, 8, 7.5, 4.6, cc);
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
        if (g.get(x, y) !== cc) continue;
        const gr = Math.sin(x * 1.1 + Math.sin(y * 1.3) * 1.8 + y * 0.4);
        let c = gr > 0.4 ? cl : gr < -0.55 ? cd : cc;
        if (y > 10) c = lerpColor(c, cd, 0.5);
        g.set(x, y, c);
      }
      shade(g, cc, cl, cd);
      chalk([[9, 4], [11, 4]]);
      break;
    }
    case 'iron': case 'iron_jug': {
      // A lump of meteoric iron: pitted like a thumbprint, the crossed
      // lattice showing on its cut face, rust in the pits, a gold gleam.
      const big = shape === 'iron_jug' ? 1 : 0;
      const ir = 0x6a7088, il = 0xc8d0e4, id = 0x24283a;
      poly(g, [[2, 9], [4, 5 - big], [8, 3 - big], [13, 3 - big], [17, 5], [18, 9], [14, 11], [6, 11]], ir);
      shade(g, ir, il, id);
      for (const [x, y] of [[6, 7], [9, 6], [12, 8], [14, 6], [8, 9]]) { g.set(x, y, 0x3a2a24); g.set(x + 1, y, 0x8a5a34); }
      for (let x = 9; x < 15; x++) if ((x % 3) === 0) g.set(x, 4 - big, 0xfff2c8);
      if (big) for (let x = 6; x <= 13; x++) { g.set(x, 6, OUT); g.set(x, 7, id); }
      g.set(11, 4 - big, 0xffffff);
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
      // A deep jug: a thick rounded lip with the dark hollow tucked under its
      // top edge, so it reads as a handle you can wrap your fingers into.
      g.ellipse(10, 7.5, 8, 4.8, body);
      shade(g, body, light, dark);
      for (let x = 5; x <= 15; x++) {
        const edge = x === 5 || x === 15;
        g.set(x, 5, OUT);
        if (!edge) g.set(x, 6, darken(base, 0.3));
        if (x > 6 && x < 14) g.set(x, 7, darken(base, 0.55));
      }
      for (let x = 6; x <= 14; x++) g.set(x, 8, light);
      chalk([[8, 10], [10, 10], [12, 9]]);
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
