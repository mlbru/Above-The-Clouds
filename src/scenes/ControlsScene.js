import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, IS_PORTRAIT, IS_TOUCH } from '../config/gameConfig.js';
import { PixelText, COLORS, drawFrame } from '../ui/PixelText.js';
import { measureLine } from '../utils/pixelFont.js';
import { Audio } from '../systems/AudioSystem.js';

// Each line: what it does, then groups of keys ('|' separates the
// alternatives; a group is drawn as caps side by side), and a note.
const ROWS = [
  { what: 'CHOOSE A ROUTE', keys: [['←', '→'], ['A', 'D'], ['1', '2', '3']] },
  { what: 'START THE CLIMB', keys: [['↑'], ['SPACE'], ['ENTER']] },
  { what: 'CLIMB ON THE BEAT', keys: [['←', '↑', '→'], ['A', 'W', 'D']], note: 'HOLD FOR HOLD NOTES' },
  { what: 'AT A LEDGE', keys: [['R'], ['V'], ['C'], ['T']], note: 'REST  VIEW  PHOTO  TRADER' },
  { what: 'PAUSE', keys: [['ESC'], ['P']] },
  { what: 'FULLSCREEN', keys: [['F']] },
  { what: 'DEBUG OVERLAY', keys: [['F3'], ['`']], note: 'THEN B FOR AUTOPILOT' },
];
const TOUCH = [
  { what: 'CLIMB', text: 'SWIPE ← ↑ → ON THE BEAT, ANYWHERE' },
  { what: 'HOLD NOTES', text: 'KEEP YOUR FINGER DOWN' },
  { what: 'DOUBLES', text: 'SWIPE WITH TWO FINGERS' },
  { what: 'ROUTES, MENUS', text: 'TAP THEM' },
];

// The controls, as a card of keycaps. Launched over the title camp or the
// pause menu (data: { returnTo }), which waits paused underneath.
export class ControlsScene extends Phaser.Scene {
  constructor() { super('Controls'); }

  init(data) { this.returnTo = data.returnTo || 'Menu'; }

  create() {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a0a14, 0.92).setOrigin(0, 0).setInteractive().on('pointerdown', () => this.close());
    const g = this.add.graphics();
    const text = (x, y, s, color = COLORS.text, opts = {}) => new PixelText(this, x, y, s, { color, ...opts });
    const rowH = 15;
    const rows = IS_TOUCH ? TOUCH.length : ROWS.length;
    const w = Math.min(GAME_WIDTH - 16, 330), h = 30 + rows * rowH + 16;
    const x = Math.round((GAME_WIDTH - w) / 2), y = Math.max(IS_PORTRAIT ? 70 : 34, Math.round((GAME_HEIGHT - h) / 2));
    text(x, y - 20, 'CONTROLS', COLORS.gold).setScale(2);
    drawFrame(g, x, y, w, h, { accent: 0x9fd8ff, alpha: 0.95 });
    const labelW = IS_PORTRAIT ? 80 : 100;
    let ry = y + 10;
    if (IS_TOUCH) {
      for (const r of TOUCH) {
        text(x + 10, ry + 3, r.what, COLORS.dim);
        text(x + 10 + labelW, ry + 3, r.text, COLORS.text);
        ry += rowH;
      }
    } else {
      for (const r of ROWS) {
        text(x + 10, ry + 3, r.what, COLORS.dim);
        let kx = x + 10 + labelW;
        r.keys.forEach((group, gi) => {
          if (gi) { text(kx, ry + 3, '/', COLORS.faint); kx += 7; }
          for (const k of group) kx = this.cap(g, kx, ry, k) + 2;
          kx += 2;
        });
        if (r.note && kx + measureLine(r.note) < x + w - 8) text(x + w - 8, ry + 3, r.note, COLORS.faint).setOrigin(1, 0);
        ry += rowH;
      }
    }
    g.fillStyle(0x9fd8ff, 0.3).fillRect(x + 8, ry + 4, w - 16, 1);
    text(x + w / 2, ry + 10, 'PRESS WHEN THE ARROW REACHES THE LINE. THE BEAT IS EVERYTHING.', COLORS.gold).setOrigin(0.5, 0);
    text(GAME_WIDTH / 2, y + h + 8, IS_TOUCH ? 'TAP TO GO BACK' : 'ANY KEY TO GO BACK', COLORS.faint).setOrigin(0.5, 0);
    this.input.keyboard.on('keydown', this.close, this);
    this.events.once('shutdown', () => this.input.keyboard.off('keydown', this.close, this));
  }

  // One keycap; returns its right edge.
  cap(g, x, y, label) {
    const w = Math.max(9, measureLine(label) + 6), h = 11;
    g.fillStyle(0x07060e, 1).fillRect(x, y + 1, w, h);
    g.fillStyle(0x4a4560, 1).fillRect(x, y, w, h - 1);
    g.fillStyle(0x2c2740, 1).fillRect(x + 1, y + 1, w - 2, h - 4);
    g.fillStyle(0x8a84a0, 1).fillRect(x + 1, y, w - 2, 1);
    new PixelText(this, x + 3, y + 2, label, { color: COLORS.text });
    return x + w;
  }

  close() {
    if (this.closing) return;
    this.closing = true;
    Audio.play('cloth');
    this.scene.stop();
    this.scene.resume(this.returnTo);
  }
}
