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
const KIND = {
  green: 'bough', stone: 'crag', frozen: 'icicles', aurora: 'icicles', hive: 'comb', obsidian: 'shards',
  crystal: 'shards', clockwork: 'cog', storm: 'crag', bones: 'ribs', dragon: 'spines', volcano: 'spines',
  cascade: 'fronds', monastery: 'eaves', moss: 'roots', reef: 'fan', starfall: 'glassblade',
};
const BASE = { bough: 0x1c2a1e, crag: 0x1e1c24, icicles: 0x22304a, comb: 0x3a2410, shards: 0x1a1426, cog: 0x2e2214, ribs: 0x2a2622, spines: 0x2a1410, fronds: 0x0e2216, eaves: 0x2a1410, roots: 0x16200e, fan: 0x2a1418, glassblade: 0x07060e };
const RIM = { bough: 0x3a5a34, crag: 0x3a3844, icicles: 0x6a8ab8, comb: 0x7a5420, shards: 0x5a3a8a, cog: 0x6a5228, ribs: 0x5a544a, spines: 0x6a2a1a, fronds: 0x3a6a3a, eaves: 0xb8862a, roots: 0x4a6a2a, fan: 0xe8806a, glassblade: 0xa898f0 };

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

// Each silhouette grows in from the left edge (x = 0); the right side is
// flipped. Small and organic: they reach at most ~36 px into the screen.
const TW = 44, TH = 80;
function paint(kind, v) {
  const rng = new SeededRandom(91 + v * 7 + kind.length * 13);
  const g = new PixelGrid(TW, TH);
  const c = BASE[kind];
  switch (kind) {
    case 'bough': {
      // A pine bough dipping in from the edge, needles fanning off it.
      const y0 = 20 + rng.range(0, 20);
      for (let x = 0; x < 34; x++) {
        const y = y0 + x * 0.35 + Math.sin(x / 6) * 1.5;
        g.rect(x, Math.round(y), 1, 2, c);
        if (x % 3 === 0 && x > 2) {
          const len = 6 + (34 - x) * 0.25;
          for (let k = 0; k < len; k++) { g.set(x + k * 0.5, y - k * 0.8, c); g.set(x + k * 0.5, y + 2 + k * 0.7, c); }
        }
      }
      break;
    }
    case 'crag': {
      const y0 = 10 + rng.range(0, 20), h = 30 + rng.range(0, 14), w = 18 + rng.range(0, 10);
      const pts = [[0, y0]];
      for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push([w * Math.sin(t * Math.PI) * (0.8 + rng.range(0, 0.3)) + 2, y0 + t * h]); }
      pts.push([0, y0 + h]);
      poly(g, pts, c);
      break;
    }
    case 'icicles': {
      // A thin, uneven lip of ice with icicles hanging off it.
      const w = 22 + rng.range(0, 12);
      poly(g, [[0, 4], [w, 6], [w - 3, 9], [0, 11]], c);
      for (let x = 2; x < w - 2; x += 4 + rng.int(0, 3)) {
        const len = 8 + rng.range(0, 26) * (1 - x / (w + 8));
        poly(g, [[x, 8], [x + 1.5, 8 + len], [x + 3, 8]], c);
      }
      break;
    }
    case 'comb': {
      for (const [cx, cy] of [[4, 20], [12, 27], [4, 34], [12, 41]]) {
        const hex = [0, 1, 2, 3, 4, 5].map((i) => [cx + Math.cos((i / 6) * Math.PI * 2) * 5, cy + Math.sin((i / 6) * Math.PI * 2) * 4.6]);
        poly(g, hex, c);
      }
      poly(g, [[8, 44], [9.5, 56], [11, 44]], c);
      break;
    }
    case 'shards': {
      for (let i = 0; i < 3; i++) {
        const y = 14 + i * 16 + rng.range(-3, 3), len = 16 + rng.range(0, 18);
        poly(g, [[0, y - 4], [len, y + rng.range(-6, 4)], [0, y + 5]], c);
      }
      break;
    }
    case 'cog': {
      const cx = 0, cy = 36, r = 20;
      g.ellipse(cx, cy, r, r, c);
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        g.rect(Math.round(cx + Math.cos(a) * (r + 2)) - 3, Math.round(cy + Math.sin(a) * (r + 2)) - 3, 6, 6, c);
      }
      g.ellipse(cx, cy, 7, 7, null);
      break;
    }
    case 'ribs': {
      for (let i = 0; i < 3; i++) {
        const y0 = 14 + i * 16;
        for (let t = 0; t <= 1; t += 0.03) g.rect(Math.round(t * 30), Math.round(y0 + Math.sin(t * Math.PI) * 8), 1, 3 - Math.round(t * 1.5), c);
      }
      break;
    }
    case 'fronds': {
      // Tree-fern fronds arching in from the edge: a curved rib and leaflets
      // that shorten towards the tip, each one a little droop.
      for (let f = 0; f < 2; f++) {
        const y0 = 14 + f * 30 + rng.range(-4, 4), len = 30 + rng.range(0, 8), bend = 0.7 + rng.range(0, 0.5);
        for (let t = 0; t <= 1; t += 0.02) {
          const x = t * len, y = y0 - Math.sin(t * Math.PI * 0.8) * 8 * bend + t * t * 14;
          g.rect(Math.round(x), Math.round(y), 1, 2, c);
          if (Math.round(t * 50) % 3 === 0 && t > 0.06) {
            const leaf = (1 - t) * 9 + 2;
            for (let k = 0; k < leaf; k++) { g.set(x + k * 0.35, y - 1 - k * 0.7, c); g.set(x + k * 0.45, y + 2 + k * 0.55 + k * k * 0.03, c); }
          }
        }
      }
      break;
    }
    case 'eaves': {
      // The upturned corner of a temple roof: tiled eaves sweeping up to a
      // dragon-tail tip, a beam end under it, a little bell hanging off it.
      const y0 = 22 + rng.range(0, 10);
      for (let x = 0; x < 34; x++) {
        const lift = Math.pow(x / 34, 3) * 14;
        const top = y0 - lift, th = 7 - x / 10;
        g.rect(x, Math.round(top), 1, Math.max(2, Math.round(th)), c);
        if (x % 4 === 0 && x < 30) g.rect(x, Math.round(top + th), 1, 2, c);
      }
      poly(g, [[30, y0 - 12], [37, y0 - 22], [35, y0 - 12]], c);
      g.rect(0, y0 + 7, 16, 4, c);
      g.rect(14, y0 + 6, 4, 6, c);
      g.rect(26, y0 - 4, 1, 8, c);
      g.ellipse(26.5, y0 + 6, 2.5, 3, c);
      break;
    }
    case 'roots': {
      // Old roots hanging into view: thick strands that taper and fork,
      // with tufts of moss caught on them.
      for (let i = 0; i < 4; i++) {
        let x = 2 + i * 7 + rng.range(-2, 2), w = 4 - i * 0.6;
        const end = 40 + rng.range(0, 36);
        for (let y = 0; y < end; y++) {
          x += Math.sin(y / 9 + i * 2) * 0.35 + 0.08;
          const ww = Math.max(1, w * (1 - y / end));
          g.rect(Math.round(x - ww / 2), y, Math.max(1, Math.round(ww)), 1, c);
          if (y % 17 === 9) g.ellipse(Math.round(x), y, 2.5, 1.5, c);
        }
      }
      break;
    }
    case 'fan': {
      // A stone sea fan reaching in from the edge, its lattice against the light.
      const cy = 30 + rng.range(-6, 6), R = 26 + rng.range(0, 8);
      for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
        const r = Math.hypot(x, (y - cy) * 0.9);
        if (r > R) continue;
        const a = Math.atan2(y - cy, x);
        if (Math.abs(Math.sin(a * 8)) < 0.2 || Math.abs(Math.sin(r * 0.55)) < 0.22 || r < 4) g.set(x, y, c);
      }
      for (let y = Math.round(cy); y < TH; y++) g.rect(0, y, 3, 1, c);
      break;
    }
    case 'glassblade': {
      // Blades of black glass thrust in from the edge at angles.
      for (let i = 0; i < 3; i++) {
        const y0 = 8 + i * 24 + rng.range(-4, 4), len = 22 + rng.range(0, 16), up = rng.range(-0.5, 0.3);
        poly(g, [[0, y0], [len, y0 + len * up], [0, y0 + 9 + rng.range(0, 4)]], c);
      }
      break;
    }
    default: { // spines
      for (let y = 10; y < 66; y += 14) poly(g, [[0, y], [20 + rng.range(0, 12), y + 4], [0, y + 9]], c);
    }
  }
  // A thin rim of light on the edge facing the wall.
  const rim = RIM[kind];
  for (let y = 0; y < TH; y++) for (let x = TW - 1; x > 0; x--) if (g.get(x, y) === c && g.get(x + 1, y) === null) { g.set(x, y, rim); break; }
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

