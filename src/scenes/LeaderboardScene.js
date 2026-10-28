import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, IS_TOUCH } from '../config/gameConfig.js';
import { BALANCE } from '../config/balanceConfig.js';
import { PixelText, COLORS, drawPanel } from '../ui/PixelText.js';
import { Audio } from '../systems/AudioSystem.js';
import { fetchTop, leaderboardEnabled, playerName, setPlayerName, cleanName, NAME_MAX } from '../systems/Leaderboard.js';

const ROWS = 10;
const ROW_H = 12;
const MODE_COLOR = { normal: COLORS.green, hard: COLORS.gold, summit: COLORS.red };

// The online top ten per mode. Opens over the Menu (or the run summary), which
// is paused meanwhile. Without a name it first asks for one.
export class LeaderboardScene extends Phaser.Scene {
  constructor() { super('Leaderboard'); }

  init(data) {
    this.returnTo = (data && data.returnTo) || 'Menu';
    this.startMode = (data && data.mode) || null;
  }

  create() {
    this.prog = this.registry.get('progression');
    const modes = BALANCE.modeOrder;
    this.mode = this.startMode || this.prog.settings.mode || 'normal';
    this.modeIndex = Math.max(0, modes.indexOf(this.mode));
    this.rows = {};
    this.objs = [];
    this.editing = !playerName(this.prog);
    this.text = '';
    this.cursor = true;
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a0c14, 0.94).setOrigin(0, 0);
    this.input.keyboard.addCapture('UP,DOWN,LEFT,RIGHT,SPACE');
    this.input.keyboard.on('keydown', this.onKey, this);
    this.blink = this.time.addEvent({ delay: 400, loop: true, callback: () => { this.cursor = !this.cursor; if (this.editing) this.render(); } });
    this.events.once('shutdown', () => {
      this.input.keyboard.off('keydown', this.onKey, this);
      window.__atcTyping = false;
    });
    window.__atcTyping = this.editing;
    this.render();
    if (!this.editing) this.fetchBoard();
  }

  get currentMode() { return BALANCE.modeOrder[this.modeIndex]; }

  async fetchBoard() {
    const mode = this.currentMode;
    if (!leaderboardEnabled()) { this.rows[mode] = { error: 'NOT SET UP YET' }; this.render(); return; }
    this.rows[mode] = { loading: true };
    this.render();
    try {
      this.rows[mode] = { list: await fetchTop(this.prog, mode, ROWS) };
    } catch {
      this.rows[mode] = { error: 'CANNOT REACH THE LEADERBOARD' };
    }
    if (this.sys.isActive()) this.render();
  }

  clear() { this.objs.forEach((o) => o.destroy()); this.objs = []; }

  render() {
    this.clear();
    const W = GAME_WIDTH / 2;
    const oy = Math.max(0, Math.round((GAME_HEIGHT - 270) / 2));
    const add = (o) => { this.objs.push(o); return o; };
    const text = (x, y, str, color, scale = 1, ox = 0.5) => add(new PixelText(this, x, y + oy, str, { color }).setOrigin(ox, 0).setScale(scale));
    const g = add(this.add.graphics());
    text(W, 10, 'LEADERBOARD', COLORS.gold, 2);

    if (this.editing) { this.renderNameEntry(g, text, add); return; }

    const mode = this.currentMode;
    const label = BALANCE.modes[mode].label;
    const prev = text(W - 80, 34, '<', COLORS.dim, 2);
    const next = text(W + 80, 34, '>', COLORS.dim, 2);
    text(W, 34, label, MODE_COLOR[mode], 2);
    for (const [obj, d] of [[prev, -1], [next, 1]]) obj.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.changeMode(d));

    const px = W - 130, pw = 260;
    drawPanel(g, px, 54 + oy, pw, ROWS * ROW_H + 8, { alpha: 0.85 });
    const state = this.rows[mode] || { loading: true };
    if (state.list && state.list.length) {
      state.list.forEach((r, i) => {
        const y = 58 + i * ROW_H;
        const color = r.mine ? COLORS.gold : i < 3 ? COLORS.text : COLORS.dim;
        text(px + 10, y, `${i + 1}`, color, 1, 0);
        text(px + 30, y, r.name, color, 1, 0);
        text(px + pw - 10, y, `${Math.floor(r.height)} M`, color, 1, 1);
      });
    } else {
      const msg = state.loading ? 'LOADING...' : state.error || 'NOBODY HAS CLIMBED HERE YET';
      text(W, 54 + (ROWS * ROW_H) / 2, msg, state.error ? COLORS.red : COLORS.dim);
    }

    const best = Math.floor(this.prog.bestFor(mode));
    text(W, 54 + ROWS * ROW_H + 14, `${playerName(this.prog)}  •  YOUR RECORD ${best} M`, COLORS.blue);
    const change = text(W - 70, 54 + ROWS * ROW_H + 28, '[N] CHANGE NAME', COLORS.green);
    const back = text(W + 70, 54 + ROWS * ROW_H + 28, '[ESC] BACK', COLORS.dim);
    change.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.startEditing());
    back.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.close());
  }

  renderNameEntry(g, text, add) {
    const W = GAME_WIDTH / 2;
    const oy = Math.max(0, Math.round((GAME_HEIGHT - 270) / 2));
    drawPanel(g, W - 120, 44 + oy, 240, 100, { alpha: 0.9 });
    drawPanel(g, W - 90, 78 + oy, 180, 24, { alpha: 0.95, highlight: 0xf2c14e });
    text(W, 52, 'YOUR CLIMBER NAME', COLORS.text);
    text(W, 88, `${this.text}${this.cursor ? '_' : ' '}`, COLORS.text);
    text(W, 108, IS_TOUCH ? 'TAP THE BOX TO TYPE' : 'TYPE IT, ENTER TO CONFIRM', COLORS.faint);
    const skip = text(W, 124, playerName(this.prog) ? '[ESC] KEEP MY NAME' : '[ESC] NOT NOW', COLORS.dim);
    skip.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.cancelEditing());
    add(this.add.zone(W - 90, 78 + oy, 180, 24).setOrigin(0, 0).setInteractive({ useHandCursor: true })).on('pointerdown', () => this.promptForName());
    if (IS_TOUCH && !this.prompted) { this.prompted = true; this.time.delayedCall(150, () => this.promptForName()); }
  }

  promptForName() {
    let v = null;
    try { v = window.prompt('Your climber name', this.text); } catch { v = null; }
    if (v) { this.text = cleanName(v); this.confirmName(); }
  }

  startEditing() {
    this.editing = true;
    this.text = '';
    window.__atcTyping = true;
    Audio.play('select');
    this.render();
  }

  cancelEditing() {
    if (!playerName(this.prog)) { this.close(); return; }
    this.editing = false;
    window.__atcTyping = false;
    this.render();
    this.fetchBoard();
  }

  confirmName() {
    if (!setPlayerName(this.prog, this.text)) { Audio.play('denied'); return; }
    Audio.play('buy');
    this.editing = false;
    window.__atcTyping = false;
    this.rows = {};
    this.render();
    // Give the first upload a moment to land before the list is fetched.
    this.time.delayedCall(700, () => this.fetchBoard());
  }

  changeMode(d) {
    const n = BALANCE.modeOrder.length;
    this.modeIndex = (this.modeIndex + d + n) % n;
    Audio.play('ui');
    this.render();
    this.fetchBoard();
  }

  onKey(event) {
    if (event.repeat) return;
    const code = event.code;
    if (this.editing) {
      if (code === 'Escape') this.cancelEditing();
      else if (code === 'Enter') this.confirmName();
      else if (code === 'Backspace') { this.text = this.text.slice(0, -1); this.render(); }
      else if (code === 'Space' || code === 'Minus') { if (this.text.length < NAME_MAX) { this.text += code === 'Space' ? ' ' : '-'; Audio.play('ui'); this.render(); } }
      else {
        const m = /^(?:Key([A-Z])|Digit([0-9])|Numpad([0-9]))$/.exec(code);
        if (m && this.text.length < NAME_MAX) { this.text += m[1] || m[2] || m[3]; Audio.play('ui'); this.render(); }
      }
      return;
    }
    switch (code) {
      case 'ArrowLeft': case 'KeyA': this.changeMode(-1); break;
      case 'ArrowRight': case 'KeyD': this.changeMode(1); break;
      case 'KeyN': this.startEditing(); break;
      case 'Escape': case 'Backspace': case 'KeyL': case 'Enter': this.close(); break;
      default: break;
    }
  }

  close() {
    Audio.play('ui');
    this.scene.stop();
    this.scene.resume(this.returnTo);
  }
}
