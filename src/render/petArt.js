// Pets (data/pets.js) as pixel art, in three sizes (baby, young, grown):
// shaped from ellipses and tapered strokes, shaded round with pixelKit, then
// detailed by hand (eyes with a glint, noses, hooves, stripes, eyespots).
// Babies have bigger heads and shorter legs; horns, beards and full wings
// come with age. Frames:
//   kid         0 stand, 1 hop, 2 bleat (head up, mouth open)
//   bee         0 wings up, 1 wings down
//   moth        0 wings open, 1 wings raised
//   dragonling  0 sit, 1 wings up, 2 puff (mouth open)
// Textures: `pet_<id>_<stage>`. Homes for the pen: `pethome_<id>`.
import { PixelGrid, makeCanvas } from '../utils/pixelGrid.js';
import { shade, stroke, poly, makeRamp, outline } from './pixelKit.js';
import { DRAGON_PAL as DP } from './dragonArt.js';

const INK = 0x2a1e26;
// Markers.
const A = 1, B = 2, C = 3, D = 4, E = 5, F = 6, G = 7;

function addFrames(scene, key, grids) {
  if (scene.textures.exists(key)) return;
  const w = Math.max(...grids.map((g) => g.w)), h = Math.max(...grids.map((g) => g.h));
  const c = makeCanvas(w * grids.length, h);
  grids.forEach((g, i) => g.drawTo(c.getContext('2d'), i * w + Math.floor((w - g.w) / 2), h - g.h));
  const tex = scene.textures.addCanvas(key, c);
  grids.forEach((g, i) => tex.add(i, 0, i * w, 0, w, h));
}

// Draws in "grown" coordinates, scaled by s around the feet (bottom left).
function canvasFor(W, H, s) {
  const g = new PixelGrid(Math.ceil(W * s) + 2, Math.ceil(H * s) + 2);
  const X = (x) => 1 + x * s, Y = (y) => g.h - 1 - (H - y) * s;
  return { g, X, Y, P: (p) => [X(p[0]), Y(p[1])] };
}

// ---------------------------------------------------------------- goat kid
const FUR = makeRamp(0x8a7c68, 0xe6dccb, 0xffffff, 6);
const FUR_D = makeRamp(0x6a5e50, 0xb4a690, 0xd8ccb8, 5);
const HORN = [0x4a3a2c, 0x7a6448, 0xa88e68, 0xd4bc94];

