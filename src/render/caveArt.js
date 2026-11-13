// Hidden caves (idea sheet 1.4): the mouth in the rock at the end of a
// traverse, and the room you step into, lit by your headlamp from the
// entrance. Both take the colours of the biome they are in. The room holds
// one find: a cache of the biome's gems, a dragon's skull set in the back
// wall, a journal page pinned to a crate, or a creature asleep (its own
// two-frame sprite, so it can breathe).
import { PixelGrid, makeCanvas } from '../utils/pixelGrid.js';
import { lerpColor, bayer, rgb } from '../utils/color.js';
import { SeededRandom, makeNoise2D } from '../utils/seededRandom.js';
import { shade, makeRamp, poly, stroke } from './pixelKit.js';
import { gemForBiome } from '../data/gems.js';

export const ROOM_W = 300, ROOM_H = 168;
const ICY = ['frozen', 'aurora', 'crystal'];
const GREEN = ['green', 'cascade', 'moss', 'stone'];
const HOT = ['obsidian', 'dragon', 'bones', 'volcano'];

function addCanvas(scene, key, c) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, c);
}

// ---------------------------------------------------------------- the mouth
export function caveMouthKey(scene, biome) {
  const key = `cave_mouth_${biome.id}`;
  if (scene.textures.exists(key)) return key;
  const g = new PixelGrid(30, 26);
  const R = biome.rock;
  // The rim: a rough arch of lit rock.
  for (let y = 0; y < 26; y++) for (let x = 0; x < 30; x++) {
    const dx = (x - 15) / 14, dy = (y - 20) / 18;
    const d = dx * dx + dy * dy * (y < 20 ? 1 : 3);
    if (d > 1.05 + ((x * 7 + y * 3) % 5) * 0.03) continue;
    g.set(x, y, d > 0.62 ? (x < 15 ? R[3] : R[1]) : null);
  }
  // The dark inside: deepest at the back.
  for (let y = 4; y < 26; y++) for (let x = 3; x < 27; x++) {
    const dx = (x - 15) / 10.5, dy = (y - 21) / 15;
    if (dx * dx + dy * dy > 0.62 * 1.6) continue;
    const k = Math.sqrt(dx * dx + dy * dy);
    g.set(x, y, k < 0.5 ? 0x050408 : bayer(x, y) < (k - 0.5) * 2 ? lerpColor(R[0], 0x050408, 0.4) : 0x0a0810);
  }
  // Teeth of rock hanging into the opening, and a lip of the biome's colour.
  for (const [x, len] of [[8, 3], [12, 5], [17, 4], [21, 3]]) for (let k = 0; k < len; k++) g.set(x, 5 + k, R[1]);
  const lip = ICY.includes(biome.id) ? 0xeef6ff : GREEN.includes(biome.id) ? biome.accentB : HOT.includes(biome.id) ? biome.accentC : biome.accentA;
  for (let x = 4; x < 27; x++) if ((x * 5) % 3) g.set(x, Math.round(4 - Math.sin((x - 4) / 22 * Math.PI) * 3), lip);
  g.outline(biome.outline);
  const c = makeCanvas(g.w, g.h);
  g.drawTo(c.getContext('2d'));
  addCanvas(scene, key, c);
  return key;
}

