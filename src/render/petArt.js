// Pets (data/pets.js), drawn small and procedurally, in three sizes: baby,
// young and grown. Each has a few frames:
//   kid         0 stand, 1 hop, 2 bleat (head up, mouth open)
//   bee         0 wings up, 1 wings down
//   moth        0 wings open, 1 wings closed
//   dragonling  0 sit, 1 wings up, 2 puff (mouth open)
// Textures: `pet_<id>_<stage>` (frames 0..n).
import { PixelGrid, makeCanvas } from '../utils/pixelGrid.js';

const OUT = 0x16141f;

function addFrames(scene, key, grids) {
  if (scene.textures.exists(key)) return;
  const w = grids[0].w, h = grids[0].h;
  const c = makeCanvas(w * grids.length, h);
  grids.forEach((g, i) => g.drawTo(c.getContext('2d'), i * w, 0));
  const tex = scene.textures.addCanvas(key, c);
  grids.forEach((g, i) => tex.add(i, 0, i * w, 0, w, h));
}

// A goat kid: cream coat, dark hooves, horns that grow with it.
function kid(stage, f) {
  const s = [1, 1.3, 1.6][stage];
  const W = Math.round(13 * s) + 2, H = Math.round(12 * s) + 2;
  const g = new PixelGrid(W, H);
  const fur = 0xf2ece0, shade = 0xc8c0b0, hoof = 0x2a2420, horn = 0x6a5a48;
  const by = Math.round((f === 1 ? 4 : 5) * s);
  const bw = Math.round(8 * s), bh = Math.max(3, Math.round(4 * s));
  const bx = 1 + Math.round(1 * s);
  g.rect(bx, by, bw, bh, fur);
  g.rect(bx, by + bh - 1, bw, 1, shade);
  g.set(bx - 1, by, fur);
  // Legs: straight when standing, tucked mid-hop.
  const legY = by + bh, legH = Math.max(2, Math.round(3 * s));
  for (const lx of [bx + 1, bx + bw - 2]) {
    if (f === 1) { g.rect(lx, legY, 1, Math.max(1, legH - 2), fur); g.set(lx + 1, legY + Math.max(1, legH - 2), hoof); }
    else { g.rect(lx, legY, 1, legH, fur); g.set(lx, legY + legH - 1, hoof); }
  }
  // Head on a short neck, up and open-mouthed when it bleats.
  const hx = bx + bw - 1, hy = f === 2 ? by - Math.round(4 * s) : by - Math.round(3 * s);
  const hw = Math.max(3, Math.round(4 * s)), hh = Math.max(3, Math.round(3.4 * s));
  g.rect(hx, hy, hw, hh, fur);
  g.rect(hx, hy + hh, 2, by - hy - hh + 1, fur);
  g.set(hx + hw - 1, hy + 1, OUT);
  if (f === 2) g.set(hx + hw, hy + hh - 1, 0xc86a6a);
  g.set(hx - 1, hy + 1, shade); // ear
  if (stage >= 1) { g.set(hx + 1, hy - 1, horn); if (stage === 2) { g.set(hx, hy - 2, horn); g.set(hx + 2, hy - 1, horn); } }
  g.outline(OUT);
  return g;
}

// A hive bee: striped, fuzzy, wings a blur.
function bee(stage, f) {
  const s = [1, 1.3, 1.6][stage];
  const W = Math.round(9 * s) + 2, H = Math.round(8 * s) + 2;
  const g = new PixelGrid(W, H);
  const cx = Math.round(W / 2), cy = Math.round(H / 2) + 1;
  const rx = Math.round(3.4 * s), ry = Math.max(2, Math.round(2.3 * s));
  g.ellipse(cx, cy, rx, ry, 0xffc030);
  for (let x = cx - rx + 2; x < cx + rx; x += 3) g.rect(x, cy - ry, 1, ry * 2 + 1, 0x2a1a08);
  g.set(cx + rx, cy, 0x2a1a08); // sting
  g.set(cx - rx, cy - 1, OUT); // eye
  const wy = f ? cy - ry - 1 : cy - ry - Math.round(2 * s);
  g.ellipse(cx - 1, wy, Math.max(1, Math.round(1.6 * s)), Math.max(1, Math.round(1.2 * s)), 0xe8f4ff);
  g.ellipse(cx + 1, wy + 1, Math.max(1, Math.round(1.3 * s)), 1, 0xc8dcf0);
  g.outline(OUT);
  return g;
}

