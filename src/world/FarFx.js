// What the Far Range's twists look like out on the wall (the note track
// shows them too, see ui/ComboPrompt.js):
//   sprayCurtain  a sheet of spray from a waterfall sweeps across the wall
//                 past you while you climb in the spray (the Cascade)
//   rainbow       a full rainbow shines up out of the spray
//   monk          a monk on a little balcony beside you strikes a bell
//                 for every arrow of the call (the Hanging Monastery)
//   steam         tea steaming on a monastery ledge
import { DEPTH } from '../config/gameConfig.js';

export class FarFx {
  constructor(scene) {
    this.scene = scene;
    this.curtain = null;
    this.monk = null;
    this.items = [];
  }

  // A sheet of spray swings to and fro across the wall at the climber's
  // height (l..r: the wall's edges there), one swing every periodMs, until
  // clearCurtain(). It moves in step with the curtain on the note track.
  sprayCurtain(fromLeft, l, r, y, periodMs) {
    this.clearCurtain(true);
    const sc = this.scene;
    const sheet = sc.add.tileSprite(0, y - 150, 56, 300, 'far_curtain').setOrigin(0.5, 0).setDepth(DEPTH.climber + 2).setAlpha(0);
    const back = sc.add.tileSprite(0, y - 150, 56, 300, 'far_curtain').setOrigin(0.5, 0).setDepth(DEPTH.holds - 0.5).setAlpha(0).setFlipX(true);
    const reduced = sc.effects && sc.effects.reduced;
    const drops = sc.add.particles(0, 0, 'px2', {
      frequency: reduced ? 120 : 30, lifespan: 700, speedX: { min: -30, max: 30 }, speedY: { min: 40, max: 120 },
      alpha: { start: 0.9, end: 0 }, tint: [0xffffff, 0xd8f6ff], x: { min: -26, max: 26 }, y: { min: 0, max: 260 },
    }).setDepth(DEPTH.climber + 3);
    drops.startFollow(sheet, 0, 0);
    this.curtain = { sheet, back, drops, t: 0, periodMs, l: l + 20, r: r - 20, ph0: fromLeft ? -Math.PI / 2 : Math.PI / 2, fade: 0, out: false };
  }

  clearCurtain(now = false) {
    const c = this.curtain;
    if (!c) return;
    if (!now) { c.out = true; return; }
    c.sheet.destroy(); c.back.destroy(); c.drops.destroy();
    this.curtain = null;
  }

  // A rainbow shining up out of the spray around (x, y).
  rainbow(x, y) {
    const sc = this.scene;
    const r = sc.add.image(x, y + 10, 'far_rainbow').setOrigin(0.5, 1).setDepth(DEPTH.holds - 0.4).setScale(2.2).setAlpha(0).setBlendMode('ADD');
    sc.tweens.add({ targets: r, alpha: 0.75, duration: 500, yoyo: true, hold: 1800, onComplete: () => r.destroy() });
  }

  // A monk on a little temple balcony at the wall's edge beside the climber,
  // with his bell. side: -1 left edge, 1 right edge.
  showMonk(x, y) {
    if (this.monk) return;
    const sc = this.scene;
    const g = sc.add.graphics().setDepth(DEPTH.decor + 2);
    // The balcony: a red plank floor on brackets, a rail with gold caps.
    g.fillStyle(0x16100c, 1).fillRect(x - 22, y - 1, 46, 5);
    g.fillStyle(0x8a5a34, 1).fillRect(x - 21, y, 44, 3);
    g.fillStyle(0xd8a868, 1).fillRect(x - 21, y, 44, 1);
    g.fillStyle(0x16100c, 1).fillRect(x - 18, y + 4, 2, 6).fillRect(x + 16, y + 4, 2, 6);
    g.fillStyle(0xb8342a, 1).fillRect(x - 21, y - 9, 2, 9).fillRect(x + 21, y - 9, 2, 9).fillRect(x - 21, y - 9, 44, 1);
    g.fillStyle(0xf2c252, 1).fillRect(x - 21, y - 10, 2, 1).fillRect(x + 21, y - 10, 2, 1);
    const bell = sc.add.image(x + 9, y, 'far_bell').setOrigin(0.5, 1).setDepth(DEPTH.decor + 2.2);
    const monk = sc.add.sprite(x - 6, y, 'far_monk', 0).setOrigin(0.5, 1).setDepth(DEPTH.decor + 2.4);
    const glow = sc.add.image(x + 9, y - 10, 'glow').setDepth(DEPTH.decor + 2.3).setBlendMode('ADD').setTint(0xffd070).setAlpha(0);
    const rings = sc.add.graphics().setDepth(DEPTH.decor + 2.5).setBlendMode('ADD');
    for (const o of [g, bell, monk, glow]) { o.setAlpha(0); sc.tweens.add({ targets: o, alpha: o === glow ? 0 : 1, duration: 300 }); }
    this.monk = { g, bell, monk, glow, rings, x, y, list: [], swing: 0 };
  }

