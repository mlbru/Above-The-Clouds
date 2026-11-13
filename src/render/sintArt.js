// Sinterklaas at base camp (data/seasons.js): a wooden shoe set out by the
// fire with a carrot and hay for the horse, and the Sint himself riding his
// white horse past camp along the meadow.
import { PixelGrid } from '../utils/pixelGrid.js';

const OUT = 0x1a1016;

// A wooden clog lying on its side, toe to the right, a painted tulip on it;
// a carrot and a wisp of hay stick out of the opening.
function shoeGrid() {
  const g = new PixelGrid(18, 12);
  const wood = 0xe8c47a, woodL = 0xfff0c0, woodD = 0xa8803e;
  for (let x = 1; x < 17; x++) {
    const top = x < 6 ? 4 : x < 13 ? 6 : 6 + Math.round((x - 13) * 0.6);
    for (let y = top; y <= 10; y++) g.set(x, y, y === top ? woodL : y >= 9 ? woodD : wood);
  }
  for (let x = 3; x < 9; x++) g.set(x, 5, 0x3a2410);
  for (let x = 4; x < 8; x++) g.set(x, 6, 0x5a3a1a);
  g.set(13, 8, 0xd83a2a); g.set(12, 7, 0xd83a2a); g.set(14, 7, 0xd83a2a); g.set(13, 7, 0xff6a4a); g.set(13, 9, 0x3a8a3a); g.set(12, 9, 0x3a8a3a);
  for (let k = 0; k < 6; k++) { g.set(5 + Math.round(k * 0.5), 5 - k, k > 4 ? 0xffa040 : 0xf07a1a); if (k < 2) g.set(6 + Math.round(k * 0.5), 5 - k, 0xc85a10); }
  g.set(8, 0, 0x4aa83a); g.set(9, 0, 0x6ac84a); g.set(7, 0, 0x3a8a2a);
  for (const [x, y] of [[2, 4], [2, 3], [3, 3], [1, 2], [4, 2], [3, 1]]) g.set(x, y, 0xf2d870);
  g.outline(OUT);
  return g;
}

// Fill a polygon.
function poly(g, pts, c) {
  const ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    for (let x = 0; x < g.w; x++) {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y + 0.5) !== (yj > y + 0.5) && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) g.set(x, y, c);
    }
  }
}

// A leg from (x, y) with an upper and lower part bent at the knee.
function leg(g, x, y, a1, a2, near) {
  const c = near ? 0xf0f0f4 : 0xb8bccc, h = near ? 0x2a2a34 : 0x1a1a24;
  let px = x, py = y;
  for (let k = 0; k < 5; k++) { g.set(Math.round(px), Math.round(py), c); g.set(Math.round(px) + 1, Math.round(py), c); px += Math.sin(a1); py += Math.cos(a1); }
  for (let k = 0; k < 5; k++) { g.set(Math.round(px), Math.round(py), c); px += Math.sin(a2); py += Math.cos(a2); }
  g.set(Math.round(px), Math.round(py), h); g.set(Math.round(px) + 1, Math.round(py), h);
}

