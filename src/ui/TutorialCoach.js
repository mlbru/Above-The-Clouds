import { PixelText, COLORS, drawPanel } from './PixelText.js';
import { DEPTH, GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';
import { HIT_X, TRACK_Y, REC_Y } from './ComboPrompt.js';
import { Audio } from '../systems/AudioSystem.js';
import { COACH } from './coachLayout.js';

const MIN_SHOW = 1500;


// Where the pointer arrow aims, in screen space. `dir` is the way the arrow points.
const TARGETS = {
  grip: { x: GAME_WIDTH - 58, y: 30, dir: 'U' },
  streak: { x: GAME_WIDTH - 40, y: 42, dir: 'U' },
  gems: { x: 11, y: 54, dir: 'U' },
  cards: { x: GAME_WIDTH / 2, y: GAME_HEIGHT - 49, dir: 'D' },
  line: { x: HIT_X, y: TRACK_Y - 18, dir: 'D' },
  recovery: { x: GAME_WIDTH / 2, y: REC_Y - 22, dir: 'D' },
};

// Bram, the base camp trader, coaching you through the Training Crag.
// Lines type out in a bubble at the top while the game keeps running; an
// arrow points at what he talks about; a goal chip tracks the lesson goal.
// Only the closing panel is modal (open = true).
export class TutorialCoach {
  constructor(scene) {
    this.scene = scene;
    this.d = DEPTH.overlay;
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(this.d);
    const c = COACH;
    this.face = scene.add.sprite(c.x + 15, c.y + c.h / 2 + 1, 'bram_face', 0).setScrollFactor(0).setDepth(this.d + 1);
    this.text = new PixelText(scene, c.x + c.textX, c.y + 7, '', { color: COLORS.text }).setScrollFactor(0).setDepth(this.d + 1);
    this.lessonText = new PixelText(scene, c.x + 2, c.y + c.h + 4, '', { color: COLORS.gold }).setScrollFactor(0).setDepth(this.d + 1);
    this.goalText = new PixelText(scene, c.x + c.w - 2, c.y + c.h + 4, '', { color: COLORS.text }).setOrigin(1, 0).setScrollFactor(0).setDepth(this.d + 1);
    this.goalBox = scene.add.image(0, 0, 'icon_check').setScrollFactor(0).setDepth(this.d + 1).setVisible(false);
    this.whenText = new PixelText(scene, c.x + c.w / 2, c.y + c.h + 14, '', { color: COLORS.blue }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(this.d + 1);
    this.arrow = scene.add.image(0, 0, 'arrow_U').setScrollFactor(0).setDepth(this.d + 2).setTint(0xf2c14e).setVisible(false);
    this.parts = [this.face, this.text, this.lessonText, this.goalText, this.goalBox, this.whenText];
    this.queue = [];
    this.timer = null;
    this.typing = null;
    this.open = false;
    this.final = false;
    this.panel = [];
    this.visible = false;
    this.setShown(false);
    const zone = scene.add.zone(c.x, c.y, c.w, c.h).setOrigin(0, 0).setScrollFactor(0).setDepth(this.d + 1).setInteractive();
    zone.on('pointerdown', () => this.next());
    this.parts.push(zone);
    this.blinkT = scene.time.addEvent({ delay: 2600, loop: true, callback: () => { this.face.setFrame(1); scene.time.delayedCall(140, () => this.face.active && this.face.setFrame(0)); } });
  }

  setShown(v) {
    this.visible = v;
    this.parts.forEach((p) => p.setVisible(v));
    this.goalBox.setVisible(v && this.goalDone === true);
    if (!v) { this.g.clear(); this.arrow.setVisible(false); }
  }

  drawBubble() {
    const c = COACH;
    const g = this.g;
    g.clear();
    drawPanel(g, c.x, c.y, c.w, c.h, { alpha: 0.94, highlight: 0xf2c14e });
    g.fillStyle(0x2e2a3c, 1); g.fillRect(c.x + 4, c.y + 3, 23, c.h - 6);
    // Little tail pointing at the portrait.
    g.fillStyle(0x16141f, 0.94); g.fillRect(c.x + 28, c.y + 12, 2, 5);
    if (this.lessonText.text) {
      const w = this.lessonText.width + 6;
      g.fillStyle(0x16141f, 0.85); g.fillRect(c.x, c.y + c.h + 2, w, 10);
    }
    if (this.goalText.text) {
      const w = this.goalText.width + 18;
      g.fillStyle(this.goalDone ? 0x2f6a3a : 0x16141f, 0.88); g.fillRect(c.x + c.w - w, c.y + c.h + 2, w, 10);
      g.lineStyle(1, this.goalDone ? 0x8fd16a : 0xa8a3b8, 1);
      g.strokeRect(c.x + c.w - w + 3, c.y + c.h + 4, 6, 6);
    }
    if (this.whenText.text) {
      const w = this.whenText.width + 8;
      g.fillStyle(0x16141f, 0.8); g.fillRect(Math.round(c.x + c.w / 2 - w / 2), c.y + c.h + 12, w, 10);
    }
  }

  // ---------- speech ----------
  // lines: array of strings or { t, p } (p = pointer target). onDone runs after the last line.
  // A line that just appeared stays up for at least MIN_SHOW ms, so a reaction
  // is not wiped out at once by the next lesson.
  say(lines, onDone = null) {
    if (this.pendingSay) { this.pendingSay.remove(); this.pendingSay = null; }
    const wait = this.lineStart ? Math.max(0, MIN_SHOW - (this.scene.time.now - this.lineStart)) : 0;
    const go = () => {
      this.pendingSay = null;
      this.queue = lines.map((l) => (typeof l === 'string' ? { t: l } : l));
      this.onDone = onDone;
      if (!this.visible) this.setShown(true);
      this.next(true);
    };
    if (wait > 0) this.pendingSay = this.scene.time.delayedCall(wait, go);
    else go();
  }

  next(force = false) {
    if (this.typing && !force) { this.finishTyping(); return; }
    if (this.timer) { this.timer.remove(); this.timer = null; }
    const line = this.queue.shift();
    if (!line) {
      const cb = this.onDone;
      this.onDone = null;
      if (cb) cb();
      return;
    }
    this.point(line.p || null);
    this.lineStart = this.scene.time.now;
    this.type(line.t, () => {
      const hold = Math.max(1700, line.t.length * 42 + 700);
      if (this.queue.length || this.onDone) this.timer = this.scene.time.delayedCall(hold, () => this.next(true));
    });
  }

  type(str, done) {
    if (this.typing) this.typing.remove();
    this.full = str;
    this.typedDone = done;
    let k = 0;
    this.text.setText('');
    this.drawBubble();
    this.typing = this.scene.time.addEvent({
      delay: 22, repeat: str.length - 1,
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
    this.text.setText(this.full);
    this.face.y = COACH.y + COACH.h / 2 + 1;
    const d = this.typedDone;
    this.typedDone = null;
    if (d) d();
  }

  // ---------- pointer, lesson, goal, when ----------
  point(target) {
    this.scene.tweens.killTweensOf(this.arrow);
    const t = TARGETS[target];
    if (!t) { this.arrow.setVisible(false); return; }
    const dy = t.dir === 'U' ? 1 : -1;
    this.arrow.setTexture(`arrow_${t.dir}`).setPosition(t.x, t.y + dy * 6).setVisible(true).setAlpha(1);
    this.scene.tweens.add({ targets: this.arrow, y: t.y, duration: 320, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  lesson(n, total, title) {
    this.lessonText.setText(title ? `${n}/${total}  ${title}` : '');
    this.drawBubble();
  }

  setGoal(text) {
    this.goalDone = text ? false : undefined;
    this.goalText.setText(text ? `GOAL: ${text}` : '').setColor(COLORS.text);
    this.goalBox.setVisible(false);
    this.drawBubble();
  }

  completeGoal() {
    if (this.goalDone !== false) return;
    this.goalDone = true;
    this.goalText.setColor(COLORS.green);
    const c = COACH;
    const bx = c.x + c.w - this.goalText.width - 12;
    this.goalBox.setPosition(bx, c.y + c.h + 7).setVisible(this.visible).setTint(0x8fd16a).setScale(2);
    this.scene.tweens.add({ targets: this.goalBox, scale: 1, duration: 260, ease: 'Back.easeOut' });
    Audio.play('held');
    this.drawBubble();
  }

  setWhen(text) {
    this.whenText.setText(text ? `IN REAL RUNS: ${text}` : '');
    this.drawBubble();
  }

  // ---------- closing panel (modal) ----------
  showFinal({ title, lines, reward }, onClose) {
    this.open = true;
    this.final = true;
    this.onClose = onClose;
    this.openedAt = performance.now();
    this.point(null);
    const sc = this.scene;
    const w = 260, h = 70 + (reward ? 12 : 0);
    const x = Math.round(GAME_WIDTH / 2 - w / 2), y = Math.round(GAME_HEIGHT / 2 - h / 2) - 10;
    const g = sc.add.graphics().setScrollFactor(0).setDepth(this.d + 3);
    drawPanel(g, x, y, w, h, { alpha: 0.95, highlight: 0xf2c14e });
    const add = (o) => { o.setScrollFactor(0).setDepth(this.d + 4); this.panel.push(o); return o; };
    this.panel.push(g);
    add(new PixelText(sc, GAME_WIDTH / 2, y + 8, title, { color: COLORS.gold }).setOrigin(0.5, 0).setScale(2));
    lines.forEach((l, i) => add(new PixelText(sc, GAME_WIDTH / 2, y + 26 + i * 9, l, { color: COLORS.text }).setOrigin(0.5, 0)));
    if (reward) add(new PixelText(sc, GAME_WIDTH / 2, y + h - 30, reward, { color: '#9fe8ff' }).setOrigin(0.5, 0));
    add(new PixelText(sc, GAME_WIDTH / 2, y + h - 14, '↑ / SPACE  CLIMB FOR REAL      ESC  TITLE', { color: COLORS.green }).setOrigin(0.5, 0));
    const zone = add(sc.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true }));
    zone.on('pointerdown', () => this.close());
  }

  // Closes the final panel (presses in the first moments are ignored).
  close() {
    if (!this.open || performance.now() - this.openedAt < 400) return false;
    this.open = false;
    this.panel.forEach((o) => o.destroy());
    this.panel = [];
    Audio.play('select');
    const cb = this.onClose;
    this.onClose = null;
    if (cb) cb();
    return true;
  }

  destroy() {
    if (this.timer) this.timer.remove();
    if (this.pendingSay) this.pendingSay.remove();
    if (this.typing) this.typing.remove();
    this.blinkT.remove();
    this.panel.forEach((o) => o.destroy());
    [...this.parts, this.arrow, this.g].forEach((o) => o.destroy());
  }
}
