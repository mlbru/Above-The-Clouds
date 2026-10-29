// Little painted views of each biome for the journal's PLACES chapter.
import { PixelGrid, makeCanvas } from '../utils/pixelGrid.js';
import { lerpColor, bayer } from '../utils/color.js';
import { BIOMES } from '../data/biomes.js';

export const THUMB_W = 44, THUMB_H = 30;

function thumbGrid(b) {
  const W = THUMB_W, H = THUMB_H;
  const g = new PixelGrid(W, H);
  const sky = (b.backdrop && b.backdrop.sky) || { top: 0x4f90e0, bottom: 0xd8f0f0 };
  const dark = b.id === 'obsidian' || b.id === 'aurora';
  // Sky, dithered from top to bottom.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = y / H;
    g.set(x, y, bayer(x, y) < t ? (dark ? 0x2a2440 : sky.bottom) : (dark ? 0x141020 : sky.top));
  }
  if (dark) [[5, 4], [12, 2], [30, 6], [8, 9], [24, 3]].forEach(([x, y]) => g.set(x, y, 0xffffff));
  // A distant ridge.
  const ridge = lerpColor(sky.bottom, b.rock[1], dark ? 0.8 : 0.45);
  for (let x = 0; x < W; x++) {
    const top = Math.round(H * 0.55 - Math.abs(Math.sin(x / 7)) * 6 - Math.sin(x / 3) * 1.5);
    for (let y = top; y < H; y++) g.set(x, y, ridge);
  }
  if (b.id === 'clouds' || b.id === 'crystal') {
    for (let x = 0; x < W; x++) for (let y = Math.round(H * 0.62 + Math.sin(x / 4) * 1.5); y < H; y++) g.set(x, y, y % 3 ? 0xf4f0ff : 0xdcd8f0);
  }
  if (b.id === 'green') {
    for (let x = 0; x < 20; x++) for (let y = H - 6; y < H; y++) g.set(x, y, (x + y) % 5 ? 0x4f8a3c : 0x79b24c);
    [3, 9, 14].forEach((x) => { g.line(x, H - 6, x, H - 11, 0x2e5236); g.line(x - 1, H - 8, x + 1, H - 8, 0x2e5236); });
  }
  // The wall itself on the right, in the biome's rock with a few holds.
  for (let y = 0; y < H; y++) {
    const edge = 20 + Math.round(Math.sin(y / 4) * 2 + Math.sin(y / 1.7));
    for (let x = edge; x < W; x++) {
      const n = ((x * 7 + y * 13) % 11) / 11;
      let c = b.rock[n > 0.7 ? 3 : n > 0.35 ? 2 : 1];
      if (x === edge) c = b.rock[0];
      if (b.id === 'green' && ((x * 3 + y * 5) % 9 === 0 || (y > 18 && x < edge + 4))) c = b.accentB;
      if (b.id === 'frozen' && (y + x) % 7 === 0) c = 0xeef6ff;
      if (b.id === 'obsidian' && (x - y) % 9 === 0) c = 0x8a6ad8;
      g.set(x, y, c);
    }
  }
  [[28, 6], [36, 12], [27, 19], [38, 24]].forEach(([x, y]) => { g.rect(x, y, 3, 2, b.holdTint); g.set(x, y, 0xffffff); });
  // A hint of the biome's twist.
  if (b.id === 'stone') { g.rect(31, 1, 3, 3, 0xa8743e); g.set(31, 0, 0xd09a5a); g.set(29, 5, 0x8a8478); g.set(35, 6, 0x8a8478); }
  if (b.id === 'frozen') for (let i = 0; i < 26; i++) g.set((i * 17) % W, (i * 11) % H, 0xffffff);
  if (b.id === 'clouds') for (let y = 8; y < 26; y += 2) g.set(24 + Math.round(Math.sin(y / 2) * 2), y, 0xffb45a);
  if (b.id === 'storm') {
    g.line(12, 0, 9, 7, 0xffffff); g.line(9, 7, 13, 9, 0xffffff); g.line(13, 9, 10, 16, 0xffe45a);
    for (let i = 0; i < 20; i++) g.set((i * 13) % 20, 4 + (i * 7) % 24, 0x9aa8c8);
  }
  if (b.id === 'aurora') {
    for (let x = 0; x < 20; x++) { const y = 4 + Math.round(Math.sin(x / 3) * 2); g.set(x, y, 0x5af0a0); g.set(x, y + 1, 0x2e8a78); g.set(x, y + 4, x % 2 ? 0x9a70f0 : 0x5a3aa0); }
  }
  if (b.id === 'dragon') {
    for (let x = 0; x < 20; x++) { const y = 14 + Math.round(Math.sin(x / 2.5) * 3); g.set(x, y, 0x8a2a2a); g.set(x, y + 1, 0x6a1c22); if (x % 4 === 0) g.set(x, y - 1, 0xffe08a); }
    for (let i = 0; i < 6; i++) g.set(29 + (i % 3), 10 - i, i % 2 ? 0xff9a3c : 0xffe08a);
  }
  if (b.id === 'hive') {
    // A papery hive and a swarm crossing the sky.
    for (let y = 6; y < 16; y++) for (let x = 6; x < 14; x++) if (((x - 10) / 4) ** 2 + ((y - 11) / 5) ** 2 <= 1) g.set(x, y, y % 3 ? 0xe8c070 : 0xc89040);
    g.set(10, 13, 0x2a160a);
    for (let i = 0; i < 12; i++) g.set(4 + ((i * 7) % 16), 3 + ((i * 5) % 6), 0x2a1a0a);
  }
  if (b.id === 'clockwork') {
    // A gear turning in the wall, and a tower with a lit window.
    for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) {
      const d = Math.hypot(x, y), tooth = Math.cos(Math.atan2(y, x) * 8) > 0.3;
      if (d <= (tooth ? 5 : 4) && d >= 2) g.set(31 + x, 14 + y, d > 3 ? 0xf0c870 : 0xb8733a);
    }
    g.rect(6, 6, 6, 12, 0x5a4a3c); g.rect(5, 4, 8, 2, 0x5aa08a); g.set(8, 10, 0xffd080);
  }
  if (b.id === 'bones') {
    // A ribcage standing on the ridge, ash in the air.
    for (let i = 0; i < 5; i++) for (let k = 0; k < 6 - Math.abs(2 - i); k++) g.set(5 + i * 3 + Math.round(k * k * 0.1), 16 - k, 0xe8dcc0);
    for (let i = 0; i < 14; i++) g.set((i * 11) % 20, (i * 7) % 26, 0xb0a8a0);
  }
  if (b.id === 'crystal') {
    for (let i = 0; i < 18; i++) g.set(10 + i, 2 + i, i % 2 ? 0xffc8f0 : 0xffffff);
    g.line(33, 28, 32, 20, 0xd8c8ff, 2); g.set(32, 20, 0xffffff);
  }
  return g;
}

