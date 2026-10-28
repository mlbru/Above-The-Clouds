import Phaser from 'phaser';
import { DEPTH } from '../config/gameConfig.js';
import { POSES, FRAME_H, FRAME_W } from '../render/climberArt.js';
import { Audio } from '../systems/AudioSystem.js';

// Fidgets while resting: [pose, ms, puff?] steps. puff = frame point where a
// little chalk cloud comes off the hands.
const FIDGETS = {
  stretch: [['stretch', 380], ['stretch_b', 900], ['stretch', 300], ['stand', 0]],
  chalk: [['chalk', 650, [26, 36]], ['clap_open', 160], ['clap', 140, [24, 13]], ['clap_open', 140], ['clap', 140, [24, 13]], ['stand', 0]],
  shake: [['shake', 130], ['shake2', 130], ['shake', 130], ['shake2', 130], ['shake', 130], ['shake2', 130], ['stand', 0]],
  look: [['look', 1500], ['stand', 400], ['look2', 1500], ['stand', 0]],
};
export const FIDGET_NAMES = Object.keys(FIDGETS);
// LEDGE LIFE: LIVELY adds these. A step may carry a prop (drawn at the right
// hand: 'bottle', or between the hands: 'map'); puff 'breath' blows a breath
// cloud from the hands instead of chalk.
const LIVELY = {
  drink: [['drink', 420, null, 'bottle'], ['drink_b', 1100, null, 'bottle'], ['drink', 320, null, 'bottle'], ['stand', 0]],
  map: [['map', 1900, null, 'map'], ['look', 700], ['map', 1300, null, 'map'], ['stand', 0]],
  wave: [['wave', 190], ['wave_b', 190], ['wave', 190], ['wave_b', 190], ['wave', 190], ['wave_b', 260], ['stand', 0]],
  stargaze: [['look', 900], ['point', 1700], ['look', 1400], ['stand', 0]],
  warm: [['blow', 420, [24, 17, 'breath']], ['blow_b', 420], ['blow', 420, [24, 17, 'breath']], ['blow_b', 420], ['stand', 0]],
};
export const LIVELY_NAMES = Object.keys(LIVELY);
// Moods, played on purpose (not as idle fidgets): cheering after a long
// perfect streak, panting after arriving with little grip left.
const MOODS = {
  cheer: [['cheer', 170], ['cheer_b', 170], ['cheer', 170], ['cheer_b', 170], ['cheer', 170], ['cheer_b', 300], ['stand', 0]],
  pant: [['pant', 520], ['pant_b', 520], ['pant', 520], ['pant_b', 520], ['pant', 520], ['pant_b', 520], ['stand', 0]],
};

// The climber sprite. Its position is the "attach point": the hands on a hold
// for wall poses, or the feet on the ground for ledge poses.
export class Climber {
  constructor(scene, x, y) {
    this.scene = scene;
    this.sprite = scene.add.sprite(x, y, 'climber', 'stand').setDepth(DEPTH.climber);
    this.lamp = scene.add.image(x, y, 'glow').setDepth(DEPTH.light + 1).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    // Props held during ledge idles; the map sits behind the body.
    this.propFront = scene.add.graphics().setDepth(DEPTH.climber + 0.6);
    this.propBack = scene.add.graphics().setDepth(DEPTH.climber - 0.6);
    this.prop = null;
    // Set by the scene when the beat pulse breathes for the climber.
    this.beatBreath = false;
    this.pose = null;
    this.mode = 'ledge';
    this.busy = 0;
    this.breathT = 0;
    this.breathPhase = 0;
    this.trembleT = 0;
    this.offsetX = 0;
    this.x = x;
    this.y = y;
    this.setPose('stand');
  }

  setPose(name) {
    if (this.pose === name) return;
    this.pose = name;
    const p = POSES[name];
    this.sprite.setFrame(name);
    this.sprite.setOrigin(0.5, p.anchor / FRAME_H);
  }

  // Picks up a rebuilt 'climber' texture (after changing outfit).
  refreshTexture() {
    const pose = this.pose || 'stand';
    this.sprite.setTexture('climber', pose);
    this.pose = null;
    this.setPose(pose);
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this.sync();
  }

  sync() {
    this.sprite.setPosition(Math.round(this.x + this.offsetX), Math.round(this.y));
    if (this.prop) this.drawProp();
  }

  setProp(name) {
    this.prop = name || null;
    this.propFront.clear();
    this.propBack.clear();
    if (this.prop) this.drawProp();
  }

