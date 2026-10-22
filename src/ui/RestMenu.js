import { PixelText, COLORS, drawPanel } from './PixelText.js';
import { DEPTH, GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';

// Quiet panel shown at ledges and checkpoints.
export class RestMenu {
  constructor(scene, onAction) {
    this.scene = scene;
    this.onAction = onAction;
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud);
    this.objs = [];
  }

  show({ title, subtitle = '', detail = '', sitting = false, trader = false }) {
    this.hide();
    const w = 300, h = detail ? 62 : 50;
    const x = Math.round(GAME_WIDTH / 2 - w / 2), y = GAME_HEIGHT - h - 8;
    drawPanel(this.g, x, y, w, h, { alpha: 0.82 });
    const add = (o) => { o.setScrollFactor(0).setDepth(DEPTH.hud + 1); this.objs.push(o); return o; };
    add(new PixelText(this.scene, GAME_WIDTH / 2, y + 6, title, { color: COLORS.gold }).setOrigin(0.5, 0));
    if (subtitle) add(new PixelText(this.scene, GAME_WIDTH / 2, y + 15, subtitle, { color: COLORS.dim }).setOrigin(0.5, 0));
    if (detail) add(new PixelText(this.scene, GAME_WIDTH / 2, y + 26, detail, { color: COLORS.blue }).setOrigin(0.5, 0));
    const opts = [
      ['rest', sitting ? 'R STAND' : 'R REST'],
      ['view', 'V VIEW'],
      ['photo', 'C PHOTO'],
      ...(trader ? [['trader', 'T TRADER']] : []),
      ['continue', 'SPACE CLIMB'],
    ];
    const oy = y + h - 13;
    let ox = x + 14;
    opts.forEach(([id, label]) => {
      const t = add(new PixelText(this.scene, ox, oy, label, { color: id === 'continue' ? COLORS.green : id === 'trader' ? COLORS.gold : COLORS.text }));
      t.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.onAction(id));
      ox += t.width + (trader ? 16 : 22);
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
