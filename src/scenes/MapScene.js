import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, IS_PORTRAIT, IS_TOUCH } from '../config/gameConfig.js';
import { PixelText, COLORS, drawFrame } from '../ui/PixelText.js';
import { measureLine } from '../utils/pixelFont.js';
import { BIOMES, SEQUENCE } from '../data/biomes.js';
import { gemForBiome } from '../data/gems.js';
import { COSMETICS } from '../data/cosmetics.js';
import { STARS, starLabel } from '../data/mastery.js';
import { LIFT_BY_ID } from '../data/lifts.js';
import { Audio } from '../systems/AudioSystem.js';
import { lerpColor, bayer } from '../utils/color.js';

const short = (id) => BIOMES[id].name.replace(/^THE /, '');
// Bram's paper and inks (the same as on his dare cards).
const PAPER = 0xeadfc4, PAPER_DARK = 0xc8b48a, PAPER_EDGE = 0x8a7450;
const INK = 0x3a2a1a, INK_CSS = '#3a2a1a', INK_SOFT = '#6a5a44', PENCIL = 0x9a8a70;
const RED_INK = '#a8322a', GREEN_INK = '#3f7a2a', GOLD_INK = '#b07818', BLUE_INK = '#2f5f9a';
const TRAIL = 0xc8463b, MARKER = 0xf2d06a;

// What Bram says about the start of your next run.
const BRAM = {
  camp: 'STRAIGHT UP FROM CAMP, THEN. THE OLD WAY.',
  lift: (id) => `THE GONDOLA WAITS FOR YOU AT THE ${short(id)}. MIND THE GAP.`,
  locked: (after) => `MASTER THE ${short(after)} FIRST. THE LIFTMAN ONLY TAKES CLIMBERS HE KNOWS.`,
  unknown: 'NOBODY HAS DRAWN THAT PART YET. GO AND SEE FOR YOURSELF.',
  top: 'NO CABLE GOES THAT HIGH. THOSE STARS YOU EARN THE HARD WAY.',
  mastered: (id) => `YOU KNOW THE ${short(id)} LIKE YOUR OWN POCKET NOW.`,
  bought: 'ONE TICKET, PUNCHED AND READY. ENJOY THE VIEW.',
  poor: 'NOT ENOUGH GEMS FOR THAT ONE. THE LIFTMAN DOES NOT DO CREDIT.',
  hard: 'TICKETS ARE FOR NORMAL CLIMBS ONLY. THE MOUNTAIN SAID SO.',
  later: 'THE GONDOLA IS BOOKED FOR YOUR NEXT RUN.',
};

function wrap(text, maxW) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (measureLine(next) > maxW && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// A cheap repeatable hash for paper specks and ragged edges.
const rnd = (a, b = 0) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };

// Bram's trail map, pinned up by lamplight: the whole climb drawn as one
// peak in ink and watercolour, a red dotted trail with each biome's stone
// as a stop, its mastery stars beside it, and the lift ticket where the
// gondola can take you. A note card holds the details; Bram talks you
// through it. Launched over the title camp or base camp during a run
// (data: { returnTo, departed, mode }), which waits paused.
export class MapScene extends Phaser.Scene {
  constructor() { super('Map'); }

  init(data) {
    this.returnTo = data.returnTo || 'Menu';
    this.departed = !!data.departed;
    this.mode = data.mode || 'normal';
  }

