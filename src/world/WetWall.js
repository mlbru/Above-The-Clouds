import { DEPTH, GAME_HEIGHT, LEVEL_PX } from '../config/gameConfig.js';

// Storm Crown: rain you can see on the rock. While a storm rages the face goes
// dark and wet and thin streams run down it; afterwards it slowly dries.
const BAND = 4;
const STREAMS = 13;
const mod = (v, n) => ((v % n) + n) % n;

export class WetWall {
  constructor(scene, mountain) {
    this.scene = scene;
    this.mountain = mountain;
    this.g = scene.add.graphics().setDepth(DEPTH.wall + 0.5);
    // Reflections on the wet rock (added light, above the light of the hour).
    this.gl = scene.add.graphics().setDepth(DEPTH.light + 1).setBlendMode('ADD');
    this.wet = 0;
    this.t = 0;
    // Each stream sits at a fixed fraction of the wall's width, with its own
    // wiggle, speed and how far down it reaches before it soaks away.
    this.streams = Array.from({ length: STREAMS }, (_, i) => ({
      f: (i + 0.5) / STREAMS + (Math.random() - 0.5) * 0.05,
      phase: Math.random() * 1000,
      speed: 0.09 + Math.random() * 0.06,
      wiggle: 1 + Math.random() * 2,
      gap: 60 + Math.random() * 90,
    }));
  }

  // storm: 0..1 storm intensity. Wetting is quick, drying slow.
  // lights: [{ x, y, c, k }] in world space (the headlamp's spot...).
  // flash: 0..1 a lightning flash. sky: the sky colour by day (a cool sheen).
  update(dt, storm, camY, { lights = [], flash = 0, sky = null, day = 0 } = {}) {
    const k = storm > this.wet ? dt / 1500 : dt / 9000;
    this.wet += (storm - this.wet) * Math.min(1, k);
    const g = this.g;
    g.clear();
    const gl = this.gl.clear();
    if (this.wet < 0.02) return;
    this.t += dt;
    const w = this.wet;
    const top = Math.floor(camY / BAND) * BAND, bottom = camY + GAME_HEIGHT;
    const rows = [];
    for (let y = top; y < bottom; y += BAND) rows.push([y, this.mountain.boundsAt(-y / LEVEL_PX)]);
    // Wet rock is darker.
    g.fillStyle(0x0a1020, 0.26 * w);
    for (const [y, b] of rows) g.fillRect(Math.round(b.l - 4), y, Math.round(b.r - b.l + 8), BAND);
    // Streams: a faint wet line with brighter drops running down it.
    for (const s of this.streams) {
      for (const [y, b] of rows) {
        // Gaps where the water soaks into a crack, so no stream runs top to bottom.
        const seg = mod(y + s.phase, s.gap + 40);
        if (seg > s.gap) continue;
        const x = Math.round(b.l + 8 + (b.r - b.l - 16) * s.f + Math.sin((y + s.phase) * 0.06) * s.wiggle);
        g.fillStyle(0xa8c0e0, 0.18 * w).fillRect(x, y, 1, BAND);
        g.fillStyle(0x05080e, 0.2 * w).fillRect(x + 1, y, 1, BAND);
        // The wet line catches nearby light: a glint along it.
        let shine = flash * 0.7 + (sky ? day * 0.08 : 0);
        for (const L of lights) {
          const d = Math.hypot(x - L.x, y - L.y);
          if (d < 70) shine += (1 - d / 70) * 0.55 * L.k;
        }
        if (shine > 0.02) gl.fillStyle(flash > 0.3 ? 0xffffff : lights.length ? lights[0].c : 0xdfe8ff, Math.min(0.8, shine) * w).fillRect(x, y, 1, BAND);
      }
      // Two drops per stream, sliding down at their own speed.
      for (let d = 0; d < 2; d++) {
        const span = GAME_HEIGHT + 40;
        const y = camY - 20 + mod(this.t * s.speed + s.phase + (d * span) / 2, span);
        const seg = mod(Math.floor(y / BAND) * BAND + s.phase, s.gap + 40);
        if (seg > s.gap) continue;
        const b = this.mountain.boundsAt(-y / LEVEL_PX);
        const x = Math.round(b.l + 8 + (b.r - b.l - 16) * s.f + Math.sin((y + s.phase) * 0.06) * s.wiggle);
        g.fillStyle(0xdde8ff, 0.7 * w).fillRect(x, Math.round(y), 1, 2);
        g.fillStyle(0xa8c0e0, 0.35 * w).fillRect(x, Math.round(y) - 3, 1, 3);
      }
    }
    // Each light mirrors in the wet rock as a glossy smear running down
    // from it, broken and wavering like a reflection in running water.
    for (const L of lights) {
      for (let k = 0; k < 34; k += 2) {
        const f = 1 - k / 34;
        const wob = Math.sin(this.t / 140 + k * 0.5) * (1 + k * 0.06);
        const a = 0.22 * L.k * w * f * f;
        if ((k + Math.floor(this.t / 90)) % 7 === 0) continue;
        gl.fillStyle(L.c, a).fillRect(Math.round(L.x + wob - 2), Math.round(L.y + 4 + k), 5, 2);
        gl.fillStyle(0xffffff, a * 0.6).fillRect(Math.round(L.x + wob), Math.round(L.y + 4 + k), 1, 2);
      }
    }
  }

  destroy() { this.g.destroy(); this.gl.destroy(); }
}
