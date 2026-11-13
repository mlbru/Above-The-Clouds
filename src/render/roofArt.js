// Overhangs (idea sheet 1.3): what hangs from a roof in each biome, and the
// underside of the roof seen from right below it, a band that slides into
// the top of the view while you climb under it.
import { makeCanvas } from '../utils/pixelGrid.js';
import { lerpColor, bayer, rgb } from '../utils/color.js';
import { SeededRandom, makeNoise2D } from '../utils/seededRandom.js';

const ICY = ['frozen', 'aurora', 'crystal'];
const GREEN = ['green', 'cascade', 'moss', 'stone', 'clouds'];
const HOT = ['obsidian', 'dragon', 'bones', 'volcano'];

// What hangs off a roof's lip here: 'icicle', 'root', 'honey', 'ember', 'rock'.
export function hangKind(biomeId) {
  if (ICY.includes(biomeId)) return 'icicle';
  if (GREEN.includes(biomeId)) return 'root';
  if (biomeId === 'hive') return 'honey';
  if (HOT.includes(biomeId)) return 'ember';
  return 'rock';
}

// Colour of a hanging thing at step k of len (0 at the lip) at column x.
export function hangColor(kind, pal, k, len, x, lit) {
  const tip = k >= len - 1;
  switch (kind) {
    case 'icicle': return tip ? 0xffffff : lit ? lerpColor(pal.accentB, 0xffffff, 0.3) : k % 3 === 0 ? pal.accentC : pal.accentA;
    case 'root': return tip ? pal.accentC : k % 5 === 4 ? pal.accentB : lit ? 0x6a4e30 : 0x3a2a1a;
    case 'honey': return tip ? pal.accentB : lit ? pal.accentB : pal.accentA;
    case 'ember': return tip ? pal.accentC : lit ? pal.rock[2] : pal.rock[0];
    default: return tip ? pal.rock[4] : lit ? pal.rock[3] : pal.rock[1];
  }
}

// The underside of the roof as you see it from just below: dark rock lit
// from beneath, ceiling layers, a ragged lit lip and the biome's hangings.
// Returns { key, tips: [{ x, y }] } (tips: where drips fall from).
export function roofBand(scene, biome, W) {
  const key = `roof_over_${biome.id}_${W}`;
  const H = 78;
  if (scene.textures.exists(key)) return scene.textures.get(key).roofTips ? { key, tips: scene.textures.get(key).roofTips } : { key, tips: [] };
  const noise = makeNoise2D(55 + biome.id.length * 9);
  const rng = new SeededRandom(91 + biome.id.length);
  const R = biome.rock;
  const kind = hangKind(biome.id);
  const px = new Array(W * H).fill(null);
  const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) px[y * W + x] = c; };
  const lipY = (x) => Math.round(30 + Math.sin(x * 0.035) * 4 + (noise(x * 0.06, 2) - 0.5) * 12);
  for (let x = 0; x < W; x++) {
    const ly = lipY(x);
    for (let y = 0; y <= ly; y++) {
      // Darkest deep under the rock, lighter toward the lip where the sky's
      // light comes in from below; layers of the ceiling across it.
      const t = y / ly;
      let k = 0.1 + t * t * 0.55 + (noise(x * 0.08, y * 0.15) - 0.5) * 0.18;
      const band = (y + Math.round(noise(x * 0.03, 7) * 8)) % 7;
      if (band === 0) k -= 0.15; else if (band === 1) k += 0.08 * t;
      const ramp = [0x040306, R[0], R[1], R[2], R[3]];
      let c = ramp[Math.max(0, Math.min(4, Math.floor(k * 5 + (bayer(x, y) - 0.5) * 0.8)))];
      if (y >= ly - 2) c = y === ly ? lerpColor(R[4], 0xffffff, 0.2) : R[3];
      set(x, y, c);
    }
  }
  // The hangings from the lip, long and short, lit on one side.
  const tips = [];
  for (let x = 2; x < W - 2; x += rng.int(5, 11)) {
    if (rng.chance(0.25)) continue;
    const ly = lipY(x), len = rng.int(6, kind === 'root' ? 40 : 30), w = kind === 'root' ? 1 : rng.range(1.5, 3.5);
    for (let k = 0; k < len; k++) {
      const ww = kind === 'root' ? 1 : w * (1 - k / len);
      const xx = x + (kind === 'root' ? Math.sin(k * 0.3 + x) * 1.2 : 0);
      for (let dx = -ww; dx <= ww; dx++) set(xx + dx, ly + 1 + k, hangColor(kind, biome, k, len, x, dx < 0));
      if (kind === 'root' && k % 9 === 6) { set(xx - 1, ly + 1 + k, biome.accentB); set(xx + 1, ly + k, biome.accentA); }
    }
    if (len > 12) tips.push({ x: Math.round(x), y: ly + 1 + len });
  }
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  px.forEach((col, i) => {
    if (col == null) return;
    const [r, g, b] = rgb(col);
    img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
  });
  ctx.putImageData(img, 0, 0);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.addCanvas(key, c);
  tex.roofTips = tips;
  return { key, tips };
}
