import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, IS_PORTRAIT, IS_TOUCH } from '../config/gameConfig.js';
import { PixelText, COLORS, drawFrame } from '../ui/PixelText.js';
import { measureLine } from '../utils/pixelFont.js';
import { DARES, DARE, MAX_DARES, cleanDares, dareKey, dareLabel, dareScale } from '../data/dares.js';
import { BALANCE } from '../config/balanceConfig.js';
import { buildDareTextures } from '../render/dareArt.js';
import { Audio } from '../systems/AudioSystem.js';

const CARD_W = 84, CARD_H = 124;
const INK = '#3a2a1a', INK_SOFT = '#6a5a44';
const PAPER = 0xeadfc4, PAPER_DARK = 0xc8b48a, PAPER_EDGE = 0x8a7450;

// What Bram says about each dare while you look at it.
const BRAM = {
  mirror: 'LEFT IS RIGHT AND RIGHT IS LEFT. ELSA ONCE CLIMBED A WHOLE DAY LIKE THAT, FOR A BET.',
  night: 'NO SUN, NO SHADOWS. JUST YOU, THE ROCK AND YOUR HEADLAMP.',
  quick: 'THE MOUNTAIN IS IN A HURRY TODAY. KEEP UP, OR KEEP FALLING.',
  light: 'HALF A PACK, HALF A REST. THE LEDGES WILL NOT SAVE YOU NOW.',
  blind: 'CLOSE YOUR EYES AND LISTEN. THE ROCK KNOWS THE BEAT.',
};
const BRAM_IDLE = 'FEELING BRAVE? TAKE A DARE OR TWO. I PAY EXTRA FOR EVERY ONE.';
const BRAM_TWO = 'NOW THAT IS A CLIMB I WOULD PAY TO SEE.';
const BRAM_FULL = 'TWO IS PLENTY. I AM NOT A MONSTER.';
const BRAM_TAKE = ['DONE. NO TAKING IT BACK ON THE WALL.', 'SHAKE ON IT, CLIMBER.', 'HA! I KNEW YOU WOULD.'];
const BRAM_DROP = 'CHANGED YOUR MIND? THE MOUNTAIN WILL NOT TELL.';

const hex = (css) => parseInt(css.slice(1), 16);

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

// Bram's dares, as a row of worn paper cards pinned up at night by the fire.
// Pick one and Bram's red wax seal slams onto it. Up to MAX_DARES at once.
// Launched over the title camp (data: { returnTo }), which waits paused.
export class DaresScene extends Phaser.Scene {
  constructor() { super('Dares'); }

  init(data) { this.returnTo = data.returnTo || 'Menu'; }

  create() {
    this.prog = this.registry.get('progression');
    buildDareTextures(this);
    this.t = 0;
    this.index = 0;
    this.mode = BALANCE.modes[this.prog.settings.mode] ? this.prog.settings.mode : 'normal';

    // Night over the camp: a deep sky, a few stars, firelight from below.
    this.sky = this.add.graphics();
    this.sky.fillStyle(0x07060e, 0.9).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    for (let i = 0; i < 9; i++) this.sky.fillStyle(0x0c0a1a, 0.25).fillRect(0, (i * GAME_HEIGHT) / 9, GAME_WIDTH, GAME_HEIGHT / 9 - (i % 2));
    this.stars = Array.from({ length: 34 }, (_, i) => ({ x: (i * 137.5) % GAME_WIDTH, y: (i * 61.7) % (GAME_HEIGHT * 0.6), p: i * 0.7 }));
    this.starG = this.add.graphics();
    this.fire = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT + 10, 'glow').setBlendMode('ADD').setTint(0xff8a3c).setScale(5, 2.2).setAlpha(0.35);
    this.add.zone(0, 0, GAME_WIDTH, GAME_HEIGHT).setOrigin(0, 0).setInteractive();

