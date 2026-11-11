export const rgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
export const toInt = (r, g, b) => ((r & 255) << 16) | ((g & 255) << 8) | (b & 255);

export function lerpColor(a, b, t) {
  const [ar, ag, ab] = rgb(a), [br, bg, bb] = rgb(b);
  return toInt(
    Math.round(ar + (br - ar) * t),
    Math.round(ag + (bg - ag) * t),
    Math.round(ab + (bb - ab) * t),
  );
}

export function darken(c, f = 0.75) {
  const [r, g, b] = rgb(c);
  return toInt(r * f, g * f, b * f);
}

export function lighten(c, f = 0.25) {
  const [r, g, b] = rgb(c);
  return toInt(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f);
}

export const toCss = (c) => '#' + c.toString(16).padStart(6, '0');

// 4x4 Bayer matrix thresholds in [0,1) for ordered dithering.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

// The same light with its warmth scaled: k < 1 pulls it towards a neutral grey
// of the same brightness (a cooler, fresher look), k > 1 makes it warmer.
export function warmthOf(c, k) {
  if (k === 1) return c;
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  const y = r * 0.3 + g * 0.55 + b * 0.15;
  const f = (v) => Math.max(0, Math.min(255, Math.round(y + (v - y) * k)));
  return (f(r) << 16) | (f(g) << 8) | f(b);
}
