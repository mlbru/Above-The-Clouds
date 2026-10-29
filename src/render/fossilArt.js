// The Bone Garden's fossils: whole skeletons of old dragons sunk into the
// rock. The wall is cut into cells; each cell may hold one find, built from
// simple pieces (tapered capsules, circles, ellipses and dark holes) at its
// own angle and size: a ribcage, a skull, thigh bones, a run of vertebrae or
// a clawed foot. The wall overlay asks shadeFossil() about every rock pixel.
import { SeededRandom, hashInts } from '../utils/seededRandom.js';
import { lerpColor, bayer } from '../utils/color.js';

const CELL = 112;
const cache = new Map();

// A piece, already turned and placed in wall pixels.
function capsule(ax, ay, bx, by, r0, r1 = r0) { return { k: 'cap', ax, ay, bx, by, r0, r1 }; }
function circle(x, y, r) { return { k: 'circ', x, y, r }; }
function ellipse(x, y, rx, ry, rot = 0) { return { k: 'ell', x, y, rx, ry, rot }; }

// Local shape coordinates -> wall pixels (turned by `a`, flipped, moved).
function frame(cx, cy, a, flip = 1) {
  const c = Math.cos(a), s = Math.sin(a);
  return (u, v) => [cx + (u * flip) * c - v * s, cy + (u * flip) * s + v * c];
}

// A curve as a chain of tapered capsules: pts in local coords, r from r0 to r1.
function chain(out, T, pts, r0, r1) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = T(...pts[i]), [bx, by] = T(...pts[i + 1]);
    const ra = r0 + (r1 - r0) * (i / (pts.length - 1)), rb = r0 + (r1 - r0) * ((i + 1) / (pts.length - 1));
    out.push(capsule(ax, ay, bx, by, ra, rb));
  }
}

function ribcage(rng, cx, cy, out, holes) {
  const flip = rng.chance(0.5) ? 1 : -1;
  const T = frame(cx, cy, rng.range(-0.9, 0.9) + (rng.chance(0.25) ? Math.PI : 0), flip);
  const L = rng.range(42, 66), n = rng.int(4, 7);
  // The spine: a gently bent row of knuckles.
  const bend = rng.range(-6, 6);
  const spineAt = (u) => bend * Math.sin((u / L + 0.5) * Math.PI);
  const sp = [];
  for (let k = 0; k <= 8; k++) { const u = -L / 2 + (k / 8) * L; sp.push([u, spineAt(u)]); }
  chain(out, T, sp, 2.8, 2);
  for (let k = 0; k <= 8; k += 2) out.push(circle(...T(sp[k][0], sp[k][1]), 3.6));
  const both = rng.chance(0.35);
  const sweep = rng.range(4, 14) * (rng.chance(0.5) ? 1 : -1);
  for (let j = 0; j < n; j++) {
    const s = -L / 2 + ((j + 0.5) / n) * L;
    const shape = 0.55 + 0.45 * Math.sin(((j + 0.5) / n) * Math.PI);
    for (const side of both ? [1, -1] : [1]) {
      const len = rng.range(18, 30) * shape * (side < 0 ? 0.7 : 1);
      const end = rng.chance(0.2) ? rng.range(0.45, 0.75) : 1; // a broken rib
      const pts = [];
      for (let k = 0; k <= 5; k++) {
        const t = (k / 5) * end;
        pts.push([s + sweep * t * t + rng.range(-0.4, 0.4), spineAt(s) + side * len * Math.sin((t * Math.PI) / 2)]);
      }
      chain(out, T, pts, 2.6, end < 1 ? 1.8 : 1.1);
    }
  }
  return holes;
}

function skull(rng, cx, cy, out, holes) {
  const flip = rng.chance(0.5) ? 1 : -1;
  const T = frame(cx, cy, rng.range(-0.6, 0.6), flip);
  const sc = rng.range(0.9, 1.35);
  const P = (u, v) => T(u * sc, v * sc);
  const [x0, y0] = P(0, 0);
  out.push(ellipse(x0, y0, 12 * sc, 9 * sc, rng.range(-0.2, 0.2)));
  chain(out, P, [[6, 1], [16, 2], [27, 3]], 5.5 * sc, 3 * sc);
  // The lower jaw, a little open.
  const gape = rng.range(2, 6);
  chain(out, P, [[3, 7], [14, 8 + gape * 0.5], [24, 8 + gape]], 2.4 * sc, 1.4 * sc);
  // Teeth along the upper jaw.
  for (let u = 9; u <= 25; u += 3) out.push(circle(...P(u, 5.5 + (u - 9) * 0.05), 0.9 * sc));
  // A horn swept back.
  chain(out, P, [[-5, -6], [-14, -11], [-22, -10], [-27, -6]], 2.8 * sc, 0.7 * sc);
  if (rng.chance(0.5)) chain(out, P, [[-2, -8], [-8, -15], [-11, -20]], 1.8 * sc, 0.5 * sc);
  // An empty eye socket (sometimes an ember still burns in it) and a nostril.
  const [ex, ey] = P(3, -1);
  holes.push({ ...ellipse(ex, ey, 3.4 * sc, 2.6 * sc), ember: rng.chance(0.45) });
  holes.push(circle(...P(23, 0), 1.2 * sc));
  return holes;
}