const SCALE = 1.3;

export class Foreground {
  constructor(scene) {
    this.scene = scene;
    this.items = [0, 1].map(() => ({ img: scene.add.image(0, 0, '__DEFAULT').setScrollFactor(0).setDepth(DEPTH.foreground + 5).setVisible(false), fy: null, side: -1, kind: null }));
  }

  // alt: the climber's height (m). camY: camera scroll. light: the light of the hour.
  // A silhouette only ever enters from beyond the screen edge (it is never
  // faded in on the spot), takes the biome's kind when it is placed, and is
  // see-through near the top so it slides in out of the haze, not behind the HUD.
  update(dt, alt, camY, light, reduced = false) {
    const kind = KIND[biomeAt(alt).id] || null;
    const fcam = camY * PARALLAX;
    const h = TH * SCALE;
    this.items.forEach((it, i) => {
      const img = it.img;
      const respawn = (above) => {
        it.kind = kind;
        it.side = (i === 0) === (Math.random() < 0.5) ? -1 : 1;
        if (kind) img.setTexture(texture(this.scene, kind, Math.floor(Math.random() * 3)));
        img.setFlipX(it.side > 0).setScale(SCALE).setOrigin(it.side > 0 ? 1 : 0, 0);
        // Far apart, so one passes now and then rather than a crowd.
        it.fy = above ? fcam - h - 120 - Math.random() * 700 - i * 420 : fcam + GAME_HEIGHT + 60 + Math.random() * 400;
        it.x = it.side > 0 ? GAME_WIDTH + 2 : -2;
      };
      if (it.fy === null) respawn(true);
      let y = it.fy - fcam;
      if (y > GAME_HEIGHT + 30) { respawn(true); y = it.fy - fcam; }
      if (y < -h - 900) { respawn(false); y = it.fy - fcam; }
      // Out of the haze: clear below the HUD, fading out towards the top edge.
      const mid = y + h * 0.5;
      const haze = Math.max(0, Math.min(1, (mid - 50) / 110));
      const on = !!it.kind && !reduced && y < GAME_HEIGHT && y > -h;
      img.setVisible(on && haze > 0.02).setPosition(Math.round(it.x), Math.round(y)).setAlpha(0.92 * haze)
        .setTint(lerpColor(0xffffff, light, 0.6));
    });
  }
}
