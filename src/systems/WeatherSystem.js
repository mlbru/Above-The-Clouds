import { DEPTH, GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';
import Phaser from 'phaser';
import { lerpColor } from '../utils/color.js';

// Screen-space atmosphere: wind streaks, leaves, snow and drifting mist bands.
export class WeatherSystem {
  constructor(scene) {
    this.scene = scene;
    const zone = (x, y, w, h) => ({ type: 'random', source: new Phaser.Geom.Rectangle(x, y, w, h) });
    this.wind = scene.add.particles(0, 0, 'px', {
      emitZone: zone(-20, 0, 20, GAME_HEIGHT), speedX: { min: 140, max: 260 }, speedY: { min: -8, max: 8 },
      lifespan: 3200, scaleX: { min: 3, max: 7 }, scaleY: 1, alpha: { start: 0.35, end: 0 }, frequency: 400, quantity: 1,
    }).setScrollFactor(0).setDepth(DEPTH.weather);
    this.leaves = scene.add.particles(0, 0, 'leaf', {
      emitZone: zone(-10, 0, 10, GAME_HEIGHT * 0.7), speedX: { min: 40, max: 90 }, speedY: { min: 5, max: 30 },
      lifespan: 9000, rotate: { min: 0, max: 360 }, alpha: 0.9, frequency: 2200, quantity: 1,
    }).setScrollFactor(0).setDepth(DEPTH.weather);
    this.snow = scene.add.particles(0, 0, 'px2', {
      emitZone: zone(-60, -10, GAME_WIDTH + 60, 10), speedX: { min: 10, max: 50 }, speedY: { min: 18, max: 42 },
      lifespan: 9000, alpha: { min: 0.6, max: 1 }, scale: { min: 0.5, max: 1 }, frequency: 60, quantity: 1,
    }).setScrollFactor(0).setDepth(DEPTH.weather);
    this.snowBack = scene.add.particles(0, 0, 'px', {
      emitZone: zone(-60, -10, GAME_WIDTH + 60, 10), speedX: { min: 5, max: 25 }, speedY: { min: 10, max: 22 },
      lifespan: 14000, alpha: 0.6, frequency: 60, quantity: 1,
    }).setScrollFactor(0).setDepth(DEPTH.bgWeather);
    this.mist = [0, 1, 2].map((i) => scene.add.tileSprite(0, 40 + i * 80, GAME_WIDTH, 48, 'mist').setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.mist).setAlpha(0));
    // Whiteout: the whole scene washes out to white.
    this.white = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xf0f4fa).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.mist + 1).setAlpha(0);
    this.mistPhase = 0;
    this.levels = { wind: -1, leaves: -1, snow: -1 };
  }

  setRate(emitter, name, level, baseFreq) {
    const q = Math.round(level * 20) / 20;
    if (this.levels[name] === q) return;
    this.levels[name] = q;
    if (q <= 0.01) emitter.stop();
    else {
      emitter.setFrequency(baseFreq / q);
      if (!emitter.emitting) emitter.start();
    }
  }

  update(dt, { biome, alt, light, reduced, windBoost = 0, mistBoost = 0, snowBoost = 0, whiteout = 0 }) {
    const scale = reduced ? 0.35 : 1;
    const w = biome.weather;
    const altWind = Math.min(1, alt / 900);
    this.setRate(this.wind, 'wind', (w.wind * 0.7 + altWind * 0.3 + windBoost) * scale, 380);
    this.setRate(this.leaves, 'leaves', w.leaves * scale, 2200);
    this.setRate(this.snow, 'snow', (w.snow + snowBoost) * scale, 70);
    this.setRate(this.snowBack, 'snowBack', (w.snow + snowBoost) * scale, 90);
    this.white.setVisible(whiteout > 0.01).setAlpha(whiteout * 0.32).setFillStyle(light === undefined ? 0xf0f4fa : lerpColor(0xf0f4fa, light, 0.5));
    this.wind.setParticleTint?.(light);
    this.mistPhase += dt;
    const mistLevel = Math.min(0.45 + whiteout * 0.25, (w.mist + mistBoost) * (reduced ? 0.6 : 1));
    this.mist.forEach((m, i) => {
      m.tilePositionX += dt * (0.006 + i * 0.004) * (1 + w.wind);
      const a = mistLevel * (0.55 + 0.45 * Math.sin(this.mistPhase / (4000 + i * 1500) + i * 2));
      m.setAlpha(m.alpha + (a - m.alpha) * Math.min(1, dt / 800));
      m.setTint(light);
    });
  }
}