function kid(stage, f) {
  const s = [0.66, 0.82, 1][stage], hb = [1.3, 1.12, 1][stage];
  const { g, X, Y, P } = canvasFor(26, 23, s);
  const hop = f === 1, bleat = f === 2;
  const lift = hop ? 1.5 : 0;
  // Far legs, then body, near legs.
  const leg = (x0, y0, x1, y1, m, w = 2.2) => stroke(g, P([x0, y0 - lift]), P([(x0 + x1) / 2, (y0 + y1) / 2 - lift]), P([x1, y1 - lift]), w * s + 0.4, w * s, m);
  if (hop) { leg(13.5, 14, 16.5, 17.5, B); leg(8.5, 14, 5.5, 17.5, B); }
  else { leg(13.6, 14, 13.8, 20, B); leg(8.6, 14, 8.6, 20, B); }
  g.ellipse(X(11), Y(11.8 - lift), 7.2 * s, 4.3 * s, A);
  g.ellipse(X(15.2), Y(11.4 - lift), 3.8 * s, 3.6 * s, A);
  // Tail flicked up.
  stroke(g, P([4.4, 10.4 - lift]), P([3.6, 8.6 - lift]), P([3.8, 7.4 - lift]), 2.2 * s + 0.4, 1, A);
  if (hop) { leg(15, 14, 18, 16.5, A); leg(7, 14, 3.5, 16.5, A); }
  else { leg(15.2, 14, 15.4, 20.2, A); leg(7, 14, 6.6, 20.2, A); }
  // Neck and head (bigger on a baby), raised when it bleats.
  const hx = 18.6, hy = (bleat ? 4.6 : 6) - lift;
  stroke(g, P([15.6, 10.5 - lift]), P([16.8, 8.5 - lift]), P([hx - 0.6, hy + 2]), 4 * s, 3.2 * s, A);
  g.ellipse(X(hx), Y(hy), 3.3 * s * hb, 2.9 * s * hb, C);
  g.ellipse(X(hx + 2.6 * hb), Y(hy + 1.1), 1.9 * s * hb, 1.6 * s * hb, C);
  // Ear flopping back.
  stroke(g, P([hx - 1.4, hy - 0.6]), P([hx - 3, hy]), P([hx - 4.2, hy + 1.4]), 2 * s * hb, 1, B);
  // Horns grow with age, curling back.
  if (stage >= 1) stroke(g, P([hx - 0.4, hy - 2.4 * hb]), P([hx - 1.6, hy - 4.6]), P([hx - 3.4, hy - (stage === 2 ? 4.2 : 3.4)]), 2 * s, 1, D);
  // Shade.
  shade(g, A, FUR, { r: Math.max(2, Math.round(3 * s)), base: 0.58 });
  shade(g, B, FUR_D, { r: 2, base: 0.45 });
  shade(g, C, FUR, { r: Math.max(2, Math.round(2.6 * s)), base: 0.62 });
  shade(g, D, HORN, { r: 1, base: 0.55 });
  // Details: eye with a glint, pink nose, mouth, hooves, beard, collar and bell.
  const ex = X(hx + 0.5 * hb), ey = Y(hy - 0.4);
  g.set(ex, ey, 0x1a1418); if (stage === 0) g.set(ex, ey + 1, 0x1a1418);
  g.set(ex + 1, ey - 1, 0xffffff);
  g.set(X(hx + 4.2 * hb), Y(hy + 0.9), 0xc87a78);
  if (bleat) { g.set(X(hx + 3.6 * hb), Y(hy + 2.4), 0x6a2a2a); g.set(X(hx + 3 * hb), Y(hy + 2.4), 0x6a2a2a); }
  if (stage === 2) stroke(g, P([hx + 2.2, hy + 2.6]), P([hx + 2.4, hy + 3.6]), P([hx + 2, hy + 4.6]), 1.6, 1, 0xc8bca4);
  for (const [x, y] of hop ? [[16.5, 17.5], [5.5, 17.5], [18, 16.5], [3.5, 16.5]] : [[13.8, 20], [8.6, 20], [15.4, 20.2], [6.6, 20.2]]) g.rect(Math.round(X(x) - 1), Math.round(Y(y - lift)), 2, 1, 0x3a2e28);
  const cx = X(16.4), cy = Y(9.2 - lift);
  g.rect(Math.round(cx - 1), Math.round(cy - 1), 3, 1, 0xc8463b);
  g.set(cx + 1, cy - 2, 0xc8463b);
  g.set(cx, cy + 1, 0xf2c14e); g.set(cx, cy, 0xf8e08a);
  outline(g, INK);
  return g;
}

// ---------------------------------------------------------------- hive bee
const GOLD = makeRamp(0x8a5a10, 0xf0b028, 0xfff0a0, 5);
const FUZZ = makeRamp(0x5a3a14, 0xb8842e, 0xf0d070, 5);
const WING = [0x8ab0d0, 0xb8d4ec, 0xdcecf8, 0xffffff];