    // Upright: below the touch buttons. Lying down: centred on tall screens.
    const top = IS_PORTRAIT ? 30 : Math.max(0, Math.floor((GAME_HEIGHT - 250) / 2));
    this.top = top;
    (new PixelText(this, GAME_WIDTH / 2, top + 7, "BRAM'S DARES", { color: COLORS.gold }).setOrigin(0.5, 0).setScale(2));
    (new PixelText(this, GAME_WIDTH / 2, top + 25, `TAKE UP TO ${MAX_DARES}. EVERY DARE PAYS X${DARE.gemScale} GEMS.`, { color: COLORS.dim }).setOrigin(0.5, 0));

    // The cards: one row, or three and two when upright.
    this.cards = DARES.map((d, i) => {
      let x, y;
      if (IS_PORTRAIT) {
        const row = i < 3 ? 0 : 1, inRow = row ? 2 : 3, col = row ? i - 3 : i;
        const rowW = inRow * CARD_W + (inRow - 1) * 8;
        x = (GAME_WIDTH - rowW) / 2 + col * (CARD_W + 8) + CARD_W / 2;
        y = top + 44 + row * (CARD_H + 10) + CARD_H / 2;
      } else {
        const rowW = DARES.length * CARD_W + (DARES.length - 1) * 8;
        x = (GAME_WIDTH - rowW) / 2 + i * (CARD_W + 8) + CARD_W / 2;
        y = top + 42 + CARD_H / 2;
      }
      return this.makeCard(d, i, x, y);
    });

    // Bram and what he says, then the payout, along the bottom.
    const by = IS_PORTRAIT ? top + 44 + 2 * (CARD_H + 10) + 8 : top + 42 + CARD_H + 10;
    this.bottomY = by;
    this.bram = this.add.sprite(26, by + 38, 'npc_trader', 0).setOrigin(0.5, 1);
    this.bubbleG = this.add.graphics();
    this.bubble = (new PixelText(this, 52, by + 6, '', { color: INK, shadow: null }));
    this.statsG = this.add.graphics();
    this.gem = this.add.image(0, 0, 'gem_diamond').setScale(1.5);
    this.mult = (new PixelText(this, 0, 0, '', { color: '#9fe8ff' }).setScale(2));
    this.best = (new PixelText(this, 0, 0, '', { color: COLORS.dim }));
    this.doneBtn = this.add.zone(0, 0, 60, 16).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.doneBtn.on('pointerdown', () => this.close());
    this.doneText = (new PixelText(this, 0, 0, 'DONE', { color: COLORS.text }).setOrigin(0.5, 0));
    (new PixelText(this, GAME_WIDTH / 2, GAME_HEIGHT - 10, IS_TOUCH ? 'TAP A CARD TO TAKE THE DARE' : `← → CHOOSE   SPACE TAKE   C CLEAR   ESC DONE`, { color: COLORS.faint }).setOrigin(0.5, 0));

