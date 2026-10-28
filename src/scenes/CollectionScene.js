import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, IS_PORTRAIT, IS_TOUCH } from '../config/gameConfig.js';
import { PixelText, COLORS } from '../ui/PixelText.js';
import { measureLine } from '../utils/pixelFont.js';
import { JOURNAL_CHAPTERS, chapterEntries, journalProgress } from '../data/journal.js';
import { buildJournalTextures, THUMB_W, THUMB_H } from '../render/journalArt.js';
import { Audio } from '../systems/AudioSystem.js';
import { toCss, lerpColor } from '../utils/color.js';

// Portrait: four cards a row, and the header (two rows of chapter pills)
// steps down below the touch buttons.
const TOP = IS_PORTRAIT ? 30 : 0;
const COLS = IS_PORTRAIT ? 4 : 7, CW = 58, CH = 76, GAP = 6;
const GRID_X = Math.round(GAME_WIDTH / 2 - (COLS * CW + (COLS - 1) * GAP) / 2);
const GRID_Y = IS_PORTRAIT ? TOP + 66 : 44;
const ROWS = Math.max(1, Math.floor((GAME_HEIGHT - GRID_Y - 66) / (CH + GAP)));

// A card name on up to two lines ("THE" dropped), cut to fit.
function cardName(text, maxW) {
  const words = text.replace(/^THE /, '').split(' ');
  const lines = [''];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    const next = cur ? `${cur} ${w}` : w;
    if (measureLine(next) <= maxW || !cur) lines[lines.length - 1] = next;
    else if (lines.length < 2) lines.push(w);
    else { lines[1] = fit(`${lines[1]} ${w}`, maxW); break; }
  }
  return lines.map((l) => fit(l, maxW)).join('\n');
}

// Cuts a line down so it fits.
function fit(text, maxW) {
  if (measureLine(text) <= maxW) return text;
  let t = text;
  while (t.length > 1 && measureLine(`${t}.`) > maxW) t = t.slice(0, -1);
  return `${t.trim()}.`;
}

// The collection: everything you have found on the mountain (places,
// creatures, gems, gear, hazards, wonders) and Bram's stamps, as cards.
// Found cards show their picture; the rest show their back with a "?".
// A card you have not looked at yet turns over the first time you pick it.
// Launched over the Menu or Pause scene, which is paused meanwhile.
export class CollectionScene extends Phaser.Scene {
  constructor() { super('Collection'); }

  init(data) { this.returnTo = (data && data.returnTo) || 'Menu'; }

  create() {
    this.prog = this.registry.get('progression');
    if (!Array.isArray(this.prog.data.journalSeen)) this.prog.data.journalSeen = [];
    buildJournalTextures(this);
    this.chapter = 0;
    this.index = 0;
    this.scroll = 0;
    this.objs = [];
    this.t = 0;
    this.bg = this.add.graphics();
    this.g = this.add.graphics();
    this.glow = this.add.graphics();
    this.input.keyboard.on('keydown', this.onKey, this);
    this.events.once('shutdown', () => this.input.keyboard.off('keydown', this.onKey, this));
    Audio.play('cloth');
    this.render();
  }

  get ch() { return JOURNAL_CHAPTERS[this.chapter]; }
  get entries() { return chapterEntries(this.ch, this.prog); }
  add2(o) { this.objs.push(o); return o; }
  text(x, y, str, color = COLORS.text, opts = {}) { return this.add2(new PixelText(this, x, y, str, { color, ...opts })); }
  isNew(e) { return e.known(this.prog) && !this.prog.data.journalSeen.includes(e.id); }

  // A picture from an entry's pic spec, fitted inside a w x h box.
  picture(pic, x, y, w, h) {
    const img = pic.thumb ? this.add.image(x, y, `jthumb_${pic.thumb}`) : this.add.image(x, y, pic.key, pic.frame);
    const iw = pic.thumb ? THUMB_W : img.width, ih = pic.thumb ? THUMB_H : img.height;
    const s = Math.min(pic.scale || 2, w / iw, h / ih);
    img.setScale(s >= 1 ? Math.max(1, Math.floor(s)) : s);
    if (pic.tint) img.setTint(pic.tint);
    return img;
  }

