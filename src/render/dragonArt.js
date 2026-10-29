// The dragon of the Dragon's Spine, drawn as pixel art at startup: a head in
// four jaw frames (closed, snarl, open, roaring), a tattered bat wing through
// a full flap cycle, round armour plates for the neck and tail, a clawed hand
// that grips the wall, back spines and the spade at the tip of the tail in 16
// directions. Head, plates and claw each get a matching '_glow' texture with
// only their lava cracks, laid on top with ADD so the cracks smoulder.
// world/Dragon.js puts it all together.
import { PixelGrid } from '../utils/pixelGrid.js';
import { lerpColor, bayer } from '../utils/color.js';

export const DRAGON_PAL = {
  outline: 0x14060a,
  // Near-black scales with a dull crimson sheen and a hot rim of light.
  ramp: [0x14070b, 0x260b11, 0x40121a, 0x641c1e, 0x94342a],
  rim: 0xd8582c,
  crack: 0x1c0404,
  belly: [0x5a3424, 0x86543a, 0xb07a4e],
  horn: [0x6a5a48, 0xa8967a, 0xe0d4b8],
  spine: 0x2a0a10,
  spineTip: 0xf0a050,
  mouth: 0x1e0406,
  throat: [0x5a1008, 0xa83010, 0xff8a28],
  tooth: 0xfff2dc,
  membrane: [0x2a0810, 0x481018, 0x681c26],
  vein: 0x2a060c,
};
const P = DRAGON_PAL;

// Markers used while drawing; replaced by shaded colours afterwards.
const BODY = 1, BELLY = 2, HORN = 3, SPINE = 4, TIP = 5, MOUTH = 6, TOOTH = 7, SOCKET = 8, BROW = 9, NOSTRIL = 10, THROAT = 11;

export const HEAD_W = 86, HEAD_H = 58;
// Where the neck joins the head, the eye sits, and fire comes out (head frame coords).
export const HEAD_NECK = { x: 17, y: 35 };
export const HEAD_EYE = { x: 47, y: 21 };
export const HEAD_MOUTH = { x: 72, y: 34 };
export const JAWS = [0, 0.12, 0.3, 0.62];
export const CLAW_W = 48, CLAW_H = 40;
// The wrist (where the arm joins) and where the talons hook over the edge.
export const CLAW_WRIST = { x: 5, y: 20 };
export const CLAW_EDGE = { x: 30, y: 14 };
export const WING_W = 176, WING_H = 140;
export const WING_SHOULDER = { x: 156, y: 130 };
export const SEG_RADII = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
export const DIRS = 16;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ramp = (list, t, x, y) => {
  // Ordered dithering between neighbouring shades keeps the gradient pixel-art.
  const f = clamp(t, 0, 0.999) * (list.length - 1);
  const i = Math.floor(f);
  return list[Math.min(list.length - 1, i + (f - i > bayer(x, y) ? 1 : 0))];
};

// A tiny seeded generator so the cracks look the same every time.
function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// Lava cracks: short wandering lines over the scales. They are cut dark into
// the base sprite and drawn white into the glow sprite (lit with ADD).
function crack(g, glow, isBody, seed, count, len) {
  const rnd = lcg(seed);
  const spots = [];
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (isBody(g.get(x, y))) spots.push([x, y]);
  if (!spots.length) return;
  for (let k = 0; k < count; k++) {
    let [x, y] = spots[Math.floor(rnd() * spots.length)];
    let dx = rnd() < 0.5 ? -1 : 1, dy = rnd() < 0.5 ? 0 : 1;
    const n = Math.round(len * (0.6 + rnd() * 0.8));
    for (let i = 0; i < n; i++) {
      if (!isBody(g.get(x, y))) break;
      g.set(x, y, P.crack);
      glow.set(x, y, i % 4 === 0 ? 0xffffff : 0xffc080);
      if (rnd() < 0.35) dy = dy ? 0 : (rnd() < 0.5 ? -1 : 1);
      if (rnd() < 0.15) dx = -dx;
      x += dx; y += dy;
    }
  }
}

function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function fillPoly(g, pts, c) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
      if (inPoly(x + 0.5, y + 0.5, pts)) g.set(x, y, c);
    }
  }
}

