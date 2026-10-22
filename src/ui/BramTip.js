import { PixelText, COLORS, drawPanel } from './PixelText.js';
import { DEPTH } from '../config/gameConfig.js';
import { Audio } from '../systems/AudioSystem.js';
import { COACH } from './coachLayout.js';
import { BRAM_TIPS } from '../data/bramTips.js';

// Bram pops up in the coach bubble with one sentence, the first time a
// mechanic appears in a real run. The game keeps running; the bubble types
// out, stays a moment and slides away. Tips that arrive together queue up.
export class BramTip {
  constructor(scene, prog) {
    this.scene = scene;
    this.prog = prog;
    const c = COACH;
    const d = DEPTH.overlay;
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(d);
    this.face = scene.add.sprite(c.x + 15, c.y + c.h / 2 + 1, 'bram_face', 0).setScrollFactor(0).setDepth(d + 1);
    this.name = new PixelText(scene, c.x + 2, c.y + c.h + 3, 'BRAM', { color: COLORS.gold }).setScrollFactor(0).setDepth(d + 1);
    this.text = new PixelText(scene, c.x + c.textX, c.y + 7, '', { color: COLORS.text }).setScrollFactor(0).setDepth(d + 1);
    this.parts = [this.g, this.face, this.name, this.text];
    this.queue = [];
    this.current = null;
    this.timer = null;
    this.typing = null;
    this.hidden = false;
    this.setAlpha(0);
    const zone = scene.add.zone(c.x, c.y, c.w, c.h).setOrigin(0, 0).setScrollFactor(0).setDepth(d + 1).setInteractive();
    zone.on('pointerdown', () => this.skip());
    this.parts.push(zone);
    this.blinkT = scene.time.addEvent({ delay: 2600, loop: true, callback: () => { this.face.setFrame(1); scene.time.delayedCall(140, () => this.face.active && this.face.setFrame(0)); } });
  }

  get seen() { return this.prog.data.tipsSeen || (this.prog.data.tipsSeen = []); }

  // Shows a tip if it has never been shown on this save. Returns true if queued.
  show(id) {
    if (!BRAM_TIPS[id] || this.seen.includes(id) || this.queue.includes(id) || this.current === id) return false;
    this.seen.push(id);
    this.prog.save();
    this.queue.push(id);
    if (!this.current) this.next();
    return true;
  }

  next() {
    const id = this.queue.shift();
    this.current = id || null;
    if (!id) { this.fade(0); return; }
    const str = BRAM_TIPS[id];
    this.fade(1);
    this.text.setText('');
    this.drawBubble();
    Audio.play('bram');
    let k = 0;
    if (this.typing) this.typing.remove();
    this.typing = this.scene.time.addEvent({
      delay: 20, repeat: str.length - 1,
      callback: () => {
        k++;
        this.text.setText(str.slice(0, k));
        this.face.y = COACH.y + COACH.h / 2 + 1 - (k % 6 < 3 ? 1 : 0);
        if (k % 3 === 0 && /[A-Z]/.test(str[k - 1])) Audio.play('tick');
        if (k >= str.length) this.finishTyping();
      },
    });
  }

  finishTyping() {
    if (this.typing) { this.typing.remove(); this.typing = null; }
    this.text.setText(BRAM_TIPS[this.current] || '');
    this.face.y = COACH.y + COACH.h / 2 + 1;
    if (this.timer) this.timer.remove();
    const hold = Math.max(2400, this.text.text.length * 55 + 900);
    this.timer = this.scene.time.delayedCall(hold, () => { this.timer = null; this.next(); });
  }

  // A tap finishes the typing, a second tap dismisses the tip.
  skip() {
    if (!this.current) return;
    if (this.typing) { this.finishTyping(); return; }
    if (this.timer) { this.timer.remove(); this.timer = null; }
    this.next();
  }

  drawBubble() {
    const c = COACH;
    const g = this.g;
    g.clear();
    drawPanel(g, c.x, c.y, c.w, c.h, { alpha: 0.94, highlight: 0xf2c14e });
    g.fillStyle(0x2e2a3c, 1); g.fillRect(c.x + 4, c.y + 3, 23, c.h - 6);
    g.fillStyle(0x16141f, 0.94); g.fillRect(c.x + 28, c.y + 12, 2, 5);
    g.fillStyle(0x16141f, 0.85); g.fillRect(c.x, c.y + c.h + 1, this.name.width + 5, 9);
  }

  fade(to) {
    this.scene.tweens.killTweensOf(this.parts);
    this.scene.tweens.add({ targets: this.parts, alpha: to, duration: to ? 160 : 320 });
  }

  setAlpha(a) { this.parts.forEach((p) => p.setAlpha(a)); }

  // Hidden while the HUD is (view mode, photos, run over).
  setVisible(v) {
    this.hidden = !v;
    this.parts.forEach((p) => p.setVisible(v));
  }

  destroy() {
    if (this.timer) this.timer.remove();
    if (this.typing) this.typing.remove();
    this.blinkT.remove();
    this.parts.forEach((o) => o.destroy());
  }
}
