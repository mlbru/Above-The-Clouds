import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, IS_PORTRAIT, IS_TOUCH } from '../config/gameConfig.js';
import { PixelText, COLORS, drawFrame } from '../ui/PixelText.js';
import { measureLine } from '../utils/pixelFont.js';
import { PixelGrid, makeCanvas } from '../utils/pixelGrid.js';
import { darken, lighten, lerpColor } from '../utils/color.js';
import { hashInts } from '../utils/seededRandom.js';
import { GROUPS, boonCard, completesSynergy, SYNERGIES } from '../data/boons.js';
import { buildBoonTextures, boonIconKey } from '../render/boonArt.js';
import { Audio } from '../systems/AudioSystem.js';

const GIFT = '#ffe08a', PRICE = '#ff8a6a', CARVE = '#efe8f8', TEAL = '#7cf0d8';
const SOCKETS = 3;
let texUid = 0;

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

// A standing stone, carved and weathered, painted into its own texture.
function paintTablet(w, h, { color, legend, seed }) {
  const g = new PixelGrid(w, h);
  const R = 11;
  const inside = (x, y) => {
    if (y < R) {
      const dx = x < R ? R - x - 0.5 : x >= w - R ? x - (w - R) + 0.5 : 0;
      const dy = R - y - 0.5;
      if (dx * dx + dy * dy > R * R) return false;
    }
    return true;
  };
  const shades = legend ? [0x6a5a52, 0x72604f, 0x7a6a58, 0x665448] : [0x5a546e, 0x625c76, 0x6a647e, 0x565068];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      const n = hashInts(seed, x >> 1, y >> 1) % 100;
      let c = shades[n % 4];
      // A fine grain on top of the blotches.
      if (hashInts(seed + 7, x, y) % 9 === 0) c = darken(c, 0.88);
      // Light from the top left, the stone thickening into shadow at the bottom.
      c = lerpColor(c, darken(c, 0.62), Math.max(0, (y - h * 0.55) / (h * 0.45)) * 0.6);
      g.set(x, y, c);
    }
  }
  // Rim: a bright edge on the top and left, a dark one on the right and bottom.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      const up = !inside(x, y - 1), left = !inside(x - 1, y), right = !inside(x + 1, y) || x === w - 1, down = y === h - 1;
      if (up || left) g.set(x, y, legend ? 0xffe08a : 0x9a94b0);
      else if (right || down) g.set(x, y, legend ? 0x8a5a1a : 0x2e2a3c);
    }
  }
  // The engraved border: a cut line with its lit lower edge.
  const m = 4;
  for (let x = m + 3; x < w - m - 3; x++) { g.set(x, h - m - 1, 0x2a2638); g.set(x, h - m, 0x8a84a0); }
  for (let y = R + 2; y < h - m; y++) { g.set(m, y, 0x2a2638); g.set(m + 1, y, 0x8a84a0); g.set(w - m - 1, y, 0x2a2638); g.set(w - m, y, 0x8a84a0); }
  // Cracks that wander in from the edges.
  for (let k = 0; k < 3; k++) {
    let x = (hashInts(seed, k, 1) % (w - 20)) + 10, y = k === 0 ? 2 : h - 3;
    const dy = k === 0 ? 1 : -1;
    for (let s = 0; s < 14 + (hashInts(seed, k, 2) % 10); s++) {
      if (inside(x, y)) { g.set(x, y, 0x26222f); if (inside(x + 1, y)) g.set(x + 1, y, darken(g.get(x + 1, y) || 0x5a546e, 0.85)); }
      y += dy; x += (hashInts(seed, k, s) % 3) - 1;
    }
  }
  // Moss creeping up from the ground, or gold veins on a legendary stone.
  if (legend) {
    for (let k = 0; k < 4; k++) {
      let x = (hashInts(seed, k, 9) % (w - 16)) + 8, y = h - 6;
      for (let s = 0; s < 30; s++) {
        if (inside(x, y)) g.set(x, y, s % 5 === 0 ? 0xfff1a0 : 0xd89a2a);
        y -= 1; x += (hashInts(seed, k, s + 50) % 3) - 1;
        if (y < 6) break;
      }
    }
  } else {
    for (let x = 0; x < w; x++) {
      const top = h - 1 - (hashInts(seed, x, 77) % 7) - (x % 11 < 4 ? 3 : 0);
      for (let y = top; y < h - 1; y++) if (inside(x, y) && hashInts(seed, x, y, 3) % 3) g.set(x, y, y > h - 4 ? 0x3a5a2a : 0x5a8a3a);
    }
  }
  // The emblem: a round recess with a ring in the gift's colour.
  const cx = w / 2, cy = 27;
  g.ellipse(cx, cy, 16.5, 16.5, 0x8a84a0);
  g.ellipse(cx, cy + 0.6, 16, 16, 0x1a1626);
  g.ellipse(cx, cy, 14, 14, darken(color, 0.45));
  g.ellipse(cx, cy, 13, 13, 0x14111e);
  g.ellipse(cx, cy, 11.5, 11.5, 0x1c1828);
  // A dark plate for the group name along the foot.
  for (let x = m + 3; x < w - m - 3; x++) for (let y = h - 17; y < h - 8; y++) g.set(x, y, 0x1a1626);
  for (let x = m + 3; x < w - m - 3; x++) g.set(x, h - 17, darken(color, 0.6));
  return g;
}

