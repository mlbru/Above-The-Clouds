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
import { toCss, darken } from '../utils/color.js';

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
    // Light over the mirror glass (see update()).
    this.glint = this.add.graphics().setDepth(5);
    // Landscape: the list on the left, details on the right. Portrait: the
    // header steps down below the touch buttons, the list on top, details below.
    this.top = IS_PORTRAIT ? 30 : 0;
    this.listX = 12; this.listY = IS_PORTRAIT ? this.top + 70 : 46;
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
    // Warm lantern light: two lanterns under the awning, or one on the tent
    // pole (which stands between the rail and the mirror when lying down).
    this.tentPoleX = IS_PORTRAIT ? GAME_WIDTH / 2 : this.detX - 3;
    this.lampY = this.top + 38;
    const ly = this.mode === 'trader' ? this.top + 26 : this.lampY;
    this.lamps = (this.mode === 'trader' ? [GAME_WIDTH * 0.04, GAME_WIDTH * 0.96] : [this.tentPoleX + 6]).map((x) =>
      this.add.image(x, ly, 'glow').setBlendMode('ADD').setTint(0xffb050).setScale(this.mode === 'trader' ? 2.6 : 4).setDepth(4).setAlpha(0.35));
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
  // Two looks. At the trader: Bram's market stall (striped awning, plank
  // walls, goods on lantern-lit shelves with paper price tags, a parchment
  // card pinned up for the chosen item). The stand-alone wardrobe: inside
  // the tent at night (canvas walls, a clothes rail of hangers, and a tall
  // standing mirror the climber tries things on in).
  clear() {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    this.g.clear();
  }

  add2(o) { this.objs.push(o); return o; }

  text(x, y, str, color = COLORS.text, opts = {}) { return this.add2(new PixelText(this, x, y, str, { color, ...opts })); }

  // Colours for text on paper: the bright UI colours turned to ink.
  ink(color) {
    return { [COLORS.gold]: '#8a5a10', [COLORS.dim]: '#6a5a44', [COLORS.text]: '#3a2a1a', [COLORS.red]: '#b8242e', [COLORS.green]: '#3a7a2a', [GEM_TEXT]: '#1e6a9a', [COLORS.blue]: '#1e6a9a', [COLORS.faint]: '#8a7a64' }[color] || color;
  }

  render() {
    this.clear();
    const rows = this.rows();
    this.currentRows = rows;
    this.index = Math.max(0, Math.min(this.index, rows.length - 1));
    if (this.index < this.scroll) this.scroll = this.index;
    if (this.index >= this.scroll + this.visibleRows) this.scroll = this.index - this.visibleRows + 1;
    this.scroll = Math.max(0, Math.min(this.scroll, Math.max(0, rows.length - this.visibleRows)));
    const g = this.g;
    const T = this.top;

    if (this.trader) this.drawStall(); else this.drawTent();

    // The title: a carved plaque on the awning, or a cloth label sewn on the tent.
    const title = this.trader ? "BRAM'S STALL" : 'WARDROBE';
    const tw = measureLine(title) * 2 + 16;
    if (this.trader) {
      g.fillStyle(0x16141f, 1).fillRect(10, T + 2, tw + 2, 18);
      g.fillStyle(0x6a4428, 1).fillRect(11, T + 2, tw, 16);
      g.fillStyle(0x8a5a32, 1).fillRect(11, T + 2, tw, 2);
      g.fillStyle(0x4a2e1a, 1).fillRect(11, T + 16, tw, 2);
      [[13, T + 4], [9 + tw, T + 4], [13, T + 14], [9 + tw, T + 14]].forEach(([x, y]) => g.fillStyle(0xc8a050, 1).fillRect(x, y, 1, 1));
      this.text(19, T + 5, title, '#f2c14e', { shadow: '#2a1608' }).setScale(2);
    } else {
      g.fillStyle(0x2a2440, 1).fillRect(10, T + 3, tw + 2, 18);
      g.fillStyle(0x3b4a8a, 1).fillRect(11, T + 4, tw, 16);
      for (let x = 13; x < 9 + tw; x += 3) g.fillStyle(0xd8c8a0, 1).fillRect(x, T + 5, 1, 1).fillRect(x, T + 18, 1, 1);
      this.text(19, T + 7, title, '#f4efe4').setScale(2);
    }

    // The wallet: a leather pouch with the gems in it.
    const wallet = this.text(GAME_WIDTH - 14, T + 6, `${this.prog.gems}`, GEM_TEXT).setOrigin(1, 0).setScale(2);
    const px = wallet.x - wallet.displayWidth - 26;
    g.fillStyle(0x16141f, 1).fillRect(px - 1, T + 2, wallet.displayWidth + 34, 18);
    g.fillStyle(this.trader ? 0x5a3a22 : 0x2c2740, 1).fillRect(px, T + 3, wallet.displayWidth + 32, 16);
    g.fillStyle(0x000000, 0.25).fillRect(px, T + 15, wallet.displayWidth + 32, 4);
    this.add2(this.add.image(px + 11, T + 11, 'icon_gem').setScale(2));
    wallet.setDepth(1);

    // Tabs: wooden signs hanging from the awning on two strings (trader), or
    // ribbon tags pinned to the canvas (wardrobe).
    let tx = 14;
    const ty = this.listY - 19;
    this.tabs.forEach((name, i) => {
      const sel = i === this.tab;
      const w = measureLine(name) + 12;
      const y = ty + (sel ? 1 : 0);
      if (this.trader) {
        g.fillStyle(0xc8b48a, 0.8).fillRect(tx + 3, ty - 8, 1, 9).fillRect(tx + w - 4, ty - 8, 1, 9);
        g.fillStyle(0x16141f, 1).fillRect(tx - 1, y - 1, w + 2, 14);
        g.fillStyle(sel ? 0x8a5a32 : 0x5a3a22, 1).fillRect(tx, y, w, 12);
        g.fillStyle(sel ? 0xa8743e : 0x6a4428, 1).fillRect(tx, y, w, 2);
        if (sel) g.fillStyle(0xf2c14e, 1).fillRect(tx, y + 11, w, 1);
      } else {
        g.fillStyle(0x16141f, 1).fillRect(tx - 1, y - 1, w + 2, 14);
        g.fillStyle(sel ? 0xc8463b : 0x4a3a5a, 1).fillRect(tx, y, w, 12);
        g.fillStyle(sel ? 0xf0644b : 0x5a4a6a, 1).fillRect(tx, y, w, 1);
        g.fillStyle(0xc8a050, 1).fillRect(tx + Math.floor(w / 2), y - 2, 1, 3);
      }
      this.text(tx + 6, y + 4, name, sel ? COLORS.gold : '#d8c8a8');
      const zone = this.add2(this.add.zone(tx, ty, w, 13).setOrigin(0, 0).setInteractive({ useHandCursor: true }));
      zone.on('pointerdown', () => this.setTab(i));
      tx += w + 6;
    });

    // Bram behind the stall, talking.
    if (this.trader) {
      const bx = IS_PORTRAIT ? 40 : Math.max(tx + 26, 250), by = IS_PORTRAIT ? this.listY - 38 : ty - 6;
      const bw = GAME_WIDTH - 12 - bx;
      g.fillStyle(0x16141f, 1).fillRect(bx - 25, by - 1, 22, 22);
      g.fillStyle(0x6a4428, 1).fillRect(bx - 24, by, 20, 20);
      this.add2(this.add.sprite(bx - 14, by + 10, 'bram_face', Math.floor(this.time.now / 140) % 26 === 0 ? 1 : 0));
      const said = wrap(this.bramLine, bw - 10);
      const lines = said.split('\n').length;
      const bh = lines > 1 ? 20 : 13;
      g.fillStyle(0x16141f, 1).fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      g.fillStyle(0xf4efe4, 1).fillRect(bx, by, bw, bh);
      g.fillStyle(0xf4efe4, 1).fillTriangle(bx, by + 4, bx - 4, by + 7, bx, by + 9);
      this.text(bx + 5, by + 3, said, '#2a2440', { shadow: null });
    } else if (!IS_TOUCH) this.text(GAME_WIDTH - 14, ty + 4, 'Q / E  SWITCH TAB', '#8a84a0').setOrigin(1, 0);

    // The list: shelves, or the clothes rail.
    const L = { x: this.listX, y: this.listY, w: this.listW, h: this.listH };
    if (this.trader) {
      g.fillStyle(0x16141f, 1).fillRect(L.x - 2, L.y - 2, L.w + 4, L.h + 4);
      g.fillStyle(0x24160c, 1).fillRect(L.x, L.y, L.w, L.h);
      g.fillStyle(0x6a4428, 1).fillRect(L.x - 2, L.y - 2, L.w + 4, 2).fillRect(L.x - 2, L.y + L.h, L.w + 4, 2);
    } else {
      g.fillStyle(0x16100a, 0.55).fillRect(L.x, L.y, L.w, L.h);
      // The rail itself, a pole along the top on two posts.
      g.fillStyle(0x16141f, 1).fillRect(L.x - 3, L.y - 1, L.w + 6, 4);
      g.fillStyle(0xa8a4b8, 1).fillRect(L.x - 2, L.y, L.w + 4, 2);
      g.fillStyle(0x6a4428, 1).fillRect(L.x - 3, L.y, 3, L.h).fillRect(L.x + L.w, L.y, 3, L.h);
    }
    const end = Math.min(rows.length, this.scroll + this.visibleRows);
    for (let i = this.scroll; i < end; i++) this.drawRow(rows[i], i, this.listY + 5 + (i - this.scroll) * ROW_H);
    // In the tent, where the list runs out: boots and a folded sweater on the groundsheet.
    if (!this.trader && (end - this.scroll) * ROW_H + 40 < L.h) {
      const by = L.y + L.h - 4, bx = L.x + 12;
      for (const ox of [0, 13]) {
        g.fillStyle(0x16141f, 1).fillRect(bx + ox - 1, by - 13, 9, 14).fillRect(bx + ox - 1, by - 5, 13, 6);
        g.fillStyle(0x6a4428, 1).fillRect(bx + ox, by - 12, 7, 12).fillRect(bx + ox, by - 4, 11, 4);
        g.fillStyle(0x8a5a32, 1).fillRect(bx + ox, by - 12, 7, 1);
        g.fillStyle(0x2a1d15, 1).fillRect(bx + ox, by - 1, 11, 1);
        g.fillStyle(0xd8c8a0, 1).fillRect(bx + ox + 2, by - 10, 3, 1).fillRect(bx + ox + 2, by - 7, 3, 1);
      }
      const sx = bx + 36;
      [[0xc8463b, 0], [0x3b6ea5, -5], [0x8fd16a, -10]].forEach(([c, dy]) => {
        g.fillStyle(0x16141f, 1).fillRect(sx - 1, by + dy - 5, 24, 6);
        g.fillStyle(c, 1).fillRect(sx, by + dy - 4, 22, 4);
        g.fillStyle(0xffffff, 0.2).fillRect(sx, by + dy - 4, 22, 1);
      });
    }
    // Empty shelves below the goods.
    if (this.trader) {
      for (let k = end - this.scroll; k < this.visibleRows; k++) {
        const y = this.listY + 5 + k * ROW_H;
        g.fillStyle(0x4a2e1a, 1).fillRect(L.x + 2, y + ROW_H - 3, L.w - 4, 2);
        g.fillStyle(0x6a4428, 1).fillRect(L.x + 2, y + ROW_H - 3, L.w - 4, 1);
      }
    }
    if (this.scroll > 0) this.text(L.x + L.w - 10, L.y + 2, '↑', COLORS.gold);
    if (end < rows.length) this.text(L.x + L.w - 10, L.y + L.h - 8, '↓', COLORS.gold);

    // The chosen item: a parchment card on the stall post, or the mirror.
    if (this.trader) {
      this.drawPaper(this.detX, this.detY, this.detW, this.detH);
      // Bram's ink stamp, faded, in the corner (not where the gem row goes).
      if (this.tabName === 'GEAR' || this.tabName === 'PERKS') {
        const sx = this.detX + this.detW - 26, sy = this.detY + this.detH - 30;
        g.lineStyle(1, 0xb8242e, 0.35).strokeCircle(sx, sy, 15).strokeCircle(sx, sy, 12);
        this.text(sx, sy - 6, 'BRAM', '#b8242e', { shadow: null }).setOrigin(0.5, 0).setAlpha(0.4);
        this.text(sx, sy + 1, 'GOODS', '#b8242e', { shadow: null }).setOrigin(0.5, 0).setAlpha(0.4);
      }
    }
    this.drawDetail(rows[this.index]);

    // Footer: the counter top (stall) or the groundsheet (tent).
    const fy = GAME_HEIGHT - 20;
    g.fillStyle(0x16141f, 1).fillRect(0, fy, GAME_WIDTH, 1);
    g.fillStyle(this.trader ? 0x6a4428 : 0x2a3a2a, 1).fillRect(0, fy + 1, GAME_WIDTH, 19);
    g.fillStyle(this.trader ? 0x8a5a32 : 0x3a4a3a, 1).fillRect(0, fy + 1, GAME_WIDTH, 2);
    const hints = {
      GEAR: '↑↓ CHOOSE   SPACE BUY   ← → PACK   ESC LEAVE',
      PERKS: '↑↓ CHOOSE   SPACE BUY / ACTIVATE   ESC LEAVE',
      STYLE: `↑↓ CHOOSE   ← → CLOTHING TYPE   SPACE ${this.mode === 'trader' ? 'BUY / WEAR' : 'WEAR'}   ESC LEAVE`,
      WARDROBE: '↑↓ CHOOSE   ← → CHANGE   ESC DONE',
    };
    if (!IS_TOUCH) this.text(12, fy + 7, hints[this.tabName], this.trader ? '#e8d4a8' : '#a8b8a0', { shadow: '#16141f' });
    const label = this.mode === 'trader' ? 'LEAVE' : 'DONE';
    const lw = measureLine(label) + 14, lx = GAME_WIDTH - 12 - lw;
    g.fillStyle(0x16141f, 1).fillRect(lx - 1, fy + 3, lw + 2, 14);
    g.fillStyle(0x3a7a2a, 1).fillRect(lx, fy + 4, lw, 12);
    g.fillStyle(0x8fd16a, 1).fillRect(lx, fy + 4, lw, 1);
    this.text(lx + 7, fy + 8, label, '#f4efe4').setDepth(1);
    this.add2(this.add.zone(lx, fy + 3, lw, 14).setOrigin(0, 0).setInteractive({ useHandCursor: true })).on('pointerdown', () => this.close());
  }

  // Plank walls under a red-and-cream striped awning with a scalloped edge.
  drawStall() {
    const g = this.g, T = this.top;
    g.fillStyle(0x3a2618, 1).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    for (let y = T + 18; y < GAME_HEIGHT; y += 13) {
      g.fillStyle(0x2a1a0e, 1).fillRect(0, y, GAME_WIDTH, 1);
      g.fillStyle(0x4a3220, 1).fillRect(0, y + 1, GAME_WIDTH, 1);
      for (let x = (y * 37) % 90; x < GAME_WIDTH; x += 90) g.fillStyle(0x2a1a0e, 1).fillRect(x, y + 1, 1, 12);
      for (let x = (y * 13) % 23; x < GAME_WIDTH; x += 23) g.fillStyle(0x32200f, 1).fillRect(x, y + 5 + (x % 5), 3, 1);
    }
    if (T) g.fillStyle(0x16141f, 1).fillRect(0, 0, GAME_WIDTH, T);
    const stripe = 14;
    for (let x = 0; x < GAME_WIDTH; x += stripe) {
      const red = Math.floor(x / stripe) % 2 === 0;
      g.fillStyle(red ? 0xc8463b : 0xf0e2c0, 1).fillRect(x, T, stripe, 18);
      g.fillStyle(red ? 0xa8343a : 0xd8c8a0, 1).fillRect(x, T + 14, stripe, 4);
      // The scallop hanging under each stripe.
      g.fillStyle(red ? 0xa8343a : 0xd8c8a0, 1).fillCircle(x + stripe / 2, T + 18, stripe / 2 - 0.5);
    }
    g.fillStyle(0x000000, 0.3).fillRect(0, T + 24, GAME_WIDTH, 2);
  }

  // Inside the tent: canvas with seams, a centre pole, warm light from a lantern.
  drawTent() {
    const g = this.g, T = this.top;
    g.fillStyle(0x1c1610, 1).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const cx = this.tentPoleX;
    for (let y = T; y < GAME_HEIGHT; y += 2) {
      const k = (y - T) / (GAME_HEIGHT - T);
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0x7a6448), Phaser.Display.Color.ValueToColor(0x3a2e22), 100, Math.round(k * 100));
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1).fillRect(0, y, GAME_WIDTH, 2);
    }
    // Seams running down from the peak.
    for (let i = -4; i <= 4; i++) {
      const bx = cx + i * (GAME_WIDTH / 8);
      for (let y = T; y < GAME_HEIGHT; y += 3) g.fillStyle(0x2a2016, 0.5).fillRect(Math.round(cx + (bx - cx) * ((y - T) / (GAME_HEIGHT - T))), y, 1, 2);
    }
    // The pole, with a lantern hanging from a hook.
    g.fillStyle(0x4a2e1a, 1).fillRect(cx - 2, T, 4, GAME_HEIGHT - T);
    g.fillStyle(0x6a4428, 1).fillRect(cx - 2, T, 1, GAME_HEIGHT - T);
    const ly = this.lampY;
    g.fillStyle(0x16141f, 1).fillRect(cx + 2, ly - 9, 5, 1).fillRect(cx + 6, ly - 9, 1, 3);
    g.fillStyle(0x16141f, 1).fillRect(cx + 3, ly - 6, 7, 11);
    g.fillStyle(0x3a3440, 1).fillRect(cx + 4, ly - 6, 5, 2).fillRect(cx + 4, ly + 3, 5, 2);
    g.fillStyle(0xffd07a, 1).fillRect(cx + 4, ly - 4, 5, 7);
    g.fillStyle(0xfff4c8, 1).fillRect(cx + 6, ly - 2, 1, 3);
    if (T) g.fillStyle(0x16141f, 1).fillRect(0, 0, GAME_WIDTH, T);
  }

  // A sheet of worn paper pinned up (the item card at the stall).
  drawPaper(x, y, w, h) {
    const g = this.g;
    g.fillStyle(0x000000, 0.4).fillRect(x + 3, y + 3, w, h);
    g.fillStyle(0x8a7450, 1).fillRect(x, y, w, h);
    g.fillStyle(0xeadfc4, 1).fillRect(x + 1, y + 1, w - 2, h - 2);
    g.fillStyle(0xc8b48a, 1).fillRect(x + 1, y + h - 4, w - 2, 3).fillRect(x + w - 3, y + 1, 2, h - 2);
    for (let k = 0; k < 6; k++) g.fillStyle(0x3a2618, 1).fillRect(x + 10 + ((k * 53) % (w - 20)), k % 2 ? y : y + h - 1, 2 + (k % 3), 1);
    for (const px of [x + 8, x + w - 9]) {
      g.fillStyle(0x5a0c14, 1).fillCircle(px, y + 4, 3);
      g.fillStyle(0xd83a3a, 1).fillCircle(px, y + 3, 2.5);
    }
  }

  drawRow(row, i, y) {
    const g = this.g;
    const sel = i === this.index;
    const x = this.listX + 4, w = this.listW - 8;
    if (this.trader) {
      // Each row sits on its own shelf board.
      g.fillStyle(0x4a2e1a, 1).fillRect(x - 2, y + ROW_H - 3, w + 4, 2);
      g.fillStyle(0x6a4428, 1).fillRect(x - 2, y + ROW_H - 3, w + 4, 1);
      if (sel) {
        g.fillStyle(0xffc060, 0.16).fillRect(x - 2, y - 2, w + 4, ROW_H);
        g.fillStyle(0xf2c14e, 1).fillRect(x - 2, y - 2, 2, ROW_H - 1);
      }
    } else {
      // A hanger hook on the rail above every row.
      if (!row.header) {
        g.fillStyle(0xa8a4b8, 1).fillRect(x + 8, y - 3, 1, 2);
        g.fillStyle(0xa8a4b8, 1).fillRect(x + 3, y - 1, 11, 1);
      }
      if (sel) {
        g.fillStyle(0xffd090, 0.16).fillRect(x - 2, y - 2, w + 4, ROW_H);
        g.fillStyle(0xf2c14e, 1).fillRect(x - 2, y - 2, 2, ROW_H - 1);
      }
    }
    if (row.header) {
      const t = this.text(x + w / 2, y + 2, row.text, sel ? COLORS.gold : '#e8d4a8').setOrigin(0.5, 0);
      g.fillStyle(this.trader ? 0x5a3a22 : 0x3b4a8a, 1).fillRect(t.x - t.width / 2 - 6, y - 1, t.width + 12, 9);
      t.setDepth(1);
    } else {
      // A stripe in the item's rarity colour.
      if (row.rarity) g.fillStyle(RARITY[row.rarity].color, 0.9).fillRect(x + 1, y, 1, ROW_H - 4);
      if (row.icon) this.add2(this.add.image(x + 9, y + 4, row.icon));
      if (row.swatch !== undefined && row.swatch !== null) this.drawSwatch(x + 5, y, row.swatch);
      const name = this.text(x + 19, y + 2, row.text, sel ? COLORS.gold : COLORS.text);
      if (row.isNew) this.text(name.x + name.width + 5, y + 2, 'NEW!', '#ff7ab8');
      if (row.sub) this.text(x + 90, y + 2, row.newCount ? `${row.sub}  ${row.newCount} NEW` : row.sub, row.newCount ? '#ff7ab8' : COLORS.faint);
      this.drawTag(x + w - 2, y, row.right, row.rightColor, sel);
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

  // A paper tag on a string, right-aligned at (right, y): prices and states.
  drawTag(right, y, label, color, sel) {
    const g = this.g;
    if (label.startsWith('<')) { this.text(right, y + 2, label, color).setOrigin(1, 0); return; }
    const state = { [COLORS.green]: [0x8fd16a, '#16241a'], [COLORS.faint]: [0x5a5466, '#c8c4d4'], [COLORS.red]: [0xeadfc4, '#b8242e'], [COLORS.text]: [0xd8c8a0, '#3a2a1a'] }[color] || [0xeadfc4, this.ink(color)];
    const w = measureLine(label) + 9;
    const x = right - w;
    g.fillStyle(0xc8b48a, 0.8).fillRect(x - 5, y + 3, 5, 1);
    g.fillStyle(0x16141f, 1).fillRect(x - 1, y - 1, w + 2, 10);
    g.fillStyle(state[0], 1).fillRect(x, y, w, 8).fillRect(x + 1, y - 1, w - 2, 1);
    if (sel) g.fillStyle(0xffffff, 0.25).fillRect(x, y, w, 1);
    g.fillStyle(0x16141f, 1).fillRect(x + 2, y + 3, 1, 1);
    this.text(x + 5, y + 2, label, state[1], { shadow: null }).setDepth(1);
  }

  drawSwatch(x, y, color) {
    const g = this.g;
    // A little garment shape (a shirt) in the item's colour.
    const fill = (c, k) => {
      g.fillStyle(c, 1).fillRect(x, y + 1, 9, 3).fillRect(x + 2, y + 1, 5, 7);
      if (k !== undefined) g.fillStyle(0x16141f, 1).fillRect(x + 4, y + 1, 1, 1);
    };
    g.fillStyle(0x16141f, 1).fillRect(x - 1, y, 11, 5).fillRect(x + 1, y, 7, 9);
    if (color === 'rainbow') {
      [0xf0644b, 0xf2c14e, 0x8fd16a, 0x6fd6ff].forEach((c, k) => { g.fillStyle(c, 1).fillRect(x + (k < 2 ? 0 : 2), y + 1 + k * 2, k < 2 ? 9 : 5, 2); });
    } else fill(color, 0);
  }

  drawDetail(row) {
    const paper = this.trader;
    const x = this.detX, w = this.detW, cx = x + w / 2;
    let y = this.detY + (paper ? 10 : 6);
    const col = (c) => (paper ? this.ink(c) : c);
    const line = (str, color = COLORS.text) => {
      const t = this.text(cx, y, wrap(str, w - 16), col(color), { align: 'center', shadow: paper ? null : '#16141f' }).setOrigin(0.5, 0);
      y += t.height + 4;
      return t;
    };
    // Buttons as little painted boards.
    const buttons = (...list) => {
      const widths = list.map(([label]) => measureLine(label) + 12);
      let bx = Math.round(cx - (widths.reduce((a, b) => a + b, 0) + (list.length - 1) * 6) / 2);
      list.forEach(([label, color, fn], k) => {
        const fillC = { [GEM_TEXT]: 0x2f6aa8, [COLORS.green]: 0x3a7a2a, [COLORS.red]: 0x8a2a2a }[color] || 0x5a3a22;
        this.g.fillStyle(0x16141f, 1).fillRect(bx - 1, y - 4, widths[k] + 2, 13);
        this.g.fillStyle(fillC, 1).fillRect(bx, y - 3, widths[k], 11);
        this.g.fillStyle(0xffffff, 0.3).fillRect(bx, y - 3, widths[k], 1);
        const t = this.text(bx + 6, y, label, '#f4efe4');
        const zone = this.add2(this.add.zone(bx, y - 4, widths[k], 13).setOrigin(0, 0).setInteractive({ useHandCursor: true }));
        zone.on('pointerdown', fn);
        t.setDepth(1);
        bx += widths[k] + 6;
      });
      y += 16;
    };
    const button = (label, color, fn) => buttons([label, color, fn]);
    if (!row) return;
    if (row.kind === 'gear' || row.kind === 'perk') {
      // The item in a little round plate, like the dare emblems.
      this.g.fillStyle(0x2a2236, 1).fillCircle(cx, y + 11, 14);
      this.g.lineStyle(1, 0xc8a050, 1).strokeCircle(cx, y + 11, 14);
      this.add2(this.add.image(cx, y + 11, row.item.icon).setScale(2));
      y += 30;
      line(row.kind === 'gear' ? `${row.item.name}  X${this.prog.owned(row.item.id)}` : row.item.name, COLORS.gold);
      line(row.item.text, COLORS.dim);
      const locked = !this.prog.owned(row.item.id) && !this.prog.hasPerk(row.item.id) && this.prog.lockedReason(row.item);
      if (locked) {
        line(`LOCKED: ${locked}`, COLORS.red);
        if (row.kind === 'gear') { this.drawPackSlots(y); y += 20; }
      } else if (row.kind === 'gear') {
        buttons(
          [`BUY ◆${row.item.price}`, this.prog.gems >= row.item.price ? GEM_TEXT : COLORS.red, () => this.buyGear(row.item)],
          [this.prog.isPacked(row.item.id) ? 'UNPACK' : 'PACK', COLORS.green, () => this.togglePack(row.item)],
        );
        this.drawPackSlots(y);
        y += 20;
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
      this.drawStage(x + (paper ? 8 : 12), y, w - (paper ? 16 : 24), look, row.slot);
      y += this.stage.h + (paper ? 4 : 12);
      const rare = (r) => toCss(paper ? darken(RARITY[r].color, 0.6) : RARITY[r].color);
      if (row.kind === 'style') {
        this.prog.markSeen(row.item.id);
        line(row.item.name, COLORS.gold);
        line(RARITY[row.rarity].name, rare(row.rarity));
        const st = row.status;
        if (this.prog.data.look[row.slot] === row.item.id) line('WEARING', COLORS.green);
        else if (st.state === 'owned') button('WEAR', COLORS.green, () => this.styleAction(row.slot, row.item));
        else if (st.state === 'locked') line(st.reason, COLORS.red);
        else if (this.mode === 'trader') button(`BUY  ◆${st.price}`, st.state === 'buy' ? GEM_TEXT : COLORS.red, () => this.styleAction(row.slot, row.item));
        else line(`◆${st.price} AT THE BASE CAMP TRADER`, GEM_TEXT);
      } else if (row.kind === 'wardrobe') {
        line(row.item.name, rare(row.rarity));
        const total = Object.values(COSMETICS).flat();
        line(`OWNED ${total.filter((c) => this.prog.isUnlocked(c.id)).length}/${total.length}`, COLORS.dim);
      } else line('PICK A CLOTHING TYPE', COLORS.dim);
    }
    if (this.msgText && this.time.now - this.msgT < 2600) {
      this.text(cx, this.detY + this.detH - 13, this.msgText, col(this.msgColor), { shadow: paper ? null : '#16141f' }).setOrigin(0.5, 0);
    }
    if (this.tabName === 'WARDROBE' || (this.tabName === 'STYLE' && row.header)) this.drawGemCollection();
  }

  // The climber on a little stage: at the stall a framed picture, in the tent
  // a tall standing mirror with a light that sweeps across the glass (update()).
  // Trails and hit effects play on it live.
  drawStage(x, y, w, look, slot) {
    const h = this.detH > 190 ? 122 : 96;
    const scale = h > 100 ? 1.5 : 1.25;
    const g = this.g;
    const sky = this.trader ? [0x2a4a7a, 0x3a5f92, 0x5079aa, 0x6c95c2, 0x8fb4d8] : [0x3a4a64, 0x4a5c78, 0x5a6e8a, 0x6c829c, 0x7e96ae];
    const glass = () => sky.forEach((c, i) => { g.fillStyle(c, 1); g.fillRect(x, y + Math.round((i * h) / sky.length), w, Math.ceil(h / sky.length)); });
    if (this.trader) {
      glass();
      g.fillStyle(0xdfe6f2, 0.55);
      [[0.2, 0.22, 14], [0.7, 0.14, 18], [0.85, 0.4, 10]].forEach(([fx, fy, r]) => { g.fillEllipse(x + w * fx, y + h * fy, r * 2, r * 0.8); });
      g.fillStyle(0x7f8ca6, 1);
      for (let i = 0; i < w; i++) {
        const top = y + h - 26 - Math.round(Math.abs(Math.sin(i / 17)) * 14 + Math.sin(i / 5) * 2);
        g.fillRect(x + i, top, 1, y + h - 10 - top);
      }
      g.fillStyle(0x4f8a3c, 1); g.fillRect(x, y + h - 10, w, 10);
      g.fillStyle(0x8fc85a, 1); g.fillRect(x, y + h - 10, w, 2);
      // A picture frame.
      g.fillStyle(0x6a4428, 1).fillRect(x - 3, y - 3, w + 6, 3).fillRect(x - 3, y + h, w + 6, 3).fillRect(x - 3, y, 3, h).fillRect(x + w, y, 3, h);
      g.fillStyle(0xc8a050, 1).fillRect(x - 3, y - 3, w + 6, 1);
    } else {
      // A heavy wooden frame with an arched top, and two feet.
      const f = 0x6a4428, fl = 0x8a5a32, fd = 0x3a2618;
      g.fillStyle(fd, 1).fillRect(x - 5, y - 4, w + 10, h + 9);
      g.fillStyle(f, 1).fillRect(x - 4, y - 3, 4, h + 6).fillRect(x + w, y - 3, 4, h + 6).fillRect(x - 4, y + h, w + 8, 3);
      g.fillStyle(fl, 1).fillRect(x - 4, y - 3, 1, h + 6);
      g.fillStyle(f, 1).fillRect(x - 4, y - 8, w + 8, 6);
      g.fillStyle(fd, 1).fillRect(x + w / 2 - 14, y - 12, 28, 5);
      g.fillStyle(f, 1).fillRect(x + w / 2 - 13, y - 11, 26, 4);
      g.fillStyle(0xc8a050, 1).fillRect(x + w / 2 - 2, y - 11, 4, 3);
      g.fillStyle(fl, 1).fillRect(x - 4, y - 8, w + 8, 1);
      g.fillStyle(fd, 1).fillRect(x + 4, y + h + 3, 6, 6).fillRect(x + w - 10, y + h + 3, 6, 6);
      g.fillStyle(f, 1).fillRect(x + 5, y + h + 3, 4, 5).fillRect(x + w - 9, y + h + 3, 4, 5);
      // The glass: cool blue, the tent floor reflected along the bottom.
      glass();
      g.fillStyle(0x6a5a44, 1).fillRect(x, y + h - 14, w, 14);
      g.fillStyle(0x8a7458, 1).fillRect(x, y + h - 14, w, 1);
      g.fillStyle(0xffffff, 0.08).fillRect(x + 3, y + 3, 2, h - 20).fillRect(x + 6, y + 3, 1, h - 30);
    }
    buildPreviewTexture(this, 'climber_preview', look);
    const baseY = y + h - (this.trader ? 9 : 12);
    const img = this.add2(this.add.image(x + w / 2, baseY, 'climber_preview', 'look').setOrigin(0.5, 1).setScale(scale));
    this.fx.setTrail(findCosmetic('trail', look.trail || 'trail-none'));
    this.fx.setHit(findCosmetic('hit', look.hit || 'hit-ring'));
    const mode = slot === 'trail' && look.trail !== 'trail-none' ? 'trail' : slot === 'hit' ? 'hit' : 'idle';
    this.stage = { x, y, w, h, img, cx: x + w / 2, baseY, scale, mode, mirror: !this.trader };
    if (this.pendingCelebrate) {
      this.pendingCelebrate = false;
      this.fx.confettiBurst(x + w / 2, baseY - 60, 36);
      this.fx.sparkle(x + w / 2, baseY - 40, 14);
    }
  }

  celebrateBuy() { this.pendingCelebrate = true; }

  update(time, delta) {
    // The lanterns flicker.
    if (this.lamps) this.lamps.forEach((l, i) => l.setAlpha(0.32 + 0.06 * Math.sin(time / (90 + i * 23)) + 0.04 * Math.sin(time / 37 + i)));
    const st = this.stage;
    if (!st || !st.img.active) return;
    this.stageT += delta;
    const t = this.stageT, img = st.img;
    // A light that sweeps across the mirror glass now and then.
    const gl = this.glint;
    gl.clear();
    if (st.mirror) {
      const p = (t % 3600) / 1200;
      if (p < 1) {
        const sx = st.x - 20 + p * (st.w + 40);
        for (let k = 0; k < st.h; k++) {
          const xx = Math.round(sx + k * 0.45);
          if (xx < st.x || xx + 4 > st.x + st.w) continue;
          gl.fillStyle(0xffffff, 0.12).fillRect(xx, st.y + k, 4, 1);
          if (xx + 7 < st.x + st.w) gl.fillStyle(0xffffff, 0.06).fillRect(xx + 6, st.y + k, 2, 1);
        }
      }
    }
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
    } else if (st.mirror) {
      // In the mirror the climber turns this way and that, checking the fit.
      const phase = Math.floor(t / 1100) % 4;
      img.setFrame(['look', 'stand', 'look2', 'stand'][phase]);
    } else {
      img.setFrame(Math.floor(t / 1300) % 2 ? 'look2' : 'look');
    }
  }

  // The pack: three little cubbies with what is packed in them.
  drawPackSlots(y) {
    const cx = this.detX + this.detW / 2;
    const packed = this.prog.data.packed;
    const g = this.g;
    for (let i = 0; i < PACK_SLOTS; i++) {
      const sx = Math.round(cx - (PACK_SLOTS * 18) / 2 + i * 18);
      g.fillStyle(0x16141f, 1).fillRect(sx - 1, y - 1, 17, 17);
      g.fillStyle(0xe07a2e, 1).fillRect(sx, y, 15, 15);
      g.fillStyle(0xa8521e, 1).fillRect(sx, y, 15, 3);
      g.fillStyle(0x3a2618, 1).fillRect(sx + 2, y + 4, 11, 9);
      if (packed[i]) this.add2(this.add.image(sx + 7.5, y + 8.5, GEAR_BY_ID[packed[i]].icon));
    }
  }

  // Regional gems found so far (they unlock some items at the trader).
  drawGemCollection() {
    // Each count sits under its stone, so all of them fit in the column.
    const step = Math.min(24, Math.floor((this.detW - 10) / GEM_ORDER.length));
    const y = this.detY + this.detH - 28;
    const x0 = this.detX + Math.round(this.detW / 2 - (GEM_ORDER.length * step) / 2 + step / 2);
    GEM_ORDER.forEach((id, i) => {
      const n = this.prog.found(id);
      this.add2(this.add.image(x0 + i * step, y + 4, `gem_${id}`)).setAlpha(n ? 1 : 0.25);
      const c = this.trader ? toCss(darken(GEMS[id].color, 0.6)) : toCss(GEMS[id].color);
      this.text(x0 + i * step, y + 11, `${n}`, n ? c : this.trader ? '#8a7a64' : COLORS.faint, { shadow: this.trader ? null : '#16141f' }).setOrigin(0.5, 0);
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