function femurs(rng, cx, cy, out) {
  const count = rng.chance(0.45) ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const T = frame(cx + rng.range(-8, 8), cy + rng.range(-6, 6), rng.range(0, Math.PI));
    const L = rng.range(26, 46) / 2, r = rng.range(1.8, 2.6);
    out.push(capsule(...T(-L, 0), ...T(L, 0), r, r * 0.85));
    for (const e of [-1, 1]) for (const o of [-1, 1]) out.push(circle(...T(e * (L + 1), o * r * 0.9), r * 1.35));
  }
}

function vertebrae(rng, cx, cy, out) {
  const T = frame(cx, cy, rng.range(-1.2, 1.2) + (rng.chance(0.5) ? Math.PI : 0));
  const A = rng.range(4, 10), f = rng.range(0.05, 0.11), ph = rng.range(0, 6);
  const span = rng.range(26, 40);
  for (let u = -span; u <= span; u += 6.5) {
    const v = A * Math.sin(u * f + ph);
    const dv = A * f * Math.cos(u * f + ph);
    const nx = -dv / Math.hypot(1, dv), ny = -1 / Math.hypot(1, dv);
    const r = 2.6 + 0.8 * Math.cos((u / span) * Math.PI / 2);
    out.push(circle(...T(u, v), r));
    out.push(capsule(...T(u, v), ...T(u + nx * (r + 4), v + ny * (r + 4)), 1.2, 0.5));
  }
}

function claws(rng, cx, cy, out) {
  const T = frame(cx, cy, rng.range(0, Math.PI * 2));
  out.push(ellipse(...T(0, 0), 6, 4.5));
  for (let i = -1; i <= 1; i++) {
    const a0 = i * 0.5 + rng.range(-0.1, 0.1), len = rng.range(14, 20), curl = rng.range(0.6, 1.1);
    const pts = [];
    for (let k = 0; k <= 5; k++) {
      const t = k / 5, a = a0 + curl * t * t;
      pts.push([Math.cos(a) * len * t + 4, Math.sin(a) * len * t]);
    }
    chain(out, T, pts, 2.4, 0.4);
  }
}

// Loose splinters scattered round the cell: short, thin, any angle.
function fragments(rng, gx, gy, out, n = 3) {
  for (let i = 0; i < n; i++) {
    const x = gx * CELL + rng.range(8, CELL - 8), y = gy * CELL + rng.range(8, CELL - 8);
    const a = rng.range(0, Math.PI), l = rng.range(2.5, 5.5);
    out.push(capsule(x - Math.cos(a) * l, y - Math.sin(a) * l, x + Math.cos(a) * l, y + Math.sin(a) * l, rng.range(1, 1.6), rng.range(0.7, 1.2)));
    if (rng.chance(0.5)) out.push(circle(x + Math.cos(a) * l, y + Math.sin(a) * l, 1.6));
  }
}

// Bounding boxes for each piece and the whole find.
function bound(bones, holes) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of bones) {
    const r = (b.k === 'cap' ? Math.max(b.r0, b.r1) : b.k === 'circ' ? b.r : Math.max(b.rx, b.ry)) + 4;
    const xs = b.k === 'cap' ? [b.ax, b.bx] : [b.x], ys = b.k === 'cap' ? [b.ay, b.by] : [b.y];
    b.bx0 = Math.min(...xs) - r; b.bx1 = Math.max(...xs) + r; b.by0 = Math.min(...ys) - r; b.by1 = Math.max(...ys) + r;
    x0 = Math.min(x0, b.bx0); x1 = Math.max(x1, b.bx1); y0 = Math.min(y0, b.by0); y1 = Math.max(y1, b.by1);
  }
  return { bones, holes, x0, x1, y0, y1 };
}