  render() {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    const g = this.g, bg = this.bg;
    g.clear(); bg.clear();
    const ch = this.ch;
    const list = this.entries;
    this.index = Math.max(0, Math.min(this.index, list.length - 1));
    const row = Math.floor(this.index / COLS);
    if (row < this.scroll) this.scroll = row;
    if (row >= this.scroll + ROWS) this.scroll = row - ROWS + 1;

    // Background: deep night tinted with the chapter's colour at the top.
    const H = GAME_HEIGHT;
    for (let y = 0; y < H; y += 4) bg.fillStyle(lerpColor(lerpColor(0x0e0c18, ch.color, 0.22), 0x0e0c18, Math.min(1, y / 140)), 1).fillRect(0, y, GAME_WIDTH, 4);
    bg.fillStyle(0xffffff, 0.04);
    for (let i = 0; i < 40; i++) bg.fillRect((i * 97) % GAME_WIDTH, (i * 53) % H, 1, 1);

    // Header: title and the overall count with a bar.
    this.text(14, TOP + 7, 'COLLECTION', '#ffffff').setScale(2);
    const all = journalProgress(this.prog);
    const bw = IS_PORTRAIT ? 60 : 90, bx = GAME_WIDTH - 14 - bw;
    this.text(bx - 6, TOP + 9, `${all.seen}/${all.total}`, COLORS.gold).setOrigin(1, 0);
    g.fillStyle(0x2a2538, 1).fillRect(bx, TOP + 11, bw, 5);
    g.fillStyle(0xf2c14e, 1).fillRect(bx, TOP + 11, Math.round((bw * all.seen) / all.total), 5);
    g.fillStyle(0xffffff, 0.35).fillRect(bx, TOP + 11, Math.round((bw * all.seen) / all.total), 1);

    // Chapter pills (wrapping onto a second row when the screen is narrow).
    let px = 14, py = TOP + 25;
    JOURNAL_CHAPTERS.forEach((c, i) => {
      const sel = i === this.chapter;
      const entries = chapterEntries(c, this.prog);
      const fresh = entries.some((e) => this.isNew(e));
      const label = c.title;
      const w = measureLine(label) + 12;
      if (px + w > GAME_WIDTH - 14) { px = 14; py += 16; }
      if (sel) g.fillStyle(c.color, 1).fillRoundedRect(px, py, w, 13, 4);
      else g.lineStyle(1, c.color, 0.6).strokeRoundedRect(px + 0.5, py + 0.5, w - 1, 12, 4);
      this.text(px + w / 2, py + 3, label, sel ? '#16141f' : toCss(lerpColor(c.color, 0xffffff, 0.3)), { shadow: sel ? null : '#16141f' }).setOrigin(0.5, 0);
      if (fresh) g.fillStyle(0xff7ab8, 1).fillCircle(px + w - 2, py + 1, 2.5);
      const z = this.add2(this.add.zone(px, py, w, 13).setOrigin(0, 0).setInteractive({ useHandCursor: true }));
      z.on('pointerdown', () => this.setChapter(i));
      px += w + 4;
    });

    // The cards.
    const first = this.scroll * COLS;
    const shown = list.slice(first, first + ROWS * COLS);
    // A short chapter sits in the middle of the space instead of the top left.
    const usedRows = Math.min(ROWS, Math.ceil(list.length / COLS));
    const ox = Math.round(((COLS - Math.min(COLS, list.length)) * (CW + GAP)) / 2);
    const oy = Math.round(((ROWS - usedRows) * (CH + GAP)) / 2) + 4;
    this.selCard = null;
    shown.forEach((e, k) => {
      const i = first + k;
      const x = GRID_X + ox + (k % COLS) * (CW + GAP), y = GRID_Y + oy + Math.floor(k / COLS) * (CH + GAP);
      const sel = i === this.index;
      const card = this.drawCard(e, x, y - (sel ? 3 : 0), sel);
      if (sel) this.selCard = { x, y: y - 3, card, e };
      const z = this.add2(this.add.zone(x, y, CW, CH).setOrigin(0, 0).setInteractive({ useHandCursor: true }));
      z.on('pointerdown', () => { if (this.index !== i) { this.index = i; Audio.play('ui'); this.render(); } });
    });
    const rows = Math.ceil(list.length / COLS);
    if (this.scroll > 0) this.text(GAME_WIDTH / 2, GRID_Y - 7, '↑', COLORS.dim).setOrigin(0.5, 0);
    if (this.scroll + ROWS < rows) this.text(GAME_WIDTH / 2, GRID_Y + ROWS * (CH + GAP) - 5, '↓', COLORS.dim).setOrigin(0.5, 0);

    // Info strip for the chosen card.
    const e = list[this.index];
    if (e) this.drawInfo(e);
    this.text(GAME_WIDTH / 2, H - 11, IS_TOUCH ? 'TAP A CARD  •  SWIPE TO MOVE  •  II TO GO BACK' : '← → ↑ ↓ PICK    Q / E  TYPE    ESC  BACK', COLORS.faint).setOrigin(0.5, 0);

    // A card seen for the first time turns over.
    if (this.selCard && this.isNew(this.selCard.e)) {
      const c = this.selCard.card;
      c.setScale(0, 1);
      this.tweens.add({ targets: c, scaleX: 1, duration: 260, ease: 'Back.easeOut' });
      Audio.play('discovery');
      this.prog.data.journalSeen.push(this.selCard.e.id);
      this.prog.save();
    }
  }

