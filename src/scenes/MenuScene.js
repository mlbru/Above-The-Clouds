import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH, CAMERA_ANCHOR } from '../config/gameConfig.js';
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
    this.cameras.main.setScroll(0, Math.round(this.camY));
    this.wall.update(0, 30, this.camY - 200, this.camY + GAME_HEIGHT);
    this.wall.flush();
    this.t = 0;

    this.ui = [];
    this.list = null;
    this.input.keyboard.addCapture('UP,DOWN,LEFT,RIGHT,SPACE');
    this.input.keyboard.on('keydown', this.onKey, this);
    this.input.on('pointerdown', () => Audio.init());
    this.events.once('shutdown', () => {
      this.input.keyboard.off('keydown', this.onKey, this);
      this.wall.destroy();
    });
    this.showMain();
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

  showMain() {
    this.clearUI();
    const d = this.prog.data;
    this.add2(new PixelText(this, GAME_WIDTH / 2 + 1, 26, 'ABOVE THE CLOUDS', { color: '#ffffff', shadow: '#2a2440' }).setOrigin(0.5, 0).setScale(3));
    this.add2(new PixelText(this, GAME_WIDTH / 2, 48, 'AN ENDLESS CLIMB', { color: COLORS.dim }).setOrigin(0.5, 0));
    const modes = BALANCE.modeOrder;
    const curMode = () => (modes.includes(this.prog.settings.mode) ? this.prog.settings.mode : 'normal');
    const cycle = (d) => {
      const i = (modes.indexOf(curMode()) + d + modes.length) % modes.length;
      this.prog.setSetting('mode', modes[i]);
      blurb.setText(BALANCE.modes[modes[i]].blurb).setColor(modes[i] === 'normal' ? COLORS.dim : COLORS.red);
    };
    this.panel(GAME_WIDTH / 2 - 70, 64, 140, 94);
    const blurb = this.add2(new PixelText(this, GAME_WIDTH / 2, 140, BALANCE.modes[curMode()].blurb, { color: curMode() === 'normal' ? COLORS.dim : COLORS.red }).setOrigin(0.5, 0));
    blurb.setY(162);
    this.list = new MenuList(this, GAME_WIDTH / 2, 72, [
      { label: () => `MODE < ${BALANCE.modes[curMode()].label} >`, onLeft: () => cycle(-1), onRight: () => cycle(1), onSelect: () => cycle(1) },
      { label: 'CLIMB', onSelect: () => this.startClimb() },
      { label: () => (d.tutorialDone ? 'TUTORIAL' : 'TUTORIAL (NEW!)'), onSelect: () => this.startClimb(true) },
      ...(d.cheats && d.cheats.devTeleport ? [{ label: 'DEV: TELEPORT', onSelect: () => this.showTeleport() }] : []),
      { label: 'WARDROBE', onSelect: () => this.openWardrobe() },
      { label: 'SETTINGS', onSelect: () => this.showSettings() },
      { label: 'CONTROLS', onSelect: () => this.showControls() },
      { label: () => (isFullscreen() ? 'EXIT FULLSCREEN (F)' : 'FULLSCREEN (F)'), onSelect: () => toggleFullscreen().then(() => this.list && this.list.refresh()) },
    ], { depth: DEPTH.hud + 1, start: d.tutorialDone ? 1 : 2 });
    const biomes = d.biomes.map((b) => BIOMES[b] && BIOMES[b].name.replace('THE ', '')).filter(Boolean).join(', ') || 'NONE YET';
    const bm = d.bestByMode || {};
    this.add2(new PixelText(this, GAME_WIDTH / 2, GAME_HEIGHT - 36, `RECORDS  NORMAL ${Math.floor(bm.normal || 0)} M   HARD ${Math.floor(bm.hard || 0)} M   SUMMIT ${Math.floor(bm.summit || 0)} M`, { color: COLORS.gold }).setOrigin(0.5, 0));
    const stats = `BEST ${Math.floor(d.bestHeight)} M   CLIMBED ${Math.floor(d.totalClimbed)} M   STREAK ${d.bestStreak || 0}   GEMS ◆${this.prog.gems}   VIEWPOINTS ${d.viewpoints.length}   FINDS ${d.discoveries.length}`;
    this.add2(new PixelText(this, GAME_WIDTH / 2, GAME_HEIGHT - 26, stats, { color: COLORS.text }).setOrigin(0.5, 0));
    this.add2(new PixelText(this, GAME_WIDTH / 2, GAME_HEIGHT - 16, `AREAS: ${biomes}`, { color: COLORS.faint }).setOrigin(0.5, 0));
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

  openWardrobe() {
    this.scene.launch('Shop', { mode: 'wardrobe', returnTo: 'Menu' });
    this.scene.pause();
  }

  startClimb(tutorial = false, devStart = null) {
    Audio.init();
    this.cameras.main.fadeOut(400, 10, 12, 20);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Climb', { tutorial, devStart }));
  }

  onKey(event) {
    Audio.init();
    if (event.repeat || !this.list) return;
    this.list.handleKey(event.code);
  }

  update(time, delta) {
    this.t += delta;
    this.dayNight.update(delta);
    const day = this.dayNight.state();
    const alt = 3 + Math.sin(this.t / 9000) * 3;
    this.background.update(delta, alt, day, { birds: 1 }, { mix: biomeMixAt(alt) });
    this.weather.update(delta, { biome: BIOMES.green, alt, light: day.light, reduced: this.prog.settings.reducedParticles });
    this.overlay.fillColor = day.light;
    this.wall.update(delta, 30, this.camY - 200, this.camY + GAME_HEIGHT);
    this.climber.setFrame(Math.floor(this.t / 2600) % 2 ? 'look2' : 'look');
    Audio.setAmbience({ wind: 0.25, stream: 0, birds: day.night < 0.4 ? 1 : 0 });
    Audio.update();
  }
}
