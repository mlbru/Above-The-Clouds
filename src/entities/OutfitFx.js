import { DEPTH, GAME_WIDTH } from '../config/gameConfig.js';
import { POSES, FRAME_W, bodyPoints } from '../render/climberArt.js';
import { findCosmetic } from '../data/cosmetics.js';
import { lerpColor } from '../utils/color.js';

// What the biome mastery outfits do on the mountain:
//   MOSSY PACK       a flower sprouts on the pack and blooms as your streak grows
//   ROCKFALL HOOD    shakes off a cloud of dust when a rock comes down past you
//   RIME COAT        frosts over the longer you hang on a hold, thaws as you climb
//   SKY KITE         flies on a string from your pack, higher in the wind
//   OBSIDIAN COLLAR  its glass lights up violet on every beat
//   PRISM SHELL      breaks the prism light into rainbows across the jacket
//   THUNDER JACKET   sparks fly on a perfect; at a streak of 10 it crackles
//   AURORA SCARF     shifts through the colours of the northern lights and sways
//   DRAGONSCALE COAT its scales glow like embers while the dragon's eye is open
// The jacket effects use the 'climber_mask' sheet (only the jacket's pixels),
// laid over the climber with the same frame.
const AURORA = [0x5af0a0, 0x40c8d8, 0x6a8cf0, 0x9a70f0, 0x40c8d8];
const hue = (h) => {
  const f = (n) => { const k = (n + h * 6) % 6; return Math.round(255 * (1 - Math.max(0, Math.min(k, 4 - k, 1)))); };
  return (f(5) << 16) | (f(3) << 8) | f(1);
};

export class OutfitFx {
  constructor(scene, climber) {
    this.scene = scene;
    this.climber = climber;
    this.back = scene.add.graphics().setDepth(DEPTH.climber - 0.5);
    this.front = scene.add.graphics().setDepth(DEPTH.climber + 0.5);
    this.mask = scene.add.sprite(0, 0, 'climber_mask', 'stand').setDepth(DEPTH.climber + 0.3).setVisible(false);
    this.t = 0;
    this.frost = 0;
    this.flash = 0;
    this.crackleIn = 1000;
    this.kiteSide = -1;
    this.kite = null;
    this.setLook({});
  }

  setLook(look) {
    this.jacket = findCosmetic('jacket', look.jacket || 'jacket-red').pattern || null;
    this.pack = findCosmetic('pack', look.pack || 'pack-orange').style || null;
    this.hat = findCosmetic('hat', look.hat || 'hat-beanie').style || null;
    this.acc = findCosmetic('accessory', look.accessory || 'acc-none').style || null;
    this.kite = null;
    if (this.scene.textures.exists('climber_mask')) this.mask.setTexture('climber_mask', this.climber.pose || 'stand');
  }

  // Frame point -> world point for the current pose.
  at([fx, fy]) {
    const s = this.climber.sprite;
    return [s.x - FRAME_W / 2 + fx, s.y - POSES[this.climber.pose].anchor + fy];
  }

  // ctx: { hanging, moving, streak, prism (0..1), eye (0..1), aurora (0..1),
  //        wind (0..1), bpm, cold, visible }
  update(dt, ctx) {
    this.t += dt;
    const back = this.back, front = this.front;
    back.clear(); front.clear();
    const s = this.climber.sprite;
    const visible = ctx.visible !== false && s.visible;
    if (!visible || !this.climber.pose) { this.mask.setVisible(false); return; }
    const pts = bodyPoints(this.climber.pose);
    this.updateMask(dt, ctx);
    if (this.pack === 'moss') this.drawFlower(front, pts, ctx.streak);
    if (this.acc === 'kite') this.drawKite(back, pts, ctx, dt);
    if (this.acc === 'collar') this.drawCollar(front, pts, ctx);
    if (this.acc === 'aurora') this.drawScarf(front, pts, ctx);
    if (this.jacket === 'bolt' && ctx.streak >= 10) {
      this.crackleIn -= dt;
      if (this.crackleIn <= 0) {
        this.crackleIn = 700 + Math.random() * 900;
        const [x, y] = this.at(pts.shoulders[Math.random() < 0.5 ? 0 : 1]);
        this.scene.effects.bolt(x, y, 1);
        this.flash = Math.max(this.flash, 0.6);
      }
    }
  }

