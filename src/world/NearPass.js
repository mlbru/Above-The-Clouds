// Things right in front of the camera (idea sheet 2.10): every half a minute
// or so something passes between you and the climber, big, close and quick,
// in the colours of the biome: a crane on the lower slopes, a bank of cloud
// that washes over the view above the clouds, a gust of fat snowflakes in
// the cold, a ribbon of bees in the Amber Hive, bats in the Obsidian Spires,
// crystal dust, steam in the Bastion, embers drifting down near the dragon.
// They keep to the top two thirds of the screen, so the note track stays clear.
import { DEPTH, GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';
import { lerpColor } from '../utils/color.js';

const W = GAME_WIDTH, H = GAME_HEIGHT;
const KIND = {
  green: ['crane', 'leaves'], stone: ['crane'], frozen: ['snow'], clouds: ['cloud', 'crane'], hive: ['bees'],
  obsidian: ['bats'], crystal: ['shards', 'cloud'], clockwork: ['steam'], storm: ['cloud'], aurora: ['snow', 'cloud'],
  bones: ['embers'], dragon: ['embers'], volcano: ['embers'], sky: ['cloud'],
  cascade: ['spray', 'crane'], monastery: ['lanterns', 'petals'], moss: ['spores', 'leaves'],
};
const rnd = (a, b) => a + Math.random() * (b - a);

export class NearPass {
  constructor(scene) {
    this.scene = scene;
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.foreground + 8);
    this.add = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.foreground + 8.5).setBlendMode('ADD');
    this.clouds = [];
    this.wait = rnd(12000, 25000);
    this.cur = null;
  }

  // biome: the biome id at the climber; day: { night, light }; busy: true while
  // something else owns the screen (a panorama, the flight).
  update(dt, biome, day, reduced = false, busy = false) {
    const g = this.g.clear(), a = this.add.clear();
    if (!this.cur) {
      if (reduced || busy) return;
      this.wait -= dt;
      if (this.wait > 0) return;
      this.wait = rnd(28000, 65000);
      const kinds = (KIND[biome] || []).filter((k) => !(k === 'crane' && day.night > 0.5) && !(k === 'bats' && day.night < 0.3 && biome !== 'obsidian'));
      if (!kinds.length) return;
      this.start(kinds[Math.floor(Math.random() * kinds.length)], day);
    }
    const c = this.cur;
    c.t += dt;
    const k = c.t / c.ms;
    if (k >= 1) { this.end(); return; }
    this[c.kind](g, a, c, k, dt, day);
  }

  start(kind, day) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const c = { kind, dir, t: 0, ms: 2200, y: rnd(H * 0.22, H * 0.5), light: day.light || 0xffffff, night: day.night || 0 };
    if (kind === 'crane') {
      // The game's own bird, blown up huge: chunky because it is so close.
      c.ms = 2000;
      this.sprite = this.scene.add.sprite(0, 0, 'bird', 0).setScrollFactor(0).setDepth(DEPTH.foreground + 8.1)
        .setScale(13).setFlipX(dir < 0).setTint(lerpColor(0x2a2a36, c.light, 0.18));
    }
    if (kind === 'cloud') {
      c.ms = 2600;
      // A bank of near cloud: a few huge puffs that wash over the whole view.
      this.clouds = [0, 1, 2, 3].map((i) => this.scene.add.image(0, 0, `cloud${i % 4}`).setScrollFactor(0).setDepth(DEPTH.foreground + 8.2)
        .setScale(6 + i * 1.2).setTint(lerpColor(lerpColor(c.light, 0xffffff, 0.4), 0xb8c4e0, c.night * 0.6)).setAlpha(0));
      c.offs = this.clouds.map((_, i) => [i * 70 - 40, rnd(-30, 50)]);
    }
    if (kind === 'snow' || kind === 'shards' || kind === 'embers' || kind === 'leaves') {
      c.ms = kind === 'embers' ? 4200 : 1800;
      c.bits = Array.from({ length: kind === 'leaves' ? 12 : 26 }, () => ({ x: rnd(-60, W + 60), y: rnd(-20, H * 0.62), s: rnd(2, 5), v: rnd(0.8, 1.4), ph: rnd(0, 6) }));
    }
    if (kind === 'bees') { c.ms = 2400; c.bits = Array.from({ length: 34 }, (_, i) => ({ o: i * 0.035 + rnd(0, 0.02), dy: rnd(-12, 12), ph: rnd(0, 6) })); }
    if (kind === 'bats') { c.ms = 2000; c.bits = Array.from({ length: 5 }, (_, i) => ({ o: i * 0.07, dy: rnd(-26, 26), ph: rnd(0, 6), s: rnd(0.8, 1.3) })); }
    if (kind === 'spray') { c.ms = 2200; c.bits = Array.from({ length: 70 }, () => ({ x: rnd(-80, W + 80), y: rnd(-20, H * 0.6), s: rnd(1, 3), v: rnd(0.7, 1.5), ph: rnd(0, 6) })); }
    if (kind === 'petals') { c.ms = 2600; c.bits = Array.from({ length: 22 }, () => ({ x: rnd(-60, W + 60), y: rnd(-20, H * 0.55), s: rnd(2, 4), v: rnd(0.7, 1.3), ph: rnd(0, 6) })); }
    if (kind === 'spores') { c.ms = 4200; c.bits = Array.from({ length: 30 }, () => ({ x: rnd(0, W), y: rnd(H * 0.1, H * 0.7), s: rnd(1, 3), v: rnd(0.5, 1.2), ph: rnd(0, 6) })); }
    if (kind === 'lanterns') { c.ms = 5200; c.bits = Array.from({ length: 4 }, (_, i) => ({ x: rnd(30, W - 30), y0: H * 0.72 + i * 34 + rnd(0, 20), s: rnd(0.8, 1.4), ph: rnd(0, 6) })); }
    if (kind === 'steam') { c.ms = 2600; c.bits = Array.from({ length: 7 }, (_, i) => ({ o: i * 0.06, dy: rnd(-14, 14), r: rnd(16, 34) })); }
    this.cur = c;
  }

  end() {
    if (this.sprite) { this.sprite.destroy(); this.sprite = null; }
    this.clouds.forEach((o) => o.destroy());
    this.clouds = [];
    this.cur = null;
  }

  // Shared: where something crossing the screen is at k (0..1).
  across(c, k, extra = 120) { return c.dir > 0 ? -extra + k * (W + extra * 2) : W + extra - k * (W + extra * 2); }

  // A big bird, huge and close, wings beating slowly, gone in two seconds.
  crane(g, a, c, k) {
    const x = this.across(c, k, 110), y = c.y - Math.sin(k * Math.PI) * 22;
    this.sprite.setPosition(Math.round(x), Math.round(y)).setFrame(Math.floor(c.t / 180) % 2).setAlpha(Math.min(1, Math.sin(k * Math.PI) * 3));
  }

  // A bank of cloud washing over the view: in, a moment of white, out.
  cloud(g, a, c, k) {
    const x = this.across(c, k, 260);
    const fade = Math.min(1, Math.sin(k * Math.PI) * 1.6);
    this.clouds.forEach((o, i) => o.setPosition(Math.round(x + c.offs[i][0] * c.dir), Math.round(H * 0.35 + c.offs[i][1])).setAlpha(0.55 * fade));
    g.fillStyle(lerpColor(c.light, 0xffffff, 0.5), 0.18 * Math.max(0, Math.sin(k * Math.PI) - 0.3)).fillRect(0, 0, W, H);
  }

  // Fat flakes (or crystal dust, or tumbling leaves) streaming sideways.
  snow(g, a, c, k, dt) { this.bits(g, a, c, k, dt, 'snow'); }
  shards(g, a, c, k, dt) { this.bits(g, a, c, k, dt, 'shards'); }
  leaves(g, a, c, k, dt) { this.bits(g, a, c, k, dt, 'leaves'); }

  bits(g, a, c, k, dt, kind) {
    const fade = Math.min(1, Math.sin(k * Math.PI) * 2);
    for (const b of c.bits) {
      b.x += c.dir * b.v * dt * (kind === 'leaves' ? 0.32 : 0.45);
      b.y += dt * (kind === 'leaves' ? 0.04 : 0.06) * b.v + Math.sin(c.t / 200 + b.ph) * 0.3;
      if (b.y > H * 0.66) continue;
      const x = Math.round(b.x), y = Math.round(b.y), s = Math.round(b.s);
      if (kind === 'snow') {
        g.fillStyle(0xffffff, 0.85 * fade).fillRect(x, y, s, s);
        g.fillStyle(0xdfe8ff, 0.5 * fade).fillRect(x - 1, y + 1, s + 2, s - 2);
      } else if (kind === 'shards') {
        const tw = Math.sin(c.t / 60 + b.ph) > 0.4;
        a.fillStyle(tw ? 0xffffff : 0xd8b4ff, 0.8 * fade).fillRect(x, y, s, 1).fillRect(x + Math.floor(s / 2), y - 1, 1, 3);
      } else {
        const turn = Math.sin(c.t / 120 + b.ph);
        g.fillStyle(lerpColor(0x4f8a3c, c.light, 0.2), fade).fillRect(x, y, Math.max(1, Math.round(s * 1.6 * Math.abs(turn))), s);
        g.fillStyle(0x79b24c, fade).fillRect(x, y, Math.max(1, Math.round(s * 0.8 * Math.abs(turn))), 1);
      }
    }
  }

  // A ribbon of bees, wavy, wings flickering.
  bees(g, a, c, k) {
    for (const b of c.bits) {
      const kk = k * 1.4 - b.o;
      if (kk < 0 || kk > 1) continue;
      const x = Math.round(this.across(c, kk, 30)), y = Math.round(c.y + b.dy + Math.sin(kk * 12 + b.ph) * 10);
      // Close up, so twice the size: striped body, a sting, wings blurring.
      g.fillStyle(0x1a1008, 1).fillRect(x - 5, y - 3, 11, 7);
      g.fillStyle(0xffc030, 1).fillRect(x - 4, y - 2, 2, 5).fillRect(x, y - 2, 2, 5).fillRect(x + 3, y - 1, 2, 3);
      g.fillStyle(0x1a1008, 1).fillRect(x - c.dir * 6, y, 2, 1);
      const up = Math.floor(c.t / 35 + b.ph) % 2;
      g.fillStyle(0xffffff, 0.6).fillRect(x - 3, y - (up ? 7 : 5), 6, up ? 4 : 2);
    }
  }

  // Bats, close and black, wings snapping.
  bats(g, a, c, k) {
    for (const b of c.bits) {
      const kk = k * 1.3 - b.o;
      if (kk < 0 || kk > 1) continue;
      const x = Math.round(this.across(c, kk, 40)), y = Math.round(c.y + b.dy + Math.sin(kk * 9 + b.ph) * 8);
      const up = Math.floor(c.t / 70 + b.ph) % 2;
      const s = b.s;
      g.fillStyle(0x0c0812, 1).fillRect(x - 3, y - 2, 6, 5);
      for (let i = 1; i <= 9; i++) {
        const wy = up ? -Math.round(i * 0.7) : Math.round(i * 0.25);
        g.fillRect(Math.round(x - 3 - i * s), y + wy, 2, 2).fillRect(Math.round(x + 2 + i * s), y + wy, 2, 2);
      }
      g.fillStyle(0xff4a4a, 0.8).fillRect(x - 1 + c.dir, y - 1, 1, 1);
    }
  }

  // Steam from the Bastion's vents rolling across.
  steam(g, a, c, k) {
    for (const b of c.bits) {
      const kk = k * 1.25 - b.o;
      if (kk < 0 || kk > 1) continue;
      const x = Math.round(this.across(c, kk, 60)), y = Math.round(c.y + b.dy - kk * 20);
      const r = b.r * (0.7 + kk * 0.6), al = 0.35 * Math.sin(kk * Math.PI);
      g.fillStyle(lerpColor(0xd8d4cc, c.light, 0.3), al).fillCircle(x, y, r);
      g.fillStyle(0xffffff, al * 0.6).fillCircle(x - r * 0.3, y - r * 0.3, r * 0.5);
    }
  }

  // Embers drifting down right past the lens, glowing.
  embers(g, a, c, k, dt) {
    const fade = Math.min(1, Math.sin(k * Math.PI) * 1.8);
    for (const b of c.bits) {
      b.y += dt * 0.03 * b.v;
      b.x += Math.sin(c.t / 400 + b.ph) * 0.4 + c.dir * 0.05 * dt;
      if (b.y > H * 0.7) continue;
      const fl = 0.6 + 0.4 * Math.sin(c.t / 80 + b.ph);
      const x = Math.round(b.x), y = Math.round(b.y), s = Math.round(b.s);
      a.fillStyle(0xff6a1a, 0.25 * fade * fl).fillCircle(x, y, s * 2);
      g.fillStyle(fl > 0.8 ? 0xffe080 : 0xff9a3c, fade).fillRect(x - Math.floor(s / 2), y - Math.floor(s / 2), s, s);
    }
  }

  // A sheet of spray off a waterfall, blown right across the lens, with a
  // little rainbow where the sun shines through it.
  spray(g, a, c, k, dt) {
    const fade = Math.min(1, Math.sin(k * Math.PI) * 1.8);
    g.fillStyle(0xf4fcff, 0.14 * fade).fillRect(0, 0, W, Math.round(H * 0.66));
    for (const b of c.bits) {
      b.x += c.dir * b.v * dt * 0.5;
      b.y += dt * 0.05 * b.v;
      if (b.y > H * 0.66) continue;
      g.fillStyle(0xffffff, 0.75 * fade).fillRect(Math.round(b.x), Math.round(b.y), b.s > 2 ? 2 : 1, Math.round(b.s));
    }
    if (c.night < 0.5) {
      const cx = W / 2 + Math.sin(k * 3) * 40, cy = H * 0.62;
      [0xff5a5a, 0xffb040, 0xfff070, 0x6ae070, 0x5aa8ff, 0x9a70f0].forEach((col, i) => {
        a.lineStyle(3, col, 0.16 * fade * (1 - c.night * 2));
        a.beginPath(); a.arc(cx, cy, 150 - i * 3, Math.PI * 1.1, Math.PI * 1.9); a.strokePath();
      });
    }
  }

  // Red and pink petals from the shrine trees, tumbling past.
  petals(g, a, c, k, dt) {
    const fade = Math.min(1, Math.sin(k * Math.PI) * 2);
    for (const b of c.bits) {
      b.x += c.dir * b.v * dt * 0.22;
      b.y += dt * 0.035 * b.v + Math.sin(c.t / 300 + b.ph) * 0.4;
      if (b.y > H * 0.66) continue;
      const turn = Math.abs(Math.sin(c.t / 160 + b.ph));
      const x = Math.round(b.x), y = Math.round(b.y), s = Math.round(b.s);
      g.fillStyle(0xe8604a, fade).fillRect(x, y, Math.max(1, Math.round(s * 1.4 * turn)), s);
      g.fillStyle(0xffc0b0, fade).fillRect(x, y, Math.max(1, Math.round(s * 0.6 * turn)), 1);
    }
  }

  // Sky lanterns let go from the monastery, rising slowly right past you:
  // paper glowing gold, a flame inside, a halo around each.
  lanterns(g, a, c, k) {
    const fade = Math.min(1, Math.sin(k * Math.PI) * 2.5);
    for (const b of c.bits) {
      const y = Math.round(b.y0 - k * (H * 0.95) * b.s), x = Math.round(b.x + Math.sin(c.t / 900 + b.ph) * 10);
      if (y > H * 0.7 || y < -40) continue;
      const s = b.s, w = Math.round(9 * s), h = Math.round(12 * s);
      a.fillStyle(0xffa040, 0.16 * fade).fillCircle(x, y, 20 * s);
      a.fillStyle(0xffd080, 0.12 * fade).fillCircle(x, y, 11 * s);
      g.fillStyle(0xd8402a, fade).fillRect(x - Math.round(w / 2), y - Math.round(h / 2), w, h);
      g.fillStyle(0xffb050, fade).fillRect(x - Math.round(w / 2) + 1, y - Math.round(h / 2) + 1, w - 2, h - 3);
      g.fillStyle(0xfff0b0, fade).fillRect(x - 1, y + Math.round(h / 2) - 4, 3, 2);
      g.fillStyle(0x6a1a10, fade).fillRect(x - Math.round(w / 2), y - Math.round(h / 2), w, 1).fillRect(x - Math.round(w / 2), y + Math.round(h / 2) - 1, w, 1);
    }
  }

  // Spores drifting up past the lens, big, soft and glowing.
  spores(g, a, c, k, dt) {
    const fade = Math.min(1, Math.sin(k * Math.PI) * 1.6);
    for (const b of c.bits) {
      b.y -= dt * 0.02 * b.v;
      b.x += Math.sin(c.t / 700 + b.ph) * 0.25;
      if (b.y > H * 0.7) continue;
      const tw = 0.6 + 0.4 * Math.sin(c.t / 250 + b.ph), x = Math.round(b.x), y = Math.round(b.y);
      a.fillStyle(0xb8ff6a, 0.12 * fade * tw).fillCircle(x, y, b.s * 4);
      a.fillStyle(0xe8ffb0, 0.7 * fade * tw).fillRect(x - Math.floor(b.s / 2), y - Math.floor(b.s / 2), Math.ceil(b.s), Math.ceil(b.s));
    }
  }

  destroy() { this.end(); this.g.destroy(); this.add.destroy(); }
}
