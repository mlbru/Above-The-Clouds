// Weather that leaves a mark on the world:
//   - Passing showers on the lower mountain: the sky greys over, rain sweeps
//     in, the rock goes dark and wet (WetWall), and it moves on again.
//   - A rainbow opposite the sun when a shower or a storm clears in daylight.
//   - Snow that piles up on the ledges while it snows hard, and slowly melts.
import Phaser from 'phaser';
import { DEPTH, GAME_WIDTH, GAME_HEIGHT, LEVEL_PX } from '../config/gameConfig.js';
import { SKY } from '../systems/DayNightSystem.js';
import { Audio } from '../systems/AudioSystem.js';

const SHOWER_BIOMES = ['green', 'stone', 'hive'];
const BOW = [0xff4a4a, 0xff9a3a, 0xffe04a, 0x6ade5a, 0x4ab8ff, 0x6a6aff, 0xb05aff];
const rnd = (a, b) => a + Math.random() * (b - a);

export class WeatherScenery {
  constructor(scene, mountain) {
    this.scene = scene;
    this.mountain = mountain;
    this.shower = { k: 0, wait: rnd(70000, 140000), left: 0 };
    this.rain = scene.add.particles(0, 0, 'drop', {
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-40, -10, GAME_WIDTH + 80, 6) },
      speedX: { min: -50, max: -30 }, speedY: { min: 280, max: 340 }, lifespan: 1100,
      alpha: { start: 0.75, end: 0.3 }, scaleY: 2, rotate: 7, tint: [0xb8c8e8, 0xd8e4f8, 0x9aa8c8], frequency: 40, emitting: false,
    }).setScrollFactor(0).setDepth(DEPTH.weather);
    this.rainLevel = -1;
    this.bowG = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.far + 4);
    this.bow = 0;
    this.bowLife = 0;
    this.capG = scene.add.graphics().setDepth(DEPTH.wall + 2);
    this.snowDepth = 0;
    this.lastWet = 0;
  }

  // Returns how hard it is raining right now (0..1).
  update(dt, { biome, day, sky, storm = 0, snow = 0, camY, reduced = false, allowShowers = true }) {
    this.updateShower(dt, biome, allowShowers);
    const rain = this.shower.k;
    const lvl = Math.round(rain * 20) / 20;
    if (lvl !== this.rainLevel) {
      this.rainLevel = lvl;
      if (lvl <= 0.02) this.rain.stop();
      else { this.rain.setFrequency(18 / (lvl * (reduced ? 0.4 : 1))); if (!this.rain.emitting) this.rain.start(); }
    }
    // When the rain (or a storm) has just cleared and the sun is out: a rainbow.
    const wet = Math.max(rain, storm);
    // (It keeps the peak of the rain since it last cleared: the rain fades out slowly.)
    this.lastWet = Math.max(this.lastWet, wet);
    if (wet <= 0.3) {
      if (this.lastWet > 0.55 && day.sun && day.sun.h < 0.95) { this.bowLife = 32000; Audio.play('rainbow'); }
      this.lastWet = 0;
    }
    this.drawBow(dt, day, sky);
    this.updateSnowCaps(dt, snow, camY, biome);
    return rain;
  }

  updateShower(dt, biome, allow) {
    const s = this.shower;
    const here = allow && SHOWER_BIOMES.includes(biome.id);
    if (s.left > 0) {
      s.left -= dt;
      s.k = Math.min(1, s.k + dt / 5000);
    } else {
      s.k = Math.max(0, s.k - dt / 7000);
      if (here && s.k === 0 && (s.wait -= dt) < 0) { s.left = rnd(18000, 30000); s.wait = rnd(120000, 240000); }
    }
    if (!here) s.left = Math.min(s.left, 0);
  }

  // The bow sits opposite the sun, low when the sun is high. Seven soft
  // bands, with a faint second bow outside it in reversed colours.
  drawBow(dt, day, sky) {
    const g = this.bowG.clear();
    if (this.bowLife > 0) this.bowLife -= dt;
    const want = this.bowLife > 0 && day.sun ? Math.min(1, this.bowLife / 6000) : 0;
    this.bow += (want - this.bow) * Math.min(1, dt / 2500);
    if (this.bow < 0.01 || !day.sun) return;
    const sun = (sky && sky.sunScreen) || day.sun;
    const cx = GAME_WIDTH - sun.x, cy = SKY.horizon + 30 + Math.max(0, sun.h) * 110;
    const R = 165, a = 0.2 * this.bow;
    BOW.forEach((c, i) => {
      g.lineStyle(2, c, a).beginPath().arc(cx, cy, R - i * 2, Math.PI, Math.PI * 2).strokePath();
      g.lineStyle(2, c, a * 0.3).beginPath().arc(cx, cy, R + 26 + i * 2, Math.PI, Math.PI * 2).strokePath();
    });
    // Brighter sky inside the bow.
    g.fillStyle(0xffffff, a * 0.25).slice(cx, cy, R - 14, Math.PI, Math.PI * 2, false).fillPath();
  }

  // Snow piles up along the ledges while it snows hard and melts slowly after.
  updateSnowCaps(dt, snow, camY, biome) {
    if (snow > 0.45) this.snowDepth = Math.min(4, this.snowDepth + (dt / 1000) * 0.14 * snow);
    else this.snowDepth = Math.max(0, this.snowDepth - (dt / 1000) * (biome.weather.snow > 0.3 ? 0.02 : 0.08));
    const g = this.capG.clear();
    const d = this.snowDepth;
    if (d < 0.3) return;
    const top = Math.floor(-(camY / LEVEL_PX)) + 2, bottom = Math.floor(-((camY + GAME_HEIGHT) / LEVEL_PX)) - 2;
    for (let l = Math.max(0, bottom); l <= top; l++) {
      const lv = this.mountain.getLevel(l);
      if (!lv || !lv.nodes.length || lv.nodes[0].kind !== 'ledge' || !lv.bounds || l === 0) continue;
      const y0 = lv.nodes[0].y - 4;
      const ll = Math.round(lv.bounds.l - 12), lr = Math.round(lv.bounds.r + 12);
      for (let x = ll; x <= lr; x++) {
        const end = Math.min(x - ll, lr - x);
        const taper = Math.min(1, end / 10);
        const h = Math.round(d * taper * (0.75 + 0.25 * Math.sin(x * 0.37 + l) + 0.15 * Math.sin(x * 1.3)));
        if (h <= 0) continue;
        g.fillStyle(0xf6f9ff, 1).fillRect(x, y0 - h, 1, h);
        g.fillStyle(0xc8d6ee, 1).fillRect(x, y0, 1, 1);
        if ((x * 7 + l) % 11 === 0) g.fillStyle(0xffffff, 1).fillRect(x, y0 - h, 1, 1);
      }
    }
  }
}
