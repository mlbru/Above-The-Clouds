import { PixelText, COLORS } from './PixelText.js';
import { DEPTH, GAME_WIDTH, GAME_HEIGHT, IS_TOUCH } from '../config/gameConfig.js';
import { measureLine } from '../utils/pixelFont.js';

const WOOD = { dark: 0x3e2614, mid: 0x6a4426, light: 0x8a5c34, hi: 0xb07c48, grain: 0x553620, nail: 0x2a2a30, nailHi: 0xb8b8c8 };

// The ledge sign: a small weathered trail board nailed to two posts, the
// ledge's name burnt into the top plank and the things you can do here as
// keycaps along the lower plank. It sits low and narrow so the climber,
// standing on the ledge just above, stays in view.
export class RestMenu {
  constructor(scene, onAction) {
    this.scene = scene;
    this.onAction = onAction;
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud);
    this.objs = [];
  }

  show({ title, subtitle = '', detail = '', sitting = false, trader = false }) {
    this.hide();
    const sc = this.scene;
    const opts = [
      ['rest', 'R', sitting ? 'STAND' : 'REST'],
      ['view', 'V', 'VIEW'],
      ['photo', 'C', 'PHOTO'],
      ...(trader ? [['trader', 'T', 'TRADER']] : []),
      ['continue', IS_TOUCH ? '↑' : 'SPACE', 'CLIMB'],
    ];
    // Width: whatever is longer, the words on top or the row of keys.
    const capW = (k) => measureLine(k) + 6;
    const rowW = opts.reduce((n, [, k, label]) => n + capW(k) + 3 + measureLine(label) + 10, -10);
    const w = Math.max(rowW + 24, measureLine(title) + 40, measureLine(subtitle) + 30, detail ? measureLine(detail) + 30 : 0);
    const h = detail ? 46 : 38;
    const x = Math.round(GAME_WIDTH / 2 - w / 2), y = GAME_HEIGHT - h - 6;
    this.drawSign(x, y, w, h);
    const add = (o) => { o.setScrollFactor(0).setDepth(DEPTH.hud + 1); this.objs.push(o); return o; };
    // Burnt-in lettering: a dark groove with the lit lower edge of the cut.
    add(new PixelText(sc, GAME_WIDTH / 2, y + 5, title, { color: '#ffe08a', shadow: '#2a1608' }).setOrigin(0.5, 0));
    if (subtitle) add(new PixelText(sc, GAME_WIDTH / 2, y + 13, subtitle, { color: '#e8d4b4', shadow: '#2a1608' }).setOrigin(0.5, 0));
    if (detail) add(new PixelText(sc, GAME_WIDTH / 2, y + 21, detail, { color: '#bfe8ff', shadow: '#2a1608' }).setOrigin(0.5, 0));
    // Keycaps on the lower plank.
    const ky = y + h - 13;
    let kx = Math.round(GAME_WIDTH / 2 - rowW / 2);
    opts.forEach(([id, key, label]) => {
      const cw = capW(key);
      const go = id === 'continue', gold = id === 'trader';
      const cap = go ? 0xb8f08a : gold ? 0xffe08a : 0xf0e6d4;
      this.g.fillStyle(0x1a0e06, 1).fillRect(kx, ky + 1, cw, 9);
      this.g.fillStyle(cap, 1).fillRect(kx, ky, cw, 8);
      this.g.fillStyle(0xffffff, 0.55).fillRect(kx + 1, ky, cw - 2, 1);
      this.g.fillStyle(0x000000, 0.18).fillRect(kx + 1, ky + 6, cw - 2, 2);
      add(new PixelText(sc, kx + cw / 2, ky + 1, key, { color: '#2a1608', shadow: null }).setOrigin(0.5, 0));
      const t = add(new PixelText(sc, kx + cw + 3, ky + 1, label, { color: go ? '#d8ffb8' : gold ? '#ffe08a' : '#f4ead8', shadow: '#2a1608' }));
      const zone = add(sc.add.zone(kx - 2, ky - 2, cw + 5 + t.width, 13).setOrigin(0, 0).setInteractive({ useHandCursor: true }));
      zone.on('pointerup', (p) => { if (p.getDistance() < 12) this.onAction(id); });
      kx += cw + 3 + t.width + 10;
    });
  }

  // Two planks, wood grain, knots, iron nails and the posts it hangs on.
  drawSign(x, y, w, h) {
    const g = this.g;
    // Posts behind the board, going down off the screen.
    for (const px of [x + 10, x + w - 14]) {
      g.fillStyle(WOOD.dark, 1).fillRect(px, y + h - 4, 5, GAME_HEIGHT - (y + h) + 8);
      g.fillStyle(WOOD.mid, 1).fillRect(px + 1, y + h - 4, 2, GAME_HEIGHT - (y + h) + 8);
    }
    // Drop shadow.
    g.fillStyle(0x000000, 0.35).fillRect(x + 3, y + 3, w, h);
    const split = Math.round(h * 0.55);
    const plank = (py, ph, seed) => {
      g.fillStyle(WOOD.dark, 1).fillRect(x, py, w, ph);
      g.fillStyle(WOOD.mid, 1).fillRect(x + 1, py + 1, w - 2, ph - 2);
      g.fillStyle(WOOD.light, 1).fillRect(x + 1, py + 1, w - 2, Math.max(1, Math.floor((ph - 2) / 2)));
      g.fillStyle(WOOD.hi, 1).fillRect(x + 2, py + 1, w - 4, 1);
      // Grain: long thin streaks that wander a little.
      for (let k = 0; k < 6; k++) {
        const gy = py + 3 + ((k * 7 + seed) % Math.max(1, ph - 5));
        const gx = x + 4 + ((k * 53 + seed * 17) % Math.max(1, w - 40));
        const len = 14 + ((k * 31 + seed) % 30);
        g.fillStyle(WOOD.grain, 0.7).fillRect(gx, gy, len, 1);
        g.fillStyle(WOOD.grain, 0.4).fillRect(gx + len, gy + 1, 6, 1);
      }
      // A knot.
      const kx = x + 18 + ((seed * 37) % Math.max(1, w - 36));
      g.fillStyle(WOOD.grain, 1).fillRect(kx, py + Math.floor(ph / 2) - 1, 4, 2);
      g.fillStyle(WOOD.dark, 1).fillRect(kx + 1, py + Math.floor(ph / 2) - 1, 2, 1);
    };
    plank(y, split, 3);
    plank(y + split, h - split, 11);
    // A dark seam between the planks.
    g.fillStyle(WOOD.dark, 1).fillRect(x + 1, y + split, w - 2, 1);
    // Nails.
    for (const [nx, ny] of [[x + 4, y + 3], [x + w - 6, y + 3], [x + 4, y + h - 5], [x + w - 6, y + h - 5]]) {
      g.fillStyle(WOOD.nail, 1).fillRect(nx, ny, 2, 2);
      g.fillStyle(WOOD.nailHi, 1).fillRect(nx, ny, 1, 1);
    }
  }

  hide() {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    this.g.clear();
  }

  setVisible(v) {
    this.objs.forEach((o) => o.setVisible(v));
    this.g.setVisible(v);
  }
}
