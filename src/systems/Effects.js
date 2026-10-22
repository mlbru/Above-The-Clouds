import { DEPTH } from '../config/gameConfig.js';

const RAINBOW = [0xf0644b, 0xf2c14e, 0x8fd16a, 0x6fd6ff, 0xb48ae0, 0xf07ab8];

// World-space particle bursts reused for the whole run (no per-event emitters).
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.reduced = false;
    this.dust = scene.add.particles(0, 0, 'dust', {
      speed: { min: 8, max: 30 }, angle: { min: 200, max: 340 }, lifespan: 700, alpha: { start: 0.7, end: 0 }, scale: { start: 1, end: 0.4 }, gravityY: 20, emitting: false,
    }).setDepth(DEPTH.fx);
    this.sparks = scene.add.particles(0, 0, 'spark', {
      speed: { min: 20, max: 60 }, lifespan: 500, alpha: { start: 1, end: 0 }, scale: { start: 1, end: 0.2 }, tint: 0xf2d06a, emitting: false, blendMode: 'ADD',
    }).setDepth(DEPTH.fx);
    this.pebbles = scene.add.particles(0, 0, 'pebble', {
      speedX: { min: -25, max: 25 }, speedY: { min: -20, max: 10 }, gravityY: 420, lifespan: 1600, rotate: { min: 0, max: 360 }, emitting: false,
    }).setDepth(DEPTH.fx);
    this.snowPuff = scene.add.particles(0, 0, 'px2', {
      speed: { min: 10, max: 40 }, angle: { min: 180, max: 360 }, gravityY: 60, lifespan: 900, alpha: { start: 1, end: 0 }, emitting: false,
    }).setDepth(DEPTH.fx);
    this.breath = scene.add.particles(0, 0, 'puff', {
      speedX: { min: -6, max: 6 }, speedY: { min: -14, max: -6 }, lifespan: 1300, alpha: { start: 0.55, end: 0 }, scale: { start: 0.5, end: 1.3 }, emitting: false,
    }).setDepth(DEPTH.fx);
    this.splash = scene.add.particles(0, 0, 'drop', {
      speedX: { min: -30, max: 30 }, speedY: { min: -60, max: -20 }, gravityY: 300, lifespan: 600, alpha: { start: 0.9, end: 0 }, emitting: false,
    }).setDepth(DEPTH.fx);
    this.confetti = scene.add.particles(0, 0, 'px2', {
      speedX: { min: -90, max: 90 }, speedY: { min: -150, max: -60 }, gravityY: 160, lifespan: { min: 1400, max: 2400 },
      rotate: { min: 0, max: 360 }, tint: [0xf2c14e, 0xf0644b, 0x8fd16a, 0x9fd8ff, 0xffffff, 0xd88cff], emitting: false,
    }).setDepth(DEPTH.fx + 6);
  }

  n(count) { return Math.max(1, Math.round(count * (this.reduced ? 0.4 : 1))); }
  // Chalk puffs take the colour of the equipped chalk (see cosmetics 'chalk').
  setChalk(item) { this.chalkItem = item || null; }
  chalk(x, y) {
    const c = this.chalkItem;
    let tint = 0xffffff;
    if (c && c.rainbow) tint = RAINBOW[Math.floor(Math.random() * RAINBOW.length)];
    else if (c && c.id !== 'chalk-white') tint = c.color;
    this.dust.setParticleTint(tint);
    this.dust.explode(this.n(5), x, y);
  }
  sparkle(x, y, count = 6) { this.sparks.explode(this.n(count), x, y); }
  pebbleFall(x, y, count = 4, tint = 0x8a8478) { this.pebbles.setParticleTint(tint); this.pebbles.explode(this.n(count), x, y); }
  snowBurst(x, y) { this.snowPuff.explode(this.n(8), x, y); }
  breathPuff(x, y) { this.breath.explode(1, x, y); }
  confettiBurst(x, y, count = 40) { this.confetti.explode(this.n(count), x, y); }

  // An expanding pixel ring (impact accent for perfect hits).
  ring(x, y, color = 0xf2d06a, radius = 12, duration = 220) {
    const g = this.scene.add.graphics().setDepth(DEPTH.fx + 1).setBlendMode('ADD');
    const st = { r: 2 };
    this.scene.tweens.add({
      targets: st, r: radius, duration, ease: 'Quad.easeOut',
      onUpdate: (tw) => {
        g.clear();
        g.lineStyle(1, color, 1 - tw.progress);
        g.strokeCircle(Math.round(x), Math.round(y), Math.round(st.r));
      },
      onComplete: () => g.destroy(),
    });
  }
}
