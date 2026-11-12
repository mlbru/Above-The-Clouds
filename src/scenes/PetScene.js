import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, IS_PORTRAIT, IS_TOUCH } from '../config/gameConfig.js';
import { PixelText, COLORS } from '../ui/PixelText.js';
import { measureLine } from '../utils/pixelFont.js';
import { PETS, STAGES, petState, petMeters, petStage } from '../data/pets.js';
import { buildPetTextures } from '../render/petArt.js';
import { Audio } from '../systems/AudioSystem.js';
import { lerpColor } from '../utils/color.js';

// THE PEN: the pets' corner of base camp at dusk. A split-rail fence, a bed
// of straw, fireflies, and four homes in a row: a hay bale for the goat kid,
// a little hive box for the bee, a lantern on a post for the moth, a warm
// stone with glowing cracks for the dragonling. The gate swings open as you
// come in and the pets pop out one by one. Pick one (← →) and it shows off;
// SPACE takes it along on your runs (a red ribbon goes round its home), or
// leaves it at camp. A wooden sign shows how big it has grown, measured
// against a notched post: BABY, YOUNG, GROWN. Locked homes stand empty with
// a chalked silhouette and what it takes to find that pet.
// Launched over the title camp (data: { returnTo }), which waits paused.
const INK = '#2a1a0e';
const W = GAME_WIDTH, H = GAME_HEIGHT;
const SOUNDS = { kid: 'bleat', bee: 'buzz', moth: 'flutter', dragonling: 'flame' };

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

export class PetScene extends Phaser.Scene {
  constructor() { super('Pets'); }

  init(data) { this.returnTo = data.returnTo || 'Menu'; }

