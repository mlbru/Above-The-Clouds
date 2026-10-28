import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH, levelToMeters, IS_PORTRAIT, IS_TOUCH } from '../config/gameConfig.js';
import { PixelText, COLORS, drawFrame } from '../ui/PixelText.js';
import { EXPEDITIONS, EXPEDITION_ORDER } from '../data/expeditions.js';
import { ExpeditionMountain } from '../systems/ExpeditionMountain.js';
import { buildPanorama, PANO_H, PANO_CENTERS } from '../render/expeditionArt.js';
import { BIOMES } from '../data/biomes.js';
import { DayNightSystem } from '../systems/DayNightSystem.js';
import { Background } from '../world/Background.js';
import { Atmosphere } from '../world/Atmosphere.js';
import { Audio } from '../systems/AudioSystem.js';
import { toCss, lerpColor } from '../utils/color.js';
import { measureLine } from '../utils/pixelFont.js';

const GROUND_Y = GAME_HEIGHT - 70;
// The panorama hangs so its ground row (200) sits 60 px above the screen bottom
// and Bram's peak is centred when the camera is at 0.
const PANO_X = GAME_WIDTH / 2 - PANO_CENTERS.peak;
// Portrait: lifted clear of the taller info panel, and the title steps down
// below the touch buttons.
const PANO_Y = GAME_HEIGHT - PANO_H - (IS_PORTRAIT ? 50 : 0);
const TOP = IS_PORTRAIT ? 30 : 0;

// Breaks a line of pixel text to fit maxW pixels.
function wrapText(text, maxW) {
  const out = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && measureLine(next) > maxW) { out.push(line); line = word; } else line = next;
  }
  if (line) out.push(line);
  return out.join('\n');
}

// The expedition picker: one painted panorama in which the three mountains
// flow into each other, set in the game's own scenery (sky and time of day,
// distant ranges, clouds, sun rays, particles).
// ← → swing the view to the next mountain and the whole scene blends into
// that expedition's world. The chosen one shows its name, height, how high
// you got (a flag on its route) and a CLIMB button.
// Launched over the Menu, which is paused meanwhile.
export class ExpeditionScene extends Phaser.Scene {
  constructor() { super('Expeditions'); }

