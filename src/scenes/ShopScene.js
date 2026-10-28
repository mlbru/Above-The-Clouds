import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, IS_PORTRAIT, IS_TOUCH } from '../config/gameConfig.js';
import { PixelText, COLORS, drawPanel } from '../ui/PixelText.js';
import { measureLine } from '../utils/pixelFont.js';
import { COSMETICS, SLOT_NAMES, RARITY, rarityOf, findCosmetic } from '../data/cosmetics.js';
import { FRAME_W } from '../render/climberArt.js';
import { Effects } from '../systems/Effects.js';
import { GEAR, PERKS, PACK_SLOTS, GEAR_BY_ID } from '../data/shop.js';
import { GEMS, GEM_ORDER } from '../data/gems.js';
import { buildClimberTexture, buildPreviewTexture } from '../render/textures.js';
import { Audio } from '../systems/AudioSystem.js';
import { toCss } from '../utils/color.js';

const GEM_TEXT = '#9fe8ff';
const ROW_H = 12;
const SLOTS = Object.keys(COSMETICS);

// What Bram says at the stall.
const BRAM_LINES = {
  hello: ['WHAT WILL IT BE TODAY?', 'FRESH GOODS FROM THE VALLEY!', 'LOOKING SHARP, CLIMBER.', 'GEMS FOR GEAR, FAIR AND SQUARE.'],
  buy: ['A FINE CHOICE!', 'PLEASURE DOING BUSINESS.', 'THAT ONE SUITS YOU.', "YOU WON'T REGRET IT!"],
  poor: ['COME BACK WITH A FEW MORE GEMS.', 'THE MOUNTAIN PAYS IN GEMS. GO EARN SOME!'],
  locked: ['THAT ONE HAS TO BE EARNED UP THERE.', 'NOT FOR SALE. THE MOUNTAIN DECIDES.'],
};
const pick = (list) => list[Math.floor(Math.random() * list.length)];

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
    // Landscape: the list on the left, details on the right. Portrait: the
    // header steps down below the touch buttons, the list on top, details below.
    this.top = IS_PORTRAIT ? 30 : 0;
    this.listX = 12; this.listY = IS_PORTRAIT ? this.top + 64 : 46;
    this.listW = IS_PORTRAIT ? GAME_WIDTH - 24 : 292;
    this.listH = IS_PORTRAIT ? 160 : GAME_HEIGHT - 46 - 24;
    this.trader = this.mode === 'trader';
    this.bramLine = pick(BRAM_LINES.hello);
    // Effects for the live preview of trails and hit effects.
    this.fx = new Effects(this);
    this.stage = null;
    this.stageT = 0;
    if (IS_PORTRAIT) {
      this.detX = 12; this.detW = GAME_WIDTH - 24;
      this.detY = this.listY + this.listH + 6; this.detH = GAME_HEIGHT - 24 - this.detY;
    } else {
      this.detX = 310; this.detW = GAME_WIDTH - 310 - 12;
      this.detY = this.listY; this.detH = this.listH;
    }
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
      const locked = !owned && p.lockedReason(item);
      return {
        icon: item.icon, text: item.name,
        right: locked ? 'LOCKED' : `${packed ? '[PACKED] ' : ''}X${owned}  ◆${item.price}`,
        rightColor: locked ? COLORS.faint : packed ? COLORS.green : owned ? COLORS.text : COLORS.dim,
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
        right: active ? 'ACTIVE' : has ? 'OWNED' : p.lockedReason(perk) ? 'LOCKED' : `◆${perk.price}`,
        rightColor: active ? COLORS.green : has ? COLORS.text : p.lockedReason(perk) ? COLORS.faint : p.gems >= perk.price ? GEM_TEXT : COLORS.red,
        item: perk, kind: 'perk',
        onAction: () => (has ? this.togglePerk(perk) : this.buyPerk(perk)),
      };
    });
  }

  styleRows() {
    const slot = SLOTS[this.styleSlot];
    const cycle = (d) => { this.styleSlot = (this.styleSlot + d + SLOTS.length) % SLOTS.length; this.index = 0; this.scroll = 0; this.render(); };
    const items = COSMETICS[slot];
    const fresh = items.filter((c) => this.prog.isNew(c.id)).length;
    const owned = items.filter((c) => this.prog.isUnlocked(c.id)).length;
    const rows = [{ header: true, text: `< ${SLOT_NAMES[slot]}S  ${owned}/${items.length}${fresh ? `  ${fresh} NEW` : ''} >`, onLeft: () => cycle(-1), onRight: () => cycle(1), onAction: () => cycle(1) }];
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
        rarity: rarityOf(item), isNew: this.prog.isNew(item.id),
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
        this.prog.markSeen(next.id);
        Audio.play('ui');
        this.render();
      };
      const fresh = owned.filter((c) => this.prog.isNew(c.id)).length;
      return {
        swatch: this.swatchOf(slot, cur), text: SLOT_NAMES[slot], right: `< ${cur.name} >`, rightColor: COLORS.gold,
        sub: `${owned.length}/${COSMETICS[slot].length}`, kind: 'wardrobe', slot, item: cur, rarity: rarityOf(cur), newCount: fresh,
        onAction: () => step(1), onLeft: () => step(-1), onRight: () => step(1),
      };
    });
  }

  swatchOf(slot, item) {
    if (item.style === 'none') return null;
    if (slot === 'accessory') return null;
    return item.rainbow ? 'rainbow' : item.color;
  }

  // ---------------------------------------------------------------- actions
  say(kind) { if (this.trader) this.bramLine = pick(BRAM_LINES[kind]); }

  message(text, color = COLORS.text) {
    this.msgText = text;
    this.msgColor = color;
    this.msgT = this.time.now;
    if (this.msgTimer) this.msgTimer.remove();
    this.msgTimer = this.time.delayedCall(2700, () => { if (this.sys.isActive()) this.render(); });
  }

  buyGear(item) {
    const locked = this.prog.lockedReason(item);
    if (locked) { Audio.play('denied'); this.message(locked, COLORS.red); }
    else if (!this.prog.buyGear(item.id)) { Audio.play('denied'); this.say('poor'); this.message('NOT ENOUGH GEMS', COLORS.red); }
    else {
      Audio.play('buy');
      this.say('buy');
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
    const locked = this.prog.lockedReason(perk);
    if (locked) { Audio.play('denied'); this.message(locked, COLORS.red); }
    else if (!this.prog.buyPerk(perk.id)) { Audio.play('denied'); this.say('poor'); this.message('NOT ENOUGH GEMS', COLORS.red); }
    else { Audio.play('buy'); this.say('buy'); this.message(`${perk.name} LEARNED`, COLORS.green); }
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
      this.say('buy');
      this.message(`BOUGHT ${item.name}!`, COLORS.green);
      this.celebrateBuy(item);
    } else { Audio.play('denied'); this.say(st.state === 'poor' ? 'poor' : 'locked'); this.message(st.state === 'poor' ? 'NOT ENOUGH GEMS' : st.reason, COLORS.red); }
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

    // Header: title and wallet; at the trader, Bram behind his stall says something.
    const T = this.top;
    const wallet = this.text(GAME_WIDTH - 14, T + 8, `${this.prog.gems}`, GEM_TEXT).setOrigin(1, 0).setScale(2);
    this.add2(this.add.image(wallet.x - wallet.displayWidth - 10, T + 13, 'icon_gem').setScale(2));
    if (this.trader) {
      drawPanel(this.g, 12, T + 3, 22, 22, { alpha: 0.95, highlight: 0xf2c14e });
      this.add2(this.add.sprite(23, T + 14, 'bram_face', Math.floor(this.time.now / 140) % 26 === 0 ? 1 : 0));
      this.text(40, T + 4, 'BRAM\'S STALL', COLORS.gold).setScale(2);
      // Portrait: Bram's speech bubble gets its own row under the title.
      const bx = IS_PORTRAIT ? 40 : 160, by = IS_PORTRAIT ? T + 24 : T + 4;
      const bw = IS_PORTRAIT ? GAME_WIDTH - 12 - bx : wallet.x - wallet.displayWidth - 30 - bx;
      const said = wrap(this.bramLine, bw - 10);
      const lines = said.split('\n').length;
      drawPanel(this.g, bx, by, bw, lines > 1 ? 20 : 13, { alpha: 0.95, fill: 0xf4efe4 });
      this.g.fillStyle(0xf4efe4, 1).fillTriangle(bx, by + 5, bx - 5, by + 8, bx, by + 9);
      this.text(bx + 5, by + 3, said, '#2a2440', { shadow: null });
    } else this.text(14, T + 8, 'WARDROBE', COLORS.gold).setScale(2);

    // Tabs
    let tx = 14;
    const ty = this.listY - 19;
    this.tabs.forEach((name, i) => {
      const sel = i === this.tab;
      const t = this.text(tx + 6, ty + 4, name, sel ? COLORS.gold : COLORS.dim);
      drawPanel(this.g, tx, ty, t.width + 12, 13, { alpha: sel ? 0.95 : 0.6, highlight: sel ? 0xf2c14e : null });
      const zone = this.add2(this.add.zone(tx, ty, t.width + 12, 13).setOrigin(0, 0).setInteractive({ useHandCursor: true }));
      zone.on('pointerdown', () => this.setTab(i));
      tx += t.width + 16;
    });
    if (!IS_TOUCH) this.text(GAME_WIDTH - 14, ty + 4, 'Q / E  SWITCH TAB', COLORS.faint).setOrigin(1, 0);

    // List
    drawPanel(this.g, this.listX, this.listY, this.listW, this.listH, { alpha: 0.9 });
    const end = Math.min(rows.length, this.scroll + this.visibleRows);
    for (let i = this.scroll; i < end; i++) this.drawRow(rows[i], i, this.listY + 4 + (i - this.scroll) * ROW_H);
    if (this.scroll > 0) this.text(this.listX + this.listW - 10, this.listY + 2, '↑', COLORS.dim);
    if (end < rows.length) this.text(this.listX + this.listW - 10, this.listY + this.listH - 8, '↓', COLORS.dim);

    // Detail
    drawPanel(this.g, this.detX, this.detY, this.detW, this.detH, { alpha: 0.9 });
    this.drawDetail(rows[this.index]);

    // Footer
    const hints = {
      GEAR: '↑↓ CHOOSE   SPACE BUY   ← → PACK   ESC LEAVE',
      PERKS: '↑↓ CHOOSE   SPACE BUY / ACTIVATE   ESC LEAVE',
      STYLE: `↑↓ CHOOSE   ← → CLOTHING TYPE   SPACE ${this.mode === 'trader' ? 'BUY / WEAR' : 'WEAR'}   ESC LEAVE`,
      WARDROBE: '↑↓ CHOOSE   ← → CHANGE   ESC DONE',
    };
    if (!IS_TOUCH) this.text(14, GAME_HEIGHT - 16, hints[this.tabName], COLORS.faint);
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
      // A stripe in the item's rarity colour.
      if (row.rarity) { this.g.fillStyle(RARITY[row.rarity].color, 0.9); this.g.fillRect(x + 2, y, 1, ROW_H - 2); }
      if (row.icon) this.add2(this.add.image(x + 8, y + 5, row.icon));
      if (row.swatch !== undefined && row.swatch !== null) this.drawSwatch(x + 5, y + 1, row.swatch);
      const name = this.text(x + 18, y + 2, row.text, sel ? COLORS.gold : COLORS.text);
      if (row.isNew) this.text(name.x + name.width + 5, y + 2, 'NEW!', '#ff7ab8');
      if (row.sub) this.text(x + 90, y + 2, row.newCount ? `${row.sub}  ${row.newCount} NEW` : row.sub, row.newCount ? '#ff7ab8' : COLORS.faint);
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
    let y = this.detY + 6;
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
      const locked = !this.prog.owned(row.item.id) && !this.prog.hasPerk(row.item.id) && this.prog.lockedReason(row.item);
      if (locked) {
        line(`LOCKED: ${locked}`, COLORS.red);
        if (row.kind === 'gear') { this.drawPackSlots(y); y += 18; }
      } else if (row.kind === 'gear') {
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
      if (row.item.lift && !locked) line('ONE TICKET AT A TIME. PACKING ONE SWAPS THE OTHER.', COLORS.blue);
      if (!this.gearAllowed) line('ONLY WORKS IN NORMAL MODE.', COLORS.red);
      else if (this.departed && row.kind === 'gear') line('THIS RUN HAS STARTED: NEW GEAR GOES WITH YOUR NEXT RUN.', COLORS.blue);
      else line(row.kind === 'gear' ? 'USED UP WHEN YOU LEAVE BASE CAMP. NORMAL MODE ONLY.' : 'NORMAL MODE ONLY.', COLORS.faint);
    } else if (row.kind === 'style' || row.kind === 'wardrobe' || row.header) {
      const look = { ...this.prog.data.look };
      if (row.kind === 'style') look[row.slot] = row.item.id;
      this.drawStage(x + 5, y - 1, w - 10, look, row.slot);
      y += this.stage.h + 3;
      if (row.kind === 'style') {
        this.prog.markSeen(row.item.id);
        line(row.item.name, COLORS.gold);
        line(RARITY[row.rarity].name, toCss(RARITY[row.rarity].color));
        const st = row.status;
        if (this.prog.data.look[row.slot] === row.item.id) line('WEARING', COLORS.green);
        else if (st.state === 'owned') button('WEAR', COLORS.green, () => this.styleAction(row.slot, row.item));
        else if (st.state === 'locked') line(st.reason, COLORS.red);
        else if (this.mode === 'trader') button(`BUY  ◆${st.price}`, st.state === 'buy' ? GEM_TEXT : COLORS.red, () => this.styleAction(row.slot, row.item));
        else line(`◆${st.price} AT THE BASE CAMP TRADER`, GEM_TEXT);
      } else if (row.kind === 'wardrobe') {
        line(row.item.name, toCss(RARITY[row.rarity].color));
        const total = Object.values(COSMETICS).flat();
        line(`OWNED ${total.filter((c) => this.prog.isUnlocked(c.id)).length}/${total.length}`, COLORS.dim);
      } else line('PICK A CLOTHING TYPE', COLORS.dim);
    }
    if (this.msgText && this.time.now - this.msgT < 2600) {
      this.text(cx, this.detY + this.detH - 12, this.msgText, this.msgColor).setOrigin(0.5, 0);
    }
    if (this.tabName === 'WARDROBE' || (this.tabName === 'STYLE' && row.header)) this.drawGemCollection();
  }

  // A little sky-and-ledge stage with the climber on it. Trails and hit
  // effects play on it live (see update()).
  drawStage(x, y, w, look, slot) {
    const h = this.detH > 190 ? 122 : 96;
    const scale = h > 100 ? 1.5 : 1.25;
    const g = this.g;
    const sky = [0x2a4a7a, 0x3a5f92, 0x5079aa, 0x6c95c2, 0x8fb4d8];
    sky.forEach((c, i) => { g.fillStyle(c, 1); g.fillRect(x, y + Math.round((i * h) / sky.length), w, Math.ceil(h / sky.length)); });
    g.fillStyle(0xdfe6f2, 0.55);
    [[0.2, 0.22, 14], [0.7, 0.14, 18], [0.85, 0.4, 10]].forEach(([fx, fy, r]) => { g.fillEllipse(x + w * fx, y + h * fy, r * 2, r * 0.8); });
    g.fillStyle(0x7f8ca6, 1);
    for (let i = 0; i < w; i++) {
      const top = y + h - 26 - Math.round(Math.abs(Math.sin(i / 17)) * 14 + Math.sin(i / 5) * 2);
      g.fillRect(x + i, top, 1, y + h - 10 - top);
    }
    g.fillStyle(0x4f8a3c, 1); g.fillRect(x, y + h - 10, w, 10);
    g.fillStyle(0x8fc85a, 1); g.fillRect(x, y + h - 10, w, 2);
    g.lineStyle(1, 0x16141f, 1); g.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
    buildPreviewTexture(this, 'climber_preview', look);
    const baseY = y + h - 9;
    const img = this.add2(this.add.image(x + w / 2, baseY, 'climber_preview', 'look').setOrigin(0.5, 1).setScale(scale));
    this.fx.setTrail(findCosmetic('trail', look.trail || 'trail-none'));
    this.fx.setHit(findCosmetic('hit', look.hit || 'hit-ring'));
    const mode = slot === 'trail' && look.trail !== 'trail-none' ? 'trail' : slot === 'hit' ? 'hit' : 'idle';
    this.stage = { x, y, w, h, img, cx: x + w / 2, baseY, scale, mode };
    if (this.pendingCelebrate) {
      this.pendingCelebrate = false;
      this.fx.confettiBurst(x + w / 2, baseY - 60, 36);
      this.fx.sparkle(x + w / 2, baseY - 40, 14);
    }
  }

  celebrateBuy() { this.pendingCelebrate = true; }

  update(time, delta) {
    const st = this.stage;
    if (!st || !st.img.active) return;
    this.stageT += delta;
    const t = this.stageT, img = st.img;
    if (st.mode === 'trail') {
      // Hop back and forth across the stage so the trail has somewhere to go.
      img.setFrame(Math.cos(t / 520) > 0 ? 'look' : 'look2');
      img.x = st.cx + Math.round(Math.sin(t / 520) * st.w * 0.3);
      img.y = st.baseY - Math.round(Math.abs(Math.sin(t / 260)) * 12);
      this.fx.trail(img.x, img.y - 26 * st.scale);
    } else if (st.mode === 'hit') {
      const beat = Math.floor(t / 700);
      if (beat !== st.beat) {
        st.beat = beat;
        const left = beat % 2 === 0;
        img.setFrame(left ? 'perfectL' : 'perfectR');
        img.y = st.baseY;
        const [hx, hy] = left ? [13, 0] : [35, 0];
        const top = img.y - 56 * st.scale;
        this.fx.hit(img.x + (hx - FRAME_W / 2) * st.scale, top + (hy + 4) * st.scale, (beat % 6) * 3);
        img.setScale(st.scale * 0.9, st.scale * 1.1);
        this.tweens.add({ targets: img, scaleX: st.scale, scaleY: st.scale, duration: 180, ease: 'Back.easeOut' });
      }
    } else {
      img.setFrame(Math.floor(t / 1300) % 2 ? 'look2' : 'look');
    }
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
    const y = this.detY + this.detH - 26;
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
        if (sc.refreshEffects) sc.refreshEffects();
      }
    }
    this.scene.stop();
    this.scene.resume(this.returnTo);
  }
}
