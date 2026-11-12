import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, IS_PORTRAIT, IS_TOUCH } from '../config/gameConfig.js';
import { PixelText, COLORS } from '../ui/PixelText.js';
import { measureLine } from '../utils/pixelFont.js';
import { PETS, STAGES, petState, petMeters, petStage } from '../data/pets.js';
import { buildPetTextures, buildPenTextures } from '../render/petArt.js';
import { PixelGrid, makeCanvas } from '../utils/pixelGrid.js';
import { rampAt, makeRamp } from '../render/pixelKit.js';
import { makeNoise2D } from '../utils/seededRandom.js';
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

    // The painted backdrop: dusk sky, mountains, the shed wall, a straw floor.
    this.floorY = Math.round(H * 0.55);
    buildPenTextures(this);
    this.add.image(0, 0, paintPenBackdrop(this, this.floorY)).setOrigin(0, 0);
    this.add.zone(0, 0, W, H).setOrigin(0, 0).setInteractive();
    this.back = this.add.graphics();
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
      const home = this.add.image(x, this.floorY + 6, `pethome_${p.home}`).setOrigin(0.5, 1).setScale(2).setDepth(1.2);
      if (!unlocked) home.setTint(0x8a7a8a);
      // On the bale, at the hive's door, beside the lantern, in the nest.
      const px = p.id === 'moth' ? x + 30 : p.id === 'bee' ? x + 18 : x;
      const py = p.id === 'kid' ? this.floorY - 28 : p.id === 'bee' ? this.floorY - 40 : p.id === 'moth' ? this.floorY - 46 : this.floorY - 12;
      const sprite = this.add.sprite(px, py, `pet_${p.id}_${stage}`, 0).setOrigin(0.5, 1).setScale(0).setDepth(3);
      if (!unlocked) sprite.setTintFill(0x1a1020).setAlpha(0.5);
      const zone = this.add.zone(x - 40, this.floorY - 100, 80, 110).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(6);
      zone.on('pointerdown', () => { if (this.index === i) this.toggle(); else this.select(i); });
      return { p, x, unlocked, stage, flying, sprite, hop: 0, baseY: sprite.y };
    });
    // The gate swings open, then the pets pop out of their homes one by one.
    this.tweens.add({ targets: this, gate: 1, duration: 600, ease: 'Back.easeOut' });
    Audio.play('creak');
    this.homes.forEach((h, i) => this.time.delayedCall(350 + i * 160, () => {
      this.tweens.add({ targets: h.sprite, scale: 2, duration: 320, ease: 'Back.easeOut' });
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

  // Light and marks round each home: the spotlight on the chosen one, the
  // lantern's and the embers' glow, a red ribbon on the one coming along, a
  // chalked "?" on an empty home. And the string of lights along the shed.
  drawHomes() {
    const g = this.homesG.clear(), gl = this.glowG.clear(), fy = this.floorY, t = this.t;
    for (let x = 6; x < W; x += 22) {
      const y = Math.round(this.wallTop + 8 + Math.sin(((x % 132) / 132) * Math.PI) * 6);
      const on = 0.7 + 0.3 * Math.sin(t / 400 + x);
      gl.fillStyle([0xffc860, 0xff8a6a, 0x9fe8a0, 0x8ac8ff][(x / 22) % 4 | 0], 0.25 * on).fillCircle(x, y + 2, 4);
      g.fillStyle(0xfff0c0, 1).fillRect(x, y + 1, 1, 2);
    }
    this.homes.forEach((h, i) => {
      const x = h.x, sel = i === this.index;
      if (sel) { gl.fillStyle(0xffd6a0, 0.14).fillEllipse(x, fy + 5, 96, 18); gl.fillStyle(0xffd6a0, 0.08).fillEllipse(x, fy + 5, 60, 10); }
      if (h.p.home === 'lantern' && h.unlocked !== null) {
        const fl = 0.8 + 0.2 * Math.sin(t / 90);
        gl.fillStyle(0xffc060, 0.16 * fl).fillCircle(x + 3, fy - 52, 26);
        gl.fillStyle(0xffe0a0, 0.18 * fl).fillCircle(x + 3, fy - 52, 10);
      }
      if (h.p.home === 'stone') {
        const fl = 0.7 + 0.3 * Math.sin(t / 260);
        gl.fillStyle(0xff6a1a, 0.18 * fl).fillEllipse(x, fy - 8, 50, 16);
        for (let k = 0; k < 3; k++) {
          const sy = fy - 14 - ((t / 20 + k * 13) % 30);
          gl.fillStyle(0xffa040, 0.5).fillRect(Math.round(x - 6 + k * 6 + Math.sin(t / 300 + k) * 3), Math.round(sy), 1, 1);
        }
      }
      if (!h.unlocked) g.fillStyle(0xf4efe4, 0.6).fillRect(x - 2, fy - 64, 5, 1).fillRect(x + 3, fy - 63, 1, 4).fillRect(x, fy - 59, 3, 1).fillRect(x, fy - 57, 1, 2).fillRect(x, fy - 54, 1, 1);
      if (this.d.pets.active === h.p.id && h.unlocked) {
        g.fillStyle(0x7a1420, 1).fillRect(x - 24, fy + 8, 48, 1);
        g.fillStyle(0xc8263a, 1).fillRect(x - 24, fy + 6, 48, 2);
        g.fillStyle(0xc8263a, 1).fillTriangle(x - 2, fy + 7, x - 9, fy + 15, x - 3, fy + 15).fillTriangle(x + 2, fy + 7, x + 9, fy + 15, x + 3, fy + 15);
        g.fillStyle(0xff6a7a, 1).fillRect(x - 1, fy + 5, 3, 3);
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
  }
}

// The pen's backdrop, painted once per screen size: a dusk sky with stars and
// a big moon, two ranges of mountains, the plank wall of the pets' shed (with
// a warm window, a coil of rope and a horseshoe on nails), and a floor of
// boards under scattered straw. The scene keeps wallTop for the fairy lights.
function paintPenBackdrop(scene, floorY) {
  const key = `pen_bg_${W}_${H}_${floorY}`;
  const wallTop = Math.round(floorY - H * 0.3);
  scene.wallTop = wallTop;
  if (scene.textures.exists(key)) return key;
  const g = new PixelGrid(W, H);
  const noise = makeNoise2D(611);
  const sky = makeRamp(0x1c1438, 0x6a3a6a, 0xf0a070, 7);
  for (let y = 0; y < wallTop + 4; y++) for (let x = 0; x < W; x++) g.set(x, y, rampAt(sky, (y / (wallTop + 4)) ** 1.2, x, y));
  for (let i = 0; i < 70; i++) { const x = (i * 97) % W, y = (i * 37) % Math.max(1, wallTop - 40); g.set(x, y, i % 4 ? 0xd8d0f0 : 0xffffff); }
  // The moon.
  const mx = Math.round(W * 0.18), my = Math.round(wallTop * 0.35);
  for (let y = -9; y <= 9; y++) for (let x = -9; x <= 9; x++) { const d = Math.hypot(x, y); if (d <= 8.5) g.set(mx + x, my + y, d > 7 ? 0xd8d4c8 : noise(x * 0.4, y * 0.4) > 0.62 ? 0xc8c4b8 : 0xf4f0e4); }
  // Two ranges of mountains, the near one darker, snow on the tops.
  for (const [base, amp, col, snow, f] of [[wallTop - 6, 46, 0x4a3a6a, 0x9a90c0, 0.012], [wallTop + 2, 30, 0x2e2244, 0x6a6090, 0.022]]) {
    for (let x = 0; x < W; x++) {
      const top = Math.round(base - amp * (0.5 + 0.5 * Math.sin(x * f + base)) * (0.6 + noise(x * f * 2, base) * 0.6));
      for (let y = top; y < wallTop + 4; y++) g.set(x, y, y < top + 3 + (x % 3) ? snow : col);
    }
  }
  // The shed wall: planks with grain, posts, nails.
  const plank = makeRamp(0x2a160c, 0x5a3a22, 0x8a5e38, 5);
  for (let y = wallTop; y < floorY; y++) {
    const row = Math.floor((y - wallTop) / 7), ry = (y - wallTop) % 7;
    for (let x = 0; x < W; x++) {
      const grain = noise(x * 0.05 + row * 9, y * 0.6) - 0.5;
      let k = 0.5 + grain * 0.5 + (row % 2 ? 0.06 : -0.04) - ((y - wallTop) / (floorY - wallTop)) * 0.25;
      if (ry === 6) k = 0.05; else if (ry === 0) k += 0.18;
      g.set(x, y, rampAt(plank, k, x, y));
    }
  }
  for (let x = 30; x < W; x += 96) {
    for (let y = wallTop - 6; y < floorY; y++) for (let k = 0; k < 6; k++) g.set(x + k, y, rampAt(plank, k === 0 ? 0.8 : k === 5 ? 0.05 : 0.38 + noise(k, y * 0.3) * 0.2, x + k, y));
    for (let y = wallTop + 3; y < floorY; y += 14) g.set(x + 2, y, 0x9a9090);
  }
  // A roof edge with a dark shadow under it.
  for (let x = 0; x < W; x++) { for (let k = 0; k < 4; k++) g.set(x, wallTop - 4 + k, k === 0 ? 0x8a5e38 : 0x2a160c); g.set(x, wallTop, 0x1a0e08); }
  // A warm window with four panes.
  const wx = Math.round(W * 0.76), wy = wallTop + 8, ww = 30, wh = 22;
  for (let y = 0; y < wh; y++) for (let x = 0; x < ww; x++) {
    const frame = x < 2 || y < 2 || x >= ww - 2 || y >= wh - 2 || x === ww / 2 || y === wh / 2;
    g.set(wx + x, wy + y, frame ? 0x2a160c : rampAt([0xc86a2a, 0xf0a040, 0xffd890, 0xfff2cc], 0.9 - y / wh * 0.6 - Math.abs(x - ww / 2) / ww * 0.4, x, y));
  }
  for (let x = -2; x < ww + 2; x++) g.set(wx + x, wy + wh, 0x8a5e38);
  // A coil of rope and a horseshoe hanging on nails.
  const rx = Math.round(W * 0.42), ry = wallTop + 10;
  for (let a = 0; a < 3; a++) for (let t = 0; t < 40; t++) { const ang = (t / 40) * Math.PI * 2; g.set(Math.round(rx + Math.cos(ang) * (7 - a)), Math.round(ry + 6 + Math.sin(ang) * (6 - a)), (t + a) % 3 ? 0xc8a064 : 0x8a6a3a); }
  g.set(rx, ry - 1, 0x9a9090);
  const hx = Math.round(W * 0.6), hy = wallTop + 12;
  for (let t = 0; t < 30; t++) { const ang = Math.PI * 0.15 + (t / 30) * Math.PI * 1.7; g.set(Math.round(hx + Math.cos(ang) * 4), Math.round(hy + 4 - Math.sin(ang) * 5), t % 4 ? 0x6a6470 : 0xa8a2b0); }
  // The floor: boards in perspective under scattered straw, darker in front.
  const board = makeRamp(0x3a2412, 0x7a5228, 0xa8783c, 5);
  for (let y = floorY; y < H; y++) for (let x = 0; x < W; x++) {
    const d = (y - floorY) / (H - floorY);
    const seam = Math.round((x - W / 2) / (18 + d * 30)) !== Math.round((x + 1 - W / 2) / (18 + d * 30));
    let k = 0.55 - d * 0.35 + (noise(x * 0.08, y * 0.3) - 0.5) * 0.25;
    if (seam) k -= 0.3;
    g.set(x, y, rampAt(board, k, x, y));
  }
  for (let x = 0; x < W; x++) for (let k = 0; k < 4; k++) g.set(x, floorY + k, rampAt(board, 0.12 + k * 0.05, x, floorY + k));
  for (let i = 0; i < 520; i++) {
    const x = (i * 53.7) % W, y = floorY + 3 + ((i * 29.3) % (H - floorY - 3));
    const c = i % 3 === 0 ? 0xf0d080 : i % 3 === 1 ? 0xd8b058 : 0xa88038;
    g.set(x, y, c); g.set(x + 1, y + (i % 2), c); if (i % 4 === 0) g.set(x + 2, y + 1, c);
  }
  const c = makeCanvas(W, H);
  g.drawTo(c.getContext('2d'));
  scene.textures.addCanvas(key, c);
  return key;
}
