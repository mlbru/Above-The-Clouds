// The title logo, painted once into a texture: every pixel of the pixel font
// becomes a little bevelled block with a sunlit gradient (warm white on top,
// sky blue below), wrapped in a thick night-blue outline with a deep drop
// shadow, and cloud puffs drifting against both ends.
import { PixelGrid, makeCanvas } from '../utils/pixelGrid.js';
import { measure, drawText } from '../utils/pixelFont.js';
import { lerpColor } from '../utils/color.js';

const OUT = 0x14112e, SHADOW = 0x2a2458;

export function buildLogoTexture(scene, key, text, scale) {
  if (scene.textures.exists(key)) return key;
  const m = measure(text);
  const src = makeCanvas(m.width, m.height);
  const sctx = src.getContext('2d');
  drawText(sctx, text, 0, 0, '#ffffff');
  const px = sctx.getImageData(0, 0, m.width, m.height).data;
  const on = (x, y) => x >= 0 && y >= 0 && x < m.width && y < m.height && px[(y * m.width + x) * 4 + 3] > 0;
  const pad = 4, k = Math.max(1, scale - 1), r = 8 * k, cloud = 2 * r + 4;
  const W = m.width * scale + pad * 2 + cloud * 2, H = m.height * scale + pad * 2 + 4;
  const g = new PixelGrid(W, H);
  const ox = pad + cloud, oy = pad;
  const tall = m.height * scale;
  // Letters: a vertical gradient, a lit top edge and a shaded bottom edge on
  // every font pixel, so each stroke looks carved rather than flat.
  for (let y = 0; y < m.height; y++) {
    for (let x = 0; x < m.width; x++) {
      if (!on(x, y)) continue;
      for (let j = 0; j < scale; j++) {
        for (let i = 0; i < scale; i++) {
          const gy = y * scale + j;
          const t = gy / tall;
          let c = t < 0.45 ? lerpColor(0xfffbea, 0xfff0c8, t / 0.45) : lerpColor(0xd8ecff, 0x7ab4ec, (t - 0.45) / 0.55);
          if (j === 0 && !on(x, y - 1)) c = 0xffffff;
          if (j === scale - 1 && !on(x, y + 1)) c = lerpColor(c, 0x3a6aa8, 0.45);
          if (i === scale - 1 && !on(x + 1, y)) c = lerpColor(c, 0x5a7ab8, 0.2);
          g.set(ox + x * scale + i, oy + gy, c);
        }
      }
    }
  }
  // Outline two pixels thick, then the drop shadow under everything.
  g.outline(OUT);
  g.outline(OUT);
  const shaded = new PixelGrid(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g.get(x, y) !== null) shaded.set(x, y + 3, SHADOW);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = g.get(x, y); if (c !== null) shaded.set(x, y, c); }
  // Cloud puffs against both ends of the title, lit from above.
  const puff = (cx, cy, r) => {
    shaded.ellipse(cx, cy + 1, r + 1, r * 0.7 + 1, OUT);
    shaded.ellipse(cx, cy, r, r * 0.7, 0xdfeaf8);
    shaded.ellipse(cx - r * 0.25, cy - r * 0.2, r * 0.7, r * 0.45, 0xffffff);
  };
  const base = oy + tall - 1;
  // Each cluster sits just outside the letters, tucked under the first and last one.
  for (const s of [-1, 1]) {
    const ex = s < 0 ? ox - r - 3 : ox + m.width * scale + r + 3;
    puff(ex, base - 2, r * 0.75);
    puff(ex + s * r * 0.7, base + 1, r * 0.55);
    puff(ex - s * r * 0.55, base + 2, r * 0.45);
  }
  const c = makeCanvas(W, H);
  shaded.drawTo(c.getContext('2d'));
  scene.textures.addCanvas(key, c);
  return key;
}