// A tapering curved stroke (horns, spines, claws): quadratic bezier from a to b
// bent towards c, w0 wide at a and w1 at b.
function taper(g, a, c, b, w0, w1, color) {
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const x = u * u * a[0] + 2 * u * t * c[0] + t * t * b[0];
    const y = u * u * a[1] + 2 * u * t * c[1] + t * t * b[1];
    const r = (w0 + (w1 - w0) * t) / 2;
    if (r < 0.7) g.set(x, y, color);
    else g.ellipse(x, y, r, r, color);
  }
}

// Shades BODY pixels per column, light on top and dark underneath (a lit
// cylinder), with rows of small overlapping scales.
function shadeBody(g, light = 0) {
  for (let x = 0; x < g.w; x++) {
    let top = -1, bot = -1;
    for (let y = 0; y < g.h; y++) if (g.get(x, y) === BODY) { if (top < 0) top = y; bot = y; }
    if (top < 0) continue;
    for (let y = top; y <= bot; y++) {
      if (g.get(x, y) !== BODY) continue;
      const t = bot > top ? (y - top) / (bot - top) : 0.5;
      let k = 0.95 - t * 0.85 + light;
      // Scales: staggered rows of little arcs, darker at their lower edge.
      const row = Math.floor(y / 3), sx = (x + (row % 2) * 2) % 4, sy = y % 3;
      if (sy === 2 && sx !== 0) k -= 0.22;
      else if (sy === 0 && sx === 1) k += 0.12;
      g.set(x, y, ramp(P.ramp, k, x, y));
    }
  }
}

function shadeRest(g) {
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const c = g.get(x, y);
      if (c === BELLY) g.set(x, y, y % 3 === 0 ? P.belly[0] : ramp(P.belly, 1 - ((x + y) % 7) / 14, x, y));
      else if (c === HORN) g.set(x, y, (x + y * 2) % 5 === 0 ? P.horn[0] : g.get(x - 1, y - 1) === null ? P.horn[2] : P.horn[1]);
      else if (c === SPINE) g.set(x, y, P.spine);
      else if (c === TIP) g.set(x, y, P.spineTip);
      else if (c === MOUTH) g.set(x, y, P.mouth);
      else if (c === TOOTH) g.set(x, y, P.tooth);
      else if (c === SOCKET) g.set(x, y, 0x0e0306);
      else if (c === BROW) g.set(x, y, (x % 3 === 0) ? P.ramp[0] : P.ramp[1]);
      else if (c === NOSTRIL) g.set(x, y, 0x0a0204);
      else if (c === THROAT) g.set(x, y, P.throat[0]);
    }
  }
}

