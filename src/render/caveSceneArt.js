// The hidden cave, full screen (scenes/CaveScene.js): three layers painted
// for the screen size, in the colours of the biome the cave is in.
//   room   the chamber: walls of lumpy stone lit from the mouth, the mouth
//          itself opening onto the biome's sky and a far ridge, a floor that
//          catches the light, a puddle, stalactites and stalagmites, and the
//          find (a pot of gems, a dragon's skull in the back wall, a crate
//          with a page pinned to it; a sleeper is its own sprite)
//   front  near-black rock framing the view: teeth along the ceiling, boulders
//          in the corners, a column on the far side (it sways a little)
//   glow   added light: the pool from the mouth, glints on the find
import { PixelGrid, makeCanvas } from '../utils/pixelGrid.js';
import { lerpColor, bayer, rgb } from '../utils/color.js';
import { SeededRandom, makeNoise2D } from '../utils/seededRandom.js';
import { shade, poly, stroke } from './pixelKit.js';
import { gemForBiome } from '../data/gems.js';

const ICY = ['frozen', 'aurora', 'crystal'];
const GREEN = ['green', 'cascade', 'moss', 'stone'];
const HOT = ['obsidian', 'dragon', 'bones', 'volcano'];
const VOID = 0x050408;

function canvasOf(W, H, px, alpha = null) {
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let i = 0; i < px.length; i++) {
    if (px[i] == null) continue;
    const [r, g, b] = rgb(px[i]);
    img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = alpha ? Math.round(alpha[i] * 255) : 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Where things are, for the scene to put its life in the right places.
export function caveLayout(W, H, side) {
  const mx = side < 0 ? Math.round(W * 0.13) : Math.round(W * 0.87);
  const floor = Math.round(H * 0.76);
  // The mouth sits on the floor: you stand in it with the sky behind you.
  const ry = Math.round(H * 0.2);
  const my = floor - Math.round(ry * 0.78);
  const findX = Math.round(W / 2 - side * W * 0.04);
  return {
    mouth: { x: mx, y: my, rx: Math.max(24, Math.round(W * 0.085)), ry },
    floor, find: { x: findX, y: floor }, skull: { x: findX, y: Math.round(H * 0.36) },
    puddle: { x: Math.round(findX - side * W * 0.16), y: floor + Math.round(H * 0.1), rx: Math.round(W * 0.08), ry: 4 },
    drips: [0.3, 0.52, 0.71].map((u) => ({ x: Math.round(W * (side < 0 ? u : 1 - u)), y: Math.round(H * 0.17 + u * 8) })),
  };
}

export function paintCave(scene, { W, H, biome, kind, side }) {
  const key = `cavescene_${biome.id}_${kind}_${side}_${W}x${H}`;
  if (scene.textures.exists(key)) return key;
  const lay = caveLayout(W, H, side);
  const { mouth: M, floor } = lay;
  const noise = makeNoise2D(91 + biome.id.length * 11);
  const rng = new SeededRandom(7 + biome.id.length * 31 + kind.length);
  const R = biome.rock;
  const ramp = [VOID, lerpColor(R[0], 0x000000, 0.45), R[0], R[1], R[2], R[3], R[4]];
  const sky = (biome.backdrop && biome.backdrop.sky) || { top: 0x5a8cd0, bottom: 0xcfe4f0 };
  const px = new Array(W * H).fill(VOID);
  const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) px[y * W + x] = c; };
  const get = (x, y) => px[Math.round(y) * W + Math.round(x)];
  const light = (x, y) => Math.pow(Math.max(0, 1 - Math.hypot((x - M.x) * 0.72, (y - M.y) * 1.15) / (W * 0.72)), 1.7);
  const inMouth = (x, y) => {
    const dx = (x - M.x) / M.rx, dy = (y - M.y) / M.ry;
    return dx * dx + dy * dy * (dy > 0 ? 1.6 : 1) <= 1 + (noise(x * 0.12, y * 0.12) - 0.5) * 0.35;
  };
  const floorY = (x) => floor + Math.round(Math.sin(x * 0.03) * 2 + (noise(x * 0.03, 5) - 0.5) * 8);
  // ---- walls: lumpy stones, each lit on its side toward the mouth.
  const CW = Math.round(W / 14), CH = Math.round(H / 10);
  const seedPt = (i, j) => {
    const h = Math.imul(i * 73856093 ^ j * 19349663, 2654435761) >>> 0;
    return [i * CW + ((h % 1000) / 1000) * CW * 0.8, j * CH + (((h >>> 10) % 1000) / 1000) * CH * 0.8, ((h >>> 20) % 1000) / 1000];
  };
  const ldx = side < 0 ? -0.8 : 0.8, ldy = -0.55;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let c;
    if (y >= floorY(x)) {
      // The floor: dust and grit, lighter toward the mouth, lines of grit
      // running toward it like a path worn in.
      const l = light(x, y);
      let k = l * 1.2 + 0.03 + (noise(x * 0.25, y * 0.5) - 0.5) * 0.14;
      const toward = Math.abs(((y - floorY(x)) * (x - M.x) / (W * 0.5)) % 6);
      if (toward < 0.5) k += 0.05 * l * 3;
      c = ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(k * (ramp.length - 1) + (bayer(x, y) - 0.5) * 0.7)))];
      if (y === floorY(x)) c = lerpColor(c, R[4], 0.4 * l + 0.05);
      const ph = Math.imul(x * 2654435761 ^ y * 40503, 97) >>> 0;
      if (ph % 53 === 0) c = lerpColor(R[3], R[4], l);
    } else {
      const wx = x + (noise(x * 0.03, y * 0.03) - 0.5) * CW * 0.6, wy = y + (noise(x * 0.03 + 9, y * 0.03) - 0.5) * CH * 0.6;
      const ci = Math.floor(wx / CW), cj = Math.floor(wy / CH);
      let d1 = 1e9, d2 = 1e9, best = null;
      for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
        const p = seedPt(i, j);
        const d = Math.hypot((wx - p[0]) * 0.78, wy - p[1]);
        if (d < d1) { d2 = d1; d1 = d; best = p; } else if (d < d2) d2 = d;
      }
      const edge = d2 - d1, l = light(x, y);
      const round = ((wx - best[0]) * ldx + (wy - best[1]) * ldy) / CW;
      let k = l * 1.3 * (0.65 + best[2] * 0.5) + round * 0.45 * (0.2 + l) + 0.04;
      // Bedding in the rock: faint bands that lean down toward the mouth.
      if (((y + Math.round((x - M.x) * 0.12 * side) + Math.round(noise(x * 0.02, 4) * 12)) % 23) === 0) k -= 0.14;
      const crack = noise(x * 0.05 + 3, y * 0.05) > 0.4;
      if (edge < 1.4 && crack) k = l * 0.22;
      else if (edge < 3.5) k += (round > 0 ? 0.2 : -0.12) * Math.min(1, l * 2.4);
      k += (noise(x * 0.4, y * 0.4) - 0.5) * 0.1;
      c = ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(k * ramp.length + (bayer(x, y) - 0.5) * 0.6)))];
      if (GREEN.includes(biome.id) && round > 0.15 && edge > 2 && noise(x * 0.12, y * 0.12) > 0.55) c = lerpColor(c, biome.accentA, 0.3 + l * 0.5);
      if (HOT.includes(biome.id) && edge < 1.4 && crack && noise(x * 0.07, y * 0.07) > 0.6) c = biome.accentC;
      if (ICY.includes(biome.id) && round > 0.25 && edge > 2 && l > 0.2) c = lerpColor(c, biome.accentB, 0.28);
    }
    set(x, y, c);
  }
  // ---- the mouth: the biome's sky, a far ridge in haze, a band of cloud.
  for (let y = M.y - M.ry - 4; y <= M.y + M.ry + 4; y++) for (let x = M.x - M.rx - 4; x <= M.x + M.rx + 4; x++) {
    if (!inMouth(x, y)) continue;
    const t = (y - (M.y - M.ry)) / (M.ry * 2);
    let c = lerpColor(sky.top, sky.bottom, Math.max(0, Math.min(1, t * 1.2)));
    const ridge = M.y + M.ry * 0.25 + Math.sin(x * 0.18) * 4 + (noise(x * 0.08, 2) - 0.5) * 14;
    if (y > ridge) c = lerpColor(lerpColor(R[2], sky.bottom, 0.55), sky.top, 0.15);
    const cloud = M.y + M.ry * 0.55 + Math.sin(x * 0.11 + 1) * 3;
    if (y > cloud) c = lerpColor(0xffffff, sky.bottom, 0.25 + (bayer(x, y) < 0.3 ? 0.1 : 0));
    set(x, y, c);
  }
  // The rim of the mouth: lit stone, a fringe of the biome (snow, moss, ash).
  const fringe = ICY.includes(biome.id) ? 0xeef6ff : GREEN.includes(biome.id) ? biome.accentB : HOT.includes(biome.id) ? 0x6a5a5a : biome.accentA;
  for (let y = M.y - M.ry - 8; y <= M.y + M.ry + 8; y++) for (let x = M.x - M.rx - 8; x <= M.x + M.rx + 8; x++) {
    if (inMouth(x, y)) continue;
    let near = false;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0]]) if (inMouth(x + ox, y + oy)) near = true;
    if (!near) continue;
    set(x, y, y < M.y && (x * 3 + y) % 4 ? fringe : lerpColor(R[3], 0xffffff, 0.25));
  }
  for (let k = 0; k < 9; k++) {
    const x = M.x - M.rx + 6 + rng.int(0, M.rx * 2 - 12), y0 = M.y - M.ry + Math.round(Math.abs(x - M.x) / M.rx * M.ry * 0.6), len = rng.int(3, 10);
    for (let t = 0; t < len; t++) set(x, y0 + t, t === len - 1 ? fringe : R[1]);
  }
  // ---- stalactites from the ceiling, stalagmites from the floor, lit on one side.
  for (let i = 0; i < 22; i++) {
    const x = rng.int(8, W - 8);
    if (Math.abs(x - M.x) < M.rx + 6) continue;
    const top = rng.chance(0.6), len = rng.int(Math.round(H * 0.04), Math.round(H * 0.16)), w = rng.range(2, 6);
    const y0 = top ? Math.round(H * 0.05 + noise(x * 0.05, 1) * H * 0.05) : floorY(x);
    for (let k = 0; k < len; k++) {
      const ww = w * Math.pow(1 - k / len, 0.8), y = top ? y0 + k : y0 - k;
      for (let dx = -ww; dx <= ww; dx++) {
        const lit = dx * side < 0;
        const l = light(x, y);
        set(x + dx, y, ramp[Math.max(1, Math.min(6, Math.round(1 + l * 4 + (lit ? 1.2 : -0.3))))]);
      }
    }
    if (top && ICY.includes(biome.id)) set(x, y0 + len, 0xffffff);
  }
  // ---- the biome's touch: crystals, roots, honey.
  for (let i = 0; i < 18; i++) {
    const x = rng.int(12, W - 12);
    if (Math.abs(x - M.x) < M.rx + 8) continue;
    if (ICY.includes(biome.id)) {
      const fy0 = floorY(x);
      for (let k = 0; k < 3; k++) { const len = rng.int(5, 14), lean = rng.range(-0.4, 0.4), bx = x + k * 3; for (let t = 0; t < len; t++) { set(bx + t * lean, fy0 - t, t > len - 2 ? 0xffffff : t % 2 ? biome.accentA : biome.accentB); set(bx + 1 + t * lean, fy0 - t, biome.accentC); } }
    } else if (GREEN.includes(biome.id)) {
      const len = rng.int(14, Math.round(H * 0.3));
      for (let t = 0; t < len; t++) set(x + Math.sin(t * 0.25 + i) * 1.4, Math.round(H * 0.06) + t, t % 6 === 5 ? biome.accentB : 0x2a1e12);
    } else if (biome.id === 'hive') {
      const y0 = Math.round(H * 0.08) + rng.int(0, 20);
      for (let t = 0; t < rng.int(5, 16); t++) set(x, y0 + t, t > 8 ? biome.accentB : biome.accentA);
    }
  }
  // ---- the puddle: dark water with the mouth's light in it.
  const P = lay.puddle;
  for (let y = -P.ry; y <= P.ry; y++) for (let x = -P.rx; x <= P.rx; x++) {
    if ((x / P.rx) ** 2 + (y / P.ry) ** 2 > 1) continue;
    let c = lerpColor(VOID, sky.top, 0.12);
    if (Math.abs(x + side * P.rx * 0.3) < 4 && y < 1) c = lerpColor(sky.bottom, VOID, 0.35);
    if (y === -P.ry) c = lerpColor(R[3], sky.bottom, 0.4);
    set(P.x + x, P.y + y, c);
  }
  // ---- the find.
  const glowPx = new Array(W * H).fill(null);
  const gset = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) glowPx[y * W + x] = c; };
  const blit = (grid, ox, oy, dim = true) => {
    for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) {
      const c = grid.get(x, y);
      if (c === null) continue;
      set(ox + x, oy + y, dim ? lerpColor(c, VOID, Math.max(0, 0.45 - light(ox + x, oy + y) * 1.3)) : c);
    }
  };
  const L = side < 0 ? [-0.75, -0.6] : [0.75, -0.6];
  const F = lay.find;
  if (kind === 'cache') {
    const gem = gemForBiome(biome.id);
    const pg = new PixelGrid(56, 34);
    poly(pg, [[4, 9], [16, 2], [38, 2], [48, 9], [48, 25], [38, 32], [16, 32], [4, 25]], 1);
    pg.ellipse(side < 0 ? 52 : 3, 17, 4, 9, 1);
    pg.ellipse(side < 0 ? 53 : 2, 17, 2.5, 7, 2);
    stroke(pg, [18, 3], [26, -3], [34, 3], 2.5, 2.5, 1);
    shade(pg, 1, [0x3a1e10, 0x6a3a20, 0x9a5a32, 0xc88a52, 0xe8b07a], { r: 5, base: 0.5, depth: 0.55, light: L, bias: (x, y) => (y === 10 || y === 23 ? -0.25 : 0) });
    shade(pg, 2, [0x0a0604, 0x1a0e08], { r: 1, base: 0.3 });
    pg.line(24, 4, 28, 30, 0x2a140a);
    pg.outline(0x120806);
    blit(pg, F.x - 28, F.y - 32);
    // Gems spilling out of the mouth of the pot.
    const sx0 = side < 0 ? F.x + 26 : F.x - 26;
    for (let i = 0; i < 34; i++) {
      const gx = sx0 - side * rng.range(-4, 46), gy = F.y - rng.range(0, 8) - (i < 6 ? 14 : 0);
      const s2 = rng.chance(0.35) ? 2 : 1;
      for (let k = -s2; k <= s2; k++) for (let j = -s2 + Math.abs(k); j <= s2 - Math.abs(k); j++) set(gx + k, gy + j, k < 0 || j < 0 ? lerpColor(gem.color, 0xffffff, 0.4) : gem.color);
      set(gx, gy + s2 + 1, lerpColor(gem.color, 0x000000, 0.55));
      set(gx - 1, gy - 1, 0xffffff);
      gset(gx, gy, gem.color); gset(gx - 1, gy - 1, 0xffffff);
    }
  } else if (kind === 'fossil') {
    const S = lay.skull;
    const sg = new PixelGrid(112, 64);
    const BONE = 1, DARK = 2, TOOTH = 3, HORN = 4;
    sg.ellipse(78, 30, 22, 16, BONE);
    poly(sg, [[62, 16], [10, 27], [5, 32], [10, 38], [64, 42]], BONE);
    poly(sg, [[54, 14], [88, 12], [90, 18], [60, 21]], BONE);
    poly(sg, [[12, 41], [64, 44], [73, 52], [16, 48]], BONE);
    stroke(sg, [86, 16], [108, 8], [102, 1], 8, 1, HORN);
    stroke(sg, [92, 28], [110, 29], [106, 40], 5, 1, HORN);
    sg.ellipse(69, 26, 7.5, 6, DARK);
    sg.ellipse(13, 30, 2.4, 1.8, DARK);
    sg.ellipse(89, 35, 4.5, 3.2, DARK);
    for (let x = 14; x <= 60; x += 4) { sg.set(x, 39, TOOTH); sg.set(x, 40, TOOTH); if (x % 8 === 2) sg.set(x, 41, TOOTH); sg.set(x + 2, 43, TOOTH); sg.set(x + 2, 42, TOOTH); }
    shade(sg, BONE, [0x4a3e32, 0x7a6a56, 0xa89878, 0xd8ccb0, 0xfff2d8], { r: 3, base: 0.5, depth: 0.55, light: L, bias: (x, y) => ((x * 3 + y * 7) % 13 === 0 ? -0.15 : 0) });
    shade(sg, HORN, [0x5a4a3a, 0x9a8a70, 0xe0d4b8], { r: 2, base: 0.55, light: L });
    shade(sg, TOOTH, [0xd8ccb0, 0xfff8e8], { r: 1, base: 0.7 });
    shade(sg, DARK, [0x060406, 0x120c0a], { r: 1, base: 0.3 });
    sg.outline(0x1a1410);
    // Facing away from the mouth, so the light rakes along the snout.
    const flip = side > 0;
    const grid = flip ? (() => { const f = new PixelGrid(sg.w, sg.h); for (let y = 0; y < sg.h; y++) for (let x = 0; x < sg.w; x++) f.set(sg.w - 1 - x, y, sg.get(x, y)); return f; })() : sg;
    blit(grid, S.x - 56, S.y - 32);
    // Vertebrae trailing into the wall.
    for (let i = 0; i < 6; i++) {
      const vx = S.x + (flip ? -1 : 1) * (60 + i * 10), vy = S.y + 14 + i * 5;
      for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) if (x * x + y * y <= 14) set(vx + x, vy + y, lerpColor(x * side + y < 0 ? 0xd8ccb0 : 0x8a7a64, VOID, Math.max(0, 0.5 - light(vx, vy) * 1.3)));
    }
  } else if (kind === 'page') {
    // A crate, a page pinned to it by an ice axe; a candle stub beside it.
    const cg = new PixelGrid(50, 30);
    cg.rect(0, 2, 50, 28, 1);
    for (let y = 2; y < 30; y += 7) cg.rect(0, y, 50, 1, 2);
    cg.rect(0, 2, 2, 28, 2); cg.rect(48, 2, 2, 28, 2);
    cg.rect(14, 5, 20, 18, 3);
    for (let y = 8; y < 21; y += 3) cg.rect(17, y, 14, 1, 4);
    shade(cg, 1, [0x4a2c18, 0x6a4428, 0x9a6a40, 0xc8925a], { r: 3, base: 0.5, light: L });
    shade(cg, 2, [0x2a180c, 0x3a2414], { r: 1, base: 0.4 });
    shade(cg, 3, [0xc8b890, 0xf0e6cc, 0xfffaf0], { r: 2, base: 0.6, light: L });
    shade(cg, 4, [0x8a7a64, 0xa89878], { r: 1, base: 0.5 });
    cg.outline(0x120806);
    blit(cg, F.x - 25, F.y - 30);
    stroke({ set, ellipse: (x, y, rx, ry, c) => { for (let yy = -ry; yy <= ry; yy++) for (let xx = -rx; xx <= rx; xx++) if ((xx / rx) ** 2 + (yy / ry) ** 2 <= 1) set(x + xx, y + yy, c); } }, [F.x - 2, F.y - 22], [F.x + 6, F.y - 32], [F.x + 18, F.y - 36], 2, 2, 0x5a3a20);
    for (let k = 0; k < 9; k++) set(F.x + 14 + k, F.y - 37 + Math.abs(k - 3) * 0.5, k < 3 ? 0xe8ecf4 : 0xb8bcc8);
    const kx = F.x + side * 36;
    for (let y = -9; y <= 0; y++) for (let x = -2; x <= 2; x++) set(kx + x, F.y + y, x < 0 ? 0xf4ead8 : 0xd8ccb0);
    set(kx, F.y - 10, 0x2a2018);
  }
  // ---- added light: the pool from the mouth on the floor and walls.
  const alpha = new Array(W * H).fill(0);
  const glowCol = new Array(W * H).fill(null);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (glowPx[i] != null) { glowCol[i] = glowPx[i]; alpha[i] = 1; continue; }
    const l = light(x, y);
    if (l < 0.05 || inMouth(x, y)) continue;
    glowCol[i] = lerpColor(0xffe0b0, sky.bottom, 0.4);
    alpha[i] = Math.min(0.5, l * 0.42) * (bayer(x, y) < 0.5 ? 1 : 0.85);
  }
  // ---- front: near-black rock framing the view.
  const front = new Array(W * H).fill(null);
  const frontA = new Array(W * H).fill(0);
  const fset = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) { front[y * W + x] = c; frontA[y * W + x] = 1; } };
  const rim = lerpColor(R[2], 0xffe0b0, 0.2);
  for (let x = 0; x < W; x++) {
    // The ceiling's edge with big teeth hanging down.
    const teeth = Math.max(0, Math.sin(x * 0.09 + 1.3)) ** 6 * H * 0.12 + Math.max(0, Math.sin(x * 0.23)) ** 8 * H * 0.05;
    const top = Math.round(H * 0.035 + (noise(x * 0.05, 7) - 0.5) * 10 + teeth);
    for (let y = 0; y < top; y++) fset(x, y, y === top - 1 && (x - M.x) * side < 0 ? rim : 0x040306);
    // Boulders along the bottom.
    const bot = Math.round(H * 0.94 - Math.max(0, Math.sin(x * 0.045 + 2)) ** 3 * H * 0.08 - (noise(x * 0.06, 3) - 0.5) * 8);
    for (let y = bot; y < H; y++) fset(x, y, y === bot ? rim : 0x040306);
  }
  // A column of rock on the far side, its edge catching the light.
  const colX = side < 0 ? W : 0;
  for (let y = 0; y < H; y++) {
    const w = Math.round(W * 0.06 + Math.sin(y * 0.04) * 6 + (noise(4, y * 0.05) - 0.5) * 12);
    for (let k = 0; k < w; k++) fset(side < 0 ? colX - 1 - k : k, y, k === w - 1 ? rim : 0x040306);
  }
  const roomC = canvasOf(W, H, px);
  const glowC = canvasOf(W, H, glowCol, alpha);
  const frontC = canvasOf(W, H, front, frontA);
  for (const [k, c] of [[key, roomC], [`${key}_glow`, glowC], [`${key}_front`, frontC]]) {
    if (scene.textures.exists(k)) scene.textures.remove(k);
    scene.textures.addCanvas(k, c);
  }
  return key;
}
