import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, IS_PORTRAIT, levelToMeters } from '../config/gameConfig.js';
import { PixelText, COLORS, drawFrame } from '../ui/PixelText.js';
import { FancyMenu } from '../ui/FancyMenu.js';
import { CodeEntry } from '../ui/CodeEntry.js';
import { biomeAt } from '../data/biomes.js';
import { dareLabel } from '../data/dares.js';
import { toCss, lighten } from '../utils/color.js';
import { measureLine } from '../utils/pixelFont.js';
import { toggleFullscreen, isFullscreen } from '../utils/fullscreen.js';
import { wipeOut } from '../utils/transition.js';

export class PauseScene extends Phaser.Scene {
  constructor() { super('Pause'); }

  create() {
    this.prog = this.registry.get('progression');
    this.climb = this.scene.get('Climb');
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a0a14, 0.9).setOrigin(0, 0);
    this.events.on('resume', () => { if (this.list && this.list.refresh) this.list.refresh(); });
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

  text(x, y, str, color = COLORS.text, opts = {}) { return this.add2(new PixelText(this, x, y, str, { color, ...opts })); }

  // Paused: a card with how this run is going, and the menu beside it.
  showMain() {
    this.clear();
    const c = this.climb;
    const tutorial = !!(c && c.tutorial);
    const top = IS_PORTRAIT ? 34 : Math.max(8, Math.floor((GAME_HEIGHT - 230) / 2));
    this.text(12, top, 'PAUSED', COLORS.gold).setScale(2);
    const items = [
      { label: 'RESUME', icon: 'play', color: 0x8fd16a, onSelect: () => this.resume() },
      { label: 'WARDROBE', icon: 'shirt', onSelect: () => this.openWardrobe() },
      { label: 'COLLECTION', icon: 'book', onSelect: () => this.openCollection() },
      { label: 'SETTINGS', icon: 'gear', color: 0xd8a6ff, onSelect: () => this.showSettings() },
      { label: 'CONTROLS', icon: 'keys', color: 0x9fd8ff, onSelect: () => this.showControls() },
      { label: 'FULLSCREEN', icon: 'expand', value: () => (isFullscreen() ? 'ON' : 'OFF'), onSelect: () => toggleFullscreen().then(() => this.list && this.list.refresh()) },
      ...(this.prog.debugUnlocked ? [{ label: 'DEBUG OVERLAY', icon: 'bug', color: 0x8fd16a, value: () => (c && c.debugVisible ? 'ON' : 'OFF'), onSelect: () => { if (c) c.setDebug(!c.debugVisible); } }] : []),
      { label: tutorial ? 'RESTART TUTORIAL' : 'RESTART RUN', icon: 'restart', color: 0xf0644b, onSelect: () => this.confirmRestart() },
      ...(tutorial ? [{ label: 'SKIP TUTORIAL', icon: 'flag', onSelect: () => this.skipTutorial() }] : []),
      { label: 'TITLE SCREEN', icon: 'home', color: 0xf0644b, onSelect: () => this.toTitle() },
    ];
    const menuW = 150;
    const cardW = IS_PORTRAIT ? GAME_WIDTH - 24 : GAME_WIDTH - menuW - 36;
    const cardY = top + 20;
    const cardH = c ? this.runCard(12, cardY, cardW) : 0;
    const mx = IS_PORTRAIT ? GAME_WIDTH / 2 : GAME_WIDTH - 12 - menuW / 2;
    const my = IS_PORTRAIT ? cardY + cardH + 8 : cardY;
    this.list = new FancyMenu(this, mx, my, items, { width: IS_PORTRAIT ? GAME_WIDTH - 24 : menuW, onCancel: () => this.resume() });
  }