  drawProp() {
    const p = POSES[this.pose];
    if (!p || p.front) return;
    const ox = Math.round(this.x + this.offsetX) - FRAME_W / 2, oy = Math.round(this.y) - p.anchor;
    const f = this.propFront, b = this.propBack;
    f.clear(); b.clear();
    if (this.prop === 'bottle') {
      const [hx, hy] = p.rh;
      const x = ox + hx, y = oy + hy;
      f.fillStyle(0x16141f, 1).fillRect(x - 1, y - 5, 4, 7);
      f.fillStyle(0x4f9ad8, 1).fillRect(x, y - 4, 2, 5);
      f.fillStyle(0x9fd8ff, 1).fillRect(x, y - 4, 1, 2);
      f.fillStyle(0xd8d0c0, 1).fillRect(x, y - 6, 2, 1);
    } else if (this.prop === 'map') {
      // Held up in front of the face: from behind, its back shows round the head.
      const x0 = ox + p.lh[0] - 1, x1 = ox + p.rh[0] + 1, y = oy + p.lh[1] - 9;
      b.fillStyle(0x16141f, 1).fillRect(x0 - 1, y - 1, x1 - x0 + 2, 13);
      b.fillStyle(0xe4d4b0, 1).fillRect(x0, y, x1 - x0, 11);
      b.fillStyle(0xc8b48a, 1).fillRect(Math.round((x0 + x1) / 2), y, 1, 11).fillRect(x0, y + 5, x1 - x0, 1);
      b.fillStyle(0x8fb86a, 1).fillRect(x0 + 2, y + 2, 3, 2).fillRect(x1 - 5, y + 7, 3, 2);
    }
  }

  // Where the head is in world space (for breath puffs and the headlamp).
  get head() {
    const p = POSES[this.pose];
    const front = p.front;
    const by = p.b ? p.b[1] : 0;
    return { x: this.x, y: this.y - p.anchor + (front ? 21 : 12 + by + (p.anchor === 54 ? 2 : 0)) };
  }

  // Wall "hand" point while standing on a ledge (used to start climbing).
  static standHandOffset() { return 50; }

