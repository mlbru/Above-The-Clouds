import { DEPTH } from '../config/gameConfig.js';
import { POSES, FRAME_W, bodyPoints } from '../render/climberArt.js';
import { buildPetTextures } from '../render/petArt.js';
import { Audio } from '../systems/AudioSystem.js';

// The pet that comes along (data/pets.js), riding with the climber:
//   GOAT KID     sits on the pack; on a ledge it hops down and potters about
//                beside you; bleats at loose or crumbling rock on the route you pick
//   HIVE BEE     circles your head; while you choose it hovers over a gem
//   CRYSTAL MOTH flutters by your head; glows softly at night
//   DRAGONLING   sits on your shoulder, puffs smoke; hides behind your head
//                while the big dragon is awake
export class PetFx {
  constructor(scene, climber) {
    this.scene = scene;
    this.climber = climber;
    buildPetTextures(scene);
    this.sprite = scene.add.sprite(0, 0, 'pet_kid_0', 0).setDepth(DEPTH.climber + 0.7).setVisible(false).setOrigin(0.5, 1);
    this.glow = scene.add.image(0, 0, 'glow').setDepth(DEPTH.light + 1).setBlendMode('ADD').setTint(0xb8e8ff).setVisible(false);
    this.id = null;
    this.stage = 0;
    this.t = 0;
    this.x = null; this.y = null;
    this.busyFrame = 0;
    this.walk = { off: 18, to: 18, wait: 1500 };
    this.puffIn = 3000;
  }

  // id: the pet's id or null; stage: 0 baby, 1 young, 2 grown.
  setPet(id, stage = 0) {
    this.id = id;
    this.stage = stage;
    if (id) this.sprite.setTexture(`pet_${id}_${stage}`, 0);
    this.sprite.setVisible(!!id);
    this.glow.setVisible(false);
  }

  at([fx, fy]) {
    const s = this.climber.sprite;
    return [s.x - FRAME_W / 2 + fx, s.y - POSES[this.climber.pose].anchor + fy];
  }

  // A route was picked: the goat kid bleats at bad rock.
  onRoute(route) {
    if (this.id !== 'kid' || !route) return;
    if (route.hazard === 'loose' || route.hazard === 'crumbling') {
      this.busyFrame = 700;
      Audio.play('bleat');
    }
  }

  // ctx: { state: 'wall' | 'ledge' | 'climbing', night, gem: {x, y} | null, dragonAwake, visible }
  update(dt, ctx) {
    if (!this.id) return;
    this.t += dt;
    const s = this.climber.sprite;
    const show = ctx.visible !== false && s.visible && !!this.climber.pose;
    this.sprite.setVisible(show);
    if (!show) { this.glow.setVisible(false); return; }
    const pts = bodyPoints(this.climber.pose);
    const ease = (cur, to, k) => (cur == null ? to : cur + (to - cur) * Math.min(1, dt / k));
    let tx, ty, frame = 0, flip = false, depth = DEPTH.climber + 0.7;
    this.busyFrame = Math.max(0, this.busyFrame - dt);
    if (this.id === 'kid') {
      if (ctx.state === 'ledge') {
        // Potters about beside you on the ledge.
        this.walk.wait -= dt;
        if (this.walk.wait <= 0) { this.walk.to = (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 18); this.walk.wait = 1800 + Math.random() * 2600; }
        const before = this.walk.off;
        this.walk.off += (this.walk.to - this.walk.off) * Math.min(1, dt / 500);
        const moving = Math.abs(this.walk.off - before) > 0.02;
        tx = this.climber.x + this.walk.off; ty = this.climber.y + 1 - (moving ? Math.abs(Math.sin(this.t / 90)) * 2 : 0);
        frame = moving ? 1 : 0;
        flip = this.walk.to < this.walk.off;
      } else {
        // Rides on the top of the pack.
        const [px, py] = this.at(pts.packTop);
        tx = px; ty = py + 1;
        flip = this.climber.sprite.flipX;
      }
      if (this.busyFrame > 0) frame = 2;
      this.x = ctx.state === 'ledge' ? ease(this.x, tx, 90) : tx;
      this.y = ctx.state === 'ledge' ? ease(this.y, ty, 90) : ty;
    } else if (this.id === 'bee') {
      const [hx, hy] = this.at(pts.head);
      if (ctx.gem) { tx = ctx.gem.x + Math.cos(this.t / 220) * 6; ty = ctx.gem.y - 10 + Math.sin(this.t / 110) * 3; }
      else { tx = hx + Math.cos(this.t / 520) * 16; ty = hy - 4 + Math.sin(this.t / 260) * 6; }
      frame = Math.floor(this.t / 45) % 2;
      flip = Math.sin(this.t / 520) > 0;
      this.x = ease(this.x, tx, ctx.gem ? 260 : 120); this.y = ease(this.y, ty, ctx.gem ? 260 : 120);
    } else if (this.id === 'moth') {
      const [hx, hy] = this.at(pts.head);
      tx = hx + 11 + Math.sin(this.t / 700) * 4; ty = hy - 8 + Math.sin(this.t / 330) * 3;
      frame = Math.floor(this.t / 120) % 2;
      this.x = ease(this.x, tx, 160); this.y = ease(this.y, ty, 160);
      const k = Math.max(0, (ctx.night || 0) - 0.35) / 0.65;
      this.glow.setVisible(k > 0.02).setPosition(this.x, this.y - 3).setScale(0.6 + this.stage * 0.25 + Math.sin(this.t / 400) * 0.05).setAlpha(0.35 * k);
    } else if (this.id === 'dragonling') {
      const [sx, sy] = this.at(pts.shoulders[1]);
      const [hx, hy] = this.at(pts.head);
      if (ctx.dragonAwake) { tx = hx - 2; ty = hy + 2; depth = DEPTH.climber - 0.7; }
      else { tx = sx + 1; ty = sy + 1; }
      this.puffIn -= dt;
      if (this.puffIn <= 0 && !ctx.dragonAwake) {
        this.puffIn = 4000 + Math.random() * 4000;
        this.busyFrame = 500;
        if (this.scene.effects) this.scene.effects.breathPuff(this.x + 6, this.y - 8);
      }
      frame = this.busyFrame > 0 ? 2 : Math.floor(this.t / 2600) % 5 === 0 ? 1 : 0;
      this.x = ease(this.x, tx, 70); this.y = ease(this.y, ty, 70);
    }
    this.sprite.setFrame(frame).setFlipX(flip).setDepth(depth).setPosition(Math.round(this.x), Math.round(this.y));
  }

  destroy() { this.sprite.destroy(); this.glow.destroy(); }
}