// The Sint on his white horse at a canter, facing right: four frames.
// A grey-white horse lit from above, mane and tail flowing; a red saddle
// cloth with a gold edge; the Sint in a red cape over a white robe, a long
// white beard, a tall red mitre with a gold cross, his gold crook upright.
function rideFrame(f) {
  const g = new PixelGrid(42, 46);
  const W = 0xf4f4f8, S = 0xd4d8e4, D = 0xa0a6bc;
  const bob = [0, -1, 0, 1][f];
  const by = 31 + bob;
  // Far legs (behind), then the body, then near legs.
  const canter = [
    [[0.5, -0.2], [-0.3, 0.6], [0.2, 0.4], [-0.6, 0.3]],
    [[0.1, 0.3], [-0.5, 0.2], [0.6, -0.4], [0.2, 0.5]],
    [[-0.4, 0.5], [0.1, 0.2], [0.3, 0.6], [0.5, -0.5]],
    [[-0.1, 0.4], [0.4, -0.3], [-0.2, 0.4], [0.3, 0.3]],
  ][f];
  leg(g, 12, by + 3, canter[1][0], canter[1][1], false);
  leg(g, 29, by + 3, canter[3][0], canter[3][1], false);
  // Body: rump, barrel, chest.
  g.ellipse(13, by, 6.5, 5, W);
  g.ellipse(21, by + 0.5, 8, 4.6, W);
  g.ellipse(28, by, 5.5, 5, W);
  // Neck arching up to the head.
  poly(g, [[27, by - 3], [31, by - 11], [34, by - 15], [37, by - 13], [34, by - 7], [32, by + 2]], W);
  // Head and muzzle.
  poly(g, [[33, by - 16], [37, by - 17], [41, by - 11], [40, by - 9], [36, by - 11], [33, by - 12]], W);
  g.set(40, by - 10, D); g.set(39, by - 9, D);
  g.set(36, by - 14, 0x1a1a2a);
  g.set(34, by - 18, S); g.set(35, by - 19, W);
  // Shade the underside of everything, light along the top.
  for (let x = 0; x < g.w; x++) for (let y = 0; y < g.h; y++) {
    if (g.get(x, y) !== W) continue;
    if (g.get(x, y + 1) == null || g.get(x, y + 2) == null) g.set(x, y, S);
    else if (y > by + 2) g.set(x, y, S);
  }
  // Mane along the neck and the tail flowing back.
  for (let k = 0; k < 9; k++) g.set(31 + Math.round(k * 0.35) - 2, by - 14 + k, k % 2 ? 0xe0e2ec : 0xc8ccd8);
  for (let k = 0; k < 9; k++) { const tx = 7 - k, ty = by - 2 + Math.round(k * 0.7 + Math.sin(k * 0.9 + f) * 1.2); g.set(tx, ty, k % 2 ? W : S); g.set(tx, ty + 1, D); }
  leg(g, 15, by + 3, canter[0][0], canter[0][1], true);
  leg(g, 31, by + 3, canter[2][0], canter[2][1], true);
  // Saddle cloth: red with a gold edge.
  poly(g, [[16, by - 5], [25, by - 5], [26, by + 3], [15, by + 3]], 0xc81e30);
  for (let x = 15; x <= 26; x++) g.set(x, by + 3, 0xf2c252);
  // The Sint. Cape over the horse's back.
  poly(g, [[17, by - 15], [23, by - 15], [25, by - 4], [12, by - 2], [14, by - 9]], 0xd8243a);
  for (let y = by - 13; y < by - 3; y++) g.set(14 + Math.round((y - by + 13) * 0.2), y, 0xa81a2a);
  // White robe at the leg, boot in the stirrup.
  g.rect(22, by - 5, 2, 5, 0xf0eee8); g.rect(22, by, 3, 1, 0x3a2a1a);
  // Arm forward holding the staff (white sleeve, red cuff).
  g.rect(23, by - 12, 3, 2, 0xd8243a); g.set(26, by - 12, 0xf0eee8); g.set(26, by - 11, 0xf0c8a8);
  // Face and the long white beard.
  g.rect(20, by - 20, 3, 2, 0xf0c8a8);
  poly(g, [[19, by - 18], [24, by - 18], [23, by - 13], [21, by - 12], [19, by - 14]], 0xffffff);
  g.set(23, by - 17, 0xe0e0e8);
  // The mitre: tall, red, a gold band and cross.
  poly(g, [[19, by - 21], [23, by - 21], [22.5, by - 26], [21, by - 28], [19.5, by - 26]], 0xd8243a);
  for (let x = 19; x <= 23; x++) g.set(x, by - 21, 0xf2c252);
  g.set(21, by - 24, 0xf2c252); g.set(21, by - 25, 0xf2c252); g.set(20, by - 24, 0xf2c252); g.set(22, by - 24, 0xf2c252);
  // The staff, gold, a crook curling forward at the top.
  for (let y = by - 30; y < by + 1; y++) g.set(27, y, y < by - 27 ? 0xffe08a : 0xd8a83a);
  g.set(28, by - 31, 0xf2c252); g.set(29, by - 31, 0xf2c252); g.set(30, by - 30, 0xf2c252); g.set(30, by - 29, 0xd8a83a); g.set(29, by - 28, 0xd8a83a);
  g.outline(OUT);
  return g;
}

export function sintGrids() {
  return { shoe: shoeGrid(), ride: [0, 1, 2, 3].map(rideFrame) };
}