// The cairn: three standing stones rise out of the mist, each a gift and its
// price. Take one and the others crumble; walk on and they sink again. One
// reroll per shrine for gems. Launched over the climb, which waits paused.
// data: { returnTo, shrine: { index, biomeName }, offer, held, rerollPrice, canReroll, wallet, firstTime }
export class ShrineScene extends Phaser.Scene {
  constructor() { super('Shrine'); }

  init(data) { this.d = data; }

  create() {
    buildBoonTextures(this);
    this.climb = this.scene.get(this.d.returnTo || 'Climb');
    this.t = 0;
    this.busy = true;
    this.index = 1;
    this.offer = this.d.offer.slice();
    this.held = this.d.held.slice();
    this.canReroll = !!this.d.canReroll;
    this.wallet = this.d.wallet;
    this.walkWarned = false;
    this.texKeys = [];
    this.trail = [];
    this.events.once('shutdown', () => this.cleanup());

    const W = GAME_WIDTH, H = GAME_HEIGHT;
    this.tw = IS_PORTRAIT ? 92 : 112;
    this.th = IS_PORTRAIT ? 168 : Math.max(128, Math.min(142, H - 104));
    this.gap = IS_PORTRAIT ? 6 : 12;
    const top = IS_PORTRAIT ? Math.max(30, Math.floor((H - 330) / 2)) : Math.max(2, Math.floor((H - (this.th + 104)) / 2));
    this.top = top;
    this.rowY = top + 40 + this.th / 2;
    this.maxTh = this.th;

    // Dusk over the cairn: a deep sky in bands, a shaft of pale light from above,
    // mist along the ground and a ring of standing stones on the skyline.
    this.root = this.add.container(0, 0).setAlpha(0);
    const sky = this.add.graphics();
    const bands = 24;
    const ridgeY = this.rowY + this.th / 2 - 22;
    // Solid colours only: the game dithers anything see-through, so the light
    // shaft and the mist are mixed into the sky's own bands.
    for (let i = 0; i < bands; i++) {
      const y0 = Math.floor((i * H) / bands), y1 = Math.floor(((i + 1) * H) / bands);
      const base = lerpColor(0x05040f, 0x24183a, i / (bands - 1));
      sky.fillStyle(base, 1).fillRect(0, y0, W, y1 - y0);
      const f = Math.max(0, 1 - y0 / (ridgeY + 10));
      const half = 20 + (y0 / H) * 70;
      [[1, 0.1], [0.7, 0.17], [0.42, 0.25]].forEach(([wk, k]) => {
        sky.fillStyle(lerpColor(base, 0x9fc8ff, k * f + 0.03), 1).fillRect(Math.round(W / 2 - half * wk), y0, Math.round(half * wk * 2), y1 - y0);
      });
    }
    // A band of mist lying along the skyline.
    for (let r = 0; r < 8; r++) {
      const y = ridgeY - 4 + r * 3;
      sky.fillStyle(lerpColor(0x1a1430, 0x6a5aa8, 0.25 - Math.abs(r - 4) * 0.05), 1).fillRect(0, y, W, 3);
    }
    sky.fillStyle(0x0c0a18, 1);
    for (let x = 0; x < W; x += 2) sky.fillRect(x, ridgeY - Math.round(6 + Math.sin(x / 37) * 4 + Math.sin(x / 11) * 1.5), 2, H);
    for (let k = 0; k < 9; k++) {
      const x = Math.round(((k + 0.5) / 9) * W + Math.sin(k * 2.3) * 14), sh = 10 + (k * 7) % 9;
      sky.fillStyle(0x0c0a18, 1).fillRect(x - 3, ridgeY - 6 - sh, 6, sh + 6).fillRect(x - 2, ridgeY - 8 - sh, 4, 2);
      sky.fillStyle(0x2a2244, 1).fillRect(x - 3, ridgeY - 6 - sh, 1, sh);
    }
    // A flash of light down the shaft when a pact is sealed.
    this.shaft = this.add.graphics().setBlendMode('ADD').setAlpha(0);
    this.shaft.fillStyle(0x9fc8ff, 1).fillRect(Math.round(W / 2 - 40), 0, 80, ridgeY);
    this.motes = Array.from({ length: IS_PORTRAIT ? 26 : 36 }, (_, i) => ({ x: (i * 97.3) % W, y: (i * 53.1) % H, v: 4 + (i % 5) * 2, p: i * 1.7, c: i % 3 === 0 ? 0xffe08a : 0x9fd8ff }));
    this.moteG = this.add.graphics();
    this.root.add([sky, this.shaft, this.moteG]);
    this.add.zone(0, 0, W, H).setOrigin(0, 0).setInteractive();

    // Title: carved runes on both sides of THE CAIRN.
    this.title = new PixelText(this, W / 2, top + 6, 'THE CAIRN', { color: COLORS.gold }).setOrigin(0.5, 0).setScale(2);
    const sub = `SHRINE ${this.d.shrine.index + 1} OF ${SOCKETS}  •  ${this.d.shrine.biomeName}`;
    this.sub = new PixelText(this, W / 2, top + 24, sub, { color: COLORS.dim }).setOrigin(0.5, 0);
    const tw = this.title.width * 2;
    this.runes = [-1, 1].map((s) => this.add.image(W / 2 + s * (tw / 2 + 12), top + 12, 'shrine_rune').setTint(0x9fd8ff).setScale(1));
    this.runeGlow = this.runes.map((r) => this.add.image(r.x, r.y, 'glow').setBlendMode('ADD').setTint(0x9fd8ff).setScale(0.4).setAlpha(0.4));
    this.root.add([this.title, this.sub, ...this.runes, ...this.runeGlow]);

    // Under the stones: the whisper (what the stone means), then your gifts and the buttons.
    this.whisper = new PixelText(this, W / 2, this.rowY + this.th / 2 + 8, '', { color: '#b8b0d8' }).setOrigin(0.5, 0);
    this.stripY = this.rowY + this.th / 2 + 22;
    this.stripG = this.add.graphics();
    this.sockets = [];
    this.root.add([this.whisper, this.stripG]);
    this.buildStrip();
    this.footer = new PixelText(this, W / 2, H - 10, IS_TOUCH ? 'TAP A STONE, TAP AGAIN TO TAKE IT' : '← → CHOOSE   SPACE TAKE   R REROLL   X WALK ON', { color: COLORS.faint }).setOrigin(0.5, 0);
    this.root.add(this.footer);

    this.tablets = [];
    this.tweens.add({ targets: this.root, alpha: 1, duration: 320 });
    Audio.play('shrineopen');
    if (this.d.firstTime) this.say('BRAM ONCE TOLD YOU: TAKE A GIFT. EVERY GIFT HAS A PRICE.', true);
    this.time.delayedCall(260, () => this.raise());

    this.input.keyboard.on('keydown', this.onKey, this);
    this.events.once('shutdown', () => this.input.keyboard.off('keydown', this.onKey, this));
  }