  create() {
    this.prog = this.registry.get('progression');
    this.d = this.prog.data;
    petState(this.d);
    buildPetTextures(this);
    this.t = 0;
    this.index = Math.max(0, PETS.findIndex((p) => p.id === this.d.pets.active));
    this.texts = [];
    this.gate = 0;

    // Dusk: violet overhead, orange at the horizon, the first stars.
    const sky = this.add.graphics();
    for (let i = 0; i < 20; i++) sky.fillStyle(lerpColor(0x241a40, 0xe0905a, (i / 19) ** 1.6), 1).fillRect(0, Math.floor((i * H) / 20), W, Math.ceil(H / 20) + 1);
    for (let i = 0; i < 40; i++) sky.fillStyle(0xffffff, 0.3 + (i % 5) * 0.12).fillRect(Math.round((i * 97.1) % W), Math.round((i * 31.7) % (H * 0.35)), 1, 1);
    // Far hills and the camp's tent and fire far off.
    for (let x = 0; x < W; x++) {
      const hy = Math.round(H * 0.5 + Math.sin(x / 37) * 6 + Math.sin(x / 13) * 2);
      sky.fillStyle(0x3a2a40, 1).fillRect(x, hy, 1, H - hy);
    }
    this.add.zone(0, 0, W, H).setOrigin(0, 0).setInteractive();
    this.floorY = Math.round(H * 0.5);
    this.back = this.add.graphics();
    this.drawPen();
    this.homesG = this.add.graphics().setDepth(1);
    this.glowG = this.add.graphics().setDepth(1.5).setBlendMode('ADD');
    this.front = this.add.graphics().setDepth(4);
    this.fireflies = Array.from({ length: 16 }, (_, i) => ({ x: (i * 53.3) % W, y: H * 0.3 + ((i * 29.7) % (H * 0.35)), ph: i }));

    // The four homes and their pets.
    const n = PETS.length, span = Math.min(W - 40, IS_PORTRAIT ? 270 : 360);
    this.homes = PETS.map((p, i) => {
      const x = Math.round(W / 2 - span / 2 + (span / (n - 1)) * i);
      const unlocked = p.unlocked(this.d);
      const stage = petStage(this.d, p.id);
      const flying = p.id === 'bee' || p.id === 'moth';
      // The bee hovers over its hive roof, the moth beside its lantern.
      const px = p.id === 'moth' ? x + 14 : x;
      const py = p.id === 'bee' ? this.floorY - 44 : p.id === 'moth' ? this.floorY - 22 : p.id === 'dragonling' ? this.floorY - 8 : this.floorY - 10;
      const sprite = this.add.sprite(px, py, `pet_${p.id}_${stage}`, 0).setOrigin(0.5, 1).setScale(0).setDepth(3);
      if (!unlocked) sprite.setTintFill(0x1a1020).setAlpha(0.5);
      const zone = this.add.zone(x - 34, this.floorY - 70, 68, 84).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(6);
      zone.on('pointerdown', () => { if (this.index === i) this.toggle(); else this.select(i); });
      return { p, x, unlocked, stage, flying, sprite, hop: 0, baseY: sprite.y };
    });
    // The gate swings open, then the pets pop out of their homes one by one.
    this.tweens.add({ targets: this, gate: 1, duration: 600, ease: 'Back.easeOut' });
    Audio.play('creak');
    this.homes.forEach((h, i) => this.time.delayedCall(350 + i * 160, () => {
      this.tweens.add({ targets: h.sprite, scale: 3, duration: 320, ease: 'Back.easeOut' });
      if (h.unlocked) this.puff(h.x, this.floorY - 4);
    }));

    // The sign, the measuring post, Bram.
    this.title = new PixelText(this, W / 2, IS_PORTRAIT ? 34 : 8, 'THE PEN', { color: '#ffd6a0', shadow: '#16141f' }).setOrigin(0.5, 0).setScale(2).setDepth(6);
    this.sign = this.add.graphics().setDepth(5);
    this.face = this.add.sprite(IS_PORTRAIT ? 20 : 26, H - 26, 'bram_face', 0).setDepth(6);
    this.bramText = new PixelText(this, IS_PORTRAIT ? 34 : 40, H - 30, '', { color: '#f4efe4', shadow: '#16141f' }).setDepth(6);
    new PixelText(this, W / 2, H - 12, IS_TOUCH ? 'TAP A PET  •  TAP AGAIN TO TAKE IT ALONG' : '← → CHOOSE   SPACE TAKE ALONG   ESC BACK', { color: COLORS.faint, shadow: '#16141f' }).setOrigin(0.5, 0).setDepth(6);
    if (IS_TOUCH) {
      const done = new PixelText(this, W - 10, IS_PORTRAIT ? 36 : 10, 'DONE', { color: COLORS.green, shadow: '#16141f' }).setOrigin(1, 0).setDepth(7).setInteractive({ useHandCursor: true });
      done.on('pointerdown', () => this.close());
    }
    this.input.keyboard.on('keydown', this.onKey, this);
    this.events.once('shutdown', () => this.input.keyboard.off('keydown', this.onKey, this));
    this.select(this.index, true);
  }

  // ---------------------------------------------------------------- scenery
  drawPen() {
    const g = this.back, fy = this.floorY;
    // Straw floor.
    g.fillStyle(0x8a6a30, 1).fillRect(0, fy, W, H - fy);
    g.fillStyle(0xb8903c, 1).fillRect(0, fy, W, 4);
    for (let i = 0; i < 260; i++) {
      const x = (i * 37.3) % W, y = fy + 2 + ((i * 17.9) % (H - fy - 30));
      g.fillStyle(i % 3 ? 0xd8b058 : 0xf0d080, 1).fillRect(Math.round(x), Math.round(y), 3, 1);
    }
    // The back fence.
    for (let x = 8; x < W; x += 44) { g.fillStyle(0x3a2414, 1).fillRect(x, fy - 34, 5, 36); g.fillStyle(0x7a5232, 1).fillRect(x, fy - 34, 1, 36); }
    for (const ry of [fy - 28, fy - 16]) { g.fillStyle(0x5e3c20, 1).fillRect(0, ry, W, 4); g.fillStyle(0x8a5a32, 1).fillRect(0, ry, W, 1); }
  }

