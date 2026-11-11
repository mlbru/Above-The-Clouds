// Biome entrance moments: climbing into a new biome plays a short signature
// scene over the panorama (birds take off from the Stone Wall, a snow squall
// sweeps the Frozen Reach, the hive empties its bees...). Installed onto
// ClimbScene.prototype; everything is screen-space and cleans itself up.
import { GAME_WIDTH, GAME_HEIGHT, DEPTH } from '../config/gameConfig.js';
import { Audio } from '../systems/AudioSystem.js';

const D = DEPTH.hud - 3;

export const biomeMoments = {
  biomeMoment(b) {
    if (this.settings.reducedParticles) return;
    const fn = MOMENTS[b.id];
    if (fn) fn.call(this, b);
  },

  // A small screen-space pixel that moves along a path and fades.
  momentDot(x, y, color, size = 1) {
    return this.add.rectangle(x, y, size, size, color).setScrollFactor(0).setDepth(D);
  },
};

const W = () => GAME_WIDTH, H = () => GAME_HEIGHT;
const rnd = (a, b) => a + Math.random() * (b - a);

const MOMENTS = {
  // A flock of birds bursts off the cliff and wheels away across the sky.
  stone() {
    Audio.play('flutter');
    for (let i = 0; i < 9; i++) {
      const bird = this.add.sprite(rnd(80, W() - 80), H() * 0.62 + rnd(-20, 20), 'bird', 0).setScrollFactor(0).setDepth(D).setTint(0x2a2430).setScale(rnd(0.8, 1.2));
      const tx = bird.x + (Math.random() < 0.5 ? -1 : 1) * rnd(160, 260), ty = rnd(20, 70);
      this.tweens.add({ targets: bird, x: tx, y: ty, delay: i * 70, duration: rnd(1600, 2200), ease: 'Sine.easeOut', onComplete: () => bird.destroy() });
      this.tweens.add({ targets: bird, scale: bird.scale * 0.6, delay: i * 70, duration: 2000 });
      let f = 0;
      const flap = this.time.addEvent({ delay: 110, repeat: 18, callback: () => { if (bird.active) bird.setFrame((f++ % 2) + 1); } });
      bird.once('destroy', () => flap.remove());
    }
  },

  // A snow squall: streaks of snow race across the screen, then it calms.
  frozen() {
    Audio.play('gust');
    for (let i = 0; i < 70; i++) {
      const y = rnd(20, H() - 20), len = Math.round(rnd(3, 9));
      const s = this.add.rectangle(-10, y, len, 1, 0xf4f8ff, rnd(0.5, 0.95)).setScrollFactor(0).setDepth(D);
      this.tweens.add({ targets: s, x: W() + 20, y: y + rnd(10, 40), delay: rnd(0, 1300), duration: rnd(500, 900), onComplete: () => s.destroy() });
    }
  },

  // The clouds part: two banks slide away to both sides and open the view.
  clouds() {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const c = this.add.image(W() / 2 + side * rnd(10, 70), rnd(60, H() - 60), `cloud${i % 4}`).setScrollFactor(0).setDepth(D).setScale(2.2).setAlpha(0.95).setFlipX(side > 0);
        this.tweens.add({ targets: c, x: c.x + side * (W() * 0.7), alpha: 0, delay: 200 + i * 60, duration: 1800, ease: 'Sine.easeIn', onComplete: () => c.destroy() });
      }
    }
  },

  // The hive empties: a buzzing swarm pours out and swirls past.
  hive() {
    Audio.play('buzz');
    const cx = W() * 0.8, cy = H() * 0.55;
    for (let i = 0; i < 60; i++) {
      const bee = this.momentDot(cx, cy, i % 3 ? 0xffc83c : 0x2a1a08, 2);
      const p = { t: 0 }, a0 = rnd(0, Math.PI * 2), r = rnd(20, 60), sx = rnd(-1, 1);
      this.tweens.add({
        targets: p, t: 1, delay: i * 18, duration: rnd(1500, 2100), ease: 'Sine.easeInOut',
        onUpdate: () => {
          const t = p.t;
          bee.setPosition(cx - t * W() * 0.9 + Math.cos(a0 + t * 9) * r, cy + Math.sin(a0 + t * 11) * r * 0.6 + sx * t * 40);
        },
        onComplete: () => bee.destroy(),
      });
    }
  },

  // The black glass drinks the light: embers rise out of the dark.
  obsidian() {
    for (let i = 0; i < 40; i++) {
      const e = this.momentDot(rnd(0, W()), H() + 4, i % 2 ? 0xff8a3c : 0xc86aff, Math.random() < 0.3 ? 2 : 1);
      this.tweens.add({ targets: e, y: rnd(20, H() * 0.6), x: e.x + rnd(-30, 30), alpha: 0, delay: rnd(0, 1400), duration: rnd(1400, 2200), ease: 'Sine.easeOut', onComplete: () => e.destroy() });
    }
  },

  // Split light: rays of colour fan across the screen and shimmer out.
  crystal() {
    Audio.play('crystal');
    const cols = [0xff9ae6, 0xfff0a0, 0xa8ffd8, 0x9fd8ff, 0xd8a6ff];
    cols.forEach((c, i) => {
      const ray = this.add.rectangle(W() * 0.15, -10, 6, H() * 1.6, c, 0.22).setOrigin(0.5, 0).setScrollFactor(0).setDepth(D).setBlendMode('ADD').setAngle(-30 + i * 12);
      this.tweens.add({ targets: ray, alpha: 0, angle: ray.angle + 10, delay: i * 90, duration: 1800, onComplete: () => ray.destroy() });
    });
    for (let i = 0; i < 26; i++) {
      const s = this.momentDot(rnd(0, W()), rnd(0, H()), cols[i % 5], 2);
      s.setAlpha(0);
      this.tweens.add({ targets: s, alpha: 1, yoyo: true, delay: rnd(0, 1600), duration: 260, onComplete: () => s.destroy() });
    }
  },

  // The bastion wakes: a heavy clank, the screen judders, cogs roll past.
  clockwork() {
    Audio.play('rockhit');
    this.cam.shake(220, 0.004);
    for (let i = 0; i < 4; i++) {
      const g = this.add.graphics().setScrollFactor(0).setDepth(D);
      const r = rnd(8, 16);
      g.fillStyle(0x8a6a3a, 1).fillCircle(0, 0, r);
      g.fillStyle(0xc8a050, 1).fillCircle(0, 0, r - 3);
      g.fillStyle(0x3a2a14, 1).fillCircle(0, 0, 3);
      for (let k = 0; k < 8; k++) g.fillStyle(0x8a6a3a, 1).fillRect(Math.cos((k * Math.PI) / 4) * (r + 1) - 2, Math.sin((k * Math.PI) / 4) * (r + 1) - 2, 4, 4);
      g.setPosition(-20, H() * 0.3 + i * 30);
      this.tweens.add({ targets: g, x: W() + 30, angle: 720, delay: i * 180, duration: 1800, ease: 'Sine.easeInOut', onComplete: () => g.destroy() });
    }
  },

  // The storm announces itself: a bolt and a long roll of thunder.
  storm() {
    this.time.delayedCall(250, () => this.lightning());
  },

  // The aurora flares: a ribbon of green light sweeps the sky.
  aurora() {
    const g = this.add.graphics().setScrollFactor(0).setDepth(D).setBlendMode('ADD');
    for (let x = 0; x < W(); x += 2) {
      const y = 50 + Math.sin(x / 40) * 18;
      g.fillStyle(x % 6 === 0 ? 0x8affd0 : 0x40d8a0, 0.35).fillRect(x, y, 2, 26 + Math.sin(x / 13) * 8);
    }
    g.setAlpha(0);
    this.tweens.add({ targets: g, alpha: 1, duration: 600, yoyo: true, hold: 600, onComplete: () => g.destroy() });
  },

  // Old bones rattle: dust drifts down and a hollow knock sounds.
  bones() {
    Audio.play('pebble', { count: 8 });
    for (let i = 0; i < 50; i++) {
      const d = this.momentDot(rnd(0, W()), -4, i % 2 ? 0xe8dcc0 : 0xa89878);
      this.tweens.add({ targets: d, y: H() + 6, x: d.x + rnd(-20, 20), delay: rnd(0, 1600), duration: rnd(1600, 2600), onComplete: () => d.destroy() });
    }
  },
};
