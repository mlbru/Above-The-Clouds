import { GAME_WIDTH, GAME_HEIGHT, IS_TOUCH } from '../config/gameConfig.js';
import { PixelText, COLORS } from './PixelText.js';
import { Audio } from '../systems/AudioSystem.js';
import { cloudPass } from '../utils/transition.js';
import { lerpColor, darken } from '../utils/color.js';
import { makeNoise2D } from '../utils/seededRandom.js';
import { buildDragonTextures, HEAD_W, HEAD_H, HEAD_NECK, WING_W, WING_H, WING_SHOULDER, WING_FLAP, SEG_RADII, dirIndex } from '../render/dragonArt.js';

const DEPTH = 8000; // under the cloud wipe (9000), over everything in the run
const FLIGHT_MS = 10500;
const W = GAME_WIDTH, H = GAME_HEIGHT;
const INK = 0x16141f;
const SEGS = 36;
const nearR = (r) => SEG_RADII.reduce((a, b) => (Math.abs(b - r) < Math.abs(a - r) ? b : a));
const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// The Dragon's Gate, part two: the dragon carries you across the sea of
// clouds to the next mountain. Side on, flying right: the old mountain (with
// the Gate's braziers still burning on it) falls away on the left, peaks
// poke through the cloud sea below, clouds stream past in front, and the
// Far Range rises on the right, green-black rock with waterfalls falling
// into the clouds and one lit ledge waiting. The dragon is built from the
// same scales, wings and head as the one coiled round the Spine; you sit at
// the base of its neck, one hand on a spine, scarf streaming. It roars once
// over the sea and breathes a plume of fire into the sky. Any key skips.
// opts: { meters, jacket, day, farName, onDone }
export class DragonFlight {
  constructor(scene, opts) {
    this.scene = scene;
    this.opts = opts;
    this.t = 0;
    this.done = false;
    this.parts = [];
    buildDragonTextures(scene);
    const add = (o, d = 0) => { o.setScrollFactor(0).setDepth(DEPTH + d); this.parts.push(o); return o; };
    const day = opts.day || { skyTop: 0x2a3a78, skyBottom: 0xf0b0a0, light: 0xffffff, night: 0 };
    this.night = day.night || 0;
    // Dusk-warm whatever the hour: the flight always feels like an evening.
    this.skyTop = lerpColor(day.skyTop, 0x2a2458, 0.35);
    this.skyBottom = lerpColor(day.skyBottom, 0xffb48a, 0.35 * (1 - this.night));
    this.light = lerpColor(day.light || 0xffffff, 0xffd0a0, 0.25);
    this.noise = makeNoise2D(9091);

    // Sky.
    const g = add(this.scene.add.graphics(), 0);
    for (let i = 0; i < 28; i++) g.fillStyle(lerpColor(this.skyTop, this.skyBottom, (i / 27) ** 1.4), 1).fillRect(0, Math.floor((i * H) / 28), W, Math.ceil(H / 28) + 1);
    if (this.night > 0.25) {
      for (let i = 0; i < 110; i++) g.fillStyle(0xffffff, (0.25 + ((i * 17) % 10) / 14) * (this.night - 0.2)).fillRect(Math.round((i * 89.7) % W), Math.round((i * 41.3) % (H * 0.55)), 1, 1);
    }
    // The sun or moon low over the sea, with a long glitter path.
    this.bodyX = W * 0.68; this.bodyY = H * 0.36;
    this.sunG = add(this.scene.add.graphics().setBlendMode('ADD'), 0.1);
    const sun = this.night < 0.5;
    const c = sun ? 0xffc890 : 0xc8d4ff;
    [[48, 0.05], [30, 0.09], [18, 0.15]].forEach(([r, a]) => this.sunG.fillStyle(c, a).fillCircle(this.bodyX, this.bodyY, r));
    this.sunG.fillStyle(sun ? 0xfff2d8 : 0xf2f0e6, 1).fillCircle(this.bodyX, this.bodyY, sun ? 9 : 7);

    this.far = add(this.scene.add.graphics(), 0.2);      // distant peaks through the sea
    this.oldMtn = add(this.scene.add.graphics(), 0.3);   // the mountain you leave
    this.newMtn = add(this.scene.add.graphics(), 0.3);   // the Far Range
    this.sea = add(this.scene.add.graphics(), 0.4);
    this.glow = add(this.scene.add.graphics().setBlendMode('ADD'), 0.45);
    this.cloudTint = lerpColor(lerpColor(this.light, 0xffffff, 0.3), this.skyBottom, 0.2);
    // Near clouds rush past in front, but above and below the dragon, never over it.
    this.nearBand = (i) => (i % 2 ? H * (0.04 + Math.random() * 0.1) : H * (0.74 + Math.random() * 0.12));
    this.clouds = Array.from({ length: 11 }, (_, i) => {
      const near = i < 3;
      const img = add(this.scene.add.image(0, 0, `cloud${i % 4}`), near ? 3 : 0.42);
      img.setScale(near ? 2.6 + (i % 2) * 0.6 : 1.2 + (i % 3) * 0.35).setTint(near ? this.cloudTint : lerpColor(this.cloudTint, this.skyBottom, 0.4)).setAlpha(near ? 0.6 : 0.75);
      return { img, near, x: (i * 157.3) % (W + 220) - 110, y: near ? this.nearBand(i) : H * (0.48 + (i % 4) * 0.06), v: near ? 0.42 : 0.07 + (i % 3) * 0.02, i };
    });

    // The dragon: far wing, body (outline, scales, belly, spines), tail tip,
    // head, near wing, rider. Positioned every frame in drawDragon().
    const img = (key, d) => add(this.scene.add.image(0, 0, key), d);
    this.wingFar = img('dragon_wing_3', 1).setTint(0x8a6a6a);
    this.lines = Array.from({ length: SEGS }, () => img('dragon_segol_10', 1.1));
    this.segs = Array.from({ length: SEGS }, (_, i) => img('dragon_seg_10', 1.2 + i * 0.0005));
    this.bellies = Array.from({ length: SEGS }, () => img('dragon_belly_10', 1.25));
    this.spines = Array.from({ length: SEGS }, () => img('dragon_spine_0', 1.15));
    this.tip = img('dragon_tip_0', 1.18);
    this.head = img('dragon_head_1', 1.4);
    this.headGlow = img('dragon_head_glow_1', 1.41).setBlendMode('ADD').setTint(0xff6a1a);
    this.rider = add(this.scene.add.graphics(), 1.7);
    this.wingNear = img('dragon_wing_3', 1.6);
    this.fire = add(this.scene.add.graphics().setBlendMode('ADD'), 1.45);
    this.embers = [];

    // Words: where you are, between two gold rules, changing as you fly.
    this.ui = add(this.scene.add.graphics(), 4);
    this.lead = add(new PixelText(scene, W / 2, H - 58, '', { color: '#ffffff', shadow: '#16141f' }).setOrigin(0.5, 0), 4);
    this.name = add(new PixelText(scene, W / 2, H - 47, '', { color: '#ffd6a0', shadow: '#16141f' }).setOrigin(0.5, 0).setScale(2), 4);
    this.sub = add(new PixelText(scene, W / 2, H - 26, '', { color: COLORS.gold, shadow: '#16141f' }).setOrigin(0.5, 0), 4);
    if (!IS_TOUCH) add(new PixelText(scene, W - 8, H - 12, 'ANY KEY: SKIP', { color: '#ffffff', shadow: '#16141f' }).setOrigin(1, 0).setAlpha(0.6), 4);
    add(scene.add.zone(0, 0, W, H).setOrigin(0, 0).setInteractive(), 5).on('pointerdown', () => this.skip());
    // Fade in from the Gate's flash.
    this.flash = add(scene.add.rectangle(0, 0, W, H, 0xfff0d0).setOrigin(0, 0), 6);
    scene.tweens.add({ targets: this.flash, alpha: 0, duration: 700 });

    this.caption = -1;
    this.flapT = 0;
    this.lastFrame = -1;
    Audio.swell(26);
    Audio.play('roar');
    this.draw(16);
  }