// ---------------------------------------------------------------- the room
// side: which side the entrance (and the light) is on (-1 left, 1 right).
export function caveRoomKey(scene, biome, kind, side) {
  const key = `cave_room_${biome.id}_${kind}_${side}`;
  if (scene.textures.exists(key)) return key;
  const W = ROOM_W, H = ROOM_H;
  const noise = makeNoise2D(311 + biome.id.length * 7);
  const rng = new SeededRandom(17 + biome.id.length * 13 + kind.length);
  const px = new Array(W * H).fill(0x050408);
  const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) px[y * W + x] = c; };
  const get = (x, y) => px[Math.round(y) * W + Math.round(x)];
  const R = biome.rock;
  const ramp = [0x07060a, lerpColor(R[0], 0x000000, 0.4), R[0], R[1], R[2], R[3], R[4]];
  const lx = side < 0 ? 28 : W - 28, ly = 64;
  // The headlamp's pool of light from the entrance: bright near it, the far
  // end of the room falling away into the dark.
  const light = (x, y) => Math.pow(Math.max(0, 1 - Math.hypot((x - lx) * 0.75, (y - ly) * 1.15) / 250), 1.5);
  const floorY = (x) => 128 + Math.round(Math.sin(x * 0.05) * 3 + (noise(x * 0.04, 3) - 0.5) * 10);
  // The chamber: a rough oval of stacked, faceted stones. Each stone is lit
  // on the side that faces the lamp and falls into shade on the other, with
  // dark seams between them; the whole room dims away from the entrance.
  const CW = 44, CH = 30;
  const seed = (i, j) => {
    const h = Math.imul(i * 73856093 ^ j * 19349663, 2654435761) >>> 0;
    return [i * CW + (h % 1000) / 1000 * CW * 0.8, j * CH + ((h >>> 10) % 1000) / 1000 * CH * 0.8, (h >>> 20) % 1000 / 1000];
  };
  const ldx = side < 0 ? -0.8 : 0.8, ldy = -0.6;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x - W / 2) / (W * 0.5), dy = (y - 96) / 96;
    const rough = (noise(x * 0.05, y * 0.05) - 0.5) * 0.25;
    if (dx * dx + dy * dy > 1 + rough) continue;
    let c;
    if (y >= floorY(x)) {
      // The floor: dust, a few pebbles catching the light, darker away from it.
      const fk = Math.max(0, Math.min(0.999, light(x, y) * 1.15 + 0.04 + (noise(x * 0.2, y * 0.4) - 0.5) * 0.12));
      c = ramp[Math.min(ramp.length - 1, Math.floor(fk * (ramp.length - 1) + (bayer(x, y) - 0.5) * 0.7))];
      if (y === floorY(x)) c = lerpColor(c, R[4], 0.35 * light(x, y) + 0.05);
      const ph = Math.imul(x * 2654435761 ^ y * 40503, 97) >>> 0;
      if (ph % 61 === 0) { c = lerpColor(R[3], R[4], light(x, y)); }
    } else {
      // Which stone is this pixel on, and how far is it from the seam?
      const ci = Math.floor(x / CW), cj = Math.floor(y / CH);
      let d1 = 1e9, d2 = 1e9, best = null;
      for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
        const p = seed(i, j);
        // Warped, so the stones come out lumpy rather than as tiles.
        const wx = x + (noise(x * 0.04, y * 0.04) - 0.5) * 26, wy = y + (noise(x * 0.04 + 9, y * 0.04) - 0.5) * 18;
        const d = Math.hypot((wx - p[0]) * 0.75, wy - p[1]);
        if (d < d1) { d2 = d1; d1 = d; best = p; } else if (d < d2) d2 = d;
      }
      const edge = d2 - d1;
      // Each stone rounded: brighter toward the lamp side of its centre.
      const round = ((x - best[0]) * ldx + (y - best[1]) * ldy) / CW;
      let k = light(x, y) * 1.5 * (0.75 + best[2] * 0.4) + round * 0.35 * (0.3 + light(x, y));
      // Cracks between the stones, broken off here and there; a lit lip
      // along the edges that face the lamp.
      const crack = noise(x * 0.06 + 3, y * 0.06) > 0.42;
      if (edge < 1.3 && crack) k = light(x, y) * 0.25;
      else if (edge < 3.5) k += (round > 0 ? 0.18 : -0.12) * Math.min(1, light(x, y) * 2.2);
      // Fine grain over everything.
      k += (noise(x * 0.35, y * 0.35) - 0.5) * 0.12;
      const f = Math.max(0, Math.min(0.999, k));
      c = ramp[Math.min(ramp.length - 1, Math.floor(f * ramp.length + (bayer(x, y) - 0.5) * 0.6))];
      // The biome's touch on the stones.
      if (GREEN.includes(biome.id) && round > 0.15 && edge > 2 && noise(x * 0.15, y * 0.15) > 0.55) c = lerpColor(c, biome.accentA, 0.35 + light(x, y) * 0.4);
      if (HOT.includes(biome.id) && edge < 1.3 && crack && noise(x * 0.08, y * 0.08) > 0.62) { c = biome.accentC; }
      if (ICY.includes(biome.id) && round > 0.25 && edge > 2 && light(x, y) > 0.2) c = lerpColor(c, biome.accentB, 0.25);
    }
    set(x, y, c);
  }
  // Stalactites and stalagmites, lit on the side toward the entrance.
  for (let i = 0; i < 16; i++) {
    const x = rng.int(20, W - 20), top = rng.chance(0.6);
    const len = rng.int(8, 30), w = rng.range(2, 5);
    const y0 = top ? 26 + Math.abs(x - W / 2) * 0.18 : floorY(x);
    for (let k = 0; k < len; k++) {
      const ww = w * (1 - k / len);
      const y = top ? y0 + k : y0 - k;
      for (let dx = -ww; dx <= ww; dx++) {
        if (get(x + dx, y) === 0x050408) continue;
        const lit = dx * side < 0 ? 1 : 0;
        set(x + dx, y, lerpColor(R[1 + lit * 2], 0x000000, 1 - light(x, y) * 1.2 > 0 ? Math.max(0, 0.6 - light(x, y)) : 0));
      }
    }
  }
  // The biome's touch: ice crystals, hanging roots, honey drips, or glints.
  for (let i = 0; i < 14; i++) {
    const x = rng.int(16, W - 16);
    if (ICY.includes(biome.id)) {
      // A cluster of crystals on the floor, leaning.
      const fy0 = floorY(x);
      for (let k = 0; k < 3; k++) {
        const len = rng.int(5, 12), lean = rng.range(-0.4, 0.4), bx = x + k * 3;
        for (let t = 0; t < len; t++) { set(bx + t * lean, fy0 - t, t > len - 2 ? 0xffffff : t % 2 ? biome.accentA : biome.accentB); set(bx + 1 + t * lean, fy0 - t, biome.accentC); }
      }
    } else if (GREEN.includes(biome.id)) {
      // Roots hanging from the ceiling, a leaf here and there.
      const y0 = 24 + Math.abs(x - W / 2) * 0.18, len = rng.int(10, 34);
      for (let t = 0; t < len; t++) { set(x + Math.sin(t * 0.3 + i) * 1.2, y0 + t, t % 5 === 4 ? biome.accentB : 0x3a2a1a); }
    } else if (biome.id === 'hive') {
      const y0 = 26 + rng.int(0, 20);
      for (let t = 0; t < rng.int(4, 12); t++) set(x, y0 + t, t > 6 ? biome.accentB : biome.accentA);
    } else {
      const y0 = rng.int(30, 120);
      if (get(x, y0) !== 0x050408) { set(x, y0, biome.accentB); set(x + 1, y0 - 1, 0xffffff); }
    }
  }
  const glow = new Array(W * H).fill(null);
  const gset = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) glow[y * W + x] = c; };
  const cx = W / 2, fy = floorY(W / 2);
  if (kind === 'cache') {
    // An old clay pot tipped on its side, a crack down it, gems spilling out
    // of its mouth across the floor, a few still glinting inside.
    const gem = gemForBiome(biome.id);
    const pg = new PixelGrid(48, 30);
    poly(pg, [[4, 8], [14, 2], [32, 2], [40, 8], [40, 22], [32, 28], [14, 28], [4, 22]], 1);
    pg.ellipse(43, 15, 4, 8, 1); pg.ellipse(44, 15, 2.5, 6, 2);
    stroke(pg, [16, 3], [22, -2], [28, 3], 2, 2, 1);
    shade(pg, 1, [0x3a1e10, 0x6a3a20, 0x9a5a32, 0xc88a52, 0xe8b07a], { r: 4, base: 0.5, depth: 0.55, light: side < 0 ? [-0.8, -0.5] : [0.8, -0.5], bias: (x, y) => (y === 9 || y === 20 ? -0.25 : 0) });
    shade(pg, 2, [0x0a0604, 0x1a0e08], { r: 1, base: 0.3 });
    pg.line(20, 4, 24, 26, 0x2a140a);
    pg.outline(0x120806);
    const px0 = Math.round(cx - 30), py0 = fy - 28;
    for (let y = 0; y < pg.h; y++) for (let x = 0; x < pg.w; x++) { const c = pg.get(x, y); if (c !== null) set(px0 + x, py0 + y, lerpColor(c, 0x050408, Math.max(0, 0.45 - light(px0 + x, py0 + y) * 1.3))); }
    for (let i = 0; i < 26; i++) {
      const gx = cx + 16 + rng.range(0, 38) + (i < 5 ? -6 : 0), gy = fy - rng.range(0, 6) - (i < 5 ? 12 : 0);
      const s2 = rng.chance(0.3) ? 2 : 1;
      for (let k = -s2; k <= s2; k++) for (let j = -s2 + Math.abs(k); j <= s2 - Math.abs(k); j++) set(gx + k, gy + j, k < 0 || j < 0 ? lerpColor(gem.color, 0xffffff, 0.35) : gem.color);
      set(gx, gy + s2 + 1, lerpColor(gem.color, 0x000000, 0.5));
      set(gx - 1, gy - 1, 0xffffff);
      gset(gx, gy, gem.color); gset(gx - 1, gy - 1, 0xffffff);
    }
  } else if (kind === 'fossil') {
    // A dragon's skull set in the back wall: a long wedge of a snout full of
    // teeth, a heavy brow, an empty socket with an ember of a stone in it,
    // swept horns, the jaw dropped a little; the first bones of the neck
    // trailing away into the rock.
    const sg = new PixelGrid(104, 60);
    const BONE = 1, DARK = 2, TOOTH = 3, HORN = 4;
    sg.ellipse(72, 28, 20, 15, BONE);
    poly(sg, [[58, 15], [10, 25], [5, 30], [9, 35], [60, 39]], BONE);
    poly(sg, [[50, 13], [82, 11], [84, 17], [56, 19]], BONE);
    poly(sg, [[12, 38], [60, 41], [68, 48], [16, 45]], BONE);
    stroke(sg, [80, 15], [100, 8], [94, 1], 7, 1, HORN);
    stroke(sg, [86, 26], [102, 27], [98, 37], 5, 1, HORN);
    sg.ellipse(64, 24, 7, 5.5, DARK);
    sg.ellipse(13, 28, 2.2, 1.6, DARK);
    sg.ellipse(83, 32, 4, 3, DARK);
    poly(sg, [[60, 39], [68, 39], [66, 42]], DARK);
    for (let x = 13; x <= 56; x += 4) { sg.set(x, 36, TOOTH); sg.set(x, 37, TOOTH); if (x % 8 === 1) sg.set(x, 38, TOOTH); sg.set(x + 2, 40, TOOTH); sg.set(x + 2, 39, TOOTH); }
    const L = side < 0 ? [-0.75, -0.6] : [0.75, -0.6];
    shade(sg, BONE, [0x4a3e32, 0x7a6a56, 0xa89878, 0xd8ccb0, 0xfff2d8], { r: 3, base: 0.5, depth: 0.55, light: L, bias: (x, y) => ((x * 3 + y * 7) % 13 === 0 ? -0.15 : 0) });
    shade(sg, HORN, [0x5a4a3a, 0x9a8a70, 0xe0d4b8], { r: 2, base: 0.55, light: L });
    shade(sg, TOOTH, [0xd8ccb0, 0xfff8e8], { r: 1, base: 0.7 });
    shade(sg, DARK, [0x060406, 0x120c0a], { r: 1, base: 0.3 });
    sg.outline(0x1a1410);
    const ox = Math.round(cx - 52 + 6), oy = 44;
    for (let y = 0; y < sg.h; y++) for (let x = 0; x < sg.w; x++) {
      const c = sg.get(x, y);
      if (c === null) continue;
      // The far side of the skull sinks into the rock's shadow.
      set(ox + x, oy + y, lerpColor(c, 0x050408, Math.max(0, 0.55 - light(ox + x, oy + y) * 1.4)));
    }
    gset(ox + 64, oy + 24, 0xff7a3a); gset(ox + 63, oy + 24, 0xffb060); gset(ox + 64, oy + 25, 0xff5a2a);
    // The neck: vertebrae trailing back into the wall.
    for (let i = 0; i < 5; i++) {
      const vx = ox + 100 + i * 9, vy = oy + 40 + i * 4;
      for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) if (x * x + y * y <= 13) set(vx + x, vy + y, lerpColor(x * side + y < 0 ? 0xd8ccb0 : 0x8a7a64, 0x050408, Math.max(0, 0.5 - light(vx, vy) * 1.3)));
      set(vx, vy - 6, 0xa89878); set(vx, vy - 5, 0x8a7a64);
    }
  } else if (kind === 'page') {
    // A crate, a journal page pinned to it by an ice axe, a candle stub.
    for (let y = -18; y <= 0; y++) for (let x = -20; x <= 20; x++) {
      const plank = (y + 18) % 6 === 0 || Math.abs(x) === 20;
      set(cx + x, fy + y, plank ? 0x3a2414 : lerpColor(0x6a4428, 0xa87448, Math.max(0, (-x * side) / 40 + 0.4)));
    }
    for (let y = -16; y <= -3; y++) for (let x = -9; x <= 7; x++) set(cx + x, fy + y, (y + 16) % 3 === 2 && x > -7 && x < 5 ? 0xa89878 : 0xf0e6cc);
    stroke({ set: (x, y, c) => set(x, y, c), ellipse: (x, y, rx, ry, c) => { for (let yy = -ry; yy <= ry; yy++) for (let xx = -rx; xx <= rx; xx++) if ((xx / rx) ** 2 + (yy / ry) ** 2 <= 1) set(x + xx, y + yy, c); } }, [cx - 2, fy - 18], [cx + 4, fy - 26], [cx + 14, fy - 30], 2, 2, 0x5a3a20);
    for (let k = 0; k < 8; k++) set(cx + 10 + k, fy - 31 + Math.abs(k - 3) * 0.5, 0xb8bcc8);
    const kx = cx + side * 30;
    for (let y = -7; y <= 0; y++) for (let x = -2; x <= 2; x++) set(kx + x, fy + y, x < 0 ? 0xf4ead8 : 0xd8ccb0);
    set(kx, fy - 9, 0xffd060); set(kx, fy - 10, 0xfff4c0); set(kx, fy - 8, 0xff9a3c);
    gset(kx, fy - 9, 0xffd060); gset(kx, fy - 10, 0xffffff);
  }
  const toCanvas = (arr) => {
    const c = makeCanvas(W, H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(W, H);
    arr.forEach((col, i) => {
      if (col == null) return;
      const [r, g, b] = rgb(col);
      img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
    });
    ctx.putImageData(img, 0, 0);
    return c;
  };
  addCanvas(scene, key, toCanvas(px));
  addCanvas(scene, `${key}_glow`, toCanvas(glow));
  return key;
}

