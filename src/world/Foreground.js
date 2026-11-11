// Things right in front of the camera: big dark silhouettes at the edges of
// the screen that slide past faster than the wall (a pine bough on the Green
// Rise, icicles in the Frozen Reach, cogs in the Clockwork Bastion...). Being
// so close they are chunky and dark, which pushes the wall back into depth.
// They hug the screen edges so they never cover the climb.
import { DEPTH, GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';
import { PixelGrid, makeCanvas } from '../utils/pixelGrid.js';
import { biomeAt } from '../data/biomes.js';
import { lerpColor } from '../utils/color.js';
import { SeededRandom } from '../utils/seededRandom.js';

const PARALLAX = 1.7;
const TOP = 64; // the HUD band at the top of the screen
const KIND = {
  green: 'bough', stone: 'crag', frozen: 'icicles', aurora: 'icicles', hive: 'comb', obsidian: 'shards',
  crystal: 'shards', clockwork: 'cog', storm: 'crag', bones: 'ribs', dragon: 'spines', volcano: 'spines',
};
const BASE = { bough: 0x1c2a1e, crag: 0x1e1c24, icicles: 0x22304a, comb: 0x3a2410, shards: 0x1a1426, cog: 0x2e2214, ribs: 0x2a2622, spines: 0x2a1410 };
const RIM = { bough: 0x3a5a34, crag: 0x3a3844, icicles: 0x6a8ab8, comb: 0x7a5420, shards: 0x5a3a8a, cog: 0x6a5228, ribs: 0x5a544a, spines: 0x6a2a1a };

function poly(g, pts, c) {
  const ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    for (let x = 0; x < g.w; x++) {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y + 0.5) !== (yj > y + 0.5) && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) g.set(x, y, c);
    }
  }
}

// Each silhouette grows in from the left edge (x = 0); the right side is flipped.
function paint(kind, v) {
  const rng = new SeededRandom(91 + v * 7 + kind.length * 13);
  const W = 70, H = 110, g = new PixelGrid(W, H);
  const c = BASE[kind];
  switch (kind) {
    case 'bough': {
      poly(g, [[0, 50], [62, 42], [64, 46], [0, 58]], c);
      for (let i = 0; i < 9; i++) {
        const x = 4 + i * 7, y = 48 - i * 0.8;
        poly(g, [[x - 6, y + 2], [x + 2, y - 16 - rng.range(0, 8)], [x + 8, y + 2]], c);
        poly(g, [[x - 5, y + 2], [x + 3, y + 18 + rng.range(0, 8)], [x + 9, y + 2]], c);
      }
      break;
    }
    case 'crag': {
      // A jagged boulder jutting in from the edge, with a smaller one below.
      const lump = (y0, h, w) => {
        const pts = [[0, y0]];
        for (let k = 0; k <= 6; k++) {
          const t = k / 6;
          pts.push([w * Math.sin(t * Math.PI) * (0.75 + rng.range(0, 0.35)) + 4, y0 + t * h]);
        }
        pts.push([0, y0 + h]);
        poly(g, pts, c);
      };
      lump(18, 46, 46);
      lump(70, 30, 26);
      break;
    }
    case 'icicles': {
      poly(g, [[0, 0], [66, 0], [60, 10], [0, 14]], c);
      for (let x = 2; x < 62; x += 5 + rng.int(0, 3)) {
        const len = 20 + rng.range(0, 70) * (1 - x / 90);
        poly(g, [[x, 8], [x + 2.5, 8 + len], [x + 5, 8]], c);
      }
      break;
    }
    case 'comb': {
      for (let r = 0; r < 6; r++) for (let q = 0; q < 4 - (r % 2); q++) {
        const cx = q * 14 + (r % 2 ? 7 : 0), cy = 20 + r * 12;
        const hex = [0, 1, 2, 3, 4, 5].map((i) => [cx + Math.cos((i / 6) * Math.PI * 2) * 7.5, cy + Math.sin((i / 6) * Math.PI * 2) * 7]);
        poly(g, hex, c);
      }
      poly(g, [[20, 90], [23, 108], [26, 90]], c);
      break;
    }
    case 'shards': {
      for (let i = 0; i < 5; i++) {
        const y = 10 + i * 20 + rng.range(-4, 4), len = 30 + rng.range(0, 34);
        poly(g, [[0, y - 6], [len, y + rng.range(-10, 6)], [0, y + 8]], c);
      }
      break;
    }
    case 'cog': {
      const cx = 8, cy = 55, r = 40;
      g.ellipse(cx, cy, r, r, c);
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        g.rect(Math.round(cx + Math.cos(a) * (r + 2)) - 4, Math.round(cy + Math.sin(a) * (r + 2)) - 4, 9, 9, c);
      }
      g.ellipse(cx, cy, 14, 14, null);
      break;
    }
    case 'ribs': {
      for (let i = 0; i < 5; i++) {
        const y0 = 8 + i * 20;
        for (let t = 0; t <= 1; t += 0.02) {
          const x = t * 60, y = y0 + Math.sin(t * Math.PI) * 14;
          g.rect(Math.round(x), Math.round(y), 1, 6 - Math.round(t * 3), c);
        }
      }
      g.rect(0, 0, 6, H, c);
      break;
    }
    default: { // spines
      poly(g, [[0, 0], [10, 0], [10, H], [0, H]], c);
      for (let y = 6; y < H; y += 16) poly(g, [[8, y], [40 + rng.range(0, 20), y + 6], [8, y + 12]], c);
    }
  }
  // A thin rim of light on the edge facing the wall.
  const rim = RIM[kind];
  for (let y = 0; y < H; y++) for (let x = W - 1; x > 0; x--) if (g.get(x, y) === c && g.get(x + 1, y) === null) { g.set(x, y, rim); break; }
  return g;
}

