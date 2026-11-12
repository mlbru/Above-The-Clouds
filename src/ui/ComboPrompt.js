import { PixelText, COLORS, drawFrame } from './PixelText.js';
import { biomeAt } from '../data/biomes.js';
import { levelToMeters } from '../config/gameConfig.js';
import { lerpColor } from '../utils/color.js';
import { DEPTH, GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';
import { ROUTE_COLORS } from '../config/balanceConfig.js';
import { darkAlpha } from '../systems/mechanics/Darkness.js';
import { gearTicks } from '../systems/mechanics/Gears.js';
import { Audio } from '../systems/AudioSystem.js';
import { BELLS } from '../systems/mechanics/Bells.js';

const PX_PER_MS = 0.085;
// Note colours, by the NOTE COLOURS setting (applyNotePalette). Mirrored
// notes are drawn the wrong way round in magenta: press the other way.
// Colour-blind palettes swap the hues that collide for that kind of sight.
const PALETTES = {
  standard: { thermal: 0xffb45a, mirror: 0xff6ad8, mirrorCur: 0xffa8ec, gust: 0x9fd8ff },
  deutan: { thermal: 0xffe040, mirror: 0x3ac8ff, mirrorCur: 0x9fe6ff, gust: 0xe8e4ff },
  tritan: { thermal: 0xff8a3a, mirror: 0xff3a7a, mirrorCur: 0xff9ab8, gust: 0xd8d8d8 },
};
export const NOTE_TINT = { ...PALETTES.standard };
// HIGH CONTRAST: a near-black track with a bright line and stronger zones.
let HIGH_CONTRAST = false;
export function applyNotePalette(name, highContrast = false) {
  Object.assign(NOTE_TINT, PALETTES[name] || PALETTES.standard);
  HIGH_CONTRAST = !!highContrast;
}
const FLIP = { L: 'R', R: 'L', U: 'U' };
// What the note looks like on the track (a mirrored note shows the other arrow).
const shownDir = (note) => (note.mirror ? FLIP[note.dir] : note.dir);
// Still beats show a red pause sign instead of an arrow; the Amber Hive's
// swarm beats show an amber bee.
export const STILL_TINT = 0xf0644b;
export const SWARM_TINT = 0xffb840;
// Gear notes (the Clockwork Bastion) sit on a brass cog.
export const GEAR_TINT = 0xf0c870;
const stillTint = (note) => (note.swarm ? SWARM_TINT : STILL_TINT);
const bigKey = (note, dir = shownDir(note)) => (note.swarm ? 'icon_swarm' : note.still ? 'icon_still' : note.echo ? 'icon_bell' : `arrow_${dir}`);
const smallKey = (note, dir = shownDir(note)) => (note.swarm ? 'icon_swarm_s' : note.still ? 'icon_still_s' : `arrow_s_${dir}`);
// The Hanging Monastery's bells: echo notes are gold bells, the call lights
// the row of arrows one by one. The Moss Cathedral's vines are green.
export const BELL_TINT = 0xf2c252;
const VINE = 0x5ab83a, VINE_LIT = 0xb8ff6a, VINE_DARK = 0x2a5a18;
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
  stung: { text: 'STUNG!', color: COLORS.red, tint: 0xf0644b },
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
    // Trail Boons: SONGBIRD lets notes in later, CAT'S EYES keeps faded notes faintly lit.
    const boon = (this.scene.boonView && this.scene.boonView()) || {};
    this.minAlpha = boon.minAlpha || 0;
    this.metronome = !!boon.metronome;
    if (boon.lateReveal && boon.lateReveal < 1) {
      const late = Math.round(((TRACK_X + TRACK_W - HIT_X) / PX_PER_MS) * boon.lateReveal);
      if (!this.revealMs || late < this.revealMs) this.revealMs = late;
    }
    // The Cascade's spray curtain and the Monastery's bell call (see update).
    this.spray = route.spray || null;
    this.sprayT0 = null;
    this.echo = route.echo ? { t0: null, step: Math.round(BELLS.stepBeats * combo.beatMs), lit: -1, rings: [] } : null;
    const n = combo.notes.length;
    const seqX = Math.round(GAME_WIDTH / 2 - (n * 10) / 2);
    combo.notes.forEach((note, i) => {
      const big = this.add.image(0, TRACK_Y, bigKey(note)).setScrollFactor(0).setDepth(DEPTH.hud + 2);
      const small = this.add.image(seqX + i * 10 + 4, TRACK_Y - 20, note.echo ? 'icon_bell_s' : smallKey(note)).setScrollFactor(0).setDepth(DEPTH.hud + 2);
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
      const holdBar = note.holdMs ? this.add.rectangle(seqX + i * 10 + 1, TRACK_Y - 15, note.vine ? 10 : 7, 1, note.vine ? VINE : 0xf2c14e).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.hud + 2)
        : note.rollMs ? this.add.rectangle(seqX + i * 10 + 1, TRACK_Y - 15, 7, 1, 0x9fffd0).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.hud + 2) : null;
      // A gear note's cog turns behind it, on the track and in the sequence row.
      const cog = note.gear ? this.add.image(0, TRACK_Y, 'icon_cog').setScrollFactor(0).setDepth(DEPTH.hud + 1.9).setTint(GEAR_TINT) : null;
      const cogS = note.gear ? this.add.image(small.x, small.y, 'icon_cog_s').setScrollFactor(0).setDepth(DEPTH.hud + 1.9).setTint(0xb8863a) : null;
      this.items.push({ note, big, small, big2, small2, mark: null, holdBar, cog, cogS, ticks: -1, sx: seqX + i * 10 + 4 });
    });
    if (combo.notes.some((n) => n.gust)) {
      this.gustIcon = this.add.image(TRACK_X + TRACK_W - 6, TRACK_Y - 33, 'icon_wind').setOrigin(1, 0).setTint(NOTE_TINT.gust).setScrollFactor(0).setDepth(DEPTH.hud + 2).setVisible(false);
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
    drawFrame(g, TRACK_X - 5, TRACK_Y - 10, TRACK_W + 10, 21, { accent: this.accent, alpha: HIGH_CONTRAST ? 1 : 0.85 });
    if (HIGH_CONTRAST) g.fillStyle(0x000000, 1).fillRect(TRACK_X - 3, TRACK_Y - 8, TRACK_W + 6, 17);
    g.fillStyle(HIGH_CONTRAST ? 0xffffff : 0x3a3450, 1);
    g.fillRect(TRACK_X, TRACK_Y, TRACK_W, 1);
    for (let x = TRACK_X + 8; x < TRACK_X + TRACK_W; x += 12) g.fillRect(x, TRACK_Y - 1, 1, 3);
    // Good and perfect zones around the hit line
    const ref = c.current || c.notes[c.notes.length - 1];
    // The target zone always shows the real window of the next note, so it
    // shrinks (and turns wind-blue) while a gust note is coming in.
    const goodW = Math.round(ref.goodMs * PX_PER_MS), perfW = Math.round(ref.perfectMs * PX_PER_MS);
    const zoneColor = ref.still ? stillTint(ref) : ref.gust ? NOTE_TINT.gust : this.color;
    g.fillStyle(zoneColor, HIGH_CONTRAST ? 0.3 : 0.18);
    g.fillRect(HIT_X - goodW, TRACK_Y - 7, goodW * 2 + 1, 15);
    g.fillStyle(zoneColor, this.flash > 0 ? 0.75 : HIGH_CONTRAST ? 0.55 : 0.38);
    g.fillRect(HIT_X - perfW, TRACK_Y - 7, perfW * 2 + 1, 15);
    // The hit line glows.
    g.fillStyle(zoneColor, 0.35);
    g.fillRect(HIT_X - 1, TRACK_Y - 8, 3, 17);
    g.fillStyle(0xffffff, 1);
    g.fillRect(HIT_X, TRACK_Y - 9, 1, 19);
    // Boons can change from beat to beat (NIGHT SHIFT's lightning).
    if (this.scene.boonView) this.minAlpha = this.scene.boonView().minAlpha || 0;
    if (this.metronome) this.drawMetronome(g, now);
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
    const curtain = this.spray ? this.drawSpray(g, now, t) : null;
    if (this.echo) this.updateCall(g, now, t);
    this.items.forEach((it) => {
      const note = it.note;
      const isCur = note === c.current;
      let x = HIT_X + (note.time - now) * PX_PER_MS;
      // A roped pair comes in the wrong way round, tied together; a beat and
      // a half before the first reaches the line they hop over each other
      // (the first over the top, the second underneath) into their true
      // order and the rope slips off. Only the drawing changes.
      let swapY = 0;
      if (note.swap && !note.result) {
        const first = note.swap === 1 ? note : c.notes[note.index - 1];
        const partner = c.notes[note.index + (note.swap === 1 ? 1 : -1)];
        const px = HIT_X + (partner.time - now) * PX_PER_MS;
        const at = first.time - Math.max(650, 1.6 * c.beatMs);
        const p = Math.max(0, Math.min(1, (now - at) / 260));
        const e = p * p * (3 - 2 * p);
        const natural = x;
        x = px + (natural - px) * e;
        swapY = Math.round(Math.sin(p * Math.PI) * (note.swap === 1 ? -9 : 6));
        const ps = this.items[partner.index].sx;
        it.small.setX(Math.round(ps + (it.sx - ps) * e));
        if (note.swap === 1) {
          const x2 = natural + (px - natural) * e; // where the second one is drawn
          const y2 = Math.round(Math.sin(p * Math.PI) * 6);
          const vis = Math.min(x, x2) < clipR && Math.max(x, x2) > TRACK_X - 6;
          if (vis && p < 1) {
            // The rope: red and cream, sagging between the two, a knot at each end.
            const a = Math.round(Math.min(x, x2)), b = Math.round(Math.max(x, x2));
            for (let px2 = a; px2 <= b; px2 += 2) {
              const u = (px2 - a) / Math.max(1, b - a);
              const y = Math.round(TRACK_Y + 6 + Math.sin(u * Math.PI) * 2 + (swapY + y2) * 0.5 * (1 - Math.abs(u - 0.5) * 2));
              g.fillStyle(Math.floor(px2 / 4) % 2 ? 0xf4efe4 : 0xe0503a, 1).fillRect(Math.min(clipR, px2), y, 2, 1);
            }
            g.fillStyle(0xe0503a, 1).fillRect(a - 1, TRACK_Y + 5, 3, 2).fillRect(b - 1, TRACK_Y + 5, 3, 2);
          }
          // The rope slips off: a short flash between them.
          if (p >= 1 && now - at < 520 && vis) {
            const k = (now - at - 260) / 260, mx = Math.round((x + x2) / 2);
            g.fillStyle(0xffffff, Math.max(0, 1 - k)).fillRect(mx - 1, TRACK_Y + 4, 3, 1).fillRect(mx - 4 - Math.round(k * 6), TRACK_Y + 6, 2, 1).fillRect(mx + 3 + Math.round(k * 6), TRACK_Y + 6, 2, 1);
          }
        }
      } else if (note.swap) it.small.setX(it.sx);
      // Gust notes ride on a pale wind band with tighter zones.
      if (note.gust && !note.result) {
        const gw = Math.round(note.goodMs * PX_PER_MS);
        const bx = Math.max(TRACK_X, Math.round(x - gw)), ex = Math.min(clipR, Math.round(x + gw));
        if (ex > bx) { g.fillStyle(NOTE_TINT.gust, 0.28); g.fillRect(bx, TRACK_Y - 8, ex - bx, 17); }
        if (note.time - now < 1600) gustSoon = true;
      }
      // Hold tails: a bar that must be kept pressed until its end.
      if (note.vine && (!note.result || note.holding)) this.drawVine(g, note, x, clipR, t);
      else if (note.holdMs && (!note.result || note.holding)) {
        const x0 = Math.max(note.holding ? HIT_X : TRACK_X, Math.round(x));
        const x1 = Math.min(clipR, Math.round(x + note.holdMs * PX_PER_MS));
        if (x1 > x0) {
          g.fillStyle(note.holding ? 0xf2c14e : 0xf4efe4, note.holding ? 0.9 : 0.5);
          g.fillRect(x0, TRACK_Y - 2, x1 - x0, 5);
          g.fillStyle(0x16141f, 1);
          g.fillRect(x1, TRACK_Y - 3, 1, 7);
        }
      }
      // Still beats sit in a dark band (red, or amber for the swarm): the
      // stretch where any press is seen.
      if (note.still && !note.result) {
        const sw = Math.round(note.goodMs * 0.85 * PX_PER_MS);
        const bx = Math.max(TRACK_X, Math.round(x - sw)), ex = Math.min(clipR, Math.round(x + sw));
        if (ex > bx) {
          g.fillStyle(note.swarm ? 0x5a3a0a : 0x6a1c22, 0.55); g.fillRect(bx, TRACK_Y - 8, ex - bx, 17);
          g.fillStyle(stillTint(note), 0.8); g.fillRect(bx, TRACK_Y - 8, 1, 17); g.fillRect(ex - 1, TRACK_Y - 8, 1, 17);
        }
      }
      // Gear notes: the arrow comes in turned back and turns clockwise with
      // its cog, a quarter on a beat, until it clicks into place two beats
      // before the line. Once locked the cog stops and dims: now press.
      if (note.gear) {
        const ticks = note.result ? 0 : gearTicks(note, now, c.beatMs);
        if (it.ticks < 0) { it.ticks = ticks; it.ang = (-ticks * Math.PI) / 2; }
        else if (ticks !== it.ticks) {
          it.ticks = ticks;
          if (x < clipR) Audio.play('clank');
          if (ticks === 0) it.lockAt = t;
        }
        it.ang += ((-ticks * Math.PI) / 2 - it.ang) * Math.min(1, dt / 70);
        const show = !note.result && x < clipR && x > TRACK_X - 6;
        const locked = ticks === 0;
        it.big.setRotation(it.ang);
        it.small.setRotation(it.ang);
        it.cog.setVisible(show).setPosition(Math.round(x), TRACK_Y).setRotation(it.ang).setAlpha(locked ? 0.45 : 1);
        it.cogS.setVisible(!note.result).setPosition(it.small.x, it.small.y).setRotation(it.ang).setAlpha(locked ? 0.45 : 1);
        // The click: brackets snap shut around the arrow as it locks.
        if (show && it.lockAt && t - it.lockAt < 220) {
          const k = (t - it.lockAt) / 220, r = Math.round(12 - k * 4);
          g.fillStyle(0xffffff, 1 - k);
          g.fillRect(Math.round(x) - r, TRACK_Y - 8, 2, 17);
          g.fillRect(Math.round(x) + r - 1, TRACK_Y - 8, 2, 17);
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
        if (this.minAlpha && (note.hidden || this.revealMs || this.dark)) alpha = Math.max(alpha, this.minAlpha * (isCur ? 1 : 0.8));
        // Behind the spray curtain a note ripples: it bobs and shimmers.
        let wet = 0;
        if (curtain && Math.abs(x - curtain.x) < curtain.w / 2) {
          wet = 1 - Math.abs(x - curtain.x) / (curtain.w / 2);
          alpha *= 0.75 + 0.25 * Math.sin(t / 70 + note.index * 2.1);
        }
        const wobX = wet ? Math.round(Math.sin(t / 95 + note.index * 1.7) * 1.5 * wet) : 0;
        it.big.setVisible(visible && alpha > 0.02).setX(Math.round(x) + wobX).setAlpha(alpha);
        it.big.setY(TRACK_Y + (note.swap ? swapY : 0) + (wet ? Math.round(Math.sin(t / 80 + note.index * 2.3) * 3 * wet) : 0));
        let tint = note.still ? (isCur && Math.floor(t / 120) % 2 ? 0xffffff : stillTint(note)) : note.echo ? (isCur ? 0xfff0a8 : BELL_TINT) : note.mirror ? (isCur ? NOTE_TINT.mirrorCur : NOTE_TINT.mirror) : note.thermal ? NOTE_TINT.thermal : note.gust ? NOTE_TINT.gust : isCur ? 0xf2c14e : 0xf4efe4;
        if (wet) tint = lerpColor(tint, 0xd8f8ff, 0.35 * wet);
        it.big.setTint(tint);
        // A vine's next note sits in a ring of leaves.
        if (visible && alpha > 0.1 && note.index > 0 && c.notes[note.index - 1].vine) this.drawLeaves(g, Math.round(x), TRACK_Y, t, note.index);
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
          g.fillStyle(NOTE_TINT.mirror, alpha);
          g.fillRect(Math.round(x) - 3, TRACK_Y + 7, 7, 1);
          g.fillRect(Math.round(x) - 3, TRACK_Y + 6, 1, 3);
          g.fillRect(Math.round(x) + 3, TRACK_Y + 6, 1, 3);
        }
        // The next note to hit carries a soft glow.
        if (isCur && this.glow) this.glow.setVisible(visible && alpha > 0.3).setPosition(Math.round(x), TRACK_Y).setAlpha(0.55 * alpha).setTint(note.thermal ? NOTE_TINT.thermal : note.gust ? NOTE_TINT.gust : 0xf2c14e);
        // A thermal note trails a small updraft under it.
        if (note.thermal && visible) {
          g.fillStyle(NOTE_TINT.thermal, 0.6);
          for (let k = 0; k < 3; k++) g.fillRect(Math.round(x) - 3 + k * 3, TRACK_Y + 6 - ((Math.floor(t / 90) + k * 2) % 5), 1, 2);
        }
        const bob = isCur ? Math.round(1 + Math.sin(t / 90)) : 0;
        if (note.echo) it.small.setTint(this.echo && it.callLit ? 0xffffff : isCur ? 0xf2c14e : 0xb8862a).setY(TRACK_Y - 20 - bob);
        else it.small.setTint(note.still ? stillTint(note) : note.mirror ? NOTE_TINT.mirror : note.thermal ? NOTE_TINT.thermal : isCur ? 0xf2c14e : note.gust ? NOTE_TINT.gust : 0xa8a3b8).setY((note.chord ? TRACK_Y - 22 : TRACK_Y - 20) - bob);
        if (it.small2) it.small2.setTint(isCur ? 0xf2c14e : 0xa8a3b8).setY(TRACK_Y - 17 - bob);
      }
      if (it.holdBar) it.holdBar.setVisible(!note.result || note.holding);
    });
    if (this.gustIcon) this.gustIcon.setVisible(gustSoon && Math.floor(t / 200) % 2 === 0);
    if (this.glow && !c.current) this.glow.setVisible(false);
  }

  // METRONOME (a gift): a little brass metronome left of the track, its arm
  // swinging from side to side and reaching the end of each swing on the
  // beat, when the hit line flashes gold.
  drawMetronome(g, now) {
    const c = this.combo;
    const t0 = c.notes[0].time, b = c.beatMs;
    const ph = (now - t0) / b;
    const frac = ((ph % 1) + 1) % 1;
    const tick = Math.max(0, 1 - Math.min(frac, 1 - frac) * b / 110);
    const x = TRACK_X - 16, y = TRACK_Y + 9;
    // The body: a wooden pyramid with a brass face.
    for (let k = 0; k < 20; k++) {
      const half = Math.round(2 + k * 0.32);
      g.fillStyle(k === 19 ? 0x16141f : 0x6a4428, 1).fillRect(x - half - 1, y - k, half * 2 + 3, 1);
      g.fillStyle(k > 17 ? 0x3a2414 : 0x9a6a3a, 1).fillRect(x - half, y - k, half * 2 + 1, 1);
    }
    g.fillStyle(0xd8a040, 1).fillRect(x - 1, y - 16, 3, 12);
    // The arm: a cosine swing, at an end on every beat.
    const ang = Math.cos(ph * Math.PI) * 0.55;
    const ax = x + Math.sin(ang) * 22, ay = y - 3 - Math.cos(ang) * 22;
    g.lineStyle(1, 0xf2c14e, 1).lineBetween(x, y - 3, ax, ay);
    g.fillStyle(0xffd870, 1).fillRect(Math.round(x + Math.sin(ang) * 14) - 1, Math.round(y - 3 - Math.cos(ang) * 14) - 1, 3, 3);
    if (tick > 0) {
      g.fillStyle(0xffffff, tick).fillRect(Math.round(ax) - 1, Math.round(ay) - 1, 3, 3);
      g.fillStyle(0xffd870, 0.55 * tick).fillRect(HIT_X - 2, TRACK_Y - 10, 5, 21);
    }
  }

  // ---- The Cascade: a curtain of spray sweeping across the track. Returns
  // { x, w } (track coordinates) so the notes behind it can ripple.
  drawSpray(g, now, t) {
    const sp = this.spray, c = this.combo;
    if (this.sprayT0 === null) this.sprayT0 = now;
    // The curtain swings to and fro across the track like the waterfall it
    // comes from: one full swing every sweepBeats.
    const ph = ((now - this.sprayT0) / (sp.sweepBeats * c.beatMs)) * Math.PI * 2 + (sp.fromLeft ? -Math.PI / 2 : Math.PI / 2);
    const cx = TRACK_X + TRACK_W / 2 + Math.sin(ph) * (TRACK_W / 2 + 8);
    const half = sp.width / 2;
    const x0 = Math.max(TRACK_X - 4, Math.round(cx - half)), x1 = Math.min(TRACK_X + TRACK_W + 4, Math.round(cx + half));
    if (x1 > x0) {
      for (let x = x0; x < x1; x++) {
        const k = 1 - Math.abs(x - cx) / half;
        g.fillStyle(0xe8faff, 0.12 + 0.28 * k).fillRect(x, TRACK_Y - 10, 1, 21);
        // Threads of falling water, each running down at its own speed.
        if (x % 2 === 0) {
          const sp2 = 0.06 + ((x * 7) % 5) * 0.014;
          const y = TRACK_Y - 10 + Math.floor((t * sp2 + x * 13) % 24);
          if (y < TRACK_Y + 10) g.fillStyle(0xffffff, 0.5 + 0.5 * k).fillRect(x, y, 1, 4);
        }
      }
      // Pale edges, and drops spattering off the top of the frame.
      g.fillStyle(0xffffff, 0.35).fillRect(x0, TRACK_Y - 10, 1, 21).fillRect(x1 - 1, TRACK_Y - 10, 1, 21);
      for (let i = 0; i < 8; i++) {
        const dx = ((i * 37 + Math.floor(t / 50)) % sp.width) - half;
        const hop = Math.abs(Math.sin(t / 130 + i)) * 6;
        if (cx + dx > TRACK_X && cx + dx < TRACK_X + TRACK_W) g.fillStyle(0xffffff, 0.9).fillRect(Math.round(cx + dx), Math.round(TRACK_Y - 12 - hop), 1, 2);
      }
    }
    // The rainbow it is painting: one band per perfect in the spray, a small
    // arc above the right end of the track.
    const spray = this.scene.mechanics && this.scene.mechanics.get('spray');
    if (spray) this.drawRainbowMeter(g, TRACK_X + TRACK_W - 16, TRACK_Y - 13, spray.rainbow, spray.cfg.rainbowNeed, t);
    return { x: cx, w: sp.width };
  }

  drawRainbowMeter(g, cx, cy, filled, need, t) {
    const bands = [0xff5a5a, 0xffa040, 0xfff070, 0x6ae070, 0x5aa8ff, 0x9a70f0];
    // A dark backing so it reads over any rock.
    g.fillStyle(0x16141f, 0.85).fillRect(cx - 14, cy - 13, 29, 14);
    for (let i = 0; i < need; i++) {
      const r = 12 - i * 1.6, on = i < filled;
      const col = bands[i % bands.length];
      for (let a = 0; a <= 24; a++) {
        const ang = Math.PI + (a / 24) * Math.PI;
        g.fillStyle(on ? col : 0x4a4460, on ? 1 : 0.8).fillRect(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r * 0.85), 1, 1);
      }
    }
    if (filled === need - 1 && Math.floor(t / 200) % 2) g.fillStyle(0xffffff, 0.9).fillRect(cx - 1, cy - 12, 3, 1);
  }

  // ---- The Hanging Monastery: the call. The monk's strikes light the
  // row's arrows one by one; when the phrase is done they turn back into
  // blank bells, before the first note reaches the line.
  updateCall(g, now, t) {
    const e = this.echo, c = this.combo;
    if (e.t0 === null) e.t0 = now + 200;
    const k = Math.floor((now - e.t0) / e.step);
    const n = c.notes.length;
    const calling = now >= e.t0 && k < n;
    if (calling && k !== e.lit) {
      e.lit = k;
      const it = this.items[k];
      if (it) e.rings.push({ x: it.sx, t });
      if (this.scene.onBellStrike) this.scene.onBellStrike(k, n);
    }
    this.items.forEach((it, i) => {
      if (!it.note.echo || it.note.result) return;
      const show = calling && i <= k;
      it.callLit = calling && i === k;
      it.small.setTexture(show ? `arrow_s_${it.note.dir}` : 'icon_bell_s');
    });
    // Rings of light out from the lit arrow (the bell's note, seen).
    e.rings = e.rings.filter((r) => t - r.t < 520);
    for (const r of e.rings) {
      const a = (t - r.t) / 520, rr = 4 + a * 9;
      g.lineStyle(1, 0xfff0a8, 0.8 * (1 - a)).strokeCircle(r.x, TRACK_Y - 20, rr);
    }
    // A little bell at the left end of the row, swinging while it rings.
    const bx = this.items.length ? this.items[0].sx - 12 : HIT_X, by = TRACK_Y - 22;
    const swing = calling ? Math.sin((now - e.t0) / e.step * Math.PI * 2) * 2 : 0;
    g.fillStyle(0x16141f, 1).fillRect(bx - 3 + Math.round(swing), by - 1, 7, 7);
    g.fillStyle(calling ? 0xfff0a8 : 0xb8862a, 1).fillRect(bx - 2 + Math.round(swing), by + 1, 5, 4).fillRect(bx - 1 + Math.round(swing), by, 3, 1);
    g.fillStyle(0x16141f, 1).fillRect(bx + Math.round(swing * 1.5), by + 5, 1, 1);
  }

  // ---- The Moss Cathedral: a vine from a held note to the next one. A stem
  // that wanders up and down with leaves along it; the part you are holding
  // glows, and it curls up into the next arrow where it bends.
  drawVine(g, note, x, clipR, t) {
    const x0 = Math.max(note.holding ? HIT_X : TRACK_X, Math.round(x));
    const x1 = Math.min(clipR, Math.round(x + note.holdMs * PX_PER_MS));
    if (x1 <= x0) return;
    const lit = note.holding;
    for (let px = x0; px <= x1; px++) {
      const u = (px - x) / Math.max(1, note.holdMs * PX_PER_MS);
      const y = TRACK_Y + Math.round(Math.sin(u * Math.PI * 2 + note.index) * 2.5 - Math.max(0, u - 0.85) * 18);
      g.fillStyle(lit ? VINE_LIT : VINE, 1).fillRect(px, y, 1, 2);
      g.fillStyle(VINE_DARK, 1).fillRect(px, y + 2, 1, 1);
      // Leaves every few pixels, alternating sides, nodding.
      const step = Math.round(px - x);
      if (step % 7 === 3 && u < 0.92) {
        const up = (step / 7) % 2 < 1 ? -1 : 1;
        const nod = lit ? Math.round(Math.sin(t / 120 + px) * 1) : 0;
        g.fillStyle(lit ? VINE_LIT : VINE, 1).fillRect(px - 1, y + up * 2 + nod, 3, 1).fillRect(px, y + up * 3 + nod, 2, 1);
      }
    }
    // A knot where the vine ends, the bend.
    g.fillStyle(VINE_DARK, 1).fillRect(x1 - 1, TRACK_Y - 3, 3, 3);
  }

  drawLeaves(g, x, y, t, i) {
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + t / 900 + i;
      const lx = Math.round(x + Math.cos(a) * 9), ly = Math.round(y + Math.sin(a) * 7);
      g.fillStyle(k % 2 ? VINE : VINE_LIT, 0.9).fillRect(lx - 1, ly, 3, 1).fillRect(lx, ly - 1, 1, 1);
    }
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
    const key = note.result === 'miss' ? (note.swarm && note.reason === 'moved' ? 'stung' : note.reason || 'late') : note.result;
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
      // An echo note shows the arrow it was, once judged.
      if (note.echo) it.small.setTexture(`arrow_s_${note.dir}`);
      it.small.setAlpha(0.25);
      const pop = this.add.image(HIT_X, TRACK_Y, note.echo ? `arrow_${note.dir}` : bigKey(note)).setScrollFactor(0).setDepth(DEPTH.hud + 3).setTint(style.tint);
      this.scene.tweens.add({ targets: pop, scale: 1.8, alpha: 0, duration: 260, onComplete: () => pop.destroy() });
    } else {
      it.big.setTint(style.tint);
    }
    return style;
  }

  hide() {
    this.items.forEach((it) => { it.big.destroy(); if (it.big2) it.big2.destroy(); if (it.small2) it.small2.destroy(); if (it.small) it.small.destroy(); if (it.mark) it.mark.destroy(); if (it.holdBar) it.holdBar.destroy(); if (it.cog) it.cog.destroy(); if (it.cogS) it.cogS.destroy(); });
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
