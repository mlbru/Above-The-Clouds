import { GAME_WIDTH, GAME_HEIGHT, IS_TOUCH } from '../config/gameConfig.js';
import { PixelText, COLORS } from './PixelText.js';
import { Audio } from '../systems/AudioSystem.js';
import { cloudPass } from '../utils/transition.js';
import { lerpColor, darken, toCss } from '../utils/color.js';

const DEPTH = 8000; // under the cloud wipe (9000), over everything in the run
const RIDE_MS = 3400;
const PUNCH_MS = 450;
const W = GAME_WIDTH, H = GAME_HEIGHT;

// The gondola ride a lift ticket buys: shown while the run waits up at the
// ticket's biome. The cabin hangs from its cable in the middle of the screen
// while clouds, a far ridge and a pylon slide past below; the ticket gets
// punched and the height counts up. Any key or tap skips it. When it ends,
// clouds roll in, the ride is gone behind them, and they open on the climb.
// opts: { biome, ticket, icon, meters, jacket, onDone }
export class LiftRide {
  constructor(scene, opts) {
    this.scene = scene;
    this.opts = opts;
    this.t = 0;
    this.done = false;
    this.parts = [];
    const add = (o) => { o.setScrollFactor(0).setDepth(DEPTH); this.parts.push(o); return o; };
    const b = opts.biome;
    const sky = b.backdrop && b.backdrop.sky ? b.backdrop.sky : { top: 0x4f90e0, bottom: 0xd8f0f0 };
    this.sky = sky;

    // Sky, banded like the backdrops.
    const g = add(scene.add.graphics());
    const bands = 18;
    for (let i = 0; i < bands; i++) g.fillStyle(lerpColor(sky.top, sky.bottom, i / (bands - 1)), 1).fillRect(0, Math.floor((i * H) / bands), W, Math.ceil(H / bands) + 1);
    // Everything that moves is redrawn each frame into these.
    this.far = add(scene.add.graphics());
    this.cloudsBack = add(scene.add.graphics());
    this.rig = add(scene.add.graphics());
    this.cloudsFront = add(scene.add.graphics());
    // The sun, high in the corner, with a pale ring.
    const sun = add(scene.add.graphics());
    sun.fillStyle(0xffffff, 0.18).fillCircle(W - 44, 30, 22);
    sun.fillStyle(0xfff6d8, 1).fillCircle(W - 44, 30, 11);

    // Clouds in two layers; the near ones are bigger and faster.
    this.clouds = Array.from({ length: 16 }, (_, i) => ({
      x: (i * 97.3) % (W + 80) - 40,
      y: (i * 53.9) % (H + 60) - 30,
      r: 6 + (i % 4) * 3 + (i < 3 ? 5 : 0),
      near: i < 3,
    }));

    // The ticket stub, top left, punched a moment in.
    this.stub = add(scene.add.image(26, 22, opts.icon).setScale(3));
    this.hole = add(scene.add.graphics()).setVisible(false);
    this.hole.fillStyle(0x16141f, 1).fillRect(26 + 3, 22 - 6, 4, 4);
    this.punchText = add(new PixelText(scene, 46, 16, 'PUNCHED', { color: COLORS.red, shadow: '#16141f' }).setAlpha(0));
    add(new PixelText(scene, 46, 26, opts.ticket, { color: '#ffffff', shadow: '#16141f' }));

    // Where you are going, and how high.
    const light = toCss(lerpColor(b.accentA, 0xffffff, 0.45));
    add(new PixelText(scene, W / 2, H - 58, 'RIDING THE LIFT UP TO', { color: '#ffffff', shadow: '#16141f' }).setOrigin(0.5, 0));
    add(new PixelText(scene, W / 2, H - 47, b.name, { color: light, shadow: '#16141f' }).setOrigin(0.5, 0).setScale(2));
    this.height = add(new PixelText(scene, W / 2, H - 27, '0 M', { color: '#ffffff', shadow: '#16141f' }).setOrigin(0.5, 0));
    if (!IS_TOUCH) add(new PixelText(scene, W - 8, H - 12, 'ANY KEY: SKIP', { color: '#ffffff', shadow: '#16141f' }).setOrigin(1, 0).setAlpha(0.6));
    add(scene.add.zone(0, 0, W, H).setOrigin(0, 0).setInteractive()).on('pointerdown', () => this.skip());

    Audio.swell(24);
    Audio.play('cloth');
    this.draw();
  }

  // The cable climbs from bottom left to top right through the middle.
  cableY(x) { return H * 0.36 - (x - W / 2) * 0.42; }

  update(delta) {
    if (this.done) return;
    const before = this.t;
    this.t += delta;
    if (before < PUNCH_MS && this.t >= PUNCH_MS) {
      this.hole.setVisible(true);
      this.punchText.setAlpha(1);
      this.stub.setScale(3.4);
      Audio.play('tick');
      Audio.play('checkpoint');
    }
    if (this.stub.scale > 3) this.stub.setScale(Math.max(3, this.stub.scale - delta / 400));
    // Each cloud passing the cabin gives a soft whoosh of wind.
    if (Math.floor(before / 900) !== Math.floor(this.t / 900)) Audio.play('cloth');
    const k = Math.min(1, this.t / (RIDE_MS - 400));
    const eased = 1 - (1 - k) ** 3;
    this.height.setText(`${Math.round(eased * this.opts.meters)} M`);
    this.draw();
    if (this.t >= RIDE_MS) this.finish();
  }

