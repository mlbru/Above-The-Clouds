import { PixelText, COLORS, drawPanel } from './PixelText.js';
import { DEPTH, GAME_WIDTH, GAME_HEIGHT, IS_PORTRAIT } from '../config/gameConfig.js';
import { measureLine } from '../utils/pixelFont.js';
import { Audio } from '../systems/AudioSystem.js';
import { lerpColor, darken } from '../utils/color.js';

const TOAST_Y = 41;
// The biome title card; upright it drops below the HUD, which fills the narrow top.
const CARD_Y = IS_PORTRAIT ? 78 : 41;
export const GEM_COLOR = '#9fe8ff';
export const GEM_TARGET = { x: 11, y: 50 };
const FIRE = ['#ff9a3c', '#f0644b', '#f2c14e', '#ffffff'];


// Minimal climbing HUD: height, grip, biome banner, quiet toasts, debug overlay.
export class HUD {
  constructor(scene) {
    this.scene = scene;
    const d = DEPTH.hud;
    this.root = [];
    const add = (o) => { o.setScrollFactor(0).setDepth(d); this.root.push(o); return o; };
    // Backing plates go first so every readout sits on its own dark glass,
    // readable over the busiest rock.
    this.plates = add(scene.add.graphics());
    this.icon = add(scene.add.image(8, 7, 'icon_mtn').setOrigin(0, 0));
    this.height = add(new PixelText(scene, 20, 6, '0 M').setScale(2));
    this.best = add(new PixelText(scene, 20, 13, '', { color: COLORS.dim }));
    this.biome = add(new PixelText(scene, 8, 23, '', { color: COLORS.text }));
    // How far to the next area ("FROZEN REACH IN 80 M").
    this.next = add(new PixelText(scene, 8, 32, '', { color: COLORS.faint }));
    this.gripIcon = add(scene.add.image(GAME_WIDTH - 94, 6, 'icon_grip').setOrigin(0, 0));
    this.gripLabel = add(new PixelText(scene, GAME_WIDTH - 84, 7, 'GRIP'));
    this.gripBar = add(scene.add.graphics());
    this.gripValue = add(new PixelText(scene, GAME_WIDTH - 9, 7, '100', { color: COLORS.text }).setOrigin(1, 0));
    this.streak = add(new PixelText(scene, GAME_WIDTH - 8, 31, '', { color: COLORS.gold }).setOrigin(1, 0));
    this.gemIcon = add(scene.add.image(7, 47, 'icon_gem').setOrigin(0, 0));
    this.gemText = add(new PixelText(scene, 18, 48, '0', { color: GEM_COLOR }));
    this.gearIcons = [];
    // Storm Crown: a little thundercloud that fills up until the next storm.
    this.stormG = add(scene.add.graphics());
    this.streakValue = 0;
    this.streakScale = 1;
    this.fireT = 0;
    this.cardLines = scene.add.graphics().setScrollFactor(0).setDepth(d);
    this.cardTimer = null;
    this.celebrations = [];
    this.celebrating = false;
    this.vignette = scene.add.image(0, 0, 'vignette').setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.vignette).setAlpha(0);
    this.banner = new PixelText(scene, GAME_WIDTH / 2, CARD_Y + 5, '').setOrigin(0.5, 0).setScale(2).setScrollFactor(0).setDepth(d).setAlpha(0);
    this.bannerSub = new PixelText(scene, GAME_WIDTH / 2, CARD_Y + 21, '', { color: COLORS.dim }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(d).setAlpha(0);
    this.debug = new PixelText(scene, 8, 62, '', { color: '#c8ffc8' }).setScrollFactor(0).setDepth(DEPTH.overlay).setVisible(false);
    this.toasts = [];
    this.toastQueue = [];
    this.visible = true;
    this.blink = 0;
  }