function bee(stage, f) {
  const s = [0.66, 0.82, 1][stage], hb = [1.35, 1.15, 1][stage];
  const { g, X, Y, P } = canvasFor(18, 15, s);
  // Wings behind: up and spread, or down and blurred.
  if (f === 0) { g.ellipse(X(8.6), Y(4), 3.6 * s, 2.2 * s, E); g.ellipse(X(11.2), Y(4.6), 2.6 * s, 1.8 * s, E); }
  else { g.ellipse(X(8.4), Y(6.2), 4 * s, 1.3 * s, E); g.ellipse(X(10.8), Y(6.6), 3 * s, 1.1 * s, E); }
  g.ellipse(X(6.2), Y(9), 4.8 * s, 3.8 * s, A);
  g.ellipse(X(11.2), Y(8.4), 2.9 * s, 2.8 * s, B);
  g.ellipse(X(14.2), Y(8.4), 2.2 * s * hb, 2.2 * s * hb, C);
  shade(g, A, GOLD, { r: 2, base: 0.6 });
  shade(g, B, FUZZ, { r: 2, base: 0.55, bias: (x, y) => ((x * 7 + y * 3) % 5 === 0 ? 0.15 : 0) });
  shade(g, C, makeRamp(0x14100c, 0x2e241a, 0x5a4a38, 4), { r: 2, base: 0.5 });
  shade(g, E, WING, { r: 1, base: 0.7, depth: 0.25 });
  // Stripes round the abdomen, the sting, the eye, antennae and legs.
  for (let i = 0; i < g.px.length; i++) {
    const x = i % g.w, y = Math.floor(i / g.w);
    const ax = (x - X(6.2)) / s;
    if (Math.abs(ax) < 4.6 && Math.abs((y - Y(9)) / s) < 3.9 && GOLD.includes(g.px[i]) && (Math.floor((ax + 10) / 2.2) % 2 === 0)) g.px[i] = g.px[i] === GOLD[4] || g.px[i] === GOLD[3] ? 0x3a2a1a : 0x1e140c;
  }
  g.set(X(1.2), Y(9.6), 0x1e140c);
  const ex = X(14.8), ey = Y(7.8);
  g.set(ex, ey, 0x0a0806); g.set(ex + 1, ey, 0x0a0806); g.set(ex, ey - 1, 0xffffff);
  stroke(g, P([14.6, 6.4]), P([15.6, 4.2]), P([17, 3.4]), 1, 1, 0x1e140c);
  g.set(X(17), Y(3.4), 0x3a2a1a);
  for (const x of [10, 11.6, 13]) g.set(X(x), Y(11.4), 0x1e140c);
  outline(g, INK);
  return g;
}

// ---------------------------------------------------------------- crystal moth
const WINGM = makeRamp(0x7a6a9a, 0xd8ccf0, 0xfaf6ff, 6);
const BODYM = makeRamp(0x4a3a5a, 0x9a88b0, 0xd8d0e8, 5);

function moth(stage, f) {
  const s = [0.66, 0.82, 1][stage];
  const { g, X, Y, P } = canvasFor(22, 16, s);
  const cx = 11, open = f === 0;
  // Forewings and hindwings, both sides; raised and narrower mid-flap.
  for (const d of [-1, 1]) {
    const span = open ? 9.6 : 6.4, lift = open ? 0 : -2.4;
    poly(g, [P([cx + d * 0.8, 6]), P([cx + d * span, 2.4 + lift]), P([cx + d * (span + 0.6), 6.4 + lift * 0.5]), P([cx + d * 1.2, 9])], A);
    g.ellipse(X(cx + d * (span * 0.55)), Y(10.6 + lift * 0.3), (open ? 3.8 : 2.8) * s, 2.8 * s, B);
  }
  g.ellipse(X(cx), Y(8.6), 1.5 * s, 4.6 * s, C);
  shade(g, A, WINGM, { r: 2, base: 0.6 });
  shade(g, B, WINGM, { r: 2, base: 0.48 });
  shade(g, C, BODYM, { r: 1, base: 0.55, bias: (x, y) => (y % 2 ? -0.12 : 0.06) });
  // Crystal eyespots and a dark rim on the wings.
  for (const d of [-1, 1]) {
    const span = open ? 9.6 : 6.4, lift = open ? 0 : -2.4;
    const sx = X(cx + d * span * 0.58), sy = Y(4.8 + lift * 0.6);
    g.set(sx, sy, 0x3ac8e8); g.set(sx + d, sy, 0x7ae8ff); g.set(sx, sy - 1, 0xffffff); g.set(sx - d, sy + 1, 0x2a7ab8);
    g.set(X(cx + d * span * 0.55), Y(11 + lift * 0.3), 0xb88ad8);
  }
  // Feathery antennae.
  for (const d of [-1, 1]) {
    stroke(g, P([cx + d * 0.4, 4.4]), P([cx + d * 1.8, 2]), P([cx + d * 3.4, 1.2]), 1, 1, 0x6a5a7a);
    g.set(X(cx + d * 2.6), Y(1.2), 0x9a88b0);
  }
  g.set(X(cx - 0.5), Y(5.2), 0x1a1020); g.set(X(cx + 0.5), Y(5.2), 0x1a1020);
  outline(g, 0x2a2238);
  return g;
}

