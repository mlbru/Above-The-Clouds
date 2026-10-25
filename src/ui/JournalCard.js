import { PixelText, COLORS, drawPanel } from './PixelText.js';
import { DEPTH, GAME_WIDTH } from '../config/gameConfig.js';
import { Audio } from '../systems/AudioSystem.js';

export const JOURNAL_W = 300;
const PAPER = 0xe9dcb8, INK = '#3a2a1a', FADED = '#7a6648';

// A page from Bram's old journal, found under a cairn on an expedition ledge.
// Shown over the rest panel; Space, ↑ or a tap puts it away.
export class JournalCard {
  constructor(scene) {
    this.scene = scene;
    this.objs = [];
    this.open = false;
  }

  show({ title, lines, footer = '', ink = INK }, onClose = null) {
    this.hide();
    this.open = true;
    this.onClose = onClose;
    this.openedAt = performance.now();
    const sc = this.scene;
    const h = 30 + lines.length * 10 + (footer ? 12 : 0);
    const x = Math.round(GAME_WIDTH / 2 - JOURNAL_W / 2), y = 54;
    const d = DEPTH.overlay + 2;
    const add = (o) => { o.setScrollFactor(0).setDepth(d); this.objs.push(o); return o; };
    const g = add(sc.add.graphics());
    // Paper with a darker edge and a torn top.
    drawPanel(g, x - 2, y - 2, JOURNAL_W + 4, h + 4, { fill: 0x16141f, alpha: 0.6 });
    g.fillStyle(PAPER, 1).fillRect(x, y, JOURNAL_W, h);
    g.fillStyle(0xcdbb8e, 1).fillRect(x, y + h - 2, JOURNAL_W, 2);
    for (let tx = x; tx < x + JOURNAL_W; tx += 4) g.fillStyle(0xd8c89e, 1).fillRect(tx, y, 2, ((tx / 4) % 3) + 1);
    for (let ly = y + 24; ly < y + h - 6; ly += 10) g.fillStyle(0xd3c49c, 1).fillRect(x + 8, ly + 7, JOURNAL_W - 16, 1);
    add(new PixelText(sc, GAME_WIDTH / 2, y + 7, title, { color: '#8a4a2a', shadow: null }).setOrigin(0.5, 0));
    lines.forEach((l, i) => add(new PixelText(sc, x + 12, y + 22 + i * 10, l, { color: ink, shadow: null })));
    if (footer) add(new PixelText(sc, GAME_WIDTH / 2, y + h - 12, footer, { color: FADED, shadow: null }).setOrigin(0.5, 0));
    add(new PixelText(sc, x + JOURNAL_W, y + h + 4, 'SPACE ▶', { color: COLORS.green }).setOrigin(1, 0));
    const zone = add(sc.add.zone(x, y, JOURNAL_W, h).setOrigin(0, 0).setInteractive({ useHandCursor: true }));
    zone.on('pointerdown', () => this.close());
    this.objs.forEach((o) => { o.setAlpha(0); sc.tweens.add({ targets: o, alpha: 1, duration: 220 }); });
    Audio.play('cloth');
  }

  // Ignores presses in the first moment so a held key doesn't skip the page.
  close() {
    if (!this.open || performance.now() - this.openedAt < 350) return false;
    this.hide();
    Audio.play('select');
    const cb = this.onClose;
    this.onClose = null;
    if (cb) cb();
    return true;
  }

  hide() {
    this.open = false;
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
  }

  destroy() { this.hide(); }
}
