import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';
import { PixelText, COLORS, drawPanel } from '../ui/PixelText.js';
import { LOGBOOK_PAGES, STAMPS } from '../data/logbook.js';
import { Audio } from '../systems/AudioSystem.js';
import { toCss } from '../utils/color.js';

const ROW_H = 24;

// Bram's logbook: one page per kind of stamp. Earned stamps are inked in the
// page colour; the rest show what to do (secret ones stay ???).
// Launched over the Menu or Pause scene, which is paused meanwhile.
export class LogbookScene extends Phaser.Scene {
  constructor() { super('Logbook'); }

  init(data) { this.returnTo = (data && data.returnTo) || 'Menu'; }

  create() {
    this.prog = this.registry.get('progression');
    this.page = 0;
    this.objs = [];
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a0a14, 0.93).setOrigin(0, 0).setInteractive();
    this.g = this.add.graphics();
    this.input.keyboard.on('keydown', this.onKey, this);
    this.events.once('shutdown', () => this.input.keyboard.off('keydown', this.onKey, this));
    this.render();
  }

  text(x, y, str, color = COLORS.text, ox = 0) {
    const t = new PixelText(this, x, y, str, { color }).setOrigin(ox, 0);
    this.objs.push(t);
    return t;
  }

  render() {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    const g = this.g;
    g.clear();
    const owned = this.prog.data.stamps;
    const W = GAME_WIDTH / 2;
    this.text(W, 8, "BRAM'S LOGBOOK", COLORS.gold, 0.5).setScale(2);
    this.text(W, 24, `${owned.length} / ${STAMPS.length} STAMPS`, COLORS.dim, 0.5);

    // Page tabs.
    const tw = 84, tx0 = Math.round(W - (LOGBOOK_PAGES.length * tw) / 2);
    LOGBOOK_PAGES.forEach((p, i) => {
      const sel = i === this.page;
      const got = STAMPS.filter((s) => s.page === p.id && owned.includes(s.id)).length;
      const all = STAMPS.filter((s) => s.page === p.id).length;
      const x = tx0 + i * tw;
      drawPanel(g, x + 1, 36, tw - 2, 13, { alpha: sel ? 0.95 : 0.6, highlight: sel ? p.color : null });
      const t = this.text(x + tw / 2, 40, `${p.title} ${got}/${all}`, sel ? toCss(p.color) : COLORS.faint, 0.5);
      t.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.setPage(i));
    });

    // Stamps on this page.
    const page = LOGBOOK_PAGES[this.page];
    const list = STAMPS.filter((s) => s.page === page.id);
    const x0 = 40, w = GAME_WIDTH - 80, y0 = 56;
    drawPanel(g, x0 - 6, y0 - 4, w + 12, list.length * ROW_H + 6, { alpha: 0.8 });
    list.forEach((s, i) => {
      const y = y0 + i * ROW_H;
      const has = owned.includes(s.id);
      this.drawStamp(x0 + 10, y + 10, has, page.color, i);
      const hidden = s.secret && !has;
      this.text(x0 + 26, y + 3, hidden ? '???' : s.name, has ? toCss(page.color) : COLORS.text);
      this.text(x0 + 26, y + 12, hidden ? 'A SECRET. BRAM WILL NOT SAY.' : s.text, has ? COLORS.dim : COLORS.faint);
      this.text(x0 + w - 4, y + 7, has ? 'STAMPED' : `◆${s.gems}`, has ? COLORS.green : '#9fe8ff', 1);
      if (i < list.length - 1) { g.fillStyle(0x2e2a3c, 1); g.fillRect(x0, y + ROW_H - 2, w, 1); }
    });

    const back = this.text(W, GAME_HEIGHT - 16, '← → PAGE      [ESC] BACK', COLORS.green, 0.5);
    back.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.close());
  }

  // An inked ring with a mountain, slightly tilted; empty dashed ring if not earned.
  drawStamp(cx, cy, has, color, i) {
    const g = this.g;
    if (!has) {
      g.fillStyle(0x4a4560, 1);
      for (let a = 0; a < 16; a += 2) {
        const t = (a / 16) * Math.PI * 2;
        g.fillRect(Math.round(cx + Math.cos(t) * 8), Math.round(cy + Math.sin(t) * 8), 1, 1);
      }
      return;
    }
    const tilt = ((i * 37) % 5) - 2;
    g.lineStyle(2, color, 0.95).strokeCircle(cx, cy, 8);
    g.fillStyle(color, 0.95);
    g.fillTriangle(cx - 5, cy + 3 + tilt * 0.3, cx - 1, cy - 4, cx + 3, cy + 3 - tilt * 0.3);
    g.fillTriangle(cx - 1, cy + 3, cx + 2, cy - 1, cx + 5, cy + 3);
    g.fillRect(cx - 5, cy + 3, 11, 1);
  }

  setPage(i) {
    const n = LOGBOOK_PAGES.length;
    this.page = (i + n) % n;
    Audio.play('ui');
    this.render();
  }

  onKey(event) {
    if (event.repeat) return;
    switch (event.code) {
      case 'ArrowLeft': case 'KeyA': case 'KeyQ': this.setPage(this.page - 1); break;
      case 'ArrowRight': case 'KeyD': case 'KeyE': case 'Tab': this.setPage(this.page + 1); break;
      case 'Escape': case 'Backspace': case 'Space': case 'Enter': case 'KeyL': this.close(); break;
      default: break;
    }
  }

  close() {
    Audio.play('cloth');
    this.scene.stop();
    this.scene.resume(this.returnTo);
  }
}