  // 0..1 through the flight.
  get k() { return clamp01(this.t / FLIGHT_MS); }

  update(delta) {
    if (this.done) return;
    this.t += delta;
    const k = this.k;
    // The captions: the Gate, the crossing, the arrival.
    const cap = k < 0.24 ? 0 : k < 0.66 ? 1 : 2;
    if (cap !== this.caption) {
      this.caption = cap;
      const [lead, name, sub] = [
        ['YOU CLIMB ONTO ITS NECK AT', "THE DRAGON'S GATE", `${this.opts.meters} M`],
        ['THE DRAGON CARRIES YOU', 'ACROSS THE CLOUD SEA', 'HOLD ON'],
        ['A NEW MOUNTAIN', this.opts.farName, 'THE CLIMB GOES ON'],
      ][cap];
      this.lead.setText(lead);
      this.name.setText(name).setScale(2).setAlpha(0);
      this.sub.setText(sub);
      this.scene.tweens.add({ targets: this.name, alpha: 1, duration: 500 });
      this.drawRules();
      if (cap === 2) Audio.play('titlecard');
    }
    // A roar and a plume of fire over the open sea.
    if (!this.roared && k > 0.42) { this.roared = true; this.breathT = 0; Audio.play('roar', { volume: 0.8 }); Audio.play('flame'); }
    this.draw(delta);
    if (this.t >= FLIGHT_MS) this.finish();
  }