// ---------------------------------------------------------------- head
// jaw: 0 closed .. ~0.6 wide open (radians the lower jaw drops).
function drawHead(jaw) {
  const g = new PixelGrid(HEAD_W, HEAD_H);
  // A crown of horns: a great swept-back pair, a hooked lower one, and a row
  // of short spikes along the back of the skull.
  taper(g, [27, 13], [10, 0], [1, 6], 7, 1, HORN);
  taper(g, [23, 18], [8, 12], [0, 16], 5, 1, HORN);
  taper(g, [21, 24], [10, 22], [4, 27], 4, 1, HORN);
  [[33, 13, 31, 6], [38, 12, 37, 6]].forEach(([x0, y0, x1, y1]) => taper(g, [x0, y0], [x0 - 1, (y0 + y1) / 2], [x1, y1], 3, 1, HORN));
  // Frills of spines down the back of the head and jaw.
  [[[16, 25], [4, 26], [8, 21]], [[15, 31], [2, 36], [6, 30]], [[18, 38], [8, 47], [11, 38]], [[27, 40], [24, 49], [31, 41]]].forEach(([a, b, c]) => {
    fillPoly(g, [a, b, c], SPINE);
    g.set(b[0], b[1], TIP);
  });
  // Skull and neck root.
  g.ellipse(30, 25, 16, 12, BODY);
  g.ellipse(19, 35, 9, 8, BODY);
  // Upper snout: a long wedge from the brow to a blunt, bumped nose.
  for (let x = 38; x <= 78; x++) {
    let top = x < 56 ? 15 + (x - 40) * 0.28 : 19.5 + (x - 56) * 0.12;
    if (x >= 66 && x <= 74) top -= Math.sin(((x - 66) / 8) * Math.PI) * 1.6;
    if (x > 75) top += (x - 75) ** 2 * 0.9;
    const bottom = x > 76 ? 31 : 32;
    for (let y = Math.round(top); y <= bottom; y++) g.set(x, y, BODY);
  }
  // A heavy brow ridge with two short spikes, and a little horn on the nose.
  fillPoly(g, [[29, 12], [42, 12], [52, 15], [58, 20], [54, 21], [45, 18], [31, 17]], BROW);
  fillPoly(g, [[35, 13], [38, 7], [40, 13]], HORN);
  fillPoly(g, [[43, 13], [47, 9], [48, 14]], HORN);
  taper(g, [65, 20], [65, 14], [68, 11], 3, 1, HORN);
  // Lower jaw, rotated down around its hinge.
  const hinge = [29, 32];
  const sin = Math.sin(jaw), cos = Math.cos(jaw);
  const rot = (x, y) => [hinge[0] + (x - hinge[0]) * cos - (y - hinge[1]) * sin, hinge[1] + (x - hinge[0]) * sin + (y - hinge[1]) * cos];
  const jawPts = [[24, 32], [74, 32], [73, 35], [66, 37], [42, 40], [27, 42]].map(([x, y]) => rot(x, y));
  if (jaw > 0.05) {
    // The open mouth: dark, with the fire glowing in the throat.
    fillPoly(g, [[30, 32], [76, 32], jawPts[1], jawPts[0]], MOUTH);
    g.ellipse(37, 34 + jaw * 8, 6, 3 + jaw * 6, THROAT);
  }
  fillPoly(g, jawPts, BODY);
  // The underside of the jaw is pale belly plate.
  fillPoly(g, [[30, 39], [64, 36], [66, 37], [42, 40], [27, 42]].map(([x, y]) => rot(x, y)), BELLY);
  // Teeth: fangs down from the upper jaw, smaller ones up from the lower.
  for (let x = 45; x <= 72; x += 5) {
    const long = x === 50 || x === 65;
    g.set(x, 33, TOOTH); g.set(x + 1, 33, TOOTH);
    g.set(x, 34, TOOTH);
    if (long || jaw > 0.05) g.set(x, 35, TOOTH);
    if (long && jaw > 0.05) g.set(x, 36, TOOTH);
  }
  if (jaw > 0.05) {
    for (let x = 47; x <= 70; x += 6) {
      const [bx, by] = rot(x, 33);
      g.set(bx, by - 1, TOOTH); g.set(bx + 1, by - 1, TOOTH); g.set(bx, by - 2, TOOTH);
    }
  }
  // Spikes along the jaw line, eye socket and nostril.
  [[44, 40], [54, 38], [62, 37]].forEach(([x, y]) => {
    const [bx, by] = rot(x, y);
    fillPoly(g, [[bx - 2, by - 1], [bx + 2, by - 1], [bx - 1, by + 4]], SPINE);
  });
  g.ellipse(HEAD_EYE.x, HEAD_EYE.y, 6, 3.6, SOCKET);
  g.rect(72, 22, 3, 2, NOSTRIL);
  shadeBody(g);
  // An old scar: three claw lines across the cheek.
  for (let k = 0; k < 3; k++) g.line(36 + k * 3, 24, 41 + k * 3, 31, P.horn[0]);
  const glow = new PixelGrid(HEAD_W, HEAD_H);
  crack(g, glow, (c) => P.ramp.includes(c), 7, 9, 9);
  glow.set(73, 22, 0xffd090); glow.set(74, 22, 0xffffff);
  // The throat glow is a gradient of fire, brightest deep inside.
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (g.get(x, y) !== THROAT) continue;
      const d = Math.hypot((x - 37) / 6, (y - 34 - jaw * 8) / (3 + jaw * 6));
      g.set(x, y, ramp(P.throat, 1 - d, x, y));
    }
  }
  shadeRest(g);
  // The brow: dark plates with a lit top edge.
  for (let x = 0; x < g.w; x++) {
    for (let y = 1; y < g.h; y++) {
      const c = g.get(x, y);
      if (g.get(x, y - 1) === null && (c === P.ramp[0] || c === P.ramp[1]) && y < 20) { g.set(x, y, P.ramp[3]); break; }
    }
  }
  // A warm rim of light along the top of the skull and snout.
  for (let x = 0; x < g.w; x++) {
    for (let y = 1; y < g.h; y++) {
      if (g.get(x, y - 1) === null && P.ramp.includes(g.get(x, y))) { g.set(x, y, P.ramp[4]); break; }
    }
  }
  // A hot rim where the light (and the fire inside) catches the top edges.
  for (let x = 0; x < g.w; x++) {
    for (let y = 1; y < g.h; y++) {
      if (g.get(x, y - 1) === null && g.get(x, y) === P.ramp[4]) { g.set(x, y, P.rim); break; }
    }
  }
  g.outline(P.outline);
  return { g, glow };
}