  // ---------------------------------------------------------------- the strip
  buildStrip() {
    const W = GAME_WIDTH, y = this.stripY, g = this.stripG;
    g.clear();
    this.sockets.forEach((s) => s.objs.forEach((o) => o.destroy()));
    // Your gifts: one socket per shrine of the run, filled in order.
    const sx = IS_PORTRAIT ? 10 : 12;
    drawFrame(g, sx - 4, y - 2, SOCKETS * 20 + 52, 22, { accent: 0x6a5aa8, alpha: 0.9 });
    const label = new PixelText(this, sx + 2, y + 5, 'GIFTS', { color: COLORS.faint });
    const gifts = this.held.filter((id) => boonCard(id));
    this.sockets = Array.from({ length: Math.max(SOCKETS, gifts.length) }, (_, i) => {
      const x = sx + 40 + i * 20, cy = y + 9;
      g.fillStyle(0x0c0a14, 1).fillRect(x - 8, cy - 8, 16, 16);
      g.fillStyle(0x3a3456, 1).fillRect(x - 8, cy - 8, 16, 1).fillRect(x - 8, cy - 8, 1, 16);
      const id = gifts[i];
      const objs = [];
      if (id) objs.push(this.add.image(x, cy, boonIconKey(id)));
      else objs.push(this.add.image(x, cy, 'shrine_rune').setTint(0x4a4270).setAlpha(0.7));
      this.root.add(objs);
      return { x, y: cy, objs, filled: !!id };
    });
    this.root.add(label);
    this.sockets.label = label;
    // Reroll (right) and walk on.
    const bw = IS_PORTRAIT ? 92 : 112;
    const bx = W - bw - (IS_PORTRAIT ? 8 : 12);
    this.rerollBox = { x: bx, y: y - 2, w: bw, h: 22 };
    if (!this.rerollText) {
      this.rerollText = new PixelText(this, 0, 0, '', { color: COLORS.text }).setOrigin(0.5, 0);
      this.rerollGem = this.add.image(0, 0, 'gem_diamond');
      this.rerollZone = this.add.zone(0, 0, bw, 22).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      this.rerollZone.on('pointerdown', () => this.reroll());
      this.walkText = new PixelText(this, 0, 0, IS_TOUCH ? 'WALK ON' : '[X] WALK ON', { color: COLORS.faint }).setOrigin(0.5, 0);
      this.walkZone = this.add.zone(0, 0, 70, 14).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
      this.walkZone.on('pointerdown', () => this.walkOn());
      this.root.add([this.rerollText, this.rerollGem, this.walkText]);
    }
    this.drawReroll();
    const wx = IS_PORTRAIT ? W / 2 + 6 : W / 2;
    this.walkText.setPosition(wx, y + 5);
    this.walkZone.setPosition(wx, y + 2);
  }

