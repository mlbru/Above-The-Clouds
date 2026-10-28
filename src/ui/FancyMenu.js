import { PixelText, COLORS, drawFrame } from './PixelText.js';
import { measureLine } from '../utils/pixelFont.js';
import { Audio } from '../systems/AudioSystem.js';
import { toCss } from '../utils/color.js';

// Small menu emblems, drawn into an 8x8 box at (x, y).
export const MENU_ICONS = {
  play: (g, x, y, c) => { g.fillStyle(c, 1).fillRect(x + 1, y, 2, 8).fillRect(x + 3, y + 1, 2, 6).fillRect(x + 5, y + 2, 2, 4).fillRect(x + 7, y + 3, 1, 2); },
  shirt: (g, x, y, c) => { g.fillStyle(c, 1).fillRect(x, y + 1, 8, 3).fillRect(x + 2, y + 1, 4, 7); g.fillStyle(0x16141f, 1).fillRect(x + 3, y + 1, 2, 1); },
  book: (g, x, y, c) => { g.fillStyle(c, 1).fillRect(x, y + 1, 3, 7).fillRect(x + 5, y + 1, 3, 7); g.fillStyle(c, 0.5).fillRect(x + 3, y + 2, 2, 6); },
  gear: (g, x, y, c) => {
    g.fillStyle(c, 1).fillRect(x + 2, y + 1, 4, 6).fillRect(x + 1, y + 2, 6, 4).fillRect(x + 3, y, 2, 8).fillRect(x, y + 3, 8, 2);
    g.fillStyle(0x16141f, 1).fillRect(x + 3, y + 3, 2, 2);
  },
  keys: (g, x, y, c) => { g.fillStyle(c, 1).fillRect(x + 3, y, 2, 3).fillRect(x, y + 4, 2, 3).fillRect(x + 3, y + 4, 2, 3).fillRect(x + 6, y + 4, 2, 3); },
  expand: (g, x, y, c) => {
    g.fillStyle(c, 1).fillRect(x, y, 3, 1).fillRect(x, y, 1, 3).fillRect(x + 5, y, 3, 1).fillRect(x + 7, y, 1, 3);
    g.fillRect(x, y + 7, 3, 1).fillRect(x, y + 5, 1, 3).fillRect(x + 5, y + 7, 3, 1).fillRect(x + 7, y + 5, 1, 3);
  },
  bug: (g, x, y, c) => {
    g.fillStyle(c, 1).fillRect(x + 2, y + 2, 4, 5).fillRect(x + 3, y, 2, 2);
    g.fillStyle(c, 0.6).fillRect(x, y + 3, 2, 1).fillRect(x + 6, y + 3, 2, 1).fillRect(x, y + 6, 2, 1).fillRect(x + 6, y + 6, 2, 1);
  },
  restart: (g, x, y, c) => {
    g.fillStyle(c, 1).fillRect(x + 2, y, 4, 1).fillRect(x + 1, y + 1, 1, 1).fillRect(x, y + 2, 1, 4).fillRect(x + 1, y + 6, 1, 1).fillRect(x + 2, y + 7, 4, 1).fillRect(x + 6, y + 6, 1, 1).fillRect(x + 7, y + 4, 1, 2);
    g.fillRect(x + 5, y, 3, 1).fillRect(x + 7, y, 1, 3);
  },
  home: (g, x, y, c) => { g.fillStyle(c, 1).fillRect(x + 3, y, 2, 1).fillRect(x + 2, y + 1, 4, 1).fillRect(x + 1, y + 2, 6, 1).fillRect(x, y + 3, 8, 1).fillRect(x + 1, y + 4, 6, 4); g.fillStyle(0x16141f, 1).fillRect(x + 3, y + 5, 2, 3); },
  back: (g, x, y, c) => { g.fillStyle(c, 1).fillRect(x + 1, y + 3, 7, 2).fillRect(x + 2, y + 2, 1, 4).fillRect(x + 3, y + 1, 1, 6); },
  flag: (g, x, y, c) => { g.fillStyle(c, 1).fillRect(x + 1, y, 1, 8).fillRect(x + 2, y, 5, 4); },
  no: (g, x, y, c) => { g.fillStyle(c, 1).fillRect(x + 1, y + 1, 2, 2).fillRect(x + 5, y + 1, 2, 2).fillRect(x + 3, y + 3, 2, 2).fillRect(x + 1, y + 5, 2, 2).fillRect(x + 5, y + 5, 2, 2); },
  yes: (g, x, y, c) => { g.fillStyle(c, 1).fillRect(x, y + 4, 2, 2).fillRect(x + 2, y + 5, 2, 2).fillRect(x + 4, y + 3, 2, 2).fillRect(x + 6, y + 1, 2, 2); },
};

