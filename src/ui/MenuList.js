import { PixelText, COLORS } from './PixelText.js';
import { Audio } from '../systems/AudioSystem.js';

// Vertical keyboard/mouse menu. Items: { label: string|fn, onSelect, onLeft, onRight, disabled: bool|fn }
export class MenuList {
  constructor(scene, x, y, items, { spacing = 11, depth = 0, scrollFactor = 0, align = 'center', onCancel = null, start = 0 } = {}) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.items = items;
    this.index = start;
    this.onCancel = onCancel;
    this.texts = items.map((item, i) => {
      const t = new PixelText(scene, x, y + i * spacing, '', {});
      t.setOrigin(align === 'center' ? 0.5 : 0, 0).setDepth(depth).setScrollFactor(scrollFactor);
      t.setInteractive({ useHandCursor: true });
      t.on('pointermove', () => { if (!this.isDisabled(i)) { this.index = i; this.refresh(); } });
      t.on('pointerdown', (p) => {
        if (this.isDisabled(i)) return;
        this.index = i;
        const local = p.x - (t.x - t.displayWidth * t.originX);
        if (item.onLeft && local < t.displayWidth * 0.3) this.left();
        else if (item.onRight && local > t.displayWidth * 0.7) this.right();
        else this.select();
      });
      return t;
    });
    while (this.isDisabled(this.index) && this.index < items.length - 1) this.index++;
    this.refresh();
  }

  isDisabled(i) {
    const d = this.items[i].disabled;
    return typeof d === 'function' ? d() : !!d;
  }

  label(item) { return typeof item.label === 'function' ? item.label() : item.label; }

  refresh() {
    this.items.forEach((item, i) => {
      const sel = i === this.index;
      const lbl = this.label(item);
      const text = sel ? `> ${lbl} <` : lbl;
      this.texts[i].setText(text).setColor(this.isDisabled(i) ? COLORS.faint : sel ? COLORS.gold : COLORS.text);
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
    if (this.texts.length) this.refresh();
  }
  left() { const it = this.items[this.index]; if (it.onLeft) { it.onLeft(); Audio.play('ui'); this.refresh(); } }
  right() { const it = this.items[this.index]; if (it.onRight) { it.onRight(); Audio.play('ui'); this.refresh(); } }

  // Returns true if the key was used.
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

  destroy() {
    this.texts.forEach((t) => t.destroy());
    this.texts = [];
  }
}
