// Weather on the lens: in a hard shower or a storm, raindrops land near the
// edges of the screen, cling there for a moment and slide down, leaving a
// faint wet trail; in a snowstorm flakes stick, then melt into a drop. They
// keep to the edges so they never cover the climb or the note track.
import { DEPTH, GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';
import { lerpColor } from '../utils/color.js';

const EDGE = 38;
const MAX = 26;

export class LensDrops {
  constructor(scene) {
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud - 3);
    this.drops = [];
    this.acc = 0;
  }

  // rain, snow: 0..1. light: the light of the hour (drops catch it).
  update(dt, { rain = 0, snow = 0, light = 0xffffff, reduced = false }) {
    const g = this.g.clear();
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