  create() {
    this.prog = this.registry.get('progression');
    this.t = 0;
    this.objs = [];
    const top = IS_PORTRAIT ? 30 : 0;
    this.top = top;
    const foot = IS_TOUCH ? 6 : 16;
    // Landscape: the map on the left, the note and Bram on the right. Upright: stacked.
    if (IS_PORTRAIT) {
      this.paper = { x: 10, y: top + 26, w: GAME_WIDTH - 20, h: 250 };
      this.card = { x: 18, y: this.paper.y + this.paper.h + 8, w: GAME_WIDTH - 36, h: 150 };
    } else {
      this.paper = { x: 8, y: top + 6, w: 276, h: GAME_HEIGHT - top - 6 - foot };
      this.card = { x: 296, y: top + 26, w: GAME_WIDTH - 296 - 10, h: GAME_HEIGHT - top - 26 - foot - 52 };
    }
    this.bramY = this.card.y + this.card.h + 8;
    // Inside the paper: the peak on the left, the names in a column on the right.
    const P = this.paper;
    const labelW = 118;
    this.labelX = P.x + P.w - labelW - 6;
    this.m = { x: P.x + 12, y: P.y + 36, w: this.labelX - P.x - 24, h: P.h - 36 - 16 };
    this.bandH = this.m.h / SEQUENCE.length;

    // Night over the camp, firelight from below (as with Bram's dares).
    const sky = this.add.graphics();
    sky.fillStyle(0x07060e, 0.9).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    for (let i = 0; i < 9; i++) sky.fillStyle(0x0c0a1a, 0.25).fillRect(0, (i * GAME_HEIGHT) / 9, GAME_WIDTH, GAME_HEIGHT / 9 - (i % 2));
    this.stars = Array.from({ length: 30 }, (_, i) => ({ x: (i * 137.5) % GAME_WIDTH, y: (i * 61.7) % (GAME_HEIGHT * 0.6), p: i * 0.7 }));
    this.starG = this.add.graphics();
    this.fire = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT + 10, 'glow').setBlendMode('ADD').setTint(0xff8a3c).setScale(5, 2.2).setAlpha(0.3);
    this.add.zone(0, 0, GAME_WIDTH, GAME_HEIGHT).setOrigin(0, 0).setInteractive();

    // The map itself is drawn once; picks and the cable go on top.
    this.mapG = this.add.graphics();
    this.drawPaper();
    this.drawPeak();
    this.lamp = this.add.image(P.x + 40, P.y + 30, 'glow').setBlendMode('ADD').setTint(0xffb050).setScale(4.5).setAlpha(0.14);
    this.cable = this.add.graphics().setDepth(2);
    this.ring = this.add.graphics().setDepth(2);

