import Phaser from 'phaser';
import { measure, drawText } from '../utils/pixelFont.js';

let uid = 0;

// Crisp bitmap text rendered with the hand-made pixel font into its own
// canvas texture. Texture is released when the object is destroyed.
export class PixelText extends Phaser.GameObjects.Image {
  constructor(scene, x, y, text = '', opts = {}) {
    super(scene, x, y, '__DEFAULT');
    this.texKey = `__ptxt_${uid++}`;
    this.opts = { color: '#f4efe4', shadow: '#16141f', align: 'left', ...opts };
    this._text = null;
    scene.add.existing(this);
    this.setOrigin(0, 0);
    this.setText(text);
  }

  get text() { return this._text; }

  setText(text) {
    const t = String(text);
    if (t === this._text) return this;
    this._text = t;
    this.redraw();
    return this;
  }

  setColor(color) {
    if (color === this.opts.color) return this;
    this.opts.color = color;
    this.redraw();
    return this;
  }

  redraw() {
    const textures = this.scene.textures;
    const { width, height } = measure(this._text);
    const sh = this.opts.shadow ? 1 : 0;
    const w = width + sh, h = height + sh;
    let tex = textures.exists(this.texKey) ? textures.get(this.texKey) : null;
    if (!tex || tex.width !== w || tex.height !== h) {
      if (tex) textures.remove(this.texKey);
      tex = textures.createCanvas(this.texKey, w, h);
    }
    const ctx = tex.context;
    ctx.clearRect(0, 0, w, h);
    if (sh) drawText(ctx, this._text, 1, 1, this.opts.shadow, this.opts.align, width);
    drawText(ctx, this._text, 0, 0, this.opts.color, this.opts.align, width);
    tex.refresh();
    this.setTexture(this.texKey);
  }

  destroy(fromScene) {
    const textures = this.scene && this.scene.textures;
    const key = this.texKey;
    super.destroy(fromScene);
    if (textures && textures.exists(key)) textures.remove(key);
  }
}

export const COLORS = {
  text: '#f4efe4',
  dim: '#a8a3b8',
  faint: '#6f6a80',
  gold: '#f2c14e',
  green: '#8fd16a',
  red: '#f0644b',
  blue: '#9fd8ff',
  panel: 0x16141f,
  panelLine: 0x4a4560,
  panelLight: 0x8a84a0,
};

export function drawPanel(g, x, y, w, h, { fill = COLORS.panel, alpha = 0.82, line = COLORS.panelLine, highlight = null } = {}) {
  g.fillStyle(fill, alpha);
  g.fillRect(x + 1, y, w - 2, h);
  g.fillRect(x, y + 1, w, h - 2);
  g.fillStyle(highlight || line, 1);
  g.fillRect(x + 1, y, w - 2, 1);
  g.fillRect(x + 1, y + h - 1, w - 2, 1);
  g.fillRect(x, y + 1, 1, h - 2);
  g.fillRect(x + w - 1, y + 1, 1, h - 2);
}
