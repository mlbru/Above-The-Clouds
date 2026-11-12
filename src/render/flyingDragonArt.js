// The dragon in flight, side on, for the crossing (ui/DragonFlight.js): a
// long, old, heavy dragon. A long S-curved neck reaching forward to a narrow
// horned head, a deep chest, a long whip of a tail ending in a spade, legs
// tucked up under it, and huge bat wings with finger bones and scalloped
// skin. Near-black crimson scales lit from above with a hot rim, pale belly
// plates the whole length of it, a ridge of spines, lava cracks that stay
// put on the scales (a separate glow sheet, lit with ADD).
// Sheets: 'fdragon' (jaw shut) and 'fdragon_roar' (jaw open), FLY.frames
// frames each, one flap cycle; 'fdragon_glow' for the cracks and the eye.
// FLY.meta[i]: { saddle, mouth } in frame coordinates.
import { PixelGrid, makeCanvas } from '../utils/pixelGrid.js';
import { lerpColor, bayer } from '../utils/color.js';
import { DRAGON_PAL as P, lcg, drawHead, HEAD_NECK, HEAD_MOUTH, JAWS } from './dragonArt.js';
import { stroke, poly, shade, makeRamp, rampAt } from './pixelKit.js';

const FW = 446, FH = 380;
const FRAMES = 12;
const BODY = 1, BELLY = 2, MEMB = 3, MEMB_FAR = 4, BONE = 5, BONE_FAR = 6, HORN = 7, SPINE = 8, TIP = 9, LIMB = 10, LIMB_FAR = 11, EDGE = 12, VEIN = 13, HEAD = 14, MOUTH = 15, TOOTH = 16;
const smooth = (a, b, t) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
const lerp = (a, b, t) => a + (b - a) * t;
// Where the neck ends and the body ends (fractions of the length).
const NECK_END = 0.27, BODY_END = 0.53;

export const FLY = { W: FW, H: FH, frames: FRAMES, meta: [] };

function radius(u) {
  if (u < NECK_END) return lerp(7.5, 13, smooth(0, NECK_END, u));
  if (u < 0.4) return lerp(13, 20, smooth(NECK_END, 0.4, u));
  if (u < BODY_END) return lerp(20, 15, smooth(0.4, BODY_END, u));
  return 0.8 + 14.2 * Math.pow(1 - (u - BODY_END) / (1 - BODY_END), 1.45);
}

const cubic = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
};

