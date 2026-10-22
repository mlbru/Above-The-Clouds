import { rgb, darken } from './color.js';

// Tiny raster used to draw procedural pixel-art sprites. Pixels hold 0xRRGGBB
// colours or null (transparent).
export class PixelGrid {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Array(w * h).fill(null);
  }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  set(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (this.inside(x, y)) this.px[y * this.w + x] = c;
  }
  get(x, y) { return this.inside(x, y) ? this.px[y * this.w + x] : null; }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  ellipse(cx, cy, rx, ry, c) {
    for (let j = Math.floor(cy - ry); j <= Math.ceil(cy + ry); j++) {
      for (let i = Math.floor(cx - rx); i <= Math.ceil(cx + rx); i++) {
        const u = (i + 0.5 - cx) / rx, v = (j + 0.5 - cy) / ry;
        if (u * u + v * v <= 1) this.set(i, j, c);
      }
    }
  }
  line(x0, y0, x1, y1, c, thick = 1) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 2;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      if (thick <= 1) this.set(x, y, c);
      else {
        const o = (thick - 1) / 2;
        for (let j = 0; j < thick; j++) for (let i = 0; i < thick; i++) this.set(Math.round(x - o + i), Math.round(y - o + j), c);
      }
    }
  }
  // Fill transparent pixels that touch a filled pixel (4-neighbourhood).
  outline(c) {
    const src = this.px.slice();
    const at = (x, y) => (x >= 0 && y >= 0 && x < this.w && y < this.h ? src[y * this.w + x] : null);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (src[y * this.w + x] !== null) continue;
        if (at(x - 1, y) !== null || at(x + 1, y) !== null || at(x, y - 1) !== null || at(x, y + 1) !== null) {
          this.px[y * this.w + x] = c;
        }
      }
    }
  }
  // Darken pixels on the lower-right silhouette edge for a light-from-top-left look.
  shadeEdges(skip = new Set(), f = 0.72) {
    const src = this.px.slice();
    const empty = (x, y) => !this.inside(x, y) || src[y * this.w + x] === null;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = src[y * this.w + x];
        if (c === null || skip.has(c)) continue;
        if (empty(x + 1, y) || empty(x, y + 1)) this.px[y * this.w + x] = darken(c, f);
      }
    }
  }
  // Writes the grid into ctx. With overlay=true, transparent pixels keep what
  // is already on the canvas (composited via a temporary canvas).
  drawTo(ctx, ox = 0, oy = 0, overlay = false) {
    const img = ctx.createImageData(this.w, this.h);
    const d = img.data;
    for (let i = 0; i < this.px.length; i++) {
      const c = this.px[i];
      if (c === null) continue;
      const [r, g, b] = rgb(c);
      d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
    }
    if (!overlay) { ctx.putImageData(img, ox, oy); return; }
    const tmp = makeCanvas(this.w, this.h);
    tmp.getContext('2d').putImageData(img, 0, 0);
    ctx.drawImage(tmp, ox, oy);
  }
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