  update(dt, { heightM, best, biomeName, nextLine = '', nextColor = COLORS.faint, grip, gripMax = 100, gripLow, gripCritical, modeLabel = '', accent = 0xf2c14e, slip = null }) {
    this.next.setText(nextLine).setColor(nextColor);
    this.height.setText(`${Math.max(0, heightM).toFixed(0)} M`);
    this.best.setText(`BEST ${best.toFixed(0)} M${modeLabel ? '  ' + modeLabel : ''}`);
    this.best.setX(20 + this.height.width * 2 + 6);
    this.biome.setText(biomeName);
    this.blink += dt;
    this.drawPlates(accent, slip);
    const g = this.gripBar;
    g.clear();
    // The grip meter: a rounded glass tube with a lit top and a shaded belly,
    // quarter ticks, and a bright cap on the liquid.
    const x = GAME_WIDTH - 93, y = 17, w = 84, h = 6;
    const ratio = Math.max(0, Math.min(1, grip / gripMax));
    const color = ratio > 0.55 ? 0x8fd16a : ratio > 0.3 ? 0xf2c14e : 0xf0644b;
    const flash = gripLow && Math.floor(this.blink / (gripCritical ? 140 : 260)) % 2 === 0;
    g.fillStyle(0x07060c, 1).fillRect(x, y - 1, w, h + 2).fillRect(x - 1, y, w + 2, h);
    g.fillStyle(0x221d30, 1).fillRect(x, y, w, h);
    const fw = Math.round(w * ratio);
    if (fw > 0) {
      const c = flash ? 0xffffff : color;
      g.fillStyle(darken(c, 0.62), 1).fillRect(x, y, fw, h);
      g.fillStyle(c, 1).fillRect(x, y, fw, h - 2);
      g.fillStyle(lerpColor(c, 0xffffff, 0.45), 1).fillRect(x + 1, y + 1, Math.max(0, fw - 2), 1);
      g.fillStyle(lerpColor(c, 0xffffff, 0.7), 1).fillRect(x + fw - 1, y, 1, h - 1);
    }
    g.fillStyle(0x07060c, 0.55);
    for (const q of [0.25, 0.5, 0.75]) g.fillRect(x + Math.round(w * q), y + h - 2, 1, 2);
    g.fillStyle(0xffffff, 0.12).fillRect(x, y, w, 1);
    this.gripValue.setText(`${Math.ceil(grip)}`).setColor(gripLow ? COLORS.red : COLORS.text);
    const vTarget = !this.visible ? 0 : gripCritical ? 0.55 + 0.25 * Math.sin(this.blink / 120) : gripLow ? 0.25 + 0.15 * Math.sin(this.blink / 250) : 0;
    this.vignette.setAlpha(this.vignette.alpha + (vTarget - this.vignette.alpha) * Math.min(1, dt / 200));
    if (this.streakValue >= 20) {
      this.fireT += dt;
      this.streak.setColor(FIRE[Math.floor(this.fireT / 110) % FIRE.length]);
    }
    this.updateToasts(dt);
  }

  // No plates: the readouts float over the scene with their outline shadow.
  // Only the biome's slip is drawn here, as a little rope coil after its name
  // (gold while you still have it, a frayed red end when it is used).
  drawPlates(accent, slip) {
    const g = this.plates;
    g.clear();
    if (!this.visible || slip === null) return;
    const px = 8 + this.biome.width + 4, py = 24;
    g.fillStyle(0x16141f, 1).fillRect(px - 1, py - 1, 8, 7);
    if (slip) {
      g.fillStyle(0x7a4a1a, 1).fillRect(px, py, 6, 5);
      g.fillStyle(0xf2c14e, 1).fillRect(px + 1, py, 4, 1).fillRect(px, py + 1, 1, 3).fillRect(px + 5, py + 1, 1, 3).fillRect(px + 1, py + 4, 4, 1).fillRect(px + 2, py + 2, 2, 1);
    } else {
      g.fillStyle(0xf0644b, 1).fillRect(px, py, 1, 1).fillRect(px + 1, py + 1, 1, 1).fillRect(px + 2, py + 2, 1, 1).fillRect(px + 3, py + 3, 1, 1).fillRect(px + 4, py + 4, 1, 1);
      g.fillRect(px + 4, py, 1, 1).fillRect(px + 3, py + 1, 1, 1).fillRect(px + 1, py + 3, 1, 1).fillRect(px, py + 4, 1, 1);
    }
  }

