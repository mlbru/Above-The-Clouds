import { GAME_WIDTH, GAME_HEIGHT, IS_TOUCH } from '../config/gameConfig.js';
import { PixelText, COLORS } from './PixelText.js';
import { Audio } from '../systems/AudioSystem.js';
import { cloudPass } from '../utils/transition.js';
import { lerpColor, darken } from '../utils/color.js';
import { buildDragonTextures } from '../render/dragonArt.js';
import { buildFlyingDragon, FLY } from '../render/flyingDragonArt.js';
import { buildFlightArt, WATERFALLS, FAR_LEDGE, OLD_GATE } from '../render/flightArt.js';

const DEPTH = 8000; // under the cloud wipe (9000), over everything in the run
const FLIGHT_MS = 11500;
const W = GAME_WIDTH, H = GAME_HEIGHT;
const INK = 0x16141f;
const BAR = 22;
const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// The Dragon's Gate, part two: the dragon carries you across the sea of
// clouds to the next mountain. A wide, letterboxed shot, side on, flying
// right: the Spine falls away on the left with the Gate's fires still
// burning; snowy peaks poke through the cloud sea; clouds drift past at
// three depths (the nearest rush by in front); sun rays fan through the sky.
// The dragon (render/flyingDragonArt.js) beats its great wings, its lava
// cracks smoulder, you sit at the base of its neck with your scarf
// streaming. Over the open sea it roars and breathes a plume of fire, then
// glides; the Far Range rises on the right, waterfalls pouring into the
// clouds, a lamp lit on the ledge where it sets you down. Any key skips.
// opts: { meters, jacket, day, farName, onDone }
export class DragonFlight {
  constructor(scene, opts) {
    this.scene = scene;
    this.opts = opts;
    this.t = 0;
    this.done = false;
    this.parts = [];
    buildDragonTextures(scene);
    buildFlyingDragon(scene);
    buildFlightArt(scene);
    const add = (o, d = 0) => { o.setScrollFactor(0).setDepth(DEPTH + d); this.parts.push(o); return o; };
    const day = opts.day || { skyTop: 0x2a3a78, skyBottom: 0xf0b0a0, light: 0xffffff, night: 0 };
    this.night = day.night || 0;
    // Always a golden, late light for the crossing, deepened at night.
    this.skyTop = lerpColor(lerpColor(day.skyTop, 0x2c2a6a, 0.4), 0x0a0c24, this.night * 0.6);
    this.skyBottom = lerpColor(lerpColor(day.skyBottom, 0xffb88a, 0.45), 0x5a4a7a, this.night * 0.6);
    this.light = lerpColor(lerpColor(day.light || 0xffffff, 0xffd8b0, 0.35), 0x8a90c8, this.night * 0.7);
    const haze = (k) => lerpColor(this.light, this.skyBottom, k);

    // Sky: fine bands from the zenith down to a glowing horizon.
    const sky = add(scene.add.graphics(), 0);
    for (let i = 0; i < 48; i++) sky.fillStyle(lerpColor(this.skyTop, this.skyBottom, (i / 47) ** 1.5), 1).fillRect(0, Math.floor((i * H) / 48), W, Math.ceil(H / 48) + 1);
    if (this.night > 0.25) for (let i = 0; i < 120; i++) sky.fillStyle(0xffffff, (0.25 + ((i * 17) % 10) / 14) * (this.night - 0.2)).fillRect(Math.round((i * 89.7) % W), Math.round((i * 41.3) % (H * 0.5)), 1, 1);
    // The sun (or moon) low ahead, with rays fanning out from it.
    this.sunX = W * 0.74; this.sunY = H * 0.42;
    this.rays = add(scene.add.graphics().setBlendMode('ADD'), 0.05);
    const sunG = add(scene.add.graphics().setBlendMode('ADD'), 0.06);
    const sc = this.night < 0.5 ? 0xffc890 : 0xc8d4ff;
    [[70, 0.04], [46, 0.07], [28, 0.12], [16, 0.2]].forEach(([r, a]) => sunG.fillStyle(sc, a).fillCircle(this.sunX, this.sunY, r));
    const disc = add(scene.add.graphics(), 0.07);
    disc.fillStyle(this.night < 0.5 ? 0xfff4dc : 0xf2f0e6, 1).fillCircle(this.sunX, this.sunY, this.night < 0.5 ? 9 : 7);

    // Far: peaks through the sea, small hazy clouds on the horizon.
    this.peaks = [0, 1, 2, 0, 1].map((k, i) => add(scene.add.image(0, 0, `flt_peak_${k}`).setOrigin(0.5, 1).setTint(haze(0.55 - i * 0.04)).setScale(0.7 + (i % 3) * 0.25), 0.1));
    this.peakX = [40, 150, 280, 390, 520];
    this.farClouds = Array.from({ length: 6 }, (_, i) => ({ img: add(scene.add.image(0, 0, `flt_cloud_${i}`).setScale(0.55).setTint(haze(0.45)).setAlpha(0.9), 0.12), x: i * 95, y: H * 0.56 + (i % 3) * 5 }));
    // The two mountains.
    this.oldMtn = add(scene.add.image(0, 0, 'flt_old').setOrigin(0, 0), 0.2);
    this.newMtn = add(scene.add.image(0, 0, 'flt_new').setOrigin(0.5, 0), 0.29);
    this.mtnFx = add(scene.add.graphics(), 0.291);
    this.mtnGlow = add(scene.add.graphics().setBlendMode('ADD'), 0.292);
    // The cloud sea: a far strip and a near one, sliding at their own speeds.
    this.seaFar = add(scene.add.tileSprite(0, 0, W, 70, 'flt_sea_0').setOrigin(0, 0).setTint(haze(0.3)), 0.3);
    this.seaFill = add(scene.add.rectangle(0, 0, W, H, haze(0.2)).setOrigin(0, 0), 0.31);
    this.seaNear = add(scene.add.tileSprite(0, 0, W, 90, 'flt_sea_1').setOrigin(0, 0).setTint(haze(0.12)), 0.32);
    // Mid clouds behind the dragon.
    this.midClouds = Array.from({ length: 4 }, (_, i) => ({ img: add(scene.add.image(0, 0, `flt_cloud_${(i + 2) % 6}`).setTint(haze(0.2)).setAlpha(0.95), 0.25), x: i * 160 + 40, y: H * (0.24 + (i % 2) * 0.26), v: 0.9 + (i % 2) * 0.3 }));
    // A flock of birds far off.
    this.birds = add(scene.add.graphics(), 0.41);

    // The dragon: body sheet (wings and all), its glowing cracks, the head.
    const tint = lerpColor(this.light, 0xffffff, 0.35);
    this.body = add(scene.add.sprite(0, 0, 'fdragon', 0).setOrigin(0, 0).setTint(tint), 1);
    this.bodyGlow = add(scene.add.sprite(0, 0, 'fdragon_glow', 0).setOrigin(0, 0).setBlendMode('ADD').setTint(0xff7a2a), 1.01);
    this.rider = add(scene.add.graphics(), 1.2);
    this.fire = add(scene.add.graphics(), 1.3);
    this.fireGlow = add(scene.add.graphics().setBlendMode('ADD'), 1.31);
    this.flames = [];
    // Near clouds rushing past in front, above and below the dragon.
    this.nearClouds = [0, 1].map((i) => ({ img: add(scene.add.image(0, 0, `flt_cloud_${i * 3 + 1}`).setScale(1.7).setTint(lerpColor(this.light, 0xffffff, 0.4)).setAlpha(0.9), 2), x: W + 160 + i * 380, y: i ? H - 6 : BAR + 4 }));

    // Letterbox and the words.
    this.bars = [0, 1].map((i) => add(scene.add.rectangle(0, i ? H : 0, W, BAR, 0x07060c).setOrigin(0, i ? 1 : 0), 3.5));
    this.ui = add(scene.add.graphics(), 4);
    this.lead = add(new PixelText(scene, W / 2, H - BAR - 46, '', { color: '#ffffff', shadow: '#16141f' }).setOrigin(0.5, 0), 4);
    this.name = add(new PixelText(scene, W / 2, H - BAR - 36, '', { color: '#ffd6a0', shadow: '#16141f' }).setOrigin(0.5, 0).setScale(2), 4);
    this.sub = add(new PixelText(scene, W / 2, H - BAR - 16, '', { color: COLORS.gold, shadow: '#16141f' }).setOrigin(0.5, 0), 4);
    if (!IS_TOUCH) add(new PixelText(scene, W - 8, H - 15, 'ANY KEY: SKIP', { color: '#ffffff', shadow: '#16141f' }).setOrigin(1, 0).setAlpha(0.45), 4);
    add(scene.add.zone(0, 0, W, H).setOrigin(0, 0).setInteractive(), 5).on('pointerdown', () => this.skip());
    this.flash = add(scene.add.rectangle(0, 0, W, H, 0xfff0d0).setOrigin(0, 0), 6);
    scene.tweens.add({ targets: this.flash, alpha: 0, duration: 800 });

    this.caption = -1;
    this.flapT = 0;
    this.lastFrame = -1;
    Audio.swell(26);
    Audio.play('roar');
    this.draw(16);
  }

