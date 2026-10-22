import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';
import { PixelText, COLORS, drawPanel } from '../ui/PixelText.js';
import { measureLine } from '../utils/pixelFont.js';
import { COSMETICS, SLOT_NAMES } from '../data/cosmetics.js';
import { GEAR, PERKS, PACK_SLOTS, GEAR_BY_ID } from '../data/shop.js';
import { GEMS, GEM_ORDER } from '../data/gems.js';
import { buildClimberTexture, buildPreviewTexture } from '../render/textures.js';
import { Audio } from '../systems/AudioSystem.js';
import { toCss } from '../utils/color.js';

const GEM_TEXT = '#9fe8ff';
const ROW_H = 12;
const SLOTS = Object.keys(COSMETICS);

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

// Base camp trader (gear, perks, style, wardrobe) and the stand-alone wardrobe.
// Launched over the Climb, Menu or Pause scene, which is paused meanwhile.
export class ShopScene extends Phaser.Scene {
  constructor() { super('Shop'); }

  init(data) {
    this.mode = data.mode || 'wardrobe';
    this.returnTo = data.returnTo || 'Menu';
    this.departed = !!data.departed;
    this.gearAllowed = data.gearAllowed !== false;
  }

  create() {
    this.prog = this.registry.get('progression');
    this.tabs = this.mode === 'trader' ? ['GEAR', 'PERKS', 'STYLE', 'WARDROBE'] : ['WARDROBE', 'STYLE'];
    this.tab = 0;
    this.index = 0;
    this.scroll = 0;
    this.styleSlot = 0;
    this.previewLook = null;
    this.objs = [];
    this.msg = null;
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a0a14, 0.93).setOrigin(0, 0).setInteractive();
    this.g = this.add.graphics();
    this.listX = 12; this.listY = 46; this.listW = 292; this.listH = GAME_HEIGHT - 46 - 24;
    this.detX = 310; this.detW = GAME_WIDTH - 310 - 12;
    this.visibleRows = Math.floor((this.listH - 6) / ROW_H);
    this.input.keyboard.on('keydown', this.onKey, this);
    this.input.on('wheel', (p, objs, dx, dy) => this.moveScroll(dy > 0 ? 1 : -1));
    this.events.once('shutdown', () => this.input.keyboard.off('keydown', this.onKey, this));
    this.render();
  }

  // ---------------------------------------------------------------- rows per tab
  get tabName() { return this.tabs[this.tab]; }

  rows() {
    switch (this.tabName) {
      case 'GEAR': return this.gearRows();
      case 'PERKS': return this.perkRows();
      case 'STYLE': return this.styleRows();
      default: return this.wardrobeRows();
    }
  }

  gearRows() {
    const p = this.prog;
    return GEAR.map((item) => {
      const owned = p.owned(item.id);
      const packed = p.isPacked(item.id);
      return {
        icon: item.icon, text: item.name,
        right: `${packed ? '[PACKED] ' : ''}X${owned}  ◆${item.price}`,
        rightColor: packed ? COLORS.green : owned ? COLORS.text : COLORS.dim,
        priceColor: p.gems >= item.price ? GEM_TEXT : COLORS.red,
        item, kind: 'gear',
        onAction: () => this.buyGear(item),
        onLeft: () => this.togglePack(item), onRight: () => this.togglePack(item),
      };
    });
  }

  perkRows() {
    const p = this.prog;
    return PERKS.map((perk) => {
      const has = p.hasPerk(perk.id);
      const active = p.data.activePerk === perk.id;
      return {
        icon: perk.icon, text: perk.name,
        right: active ? 'ACTIVE' : has ? 'OWNED' : `◆${perk.price}`,
        rightColor: active ? COLORS.green : has ? COLORS.text : p.gems >= perk.price ? GEM_TEXT : COLORS.red,
        item: perk, kind: 'perk',
        onAction: () => (has ? this.togglePerk(perk) : this.buyPerk(perk)),
      };
    });
  }

  styleRows() {
    const slot = SLOTS[this.styleSlot];
    const cycle = (d) => { this.styleSlot = (this.styleSlot + d + SLOTS.length) % SLOTS.length; this.index = 0; this.scroll = 0; this.render(); };
    const rows = [{ header: true, text: `< ${SLOT_NAMES[slot]}S >`, onLeft: () => cycle(-1), onRight: () => cycle(1), onAction: () => cycle(1) }];
    for (const item of COSMETICS[slot]) {
      const st = this.prog.cosmeticStatus(item);
      const wearing = this.prog.data.look[slot] === item.id;
      let right, color;
      if (wearing) { right = 'WEARING'; color = COLORS.green; }
      else if (st.state === 'owned') { right = 'OWNED'; color = COLORS.text; }
      else if (st.state === 'buy' || st.state === 'poor') { right = `◆${st.price}`; color = st.state === 'buy' ? GEM_TEXT : COLORS.red; }
      else { right = st.price ? `◆${st.price}` : 'LOCKED'; color = COLORS.faint; }
      rows.push({
        swatch: this.swatchOf(slot, item), text: item.name, right, rightColor: color, item, slot, kind: 'style', status: st,
        onAction: () => this.styleAction(slot, item),
        onLeft: () => cycle(-1), onRight: () => cycle(1),
      });
    }
    return rows;
  }

  wardrobeRows() {
    return SLOTS.map((slot) => {
      const owned = COSMETICS[slot].filter((c) => this.prog.isUnlocked(c.id));
      const cur = COSMETICS[slot].find((c) => c.id === this.prog.data.look[slot]) || owned[0];
      const step = (d) => {
        const i = owned.findIndex((c) => c.id === cur.id);
        const next = owned[(i + d + owned.length) % owned.length];
        this.prog.setLook(slot, next.id);
        this.render();
      };
      return {
        swatch: this.swatchOf(slot, cur), text: SLOT_NAMES[slot], right: `< ${cur.name} >`, rightColor: COLORS.gold,
        sub: `${owned.length}/${COSMETICS[slot].length}`, kind: 'wardrobe', slot,
        onAction: () => step(1), onLeft: () => step(-1), onRight: () => step(1),
      };
    });
  }

  swatchOf(slot, item) {
    if (slot === 'hat' && item.style === 'none') return null;
    if (slot === 'accessory') return null;
    return item.rainbow ? 'rainbow' : item.color;
  }

  // ---------------------------------------------------------------- actions
  message(text, color = COLORS.text) {
    this.msgText = text;
    this.msgColor = color;
    this.msgT = this.time.now;
    if (this.msgTimer) this.msgTimer.remove();
    this.msgTimer = this.time.delayedCall(2700, () => { if (this.sys.isActive()) this.render(); });
  }

  buyGear(item) {
    if (!this.prog.buyGear(item.id)) { Audio.play('denied'); this.message('NOT ENOUGH GEMS', COLORS.red); }
    else {
      Audio.play('buy');
      this.message(this.prog.isPacked(item.id) ? `BOUGHT ${item.name}. PACKED.` : `BOUGHT ${item.name}.`, COLORS.green);
    }
    this.render();
  }

  togglePack(item) {
    const r = this.prog.togglePack(item.id);
    if (r === null) {
      Audio.play('denied');
      this.message(this.prog.owned(item.id) < 1 ? 'BUY ONE FIRST' : `YOUR PACK HOLDS ${PACK_SLOTS} ITEMS`, COLORS.red);
    } else { Audio.play('ui'); this.message(r ? `${item.name} PACKED` : `${item.name} UNPACKED`); }
    this.render();
  }

  buyPerk(perk) {
    if (!this.prog.buyPerk(perk.id)) { Audio.play('denied'); this.message('NOT ENOUGH GEMS', COLORS.red); }
    else { Audio.play('buy'); this.message(`${perk.name} LEARNED`, COLORS.green); }
    this.render();
  }

  togglePerk(perk) {
    this.prog.setActivePerk(perk.id);
    Audio.play('ui');
    this.message(this.prog.data.activePerk === perk.id ? `${perk.name} ACTIVE` : 'NO PERK ACTIVE');
    this.render();
  }

  styleAction(slot, item) {
    const st = this.prog.cosmeticStatus(item);
    if (st.state === 'owned') { this.prog.setLook(slot, item.id); Audio.play('select'); this.message(`WEARING ${item.name}`, COLORS.green); }
    else if (this.mode !== 'trader') { Audio.play('denied'); this.message(st.state === 'locked' ? st.reason : 'BUY IT AT THE BASE CAMP TRADER', COLORS.red); }
    else if (st.state === 'buy') {
      this.prog.buyCosmetic(slot, item);
      Audio.play('buy');
      this.message(`BOUGHT ${item.name}!`, COLORS.green);
    } else { Audio.play('denied'); this.message(st.state === 'poor' ? 'NOT ENOUGH GEMS' : st.reason, COLORS.red); }
    this.render();
  }

  // ---------------------------------------------------------------- drawing
  clear() {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    this.g.clear();
  }

  add2(o) { this.objs.push(o); return o; }

  text(x, y, str, color = COLORS.text, opts = {}) { return this.add2(new PixelText(this, x, y, str, { color, ...opts })); }

  render() {
    this.clear();
    const rows = this.rows();
    this.currentRows = rows;
    this.index = Math.max(0, Math.min(this.index, rows.length - 1));
    if (this.index < this.scroll) this.scroll = this.index;
    if (this.index >= this.scroll + this.visibleRows) this.scroll = this.index - this.visibleRows + 1;
    this.scroll = Math.max(0, Math.min(this.scroll, Math.max(0, rows.length - this.visibleRows)));

    // Header: title and wallet.
    this.text(14, 8, this.mode === 'trader' ? 'BASE CAMP TRADER' : 'WARDROBE', COLORS.gold).setScale(2);
    const wallet = this.text(GAME_WIDTH - 14, 8, `${this.prog.gems}`, GEM_TEXT).setOrigin(1, 0).setScale(2);
    this.add2(this.add.image(wallet.x - wallet.displayWidth - 10, 13, 'icon_gem').setScale(2));

    // Tabs
    let tx = 14;
    this.tabs.forEach((name, i) => {
      const sel = i === this.tab;
      const t = this.text(tx + 6, 31, name, sel ? COLORS.gold : COLORS.dim);
      drawPanel(this.g, tx, 27, t.width + 12, 13, { alpha: sel ? 0.95 : 0.6, highlight: sel ? 0xf2c14e : null });
      const zone = this.add2(this.add.zone(tx, 27, t.width + 12, 13).setOrigin(0, 0).setInteractive({ useHandCursor: true }));
      zone.on('pointerdown', () => this.setTab(i));
      tx += t.width + 16;
    });
    this.text(GAME_WIDTH - 14, 31, 'Q / E  SWITCH TAB', COLORS.faint).setOrigin(1, 0);

    // List
    drawPanel(this.g, this.listX, this.listY, this.listW, this.listH, { alpha: 0.9 });
    const end = Math.min(rows.length, this.scroll + this.visibleRows);
    for (let i = this.scroll; i < end; i++) this.drawRow(rows[i], i, this.listY + 4 + (i - this.scroll) * ROW_H);
    if (this.scroll > 0) this.text(this.listX + this.listW - 10, this.listY + 2, '↑', COLORS.dim);
    if (end < rows.length) this.text(this.listX + this.listW - 10, this.listY + this.listH - 8, '↓', COLORS.dim);

    // Detail
    drawPanel(this.g, this.detX, this.listY, this.detW, this.listH, { alpha: 0.9 });
    this.drawDetail(rows[this.index]);

    // Footer
    const hints = {
      GEAR: '↑↓ CHOOSE   SPACE BUY   ← → PACK   ESC LEAVE',
      PERKS: '↑↓ CHOOSE   SPACE BUY / ACTIVATE   ESC LEAVE',
      STYLE: `↑↓ CHOOSE   ← → CLOTHING TYPE   SPACE ${this.mode === 'trader' ? 'BUY / WEAR' : 'WEAR'}   ESC LEAVE`,
      WARDROBE: '↑↓ CHOOSE   ← → CHANGE   ESC DONE',
    };
    this.text(14, GAME_HEIGHT - 16, hints[this.tabName], COLORS.faint);
    const close = this.text(GAME_WIDTH - 14, GAME_HEIGHT - 16, this.mode === 'trader' ? '[ LEAVE ]' : '[ DONE ]', COLORS.green).setOrigin(1, 0);
    close.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.close());
  }

  drawRow(row, i, y) {
    const sel = i === this.index;
    const x = this.listX + 4, w = this.listW - 8;
    if (sel) {
      this.g.fillStyle(0xf2c14e, 0.16); this.g.fillRect(x, y - 1, w, ROW_H);
      this.g.fillStyle(0xf2c14e, 1); this.g.fillRect(x, y - 1, 1, ROW_H);
    }
    if (row.header) {
      this.text(x + w / 2, y + 2, row.text, sel ? COLORS.gold : COLORS.text).setOrigin(0.5, 0);
    } else {
      if (row.icon) this.add2(this.add.image(x + 8, y + 5, row.icon));
      if (row.swatch !== undefined && row.swatch !== null) this.drawSwatch(x + 4, y + 1, row.swatch);
      this.text(x + 18, y + 2, row.text, sel ? COLORS.gold : COLORS.text);
      if (row.sub) this.text(x + 90, y + 2, row.sub, COLORS.faint);
      this.text(x + w - 4, y + 2, row.right, row.rightColor).setOrigin(1, 0);
    }
    const zone = this.add2(this.add.zone(x, y - 1, w, ROW_H).setOrigin(0, 0).setInteractive({ useHandCursor: true }));
    zone.on('pointermove', () => { if (this.index !== i) { this.index = i; this.render(); } });
    zone.on('pointerdown', (p) => {
      if (this.index !== i) { this.index = i; this.render(); return; }
      const local = p.x - x;
      if (row.onLeft && local < w * 0.25 && (row.header || row.kind === 'wardrobe')) row.onLeft();
      else if (row.onAction) row.onAction();
    });
  }

  drawSwatch(x, y, color) {
    const g = this.g;
    g.fillStyle(0x16141f, 1); g.fillRect(x - 1, y - 1, 10, 10);
    if (color === 'rainbow') {
      [0xf0644b, 0xf2c14e, 0x8fd16a, 0x6fd6ff].forEach((c, k) => { g.fillStyle(c, 1); g.fillRect(x, y + k * 2, 8, 2); });
    } else { g.fillStyle(color, 1); g.fillRect(x, y, 8, 8); }
  }

  drawDetail(row) {
    const x = this.detX, w = this.detW, cx = x + w / 2;
    let y = this.listY + 6;
    const line = (str, color = COLORS.text) => {
      const t = this.text(cx, y, wrap(str, w - 12), color, { align: 'center' }).setOrigin(0.5, 0);
      y += t.height + 4;
      return t;
    };
    // One or more clickable buttons centred on a row.
    const buttons = (...list) => {
      const widths = list.map(([label]) => measureLine(label) + 10);
      let bx = Math.round(cx - (widths.reduce((a, b) => a + b, 0) + (list.length - 1) * 6) / 2);
      list.forEach(([label, color, fn], k) => {
        drawPanel(this.g, bx, y - 3, widths[k], 11, { alpha: 0.95, highlight: Phaser.Display.Color.HexStringToColor(color).color });
        const t = this.text(bx + 5, y, label, color);
        const zone = this.add2(this.add.zone(bx, y - 3, widths[k], 11).setOrigin(0, 0).setInteractive({ useHandCursor: true }));
        zone.on('pointerdown', fn);
        t.setDepth(1);
        bx += widths[k] + 6;
      });
      y += 15;
    };
    const button = (label, color, fn) => buttons([label, color, fn]);
    if (!row) return;
    if (row.kind === 'gear' || row.kind === 'perk') {
      this.add2(this.add.image(cx, y + 10, row.item.icon).setScale(2));
      y += 26;
      line(row.kind === 'gear' ? `${row.item.name}  X${this.prog.owned(row.item.id)}` : row.item.name, COLORS.gold);
      line(row.item.text, COLORS.dim);
      if (row.kind === 'gear') {
        buttons(
          [`BUY ◆${row.item.price}`, this.prog.gems >= row.item.price ? GEM_TEXT : COLORS.red, () => this.buyGear(row.item)],
          [this.prog.isPacked(row.item.id) ? 'UNPACK' : 'PACK', COLORS.green, () => this.togglePack(row.item)],
        );
        this.drawPackSlots(y);
        y += 18;
      } else {
        const has = this.prog.hasPerk(row.item.id);
        if (!has) button(`LEARN  ◆${row.item.price}`, this.prog.gems >= row.item.price ? GEM_TEXT : COLORS.red, () => this.buyPerk(row.item));
        else button(this.prog.data.activePerk === row.item.id ? 'ACTIVE (TURN OFF)' : 'MAKE ACTIVE', COLORS.green, () => this.togglePerk(row.item));
        line('ONE PERK CAN BE ACTIVE AT A TIME.', COLORS.faint);
      }
      if (!this.gearAllowed) line('ONLY WORKS IN NORMAL MODE.', COLORS.red);
      else if (this.departed && row.kind === 'gear') line('THIS RUN HAS STARTED: NEW GEAR GOES WITH YOUR NEXT RUN.', COLORS.blue);
      else line(row.kind === 'gear' ? 'USED UP WHEN YOU LEAVE BASE CAMP. NORMAL MODE ONLY.' : 'NORMAL MODE ONLY.', COLORS.faint);
    } else if (row.kind === 'style' || row.kind === 'wardrobe' || row.header) {
      const look = { ...this.prog.data.look };
      if (row.kind === 'style') look[row.slot] = row.item.id;
      buildPreviewTexture(this, 'climber_preview', look);
      const scale = this.listH > 190 ? 2 : 1.5;
      this.add2(this.add.image(cx, y + 2, 'climber_preview', 'look').setOrigin(0.5, 0).setScale(scale));
      y += Math.round(56 * scale) + 2;
      if (row.kind === 'style') {
        line(row.item.name, COLORS.gold);
        const st = row.status;
        if (this.prog.data.look[row.slot] === row.item.id) line('WEARING', COLORS.green);
        else if (st.state === 'owned') button('WEAR', COLORS.green, () => this.styleAction(row.slot, row.item));
        else if (st.state === 'locked') line(st.reason, COLORS.red);
        else if (this.mode === 'trader') button(`BUY  ◆${st.price}`, st.state === 'buy' ? GEM_TEXT : COLORS.red, () => this.styleAction(row.slot, row.item));
        else line(`◆${st.price} AT THE BASE CAMP TRADER`, GEM_TEXT);
      } else if (row.kind === 'wardrobe') {
        const total = Object.values(COSMETICS).flat();
        line(`OWNED ${total.filter((c) => this.prog.isUnlocked(c.id)).length}/${total.length}`, COLORS.dim);
      } else line('PICK A CLOTHING TYPE', COLORS.dim);
    }
    if (this.msgText && this.time.now - this.msgT < 2600) {
      this.text(cx, this.listY + this.listH - 12, this.msgText, this.msgColor).setOrigin(0.5, 0);
    }
    if (this.tabName === 'WARDROBE' || (this.tabName === 'STYLE' && row.header)) this.drawGemCollection();
  }

  drawPackSlots(y) {
    const cx = this.detX + this.detW / 2;
    const packed = this.prog.data.packed;
    for (let i = 0; i < PACK_SLOTS; i++) {
      const sx = Math.round(cx - (PACK_SLOTS * 16) / 2 + i * 16);
      drawPanel(this.g, sx, y, 14, 14, { alpha: 0.95 });
      if (packed[i]) this.add2(this.add.image(sx + 7, y + 7, GEAR_BY_ID[packed[i]].icon));
    }
  }

  // Regional gems found so far (they unlock some items at the trader).
  drawGemCollection() {
    const y = this.listY + this.listH - 26;
    const x0 = this.detX + Math.round(this.detW / 2 - (GEM_ORDER.length * 24) / 2);
    GEM_ORDER.forEach((id, i) => {
      const n = this.prog.found(id);
      this.add2(this.add.image(x0 + i * 24 + 6, y + 4, `gem_${id}`)).setAlpha(n ? 1 : 0.25);
      this.text(x0 + i * 24 + 12, y + 2, `${n}`, n ? toCss(GEMS[id].color) : COLORS.faint);
    });
  }

  // ---------------------------------------------------------------- input
  setTab(i) {
    if (i === this.tab) return;
    this.tab = (i + this.tabs.length) % this.tabs.length;
    this.index = 0;
    this.scroll = 0;
    Audio.play('ui');
    this.render();
  }

  moveScroll(d) {
    this.move(d);
  }

  move(d) {
    const n = this.currentRows.length;
    if (!n) return;
    this.index = (this.index + d + n) % n;
    Audio.play('ui');
    this.render();
  }

  onKey(event) {
    if (event.repeat) return;
    const row = this.currentRows[this.index];
    switch (event.code) {
      case 'ArrowUp': case 'KeyW': this.move(-1); break;
      case 'ArrowDown': case 'KeyS': this.move(1); break;
      case 'ArrowLeft': case 'KeyA': if (row && row.onLeft) row.onLeft(); break;
      case 'ArrowRight': case 'KeyD': if (row && row.onRight) row.onRight(); break;
      case 'KeyQ': this.setTab(this.tab - 1); break;
      case 'KeyE': case 'Tab': this.setTab(this.tab + 1); break;
      case 'Space': case 'Enter': if (row && row.onAction) row.onAction(); break;
      case 'Escape': case 'Backspace': case 'KeyT': this.close(); break;
      default: break;
    }
  }

  close() {
    Audio.play('cloth');
    // Rebuild the gameplay sheet once and let the scene underneath pick it up.
    buildClimberTexture(this, this.prog.data.look);
    for (const key of ['Climb', 'Menu']) {
      const sc = this.scene.get(key);
      if (sc && sc.sys.settings.status !== Phaser.Scenes.SHUTDOWN && sc.climber && sc.sys.isActive && (sc.sys.isActive() || sc.sys.isPaused())) {
        if (sc.climber.refreshTexture) sc.climber.refreshTexture();
        else sc.climber.setTexture('climber', 'look');
      }
    }
    this.scene.stop();
    this.scene.resume(this.returnTo);
  }
}
