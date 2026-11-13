import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, IS_TOUCH } from '../config/gameConfig.js';
import { PixelText, COLORS, drawFrame } from '../ui/PixelText.js';
import { BIOMES } from '../data/biomes.js';
import { gemForBiome } from '../data/gems.js';
import { paintCave, caveLayout } from '../render/caveSceneArt.js';
import { creatureKey, creatureFor } from '../render/caveArt.js';
import { lerpColor, toCss } from '../utils/color.js';
import { Audio } from '../systems/AudioSystem.js';

// A hidden cave (idea sheet 1.4), launched over the climb (which waits,
// paused) at the end of a traverse. You stand in the mouth with the sky at
// your back; the room is dark until your headlamp swings round and finds
// what is there. Light pours in through the mouth in shafts with dust
// turning in them, water drips from the stalactites into a puddle, glow-
// worms prick the ceiling. Take the find (each has its own little moment),
// then climb on.
// data: { returnTo, biome, kind, side }
export class CaveScene extends Phaser.Scene {
  constructor() { super('Cave'); }

  init(data) { this.d = data; }

  create() {
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    this.climb = this.scene.get(this.d.returnTo || 'Climb');
    this.biome = BIOMES[this.d.biome] || BIOMES.green;
    this.kind = this.d.kind;
    this.side = this.d.side;
    this.t = 0;
    this.phase = 'reveal';
    this.taken = false;
    this.lay = caveLayout(W, H, this.side);
    this.events.once('shutdown', () => this.input.keyboard.off('keydown', this.onKey, this));
    const key = paintCave(this, { W, H, biome: this.biome, kind: this.kind, side: this.side });
    const M = this.lay.mouth;
    // Layers, back to front.
    this.room = this.add.image(0, 0, key).setOrigin(0, 0);
    // Shafts of light through the mouth, slanting down into the room.
    this.shafts = [0, 1, 2].map((i) => this.add.image(M.x, M.y - M.ry * 0.6 + i * 10, 'far_shaft').setOrigin(0.5, 0)
      .setBlendMode('ADD').setTint(lerpColor(0xffe8c0, (this.biome.backdrop?.sky?.bottom) || 0xffffff, 0.3))
      .setRotation(-this.side * (1.0 + i * 0.16)).setScale(1.3 + i * 0.3, (W / 160) * (1.1 - i * 0.12)).setAlpha(0));
    this.glow = this.add.image(0, 0, `${key}_glow`).setOrigin(0, 0).setBlendMode('ADD').setAlpha(0);
    this.fx = this.add.graphics();
    this.addFx = this.add.graphics().setBlendMode('ADD');
    // The find's own life.
    const F = this.lay.find;
    if (this.kind === 'creature') {
      this.sleeper = this.add.sprite(F.x, F.y + 2, creatureKey(this, this.biome.id), 0).setOrigin(0.5, 1).setScale(2);
      this.sleeper.setFlipX(this.side > 0);
    }
    if (this.kind === 'fossil') this.ember = this.add.image(this.lay.skull.x + (this.side > 0 ? 13 : -13), this.lay.skull.y - 6, 'glow_small').setBlendMode('ADD').setTint(0xff6a2a).setScale(1.4);
    // You, in the mouth: a silhouette against the sky, the lamp on your head.
    const cl = this.textures.exists('climber') ? 'climber' : null;
    this.you = cl ? this.add.sprite(M.x - this.side * 4, this.lay.floor + 2, cl, 'stand').setOrigin(0.5, 1).setTintFill(0x07060a).setFlipX(this.side > 0) : null;
    this.front = this.add.image(0, 0, `${key}_front`).setOrigin(0, 0);
    // The dark that the lamp pushes back.
    this.dark = this.add.rectangle(0, 0, W, H, 0x020104).setOrigin(0, 0).setAlpha(1);
    this.beam = this.add.graphics().setBlendMode('ADD');
    // Life in the room.
    this.motes = Array.from({ length: 40 }, (_, i) => ({ u: Math.random(), v: Math.random(), s: 0.4 + Math.random() * 0.8, p: i * 1.3 }));
    this.drops = this.lay.drips.map((d, i) => ({ ...d, t: i * 900, y0: d.y }));
    this.ripples = [];
    this.worms = Array.from({ length: 36 }, (_, i) => ({ x: Math.round((i * 137.5) % W), y: Math.round(H * 0.06 + ((i * 53) % Math.round(H * 0.22))), p: i * 0.7 }));
    this.sparks = [];
    // Words: the cave's name over the scene, what you found under it.
    this.title = new PixelText(this, W / 2, 10, 'A HIDDEN CAVE', { color: COLORS.gold }).setOrigin(0.5, 0).setScale(2).setAlpha(0);
    this.sub = new PixelText(this, W / 2, 28, `IN ${this.biome.name.replace(/^THE /, 'THE ')}`, { color: COLORS.dim }).setOrigin(0.5, 0).setAlpha(0);
    this.ui = this.add.graphics().setAlpha(0);
    this.what = new PixelText(this, W / 2, H - 52, '', { color: '#ffe08a' }).setOrigin(0.5, 0).setScale(1).setAlpha(0);
    this.line1 = new PixelText(this, W / 2, H - 40, '', { color: '#e8e4dc' }).setOrigin(0.5, 0).setAlpha(0);
    this.line2 = new PixelText(this, W / 2, H - 31, '', { color: '#e8e4dc' }).setOrigin(0.5, 0).setAlpha(0);
    this.button = new PixelText(this, W / 2, H - 17, '', { color: COLORS.text }).setOrigin(0.5, 0).setAlpha(0);
    this.zone = this.add.zone(0, 0, W, H).setOrigin(0, 0).setInteractive();
    this.zone.on('pointerdown', () => this.act());
    this.input.keyboard.on('keydown', this.onKey, this);
    this.setWords(this.teaser(), '', '');
    Audio.play('cloth');
  }