  get k() { return clamp01(this.t / FLIGHT_MS); }

  update(delta) {
    if (this.done) return;
    this.t += delta;
    const k = this.k;
    const cap = k < 0.24 ? 0 : k < 0.64 ? 1 : 2;
    if (cap !== this.caption) {
      this.caption = cap;
      const [lead, name, sub] = [
        ['YOU CLIMB ONTO ITS NECK AT', "THE DRAGON'S GATE", `${this.opts.meters} M`],
        ['THE DRAGON CARRIES YOU', 'ACROSS THE CLOUD SEA', 'HOLD ON TIGHT'],
        ['A NEW MOUNTAIN RISES', this.opts.farName, 'THE CLIMB GOES ON'],
      ][cap];
      this.lead.setText(lead).setAlpha(0);
      this.name.setText(name).setAlpha(0);
      this.sub.setText(sub).setAlpha(0);
      this.scene.tweens.add({ targets: [this.lead, this.name, this.sub], alpha: 1, duration: 600 });
      this.drawRules();
      if (cap === 2) Audio.play('titlecard');
    }
    if (!this.roared && k > 0.4) { this.roared = true; this.breathT = 0; Audio.play('roar', { volume: 0.8 }); Audio.play('flame'); }
    this.draw(delta);
    if (this.t >= FLIGHT_MS) this.finish();
  }

