import { PixelText, COLORS, drawPanel } from './PixelText.js';
import { GAME_WIDTH } from '../config/gameConfig.js';
import { IS_TOUCH } from '../config/gameConfig.js';
import { Audio } from '../systems/AudioSystem.js';

const MAX = 16;

// "Enter code" page for the settings menu. Acts like a MenuList for the scene
// (handleKey / refresh / destroy). Type with the keyboard; on touch screens (or
// by clicking the box) the browser's text prompt is used instead.
export class CodeEntry {
  constructor(scene, prog, onBack, { depth = 0 } = {}) {
    this.scene = scene;
    this.prog = prog;
    this.onBack = onBack;
    this.text = '';
    this.objs = [];
    const add = (o) => { o.setScrollFactor(0).setDepth(depth); this.objs.push(o); return o; };
    const cx = GAME_WIDTH / 2;
    this.g = add(scene.add.graphics());
    drawPanel(this.g, cx - 120, 32, 240, 112, { alpha: 0.9 });
    drawPanel(this.g, cx - 90, 66, 180, 24, { alpha: 0.95, highlight: 0xf2c14e });
    add(new PixelText(scene, cx, 40, 'ENTER CODE', { color: COLORS.gold }).setOrigin(0.5, 0).setScale(2));
    this.field = add(new PixelText(scene, cx, 76, '', { color: COLORS.text }).setOrigin(0.5, 0));
    this.msg = add(new PixelText(scene, cx, 98, '', { color: COLORS.dim }).setOrigin(0.5, 0));
    add(new PixelText(scene, cx, 112, IS_TOUCH ? 'TAP THE BOX TO TYPE' : 'TYPE IT, ENTER TO CONFIRM, ESC TO GO BACK', { color: COLORS.faint }).setOrigin(0.5, 0));
    const back = add(new PixelText(scene, cx, 128, '[ BACK ]', { color: COLORS.green }).setOrigin(0.5, 0));
    back.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.onBack());
    const zone = add(scene.add.zone(cx - 90, 66, 180, 24).setOrigin(0, 0).setInteractive({ useHandCursor: true }));
    zone.on('pointerdown', () => this.promptForCode());
    this.blink = scene.time.addEvent({ delay: 400, loop: true, callback: () => { this.cursor = !this.cursor; this.refresh(); } });
    this.refresh();
    window.__atcTyping = true; // the F key must not toggle fullscreen while typing
    if (IS_TOUCH) scene.time.delayedCall(150, () => this.promptForCode());
  }

  promptForCode() {
    let v = null;
    try { v = window.prompt('Enter code'); } catch { v = null; }
    if (v) { this.text = v.toUpperCase().slice(0, MAX); this.submit(); }
  }

  refresh() {
    if (!this.field.active) return;
    this.field.setText(`${this.text}${this.cursor ? '_' : ' '}`);
  }

  submit() {
    if (!this.text) return;
    const r = this.prog.redeemCode(this.text);
    Audio.play(r.ok ? 'buy' : 'denied');
    this.msg.setText(r.message).setColor(r.ok ? COLORS.green : COLORS.red);
    this.text = '';
    this.refresh();
  }

  handleKey(code) {
    if (code === 'Escape') { this.onBack(); return true; }
    if (code === 'Enter') { this.submit(); return true; }
    if (code === 'Backspace') { this.text = this.text.slice(0, -1); this.refresh(); return true; }
    const m = /^(?:Key([A-Z])|Digit([0-9])|Numpad([0-9]))$/.exec(code);
    if (m && this.text.length < MAX) {
      this.text += m[1] || m[2] || m[3];
      Audio.play('ui');
      this.refresh();
      return true;
    }
    return false;
  }

  destroy() {
    window.__atcTyping = false;
    this.blink.remove();
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
  }
}