// ---------------------------------------------------------------- the sleeper
// A small creature curled up asleep, its tail wrapped round its nose. Colours
// by biome; frame 1 is a breath in.
const CREATURES = {
  frozen: { name: 'SNOW FOX', fur: [0x9ab0c8, 0xd8e4f0, 0xffffff], belly: 0xffffff },
  aurora: { name: 'SNOW FOX', fur: [0x9ab0c8, 0xd8e4f0, 0xffffff], belly: 0xffffff },
  crystal: { name: 'GLASS FOX', fur: [0x6aa8b8, 0xb8f0f4, 0xf0ffff], belly: 0xffc8f0 },
  green: { name: 'MARMOT', fur: [0x5a3a20, 0x8a6038, 0xb88a58], belly: 0xd8b888 },
  stone: { name: 'MARMOT', fur: [0x5a3a20, 0x8a6038, 0xb88a58], belly: 0xd8b888 },
  hive: { name: 'HONEY BADGER', fur: [0x2a1a0c, 0x4a3018, 0xd8b048], belly: 0xf0d890 },
  obsidian: { name: 'CAVE CAT', fur: [0x14101c, 0x2a2436, 0x4a4060], belly: 0x6a5a80 },
  dragon: { name: 'DRAGON WHELP', fur: [0x3a0c10, 0x6a1c1e, 0xb8442e], belly: 0xe0a060 },
  bones: { name: 'ASH FOX', fur: [0x3a3634, 0x6a625c, 0x9a928a], belly: 0xc8c0b8 },
  cascade: { name: 'OTTER', fur: [0x2a1a10, 0x5a3a24, 0x8a6040], belly: 0xc8a888 },
  moss: { name: 'MOSS DEER', fur: [0x3a4a20, 0x6a7a34, 0x9aaa5a], belly: 0xd8e0a8 },
  reef: { name: 'SHORE FOX', fur: [0x6a3a2a, 0xb06a4a, 0xe0a07a], belly: 0xfff0e0 },
  starfall: { name: 'STAR HARE', fur: [0x2a2a4a, 0x4a4a7a, 0x8a8ac0], belly: 0xe8e8ff },
  monastery: { name: 'TEMPLE CAT', fur: [0x6a4a2a, 0xc89a58, 0xf0d098], belly: 0xfff0d8 },
};
export const creatureFor = (biomeId) => CREATURES[biomeId] || { name: 'FOX', fur: [0x8a3a10, 0xd86a20, 0xf0a050], belly: 0xfff0e0 };