// The whole spine, head to tail tip, resampled evenly along its length.
function spine(phase) {
  const raw = [];
  const bob = Math.sin(phase) * 3;
  const head = [368, 178 + bob * 0.6], shoulder = [268, 238 + bob], hips = [164, 242 + bob * 0.5];
  // The neck: an S from the head back and down to the shoulders.
  for (let i = 0; i <= 60; i++) raw.push(cubic(head, [338, 182 + bob], [306, 250 + bob], shoulder, i / 60));
  // The body, slung between the shoulders and the hips.
  for (let i = 1; i <= 50; i++) { const t = i / 50; raw.push([lerp(shoulder[0], hips[0], t), lerp(shoulder[1], hips[1], t) + Math.sin(t * Math.PI) * 5]); }
  // The tail: long, a wave running down it, the end flicking up.
  for (let i = 1; i <= 120; i++) {
    const t = i / 120;
    raw.push([hips[0] - t * 160, hips[1] + t * 6 + Math.sin(t * Math.PI * 2.2 - phase) * (2 + 12 * t * t) - 16 * smooth(0.82, 1, t)]);
  }
  const acc = [0];
  for (let i = 1; i < raw.length; i++) acc.push(acc[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
  const total = acc[acc.length - 1], N = 460, pts = [];
  let j = 0;
  for (let k = 0; k <= N; k++) {
    const d = (k / N) * total;
    while (j < acc.length - 2 && acc[j + 1] < d) j++;
    const f = (d - acc[j]) / Math.max(1e-6, acc[j + 1] - acc[j]);
    pts.push({ x: lerp(raw[j][0], raw[j + 1][0], f), y: lerp(raw[j][1], raw[j + 1][1], f), u: k / N });
  }
  for (let i = 0; i <= N; i++) {
    const a = pts[Math.max(0, i - 3)], b = pts[Math.min(N, i + 3)];
    let tx = b.x - a.x, ty = b.y - a.y;
    const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    let nx = -ty, ny = tx;
    if (ny < 0) { nx = -nx; ny = -ny; }
    Object.assign(pts[i], { tx, ty, nx, ny, r: radius(pts[i].u) });
  }
  return pts;
}
const at = (pts, u) => pts[Math.round(Math.max(0, Math.min(1, u)) * (pts.length - 1))];

// Lava cracks laid out along the body (u along, v round), so they stay put.
const CRACKS = (() => {
  const rnd = lcg(1907), out = [];
  for (let k = 0; k < 34; k++) {
    let u = 0.05 + rnd() * 0.75, v = -0.8 + rnd() * 1.0;
    const path = [], n = 5 + Math.floor(rnd() * 8), du = (rnd() < 0.5 ? -1 : 1) * 0.0028;
    for (let i = 0; i < n; i++) { path.push([u, v]); u += du; if (rnd() < 0.4) v += (rnd() - 0.5) * 0.16; }
    out.push(path);
  }
  return out;
})();

// A wing: a heavy arm out to the wrist, four long fingers fanning back, the
// skin between them sagging into scallops along the trailing edge.
function wing(g, pts, e, far, off = [0, 0]) {
  const memb = far ? MEMB_FAR : MEMB, bone = far ? BONE_FAR : BONE;
  const c = at(pts, 0.31);
  const S = [c.x - c.nx * c.r * 0.6 + off[0], c.y - c.ny * c.r * 0.6 + off[1]];
  const se = Math.sin(e);
  const W = [S[0] + 16 - Math.abs(se) * 6, S[1] - 52 * se];
  const ANG = [104, 130, 154, 176].map((d) => (d * Math.PI) / 180);
  const LEN = [150, 134, 110, 84];
  const tips = ANG.map((th, i) => [W[0] + Math.cos(th) * LEN[i] * 1.2, W[1] - Math.sin(th) * LEN[i] * se * 0.86]);
  const a = at(pts, 0.56);
  const A = [a.x - a.nx * a.r * 0.7 + off[0], a.y - a.ny * a.r * 0.7 + off[1]];
  const pull = (p, q, k) => { const m = [lerp(p[0], q[0], 0.5), lerp(p[1], q[1], 0.5)]; return [m[0] + (W[0] - m[0]) * k, m[1] + (W[1] - m[1]) * k]; };
  const edge = [S, W, tips[0]];
  for (let i = 1; i < tips.length; i++) edge.push(pull(tips[i - 1], tips[i], 0.14), pull(tips[i - 1], tips[i], 0.26), pull(tips[i - 1], tips[i], 0.14), tips[i]);
  edge.push(pull(tips[3], A, 0.22), A);
  poly(g, edge, memb);
  for (let i = 1; i < tips.length; i++) stroke(g, W, W, pull(tips[i - 1], tips[i], 0.28), 1, 1, far ? BONE_FAR : VEIN);
  stroke(g, S, [lerp(S[0], W[0], 0.5) + 6, lerp(S[1], W[1], 0.5)], W, 7, 4, bone);
  tips.forEach((t, i) => stroke(g, W, [lerp(W[0], t[0], 0.45) + 3, lerp(W[1], t[1], 0.45)], t, 3 - i * 0.3, 1, bone));
  g.ellipse(W[0], W[1], 2.8, 2.8, bone);
  if (!far) {
    stroke(g, W, [W[0] + 5, W[1] - 5], [W[0] + 10, W[1] - 1], 2.6, 1, HORN);
    tips.forEach((t) => g.set(t[0], t[1], HORN));
  }
}

// A leg folded up in flight: thigh, shin, a clawed foot.
function leg(g, pts, u, front, mark) {
  const c = at(pts, u);
  const H = [c.x + c.nx * c.r * 0.5, c.y + c.ny * c.r * 0.5];
  const tx = c.tx, ty = c.ty;
  const K = front ? [H[0] - tx * 5 + c.nx * 12, H[1] - ty * 5 + c.ny * 12] : [H[0] - tx * 9 + c.nx * 10, H[1] - ty * 9 + c.ny * 10];
  const F = front ? [K[0] + tx * 10 + c.nx * 3, K[1] + ty * 10 + c.ny * 3] : [K[0] + tx * 18 + c.nx * 5, K[1] + ty * 18 + c.ny * 5];
  stroke(g, H, H, K, front ? 9 : 12, 6, mark);
  stroke(g, K, K, F, 6, 4, mark);
  for (let k = -1; k <= 1; k++) stroke(g, F, F, [F[0] + tx * 5 + k * 2, F[1] + ty * 5 + 4], 1.8, 1, HORN);
}

// The head is the wall dragon's own (render/dragonArt.js), drawn a little
// smaller, so the dragon you ride is the one that hunted you up the Spine.
const HS = 0.82;
const HEADS = {};
const headFor = (jaw) => (HEADS[jaw] ||= drawHead(jaw ? JAWS[3] : 0, HS));

function frame(i, jaw) {
  const phase = (i / FRAMES) * Math.PI * 2;
  const e = 0.18 + 1.18 * Math.cos(phase);
  const pts = spine(phase);
  const g = new PixelGrid(FW, FH), glow = new PixelGrid(FW, FH);
  // Behind: the far wing (lagging), the far legs.
  wing(g, spine(phase - 0.35), 0.18 + 1.18 * Math.cos(phase - 0.35), true, [12, -9]);
  leg(g, pts, 0.33, true, LIMB_FAR);
  leg(g, pts, 0.52, false, LIMB_FAR);
  // The body, pixel by pixel from the nearest spine sample.
  const best = new Float32Array(FW * FH).fill(1e9), vb = new Float32Array(FW * FH), ub = new Float32Array(FW * FH);
  for (const p of pts) {
    const r = p.r;
    for (let y = Math.floor(p.y - r - 1); y <= Math.ceil(p.y + r + 1); y++) {
      for (let x = Math.floor(p.x - r - 1); x <= Math.ceil(p.x + r + 1); x++) {
        if (x < 0 || y < 0 || x >= FW || y >= FH) continue;
        const dx = x + 0.5 - p.x, dy = y + 0.5 - p.y, d = Math.hypot(dx, dy);
        if (d > r || d >= best[y * FW + x]) continue;
        best[y * FW + x] = d;
        const v = (dx * p.nx + dy * p.ny) / r;
        vb[y * FW + x] = v; ub[y * FW + x] = p.u;
        g.set(x, y, v > 0.38 && p.u > 0.02 && p.u < 0.8 ? BELLY : BODY);
      }
    }
  }
  // Spines: small on the neck, tall over the shoulders, little blades on the tail.
  for (let u = 0.03; u < 0.95; u += 0.022) {
    const p = at(pts, u);
    const len = (u < NECK_END ? 3 : u < BODY_END ? 4.5 : 3) + p.r * 0.38;
    const b = [p.x - p.nx * p.r * 0.92, p.y - p.ny * p.r * 0.92];
    const tip = [b[0] - p.nx * len + p.tx * len * 0.75, b[1] - p.ny * len + p.ty * len * 0.75];
    stroke(g, b, [b[0] - p.nx * len * 0.6, b[1] - p.ny * len * 0.6], tip, Math.max(2, p.r * 0.32), 1, SPINE);
    g.set(tip[0], tip[1], TIP);
  }
  const tl = at(pts, 1), tl2 = at(pts, 0.975);
  poly(g, [[tl.x + 3, tl.y], [tl2.x - tl2.nx * 7, tl2.y - tl2.ny * 7], [tl.x - 12, tl.y - 3], [tl2.x + tl2.nx * 7, tl2.y + tl2.ny * 7]], SPINE);
  // In front: legs, the head, the near wing.
  leg(g, pts, 0.31, true, LIMB);
  leg(g, pts, 0.5, false, LIMB);
  wing(g, pts, e, false);
  // Seams where the near wing, legs or head cross the body.
  const src = g.px.slice();
  const isBody = (v) => v === BODY || v === BELLY;
  for (let y = 1; y < FH - 1; y++) for (let x = 1; x < FW - 1; x++) {
    const v = src[y * FW + x];
    if (v !== MEMB && v !== LIMB && v !== BONE) continue;
    if ([src[y * FW + x - 1], src[y * FW + x + 1], src[(y - 1) * FW + x], src[(y + 1) * FW + x]].some(isBody)) g.px[y * FW + x] = EDGE;
  }
  for (const path of CRACKS) path.forEach(([u, v], j) => {
    const p = at(pts, u);
    const x = Math.round(p.x + p.nx * v * p.r), y = Math.round(p.y + p.ny * v * p.r);
    if (g.get(x, y) !== BODY) return;
    g.set(x, y, P.crack);
    glow.set(x, y, j % 4 === 0 ? 0xffffff : 0xffc080);
  });

  // ---- shading
  const memb = [0x1e060c, P.membrane[0], P.membrane[1], P.membrane[2], 0x7a2228, 0x963428];
  const membFar = memb.map((c) => lerpColor(c, 0x12040a, 0.45));
  const limbRamp = makeRamp(P.ramp[0], P.ramp[2], P.ramp[4], 5);
  const limbFar = limbRamp.map((c) => lerpColor(c, 0x0a0206, 0.4));
  let wTop = FH, wBot = 0;
  for (let k = 0; k < g.px.length; k++) if (g.px[k] === MEMB || g.px[k] === MEMB_FAR) { const y = Math.floor(k / FW); wTop = Math.min(wTop, y); wBot = Math.max(wBot, y); }
  const pre = g.px.slice();
  const boneDist = new Float32Array(FW * FH).fill(99);
  {
    const q = [];
    for (let k = 0; k < pre.length; k++) if (pre[k] === BONE || pre[k] === BONE_FAR || pre[k] === VEIN || pre[k] === EDGE) { boneDist[k] = 0; q.push(k); }
    for (let h = 0; h < q.length; h++) {
      const k = q[h], x = k % FW, y = (k - x) / FW;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= FW || ny >= FH) continue;
        const nn = ny * FW + nx;
        if ((pre[nn] === MEMB || pre[nn] === MEMB_FAR) && boneDist[nn] > boneDist[k] + 1) { boneDist[nn] = boneDist[k] + 1; q.push(nn); }
      }
    }
  }
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    const v = pre[y * FW + x];
    if (v === BODY) {
      const t = (vb[y * FW + x] + 1) / 2;
      let k = 0.8 - t * 0.82;
      const row = Math.floor(y / 3), sx = (x + (row % 2) * 2) % 4, sy = y % 3;
      if (sy === 2 && sx !== 0) k -= 0.2; else if (sy === 0 && sx === 1) k += 0.12;
      g.set(x, y, vb[y * FW + x] < -0.84 && (x + y) % 3 !== 0 ? P.rim : rampAt(P.ramp, k, x, y));
    } else if (v === BELLY) {
      const arc = ub[y * FW + x] * 400;
      const t = (vb[y * FW + x] - 0.38) / 0.62;
      g.set(x, y, arc % 3.6 < 1 ? P.belly[0] : rampAt(P.belly, 0.95 - t * 0.7, x, y));
    } else if (v === MEMB || v === MEMB_FAR) {
      const d = boneDist[y * FW + x];
      const k = 0.28 + Math.min(d, 8) / 8 * 0.55 - ((y - wTop) / Math.max(1, wBot - wTop)) * 0.18 + (bayer(x, y) - 0.5) * 0.1;
      g.set(x, y, rampAt(v === MEMB ? memb : membFar, k, x, y));
    } else if (v === VEIN) g.set(x, y, P.vein);
    else if (v === BONE) {
      const pb = (xx, yy) => pre[yy * FW + xx] === BONE;
      g.set(x, y, !pb(x, y - 1) || !pb(x - 1, y) ? P.ramp[4] : !pb(x, y + 1) ? P.ramp[1] : P.ramp[3]);
    } else if (v === BONE_FAR) g.set(x, y, P.ramp[0]);
    else if (v === SPINE) g.set(x, y, P.spine);
    else if (v === TIP) g.set(x, y, P.spineTip);
    else if (v === EDGE) g.set(x, y, P.outline);
    else if (v === MOUTH) g.set(x, y, P.mouth);
    else if (v === TOOTH) g.set(x, y, P.tooth);
  }
  shade(g, LIMB, limbRamp, { r: 2, base: 0.5 });
  shade(g, LIMB_FAR, limbFar, { r: 2, base: 0.4 });
  shade(g, HORN, P.horn, { r: 1, base: 0.6 });
  // The head, laid over the end of the neck, its cracks and eye in the glow.
  const n0 = at(pts, 0), hd = headFor(jaw);
  const ox = Math.round(n0.x - HEAD_NECK.x * HS), oy = Math.round(n0.y - HEAD_NECK.y * HS);
  for (let y = 0; y < hd.g.h; y++) for (let x = 0; x < hd.g.w; x++) {
    const c = hd.g.get(x, y);
    if (c !== null) g.set(ox + x, oy + y, c);
    const c2 = hd.glow.get(x, y);
    if (c2 !== null) glow.set(ox + x, oy + y, c2);
  }
  const mouth = [ox + HEAD_MOUTH.x * HS, oy + HEAD_MOUTH.y * HS];
  g.outline(P.outline);
  const sd = at(pts, 0.29);
  FLY.meta[i] = { saddle: [sd.x - sd.nx * (sd.r - 1), sd.y - sd.ny * (sd.r - 1)], mouth };
  return { g, glow };
}

export function buildFlyingDragon(scene) {
  if (scene.textures.exists('fdragon')) return;
  const sheets = { fdragon: makeCanvas(FW * FRAMES, FH), fdragon_roar: makeCanvas(FW * FRAMES, FH), fdragon_glow: makeCanvas(FW * FRAMES, FH) };
  for (let i = 0; i < FRAMES; i++) {
    const shut = frame(i, 0);
    shut.g.drawTo(sheets.fdragon.getContext('2d'), i * FW, 0);
    shut.glow.drawTo(sheets.fdragon_glow.getContext('2d'), i * FW, 0);
    frame(i, 1).g.drawTo(sheets.fdragon_roar.getContext('2d'), i * FW, 0);
  }
  for (const [key, c] of Object.entries(sheets)) {
    const tex = scene.textures.addCanvas(key, c);
    for (let i = 0; i < FRAMES; i++) tex.add(i, 0, i * FW, 0, FW, FH);
  }
}