  // ---------- storm meter ----------
  // storm: null (hidden) or { phase, progress } from the Storm mechanic.
  setStorm(storm) {
    const g = this.stormG;
    g.clear();
    if (!storm) return;
    const { phase, progress } = storm;
    const x = GAME_WIDTH - 160, y = 14;
    const flash = Math.floor(this.blink / 160) % 2 === 0;
    // A pixel thundercloud; it darkens as the storm builds.
    const fill = phase === 'calm' ? progress : phase === 'clearing' ? 1 - progress : 1;
    const cloud = phase === 'storm' ? (flash ? 0xffe45a : 0x5a6078) : lerpColor(0xc8d0e0, 0x4a5068, fill);
    g.fillStyle(0x16141f, 0.8).fillRect(x - 1, y + 1, 14, 7).fillRect(x + 2, y - 1, 8, 3);
    g.fillStyle(cloud, 1).fillRect(x, y + 2, 12, 5).fillRect(x + 3, y, 6, 3).fillRect(x + 1, y + 1, 3, 2);
    if (phase !== 'calm') {
      g.fillStyle(0xffe45a, phase === 'warning' && !flash ? 0.4 : 1);
      g.fillRect(x + 6, y + 7, 2, 2).fillRect(x + 5, y + 9, 2, 1).fillRect(x + 4, y + 10, 2, 2);
    }
    // The bar: fills up while it is calm, drains while the storm rages.
    const bx = x + 16, bw = 44;
    drawPanel(g, bx - 2, y + 1, bw + 3, 7, { alpha: 0.6 });
    const shown = phase === 'calm' ? progress : phase === 'warning' ? 1 : phase === 'storm' ? 1 - progress : 0;
    const col = phase === 'calm' ? (progress > 0.8 && flash ? 0xffe45a : 0x8a94b8) : 0xffe45a;
    g.fillStyle(col, 1).fillRect(bx, y + 3, Math.round(bw * shown), 3);
  }

  // ---------- gems & gear ----------
  setGems(n, pulse = false) {
    this.gemText.setText(`${n}`);
    if (!pulse) return;
    const sc = this.scene;
    sc.tweens.killTweensOf([this.gemIcon, this.gemText]);
    this.gemIcon.setScale(1.6); this.gemText.setScale(1.4);
    sc.tweens.add({ targets: [this.gemIcon, this.gemText], scale: 1, duration: 220, ease: 'Back.easeOut' });
  }

  // "+3" next to the gem counter.
  gemGain(amount, color = GEM_COLOR) {
    this.gains = (this.gains || []).filter((g) => g.active);
    if (this.gains.length >= 2) this.gains.shift().destroy();
    const t = new PixelText(this.scene, 20 + this.gemText.width + 4, 48, `+${amount}`, { color }).setScrollFactor(0).setDepth(DEPTH.hud).setVisible(this.visible);
    this.gains.push(t);
    this.scene.tweens.add({ targets: t, y: 40, alpha: 0, delay: 500, duration: 700, onComplete: () => t.destroy() });
  }

