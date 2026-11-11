import { GAME_WIDTH, GAME_HEIGHT, IS_TOUCH } from '../config/gameConfig.js';
import { PixelText, COLORS } from './PixelText.js';
import { Audio } from '../systems/AudioSystem.js';
import { cloudPass } from '../utils/transition.js';
import { lerpColor, darken, toCss } from '../utils/color.js';
import { makeNoise2D } from '../utils/seededRandom.js';

const DEPTH = 8000; // under the cloud wipe (9000), over everything in the run
const RIDE_MS = 5600;
const PUNCH_MS = 800;
const SPEED = 0.12; // px of cable per ms at full speed
const W = GAME_WIDTH, H = GAME_HEIGHT;
const INK = 0x16141f;
const RANGES = [
  { key: 'bg_summits', y: 0.5, f: 0.02, haze: 0.5 },
  { key: 'bg_far', y: 0.62, f: 0.045, haze: 0.33 },
  { key: 'bg_mid', y: 0.76, f: 0.09, haze: 0.16 },
];

// How fast the cabin moves at time t: it pulls away gently from the bottom
// station and eases in to the top one.
const speedAt = (t) => Math.max(0, Math.min(1, t / 900, (RIDE_MS - 250 - t) / 1300));

// The gondola ride a lift ticket buys, shown while the run waits up at the
// ticket's biome. The cabin hangs from its cable in the middle of the screen:
// it leaves the bottom station, the hills and ranges sink away under it, the
// mountain's own face slides past on the right, a pylon clatters by, clouds
// stream past in front, and the top station swings in at the end. The sky is
// the sky of the hour (stars and a lit cabin window at night). The ticket gets
// punched and the height counts up. Any key or tap skips it.
// opts: { biome, ticket, icon, meters, jacket, day, onDone }
export class LiftRide {
  constructor(scene, opts) {
    this.scene = scene;
    this.opts = opts;
    this.t = 0;
    this.dist = 0;
    this.done = false;
    this.bump = 0;
    this.parts = [];
    const add = (o) => { o.setScrollFactor(0).setDepth(DEPTH); this.parts.push(o); return o; };
    const b = opts.biome;
    const day = opts.day || { skyTop: 0x4f90e0, skyBottom: 0xd8f0f0, light: 0xffffff, night: 0 };
    this.day = day;
    this.night = day.night || 0;
    const bs = b.backdrop && b.backdrop.sky ? b.backdrop.sky : null;
    this.skyTop = bs ? lerpColor(day.skyTop, bs.top, 0.3 * (1 - this.night)) : day.skyTop;
    this.skyBottom = bs ? lerpColor(day.skyBottom, bs.bottom, 0.3 * (1 - this.night)) : day.skyBottom;
    this.light = day.light || 0xffffff;
    this.noise = makeNoise2D(4711);
    // Total cable travelled, to place the top station where the ride ends.
    let total = 0;
    for (let t = 0; t < RIDE_MS; t += 16) total += speedAt(t) * 16 * SPEED;
    this.total = total;

    // Sky, banded.
    const g = add(scene.add.graphics());
    const bands = 24;
    for (let i = 0; i < bands; i++) g.fillStyle(lerpColor(this.skyTop, this.skyBottom, (i / (bands - 1)) ** 1.3), 1).fillRect(0, Math.floor((i * H) / bands), W, Math.ceil(H / bands) + 1);
    // Stars at night.
    if (this.night > 0.3) {
      for (let i = 0; i < 90; i++) {
        const x = (i * 97.13) % W, y = (i * 53.71) % (H * 0.6);
        g.fillStyle(i % 7 ? 0xffffff : 0xc8d4ff, (0.3 + ((i * 13) % 10) / 14) * (this.night - 0.3) * 1.4).fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    }
    // The sun or the moon where it really is in the sky right now, with a halo.
    this.bodyG = add(scene.add.graphics().setBlendMode('ADD'));
    const body = day.sun || day.moon;
    if (body) {
      const x = Math.round(body.x * (W / 480)), y = Math.round(Math.min(body.y, H * 0.55));
      const sun = !!day.sun;
      const c = sun ? lerpColor(0xfff2c8, 0xffa050, Math.max(0, 1 - (day.sun.h || 0.5) / 0.4)) : 0xc8d4ff;
      [[34, 0.05], [22, 0.09], [14, 0.16]].forEach(([r, a]) => this.bodyG.fillStyle(c, a).fillCircle(x, y, r));
      const disc = add(scene.add.graphics());
      disc.fillStyle(sun ? lerpColor(0xfff6d8, c, 0.4) : 0xf2f0e6, 1).fillCircle(x, y, sun ? 8 : 6);
      if (!sun) disc.fillStyle(0xc4c6cc, 1).fillRect(x - 2, y - 1, 2, 2).fillRect(x + 1, y + 2, 1, 1);
    }
    // The ranges of the world below, sinking away as you rise.
    this.ranges = RANGES.filter((r) => scene.textures.exists(r.key)).map((r) => {
      const h = scene.textures.get(r.key).getSourceImage().height;
      const img = add(scene.add.tileSprite(0, 0, W, h, r.key).setOrigin(0, 0));
      img.setTint(lerpColor(this.light, this.skyBottom, r.haze));
      const fill = add(scene.add.rectangle(0, 0, W, H, lerpColor(darken(this.light, 0.55), this.skyBottom, r.haze)).setOrigin(0, 0));
      return { ...r, img, fill, h };
    });
    // Clouds: a far layer behind the rig, a near one in front of it.
    const cloudTint = lerpColor(lerpColor(this.light, 0xffffff, 0.35), this.skyBottom, 0.15);
    this.clouds = Array.from({ length: 11 }, (_, i) => {
      const near = i < 4;
      const img = add(scene.add.image(0, 0, `cloud${i % 4}`).setScale(near ? 3 + (i % 2) : 1.4 + (i % 3) * 0.4));
      img.setTint(near ? cloudTint : lerpColor(cloudTint, this.skyBottom, 0.35)).setAlpha(near ? 0.9 : 0.8);
      return { img, near, x: (i * 131.7) % (W + 160) - 80, y: (i * 67.3) % (H + 120) - 60, v: near ? 1.8 : 0.5 + (i % 3) * 0.15 };
    });
    this.cliff = add(scene.add.graphics());
    this.rig = add(scene.add.graphics());
    this.cabin = add(scene.add.graphics());
    this.glowG = add(scene.add.graphics().setBlendMode('ADD'));
    this.clouds.filter((c) => c.near).forEach((c) => c.img.setDepth(DEPTH + 0.5));
    this.ui = add(scene.add.graphics()).setDepth(DEPTH + 1);

    // The ticket stub, top left, punched a moment in.
    const ui = (o) => add(o).setDepth(DEPTH + 1);
    this.stub = ui(scene.add.image(26, 22, opts.icon).setScale(3));
    this.hole = ui(scene.add.graphics()).setVisible(false);
    this.hole.fillStyle(INK, 1).fillRect(26 + 3, 22 - 6, 4, 4);
    this.punchText = ui(new PixelText(scene, 46, 16, 'PUNCHED', { color: COLORS.red, shadow: '#16141f' }).setAlpha(0));
    ui(new PixelText(scene, 46, 26, opts.ticket, { color: '#ffffff', shadow: '#16141f' }));

    // Where you are going, and how high: the name between two gold rules.
    const light = toCss(lerpColor(b.accentA, 0xffffff, 0.5));
    this.lead = ui(new PixelText(scene, W / 2, H - 60, 'RIDING THE LIFT UP TO', { color: '#ffffff', shadow: '#16141f' }).setOrigin(0.5, 0));
    this.name = ui(new PixelText(scene, W / 2, H - 49, b.name, { color: light, shadow: '#16141f' }).setOrigin(0.5, 0).setScale(2));
    this.height = ui(new PixelText(scene, W / 2, H - 27, '0 M', { color: COLORS.gold, shadow: '#16141f' }).setOrigin(0.5, 0));
    const rw = 22, gap = 8, nx0 = W / 2 - this.name.displayWidth / 2, nx1 = W / 2 + this.name.displayWidth / 2;
    for (const [x0, cap] of [[nx0 - gap - rw, nx0 - gap - 1], [nx1 + gap, nx1 + gap]]) {
      this.ui.fillStyle(INK, 0.8).fillRect(x0, H - 41, rw, 1);
      this.ui.fillStyle(0xf2c14e, 1).fillRect(x0, H - 42, rw, 1).fillRect(cap, H - 43, 1, 3);
    }
    if (!IS_TOUCH) ui(new PixelText(scene, W - 8, H - 12, 'ANY KEY: SKIP', { color: '#ffffff', shadow: '#16141f' }).setOrigin(1, 0).setAlpha(0.6));
    ui(scene.add.zone(0, 0, W, H).setOrigin(0, 0).setInteractive()).on('pointerdown', () => this.skip());

    // Pylons along the way; the bottom station is right behind the cabin.
    this.cx = Math.round(W * 0.44);
    this.pylons = [];
    for (let u = 150; u < total - 90; u += 230) this.pylons.push({ u, passed: false });

    Audio.swell(24);
    Audio.play('creak');
    Audio.startHum();
    this.draw();
  }

  // The cable climbs from bottom left to top right.
  cableY(x) { return H * 0.34 - (x - W / 2) * 0.4; }
  // A point on the cable, u px along it from the cabin (scrolled by the ride).
  at(u0) { const x = this.cx + u0 - this.dist; return { x, y: this.cableY(x) }; }

  update(delta) {
    if (this.done) return;
    const before = this.t;
    this.t += delta;
    this.dist += speedAt(this.t) * delta * SPEED;
    if (before < PUNCH_MS && this.t >= PUNCH_MS) {
      this.hole.setVisible(true);
      this.punchText.setAlpha(1);
      this.stub.setScale(3.5);
      Audio.play('tick');
      Audio.play('checkpoint');
      // A little confetti of punched card.
      for (let i = 0; i < 6; i++) {
        const p = this.scene.add.rectangle(31, 18, 1, 1, i % 2 ? 0xf4efe4 : 0xf2c14e).setScrollFactor(0).setDepth(DEPTH + 2);
        this.parts.push(p);
        this.scene.tweens.add({ targets: p, x: 31 + (Math.random() - 0.5) * 30, y: 18 + 10 + Math.random() * 24, alpha: 0, duration: 600 + Math.random() * 300, ease: 'Quad.easeOut' });
      }
    }
    if (this.stub.scale > 3) this.stub.setScale(Math.max(3, this.stub.scale - delta / 400));
    // Rolling over a pylon's wheels: a clatter and a bounce.
    for (const p of this.pylons) {
      if (!p.passed && this.dist >= p.u) { p.passed = true; this.bump = 1; Audio.play('clack'); Audio.play('creak'); }
    }
    if (Math.floor(before / 1100) !== Math.floor(this.t / 1100) && speedAt(this.t) > 0.5) Audio.play('cloth');
    this.bump = Math.max(0, this.bump - delta / 600);
    const k = Math.min(1, this.dist / this.total);
    this.height.setText(`${Math.round(k * this.opts.meters)} M`);
    if (this.t > RIDE_MS - 900 && !this.arrived) { this.arrived = true; this.lead.setText('ARRIVING AT'); }
    this.draw(delta);
    if (this.t >= RIDE_MS) this.finish();
  }

  draw(delta = 16) {
    const t = this.t, d = this.dist;
    this.glowG.clear();
    const f = delta / 16;
    // The ranges sink as the climb goes on; each slides sideways at its own pace.
    for (const r of this.ranges) {
      const y = Math.round(H * r.y + d * r.f * 6);
      r.img.setY(y).setTilePosition(d * r.f * 3, 0);
      r.fill.setY(y + r.h).setVisible(y + r.h < H);
    }
    // Clouds drift down and back past the cabin (you are going up and along).
    for (const c of this.clouds) {
      const sp = speedAt(t) * 0.35 + 0.05;
      c.y += c.v * sp * 0.9 * f;
      c.x -= (c.v * sp * 0.55 + 0.02) * f;
      if (c.y > H + 60) { c.y = -60; c.x = Math.random() * (W + 120) - 60; }
      if (c.x < -120) c.x = W + 120;
      c.img.setPosition(Math.round(c.x), Math.round(c.y));
    }
    this.drawCliff(d);
    this.drawRig(d, t);
    this.drawCabin(t);
  }

  // The mountain's own face on the right, in the colours of the biome you are
  // riding up to: a ragged edge lit by the sky, rock strata, snow or moss.
  drawCliff(d) {
    const g = this.cliff.clear();
    const rock = this.opts.biome.rock;
    const acc = this.opts.biome.accentB;
    const snowy = this.opts.biome.weather && this.opts.biome.weather.snow > 0.3;
    const shade = (c) => lerpColor(c, this.skyBottom, 0.12);
    for (let y = 0; y < H; y += 2) {
      const wy = y - d * 0.9;
      const e = Math.round(W - 58 - this.noise(0.5, wy * 0.018) * 34 - this.noise(3.1, wy * 0.07) * 8);
      g.fillStyle(shade(rock[1]), 1).fillRect(e, y, W - e, 2);
      g.fillStyle(shade(rock[2]), 1).fillRect(e + 6, y, W - e - 6, 2);
      if (this.noise(e * 0.05, wy * 0.05) > 0.62) g.fillStyle(shade(rock[3]), 1).fillRect(e + 10, y, 14, 2);
      g.fillStyle(shade(rock[4]), 1).fillRect(e, y, 2, 2);
      g.fillStyle(rock[0], 1).fillRect(e - 1, y, 1, 2);
      // Strata, and a fringe of snow or green along the ledges they make.
      if (((Math.round(wy) % 46) + 46) % 46 < 2) {
        g.fillStyle(rock[0], 1).fillRect(e + 3, y, W - e, 1);
        g.fillStyle(snowy ? 0xf2f6ff : acc, 1).fillRect(e - 2, y - 1, 16 + Math.round(this.noise(wy, 1) * 20), 1);
      }
    }
  }

  drawRig(d, t) {
    const r = this.rig.clear();
    const metal = lerpColor(0x3a3550, this.skyBottom, 0.1), dark = 0x221e30, lit = lerpColor(0x6a6480, this.light, 0.3);
    // Bottom station, behind the cabin at the start: a stone base, a timber
    // hut with a red roof, and the big bullwheel turning the cable round.
    this.drawStation(r, this.at(0), false, t);
    // Top station, swinging in at the end of the ride.
    this.drawStation(r, this.at(this.total), true, t);
    // The cables: the track rope and, just under it, the haul rope.
    for (let x = -10; x < W + 10; x += 1) {
      const y = Math.round(this.cableY(x));
      r.fillStyle(dark, 1).fillRect(x, y, 1, 1);
      r.fillStyle(lit, 1).fillRect(x, y + 1, 1, 1);
      r.fillStyle(dark, 1).fillRect(x, y + 5, 1, 1);
    }
    // Rollers riding the haul rope give the speed away.
    for (let k = 0; k < 9; k++) {
      const x = ((k * 64 - d * 1.6) % (W + 64) + (W + 64)) % (W + 64) - 32;
      r.fillStyle(INK, 1).fillRect(Math.round(x) - 1, Math.round(this.cableY(x)) + 4, 3, 3);
    }
    // Lattice pylons, each with a wheel train where the rope runs over it.
    for (const p of this.pylons) {
      const { x, y } = this.at(p.u);
      if (x < -30 || x > W + 30) continue;
      const px = Math.round(x), py = Math.round(y);
      for (let yy = py + 6; yy < H; yy += 1) {
        const spread = Math.round(3 + (yy - py) * 0.06);
        r.fillStyle(metal, 1).fillRect(px - spread, yy, 2, 1).fillRect(px + spread - 1, yy, 2, 1);
        if ((yy - py) % 9 === 0) r.fillStyle(dark, 1).fillRect(px - spread, yy, spread * 2, 1);
        // X bracing between the cross bars.
        const ph = ((yy - py) % 9) / 9;
        r.fillStyle(metal, 1).fillRect(Math.round(px - spread + ph * spread * 2), yy, 1, 1).fillRect(Math.round(px + spread - ph * spread * 2), yy, 1, 1);
      }
      r.fillStyle(metal, 1).fillRect(px - 12, py + 3, 24, 3);
      r.fillStyle(lit, 1).fillRect(px - 12, py + 3, 24, 1);
      for (let w = -9; w <= 9; w += 6) {
        const wy = Math.round(this.cableY(px + w));
        r.fillStyle(INK, 1).fillCircle(px + w, wy + 2, 2);
        const spin = Math.floor(d / 4) % 2;
        r.fillStyle(lit, 1).fillRect(px + w - (spin ? 1 : 0), wy + 1 + (spin ? 1 : 0), 1, 1);
      }
      // A red warning lamp on top, blinking at night.
      if (this.night > 0.3 && Math.floor(t / 500) % 2) this.glowG.fillStyle(0xff4a3a, 0.5).fillCircle(px, py - 2, 3);
      r.fillStyle(this.night > 0.3 ? 0xff6a5a : 0xc8463b, 1).fillRect(px, py - 2, 1, 1);
    }
  }

  // A lift station: a timber house on a stone footing with a tall open bay
  // the cabin docks into (warm-lit at night), the bullwheel turning under the
  // roof where the rope comes round, and a flag on the top one.
  drawStation(r, { x, y }, top, t) {
    if (x < -90 || x > W + 90) return;
    const cx = Math.round(x), cy = Math.round(y);
    const stone = lerpColor(0x6a6478, this.light, 0.25), stoneD = 0x3a3548, wood = lerpColor(0x8a5a34, this.light, 0.2), woodD = 0x5a3a20;
    const roof = top ? lerpColor(this.opts.biome.accentA, 0x6a3a2a, 0.3) : 0xb0403a;
    const y0 = cy - 12, y1 = cy + 60;
    // Stone footing down to the bottom of the screen.
    r.fillStyle(stoneD, 1).fillRect(cx - 34, y1, 68, H);
    r.fillStyle(stone, 1).fillRect(cx - 32, y1, 64, H);
    for (let yy = y1 + 6; yy < H; yy += 8) {
      const o = (Math.floor((yy - y1) / 8) % 2) * 8;
      r.fillStyle(stoneD, 1).fillRect(cx - 32, yy, 64, 1);
      for (let xx = cx - 32 + o; xx < cx + 32; xx += 16) r.fillRect(xx, yy, 1, 8);
    }
    // The timber house.
    r.fillStyle(INK, 1).fillRect(cx - 31, y0, 62, y1 - y0);
    r.fillStyle(wood, 1).fillRect(cx - 30, y0 + 1, 60, y1 - y0 - 1);
    for (let xx = cx - 30; xx < cx + 30; xx += 5) r.fillStyle(woodD, 1).fillRect(xx, y0 + 1, 1, y1 - y0 - 1);
    // The bay: dark inside by day, lamplit by night, with a lit sill.
    const night = this.night > 0.3;
    r.fillStyle(INK, 1).fillRect(cx - 26, cy + 10, 52, y1 - cy - 12);
    r.fillStyle(night ? 0xc88a40 : 0x231c2c, 1).fillRect(cx - 25, cy + 11, 50, y1 - cy - 14);
    if (night) {
      r.fillStyle(0xffd27a, 1).fillRect(cx - 25, cy + 11, 50, 2);
      this.glowG.fillStyle(0xffb050, 0.16).fillCircle(cx, cy + 34, 40);
    }
    r.fillStyle(lerpColor(woodD, 0xffffff, 0.2), 1).fillRect(cx - 28, y1 - 3, 56, 2);
    // The roof.
    for (let i = 0; i < 12; i++) r.fillStyle(i === 0 ? INK : lerpColor(roof, 0xffffff, i === 1 ? 0.25 : 0), 1).fillRect(cx - 37 + i, y0 - 1 - i, 74 - i * 2, 1);
    // The bullwheel up under the roof, turning.
    const wx = cx, wy = cy - 2;
    r.fillStyle(INK, 1).fillCircle(wx, wy, 8);
    r.fillStyle(0x8a8498, 1).fillCircle(wx, wy, 7);
    r.fillStyle(0x4a4458, 1).fillCircle(wx, wy, 5);
    const a = (t / 260) * (top ? 1 : -1);
    for (let k = 0; k < 4; k++) r.fillStyle(0xd8d4e0, 1).fillRect(Math.round(wx + Math.cos(a + (k * Math.PI) / 2) * 5), Math.round(wy + Math.sin(a + (k * Math.PI) / 2) * 5), 1, 1);
    // A flag on the top station in the biome's colour.
    if (top) {
      r.fillStyle(INK, 1).fillRect(cx + 26, y0 - 26, 1, 16);
      const f = Math.round(Math.sin(t / 160) * 1.5);
      r.fillStyle(this.opts.biome.accentC, 1).fillRect(cx + 27, y0 - 26, 8, 4).fillRect(cx + 35, y0 - 25 + f, 2, 3);
    }
  }

  // The cabin hangs from its grip arm, swaying, bouncing over the pylons.
  drawCabin(t) {
    const r = this.cabin.clear();
    const gl = this.glowG;
    const cx = this.cx, cy = Math.round(this.cableY(cx));
    const sp = speedAt(t);
    const sway = Math.round(Math.sin(t / 470) * (1 + sp) + this.bump * Math.sin(t / 45) * 2);
    const bounce = Math.round(this.bump * 2 * Math.abs(Math.sin(t / 60)));
    // Grip on the rope and the hanger arm.
    r.fillStyle(INK, 1).fillRect(cx - 5, cy - 2, 11, 4);
    r.fillStyle(0x8a8498, 1).fillRect(cx - 4, cy - 1, 9, 2);
    r.fillStyle(0x4a4458, 1).fillRect(cx, cy + 2, 2, 8 + bounce);
    r.fillRect(cx + Math.round(sway / 2), cy + 10 + bounce, 2, 7);
    const bx = cx - 20 + sway, by = cy + 17 + bounce, bw = 42, bh = 34;
    // Body: outline, rounded roof, red paint with a highlight and a dark skirt.
    r.fillStyle(INK, 1).fillRect(bx - 1, by + 1, bw + 2, bh).fillRect(bx + 2, by - 1, bw - 4, 2);
    r.fillStyle(0x4a4458, 1).fillRect(bx + 8, by - 3, bw - 16, 3);
    r.fillStyle(0xc8463b, 1).fillRect(bx, by + 1, bw, bh - 2).fillRect(bx + 2, by, bw - 4, 1);
    r.fillStyle(0xe8745a, 1).fillRect(bx + 2, by + 1, bw - 4, 2);
    r.fillStyle(0x8a2a24, 1).fillRect(bx, by + bh - 7, bw, 6);
    r.fillStyle(0xf2c14e, 1).fillRect(bx, by + bh - 9, bw, 1);
    // Windows: glass reflecting the sky, with a glare that slides across.
    const night = this.night > 0.35;
    const glass = night ? 0xffd890 : lerpColor(this.skyBottom, 0xffffff, 0.35);
    const glassD = night ? 0xe8a850 : lerpColor(this.skyTop, this.skyBottom, 0.5);
    r.fillStyle(INK, 1).fillRect(bx + 3, by + 5, bw - 6, 15);
    for (const wx0 of [bx + 4, bx + 4 + 12, bx + 4 + 24]) {
      for (let j = 0; j < 13; j++) r.fillStyle(lerpColor(glass, glassD, j / 12), 1).fillRect(wx0, by + 6 + j, 11, 1);
    }
    // The climber looking out of the middle window (back lit at night).
    const hx = bx + 18;
    r.fillStyle(night ? 0x3a2a30 : this.opts.jacket, 1).fillRect(hx, by + 14, 9, 5);
    r.fillStyle(night ? 0x5a4040 : 0xf0c8a0, 1).fillRect(hx + 2, by + 9, 5, 5);
    r.fillStyle(night ? 0x2a1e24 : 0x6a3a24, 1).fillRect(hx + 2, by + 8, 5, 2);
    if (!night) r.fillStyle(INK, 1).fillRect(hx + 6, by + 11, 1, 1);
    // Glare.
    const gx = ((t / 18) % 90) - 20;
    for (let j = 0; j < 13; j++) {
      const x = Math.round(bx + 4 + gx - j * 0.6);
      if (x > bx + 3 && x < bx + bw - 6) r.fillStyle(0xffffff, night ? 0.15 : 0.45).fillRect(x, by + 6 + j, 2, 1);
    }
    for (const wx0 of [bx + 15, bx + 27]) r.fillStyle(INK, 1).fillRect(wx0, by + 5, 1, 15);
    // Door seam, the cabin number, and a lamp glow at night.
    r.fillStyle(0x8a2a24, 1).fillRect(bx + bw - 5, by + 21, 1, 6);
    r.fillStyle(0xf4efe4, 1).fillRect(bx + 4, by + 22, 5, 4);
    r.fillStyle(INK, 1).fillRect(bx + 5, by + 23, 3, 1).fillRect(bx + 7, by + 24, 1, 1);
    if (night) [[30, 0.08], [20, 0.12]].forEach(([rr, a]) => gl.fillStyle(0xffb050, a).fillCircle(bx + bw / 2, by + 12, rr));
  }

  skip() {
    if (this.done) return;
    this.t = Math.max(this.t, PUNCH_MS);
    this.height.setText(`${this.opts.meters} M`);
    this.finish();
  }

  finish() {
    if (this.done) return;
    this.done = true;
    Audio.stopHum();
    Audio.play('clack');
    cloudPass(this.scene, () => this.parts.forEach((o) => o.destroy()), () => this.opts.onDone());
  }
}