  // Before you take it: what the lamp shows you.
  teaser() {
    const gem = gemForBiome(this.biome.id);
    return {
      cache: [`A POT OF ${gem.name}`, 'TIPPED OVER, SPILLING IN THE DUST.'],
      fossil: ["A DRAGON'S SKULL", 'SET IN THE BACK WALL. SOMETHING GLOWS IN ITS EYE.'],
      page: ['A PAGE PINNED TO A CRATE', 'SOMEONE LEFT IT HERE ON PURPOSE.'],
      creature: [`A ${creatureFor(this.biome.id).name}, ASLEEP`, 'CURLED UP OUT OF THE WIND.'],
    }[this.kind];
  }

  setWords([what, l1], l2 = '', button = null) {
    this.what.setText(what);
    this.line1.setText(l1 || '');
    this.line2.setText(l2 || '');
    const verb = this.kind === 'creature' ? 'SIT WITH IT' : this.kind === 'page' ? 'READ IT' : 'TAKE IT';
    this.button.setText(button || (IS_TOUCH ? `TAP: ${verb}` : `SPACE: ${verb}`));
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const w = Math.max(this.what.width, this.line1.width, this.line2.width, this.button.width) + 24;
    this.ui.clear();
    drawFrame(this.ui, Math.round(W / 2 - w / 2), H - 58, Math.round(w), 54, { accent: this.biome.accentC, alpha: 0.92 });
    this.button.setColor(COLORS.gold);
  }

