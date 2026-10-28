import { DEPTH } from '../config/gameConfig.js';
import { POSES, FRAME_W, bodyPoints } from '../render/climberArt.js';

// WEATHER ON YOU (settings): the mountain leaves its marks on the climber.
//   snow    piles up on the hat, shoulders and pack in snow and whiteouts
//   wet     the jacket darkens and drips in a Storm Crown downpour or a waterfall
//   soot    dragon fire and the volcano grey the jacket with ash
//   glitter crystal dust twinkles on the jacket in the Crystal Heights
// Every layer builds slowly while you are in it and fades slowly after. Rest
// on a ledge and the climber shakes it all off.
const RATE = { snow: 1 / 40000, wet: 1 / 14000, soot: 1 / 30000, glitter: 1 / 25000 };
const FADE = { snow: 1 / 90000, wet: 1 / 45000, soot: 1 / 240000, glitter: 1 / 40000 };
const SHAKE_AT = 0.3; // total coat that makes the climber shake it off on a ledge

export class WeatherCoat {
  constructor(scene, climber) {
    this.scene = scene;
    this.climber = climber;
    this.g = scene.add.graphics().setDepth(DEPTH.climber + 0.4);
    this.mask = scene.add.sprite(0, 0, 'climber_mask', 'stand').setDepth(DEPTH.climber + 0.2).setVisible(false);
    this.lv = { snow: 0, wet: 0, soot: 0, glitter: 0 };
    this.t = 0;
    this.dripIn = 0;
    this.restT = 0;
    this.enabled = true;
  }

  // Dragon fire that hits you leaves a lot of soot at once.
  scorch(amount = 0.45) { this.lv.soot = Math.min(1, this.lv.soot + amount); }

  get total() { return this.lv.snow + this.lv.wet + this.lv.soot + this.lv.glitter; }

  // ctx: { snow, wet, soot, glitter (0..1 exposure), resting, visible }
  update(dt, ctx) {
    this.t += dt;
    const lv = this.lv;
    for (const k of Object.keys(lv)) {
      const expo = Math.max(0, Math.min(1, ctx[k] || 0));
      lv[k] = expo > 0.05 ? Math.min(1, lv[k] + expo * RATE[k] * dt) : Math.max(0, lv[k] - FADE[k] * dt);
    }
    // On a ledge the climber shakes it all off after a moment.
    this.restT = ctx.resting ? this.restT + dt : 0;
    if (this.restT > 1400 && this.total > SHAKE_AT && !this.climber.fidgeting && this.climber.busy === 0) this.shakeOff();
    this.draw(dt, ctx);
  }

  shakeOff() {
    this.restT = -100000;
    const c = this.climber, fx = this.scene.effects;
    c.fidget('shake', fx);
    const h = c.head;
    if (this.lv.snow > 0.15) fx.snowBurst(h.x, h.y + 4);
    if (this.lv.wet > 0.15) fx.splash.explode(fx.n(8), h.x, h.y + 10);
    if (this.lv.soot > 0.15) fx.pebbleFall(h.x, h.y + 8, 4, 0x3a3430);
    if (this.lv.glitter > 0.15) fx.sparkle(h.x, h.y + 8, 8);
    for (const k of Object.keys(this.lv)) this.lv[k] *= 0.15;
  }

  at([fx, fy]) {
    const s = this.climber.sprite;
    return [Math.round(s.x - FRAME_W / 2 + fx), Math.round(s.y - POSES[this.climber.pose].anchor + fy)];
  }