  drawRules() {
    const u = this.ui.clear();
    const rw = 22, gap = 8, nx0 = W / 2 - this.name.displayWidth / 2, nx1 = W / 2 + this.name.displayWidth / 2;
    for (const [x0, cap] of [[nx0 - gap - rw, nx0 - gap - 1], [nx1 + gap, nx1 + gap]]) {
      u.fillStyle(INK, 0.8).fillRect(x0, H - 39, rw, 1);
      u.fillStyle(0xf2c14e, 1).fillRect(x0, H - 40, rw, 1).fillRect(cap, H - 41, 1, 3);
    }
  }

  draw(delta) {
    const t = this.t, k = this.k;
    const f = Math.min(3, delta / 16);
    const seaY = Math.round(H * 0.66);
    this.glow.clear();
    this.drawFar(seaY, t);
    this.drawOld(seaY, k, t);
    this.drawNew(seaY, k, t);
    this.drawSea(seaY, t);
    for (const c of this.clouds) {
      c.x -= c.v * 6 * f;
      if (c.x < -140) { c.x = W + 140; c.y = c.near ? this.nearBand(c.i) : H * (0.48 + Math.random() * 0.2); }
      c.img.setPosition(Math.round(c.x), Math.round(c.y + (c.near ? Math.sin(t / 900 + c.x / 90) * 3 : 0)));
    }
    this.drawDragon(t, k, delta);
  }

  // Peaks of other mountains poking through the cloud sea, drifting by slowly.
  drawFar(seaY, t) {
    const g = this.far.clear();
    const col = lerpColor(0x4a4868, this.skyBottom, 0.55);
    const shift = t * 0.006;
    for (let i = 0; i < 6; i++) {
      const cx = ((i * 113 - shift * (1 + (i % 3) * 0.4)) % (W + 120) + W + 120) % (W + 120) - 60;
      const h = 18 + ((i * 37) % 26), w = 30 + ((i * 23) % 30);
      for (let x = -w; x <= w; x++) {
        const hy = h * (1 - Math.abs(x) / w) + this.noise(i * 7.1, x * 0.12) * 4;
        g.fillStyle(col, 1).fillRect(Math.round(cx + x), Math.round(seaY - hy), 1, Math.round(hy) + 2);
      }
      g.fillStyle(lerpColor(col, 0xffffff, 0.35), 1).fillRect(Math.round(cx) - 1, Math.round(seaY - h), 3, 2);
    }
  }

  // The mountain you came from: the coil of the Spine on the left, its two
  // Gate braziers still burning on the ledge, sliding away and hazing over.
  drawOld(seaY, k, t) {
    const g = this.oldMtn.clear();
    const x0 = Math.round(W * 0.16 - k * W * 0.55);
    if (x0 < -160) return;
    const haze = 0.2 + k * 0.55;
    const rock = lerpColor(0x2a1a1c, this.skyBottom, haze), lit = lerpColor(0x6a3a2a, this.skyBottom, haze);
    for (let y = 0; y < seaY + 4; y += 2) {
      const wy = y / H;
      const half = 34 + wy * 120 + this.noise(1.3, y * 0.04) * 16;
      const edge = Math.round(x0 + half * 0.6 + this.noise(2.7, y * 0.09) * 8);
      g.fillStyle(rock, 1).fillRect(Math.round(x0 - half), y, edge - Math.round(x0 - half), 2);
      g.fillStyle(lit, 1).fillRect(edge - 2, y, 2, 2);
    }
    // The Gate: two pillars and their fires, right at the top edge.
    const gy = Math.round(H * 0.3), gx = Math.round(x0 + 38);
    for (const px of [gx - 8, gx + 8]) {
      g.fillStyle(rock, 1).fillRect(px - 1, gy - 10, 3, 10);
      const fl = 0.6 + 0.4 * Math.sin(t / 70 + px);
      this.glow.fillStyle(0xff8a3c, 0.35 * fl * (1 - k * 0.6)).fillCircle(px, gy - 12, 5);
      g.fillStyle(0xffc860, 1).fillRect(px, gy - 13, 1, 2);
    }
  }

