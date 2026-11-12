// The dragon in flight, side on, for the crossing (ui/DragonFlight.js). It is
// the Spine dragon's own body seen from the side: near-black crimson scales
// lit from above with a hot rim, a column of pale belly plates, a ridge of
// spines down the back, forelegs and hind legs tucked up under it, smouldering
// lava cracks (a separate glow sheet, lit with ADD), and two great bat wings
// with finger bones and a scalloped trailing edge, through a full flap cycle.
// The head is the Spine dragon's own head texture, attached at NECK.
// Frames: FLY.frames; per frame FLY.meta[i].saddle is where the rider sits.
import { PixelGrid, makeCanvas } from '../utils/pixelGrid.js';
import { lerpColor, bayer } from '../utils/color.js';
import { DRAGON_PAL as P, lcg } from './dragonArt.js';
import { stroke, poly, shade, makeRamp, rampAt } from './pixelKit.js';

const FW = 214, FH = 236;
const NECK = [188, 118];
const FRAMES = 12;
const BODY = 1, BELLY = 2, MEMB = 3, MEMB_FAR = 4, BONE = 5, BONE_FAR = 6, HORN = 7, SPINE = 8, TIP = 9, LIMB = 10, LIMB_FAR = 11, EDGE = 12, VEIN = 13;
const LEN = 176;
const smooth = (a, b, t) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
const lerp = (a, b, t) => a + (b - a) * t;

export const FLY = { W: FW, H: FH, neck: NECK, frames: FRAMES, meta: [] };

// Lava cracks, laid out once along the body (u along, v round) so they stay
// put on the scales from frame to frame.
const CRACKS = (() => {
  const rnd = lcg(1907), out = [];
  for (let k = 0; k < 22; k++) {
    let u = 0.06 + rnd() * 0.72, v = -0.75 + rnd() * 0.95;
    const path = [], n = 5 + Math.floor(rnd() * 7), du = (rnd() < 0.5 ? -1 : 1) * 0.0045;
    for (let i = 0; i < n; i++) { path.push([u, v]); u += du; if (rnd() < 0.4) v += (rnd() - 0.5) * 0.18; }
    out.push(path);
  }
  return out;
})();

// Body radius along the spine (u: 0 at the neck joint, 1 at the tail tip).
function radius(u) {
  if (u < 0.2) return lerp(8, 12.5, smooth(0, 0.2, u));
  if (u < 0.42) return lerp(12.5, 13.5, (u - 0.2) / 0.22);
  if (u < 0.58) return lerp(13.5, 10, (u - 0.42) / 0.16);
  return 0.8 + 9.2 * Math.pow(1 - (u - 0.58) / 0.42, 1.35);
}

// The spine: from the neck joint back to the tail, rising out of the
// shoulders to the head, a travelling wave down the tail, the tip curling up.
function spine(phase) {
  const N = 240, pts = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const x = NECK[0] - u * LEN;
    const y = NECK[1] + 20 * smooth(0, 0.22, u)
      + Math.sin(u * Math.PI * 2.3 - phase) * (0.6 + 9 * u * u)
      + Math.sin(phase) * 2 * (1 - u)
      - 12 * smooth(0.82, 1, u);
    pts.push({ x, y, u, r: radius(u) });
  }
  for (let i = 0; i <= N; i++) {
    const a = pts[Math.max(0, i - 2)], b = pts[Math.min(N, i + 2)];
    let tx = b.x - a.x, ty = b.y - a.y;
    const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    let nx = -ty, ny = tx;
    if (ny < 0) { nx = -nx; ny = -ny; }
    Object.assign(pts[i], { tx, ty, nx, ny });
  }
  return pts;
}
const at = (pts, u) => pts[Math.round(u * (pts.length - 1))];