// ---------------------------------------------------------------- wing
// A bat wing seen from behind the dragon, rising up and away from the wall
// (to the left): arm and forearm along the leading edge, four long fingers
// fanning out from the wrist, membrane in scalloped panels between them.
// open: 0 folded .. 1 spread; sweep: >0 raised (upstroke), <0 swept down.
function drawWing(open, sweep) {
  const g = new PixelGrid(WING_W, WING_H);
  const S = [WING_SHOULDER.x, WING_SHOULDER.y];
  const lerp = (a, b, t) => a + (b - a) * t;
  const rad = (d) => (d * Math.PI) / 180;
  const at = (o, deg, len) => [o[0] + Math.cos(rad(deg)) * len, o[1] + Math.sin(rad(deg)) * len];
  const sw = sweep * 40;
  const short = 1 - Math.max(0, -sweep) * 0.22;
  const elbow = at(S, lerp(-100, -122, open) + sw * 0.4, lerp(26, 30, open));
  const wrist = at(elbow, lerp(-88, -100, open) + sw * 0.7, lerp(22, 28, open) * short);
  const fingerDeg = [[-82, -70], [-92, -110], [-100, -150], [-104, -192]];
  const fingerLen = [[30, 58], [34, 74], [34, 84], [30, 76]];
  const fingers = fingerDeg.map((d, i) => at(wrist, lerp(d[0], d[1], open) + sw, lerp(fingerLen[i][0], fingerLen[i][1], open) * short));
  // Membrane: leading edge along the arm, scalloped trailing edge, down to the flank.
  const flank = [S[0] - 4, S[1] + 6];
  const memb = [flank, S, elbow, wrist];
  const ends = [...fingers, flank];
  for (let i = 0; i < fingers.length; i++) {
    const a = ends[i], b = ends[i + 1];
    memb.push(a);
    for (let k = 1; k < 8; k++) {
      const t = k / 8;
      const sag = Math.sin(t * Math.PI) * (i < fingers.length - 1 ? 0.2 : 0.14);
      memb.push([lerp(lerp(a[0], b[0], t), wrist[0], sag), lerp(lerp(a[1], b[1], t), wrist[1], sag)]);
    }
  }
  fillPoly(g, memb, 1);
  // Old battle damage: a few tears through the membrane and a ragged edge.
  const rnd = lcg(31);
  for (let k = 0; k < 3; k++) {
    const f = fingers[1 + (k % 3)], t = 0.55 + rnd() * 0.25;
    const hx = lerp(wrist[0], f[0], t) + (rnd() - 0.5) * 10, hy = lerp(wrist[1], f[1], t) + (rnd() - 0.5) * 10;
    const r = 1.5 + rnd() * 2.5 * open;
    for (let y = Math.floor(hy - r); y <= hy + r; y++) for (let x = Math.floor(hx - r * 1.4); x <= hx + r * 1.4; x++) {
      if (((x - hx) / (r * 1.4)) ** 2 + ((y - hy) / r) ** 2 <= 1 && g.get(x, y) === 1) g.px[y * g.w + x] = null;
    }
  }
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (g.get(x, y) === 1 && (g.get(x, y + 1) === null || g.get(x - 1, y) === null) && rnd() < 0.18) g.px[y * g.w + x] = null;
  }
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (g.get(x, y) !== 1) continue;
      // Darker towards the trailing edge, lighter where the sun shines through.
      const d = Math.hypot(x - wrist[0], y - wrist[1]) / 90;
      g.set(x, y, ramp(P.membrane, 0.85 - d * 0.6 + (y < wrist[1] ? 0.12 : 0), x, y));
    }
  }
  // Veins: thin dark lines between the fingers.
  for (let i = 0; i < fingers.length - 1; i++) {
    const m = [lerp(fingers[i][0], fingers[i + 1][0], 0.5), lerp(fingers[i][1], fingers[i + 1][1], 0.5)];
    const end = [lerp(m[0], wrist[0], 0.25), lerp(m[1], wrist[1], 0.25)];
    g.line(lerp(wrist[0], end[0], 0.2), lerp(wrist[1], end[1], 0.2), end[0], end[1], P.vein);
  }
  // Bones, joints, a hooked thumb claw at the wrist and claws at the tips.
  g.line(S[0], S[1], elbow[0], elbow[1], P.ramp[2], 5);
  g.line(elbow[0], elbow[1], wrist[0], wrist[1], P.ramp[2], 4);
  g.line(S[0] - 1, S[1] - 1, elbow[0] - 1, elbow[1] - 1, P.ramp[3], 1);
  fingers.forEach((f) => {
    g.line(wrist[0], wrist[1], f[0], f[1], P.ramp[3], 2);
    g.line(wrist[0] - 1, wrist[1] - 1, lerp(wrist[0], f[0], 0.8) - 1, lerp(wrist[1], f[1], 0.8) - 1, P.ramp[4], 1);
  });
  g.ellipse(elbow[0], elbow[1], 3, 3, P.ramp[3]);
  g.ellipse(wrist[0], wrist[1], 3, 3, P.ramp[3]);
  taper(g, wrist, [wrist[0] + 2, wrist[1] - 8], [wrist[0] + 6, wrist[1] - 10], 3, 1, P.horn[1]);
  fingers.forEach((f) => { g.set(f[0], f[1], P.horn[2]); g.set(f[0], f[1] - 1, P.horn[1]); });
  g.outline(P.outline);
  return g;
}