  // The Far Range: dark green rock, waterfalls into the clouds, mist, and one
  // ledge with a lamp. It rises in from the right and grows as you near it.
  drawNew(seaY, k, t) {
    const g = this.newMtn.clear();
    const p = ease(clamp01((k - 0.35) / 0.65));
    if (p <= 0) return;
    const cx = Math.round(W + 140 - p * (W * 0.42 + 120));
    const scale = 0.7 + p * 0.5;
    const haze = 0.55 - p * 0.4;
    const rock = lerpColor(0x1c3a34, this.skyBottom, haze), rock2 = lerpColor(0x2e5a48, this.skyBottom, haze), lit = lerpColor(0x8fd1a0, this.skyBottom, haze);
    const top = Math.round(H * 0.08 + (1 - p) * 40);
    for (let y = top; y < seaY + 4; y += 2) {
      const d = (y - top) / (seaY - top);
      // Twin summits: a notch near the top.
      const notch = d < 0.18 ? Math.abs(this.noise(4.4, y * 0.1)) * 10 : 0;
      const half = (18 + d * 150 + this.noise(5.1, y * 0.05) * 18) * scale;
      const l = Math.round(cx - half + notch), r = Math.round(cx + half * 0.8);
      g.fillStyle(rock, 1).fillRect(l, y, r - l, 2);
      g.fillStyle(rock2, 1).fillRect(l + 4, y, Math.max(0, Math.round((r - l) * 0.35)), 2);
      g.fillStyle(lit, 1).fillRect(l, y, 2, 2);
      // Moss on the steps.
      if (this.noise(l * 0.1, y * 0.13) > 0.6) g.fillStyle(lerpColor(0x5aa85a, this.skyBottom, haze), 1).fillRect(l, y - 1, 6, 1);
    }
    // Two waterfalls falling into the cloud sea.
    for (const [fx, fy] of [[-0.25, 0.32], [0.18, 0.45]]) {
      const x = Math.round(cx + fx * 150 * scale), y0 = Math.round(top + (seaY - top) * fy);
      for (let y = y0; y < seaY; y += 1) {
        const on = (Math.floor((y - t / 12) / 3) % 3) !== 0;
        g.fillStyle(on ? 0xe8f4ff : 0xa8c8e8, 0.85).fillRect(x, y, 2, 1);
      }
      this.glow.fillStyle(0xffffff, 0.12).fillCircle(x + 1, seaY, 8);
    }
    // The ledge waiting for you, with a lamp.
    const lx = Math.round(cx - 40 * scale), ly = Math.round(top + (seaY - top) * 0.55);
    g.fillStyle(rock2, 1).fillRect(lx - 10, ly, 20, 2);
    g.fillStyle(lit, 1).fillRect(lx - 10, ly, 20, 1);
    const lamp = 0.6 + 0.4 * Math.sin(t / 200);
    this.glow.fillStyle(0xffc870, 0.3 * lamp * p).fillCircle(lx + 6, ly - 4, 6);
    g.fillStyle(0xffe0a0, 1).fillRect(lx + 6, ly - 5, 1, 2);
  }

  // The sea of clouds: banded, scrolling, brighter where the sun lies on it.
  drawSea(seaY, t) {
    const g = this.sea.clear();
    const top = lerpColor(this.cloudTint, 0xffffff, 0.25), deep = lerpColor(this.cloudTint, this.skyBottom, 0.5);
    for (let y = seaY; y < H; y += 2) {
      const d = (y - seaY) / (H - seaY);
      g.fillStyle(lerpColor(top, deep, d * 0.8), 1).fillRect(0, y, W, 2);
    }
    // Billows along the top edge, rolling left.
    for (let x = -20; x < W + 20; x += 3) {
      const wx = x + t * 0.07;
      const b = Math.round(4 + this.noise(wx * 0.02, 0.5) * 9 + Math.sin(wx * 0.11) * 2);
      g.fillStyle(top, 1).fillRect(x, seaY - b, 3, b);
      g.fillStyle(0xffffff, 0.5).fillRect(x, seaY - b, 3, 1);
    }
    // The light's path on the clouds.
    for (let i = 0; i < 12; i++) {
      const y = seaY + 4 + i * 3, w = 10 + i * 4;
      if (Math.sin(t / 220 + i * 2.1) > 0.3) this.glow.fillStyle(0xffe0b0, 0.07 * (1 - i / 12)).fillRect(Math.round(this.bodyX - w / 2 + Math.sin(t / 300 + i) * 4), y, w, 1);
    }
  }

