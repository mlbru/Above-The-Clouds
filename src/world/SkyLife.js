// Life far off in the sky, behind the mountains: flocks of birds in a V over
// the lower mountain by day, an airship drifting above the clouds, a dragon
// circling far away over the high biomes, and shooting stars at night. All of
// it is drawn small and hazed into the sky colour, so it reads as distance.
import { GAME_WIDTH, DEPTH } from '../config/gameConfig.js';
import { lerpColor } from '../utils/color.js';

const rnd = (a, b) => a + Math.random() * (b - a);

export class SkyLife {
  constructor(scene) {
    this.scene = scene;
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.far + 3);
    this.flock = null;
    this.ship = null;
    this.dragon = null;
    this.stars = [];
    this.wait = { flock: rnd(3000, 9000), ship: rnd(2000, 8000), star: rnd(2000, 6000) };
    this.t = 0;
    // Called when a shooting star appears (the title screen makes a wish).
    this.onStar = null;
  }

  update(dt, alt, day, skyBottom) {
    this.t += dt;
    const g = this.g;
    g.clear();
    const haze = (c, k) => lerpColor(c, skyBottom, k);
    const W = GAME_WIDTH;

    // Flocks: low mountain, daylight.
    if (!this.flock && alt < 330 && day.night < 0.3 && (this.wait.flock -= dt) < 0) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.flock = { x: dir > 0 ? -40 : W + 40, y: rnd(30, 90), dir, n: 5 + Math.floor(rnd(0, 5)), v: rnd(14, 22) };
    }
    if (this.flock) {
      const f = this.flock;
      f.x += f.dir * f.v * dt / 1000;
      const col = haze(0x2a2430, 0.45);
      for (let i = 0; i < f.n; i++) {
        const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
        const bx = Math.round(f.x - f.dir * row * 6), by = Math.round(f.y + side * row * 3 + Math.sin(this.t / 300 + i) * 0.6);
        const up = Math.floor(this.t / 160 + i) % 2;
        g.fillStyle(col, 1).fillRect(bx, by, 1, 1).fillRect(bx - 1, by - up, 1, 1).fillRect(bx + 1, by - up, 1, 1);
      }
      if (f.x < -80 || f.x > W + 80) { this.flock = null; this.wait.flock = rnd(9000, 20000); }
    }

    // An airship above the clouds: a long envelope, a gondola, a blinking light.
    const shipZone = alt > 320 && alt < 1000;
    if (!this.ship && shipZone && (this.wait.ship -= dt) < 0) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.ship = { x: dir > 0 ? -50 : W + 50, y: rnd(36, 70), dir, v: rnd(4, 7) };
    }
    if (this.ship) {
      const s = this.ship;
      s.x += s.dir * s.v * dt / 1000;
      const x = Math.round(s.x), y = Math.round(s.y + Math.sin(this.t / 1800) * 1.5);
      const k = 0.35 + day.night * 0.2;
      const env = haze(0xc8b090, k), envD = haze(0x8a7058, k), car = haze(0x5a4030, k);
      g.fillStyle(envD, 1).fillRect(x - 13, y - 3, 26, 7).fillRect(x - 11, y - 4, 22, 9);
      g.fillStyle(env, 1).fillRect(x - 12, y - 3, 24, 5).fillRect(x - 10, y - 4, 20, 2);
      g.fillStyle(haze(0xf0e0c0, k), 1).fillRect(x - 9, y - 3, 14, 1);
      g.fillStyle(envD, 1).fillRect(x - s.dir * 13, y - 5, 2, 3).fillRect(x - s.dir * 13, y + 2, 2, 3);
      g.fillStyle(car, 1).fillRect(x - 4, y + 6, 8, 3).fillRect(x - 3, y + 5, 1, 1).fillRect(x + 2, y + 5, 1, 1);
      if (Math.floor(this.t / 600) % 2) g.fillStyle(day.night > 0.4 ? 0xff5a4a : haze(0xffe08a, k), 1).fillRect(x + s.dir * 4, y + 7, 1, 1);
      if (s.x < -90 || s.x > W + 90 || !shipZone) { this.ship = null; this.wait.ship = rnd(25000, 50000); }
    }

    // The dragon, far off: a dark winged shape on a slow wide circle.
    if (alt > 1400) {
      const a = this.t / 9000;
      const x = Math.round(W / 2 + Math.cos(a) * W * 0.42), y = Math.round(70 + Math.sin(a * 2) * 22);
      const flap = Math.sin(this.t / 260);
      const c = haze(0x1a0e14, 0.5 - day.night * 0.2);
      const dir = Math.sin(a) > 0 ? -1 : 1;
      g.fillStyle(c, 1).fillRect(x - 3, y, 7, 2).fillRect(x + dir * 4, y - 1, 2, 2).fillRect(x - dir * 5, y + 1, 3, 1);
      const wy = Math.round(flap * 3);
      g.fillRect(x - 1, y - 1 - Math.max(0, wy), 1, 1 + Math.abs(wy));
      for (let k = 1; k <= 6; k++) g.fillRect(x - k, y - wy * (k / 6) - 1, 1, 1).fillRect(x + k, y - wy * (k / 6) - 1, 1, 1);
    }

    // Shooting stars at night, anywhere.
    if (day.night > 0.6 && (this.wait.star -= dt) < 0) {
      this.wait.star = rnd(4000, 12000);
      this.stars.push({ x: rnd(40, W - 40), y: rnd(10, 60), vx: rnd(-160, -90) * (Math.random() < 0.5 ? 1 : -1), vy: rnd(40, 70), life: 700 });
      if (this.onStar) this.onStar();
    }
    this.stars = this.stars.filter((s) => (s.life -= dt) > 0);
    for (const s of this.stars) {
      s.x += s.vx * dt / 1000; s.y += s.vy * dt / 1000;
      const a = Math.min(1, s.life / 300);
      for (let k = 0; k < 8; k++) g.fillStyle(0xffffff, a * (1 - k / 8)).fillRect(Math.round(s.x - s.vx * k * 0.006), Math.round(s.y - s.vy * k * 0.006), 1, 1);
    }
  }
}