  // One card as a container centred on its middle (so it can flip).
  drawCard(e, x, y, sel) {
    const known = e.known(this.prog);
    const color = e.color || this.ch.color;
    const c = this.add2(this.add.container(x + CW / 2, y + CH / 2));
    const g = this.add.graphics();
    c.add(g);
    const L = -CW / 2, T = -CH / 2;
    g.fillStyle(0x000000, 0.4).fillRoundedRect(L + 2, T + 3, CW, CH, 5);
    if (known) {
      g.fillStyle(lerpColor(color, 0x16141f, 0.35), 1).fillRoundedRect(L, T, CW, CH, 5);
      g.fillStyle(0x1c1828, 1).fillRoundedRect(L + 3, T + 3, CW - 6, CH - 6, 3);
      g.fillStyle(lerpColor(color, 0x1c1828, 0.75), 1).fillRect(L + 5, T + 5, CW - 10, 44);
      g.fillStyle(0xffffff, 0.12).fillRect(L + 5, T + 5, CW - 10, 1);
      c.add(this.picture(e.pic, 0, T + 27, CW - 14, 38));
      c.add(new PixelText(this, 0, T + 52, cardName(e.name, CW - 8), { color: '#ffffff', align: 'center' }).setOrigin(0.5, 0));
      g.fillStyle(color, 1).fillRect(L + 8, T + CH - 7, CW - 16, 2);
    } else {
      // The back of the card: a diamond pattern in the chapter colour.
      g.fillStyle(lerpColor(color, 0x0e0c18, 0.72), 1).fillRoundedRect(L, T, CW, CH, 5);
      g.fillStyle(lerpColor(color, 0x0e0c18, 0.45), 1);
      for (let yy = T + 6, r = 0; yy < T + CH - 4; yy += 6, r++) {
        for (let xx = L + 5 + (r % 2) * 3; xx < L + CW - 4; xx += 6) g.fillRect(xx, yy - 1, 1, 3).fillRect(xx - 1, yy, 3, 1);
      }
      g.fillStyle(lerpColor(color, 0x0e0c18, 0.72), 1).fillCircle(0, -4, 12);
      g.lineStyle(1, lerpColor(color, 0x0e0c18, 0.2), 1).strokeRoundedRect(L + 0.5, T + 0.5, CW - 1, CH - 1, 5);
      if (e.goal) {
        const seal = this.picture(e.pic, 0, -4, 22, 22).setAlpha(0.35);
        c.add(seal);
        c.add(new PixelText(this, 0, T + 52, cardName(e.name, CW - 8), { color: toCss(lerpColor(color, 0xffffff, 0.2)), align: 'center' }).setOrigin(0.5, 0).setAlpha(0.8));
      } else c.add(new PixelText(this, 1, -13, '?', { color: toCss(lerpColor(color, 0xffffff, 0.35)) }).setOrigin(0.5, 0).setScale(3));
    }
    if (this.isNew(e)) {
      g.fillStyle(0xff7ab8, 1).fillRoundedRect(L + CW - 21, T - 3, 22, 9, 3);
      c.add(new PixelText(this, L + CW - 10, T - 1, 'NEW', { color: '#ffffff' }).setOrigin(0.5, 0));
    }
    if (sel) g.lineStyle(1, 0xffffff, 1).strokeRoundedRect(L - 0.5, T - 0.5, CW + 1, CH + 1, 5);
    return c;
  }