  drawDragon(t, k, delta) {
    this.glow.lineStyle(0);
    const s = t / 1000;
    // It climbs off the ledge, glides across, then swoops down to the far ledge.
    const swoop = ease(clamp01((k - 0.82) / 0.18));
    const lift = ease(clamp01(k / 0.12));
    const hx = Math.round(W * 0.5 + Math.sin(s * 0.5) * 10 + swoop * 70);
    const beat = Math.sin(s * 5.2);
    const hy = Math.round(H * 0.4 + (1 - lift) * 50 - beat * 4 + swoop * 26 + Math.sin(s * 0.8) * 6);
    // Body: from the neck joint back to the tail, a travelling wave along it.
    const L = 210;
    const pts = [];
    for (let i = 0; i < SEGS; i++) {
      const u = i / (SEGS - 1);
      const neck = Math.min(1, u / 0.2);
      const x = hx - 8 - u * L;
      let y = hy + 22 * ease(neck) + Math.sin(u * Math.PI * 2.4 - s * 3.4) * 7 * u + beat * 3 * (1 - u) * 0.5;
      y += swoop * u * 10;
      pts.push([x, y]);
    }
    const tint = lerpColor(this.light, 0xffffff, 0.5);
    for (let i = 0; i < SEGS; i++) {
      const u = i / (SEGS - 1);
      const [x, y] = pts[i];
      const [ax, ay] = pts[Math.max(0, i - 1)], [bx, by] = pts[Math.min(SEGS - 1, i + 1)];
      let tx = bx - ax, ty = by - ay;
      const len = Math.hypot(tx, ty) || 1; tx /= len; ty /= len;
      let nx = -ty, ny = tx;
      if (ny < 0) { nx = -nx; ny = -ny; } // the belly faces down
      const rad = u < 0.2 ? 7 + u * 25 : u < 0.4 ? 12 : 12 - (u - 0.4) * 16;
      const r = nearR(Math.max(3, rad));
      const px = Math.round(x), py = Math.round(y);
      this.lines[i].setTexture(`dragon_segol_${r}`).setPosition(px, py);
      this.segs[i].setTexture(`dragon_seg_${r}`).setPosition(px, py).setTint(tint);
      this.bellies[i].setTexture(`dragon_${i % 3 === 0 ? 'bellyl' : 'belly'}_${r}`).setPosition(Math.round(px + nx * r * 0.42), Math.round(py + ny * r * 0.42)).setTint(tint);
      const sp = this.spines[i];
      sp.setVisible(i % 3 === 0 && i > 2 && i < SEGS - 2);
      if (sp.visible) sp.setTexture(`dragon_spine_${dirIndex(Math.atan2(-ny, -nx))}`).setPosition(Math.round(px - nx * (r + 2)), Math.round(py - ny * (r + 2))).setTint(tint);
    }
    const [lx, ly] = pts[SEGS - 1], [px2, py2] = pts[SEGS - 2];
    this.tip.setTexture(`dragon_tip_${dirIndex(Math.atan2(ly - py2, lx - px2))}`).setPosition(Math.round(lx), Math.round(ly)).setTint(tint);
    // Head: facing the way it flies, nodding with the wingbeat; it roars once.
    const roaring = this.breathT !== undefined && this.breathT < 1600;
    const jaw = roaring ? 3 : Math.floor(s * 0.7) % 5 === 0 ? 2 : 1;
    const tilt = -0.08 + beat * 0.04 + swoop * 0.25 - (roaring ? 0.18 : 0);
    this.head.setTexture(`dragon_head_${jaw}`).setOrigin(HEAD_NECK.x / HEAD_W, HEAD_NECK.y / HEAD_H).setPosition(hx, hy).setRotation(tilt).setTint(tint);
    this.headGlow.setTexture(`dragon_head_glow_${jaw}`).setOrigin(HEAD_NECK.x / HEAD_W, HEAD_NECK.y / HEAD_H).setPosition(hx, hy).setRotation(tilt).setAlpha(0.45 + 0.25 * Math.sin(s * 3) + (roaring ? 0.4 : 0));
    // Wings at the shoulders: they beat slow and deep while it climbs, then glide.
    const gliding = k > 0.5 && k < 0.8;
    this.flapT += delta * (gliding ? 0.45 : 1);
    const frame = gliding && Math.sin(this.flapT / 400) > -0.3 ? 4 : WING_FLAP[Math.floor(this.flapT / 120) % WING_FLAP.length];
    if (frame !== this.lastFrame && frame === WING_FLAP[0] && !gliding) Audio.play('wing');
    this.lastFrame = frame;
    const [sx, sy] = pts[9];
    const ox = WING_SHOULDER.x / WING_W, oy = WING_SHOULDER.y / WING_H;
    this.wingFar.setTexture(`dragon_wing_${frame}`).setOrigin(ox, oy).setPosition(Math.round(sx + 6), Math.round(sy - 6)).setScale(0.9).setTint(lerpColor(tint, 0x3a2028, 0.45));
    this.wingNear.setTexture(`dragon_wing_${frame}`).setOrigin(ox, oy).setPosition(Math.round(sx - 2), Math.round(sy - 2)).setScale(1.05).setTint(tint);
    // The rider at the base of the neck, scarf streaming back.
    const [rx0, ry0] = pts[3];
    this.drawRider(Math.round(rx0), Math.round(ry0 - 9), t);
    // Fire: a plume into the sky over the sea.
    const fg = this.fire.clear();
    if (this.breathT !== undefined) {
      this.breathT += delta;
      if (this.breathT < 1600) {
        const mx = hx + Math.cos(tilt) * 52, my = hy + Math.sin(tilt) * 52 - 2;
        for (let i = 0; i < 3; i++) this.embers.push({ x: mx, y: my, vx: 3 + Math.random() * 1.8, vy: -0.9 - Math.random() * 0.9, life: 1, r: 1.5 + Math.random() * 2.5 });
      }
    }
    this.embers = this.embers.filter((e) => (e.life -= delta / 900) > 0);
    for (const e of this.embers) {
      e.x += e.vx * (delta / 16); e.y += e.vy * (delta / 16); e.vx *= 0.985;
      const c = e.life > 0.75 ? 0xfff4c0 : e.life > 0.5 ? 0xffb040 : e.life > 0.25 ? 0xf05a1a : 0x6a2a18;
      const r = Math.max(1, Math.round(e.r * (2.2 - e.life * 1.2)));
      fg.fillStyle(c, Math.min(1, e.life * 1.3)).fillRect(Math.round(e.x - r / 2), Math.round(e.y - r / 2), r, r);
    }
  }