// A crystal moth: pale wings with glassy spots that catch the light.
function moth(stage, f) {
  const s = [1, 1.3, 1.6][stage];
  const W = Math.round(11 * s) + 2, H = Math.round(8 * s) + 2;
  const g = new PixelGrid(W, H);
  const cx = Math.round(W / 2), cy = Math.round(H / 2);
  const span = f ? Math.round(2 * s) : Math.round(5 * s), tall = Math.round(3 * s);
  for (const d of [-1, 1]) {
    for (let i = 1; i <= span; i++) {
      const hgt = Math.max(1, Math.round(tall * (1 - (i / (span + 1)) * 0.4)));
      g.rect(cx + d * i, cy - hgt + 1, 1, hgt + 1, 0xe8dcf8);
      if (i === Math.round(span * 0.6)) g.set(cx + d * i, cy - 1, 0x7ae8ff);
    }
  }
  g.rect(cx, cy - Math.round(2 * s), 1, Math.round(4 * s), 0x8a6ab8);
  g.set(cx - 1, cy - Math.round(2 * s) - 1, 0x8a6ab8); g.set(cx + 1, cy - Math.round(2 * s) - 1, 0x8a6ab8);
  g.outline(OUT);
  return g;
}

// A dragonling: the big one's colours, stubby wings, a smouldering belly.
function dragonling(stage, f) {
  const s = [1, 1.3, 1.6][stage];
  const W = Math.round(14 * s) + 2, H = Math.round(12 * s) + 2;
  const g = new PixelGrid(W, H);
  const red = 0xa83a2a, dark = 0x6a1e18, belly = 0xe8a060, horn = 0xe8dcc0, ember = 0xffb040;
  const bx = Math.round(3 * s), by = Math.round(5 * s), bw = Math.round(6 * s), bh = Math.round(5 * s);
  // Tail curling behind.
  for (let i = 0; i < Math.round(4 * s); i++) g.set(bx - i, by + bh - 1 - Math.round(i * 0.5), dark);
  g.ellipse(bx + bw / 2, by + bh / 2, bw / 2, bh / 2, red);
  g.rect(bx + 2, by + Math.round(bh / 2), Math.max(1, bw - 3), Math.max(1, Math.round(bh / 2) - 1), belly);
  g.rect(bx + 1, by + bh, 1, Math.max(1, Math.round(s)), dark);
  g.rect(bx + bw - 2, by + bh, 1, Math.max(1, Math.round(s)), dark);
  // Head forward and up.
  const hx = bx + bw - 1, hy = by - Math.round(3 * s);
  g.rect(hx, hy, Math.round(4 * s), Math.round(3 * s), red);
  g.rect(hx + Math.round(4 * s) - 1, hy + Math.round(1 * s), Math.round(1.5 * s), Math.round(1.5 * s), red);
  g.set(hx + Math.round(2 * s), hy + 1, ember);
  g.set(hx, hy - 1, horn); if (stage >= 1) g.set(hx + 1, hy - 2, horn);
  if (f === 2) g.set(hx + Math.round(5 * s), hy + Math.round(2 * s), ember);
  // Wings: folded, or up mid-flap.
  const wx = bx + 1, wy = by - 1;
  if (f === 1) { for (let i = 0; i < Math.round(4 * s); i++) g.rect(wx + i, wy - Math.round(3 * s) + i, 1, Math.round(3 * s) - i + 1, dark); }
  else { g.rect(wx, wy, Math.round(3 * s), Math.max(1, Math.round(1.5 * s)), dark); }
  g.outline(OUT);
  return g;
}

const ART = { kid: [kid, 3], bee: [bee, 2], moth: [moth, 2], dragonling: [dragonling, 3] };

export function buildPetTextures(scene) {
  for (const [id, [fn, frames]] of Object.entries(ART)) {
    for (let stage = 0; stage < 3; stage++) addFrames(scene, `pet_${id}_${stage}`, Array.from({ length: frames }, (_, f) => fn(stage, f)));
  }
}