    // Bands answer the pointer, names included.
    SEQUENCE.forEach((id, i) => {
      this.add.zone(this.m.x - 6, this.bandY(i), P.x + P.w - this.m.x, Math.ceil(this.bandH)).setOrigin(0, 0).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.select(i));
    });

    // Bram under the card, with his bubble.
    this.bram = this.add.sprite(this.card.x + 10, this.bramY + 38, 'npc_trader', 0).setOrigin(0.5, 1).setDepth(3);
    this.bubbleG = this.add.graphics().setDepth(3);
    this.bubble = new PixelText(this, 0, 0, '', { color: INK_CSS, shadow: null }).setDepth(3);

    // DONE in the corner, framed like the dares screen.
    const dx = GAME_WIDTH - 66, dy = top + 6;
    const btn = this.add.graphics();
    drawFrame(btn, dx, dy, 58, 15, { accent: 0x8fd16a, alpha: 0.95 });
    new PixelText(this, dx + 29, dy + 5, 'DONE', { color: COLORS.text }).setOrigin(0.5, 0);
    this.add.zone(dx, dy, 58, 15).setOrigin(0, 0).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.close());
    if (!IS_TOUCH) new PixelText(this, GAME_WIDTH / 2, GAME_HEIGHT - 10, '↑ ↓ CHOOSE   SPACE BUY TICKET   ENTER START HERE   ESC DONE', { color: COLORS.faint }).setOrigin(0.5, 0);

    // Start on the picked ticket, else on the highest biome you know.
    const lift = this.prog.data.lift;
    const known = SEQUENCE.filter((id) => this.known(id));
    this.index = lift ? SEQUENCE.indexOf(lift) : Math.max(0, SEQUENCE.indexOf(known[known.length - 1]));

    this.input.keyboard.on('keydown', this.onKey, this);
    this.events.once('shutdown', () => this.input.keyboard.off('keydown', this.onKey, this));
    this.render();
    this.sayState();
  }

  known(id) { return id === 'green' || this.prog.data.biomes.includes(id) || this.prog.stars(id).length > 0; }

  // Top and middle of band i (0 = the Green Rise at the foot).
  bandY(i) { return Math.round(this.m.y + this.m.h - (i + 1) * this.bandH); }
  bandMid(i) { return Math.round(this.m.y + this.m.h - (i + 0.5) * this.bandH); }

  // Half the width of the peak at height t (0 foot, 1 summit): broad shoulders, a ragged ridge.
  halfW(t, y) {
    const base = this.m.w / 2 - 2;
    const shoulder = Math.sin(t * Math.PI * 2.5) * 4 * (1 - t);
    return Math.max(2, Math.round(base * (1 - t) ** 0.8 + shoulder + Math.sin(y * 0.8) * 1.2 + Math.sin(y * 0.31) * 1.6));
  }

  // The trail's stop in band i: it zigzags from flank to flank.
  stop(i) {
    const cx = this.m.x + this.m.w / 2;
    const y = this.bandMid(i);
    const hw = this.halfW((i + 0.5) / SEQUENCE.length, y);
    return { x: Math.round(cx + (i % 2 ? 0.4 : -0.4) * hw), y };
  }

  text(x, y, str, color, scale = 1) {
    return new PixelText(this, x, y, str, { color, shadow: null }).setScale(scale);
  }

  // Old paper: ragged edges, specks, two fold creases, a coffee ring, pins and a title.
  drawPaper() {
    const g = this.mapG;
    const { x, y, w, h } = this.paper;
    g.fillStyle(0x000000, 0.35).fillRect(x + 3, y + 4, w, h);
    g.fillStyle(PAPER_EDGE, 1).fillRect(x, y, w, h);
    g.fillStyle(PAPER, 1).fillRect(x + 1, y + 1, w - 2, h - 2);
    for (let k = 0; k < 4; k++) {
      g.fillStyle(PAPER_DARK, 0.2);
      g.fillRect(x + 1 + k, y + 1 + k, w - 2 - 2 * k, 1).fillRect(x + 1 + k, y + h - 2 - k, w - 2 - 2 * k, 1);
      g.fillRect(x + 1 + k, y + 1 + k, 1, h - 2 - 2 * k).fillRect(x + w - 2 - k, y + 1 + k, 1, h - 2 - 2 * k);
    }
    for (let i = 0; i < 260; i++) g.fillStyle(PAPER_DARK, 0.5).fillRect(x + 2 + Math.floor(rnd(i) * (w - 4)), y + 2 + Math.floor(rnd(i, 1) * (h - 4)), 1, 1);
    // Fold creases.
    const fx = Math.round(x + w / 2), fy = Math.round(y + h / 2);
    g.fillStyle(PAPER_DARK, 0.4).fillRect(fx, y + 1, 1, h - 2).fillRect(x + 1, fy, w - 2, 1);
    g.fillStyle(0xf8f0dc, 0.6).fillRect(fx + 1, y + 1, 1, h - 2).fillRect(x + 1, fy + 1, w - 2, 1);
    // Bites out of the edges.
    for (let k = 0; k < 14; k++) {
      const side = k % 4, at = 6 + Math.floor(rnd(k, 7) * ((side < 2 ? w : h) - 12));
      g.fillStyle(0x07060e, 1);
      if (side === 0) g.fillRect(x + at, y, 2 + (k % 3), 1);
      else if (side === 1) g.fillRect(x + at, y + h - 1, 2 + (k % 3), 1);
      else if (side === 2) g.fillRect(x, y + at, 1, 2 + (k % 3));
      else g.fillRect(x + w - 1, y + at, 1, 2 + (k % 3));
    }
    // A coffee ring.
    g.lineStyle(1, 0xa8834a, 0.3).strokeCircle(x + w - 24, y + 24, 11);
    g.lineStyle(1, 0xa8834a, 0.18).strokeCircle(x + w - 23, y + 25, 9);
    // Pins.
    for (const px of [x + 12, x + w - 12]) {
      g.fillStyle(0x5a0c14, 1).fillCircle(px, y + 5, 3);
      g.fillStyle(0xd83a3a, 1).fillCircle(px, y + 4, 3);
      g.fillStyle(0xffb0b0, 1).fillRect(px - 1, y + 2, 1, 1);
    }
    // A little compass rose.
    const cx = x + 20, cy = y + 26;
    g.lineStyle(1, INK, 0.5).strokeCircle(cx + 0.5, cy + 0.5, 4);
    g.fillStyle(INK, 1).fillRect(cx, cy - 6, 1, 13).fillRect(cx - 6, cy, 13, 1);
    g.fillStyle(TRAIL, 1).fillRect(cx, cy - 6, 1, 4).fillRect(cx - 1, cy - 4, 3, 1);
    this.text(cx - 2, cy - 14, 'N', INK_SOFT);
    this.text(x + w / 2, y + 9, "BRAM'S TRAIL MAP", INK_CSS, 2).setOrigin(0.5, 0);
    this.text(x + w / 2, y + 25, 'MASTER A BIOME TO RIDE THE LIFT TO THE NEXT', INK_SOFT).setOrigin(0.5, 0);
  }

  // The peak in watercolour, a row at a time, with ink on its edges. Biomes
  // nobody has seen yet are only pencilled in.
  drawPeak() {
    const g = this.mapG;
    const { x, y, w, h } = this.m;
    const cx = Math.round(x + w / 2);
    const wash = SEQUENCE.map((id) => (this.known(id) ? lerpColor(PAPER, BIOMES[id].accentA, 0.72) : lerpColor(PAPER, PAPER_DARK, 0.1)));
    for (let py = y; py < y + h; py++) {
      const t = (y + h - py) / h;
      const f = t * SEQUENCE.length;
      const i = Math.min(SEQUENCE.length - 1, Math.floor(f));
      // Colours bleed into each other near a border, the way wet paint does.
      const frac = f - i;
      const hw = this.halfW(t, py);
      for (let px = cx - hw; px < cx + hw; px++) {
        const k = frac < 0.22 && i > 0 && bayer(px, py) > frac / 0.22 ? i - 1 : i;
        let c = wash[k];
        // Light from the right; the shady flank is darker, with ink hatching near its edge.
        const side = (px - cx) / hw;
        if (!this.known(SEQUENCE[k])) {
          // Only pencilled in: a few strokes on the shady side.
          if (side < -0.4 && (px + py) % 6 === 0) c = lerpColor(c, PENCIL, 0.45);
        } else {
          if (side >= 0) c = lerpColor(c, 0xffffff, 0.18 * (1 - side));
          else c = lerpColor(c, INK, 0.1 - side * 0.08);
          if (side < -0.65 && (px + py) % 6 === 0) c = lerpColor(c, INK, 0.22);
        }
        g.fillStyle(c, 1).fillRect(px, py, 1, 1);
      }
      const edge = this.known(SEQUENCE[i]) ? [INK, 0.85] : [PENCIL, 0.9];
      g.fillStyle(edge[0], edge[1]).fillRect(cx - hw - 1, py, 1, 1).fillRect(cx + hw, py, 1, 1);
    }
    // Mist over the part nobody has charted yet.
    const highest = SEQUENCE.map((id) => this.known(id)).lastIndexOf(true);
    if (highest < SEQUENCE.length - 1) {
      const my = Math.round((this.bandY(highest) + this.m.y) / 2);
      this.cloud(g, cx - 14, my + 14);
      this.cloud(g, cx + 12, my - 18);
      this.cloud(g, cx - 4, this.bandY(highest) - 4);
      this.text(cx, my - 3, 'UNCHARTED', INK_SOFT).setOrigin(0.5, 0).setAlpha(0.8);
    }
    // Snow on the summit.
    g.fillStyle(0xffffff, 1).fillRect(cx - 1, y + 1, 3, 2).fillRect(cx - 3, y + 3, 6, 2);
    // Pines and the camp at the foot, clouds round the cloud band.
    const fy = y + h;
    g.fillStyle(INK, 0.6).fillRect(x - 6, fy, w + 12, 1);
    for (const [dx, s] of [[-w / 2 - 4, 7], [-w / 2 + 4, 5], [w / 2 - 2, 6], [w / 2 + 6, 8]]) this.pine(g, Math.round(cx + dx), fy, s);
    this.tent = { x: cx + 6, y: fy - 1 };
    this.tentDoodle(g, this.tent.x, fy);
    if (this.known('clouds')) {
      const cy = this.bandMid(3);
      const hw = this.halfW(3.5 / SEQUENCE.length, cy);
      this.cloud(g, cx - hw - 3, cy + 2);
      this.cloud(g, cx + hw + 3, cy - 3);
    }
    // Your record: a little red flag on the flank.
    const best = this.prog.bestFor('normal');
    if (best > 0) {
      let i = 0;
      while (i < SEQUENCE.length - 1 && best >= BIOMES[SEQUENCE[i + 1]].from) i++;
      const lo = BIOMES[SEQUENCE[i]].from;
      const hi = i < SEQUENCE.length - 1 ? BIOMES[SEQUENCE[i + 1]].from : lo + 173;
      const by = Math.round(y + h - (i + Math.min(1, (best - lo) / (hi - lo))) * this.bandH);
      const bx = Math.round(cx - this.halfW((y + h - by) / h, by) - 1);
      g.fillStyle(INK, 1).fillRect(bx, by - 7, 1, 8);
      g.fillStyle(0xd83a3a, 1).fillRect(bx - 5, by - 7, 5, 3);
      this.text(bx - 7, by - 7, `${Math.floor(best)}`, RED_INK).setOrigin(1, 0);
    }
  }

  pine(g, x, base, s) {
    for (let k = 0; k < s; k++) {
      const half = Math.floor((k * 3) / s);
      g.fillStyle(k % 2 ? 0x4a7a3c : 0x2f5a30, 1).fillRect(x - half, base - s + k, half * 2 + 1, 1);
    }
    g.fillStyle(INK, 1).fillRect(x, base - s - 1, 1, 1);
  }

  // A small orange tent and a campfire with a wisp of smoke.
  tentDoodle(g, x, base) {
    for (let k = 0; k < 6; k++) g.fillStyle(0xe07a2e, 1).fillRect(x - k, base - 6 + k, k * 2 + 1, 1);
    g.fillStyle(INK, 1).fillRect(x - 6, base - 1, 13, 1).fillRect(x, base - 4, 1, 3);
    g.fillStyle(0xd83a3a, 1).fillRect(x + 10, base - 2, 3, 1);
    g.fillStyle(0xf2a03c, 1).fillRect(x + 11, base - 3, 1, 1);
    g.fillStyle(PENCIL, 0.8).fillRect(x + 11, base - 6, 1, 2).fillRect(x + 12, base - 8, 1, 2).fillRect(x + 11, base - 10, 1, 1);
  }

  cloud(g, x, y) {
    g.fillStyle(0xffffff, 0.95).fillRect(x - 5, y, 11, 3).fillRect(x - 3, y - 2, 6, 2);
    g.fillStyle(INK, 0.55).fillRect(x - 5, y + 3, 11, 1).fillRect(x - 6, y + 1, 1, 2).fillRect(x + 6, y + 1, 1, 2).fillRect(x - 3, y - 3, 6, 1);
  }

  clear() { this.objs.forEach((o) => o.destroy()); this.objs = []; }
  add2(o) { this.objs.push(o); return o; }
  ink(x, y, str, color = INK_CSS) { return this.add2(this.text(x, y, str, color)); }

  // A painted band on the card, like the payout strip on a dare card.
  button(x, y, label, fill, onClick) {
    const w = measureLine(label) + 12, h = 12;
    const g = this.add2(this.add.graphics());
    g.fillStyle(0x000000, 0.25).fillRect(x + 1, y + 1, w, h);
    g.fillStyle(fill, 1).fillRect(x, y, w, h);
    g.fillStyle(0xffffff, 0.35).fillRect(x, y, w, 1);
    g.fillStyle(0x000000, 0.2).fillRect(x, y + h - 1, w, 1);
    this.add2(new PixelText(this, x + 6, y + 4, label, { color: '#16141f', shadow: null }));
    this.add2(this.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true })).on('pointerdown', onClick);
    return w;
  }

  render() {
    this.clear();
    const p = this.prog;
    const g = this.add2(this.add.graphics());
    const known = SEQUENCE.map((id) => this.known(id));
    const highest = known.lastIndexOf(true);

    // The trail: red dashes up to the highest biome you know, pencil after.
    let prev = { x: this.tent.x - 2, y: this.tent.y - 6 };
    SEQUENCE.forEach((id, i) => {
      const s = this.stop(i);
      const steps = Math.max(1, Math.round(Math.hypot(s.x - prev.x, s.y - prev.y) / 3));
      for (let k = 1; k < steps; k++) {
        const px = Math.round(prev.x + ((s.x - prev.x) * k) / steps), py = Math.round(prev.y + ((s.y - prev.y) * k) / steps);
        g.fillStyle(i <= highest ? TRAIL : PENCIL, i <= highest ? 1 : 0.7).fillRect(px, py, 1, 1);
      }
      prev = s;
    });

    // Each stop: its stone (or a question mark), a dotted leader, the stars and the name.
    SEQUENCE.forEach((id, i) => {
      const s = this.stop(i);
      const ly = this.bandMid(i) - 3;
      if (i === this.index) {
        // A swipe of highlighter over the name.
        g.fillStyle(MARKER, 0.6).fillRect(this.labelX - 3, ly - 2, this.paper.x + this.paper.w - this.labelX - 3, 9);
        g.fillStyle(MARKER, 0.35).fillRect(this.labelX - 5, ly - 1, 2, 7);
      }
      for (let lx = s.x + 7; lx < this.labelX - 4; lx += 2) g.fillStyle(PENCIL, 0.6).fillRect(lx, this.bandMid(i), 1, 1);
      if (!known[i]) {
        this.ink(s.x - 2, s.y - 3, '?', INK_SOFT);
        this.ink(this.labelX, ly, '? ? ?', INK_SOFT).setAlpha(0.6);
        return;
      }
      g.fillStyle(PAPER, 1).fillCircle(s.x, s.y, 5);
      g.lineStyle(1, INK, 0.8).strokeCircle(s.x + 0.5, s.y + 0.5, 5);
      this.add2(this.add.image(s.x, s.y, `gem_${gemForBiome(id).id}`));
      const have = p.stars(id);
      const all = have.length === STARS.length;
      let lx = this.labelX;
      STARS.forEach((k) => {
        const got = have.includes(k);
        this.ink(lx, ly, got ? '★' : '☆', got ? GOLD_INK : INK_SOFT).setAlpha(got ? 1 : 0.85);
        lx += 6;
      });
      this.ink(lx + 3, ly, short(id), all ? GOLD_INK : INK_CSS);
      const l = LIFT_BY_ID[id];
      if (l) {
        const owned = p.tickets(id);
        const open = p.liftStatus(id).state !== 'locked';
        const tx = this.paper.x + this.paper.w - (owned ? 18 : 12);
        this.add2(this.add.image(tx, ly + 2, l.icon).setAlpha(open || owned ? 1 : 0.3));
        if (owned) this.ink(tx + 7, ly, `${owned}`, INK_CSS);
      }
    });
    this.drawCard();
  }

  // The note card pinned beside the map.
  drawCard() {
    const p = this.prog;
    const id = SEQUENCE[this.index];
    const b = BIOMES[id];
    const known = this.known(id);
    const c = this.card;
    const g = this.add2(this.add.graphics());
    g.fillStyle(0x000000, 0.35).fillRect(c.x + 2, c.y + 3, c.w, c.h);
    g.fillStyle(PAPER_EDGE, 1).fillRect(c.x, c.y, c.w, c.h);
    g.fillStyle(PAPER, 1).fillRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
    g.fillStyle(PAPER_DARK, 1).fillRect(c.x + 1, c.y + c.h - 4, c.w - 2, 3).fillRect(c.x + c.w - 3, c.y + 1, 2, c.h - 2);
    for (let ly = c.y + 32; ly < c.y + c.h - 8; ly += 9) g.fillStyle(0xb8c8d8, 0.3).fillRect(c.x + 5, ly + 7, c.w - 12, 1);
    // The biome's colour along the top, and the pin.
    g.fillStyle(known ? b.accentA : PAPER_DARK, 1).fillRect(c.x + 1, c.y + 1, c.w - 4, 4);
    g.fillStyle(0x5a0c14, 1).fillCircle(c.x + c.w / 2, c.y + 3, 3);
    g.fillStyle(0xd83a3a, 1).fillCircle(c.x + c.w / 2, c.y + 2, 3);
    g.fillStyle(0xffb0b0, 1).fillRect(c.x + c.w / 2 - 1, c.y, 1, 1);

    const L = c.x + 8, maxW = c.w - 16;
    let y = c.y + 11;
    const name = known ? b.name : '? ? ?';
    const big = measureLine(name) * 2 <= maxW;
    this.ink(L, y, name).setScale(big ? 2 : 1);
    y += big ? 15 : 10;
    if (!known) {
      wrap('NOBODY HAS DRAWN THIS PART OF THE MOUNTAIN YET. CLIMB HIGHER TO FIND IT.', maxW).forEach((ln) => { this.ink(L, y, ln, INK_SOFT); y += 9; });
      return;
    }
    const gem = gemForBiome(id);
    this.ink(L, y, `FROM ${b.from} M`, INK_SOFT);
    const gx = L + measureLine(`FROM ${b.from} M`) + 9;
    this.add2(this.add.image(gx, y + 2, `gem_${gem.id}`));
    this.ink(gx + 7, y, gem.name, INK_SOFT);
    y += 13;

    const have = p.stars(id);
    const all = have.length === STARS.length;
    this.ink(L, y, all ? 'MASTERED!' : 'MASTERY, IN ONE PASS:', all ? GOLD_INK : INK_CSS);
    y += 10;
    for (const k of STARS) {
      const got = have.includes(k);
      this.ink(L + 2, y, got ? '★' : '☆', got ? GOLD_INK : INK_SOFT);
      this.ink(L + 11, y, starLabel(id, k), got ? INK_CSS : INK_SOFT);
      // Done ones are ticked off with a stroke of the pen.
      if (got) g.fillStyle(INK, 0.55).fillRect(L + 10, y + 2, measureLine(starLabel(id, k)) + 2, 1);
      y += 9;
    }
    const reward = Object.values(COSMETICS).flat().find((it) => it.requirement && it.requirement.mastery === id);
    if (reward) { this.ink(L, y + 2, `PRIZE: ${reward.name}`, all ? GREEN_INK : INK_SOFT); y += 11; }

    // The lift, under a pencil line.
    const lift = LIFT_BY_ID[id];
    const picked = p.data.lift;
    for (let lx = L; lx < c.x + c.w - 10; lx += 2) g.fillStyle(PENCIL, 0.7).fillRect(lx, y + 4, 1, 1);
    const by = Math.min(c.y + c.h - 20, y + 22);
    if (lift) {
      const st = p.liftStatus(id);
      const owned = p.tickets(id);
      this.add2(this.add.image(L + 5, by - 8, lift.icon));
      this.ink(L + 13, by - 10, owned ? `LIFT TICKET  X${owned}` : 'LIFT TICKET', BLUE_INK);
      let bx = L;
      if (st.state === 'locked') {
        this.ink(L, by + 2, `MASTER ${short(lift.after)} FIRST`, RED_INK);
        bx = c.x + c.w - 8 - (measureLine(picked === id ? 'PICKED' : 'START HERE') + 12);
      } else bx += this.button(bx, by - 1, `BUY ◆${lift.price}`, st.state === 'buy' ? 0x9fd8ff : 0xd88a7a, () => this.buy()) + 4;
      if (owned) this.button(bx, by - 1, picked === id ? 'PICKED' : 'START HERE', picked === id ? 0x8fd16a : 0xf2d06a, () => this.pick());
    } else if (id === 'green') {
      this.ink(L, by - 10, 'BASE CAMP', BLUE_INK);
      this.button(L, by - 1, !picked ? 'PICKED' : 'START HERE', !picked ? 0x8fd16a : 0xf2d06a, () => this.pick());
    } else this.ink(L, by + 2, 'NO LIFT GOES THIS HIGH', INK_SOFT);
  }

  // Bram's line about the chosen biome and where your next run starts.
  sayState() {
    const p = this.prog;
    const id = SEQUENCE[this.index];
    const lift = LIFT_BY_ID[id];
    let text;
    if (this.mode !== 'normal') text = BRAM.hard;
    else if (!this.known(id)) text = BRAM.unknown;
    else if (lift && p.liftStatus(id).state === 'locked' && !p.tickets(id)) text = BRAM.locked(lift.after);
    else if (p.data.lift) text = this.departed ? BRAM.later : BRAM.lift(p.data.lift);
    else if (p.stars(id).length === STARS.length) text = BRAM.mastered(id);
    else if (!lift && id !== 'green') text = BRAM.top;
    else text = BRAM.camp;
    this.say(text);
  }

  say(text) {
    const x = this.card.x + 26, y = this.bramY;
    const maxW = GAME_WIDTH - x - 20;
    this.bubble.setText(wrap(text, maxW).join('\n'));
    const g = this.bubbleG.clear();
    const bw = this.bubble.width + 10, bh = this.bubble.height + 9;
    g.fillStyle(0x16141f, 1).fillRect(x - 1, y - 1, bw + 2, bh + 2);
    g.fillStyle(0xf4efe4, 1).fillRect(x, y, bw, bh);
    // The tail, pointing at Bram.
    g.fillStyle(0xf4efe4, 1).fillRect(x - 4, y + 11, 4, 3).fillRect(x - 6, y + 13, 3, 2);
    g.fillStyle(0x16141f, 1).fillRect(x - 7, y + 14, 2, 2);
    this.bubble.setPosition(x + 5, y + 5);
    this.bram.setFrame(1);
    this.time.delayedCall(140, () => this.bram.active && this.bram.setFrame(0));
  }

  select(i) {
    if (i < 0 || i >= SEQUENCE.length || i === this.index) return;
    this.index = i;
    Audio.play('ui');
    this.render();
    this.sayState();
  }

  buy() {
    const id = SEQUENCE[this.index];
    if (!LIFT_BY_ID[id]) return;
    const st = this.prog.liftStatus(id);
    if (st.state === 'locked') { Audio.play('denied'); this.say(BRAM.locked(LIFT_BY_ID[id].after)); return; }
    if (!this.prog.buyLift(id)) { Audio.play('denied'); this.say(BRAM.poor); return; }
    Audio.play('buy');
    this.render();
    this.say(BRAM.bought);
  }

  // Picks this band as where the next run starts (the foot: base camp).
  pick() {
    const id = SEQUENCE[this.index];
    if (id === 'green') this.prog.setLift(null);
    else if (!LIFT_BY_ID[id]) return;
    else if (this.prog.data.lift === id) this.prog.setLift(null);
    else if (!this.prog.setLift(id)) { Audio.play('denied'); this.say(BRAM.locked(LIFT_BY_ID[id].after)); return; }
    Audio.play('select');
    this.render();
    this.sayState();
  }

  onKey(event) {
    if (event.repeat) return;
    switch (event.code) {
      case 'ArrowUp': case 'KeyW': this.select(this.index + 1); break;
      case 'ArrowDown': case 'KeyS': this.select(this.index - 1); break;
      case 'Space': this.buy(); break;
      case 'Enter': case 'ArrowRight': case 'KeyD': this.pick(); break;
      case 'Escape': case 'Backspace': this.close(); break;
      default: break;
    }
  }

  update(time, delta) {
    this.t += delta;
    const sg = this.starG.clear();
    for (const s of this.stars) sg.fillStyle(0xf4efe4, 0.35 + 0.65 * Math.max(0, Math.sin(this.t / 700 + s.p))).fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
    this.fire.setAlpha(0.28 + 0.08 * Math.sin(this.t / 90) + 0.05 * Math.sin(this.t / 37));
    this.lamp.setAlpha(0.13 + 0.03 * Math.sin(this.t / 130) + 0.02 * Math.sin(this.t / 53));
    this.bram.y = this.bramY + 38 + (Math.floor(this.t / 1400) % 2);

    // A red pencil ring round the chosen stop, drawn a little unsteadily.
    const s = this.stop(this.index);
    const r = this.ring.clear();
    for (let a = 0; a < Math.PI * 2; a += 0.2) {
      const rr = 8 + Math.sin(a * 3 + this.t / 400) * 0.7;
      r.fillStyle(TRAIL, 0.9).fillRect(Math.round(s.x + Math.cos(a) * (rr + 1)), Math.round(s.y + Math.sin(a) * rr), 1, 1);
    }

    // The lift cable in ink from camp to the picked ticket's stop, and the gondola riding it.
    const c = this.cable.clear();
    const lift = this.prog.data.lift;
    if (!lift) return;
    const to = this.stop(SEQUENCE.indexOf(lift));
    const x0 = this.tent.x + 16, y0 = this.tent.y - 2;
    const x1 = to.x + 6, y1 = to.y - 3;
    const at = (k) => ({ x: Math.round(x0 + (x1 - x0) * k), y: Math.round(y0 + (y1 - y0) * k + Math.sin(k * Math.PI) * 5) });
    for (let k = 0; k <= 1; k += 0.015) { const q = at(k); c.fillStyle(INK, 0.75).fillRect(q.x, q.y, 1, 1); }
    const q = at(Math.min(1, (this.t % 4600) / 3000));
    c.fillStyle(INK, 1).fillRect(q.x, q.y, 1, 3).fillRect(q.x - 4, q.y + 3, 9, 7);
    c.fillStyle(0xc8463b, 1).fillRect(q.x - 3, q.y + 4, 7, 5);
    c.fillStyle(0xf8f0dc, 1).fillRect(q.x - 2, q.y + 5, 2, 2).fillRect(q.x + 1, q.y + 5, 2, 2);
  }

  close() {
    Audio.play('cloth');
    this.scene.stop();
    this.scene.resume(this.returnTo);
  }
}