  drawRider(x, y, t) {
    const g = this.rider.clear();
    const jacket = this.opts.jacket || 0xc8463b;
    // Legs astride the neck, body leaning forward into the wind.
    g.fillStyle(INK, 1).fillRect(x - 4, y - 1, 9, 9);
    g.fillStyle(0x2c3448, 1).fillRect(x - 3, y + 5, 3, 4).fillRect(x + 2, y + 5, 2, 3);
    g.fillStyle(jacket, 1).fillRect(x - 3, y, 7, 6);
    g.fillStyle(darken(jacket, 0.7), 1).fillRect(x - 3, y + 4, 7, 1);
    // Pack.
    g.fillStyle(0xe8762a, 1).fillRect(x - 6, y, 3, 5);
    // Arm reaching to the spine ahead.
    g.fillStyle(jacket, 1).fillRect(x + 4, y + 1, 4, 2);
    g.fillStyle(0xf0c8a0, 1).fillRect(x + 8, y + 1, 1, 2);
    // Head, hat.
    g.fillStyle(INK, 1).fillRect(x - 1, y - 6, 6, 6);
    g.fillStyle(0xf0c8a0, 1).fillRect(x, y - 5, 4, 4);
    g.fillStyle(0x3b6ea5, 1).fillRect(x - 1, y - 7, 6, 3);
    // The scarf, streaming back and fluttering.
    for (let i = 0; i < 9; i++) {
      const fl = Math.round(Math.sin(t / 60 - i * 0.8) * (i / 9) * 2);
      g.fillStyle(Math.floor(i / 2) % 2 ? 0xf0e6d0 : 0xc8463b, 1).fillRect(x - 2 - i, y - 1 + fl + Math.round(i * 0.15), 1, 2);
    }
  }

  skip() {
    if (this.done) return;
    this.finish();
  }

  finish() {
    if (this.done) return;
    this.done = true;
    Audio.play('land');
    cloudPass(this.scene, () => { this.parts.forEach((o) => o.destroy()); this.parts = []; }, () => this.opts.onDone());
  }
}
