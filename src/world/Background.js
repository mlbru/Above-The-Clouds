import { DEPTH, GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';
import { lerpColor, warmthOf } from '../utils/color.js';
import { BIOMES, biomeLocalAlt, mixWarmth } from '../data/biomes.js';
import { SkyLife } from './SkyLife.js';
import { buildMilkyWay, buildMoon } from '../render/skyArt.js';
import { SeededRandom } from '../utils/seededRandom.js';

const HORIZON = 160;
// Parallax ranges: E = the altitude (m) at which the range sits on the horizon,
// f = how fast it sinks as the climber rises.
const RANGES = [
  { key: 'bg_summits', E: 3250, f: 0.04, haze: 0.55, fill: 0xdfe6f2, depth: DEPTH.far },
  { key: 'bg_far', E: 900, f: 0.12, haze: 0.35, fill: 0xaebbd2, depth: DEPTH.far + 1 },
  { key: 'bg_mid', E: 250, f: 0.3, haze: 0.18, fill: 0x7f8ca6, depth: DEPTH.mid },
  { key: 'bg_near', E: 40, f: 0.8, haze: 0.05, fill: 0x4c6a4a, depth: DEPTH.near },
];

export class Background {
  constructor(scene) {
    this.scene = scene;
    this.sky = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.sky);
    this.skyKey = '';
    // The night sky: the Milky Way, then stars that come out one by one.
    this.milky = scene.add.image(0, 0, buildMilkyWay(scene, GAME_WIDTH, 200)).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.sky + 1).setAlpha(0);
    this.starG = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.sky + 1);
    const rng = new SeededRandom(99);
    this.starList = Array.from({ length: Math.round(GAME_WIDTH * 0.42) }, () => ({
      x: rng.int(0, GAME_WIDTH - 1), y: rng.int(0, 175), thr: rng.range(0, 0.92) ** 1.3,
      b: rng.range(0.35, 1), sp: rng.range(0.6, 2.4), ph: rng.range(0, 7),
      c: rng.pick([0xffffff, 0xffffff, 0xdfe6ff, 0xc8d4ff, 0xfff0d8]),
    }));
    this.starList.slice(0, 16).forEach((s) => { s.b = 1; s.big = true; s.thr *= 0.4; });
    this.aurora = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.sky + 2);
    // Halos around the sun and the moon (behind the hills, like the bodies).
    this.halo = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.sky + 2).setBlendMode('ADD');
    this.sun = scene.add.image(0, 0, 'sun').setScrollFactor(0).setDepth(DEPTH.sky + 3);
    this.moon = scene.add.image(0, 0, 'moon').setScrollFactor(0).setDepth(DEPTH.sky + 3);
    // Where the sun and moon are drawn this frame (the light rays start here).
    this.sunScreen = null;
    this.moonScreen = null;
    this.overcast = 0;
    this.ranges = RANGES.map((r) => ({
      ...r,
      img: scene.add.tileSprite(0, 0, GAME_WIDTH, scene.textures.get(r.key).getSourceImage().height, r.key).setOrigin(0, 0).setScrollFactor(0).setDepth(r.depth),
      fillRect: scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffffff).setOrigin(0, 0).setScrollFactor(0).setDepth(r.depth),
    }));
    // Biome scenery: extra ranges that fade in while you climb through their biome.
    this.biomeLayers = Object.values(BIOMES).flatMap((b) => (b.backdrop?.layers || []).map((r) => ({
      ...r,
      biome: b.id,
      img: scene.add.tileSprite(0, 0, GAME_WIDTH, r.h, r.key).setOrigin(0, 0).setScrollFactor(0).setDepth(r.depth).setVisible(false),
      fillRect: scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffffff).setOrigin(0, 0).setScrollFactor(0).setDepth(r.depth).setVisible(false),
    })));
    this.clouds = [];
    for (let i = 0; i < 6; i++) {
      const c = scene.add.image(Math.random() * GAME_WIDTH, 0, `cloud${i % 4}`).setScrollFactor(0).setDepth(DEPTH.far + 2 + (i % 2) * 9);
      c.baseY = 20 + i * 47;
      c.speed = 2 + Math.random() * 4;
      c.par = 0.25 + (i % 3) * 0.12;
      this.clouds.push(c);
    }
    this.cloudSea = scene.add.tileSprite(0, 0, GAME_WIDTH, 90, 'cloudsea').setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.cloudSea);
    this.cloudSeaFill = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xbcc6de).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.cloudSea);
    this.floaters = [0, 1, 2].map((i) => {
      const f = scene.add.image(0, 0, 'decor_float_rock').setScrollFactor(0).setDepth(DEPTH.mid + 2 + i);
      f.baseX = [60, 400, 250][i];
      f.baseY = [70, 110, 40][i];
      f.phase = i * 2;
      f.setScale(i === 2 ? 1 : 2);
      return f;
    });
    this.birds = [];
    this.eagle = null;
    // Sky life of the high biomes (see updateSkyLife).
    this.skyFx = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.far + 9);
    // Storm Crown: lightning flickering inside the thunderheads (see updateSkyLife).
    this.stormAnvils = this.biomeLayers.find((r) => r.key === 'bg_storm_anvils');
    this.stormGlow = this.stormAnvils ? [0, 1, 2].map(() => scene.add.image(0, 0, 'bg_storm_anvils').setOrigin(0, 0).setScrollFactor(0)
      .setDepth(this.stormAnvils.depth).setBlendMode('ADD').setTint(0xc8d4ff).setVisible(false)) : [];
    this.bats = [];
    this.smoke = [];
    this.streaks = [];
    this.flicker = 0;
    this.time = 0;
    this.floatersVisible = false;
    this.auroraVisible = false;
    this.skyLife = new SkyLife(scene);
    // The sun's path glittering on the sea of clouds (see update).
    this.seaGlitter = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.cloudSea + 1).setBlendMode('ADD');
  }

  // mix: biomeMixAt() at the camera height. whiteout: 0..1 storm strength.
  update(dt, alt, day, ambience, { mix = null, whiteout = 0, storm = 0 } = {}) {
    this.time += dt;
    // Scenery takes the light of the hour, with the biome's warmth (the Green Rise stays cool).
    const light = mix ? warmthOf(day.light, Math.min(1, mixWarmth(mix))) : day.light;
    const weight = (id) => (mix ? (mix.a.id === id ? 1 - mix.t : 0) + (mix.b.id === id ? mix.t : 0) : 0);
    // Sky gradient in stepped bands (pixel-art friendly), tinted by the biome.
    let skyTop = day.skyTop, skyBottom = day.skyBottom;
    if (mix) {
      for (const b of new Set([mix.a, mix.b])) {
        const s = b.backdrop?.sky;
        const k = s ? weight(b.id) * s.amount * (1 - day.night * 0.6) : 0;
        if (k > 0) { skyTop = lerpColor(skyTop, s.top, k); skyBottom = lerpColor(skyBottom, s.bottom, k); }
      }
    }
    if (whiteout > 0) {
      const k = whiteout * (1 - day.night * 0.5);
      skyTop = lerpColor(skyTop, 0xc8d4e4, k * 0.6);
      skyBottom = lerpColor(skyBottom, 0xf0f4fa, k * 0.7);
    }
    // A raging storm on the Storm Crown turns the sky to slate.
    if (storm > 0) {
      skyTop = lerpColor(skyTop, 0x141824, storm * 0.8);
      skyBottom = lerpColor(skyBottom, 0x3a4058, storm * 0.7);
    }
    const overcast = mix ? Math.min(1, [...new Set([mix.a, mix.b])].reduce((k, b) => k + (b.overcast || 0) * weight(b.id), 0) + storm) : Math.min(1, storm);
    this.overcast = Math.min(1, overcast + whiteout * 0.8);
    this.updateBodies(day, skyBottom);
    this.drawSky(skyTop, skyBottom, day);
    this.skyLife.update(dt, alt, day, skyBottom);
    this.updateStars(day);

    const placeRange = (r, alpha, at = alt) => {
      const y = Math.round(HORIZON - r.E * r.f + at * r.f);
      const h = r.img.height;
      const visible = y < GAME_HEIGHT && alpha > 0.01;
      r.img.setVisible(visible).setY(y).setAlpha(alpha);
      const tint = lerpColor(light, skyBottom, r.haze * (1 - day.night * 0.5));
      r.img.setTint(tint);
      r.fillRect.setVisible(visible && r.fill !== null && y + h < GAME_HEIGHT).setY(y + h).setAlpha(alpha);
      if (r.fill !== null) r.fillRect.fillColor = multiply(r.fill, tint);
    };
    // An expedition theme can scorch the distant hills or drop them altogether
    // (weighted, so the expedition picker can blend from one theme to the next).
    let hide = 0, scorch = 0xffffff;
    for (const th of mix ? new Set([mix.a, mix.b]) : []) {
      if (!th.special) continue;
      const w = weight(th.id);
      if (th.hideRanges) hide += w * Math.min(1, alt / 25);
      if (th.rangeTint) scorch = lerpColor(scorch, th.rangeTint, w);
    }
    for (const r of this.ranges) {
      placeRange(r, Math.max(0, 1 - hide));
      if (scorch !== 0xffffff) {
        r.img.setTint(multiply(r.img.tintTopLeft, scorch));
        if (r.fill !== null) r.fillRect.fillColor = multiply(r.fillRect.fillColor, scorch);
      }
    }
    for (const r of this.biomeLayers) {
      const w = weight(r.biome);
      placeRange(r, w, w > 0 ? biomeLocalAlt(alt, r.biome) : alt);
    }

    // Drifting clouds pass downward as you climb, giving a sense of ascent.
    for (const c of this.clouds) {
      c.x += (c.speed * dt) / 1000;
      if (c.x > GAME_WIDTH + 50) c.x = -50;
      const span = GAME_HEIGHT + 80;
      c.y = Math.round((((c.baseY + alt * 16 * c.par * 0.15) % span) + span) % span) - 40;
      c.setTint(lerpColor(light, 0xffffff, 0.3)).setAlpha(0.9 - day.night * 0.4);
      c.x = Math.round(c.x * 10) / 10;
    }

    // Cloud sea appears once you climb above the cloud layer (the Above the Clouds biome).
    // (An expedition theme can bring the sea lower: the sky islands float over it.)
    const seaFrom = (mix && (mix.t > 0.5 ? mix.b : mix.a).seaFrom) ?? BIOMES.clouds.from - 10;
    const seaAlpha = Math.max(0, Math.min(1, (alt - seaFrom) / 30));
    const seaY = Math.round(Math.min(GAME_HEIGHT - 48, 150 + Math.max(0, alt - seaFrom - 10) * 0.25));
    // Each high biome colours its sea of clouds: storm grey, dusk violet, ember red.
    let sea = 0xffffff;
    if (mix) for (const b of new Set([mix.a, mix.b])) if (b.sea) sea = lerpColor(sea, b.sea, weight(b.id));
    let seaTint = multiply(lerpColor(light, 0xffffff, 0.15), sea);
    // At sunrise and sunset the sea of clouds catches the light: gold on top,
    // rose underneath, and a glittering path under the sun.
    const lowSun = day.sun ? Math.max(0, 1 - day.sun.h / 0.5) : 0;
    if (lowSun > 0) seaTint = lerpColor(seaTint, 0xffc890, lowSun * 0.45);
    this.cloudSea.setVisible(seaAlpha > 0).setAlpha(seaAlpha).setY(seaY).setTint(seaTint, seaTint, lerpColor(seaTint, 0xe890a8, lowSun * 0.4), lerpColor(seaTint, 0xe890a8, lowSun * 0.4));
    const gl = this.seaGlitter;
    gl.clear();
    if (seaAlpha > 0 && day.sun) {
      const k = seaAlpha * (0.35 + lowSun * 0.65);
      for (let i = 0; i < 26; i++) {
        const y = seaY + 4 + i * 2.2;
        const w = 4 + i * 1.6, x = day.sun.x + Math.sin(this.time / 600 + i * 1.7) * (2 + i * 0.6);
        if (Math.sin(this.time / 240 + i * 2.3) > 0.2) gl.fillStyle(lerpColor(0xfff4d8, 0xffb060, lowSun), 0.22 * k * (1 - i / 26)).fillRect(Math.round(x - w / 2), Math.round(y), Math.round(w), 1);
      }
    }
    this.cloudSea.tilePositionX += dt * 0.004;
    this.cloudSeaFill.setVisible(seaAlpha > 0).setAlpha(seaAlpha).setY(seaY + 88);
    this.cloudSeaFill.fillColor = multiply(multiply(0xbcc6de, light), sea);

    // Floating stones: they only drift where the air holds them up (biomes
    // with `floaters`: above the clouds and among the crystals).
    const floatW = mix ? [...new Set([mix.a, mix.b])].reduce((k, b) => k + (b.floaters ? weight(b.id) : 0), 0) : 0;
    const fa = Math.max(0, Math.min(1, (alt - BIOMES.clouds.from - 40) / 40)) * floatW;
    this.floatersVisible = fa > 0.9;
    this.floaters.forEach((f) => {
      f.setVisible(fa > 0).setAlpha(fa).setTint(light);
      f.setPosition(Math.round(f.baseX + Math.sin(this.time / 4000 + f.phase) * 6), Math.round(f.baseY + Math.sin(this.time / 1700 + f.phase) * 3));
    });

    // The Aurora Ridge keeps the northern lights up, day or night.
    const auroraBiome = mix ? [...new Set([mix.a, mix.b])].reduce((k, b) => k + (b.aurora || 0) * weight(b.id), 0) : 0;
    this.updateAurora(day, alt, auroraBiome);
    this.updateBirds(dt, ambience, day, light);
    this.updateSkyLife(dt, weight, light);
  }

  // The sun and the moon on their arcs. Both rise out of the hills and sink
  // back behind them (the ranges are drawn over them), fading as they go.
  updateBodies(day, skyBottom) {
    const clear = 1 - this.overcast * 0.9;
    const halo = this.halo.clear();
    const sun = day.sunSky;
    if (sun) {
      const vis = Math.max(0, Math.min(1, (sun.h + 0.04) / 0.1));
      const low = Math.max(0, 1 - Math.max(0, sun.h) / 0.4);
      const x = Math.round(sun.x), y = Math.round(sun.y);
      this.sunScreen = { x, y, h: sun.h, vis: vis * clear, low };
      this.sun.setVisible(vis > 0).setPosition(x, y).setAlpha(vis * clear).setScale(1 + low * 0.22)
        .setTint(lerpColor(0xffffff, 0xff9a50, low * 0.85));
      const hc = lerpColor(0xfff2c8, 0xff8a40, low);
      [[13, 0.2], [20, 0.11], [30, 0.06], [44, 0.035]].forEach(([r, a]) => halo.fillStyle(hc, a * vis * clear * (0.7 + low * 0.6)).fillCircle(x, y, r * (1 + low * 0.3)));
    } else {
      this.sunScreen = null;
      this.sun.setVisible(false);
    }
    const moon = day.moonSky;
    if (moon) {
      const vis = Math.max(0, Math.min(1, (moon.h + 0.04) / 0.1)) * Math.min(1, day.night * 1.6);
      const low = Math.max(0, 1 - Math.max(0, moon.h) / 0.3);
      const x = Math.round(moon.x), y = Math.round(moon.y);
      this.moonScreen = { x, y, h: moon.h, vis: vis * clear, low };
      const key = buildMoon(this.scene, day.moonPhase);
      if (this.moon.texture.key !== key) this.moon.setTexture(key);
      // A rising moon is big and amber; high up it is small and silver.
      this.moon.setVisible(vis > 0).setPosition(x, y).setAlpha(vis * clear).setScale(1 + low * 0.25)
        .setTint(lerpColor(0xffffff, 0xffc890, low * 0.8));
      const lit = 0.25 + day.moonLit * 0.75;
      [[11, 0.16], [18, 0.08], [28, 0.04]].forEach(([r, a]) => halo.fillStyle(lerpColor(0x9fb4ff, 0xffd8a0, low), a * vis * clear * lit).fillCircle(x, y, r));
    } else {
      this.moonScreen = null;
      this.moon.setVisible(false);
    }
  }

  // The sky: a gradient in soft pixel bands, with a glow on the horizon where
  // the sun is rising or setting (it lingers after the sun is gone) and a
  // faint pale one around a low moon.
  drawSky(skyTop, skyBottom, day) {
    let glow = null;
    const sun = day.sunSky;
    if (sun && sun.h < 0.5) {
      const k = Math.max(0, Math.min(1, (0.5 - sun.h) / 0.4)) * Math.max(0, Math.min(1, (sun.h + 0.22) / 0.16));
      const deep = Math.max(0, Math.min(1, -sun.h / 0.18));
      if (k > 0.02) glow = { x: sun.x, y: Math.max(sun.y, 120), r: 150, k: k * 0.75 * (1 - this.overcast * 0.8), c: lerpColor(lerpColor(0xffe0a0, 0xff8a58, Math.min(1, (0.5 - sun.h) * 2)), 0xd8607a, deep), c2: lerpColor(0xfff4d0, 0xffb070, deep) };
    } else if (day.moonSky && day.moonSky.h > -0.05) {
      glow = { x: day.moonSky.x, y: day.moonSky.y, r: 60, k: 0.2 * day.night * (0.3 + day.moonLit * 0.7) * (1 - this.overcast), c: 0x6a7ab8, c2: 0x9aa8d8 };
    }
    const q = (v, n) => Math.round(v / n);
    const key = glow ? `${skyTop}-${skyBottom}-${q(glow.x, 4)}-${q(glow.y, 4)}-${q(glow.k, 0.03)}-${glow.c}` : `${skyTop}-${skyBottom}`;
    if (key === this.skyKey) return;
    // A glowing sky is a few thousand rects: redraw it at most ~8 times a second.
    if (glow && this.skyKey && this.time - (this.skyAt || 0) < 120) return;
    this.skyKey = key;
    this.skyAt = this.time;
    const g = this.sky.clear();
    const ROW = 6, COL = 6, SKY_H = 204;
    for (let y = 0; y < GAME_HEIGHT; y += ROW) {
      const base = y < SKY_H ? lerpColor(skyTop, skyBottom, Math.pow(y / SKY_H, 1.35)) : skyBottom;
      if (!glow || glow.k < 0.02) { g.fillStyle(base, 1).fillRect(0, y, GAME_WIDTH, ROW); continue; }
      let runX = 0, runC = -1;
      for (let x = 0; x <= GAME_WIDTH; x += COL) {
        let c = base;
        if (x < GAME_WIDTH) {
          const d = Math.hypot((x + COL / 2 - glow.x) / 1.9, (y + ROW / 2 - glow.y) * 1.15) / glow.r;
          const k = Math.max(0, 1 - d);
          if (k > 0) {
            // Two steps of glow: a broad warm wash and a bright core near the body.
            c = lerpColor(base, glow.c, Math.min(1, k * k * glow.k * 1.4));
            if (k > 0.72) c = lerpColor(c, glow.c2, (k - 0.72) / 0.28 * glow.k * 0.8);
          }
        } else c = -2;
        if (c !== runC) {
          if (runC >= 0) g.fillStyle(runC, 1).fillRect(runX, y, x - runX, ROW);
          runX = x; runC = c;
        }
      }
    }
  }

  // Stars come out one by one as it gets dark (the brightest first), twinkle,
  // and the Milky Way shows once the night is deep. Clouds hide them.
  updateStars(day) {
    const g = this.starG.clear();
    const dark = Math.max(0, Math.min(1, (day.night - 0.22) / 0.55)) * (1 - this.overcast);
    this.milky.setAlpha(Math.max(0, Math.min(1, (day.night - 0.75) / 0.2)) * 0.9 * (1 - this.overcast));
    if (dark <= 0) return;
    const t = this.time / 1000;
    for (const s of this.starList) {
      const on = Math.min(1, (dark - s.thr) * 5);
      if (on <= 0) continue;
      const tw = 0.6 + 0.4 * Math.sin(t * s.sp + s.ph);
      const a = on * s.b * tw;
      g.fillStyle(s.c, a).fillRect(s.x, s.y, 1, 1);
      if (s.big) {
        g.fillStyle(s.c, a * 0.4).fillRect(s.x - 1, s.y, 1, 1).fillRect(s.x + 1, s.y, 1, 1).fillRect(s.x, s.y - 1, 1, 1).fillRect(s.x, s.y + 1, 1, 1);
        if (tw > 0.9) g.fillStyle(s.c, a * 0.25).fillRect(s.x - 2, s.y, 1, 1).fillRect(s.x + 2, s.y, 1, 1);
      }
    }
  }

  // Something alive in every high sky: bats in the Obsidian Spires, shooting
  // stars over the Aurora Ridge, smoke from the dragon's nostrils, and storm
  // light flickering inside the thunderheads of the Storm Crown.
  updateSkyLife(dt, weight, light) {
    const g = this.skyFx;
    g.clear();
    const chance = (perSec) => Math.random() < (dt / 1000) * perSec;
    // Bats: a jittery little swarm, dark against the dusk.
    if (weight('obsidian') > 0.5 && this.bats.length === 0 && chance(0.12)) {
      const dir = Math.random() < 0.5 ? 1 : -1, y0 = 30 + Math.random() * 70, n = 4 + Math.floor(Math.random() * 5);
      for (let i = 0; i < n; i++) {
        const b = this.scene.add.image(dir > 0 ? -10 - i * 7 : GAME_WIDTH + 10 + i * 7, y0 + (Math.random() - 0.5) * 20, 'bird', 0).setScrollFactor(0).setDepth(DEPTH.mid + 5).setScale(0.75);
        b.dir = dir; b.phase = Math.random() * 10; b.baseY = b.y; b.speed = 0.05 + Math.random() * 0.02;
        this.bats.push(b);
      }
    }
    this.bats.forEach((b) => {
      b.x += b.dir * dt * b.speed;
      b.y = b.baseY + Math.sin(this.time / 140 + b.phase) * 5 + Math.sin(this.time / 53 + b.phase * 3) * 2;
      b.setFrame(Math.floor(this.time / 70 + b.phase) % 2).setTint(0x1a1222);
    });
    this.bats = this.bats.filter((b) => { const gone = b.x < -60 || b.x > GAME_WIDTH + 60; if (gone) b.destroy(); return !gone; });

    // Shooting stars over the Aurora Ridge.
    if (weight('aurora') > 0.5 && chance(0.35)) {
      this.streaks.push({ x: 40 + Math.random() * (GAME_WIDTH - 80), y: 10 + Math.random() * 50, dx: (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random()), life: 0 });
    }
    this.streaks = this.streaks.filter((s) => {
      s.life += dt;
      const p = s.life / 650;
      if (p >= 1) return false;
      const len = 18 * Math.sin(p * Math.PI);
      for (let k = 0; k < len; k++) {
        g.fillStyle(k < 2 ? 0xffffff : 0xc8ffe8, (1 - k / len) * (1 - p * 0.6));
        g.fillRect(Math.round(s.x + s.dx * (p * 40 - k * 0.5)), Math.round(s.y + p * 22 - k * 0.45), 1, 1);
      }
      return true;
    });

    // Dragon smoke: dark plumes rise slowly from behind the far ridge.
    if (weight('dragon') > 0.5 && this.smoke.length < 7 && chance(0.6)) {
      const p = this.scene.add.image(Math.random() * GAME_WIDTH, 150 + Math.random() * 30, 'puff').setScrollFactor(0).setDepth(DEPTH.far + 7)
        .setScale(1.2 + Math.random() * 1.2).setAlpha(0).setTint(0x3a2626);
      p.life = 0; p.span = 7000 + Math.random() * 4000; p.vx = (Math.random() - 0.3) * 0.004;
      this.smoke.push(p);
    }
    this.smoke = this.smoke.filter((p) => {
      p.life += dt;
      const t = p.life / p.span;
      if (t >= 1 || weight('dragon') < 0.2) { p.destroy(); return false; }
      p.y -= dt * 0.006; p.x += dt * p.vx;
      p.setAlpha(Math.sin(t * Math.PI) * 0.4).setScale(p.scale + dt * 0.00012);
      return true;
    });

    // Storm Crown: light flickers deep inside the far thunderheads.
    // The thunderheads themselves light up (an additive copy of their layer,
    // cropped to a stretch of sky with softer, wider copies around it), so the
    // glow always has the shape of the clouds.
    if (weight('storm') > 0.5 && this.flicker <= 0 && chance(0.25)) this.startFlicker();
    const anvils = this.stormAnvils;
    if (this.flicker > 0 && anvils && anvils.img.visible) {
      this.flicker -= dt;
      const a = (Math.floor(this.flicker / 50) % 2 ? 0.55 : 0.18) * weight('storm');
      this.stormGlow.forEach((img, i) => img.setVisible(true).setY(anvils.img.y).setAlpha(a * [1, 0.55, 0.3][i]));
    } else {
      this.flicker = Math.max(0, this.flicker - dt);
      this.stormGlow.forEach((img) => img.setVisible(false));
    }
  }

  startFlicker() {
    if (!this.stormAnvils) return;
    this.flicker = 260;
    const cx = 60 + Math.random() * (GAME_WIDTH - 120);
    const h = this.stormAnvils.img.height;
    [60, 110, 170].forEach((w, i) => {
      const half = w / 2 + Math.random() * 16;
      const l = Math.max(0, Math.round(cx - half)), r = Math.min(GAME_WIDTH, Math.round(cx + half));
      this.stormGlow[i].setCrop(l, 0, r - l, h);
    });
  }

  updateAurora(day, alt, biome = 0) {
    const g = this.aurora;
    g.clear();
    const strength = Math.max(Math.max(0, day.night - 0.6) * 2.5 * Math.max(0, Math.min(1, (alt - 650) / 60)), biome * 1.2);
    this.auroraVisible = strength > 0.5;
    if (strength <= 0) return;
    const t = this.time / 1000;
    const bands = [{ c: 0x5af0a0, y: 34, a: 0.5 }, { c: 0x40c8d8, y: 52, a: 0.4 }, { c: 0x9a70f0, y: 24, a: 0.25 }];
    for (const b of bands) {
      for (let x = 0; x < GAME_WIDTH; x += 2) {
        const y = b.y + Math.sin(x * 0.018 + t * 0.4 + b.y) * 10 + Math.sin(x * 0.05 - t * 0.7) * 3;
        const len = 18 + Math.sin(x * 0.03 + t) * 8;
        const a = b.a * strength * (0.6 + 0.4 * Math.sin(x * 0.07 + t * 1.3));
        g.fillStyle(b.c, Math.max(0, Math.min(0.6, a)));
        g.fillRect(x, Math.round(y), 2, Math.round(len));
      }
    }
  }

  updateBirds(dt, ambience, day, light) {
    if (ambience.birds > 0 && day.night < 0.4 && this.birds.length === 0 && Math.random() < dt / 9000 * ambience.birds) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const n = 3 + Math.floor(Math.random() * 4);
      const y0 = 40 + Math.random() * 60;
      for (let i = 0; i < n; i++) {
        const b = this.scene.add.image(dir > 0 ? -10 - i * 8 : GAME_WIDTH + 10 + i * 8, y0 + Math.abs(i - n / 2) * 4, 'bird', 0).setScrollFactor(0).setDepth(DEPTH.far + 5);
        b.dir = dir; b.phase = i;
        this.birds.push(b);
      }
    }
    this.birds.forEach((b) => {
      b.x += b.dir * dt * 0.025;
      b.y += Math.sin(this.time / 300 + b.phase) * 0.05;
      b.setFrame(Math.floor(this.time / 180 + b.phase) % 2).setTint(light);
      b.setPosition(b.x, b.y);
    });
    this.birds = this.birds.filter((b) => {
      const gone = b.x < -60 || b.x > GAME_WIDTH + 60;
      if (gone) b.destroy();
      return !gone;
    });
    if (this.eagle) {
      const e = this.eagle;
      e.x += e.dir * dt * 0.05;
      e.y = e.baseY + Math.sin(this.time / 900) * 6;
      e.setFrame(Math.floor(this.time / 400) % 2).setTint(light);
      if (!e.seen && Math.abs(e.x - GAME_WIDTH / 2) < 80) { e.seen = true; e.onSeen && e.onSeen(); }
      if (e.x < -40 || e.x > GAME_WIDTH + 40) { e.destroy(); this.eagle = null; }
    }
  }

  // A rare large bird glides past in front of the distant ranges.
  spawnEagle(onSeen) {
    if (this.eagle) return;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const e = this.scene.add.image(dir > 0 ? -30 : GAME_WIDTH + 30, 0, 'eagle', 0).setScrollFactor(0).setDepth(DEPTH.mid + 6);
    e.dir = dir; e.baseY = 50 + Math.random() * 50; e.onSeen = onSeen; e.seen = false;
    e.setFlipX(dir < 0);
    this.eagle = e;
  }
}

function multiply(a, b) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (((ar * br) / 255) << 16) | (((ag * bg) / 255) << 8) | ((ab * bb) / 255);
}