function texture(scene, kind, v) {
  const key = `fg_near_${kind}_${v}`;
  if (scene.textures.exists(key)) return key;
  const g = paint(kind, v);
  const c = makeCanvas(g.w, g.h);
  g.drawTo(c.getContext('2d'));
  scene.textures.addCanvas(key, c);
  return key;
}

export class Foreground {
  constructor(scene) {
    this.scene = scene;
    this.items = [0, 1].map((i) => ({ img: scene.add.image(0, 0, '__DEFAULT').setScrollFactor(0).setDepth(DEPTH.foreground + 5).setVisible(false), fy: null, side: i ? 1 : -1, kind: null, a: 0 }));
  }

  // alt: the climber's height (m). camY: camera scroll. light: the light of the hour.
  update(dt, alt, camY, light, reduced = false) {
    const kind = KIND[biomeAt(alt).id] || null;
    const fcam = camY * PARALLAX;
    this.items.forEach((it, i) => {
      const img = it.img;
      const h = 110 * 2.2;
      // Place it (again) above the screen once it has passed below, or below if falling.
      const respawn = (above) => {
        it.kind = kind;
        it.side = Math.random() < 0.5 ? -1 : 1;
        if (kind) img.setTexture(texture(this.scene, kind, Math.floor(Math.random() * 3)));
        img.setFlipX(it.side > 0).setScale(2.2).setOrigin(it.side > 0 ? 1 : 0, 0);
        it.fy = above ? fcam - h - 60 - Math.random() * 380 - i * 260 : fcam + GAME_HEIGHT + 40 + Math.random() * 200;
        it.x = it.side > 0 ? GAME_WIDTH + 6 - Math.random() * 18 : -6 + Math.random() * 18;
      };
      // A new biome: once an old silhouette has faded, it comes back as the new kind.
      if (it.fy === null || (it.kind !== kind && it.a < 0.02 && kind)) respawn(true);
      let y = it.fy - fcam;
      if (y > GAME_HEIGHT + 20) { respawn(true); y = it.fy - fcam; }
      if (y < -h * 3) { respawn(false); y = it.fy - fcam; }
      const want = kind && it.kind === kind && !reduced ? 1 : 0;
      it.a += (want - it.a) * Math.min(1, dt / 600);
      img.setVisible(it.a > 0.02 && !!it.kind).setPosition(Math.round(it.x), Math.round(y)).setAlpha(it.a)
        .setTint(lerpColor(0xffffff, light, 0.6));
      // Never behind the HUD at the top: clip off whatever reaches up there.
      const top = Math.max(0, Math.ceil((TOP - y) / 2.2));
      img.setCrop(0, top, 70, 110 - top);
    });
  }
}