  drawReroll() {
    const { x, y, w, h } = this.rerollBox;
    const can = this.canReroll && this.wallet >= this.d.rerollPrice;
    drawFrame(this.stripG, x, y, w, h, { accent: can ? 0x9fe8ff : 0x3a3456, glow: can, alpha: 0.95 });
    const label = !this.canReroll ? 'STONES CAST' : `CAST ${this.d.rerollPrice}`;
    this.rerollText.setText(IS_TOUCH || !this.canReroll ? label : `[R] ${label}`).setColor(can ? '#9fe8ff' : COLORS.faint);
    this.rerollText.setPosition(x + w / 2 - (this.canReroll ? 6 : 0), y + 8);
    this.rerollGem.setPosition(x + w / 2 + this.rerollText.width / 2 + 2, y + 11).setVisible(this.canReroll).setAlpha(can ? 1 : 0.4);
    this.rerollZone.setPosition(x, y);
  }

  // ---------------------------------------------------------------- the stones
  raise() {
    this.busy = true;
    const W = GAME_WIDTH, n = this.offer.length;
    this.th = Math.min(this.maxTh, Math.max(112, ...this.offer.map((id) => this.tabletHeight(id))));
    const rowW = n * this.tw + (n - 1) * this.gap;
    this.tablets.forEach((t) => t.c.destroy());
    this.tablets = this.offer.map((id, i) => this.makeTablet(id, i, (W - rowW) / 2 + i * (this.tw + this.gap) + this.tw / 2, this.rowY));
    Audio.play('stonerise');
    this.tablets.forEach((t, i) => {
      t.c.setY(t.baseY + 70).setAlpha(0);
      this.tweens.add({
        targets: t.c, y: t.baseY, alpha: 1, delay: i * 140, duration: 520, ease: 'Back.easeOut',
        onStart: () => this.dust(t.baseX, this.rowY + this.th / 2, 10),
        onComplete: () => { if (i === n - 1) { this.busy = false; this.select(Math.min(this.index, n - 1), true); } },
      });
    });
    this.cameras.main.shake(260, 0.003);
  }

  // How tall a stone must be to hold its carving.
  tabletHeight(id) {
    const card = boonCard(id), tw = this.tw - 16;
    const lines = (t, w) => wrap(t, w).split('\n').length;
    return 48 + lines(card.name, tw) * 8 + 5 + lines(card.gift, tw - 8) * 8 + 5 + lines(card.price, tw - 8) * 8 + 26;
  }

