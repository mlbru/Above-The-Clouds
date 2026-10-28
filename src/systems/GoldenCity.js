import { GAME_WIDTH, GAME_HEIGHT, DEPTH } from '../config/gameConfig.js';
import { COLORS } from '../ui/PixelText.js';
import { GEMS } from '../data/gems.js';
import { GOLDEN_CITY, GOLDEN_CITY_MUSIC, cityGem } from '../data/goldenCity.js';
import { Audio } from './AudioSystem.js';

const GOLDS = [0xfff1a0, 0xffd24a, 0xf2a62a, 0xffe27a, 0xd88a1a, 0xffffff];

// The secret level's show (the rules live in data/goldenCity.js): the
// announcement, the gold that covers everything, the glitter and the song.
// The diamonds are drawn above the gold so they keep their own colour.
export class GoldenCity {
  constructor(scene) {
    this.scene = scene;
    this.active = null;
    this.gold = null;
    this.glow = null;
    this.t = 0;
    this.sparkT = 0;
  }

  // Rolled once for each biome you enter. `forced` is the GOLDENCITY test code.
  roll(forced = false) { return forced || Math.random() < GOLDEN_CITY.chance; }

  routeGem(route, taken) { return cityGem(route, taken, Math.random); }

  // Depth for diamonds on the wall: above the gold.
  get gemDepth() { return DEPTH.light + 3; }

  open(stretch) {
    const sc = this.scene;
    this.active = { stretch };
    this.t = 0;
    sc.prog.bump('goldenCities');
    sc.run.finds.push('THE GOLDEN CITY');
    // Gold over everything: a multiply layer turns the world gold, a warm glow on top.
    this.gold = sc.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 1).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.light + 1).setBlendMode('MULTIPLY');
    this.glow = sc.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x5a3a00, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.light + 2).setBlendMode('ADD');
    Audio.setMusicMode(GOLDEN_CITY_MUSIC);
    this.announce();
  }

  // The big moment: the mountain rumbles and goes dark, flashes of gold, the
  // title slams in, diamonds rain down and the walls turn to gold.
  announce() {
    const sc = this.scene, hud = sc.hud, shake = sc.settings.shake;
    const at = (ms, fn) => sc.time.delayedCall(ms, () => { if (this.active) fn(); });
    Audio.play('crumble');
    if (shake) sc.cam.shake(700, 0.012);
    hud.flashScreen(0x000000, 0.9, 900);
    at(250, () => Audio.play('pebble', { count: 4, volume: 0.8 }));
    GOLDS.forEach((c, i) => at(450 + i * 110, () => { hud.flashScreen(c, 0.45, 220); Audio.play('gem', { value: 2 + i * 2 }); }));
    at(1150, () => {
      // Nothing else gets to share this moment: drop any height slams still waiting.
      hud.celebrations.length = 0;
      this.goldTween(1);
      hud.celebrate({
        title: 'SECRET LEVEL!', sub: GOLDEN_CITY.name, color: COLORS.gold, flicker: true, slam: true,
        onLand: () => {
          Audio.play('slam');
          Audio.play('fanfare');
          hud.flashScreen(0xffe27a, 0.7, 500);
          if (shake) sc.cam.shake(320, 0.01);
          this.burst();
          this.diamondRain(60, 2600);
          at(1100, () => this.burst());
          at(2400, () => { hud.toast('A CITY MADE OF GOLD!', COLORS.gold); hud.toast('DIAMONDS EVERYWHERE!', '#d8fbff'); });
        },
      });
    });
  }

  // Confetti from both top corners and the climber, rings of gold and diamond.
  burst() {
    const sc = this.scene, fx = sc.effects, v = sc.cam.worldView, c = sc.climber;
    fx.confettiBurst(v.x + 30, v.y + 20, 40);
    fx.confettiBurst(v.right - 30, v.y + 20, 40);
    fx.confettiBurst(c.x, c.y - 20, 30);
    [0xffd24a, GEMS.diamond.color, 0xfff1a0, GEMS.diamond.color, 0xf2a62a].forEach((col, i) => sc.time.delayedCall(i * 80, () => fx.ring(c.x, c.y - 10, col, 14 + i * 8, 440)));
    fx.sparkle(c.x, c.y - 10, 20);
  }

  // Diamonds tumble down the screen, above the gold.
  diamondRain(count, spreadMs) {
    const sc = this.scene;
    for (let i = 0; i < count; i++) {
      const x = 10 + Math.random() * (GAME_WIDTH - 20);
      const img = sc.add.image(x, -10 - Math.random() * 30, 'gem_diamond').setScrollFactor(0).setDepth(DEPTH.hud - 2).setScale(1 + Math.random() * 1.5);
      sc.tweens.add({
        targets: img, y: GAME_HEIGHT + 20, x: x + (Math.random() - 0.5) * 60, angle: (Math.random() - 0.5) * 720,
        delay: Math.random() * spreadMs, duration: 1100 + Math.random() * 900, ease: 'Quad.easeIn',
        onStart: () => { if (Math.random() < 0.15) Audio.play('tick'); },
        onComplete: () => img.destroy(),
      });
    }
  }

  // u = 0 is no gold at all, 1 is the full city.
  goldTween(u, onComplete) {
    if (!this.gold) return;
    const sc = this.scene, st = { u: this.goldU || 0 };
    sc.tweens.killTweensOf(this.goldState || {});
    this.goldState = st;
    sc.tweens.add({
      targets: st, u, duration: 1000,
      onUpdate: () => { this.goldU = st.u; },
      onComplete,
    });
  }

  close() {
    if (!this.active) return;
    this.active = null;
    this.scene.hud.toast('THE GOLDEN CITY FADES BEHIND YOU', COLORS.gold);
    const gold = this.gold, glow = this.glow;
    this.gold = null;
    this.glow = null;
    // Fade the gold out on our own: update() no longer runs for a closed city.
    const sc = this.scene, st = { u: this.goldU ?? 0 };
    if (this.goldState) sc.tweens.killTweensOf(this.goldState);
    sc.tweens.add({
      targets: st, u: 0, duration: 1200,
      onUpdate: () => { gold.fillColor = goldColor(st.u); glow.fillAlpha = st.u * 0.18; },
      onComplete: () => { gold.destroy(); glow.destroy(); },
    });
    this.goldU = 0;
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const u = this.goldU || 0;
    // The gold breathes a little, as if the light moves over it.
    const shimmer = 0.5 + 0.5 * Math.sin(this.t / 700);
    if (this.gold) this.gold.fillColor = goldColor(u * (0.92 + 0.08 * shimmer));
    if (this.glow) this.glow.fillAlpha = u * (0.12 + 0.1 * shimmer);
    // Glitter all over the wall.
    this.sparkT += dt;
    if (u > 0.5 && this.sparkT > 120) {
      this.sparkT = 0;
      const v = this.scene.cam.worldView;
      this.scene.effects.sparkle(v.x + Math.random() * v.width, v.y + Math.random() * v.height, 3);
    }
  }
}

// White (no change) blending to deep gold for the multiply layer.
function goldColor(u) {
  const to = [0xff, 0xc4, 0x48];
  const c = to.map((v) => Math.round(255 + (v - 255) * u));
  return (c[0] << 16) | (c[1] << 8) | c[2];
}
