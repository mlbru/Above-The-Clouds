import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, IS_PORTRAIT, IS_TOUCH } from '../config/gameConfig.js';
import { PixelText, COLORS, drawFrame } from '../ui/PixelText.js';
import { measureLine } from '../utils/pixelFont.js';
import { SETTING_SECTIONS } from '../ui/SettingsMenu.js';
import { Audio } from '../systems/AudioSystem.js';
import { toCss } from '../utils/color.js';

const ROW_H = 12;
const INK = '#16141f';

// Breaks text into lines that fit `maxW` pixels in the pixel font.
function wrap(text, maxW) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (measureLine(next) > maxW && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

// Tiny section emblems, drawn at (x, y) in an 8x8 box.
const ICONS = {
  sound: (g, x, y, c) => {
    g.fillStyle(c, 1).fillRect(x, y + 3, 2, 3).fillRect(x + 2, y + 2, 1, 5).fillRect(x + 3, y + 1, 1, 7);
    g.fillRect(x + 5, y + 3, 1, 3).fillRect(x + 7, y + 1, 1, 7);
  },
  screen: (g, x, y, c) => {
    g.fillStyle(c, 1).fillRect(x, y + 1, 8, 1).fillRect(x, y + 6, 8, 1).fillRect(x, y + 1, 1, 6).fillRect(x + 7, y + 1, 1, 6).fillRect(x + 3, y + 7, 2, 1);
    g.fillStyle(c, 0.5).fillRect(x + 2, y + 3, 2, 2);
  },
  feel: (g, x, y, c) => {
    g.fillStyle(c, 1).fillRect(x + 3, y, 2, 8).fillRect(x, y + 3, 8, 2);
    g.fillStyle(c, 0.5).fillRect(x + 1, y + 1, 1, 1).fillRect(x + 6, y + 1, 1, 1).fillRect(x + 1, y + 6, 1, 1).fillRect(x + 6, y + 6, 1, 1);
  },
  play: (g, x, y, c) => {
    g.fillStyle(c, 1).fillRect(x + 3, y, 2, 1).fillRect(x + 2, y + 1, 4, 2).fillRect(x + 1, y + 3, 6, 2).fillRect(x, y + 5, 8, 3);
    g.fillStyle(0x16141f, 1).fillRect(x + 4, y + 2, 1, 4);
  },
};

// The settings screen: sections of rows on the left (on top when upright),
// and on the right a card that explains the chosen row and what each choice
// does, with a small live demo for the look-and-feel rows. Launched over the
// title camp or the pause menu, which waits paused underneath.
//   data: { returnTo, onCode: true to show ENTER CODE (the scene underneath
//           gets showCodeEntry() after this closes) }
export class SettingsScene extends Phaser.Scene {
  constructor() { super('Settings'); }

  init(data) {
    this.returnTo = data.returnTo || 'Menu';
    this.withCode = !!data.onCode;
  }

  create() {
    this.prog = this.registry.get('progression');
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a0a14, 0.92).setOrigin(0, 0).setInteractive();
    this.g = this.add.graphics();
    this.demo = this.add.graphics().setDepth(2);
    this.objs = [];
    this.t = 0;
    // Every selectable line: setting rows, then the buttons.
    this.items = [];
    SETTING_SECTIONS.forEach((sec) => sec.rows.forEach((row) => this.items.push({ kind: 'row', row, sec })));
    if (this.withCode) this.items.push({ kind: 'button', id: 'code', label: 'ENTER CODE' });
    this.items.push({ kind: 'button', id: 'done', label: 'DONE' });
    this.index = 0;

    const top = IS_PORTRAIT ? 30 : 0;
    const listH = SETTING_SECTIONS.length * ROW_H + (this.items.length - (this.withCode ? 2 : 1)) * ROW_H + 10;
    if (IS_PORTRAIT) {
      this.list = { x: 8, y: top + 34, w: GAME_WIDTH - 16, h: listH };
      this.card = { x: 8, y: this.list.y + listH + 6, w: GAME_WIDTH - 16, h: Math.min(160, Math.max(110, GAME_HEIGHT - (this.list.y + listH + 6) - 28)) };
    } else {
      // As tall as the rows need (the card at least tall enough for its demo),
      // centred on tall screens.
      const h = Math.max(listH, 168);
      const y = Math.max(32, Math.floor((GAME_HEIGHT - h - 22) / 2));
      this.list = { x: 8, y, w: 292, h };
      this.card = { x: 306, y, w: GAME_WIDTH - 306 - 8, h };
    }
    this.input.keyboard.on('keydown', this.onKey, this);
    this.events.once('shutdown', () => this.input.keyboard.off('keydown', this.onKey, this));
    this.render();
  }

  get s() { return this.prog.settings; }
  get item() { return this.items[this.index]; }

  // ---------------------------------------------------------------- values
  valueIndex(row) { return Math.max(0, row.values.findIndex(([v]) => v === this.s[row.key])); }

  set(key, value) {
    this.prog.setSetting(key, value);
    Audio.setVolumes(this.s.music, this.s.sfx);
  }

  change(d) {
    const it = this.item;
    if (it.kind !== 'row') return;
    const row = it.row;
    if (row.type === 'volume') {
      const v = Math.max(0, Math.min(1, Math.round((this.s[row.key] + d * 0.1) * 10) / 10));
      if (v === this.s[row.key]) return;
      this.set(row.key, v);
      // Let you hear the new level.
      Audio.play(row.key === 'sfx' ? 'grab' : 'tick');
    } else {
      const n = row.values.length;
      this.set(row.key, row.values[(this.valueIndex(row) + d + n) % n][0]);
      Audio.play('ui');
    }
    this.pulseT = 0;
    this.render();
  }

  activate() {
    const it = this.item;
    if (it.kind === 'row') { this.change(1); return; }
    Audio.play('select');
    this.close(it.id === 'code');
  }

  move(d) {
    this.index = (this.index + d + this.items.length) % this.items.length;
    Audio.play('ui');
    this.pulseT = 0;
    this.render();
  }

  // ---------------------------------------------------------------- drawing
  text(x, y, str, color = COLORS.text, scale = 1, shadow = '#16141f') {
    const t = new PixelText(this, x, y, str, { color, shadow }).setScale(scale).setDepth(3);
    this.objs.push(t);
    return t;
  }

  zone(x, y, w, h, fn, over = null) {
    const z = this.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(4);
    z.on('pointerdown', fn);
    if (over) z.on('pointerover', over);
    this.objs.push(z);
    return z;
  }

  render() {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    const g = this.g;
    g.clear();
    const it = this.item;
    const accent = it.kind === 'row' ? it.sec.color : 0xf2c14e;

    // Header.
    const top = IS_PORTRAIT ? 30 : 0;
    this.text(10, IS_PORTRAIT ? top + 8 : this.list.y - 22, 'SETTINGS', COLORS.gold, 2);
    if (!IS_PORTRAIT) this.text(GAME_WIDTH - 10, this.list.y - 18, IS_TOUCH ? 'TAP A CHOICE TO PICK IT' : '↑↓ CHOOSE   ← → CHANGE   ESC DONE', COLORS.faint).setOrigin(1, 0);

    // The list.
    const L = this.list;
    drawFrame(g, L.x, L.y, L.w, L.h, { accent, alpha: 0.95 });
    let y = L.y + 6;
    let k = 0;
    for (const sec of SETTING_SECTIONS) {
      ICONS[sec.id](g, L.x + 8, y + 1, sec.color);
      const title = this.text(L.x + 20, y + 2, sec.title, toCss(sec.color));
      const lx = title.x + title.width + 4;
      g.fillStyle(sec.color, 0.25).fillRect(lx, y + 4, L.x + L.w - 8 - lx, 1);
      y += ROW_H;
      for (const row of sec.rows) {
        this.drawRow(row, sec, k, L.x + 4, y, L.w - 8);
        y += ROW_H;
        k++;
      }
    }
    // The buttons along the bottom.
    const buttons = this.items.filter((x) => x.kind === 'button');
    const bw = 64, gap = 6;
    let bx = L.x + L.w - buttons.length * bw - (buttons.length - 1) * gap;
    const by = IS_PORTRAIT ? this.card.y + this.card.h + 6 : L.y + L.h + 5;
    for (const b of buttons) {
      const i = this.items.indexOf(b);
      const sel = i === this.index;
      drawFrame(g, bx, by, bw, 16, { accent: b.id === 'done' ? 0x8fd16a : 0x9fd8ff, glow: sel, alpha: 0.95 });
      this.text(bx + bw / 2, by + 5, b.label, sel ? COLORS.gold : COLORS.text).setOrigin(0.5, 0);
      this.zone(bx, by, bw, 16, () => { this.index = i; this.activate(); }, () => { if (this.index !== i) { this.index = i; this.render(); } });
      bx += bw + gap;
    }
    if (!IS_PORTRAIT) this.text(L.x + 2, by + 5, `SAVED AS YOU GO`, COLORS.faint);

    this.drawCard();
  }

  drawRow(row, sec, k, x, y, w) {
    const g = this.g;
    const sel = k === this.index;
    if (sel) {
      g.fillStyle(sec.color, 0.16).fillRect(x, y - 1, w, ROW_H - 1);
      g.fillStyle(sec.color, 1).fillRect(x, y - 1, 2, ROW_H - 1);
    }
    this.text(x + 16, y + 2, row.label, sel ? COLORS.gold : COLORS.text);
    this.zone(x, y - 1, w, ROW_H - 1, () => { if (this.index !== k) { this.index = k; Audio.play('ui'); this.render(); } });
    const right = x + w - 6;
    if (row.type === 'volume') {
      const v = this.s[row.key];
      const segW = 5, segGap = 1, segs = 10;
      const bw = segs * (segW + segGap) - segGap;
      const bx = right - bw - (sel ? 8 : 0);
      for (let i = 0; i < segs; i++) {
        const on = i < Math.round(v * 10);
        const sx = bx + i * (segW + segGap);
        const hgt = 3 + Math.floor(i / 2);
        g.fillStyle(on ? sec.color : 0x3a3550, on ? 1 : 0.9).fillRect(sx, y + 8 - hgt, segW, hgt);
        this.zone(sx, y - 1, segW + segGap, ROW_H - 1, () => {
          this.index = k;
          this.set(row.key, (i + 1) / 10 === v ? i / 10 : (i + 1) / 10);
          Audio.play(row.key === 'sfx' ? 'grab' : 'tick');
          this.render();
        });
      }
      this.text(bx - 4, y + 2, `${Math.round(v * 100)}%`, sel ? COLORS.text : COLORS.dim).setOrigin(1, 0);
      if (sel) { this.text(bx - 26, y + 2, '<', COLORS.gold); this.text(right - 3, y + 2, '>', COLORS.gold); }
      return;
    }
    // Choices as pills, right-aligned; the active one filled in the section colour.
    const at = this.valueIndex(row);
    const widths = row.values.map(([, shown]) => measureLine(shown) + 6);
    const total = widths.reduce((a, b) => a + b, 0) + (widths.length - 1) * 2;
    let px = right - total - (sel ? 8 : 0);
    row.values.forEach(([value, shown], i) => {
      const pw = widths[i];
      const on = i === at;
      if (on) {
        g.fillStyle(sec.color, 1).fillRect(px + 1, y, pw - 2, 9).fillRect(px, y + 1, pw, 7);
        g.fillStyle(0xffffff, 0.25).fillRect(px + 1, y, pw - 2, 1);
      } else {
        g.fillStyle(0x3a3550, sel ? 1 : 0.7).fillRect(px + 1, y, pw - 2, 1).fillRect(px + 1, y + 8, pw - 2, 1).fillRect(px, y + 1, 1, 7).fillRect(px + pw - 1, y + 1, 1, 7);
      }
      this.text(px + 3, y + 2, shown, on ? INK : sel ? COLORS.dim : COLORS.faint, 1, on ? null : '#16141f');
      this.zone(px, y - 1, pw, ROW_H - 1, () => {
        this.index = k;
        if (this.s[row.key] !== value) { this.set(row.key, value); Audio.play('ui'); this.pulseT = 0; }
        this.render();
      });
      px += pw + 2;
    });
    if (sel) { this.text(right - total - 14, y + 2, '<', COLORS.gold); this.text(right - 3, y + 2, '>', COLORS.gold); }
  }

  // The card: what the chosen row is, what the chosen value does.
  drawCard() {
    const g = this.g, C = this.card, it = this.item;
    const accent = it.kind === 'row' ? it.sec.color : 0xf2c14e;
    drawFrame(g, C.x, C.y, C.w, C.h, { accent, alpha: 0.95 });
    const x = C.x + 8, w = C.w - 16;
    this.demoBox = null;
    if (it.kind === 'button') {
      const done = it.id === 'done';
      this.text(x, C.y + 8, done ? 'ALL SET?' : 'A SECRET?', COLORS.gold, 2);
      this.text(x, C.y + 26, wrap(done ? 'YOUR CHOICES ARE SAVED THE MOMENT YOU MAKE THEM. BACK TO THE MOUNTAIN.' : 'BRAM HEARD THERE ARE WORDS THAT CHANGE THE MOUNTAIN. TYPE ONE IN.', w), COLORS.dim);
      return;
    }
    const { row, sec } = it;
    // Section tag.
    const tag = sec.title;
    const tw = measureLine(tag) + 6;
    g.fillStyle(sec.color, 1).fillRect(x, C.y + 7, tw, 9);
    this.text(x + 3, C.y + 9, tag, INK, 1, null);
    const name = this.text(x, C.y + 20, row.label, COLORS.text, measureLine(row.label) * 2 <= w ? 2 : 1);
    let y = name.y + name.displayHeight + 5;
    if (row.type === 'volume') {
      const v = this.s[row.key];
      this.text(x, y, `${Math.round(v * 100)}%`, toCss(sec.color), 2);
      y += 16;
    } else {
      const [, shown, what] = row.values[this.valueIndex(row)];
      this.text(x, y, shown, toCss(sec.color), 2);
      y += 16;
      const desc = this.text(x, y, wrap(row.text, w), COLORS.dim);
      y += desc.height + 6;
      g.fillStyle(sec.color, 0.3).fillRect(x, y - 3, w, 1);
      const t = this.text(x, y, wrap(what, w), COLORS.text);
      y += t.height + 6;
    }
    if (row.type === 'volume') { const d = this.text(x, y, wrap(row.text, w), COLORS.dim); y += d.height + 6; }
    // A little live demo in what is left of the card.
    const room = C.y + C.h - 8 - y;
    if (room >= 34) this.demoBox = { x, y, w, h: Math.min(room, 60), row, sec };
  }

  // ---------------------------------------------------------------- live demos
  update(time, delta) {
    this.t += delta;
    this.pulseT = (this.pulseT || 0) + delta;
    const g = this.demo;
    g.clear();
    const b = this.demoBox;
    if (!b) return;
    g.fillStyle(0x0c0a12, 0.9).fillRect(b.x, b.y, b.w, b.h);
    g.fillStyle(b.sec.color, 0.35).fillRect(b.x, b.y, b.w, 1).fillRect(b.x, b.y + b.h - 1, b.w, 1);
    const v = this.s[b.row.key];
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const hold = (hx, hy, s = 1, chalk = false) => {
      const r = Math.round(3 * s);
      g.fillStyle(0x16141f, 1).fillRect(hx - r - 1, hy - r + 1, (r + 1) * 2, r * 2);
      g.fillStyle(0x9a9488, 1).fillRect(hx - r, hy - r + 1, r * 2, r * 2 - 1);
      g.fillStyle(0xc8c2b0, 1).fillRect(hx - r + 1, hy - r + 1, r * 2 - 2, 1);
      if (chalk) g.fillStyle(0xf4f0e8, 1).fillRect(hx - 1, hy - r, 3, 2);
    };
    const beatMs = 600, beat = this.t / beatMs, ph = beat % 1;
    switch (b.row.key) {
      case 'music': case 'sfx': {
        // An equalizer that dances as loud as the setting.
        for (let i = 0; i < 14; i++) {
          const hgt = Math.max(1, Math.round((b.h - 10) * v * (0.35 + 0.65 * Math.abs(Math.sin(this.t / (180 + i * 37) + i)))));
          g.fillStyle(b.sec.color, 0.4 + 0.6 * v).fillRect(b.x + 6 + i * ((b.w - 12) / 14), b.y + b.h - 4 - hgt, Math.max(2, (b.w - 12) / 14 - 2), hgt);
        }
        break;
      }
      case 'chalkMarks': {
        const pts = [[cx - 28, b.y + b.h - 10], [cx - 6, b.y + b.h - 26], [cx + 14, b.y + b.h - 18], [cx + 30, b.y + 10]];
        if (v === 'line') {
          for (let i = 1; i < pts.length; i++) {
            const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
            const len = Math.hypot(x1 - x0, y1 - y0);
            for (let d = 6; d < len - 5; d += 3) g.fillStyle(0xf4f0e8, 0.9).fillRect(Math.round(x0 + ((x1 - x0) * d) / len), Math.round(y0 + ((y1 - y0) * d) / len), 1, 1);
          }
        }
        pts.forEach(([hx, hy]) => hold(hx, hy, 1, v !== 'off'));
        break;
      }
      case 'beatPulse': {
        const pop = v === 'off' ? 0 : Math.pow(1 - ph, 3);
        hold(cx, cy, 1 + pop * 0.6);
        g.lineStyle(1, b.sec.color, v === 'off' ? 0.6 : 0.4 + pop * 0.6).strokeCircle(cx, cy, 8 + pop * 4);
        if (v === 'full') for (let i = 0; i < 6; i++) {
          const a = i + Math.floor(beat);
          g.fillStyle(b.sec.color, pop).fillRect(Math.round(cx + Math.cos(a * 2.1) * (16 + i * 3)), Math.round(cy + Math.sin(a * 1.7) * 12), 1, 1);
        }
        // The beat itself, as ticks along the bottom.
        for (let i = 0; i < 4; i++) g.fillStyle(i === Math.floor(beat) % 4 ? 0xf4efe4 : 0x4a4560, 1).fillRect(cx - 13 + i * 8, b.y + b.h - 6, 4, 2);
        break;
      }
      case 'hitStop': {
        // A dot swings across; on every "perfect" it holds still for a moment.
        const stop = { off: 0, subtle: 90, punchy: 160 }[v];
        const cyc = 1400, t = this.t % cyc;
        const hitAt = cyc / 2;
        // Out to the right edge, a freeze there, then back.
        const p = t < hitAt ? t / hitAt : t < hitAt + stop ? 1 : 1 + (t - hitAt - stop) / (cyc - hitAt - stop);
        const xx = b.x + 10 + ((b.w - 20) * (p <= 1 ? p : 2 - p));
        const frozen = t >= hitAt && t < hitAt + stop;
        if (frozen && v === 'punchy') g.fillStyle(0xffffff, 0.12).fillRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
        g.fillStyle(frozen ? 0xffffff : b.sec.color, 1).fillRect(Math.round(xx) - 2, cy - 2, 5, 5);
        if (t >= hitAt && t < hitAt + 260) g.lineStyle(1, 0xf2c14e, 1 - (t - hitAt) / 260).strokeCircle(b.x + b.w - 10, cy, 4 + (t - hitAt) / 30);
        break;
      }
      case 'weatherCoat': {
        // A little hat gathering snow, then shaking it off.
        const c = (this.t % 4000) / 4000;
        g.fillStyle(0xc8463b, 1).fillRect(cx - 6, cy, 12, 10);
        g.fillStyle(0x3b6ea5, 1).fillRect(cx - 5, cy - 5, 10, 5);
        if (v === true) {
          const pile = c < 0.8 ? Math.floor(c * 8) : 0;
          if (pile) g.fillStyle(0xffffff, 1).fillRect(cx - Math.min(5, pile), cy - 6, Math.min(10, pile * 2), Math.min(2, 1 + Math.floor(pile / 4)));
          for (let i = 0; i < 6; i++) g.fillStyle(0xffffff, 0.8).fillRect(Math.round(b.x + 8 + ((i * 37 + this.t / 20) % (b.w - 16))), Math.round(b.y + ((i * 13 + this.t / 30) % (b.h - 4))), 1, 1);
        }
        break;
      }
      case 'ledgeLife': {
        // A tiny bottle raised now and then.
        g.fillStyle(0xc8463b, 1).fillRect(cx - 5, cy - 2, 10, 12);
        g.fillStyle(0xe8b48a, 1).fillRect(cx - 3, cy - 9, 6, 6);
        const up = v === 'lively' && (this.t % 3000) < 1300;
        g.fillStyle(0xc8463b, 1).fillRect(cx + 5, up ? cy - 7 : cy, 2, up ? 7 : 8);
        if (up) g.fillStyle(0x4f9ad8, 1).fillRect(cx + 4, cy - 12, 3, 5);
        break;
      }
      default:
        g.fillStyle(b.sec.color, 0.6).fillRect(cx - 1, cy - 1, 3, 3);
    }
  }

  // ---------------------------------------------------------------- input
  onKey(event) {
    if (event.repeat && !['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(event.code)) return;
    switch (event.code) {
      case 'ArrowUp': case 'KeyW': this.move(-1); break;
      case 'ArrowDown': case 'KeyS': this.move(1); break;
      case 'ArrowLeft': case 'KeyA': this.change(-1); break;
      case 'ArrowRight': case 'KeyD': this.change(1); break;
      case 'Space': case 'Enter': this.activate(); break;
      case 'Escape': case 'Backspace': this.close(); break;
      default: break;
    }
  }

  close(code = false) {
    Audio.play('cloth');
    this.scene.stop();
    this.scene.resume(this.returnTo);
    const under = this.scene.get(this.returnTo);
    if (code && under && under.showCodeEntry) under.showCodeEntry();
  }
}