  hideMonk() {
    if (!this.monk) return;
    const m = this.monk;
    this.monk = null;
    this.scene.tweens.add({ targets: [m.g, m.bell, m.monk], alpha: 0, duration: 300, onComplete: () => { m.g.destroy(); m.bell.destroy(); m.monk.destroy(); } });
    m.glow.destroy(); m.rings.destroy();
  }

  // One strike of the call: the mallet swings, the bell rocks, rings of light.
  strike() {
    const m = this.monk;
    if (!m) return;
    m.monk.setFrame(1);
    this.scene.time.delayedCall(90, () => { if (this.monk === m) m.monk.setFrame(2); });
    this.scene.time.delayedCall(260, () => { if (this.monk === m) m.monk.setFrame(0); });
    m.swing = 1;
    m.list.push({ t: 0 });
    m.glow.setAlpha(0.6);
  }

  // The monk's tea on a monastery ledge: a little steam from the cup.
  steam(x, y) {
    const sc = this.scene;
    const p = sc.add.particles(x, y, 'puff', {
      frequency: 260, lifespan: 1600, speedX: { min: -3, max: 3 }, speedY: { min: -14, max: -8 },
      alpha: { start: 0.45, end: 0 }, scale: { start: 0.15, end: 0.5 }, tint: 0xffffff,
    }).setDepth(DEPTH.decor + 3);
    sc.time.delayedCall(5000, () => p.destroy());
  }

  update(dt) {
    const c = this.curtain;
    if (c) {
      c.t += dt;
      c.fade = Math.max(0, Math.min(1, c.fade + (c.out ? -dt : dt) / 400));
      const ph = (c.t / c.periodMs) * Math.PI * 2 + c.ph0;
      const x = (c.l + c.r) / 2 + Math.sin(ph) * (c.r - c.l) / 2;
      c.sheet.setX(Math.round(x)).setAlpha(0.8 * c.fade);
      c.back.setX(Math.round(x + 6)).setAlpha(0.45 * c.fade);
      c.sheet.tilePositionY -= dt * 0.22;
      c.back.tilePositionY -= dt * 0.15;
      if (c.out) c.drops.stop();
      if (c.out && c.fade <= 0) this.clearCurtain(true);
    }
    const m = this.monk;
    if (m) {
      m.swing = Math.max(0, m.swing - dt / 500);
      m.bell.setRotation(Math.sin(m.swing * 14) * 0.18 * m.swing);
      m.glow.setAlpha(Math.max(0, m.glow.alpha - dt / 600));
      m.rings.clear();
      m.list = m.list.filter((r) => (r.t += dt) < 700);
      for (const r of m.list) {
        const k = r.t / 700;
        m.rings.lineStyle(1, 0xfff0a8, 0.8 * (1 - k)).strokeEllipse(m.x + 9, m.y - 10, 10 + k * 46, 8 + k * 30);
      }
    }
  }

  destroy() { this.clearCurtain(true); this.hideMonk(); }
}