    this.say(this.picked.length >= MAX_DARES ? BRAM_TWO : BRAM_IDLE);
    this.input.keyboard.on('keydown', this.onKey, this);
    this.events.once('shutdown', () => this.input.keyboard.off('keydown', this.onKey, this));
    this.select(0, true);
    this.refresh();
  }

  get picked() { return cleanDares(this.prog.settings.dares); }

  // ---------------------------------------------------------------- cards
  makeCard(dare, i, x, y) {
    const c = this.add.container(x, y);
    const color = hex(dare.color);
    const g = this.add.graphics();
    const w = CARD_W, h = CARD_H, x0 = -w / 2, y0 = -h / 2;
    // Paper with a few torn bites out of the edges (the same on every visit).
    g.fillStyle(0x000000, 0.35).fillRect(x0 + 2, y0 + 3, w, h);
    g.fillStyle(PAPER_EDGE, 1).fillRect(x0, y0, w, h);
    g.fillStyle(PAPER, 1).fillRect(x0 + 1, y0 + 1, w - 2, h - 2);
    g.fillStyle(PAPER_DARK, 1).fillRect(x0 + 1, y0 + h - 4, w - 2, 3).fillRect(x0 + w - 3, y0 + 1, 2, h - 2);
    for (let k = 0; k < 7; k++) {
      const s = (i * 31 + k * 17) % 97;
      const side = k % 4, at = 8 + (s % (side < 2 ? w - 16 : h - 16));
      g.fillStyle(0x07060e, 1);
      if (side === 0) g.fillRect(x0 + at, y0, 2 + (s % 3), 1);
      else if (side === 1) g.fillRect(x0 + at, y0 + h - 1, 2 + (s % 3), 1);
      else if (side === 2) g.fillRect(x0, y0 + at, 1, 2 + (s % 3));
      else g.fillRect(x0 + w - 1, y0 + at, 1, 2 + (s % 3));
    }
    // Faint ruled lines like a notebook page.
    for (let ly = y0 + 62; ly < y0 + h - 22; ly += 8) g.fillStyle(0xb8c8d8, 0.35).fillRect(x0 + 5, ly, w - 10, 1);
    // The emblem in a dark round plate.
    g.fillStyle(0x2a2236, 1).fillCircle(0, y0 + 26, 17);
    g.lineStyle(1, color, 1).strokeCircle(0, y0 + 26, 17);
    g.lineStyle(1, color, 0.35).strokeCircle(0, y0 + 26, 15);
    // A coloured band along the bottom.
    g.fillStyle(color, 1).fillRect(x0 + 1, y0 + h - 15, w - 2, 11);
    g.fillStyle(0xffffff, 0.3).fillRect(x0 + 1, y0 + h - 15, w - 2, 1);
    const icon = this.add.image(0, y0 + 26, `dare_${dare.id}`).setScale(1);
    // The pin holding it up.
    const pin = this.add.graphics();
    pin.fillStyle(0x5a0c14, 1).fillCircle(0, y0 + 2, 3);
    pin.fillStyle(0xd83a3a, 1).fillCircle(0, y0 + 1, 3);
    pin.fillStyle(0xffb0b0, 1).fillRect(-1, y0 - 1, 1, 1);
    const name = new PixelText(this, 0, y0 + 48, wrap(dare.name, w - 10), { color: INK, shadow: null, align: 'center' }).setOrigin(0.5, 0);
    const rule = new PixelText(this, 0, y0 + 66, wrap(dare.text, w - 12), { color: INK_SOFT, shadow: null, align: 'center' }).setOrigin(0.5, 0);
    const pay = new PixelText(this, 0, y0 + h - 12, `GEMS X${DARE.gemScale}`, { color: '#16141f', shadow: null }).setOrigin(0.5, 0);
    // Glow behind the card when taken.
    const glow = this.add.graphics();
    glow.fillStyle(color, 0.22).fillRect(x0 - 4, y0 - 4, w + 8, h + 8);
    glow.fillStyle(color, 0.35).fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
    glow.setAlpha(0);
    // The seal, pressed on when the dare is taken.
    const seal = this.add.image(w / 2 - 16, y0 + 34, 'dare_seal').setAlpha(0);
    const sealText = new PixelText(this, w / 2 - 16, y0 + 32, 'DARED', { color: '#ffd8c8', shadow: '#5a0c14' }).setOrigin(0.5, 0).setAlpha(0);
    const shade = this.add.graphics();
    shade.fillStyle(0x07060e, 0.55).fillRect(x0, y0, w, h);
    shade.setAlpha(0);
    c.add([glow, g, icon, name, rule, pay, pin, seal, sealText, shade]);
    c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on('pointerover', () => this.select(i));
    c.on('pointerdown', () => { this.select(i, true); this.toggle(); });
    // Each card hangs a little crooked.
    const tilt = [-2, 1.5, -1, 2, -1.5][i % 5];
    c.setAngle(tilt);
    return { c, dare, glow, seal, sealText, shade, icon, baseX: x, baseY: y, tilt, color };
  }

  select(i, quiet = false) {
    if (i === this.index && !quiet) return;
    if (i !== this.index && !quiet) Audio.play('ui');
    this.index = i;
    this.cards.forEach((k, j) => {
      const on = j === i;
      this.tweens.add({ targets: k.c, y: k.baseY - (on ? 7 : 0), angle: on ? 0 : k.tilt, scale: on ? 1.06 : 1, duration: 160, ease: 'Back.easeOut' });
      k.c.setDepth(on ? 5 : 1);
    });
    if (this.lastSaid !== 'action') this.say(BRAM[DARES[i].id]);
  }

  toggle() {
    const d = DARES[this.index];
    const now = this.picked;
    const card = this.cards[this.index];
    if (now.includes(d.id)) {
      this.prog.setSetting('dares', now.filter((x) => x !== d.id));
      Audio.play('cloth');
      this.tweens.add({ targets: [card.seal, card.sealText], alpha: 0, scale: 1.4, duration: 180 });
      this.say(BRAM_DROP, true);
    } else if (now.length >= MAX_DARES) {
      // Refused: the card shudders and Bram shakes his head.
      Audio.play('miss');
      this.tweens.add({ targets: card.c, x: card.baseX + 3, duration: 40, yoyo: true, repeat: 3, onComplete: () => card.c.setX(card.baseX) });
      this.say(BRAM_FULL, true);
      return;
    } else {
      this.prog.setSetting('dares', cleanDares([...now, d.id]));
      this.stamp(card);
      const two = this.picked.length >= MAX_DARES;
      this.say(two ? BRAM_TWO : BRAM_TAKE[Math.floor(Math.random() * BRAM_TAKE.length)], true);
    }
    this.refresh();
  }

  // The seal comes down hard: big and see-through, then a thud and a jolt.
  stamp(card) {
    const targets = [card.seal, card.sealText];
    targets.forEach((o) => o.setScale(2.6).setAlpha(0).setAngle(-28));
    this.tweens.add({
      targets, scale: 1, alpha: 1, angle: -14, duration: 190, ease: 'Quad.easeIn',
      onComplete: () => {
        Audio.play('rockhit');
        Audio.play('checkpoint');
        this.cameras.main.shake(90, 0.006);
        card.c.setScale(1.12);
        this.tweens.add({ targets: card.c, scale: 1.06, duration: 160, ease: 'Back.easeOut' });
        // A few flecks of wax.
        for (let k = 0; k < 6; k++) {
          const f = this.add.rectangle(card.c.x + card.seal.x, card.c.y + card.seal.y, 2, 2, 0xd83a3a).setDepth(9);
          this.tweens.add({ targets: f, x: f.x + (Math.random() - 0.5) * 40, y: f.y + (Math.random() - 0.5) * 30, alpha: 0, duration: 380, onComplete: () => f.destroy() });
        }
      },
    });
  }

  clearAll() {
    if (!this.picked.length) return;
    this.prog.setSetting('dares', []);
    Audio.play('cloth');
    this.cards.forEach((k) => this.tweens.add({ targets: [k.seal, k.sealText], alpha: 0, duration: 200 }));
    this.say('ALL TORN UP. A PLAIN CLIMB, THEN.', true);
    this.refresh();
  }

  // Seals, glows and shading match what is picked; the payout line updates.
  refresh() {
    const ids = this.picked;
    const full = ids.length >= MAX_DARES;
    this.cards.forEach((k) => {
      const on = ids.includes(k.dare.id);
      if (on && k.seal.alpha === 0 && !this.tweens.isTweening(k.seal)) { k.seal.setAlpha(1).setAngle(-14); k.sealText.setAlpha(1).setAngle(-14); }
      k.glow.setAlpha(on ? 1 : 0);
      k.shade.setAlpha(full && !on ? 1 : 0);
    });
    // The payout, on the right of the bottom strip.
    const g = this.statsG;
    g.clear();
    // Beside Bram when lying down; under his bubble when upright.
    const w = 150, x = IS_PORTRAIT ? (GAME_WIDTH - w) / 2 : GAME_WIDTH - w - 8;
    const y = IS_PORTRAIT ? this.bottomY + 48 : this.bottomY;
    drawFrame(g, x, y, w, 40, { accent: ids.length ? 0x9fe8ff : 0x4a4560, glow: ids.length > 0, alpha: 0.95 });
    this.gem.setPosition(x + 14, y + 13);
    this.mult.setPosition(x + 26, y + 6).setText(`X${dareScale(ids).toFixed(2)}`).setColor(ids.length ? '#9fe8ff' : COLORS.faint);
    const best = ids.length ? Math.floor(this.prog.dareBestFor(dareKey(ids, this.mode))) : Math.floor(this.prog.bestFor(this.mode));
    this.best.setPosition(x + 8, y + 26).setText(ids.length ? `${BALANCE.modes[this.mode].label} + ${dareLabel(ids)}  BEST ${best} M` : `NO DARES  •  ${BALANCE.modes[this.mode].label} RECORD ${best} M`);
    if (this.best.width > w - 14) this.best.setText(ids.length ? `BEST ${best} M WITH THESE` : `RECORD ${best} M`);
    // DONE, up in the top right corner.
    const dx = GAME_WIDTH - 68, dy = this.top + 7;
    drawFrame(g, dx, dy, 60, 15, { accent: 0x8fd16a, alpha: 0.95 });
    this.doneBtn.setPosition(dx, dy);
    this.doneText.setPosition(dx + 30, dy + 5);
  }

  // Bram's speech bubble. `action` lines stay up until the next card change.
  say(text, action = false) {
    this.lastSaid = action ? 'action' : 'idle';
    if (action) this.time.delayedCall(2200, () => { if (this.lastSaid === 'action') { this.lastSaid = 'idle'; this.say(BRAM[DARES[this.index].id]); } });
    const maxW = IS_PORTRAIT ? GAME_WIDTH - 52 - 16 : GAME_WIDTH - 52 - 166 - 16;
    this.bubble.setText(wrap(text, maxW));
    const g = this.bubbleG, y = this.bottomY;
    const bw = this.bubble.width + 10, bh = this.bubble.height + 9;
    g.clear();
    g.fillStyle(0x16141f, 1).fillRect(46, y, bw + 2, bh + 2);
    g.fillStyle(0xf4efe4, 1).fillRect(47, y + 1, bw, bh);
    // The tail, pointing at Bram.
    g.fillStyle(0xf4efe4, 1).fillRect(43, y + 12, 4, 3).fillRect(41, y + 14, 3, 2);
    g.fillStyle(0x16141f, 1).fillRect(40, y + 15, 2, 2);
    this.bubble.setPosition(52, y + 5);
    // Bram nods as he talks.
    this.bram.setFrame(1);
    this.time.delayedCall(140, () => this.bram.active && this.bram.setFrame(0));
  }

  update(time, delta) {
    this.t += delta;
    const g = this.starG;
    g.clear();
    for (const s of this.stars) {
      const a = 0.35 + 0.65 * Math.max(0, Math.sin(this.t / 700 + s.p));
      g.fillStyle(0xf4efe4, a).fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
    }
    this.fire.setAlpha(0.3 + 0.08 * Math.sin(this.t / 90) + 0.05 * Math.sin(this.t / 37));
    // The chosen card's emblem bobs a little.
    const k = this.cards[this.index];
    if (k) k.icon.y = -CARD_H / 2 + 26 + Math.round(Math.sin(this.t / 260));
    this.bram.y = this.bottomY + 38 + (Math.floor(this.t / 1400) % 2);
  }

  onKey(event) {
    if (event.repeat) return;
    const n = DARES.length;
    switch (event.code) {
      case 'ArrowLeft': case 'KeyA': this.select((this.index - 1 + n) % n); break;
      case 'ArrowRight': case 'KeyD': this.select((this.index + 1) % n); break;
      case 'ArrowUp': case 'KeyW': if (IS_PORTRAIT && this.index >= 3) this.select(this.index - 3); break;
      case 'ArrowDown': case 'KeyS': if (IS_PORTRAIT && this.index < 3) this.select(Math.min(n - 1, this.index + 3)); break;
      case 'Space': case 'Enter': this.toggle(); break;
      case 'KeyC': this.clearAll(); break;
      case 'Escape': case 'Backspace': this.close(); break;
      default: break;
    }
  }

  close() {
    Audio.play('cloth');
    this.scene.stop();
    this.scene.resume(this.returnTo);
  }
}
