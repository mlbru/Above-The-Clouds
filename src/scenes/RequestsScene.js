import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, IS_PORTRAIT, IS_TOUCH } from '../config/gameConfig.js';
import { PixelText, COLORS } from '../ui/PixelText.js';
import { measureLine } from '../utils/pixelFont.js';
import { ensureRequests, collectRequests, whoOf, REQUEST_BY_ID } from '../data/requests.js';
import { Audio } from '../systems/AudioSystem.js';
import { SeededRandom } from '../utils/seededRandom.js';

// Camp requests: the corkboard on its post at base camp, under a little
// roof, lit by a lantern swinging on a hook. Three notes hang from a string
// stretched between red pins, each on the paper of whoever wrote it. Notes
// you finished get a red thumbprint when you open the board, pay their gems
// and are torn off; a new note is pinned in each empty place.
// Launched over the title camp (data: { returnTo }), which waits paused.
const PAPER = {
  bram: { fill: 0xeee2c4, edge: 0xb8a47a, ink: '#3a2a1a', line: 0xc8b48a, style: 'ruled' },
  ines: { fill: 0xf6f4ee, edge: 0xb8b4aa, ink: '#24304a', line: 0x9fb8d8, style: 'postcard' },
  pim: { fill: 0xe8f0e0, edge: 0xa8b89a, ink: '#2a3a24', line: 0xb8d0a8, style: 'grid' },
  marta: { fill: 0xe8dcf0, edge: 0xa898b8, ink: '#3a2448', line: 0xc8b8d8, style: 'plain' },
  noor: { fill: 0xf8e488, edge: 0xc8a840, ink: '#a8342a', line: 0xe8c860, style: 'crayon' },
  tenzin: { fill: 0xf4dcb0, edge: 0xc89a5a, ink: '#5a2a10', line: 0xe0b878, style: 'brush' },
};
const BRAM_IDLE = ['PEOPLE PIN THINGS UP HERE. I JUST CARRY THE GEMS.', 'READ THEM ALL. SOME OF THEM ARE SILLY. MOST OF THEM ARE NOT.', 'IF YOU DO ONE, I WILL KNOW. I ALWAYS KNOW.'];
const BRAM_PAID = ['THUMBPRINT AND ALL. THEY WILL BE PLEASED.', 'PAID IN FULL. NEW NOTE ALREADY. PEOPLE NEVER STOP WANTING THINGS.', 'THAT IS A GOOD DAY ON THE BOARD.'];

