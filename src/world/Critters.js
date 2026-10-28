import { DEPTH, GAME_HEIGHT, LEVEL_PX, levelToMeters } from '../config/gameConfig.js';
import { biomeAt } from '../data/biomes.js';
import { hashInts } from '../utils/seededRandom.js';
import { Audio } from '../systems/AudioSystem.js';

// Animals that notice you. Birds perch on holds and take off when you climb
// close; mountain goats stand on rest ledges, turn to watch you come and jump
// away when you pull onto their ledge. Placed per hold from the run's seed.
const BIRD_BIOMES = { green: 0.06, stone: 0.05, clouds: 0.04 };
const BIRD_TINT = { green: 0xffffff, stone: 0xd8d0c8, clouds: 0xe8eeff };
const GOAT_BIOMES = { green: 0.5, stone: 0.6, frozen: 0.45 };
const SCAN_EVERY = 250;
const SCAN_LEVELS = 16;

export class Critters {
  constructor(scene, mountain, seed) {
    this.scene = scene;
    this.mountain = mountain;
    this.seed = seed;
    this.seen = new Set();
    this.list = [];
    this.scanT = SCAN_EVERY;
  }

  roll(node, salt) { return (hashInts(this.seed, node.level, Number(node.id.split(':')[1]), salt) & 0xffff) / 0xffff; }

  scan(fromLevel) {
    for (let l = Math.max(1, fromLevel); l < fromLevel + SCAN_LEVELS; l++) {
      const lv = this.mountain.getLevel(l);
      if (!lv) continue;
      for (const node of lv.nodes) {
        if (this.seen.has(node.id)) continue;
        this.seen.add(node.id);
        const biome = biomeAt(levelToMeters(node.level)).id;
        if (node.kind === 'ledge') {
          if (this.roll(node, 1) < (GOAT_BIOMES[biome] || 0)) this.addGoat(node);
        } else if (node.hazard !== 'crumbling' && this.roll(node, 2) < (BIRD_BIOMES[biome] || 0)) this.addBird(node, biome);
      }
    }
  }

  addBird(node, biome) {
    const side = this.roll(node, 3) < 0.5 ? -1 : 1;
    const img = this.scene.add.sprite(node.x + side * 7, node.y - 1, 'critter_bird', 0).setOrigin(0.5, 1)
      .setDepth(DEPTH.decor + 2).setFlipX(side < 0).setTint(BIRD_TINT[biome] || 0xffffff);
    this.list.push({ kind: 'bird', img, node, t: this.roll(node, 4) * 3000, gone: false });
  }

  addGoat(node) {
    const side = this.roll(node, 5) < 0.5 ? -1 : 1;
    const img = this.scene.add.sprite(node.x + side * 26, node.y + 1, 'critter_goat', 0).setOrigin(0.5, 1).setDepth(DEPTH.decor + 2);
    this.list.push({ kind: 'goat', img, node, side, t: 0, gone: false, bleated: false });
  }

  update(dt, climber, camY) {
    this.scanT += dt;
    if (this.scanT >= SCAN_EVERY) {
      this.scanT = 0;
      this.scan(Math.floor(-climber.y / LEVEL_PX) - 2);
    }
    for (const c of this.list) {
      if (c.gone) continue;
      c.t += dt;
      const dx = climber.x - c.img.x, dy = climber.y - c.img.y;
      if (c.kind === 'bird') {
        // Pecks now and then; flies when you come within reach.
        c.img.setFrame(c.t % 2600 < 260 || (c.t % 2600 > 520 && c.t % 2600 < 700) ? 1 : 0);
        if (Math.abs(dx) < 44 && dy < 40 && dy > -30) this.flyOff(c, dx);
      } else {
        // Faces you, looks back over its shoulder when you are close, and
        // leaves the ledge when you arrive on it.
        c.img.setFlipX(dx < 0);
        const near = Math.abs(dy) < 70 && Math.abs(dx) < 120;
        c.img.setFrame(near ? 1 : 0);
        if (near && !c.bleated) { c.bleated = true; Audio.play('bleat'); }
        if (Math.abs(dy) < 6 && Math.abs(dx) < 34) this.jumpOff(c);
      }
    }
    // Drop what scrolled far below the view.
    const bottom = camY + GAME_HEIGHT * 2;
    this.list = this.list.filter((c) => {
      if (c.img.y < bottom && c.img.active) return true;
      c.img.destroy();
      return false;
    });
  }

  flyOff(c, dx) {
    c.gone = true;
    const dir = dx > 0 ? -1 : 1;
    const img = c.img;
    img.setFrame(2);
    Audio.play('flutter');
    this.scene.time.delayedCall(90, () => {
      if (!img.active) return;
      img.setTexture('bird', 0).setOrigin(0.5, 0.5).setFlipX(false);
      let up = false;
      const flap = this.scene.time.addEvent({ delay: 80, loop: true, callback: () => { up = !up; if (img.active) img.setFrame(up ? 1 : 0); } });
      this.scene.tweens.add({
        targets: img, x: img.x + dir * 140, y: img.y - 110, duration: 1700, ease: 'Quad.easeIn',
        onComplete: () => { flap.remove(); img.destroy(); },
      });
    });
  }

  jumpOff(c) {
    c.gone = true;
    const img = c.img;
    const dir = c.side;
    img.setFrame(2).setFlipX(dir < 0);
    this.scene.tweens.add({ targets: img, x: img.x + dir * 40, duration: 700, ease: 'Linear' });
    this.scene.tweens.add({ targets: img, y: img.y - 46, duration: 350, ease: 'Quad.easeOut', yoyo: true });
    this.scene.tweens.add({ targets: img, alpha: 0, delay: 450, duration: 250, onComplete: () => img.destroy() });
  }
}