// The wing folded flat for sleep, lying back along the body: the forearm
// rises to a hump at the wrist, the fingers trail back from it side by side
// and the membrane hangs between them in pleats, lit on top, creased below.
// Same frame and shoulder as the open wing, but drawn trailing the other way
// round (world/Dragon.js flips it so it lies back towards the wall).
function drawFoldedWing() {
  const g = new PixelGrid(WING_W, WING_H);
  const S = [WING_SHOULDER.x, WING_SHOULDER.y];
  const elbow = [S[0] - 26, S[1] - 9];
  const wrist = [S[0] - 9, S[1] - 33];
  const tips = [[76, 114], [86, 121], [97, 127], [109, 132]];
  const flank = [S[0] - 3, S[1] + 6];
  const lerp = (a, b, t) => a + (b - a) * t;
  const memb = [S, wrist];
  const ends = [...tips, flank];
  for (let i = 0; i < tips.length; i++) {
    const a = ends[i], b = ends[i + 1];
    memb.push(a);
    for (let k = 1; k < 6; k++) {
      const t = k / 6, sag = Math.sin(t * Math.PI) * (i < tips.length - 1 ? 0.12 : 0.06);
      memb.push([lerp(lerp(a[0], b[0], t), wrist[0], sag), lerp(lerp(a[1], b[1], t), wrist[1], sag)]);
    }
  }
  fillPoly(g, memb, 1);
  // Pleats: the angle around the wrist says which panel a pixel is in and
  // how far down it, so every fold is light at its top and dark in its crease.
  const angs = tips.map(([x, y]) => Math.atan2(y - wrist[1], x - wrist[0]));
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (g.get(x, y) !== 1) continue;
      const a = Math.atan2(y - wrist[1], x - wrist[0]);
      let f = 1;
      for (let i = 0; i < angs.length - 1; i++) {
        const lo = Math.min(angs[i], angs[i + 1]), hi = Math.max(angs[i], angs[i + 1]);
        if (a >= lo && a <= hi) { f = (angs[i] - a) / (angs[i] - angs[i + 1]); break; }
      }
      const d = Math.hypot(x - wrist[0], y - wrist[1]) / 70;
      g.set(x, y, ramp(P.membrane, 0.95 - f * 0.75 - d * 0.25, x, y));
    }
  }
  // Bones on top: upper arm, forearm up to the wrist, fingers trailing back.
  g.line(S[0], S[1], elbow[0], elbow[1], P.ramp[2], 5);
  g.line(elbow[0], elbow[1], wrist[0], wrist[1], P.ramp[2], 5);
  g.line(elbow[0] - 1, elbow[1] - 2, wrist[0] - 2, wrist[1] - 1, P.ramp[3], 1);
  tips.forEach((tp) => {
    g.line(wrist[0], wrist[1], tp[0], tp[1], P.ramp[3], 2);
    g.line(wrist[0] - 1, wrist[1] - 1, lerp(wrist[0], tp[0], 0.85), lerp(wrist[1], tp[1], 0.85) - 1, P.ramp[4], 1);
    g.set(tp[0], tp[1], P.horn[2]);
    g.set(tp[0] + 1, tp[1], P.horn[1]);
  });
  g.ellipse(elbow[0], elbow[1], 3.5, 3, P.ramp[3]);
  g.ellipse(wrist[0], wrist[1], 3.5, 3.5, P.ramp[3]);
  g.set(wrist[0] - 1, wrist[1] - 2, P.ramp[4]);
  // The hooked thumb claw on top of the wrist.
  taper(g, [wrist[0], wrist[1] - 2], [wrist[0] - 1, wrist[1] - 10], [wrist[0] + 5, wrist[1] - 12], 3, 1, P.horn[1]);
  g.set(wrist[0] + 5, wrist[1] - 12, P.horn[2]);
  g.outline(P.outline);
  return g;
}

