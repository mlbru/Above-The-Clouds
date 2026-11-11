// Painted once, used by the sky: the Milky Way, the moon in its real phase,
// and the soft shapes of cloud shadows that drift over the mountain.
import { PixelGrid, makeCanvas } from '../utils/pixelGrid.js';
import { lerpColor } from '../utils/color.js';
import { SeededRandom } from '../utils/seededRandom.js';

// A band of the galaxy across the night sky: a faint river of colour (violet
// at its edges, warm dust in its core), dense specks of tiny stars, and a dark
// rift of dust running down its middle. Smooth alpha, no dither.
export function buildMilkyWay(scene, w, h) {
  const key = 'milkyway';
  if (scene.textures.exists(key)) return key;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rng = new SeededRandom(777);
  // The band runs from low on the left to high on the right.
  const along = (s) => ({ x: -20 + s * (w + 40), y: h * 0.86 - s * h * 0.78 + Math.sin(s * 5.2) * 10 });
  const glow = (x, y, r, col, a) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${col},${a})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  for (let i = 0; i <= 60; i++) {
    const s = i / 60, p = along(s);
    const core = 0.6 + 0.4 * Math.sin(s * Math.PI * 1.3 + 0.4);
    glow(p.x, p.y, 34 + rng.range(-6, 6), '120,96,190', 0.05 * core);
    glow(p.x + rng.range(-6, 6), p.y + rng.range(-4, 4), 20, '170,160,230', 0.06 * core);
    glow(p.x + rng.range(-4, 4), p.y + rng.range(-3, 3), 10, '255,226,190', 0.07 * core * core);
  }
  // The dark rift.
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i <= 40; i++) {
    const s = 0.15 + (i / 40) * 0.6, p = along(s);
    glow(p.x + 3, p.y + 2 + Math.sin(s * 17) * 2, 6 + Math.sin(s * 9) * 2, '0,0,0', 0.5);
  }
  ctx.globalCompositeOperation = 'source-over';
  // Star dust: many single faint pixels, densest along the band.
  const img = ctx.getImageData(0, 0, w, h);
  const put = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const k = (y * w + x) * 4;
    img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = Math.max(img.data[k + 3], a);
  };
  for (let n = 0; n < 900; n++) {
    const s = rng.next(), p = along(s);
    const spread = (rng.next() + rng.next() + rng.next() - 1.5) * 26;
    const x = Math.round(p.x + spread * 0.5), y = Math.round(p.y + spread);
    const warm = rng.chance(0.3);
    put(x, y, warm ? 255 : 220, warm ? 236 : 226, warm ? 210 : 255, Math.round(rng.range(50, 170)));
  }
  ctx.putImageData(img, 0, 0);
  scene.textures.addCanvas(key, c);
  return key;
}

// The moon in its phase (0 new .. 0.5 full .. 1 new), 17x17: a lit face with
// darker seas and a few craters, the dark side faintly lit by earthshine.
export function buildMoon(scene, phase) {
  const step = Math.round(phase * 16) % 16;
  const key = `moon_p${step}`;
  if (scene.textures.exists(key)) return key;
  const ph = step / 16;
  const S = 17, R = 7.6, C = 8.5;
  const g = new PixelGrid(S, S);
  const k = Math.cos(ph * Math.PI * 2);
  const seas = [[6, 6, 2.4], [10, 9, 2], [7, 11, 1.6], [11, 5, 1.2]];
  const craters = [[5, 9], [12, 8], [9, 4], [8, 13]];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - C, dy = y + 0.5 - C;
      if (dx * dx + dy * dy > R * R) continue;
      const v = dy / R, sRow = Math.sqrt(Math.max(0.0001, 1 - v * v));
      const u = dx / R / sRow;
      const lit = ph < 0.5 ? u > k : u < -k;
      if (!lit) { g.set(x, y, 0x232a48); continue; }
      let c = 0xf2f0e6;
      // Limb darkening towards the edge, the seas a little grey-blue.
      const r = Math.hypot(dx, dy) / R;
      if (r > 0.82) c = 0xdcdad4;
      for (const [sx, sy, sr] of seas) if (Math.hypot(x - sx, y - sy) < sr) c = 0xc4c6cc;
      for (const [cx, cy] of craters) if (x === cx && y === cy) c = 0xa8aab4;
      g.set(x, y, c);
    }
  }
  const canvas = makeCanvas(S, S);
  g.drawTo(canvas.getContext('2d'));
  scene.textures.addCanvas(key, canvas);
  return key;
}

// The shadow a cloud throws on the mountain: an opaque texture that is white
// at its edges and cool slate in its middle, used with MULTIPLY, so it darkens
// softly with no alpha (and no dither) involved.
export function buildCloudShadow(scene, variant) {
  const key = `cloudshadow${variant}`;
  if (scene.textures.exists(key)) return key;
  const w = 220, h = 110;
  const rng = new SeededRandom(300 + variant);
  const blobs = Array.from({ length: 6 }, () => ({ x: rng.range(50, 170), y: rng.range(40, 70), rx: rng.range(28, 52), ry: rng.range(16, 28) }));
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const shade = 0x6c7898;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let d = 0;
      for (const b of blobs) {
        const u = (x - b.x) / b.rx, v = (y - b.y) / b.ry;
        d = Math.max(d, 1 - Math.sqrt(u * u + v * v));
      }
      const k = Math.max(0, Math.min(1, d * 2.2));
      const col = lerpColor(0xffffff, shade, k * k * (3 - 2 * k));
      const i = (y * w + x) * 4;
      img.data[i] = (col >> 16) & 255; img.data[i + 1] = (col >> 8) & 255; img.data[i + 2] = col & 255; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  scene.textures.addCanvas(key, c);
  return key;
}
