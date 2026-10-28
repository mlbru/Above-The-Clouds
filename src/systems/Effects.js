import { DEPTH } from '../config/gameConfig.js';

const RAINBOW = [0xf0644b, 0xf2c14e, 0x8fd16a, 0x6fd6ff, 0xb48ae0, 0xf07ab8];

// Trails (cosmetics 'trail'): particles left behind while the climber moves.
const TRAILS = {
  chalk: { tex: 'dust', speed: { min: 2, max: 10 }, lifespan: 700, alpha: { start: 0.55, end: 0 }, scale: { start: 0.9, end: 1.5 }, gravityY: -6 },
  leaves: { tex: 'fx_leaf', speedX: { min: -14, max: 14 }, speedY: { min: 4, max: 16 }, lifespan: 1300, alpha: { start: 1, end: 0 }, rotate: { min: 0, max: 360 }, gravityY: 18, tint: [0xe0802a, 0xc8463b, 0xf2c14e, 0x9a5a2a] },
  stardust: { tex: 'spark', speed: { min: 3, max: 14 }, lifespan: 600, alpha: { start: 1, end: 0 }, scale: { start: 0.9, end: 0.1 }, tint: [0xf2d06a, 0xffffff, 0xfff1a0], blendMode: 'ADD' },
  snow: { tex: 'px2', speedX: { min: -8, max: 8 }, speedY: { min: 6, max: 18 }, lifespan: 1100, alpha: { start: 1, end: 0 }, tint: [0xffffff, 0xeef6ff, 0xbfe4ff] },
  hearts: { tex: 'fx_heart', speedX: { min: -8, max: 8 }, speedY: { min: -22, max: -8 }, lifespan: 900, alpha: { start: 1, end: 0 }, scale: { start: 0.9, end: 0.4 }, tint: [0xf07ab8, 0xf0644b, 0xffb0d8] },
  fire: { tex: 'px2', speedX: { min: -6, max: 6 }, speedY: { min: -38, max: -16 }, lifespan: 480, alpha: { start: 1, end: 0 }, scale: { start: 1.6, end: 0.3 }, tint: [0xfff1a0, 0xff9a3c, 0xf0644b], blendMode: 'ADD' },
  rainbow: { tex: 'px2', speed: { min: 0, max: 4 }, lifespan: 750, alpha: { start: 1, end: 0 }, scale: { start: 1.5, end: 0.6 } },
};

