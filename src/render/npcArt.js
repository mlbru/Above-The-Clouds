// Other climbers out on the wall: the stranded climber you can rescue (idea
// sheet 1.8) and the rival who races you (1.10). Small, but built like the
// player: a jacket and pack, a helmet, a rope harness.
// Frames: 0 hanging from a rope (arms up, legs dangling), 1 and 2 climbing
// (left / right hand up), 3 standing and waving, 4 a fall (arms flung up).
import { PixelGrid, makeCanvas } from '../utils/pixelGrid.js';
import { lerpColor } from '../utils/color.js';
import { shade, makeRamp, stroke } from './pixelKit.js';

const OUT = 0x16141f;
export const NPC_W = 20, NPC_H = 28;
const COAT = 1, PANTS = 2, SKIN = 3, HELM = 4, PACK = 5, BOOT = 6, ROPE = 7;

function frame(look, f) {
  const g = new PixelGrid(NPC_W, NPC_H);
  const cx = 10;
  // Legs.
  const legs = {
    0: [[[9, 17], [8, 22], [7, 26]], [[11, 17], [12, 22], [13, 25]]],
    1: [[[9, 17], [7, 20], [6, 24]], [[11, 17], [12, 21], [12, 26]]],
    2: [[[9, 17], [8, 21], [8, 26]], [[11, 17], [13, 20], [14, 24]]],
    3: [[[9, 17], [9, 22], [9, 26]], [[11, 17], [11, 22], [12, 26]]],
    4: [[[9, 17], [6, 20], [4, 22]], [[11, 17], [14, 20], [16, 23]]],
  }[f];
  for (const [a, b, c] of legs) { stroke(g, a, a, b, 3, 3, PANTS); stroke(g, b, b, c, 3, 2.4, PANTS); g.rect(Math.round(c[0]) - 1, Math.round(c[1]), 3, 2, BOOT); }
  // Pack behind, body, harness.
  g.rect(5, 9, 4, 8, PACK);
  g.ellipse(cx, 13, 3.6, 5, COAT);
  g.rect(7, 16, 6, 2, PANTS);
  g.rect(7, 16, 6, 1, ROPE);
  // Arms.
  const arms = {
    0: [[[8, 10], [7, 6], [8, 2]], [[12, 10], [13, 6], [12, 2]]],
    1: [[[8, 10], [5, 6], [5, 2]], [[12, 10], [14, 12], [15, 14]]],
    2: [[[8, 10], [6, 12], [5, 14]], [[12, 10], [15, 6], [15, 2]]],
    3: [[[8, 10], [7, 13], [7, 16]], [[12, 10], [15, 6], [17, 2]]],
    4: [[[8, 10], [4, 6], [2, 3]], [[12, 10], [16, 6], [18, 3]]],
  }[f];
  for (const [a, b, c] of arms) { stroke(g, a, a, b, 2.6, 2.2, COAT); stroke(g, b, b, c, 2.2, 2, COAT); g.rect(Math.round(c[0]) - 1, Math.round(c[1]) - 1, 2, 2, SKIN); }
  // Head and helmet.
  g.ellipse(cx, 6.5, 2.6, 2.8, SKIN);
  g.ellipse(cx, 5, 3, 2, HELM);
  g.rect(7, 5, 7, 1, HELM);
  shade(g, COAT, makeRamp(lerpColor(look.coat, 0x000000, 0.55), look.coat, lerpColor(look.coat, 0xffffff, 0.45), 5), { r: 2, base: 0.55 });
  shade(g, PANTS, makeRamp(0x1a1824, 0x3a3648, 0x5a5670, 4), { r: 1, base: 0.5 });
  shade(g, SKIN, makeRamp(lerpColor(look.skin, 0x000000, 0.35), look.skin, lerpColor(look.skin, 0xffffff, 0.3), 4), { r: 1, base: 0.6 });
  shade(g, HELM, makeRamp(lerpColor(look.helm, 0x000000, 0.5), look.helm, lerpColor(look.helm, 0xffffff, 0.5), 4), { r: 1, base: 0.6 });
  shade(g, PACK, makeRamp(0x3a2a1a, 0x6a4a2a, 0x9a7048, 4), { r: 1, base: 0.5 });
  shade(g, BOOT, [0x1a1210, 0x3a2a20], { r: 1, base: 0.4 });
  shade(g, ROPE, [0xa8282a, 0xe8504a], { r: 1, base: 0.6 });
  g.set(11, 7, OUT);
  g.outline(OUT);
  return g;
}

// Builds `key` (5 frames) for a look { coat, skin, helm }.
export function buildNpcClimber(scene, key, look) {
  if (scene.textures.exists(key)) return key;
  const frames = [0, 1, 2, 3, 4].map((f) => frame(look, f));
  const c = makeCanvas(NPC_W * frames.length, NPC_H);
  frames.forEach((g, i) => g.drawTo(c.getContext('2d'), i * NPC_W, 0));
  const tex = scene.textures.addCanvas(key, c);
  frames.forEach((g, i) => tex.add(i, 0, i * NPC_W, 0, NPC_W, NPC_H));
  return key;
}

// A white feather, for the cranes of the migration.
export function buildFeather(scene) {
  if (scene.textures.exists('ev_feather')) return;
  const g = new PixelGrid(5, 11);
  for (let y = 0; y < 10; y++) {
    const w = Math.round(Math.sin(((y + 1) / 11) * Math.PI) * 2);
    for (let x = 2 - w; x <= 2 + w; x++) g.set(x, y, x < 2 ? 0xffffff : 0xd8e0ea);
  }
  g.line(2, 1, 2, 10, 0xa8b0c0);
  const c = makeCanvas(g.w, g.h);
  g.drawTo(c.getContext('2d'));
  scene.textures.addCanvas('ev_feather', c);
}
