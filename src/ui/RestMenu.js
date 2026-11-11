import { PixelText, COLORS } from './PixelText.js';
import { DEPTH, GAME_WIDTH, GAME_HEIGHT, IS_TOUCH } from '../config/gameConfig.js';
import { measureLine } from '../utils/pixelFont.js';

// What you can do on a ledge, without a panel: the ledge's name in gold
// between two short rules, a quiet subtitle, and a row of little keycaps
// floating over the scene. It sits low so the climber stays in view.
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
    const capW = (k) => measureLine(k) + 6;
    const rowW = opts.reduce((n, [, k, label]) => n + capW(k) + 3 + measureLine(label) + 12, -12);
    const cx = GAME_WIDTH / 2;
    const ky = GAME_HEIGHT - 16;
    const lines = (detail ? 1 : 0) + (subtitle ? 1 : 0);
    const ty = ky - 14 - lines * 9;
    const add = (o) => { o.setScrollFactor(0).setDepth(DEPTH.hud + 1); this.objs.push(o); return o; };
    const g = this.g;
    // The name, with a short gold rule on each side.
    const name = add(new PixelText(sc, cx, ty, title, { color: COLORS.gold }).setOrigin(0.5, 0));
    const rw = 18, gap = 6;
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? cx - name.width / 2 - gap - rw : cx + name.width / 2 + gap;
      g.fillStyle(0x16141f, 0.8).fillRect(x0, ty + 3, rw, 1);
      g.fillStyle(0xf2c14e, 1).fillRect(x0, ty + 2, rw, 1);
      g.fillStyle(0xf2c14e, 1).fillRect(s < 0 ? x0 + rw - 1 : x0, ty + 1, 1, 3);
    }
    let y = ty + 10;
    if (subtitle) { add(new PixelText(sc, cx, y, subtitle, { color: '#dfe8ff' }).setOrigin(0.5, 0)); y += 9; }
    if (detail) add(new PixelText(sc, cx, y, detail, { color: COLORS.blue }).setOrigin(0.5, 0));
    // Keycaps: a light cap with a darker base, like a real key.
    let kx = Math.round(cx - rowW / 2);
    opts.forEach(([id, key, label]) => {
      const cw = capW(key);
      const go = id === 'continue', gold = id === 'trader';
      const cap = go ? 0xb8f08a : gold ? 0xffe08a : 0xf0ecf8;
      g.fillStyle(0x16141f, 1).fillRect(kx - 1, ky - 1, cw + 2, 11);
      g.fillStyle(go ? 0x5a9a3a : gold ? 0xb8902a : 0x8a84a0, 1).fillRect(kx, ky + 1, cw, 9);
      g.fillStyle(cap, 1).fillRect(kx, ky, cw, 8);
      g.fillStyle(0xffffff, 0.6).fillRect(kx + 1, ky, cw - 2, 1);
      add(new PixelText(sc, kx + cw / 2, ky + 1, key, { color: '#16141f', shadow: null }).setOrigin(0.5, 0));
      const t = add(new PixelText(sc, kx + cw + 3, ky + 1, label, { color: go ? '#b8f08a' : gold ? '#ffe08a' : COLORS.text }));
      const zone = add(sc.add.zone(kx - 2, ky - 2, cw + 5 + t.width, 13).setOrigin(0, 0).setInteractive({ useHandCursor: true }));
      zone.on('pointerup', (p) => { if (p.getDistance() < 12) this.onAction(id); });
      kx += cw + 3 + t.width + 12;
    });
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