  // The run so far, as tiles. Returns the card's height.
  runCard(x, y, w) {
    const c = this.climb, run = c.run;
    const g = this.add2(this.add.graphics());
    const h = c.node ? levelToMeters(c.node.level) : 0;
    const biome = biomeAt(h);
    // The biome's own lightest accent, brightened a little.
    const accent = biome.accentC ? lighten(biome.accentC, 0.3) : 0x9fd8ff;
    const tiles = [
      ['HEIGHT', `${h.toFixed(0)} M`, COLORS.text],
      [c.expedition ? 'BEST HERE' : 'RECORD', `${Math.floor(c.expedition ? run.startBest : c.recordBest || 0)} M`, COLORS.gold],
      ['CLIMBED', `${run.climbed.toFixed(0)} M`, COLORS.text],
      ['GEMS', `+${run.gems || 0}`, '#9fe8ff'],
      ['PERFECTS', `${run.perfects}`, COLORS.green],
      ['BEST STREAK', `${run.bestStreak}`, '#ff9a3c'],
      ['SLIPS', `${run.slips}`, COLORS.dim],
      ['FALLS', `${run.falls}`, run.falls ? COLORS.red : COLORS.dim],
    ];
    const cols = 2, tw = Math.floor((w - 16 - 6) / cols), th = 22;
    const ch = 34 + Math.ceil(tiles.length / cols) * (th + 4) + 12;
    drawFrame(g, x, y, w, ch, { accent, alpha: 0.95 });
    // Where you are and how you are playing.
    const where = c.expedition ? c.expedition.name : c.tutorial ? 'TRAINING CRAG' : biome.name;
    this.text(x + 8, y + 7, where, toCss(accent));
    let px = x + 8;
    const pill = (label, fill, ink = '#16141f') => {
      const pw = measureLine(label) + 6;
      g.fillStyle(fill, 1).fillRect(px + 1, y + 17, pw - 2, 9).fillRect(px, y + 18, pw, 7);
      this.text(px + 3, y + 19, label, ink, { shadow: null });
      px += pw + 3;
    };
    if (!c.expedition && !c.tutorial) pill(`${c.modeCfg.label} MODE`, { normal: 0x8fd16a, hard: 0xf2c14e, summit: 0xf0644b }[c.mode] || 0x8fd16a);
    if (c.dared) pill(`DARE ${dareLabel(c.dares)}`, 0xd83a3a, '#ffd8c8');
    if (c.devRun) pill('DEV', 0x4a4560, COLORS.text);
    tiles.forEach(([label, value, color], i) => {
      const tx = x + 8 + (i % cols) * (tw + 6), ty = y + 32 + Math.floor(i / cols) * (th + 4);
      g.fillStyle(0x0c0a12, 0.8).fillRect(tx, ty, tw, th);
      g.fillStyle(accent, 0.25).fillRect(tx, ty, 2, th);
      this.text(tx + 6, ty + 3, label, COLORS.faint);
      this.text(tx + 6, ty + 10, value, color).setScale(value.length > 8 ? 1 : 2).setY(value.length > 8 ? ty + 12 : ty + 10);
    });
    this.text(x + w - 8, y + ch - 10, `SEED ${c.seed}`, COLORS.faint).setOrigin(1, 0);
    return ch;
  }

  openWardrobe() {
    this.scene.launch('Shop', { mode: 'wardrobe', returnTo: 'Pause' });
    this.scene.pause();
  }

  openCollection() {
    this.scene.launch('Collection', { returnTo: 'Pause' });
    this.scene.pause();
  }

  // The settings screen is an overlay of its own (scenes/SettingsScene.js).
  showSettings() {
    this.scene.launch('Settings', { returnTo: 'Pause', onCode: true });
    this.scene.pause();
  }

  showCodeEntry() {
    this.clear();
    // Back goes to Settings with the pause menu underneath again, so leaving
    // Settings lands on the menu and not back in here.
    this.list = new CodeEntry(this, this.prog, () => { this.showMain(); this.showSettings(); });
  }


  showControls() {
    this.scene.launch('Controls', { returnTo: 'Pause' });
    this.scene.pause();
  }

  confirmRestart() {
    this.clear();
    const w = Math.min(GAME_WIDTH - 24, 260), x = Math.round((GAME_WIDTH - w) / 2), y = Math.floor(GAME_HEIGHT / 2) - 66;
    const g = this.add2(this.add.graphics());
    drawFrame(g, x, y, w, 46, { accent: 0xf0644b, alpha: 0.95 });
    this.text(GAME_WIDTH / 2, y + 8, 'RESTART THIS RUN?', COLORS.red).setOrigin(0.5, 0).setScale(2);
    const where = this.climb && this.climb.expedition ? 'AT THE FOOT OF THE EXPEDITION' : 'FROM BASE CAMP ON A NEW MOUNTAIN';
    this.text(GAME_WIDTH / 2, y + 26, `YOU START AGAIN ${where}.\nRECORDS, DISCOVERIES AND UNLOCKS ARE KEPT.`, COLORS.dim, { align: 'center' }).setOrigin(0.5, 0);
    this.list = new FancyMenu(this, GAME_WIDTH / 2, y + 52, [
      { label: 'NO, KEEP CLIMBING', icon: 'back', color: 0x8fd16a, onSelect: () => this.showMain() },
      { label: 'YES, RESTART', icon: 'restart', color: 0xf0644b, onSelect: () => this.restart() },
    ], { width: 150, onCancel: () => this.showMain() });
  }

  skipTutorial() {
    this.prog.data.tutorialDone = true;
    this.prog.save();
    wipeOut(this, () => { this.scene.stop('Climb'); this.scene.start('Climb', {}); });
  }

  resume() {
    this.scene.stop();
    this.scene.resume('Climb');
  }

  restart() {
    const tutorial = !!(this.climb && this.climb.tutorial);
    const expedition = this.climb && this.climb.expedition ? this.climb.expedition.id : null;
    const devStart = this.climb && this.climb.devRun ? this.climb.devStart : null;
    wipeOut(this, () => { this.scene.stop('Climb'); this.scene.start('Climb', { tutorial, devStart, expedition }); });
  }

  toTitle() {
    if (this.climb && this.climb.dayNight) this.registry.set('dayT', this.climb.dayNight.t);
    wipeOut(this, () => { this.scene.stop('Climb'); this.scene.start('Menu'); });
  }

  onKey(event) {
    if (event.repeat || !this.list) return;
    if (event.code === 'KeyP' && this.list && !(this.list instanceof CodeEntry)) { this.resume(); return; }
    this.list.handleKey(event.code);
  }
}