  onKey(e) {
    if (e.repeat) return;
    if (['Space', 'Enter', 'ArrowUp', 'KeyW', 'ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) this.act();
    else if (e.code === 'Escape' || e.code === 'KeyX') { if (this.taken) this.close(); else this.act(); }
  }

  act() {
    if (this.phase === 'reveal' || this.phase === 'closing') return;
    if (this.page) { this.foldPage(); return; }
    if (!this.taken) this.take();
    else this.close();
  }

  // Take the find: the climb applies the reward, the cave shows it.
  take() {
    this.taken = true;
    const r = this.climb.caveReward(this.kind) || {};
    const W = GAME_WIDTH, H = GAME_HEIGHT, F = this.lay.find;
    this.cameras.main.flash(160, 255, 240, 200);
    if (this.kind === 'cache' || this.kind === 'fossil') {
      // The stones leap up out of the pot (or the socket) and fly away.
      const gem = gemForBiome(this.biome.id);
      const from = this.kind === 'fossil' ? { x: this.ember.x, y: this.ember.y } : { x: F.x + (this.side < 0 ? 28 : -28), y: F.y - 8 };
      if (this.ember) this.tweens.add({ targets: this.ember, alpha: 0, duration: 300 });
      for (let i = 0; i < (r.stones || 3); i++) {
        const img = this.add.image(from.x, from.y, `gem_${gem.id}`).setScale(1.5);
        const tx = W / 2 + (i - (r.stones || 3) / 2) * 14, ty = H * 0.3;
        this.tweens.add({ targets: img, x: tx, y: ty, duration: 420, delay: i * 90, ease: 'Back.easeOut', onComplete: () => {
          this.sparks.push({ x: tx, y: ty, t: 0 });
          this.tweens.add({ targets: img, y: ty - 30, alpha: 0, duration: 500, delay: 500 });
        } });
      }
      Audio.play('gem', { value: gem.value });
    } else if (this.kind === 'creature') {
      // It stirs, opens one eye, tucks its nose back under its tail.
      this.tweens.add({ targets: this.sleeper, scaleY: 2.15, duration: 300, yoyo: true, repeat: 1 });
      for (let i = 0; i < 12; i++) this.time.delayedCall(i * 90, () => this.sparks.push({ x: F.x + (Math.random() - 0.5) * 40, y: F.y - 10 - Math.random() * 20, t: 0, warm: true }));
      Audio.play('checkpoint');
    } else if (this.kind === 'page') {
      this.openPage(r.page || ['', '']);
      Audio.play('cloth');
    }
    this.setWords([r.title || '', r.line1 || ''], r.line2 || '', IS_TOUCH ? 'TAP: CLIMB ON' : 'SPACE: CLIMB ON');
    this.what.setColor(r.color || '#ffe08a');
  }

  // A page: a parchment card rises over the scene, the note written on it.
  openPage([a, b]) {
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const pw = Math.min(W - 40, 280), ph = 92, x0 = Math.round(W / 2 - pw / 2), y0 = Math.round(H / 2 - ph / 2 - 16);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.4).fillRect(x0 + 4, y0 + 5, pw, ph);
    g.fillStyle(0xe8dcb8, 1).fillRect(x0, y0, pw, ph);
    g.fillStyle(0xf4ecd0, 1).fillRect(x0 + 3, y0 + 3, pw - 6, ph - 10);
    // Torn edges, a fold across the middle, a coffee ring, ruled lines.
    for (let x = x0; x < x0 + pw; x += 3) g.fillStyle(0x07060c, 1).fillRect(x, y0 + ph - 1 - ((x * 7) % 3), 3, 2);
    g.fillStyle(0xd8c8a0, 1).fillRect(x0 + 2, y0 + Math.round(ph / 2), pw - 4, 1);
    for (let y = y0 + 22; y < y0 + ph - 12; y += 10) g.fillStyle(0xc8d4e0, 0.6).fillRect(x0 + 10, y, pw - 20, 1);
    g.lineStyle(1, 0xc8a878, 0.6).strokeCircle(x0 + pw - 28, y0 + 22, 11);
    g.fillStyle(0x8a3a2a, 1).fillRect(x0 + 6, y0 + 6, 3, 3);
    const t1 = new PixelText(this, W / 2, y0 + 30, a, { color: '#3a2a1a', shadow: null }).setOrigin(0.5, 0);
    const t2 = new PixelText(this, W / 2, y0 + 44, b, { color: '#3a2a1a', shadow: null }).setOrigin(0.5, 0);
    const head = new PixelText(this, W / 2, y0 + 10, 'A PAGE, PINNED TO A CRATE', { color: '#8a6a4a', shadow: null }).setOrigin(0.5, 0);
    this.page = [g, t1, t2, head];
    this.page.forEach((o) => { o.y += 40; o.setAlpha(0); });
    this.tweens.add({ targets: this.page, y: '-=40', alpha: 1, duration: 380, ease: 'Back.easeOut' });
  }

  foldPage() {
    const p = this.page;
    this.page = null;
    this.tweens.add({ targets: p, alpha: 0, y: '+=30', duration: 260, onComplete: () => p.forEach((o) => o.destroy()) });
  }

  close() {
    this.phase = 'closing';
    this.tweens.add({
      targets: this.dark, alpha: 1, duration: 360,
      onComplete: () => {
        this.scene.stop();
        this.scene.resume(this.d.returnTo || 'Climb');
        this.climb.leaveCave();
      },
    });
  }

  update(time, delta) {
    const dt = Math.min(delta, 50);
    this.t += dt;
    const W = GAME_WIDTH, H = GAME_HEIGHT, M = this.lay.mouth, F = this.lay.find;
    // The reveal: the room comes out of the dark as the lamp swings round
    // from the mouth to the find.
    const rv = Math.min(1, this.t / 1400);
    const e = rv * rv * (3 - 2 * rv);
    if (this.phase === 'reveal') {
      this.dark.setAlpha(1 - e * 0.95);
      if (rv >= 1) {
        this.phase = 'look';
        [this.title, this.sub, this.ui, this.what, this.line1, this.line2, this.button].forEach((o) => this.tweens.add({ targets: o, alpha: 1, duration: 320 }));
        this.sparks.push({ x: F.x, y: F.y - 16, t: 0, ring: true });
        Audio.play('crystal', { dir: 'U' });
      }
    }
    const fl = 0.88 + 0.12 * Math.sin(this.t / 110) * Math.sin(this.t / 47);
    this.glow.setAlpha((0.2 + 0.8 * e) * fl);
    this.shafts.forEach((s, i) => s.setAlpha((0.2 + 0.08 * Math.sin(this.t / 1300 + i * 2)) * e));
    // The lamp: a cone from your head, swinging from the floor to the find.
    const g = this.fx.clear(), a = this.addFx.clear(), b = this.beam.clear();
    const hx = M.x - this.side * 2, hy = this.lay.floor - 42;
    const target = this.phase === 'reveal' ? { x: hx - this.side * W * 0.3 * (1 - e) - this.side * 30, y: H * 0.85 - e * (H * 0.85 - F.y + 14) } : { x: F.x + Math.sin(this.t / 1700) * 10, y: F.y - 14 + Math.sin(this.t / 1300) * 4 };
    const ang = Math.atan2(target.y - hy, target.x - hx), len = Math.hypot(target.x - hx, target.y - hy) + 30;
    for (let i = 0; i < 4; i++) {
      const sp = 0.12 + i * 0.05;
      b.fillStyle(0xfff0c8, (0.05 - i * 0.008) * fl).fillTriangle(hx, hy, hx + Math.cos(ang - sp) * len, hy + Math.sin(ang - sp) * len, hx + Math.cos(ang + sp) * len, hy + Math.sin(ang + sp) * len);
    }
    b.fillStyle(0xfff0c8, 0.12 * fl).fillCircle(target.x, target.y, 22);
    // Dust turning in the shafts of light.
    for (const m of this.motes) {
      m.u = (m.u + dt * 0.00002 * m.s) % 1;
      const x = M.x - this.side * m.u * W * 0.6 + Math.sin(this.t / 900 + m.p) * 6, y = M.y - M.ry * 0.3 + m.u * H * 0.35 + m.v * 30;
      a.fillStyle(0xfff4d8, 0.55 * (1 - m.u) * e).fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    // Glow-worms on the ceiling, twinkling.
    for (const w of this.worms) {
      const tw = 0.5 + 0.5 * Math.sin(this.t / 600 + w.p);
      a.fillStyle(0x9ff8e0, 0.5 * tw * (0.4 + e * 0.6)).fillRect(w.x, w.y, 1, 1);
      if (tw > 0.85) a.fillStyle(0x6ae0c8, 0.2).fillRect(w.x - 1, w.y, 3, 1);
    }
    // Drips: a bead swells at a tip, falls, and rings the puddle.
    const P = this.lay.puddle;
    for (const d of this.drops) {
      d.t += dt;
      const cyc = 2400, k = d.t % cyc;
      if (k < 1400) {
        const s = k / 1400;
        g.fillStyle(0xbfe8ff, 0.4 + s * 0.6).fillRect(d.x, d.y0, 1, 1 + Math.round(s));
      } else {
        const fall = (k - 1400) / 1000;
        const y = d.y0 + fall * fall * (P.y - d.y0);
        if (y < P.y) g.fillStyle(0xd8f4ff, 0.9).fillRect(d.x, Math.round(y), 1, 3);
        if (!d.landed && y >= P.y - 2) { d.landed = true; this.ripples.push({ x: Math.abs(d.x - P.x) < P.rx ? d.x : P.x, y: P.y, t: 0 }); }
      }
      if (k < 100) d.landed = false;
    }
    this.ripples = this.ripples.filter((r) => {
      r.t += dt;
      const k = r.t / 900;
      a.lineStyle(1, 0xbfe8ff, 0.5 * (1 - k)).strokeEllipse(r.x, r.y, 4 + k * 26, 1 + k * 4);
      return k < 1;
    });
    // The find's life.
    if (this.kind === 'cache') {
      for (let i = 0; i < 4; i++) {
        const k = ((this.t / 700 + i * 0.37) % 1);
        const x = F.x + (this.side < 0 ? 30 : -30) - this.side * ((i * 13) % 40), y = F.y - 3 - ((i * 7) % 8);
        if (k < 0.2) { const s = Math.sin(k / 0.2 * Math.PI); a.fillStyle(0xffffff, s).fillRect(x - 2, y, 5, 1).fillRect(x, y - 2, 1, 5); }
      }
    }
    if (this.ember) this.ember.setAlpha((this.taken ? this.ember.alpha : 0.5 + 0.4 * Math.sin(this.t / 400)) * e).setScale(1.2 + 0.3 * Math.sin(this.t / 400));
    if (this.kind === 'page') {
      // The candle: a small flame that leans and flickers.
      const kx = F.x + this.side * 36, ky = F.y - 11;
      const lean = Math.round(Math.sin(this.t / 160) * 1.2);
      g.fillStyle(0xff9a3c, 1).fillRect(kx, ky - 2, 1, 3);
      g.fillStyle(0xffd060, 1).fillRect(kx + lean, ky - 4, 1, 3);
      g.fillStyle(0xfff4c0, 1).fillRect(kx + lean, ky - 5, 1, 1);
      a.fillStyle(0xffb050, 0.12 * fl).fillCircle(kx, ky - 3, 16);
      a.fillStyle(0xffd080, 0.1 * fl).fillCircle(kx, ky - 3, 7);
    }
    if (this.sleeper) {
      this.sleeper.setFrame(Math.floor(this.t / 1200) % 2);
      const zt = (this.t % 2600) / 2600, zx = this.sleeper.x - this.side * (20 + zt * 14), zy = this.sleeper.y - 30 - zt * 26;
      const z = (x, y, s, al) => { g.fillStyle(0xd8e4ff, al).fillRect(x, y, s, 1).fillRect(x + s - 1 - Math.floor(s / 2), y + Math.floor(s / 2), 1, 1).fillRect(x, y + s - 1, s, 1); };
      z(Math.round(zx), Math.round(zy), 4, (1 - zt) * e);
      if (zt > 0.3) z(Math.round(zx - this.side * 8), Math.round(zy - 10), 3, (1 - zt) * 0.7 * e);
    }
    // Sparkles and rings.
    this.sparks = this.sparks.filter((s) => {
      s.t += dt;
      const k = s.t / (s.ring ? 700 : 500);
      if (s.ring) a.lineStyle(1, 0xfff0c8, 0.7 * (1 - k)).strokeCircle(s.x, s.y, 6 + k * 30);
      else if (s.warm) a.fillStyle(0xffb070, 0.8 * (1 - k)).fillRect(Math.round(s.x), Math.round(s.y - k * 14), 2, 2);
      else for (let i = 0; i < 6; i++) { const an = i * 1.05 + k; a.fillStyle(0xffffff, 1 - k).fillRect(Math.round(s.x + Math.cos(an) * k * 16), Math.round(s.y + Math.sin(an) * k * 16), 1, 1); }
      return k < 1;
    });
    // The rock at the edges sways a hair: you are breathing hard.
    this.front.setPosition(Math.round(Math.sin(this.t / 1500) * 1.5), Math.round(Math.sin(this.t / 1900) * 1));
    if (this.you) this.you.setY(this.lay.floor + 2 + (Math.floor(this.t / 1600) % 2));
    this.button.setAlpha(this.phase === 'look' ? 0.6 + 0.4 * Math.abs(Math.sin(this.t / 500)) : this.button.alpha);
    // The autopilot (dev) takes it and climbs on by itself.
    if (this.climb.bot && this.phase === 'look' && this.t > 1700 + (this.taken ? 900 : 0)) this.act();
  }
}

export { toCss };
