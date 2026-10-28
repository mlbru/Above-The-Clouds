import { PixelText, COLORS, drawFrame } from './PixelText.js';
import { biomeAt } from '../data/biomes.js';
import { levelToMeters } from '../config/gameConfig.js';
import { lerpColor } from '../utils/color.js';
import { DEPTH, GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';
import { ROUTE_COLORS } from '../config/balanceConfig.js';
import { darkAlpha } from '../systems/mechanics/Darkness.js';

const PX_PER_MS = 0.085;
export const THERMAL_TINT = 0xffb45a;
// Mirrored notes are drawn the wrong way round in magenta: press the other way.
export const MIRROR_TINT = 0xff6ad8;
const FLIP = { L: 'R', R: 'L', U: 'U' };
// What the note looks like on the track (a mirrored note shows the other arrow).
const shownDir = (note) => (note.mirror ? FLIP[note.dir] : note.dir);
// Still beats (the Dragon's Eye) show a red pause sign instead of an arrow.
export const STILL_TINT = 0xf0644b;
const bigKey = (note) => (note.still ? 'icon_still' : `arrow_${shownDir(note)}`);
const smallKey = (note) => (note.still ? 'icon_still_s' : `arrow_s_${shownDir(note)}`);
const TRACK_W = 200;
const TRACK_X = Math.round(GAME_WIDTH / 2 - TRACK_W / 2);
export const HIT_X = TRACK_X + 30;
export const TRACK_Y = GAME_HEIGHT - 22;
export const REC_Y = GAME_HEIGHT - 34;

const RESULT_STYLE = {
  perfect: { text: 'PERFECT', color: COLORS.gold, tint: 0xf2c14e },
  good: { text: 'GOOD', color: COLORS.text, tint: 0xf4efe4 },
  early: { text: 'EARLY', color: COLORS.red, tint: 0xf0644b },
  late: { text: 'LATE', color: COLORS.red, tint: 0xf0644b },
  wrong: { text: 'WRONG WAY', color: COLORS.red, tint: 0xf0644b },
  release: { text: 'LET GO!', color: COLORS.red, tint: 0xf0644b },
  roll: { text: 'TAP FASTER!', color: COLORS.red, tint: 0xf0644b },
  half: { text: 'BOTH ARROWS!', color: COLORS.red, tint: 0xf0644b },
  moved: { text: 'YOU MOVED!', color: COLORS.red, tint: 0xf0644b },
};

// The timing UI: notes slide right-to-left into a fixed target zone.
export class ComboPrompt {
  constructor(scene) {
    this.scene = scene;
    // Everything the box draws, so it can move onto its own camera (setSway).
    this.owned = new Set();
    this.boxCam = null;
    this.detached = false;
    this.g = this.own(scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud));
    scene.events.once('shutdown', () => { if (this.boxCam) scene.cameras.remove(this.boxCam); this.boxCam = null; });
    this.items = [];
    this.combo = null;
    this.mode = null;
    this.flash = 0;
  }

  // Scene factory for the box's own objects (they are tracked in `owned`).
  get add() {
    const f = this.scene.add;
    return { image: (...a) => this.own(f.image(...a)), rectangle: (...a) => this.own(f.rectangle(...a)) };
  }

  own(o) {
    this.owned.add(o);
    o.once('destroy', () => this.owned.delete(o));
    if (this.detached) this.scene.cameras.main.ignore(o);
    return o;
  }

  // The dragon's pressure: s = { x, y, rot, shake } moves the whole box (track,
  // arrows, labels) on a camera of its own: it drifts, tilts and shakes while
  // the main view does its own thing. null puts it back on the main camera.
  setSway(s) {
    const sc = this.scene, main = sc.cameras.main;
    if (s && !this.boxCam) this.boxCam = sc.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT).setVisible(false);
    if (s && !this.detached) {
      this.detached = true;
      this.boxCam.setVisible(true);
      this.owned.forEach((o) => main.ignore(o));
    } else if (!s && this.detached) {
      this.detached = false;
      this.boxCam.setVisible(false);
      this.owned.forEach((o) => { o.cameraFilter &= ~main.id; });
    }
    if (!s) return;
    // The box camera shows the box and nothing else.
    for (const o of sc.children.list) if (!this.owned.has(o)) o.cameraFilter |= this.boxCam.id;
    this.boxCam.setPosition(Math.round(s.x), Math.round(s.y)).setRotation(s.rot || 0);
    if (s.shake && !this.boxCam.shakeEffect.isRunning) this.boxCam.shake(s.shake[0], s.shake[1]);
  }

  show(combo, route) {
    this.hide();
    this.dark = (route.mods && route.mods.dark) || null;
    this.combo = combo;
    this.mode = 'combo';
    this.route = route;
    this.color = route.toLedge ? ROUTE_COLORS.ledge : ROUTE_COLORS[route.type];
    // The lane is framed in the colours of the biome you are climbing.
    this.accent = lerpColor(biomeAt(levelToMeters(route.target.level)).accentC, 0xffffff, 0.25);
    this.glow = this.add.image(0, TRACK_Y, 'glow_small').setScrollFactor(0).setDepth(DEPTH.hud + 1).setBlendMode('ADD').setTint(0xf2c14e).setScale(1.3).setVisible(false);
    // Biome mechanics (whiteout) can make notes appear only shortly before the line.
    this.revealMs = (route.mods && route.mods.revealMs) || 0;
    const n = combo.notes.length;
    const seqX = Math.round(GAME_WIDTH / 2 - (n * 10) / 2);
    combo.notes.forEach((note, i) => {
      const big = this.add.image(0, TRACK_Y, bigKey(note)).setScrollFactor(0).setDepth(DEPTH.hud + 2);
      const small = this.add.image(seqX + i * 10 + 4, TRACK_Y - 20, smallKey(note)).setScrollFactor(0).setDepth(DEPTH.hud + 2);
      // A double note stacks its two arrows, a little smaller.
      let big2 = null, small2 = null;
      if (note.chord) {
        big.setScale(0.8);
        big2 = this.add.image(0, TRACK_Y + 5, `arrow_${note.chord}`).setScale(0.8).setScrollFactor(0).setDepth(DEPTH.hud + 2);
        small.setY(TRACK_Y - 22).setScale(0.75);
        small2 = this.add.image(small.x, TRACK_Y - 17, `arrow_s_${note.chord}`).setScale(0.75).setScrollFactor(0).setDepth(DEPTH.hud + 2);
      }
      // A short bar under the small arrow marks a hold note in the sequence
      // (dotted for a roll).
      const holdBar = note.holdMs ? this.add.rectangle(seqX + i * 10 + 1, TRACK_Y - 15, 7, 1, 0xf2c14e).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.hud + 2)
        : note.rollMs ? this.add.rectangle(seqX + i * 10 + 1, TRACK_Y - 15, 7, 1, 0x9fffd0).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.hud + 2) : null;
      this.items.push({ note, big, small, big2, small2, mark: null, holdBar });
    });
    if (combo.notes.some((n) => n.gust)) {
      this.gustIcon = this.add.image(TRACK_X + TRACK_W - 6, TRACK_Y - 33, 'icon_wind').setOrigin(1, 0).setTint(0x9fd8ff).setScrollFactor(0).setDepth(DEPTH.hud + 2).setVisible(false);
    }
    const tags = [...(route.tags || []), ...(route.mods ? [route.mods.tag] : []), ...(route.thermal ? ['THERMAL'] : [])];
    let line = `${route.label} ROUTE${tags.length ? '  \u2022 ' + tags.join(' ') : ''}`;
    if (line.length > 40) line = `${line.slice(0, 38).replace(/ \S*$/, '')} ...`;
    this.label = this.own(new PixelText(this.scene, TRACK_X, TRACK_Y - 33, line, { color: COLORS.dim }).setScrollFactor(0).setDepth(DEPTH.hud + 1));
  }

  showRecovery(combo, { label = 'GRAB THE WALL!', color = COLORS.red } = {}) {
    this.hide();
    this.combo = combo;
    this.mode = 'recovery';
    const note = combo.notes[0];
    const big = this.add.image(GAME_WIDTH / 2, REC_Y, `arrow_${note.dir}`).setScrollFactor(0).setDepth(DEPTH.hud + 2).setScale(2);
    this.items.push({ note, big, small: null, mark: null });
    this.label = this.own(new PixelText(this.scene, GAME_WIDTH / 2 + 26, REC_Y - 3, label, { color }).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.hud + 1));
  }

  update(now, dt) {
    const g = this.g;
    g.clear();
    if (!this.combo) return;
    this.flash = Math.max(0, this.flash - dt);
    if (this.mode === 'recovery') return this.updateRecovery(now);
    const c = this.combo;
    // Track
    drawFrame(g, TRACK_X - 5, TRACK_Y - 10, TRACK_W + 10, 21, { accent: this.accent, alpha: 0.85 });
    g.fillStyle(0x3a3450, 1);
    g.fillRect(TRACK_X, TRACK_Y, TRACK_W, 1);
    for (let x = TRACK_X + 8; x < TRACK_X + TRACK_W; x += 12) g.fillRect(x, TRACK_Y - 1, 1, 3);
    // Good and perfect zones around the hit line
    const ref = c.current || c.notes[c.notes.length - 1];
    // The target zone always shows the real window of the next note, so it
    // shrinks (and turns wind-blue) while a gust note is coming in.
    const goodW = Math.round(ref.goodMs * PX_PER_MS), perfW = Math.round(ref.perfectMs * PX_PER_MS);
    const zoneColor = ref.still ? STILL_TINT : ref.gust ? 0x9fd8ff : this.color;
    g.fillStyle(zoneColor, 0.18);
    g.fillRect(HIT_X - goodW, TRACK_Y - 7, goodW * 2 + 1, 15);
    g.fillStyle(zoneColor, this.flash > 0 ? 0.75 : 0.38);
    g.fillRect(HIT_X - perfW, TRACK_Y - 7, perfW * 2 + 1, 15);
    // The hit line glows.
    g.fillStyle(zoneColor, 0.35);
    g.fillRect(HIT_X - 1, TRACK_Y - 8, 3, 17);
    g.fillStyle(0xffffff, 1);
    g.fillRect(HIT_X, TRACK_Y - 9, 1, 19);
    // Whiteout: a wall of snow on the track that notes come out of.
    if (this.revealMs) {
      const fx = Math.round(HIT_X + this.revealMs * PX_PER_MS);
      const t0 = this.scene.time.now;
      g.fillStyle(0xe8f0fa, 0.55);
      g.fillRect(fx, TRACK_Y - 8, TRACK_X + TRACK_W - fx, 17);
      g.fillStyle(0xffffff, 0.9);
      for (let i = 0; i < 14; i++) {
        const sx = fx + 2 + ((i * 37 + Math.floor(t0 / 40)) % (TRACK_X + TRACK_W - fx - 4));
        g.fillRect(sx, TRACK_Y - 7 + ((i * 11) % 15), 1, 1);
      }
    }
    // Sequence row background
    const n = c.notes.length;
    drawFrame(g, Math.round(GAME_WIDTH / 2 - (n * 10) / 2) - 5, TRACK_Y - 27, n * 10 + 8, 14, { accent: this.accent, alpha: 0.75 });
    const t = this.scene.time.now;
    const clipR = TRACK_X + TRACK_W - 4;
    let gustSoon = false;
    this.items.forEach((it) => {
      const note = it.note;
      const isCur = note === c.current;
      const x = HIT_X + (note.time - now) * PX_PER_MS;
      // Gust notes ride on a pale wind band with tighter zones.
      if (note.gust && !note.result) {
        const gw = Math.round(note.goodMs * PX_PER_MS);
        const bx = Math.max(TRACK_X, Math.round(x - gw)), ex = Math.min(clipR, Math.round(x + gw));
        if (ex > bx) { g.fillStyle(0x9fd8ff, 0.28); g.fillRect(bx, TRACK_Y - 8, ex - bx, 17); }
        if (note.time - now < 1600) gustSoon = true;
      }
      // Hold tails: a bar that must be kept pressed until its end.
      if (note.holdMs && (!note.result || note.holding)) {
        const x0 = Math.max(note.holding ? HIT_X : TRACK_X, Math.round(x));
        const x1 = Math.min(clipR, Math.round(x + note.holdMs * PX_PER_MS));
        if (x1 > x0) {
          g.fillStyle(note.holding ? 0xf2c14e : 0xf4efe4, note.holding ? 0.9 : 0.5);
          g.fillRect(x0, TRACK_Y - 2, x1 - x0, 5);
          g.fillStyle(0x16141f, 1);
          g.fillRect(x1, TRACK_Y - 3, 1, 7);
        }
      }
      // Still beats sit in a dark red band: the stretch where any press is seen.
      if (note.still && !note.result) {
        const sw = Math.round(note.goodMs * 0.85 * PX_PER_MS);
        const bx = Math.max(TRACK_X, Math.round(x - sw)), ex = Math.min(clipR, Math.round(x + sw));
        if (ex > bx) {
          g.fillStyle(0x6a1c22, 0.55); g.fillRect(bx, TRACK_Y - 8, ex - bx, 17);
          g.fillStyle(STILL_TINT, 0.8); g.fillRect(bx, TRACK_Y - 8, 1, 17); g.fillRect(ex - 1, TRACK_Y - 8, 1, 17);
        }
      }
      // Roll tails: a dotted bar with one pip per tap still needed.
      if (note.rollMs && (!note.result || note.holding)) {
        const x0 = Math.max(note.holding ? HIT_X : TRACK_X, Math.round(x));
        const x1 = Math.min(clipR, Math.round(x + note.rollMs * PX_PER_MS));
        if (x1 > x0) {
          g.fillStyle(0x9fffd0, note.holding ? 0.9 : 0.55);
          for (let px = x0; px < x1; px += 3) g.fillRect(px, TRACK_Y - 1, 2, 3);
          g.fillStyle(0x16141f, 1);
          g.fillRect(x1, TRACK_Y - 3, 1, 7);
        }
        const left = note.holding ? note.tapsLeft : note.taps;
        const px0 = (note.holding ? HIT_X : Math.round(x)) - (left * 3) / 2;
        if (left > 0 && (note.holding || (x < clipR && x > TRACK_X - 6))) {
          g.fillStyle(note.holding && Math.floor(t / 80) % 2 ? 0xffffff : 0x9fffd0, 1);
          for (let k = 0; k < left; k++) g.fillRect(Math.round(px0 + k * 3), TRACK_Y - 9, 2, 2);
        }
      }
      if (!note.result) {
        const visible = x < clipR && x > TRACK_X - 6;
        let alpha = isCur ? 1 : 0.8;
        // Blind notes vanish just before the line: you have to feel the beat.
        // In a whiteout they stay visible instead, so a note is never unseen.
        if (note.hidden && !this.revealMs && !this.dark) alpha *= Math.max(0, Math.min(1, ((note.time - now) - 280) / 180));
        if (this.revealMs) alpha *= Math.max(0, Math.min(1, (this.revealMs - (note.time - now)) / 160));
        // Darkness: every note is a faint shape that flashes up on the beat.
        if (this.dark) alpha = darkAlpha(this.dark, now, c.notes[0].time, this.route.beatMs, isCur);
        it.big.setVisible(visible && alpha > 0.02).setX(Math.round(x)).setAlpha(alpha);
        const tint = note.still ? (isCur && Math.floor(t / 120) % 2 ? 0xffffff : STILL_TINT) : note.mirror ? (isCur ? 0xffa8ec : MIRROR_TINT) : note.thermal ? THERMAL_TINT : note.gust ? 0x9fd8ff : isCur ? 0xf2c14e : 0xf4efe4;
        it.big.setTint(tint);
        if (note.chord) {
          // The first arrow already pressed lights up while the other is awaited.
          const p = note.pressed && note.pressed.dir;
          it.big.setY(TRACK_Y - 5).setTint(p === note.dir ? 0xffffff : tint);
          it.big2.setVisible(visible && alpha > 0.02).setPosition(Math.round(x), TRACK_Y + 5).setAlpha(alpha).setTint(p === note.chord ? 0xffffff : tint);
          // A bracket ties the two arrows together.
          if (visible) {
            g.fillStyle(0xf2c14e, 0.8 * alpha);
            g.fillRect(Math.round(x) - 7, TRACK_Y - 9, 1, 19);
            g.fillRect(Math.round(x) - 7, TRACK_Y - 9, 3, 1);
            g.fillRect(Math.round(x) - 7, TRACK_Y + 9, 3, 1);
          }
        }
        // A mirrored note carries a little two-headed bar under it.
        if (note.mirror && visible && alpha > 0.1) {
          g.fillStyle(MIRROR_TINT, alpha);
          g.fillRect(Math.round(x) - 3, TRACK_Y + 7, 7, 1);
          g.fillRect(Math.round(x) - 3, TRACK_Y + 6, 1, 3);
          g.fillRect(Math.round(x) + 3, TRACK_Y + 6, 1, 3);
        }
        // The next note to hit carries a soft glow.
        if (isCur && this.glow) this.glow.setVisible(visible && alpha > 0.3).setPosition(Math.round(x), TRACK_Y).setAlpha(0.55 * alpha).setTint(note.thermal ? THERMAL_TINT : note.gust ? 0x9fd8ff : 0xf2c14e);
        // A thermal note trails a small updraft under it.
        if (note.thermal && visible) {
          g.fillStyle(THERMAL_TINT, 0.6);
          for (let k = 0; k < 3; k++) g.fillRect(Math.round(x) - 3 + k * 3, TRACK_Y + 6 - ((Math.floor(t / 90) + k * 2) % 5), 1, 2);
        }
        const bob = isCur ? Math.round(1 + Math.sin(t / 90)) : 0;
        it.small.setTint(note.still ? STILL_TINT : note.mirror ? MIRROR_TINT : note.thermal ? THERMAL_TINT : isCur ? 0xf2c14e : note.gust ? 0x9fd8ff : 0xa8a3b8).setY((note.chord ? TRACK_Y - 22 : TRACK_Y - 20) - bob);
        if (it.small2) it.small2.setTint(isCur ? 0xf2c14e : 0xa8a3b8).setY(TRACK_Y - 17 - bob);
      }
      if (it.holdBar) it.holdBar.setVisible(!note.result || note.holding);
    });
    if (this.gustIcon) this.gustIcon.setVisible(gustSoon && Math.floor(t / 200) % 2 === 0);
    if (this.glow && !c.current) this.glow.setVisible(false);
  }

  updateRecovery(now) {
    const g = this.g;
    const it = this.items[0];
    if (!it || it.note.result) return;
    const cx = GAME_WIDTH / 2, cy = REC_Y;
    const remaining = Math.max(0, it.note.time - now);
    const r = Math.round(13 + remaining * 0.022);
    g.lineStyle(1, 0xf0644b, 0.9);
    g.strokeCircle(cx, cy, r);
    const goodR = Math.max(2, Math.round(it.note.goodMs * 0.022));
    g.lineStyle(goodR * 2, 0xf2c14e, 0.25);
    g.strokeCircle(cx, cy, 13);
    g.lineStyle(1, 0xffffff, 1);
    g.strokeCircle(cx, cy, 13);
  }

  // Visual confirmation for a judged note. Returns the label used.
  judge(note) {
    const it = this.items.find((x) => x.note === note);
    const key = note.result === 'miss' ? note.reason || 'late' : note.result;
    const style = RESULT_STYLE[key] || RESULT_STYLE.late;
    if (!it) return style;
    if (note.result !== 'miss') this.flash = 120;
    if (this.mode === 'combo') {
      it.big.setVisible(false);
      if (it.big2) it.big2.setVisible(false);
      if (it.small2) it.small2.setAlpha(0.25);
      if (it.mark) it.mark.destroy();
      const icon = note.result === 'miss' ? 'icon_cross' : 'icon_check';
      it.mark = this.add.image(it.small.x, it.small.y, icon).setScrollFactor(0).setDepth(DEPTH.hud + 3).setTint(style.tint);
      it.small.setAlpha(0.25);
      const pop = this.add.image(HIT_X, TRACK_Y, bigKey(note)).setScrollFactor(0).setDepth(DEPTH.hud + 3).setTint(style.tint);
      this.scene.tweens.add({ targets: pop, scale: 1.8, alpha: 0, duration: 260, onComplete: () => pop.destroy() });
    } else {
      it.big.setTint(style.tint);
    }
    return style;
  }

  hide() {
    this.items.forEach((it) => { it.big.destroy(); if (it.big2) it.big2.destroy(); if (it.small2) it.small2.destroy(); if (it.small) it.small.destroy(); if (it.mark) it.mark.destroy(); if (it.holdBar) it.holdBar.destroy(); });
    if (this.gustIcon) { this.gustIcon.destroy(); this.gustIcon = null; }
    if (this.glow) { this.glow.destroy(); this.glow = null; }
    this.items = [];
    if (this.label) { this.label.destroy(); this.label = null; }
    this.combo = null;
    this.mode = null;
    this.g.clear();
  }
}

export { RESULT_STYLE };