  drawInfo(e) {
    const g = this.g;
    const known = e.known(this.prog);
    const color = e.color || this.ch.color;
    const y = GAME_HEIGHT - 58, x = 14, w = GAME_WIDTH - 28, h = 42;
    g.fillStyle(0x16141f, 0.92).fillRoundedRect(x, y, w, h, 5);
    g.fillStyle(color, 1).fillRoundedRect(x, y, 4, h, { tl: 5, bl: 5, tr: 0, br: 0 });
    const showName = known || e.goal;
    this.text(x + 12, y + 5, showName ? e.name : '???', known ? '#ffffff' : COLORS.dim).setScale(2);
    if (known && e.stat) this.text(x + w - 8, y + 8, e.stat(this.prog), COLORS.gold).setOrigin(1, 0);
    else if (!known && e.goal && e.stat) this.text(x + w - 8, y + 8, e.stat(this.prog), COLORS.dim).setOrigin(1, 0);
    else if (!known) this.text(x + w - 8, y + 8, 'NOT FOUND YET', COLORS.faint).setOrigin(1, 0);
    const line = known ? e.text : e.hint || 'NOT SEEN YET.';
    this.text(x + 12, y + 26, fit(line, w - 24), known ? COLORS.text : COLORS.dim);
  }

  update(time, delta) {
    this.t += delta;
    const g = this.glow;
    g.clear();
    const s = this.selCard;
    if (!s) return;
    // A soft pulsing glow around the chosen card.
    const color = s.e.color || this.ch.color;
    const a = 0.25 + 0.2 * Math.sin(this.t / 220);
    g.lineStyle(3, color, a).strokeRoundedRect(s.x - 3, s.y - 3, CW + 6, CH + 6, 7);
  }

  setChapter(i) {
    const n = JOURNAL_CHAPTERS.length;
    this.chapter = (i + n) % n;
    this.index = 0;
    this.scroll = 0;
    Audio.play('cloth');
    this.render();
  }

  move(d) {
    const n = this.entries.length;
    if (!n) return;
    const next = this.index + d;
    if (next < 0 || next >= n) return;
    this.index = next;
    Audio.play('ui');
    this.render();
  }

  onKey(event) {
    if (event.repeat) return;
    switch (event.code) {
      case 'ArrowLeft': case 'KeyA': this.move(-1); break;
      case 'ArrowRight': case 'KeyD': this.move(1); break;
      case 'ArrowUp': case 'KeyW': this.move(-COLS); break;
      case 'ArrowDown': case 'KeyS': this.move(COLS); break;
      case 'KeyQ': this.setChapter(this.chapter - 1); break;
      case 'KeyE': case 'Tab': this.setChapter(this.chapter + 1); break;
      case 'Escape': case 'Backspace': case 'KeyJ': case 'KeyC': this.close(); break;
      default: break;
    }
  }

  close() {
    Audio.play('cloth');
    this.scene.stop();
    this.scene.resume(this.returnTo);
  }
}