  draw() {
    const t = this.t;
    const b = this.opts.biome;
    // A far ridge in the biome's rock, sinking away as you rise.
    const far = this.far.clear();
    const ridge = lerpColor(darken(b.accentA, 0.7), this.sky.bottom, 0.45);
    const base = H * 0.78 + t * 0.03;
    for (let x = 0; x < W; x += 2) {
      const y = base - 26 - Math.abs(Math.sin(x * 0.021)) * 22 - Math.sin(x * 0.067) * 6;
      far.fillStyle(ridge, 1).fillRect(x, Math.round(y), 2, H - Math.round(y));
    }
    // Clouds drift down past the cabin (you are going up).
    const back = this.cloudsBack.clear(), front = this.cloudsFront.clear();
    for (const c of this.clouds) {
      const speed = c.near ? 0.07 : 0.03;
      const y = ((c.y + t * speed + 40) % (H + 80)) - 40;
      const x = c.x - t * speed * 0.5;
      const xx = ((x + 60) % (W + 120) + (W + 120)) % (W + 120) - 60;
      const g = c.near ? front : back;
      const a = c.near ? 0.85 : 0.7;
      g.fillStyle(lerpColor(0xffffff, this.sky.top, 0.18), a).fillEllipse(xx + 2, y + c.r * 0.35, c.r * 3.2, c.r * 1.2);
      g.fillStyle(0xffffff, a).fillCircle(xx - c.r * 0.6, y, c.r * 0.8).fillCircle(xx + c.r * 0.5, y - c.r * 0.2, c.r).fillCircle(xx + c.r * 1.3, y + c.r * 0.2, c.r * 0.6);
    }
    // The cable, rollers sliding down it, a pylon passing, and the cabin.
    const r = this.rig.clear();
    for (let x = -10; x < W + 10; x++) {
      const y = Math.round(this.cableY(x));
      r.fillStyle(0x2a2440, 1).fillRect(x, y, 1, 1);
      r.fillStyle(0x6a6480, 1).fillRect(x, y + 1, 1, 1);
    }
    for (let k = 0; k < 8; k++) {
      const x = ((k * 70 - t * 0.09) % (W + 70) + (W + 70)) % (W + 70) - 35;
      r.fillStyle(0x16141f, 1).fillRect(Math.round(x) - 1, Math.round(this.cableY(x)) - 1, 3, 2);
    }
    const px = W + 60 - ((t * 0.11) % (W + 160));
    const py = this.cableY(px);
    r.fillStyle(0x3a3550, 1).fillRect(Math.round(px) - 2, Math.round(py), 4, H);
    r.fillStyle(0x3a3550, 1).fillRect(Math.round(px) - 9, Math.round(py) - 2, 18, 3);
    for (let y = py + 10; y < H; y += 10) r.fillStyle(0x2a2440, 1).fillRect(Math.round(px) - 4, Math.round(y), 8, 1);
    // The cabin sways a little on its arm.
    const cx = W / 2, cy = this.cableY(cx);
    const sway = Math.round(Math.sin(t / 420) * 2);
    r.fillStyle(0x2a2440, 1).fillRect(cx - 4, Math.round(cy) - 2, 9, 3);
    r.fillStyle(0x3a3550, 1).fillRect(cx, Math.round(cy), 1, 14);
    r.fillRect(cx + Math.round(sway / 2), Math.round(cy) + 6, 1, 8);
    const bx = cx - 18 + sway, by = Math.round(cy) + 14;
    r.fillStyle(0x16141f, 1).fillRect(bx - 1, by - 1, 38, 30);
    r.fillStyle(0xc8463b, 1).fillRect(bx, by, 36, 28);
    r.fillStyle(0xe06a50, 1).fillRect(bx, by, 36, 3);
    r.fillStyle(0x8a2a24, 1).fillRect(bx, by + 24, 36, 4);
    // Windows, and you inside, looking out.
    r.fillStyle(0x16141f, 1).fillRect(bx + 3, by + 5, 30, 14);
    r.fillStyle(lerpColor(this.sky.bottom, 0xffffff, 0.4), 1).fillRect(bx + 4, by + 6, 13, 12).fillRect(bx + 19, by + 6, 13, 12);
    r.fillStyle(0xffffff, 0.6).fillRect(bx + 5, by + 7, 4, 1).fillRect(bx + 20, by + 7, 4, 1);
    const hx = bx + 22;
    r.fillStyle(this.opts.jacket, 1).fillRect(hx, by + 13, 8, 5);
    r.fillStyle(0xf0c8a0, 1).fillRect(hx + 2, by + 9, 4, 4);
    r.fillStyle(0x16141f, 1).fillRect(hx + 5, by + 10, 1, 1);
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
    cloudPass(this.scene, () => this.parts.forEach((o) => o.destroy()), () => this.opts.onDone());
  }
}