// ---------------------------------------------------------------- plates
// A round armour plate (neck and tail), lit from the top left, with scales.
function drawSegment(r, glowOut = null) {
  const s = r * 2 + 3;
  const g = new PixelGrid(s, s);
  const c = r + 1.5;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const u = (x + 0.5 - c) / r, v = (y + 0.5 - c) / r;
      const q = u * u + v * v;
      if (q > 1) continue;
      const z = Math.sqrt(1 - q);
      let k = 0.25 + (-0.55 * u - 0.7 * v) * 0.5 + z * 0.45;
      const row = Math.floor(y / 3), sx = (x + (row % 2) * 2) % 4;
      if (y % 3 === 2 && sx !== 0) k -= 0.18;
      g.set(x, y, ramp(P.ramp, k, x, y));
    }
  }
  if (glowOut && r >= 5) crack(g, glowOut, (c) => P.ramp.includes(c), 100 + r, Math.max(1, Math.round(r / 5)), r * 0.9);
  return g;
}

// A dark disk one pixel larger than a plate: laid behind the whole neck it
// becomes one outline around the body instead of a ring around every plate.
function drawSegmentOutline(r) {
  const s = r * 2 + 5;
  const g = new PixelGrid(s, s);
  g.ellipse(r + 2.5, r + 2.5, r + 1.2, r + 1.2, P.outline);
  return g;
}

// A pale belly plate laid over the lower side of each neck plate.
// lined: a dark seam along its top, so every few plates read as one band.
function drawBelly(r, lined) {
  const s = r * 2 + 3;
  const g = new PixelGrid(s, s);
  g.ellipse(r + 1.5, r + 1.5, r, r, 1);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      if (g.get(x, y) !== 1) continue;
      const top = g.get(x, y - 1) === null;
      g.set(x, y, lined && top ? P.belly[0] : ramp(P.belly, 0.9 - (y / s) * 0.6, x, y));
    }
  }
  return g;
}

// A back spine pointing along `ang`.
function drawSpine(ang, len = 8) {
  const g = new PixelGrid(20, 20);
  const c = [10, 10], dx = Math.cos(ang), dy = Math.sin(ang);
  const tip = [c[0] + dx * len, c[1] + dy * len];
  fillPoly(g, [[c[0] - dy * 3, c[1] + dx * 3], [c[0] + dy * 3, c[1] - dx * 3], tip], P.spine);
  g.set(tip[0], tip[1], P.spineTip);
  g.set(tip[0] - dx, tip[1] - dy, P.spineTip);
  g.outline(P.outline);
  return g;
}

// The spade at the tip of the tail, pointing along `ang`.
function drawTailTip(ang) {
  const g = new PixelGrid(30, 30);
  const c = [15, 15], dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  const p = (a, b) => [c[0] + dx * a + nx * b, c[1] + dy * a + ny * b];
  fillPoly(g, [p(-6, 0), p(2, 7), p(12, 0), p(2, -7)], 1);
  for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) {
    if (g.get(x, y) !== 1) continue;
    const side = (x - c[0]) * nx + (y - c[1]) * ny;
    g.set(x, y, side < -1 ? P.ramp[4] : side < 1 ? P.ramp[2] : P.ramp[1]);
  }
  g.line(...p(-5, 0), ...p(10, 0), P.ramp[0]);
  g.outline(P.outline);
  return g;
}