// A wing: arm from the shoulder to the wrist, four fingers fanning back, the
// membrane between them scalloped along its trailing edge.
function wing(g, pts, e, far, off = [0, 0]) {
  const memb = far ? MEMB_FAR : MEMB, bone = far ? BONE_FAR : BONE;
  const c = at(pts, 0.22);
  const S = [c.x - c.nx * c.r * 0.55 + off[0], c.y - c.ny * c.r * 0.55 + off[1]];
  const se = Math.sin(e);
  // The arm reaches out (seen from the side: up, or down on the downstroke),
  // a little forward; the fingers fan back from the wrist like a bat's.
  const W = [S[0] + 5 - Math.abs(se) * 4, S[1] - 44 * se];
  const ANG = [94, 122, 150, 176].map((d) => (d * Math.PI) / 180);
  const LEN = [64, 60, 50, 38];
  // Back along the body the wing keeps its full breadth; up and down it is
  // foreshortened with the beat.
  const tips = ANG.map((th, i) => [W[0] + Math.cos(th) * LEN[i] * 1.45, W[1] - Math.sin(th) * LEN[i] * se]);
  const a = at(pts, 0.55);
  const A = [a.x - a.nx * a.r * 0.75 + off[0], a.y - a.ny * a.r * 0.75 + off[1]];
  // Scallops: the trailing edge sags towards the wrist between fingers.
  const pull = (p, q, k) => { const m = [lerp(p[0], q[0], 0.5), lerp(p[1], q[1], 0.5)]; return [m[0] + (W[0] - m[0]) * k, m[1] + (W[1] - m[1]) * k]; };
  const edge = [S, W, tips[0]];
  for (let i = 1; i < tips.length; i++) {
    edge.push(pull(tips[i - 1], tips[i], 0.16), pull(tips[i - 1], tips[i], 0.3), pull(tips[i - 1], tips[i], 0.16));
    edge.push(tips[i]);
  }
  edge.push(pull(tips[3], A, 0.28), A);
  poly(g, edge, memb);
  // Fine veins running out to the scallops.
  for (let i = 1; i < tips.length; i++) stroke(g, W, W, pull(tips[i - 1], tips[i], 0.32), 1, 1, bone === BONE ? VEIN : BONE_FAR);
  // Bones: a heavy arm and four tapering fingers with a knuckle at the wrist.
  stroke(g, S, [lerp(S[0], W[0], 0.5) + 5, lerp(S[1], W[1], 0.5)], W, 6, 3.5, bone);
  tips.forEach((t, i) => stroke(g, W, [lerp(W[0], t[0], 0.45) + 2, lerp(W[1], t[1], 0.45)], t, 2.6 - i * 0.25, 1, bone));
  g.ellipse(W[0], W[1], 2.2, 2.2, bone);
  // A hooked thumb claw at the wrist, and claws on the finger tips.
  if (!far) {
    stroke(g, W, [W[0] + 4, W[1] - 4], [W[0] + 8, W[1] - 1], 2.2, 1, HORN);
    g.set(tips[0][0], tips[0][1], HORN);
  }
  return { S, W, tips };
}

// A leg: thigh, shin and a clawed foot, folded up in flight.
function leg(g, pts, u, front, mark) {
  const c = at(pts, u);
  const H = [c.x + c.nx * c.r * 0.5, c.y + c.ny * c.r * 0.5];
  const tx = c.tx, ty = c.ty;
  let K, F;
  if (front) { K = [H[0] - tx * 4 + c.nx * 9, H[1] - ty * 4 + c.ny * 9]; F = [K[0] + tx * 8 + c.nx * 2, K[1] + ty * 8 + c.ny * 2]; }
  else { K = [H[0] - tx * 7 + c.nx * 8, H[1] - ty * 7 + c.ny * 8]; F = [K[0] + tx * 14 + c.nx * 4, K[1] + ty * 14 + c.ny * 4]; }
  stroke(g, H, H, K, front ? 7 : 9, 5, mark);
  stroke(g, K, K, F, 5, 3, mark);
  for (let k = -1; k <= 1; k++) stroke(g, F, F, [F[0] + tx * 4 + k * 2, F[1] + ty * 4 + 3], 1.5, 1, HORN);
}