  // A home for each pet, behind its sprite.
  drawHomes() {
    const g = this.homesG.clear(), gl = this.glowG.clear(), fy = this.floorY, t = this.t;
    this.homes.forEach((h, i) => {
      const x = h.x, sel = i === this.index;
      // The spotlight on the chosen one.
      if (sel) { gl.fillStyle(0xffd6a0, 0.12).fillEllipse(x, fy, 70, 14); gl.fillStyle(0xffd6a0, 0.08).fillEllipse(x, fy, 46, 8); }
      if (h.p.home === 'hay') {
        g.fillStyle(0x6a5020, 1).fillRect(x - 20, fy - 10, 40, 12);
        g.fillStyle(0xd8b058, 1).fillRect(x - 19, fy - 11, 38, 12);
        for (let k = 0; k < 9; k++) g.fillStyle(0xb8903c, 1).fillRect(x - 17 + k * 4, fy - 10, 1, 10);
        g.fillStyle(0x8a3a2a, 1).fillRect(x - 6, fy - 11, 2, 12).fillRect(x + 5, fy - 11, 2, 12);
      } else if (h.p.home === 'hive') {
        g.fillStyle(0x3a2414, 1).fillRect(x - 3, fy - 16, 6, 17);
        g.fillStyle(0x5e3c20, 1).fillRect(x - 13, fy - 34, 26, 19);
        g.fillStyle(0xa8743e, 1).fillRect(x - 12, fy - 33, 24, 17);
        g.fillStyle(0x8a5a32, 1).fillRect(x - 12, fy - 27, 24, 1).fillRect(x - 12, fy - 21, 24, 1);
        g.fillStyle(0x16141f, 1).fillRect(x - 2, fy - 20, 4, 2);
        g.fillStyle(0x6a3a2a, 1).fillTriangle(x - 16, fy - 33, x + 16, fy - 33, x, fy - 42);
      } else if (h.p.home === 'lantern') {
        g.fillStyle(0x3a2414, 1).fillRect(x - 14, fy - 46, 3, 47).fillRect(x - 14, fy - 46, 16, 2);
        const sw = Math.round(Math.sin(t / 700) * 1.5);
        g.fillStyle(0x16141f, 1).fillRect(x + 1 + sw, fy - 44, 1, 6).fillRect(x - 3 + sw, fy - 38, 9, 11);
        const fl = 0.8 + 0.2 * Math.sin(t / 90);
        g.fillStyle(0xffd070, 1).fillRect(x - 2 + sw, fy - 37, 7, 9);
        gl.fillStyle(0xffc060, 0.22 * fl).fillCircle(x + 1 + sw, fy - 33, 18);
      } else {
        g.fillStyle(0x16141f, 1).fillEllipse(x, fy - 4, 40, 14);
        g.fillStyle(0x3a2a2a, 1).fillEllipse(x, fy - 5, 38, 12);
        for (let k = 0; k < 5; k++) {
          const glow = 0.5 + 0.5 * Math.sin(t / 300 + k);
          g.fillStyle(lerpColor(0x8a2a1a, 0xffb040, glow), 1).fillRect(x - 14 + k * 7, fy - 6 + (k % 2), 4, 1);
        }
        gl.fillStyle(0xff6a1a, 0.12).fillEllipse(x, fy - 6, 44, 14);
        // Heat shimmering up off it.
        for (let k = 0; k < 4; k++) g.fillStyle(0xffffff, 0.08).fillRect(x - 6 + k * 4 + Math.round(Math.sin(t / 200 + k) * 2), fy - 16 - ((t / 30 + k * 7) % 16), 1, 3);
      }
      // Locked: a chalked "?" over the empty home.
      if (!h.unlocked) g.fillStyle(0xf4efe4, 0.5).fillRect(x - 1, fy - 52, 3, 1).fillRect(x + 2, fy - 51, 1, 3).fillRect(x, fy - 48, 2, 1).fillRect(x, fy - 46, 1, 1).fillRect(x, fy - 44, 1, 1);
      // Coming along: a red ribbon tied round the home.
      if (this.d.pets.active === h.p.id && h.unlocked) {
        g.fillStyle(0xc8263a, 1).fillRect(x - 20, fy + 3, 40, 2);
        g.fillStyle(0xc8263a, 1).fillTriangle(x - 2, fy + 4, x - 8, fy + 11, x - 3, fy + 11).fillTriangle(x + 2, fy + 4, x + 8, fy + 11, x + 3, fy + 11);
        g.fillStyle(0xff6a7a, 1).fillRect(x - 1, fy + 3, 3, 3);
      }
    });
  }

