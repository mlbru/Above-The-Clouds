import Phaser from 'phaser';
import { DEPTH } from '../config/gameConfig.js';
import { POSES, FRAME_H } from '../render/climberArt.js';
import { Audio } from '../systems/AudioSystem.js';

// The climber sprite. Its position is the "attach point": the hands on a hold
// for wall poses, or the feet on the ground for ledge poses.
export class Climber {
  constructor(scene, x, y) {
    this.scene = scene;
    this.sprite = scene.add.sprite(x, y, 'climber', 'stand').setDepth(DEPTH.climber);
    this.lamp = scene.add.image(x, y, 'glow').setDepth(DEPTH.light + 1).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
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

  tweenTo(x, y, duration, ease = 'Sine.easeInOut') {
    this.busy++;
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this, x, y, duration, ease,
        onUpdate: () => this.sync(),
        onComplete: () => { this.busy--; this.sync(); resolve(); },
      });
    });
  }

  // Squash & stretch: snaps to (sx, sy) and eases back to normal size.
  squash(sx, sy, ms = 160) {
    const s = this.sprite;
    this.scene.tweens.killTweensOf(s);
    s.setScale(sx, sy);
    this.scene.tweens.add({ targets: s, scaleX: 1, scaleY: 1, duration: ms, ease: 'Back.easeOut' });
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

  // Cancels any movement in progress (pending tween promises are abandoned).
  stopTweens() {
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
        if (cold && effects) { const h = this.head; effects.breathPuff(h.x + 2, h.y + 2); }
      }
    }
    if (this.busy > 0) return;
    if (state === 'wall') {
      if (tired) this.setPose(this.breathPhase ? 'hang_tired' : 'hang_b');
      else this.setPose(this.breathPhase ? 'hang_b' : 'hang');
    } else if (state === 'ledge') {
      this.setPose(sitting ? (this.breathPhase ? 'sit_b' : 'sit') : this.breathPhase ? 'stand_b' : 'stand');
    } else if (state === 'look') {
      this.setPose(Math.floor(this.scene.time.now / 2600) % 2 ? 'look2' : 'look');
    }
    // Trembling arms when grip is critical (1px, stays on the pixel grid).
    this.trembleT += dt;
    if (state === 'wall' && gripRatio < 0.15 && this.trembleT > 90) {
      this.trembleT = 0;
      this.offsetX = this.offsetX ? 0 : Math.random() < 0.5 ? -1 : 1;
      this.sync();
    } else if (gripRatio >= 0.15 && this.offsetX) {
      this.offsetX = 0;
      this.sync();
    }
  }

  updateLamp(night) {
    const h = this.head;
    this.lamp.setPosition(Math.round(h.x), Math.round(h.y - 22)).setAlpha(Math.max(0, night - 0.35) * 0.55);
  }

  destroy() {
    this.sprite.destroy();
    this.lamp.destroy();
  }
}