// A white stamp seal (tinted per logbook page): a double ring and a mountain.
function sealGrid() {
  const g = new PixelGrid(30, 30);
  const W = 0xffffff;
  for (let a = 0; a < 360; a += 2) {
    const t = (a * Math.PI) / 180;
    g.set(15 + Math.cos(t) * 13.5, 15 + Math.sin(t) * 13.5, W);
    g.set(15 + Math.cos(t) * 12.5, 15 + Math.sin(t) * 12.5, W);
    g.set(15 + Math.cos(t) * 10, 15 + Math.sin(t) * 10, W);
  }
  for (let y = 0; y < 9; y++) for (let x = -y; x <= y; x++) g.set(13 + x, 10 + y, W);
  for (let y = 0; y < 6; y++) for (let x = -y; x <= y; x++) g.set(18 + x, 13 + y, W);
  g.rect(8, 19, 15, 1, W);
  g.rect(15, 5, 1, 3, W); g.rect(14, 6, 3, 1, W);
  return g;
}

export function buildJournalTextures(scene) {
  if (!scene.textures.exists('stamp_seal')) {
    const grid = sealGrid();
    const c = makeCanvas(grid.w, grid.h);
    grid.drawTo(c.getContext('2d'));
    scene.textures.addCanvas('stamp_seal', c);
  }
  for (const b of Object.values(BIOMES)) {
    const key = `jthumb_${b.id}`;
    if (scene.textures.exists(key)) continue;
    const grid = thumbGrid(b);
    const c = makeCanvas(grid.w, grid.h);
    grid.drawTo(c.getContext('2d'));
    scene.textures.addCanvas(key, c);
  }
}