  // The sign: name, size, the measuring post, the habit, what SPACE does.
  renderSign() {
    this.texts.forEach((t) => t.destroy());
    this.texts = [];
    const h = this.homes[this.index], p = h.p;
    const sw = Math.min(W - 24, 300), sx = Math.round(W / 2 - sw / 2), sy = this.floorY + 18;
    const shH = Math.min(84, H - sy - 38);
    this.signBox = { sx, sy, sw, shH };
    const add = (x, y, s, color, scale = 1) => { const t = new PixelText(this, x, y, s, { color, shadow: null }).setScale(scale).setDepth(6); this.texts.push(t); return t; };
    if (!h.unlocked) {
      add(sx + 10, sy + 8, '???', INK, 2);
      add(sx + 10, sy + 26, wrap(`TO FIND THIS ONE: ${p.hint}`, sw - 20), INK);
      return;
    }
    const m = Math.floor(petMeters(this.d, p.id)), st = petStage(this.d, p.id);
    add(sx + 10, sy + 7, p.name, INK, 2);
    add(sx + sw - 10, sy + 9, STAGES[st].name, '#8a3a1a').setOrigin(1, 0);
    add(sx + 10, sy + 25, `CLIMBED TOGETHER: ${m} M`, INK);
    this.post = { x: sx + 10, y: sy + 37, w: sw - 20, m };
    const habit = add(sx + 10, sy + 50, wrap(p.habit, sw - 20), '#4a3018');
    const along = this.d.pets.active === p.id;
    add(sx + 10, sy + 54 + habit.height, along ? 'COMES ALONG ON EVERY RUN.  SPACE: LEAVE AT CAMP' : 'SPACE: TAKE IT ALONG', along ? '#c8263a' : '#2a6a2a');
  }

  drawSign() {
    const g = this.sign.clear();
    const b = this.signBox;
    if (!b) return;
    const { sx, sy, sw, shH } = b;
    // Two posts and a weathered plank.
    g.fillStyle(0x3a2414, 1).fillRect(sx + 18, sy - 14, 4, 16).fillRect(sx + sw - 22, sy - 14, 4, 16);
    g.fillStyle(0x16141f, 1).fillRect(sx - 1, sy - 1, sw + 2, shH + 2);
    g.fillStyle(0xc89a5a, 1).fillRect(sx, sy, sw, shH);
    g.fillStyle(0xd8b070, 1).fillRect(sx, sy, sw, 2);
    for (let y = sy + 10; y < sy + shH; y += 12) g.fillStyle(0xb8864a, 1).fillRect(sx + 2, y, sw - 4, 1);
    for (const [nx, ny] of [[sx + 3, sy + 3], [sx + sw - 5, sy + 3], [sx + 3, sy + shH - 5], [sx + sw - 5, sy + shH - 5]]) g.fillStyle(0x5a4a3a, 1).fillRect(nx, ny, 2, 2);
    // The measuring post: notches at each size, a chalk mark where it stands now.
    const p = this.post;
    if (p && this.homes[this.index].unlocked) {
      const top = STAGES[STAGES.length - 1].at * 1.25;
      g.fillStyle(0x6a4a2a, 1).fillRect(p.x, p.y + 2, p.w, 3);
      STAGES.forEach((st) => {
        const x = Math.round(p.x + (st.at / top) * p.w);
        g.fillStyle(0x2a1a0e, 1).fillRect(x, p.y, 1, 7);
      });
      const k = Math.min(1, p.m / top);
      const mx = Math.round(p.x + k * p.w * this.grow);
      g.fillStyle(0xffffff, 1).fillRect(p.x, p.y + 3, Math.max(0, mx - p.x), 1);
      g.fillStyle(0xc8263a, 1).fillRect(mx - 1, p.y - 2, 3, 3);
    }
  }

  puff(x, y) {
    for (let i = 0; i < 6; i++) {
      const s = this.add.rectangle(x, y, 2, 1, 0xf0d080).setDepth(4);
      this.tweens.add({ targets: s, x: x + (Math.random() - 0.5) * 30, y: y - 4 - Math.random() * 10, alpha: 0, duration: 500 + Math.random() * 300, onComplete: () => s.destroy() });
    }
  }