// A framed column of buttons in the style of the settings and dares screens:
// an emblem, a label, an optional value pill on the right; the chosen one
// lights up in its accent colour. Drop-in for MenuList (same item fields and
// methods), plus per item: icon (a MENU_ICONS name), value() (text for the
// pill), color (accent), hint.
//   opts: { width, depth, onCancel, accent, rowH, title, start }
// x is the centre of the menu, y its top edge.
export class FancyMenu {
  constructor(scene, x, y, items, { width = 156, depth = 0, onCancel = null, accent = 0xf2c14e, rowH = 15, title = null, start = 0, scrollFactor = 0 } = {}) {
    this.scene = scene;
    this.items = items;
    this.index = start;
    this.onCancel = onCancel;
    this.accent = accent;
    this.rowH = rowH;
    this.w = width;
    this.x = Math.round(x - width / 2);
    this.y = y;
    this.depth = depth;
    this.title = title;
    this.top = y + (title ? 14 : 0);
    this.g = scene.add.graphics().setDepth(depth).setScrollFactor(scrollFactor);
    this.objs = [this.g];
    if (title) this.objs.push(new PixelText(scene, this.x + 4, y, title, { color: COLORS.gold }).setDepth(depth).setScrollFactor(scrollFactor));
    this.texts = items.map((item, i) => {
      const t = new PixelText(scene, this.x + 22, this.top + 6 + i * rowH + 4, '').setDepth(depth + 0.2).setScrollFactor(scrollFactor);
      this.objs.push(t);
      return t;
    });
    this.values = items.map((item) => {
      if (!item.value) return null;
      const t = new PixelText(scene, 0, 0, '', { shadow: null }).setDepth(depth + 0.2).setScrollFactor(scrollFactor);
      this.objs.push(t);
      return t;
    });
    this.zones = items.map((item, i) => {
      const z = scene.add.zone(this.x + 4, this.top + 5 + i * rowH, width - 8, rowH - 1).setOrigin(0, 0).setDepth(depth + 0.3).setScrollFactor(scrollFactor).setInteractive({ useHandCursor: true });
      z.on('pointermove', () => { if (!this.isDisabled(i) && this.index !== i) { this.index = i; this.refresh(); } });
      z.on('pointerdown', (p) => {
        if (this.isDisabled(i)) return;
        this.index = i;
        const local = p.x - z.x;
        if (item.onLeft && local < z.width * 0.25) this.left();
        else if (item.onRight && local > z.width * 0.75) this.right();
        else this.select();
      });
      this.objs.push(z);
      return z;
    });
    while (this.isDisabled(this.index) && this.index < items.length - 1) this.index++;
    this.refresh();
  }

  get height() { return this.top - this.y + 10 + this.items.length * this.rowH; }

  isDisabled(i) {
    const d = this.items[i].disabled;
    return typeof d === 'function' ? d() : !!d;
  }

  label(item) { return typeof item.label === 'function' ? item.label() : item.label; }

  refresh() {
    const g = this.g;
    g.clear();
    const cur = this.items[this.index];
    const accent = (cur && cur.color) || this.accent;
    drawFrame(g, this.x, this.top, this.w, 10 + this.items.length * this.rowH, { accent, alpha: 0.95 });
    this.items.forEach((item, i) => {
      const sel = i === this.index;
      const off = this.isDisabled(i);
      const col = item.color || this.accent;
      const ry = this.top + 5 + i * this.rowH;
      if (sel) {
        g.fillStyle(col, 0.18).fillRect(this.x + 4, ry, this.w - 8, this.rowH - 1);
        g.fillStyle(col, 1).fillRect(this.x + 4, ry, 2, this.rowH - 1);
      }
      if (item.icon && MENU_ICONS[item.icon]) MENU_ICONS[item.icon](g, this.x + 10, ry + Math.floor((this.rowH - 9) / 2), off ? 0x4a4560 : sel ? col : 0x8a84a0);
      const t = this.texts[i];
      t.setText(this.label(item)).setColor(off ? COLORS.faint : sel ? toCss(col) === '#f2c14e' ? COLORS.gold : toCss(col) : COLORS.text);
      t.setY(ry + Math.floor((this.rowH - 5) / 2));
      const v = this.values[i];
      if (v) {
        const text = item.value();
        const pw = measureLine(text) + 6;
        const px = this.x + this.w - 8 - pw, py = ry + Math.floor((this.rowH - 9) / 2);
        g.fillStyle(sel ? col : 0x3a3550, 1).fillRect(px + 1, py, pw - 2, 9).fillRect(px, py + 1, pw, 7);
        v.setText(text).setColor(sel ? '#16141f' : COLORS.dim).setPosition(px + 3, py + 2);
      }
      if (sel && (item.onLeft || item.onRight) && !v) {
        g.fillStyle(col, 1).fillRect(this.x + this.w - 10, ry + 4, 1, 5).fillRect(this.x + this.w - 9, ry + 5, 1, 3).fillRect(this.x + this.w - 8, ry + 6, 1, 1);
      }
    });
  }

  move(d) {
    const n = this.items.length;
    for (let k = 1; k <= n; k++) {
      const j = (this.index + d * k + n * 4) % n;
      if (!this.isDisabled(j)) { this.index = j; break; }
    }
    Audio.play('ui');
    this.refresh();
  }

  select() {
    const item = this.items[this.index];
    if (item && item.onSelect && !this.isDisabled(this.index)) { Audio.play('select'); item.onSelect(); }
    if (this.g.active) this.refresh();
  }

  left() { const it = this.items[this.index]; if (it.onLeft) { it.onLeft(); Audio.play('ui'); this.refresh(); } }
  right() { const it = this.items[this.index]; if (it.onRight) { it.onRight(); Audio.play('ui'); this.refresh(); } }

  handleKey(code) {
    if (code === 'ArrowUp' || code === 'KeyW') this.move(-1);
    else if (code === 'ArrowDown' || code === 'KeyS') this.move(1);
    else if (code === 'ArrowLeft' || code === 'KeyA') this.left();
    else if (code === 'ArrowRight' || code === 'KeyD') this.right();
    else if (code === 'Enter' || code === 'Space') this.select();
    else if ((code === 'Escape' || code === 'Backspace') && this.onCancel) this.onCancel();
    else return false;
    return true;
  }

  setAlpha(a) { this.objs.forEach((o) => o.setAlpha && o.setAlpha(a)); }

  destroy() {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    this.texts = [];
  }
}
