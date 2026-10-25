import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH, CAMERA_ANCHOR, PX_PER_METER } from '../config/gameConfig.js';
import { Mountain } from '../systems/SegmentGenerator.js';
import { DayNightSystem } from '../systems/DayNightSystem.js';
import { WeatherSystem } from '../systems/WeatherSystem.js';
import { Background } from '../world/Background.js';
import { WallRenderer } from '../world/WallRenderer.js';
import { Audio } from '../systems/AudioSystem.js';
import { PixelText, COLORS, drawPanel } from '../ui/PixelText.js';
import { MenuList } from '../ui/MenuList.js';
import { settingsItems, CONTROLS_TEXT } from '../ui/SettingsMenu.js';
import { CodeEntry } from '../ui/CodeEntry.js';
import { buildClimberTexture } from '../render/textures.js';
import { BIOMES, biomeMixAt } from '../data/biomes.js';
import { POSES, FRAME_H } from '../render/climberArt.js';
import { BALANCE } from '../config/balanceConfig.js';
import { toggleFullscreen, isFullscreen } from '../utils/fullscreen.js';
import { STAMPS } from '../data/logbook.js';
import { EXPEDITIONS, EXPEDITION_ORDER } from '../data/expeditions.js';
import { ExpeditionMountain } from '../systems/ExpeditionMountain.js';
import { measureLine } from '../utils/pixelFont.js';
import { toCss } from '../utils/color.js';

// Breaks text into lines that fit `maxW` pixels in the pixel font.
function wrap(text, maxW) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (measureLine(next) > maxW && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines.join('\n');
}