  // The jacket glow: frost, rainbow, ember scales or a lightning flash.
  updateMask(dt, ctx) {
    const m = this.mask;
    const s = this.climber.sprite;
    // Frost builds while you hang still (faster in the cold) and thaws as you move.
    if (ctx.hanging) this.frost = Math.min(1, this.frost + (dt / 9000) * (ctx.cold ? 2 : 1));
    else this.frost = Math.max(0, this.frost - dt / (ctx.moving ? 1200 : 4000));
    this.flash = Math.max(0, this.flash - dt / 260);
    let alpha = 0, tint = 0xffffff, add = true;
    if (this.jacket === 'rime') {
      alpha = this.frost * 0.6; tint = 0xeef8ff; add = false;
      if (this.frost > 0.4 && Math.random() < dt / 400) {
        const [x, y] = this.at(bodyPoints(this.climber.pose).neck);
        this.scene.effects.sparkle(x + (Math.random() - 0.5) * 12, y + 4 + Math.random() * 10, 1);
      }
    } else if (this.jacket === 'prism') {
      alpha = 0.12 + ctx.prism * 0.5; tint = hue((this.t / 1400) % 1);
    } else if (this.jacket === 'scales') {
      alpha = ctx.eye * (0.45 + 0.2 * Math.sin(this.t / 140)); tint = lerpColor(0xff4a10, 0xffb040, 0.5 + 0.5 * Math.sin(this.t / 230));
    } else if (this.jacket === 'bolt') {
      alpha = this.flash * 0.8; tint = 0xfff07a;
    }
    if (alpha < 0.02) { m.setVisible(false); return; }
    m.setVisible(true).setTexture('climber_mask', this.climber.pose).setOrigin(s.originX, s.originY)
      .setPosition(s.x, s.y).setScale(s.scaleX, s.scaleY).setAngle(s.angle)
      .setBlendMode(add ? 'ADD' : 'NORMAL').setTintFill(tint).setAlpha(alpha);
  }

  // A sprout on the pack: a bud from 5 perfects in a row, a full bloom from 10.
  drawFlower(g, pts, streak) {
    const [x0, y0] = this.at(pts.packTop);
    const x = Math.round(x0 + 3 + Math.sin(this.t / 600)), y = Math.round(y0);
    const stem = streak >= 10 ? 5 : streak >= 5 ? 4 : 2;
    g.fillStyle(0x4a8a2a, 1).fillRect(x, y - stem, 1, stem);
    g.fillStyle(0x6ab83a, 1).fillRect(x - 1, y - 2, 1, 1).fillRect(x + 1, y - 3, 1, 1);
    if (streak >= 10) {
      const open = Math.min(1, (streak - 10) / 5);
      g.fillStyle(0xf5a0c8, 1).fillRect(x - 1, y - stem - 1, 3, 1).fillRect(x, y - stem - 2, 1, 3);
      if (open > 0.5) g.fillStyle(0xffd0e4, 1).fillRect(x - 2, y - stem - 1, 1, 1).fillRect(x + 2, y - stem - 1, 1, 1).fillRect(x, y - stem - 3, 1, 1);
      g.fillStyle(0xf2c14e, 1).fillRect(x, y - stem - 1, 1, 1);
    } else if (streak >= 5) {
      g.fillStyle(0xe07aa8, 1).fillRect(x, y - stem - 1, 1, 2);
    }
  }