  // Small icons for this run's gear and perk; used-up items are dimmed.
  setGear(list) {
    this.gearIcons.forEach((o) => o.destroy());
    this.root = this.root.filter((o) => !this.gearIcons.includes(o));
    this.gearIcons = list.map((g, i) => {
      const img = this.scene.add.image(7 + i * 12, 58, g.icon).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.hud).setAlpha(g.used ? 0.3 : 1).setVisible(this.visible);
      this.root.push(img);
      return img;
    });
  }

  // Trail Boons: your gifts as small framed emblems on the left, under the gear.
  setBoons(list) {
    (this.boonIcons || []).forEach((o) => o.destroy());
    this.root = this.root.filter((o) => !(this.boonIcons || []).includes(o));
    this.boonIcons = [];
    const g = this.scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud).setVisible(this.visible);
    this.boonIcons.push(g);
    list.forEach((b, i) => {
      // Left column, under the gems and the gear row.
      const x = 15 + i * 17, y = 80;
      g.fillStyle(0x0c0a12, 0.85).fillRect(x - 8, y - 8, 16, 16);
      g.fillStyle(b.color, 0.9).fillRect(x - 8, y - 8, 16, 1).fillRect(x - 8, y + 7, 16, 1);
      g.fillStyle(b.color, 0.45).fillRect(x - 8, y - 7, 1, 14).fillRect(x + 7, y - 7, 1, 14);
      const img = this.scene.add.image(x, y, b.icon).setScrollFactor(0).setDepth(DEPTH.hud).setVisible(this.visible);
      this.boonIcons.push(img);
      // A new gift pops in.
      if (i === list.length - 1 && this.lastBoonCount !== undefined && list.length > this.lastBoonCount) {
        img.setScale(2.4);
        this.scene.tweens.add({ targets: img, scale: 1, duration: 360, ease: 'Back.easeOut' });
      }
    });
    this.lastBoonCount = list.length;
    this.root.push(...this.boonIcons);
  }

  setVisible(v) {
    this.visible = v;
    this.root.forEach((o) => o.setVisible(v));
    this.toasts.forEach((t) => t.setVisible(v));
    [this.banner, this.bannerSub, this.cardLines].forEach((o) => o.setVisible(v));
  }

  // Consecutive perfect moves, shown under the grip meter while it lasts. The
  // counter grows and heats up with the streak: gold, then big orange at 10,
  // then flickering fire from 20.
  setStreak(n) {
    const prev = this.streakValue;
    this.streakValue = n;
    if (n < prev && prev >= 5) this.shatterStreak();
    const t = this.streak;
    if (n < 2) { t.setText(''); return; }
    const big = n >= 10;
    this.streakScale = big ? 2 : 1;
    t.setText(big ? `${n} IN A ROW${n >= 20 ? '!!' : '!'}` : `${n} PERFECT IN A ROW`);
    if (n > prev) {
      t.setColor('#ffffff');
      this.scene.time.delayedCall(90, () => { if (this.streakValue < 20) t.setColor(n >= 10 ? '#ff9a3c' : COLORS.gold); });
      this.scene.tweens.killTweensOf(t);
      const punch = n % 10 === 0 ? 1.6 : 1.25;
      t.setScale(this.streakScale * punch);
      this.scene.tweens.add({ targets: t, scale: this.streakScale, duration: n % 10 === 0 ? 320 : 140, ease: 'Back.easeOut' });
    } else t.setScale(this.streakScale);
  }

  // The broken streak counter falls apart into shards.
  shatterStreak() {
    const t = this.streak;
    const w = t.displayWidth, h = t.displayHeight;
    const ghost = new PixelText(this.scene, t.x, t.y, t.text, { color: COLORS.red }).setOrigin(1, 0).setScale(t.scaleX)
      .setScrollFactor(0).setDepth(DEPTH.hud).setVisible(this.visible);
    this.scene.tweens.add({ targets: ghost, y: ghost.y + 10, alpha: 0, angle: 6, duration: 420, ease: 'Quad.easeIn', onComplete: () => ghost.destroy() });
    const count = this.scene.effects && this.scene.effects.reduced ? 4 : 10;
    for (let i = 0; i < count; i++) {
      const px = t.x - Math.random() * w, py = t.y + Math.random() * h;
      const shard = this.scene.add.image(px, py, 'px2').setScrollFactor(0).setDepth(DEPTH.hud).setTint(i % 2 ? 0xf0644b : 0xf2c14e).setVisible(this.visible);
      this.scene.tweens.add({
        targets: shard, x: px + (Math.random() - 0.5) * 40, y: py + 18 + Math.random() * 26, alpha: 0, angle: Math.random() * 360,
        duration: 500 + Math.random() * 300, ease: 'Quad.easeIn', onComplete: () => shard.destroy(),
      });
    }
    t.setText('');
    t.setScale(1);
  }

  // Biome title card: rules slide out from the centre and the name types in.
  // color: the biome's accent, used for the rules and the subtitle.
  showBanner(title, sub = '', color = 0xf2c14e) {
    const sc = this.scene;
    const scale = 2;
    const fullW = measureLine(title) * scale;
    const left = Math.round(GAME_WIDTH / 2 - fullW / 2);
    // Scene time when the card has faded out (others wait for it, see ClimbScene.showStars()).
    this.bannerUntil = sc.time.now + 55 * ([...title].length + 4) + 2800 + 900;
    if (this.cardTimer) this.cardTimer.remove();
    sc.tweens.killTweensOf([this.banner, this.bannerSub, this.cardLines]);
    this.banner.setOrigin(0, 0).setX(left).setText('').setAlpha(1);
    this.bannerSub.setText(sub).setAlpha(0).setColor(`#${lerpColor(color, 0xffffff, 0.4).toString(16).padStart(6, '0')}`);
    const lines = this.cardLines.setAlpha(1);
    const prog = { w: 0 };
    const maxW = fullW / 2 + 26;
    const drawLines = () => {
      lines.clear();
      const w = Math.round(prog.w), cx = GAME_WIDTH / 2;
      // Two gold rules above and below the name.
      const y0 = CARD_Y - 2, y1 = CARD_Y + 31;
      for (const y of [y0, y1]) {
        lines.fillStyle(0x16141f, 0.6); lines.fillRect(cx - w, y + 1, w * 2, 1);
        lines.fillStyle(color, 1); lines.fillRect(cx - w, y, w * 2, 1);
        if (w > 6) { lines.fillRect(cx - w - 3, y, 2, 1); lines.fillRect(cx + w + 1, y, 2, 1); }
      }
    };
    sc.tweens.add({ targets: prog, w: maxW, duration: 380, ease: 'Cubic.easeOut', onUpdate: drawLines });
    let k = -4; // a short pause while the rules slide out
    const chars = [...title];
    this.cardTimer = sc.time.addEvent({
      delay: 55, repeat: chars.length + 3,
      callback: () => {
        if (++k <= 0) return;
        this.banner.setText(chars.slice(0, k).join(''));
        if (chars[k - 1] !== ' ') Audio.play('tick');
        if (k === chars.length) {
          sc.tweens.add({ targets: this.bannerSub, alpha: 1, duration: 400 });
          sc.tweens.add({ targets: [this.banner, this.bannerSub, lines], alpha: 0, delay: 2800, duration: 900, ease: 'Sine.easeIn' });
        }
      },
    });
    this.bannerSub.setY(CARD_Y + 23);
  }

  // Big centre-screen moments (every 100 m, new record). Queued so they never overlap.
  // slam: the title drops in from huge and lands with a thud (onLand fires on impact).
  celebrate({ title, sub = '', color = COLORS.gold, flicker = false, scale = 3, slam = false, onLand = null }) {
    this.celebrations.push({ title, sub, color, flicker, scale, slam, onLand });
    if (!this.celebrating) this.nextCelebration();
  }

  nextCelebration() {
    const c = this.celebrations.shift();
    if (!c) { this.celebrating = false; return; }
    this.celebrating = true;
    const sc = this.scene;
    const y = 82;
    const t = new PixelText(sc, GAME_WIDTH / 2, y, c.title, { color: c.color }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH.hud + 2).setScale(c.scale * 2).setAlpha(0);
    const s = c.sub ? new PixelText(sc, GAME_WIDTH / 2, y + c.scale * 5 + 5, c.sub, { color: COLORS.text }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH.hud + 2).setAlpha(0) : null;
    const parts = [t, s].filter(Boolean);
    parts.forEach((o) => o.setVisible(this.visible));
    if (c.slam) {
      t.setScale(c.scale * 3.2);
      sc.tweens.add({
        targets: t, scale: c.scale, alpha: 1, duration: 170, ease: 'Quad.easeIn',
        onComplete: () => {
          if (c.onLand) c.onLand();
          sc.tweens.add({ targets: t, scale: c.scale * 1.12, duration: 60, yoyo: true, ease: 'Quad.easeOut' });
        },
      });
    } else sc.tweens.add({ targets: t, scale: c.scale, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    if (s) sc.tweens.add({ targets: s, alpha: 1, delay: 200, duration: 300 });
    let flick = null;
    if (c.flicker) {
      let i = 0;
      flick = sc.time.addEvent({ delay: 120, loop: true, callback: () => t.setColor(++i % 2 ? '#ffffff' : c.color) });
    }
    sc.tweens.add({
      targets: parts, alpha: 0, y: '-=10', delay: c.flicker ? 2400 : 1500, duration: 500, ease: 'Sine.easeIn',
      onComplete: () => {
        if (flick) flick.remove();
        parts.forEach((o) => o.destroy());
        this.nextCelebration();
      },
    });
  }

  // A quick full-screen flash.
  flashScreen(color = 0xffffff, alpha = 0.3, ms = 260) {
    const r = this.scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, color, alpha).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.hud - 1);
    this.scene.tweens.add({ targets: r, alpha: 0, duration: ms, onComplete: () => r.destroy() });
  }

  // Understated messages that stack quietly under the grip meter.
  toast(text, color = COLORS.text) {
    this.toastQueue.push({ text, color });
  }

  updateToasts() {
    if (this.toastQueue.length && this.toasts.length < 3) {
      const { text, color } = this.toastQueue.shift();
      const t = new PixelText(this.scene, GAME_WIDTH - 8, TOAST_Y + this.toasts.length * 9, text, { color }).setOrigin(1, 0).setScrollFactor(0).setDepth(DEPTH.hud).setAlpha(0);
      t.setVisible(this.visible);
      this.toasts.push(t);
      this.scene.tweens.add({
        targets: t, alpha: 1, duration: 500, hold: 3800, yoyo: true,
        onComplete: () => {
          this.toasts = this.toasts.filter((o) => o !== t);
          t.destroy();
          this.toasts.forEach((o, i) => o.setY(TOAST_Y + i * 9));
        },
      });
    }
  }

  setDebug(text) {
    this.debug.setVisible(text !== null);
    if (text !== null) this.debug.setText(text);
  }
}

export { GAME_HEIGHT };