  create() {
    this.prog = this.registry.get('progression');
    this.list = EXPEDITION_ORDER.map((id) => EXPEDITIONS[id]);
    const pano = buildPanorama(this);
    this.paths = pano.paths;
    this.spots = pano.spots;
    this.index = 0;
    this.t = 0;
    // Scenery, exactly as in a climb.
    this.dayNight = new DayNightSystem({ dayLengthSec: 9999, startT: this.list[0].look.dayT });
    this.background = new Background(this);
    this.atmos = new Atmosphere(this);
    this.blend = { from: this.list[0].look, to: this.list[0].look, k: 1 };
    this.overlay = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffffff).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.light).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.pano = this.add.image(PANO_X, PANO_Y, 'exp_panorama').setOrigin(0, 0).setDepth(DEPTH.wall);
    this.boughs = [
      this.add.image(-8, GAME_HEIGHT + 8, 'fg_branch').setOrigin(0, 1).setScrollFactor(0).setDepth(DEPTH.foreground),
      this.add.image(GAME_WIDTH + 8, GAME_HEIGHT + 4, 'fg_branch').setOrigin(1, 1).setFlipX(true).setScrollFactor(0).setDepth(DEPTH.foreground),
    ];
    this.mtns = this.list.map((exp, i) => this.buildMountain(exp, i));
    this.birds = [0, 1, 2].map((k) => this.add.sprite(-40 - k * 30, 60 + k * 14, 'bird', 0).setDepth(DEPTH.wall - 1));

    // Title.
    const title = new PixelText(this, GAME_WIDTH / 2, TOP + 8, 'EXPEDITIONS', { color: '#ffffff', shadow: '#2a2440' }).setOrigin(0.5, 0).setScale(2).setScrollFactor(0).setDepth(DEPTH.hud);
    title.setTint(0xffffff, 0xffffff, 0x9fd8ff, 0x9fd8ff);
    this.add.existing(title);
    this.add.existing(new PixelText(this, GAME_WIDTH / 2, TOP + 26, 'CHOOSE YOUR MOUNTAIN', { color: '#dfe8ff', shadow: '#2a2440' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH.hud));
    this.arrows = [-1, 1].map((d) => {
      const a = this.add.image(d < 0 ? 18 : GAME_WIDTH - 18, GROUND_Y - 60, d < 0 ? 'arrow_L' : 'arrow_R').setScrollFactor(0).setDepth(DEPTH.hud).setScale(1.5).setInteractive({ useHandCursor: true });
      a.on('pointerdown', () => this.move(d));
      return a;
    });
    this.ui = [];
    this.uiG = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud);
    this.btnG = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud);
    this.cameras.main.setScroll(0, 0);
    this.input.keyboard.on('keydown', this.onKey, this);
    this.events.once('shutdown', () => this.input.keyboard.off('keydown', this.onKey, this));
    Audio.play('cloth');
    this.select(0, true);
  }

  buildMountain(exp, i) {
    const x = PANO_X + PANO_CENTERS[exp.look.kind];
    const at = ([px, py]) => [PANO_X + px, PANO_Y + py];
    // Click a mountain to pick it (or to climb it once it is picked).
    this.add.zone(x - 150, PANO_Y, 300, PANO_H - 60).setOrigin(0, 0).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => (this.index === i ? this.go() : this.select(i)));
    const halo = this.add.image(x, PANO_Y + 90, 'glow').setScale(6).setBlendMode('ADD').setTint(exp.look.color).setAlpha(0).setDepth(DEPTH.wall - 2);
    const line = this.add.graphics().setDepth(DEPTH.wall + 1);
    const flag = this.add.image(0, 0, 'flag').setOrigin(0.1, 1).setDepth(DEPTH.wall + 2).setVisible(false);
    const fx = [];
    if (exp.look.kind === 'volcano') {
      const [cx, cy] = at(this.spots.crater), [vx, vy] = at(this.spots.vent);
      fx.push(this.add.particles(cx + 6, cy, 'puff', { frequency: 150, lifespan: 4600, speedX: { min: 2, max: 16 }, speedY: { min: -22, max: -12 }, scale: { start: 1, end: 4.5 }, alpha: { start: 0.55, end: 0 }, tint: [0x4a3a3a, 0x6a5050, 0x2a2020] }).setDepth(DEPTH.wall - 1));
      fx.push(this.add.particles(cx, cy, 'px2', { frequency: 60, lifespan: 1500, speedX: { min: -26, max: 26 }, speedY: { min: -60, max: -24 }, gravityY: 40, alpha: { start: 1, end: 0 }, tint: [0xffd25a, 0xff9a3c, 0xf0644b], blendMode: 'ADD' }).setDepth(DEPTH.wall + 1));
      fx.push(this.add.image(cx, cy + 4, 'glow').setScale(2.6).setBlendMode('ADD').setTint(0xff7a2a).setAlpha(0.5).setDepth(DEPTH.wall + 1));
      fx.push(this.add.particles(vx, vy, 'puff', { frequency: 420, lifespan: 3000, speedX: { min: 4, max: 12 }, speedY: { min: -14, max: -6 }, scale: { start: 0.5, end: 2 }, alpha: { start: 0.45, end: 0 }, tint: 0x5a4a4a }).setDepth(DEPTH.wall + 1));
      fx.push(this.add.image(PANO_X + PANO_CENTERS.volcano + 20, PANO_Y + 206, 'glow').setScale(5).setBlendMode('ADD').setTint(0xff6a2a).setAlpha(0.35).setDepth(DEPTH.wall + 1));
    }
    if (exp.look.kind === 'peak') {
      // Wind blows snow off the summit.
      const [sx, sy] = at(this.spots.summit);
      fx.push(this.add.particles(sx, sy + 2, 'puff', { frequency: 220, lifespan: 2800, speedX: { min: 14, max: 32 }, speedY: { min: -6, max: 2 }, scale: { start: 0.4, end: 1.8 }, alpha: { start: 0.6, end: 0 }, tint: 0xffffff }).setDepth(DEPTH.wall + 1));
    }
    if (exp.look.kind === 'islands') {
      [0, 1, 2, 3, 4].forEach((k) => fx.push(this.add.image(x - 160 + k * 80, PANO_Y + 190 - k * 40, `cloud${k % 4}`).setDepth(k % 2 ? DEPTH.wall - 1 : DEPTH.wall + 1).setAlpha(0.85)));
    }
    const st = this.prog.expedition(exp.id);
    const top = levelToMeters(new ExpeditionMountain(exp).summitLevel);
    const frac = st.summits ? 1 : Math.min(1, (st.best || 0) / top);
    return { exp, x, halo, line, flag, fx, top, frac, st };
  }

  // Point along the route at fraction f (0 base, 1 summit), in world space.
  routeAt(m, f) {
    const p = this.paths[m.exp.look.kind];
    const lens = p.slice(1).map((q, k) => Math.hypot(q[0] - p[k][0], q[1] - p[k][1]));
    let d = f * lens.reduce((a, b) => a + b, 0);
    let k = 0;
    while (k < lens.length - 1 && d > lens[k]) { d -= lens[k]; k++; }
    const t = lens[k] ? Math.min(1, d / lens[k]) : 0;
    const x = p[k][0] + (p[k + 1][0] - p[k][0]) * t, y = p[k][1] + (p[k + 1][1] - p[k][1]) * t;
    return [PANO_X + x, PANO_Y + y];
  }

  drawRoute(m, show) {
    const g = m.line;
    g.clear();
    m.flag.setVisible(false);
    if (!show) return;
    const steps = 90;
    for (let s = 0; s <= steps; s++) {
      const f = s / steps;
      const [x, y] = this.routeAt(m, f);
      const climbed = f <= m.frac;
      if (!climbed && s % 3) continue;
      if (climbed) g.fillStyle(0x16141f, 0.6).fillRect(Math.round(x) + 1, Math.round(y) + 1, 2, 2);
      g.fillStyle(climbed ? m.exp.look.color : 0xffffff, climbed ? 1 : 0.6).fillRect(Math.round(x), Math.round(y), climbed ? 2 : 1, climbed ? 2 : 1);
    }
    if (m.frac > 0) {
      const [fx, fy] = this.routeAt(m, m.frac);
      m.flag.setPosition(Math.round(fx), Math.round(fy)).setVisible(true).setTint(m.st.summits ? 0xf2c14e : 0xffffff);
    }
  }

  select(i, quiet = false) {
    if (i < 0 || i >= this.list.length) return;
    if (!quiet && i !== this.index) Audio.play('ui');
    this.blend = { from: this.lookNow(), to: this.list[i].look, k: quiet ? 1 : 0 };
    this.index = i;
    const cam = this.cameras.main;
    this.tweens.killTweensOf(cam);
    this.tweens.add({ targets: cam, scrollX: PANO_CENTERS[this.list[i].look.kind] - PANO_CENTERS.peak, duration: quiet ? 1 : 750, ease: 'Cubic.easeInOut' });
    this.mtns.forEach((m, k) => {
      const sel = k === i;
      this.tweens.killTweensOf(m.halo);
      this.tweens.add({ targets: m.halo, alpha: sel ? 0.18 : 0, duration: 500 });
      this.drawRoute(m, false);
    });
    this.time.delayedCall(quiet ? 0 : 560, () => { if (this.index === i) this.drawRoute(this.mtns[i], true); });
    this.drawInfo();
  }

  // The scenery settings right now (mid-blend when switching).
  lookNow() {
    const { from, to, k } = this.blend;
    return { ...to, alt: from.alt + (to.alt - from.alt) * k, dayT: from.dayT + (to.dayT - from.dayT) * k, from: from.biome, fk: 1 - k };
  }

  drawInfo() {
    this.ui.forEach((o) => o.destroy());
    this.ui = [];
    const g = this.uiG;
    g.clear();
    const m = this.mtns[this.index];
    const e = m.exp, st = m.st, col = e.look.color;
    // Portrait: a taller panel with the blurb wrapped and CLIMB under the facts.
    const x = IS_PORTRAIT ? 12 : 30, w = GAME_WIDTH - 2 * x, h = IS_PORTRAIT ? 92 : 52, y = GAME_HEIGHT - h - 14;
    if (IS_PORTRAIT) g.fillStyle(0x0d0f1a, 0.85).fillRect(0, GAME_HEIGHT - 56, GAME_WIDTH, 56);
    drawFrame(g, x, y, w, h, { accent: col, alpha: 0.92, glow: true });
    const factY = IS_PORTRAIT ? y + 48 : y + 37;
    const add = (o) => { o.setScrollFactor(0).setDepth(DEPTH.hud + 1); this.ui.push(o); return o; };
    add(new PixelText(this, x + 10, y + 6, e.name, { color: '#ffffff' }).setScale(2));
    // Difficulty pips.
    const dx = x + 16 + measureLine(e.name) * 2;
    for (let p = 0; p < 3; p++) { g.fillStyle(p < e.look.difficulty ? col : 0x3a3550, 1).fillRect(dx + p * 7, y + 10, 5, 5); }
    add(new PixelText(this, x + 10, y + 23, IS_PORTRAIT ? wrapText(e.blurb, w - 20) : e.blurb, { color: COLORS.dim }));
    // A row of facts with icons.
    let fx = x + 10;
    const fact = (icon, text, color, tint) => {
      add(this.add.image(fx + 5, factY + 3, icon).setTint(tint || 0xffffff));
      const t = add(new PixelText(this, fx + 13, factY, text, { color }));
      fx += 13 + t.width + 12;
    };
    fact('icon_mtn', `${Math.floor(m.top)} M`, '#ffffff');
    fact('flag', st.summits ? `SUMMIT X${st.summits}` : st.best ? `BEST ${Math.floor(st.best)} M` : 'NOT CLIMBED', st.summits ? COLORS.gold : toCss(lerpColor(col, 0xffffff, 0.35)), st.summits ? 0xf2c14e : 0xffffff);
    fact('icon_check', `${st.pages.length}/${e.pitches.length - 1} PAGES`, COLORS.dim, 0xf4efe4);
    fact('icon_gem', `+${e.reward}`, '#9fe8ff');
    // CLIMB button (drawn in update so it can pulse).
    this.btn = IS_PORTRAIT ? { x: x + w - 74, y: y + h - 28, w: 64, h: 22, col } : { x: x + w - 74, y: y + 14, w: 64, h: 24, col };
    add(new PixelText(this, this.btn.x + 32, this.btn.y + this.btn.h / 2 - 4, 'CLIMB', { color: '#16141f', shadow: null }).setOrigin(0.5, 0));
    add(this.add.zone(this.btn.x, this.btn.y, 64, this.btn.h).setOrigin(0, 0).setInteractive({ useHandCursor: true })).on('pointerdown', () => this.go());
    // Which mountain of how many.
    this.list.forEach((_, k) => g.fillStyle(k === this.index ? 0xffffff : 0x8a86a0, k === this.index ? 1 : 0.6).fillCircle(GAME_WIDTH / 2 - (this.list.length - 1) * 6 + k * 12, y - 7, k === this.index ? 2.5 : 2));
    this.arrows[0].setVisible(this.index > 0);
    this.arrows[1].setVisible(this.index < this.list.length - 1);
    add(new PixelText(this, GAME_WIDTH / 2, GAME_HEIGHT - 11, IS_TOUCH ? 'SWIPE ← → FOR ANOTHER MOUNTAIN    II BACK' : '← → CHOOSE    SPACE CLIMB    ESC BACK', { color: '#dfe8ff', shadow: '#16141f' }).setOrigin(0.5, 0).setAlpha(0.75));
  }

  update(time, delta) {
    this.t += delta;
    if (this.blend.k < 1) this.blend.k = Math.min(1, this.blend.k + delta / 650);
    const look = this.lookNow();
    this.dayNight.t = look.dayT;
    const day = this.dayNight.state();
    const to = BIOMES[look.biome], from = BIOMES[look.from];
    const mix = { a: from, b: to, t: 1 - look.fk };
    this.background.update(delta, look.alt, day, { birds: 1 }, { mix });
    this.overlay.fillColor = day.light;
    this.atmos.update(delta, { day, biome: look.fk > 0.5 ? from : to });
    // The meadow fades out over the cloud sea and turns to ash at the volcano.
    const gTo = this.list[this.index].look.ground, gFrom = this.blend.from.ground;
    const ga = (gTo === null ? 0 : 1) * (1 - look.fk) + (gFrom === null ? 0 : 1) * look.fk;
    this.boughs.forEach((b) => b.setAlpha(ga));
    // Birds cross now and then; islands bob; clouds round them drift.
    this.birds.forEach((b, k) => {
      b.x += (delta / 1000) * (22 + k * 4);
      if (b.x > this.cameras.main.scrollX + GAME_WIDTH + 40) { b.x = this.cameras.main.scrollX - 60 - k * 30; b.y = 50 + Math.random() * 70; }
      b.setFrame(Math.floor(this.t / 160 + k) % 2);
    });
    this.mtns.forEach((m) => {
      if (m.exp.look.kind === 'islands') {
        m.fx.forEach((c, k) => { c.x = m.x - 170 + ((k * 80 + this.t / 50) % 360); });
      }
      if (m.exp.look.kind === 'volcano') {
        m.fx[2].setAlpha(0.4 + Math.sin(this.t / 140) * 0.08 + Math.sin(this.t / 53) * 0.05);
        m.fx[4].setAlpha(0.3 + Math.sin(this.t / 210) * 0.06);
      }
    });
    // The CLIMB button breathes.
    const b = this.btn;
    if (b) {
      const g = this.btnG;
      g.clear();
      const pulse = 0.5 + 0.5 * Math.sin(this.t / 260);
      g.fillStyle(b.col, 0.25 * pulse).fillRoundedRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6, 7);
      g.fillStyle(b.col, 1).fillRoundedRect(b.x, b.y, b.w, b.h, 5);
      g.fillStyle(0xffffff, 0.35).fillRect(b.x + 4, b.y + 2, b.w - 8, 1);
      g.fillStyle(0x000000, 0.2).fillRect(b.x + 4, b.y + b.h - 3, b.w - 8, 1);
    }
  }

  move(d) { this.select(Math.max(0, Math.min(this.list.length - 1, this.index + d))); }

  go() {
    const id = this.list[this.index].id;
    Audio.play('select');
    this.scene.stop();
    this.scene.resume('Menu');
    this.scene.get('Menu').startClimb(false, null, id);
  }

  onKey(event) {
    if (event.repeat) return;
    switch (event.code) {
      case 'ArrowLeft': case 'KeyA': this.move(-1); break;
      case 'ArrowRight': case 'KeyD': this.move(1); break;
      case 'Space': case 'Enter': case 'ArrowUp': this.go(); break;
      case 'Escape': case 'Backspace': Audio.play('cloth'); this.scene.stop(); this.scene.resume('Menu'); break;
      default: break;
    }
  }
}
