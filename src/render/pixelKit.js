// A small kit for painting lit, rounded pixel art from flat shapes.
//
// Draw a shape into a PixelGrid with a marker value (any small integer), then
// call shade() to turn it into a dithered gradient: the edge facing the light
// (top left by default) gets a highlight, the far edge falls into shadow, and
// the middle is the base tone. Different markers are shaded separately, so a
// head drawn over a body keeps its own roundness.
import { bayer, lerpColor } from '../utils/color.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// A colour from a ramp (dark to light) at t in 0..1, dithered between steps.
export function rampAt(list, t, x, y) {
  const f = clamp(t, 0, 0.999) * (list.length - 1);
  const i = Math.floor(f);
  return list[Math.min(list.length - 1, i + (f - i > bayer(x, y) ? 1 : 0))];
}

// A ramp of n steps from dark to light through base.
export function makeRamp(dark, base, light, n = 5) {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return t < 0.5 ? lerpColor(dark, base, t * 2) : lerpColor(base, light, (t - 0.5) * 2);
  });
}

// Shades every pixel holding `marker` with `ramp`.
// opts.light: unit vector towards the light (screen space, y down).
// opts.r: how far (px) to look for the edge; bigger = softer, rounder.
// opts.base: tone of the flat middle (0..1); opts.depth: how strong the edges are.
// opts.bias(x, y): extra brightness per pixel (patterns, scales...).
export function shade(g, marker, ramp, opts = {}) {
  const L = opts.light || [-0.55, -0.83];
  const r = opts.r || 3, base = opts.base ?? 0.55, depth = opts.depth ?? 0.42;
  const src = g.px.slice();
  const inside = (x, y) => x >= 0 && y >= 0 && x < g.w && y < g.h && src[y * g.w + x] === marker;
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (src[y * g.w + x] !== marker) continue;
      // Outward normal: the average direction to pixels outside the shape.
      let nx = 0, ny = 0, out = 0;
      for (let j = -r; j <= r; j++) {
        for (let i = -r; i <= r; i++) {
          if (i * i + j * j > r * r || inside(x + i, y + j)) continue;
          const w = 1 / (i * i + j * j);
          nx += i * w; ny += j * w; out += w;
        }
      }
      let k = base;
      if (out > 0) {
        const len = Math.hypot(nx, ny) || 1;
        const edge = clamp(out / 1.4, 0, 1);
        k += ((nx / len) * L[0] + (ny / len) * L[1]) * depth * edge;
      }
      if (opts.bias) k += opts.bias(x, y);
      g.set(x, y, rampAt(ramp, k, x, y));
    }
  }
}

// Fills a polygon [[x, y], ...] with c.
export function poly(g, pts, c) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y + 0.5) !== (yj > y + 0.5) && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) g.set(x, y, c);
    }
  }
}

// A tapering stroke along a quadratic curve a -> (bent towards) c -> b.
export function stroke(g, a, c, b, w0, w1, color) {
  const n = Math.max(12, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2));
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const x = u * u * a[0] + 2 * u * t * c[0] + t * t * b[0];
    const y = u * u * a[1] + 2 * u * t * c[1] + t * t * b[1];
    const rr = (w0 + (w1 - w0) * t) / 2;
    if (rr < 0.75) g.set(x, y, color);
    else g.ellipse(x, y, rr, rr, color);
  }
}

// Replaces every pixel of one marker/colour with another.
export function swap(g, from, to) {
  for (let i = 0; i < g.px.length; i++) if (g.px[i] === from) g.px[i] = to;
}

// A one-pixel outline in c round everything, then the lower-right rim of the
// outline nudged darker... and a "selout": where the outline touches a light
// colour it is softened towards that colour (less harsh than pure ink).
export function outline(g, c, soft = 0.25) {
  const src = g.px.slice();
  const at = (x, y) => (x >= 0 && y >= 0 && x < g.w && y < g.h ? src[y * g.w + x] : null);
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (src[y * g.w + x] !== null) continue;
      const n = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].filter((v) => v !== null && v > 255);
      if (!n.length) continue;
      // Top-left edges (light side) get a softer outline.
      const lit = at(x + 1, y) !== null || at(x, y + 1) !== null;
      g.px[y * g.w + x] = lit && soft ? lerpColor(c, n[0], soft) : c;
    }
  }
}