// ---------------------------------------------------------------- claw
// A clawed hand hooked over the wall edge (reaching right, onto the wall):
// scaled back of the hand, three fingers, long talons curling down over the
// rock. grip: 0 resting .. 1 dug in deep.
function drawClaw(grip) {
  const g = new PixelGrid(CLAW_W, CLAW_H);
  // Forearm stub and palm.
  g.ellipse(6, 21, 6, 6.5, BODY);
  g.ellipse(14, 19, 7.5, 8, BODY);
  const tips = [];
  [-1, 0, 1].forEach((k) => {
    // Each finger: a thick first joint, a knuckle bump, then the talon.
    const y0 = 19 + k * 6;
    const knuckle = [25, y0 - 3 + Math.abs(k) * 2];
    g.line(17, y0, knuckle[0], knuckle[1], BODY, 3);
    g.ellipse(knuckle[0], knuckle[1], 2.8, 2.6, BODY);
    const tip = [knuckle[0] + 9 - grip, knuckle[1] + 10 + grip * 4];
    taper(g, [knuckle[0] + 1, knuckle[1] - 1], [knuckle[0] + 10, knuckle[1] - 3], tip, 4, 1, HORN);
    tips.push(tip);
  });
  // A dew claw on the inside.
  taper(g, [13, 24], [12, 30], [15, 33], 3, 1, HORN);
  shadeBody(g, 0.05);
  shadeRest(g);
  tips.forEach(([x, y]) => g.set(x, y, P.horn[0]));
  const glow = new PixelGrid(CLAW_W, CLAW_H);
  crack(g, glow, (c) => P.ramp.includes(c), 53, 3, 6);
  for (let x = 0; x < g.w; x++) {
    for (let y = 1; y < g.h; y++) {
      if (g.get(x, y - 1) === null && g.get(x, y) === P.ramp[4]) { g.set(x, y, P.rim); break; }
    }
  }
  g.outline(P.outline);
  return { g, glow };
}

function addGrid(scene, key, grid) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, grid.w, grid.h);
  grid.drawTo(tex.context);
  tex.refresh();
}

// [open, sweep]: folded, unfolding, then a flap cycle (up, level, down).
// [open, sweep]: folded, unfolding, then a six-frame flap cycle from the top
// of the upstroke down through the beat and back (frames 2-7).
export const WING_FRAMES = [[0, 0], [0.7, 0.2], [1, 0.42], [1, 0.22], [1, -0.05], [0.97, -0.35], [0.94, -0.5], [0.98, -0.12]];
export const WING_FLAP = [2, 3, 4, 5, 6, 7];

export function buildDragonTextures(scene) {
  if (scene.textures.exists('dragon_head_0')) return;
  JAWS.forEach((jaw, i) => {
    const { g, glow } = drawHead(jaw);
    addGrid(scene, `dragon_head_${i}`, g);
    addGrid(scene, `dragon_head_glow_${i}`, glow);
  });
  [0, 1].forEach((grip) => {
    const { g, glow } = drawClaw(grip);
    addGrid(scene, `dragon_claw_${grip}`, g);
    addGrid(scene, `dragon_claw_glow_${grip}`, glow);
  });
  // Frame 0 (asleep) is the wing folded flat along the back.
  WING_FRAMES.forEach(([open, down], i) => addGrid(scene, `dragon_wing_${i}`, i === 0 ? drawFoldedWing() : drawWing(open, down)));
  SEG_RADII.forEach((r) => {
    const glow = new PixelGrid(r * 2 + 3, r * 2 + 3);
    addGrid(scene, `dragon_seg_${r}`, drawSegment(r, glow));
    addGrid(scene, `dragon_segglow_${r}`, glow);
    addGrid(scene, `dragon_segol_${r}`, drawSegmentOutline(r));
    addGrid(scene, `dragon_belly_${r}`, drawBelly(Math.max(2, Math.round(r * 0.6)), false));
    addGrid(scene, `dragon_bellyl_${r}`, drawBelly(Math.max(2, Math.round(r * 0.6)), true));
  });
  for (let i = 0; i < DIRS; i++) {
    const ang = (i / DIRS) * Math.PI * 2;
    addGrid(scene, `dragon_spine_${i}`, drawSpine(ang));
    addGrid(scene, `dragon_tip_${i}`, drawTailTip(ang));
  }
}

// Texture index for a direction (radians).
export const dirIndex = (ang) => ((Math.round((ang / (Math.PI * 2)) * DIRS) % DIRS) + DIRS) % DIRS;

export { lerpColor };