  drawRules() {
    const u = this.ui.clear();
    const rw = 26, gap = 8, y = H - BAR - 26;
    const nx0 = W / 2 - this.name.displayWidth / 2, nx1 = W / 2 + this.name.displayWidth / 2;
    for (const [x0, cap] of [[nx0 - gap - rw, nx0 - gap - 1], [nx1 + gap, nx1 + gap]]) {
      u.fillStyle(INK, 0.8).fillRect(x0, y + 1, rw, 1);
      u.fillStyle(0xf2c14e, 1).fillRect(x0, y, rw, 1).fillRect(cap, y - 1, 1, 3);
    }
  }

  draw(delta) {
    const t = this.t, k = this.k, f = Math.min(3, delta / 16);
    const seaY = Math.round(H * 0.62);
    // Sun rays turning very slowly.
    const r = this.rays.clear();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + t / 9000, w = 0.05 + (i % 3) * 0.02, len = 260 + (i % 4) * 60;
      r.fillStyle(this.night < 0.5 ? 0xffd8a8 : 0xc8d4ff, 0.05 + (i % 2) * 0.03).fillTriangle(this.sunX, this.sunY, this.sunX + Math.cos(a - w) * len, this.sunY + Math.sin(a - w) * len, this.sunX + Math.cos(a + w) * len, this.sunY + Math.sin(a + w) * len);
    }
    // Peaks and far clouds drift slowly left (we fly right).
    this.peaks.forEach((p, i) => {
      const x = ((this.peakX[i] - t * 0.006 * (1 + (i % 3) * 0.3)) % (W + 160) + W + 160) % (W + 160) - 80;
      p.setPosition(Math.round(x), seaY + 6);
    });
    this.farClouds.forEach((c) => { c.x -= 0.08 * f; if (c.x < -80) c.x += W + 160; c.img.setPosition(Math.round(c.x), Math.round(c.y)); });
    this.drawMountains(seaY, t, k);
    // The cloud sea.
    this.seaFar.setY(seaY - 8).setTilePosition(t * 0.012, 0);
    this.seaNear.setY(seaY + 24).setTilePosition(t * 0.035, 0);
    this.seaFill.setY(seaY + 30);
    this.midClouds.forEach((c) => {
      c.x -= c.v * 0.55 * f;
      if (c.x < -120) { c.x = W + 120; c.y = H * (0.18 + Math.random() * 0.35); }
      c.img.setPosition(Math.round(c.x), Math.round(c.y));
    });
    this.drawBirds(t);
    this.drawDragon(t, k, delta);
    this.nearClouds.forEach((c) => { c.x -= 3.2 * f; if (c.x < -260) c.x = W + 300 + Math.random() * 200; c.img.setPosition(Math.round(c.x), c.y); });
  }

  // The Spine slides away left; the Far Range rises in on the right.
  drawMountains(seaY, t, k) {
    const fx = this.mtnFx.clear(), gl = this.mtnGlow.clear();
    const oldX = Math.round(-20 - k * 260), oldY = seaY - 250;
    this.oldMtn.setPosition(oldX, oldY).setTint(lerpColor(this.light, this.skyBottom, 0.25 + k * 0.5)).setVisible(oldX > -240);
    // The Gate's two fires still burning up there.
    for (const dx of [-8, 10]) {
      const x = oldX + OLD_GATE.x + dx + 1, y = oldY + OLD_GATE.y - 15, fl = 0.6 + 0.4 * Math.sin(t / 70 + dx);
      gl.fillStyle(0xff8a3c, 0.35 * fl).fillCircle(x, y, 5);
      gl.fillStyle(0xffd070, 0.5 * fl).fillCircle(x, y, 2);
    }
    const p = ease(clamp01((k - 0.3) / 0.7));
    if (p <= 0) { this.newMtn.setVisible(false); return; }
    // Far off at first, growing as you near it; its feet stay in the clouds.
    const s = 0.45 + p * 0.27;
    const nx = Math.round(W + 110 - p * (W * 0.26 + 110)), ny = Math.round(seaY + 34 - 320 * s);
    this.newMtn.setVisible(true).setPosition(nx, ny).setScale(s).setTint(lerpColor(this.light, this.skyBottom, 0.55 - p * 0.4));
    // Falling water down the gullies, mist where it meets the clouds.
    const ox = nx - (300 * s) / 2;
    for (const [wx, w0] of WATERFALLS) {
      const x = Math.round(ox + wx * s);
      for (let y = Math.round(ny + w0 * s); y < seaY + 30; y += 1) {
        const on = (Math.floor((y - t / 10) / 3) % 4) !== 0;
        fx.fillStyle(on ? 0xe8f4ff : 0xa8c8e8, 0.85).fillRect(x, y, 1, 1);
      }
      gl.fillStyle(0xffffff, 0.12).fillEllipse(x, seaY + 26, 22, 8);
    }
    // The lamp on the landing ledge.
    const lx = Math.round(ox + (FAR_LEDGE[0] - 8) * s), ly = Math.round(ny + (FAR_LEDGE[1] - 6) * s);
    const lamp = 0.7 + 0.3 * Math.sin(t / 180);
    gl.fillStyle(0xffc870, 0.35 * lamp * p).fillCircle(lx, ly, 7 * s);
    gl.fillStyle(0xffe8b0, 0.6 * lamp * p).fillCircle(lx, ly, 2);
  }

  drawBirds(t) {
    const g = this.birds.clear();
    const bx = ((W + 60 - t * 0.02) % (W + 120) + W + 120) % (W + 120) - 60;
    const col = lerpColor(0x3a3048, this.skyBottom, 0.4);
    for (let i = 0; i < 6; i++) {
      const x = Math.round(bx + Math.ceil(i / 2) * 7), y = Math.round(H * 0.3 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 3);
      const up = Math.floor(t / 180 + i) % 2;
      g.fillStyle(col, 1).fillRect(x, y, 1, 1).fillRect(x - 1, y - up, 1, 1).fillRect(x + 1, y - up, 1, 1);
    }
  }

  drawDragon(t, k, delta) {
    const s = t / 1000;
    const lift = ease(clamp01(k / 0.14));
    const swoop = ease(clamp01((k - 0.82) / 0.18));
    // Flap: a strong beat climbing away from the Gate, a long glide over the
    // middle of the sea, beating again as it nears the Far Range.
    const gliding = k > 0.48 && k < 0.78;
    this.flapT += delta * (gliding ? 0.25 : 1);
    const frame = gliding ? (Math.sin(this.flapT / 500) > 0 ? 2 : 3) : Math.floor(this.flapT / 75) % FLY.frames;
    if (frame !== this.lastFrame && frame === 6 && !gliding) Audio.play('wing');
    this.lastFrame = frame;
    // The whole dragon rises a little on each downbeat.
    const beat = gliding ? Math.sin(s * 1.4) * 2 : Math.sin((frame / FLY.frames) * Math.PI * 2) * 4;
    const x0 = Math.round(W * 0.5 - 236 + Math.sin(s * 0.45) * 8 + swoop * 50);
    const y0 = Math.round(H * 0.46 - 222 + (1 - lift) * 60 + beat + Math.sin(s * 0.7) * 5 + swoop * 28);
    const roaring = this.breathT !== undefined && this.breathT < 1800;
    this.body.setTexture(roaring ? 'fdragon_roar' : 'fdragon', frame).setPosition(x0, y0);
    const heat = 0.55 + 0.3 * Math.sin(s * 3.1) + (roaring ? 0.4 : 0);
    this.bodyGlow.setFrame(frame).setPosition(x0, y0).setAlpha(Math.min(1, heat));
    const meta = FLY.meta[frame] || { saddle: [260, 220], mouth: [400, 180] };
    const hx = x0 + meta.mouth[0], hy = y0 + meta.mouth[1];
    // The rider on its back.
    this.drawRider(x0 + meta.saddle[0], y0 + meta.saddle[1], t);
    // Fire: a plume roaring forward and up out of the jaws, then smoke.
    if (this.breathT !== undefined) {
      this.breathT += delta;
      if (this.breathT < 1600) {
        const mx = hx + 2, my = hy;
        for (let i = 0; i < 4; i++) this.flames.push({ x: mx, y: my, vx: 4.6 + Math.random() * 1.8, vy: -0.5 - Math.random() * 0.9, life: 1, r: 2 + Math.random() * 3 });
      }
    }
    const fg = this.fire.clear(), fgl = this.fireGlow.clear();
    this.flames = this.flames.filter((e) => (e.life -= delta / 750) > 0);
    for (const e of this.flames) {
      e.x += e.vx * (delta / 16); e.y += e.vy * (delta / 16); e.vx *= 0.96; e.vy -= 0.01;
      const rr = Math.max(1, Math.round(e.r * (2.6 - e.life * 1.6)));
      if (e.life > 0.35) {
        const c = e.life > 0.8 ? 0xfff6c8 : e.life > 0.6 ? 0xffc040 : 0xf0601a;
        fgl.fillStyle(c, 0.5 * e.life).fillCircle(e.x, e.y, rr * 1.6);
        fg.fillStyle(c, 1).fillRect(Math.round(e.x - rr / 2), Math.round(e.y - rr / 2), rr, rr);
      } else {
        fg.fillStyle(lerpColor(0x3a2a2a, this.skyBottom, 0.4), e.life * 1.6).fillRect(Math.round(e.x - rr / 2), Math.round(e.y - rr / 2), rr, rr);
      }
    }
  }

  // The climber astride the neck, side on: boots, legs, jacket, pack, one
  // hand on a spine, a bobble hat, and a scarf streaming back in the wind.
  drawRider(x, y, t) {
    const g = this.rider.clear();
    x = Math.round(x); y = Math.round(y);
    const jacket = this.opts.jacket || 0xc8463b, jd = darken(jacket, 0.65), jl = lerpColor(jacket, 0xffffff, 0.3);
    const skin = 0xf0c8a0, pants = 0x2c3448, ink = 0x14101a;
    for (let i = 0; i < 14; i++) {
      const fl = Math.round(Math.sin(t / 55 - i * 0.7) * (i / 14) * 2.5);
      g.fillStyle(ink, 1).fillRect(x - 3 - i, y - 10 + fl + Math.round(i * 0.12), 1, 3);
      g.fillStyle(Math.floor(i / 2) % 2 ? 0xf0e6d0 : 0xc8463b, 1).fillRect(x - 3 - i, y - 9 + fl + Math.round(i * 0.12), 1, 2);
    }
    g.fillStyle(ink, 1).fillRect(x - 8, y - 11, 6, 9);
    g.fillStyle(0xe8762a, 1).fillRect(x - 7, y - 10, 4, 7);
    g.fillStyle(0xffa050, 1).fillRect(x - 7, y - 10, 4, 1);
    g.fillStyle(ink, 1).fillRect(x - 2, y - 3, 7, 5);
    g.fillStyle(pants, 1).fillRect(x - 1, y - 2, 5, 3);
    g.fillStyle(ink, 1).fillRect(x + 3, y + 1, 4, 3);
    g.fillStyle(0x5a3a22, 1).fillRect(x + 4, y + 1, 2, 2);
    g.fillStyle(ink, 1).fillRect(x - 3, y - 12, 8, 10);
    g.fillStyle(jacket, 1).fillRect(x - 2, y - 11, 6, 8);
    g.fillStyle(jl, 1).fillRect(x - 2, y - 11, 6, 1);
    g.fillStyle(jd, 1).fillRect(x - 2, y - 5, 6, 2);
    g.fillStyle(ink, 1).fillRect(x + 3, y - 9, 6, 3);
    g.fillStyle(jacket, 1).fillRect(x + 4, y - 8, 4, 1);
    g.fillStyle(skin, 1).fillRect(x + 8, y - 8, 1, 2);
    g.fillStyle(ink, 1).fillRect(x - 1, y - 18, 7, 7);
    g.fillStyle(skin, 1).fillRect(x, y - 16, 5, 4);
    g.fillStyle(ink, 1).fillRect(x + 4, y - 15, 1, 1);
    g.fillStyle(0x3b6ea5, 1).fillRect(x - 1, y - 19, 7, 3);
    g.fillStyle(0x6a9ad0, 1).fillRect(x, y - 19, 5, 1);
    g.fillStyle(0xf0e6d0, 1).fillRect(x - 2, y - 20, 2, 2);
  }

  skip() {
    if (this.done) return;
    this.finish();
  }

  finish() {
    if (this.done) return;
    this.done = true;
    Audio.play('land');
    cloudPass(this.scene, () => { this.parts.forEach((o) => o.destroy()); this.parts = []; if (this.opts.onLand) this.opts.onLand(); }, () => this.opts.onDone());
  }
}
