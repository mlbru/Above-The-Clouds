// Weather on the lens: in a hard shower or a storm, raindrops land near the
// edges of the screen, cling there for a moment and slide down, leaving a
// faint wet trail; in a snowstorm flakes stick, then melt into a drop. They
// keep to the edges so they never cover the climb or the note track.
import { DEPTH, GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';
import { lerpColor } from '../utils/color.js';
import { SeededRandom } from '../utils/seededRandom.js';

// Frost on the lens: feathery ice ferns growing in from the four corners.
// Painted once in four rings (near the corner first), shown one ring after
// another as the frost creeps in, and melting back the same way.
const FROST_STAGES = 4;
export function frostTextures(scene) {
  if (scene.textures.exists('lens_frost_0')) return;
  const W = GAME_WIDTH, H = GAME_HEIGHT, R = 92;
  const rng = new SeededRandom(4711);
  const stages = Array.from({ length: FROST_STAGES }, () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c.getContext('2d'); });
  const dot = (x, y, d, a) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const k = Math.min(FROST_STAGES - 1, Math.floor((d / R) * FROST_STAGES));
    stages[k].fillStyle = `rgba(${a > 0.7 ? '255,255,255' : '214,232,255'},${a})`;
    stages[k].fillRect(Math.round(x), Math.round(y), 1, 1);
  };
  const corners = [[0, 0, 1, 1], [W - 1, 0, -1, 1], [0, H - 1, 1, -1], [W - 1, H - 1, -1, -1]];
  for (const [cx, cy, sx, sy] of corners) {
    // A dense rime right in the corner.
    for (let i = 0; i < 260; i++) {
      const d = Math.pow(rng.next(), 2) * 18, a = rng.next() * Math.PI / 2;
      dot(cx + sx * Math.cos(a) * d, cy + sy * Math.sin(a) * d, d, 0.5 + rng.next() * 0.4);
    }
    // Fern branches with side twigs.
    for (let b = 0; b < 11; b++) {
      let ang = (b / 10) * Math.PI / 2 + (rng.next() - 0.5) * 0.2;
      let x = cx, y = cy;
      const len = 30 + rng.next() * (R - 30);
      for (let s = 0; s < len; s++) {
        ang += (rng.next() - 0.5) * 0.25;
        x += sx * Math.cos(ang); y += sy * Math.sin(ang);
        const d = Math.hypot(x - cx, y - cy);
        dot(x, y, d, 0.75 - (s / len) * 0.35);
        if (s % 4 === 2 && s < len - 4) {
          const side = (s % 8 < 4 ? 1 : -1), tl = 2 + Math.round(rng.next() * 5 * (1 - s / len));
          for (let t = 1; t <= tl; t++) dot(x + sx * Math.cos(ang + side * 0.9) * t, y + sy * Math.sin(ang + side * 0.9) * t, d + t, 0.55 - t * 0.05);
        }
      }
    }
  }
  stages.forEach((ctx, i) => scene.textures.addCanvas(`lens_frost_${i}`, ctx.canvas));
}

const EDGE = 38;
const MAX = 26;

export class LensDrops {
  constructor(scene) {
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud - 3);
    this.drops = [];
    this.acc = 0;
    frostTextures(scene);
    this.frost = 0;
    this.frostImgs = Array.from({ length: FROST_STAGES }, (_, i) => scene.add.image(0, 0, `lens_frost_${i}`).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.hud - 3).setAlpha(0));
  }

  // rain, snow: 0..1. light: the light of the hour (drops catch it).
  // frost: 0..1, how far the frost should creep in (it gets there slowly).
  update(dt, { rain = 0, snow = 0, frost = 0, light = 0xffffff, reduced = false }) {
    const g = this.g.clear();
    this.frost += (frost - this.frost) * Math.min(1, dt / (frost > this.frost ? 9000 : 3000));
    this.frostImgs.forEach((img, i) => {
      const k = Math.max(0, Math.min(1, this.frost * FROST_STAGES - i));
      img.setAlpha(k * 0.75).setVisible(k > 0.01).setTint(lerpColor(0xffffff, light, 0.25));
    });
    const rate = (rain > 0.4 ? (rain - 0.4) * 9 : 0) + (snow > 0.5 ? (snow - 0.5) * 7 : 0);
    this.acc += (dt / 1000) * rate * (reduced ? 0.4 : 1);
    while (this.acc >= 1 && this.drops.length < MAX) {
      this.acc -= 1;
      // Somewhere along one of the four edges.
      const side = Math.floor(Math.random() * 4);
      const along = Math.random();
      const x = side === 0 ? Math.random() * EDGE : side === 1 ? GAME_WIDTH - Math.random() * EDGE : along * GAME_WIDTH;
      const y = side === 2 ? Math.random() * EDGE : side === 3 ? GAME_HEIGHT - Math.random() * EDGE : along * GAME_HEIGHT;
      const flake = snow > rain && Math.random() < 0.8;
      this.drops.push({ x, y, life: 0, span: 1600 + Math.random() * 1800, size: 2 + Math.floor(Math.random() * 3), flake, v: 0, trail: [] });
    }
    if (this.acc > 1) this.acc = 1;
    const rim = lerpColor(0x2a3448, light, 0.2), body = lerpColor(0xbfd4ee, light, 0.3), hi = 0xffffff;
    this.drops = this.drops.filter((d) => {
      d.life += dt;
      const t = d.life / d.span;
      if (t >= 1) return false;
      const a = Math.min(1, (1 - t) * 3) * Math.min(1, d.life / 120);
      // A flake melts into a drop halfway through.
      const melted = !d.flake || t > 0.55;
      if (melted) {
        // Clings a moment, then starts to slide, faster as it gathers water.
        if (d.life > 500) { d.v += dt * 0.00004 * (d.size + 1); d.y += d.v * dt; }
        if (Math.floor(d.life / 60) !== Math.floor((d.life - dt) / 60) && d.v > 0.005) d.trail.push([Math.round(d.x), Math.round(d.y) - 2]);
        if (d.trail.length > 10) d.trail.shift();
        for (const [tx, ty] of d.trail) g.fillStyle(body, a * 0.18).fillRect(tx, ty, 1, 1);
        // A round blob: dark rim, pale lens-like body, bright glint top left.
        const x = Math.round(d.x), y = Math.round(d.y), s = d.size;
        g.fillStyle(rim, a * 0.55).fillRect(x, y - 1, s, 1).fillRect(x - 1, y, 1, s + 1).fillRect(x + s, y, 1, s + 1).fillRect(x, y + s + 1, s, 1);
        g.fillStyle(body, a * 0.45).fillRect(x, y, s, s + 1);
        g.fillStyle(lerpColor(body, 0xffffff, 0.5), a * 0.5).fillRect(x, y + s, s, 1);
        g.fillStyle(hi, a * 0.9).fillRect(x, y, 1, 1);
      } else {
        const x = Math.round(d.x), y = Math.round(d.y);
        g.fillStyle(0xffffff, a).fillRect(x, y, 1, 1);
        g.fillStyle(0xf0f6ff, a * 0.7).fillRect(x - 1, y, 1, 1).fillRect(x + 1, y, 1, 1).fillRect(x, y - 1, 1, 1).fillRect(x, y + 1, 1, 1);
        if (d.size > 1) g.fillStyle(0xe0ecff, a * 0.4).fillRect(x - 2, y - 2, 1, 1).fillRect(x + 2, y + 2, 1, 1).fillRect(x + 2, y - 2, 1, 1).fillRect(x - 2, y + 2, 1, 1);
      }
      return d.y < GAME_HEIGHT + 4;
    });
  }
}