function frame(i) {
  const phase = (i / FRAMES) * Math.PI * 2;
  const e = 0.2 + 1.15 * Math.cos(phase); // wing elevation: up at 0, down at PI
  const pts = spine(phase);
  const g = new PixelGrid(FW, FH), glow = new PixelGrid(FW, FH);
  // Behind the body: the far wing (lagging a touch) and the far legs.
  wing(g, spine(phase - 0.35), 0.2 + 1.15 * Math.cos(phase - 0.35), true, [9, -7]);
  leg(g, pts, 0.3, true, LIMB_FAR);
  leg(g, pts, 0.58, false, LIMB_FAR);
  // The body: each pixel keeps the nearest spine sample, and remembers how far
  // round the body it is (v: -1 top .. 1 belly) and how far along (u).
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
        g.set(x, y, v > 0.4 && p.u > 0.03 && p.u < 0.84 ? BELLY : BODY);
      }
    }
  }
  // Spines down the back, longest over the shoulders.
  for (let u = 0.03; u < 0.9; u += 0.034) {
    const p = at(pts, u);
    const len = 2.5 + p.r * 0.42;
    const b = [p.x - p.nx * p.r * 0.9, p.y - p.ny * p.r * 0.9];
    const tip = [b[0] - p.nx * len + p.tx * len * 0.7, b[1] - p.ny * len + p.ty * len * 0.7];
    stroke(g, b, [b[0] - p.nx * len * 0.6, b[1] - p.ny * len * 0.6], tip, Math.max(2, p.r * 0.35), 1, SPINE);
    g.set(tip[0], tip[1], TIP);
  }
  // The tail's spade.
  const tl = at(pts, 1), tl2 = at(pts, 0.96);
  poly(g, [[tl.x + 2, tl.y], [tl2.x - tl2.nx * 5, tl2.y - tl2.ny * 5], [tl.x - 9, tl.y - 2], [tl2.x + tl2.nx * 5, tl2.y + tl2.ny * 5]], SPINE);
  // In front: the near legs, then the near wing.
  leg(g, pts, 0.28, true, LIMB);
  leg(g, pts, 0.56, false, LIMB);
  wing(g, pts, e, false);
  // Where the near wing or a leg crosses the body, a dark seam so it reads.
  const src = g.px.slice();
  const isBody = (v) => v === BODY || v === BELLY;
  for (let y = 1; y < FH - 1; y++) {
    for (let x = 1; x < FW - 1; x++) {
      const v = src[y * FW + x];
      if (v !== MEMB && v !== LIMB && v !== BONE) continue;
      if ([src[y * FW + x - 1], src[y * FW + x + 1], src[(y - 1) * FW + x], src[(y + 1) * FW + x]].some(isBody)) g.px[y * FW + x] = EDGE;
    }
  }
  // Lava cracks in the scales (dark in the sprite, bright in the glow sheet).
  for (const path of CRACKS) {
    path.forEach(([u, v], j) => {
      const p = at(pts, u);
      const x = Math.round(p.x + p.nx * v * p.r), y = Math.round(p.y + p.ny * v * p.r);
      if (g.get(x, y) !== BODY) return;
      g.set(x, y, P.crack);
      glow.set(x, y, j % 4 === 0 ? 0xffffff : 0xffc080);
    });
  }

  // ---- shading
  const memb = [0x1e060c, P.membrane[0], P.membrane[1], P.membrane[2], 0x8a2a30, 0xb04234, 0xd8664a];
  const membFar = memb.map((c) => lerpColor(c, 0x12040a, 0.45));
  const limbRamp = makeRamp(P.ramp[0], P.ramp[2], P.ramp[4], 5);
  const limbFar = limbRamp.map((c) => lerpColor(c, 0x0a0206, 0.4));
  const wb = wingBounds(g);
  const pre = g.px.slice();
  const boneDist = new Float32Array(FW * FH).fill(99);
  {
    const q = [];
    for (let k = 0; k < g.px.length; k++) if (g.px[k] === BONE || g.px[k] === BONE_FAR || g.px[k] === VEIN || g.px[k] === EDGE) { boneDist[k] = 0; q.push(k); }
    for (let h = 0; h < q.length; h++) {
      const k = q[h], x = k % FW, y = (k - x) / FW;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= FW || ny >= FH) continue;
        const n = ny * FW + nx, pv = g.px[n];
        if ((pv === MEMB || pv === MEMB_FAR) && boneDist[n] > boneDist[k] + 1) { boneDist[n] = boneDist[k] + 1; q.push(n); }
      }
    }
  }
  for (let y = 0; y < FH; y++) {
    for (let x = 0; x < FW; x++) {
      const v = g.get(x, y);
      if (v === BODY) {
        const t = (vb[y * FW + x] + 1) / 2;
        let k = 0.9 - t * 0.88;
        const row = Math.floor(y / 3), sx = (x + (row % 2) * 2) % 4, sy = y % 3;
        if (sy === 2 && sx !== 0) k -= 0.2; else if (sy === 0 && sx === 1) k += 0.12;
        g.set(x, y, vb[y * FW + x] < -0.84 && (x + y) % 3 !== 0 ? P.rim : rampAt(P.ramp, k, x, y));
      } else if (v === BELLY) {
        const arc = ub[y * FW + x] * LEN;
        const line = arc % 3.4 < 1;
        const t = (vb[y * FW + x] - 0.4) / 0.6;
        g.set(x, y, line ? P.belly[0] : rampAt(P.belly, 0.95 - t * 0.7, x, y));
      } else if (v === MEMB || v === MEMB_FAR) {
        // Thin skin: the light glows through the middle of each panel and
        // darkens towards the bones and the trailing edge.
        const d = boneDist[y * FW + x];
        let k = 0.28 + Math.min(d, 7) / 7 * 0.55 - ((y - wb.top) / Math.max(1, wb.bot - wb.top)) * 0.18 + (bayer(x, y) - 0.5) * 0.1;
        g.set(x, y, rampAt(v === MEMB ? memb : membFar, k, x, y));
      } else if (v === VEIN) {
        g.set(x, y, P.vein);
      } else if (v === BONE) {
        // Bones: a lit ridge on the side facing the light, dark beneath.
        const pb = (xx, yy) => pre[yy * FW + xx] === BONE;
        const lit = !pb(x, y - 1) || !pb(x - 1, y);
        const under = !pb(x, y + 1);
        g.set(x, y, lit ? 0xc8784e : under ? 0x3a0e12 : 0x8a3a2a);
      } else if (v === BONE_FAR) g.set(x, y, P.ramp[0]);
      else if (v === SPINE) g.set(x, y, P.spine);
      else if (v === TIP) g.set(x, y, P.spineTip);
      else if (v === EDGE) g.set(x, y, P.outline);
    }
  }
  shade(g, LIMB, limbRamp, { r: 2, base: 0.5 });
  shade(g, LIMB_FAR, limbFar, { r: 2, base: 0.4 });
  shade(g, HORN, P.horn, { r: 1, base: 0.6 });
  g.outline(P.outline);
  const saddle = at(pts, 0.15);
  FLY.meta[i] = { saddle: [saddle.x - saddle.nx * (saddle.r - 1), saddle.y - saddle.ny * (saddle.r - 1)] };
  return { g, glow };
}

function wingBounds(g) {
  let top = g.h, bot = 0;
  for (let i = 0; i < g.px.length; i++) if (g.px[i] === MEMB || g.px[i] === MEMB_FAR) { const y = Math.floor(i / g.w); top = Math.min(top, y); bot = Math.max(bot, y); }
  return { top, bot };
}

export function buildFlyingDragon(scene) {
  if (scene.textures.exists('fdragon')) return;
  const sheet = makeCanvas(FW * FRAMES, FH), glowSheet = makeCanvas(FW * FRAMES, FH);
  for (let i = 0; i < FRAMES; i++) {
    const { g, glow } = frame(i);
    g.drawTo(sheet.getContext('2d'), i * FW, 0);
    glow.drawTo(glowSheet.getContext('2d'), i * FW, 0);
  }
  for (const [key, c] of [['fdragon', sheet], ['fdragon_glow', glowSheet]]) {
    const tex = scene.textures.addCanvas(key, c);
    for (let i = 0; i < FRAMES; i++) tex.add(i, 0, i * FW, 0, FW, FH);
  }
}
// lcg is re-exported for callers that want the same seeded noise.
export { lcg };
