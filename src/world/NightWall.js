// The wall at night is never just a dark block: tiny lights live in the rock
// and come out after dusk, each biome its own: glow-moss on the Green Rise,
// frost glinting in the moonlight on the Frozen Reach, violet veins in the
// black glass, honey in the hive, embers along the Dragon's Spine... They
// twinkle in place (fixed in the world, so the climb scrolls past them).
import { DEPTH, GAME_WIDTH, GAME_HEIGHT, LEVEL_PX } from '../config/gameConfig.js';
import { biomeAt } from '../data/biomes.js';

const CELL = 10;
const LOOK = {
  green: { c: [0x9fff8a, 0xd8ff9a], d: 0.05, sp: 0.9 },
  stone: { c: [0xc8f0a0, 0xe8f4ff], d: 0.025, sp: 0.8 },
  frozen: { c: [0xdff4ff, 0xffffff, 0x9fd2f2], d: 0.09, sp: 2.6, star: true },
  clouds: { c: [0xffffff, 0xdfe8ff], d: 0.03, sp: 1.2 },
  hive: { c: [0xffc040, 0xffe08a], d: 0.06, sp: 0.6 },
  obsidian: { c: [0xb48aff, 0xd8b8ff, 0x8a5aff], d: 0.08, sp: 0.7 },
  crystal: { c: [0xffa8f0, 0xa8fff4, 0xfff1a8], d: 0.1, sp: 2, star: true },
  clockwork: { c: [0xffd27a, 0xfff0c0], d: 0.04, sp: 1.8 },
  storm: { c: [0x8fb8ff, 0xd8e4ff], d: 0.04, sp: 3 },
  aurora: { c: [0x5af0a0, 0x9a70f0, 0xc8ffe8], d: 0.08, sp: 1 },
  bones: { c: [0xd8f0ff, 0xa8d8c8], d: 0.03, sp: 0.5 },
  dragon: { c: [0xff7a2a, 0xffb040, 0xff4a2a], d: 0.08, sp: 1.4 },
  volcano: { c: [0xff7a2a, 0xffb040], d: 0.08, sp: 1.4 },
  sky: { c: [0xffffff, 0xfff4c8], d: 0.03, sp: 1 },
};
const hash = (x, y, s) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

export class NightWall {
  constructor(scene, mountain) {
    this.scene = scene;
    this.mountain = mountain;
    this.g = scene.add.graphics().setDepth(DEPTH.light + 1).setBlendMode('ADD');
    this.t = 0;
  }

  // k: 0..1 how dark it is (night, the Obsidian dark, a storm).
  update(dt, k, camX, camY, reduced = false) {
    this.t += dt;
    const g = this.g.clear();
    if (k < 0.05) return;
    const t = this.t / 1000;
    const y0 = Math.floor(camY / CELL) * CELL, y1 = camY + GAME_HEIGHT;
    for (let y = y0; y < y1; y += CELL) {
      const meters = -y / 16;
      const look = LOOK[biomeAt(Math.max(0, meters)).id] || LOOK.stone;
      const b = this.mountain.boundsAt(-y / LEVEL_PX);
      const cy = Math.floor(y / CELL);
      const d = look.d * (reduced ? 0.5 : 1);
      for (let x = Math.floor(Math.max(camX, b.l) / CELL) * CELL; x < Math.min(camX + GAME_WIDTH, b.r); x += CELL) {
        const cx = Math.floor(x / CELL);
        if (hash(cx, cy, 1) > d) continue;
        const px = x + Math.floor(hash(cx, cy, 2) * CELL), py = y + Math.floor(hash(cx, cy, 3) * CELL);
        if (px < b.l + 3 || px > b.r - 3) continue;
        const ph = hash(cx, cy, 4) * 6.28, sp = look.sp * (0.6 + hash(cx, cy, 5) * 0.8);
        const tw = Math.max(0, Math.sin(t * sp + ph));
        const a = k * (look.star ? tw ** 3 : 0.35 + 0.65 * tw * tw);
        if (a < 0.03) continue;
        const c = look.c[Math.floor(hash(cx, cy, 6) * look.c.length)];
        g.fillStyle(c, Math.min(1, a)).fillRect(px, py, 1, 1);
        if (look.star && tw > 0.85) g.fillStyle(c, a * 0.5).fillRect(px - 1, py, 3, 1).fillRect(px, py - 1, 1, 3);
        else if (!look.star && hash(cx, cy, 7) > 0.7) g.fillStyle(c, a * 0.25).fillRect(px - 1, py - 1, 3, 3);
      }
    }
  }
}