  makeTablet(id, i, x, y) {
    const card = boonCard(id);
    const legend = card.group === 'legendary';
    const group = GROUPS[card.group];
    const w = this.tw, h = this.th, x0 = -w / 2, y0 = -h / 2;
    const key = `shrine_tab_${texUid++}`;
    const grid = paintTablet(w, h, { color: group.color, legend, seed: hashInts(texUid, i, id.length) });
    const cv = makeCanvas(w, h);
    grid.drawTo(cv.getContext('2d'));
    this.textures.addCanvas(key, cv);
    this.texKeys.push(key);
    const c = this.add.container(x, y);
    const back = this.add.image(0, 0, 'glow').setBlendMode('ADD').setTint(group.color).setScale(w / 26, h / 30).setAlpha(0);
    const shadow = this.add.rectangle(3, 4, w, h, 0x000000, 0.4);
    const img = this.add.image(0, 0, key);
    const ring = this.add.image(0, y0 + 27, 'glow').setBlendMode('ADD').setTint(group.color).setScale(0.7).setAlpha(0.35);
    const icon = this.add.image(0, y0 + 27, boonIconKey(id)).setScale(2);
    const tw = w - 16;
    let ty = y0 + 48;
    const name = new PixelText(this, 0, ty, wrap(card.name, tw), { color: legend ? '#fff1a0' : CARVE, align: 'center' }).setOrigin(0.5, 0);
    ty += name.height + 5;
    const marks = this.add.graphics();
    const gift = new PixelText(this, x0 + 14, ty, wrap(card.gift, tw - 8), { color: GIFT });
    marks.fillStyle(0xffd24a, 1).fillRect(x0 + 8, ty + 3, 3, 1).fillRect(x0 + 9, ty + 2, 1, 1);
    ty += gift.height + 5;
    marks.fillStyle(0x6a5a8a, 1).fillRect(x0 + 9, ty - 3, w - 18, 1);
    const price = new PixelText(this, x0 + 14, ty, wrap(card.price, tw - 8), { color: PRICE });
    marks.fillStyle(0xf0644b, 1).fillRect(x0 + 8, ty + 1, 3, 1).fillRect(x0 + 9, ty + 2, 1, 1);
    const groupText = new PixelText(this, 0, h / 2 - 15, group.label, { color: `#${group.color.toString(16).padStart(6, '0')}` }).setOrigin(0.5, 0);
    // Pairs: teal when this stone would complete a synergy with what you carry.
    const done = completesSynergy(id, this.held);
    const partner = !done && SYNERGIES.find((s) => s.pair.includes(id));
    let pairText = null;
    if (done) pairText = new PixelText(this, 0, y0 + 4, `★ ${done.name}`, { color: TEAL }).setOrigin(0.5, 0);
    const shimmer = this.add.graphics();
    const flash = this.add.rectangle(0, 0, w, h, 0xffffff, 1).setAlpha(0);
    const shade = this.add.rectangle(0, 0, w, h, 0x05040f, 0.5).setAlpha(0);
    c.add([back, shadow, img, ring, icon, name, marks, gift, price, groupText, shimmer, ...(pairText ? [pairText] : []), flash, shade]);
    c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on('pointerover', () => { if (!IS_TOUCH) this.select(i); });
    c.on('pointerdown', () => {
      if (this.busy) return;
      if (i !== this.index) { this.select(i); return; }
      this.choose();
    });
    this.root.add(c);
    const tilt = [-1.5, 1, -0.8][i % 3];
    c.setAngle(tilt);
    return { c, id, card, back, ring, icon, shimmer, flash, shade, legend, tilt, baseX: x, baseY: y, partner, done, group };
  }

  select(i, quiet = false) {
    if (!this.tablets.length || this.busy && !quiet) return;
    if (i !== this.index && !quiet) Audio.play('ui');
    this.index = i;
    this.tablets.forEach((k, j) => {
      const on = j === i;
      this.tweens.add({ targets: k.c, angle: on ? 0 : k.tilt, scale: on ? 1.05 : 0.98, duration: 200, ease: 'Back.easeOut' });
      this.tweens.add({ targets: k.back, alpha: on ? 0.28 : 0, duration: 200 });
      this.tweens.add({ targets: k.shade, alpha: on ? 0 : 0.35, duration: 200 });
      k.c.setDepth(on ? 5 : 1);
      if (on) this.root.bringToTop(k.c);
    });
    const k = this.tablets[i];
    if (!this.sayLock) {
      const pairLine = k.done ? `  •  COMPLETES ${k.done.name}: ${k.done.text}` : k.partner ? `  •  PAIRS WITH ${boonCard(k.partner.pair.find((p) => p !== k.id)).name}` : '';
      this.say(`"${k.card.bram}"${IS_PORTRAIT ? '' : pairLine}`);
    }
  }

