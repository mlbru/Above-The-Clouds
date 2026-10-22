import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';
import { PixelText, COLORS, drawPanel } from '../ui/PixelText.js';
import { MenuList } from '../ui/MenuList.js';
import { settingsItems, CONTROLS_TEXT } from '../ui/SettingsMenu.js';
import { CodeEntry } from '../ui/CodeEntry.js';
import { levelToMeters } from '../config/gameConfig.js';
import { toggleFullscreen, isFullscreen } from '../utils/fullscreen.js';

export class PauseScene extends Phaser.Scene {
  constructor() { super('Pause'); }

  create() {
    this.prog = this.registry.get('progression');
    this.climb = this.scene.get('Climb');
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a0a14, 0.62).setOrigin(0, 0);
    this.ui = [];
    this.list = null;
    this.input.keyboard.on('keydown', this.onKey, this);
    this.events.once('shutdown', () => this.input.keyboard.off('keydown', this.onKey, this));
    this.showMain();
  }

  clear() {
    if (this.list) { this.list.destroy(); this.list = null; }
    this.ui.forEach((o) => o.destroy());
    this.ui = [];
  }

  add2(o) { this.ui.push(o); return o; }

  panel(x, y, w, h) {
    const g = this.add2(this.add.graphics());
    drawPanel(g, x, y, w, h, { alpha: 0.9 });
  }

  showMain() {
    this.clear();
    const c = this.climb;
    this.add2(new PixelText(this, GAME_WIDTH / 2, 36, 'PAUSED', { color: COLORS.gold }).setOrigin(0.5, 0).setScale(2));
    const h = c && c.node ? levelToMeters(c.node.level) : 0;
    const stats = c ? `${c.modeCfg.label} MODE   HEIGHT ${h.toFixed(0)} M   BEST ${Math.floor(this.prog.bestFor(c.mode))} M   CLIMBED THIS RUN ${c.run.climbed.toFixed(0)} M` : '';
    this.add2(new PixelText(this, GAME_WIDTH / 2, 56, stats, { color: COLORS.dim }).setOrigin(0.5, 0));
    if (c) this.add2(new PixelText(this, GAME_WIDTH / 2, 65, `SLIPS ${c.run.slips}   FALLS ${c.run.falls}   PERFECTS ${c.run.perfects}   BEST STREAK ${c.run.bestStreak}   GEMS +${c.run.gems || 0}   SEED ${c.seed}`, { color: COLORS.faint }).setOrigin(0.5, 0));
    this.panel(GAME_WIDTH / 2 - 70, 80, 140, this.climb && this.climb.tutorial ? 110 : 99);
    this.list = new MenuList(this, GAME_WIDTH / 2, 88, [
      { label: 'RESUME', onSelect: () => this.resume() },
      { label: 'WARDROBE', onSelect: () => this.openWardrobe() },
      { label: "BRAM'S LOGBOOK", onSelect: () => this.openLogbook() },
      { label: 'SETTINGS', onSelect: () => this.showSettings() },
      { label: 'CONTROLS', onSelect: () => this.showControls() },
      { label: () => (isFullscreen() ? 'EXIT FULLSCREEN' : 'FULLSCREEN'), onSelect: () => toggleFullscreen().then(() => this.list && this.list.refresh()) },
      { label: () => (this.climb && this.climb.tutorial ? 'RESTART TUTORIAL' : 'RESTART RUN'), onSelect: () => this.confirmRestart() },
      ...(this.climb && this.climb.tutorial ? [{ label: 'SKIP TUTORIAL', onSelect: () => this.skipTutorial() }] : []),
      { label: 'TITLE SCREEN', onSelect: () => this.toTitle() },
    ], { onCancel: () => this.resume() });
  }

  openWardrobe() {
    this.scene.launch('Shop', { mode: 'wardrobe', returnTo: 'Pause' });
    this.scene.pause();
  }

  openLogbook() {
    this.scene.launch('Logbook', { returnTo: 'Pause' });
    this.scene.pause();
  }

  showSettings() {
    this.clear();
    this.add2(new PixelText(this, GAME_WIDTH / 2, 40, 'SETTINGS', { color: COLORS.gold }).setOrigin(0.5, 0).setScale(2));
    this.panel(GAME_WIDTH / 2 - 90, 64, 180, 89);
    this.list = new MenuList(this, GAME_WIDTH / 2, 72, settingsItems(this.prog, () => this.showMain(), undefined, () => this.showCodeEntry()), { onCancel: () => this.showMain() });
  }

  showCodeEntry() {
    this.clear();
    this.list = new CodeEntry(this, this.prog, () => this.showSettings());
  }


  showControls() {
    this.clear();
    this.add2(new PixelText(this, GAME_WIDTH / 2, 40, 'CONTROLS', { color: COLORS.gold }).setOrigin(0.5, 0).setScale(2));
    this.panel(GAME_WIDTH / 2 - 120, 62, 240, 70);
    this.add2(new PixelText(this, GAME_WIDTH / 2 - 110, 70, CONTROLS_TEXT));
    this.list = new MenuList(this, GAME_WIDTH / 2, 142, [{ label: 'BACK', onSelect: () => this.showMain() }], { onCancel: () => this.showMain() });
  }

  confirmRestart() {
    this.clear();
    this.add2(new PixelText(this, GAME_WIDTH / 2, 70, 'RESTART THIS RUN?', { color: COLORS.gold }).setOrigin(0.5, 0).setScale(2));
    this.add2(new PixelText(this, GAME_WIDTH / 2, 90, 'YOU START AGAIN FROM BASE CAMP ON A NEW MOUNTAIN.\nRECORDS, DISCOVERIES AND UNLOCKS ARE KEPT.', { color: COLORS.dim, align: 'center' }).setOrigin(0.5, 0));
    this.panel(GAME_WIDTH / 2 - 50, 112, 100, 30);
    this.list = new MenuList(this, GAME_WIDTH / 2, 118, [
      { label: 'NO, KEEP CLIMBING', onSelect: () => this.showMain() },
      { label: 'YES, RESTART', onSelect: () => this.restart() },
    ], { onCancel: () => this.showMain() });
  }

  skipTutorial() {
    this.prog.data.tutorialDone = true;
    this.prog.save();
    this.scene.stop('Climb');
    this.scene.start('Climb', {});
  }

  resume() {
    this.scene.stop();
    this.scene.resume('Climb');
  }

  restart() {
    const tutorial = !!(this.climb && this.climb.tutorial);
    this.scene.stop('Climb');
    const devStart = this.climb && this.climb.devRun ? this.climb.devStart : null;
    this.scene.start('Climb', { tutorial, devStart });
  }

  toTitle() {
    this.scene.stop('Climb');
    this.scene.start('Menu');
  }

  onKey(event) {
    if (event.repeat || !this.list) return;
    if (event.code === 'KeyP' && this.list && !(this.list instanceof CodeEntry)) { this.resume(); return; }
    this.list.handleKey(event.code);
  }
}
