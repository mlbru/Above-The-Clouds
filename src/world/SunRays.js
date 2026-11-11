// Light rays: soft beams fanning out of the sun (or the moon) across the
// whole scene. Long and golden while the sun is low, short and pale at noon,
// thin and blue by moonlight. Each beam sways and breathes on its own, and
// mist, snow or a clearing storm make them stronger (light catching in the air).
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';
import { lerpColor } from '../utils/color.js';

const BEAMS = 9;

export class SunRays {
  constructor(scene, depth) {
    this.scene = scene;
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(depth).setBlendMode('ADD');
    this.t = 0;
    this.beams = Array.from({ length: BEAMS }, (_, i) => ({
      a: (i / (BEAMS - 1)) * 2 - 1,
      w: 0.035 + ((i * 37) % 7) * 0.008,
      p: i * 1.9,
      k: 0.5 + ((i * 53) % 10) / 20,
    }));
  }

  // day: DayNightSystem state. air: 0..1 extra haze to catch the light.
  // dim: 0..1 cloud cover. boost: 0..1 extra (a storm clearing).
  update(dt, day, { air = 0, dim = 0, boost = 0, reduced = false } = {}) {
    this.t += dt;
    const g = this.g;
    g.clear();
    const src = day.sun || day.moon;
    if (!src) return;
    const sun = !!day.sun;
    const height = Math.max(0, Math.min(1, (150 - src.y) / 120));
    // Low sun: long warm beams. High sun: short pale ones. Moon: faint blue.
    let strength = sun ? 0.05 + (1 - height) * 0.07 : 0.035 * day.night;
    strength *= (1 - dim * 0.85) * (1 + air * 0.8) * (1 + boost * 1.6);
    if (reduced) strength *= 0.6;
    if (strength < 0.004) return;
    const color = sun ? lerpColor(0xffa040, 0xfff4d8, height) : 0x9fb8ff;
    const len = (sun ? 260 + (1 - height) * 260 : 220);
    // Beams point away from the sun towards the middle of the screen and down.
    const base = Math.atan2(GAME_HEIGHT * 0.9 - src.y, GAME_WIDTH / 2 - src.x);
    const spread = sun ? 0.9 - height * 0.35 : 0.6;
    for (const b of this.beams) {
      const sway = Math.sin(this.t / 2600 + b.p) * 0.05;
      const ang = base + b.a * spread + sway;
      const breathe = 0.55 + 0.45 * Math.sin(this.t / (1700 + b.p * 120) + b.p);
      const alpha = strength * b.k * breathe;
      const half = b.w * (sun ? 1.2 - height * 0.4 : 0.8);
      // Three layers per beam, each narrower and brighter towards the middle.
      for (const [wk, ak] of [[1, 0.5], [0.55, 0.8], [0.22, 1]]) {
        const a0 = ang - half * wk, a1 = ang + half * wk;
        g.fillStyle(color, alpha * ak);
        g.fillTriangle(src.x, src.y, src.x + Math.cos(a0) * len, src.y + Math.sin(a0) * len, src.x + Math.cos(a1) * len, src.y + Math.sin(a1) * len);
      }
    }
    // A soft bloom right around the source.
    for (let r = 4; r >= 1; r--) {
      g.fillStyle(color, strength * 0.5 * (5 - r) / 4);
      g.fillCircle(src.x, src.y, 8 + r * 7);
    }
  }
}