export function creatureKey(scene, biomeId) {
  const key = `cave_creature_${biomeId}`;
  if (scene.textures.exists(key)) return key;
  const cr = creatureFor(biomeId);
  const frame = (f) => {
    const g = new PixelGrid(34, 20);
    const BODY = 1, TAIL = 2, BELLY = 3, EAR = 4;
    g.ellipse(17, 13 - f * 0.5, 13, 6 + f * 0.6, BODY);
    g.ellipse(25, 11, 6, 5, BODY);
    poly(g, [[22, 7], [24, 2], [26, 7]], EAR); poly(g, [[27, 7], [30, 3], [30, 8]], EAR);
    stroke(g, [5, 15], [2, 8], [14, 6], 6, 3, TAIL);
    stroke(g, [14, 6], [22, 5], [28, 13], 3, 2, TAIL);
    g.ellipse(14, 16, 7, 2, BELLY);
    shade(g, BODY, makeRamp(cr.fur[0], cr.fur[1], cr.fur[2], 5), { r: 3, base: 0.55 });
    shade(g, TAIL, makeRamp(cr.fur[0], cr.fur[1], cr.fur[2], 5), { r: 2, base: 0.62 });
    shade(g, BELLY, [lerpColor(cr.belly, 0x000000, 0.25), cr.belly], { r: 1, base: 0.6 });
    shade(g, EAR, [cr.fur[0], cr.fur[1]], { r: 1, base: 0.5 });
    g.line(24, 11, 27, 11, 0x1a1210);
    g.set(30, 12, 0x2a1a14);
    g.outline(0x0a0806);
    return g;
  };
  const frames = [frame(0), frame(1)];
  const c = makeCanvas(34 * 2, 20);
  frames.forEach((g, i) => g.drawTo(c.getContext('2d'), i * 34, 0));
  const tex = scene.textures.addCanvas(key, c);
  frames.forEach((g, i) => tex.add(i, 0, i * 34, 0, 34, 20));
  return key;
}