  draw(dt, ctx) {
    const g = this.g, m = this.mask, s = this.climber.sprite, lv = this.lv;
    g.clear();
    if (!this.enabled || ctx.visible === false || !s.visible || !this.climber.pose || this.total < 0.02) { m.setVisible(false); return; }
    const pts = bodyPoints(this.climber.pose);

    // Wet or sooty: the jacket darkens (the mask holds only the jacket's pixels).
    const dark = Math.max(lv.wet * 0.42, lv.soot * 0.5);
    if (dark > 0.03 && this.scene.textures.exists('climber_mask')) {
      const tint = lv.soot > lv.wet ? 0x2a2420 : 0x14203a;
      m.setVisible(true).setTexture('climber_mask', this.climber.pose).setOrigin(s.originX, s.originY)
        .setPosition(s.x, s.y).setScale(s.scaleX, s.scaleY).setAngle(s.angle).setTintFill(tint).setAlpha(dark);
    } else m.setVisible(false);

    // Snow: a cap on the head, a rim on the shoulders, a heap on the pack.
    if (lv.snow > 0.08) {
      const n = lv.snow;
      const [hx, hy] = this.at(pts.head);
      const w = 3 + Math.round(n * 6);
      g.fillStyle(0xffffff, 1).fillRect(hx - Math.floor(w / 2), hy - 5, w, n > 0.5 ? 2 : 1);
      g.fillStyle(0xd8ecff, 1).fillRect(hx - Math.floor(w / 2) + 1, hy - 4 + (n > 0.5 ? 1 : 0), Math.max(1, w - 2), 1);
      pts.shoulders.forEach(([sx, sy], i) => {
        const [x, y] = this.at([sx, sy - 2]);
        const sw = 1 + Math.round(n * 3);
        g.fillStyle(0xffffff, 1).fillRect(i ? x - sw + 1 : x, y, sw, 1);
      });
      if (!pts.front && n > 0.3) {
        const [px, py] = this.at(pts.packTop);
        const pw = 3 + Math.round(n * 7);
        g.fillStyle(0xffffff, 1).fillRect(px - Math.floor(pw / 2), py - 2, pw, 1);
        if (n > 0.6) g.fillRect(px - 2, py - 3, 4, 1);
      }
    }

    // Drips falling from the hem of a wet jacket.
    if (lv.wet > 0.2) {
      this.dripIn -= dt * lv.wet;
      if (this.dripIn <= 0) {
        this.dripIn = 260 + Math.random() * 500;
        const [x, y] = this.at([pts.neck[0] + (Math.random() - 0.5) * 12, pts.neck[1] + 15]);
        const d = this.scene.add.rectangle(x, y, 1, 2, 0x9fd0ff).setDepth(DEPTH.climber + 0.5).setAlpha(0.9);
        this.scene.tweens.add({ targets: d, y: y + 14 + Math.random() * 8, alpha: 0, duration: 420, ease: 'Quad.easeIn', onComplete: () => d.destroy() });
      }
    }

    // Soot specks and crystal glitter on the jacket.
    const [nx, ny] = this.at(pts.neck);
    const specks = (count, color, alpha, seed) => {
      for (let i = 0; i < count; i++) {
        const k = (i * 7919 + seed) % 97;
        const x = nx - 6 + (k % 13), y = ny + 3 + ((k * 3) % 11);
        g.fillStyle(color, alpha).fillRect(x, y, 1, 1);
      }
    };
    if (lv.soot > 0.15) specks(Math.round(lv.soot * 7), 0x1a1614, 0.9, 11);
    if (lv.glitter > 0.08) {
      const tw = Math.floor(this.t / 140);
      for (let i = 0; i < Math.round(lv.glitter * 8); i++) {
        if ((tw + i * 3) % 5 > 1) continue;
        const k = (i * 131 + tw * 17) % 89;
        g.fillStyle([0xffffff, 0xffc8f0, 0xb8fff4, 0xfff1a8][i % 4], 1).fillRect(nx - 6 + (k % 13), ny + 2 + ((k * 5) % 12), 1, 1);
      }
    }
  }

  clear() { for (const k of Object.keys(this.lv)) this.lv[k] = 0; }

  destroy() { this.g.destroy(); this.mask.destroy(); }
}
