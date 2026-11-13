import { DEPTH, GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';

// Screen-space atmosphere layered over the world:
//   - cloud wisps drifting past in front of the climber (more of them higher up)
//   - small particles that belong to each biome (pollen, dust, ice glitter,
//     drifting fluff, embers, prism sparkles)
const WISPS = { green: 0.15, stone: 0.25, frozen: 0.5, clouds: 0.7, obsidian: 0.35, crystal: 0.45, volcano: 0.5, sky: 0.6, storm: 0.6, aurora: 0.3, dragon: 0.55, hive: 0.5, clockwork: 0.55, bones: 0.45, cascade: 0.75, monastery: 0.4, moss: 0.5, reef: 0.35, starfall: 0.25 };
const WISP_TINT = { obsidian: 0x5a5070, crystal: 0xffe4f6, stone: 0xe4e2dc, volcano: 0x4a3a3a, storm: 0x6a7088, aurora: 0x9ae0c8, dragon: 0x5a3a3a, hive: 0xffe8c0, clockwork: 0xe8e0d8, bones: 0x7a6e6a, cascade: 0xe8fbff, monastery: 0xfff0dc, moss: 0xd8f0c0, reef: 0xfff0ea, starfall: 0x9a8ac8 };

const MOTES = {
  green: { tex: 'px2', rate: 3, speedX: { min: 3, max: 12 }, speedY: { min: -6, max: 4 }, lifespan: 4500, alpha: { start: 0.9, end: 0 }, scale: { start: 0.5, end: 0.5 }, tint: [0xfff6c0, 0xf4efe4, 0xd8f0a0] },
  stone: { tex: 'px2', rate: 2.5, speedX: { min: -4, max: 6 }, speedY: { min: 4, max: 12 }, lifespan: 4000, alpha: { start: 0.6, end: 0 }, scale: { start: 0.5, end: 0.5 }, tint: [0xc8c2b0, 0x9a9488] },
  frozen: { tex: 'spark', rate: 6, speed: 0, lifespan: 700, alpha: { start: 0, end: 0, ease: 'Sine.easeInOut' }, scale: { start: 0.9, end: 0.1 }, tint: [0xffffff, 0xbfe4ff], blendMode: 'ADD', twinkle: true },
  clouds: { tex: 'puff', rate: 2, speedX: { min: 4, max: 10 }, speedY: { min: -8, max: -2 }, lifespan: 5000, alpha: { start: 0.35, end: 0 }, scale: { start: 0.3, end: 0.7 }, tint: 0xffffff },
  obsidian: { tex: 'px2', rate: 4, speedX: { min: -5, max: 5 }, speedY: { min: -26, max: -10 }, lifespan: 2600, alpha: { start: 1, end: 0 }, scale: { start: 0.6, end: 0.3 }, tint: [0xff9a3c, 0xf0644b, 0xffd25a], blendMode: 'ADD' },
  volcano: { tex: 'px2', rate: 9, speedX: { min: -8, max: 8 }, speedY: { min: -34, max: -12 }, lifespan: 2200, alpha: { start: 1, end: 0 }, scale: { start: 0.7, end: 0.3 }, tint: [0xff9a3c, 0xf0644b, 0xffd25a, 0x5a4a4a], blendMode: 'ADD' },
  sky: { tex: 'fx_leaf', rate: 2.5, speedX: { min: 8, max: 22 }, speedY: { min: -4, max: 6 }, lifespan: 4500, alpha: { start: 0.9, end: 0 }, rotate: { min: 0, max: 360 }, tint: [0xa8e878, 0xf4efe4, 0xf2c14e] },
  // Storm Crown: rain lashing sideways.
  storm: { tex: 'drop', rate: 110, speedX: { min: -80, max: -60 }, speedY: { min: 300, max: 360 }, lifespan: 650, alpha: { start: 0.8, end: 0.35 }, scaleX: 1, scaleY: 2.4, rotate: 12, tint: [0xb8c8e8, 0xd8e4f8, 0x8a98b8] },
  // Aurora Ridge: slow green and violet glints hanging in the cold air.
  aurora: { tex: 'spark', rate: 3, speedX: { min: -2, max: 2 }, speedY: { min: -4, max: 2 }, lifespan: 2200, alpha: { start: 1, end: 0 }, scale: { start: 0.6, end: 0.1 }, tint: [0x5af0a0, 0x9a70f0, 0xc8ffe8], blendMode: 'ADD' },
  // Dragon's Spine: ash flakes and sparks drifting up from the dragon's breath.
  dragon: { tex: 'px2', rate: 6, speedX: { min: -8, max: 8 }, speedY: { min: -30, max: -8 }, lifespan: 2600, alpha: { start: 1, end: 0 }, scale: { start: 0.6, end: 0.3 }, tint: [0xff9a3c, 0xffe08a, 0x6a5a5a, 0x4a3a3a], blendMode: 'ADD' },
  // Amber Hive: drowsy bees and floating specks of pollen.
  hive: { tex: 'px2', rate: 4, speedX: { min: -14, max: 14 }, speedY: { min: -6, max: 6 }, lifespan: 3000, alpha: { start: 1, end: 0 }, scale: { start: 0.6, end: 0.5 }, tint: [0x2a1a0a, 0xffd870, 0xfff2c0] },
  // Clockwork Bastion: puffs of steam drifting up from the vents.
  clockwork: { tex: 'puff', rate: 2.5, speedX: { min: -3, max: 6 }, speedY: { min: -16, max: -6 }, lifespan: 3200, alpha: { start: 0.3, end: 0 }, scale: { start: 0.2, end: 0.8 }, tint: [0xf0ece4, 0xd8d0c4] },
  // Bone Garden: grey ash falling slowly, the odd ember among it.
  bones: { tex: 'px2', rate: 7, speedX: { min: -6, max: 4 }, speedY: { min: 6, max: 16 }, lifespan: 4500, alpha: { start: 0.8, end: 0 }, scale: { start: 0.5, end: 0.5 }, tint: [0xb0a8a0, 0x8a827c, 0xd8d0c8, 0xe06a3a] },
  // The Cascade: fine spray drifting across, catching the light.
  cascade: { tex: 'px2', rate: 14, speedX: { min: 10, max: 30 }, speedY: { min: 6, max: 20 }, lifespan: 2200, alpha: { start: 0.7, end: 0 }, scale: { start: 0.5, end: 0.5 }, tint: [0xffffff, 0xd8f6ff, 0xb8e8f0] },
  // The Hanging Monastery: incense ash and red petals from the shrines.
  monastery: { tex: 'px2', rate: 3, speedX: { min: 4, max: 14 }, speedY: { min: -10, max: 6 }, lifespan: 4800, alpha: { start: 0.9, end: 0 }, scale: { start: 0.5, end: 0.5 }, tint: [0xe8604a, 0xffd0c0, 0xd8cfc0, 0xf2c252] },
  // The Moss Cathedral: glowing spores rising slowly through the shafts of light.
  moss: { tex: 'spark', rate: 4, speedX: { min: -3, max: 3 }, speedY: { min: -9, max: -3 }, lifespan: 4200, alpha: { start: 1, end: 0 }, scale: { start: 0.5, end: 0.1 }, tint: [0xd8ff8a, 0xb8ff6a, 0xfff4b0], blendMode: 'ADD' },
  // The Fossil Reef: specks of the old sea (plankton, sand) drifting up in slow spirals.
  reef: { tex: 'px2', rate: 5, speedX: { min: -5, max: 5 }, speedY: { min: -12, max: -4 }, lifespan: 4200, alpha: { start: 0.9, end: 0 }, scale: { start: 0.5, end: 0.5 }, tint: [0xd8fff4, 0xfff0e0, 0x9ae8d8] },
  // The Starfall Crater: star dust glittering down out of the violet sky.
  starfall: { tex: 'spark', rate: 6, speedX: { min: -4, max: 2 }, speedY: { min: 6, max: 16 }, lifespan: 2600, alpha: { start: 1, end: 0 }, scale: { start: 0.6, end: 0.1 }, tint: [0xffffff, 0xb8e0ff, 0xfff0b0], blendMode: 'ADD' },
  crystal: { tex: 'spark', rate: 4, speedX: { min: -3, max: 3 }, speedY: { min: -6, max: 2 }, lifespan: 1400, alpha: { start: 1, end: 0 }, scale: { start: 0.7, end: 0.1 }, tint: [0xffc8f0, 0xb8fff4, 0xfff1a8], blendMode: 'ADD' },
};

export class Atmosphere {
  constructor(scene) {
    this.scene = scene;
    this.t = 0;
    this.wisps = [];
    for (let i = 0; i < 6; i++) {
      const img = scene.add.image(0, 0, `cloud${i % 4}`).setScrollFactor(0).setDepth(DEPTH.foreground + 2).setScale(1.6 + (i % 3) * 0.4).setAlpha(0);
      this.wisps.push({ img, x: Math.random() * GAME_WIDTH, y: Math.random() * GAME_HEIGHT, speed: 4 + Math.random() * 8, a: 0 });
    }
    this.motes = {};
    this.acc = 0;
    this.lastCamY = null;
    this.reduced = false;
  }

  // day: DayNightSystem state; biome: current biome; dim: 0-1 (whiteout/darkness)
  update(dt, { day, biome, dim = 0 }) {
    this.t += dt;
    this.updateWisps(dt, biome);
    this.updateMotes(dt, biome, day);
  }

  updateWisps(dt, biome) {
    const cam = this.scene.cameras.main;
    const dCam = this.lastCamY === null ? 0 : cam.scrollY - this.lastCamY;
    this.lastCamY = cam.scrollY;
    const density = WISPS[biome.id] ?? 0.2;
    const count = Math.round(density * this.wisps.length);
    this.wisps.forEach((w, i) => {
      // In front of the wall: they move further than the world when the camera moves.
      w.y -= dCam * 1.45;
      w.x += (w.speed * dt) / 1000;
      if (w.x > GAME_WIDTH + 80) w.x = -80;
      if (w.y > GAME_HEIGHT + 40) { w.y = -40; w.x = Math.random() * GAME_WIDTH; }
      if (w.y < -60) { w.y = GAME_HEIGHT + 30; w.x = Math.random() * GAME_WIDTH; }
      const target = i < count ? 0.18 + (i % 3) * 0.08 : 0;
      w.a += (target - w.a) * Math.min(1, dt / 900);
      w.img.setPosition(Math.round(w.x), Math.round(w.y)).setAlpha(w.a).setTint(WISP_TINT[biome.id] || 0xffffff);
    });
  }

  updateMotes(dt, biome, day) {
    const cfg = MOTES[biome.id];
    if (!cfg) return;
    let em = this.motes[biome.id];
    if (!em) {
      const { tex, rate, twinkle, ...conf } = cfg;
      if (twinkle) conf.alpha = { start: 1, end: 0 };
      em = this.motes[biome.id] = this.scene.add.particles(0, 0, tex, { ...conf, emitting: false }).setDepth(DEPTH.weather - 1);
    }
    const night = biome.id === 'green' ? 1 - day.night * 0.7 : 1;
    this.acc += (dt / 1000) * cfg.rate * night * (this.reduced ? 0.4 : 1);
    const v = this.scene.cameras.main.worldView;
    while (this.acc >= 1) {
      this.acc -= 1;
      em.explode(1, v.x + Math.random() * v.width, v.y + Math.random() * v.height);
    }
  }

  // BEAT PULSE: FULL. A small swell of the biome's own motes on the beat,
  // close around (x, y) so it reads as the air moving with the music.
  pulse(biome, x, y, count = 3) {
    const em = this.motes[biome.id];
    if (!em || this.reduced) return;
    for (let i = 0; i < count; i++) em.explode(1, x + (Math.random() - 0.5) * 120, y + (Math.random() - 0.5) * 90);
  }
}