// World-space particle bursts reused for the whole run (no per-event emitters).
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.reduced = false;
    this.trailSkip = 0;
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
    this.flames = scene.add.particles(0, 0, 'px2', {
      speedX: { min: -10, max: 10 }, speedY: { min: -40, max: -14 }, lifespan: 520, alpha: { start: 1, end: 0 }, scale: { start: 1.6, end: 0.3 },
      tint: [0xfff1a0, 0xff9a3c, 0xf0644b], blendMode: 'ADD', emitting: false,
    }).setDepth(DEPTH.fx);
    this.confetti = scene.add.particles(0, 0, 'px2', {
      speedX: { min: -90, max: 90 }, speedY: { min: -150, max: -60 }, gravityY: 160, lifespan: { min: 1400, max: 2400 },
      rotate: { min: 0, max: 360 }, tint: [0xf2c14e, 0xf0644b, 0x8fd16a, 0x9fd8ff, 0xffffff, 0xd88cff], emitting: false,
    }).setDepth(DEPTH.fx + 6);
  }

  // ---------------------------------------------------------------- trails
  setTrail(item) {
    const style = item && item.style !== 'none' ? item.style : null;
    if (style === this.trailStyle) return;
    this.trailStyle = style;
    if (this.trailFx) { this.trailFx.destroy(); this.trailFx = null; }
    if (!style) return;
    const { tex, ...cfg } = TRAILS[style];
    this.trailFx = this.scene.add.particles(0, 0, tex, { ...cfg, emitting: false }).setDepth(DEPTH.climber - 1);
    this.trailI = 0;
  }

  // Called while the climber moves; drops a particle or two at (x, y).
  trail(x, y) {
    if (!this.trailFx || (this.reduced && ++this.trailSkip % 2)) return;
    if (this.trailStyle === 'rainbow') this.trailFx.setParticleTint(RAINBOW[Math.floor(this.trailI++ / 2) % RAINBOW.length]);
    this.trailFx.explode(1, x + (Math.random() - 0.5) * 6, y + (Math.random() - 0.5) * 6);
  }

  // ---------------------------------------------------------------- hit effects
  setHit(item) { this.hitStyle = (item && item.style) || 'ring'; }

  // The flourish on a perfect hit. heat (0-20) grows it with the streak.
  hit(x, y, heat = 0) {
    const style = this.hitStyle || 'ring';
    const hot = heat >= 10;
    if (style === 'ring') { this.ring(x, y, hot ? 0xff9a3c : 0xf2d06a, 12 + Math.floor(heat / 3)); return; }
    if (!this.hitFx) this.hitFx = {};
    const burst = (key, tex, cfg, count) => {
      if (!this.hitFx[key]) this.hitFx[key] = this.scene.add.particles(0, 0, tex, { ...cfg, emitting: false }).setDepth(DEPTH.fx + 1);
      this.hitFx[key].explode(this.n(count + Math.floor(heat / 3)), x, y);
    };
    if (style === 'star') {
      burst('star', 'fx_star', { speed: { min: 40, max: 75 }, lifespan: 360, alpha: { start: 1, end: 0 }, scale: { start: 1, end: 0.3 }, tint: [0xfff1a0, 0xffffff, 0xf2c14e], blendMode: 'ADD' }, 7);
      this.ring(x, y, 0xfff1a0, 9, 160);
    } else if (style === 'blast') {
      burst('blast', 'px2', { speed: { min: 30, max: 95 }, lifespan: 420, gravityY: 90, alpha: { start: 1, end: 0 }, scale: { start: 1.6, end: 0.6 }, tint: [0xffffff, 0xf2c14e, 0xff9a3c, 0xf0644b] }, 12);
    } else if (style === 'notes') {
      burst('notes', 'fx_note', { speedX: { min: -26, max: 26 }, speedY: { min: -55, max: -25 }, lifespan: 750, alpha: { start: 1, end: 0 }, tint: [0xffffff, 0x9fd8ff, 0xf5a0c8, 0xf2c14e] }, 3);
    } else if (style === 'hearts') {
      burst('hearts', 'fx_heart', { speed: { min: 25, max: 55 }, lifespan: 520, alpha: { start: 1, end: 0 }, scale: { start: 1, end: 0.5 }, tint: [0xf07ab8, 0xf0644b, 0xffb0d8] }, 5);
    } else if (style === 'shards') {
      burst('shards', 'fx_shard', { speed: { min: 45, max: 90 }, lifespan: 560, gravityY: 220, rotate: { min: 0, max: 360 }, alpha: { start: 1, end: 0 }, tint: [0xe0344f, 0x4f86f0, 0x3fcf6a, 0xd8fbff, 0xf2a03c] }, 8);
      this.ring(x, y, 0xd8fbff, 8, 140);
    } else if (style === 'bolt') {
      this.bolt(x, y, hot ? 4 : 3);
    }
  }

  // A few jagged lightning strokes flashing out from the hand.
  bolt(x, y, count) {
    const g = this.scene.add.graphics().setDepth(DEPTH.fx + 1).setBlendMode('ADD');
    for (let k = 0; k < count; k++) {
      const a = -Math.PI / 2 + (k - (count - 1) / 2) * 0.9 + (Math.random() - 0.5) * 0.4;
      let px = x, py = y;
      for (let i = 0; i < 4; i++) {
        const len = 4 + Math.random() * 3;
        const nx = px + Math.cos(a) * len + (Math.random() - 0.5) * 5, ny = py + Math.sin(a) * len + (Math.random() - 0.5) * 5;
        g.lineStyle(2, 0x6fb8ff, 0.6); g.lineBetween(px, py, nx, ny);
        g.lineStyle(1, 0xffffff, 1); g.lineBetween(Math.round(px), Math.round(py), Math.round(nx), Math.round(ny));
        px = nx; py = ny;
      }
    }
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 200, delay: 40, onComplete: () => g.destroy() });
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
  flameBurst(x, y, count = 10) { this.flames.explode(this.n(count), x, y); }
  breathPuff(x, y) { this.breath.explode(1, x, y); }
  // A puff of dust under the boots when the climber lands on a ledge.
  landDust(x, y, tint = 0xd8d0c0) {
    this.dust.setParticleTint(tint);
    this.dust.explode(this.n(4), x - 5, y);
    this.dust.explode(this.n(4), x + 5, y);
  }
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
