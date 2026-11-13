// What the two highest Far Range twists look like out in the world.
//
// GhostTide (the Fossil Reef): the ghost of the old sea rises over the wall.
// A shimmering waterline climbs the screen; under it everything sits in pale
// sea-green light with caustics rippling across it (two layers drifting
// against each other), shoals of ghost fish turning, bubbles rising. At
// night the water glows like the deep. It is screen-space and see-through:
// you climb on inside it.
//
// StarSky (the Starfall Crater): the violet sky here keeps its stars by day,
// shooting stars cross it all the time, and when a star falls onto one of
// your routes you watch it come down: a burning streak, a flash and a ring
// of light where it hits, then a glowing crater left on the wall.
import { DEPTH, GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';
import { lerpColor } from '../utils/color.js';

const W = GAME_WIDTH;
const rnd = (a, b) => a + Math.random() * (b - a);

export class GhostTide {
  constructor(scene) {
    this.scene = scene;
    this.t = 0;
    this.objs = null;
    this.level = 0;
  }

  build() {
    const sc = this.scene;
    const H = sc.scale.height;
    const d = DEPTH.fx + 1;
    const body = sc.add.rectangle(0, 0, W, H, 0x3ab8b8).setOrigin(0, 0).setScrollFactor(0).setDepth(d).setAlpha(0);
    const c1 = sc.add.tileSprite(0, 0, W, H, 'reef_caustic').setOrigin(0, 0).setScrollFactor(0).setDepth(d + 0.1).setBlendMode('ADD').setAlpha(0).setScale(2);
    const c2 = sc.add.tileSprite(0, 0, W, H, 'reef_caustic').setOrigin(0, 0).setScrollFactor(0).setDepth(d + 0.1).setBlendMode('ADD').setAlpha(0).setScale(3).setFlipX(true);
    const g = sc.add.graphics().setScrollFactor(0).setDepth(d + 0.3);
    const ga = sc.add.graphics().setScrollFactor(0).setDepth(d + 0.2).setBlendMode('ADD');
    const fish = Array.from({ length: 9 }, (_, i) => ({
      o: sc.add.sprite(0, 0, 'reef_fish', 0).setScrollFactor(0).setDepth(d + 0.15).setBlendMode('ADD').setAlpha(0),
      x: rnd(0, W), y: rnd(0.3, 0.95), v: rnd(0.012, 0.03) * (i % 2 ? 1 : -1), ph: rnd(0, 6), s: rnd(1, 2),
    }));
    const bubbles = Array.from({ length: 22 }, () => ({ x: rnd(0, W), y: rnd(0, 1), v: rnd(0.02, 0.05), r: rnd(1, 2.6), ph: rnd(0, 6) }));
    this.objs = { body, c1, c2, g, ga, fish, bubbles };
  }

  // level 0..1 (the tide), w: how much of the reef is around you, night 0..1.
  update(dt, level, w, night, reduced) {
    this.level = level;
    const vis = level * w;
    if (vis < 0.01 && !this.objs) return;
    if (!this.objs) this.build();
    const o = this.objs;
    this.t += dt;
    const H = this.scene.scale.height;
    const on = vis > 0.01;
    [o.body, o.c1, o.c2, o.g, o.ga].forEach((x) => x.setVisible(on));
    o.fish.forEach((f) => f.o.setVisible(on && !reduced));
    o.g.clear(); o.ga.clear();
    if (!on) return;
    // The waterline: low on screen as it comes in, well above the climber at the full.
    const surf = Math.round(H - level * H * 0.78 + Math.sin(this.t / 900) * 4);
    const depthH = H - surf;
    const water = lerpColor(0x5ad8cc, 0x1a6a9a, night);
    o.body.setY(surf).setSize(W, depthH).setFillStyle(water).setAlpha(0.13 * vis + 0.06 * night * vis);
    const ct = lerpColor(0xd8fff4, 0x6affe0, night);
    o.c1.setY(surf).setSize(W / 2, depthH / 2 + 2).setTint(ct).setAlpha(0.1 * vis);
    o.c1.tilePositionX = this.t * 0.006; o.c1.tilePositionY = -this.t * 0.004;
    o.c2.setY(surf).setSize(W / 3 + 2, depthH / 3 + 2).setTint(ct).setAlpha(0.07 * vis);
    o.c2.tilePositionX = -this.t * 0.004; o.c2.tilePositionY = this.t * 0.003;
    // The surface: a bright rippling line, a glassy band under it, glints.
    for (let x = 0; x < W; x += 2) {
      const y = surf + Math.round(Math.sin(x * 0.045 + this.t / 380) * 2 + Math.sin(x * 0.11 - this.t / 260) * 1.2);
      o.ga.fillStyle(0xe8fffa, 0.55 * vis).fillRect(x, y, 2, 1);
      o.g.fillStyle(0x2a8a8a, 0.18 * vis).fillRect(x, y + 1, 2, 4);
      if ((x * 7 + Math.floor(this.t / 140)) % 53 === 0) o.ga.fillStyle(0xffffff, 0.9 * vis).fillRect(x - 2, y - 1, 5, 1);
    }
    // Light falling in from the surface: soft slanting rays.
    for (let i = 0; i < 5; i++) {
      const x0 = ((i * 131 + this.t * 0.01) % (W + 80)) - 40;
      const a = (0.05 + 0.04 * Math.sin(this.t / 1300 + i)) * vis * (1 - night * 0.6);
      o.ga.fillStyle(0xd8fff4, a).fillTriangle(x0, surf + 3, x0 + 18, surf + 3, x0 - 30, Math.min(H, surf + 160));
    }
    // Ghost fish, turning together.
    for (const f of o.fish) {
      f.x += f.v * dt;
      if (f.x < -20) f.x = W + 20; if (f.x > W + 20) f.x = -20;
      const y = surf + 14 + f.y * Math.max(10, depthH - 30) + Math.sin(this.t / 600 + f.ph) * 6;
      f.o.setPosition(Math.round(f.x), Math.round(y)).setFlipX(f.v > 0).setFrame(Math.floor(this.t / 160 + f.ph) % 2).setScale(f.s).setAlpha(0.32 * vis).setVisible(!reduced && y > surf + 6);
    }
    // Bubbles rising to the surface.
    if (!reduced) {
      for (const b of o.bubbles) {
        b.y -= b.v * dt / Math.max(60, depthH);
        if (b.y < 0) { b.y = 1; b.x = rnd(0, W); }
        const x = Math.round(b.x + Math.sin(this.t / 300 + b.ph) * 3), y = Math.round(surf + 4 + b.y * (depthH - 4));
        o.ga.lineStyle(1, 0xd8fff8, 0.45 * vis).strokeCircle(x, y, b.r);
      }
    }
  }

  destroy() {
    if (!this.objs) return;
    const o = this.objs;
    [o.body, o.c1, o.c2, o.g, o.ga].forEach((x) => x.destroy());
    o.fish.forEach((f) => f.o.destroy());
    this.objs = null;
  }
}

export class StarSky {
  constructor(scene) {
    this.scene = scene;
    this.t = 0;
    this.g = null;
    this.streaks = [];
    this.wait = 800;
    this.stars = Array.from({ length: 110 }, (_, i) => ({ x: (i * 97.13) % W, y: (i * 61.7) % 1, b: 0.3 + ((i * 13) % 10) / 14, ph: i * 1.7, big: i % 17 === 0 }));
    this.mark = null;
    this.falls = [];
  }

  // w: how much of the crater is around you.
  update(dt, w, night, reduced) {
    this.t += dt;
    const sc = this.scene;
    if (w < 0.01 && !this.g) { this.updateFalls(dt); return; }
    if (!this.g) {
      this.g = sc.add.graphics().setScrollFactor(0).setDepth(DEPTH.far + 1).setBlendMode('ADD');
    }
    const g = this.g.clear();
    this.updateFalls(dt);
    if (w < 0.01) return;
    const H = sc.scale.height;
    // Stars that stay out by day.
    for (const s of this.stars) {
      const tw = 0.6 + 0.4 * Math.sin(this.t / 400 + s.ph);
      const a = s.b * tw * w * (0.55 + night * 0.45);
      const y = Math.round(s.y * H * 0.62);
      g.fillStyle(s.big ? 0xfff0d0 : 0xd8e0ff, a).fillRect(Math.round(s.x), y, 1, 1);
      if (s.big) g.fillStyle(0xb8d0ff, a * 0.5).fillRect(Math.round(s.x) - 1, y, 3, 1).fillRect(Math.round(s.x), y - 1, 1, 3);
    }
    // Shooting stars, often.
    if (!reduced && (this.wait -= dt) < 0) {
      this.wait = rnd(500, 1800);
      this.streaks.push({ x: rnd(0, W + 120), y: rnd(-10, H * 0.35), t: 0, ms: rnd(400, 900), len: rnd(20, 60), dir: Math.random() < 0.8 ? 1 : -1 });
    }
    this.streaks = this.streaks.filter((s) => {
      s.t += dt;
      const k = s.t / s.ms;
      const x = s.x - k * 160 * s.dir, y = s.y + k * 80;
      const fade = Math.sin(Math.min(1, k) * Math.PI) * w;
      for (let j = 0; j < s.len; j += 2) g.fillStyle(j < 4 ? 0xffffff : 0xd8e4ff, (1 - j / s.len) * fade).fillRect(Math.round(x + j * 2 * s.dir), Math.round(y - j), 2, 1);
      return k < 1;
    });
  }

  // A star comes down onto the wall at (x, y) (world space): a burning
  // streak from the sky, a flash and a ring, then a glowing crater.
  land(x, y, onHit) {
    const sc = this.scene;
    this.clearMark();
    const gfx = sc.add.graphics().setDepth(DEPTH.fx + 3).setBlendMode('ADD');
    const head = sc.add.image(x, y, 'glow_small').setDepth(DEPTH.fx + 4).setBlendMode('ADD').setTint(0xfff0c0).setScale(2);
    const from = { x: x + 170, y: y - 260 };
    this.falls.push({ gfx, head, from, to: { x, y }, t: 0, ms: 650, onHit, sparks: [] });
  }

  updateFalls(dt) {
    const sc = this.scene;
    this.falls = this.falls.filter((f) => {
      f.t += dt;
      const g = f.gfx.clear();
      const k = Math.min(1, f.t / f.ms), e = k * k;
      const hx = f.from.x + (f.to.x - f.from.x) * e, hy = f.from.y + (f.to.y - f.from.y) * e;
      if (k < 1) {
        f.head.setPosition(hx, hy);
        for (let j = 0; j < 60; j++) {
          const u = j / 60;
          const px = hx + (f.from.x - f.to.x) * u * 0.45 * e, py = hy + (f.from.y - f.to.y) * u * 0.45 * e;
          g.fillStyle(j < 5 ? 0xffffff : j < 20 ? 0xfff0b0 : 0xff9a5a, (1 - u) * 0.9).fillRect(Math.round(px), Math.round(py), 2, 2);
        }
        return true;
      }
      if (!f.hit) {
        f.hit = true;
        f.head.destroy();
        this.mark = this.makeMark(f.to.x, f.to.y);
        sc.cameras.main.shake(140, 0.004);
        if (sc.effects && !sc.effects.reduced) sc.effects.sparkle(f.to.x, f.to.y, 14);
        if (f.onHit) f.onHit();
      }
      // The flash and its ring spreading out.
      const q = (f.t - f.ms) / 600;
      if (q >= 1) { f.gfx.destroy(); return false; }
      g.fillStyle(0xffffff, (1 - q) * 0.7).fillCircle(f.to.x, f.to.y, 6 + q * 10);
      g.lineStyle(2, 0xfff0b0, 1 - q).strokeEllipse(f.to.x, f.to.y, 10 + q * 90, 6 + q * 50);
      return true;
    });
    if (this.mark) {
      const m = this.mark;
      m.t += dt;
      const p = 0.75 + 0.25 * Math.sin(m.t / 260);
      m.img.setAlpha(m.fade * p).setScale(1.7 + 0.08 * Math.sin(m.t / 300));
      m.halo.setAlpha(0.45 * m.fade * p);
      if (m.out) { m.fade -= dt / 500; if (m.fade <= 0) { m.img.destroy(); m.halo.destroy(); m.smoke.destroy(); this.mark = null; } }
    }
  }

  makeMark(x, y) {
    const sc = this.scene;
    const img = sc.add.image(x, y, 'star_crater').setDepth(DEPTH.light + 1).setBlendMode('ADD').setTint(0xffd890);
    const halo = sc.add.image(x, y, 'glow_small').setDepth(DEPTH.light + 1).setBlendMode('ADD').setTint(0xffc860).setScale(3.2).setAlpha(0.5);
    const smoke = sc.add.particles(x, y, 'px2', {
      frequency: 160, lifespan: 1600, speedY: { min: -14, max: -6 }, speedX: { min: -4, max: 4 },
      alpha: { start: 0.6, end: 0 }, tint: [0xfff0c0, 0xb8a8d8, 0x8a7ab8],
    }).setDepth(DEPTH.holds - 0.5);
    return { img, halo, smoke, t: 0, fade: 1, out: false, x, y };
  }

  // The crater burns out (its route was climbed, or left behind).
  clearMark(burst = false) {
    if (!this.mark || this.mark.out) return;
    if (burst && this.scene.effects) this.scene.effects.sparkle(this.mark.x, this.mark.y, 10);
    this.mark.out = true;
    this.mark.smoke.stop();
  }

  destroy() {
    if (this.g) this.g.destroy();
    this.falls.forEach((f) => { f.gfx.destroy(); if (!f.hit) f.head.destroy(); });
    if (this.mark) { this.mark.img.destroy(); this.mark.halo.destroy(); this.mark.smoke.destroy(); }
  }
}