// ---------------------------------------------------------------- dragonling
const SCALE = makeRamp(DP.ramp[0], DP.ramp[3], DP.rim, 6);
const BELLY = [DP.belly[0], DP.belly[1], DP.belly[2], 0xd8a070];
const MEMB = makeRamp(0x1e060c, DP.membrane[2], 0xb04234, 5);

function dragonling(stage, f) {
  const s = [0.66, 0.82, 1][stage], hb = [1.35, 1.15, 1][stage];
  const { g, X, Y, P } = canvasFor(26, 22, s);
  const up = f === 1, puff = f === 2;
  // Far wing, tail, body, belly, near wing, head.
  const wing = (dx, m) => {
    const sh = [10.4 + dx, 9.2];
    const tip = up ? [7 + dx, 1.4] : [4.8 + dx, 7.2];
    const back = up ? [3.6 + dx, 5.2] : [3.4 + dx, 10.4];
    poly(g, [P(sh), P(tip), P([(tip[0] + back[0]) / 2 + 1, (tip[1] + back[1]) / 2 + 1.4]), P(back), P([8.6 + dx, 11.6])], m);
    stroke(g, P(sh), P([(sh[0] + tip[0]) / 2 + 0.6, (sh[1] + tip[1]) / 2]), P(tip), 1.6 * s + 0.3, 1, F);
  };
  if (stage >= 1) wing(1.4, E);
  stroke(g, P([6, 15]), P([1.4, 16.4]), P([1.6, 11.4]), 3 * s + 0.4, 1, A);
  poly(g, [P([1.6, 11.4]), P([0.2, 9.8]), P([3.2, 10.6]), P([2.4, 12.6])], G);
  g.ellipse(X(10), Y(14.2), 5.6 * s, 5 * s, A);
  g.ellipse(X(11.6), Y(15.6), 3.4 * s, 3.2 * s, B);
  // Little legs and claws.
  stroke(g, P([8, 18]), P([7.6, 19.4]), P([8.6, 20.6]), 2.2 * s + 0.3, 2 * s, A);
  stroke(g, P([13.4, 17.6]), P([14.2, 19]), P([14.6, 20.4]), 2 * s + 0.3, 1.8 * s, A);
  wing(0, E);
  // Head: big round on a baby, with a snout, horn nubs that grow.
  const hx = 15.4, hy = 8.2;
  stroke(g, P([12.6, 11.6]), P([13.6, 9.8]), P([hx - 0.6, hy + 1.2]), 3.6 * s, 3 * s, A);
  g.ellipse(X(hx), Y(hy), 3.4 * s * hb, 3 * s * hb, C);
  g.ellipse(X(hx + 3 * hb), Y(hy + 1), 2.2 * s * hb, 1.7 * s * hb, C);
  const horn = stage === 0 ? 1.4 : stage === 1 ? 2.6 : 3.6;
  stroke(g, P([hx - 1, hy - 2.4 * hb]), P([hx - 2.2, hy - 3.4]), P([hx - 2.6 - horn * 0.6, hy - 2.4 - horn * 0.7]), 1.8 * s + 0.3, 1, D);
  shade(g, A, SCALE, { r: 2, base: 0.5, bias: (x, y) => ((x + (Math.floor(y / 2) % 2) * 2) % 4 === 0 && y % 2 === 0 ? -0.12 : 0) });
  shade(g, B, BELLY, { r: 2, base: 0.6, bias: (x, y) => (y % 2 === 0 ? -0.15 : 0.05) });
  shade(g, C, SCALE, { r: 2, base: 0.58 });
  shade(g, D, [DP.horn[0], DP.horn[1], DP.horn[2]], { r: 1, base: 0.6 });
  shade(g, E, MEMB, { r: 2, base: 0.55 });
  for (let i = 0; i < g.px.length; i++) { if (g.px[i] === F) g.px[i] = 0xa85a3a; else if (g.px[i] === G) g.px[i] = DP.spine; }
  // A big glinting eye, a nostril, a glow in the throat when it puffs.
  const ex = X(hx + 0.6 * hb), ey = Y(hy - 0.6);
  g.set(ex, ey, 0xffb040); g.set(ex + 1, ey, 0xffb040); g.set(ex, ey + 1, 0x1a0606); g.set(ex + 1, ey + 1, 0xe8802a);
  g.set(ex, ey - 1, 0xffffff);
  g.set(X(hx + 4.6 * hb), Y(hy + 0.4), 0x0a0204);
  if (puff) { g.set(X(hx + 4.4 * hb), Y(hy + 2.2), 0xffd070); g.set(X(hx + 3.6 * hb), Y(hy + 2.2), 0xff8a28); }
  // Back spines.
  for (const [x, y] of [[8, 9.4], [10.4, 9], [12.4, 9.6]]) { g.set(X(x), Y(y), DP.spine); g.set(X(x), Y(y) - 1, DP.spineTip); }
  outline(g, DP.outline);
  return g;
}