  // ---------------------------------------------------------------- input
  select(i, quiet = false) {
    this.index = (i + PETS.length) % PETS.length;
    const h = this.homes[this.index];
    if (!quiet) { Audio.play('ui'); if (h.unlocked) this.hop(h); }
    this.grow = 0;
    this.tweens.add({ targets: this, grow: 1, duration: 600, ease: 'Quad.easeOut' });
    this.renderSign();
    this.say(h.unlocked ? h.p.bram : 'AN EMPTY HOME. SOMETHING WILL MOVE IN ONE DAY.');
  }

  hop(h) {
    if (h.hopping) return;
    h.hopping = true;
    this.tweens.add({ targets: h.sprite, y: h.baseY - 12, duration: 160, ease: 'Quad.easeOut', yoyo: true, onComplete: () => { h.hopping = false; h.sprite.setY(h.baseY); } });
    Audio.play(SOUNDS[h.p.id] || 'ui');
  }

  toggle() {
    const h = this.homes[this.index];
    if (!h.unlocked) { Audio.play('denied'); this.say('NOT YET. ' + h.p.hint); return; }
    const along = this.d.pets.active === h.p.id;
    this.d.pets.active = along ? null : h.p.id;
    this.prog.save();
    this.registry.set('campChanged', true);
    this.hop(h);
    this.puff(h.x, this.floorY - 2);
    Audio.play(along ? 'cloth' : 'select');
    this.say(along ? 'IT WILL WAIT HERE FOR YOU. WITH ME. AS USUAL.' : `THE ${h.p.name} COMES ALONG. KEEP IT OFF THE DRAGON.`);
    this.renderSign();
  }

  say(text) { this.bramText.setText(wrap(text, W - (IS_PORTRAIT ? 44 : 56))); }

  onKey(e) {
    if (e.repeat) return;
    switch (e.code) {
      case 'ArrowLeft': case 'KeyA': this.select(this.index - 1); break;
      case 'ArrowRight': case 'KeyD': this.select(this.index + 1); break;
      case 'Space': case 'Enter': this.toggle(); break;
      case 'Escape': case 'Backspace': this.close(); break;
      default: break;
    }
  }

  close() {
    Audio.play('creak');
    this.scene.stop();
    this.scene.resume(this.returnTo);
  }

  update(time, delta) {
    this.t += delta;
    this.drawHomes();
    this.drawSign();
    // Pets idle: the goat shifts, the bee and moth hover, the dragonling breathes.
    this.homes.forEach((h, i) => {
      const sel = i === this.index;
      const speed = sel ? 1 : 0.5;
      if (h.flying) {
        h.sprite.setFrame(Math.floor((this.t * speed) / 70) % 2);
        if (!h.hopping) h.sprite.setY(Math.round(h.baseY + Math.sin(this.t / 400 + i) * 3));
      } else {
        h.sprite.setFrame(sel && h.unlocked && Math.floor(this.t / 1400) % 3 === 0 ? (h.p.id === 'dragonling' || h.p.id === 'kid' ? 2 : 1) : 0);
      }
      h.sprite.setFlipX(Math.floor(this.t / 3000 + i) % 2 === 1);
    });
    // Fireflies.
    const f = this.front.clear();
    for (const ff of this.fireflies) {
      const x = Math.round(ff.x + Math.sin(this.t / 1300 + ff.ph) * 20), y = Math.round(ff.y + Math.sin(this.t / 900 + ff.ph * 2) * 10);
      const on = Math.sin(this.t / 500 + ff.ph * 3) > 0.2;
      if (on) f.fillStyle(0xf0ff90, 0.9).fillRect(x, y, 1, 1).fillStyle(0xf0ff90, 0.2).fillRect(x - 1, y - 1, 3, 3);
    }
    // The gate swinging open at the left, as you came in.
    const gw = Math.round(40 * (1 - this.gate * 0.85)), gy = this.floorY - 30;
    f.fillStyle(0x3a2414, 1).fillRect(4, gy - 4, 5, 34);
    f.fillStyle(0x5e3c20, 1).fillRect(9, gy + 2, gw, 3).fillRect(9, gy + 14, gw, 3);
    f.fillStyle(0x8a5a32, 1).fillRect(9, gy + 2, gw, 1).fillRect(9, gy + 14, gw, 1);
  }
}