// The find in one cell (or null), with its bounding box. Kept in a small cache.
function cellFind(gx, gy) {
  const key = `${gx},${gy}`;
  if (cache.has(key)) return cache.get(key);
  if (cache.size > 600) cache.clear();
  const hsh = hashInts(gx, gy, 61);
  const rng = new SeededRandom(hsh);
  const kind = hsh % 12;
  let find = null;
  if (kind < 3) {
    // No skeleton here, only loose splinters of bone.
    const bones = [];
    fragments(rng, gx, gy, bones, 5);
    find = bound(bones, []);
  } else {
    const cx = gx * CELL + CELL / 2 + rng.range(-12, 12), cy = gy * CELL + CELL / 2 + rng.range(-12, 12);
    const bones = [], holes = [];
    if (kind <= 4) ribcage(rng, cx, cy, bones, holes);
    else if (kind <= 6) skull(rng, cx, cy, bones, holes);
    else if (kind === 7) femurs(rng, cx, cy, bones);
    else if (kind === 8) vertebrae(rng, cx, cy, bones);
    else if (kind === 9) claws(rng, cx, cy, bones);
    else if (kind === 10) { femurs(rng, cx - 14, cy, bones); claws(rng, cx + 18, cy + 6, bones); }
    else { skull(rng, cx + 16, cy - 8, bones, holes); vertebrae(rng, cx - 18, cy + 10, bones); }
    fragments(rng, gx, gy, bones);
    find = bound(bones, holes);
  }
  cache.set(key, find);
  return find;
}

// Signed distance (negative inside) and the up/down part of the surface normal.
function dist(b, x, y) {
  if (b.k === 'cap') {
    const dx = b.bx - b.ax, dy = b.by - b.ay;
    const t = Math.max(0, Math.min(1, ((x - b.ax) * dx + (y - b.ay) * dy) / (dx * dx + dy * dy || 1)));
    const qx = b.ax + dx * t, qy = b.ay + dy * t;
    const d = Math.hypot(x - qx, y - qy);
    return { d: d - (b.r0 + (b.r1 - b.r0) * t), ny: d ? (y - qy) / d : 0, r: b.r0 };
  }
  if (b.k === 'circ') {
    const d = Math.hypot(x - b.x, y - b.y);
    return { d: d - b.r, ny: d ? (y - b.y) / d : 0, r: b.r };
  }
  const c = Math.cos(-b.rot), s = Math.sin(-b.rot);
  const u = ((x - b.x) * c - (y - b.y) * s) / b.rx, v = ((x - b.x) * s + (y - b.y) * c) / b.ry;
  const len = Math.hypot(u, v);
  return { d: (len - 1) * Math.min(b.rx, b.ry), ny: len ? v / len : 0, r: Math.min(b.rx, b.ry) };
}

// Recolours the rock pixel p (see wallOverlays.js) where a fossil lies.
export function shadeFossil(p) {
  const { pal } = p;
  const x = p.x, y = p.wy;
  // A find can reach over its cell's edge, so look at the neighbours too.
  const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
  let best = null, find = null;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const f = cellFind(gx + i, gy + j);
    if (!f || x < f.x0 || x > f.x1 || y < f.y0 || y > f.y1) continue;
    for (const b of f.bones) {
      if (x < b.bx0 || x > b.bx1 || y < b.by0 || y > b.by1) continue;
      const q = dist(b, x, y);
      if (!best || q.d < best.d) { best = q; find = f; }
    }
  }
  if (!best || best.d > 3) return;
  if (best.d > 0) {
    // The hollow the bone lies in: deep shadow under it, a thin one above.
    const k = 1 - best.d / 3;
    p.c = lerpColor(p.c, pal.rock[0], best.ny > 0.1 ? 0.65 * k : best.d < 1.2 ? 0.3 : 0);
    return;
  }
  for (const h of find.holes) {
    const q = dist(h, x, y);
    if (q.d > 0) continue;
    p.c = pal.rock[0];
    if (h.ember && q.d < -h.r * 0.45) p.c = q.d < -h.r * 0.75 ? 0xffd27a : pal.accentC;
    return;
  }
  // Bone: lit along the top, shaded underneath, a darker rim, old stains and cracks.
  let c = best.ny < -0.35 ? pal.accentB : best.ny > 0.45 ? lerpColor(pal.accentA, pal.rock[2], 0.5) : pal.accentA;
  if (best.d > -0.9) c = lerpColor(c, pal.rock[1], best.ny > 0 ? 0.6 : 0.25);
  if (bayer(x, y) < 0.18 && (hashInts(Math.floor(x / 5), Math.floor(y / 5), 71) & 3) === 0) c = lerpColor(c, 0x9a8466, 0.45);
  if ((hashInts(x, y, 73) & 127) === 0) c = lerpColor(c, pal.rock[1], 0.7);
  p.c = c;
}