  say(text, lock = false) {
    const maxW = GAME_WIDTH - 16;
    let t = text;
    while (measureLine(t) > maxW && t.length > 8) t = `${t.slice(0, -4)}...`;
    this.whisper.setText(t);
    if (lock) { this.sayLock = true; this.time.delayedCall(2600, () => { this.sayLock = false; if (this.tablets[this.index]) this.select(this.index, true); }); }
  }

  // ---------------------------------------------------------------- choosing
  choose() {
    if (this.busy) return;
    const k = this.tablets[this.index];
    if (!k) return;
    this.busy = true;
    Audio.play('pact');
    // The chosen stone flares; the others crumble into the mist.
    this.tweens.add({ targets: k.flash, alpha: { from: 0.9, to: 0 }, duration: 520 });
    this.tweens.add({ targets: k.c, scale: 1.12, angle: 0, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.shaft, alpha: { from: 0, to: 0.5 }, duration: 160, yoyo: true });
    this.tablets.forEach((o) => { if (o !== k) this.crumble(o); });
    this.cameras.main.shake(120, 0.004);
    this.time.delayedCall(420, () => this.fly(k));
  }

  crumble(o) {
    const { baseX, baseY } = o;
    Audio.play('stonecrumble');
    const cols = o.legend ? [0x7a6a58, 0x665448, 0xd89a2a] : [0x5a546e, 0x6a647e, 0x2e2a3c, 0x5a8a3a];
    for (let k = 0; k < 46; k++) {
      const px = baseX + (Math.random() - 0.5) * this.tw, py = baseY + (Math.random() - 0.5) * this.th;
      const s = 1 + Math.floor(Math.random() * 3);
      const p = this.add.rectangle(px, py, s, s, cols[k % cols.length]);
      this.root.add(p);
      this.tweens.add({ targets: p, y: py + 50 + Math.random() * 90, x: px + (Math.random() - 0.5) * 30, alpha: 0, angle: Math.random() * 360, delay: Math.random() * 120, duration: 520 + Math.random() * 380, ease: 'Quad.easeIn', onComplete: () => p.destroy() });
    }
    this.tweens.add({ targets: o.c, alpha: 0, y: baseY + 14, scaleY: 0.9, duration: 220, ease: 'Quad.easeIn' });
    this.dust(baseX, baseY + this.th / 2, 14);
  }

  // The emblem leaves the stone and settles in its socket in the strip.
  fly(k) {
    const socket = this.sockets.find((s) => !s.filled) || this.sockets[this.sockets.length - 1];
    const wx = k.c.x, wy = k.c.y + (-this.th / 2 + 27) * k.c.scaleY;
    k.icon.setVisible(false);
    const icon = this.add.image(wx, wy, boonIconKey(k.id)).setScale(2.4).setDepth(20);
    const glow = this.add.image(wx, wy, 'glow').setBlendMode('ADD').setTint(k.group.color).setScale(0.8).setAlpha(0.7).setDepth(19);
    this.flying = { icon, glow, color: k.group.color };
    this.tweens.add({ targets: k.c, alpha: 0.0, duration: 500, delay: 200 });
    const midY = Math.min(wy, socket.y) - 40;
    const path = { t: 0 };
    this.tweens.add({
      targets: path, t: 1, duration: 760, ease: 'Sine.easeInOut',
      onUpdate: () => {
        const t = path.t, u = 1 - t;
        const x = u * u * wx + 2 * u * t * ((wx + socket.x) / 2) + t * t * socket.x;
        const y = u * u * wy + 2 * u * t * midY + t * t * socket.y;
        icon.setPosition(x, y).setScale(2.4 - t * 1.4);
        glow.setPosition(x, y);
      },
      onComplete: () => this.seal(k, socket),
    });
  }

