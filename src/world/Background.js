import { DEPTH, GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';
import { lerpColor } from '../utils/color.js';
import { BIOMES, biomeLocalAlt } from '../data/biomes.js';

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
    this.stars = scene.add.image(0, 0, 'stars').setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.sky + 1);
    this.aurora = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.sky + 2);
    this.sun = scene.add.image(0, 0, 'sun').setScrollFactor(0).setDepth(DEPTH.sky + 3);
    this.moon = scene.add.image(0, 0, 'moon').setScrollFactor(0).setDepth(DEPTH.sky + 3);
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
    this.time = 0;
    this.floatersVisible = false;
    this.auroraVisible = false;
  }

  // mix: biomeMixAt() at the camera height. whiteout: 0..1 storm strength.
  update(dt, alt, day, ambience, { mix = null, whiteout = 0 } = {}) {
    this.time += dt;
    const light = day.light;
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
    const key = `${skyTop}-${skyBottom}`;
    if (key !== this.skyKey) {
      this.skyKey = key;
      const g = this.sky;
      g.clear();
      const bands = 16;
      for (let i = 0; i < bands; i++) {
        const t = Math.pow(i / (bands - 1), 1.4);
        g.fillStyle(lerpColor(skyTop, skyBottom, t), 1);
        g.fillRect(0, Math.floor((i * 200) / bands), GAME_WIDTH, Math.ceil(200 / bands) + 1);
      }
      g.fillStyle(skyBottom, 1);
      g.fillRect(0, 200, GAME_WIDTH, GAME_HEIGHT - 200);
    }
    this.stars.setAlpha(Math.max(0, day.night - 0.2) * 1.2).setY(Math.round(-10 + (alt * 0.01) % 10));
    if (day.sun) this.sun.setVisible(true).setPosition(Math.round(day.sun.x), Math.round(day.sun.y + Math.min(40, alt * 0.01))).setTint(lerpColor(0xffffff, 0xffa060, Math.max(0, 1 - day.sun.y / 150)));
    else this.sun.setVisible(false);
    if (day.moon) this.moon.setVisible(true).setPosition(Math.round(day.moon.x), Math.round(day.moon.y));
    else this.moon.setVisible(false);

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
    for (const r of this.ranges) placeRange(r, 1);
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

    // Cloud sea appears once you climb above the cloud layer (~480 m).
    const seaAlpha = Math.max(0, Math.min(1, (alt - 470) / 30));
    const seaY = Math.round(Math.min(GAME_HEIGHT - 48, 150 + Math.max(0, alt - 480) * 0.25));
    this.cloudSea.setVisible(seaAlpha > 0).setAlpha(seaAlpha).setY(seaY).setTint(lerpColor(light, 0xffffff, 0.15));
    this.cloudSea.tilePositionX += dt * 0.004;
    this.cloudSeaFill.setVisible(seaAlpha > 0).setAlpha(seaAlpha).setY(seaY + 88);
    this.cloudSeaFill.fillColor = multiply(0xbcc6de, light);

    // Floating stones: a rare high-altitude formation.
    const fa = Math.max(0, Math.min(1, (alt - 520) / 40));
    this.floatersVisible = fa > 0.9;
    this.floaters.forEach((f) => {
      f.setVisible(fa > 0).setAlpha(fa).setTint(light);
      f.setPosition(Math.round(f.baseX + Math.sin(this.time / 4000 + f.phase) * 6), Math.round(f.baseY + Math.sin(this.time / 1700 + f.phase) * 3));
    });

    this.updateAurora(day, alt);
    this.updateBirds(dt, ambience, day, light);
  }

  updateAurora(day, alt) {
    const g = this.aurora;
    g.clear();
    const strength = Math.max(0, day.night - 0.6) * 2.5 * Math.max(0, Math.min(1, (alt - 650) / 60));
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