const ART = { kid: [kid, 3], bee: [bee, 2], moth: [moth, 2], dragonling: [dragonling, 3] };

export function buildPetTextures(scene) {
  for (const [id, [fn, frames]] of Object.entries(ART)) {
    for (let stage = 0; stage < 3; stage++) addFrames(scene, `pet_${id}_${stage}`, Array.from({ length: frames }, (_, fr) => fn(stage, fr)));
  }
}

// ---------------------------------------------------------------- the pen
// Homes, painted at 1x and shown at 3x next to the pets:
//   hay      a bale of straw tied with twine
//   hive     a woven straw skep on a cut log, its doorway dark
//   lantern  a hanging lantern on a wrought-iron hook post
//   stone    a nest of dark stones round glowing embers and a broken shell
const STRAW = makeRamp(0x7a5a1a, 0xd8b048, 0xfff0a8, 6);
const WOOD = makeRamp(0x2a1a0e, 0x6a4422, 0xb07a44, 5);

function hayHome() {
  const g = new PixelGrid(30, 18);
  g.rect(1, 3, 28, 14, A);
  g.rect(2, 2, 26, 1, A);
  shade(g, A, STRAW, { r: 3, base: 0.55, bias: (x, y) => ((x * 3 + y * 7) % 5 === 0 ? -0.22 : (x + y * 2) % 7 === 0 ? 0.15 : 0) });
  // Straw strands along the bale, and two bands of twine.
  for (let i = 0; i < 40; i++) { const x = 2 + ((i * 37) % 26), y = 3 + ((i * 11) % 13); g.set(x, y, i % 3 ? 0xf8e48a : 0x9a7428); g.set(x + 1, y, 0xe8c860); }
  for (const tx of [8, 21]) for (let y = 2; y < 17; y++) g.set(tx, y, y % 3 ? 0x8a3a2a : 0xc8604a);
  for (const x of [3, 12, 25]) { g.set(x, 1, 0xd8b048); g.set(x + 1, 0, 0xf0d070); }
  outline(g, 0x3a2410);
  return g;
}