  seal(k, socket) {
    const { icon, glow } = this.flying;
    this.flying = null;
    glow.destroy();
    icon.setScale(1);
    socket.objs.forEach((o) => o.destroy());
    socket.objs = [icon];
    socket.filled = true;
    Audio.play('stamp');
    const ring = this.add.circle(socket.x, socket.y, 4, k.group.color, 0).setStrokeStyle(2, k.group.color, 1).setDepth(20);
    this.tweens.add({ targets: ring, radius: 22, alpha: 0, duration: 420, onComplete: () => ring.destroy() });
    this.tweens.add({ targets: icon, scale: { from: 1.8, to: 1 }, duration: 260, ease: 'Back.easeOut' });
    this.cameras.main.shake(90, 0.005);
    // PACT SEALED slams down in the middle.
    const W = GAME_WIDTH, cy = this.rowY - 16;
    const syn = completesSynergy(k.id, this.held);
    const big = new PixelText(this, W / 2, cy, 'PACT SEALED', { color: COLORS.gold }).setOrigin(0.5, 0.5).setScale(5).setAlpha(0).setDepth(30);
    const small = new PixelText(this, W / 2, cy + 18, syn ? `${k.card.name}  •  SYNERGY: ${syn.name}!` : k.card.name, { color: syn ? TEAL : CARVE }).setOrigin(0.5, 0.5).setAlpha(0).setDepth(30);
    this.tweens.add({ targets: big, scale: 2, alpha: 1, duration: 200, ease: 'Quad.easeIn', onComplete: () => { Audio.play('rockhit'); this.cameras.main.shake(110, 0.006); } });
    this.tweens.add({ targets: small, alpha: 1, delay: 220, duration: 200 });
    if (syn) this.time.delayedCall(260, () => Audio.play('streakmilestone'));
    this.time.delayedCall(syn ? 1500 : 1150, () => this.close(k.id));
  }

  // ---------------------------------------------------------------- reroll / walk on
  reroll() {
    if (this.busy) return;
    if (!this.canReroll || this.wallet < this.d.rerollPrice) {
      Audio.play('miss');
      this.tweens.add({ targets: this.rerollText, x: this.rerollText.x + 2, duration: 40, yoyo: true, repeat: 3 });
      this.say(!this.canReroll ? 'THE STONES HAVE BEEN CAST ONCE ALREADY.' : 'NOT ENOUGH GEMS TO CAST.', true);
      return;
    }
    const next = this.climb.shrineReroll();
    if (!next) return;
    this.busy = true;
    this.canReroll = false;
    this.wallet -= this.d.rerollPrice;
    this.drawReroll();
    // Gems arc from the button into the cairn, then the stones sink and new ones rise.
    const { x, y, w } = this.rerollBox;
    for (let k = 0; k < 6; k++) {
      const gem = this.add.image(x + w / 2, y + 10, 'gem_diamond').setDepth(20);
      const p = { t: 0 }, tx = GAME_WIDTH / 2 + (k - 2.5) * 6, ty = this.rowY + this.th / 2 - 4;
      this.tweens.add({
        targets: p, t: 1, delay: k * 50, duration: 420, ease: 'Sine.easeIn',
        onUpdate: () => { const t = p.t; gem.setPosition(x + w / 2 + (tx - x - w / 2) * t, y + 10 + (ty - y - 10) * t - Math.sin(t * Math.PI) * 50); },
        onComplete: () => { gem.destroy(); if (k === 0) Audio.play('gem', { value: 4 }); },
      });
    }
    this.time.delayedCall(420, () => {
      Audio.play('stonerise');
      this.tablets.forEach((t, i) => this.tweens.add({ targets: t.c, y: t.baseY + 80, alpha: 0, delay: i * 60, duration: 320, ease: 'Quad.easeIn' }));
      this.time.delayedCall(560, () => { this.offer = next; this.raise(); });
    });
  }

  walkOn() {
    if (this.busy) return;
    if (!this.walkWarned) {
      this.walkWarned = true;
      this.walkText.setText(IS_TOUCH ? 'TAP AGAIN: NO GIFT' : 'X AGAIN: NO GIFT').setColor(PRICE);
      this.say('WALK ON WITH NO GIFT? THE CAIRN WILL NOT ASK AGAIN.', true);
      return;
    }
    this.busy = true;
    Audio.play('stonerise');
    this.tablets.forEach((t, i) => this.tweens.add({ targets: t.c, y: t.baseY + 80, alpha: 0, delay: i * 60, duration: 320, ease: 'Quad.easeIn' }));
    this.time.delayedCall(500, () => this.close(null));
  }

  close(id) {
    this.tweens.add({
      targets: this.root, alpha: 0, duration: 260,
      onComplete: () => {
        this.scene.stop();
        this.scene.resume(this.d.returnTo || 'Climb');
        this.climb.shrinePicked(id);
      },
    });
  }

