// Pixel art for Bram's dare cards: one 20x20 emblem per dare, and the red
// wax seal pressed on a card you take.
import { PixelGrid, makeCanvas } from '../utils/pixelGrid.js';

const OUT = 0x16141f;

const ICONS = {
  // A hand mirror; the glass shows a reflected arrow.
  mirror: (g) => {
    g.ellipse(10, 8, 7, 7.5, 0xc8a050);
    g.ellipse(10, 8, 5.4, 6, 0x9fd8ff);
    g.line(7, 4, 9, 2, 0xe8f6ff, 2);
    g.rect(9, 15, 3, 5, 0x8a6a3a);
    g.rect(9, 15, 1, 5, 0xc8a050);
    // ← in the glass
    g.rect(8, 8, 6, 1, 0xff9ae6); g.set(9, 7, 0xff9ae6); g.set(9, 9, 0xff9ae6); g.set(10, 6, 0xff9ae6); g.set(10, 10, 0xff9ae6);
  },
  // A crescent moon and two stars.
  night: (g) => {
    g.ellipse(9, 10, 7, 7, 0xf0f2ff);
    g.ellipse(12.5, 7.5, 6, 6, null);
    g.set(5, 8, 0xc8d0f0); g.set(6, 13, 0xc8d0f0);
    for (const [x, y] of [[15, 13], [17, 4]]) { g.set(x, y, 0xfff1a8); g.set(x - 1, y, 0xd8c070); g.set(x + 1, y, 0xd8c070); g.set(x, y - 1, 0xd8c070); g.set(x, y + 1, 0xd8c070); }
  },
  // A metronome with its arm thrown hard over, and speed lines.
  quick: (g) => {
    for (let y = 4; y <= 18; y++) {
      const half = Math.round(2 + (y - 4) * 0.36);
      g.rect(9 - half, y, half * 2 + 1, 1, y > 15 ? 0x6a4428 : 0x9a6a3a);
    }
    g.rect(8, 9, 3, 6, 0x6a4428);
    g.line(9, 15, 15, 2, 0xf2c14e, 1);
    g.rect(13, 5, 2, 2, 0xf2c14e);
    g.rect(16, 9, 3, 1, 0xf4efe4); g.rect(17, 12, 2, 1, 0xf4efe4); g.rect(16, 15, 3, 1, 0xf4efe4);
  },
  // A small pack beside a grip meter that is only half full.
  light: (g) => {
    g.rect(2, 6, 9, 12, 0xe07a2e);
    g.rect(2, 6, 9, 3, 0xa8521e);
    g.rect(4, 11, 5, 4, 0xa8521e);
    g.rect(1, 3, 11, 3, 0x6aa6cf);
    g.rect(14, 2, 5, 17, 0x2a2440);
    g.rect(15, 11, 3, 7, 0x8fd16a);
    g.rect(15, 3, 3, 7, 0x3a3550);
  },
  // A closed eye with its lashes.
  blind: (g) => {
    for (let x = 2; x <= 17; x++) {
      const y = Math.round(9 + Math.sin(((x - 2) / 15) * Math.PI) * 3);
      g.set(x, y, 0xf4efe4); g.set(x, y - 1, 0xd8a6ff);
    }
    for (const x of [4, 7, 10, 13, 16]) {
      const y = Math.round(9 + Math.sin(((x - 2) / 15) * Math.PI) * 3);
      g.line(x, y + 1, x + (x - 10) * 0.25, y + 4, 0xf4efe4, 1);
    }
    g.set(10, 4, 0xd8a6ff); g.set(9, 5, 0xd8a6ff); g.set(11, 5, 0xd8a6ff);
  },
};