function hiveHome() {
  const g = new PixelGrid(26, 34);
  // The log it sits on: bark sides, rings on top.
  g.rect(4, 22, 18, 12, B);
  g.ellipse(13, 22, 9, 2.5, C);
  shade(g, B, WOOD, { r: 2, base: 0.45, bias: (x) => (x % 3 === 0 ? -0.2 : 0) });
  shade(g, C, makeRamp(0x8a6038, 0xc89a64, 0xe8c890, 4), { r: 1, base: 0.6, bias: (x, y) => (Math.round(Math.hypot((x - 13) / 3, (y - 22))) % 2 ? -0.15 : 0) });
  // The skep: stacked coils of straw, narrowing to a rounded top.
  for (let k = 0; k < 6; k++) {
    const y = 20 - k * 3.2, w = 10 - k * k * 0.22;
    g.ellipse(13, y, w, 2.1, A);
  }
  shade(g, A, STRAW, { r: 3, base: 0.5, bias: (x, y) => ((Math.round(y) % 3) === 0 ? -0.25 : 0.05) });
  g.ellipse(13, 18, 2.2, 1.6, 0x1a0e04);
  g.set(12, 17, 0x3a2410);
  outline(g, 0x2a1a0a);
  return g;
}

function lanternHome() {
  const g = new PixelGrid(26, 52);
  // A wrought-iron post with a curl at the top and a hook.
  g.rect(4, 6, 3, 46, D);
  stroke(g, [5, 7], [8, 0], [16, 3], 2, 2, D);
  stroke(g, [16, 3], [19, 4], [18, 8], 1.5, 1, D);
  g.rect(1, 48, 9, 4, D);
  shade(g, D, [0x0e0a0c, 0x1e1a1c, 0x3a3436, 0x5a5254], { r: 1, base: 0.45 });
  // Chain and the lantern: cap, glass panes with a flame, base.
  for (let y = 8; y < 15; y++) g.set(18, y, y % 2 ? 0x4a4446 : 0x6a6466);
  g.rect(14, 15, 9, 3, E); g.set(18, 14, 0x3a2a1a);
  g.rect(14, 18, 9, 11, F);
  g.rect(14, 29, 9, 2, E);
  shade(g, E, makeRamp(0x2a1a0e, 0x6a4a24, 0xa8803c, 4), { r: 1, base: 0.55 });
  for (let y = 18; y < 29; y++) for (let x = 14; x < 23; x++) {
    const d = Math.hypot(x - 18.5, y - 24);
    g.set(x, y, x === 18 || y === 23 ? 0x3a2a1a : d < 2 ? 0xfff6d0 : d < 3.4 ? 0xffd070 : 0xe8a040);
  }
  for (const x of [14, 22]) for (let y = 18; y < 29; y++) g.set(x, y, 0x2a1a0e);
  outline(g, 0x0e0a0c);
  return g;
}

function stoneHome() {
  const g = new PixelGrid(34, 16);
  // Ash and embers in the middle, a broken shell, a ring of stones.
  g.ellipse(17, 10, 13, 4.5, 0x2a1a1a);
  for (let i = 0; i < 26; i++) { const x = 7 + ((i * 29) % 20), y = 8 + ((i * 7) % 5); g.set(x, y, i % 3 ? 0xc84a1a : 0xffa040); }
  stroke(g, [14, 9], [15, 4], [18, 5], 2.2, 1.4, G);
  stroke(g, [21, 10], [22, 6], [24, 7], 2, 1.2, G);
  for (const [x, y, r] of [[4, 11, 3.6], [9, 13.5, 3.2], [16, 14, 3.4], [23, 13.6, 3.2], [29, 11.4, 3.6], [8, 7.6, 2.6], [26, 7.6, 2.6]]) g.ellipse(x, y, r, r * 0.8, A);
  shade(g, A, [0x14100e, 0x2a2422, 0x463c38, 0x6a5e58, 0x8a7e76], { r: 2, base: 0.48 });
  shade(g, G, [0xb8a890, 0xe8dcc4, 0xfff8ec], { r: 1, base: 0.6 });
  outline(g, 0x0a0606);
  return g;
}

export function buildPenTextures(scene) {
  const add = (key, g) => {
    if (scene.textures.exists(key)) return;
    const c = makeCanvas(g.w, g.h);
    g.drawTo(c.getContext('2d'));
    scene.textures.addCanvas(key, c);
  };
  add('pethome_hay', hayHome());
  add('pethome_hive', hiveHome());
  add('pethome_lantern', lanternHome());
  add('pethome_stone', stoneHome());
}
