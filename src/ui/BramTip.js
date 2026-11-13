import { PixelText, COLORS, drawPanel } from './PixelText.js';
import { DEPTH } from '../config/gameConfig.js';
import { Audio } from '../systems/AudioSystem.js';
import { COACH } from './coachLayout.js';
import { BRAM_TIPS } from '../data/bramTips.js';

// Bram pops up in the coach bubble with one sentence, the first time a
// mechanic appears in a real run. The game stands still while he talks
// (onOpen / onClose let the scene freeze and resume); the bubble types out,
// then waits for a key or tap, or closes by itself after a while. Tips that
// arrive together queue up.
export class BramTip {
  constructor(scene, prog, { onOpen = () => {}, onClose = () => {}, wait = () => false } = {}) {
    this.onOpen = onOpen;
    // While wait() is true (a cutscene covers the screen) tips stay queued.
    this.wait = wait;
    this.onClose = onClose;
    this.scene = scene;
    this.prog = prog;
    const c = COACH;
    const d = DEPTH.overlay;
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(d);
    this.face = scene.add.sprite(c.x + 15, c.y + c.h / 2 + 1, 'bram_face', 0).setScrollFactor(0).setDepth(d + 1);
    this.name = new PixelText(scene, c.x + 2, c.y + c.h + 3, 'BRAM', { color: COLORS.gold }).setScrollFactor(0).setDepth(d + 1);
    this.text = new PixelText(scene, c.x + c.textX, c.y + 7, '', { color: COLORS.text }).setScrollFactor(0).setDepth(d + 1);
    this.more = new PixelText(scene, c.x + c.w - 2, c.y + c.h + 3, 'SPACE ▶', { color: COLORS.green }).setOrigin(1, 0).setScrollFactor(0).setDepth(d + 1);
    this.parts = [this.g, this.face, this.name, this.text, this.more];
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

  // True while Bram is talking: the game should stand still.
  get blocking() { return !!this.current; }

  get seen() { return this.prog.data.tipsSeen || (this.prog.data.tipsSeen = []); }

  // Shows a tip if it has never been shown on this save. Returns true if queued.
  show(id) {
    if (!BRAM_TIPS[id] || this.seen.includes(id) || this.queue.includes(id) || this.current === id) return false;
    this.seen.push(id);
    this.prog.save();
    this.queue.push(id);
    if (!this.current && !this.wait()) this.next();
    return true;
  }

  // A line that is not a tip (the run's event): said every time, not once per save.
  say(text) {
    const id = `!${text}`;
    if (this.queue.includes(id) || this.current === id) return;
    this.queue.push(id);
    if (!this.current && !this.wait()) this.next();
  }

  // Each frame: a cutscene that starts puts the open tip back in the queue
  // (it would talk, unseen, under the cutscene and hold the game still);
  // once it ends the queue carries on.
  update() {
    const wait = this.wait();
    if (wait && this.current) this.stash();
    else if (!wait && !this.current && this.queue.length) this.next();
  }

  stash() {
    if (this.typing) { this.typing.remove(); this.typing = null; }
    if (this.timer) { this.timer.remove(); this.timer = null; }
    this.queue.unshift(this.current);
    this.current = null;
    this.fade(0);
    this.onClose();
  }

  next() {
    const id = this.queue.shift();
    const was = this.current;
    this.current = id || null;
    if (!id) { this.fade(0); if (was) this.onClose(); return; }
    if (!was) this.onOpen();
    this.more.setVisible(false);
    const str = id.startsWith('!') ? id.slice(1) : BRAM_TIPS[id];
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
    this.text.setText((this.current && this.current.startsWith('!') ? this.current.slice(1) : BRAM_TIPS[this.current]) || '');
    this.face.y = COACH.y + COACH.h / 2 + 1;
    if (this.timer) this.timer.remove();
    this.more.setVisible(!this.hidden);
    const hold = Math.max(3500, this.text.text.length * 70 + 1500);
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
    if (v && this.typing) this.more.setVisible(false);
  }

  destroy() {
    if (this.timer) this.timer.remove();
    if (this.typing) this.typing.remove();
    this.blinkT.remove();
    this.parts.forEach((o) => o.destroy());
  }
}
