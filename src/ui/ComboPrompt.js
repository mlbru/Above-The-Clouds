import { PixelText, COLORS, drawPanel } from './PixelText.js';
import { DEPTH, GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';
import { ROUTE_COLORS } from '../config/balanceConfig.js';
import { darkAlpha } from '../systems/mechanics/Darkness.js';

const PX_PER_MS = 0.085;
export const THERMAL_TINT = 0xffb45a;
export const ECHO_TINT = 0xb8fff4;
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
};

// The timing UI: notes slide right-to-left into a fixed target zone.
export class ComboPrompt {
  constructor(scene) {
    this.scene = scene;
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud);
    this.items = [];
    this.combo = null;
    this.mode = null;
    this.flash = 0;
  }

  // echoOffset: the crystal plays every note this many ms earlier, then you answer.
  show(combo, route, { echoOffset = 0 } = {}) {
    this.hide();
    this.echoOffset = echoOffset;
    this.dark = (route.mods && route.mods.dark) || null;
    this.combo = combo;
    this.mode = 'combo';
    this.route = route;
    this.color = route.toLedge ? ROUTE_COLORS.ledge : ROUTE_COLORS[route.type];
    // Biome mechanics (whiteout) can make notes appear only shortly before the line.
    this.revealMs = (route.mods && route.mods.revealMs) || 0;
    const n = combo.notes.length;
    const seqX = Math.round(GAME_WIDTH / 2 - (n * 10) / 2);
    combo.notes.forEach((note, i) => {
      const big = this.scene.add.image(0, TRACK_Y, `arrow_${note.dir}`).setScrollFactor(0).setDepth(DEPTH.hud + 2);
      const small = this.scene.add.image(seqX + i * 10 + 4, TRACK_Y - 20, `arrow_s_${note.dir}`).setScrollFactor(0).setDepth(DEPTH.hud + 2);
      // A short bar under the small arrow marks a hold note in the sequence.
      const holdBar = note.holdMs ? this.scene.add.rectangle(seqX + i * 10 + 1, TRACK_Y - 15, 7, 1, 0xf2c14e).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.hud + 2) : null;
      // Echo: the sequence stays hidden; a crystal copy of each note plays first.
      const call = echoOffset ? this.scene.add.image(0, TRACK_Y, `arrow_${note.dir}`).setTint(ECHO_TINT).setScrollFactor(0).setDepth(DEPTH.hud + 2).setVisible(false) : null;
      if (echoOffset) small.setVisible(false);
      this.items.push({ note, big, small, mark: null, holdBar, call, called: false });
    });
    if (combo.notes.some((n) => n.gust)) {
      this.gustIcon = this.scene.add.image(TRACK_X + TRACK_W - 6, TRACK_Y - 33, 'icon_wind').setOrigin(1, 0).setTint(0x9fd8ff).setScrollFactor(0).setDepth(DEPTH.hud + 2).setVisible(false);
    }
    const tags = [...(route.tags || []), ...(route.mods ? [route.mods.tag] : []), ...(route.thermal ? ['THERMAL'] : []), ...(route.echo ? ['ECHO: LISTEN, THEN PLAY'] : [])];
    this.label = new PixelText(this.scene, TRACK_X, TRACK_Y - 33, `${route.label} ROUTE${tags.length ? '  \u2022 ' + tags.join(' ') : ''}`, { color: COLORS.dim }).setScrollFactor(0).setDepth(DEPTH.hud + 1);
  }

  showRecovery(combo, { label = 'GRAB THE WALL!', color = COLORS.red } = {}) {
    this.hide();
    this.combo = combo;
    this.mode = 'recovery';
    const note = combo.notes[0];
    const big = this.scene.add.image(GAME_WIDTH / 2, REC_Y, `arrow_${note.dir}`).setScrollFactor(0).setDepth(DEPTH.hud + 2).setScale(2);
    this.items.push({ note, big, small: null, mark: null });
    this.label = new PixelText(this.scene, GAME_WIDTH / 2 + 26, REC_Y - 3, label, { color }).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.hud + 1);
  }

  update(now, dt) {
    const g = this.g;
    g.clear();
    if (!this.combo) return;
    this.flash = Math.max(0, this.flash - dt);
    if (this.mode === 'recovery') return this.updateRecovery(now);
    const c = this.combo;
    // Track
    drawPanel(g, TRACK_X - 4, TRACK_Y - 9, TRACK_W + 8, 19, { alpha: 0.78 });
    g.fillStyle(0x2e2a3c, 1);
    g.fillRect(TRACK_X, TRACK_Y, TRACK_W, 1);
    // Good and perfect zones around the hit line
    const ref = c.current || c.notes[c.notes.length - 1];
    // The target zone always shows the real window of the next note, so it
    // shrinks (and turns wind-blue) while a gust note is coming in.
    const goodW = Math.round(ref.goodMs * PX_PER_MS), perfW = Math.round(ref.perfectMs * PX_PER_MS);
    const zoneColor = ref.gust ? 0x9fd8ff : this.color;
    g.fillStyle(zoneColor, 0.18);
    g.fillRect(HIT_X - goodW, TRACK_Y - 7, goodW * 2 + 1, 15);
    g.fillStyle(zoneColor, this.flash > 0 ? 0.75 : 0.38);
    g.fillRect(HIT_X - perfW, TRACK_Y - 7, perfW * 2 + 1, 15);
    g.fillStyle(0xffffff, 1);
    g.fillRect(HIT_X, TRACK_Y - 8, 1, 17);
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
    drawPanel(g, Math.round(GAME_WIDTH / 2 - (n * 10) / 2) - 4, TRACK_Y - 26, n * 10 + 6, 12, { alpha: 0.7 });
    const t = this.scene.time.now;
    const clipR = TRACK_X + TRACK_W - 4;
    let gustSoon = false;
    this.items.forEach((it) => {
      const note = it.note;
      const isCur = note === c.current;
      const x = HIT_X + (note.time - now) * PX_PER_MS;
      // Gust notes ride on a pale wind band with tighter zones.
      if (note.gust && !note.result && !this.echoOffset) {
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
      if (!note.result) {
        const visible = x < clipR && x > TRACK_X - 6;
        let alpha = isCur ? 1 : 0.8;
        // Blind notes vanish just before the line: you have to feel the beat.
        // In a whiteout they stay visible instead, so a note is never unseen.
        if (note.hidden && !this.revealMs && !this.dark) alpha *= Math.max(0, Math.min(1, ((note.time - now) - 280) / 180));
        if (this.revealMs) alpha *= Math.max(0, Math.min(1, (this.revealMs - (note.time - now)) / 160));
        // Darkness: every note is a faint shape that flashes up on the beat.
        if (this.dark) alpha = darkAlpha(this.dark, now, c.notes[0].time, this.route.beatMs, isCur);
        if (this.echoOffset) alpha = 0;
        it.big.setVisible(visible && alpha > 0.02).setX(Math.round(x)).setAlpha(alpha);
        it.big.setTint(note.thermal ? THERMAL_TINT : note.gust ? 0x9fd8ff : isCur ? 0xf2c14e : 0xf4efe4);
        // A thermal note trails a small updraft under it.
        if (note.thermal && visible) {
          g.fillStyle(THERMAL_TINT, 0.6);
          for (let k = 0; k < 3; k++) g.fillRect(Math.round(x) - 3 + k * 3, TRACK_Y + 6 - ((Math.floor(t / 90) + k * 2) % 5), 1, 2);
        }
        it.small.setTint(note.thermal ? THERMAL_TINT : isCur ? 0xf2c14e : note.gust ? 0x9fd8ff : 0xa8a3b8).setY(TRACK_Y - 20 - (isCur ? Math.round(1 + Math.sin(t / 90)) : 0));
      }
      if (it.holdBar) it.holdBar.setVisible(!note.result || note.holding);
      if (it.call) {
        const callT = note.time - this.echoOffset;
        const cx = HIT_X + (callT - now) * PX_PER_MS;
        it.call.setVisible(cx < clipR && now < callT + 90).setX(Math.round(cx)).setAlpha(now >= callT ? 1 - (now - callT) / 90 : 0.9);
        if (!it.called && now >= callT) {
          it.called = true;
          this.flash = 120;
          if (this.onEchoCall) this.onEchoCall(note);
        }
      }
    });
    if (this.gustIcon) this.gustIcon.setVisible(gustSoon && Math.floor(t / 200) % 2 === 0);
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
      if (it.mark) it.mark.destroy();
      const icon = note.result === 'miss' ? 'icon_cross' : 'icon_check';
      it.small.setVisible(true);
      it.mark = this.scene.add.image(it.small.x, it.small.y, icon).setScrollFactor(0).setDepth(DEPTH.hud + 3).setTint(style.tint);
      it.small.setAlpha(0.25);
      const pop = this.scene.add.image(HIT_X, TRACK_Y, `arrow_${note.dir}`).setScrollFactor(0).setDepth(DEPTH.hud + 3).setTint(style.tint);
      this.scene.tweens.add({ targets: pop, scale: 1.8, alpha: 0, duration: 260, onComplete: () => pop.destroy() });
    } else {
      it.big.setTint(style.tint);
    }
    return style;
  }

  hide() {
    this.items.forEach((it) => { it.big.destroy(); if (it.small) it.small.destroy(); if (it.mark) it.mark.destroy(); if (it.holdBar) it.holdBar.destroy(); if (it.call) it.call.destroy(); });
    if (this.gustIcon) { this.gustIcon.destroy(); this.gustIcon = null; }
    this.items = [];
    if (this.label) { this.label.destroy(); this.label = null; }
    this.combo = null;
    this.mode = null;
    this.g.clear();
  }
}

export { RESULT_STYLE };