// The dares of idea sheet 1.14.
Object.assign(ICONS, {
  // An eye squinting at a track cut in half: only the near end is drawn.
  shortsight: (g) => {
    g.rect(1, 14, 18, 3, 0x2a2440); g.rect(2, 15, 8, 1, 0x9fe8ff); g.rect(11, 15, 7, 1, 0x3a3550);
    g.rect(3, 13, 1, 5, 0xffffff);
    for (let x = 4; x <= 15; x++) { const y = Math.round(7 - Math.sin(((x - 4) / 11) * Math.PI) * 3); g.set(x, y, 0xf4efe4); g.set(x, 14 - y, 0xf4efe4); }
    g.ellipse(9.5, 7, 2, 1.6, 0x9fe8ff); g.set(9, 7, 0x16141f); g.set(10, 6, 0xffffff);
  },
  // A hold breaking into pieces, grit falling.
  fragile: (g) => {
    g.ellipse(7, 7, 5, 3.5, 0xb8ab9a); g.ellipse(13, 8, 4, 3, 0x8a7f74);
    g.line(9, 4, 10, 11, 0x2a2420); g.line(5, 5, 7, 9, 0x4e463e);
    g.rect(8, 13, 2, 2, 0x8a7f74); g.rect(12, 15, 2, 2, 0xb8ab9a); g.set(6, 17, 0x8a7f74); g.set(11, 18, 0x6e655c); g.set(14, 12, 0x6e655c);
    g.set(5, 5, 0xf6f3ea); g.set(6, 5, 0xf6f3ea);
  },
  // The dragon's great eye, wide open, staring.
  pacifist: (g) => {
    g.ellipse(10, 10, 9, 5.5, 0x40121a);
    g.ellipse(10, 10, 7.5, 4.4, 0xffb030);
    g.ellipse(10, 10, 6, 3.4, 0xffd25a);
    g.rect(9, 6, 2, 9, 0x16060a);
    g.set(8, 8, 0xffffff); g.set(7, 9, 0xfff4c0);
    g.line(1, 5, 6, 3, 0x641c1e, 2); g.line(19, 5, 14, 3, 0x641c1e, 2);
  },
  // A camera on a strap with one arrow pointing straight ahead.
  tourist: (g) => {
    g.line(3, 2, 7, 6, 0xd84a3a); g.line(17, 2, 13, 6, 0xd84a3a);
    g.rect(4, 6, 12, 8, 0x3a3046); g.rect(4, 6, 12, 2, 0x5a5070);
    g.ellipse(10, 10, 3, 3, 0x9fd8ff); g.ellipse(10, 10, 1.5, 1.5, 0x2a4a6a); g.set(9, 9, 0xffffff);
    g.rect(13, 4, 2, 2, 0xf2c14e);
    g.rect(9, 16, 2, 3, 0xf2c14e); g.set(8, 17, 0xf2c14e); g.set(11, 17, 0xf2c14e);
  },
  // A single rope, one knot, frayed at the top.
  onerope: (g) => {
    for (let y = 3; y < 19; y++) { const x = 10 + Math.round(Math.sin(y * 0.5) * 1.5); g.set(x, y, y % 3 ? 0xe8e4dc : 0xb8b0a0); g.set(x + 1, y, y % 3 ? 0xc8c0b0 : 0x8a8478); }
    g.ellipse(10.5, 11, 2.4, 2, 0xf4efe4); g.set(10, 10, 0x8a8478);
    g.set(9, 2, 0xe8e4dc); g.set(12, 1, 0xe8e4dc); g.set(11, 2, 0xc8c0b0); g.set(8, 1, 0xc8c0b0);
  },
});

function addGrid(scene, key, grid) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const c = makeCanvas(grid.w, grid.h);
  grid.drawTo(c.getContext('2d'));
  scene.textures.addCanvas(key, c);
}

// Builds `dare_<id>` icons and `dare_seal` once.
export function buildDareTextures(scene) {
  if (scene.textures.exists('dare_seal')) return;
  for (const [id, draw] of Object.entries(ICONS)) {
    const g = new PixelGrid(20, 20);
    draw(g);
    g.outline(OUT);
    addGrid(scene, `dare_${id}`, g);
  }
  // Wax seal: a lumpy red disc, a darker rim, a raised inner ring.
  const s = new PixelGrid(30, 30);
  s.ellipse(15, 15, 13, 12.5, 0xb8242e);
  for (const [x, y, r] of [[4, 9, 3], [25, 7, 2.5], [26, 21, 3], [6, 23, 2.5], [15, 2, 2]]) s.ellipse(x, y, r, r, 0xb8242e);
  s.ellipse(15, 15, 10, 9.6, 0xd83a3a);
  s.ellipse(15, 15, 8.4, 8, 0xb8242e);
  s.ellipse(15, 15, 7.4, 7, 0xd83a3a);
  s.ellipse(11, 10, 2, 1.4, 0xf08080);
  s.shadeEdges(new Set(), 0.7);
  s.outline(0x5a0c14);
  addGrid(scene, 'dare_seal', s);
}