  // ---------------------------------------------------------------- life
  dust(x, y, n) {
    for (let k = 0; k < n; k++) {
      const p = this.add.rectangle(x + (Math.random() - 0.5) * this.tw, y, 2, 2, 0x8a84a0, 0.8);
      this.root.add(p);
      this.tweens.add({ targets: p, x: p.x + (Math.random() - 0.5) * 24, y: y - 4 - Math.random() * 14, alpha: 0, duration: 500 + Math.random() * 300, onComplete: () => p.destroy() });
    }
  }

  update(time, delta) {
    this.t += delta;
    const g = this.moteG;
    g.clear();
    const H = GAME_HEIGHT;
    for (const m of this.motes) {
      m.y -= (m.v * delta) / 1000;
      if (m.y < -2) { m.y = H + 2; m.x = Math.random() * GAME_WIDTH; }
      const a = 0.25 + 0.6 * Math.max(0, Math.sin(this.t / 400 + m.p));
      g.fillStyle(m.c, a).fillRect(Math.round(m.x + Math.sin(this.t / 900 + m.p) * 3), Math.round(m.y), 1, 1);
    }
    this.runes.forEach((r, i) => { const a = 0.6 + 0.4 * Math.sin(this.t / 500 + i * Math.PI); r.setAlpha(a); this.runeGlow[i].setAlpha(0.25 + 0.25 * a); });
    // The chosen stone hovers; its emblem breathes. Legendary stones shimmer.
    this.tablets.forEach((k, j) => {
      const on = j === this.index && !this.busy;
      if (on) k.c.y = k.baseY - 5 + Math.round(Math.sin(this.t / 320) * 1.5);
      else if (!this.busy && !this.tweens.isTweening(k.c)) k.c.y = k.baseY;
      k.ring.setAlpha((on ? 0.5 : 0.25) + 0.15 * Math.sin(this.t / 260 + j));
      k.icon.y = -this.th / 2 + 27 + (on ? Math.round(Math.sin(this.t / 260)) : 0);
      if (k.legend) {
        const s = k.shimmer;
        s.clear();
        const w = this.tw, h = this.th, x0 = -w / 2, y0 = -h / 2;
        const pos = ((this.t / 7) % (w + h + 40)) - 20;
        for (let y = 0; y < h; y += 1) {
          const x = pos - y * 0.6;
          if (x > 2 && x < w - 4) s.fillStyle(0xfff1a0, 0.22).fillRect(x0 + Math.round(x), y0 + y, 3, 1);
        }
        if (Math.random() < delta / 120) {
          const p = this.add.rectangle(k.c.x + (Math.random() - 0.5) * w, k.c.y + (Math.random() - 0.5) * h, 1, 1, 0xffe08a);
          this.root.add(p);
          this.tweens.add({ targets: p, y: p.y - 12, alpha: 0, duration: 700, onComplete: () => p.destroy() });
        }
      }
    });
    // Sparks trail behind the flying emblem.
    if (this.flying && Math.random() < 0.8) {
      const { icon, color } = this.flying;
      const p = this.add.rectangle(icon.x + (Math.random() - 0.5) * 6, icon.y + (Math.random() - 0.5) * 6, 2, 2, Math.random() < 0.5 ? color : 0xffffff).setDepth(18);
      this.tweens.add({ targets: p, alpha: 0, scale: 0.2, duration: 380, onComplete: () => p.destroy() });
    }
    // The next empty socket pulses.
    const next = this.sockets.find((s) => !s.filled);
    if (next) next.objs[0].setAlpha(0.45 + 0.4 * Math.sin(this.t / 300)).setTint(lighten(0x4a4270, 0.2 + 0.2 * Math.sin(this.t / 300)));
  }

  onKey(event) {
    if (event.repeat || this.busy) return;
    const n = this.tablets.length;
    switch (event.code) {
      case 'ArrowLeft': case 'KeyA': this.select((this.index - 1 + n) % n); break;
      case 'ArrowRight': case 'KeyD': this.select((this.index + 1) % n); break;
      case 'Space': case 'Enter': case 'ArrowUp': case 'KeyW': this.choose(); break;
      case 'KeyR': case 'ArrowDown': case 'KeyS': this.reroll(); break;
      case 'KeyX': case 'Escape': case 'Backspace': this.walkOn(); break;
      default: break;
    }
  }

  cleanup() {
    this.texKeys.forEach((k) => { if (this.textures.exists(k)) this.textures.remove(k); });
    this.texKeys = [];
  }
}

