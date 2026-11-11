// The light of the sky, all from one source: the sun (or the moon) exactly
// where the background draws it.
//   - Crepuscular rays: a fan of soft beams around the sun, behind the
//     mountain (the rock and the hills cut them off, like real rays). Long and
//     gold at sunrise and sunset, fanning up from behind the hills just after
//     the sun has set, short and pale at noon, thin and silver by moonlight.
//   - Shafts through the cloud gaps: light breaking past the clouds, pointing
//     straight away from the sun.
//   - In mist, snow or a clearing storm the air in front of the wall catches
//     the same beams faintly.
//   - Cloud shadows: big soft shapes that drift across the mountain and the
//     climber on a sunny day.
import { GAME_WIDTH, GAME_HEIGHT, DEPTH } from '../config/gameConfig.js';
import { lerpColor } from '../utils/color.js';
import { buildCloudShadow } from '../render/skyArt.js';

const BEAMS = 15;
const TAU = Math.PI * 2;

export class SunRays {
  // depth: where the front (air) beams go. The back beams sit behind the wall.
  constructor(scene, depth) {
    this.scene = scene;
    this.back = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.cloudSea + 3).setBlendMode('ADD');
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(depth).setBlendMode('ADD');
    this.t = 0;
    this.beams = Array.from({ length: BEAMS }, (_, i) => ({
      a: (i / BEAMS) * TAU + Math.sin(i * 7.3) * 0.12,
      w: 0.035 + ((i * 37) % 7) * 0.007,
      p: i * 1.9,
      k: 0.45 + ((i * 53) % 10) / 18,
      len: 0.7 + ((i * 29) % 9) / 24,
    }));
    this.shadows = [0, 1, 2].map((i) => {
      const img = scene.add.image(0, 0, buildCloudShadow(scene, i)).setScrollFactor(0).setDepth(DEPTH.light - 3)
        .setBlendMode('MULTIPLY').setScale(1.7 + i * 0.35).setAlpha(0);
      return { img, x: Math.random() * GAME_WIDTH, wy: null, v: 5 + i * 2.5 };
    });
    this.shadowA = 0;
  }

  // day: DayNightSystem state. sky: { sun, moon } from Background (screen
  // positions as drawn), clouds: the background's cloud images.
  // air: 0..1 haze in front of the wall. dim: 0..1 cloud cover. boost: a storm clearing.
  update(dt, day, { sky = null, clouds = [], air = 0, dim = 0, boost = 0, reduced = false, camY = 0, shadows = true } = {}) {
    this.t += dt;
    const back = this.back.clear();
    const front = this.g.clear();
    const sunS = sky ? sky.sunScreen : null;
    const moonS = sky ? sky.moonScreen : null;
    const overcast = sky ? sky.overcast : 0;
    this.updateShadows(dt, day, sunS, overcast, camY, shadows && !reduced);

    let src = null, color = 0xffffff, strength = 0, reach = 300;
    if (sunS && sunS.h > -0.2) {
      // From a full glow on the horizon to a faint sheen at noon; after
      // sunset the rays fade as the sun sinks deeper.
      const below = Math.max(0, Math.min(1, (sunS.h + 0.2) / 0.2));
      strength = (0.01 + Math.pow(sunS.low, 1.4) * 0.1) * below;
      color = lerpColor(lerpColor(0xfff2d4, 0xffa050, sunS.low), 0xff7088, Math.max(0, -sunS.h) * 3);
      reach = 240 + sunS.low * 300;
      src = sunS;
    } else if (moonS && moonS.h > 0) {
      strength = 0.028 * day.night * (0.3 + day.moonLit * 0.7) * moonS.vis;
      color = 0x9fb8ff;
      reach = 200;
      src = moonS;
    }
    if (!src) return;
    strength *= (1 - Math.min(1, dim + overcast) * 0.85) * (1 + boost * 1.6);
    if (reduced) strength *= 0.6;
    if (strength < 0.004) return;
    const frontK = Math.min(1, air * 0.7 + boost * 0.6);
    for (const b of this.beams) {
      const ang = b.a + Math.sin(this.t / 2600 + b.p) * 0.04 + this.t / 90000;
      // Each beam comes and goes, as if clouds were passing in front of it.
      const breathe = Math.max(0, 0.35 + 0.65 * Math.sin(this.t / (1900 + b.p * 140) + b.p));
      // Beams pointing down into the hills read stronger than ones up into the sky.
      const down = 0.65 + 0.35 * Math.max(0, Math.sin(ang));
      const alpha = strength * b.k * breathe * down;
      if (alpha < 0.002) continue;
      const len = reach * b.len, half = b.w;
      for (const [wk, ak] of [[1, 0.45], [0.55, 0.75], [0.22, 1]]) {
        const a0 = ang - half * wk, a1 = ang + half * wk;
        const pts = [src.x, src.y, src.x + Math.cos(a0) * len, src.y + Math.sin(a0) * len, src.x + Math.cos(a1) * len, src.y + Math.sin(a1) * len];
        back.fillStyle(color, alpha * ak).fillTriangle(...pts);
        if (frontK > 0.02) front.fillStyle(color, alpha * ak * frontK * 0.6).fillTriangle(...pts);
      }
    }
    // Soft bloom right around the source.
    for (let r = 4; r >= 1; r--) back.fillStyle(color, strength * 0.5 * (5 - r) / 4).fillCircle(src.x, src.y, 8 + r * 7);
    if (src === sunS && sunS.h > 0.02) this.cloudShafts(back, sunS, clouds, color, strength);
  }

  // Light breaking past the clouds: two shafts slanting away from the sun
  // from each cloud's edges, fading with distance.
  cloudShafts(g, sun, clouds, color, strength) {
    const k = 0.012 + strength * 0.6;
    for (const c of clouds) {
      if (!c.visible || c.alpha < 0.2) continue;
      const w = c.displayWidth, h = c.displayHeight;
      if (c.x < -w || c.x > GAME_WIDTH + w || c.y < -h || c.y > GAME_HEIGHT) continue;
      let dx = c.x - sun.x, dy = c.y + h * 0.3 - sun.y;
      const d = Math.hypot(dx, dy);
      if (d < 30) continue;
      dx /= d; dy /= d;
      // Perpendicular to the light: the cloud's two edges as seen from the sun.
      const px = -dy, py = dx;
      for (const side of [-1, 1]) {
        const ex = c.x + px * side * w * 0.42, ey = c.y + h * 0.2 + py * side * h * 0.3;
        const sw = 3 + w * 0.06;
        for (let s = 0; s < 3; s++) {
          const l0 = s * 34, l1 = (s + 1) * 34 + 8;
          const a = k * c.alpha * 0.9 * (1 - s / 3);
          g.fillStyle(color, a);
          g.fillPoints([
            { x: ex + dx * l0 - px * sw, y: ey + dy * l0 - py * sw },
            { x: ex + dx * l0 + px * sw, y: ey + dy * l0 + py * sw },
            { x: ex + dx * l1 + px * sw * 1.4, y: ey + dy * l1 + py * sw * 1.4 },
            { x: ex + dx * l1 - px * sw * 1.4, y: ey + dy * l1 - py * sw * 1.4 },
          ], true);
        }
      }
    }
  }

  // Cloud shadows drift over the mountain with the wind; they belong to the
  // world (they scroll with the climb) and only show while the sun is out.
  updateShadows(dt, day, sun, overcast, camY, on) {
    const want = on && sun && sun.h > 0.05 ? Math.min(1, sun.h * 3) * (1 - overcast) * (1 - day.night) : 0;
    this.shadowA += (want - this.shadowA) * Math.min(1, dt / 1500);
    for (const s of this.shadows) {
      const { img } = s;
      if (this.shadowA < 0.01) { img.setVisible(false); continue; }
      const hh = img.displayHeight;
      if (s.wy === null) s.wy = camY + Math.random() * GAME_HEIGHT;
      s.x += (s.v * dt) / 1000;
      if (s.x - img.displayWidth / 2 > GAME_WIDTH) { s.x = -img.displayWidth / 2; s.wy = camY + Math.random() * GAME_HEIGHT; }
      let y = s.wy - camY;
      // Scrolled off (climbing up or falling): it comes round again from the other edge.
      if (y > GAME_HEIGHT + hh) { s.wy = camY - hh; y = -hh; }
      if (y < -hh * 1.5) { s.wy = camY + GAME_HEIGHT + hh * 0.5; y = GAME_HEIGHT + hh * 0.5; }
      img.setVisible(true).setPosition(Math.round(s.x), Math.round(y)).setAlpha(this.shadowA * 0.75);
    }
  }
}