  // delay: hold still first (the hit-stop on perfect hits).
  tweenTo(x, y, duration, ease = 'Sine.easeInOut', delay = 0) {
    this.busy++;
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this, x, y, duration, ease, delay,
        onUpdate: () => this.sync(),
        onComplete: () => { this.busy--; this.sync(); resolve(); },
      });
    });
  }

  // A leap through the air on an arc (the Crevasse's jumps across the gap).
  jumpTo(x, y, duration, arc = 18) {
    this.busy++;
    const x0 = this.x, y0 = this.y;
    return new Promise((resolve) => {
      this.scene.tweens.addCounter({
        from: 0, to: 1, duration, ease: 'Sine.easeInOut',
        onUpdate: (tw) => {
          const t = tw.getValue();
          this.x = x0 + (x - x0) * t;
          this.y = y0 + (y - y0) * t - Math.sin(t * Math.PI) * arc;
          this.sync();
        },
        onComplete: () => { this.busy--; this.x = x; this.y = y; this.sync(); resolve(); },
      });
    });
  }

  // Squash & stretch: snaps to (sx, sy) and eases back to normal size.
  squash(sx, sy, ms = 160, delay = 0) {
    const s = this.sprite;
    this.scene.tweens.killTweensOf(s);
    s.setScale(sx, sy);
    this.scene.tweens.add({ targets: s, scaleX: 1, scaleY: 1, duration: ms, delay, ease: 'Back.easeOut' });
  }

  // A one-frame white flash (impact accent on perfect hits).
  flash(ms = 50) {
    const s = this.sprite;
    s.setTintFill(0xffffff);
    this.scene.time.delayedCall(ms, () => { if (s.active) s.clearTint(); });
  }

  // Shows an in-between frame for a moment, then the pose itself (unless
  // something else changed the pose meanwhile).
  via(mid, name, ms = 55) {
    this.setPose(mid);
    this.scene.time.delayedCall(ms, () => { if (this.pose === mid) this.setPose(name); });
  }

  // Arms and legs flail through the fall frames while the body turns.
  // spin: degrees per second (a run-ending fall tumbles; a short one wobbles).
  flail(spin = 0) {
    this.stopFlail();
    const frames = ['fall', 'fall2', 'fall3', 'fall2'];
    let i = 0;
    this.setPose('fall');
    this.flailT = this.scene.time.addEvent({ delay: 95, loop: true, callback: () => this.setPose(frames[++i % frames.length]) });
    const s = this.sprite;
    if (spin) this.flailTween = this.scene.tweens.add({ targets: s, angle: (Math.random() < 0.5 ? -1 : 1) * 360, duration: 360000 / spin, repeat: -1 });
    else this.flailTween = this.scene.tweens.add({ targets: s, angle: { from: -10, to: 10 }, duration: 240, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  stopFlail() {
    if (this.flailT) { this.flailT.remove(); this.flailT = null; }
    if (this.flailTween) { this.flailTween.stop(); this.flailTween = null; }
    this.sprite.setAngle(0);
  }

  // Plays one of the FIDGETS on a ledge. Idle breathing waits until it ends;
  // anything that moves the climber cancels it (stopFidget).
  fidget(name, effects = null) {
    const seq = FIDGETS[name] || MOODS[name] || LIVELY[name];
    this.stopFidget();
    let i = 0;
    const step = () => {
      this.fidgetT = null;
      if (i >= seq.length) { this.setProp(null); return; }
      const [pose, ms, puff, prop] = seq[i++];
      this.setPose(pose);
      this.setProp(prop);
      if (puff && effects) {
        const px = this.x - FRAME_W / 2 + puff[0], py = this.y - POSES[pose].anchor + puff[1];
        if (puff[2] === 'breath') effects.breathPuff(px, py); else effects.chalk(px, py);
      }
      if (i < seq.length) this.fidgetT = this.scene.time.delayedCall(ms, step);
      else this.setProp(null);
    };
    step();
  }

  get fidgeting() { return !!this.fidgetT; }

  stopFidget() {
    if (this.fidgetT) { this.fidgetT.remove(); this.fidgetT = null; }
    if (this.prop) this.setProp(null);
  }

  // Cancels any movement in progress (pending tween promises are abandoned).
  stopTweens() {
    this.stopFidget();
    this.scene.tweens.killTweensOf(this);
    this.stopFlail();
    this.busy = 0;
    this.sync();
  }

  // Holds a pose for a while, blocking idle animation.
  hold(name, ms) {
    this.setPose(name);
    this.busy++;
    return new Promise((resolve) => this.scene.time.delayedCall(ms, () => { this.busy--; resolve(); }));
  }

  // Idle behaviour: breathing, tired breathing and trembling at low grip.
  idle(dt, { state, gripRatio = 1, cold = false, effects = null, sitting = false }) {
    this.breathT += dt;
    const tired = gripRatio < 0.3;
    const period = state === 'wall' ? (tired ? 650 : gripRatio < 0.6 ? 1000 : 1400) : sitting ? 1800 : 1500;
    if (this.breathT > period) {
      this.breathT = 0;
      this.breathPhase = 1 - this.breathPhase;
      if (this.breathPhase === 1) {
        if (state === 'wall') Audio.play('breath', { intensity: tired ? 1 : gripRatio < 0.6 ? 0.5 : 0.1 });
        if (cold && effects && !this.beatBreath) { const h = this.head; effects.breathPuff(h.x + 2, h.y + 2); }
      }
    }
    if (this.busy > 0 || this.fidgetT) return;
    if (state === 'wall') {
      if (tired) this.setPose(this.breathPhase ? 'hang_tired' : 'hang_b');
      else this.setPose(this.breathPhase ? 'hang_b' : 'hang');
    } else if (state === 'ledge') {
      if (sitting) this.setPose(this.breathPhase ? 'sit_b' : 'sit');
      else if (cold) this.setPose(this.breathPhase ? 'hug_b' : 'hug');
      else this.setPose(this.breathPhase ? 'stand_b' : 'stand');
    } else if (state === 'look') {
      this.setPose(Math.floor(this.scene.time.now / 2600) % 2 ? 'look2' : 'look');
    }
    // In the cold a shiver runs through the body every few seconds.
    this.shiverT = (this.shiverT || 0) + dt;
    const shivering = cold && state !== 'look' && this.shiverT % 4200 < 420;
    // Trembling arms when grip is critical (1px, stays on the pixel grid).
    this.trembleT += dt;
    if (((state === 'wall' && gripRatio < 0.15) || shivering) && this.trembleT > (shivering ? 60 : 90)) {
      this.trembleT = 0;
      this.offsetX = this.offsetX ? 0 : Math.random() < 0.5 ? -1 : 1;
      this.sync();
    } else if ((gripRatio >= 0.15 || state !== 'wall') && !shivering && this.offsetX) {
      this.offsetX = 0;
      this.sync();
    }
  }

  updateLamp(night) {
    const h = this.head;
    // At night the headlamp throws a wide warm pool of light on the rock.
    this.lamp.setPosition(Math.round(h.x), Math.round(h.y - 14)).setScale(night > 0.5 ? 2 : 1).setTint(0xffe8c0).setAlpha(Math.max(0, night - 0.3) * 0.42);
  }

  destroy() {
    this.sprite.destroy();
    this.lamp.destroy();
    this.propFront.destroy();
    this.propBack.destroy();
  }
}