export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    this.prog = this.registry.get('progression');
    buildClimberTexture(this, this.prog.data.look);
    this.mountain = new Mountain(424242);
    this.mountain.ensureLevel(60);
    this.dayNight = new DayNightSystem({ dayLengthSec: 240, startT: 0.02 });
    this.background = new Background(this);
    this.wall = new WallRenderer(this, this.mountain, 424242);
    this.weather = new WeatherSystem(this);
    this.overlay = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffffff).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.light).setBlendMode(Phaser.BlendModes.MULTIPLY);
    const camp = this.mountain.getLevel(0).nodes[0];
    this.climber = this.add.sprite(camp.x, camp.y, 'climber', 'look').setOrigin(0.5, POSES.look.anchor / FRAME_H).setDepth(DEPTH.climber);
    this.camY = camp.y - 50 - GAME_HEIGHT * CAMERA_ANCHOR;
    this.homeY = this.camY;
    this.cameras.main.setScroll(0, Math.round(this.camY));
    this.wall.update(0, 30, this.camY - 600, this.camY + GAME_HEIGHT);
    this.wall.flush();
    this.t = 0;

    this.ui = [];
    this.list = null;
    this.input.keyboard.addCapture('UP,DOWN,LEFT,RIGHT,SPACE');
    this.input.keyboard.on('keydown', this.onKey, this);
    Audio.setMusicMode(BIOMES.green.music);
    this.input.on('pointerdown', () => { Audio.init(); if (this.introRunning) this.endIntro(); });
    this.events.once('shutdown', () => {
      this.input.keyboard.off('keydown', this.onKey, this);
      this.wall.destroy();
    });
    this.introRunning = false;
    if (!this.registry.get('introShown')) {
      this.registry.set('introShown', true);
      this.playIntro();
    }
    this.showMain();
    if (this.introRunning && this.list) this.list.texts.forEach((t) => t.setAlpha(0));
  }

  clearUI() {
    if (this.list) { this.list.destroy(); this.list = null; }
    this.ui.forEach((o) => o.destroy());
    this.ui = [];
  }

  add2(o) { o.setScrollFactor(0).setDepth(DEPTH.hud); this.ui.push(o); return o; }

  panel(x, y, w, h) {
    const g = this.add2(this.add.graphics());
    drawPanel(g, x, y, w, h, { alpha: 0.78 });
    return g;
  }

  // Title, a mode switch and the menu on the left, your records on the right;
  // the climber and Bram stay visible at base camp in the middle.
  showMain() {
    this.clearUI();
    const d = this.prog.data;
    const W = GAME_WIDTH / 2;
    const logo = this.add2(new PixelText(this, W, 14, 'ABOVE THE CLOUDS', { color: '#ffffff', shadow: '#2a2440' }).setOrigin(0.5, 0).setScale(3));
    logo.setTint(0xffffff, 0xffffff, 0x9fd8ff, 0x9fd8ff);
    this.logo = logo;
    this.add2(new PixelText(this, W, 38, 'AN ENDLESS CLIMB TO THE BEAT', { color: '#dfe8ff', shadow: '#2a2440' }).setOrigin(0.5, 0));

    // Mode pills.
    const modes = BALANCE.modeOrder;
    const curMode = () => (modes.includes(this.prog.settings.mode) ? this.prog.settings.mode : 'normal');
    const dev = !!(d.cheats && d.cheats.devTeleport);
    const px = 14, py = 60, pw = 134, ph = dev ? 146 : 134;
    this.panel(px, py, pw, ph);
    const pills = this.add2(this.add.graphics());
    const pillW = Math.floor((pw - 8) / modes.length);
    const pillTexts = modes.map((m, i) => {
      const t = this.add2(new PixelText(this, px + 4 + i * pillW + pillW / 2, py + 7, BALANCE.modes[m].label).setOrigin(0.5, 0));
      t.setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.prog.setSetting('mode', m); drawPills(); Audio.play('ui'); });
      return t;
    });
    const blurb = this.add2(new PixelText(this, px + pw / 2, py + 21, '', { color: COLORS.dim }).setOrigin(0.5, 0));
    const drawPills = () => {
      pills.clear();
      modes.forEach((m, i) => {
        const sel = m === curMode();
        const col = m === 'normal' ? 0x8fd16a : m === 'hard' ? 0xf2c14e : 0xf0644b;
        drawPanel(pills, px + 4 + i * pillW, py + 4, pillW - 2, 13, { alpha: sel ? 1 : 0.5, fill: sel ? 0x2e2a3c : 0x16141f, highlight: sel ? col : null });
        pillTexts[i].setColor(sel ? toCss(col) : COLORS.faint);
      });
      const cfg = BALANCE.modes[curMode()];
      blurb.setText(wrap(cfg.blurb, pw - 10)).setColor(curMode() === 'normal' ? COLORS.dim : COLORS.red);
    };
    const cycle = (dd) => {
      const i = (modes.indexOf(curMode()) + dd + modes.length) % modes.length;
      this.prog.setSetting('mode', modes[i]);
      drawPills();
    };
    drawPills();

    this.list = new MenuList(this, px + 12, py + 44, [
      { label: 'CLIMB', onSelect: () => this.startClimb(), onLeft: () => cycle(-1), onRight: () => cycle(1) },
      { label: 'EXPEDITIONS', onSelect: () => this.showExpeditions() },
      { label: () => `LOGBOOK  ${d.stamps.length}/${STAMPS.length}`, onSelect: () => this.openLogbook(), onLeft: () => cycle(-1), onRight: () => cycle(1) },
      ...(dev ? [{ label: 'DEV: TELEPORT', onSelect: () => this.showTeleport() }] : []),
      { label: 'WARDROBE', onSelect: () => this.openWardrobe() },
      { label: 'SETTINGS', onSelect: () => this.showSettings() },
      { label: 'CONTROLS', onSelect: () => this.showControls() },
      { label: () => (isFullscreen() ? 'WINDOWED (F)' : 'FULLSCREEN (F)'), onSelect: () => toggleFullscreen().then(() => this.list && this.list.refresh()) },
    ], { depth: DEPTH.hud + 1, align: 'left', spacing: 12 });
    this.add2(new PixelText(this, px + pw / 2, py + ph - 11, '← → MODE   ↑ ↓ MENU', { color: COLORS.faint }).setOrigin(0.5, 0));

    // Records card.
    const rx = GAME_WIDTH - 14 - 134, ry = 60, rw = 134;
    this.panel(rx, ry, rw, 134);
    const bm = d.bestByMode || {};
    const row = (y, label, value, color = COLORS.text) => {
      this.add2(new PixelText(this, rx + 8, ry + y, label, { color: COLORS.dim }));
      this.add2(new PixelText(this, rx + rw - 8, ry + y, value, { color }).setOrigin(1, 0));
    };
    this.add2(new PixelText(this, rx + rw / 2, ry + 6, 'RECORDS', { color: COLORS.gold }).setOrigin(0.5, 0));
    row(18, 'NORMAL', `${Math.floor(bm.normal || 0)} M`, COLORS.green);
    row(28, 'HARD', `${Math.floor(bm.hard || 0)} M`, COLORS.gold);
    row(38, 'SUMMIT', `${Math.floor(bm.summit || 0)} M`, COLORS.red);
    const g = this.add2(this.add.graphics());
    g.fillStyle(0x4a4560, 1).fillRect(rx + 8, ry + 50, rw - 16, 1);
    row(56, 'BEST STREAK', `${d.bestStreak || 0}`);
    row(66, 'CLIMBED', `${Math.floor(d.totalClimbed)} M`);
    row(76, 'GEMS', `◆${this.prog.gems}`, '#9fe8ff');
    row(86, 'FINDS', `${d.discoveries.length + d.viewpoints.length}`);
    row(96, 'STAMPS', `${d.stamps.length}/${STAMPS.length}`, COLORS.gold);
    // The areas you have seen, as coloured pips.
    this.add2(new PixelText(this, rx + 8, ry + 110, 'AREAS', { color: COLORS.dim }));
    const order = Object.values(BIOMES).sort((a, b) => a.from - b.from);
    order.forEach((b, i) => {
      const seen = d.biomes.includes(b.id);
      const x = rx + rw - 8 - (order.length - i) * 11 + 2;
      g.fillStyle(seen ? b.accentA : 0x2e2a3c, 1).fillRect(x, ry + 110, 8, 6);
      g.lineStyle(1, seen ? 0xf4efe4 : 0x4a4560, seen ? 0.5 : 1).strokeRect(x - 0.5, ry + 109.5, 9, 7);
    });
    this.add2(new PixelText(this, rx + rw / 2, ry + 122, d.runs ? `${d.runs} RUNS SO FAR` : 'THE MOUNTAIN IS WAITING', { color: COLORS.faint }).setOrigin(0.5, 0));

    if (this.introRunning) this.ui.forEach((o) => o.setAlpha(0));
  }

  // First visit: the camera starts up in the clouds and drifts down to base camp.
  playIntro() {
    this.introRunning = true;
    const to = this.camY;
    this.camY = to - 520;
    this.cameras.main.setScroll(0, Math.round(this.camY));
    const st = { y: this.camY };
    this.introTween = this.tweens.add({
      targets: st, y: to, duration: 3200, ease: 'Sine.easeInOut',
      onUpdate: () => { this.camY = st.y; this.cameras.main.setScroll(0, Math.round(st.y)); },
      onComplete: () => this.endIntro(),
    });
  }

  endIntro() {
    if (!this.introRunning) return;
    this.introRunning = false;
    if (this.introTween) this.introTween.stop();
    this.camY = this.homeY;
    this.cameras.main.setScroll(0, Math.round(this.camY));
    this.ui.forEach((o) => { o.setAlpha(0); this.tweens.add({ targets: o, alpha: 1, duration: 500 }); });
    if (this.list) this.list.texts.forEach((t) => { t.setAlpha(0); this.tweens.add({ targets: t, alpha: 1, duration: 500 }); });
    Audio.play('titlecard');
  }

  // Dev only (code WARPZONE): start a run at the beginning of any biome.
  // Teleport runs use a save copy, so nothing they do is kept.
  showTeleport() {
    this.clearUI();
    this.add2(new PixelText(this, GAME_WIDTH / 2, 40, 'DEV: TELEPORT', { color: COLORS.gold }).setOrigin(0.5, 0).setScale(2));
    const biomes = Object.values(BIOMES).sort((a, b) => a.from - b.from);
    this.panel(GAME_WIDTH / 2 - 90, 64, 180, 14 + (biomes.length + 1) * 11);
    this.list = new MenuList(this, GAME_WIDTH / 2, 72, [
      ...biomes.map((b) => ({ label: `${b.name.replace('THE ', '')}  ${b.from} M`, onSelect: () => this.startClimb(false, b.from) })),
      { label: 'BACK', onSelect: () => this.showMain() },
    ], { depth: DEPTH.hud + 1, onCancel: () => this.showMain() });
    this.add2(new PixelText(this, GAME_WIDTH / 2, 82 + (biomes.length + 1) * 11, 'TEST RUN: NO RECORDS, UNLOCKS OR GEMS ARE SAVED', { color: COLORS.dim }).setOrigin(0.5, 0));
  }

  showSettings() {
    this.clearUI();
    this.add2(new PixelText(this, GAME_WIDTH / 2, 40, 'SETTINGS', { color: COLORS.gold }).setOrigin(0.5, 0).setScale(2));
    this.panel(GAME_WIDTH / 2 - 90, 64, 180, 89);
    this.list = new MenuList(this, GAME_WIDTH / 2, 72, settingsItems(this.prog, () => this.showMain(), undefined, () => this.showCodeEntry()), { depth: DEPTH.hud + 1, onCancel: () => this.showMain() });
  }

  showCodeEntry() {
    this.clearUI();
    this.list = new CodeEntry(this, this.prog, () => this.showSettings(), { depth: DEPTH.hud + 1 });
  }


  showControls() {
    this.clearUI();
    this.add2(new PixelText(this, GAME_WIDTH / 2, 40, 'CONTROLS', { color: COLORS.gold }).setOrigin(0.5, 0).setScale(2));
    this.panel(GAME_WIDTH / 2 - 120, 62, 240, 70);
    this.add2(new PixelText(this, GAME_WIDTH / 2 - 110, 70, CONTROLS_TEXT, { color: COLORS.text }));
    this.add2(new PixelText(this, GAME_WIDTH / 2, 140, 'PRESS ON THE BEAT: WHEN THE ARROW REACHES THE LINE.', { color: COLORS.dim }).setOrigin(0.5, 0));
    this.list = new MenuList(this, GAME_WIDTH / 2, 156, [{ label: 'BACK', onSelect: () => this.showMain() }], { depth: DEPTH.hud + 1, onCancel: () => this.showMain() });
  }

  openLogbook() {
    this.scene.launch('Logbook', { returnTo: 'Menu' });
    this.scene.pause();
  }

  openWardrobe() {
    this.scene.launch('Shop', { mode: 'wardrobe', returnTo: 'Menu' });
    this.scene.pause();
  }

  startClimb(tutorial = false, devStart = null, expedition = null) {
    Audio.init();
    this.cameras.main.fadeOut(400, 10, 12, 20);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Climb', { tutorial, devStart, expedition }));
  }

  // Hand-built mountains with a summit. One card per expedition.
  showExpeditions() {
    this.clearUI();
    const W = GAME_WIDTH / 2;
    this.add2(new PixelText(this, W, 28, 'EXPEDITIONS', { color: COLORS.gold }).setOrigin(0.5, 0).setScale(2));
    this.add2(new PixelText(this, W, 46, 'HAND-BUILT MOUNTAINS WITH A REAL SUMMIT. NO FALL LIMIT.', { color: COLORS.dim }).setOrigin(0.5, 0));
    const items = [];
    EXPEDITION_ORDER.forEach((id, i) => {
      const exp = EXPEDITIONS[id];
      const st = this.prog.expedition(id);
      const y = 62 + i * 58;
      this.panel(W - 150, y, 300, 52);
      const top = new ExpeditionMountain(exp).summitLevel * 1.5;
      this.add2(new PixelText(this, W - 140, y + 22, exp.blurb, { color: COLORS.dim }));
      const pages = `JOURNAL ${st.pages.length}/${exp.pitches.length - 1}`;
      const status = st.summits ? `SUMMITED X${st.summits}  •  BEST TIME ${Math.floor(st.bestTime / 60000)}:${String(Math.floor((st.bestTime % 60000) / 1000)).padStart(2, '0')}` : st.best ? `BEST ${Math.floor(st.best)} / ${Math.floor(top)} M` : `${Math.floor(top)} M  •  NOT CLIMBED YET`;
      this.add2(new PixelText(this, W - 140, y + 33, `${status}   ${pages}`, { color: st.summits ? COLORS.gold : COLORS.text }));
      // Progress up the mountain.
      const g = this.add2(this.add.graphics());
      g.fillStyle(0x2e2a3c, 1).fillRect(W - 140, y + 44, 280, 2);
      g.fillStyle(st.summits ? 0xf2c14e : 0x9fd8ff, 1).fillRect(W - 140, y + 44, Math.round(280 * Math.min(1, (st.summits ? top : st.best) / top)), 2);
      items.push({ label: exp.name, onSelect: () => this.startClimb(false, null, id) });
    });
    items.push({ label: 'BACK', onSelect: () => this.showMain() });
    this.list = new MenuList(this, W - 140, 70, items, { depth: DEPTH.hud + 1, align: 'left', spacing: 58, onCancel: () => this.showMain() });
  }

  onKey(event) {
    Audio.init();
    if (this.introRunning) { this.endIntro(); return; }
    if (event.repeat || !this.list) return;
    this.list.handleKey(event.code);
  }

  update(time, delta) {
    this.t += delta;
    this.dayNight.update(delta);
    const day = this.dayNight.state();
    // During the intro the scenery follows the camera down from up high.
    const alt = 3 + Math.sin(this.t / 9000) * 3 + Math.max(0, (this.homeY - this.camY) / PX_PER_METER);
    this.background.update(delta, alt, day, { birds: 1 }, { mix: biomeMixAt(alt) });
    this.weather.update(delta, { biome: BIOMES.green, alt, light: day.light, reduced: this.prog.settings.reducedParticles });
    this.overlay.fillColor = day.light;
    this.wall.update(delta, 30, this.camY - 200, this.camY + GAME_HEIGHT);
    if (this.logo && !this.introRunning) this.logo.y = 14 + Math.round(Math.sin(this.t / 900));
    this.climber.setFrame(Math.floor(this.t / 2600) % 2 ? 'look2' : 'look');
    Audio.setAmbience({ wind: 0.25, stream: 0, birds: day.night < 0.4 ? 1 : 0 });
    Audio.update();
  }
}