const wrap = (text, maxW) => {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (measureLine(next) > maxW && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines.join('\n');
};

export class RequestsScene extends Phaser.Scene {
  constructor() { super('Requests'); }

  init(data) { this.returnTo = data.returnTo || 'Menu'; }

  create() {
    this.prog = this.registry.get('progression');
    this.st = ensureRequests(this.prog.data);
    this.prog.save();
    this.t = 0;
    this.index = 0;
    this.busy = false;
    this.cards = [];
    this.wallet = this.prog.gems;

    // Dusk over camp, a lantern on a hook top left.
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a0812, 0.88).setOrigin(0, 0).setInteractive();
    this.lanternGlow = this.add.image(40, 26, 'glow').setBlendMode('ADD').setTint(0xffb050).setScale(4.5, 3.5).setAlpha(0.22);
    this.lanternG = this.add.graphics().setDepth(6);

    // The board: as wide as three notes, centred.
    this.noteW = IS_PORTRAIT ? 88 : 116;
    this.noteH = IS_PORTRAIT ? 120 : 128;
    const gap = IS_PORTRAIT ? 6 : 12;
    this.gap = gap;
    const bw = this.noteW * 3 + gap * 4;
    const bh = this.noteH + 34;
    this.bx = Math.round((GAME_WIDTH - bw) / 2);
    this.by = IS_PORTRAIT ? 60 : Math.max(28, Math.floor((GAME_HEIGHT - bh - 60) / 2) + 10);
    this.bw = bw; this.bh = bh;
    this.boardG = this.add.graphics();
    this.drawBoard();
    this.stringG = this.add.graphics().setDepth(4);
    new PixelText(this, GAME_WIDTH / 2, this.by - 22, 'REQUESTS', { color: '#f4dca0', shadow: '#16141f' }).setOrigin(0.5, 0).setScale(2).setDepth(6);
    this.walletText = new PixelText(this, GAME_WIDTH - 10, 8, '', { color: '#9fe8ff', shadow: '#16141f' }).setOrigin(1, 0).setDepth(6);
    this.setWallet(this.wallet);

    // Bram at the bottom.
    this.face = this.add.sprite(IS_PORTRAIT ? 20 : 26, GAME_HEIGHT - 26, 'bram_face', 0).setDepth(6);
    this.bramText = new PixelText(this, IS_PORTRAIT ? 34 : 40, GAME_HEIGHT - 30, '', { color: '#f4efe4', shadow: '#16141f' }).setDepth(6);
    new PixelText(this, GAME_WIDTH / 2, GAME_HEIGHT - 12, IS_TOUCH ? 'TAP A NOTE  •  TAP OUTSIDE TO LEAVE' : '← → READ   ESC BACK', { color: COLORS.faint, shadow: '#16141f' }).setOrigin(0.5, 0).setDepth(6);
    this.add.zone(0, 0, GAME_WIDTH, GAME_HEIGHT).setOrigin(0, 0).setInteractive().on('pointerdown', (p) => {
      if (this.busy) return;
      const i = this.cards.findIndex((c) => c && Math.abs(p.x - c.x) < this.noteW / 2 && Math.abs(p.y - c.y - this.noteH / 2) < this.noteH / 2);
      if (i >= 0) this.select(i); else this.close();
    });

    this.st.active.forEach((n, i) => this.makeCard(n, i, false));
    this.select(0, true);
    this.input.keyboard.on('keydown', this.onKey, this);
    this.events.once('shutdown', () => this.input.keyboard.off('keydown', this.onKey, this));
    Audio.play('cloth');

    // Finished notes: thumbprints and payment, one after another.
    const done = this.st.active.map((n, i) => (n.done ? i : -1)).filter((i) => i >= 0);
    if (done.length) this.payOut(done);
    else this.say(BRAM_IDLE[(this.prog.data.runs || 0) % BRAM_IDLE.length]);
  }

  // ---------------------------------------------------------------- the board
  drawBoard() {
    const g = this.boardG, x = this.bx, y = this.by, w = this.bw, h = this.bh;
    // Post down to the ground, roof on top.
    g.fillStyle(0x3a2414, 1).fillRect(GAME_WIDTH / 2 - 5, y + h, 10, GAME_HEIGHT - y - h);
    g.fillStyle(0x5e3c20, 1).fillRect(GAME_WIDTH / 2 - 4, y + h, 3, GAME_HEIGHT - y - h);
    g.fillStyle(0x3a2414, 1).fillRect(x - 10, y - 8, w + 20, 6);
    g.fillStyle(0x5a3a22, 1).fillRect(x - 8, y - 10, w + 16, 3);
    for (let i = 0; i < (w + 16) / 6; i++) g.fillStyle(i % 2 ? 0x6a4428 : 0x4a2e18, 1).fillRect(x - 8 + i * 6, y - 7, 6, 3);
    // Frame and cork, speckled.
    g.fillStyle(0x16141f, 1).fillRect(x - 5, y - 3, w + 10, h + 7);
    g.fillStyle(0x5e3c20, 1).fillRect(x - 4, y - 2, w + 8, h + 5);
    g.fillStyle(0x8a5a32, 1).fillRect(x - 4, y - 2, w + 8, 1);
    g.fillStyle(0xb4824a, 1).fillRect(x, y + 2, w, h - 2);
    const rng = new SeededRandom(1234);
    for (let i = 0; i < (w * h) / 9; i++) {
      const c = [0x9a6a3a, 0xc89660, 0xa87440, 0xd4a46a][rng.int(0, 3)];
      g.fillStyle(c, 1).fillRect(x + rng.int(0, w - 2), y + 2 + rng.int(0, h - 4), rng.chance(0.2) ? 2 : 1, 1);
    }
    // Old pin holes and a faded rectangle where a note used to be.
    for (let i = 0; i < 14; i++) g.fillStyle(0x5a3a1a, 1).fillRect(x + rng.int(4, w - 4), y + rng.int(6, h - 6), 1, 1);
    g.fillStyle(0xc8a070, 0.5).fillRect(x + w - 30, y + h - 22, 22, 16);
  }

  setWallet(v) { this.walletText.setText(`◆${Math.round(v)}`); }

  // A note at slot i. drop: pin it in from above (a new note).
  makeCard(note, i, drop) {
    const P = PAPER[REQUEST_BY_ID[note.id].who] || PAPER.bram;
    const who = whoOf(note);
    const cx = this.bx + this.gap + i * (this.noteW + this.gap) + this.noteW / 2;
    const cy = this.by + 18;
    const c = this.add.container(cx, cy).setDepth(3);
    const W = this.noteW, H = this.noteH;
    const g = this.add.graphics();
    // Paper with a torn edge and a soft shadow.
    g.fillStyle(0x000000, 0.25).fillRect(-W / 2 + 3, 3, W, H);
    g.fillStyle(P.edge, 1).fillRect(-W / 2, 0, W, H);
    g.fillStyle(P.fill, 1).fillRect(-W / 2 + 1, 1, W - 2, H - 2);
    const rng = new SeededRandom(note.id.length * 31 + i);
    if (P.style === 'ruled') { for (let y = 26; y < H - 6; y += 9) g.fillStyle(P.line, 1).fillRect(-W / 2 + 4, y, W - 8, 1); g.fillStyle(0xd88a8a, 1).fillRect(-W / 2 + 8, 2, 1, H - 4); for (let x = -W / 2; x < W / 2; x += 3) g.fillStyle(P.edge, 1).fillRect(x, 0, 2, rng.int(1, 2)); }
    if (P.style === 'grid') { for (let y = 6; y < H - 2; y += 6) g.fillStyle(P.line, 1).fillRect(-W / 2 + 2, y, W - 4, 1); for (let x = -W / 2 + 6; x < W / 2 - 2; x += 6) g.fillStyle(P.line, 1).fillRect(x, 2, 1, H - 4); }
    if (P.style === 'postcard') { g.fillStyle(P.line, 1).fillRect(W / 2 - 18, 4, 14, 16); g.fillStyle(0xc8463b, 1).fillRect(W / 2 - 16, 6, 10, 12); g.fillStyle(0xf6f4ee, 1).fillRect(W / 2 - 13, 9, 4, 5); g.fillStyle(P.line, 1).fillRect(-W / 2 + 4, H - 14, W - 8, 1); }
    if (P.style === 'crayon') { for (let k = 0; k < 6; k++) g.fillStyle([0xd84a3a, 0x4a8ad8, 0x4ab84a][k % 3], 1).fillRect(W / 2 - 20 + k * 3, H - 14 + (k % 2) * 2, 2, 2); g.fillStyle(0xf8f0a8, 1).fillCircle(W / 2 - 12, 12, 5); }
    if (P.style === 'brush') { for (let k = 0; k < 18; k++) g.fillStyle(0x5a2a10, 0.5).fillRect(-W / 2 + 6 + k * 2, H - 12 + Math.round(Math.sin(k / 3) * 2), 2, 2); }
    if (P.style === 'plain') { g.fillStyle(P.line, 1).fillTriangle(-W / 2 + 1, 1, -W / 2 + 14, 1, -W / 2 + 1, 14); }
    c.add(g);
    // Who wrote it, what they want, and how far you have got.
    const pad = 6, tw = W - pad * 2;
    const head = new PixelText(this, -W / 2 + pad, 6, who.title ? `${who.name}` : 'BRAM', { color: P.ink, shadow: null });
    c.add(head);
    if (who.title) c.add(new PixelText(this, -W / 2 + pad, 15, who.title, { color: P.ink, shadow: null }).setAlpha(0.6));
    const body = new PixelText(this, -W / 2 + pad, who.title ? 28 : 20, wrap(note.text, tw), { color: P.ink, shadow: null });
    c.add(body);
    const prog = new PixelText(this, -W / 2 + pad, H - 26, note.done ? 'DONE!' : `BEST RUN: ${Math.floor(note.best || 0)}/${note.goal}`, { color: note.done ? '#c8263a' : P.ink, shadow: null }).setAlpha(note.done ? 1 : 0.75);
    c.add(prog);
    const bar = this.add.graphics();
    const k = Math.min(1, (note.best || 0) / note.goal);
    bar.fillStyle(0x000000, 0.15).fillRect(-W / 2 + pad, H - 16, tw - 34, 3);
    bar.fillStyle(note.done ? 0xc8263a : 0x4a8a3a, 1).fillRect(-W / 2 + pad, H - 16, Math.round((tw - 34) * k), 3);
    c.add(bar);
    c.add(new PixelText(this, W / 2 - pad, H - 18, `◆${Math.round(note.gems)}`, { color: '#2a6ab8', shadow: null }).setOrigin(1, 0));
    // The thumbprint (hidden until paid).
    const thumb = this.add.graphics().setVisible(false);
    for (let r = 2; r <= 12; r += 2) for (let a = 0; a < Math.PI * 2; a += 0.12) {
      if (Math.sin(a * 3 + r) > 0.75) continue;
      thumb.fillStyle(0xc8263a, 0.85).fillRect(Math.round(Math.cos(a) * r * 0.8), Math.round(Math.sin(a) * r), 1, 1);
    }
    thumb.setPosition(W / 2 - 22, H / 2 + 4);
    c.add(thumb);
    // The pin.
    const pin = this.add.graphics();
    pin.fillStyle(0x16141f, 1).fillCircle(0, 2, 3);
    pin.fillStyle(0xd83a22, 1).fillCircle(0, 1, 2.5);
    pin.fillStyle(0xff9a8a, 1).fillRect(-1, 0, 1, 1);
    c.add(pin);
    const card = { c, x: cx, y: cy, note, thumb, sway: rng.next() * 6, lift: 0 };
    this.cards[i] = card;
    if (drop) {
      c.y = -this.noteH - 20;
      c.setAngle(-8 + rng.next() * 16);
      this.tweens.add({ targets: c, y: cy, angle: 0, duration: 520, ease: 'Back.easeOut', onComplete: () => { Audio.play('clack'); this.pinPop(cx, cy); } });
    }
    return card;
  }

  pinPop(x, y) {
    const g = this.add.graphics().setDepth(5);
    let r = 2;
    this.tweens.addCounter({ from: 0, to: 1, duration: 300, onUpdate: (tw) => { const v = tw.getValue(); g.clear().lineStyle(1, 0xffffff, 1 - v).strokeCircle(x, y + 1, 2 + v * 8); }, onComplete: () => g.destroy() });
    return r;
  }

  select(i, quiet = false) {
    this.index = i;
    if (!quiet) Audio.play('ui');
    const n = this.cards[i] && this.cards[i].note;
    if (n && !this.busy) {
      const r = REQUEST_BY_ID[n.id];
      const who = whoOf(n);
      this.say(n.done ? 'THAT ONE IS DONE. I WILL PAY YOU OUT.' : r.story ? `${who.name} PINNED THAT ONE UP. IT MATTERS TO THEM.` : r.kind === 'find' ? 'KEEP YOUR EYES OPEN UP THERE.' : r.kind === 'reach' ? 'HIGH ENOUGH AND IT IS YOURS.' : 'THAT IS A MATTER OF RHYTHM.');
    }
  }

  say(text) {
    this.bramText.setText(wrap(text, GAME_WIDTH - (IS_PORTRAIT ? 44 : 56)));
  }

  // ---------------------------------------------------------------- paying out
  payOut(slots) {
    this.busy = true;
    let total = 0;
    let delay = 500;
    slots.forEach((i) => {
      const card = this.cards[i];
      const gems = Math.round(card.note.gems);
      total += gems;
      this.time.delayedCall(delay, () => {
        this.select(i, true);
        // The thumb comes down hard.
        card.thumb.setVisible(true).setScale(2.4).setAlpha(0);
        this.tweens.add({ targets: card.thumb, scale: 1, alpha: 1, duration: 160, ease: 'Quad.easeIn', onComplete: () => {
          Audio.play('stamp');
          this.cameras.main.shake(110, 0.004);
          this.tweens.add({ targets: card.c, scaleX: 1.04, scaleY: 0.96, duration: 70, yoyo: true });
          this.gemBurst(card.x + this.noteW / 2 - 22, card.y + this.noteH / 2 + 4, gems);
        } });
        const thanks = REQUEST_BY_ID[card.note.id].story ? card.note.thanks : null;
        this.say(thanks || BRAM_PAID[i % BRAM_PAID.length]);
      });
      delay += 1100;
      // Then torn off: it twists, drops and is gone.
      this.time.delayedCall(delay - 300, () => {
        Audio.play('cloth');
        this.tweens.add({ targets: card.c, y: GAME_HEIGHT + 40, angle: 25 - Math.random() * 50, duration: 700, ease: 'Quad.easeIn', onComplete: () => card.c.destroy() });
      });
    });
    this.time.delayedCall(delay + 400, () => {
      const paid = collectRequests(this.prog.data);
      const sum = paid.reduce((a, p) => a + p.gems, 0) || total;
      this.prog.addGems(sum);
      ensureRequests(this.prog.data);
      this.prog.save();
      // The camp may look different now (a friend at the fire).
      this.registry.set('campChanged', true);
      // New notes pinned where the old ones were.
      const st = this.prog.data.requests;
      slots.forEach((i, k) => {
        const n = st.active.find((a) => !this.cards.some((c) => c && c.note === a));
        if (!n) return;
        this.time.delayedCall(k * 260, () => this.makeCard(n, i, true));
      });
      // Keep the board in the save's order from now on.
      this.time.delayedCall(slots.length * 260 + 600, () => {
        this.cards = st.active.map((n) => this.cards.find((c) => c && c.note === n)).filter(Boolean);
        this.busy = false;
      });
    });
  }

  gemBurst(x, y, gems) {
    const tx = GAME_WIDTH - 24, ty = 12;
    const n = Math.min(12, 4 + Math.floor(gems / 10));
    for (let k = 0; k < n; k++) {
      const s = this.add.image(x, y, 'glow_small').setBlendMode('ADD').setTint(0x9fe8ff).setScale(0.7).setDepth(7);
      const mx = x + (Math.random() - 0.5) * 50, my = y - 20 - Math.random() * 30;
      this.tweens.add({ targets: s, x: mx, y: my, duration: 260, ease: 'Quad.easeOut', onComplete: () => {
        this.tweens.add({ targets: s, x: tx, y: ty, duration: 380 + k * 30, ease: 'Quad.easeIn', onComplete: () => {
          s.destroy();
          this.wallet += gems / n;
          this.setWallet(this.wallet);
          if (k % 3 === 0) Audio.play('gem');
        } });
      } });
    }
  }

  // ---------------------------------------------------------------- input
  onKey(e) {
    if (e.repeat) return;
    switch (e.code) {
      case 'ArrowLeft': case 'KeyA': if (!this.busy) this.select((this.index + 2) % 3); break;
      case 'ArrowRight': case 'KeyD': if (!this.busy) this.select((this.index + 1) % 3); break;
      case 'Escape': case 'Backspace': case 'Space': case 'Enter': this.close(); break;
      default: break;
    }
  }

  close() {
    if (this.busy) return;
    Audio.play('cloth');
    this.scene.stop();
    this.scene.resume(this.returnTo);
  }

  update(time, delta) {
    this.t += delta;
    // The lantern swings on its hook and the light breathes with it.
    const sw = Math.sin(this.t / 900) * 3;
    const g = this.lanternG.clear();
    g.fillStyle(0x3a3440, 1).fillRect(39, 0, 1, 12);
    g.fillStyle(0x16141f, 1).fillRect(Math.round(36 + sw), 12, 8, 11);
    g.fillStyle(0xffd070, 1).fillRect(Math.round(38 + sw), 14, 4, 7);
    g.fillStyle(0x5a4a3a, 1).fillRect(Math.round(35 + sw), 11, 10, 2);
    this.lanternGlow.setPosition(40 + sw, 22).setAlpha(0.2 + Math.sin(this.t / 120) * 0.02);
    // Cards sway gently on their pins; the chosen one lifts off the cork.
    this.cards.forEach((c, i) => {
      if (!c || !c.c.active || this.busy) return;
      c.lift += ((i === this.index ? 1 : 0) - c.lift) * Math.min(1, delta / 120);
      c.c.setAngle(Math.sin(this.t / 1400 + c.sway) * 1.2 * (1 + c.lift)).setY(c.y - Math.round(c.lift * 3)).setScale(1 + c.lift * 0.04);
      c.c.setAlpha(0.82 + c.lift * 0.18);
    });
    // The string strung from pin to pin across the board.
    const sg = this.stringG.clear();
    const pins = this.cards.filter((c) => c && c.c.active).map((c) => [c.c.x, c.c.y + 1]).sort((a, b) => a[0] - b[0]);
    const ends = [[this.bx + 3, this.by + 10], ...pins, [this.bx + this.bw - 3, this.by + 10]];
    for (let k = 1; k < ends.length; k++) {
      const [x0, y0] = ends[k - 1], [x1, y1] = ends[k];
      const len = Math.max(1, Math.round(Math.abs(x1 - x0)));
      for (let s = 0; s <= len; s++) {
        const t = s / len;
        const y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * 4;
        sg.fillStyle(0xe8dcc0, 0.9).fillRect(Math.round(x0 + (x1 - x0) * t), Math.round(y), 1, 1);
      }
    }
  }
}