  // A diamond kite on a long sagging string, tail of little bows below it.
  drawKite(g, pts, ctx, dt) {
    const [ax, ay] = this.at(pts.packTop);
    const wind = Math.min(1, ctx.wind || 0);
    // It drifts over to the side with more room (away from the middle of the screen).
    const cam = this.scene.cameras.main;
    const want = ax - cam.scrollX < GAME_WIDTH / 2 ? 1 : -1;
    if (want !== this.kiteSide && Math.random() < dt / 3000) this.kiteSide = want;
    const tx = ax + this.kiteSide * (26 + wind * 10) + Math.sin(this.t / 900) * 5 + Math.sin(this.t / 370) * 2 * (1 + wind * 2);
    const ty = ay - 38 - wind * 14 + Math.sin(this.t / 700) * 4;
    if (!this.kite) this.kite = [tx, ty];
    this.kite[0] += (tx - this.kite[0]) * Math.min(1, dt / 300);
    this.kite[1] += (ty - this.kite[1]) * Math.min(1, dt / 300);
    const [kx, ky] = this.kite;
    // The string sags between the pack and the kite.
    g.fillStyle(0xe8e4da, 0.75);
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      g.fillRect(Math.round(ax + (kx - ax) * u), Math.round(ay + (ky + 6 - ay) * u + Math.sin(u * Math.PI) * 6), 1, 1);
    }
    const x = Math.round(kx), y = Math.round(ky), tilt = Math.round(Math.sin(this.t / 500) * 1.5);
    const quad = [[0xe04a3a, -1, -1], [0xf2c14e, 1, -1], [0xf2c14e, -1, 1], [0xe04a3a, 1, 1]];
    for (const [c, sx, sy] of quad) {
      g.fillStyle(c, 1);
      const h = sy < 0 ? 6 : 8;
      for (let j = 0; j < h; j++) {
        const w = Math.round(4 * (1 - j / h));
        for (let i = 0; i < w; i++) g.fillRect(x + sx * i + (sx > 0 ? 0 : -1) + (sy < 0 ? -tilt : tilt), y + sy * j + (sy > 0 ? 1 : 0), 1, 1);
      }
    }
    g.fillStyle(0x6a3a22, 1).fillRect(x, y - 6, 1, 15).fillRect(x - 4, y, 9, 1);
    // Tail.
    for (let i = 1; i <= 4; i++) {
      const bx = x + Math.round(Math.sin(this.t / 260 + i) * (2 + i)), by = y + 8 + i * 4;
      g.fillStyle(0xe8e4da, 0.8).fillRect(bx, by - 2, 1, 2);
      g.fillStyle(i % 2 ? 0x6fd6ff : 0xf07ab8, 1).fillRect(bx - 1, by, 3, 1);
    }
  }

  // Violet light running through the glass facets, brightest on the beat.
  drawCollar(g, pts, ctx) {
    const beat = ((this.t / 60000) * (ctx.bpm || 100)) % 1;
    const pulse = Math.pow(1 - beat, 3);
    const [x, y] = this.at(pts.neck);
    const cx = Math.round(x), cy = Math.round(y);
    g.fillStyle(0xb48aff, 0.35 + pulse * 0.65);
    for (let i = -4; i <= 4; i += 2) g.fillRect(cx + i, cy, 1, 1);
    if (pulse > 0.4) g.fillStyle(0xe8d8ff, pulse).fillRect(cx - 1, cy + 1, 3, 1);
    if (pulse > 0.6) g.fillStyle(0xb48aff, (pulse - 0.6) * 0.8).fillRect(cx - 6, cy - 1, 13, 4);
  }

  // A scarf flowing through the aurora colours; it swings with the swing rhythm.
  drawScarf(g, pts, ctx) {
    const [x, y] = this.at(pts.neck);
    const cx = Math.round(x), cy = Math.round(y);
    const k = (this.t / 2200) % AURORA.length;
    const col = (o) => {
      const i = Math.floor((k + o) % AURORA.length);
      return lerpColor(AURORA[i], AURORA[(i + 1) % AURORA.length], (k + o) % 1);
    };
    const front = pts.front;
    g.fillStyle(col(0), 1).fillRect(cx - 4, cy, 9, 2);
    const sway = (1 + ctx.aurora * 2) * Math.sin(this.t / (ctx.aurora > 0.5 ? 330 : 520));
    for (let i = 0; i < 9; i++) {
      // From behind, the tail hangs past the side of the pack.
      const sx = front ? cx + 3 : cx - 6 - Math.round(i * 0.25 + sway * (i / 9) * 2);
      g.fillStyle(col(i * 0.12), 1).fillRect(sx, cy + 2 + i, 2, 1);
    }
  }

  onPerfect() {
    if (this.jacket !== 'bolt') return;
    const pts = bodyPoints(this.climber.pose);
    pts.shoulders.forEach((p) => { const [x, y] = this.at(p); this.scene.effects.bolt(x, y - 1, 2); });
    this.flash = 1;
  }

  onRockfall() {
    if (this.hat !== 'hood') return;
    const [x, y] = this.at(bodyPoints(this.climber.pose).head);
    for (let i = 0; i < 5; i++) {
      const p = this.scene.add.image(x + (Math.random() - 0.5) * 8, y - 2, 'puff').setDepth(DEPTH.fx).setTint(0xa8a29a).setAlpha(0.7).setScale(0.8);
      this.scene.tweens.add({ targets: p, x: p.x + (Math.random() - 0.5) * 24, y: p.y - 6 - Math.random() * 10, scale: 2.2, alpha: 0, duration: 700 + Math.random() * 400, onComplete: () => p.destroy() });
    }
    this.scene.effects.pebbleFall(x, y, 3, 0x8a8478);
  }

  destroy() { [this.back, this.front, this.mask].forEach((o) => o.destroy()); }
}
