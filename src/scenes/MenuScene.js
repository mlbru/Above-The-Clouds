import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH, CAMERA_ANCHOR, PX_PER_METER, LEVEL_PX, RENDER_AHEAD_LEVELS, levelToMeters, camXFor } from '../config/gameConfig.js';
import { Mountain } from '../systems/SegmentGenerator.js';
import { randomSeed } from '../utils/seededRandom.js';
import { DayNightSystem } from '../systems/DayNightSystem.js';
import { WeatherSystem } from '../systems/WeatherSystem.js';
import { Background } from '../world/Background.js';
import { Atmosphere } from '../world/Atmosphere.js';
import { wipeOut, wipeIn } from '../utils/transition.js';
import { WallRenderer } from '../world/WallRenderer.js';
import { Audio } from '../systems/AudioSystem.js';
import { PixelText, COLORS, drawPanel } from '../ui/PixelText.js';
import { MenuList } from '../ui/MenuList.js';
import { CampMenu } from '../ui/CampMenu.js';
import { settingsItems, CONTROLS_TEXT } from '../ui/SettingsMenu.js';
import { DARES, DARE, MAX_DARES, cleanDares, dareKey, dareLabel, dareScale } from '../data/dares.js';
import { CodeEntry } from '../ui/CodeEntry.js';
import { buildClimberTexture } from '../render/textures.js';
import { BIOMES, biomeMixAt, setBiomeTheme } from '../data/biomes.js';
import { SEASONS, currentSeason } from '../data/seasons.js';
import { POSES } from '../render/climberArt.js';
import { Climber } from '../entities/Climber.js';
import { Effects } from '../systems/Effects.js';
import { findCosmetic } from '../data/cosmetics.js';
import { BALANCE } from '../config/balanceConfig.js';
import { toggleFullscreen, isFullscreen } from '../utils/fullscreen.js';
import { leaderboardEnabled } from '../systems/Leaderboard.js';



const IDLE_DEMO_MS = 20000;

function urlSeed() {
  try {
    const v = new URLSearchParams(window.location.search).get('seed');
    return v !== null && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : null;
  } catch { return null; }
}

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    setBiomeTheme(null);
    this.prog = this.registry.get('progression');
    buildClimberTexture(this, this.prog.data.look);
    // The title camp is the start of the next run: same seed, same mountain,
    // so picking CLIMB carries straight on from what you see here.
    this.seed = this.registry.get('nextSeed') ?? urlSeed() ?? randomSeed();
    this.registry.set('nextSeed', this.seed);
    this.starting = false;
    this.season = currentSeason();
    this.campMenu = null;
    this.wall = null;
    this.climber = null;
    this.dayNight = new DayNightSystem({ dayLengthSec: 240, startT: this.registry.get('dayT') ?? 0.02 });
    this.background = new Background(this);
    this.buildWorld();
    this.weather = new WeatherSystem(this);
    this.overlay = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffffff).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.light).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.atmos = new Atmosphere(this);
    this.atmos.reduced = this.prog.settings.reducedParticles;
    const camp = this.mountain.getLevel(0).nodes[0];
    this.camp = camp;
    this.climber = new Climber(this, camp.x, camp.y);
    this.climber.setPose('look');
    this.effects = new Effects(this);
    this.effects.reduced = this.prog.settings.reducedParticles;
    this.refreshEffects();
    // Left alone for a while, the climber sets off up the wall by himself
    // (any key or click brings him straight back).
    this.demo = { wait: IDLE_DEMO_MS, climbing: false, run: 0 };
    this.cameras.main.setScroll(this.camX, Math.round(this.camY));
    this.t = 0;

    this.ui = [];
    this.list = null;
    this.input.keyboard.addCapture('UP,DOWN,LEFT,RIGHT,SPACE');
    this.input.keyboard.on('keydown', this.onKey, this);
    Audio.setMusicMode(BIOMES.green.music);
    this.input.on('pointerdown', () => { Audio.init(); if (this.introRunning) this.endIntro(); else this.stopDemo(); });
    this.events.once('shutdown', () => {
      this.input.keyboard.off('keydown', this.onKey, this);
      this.demo.run++;
      this.wall.destroy();
    });
    this.events.on('resume', () => { if (this.list) this.list.refresh(); else if (this.campMenu && this.campMenu.visible) this.showMain(); });
    this.introRunning = false;
    if (!this.registry.get('introShown')) {
      this.registry.set('introShown', true);
      this.playIntro();
    }
    this.showMain();
    if (this.introRunning && this.list) this.list.texts.forEach((t) => t.setAlpha(0));
    // Picked EXPEDITIONS at base camp during a run.
    if (this.registry.get('openExpeditions')) { this.registry.set('openExpeditions', false); this.showExpeditions(); }
    wipeIn(this);
  }

  clearUI() {
    if (this.campMenu) this.campMenu.hide();
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

  // Base camp is the menu (see ui/CampMenu.js); this scene adds the mode
  // switch under CLIMB and the expeditions behind the signpost.
  showMain() {
    this.clearUI();
    if (!this.campMenu) {
      this.campMenu = new CampMenu(this, {
        actions: {
          climb: () => this.startClimb(),
          collection: () => this.openCollection(),
          expeditions: () => this.showExpeditions(),
          shop: () => this.openShop(),
          wardrobe: () => this.openWardrobe(),
          dares: () => this.showDares(),
        },
        dares: () => {
          const ids = cleanDares(this.prog.settings.dares);
          return ids.length ? `${dareLabel(ids)} X${dareScale(ids).toFixed(2)}` : 'NONE';
        },
        subtitle: () => {
          const best = Math.floor(this.prog.bestFor(this.mode));
          const line = best ? `BEST ${best} M` : 'AN ENDLESS CLIMB TO THE BEAT';
          return this.season ? `${SEASONS[this.season].greeting}  •  ${line}` : line;
        },
        mode: () => ({ text: `< ${BALANCE.modes[this.mode].label} >${cleanDares(this.prog.settings.dares).length ? ' + DARES' : ''}`, color: { normal: COLORS.green, hard: COLORS.gold, summit: COLORS.red }[this.mode] }),
        onDown: () => this.cycleMode(1),
        onGear: () => this.showOptions(),
        onBoard: leaderboardEnabled() ? () => this.openLeaderboard() : null,
      });
    }
    this.campMenu.opts.camp = this.camp;
    this.campMenu.opts.spots = this.wall.campSpots;
    this.campMenu.show();
    if (this.introRunning) this.campMenu.setAlpha(0);
  }

  // The mountain and its wall for this.seed in the chosen mode (the mode
  // shapes the climb, so switching it rebuilds the camp you look at).
  buildWorld() {
    if (this.wall) this.wall.destroy();
    this.mountain = new Mountain(this.seed, BALANCE, this.mode);
    this.mountain.ensureLevel(60);
    this.wall = new WallRenderer(this, this.mountain, this.seed);
    this.camp = this.mountain.getLevel(0).nodes[0];
    this.camY = this.camp.y - 50 - GAME_HEIGHT * CAMERA_ANCHOR;
    this.camX = camXFor(this.camp.x);
    this.homeY = this.camY;
    this.wall.update(0, 30, this.camY - 600, this.camY + GAME_HEIGHT);
    this.wall.flush();
    if (this.climber) this.climber.setPosition(this.camp.x, this.camp.y);
  }

  get mode() { return BALANCE.modeOrder.includes(this.prog.settings.mode) ? this.prog.settings.mode : 'normal'; }

  cycleMode(d) {
    const modes = BALANCE.modeOrder;
    this.prog.setSetting('mode', modes[(modes.indexOf(this.mode) + d + modes.length) % modes.length]);
    Audio.play('ui');
    this.buildWorld();
    this.showMain();
  }

  // Bram's dares: pick up to two for the next endless run (data/dares.js).
  showDares() {
    this.clearUI();
    const W = GAME_WIDTH / 2;
    const picked = () => cleanDares(this.prog.settings.dares);
    const toggle = (id) => {
      const now = picked();
      if (now.includes(id)) this.prog.setSetting('dares', now.filter((d) => d !== id));
      else if (now.length < MAX_DARES) this.prog.setSetting('dares', cleanDares([...now, id]));
      else { Audio.play('miss'); return; }
      info();
    };
    this.add2(new PixelText(this, W, 26, "BRAM'S DARES", { color: COLORS.gold }).setOrigin(0.5, 0).setScale(2));
    this.add2(new PixelText(this, W, 44, `PICK UP TO ${MAX_DARES}. EACH ONE: GEMS X${DARE.gemScale}`, { color: COLORS.dim }).setOrigin(0.5, 0));
    this.panel(W - 110, 56, 220, 12 + (DARES.length + 2) * 11 + 30);
    const desc = this.add2(new PixelText(this, W, 62 + (DARES.length + 2) * 11, '', { color: '#dfe8ff' }).setOrigin(0.5, 0));
    const stat = this.add2(new PixelText(this, W, 74 + (DARES.length + 2) * 11, '', { color: COLORS.faint }).setOrigin(0.5, 0));
    const info = () => {
      const ids = picked();
      const best = ids.length ? Math.floor(this.prog.dareBestFor(dareKey(ids, this.mode))) : Math.floor(this.prog.bestFor(this.mode));
      stat.setText(ids.length ? `${BALANCE.modes[this.mode].label} + ${dareLabel(ids)}  •  GEMS X${dareScale(ids).toFixed(2)}  •  BEST ${best} M` : `NO DARES  •  ${BALANCE.modes[this.mode].label} RECORD ${best} M`);
    };
    const items = DARES.map((d) => ({
      label: () => {
        if (this.list && this.list.items[this.list.index] && this.list.items[this.list.index].dare === d.id) desc.setText(d.text).setColor(d.color);
        return `${picked().includes(d.id) ? '[X]' : '[ ]'} ${d.name}`;
      },
      dare: d.id,
      onSelect: () => toggle(d.id),
    }));
    items.push({ label: () => { if (this.list && this.list.index === DARES.length) desc.setText('NO DARES: A NORMAL RUN WITH RECORDS.').setColor(COLORS.dim); return 'CLEAR ALL'; }, onSelect: () => { this.prog.setSetting('dares', []); info(); } });
    items.push({ label: () => { if (this.list && this.list.index === DARES.length + 1) desc.setText('DARED RUNS KEEP THEIR OWN RECORDS.').setColor(COLORS.dim); return 'BACK'; }, onSelect: () => this.showMain() });
    this.list = new MenuList(this, W, 63, items, { depth: DEPTH.hud + 1, onCancel: () => this.showMain() });
    info();
    this.list.refresh();
  }

  // The small options menu behind the gear.
  showOptions() {
    this.clearUI();
    const dev = !!(this.prog.data.cheats && this.prog.data.cheats.devTeleport);
    const items = [
      { label: 'SETTINGS', onSelect: () => this.showSettings() },
      { label: 'CONTROLS', onSelect: () => this.showControls() },
      { label: () => (isFullscreen() ? 'WINDOWED' : 'FULLSCREEN'), onSelect: () => toggleFullscreen().then(() => this.list && this.list.refresh()) },
      ...(dev ? [{ label: 'DEV: TELEPORT', onSelect: () => this.showTeleport() }] : []),
      { label: 'BACK', onSelect: () => this.showMain() },
    ];
    this.add2(new PixelText(this, GAME_WIDTH / 2, 40, 'OPTIONS', { color: COLORS.gold }).setOrigin(0.5, 0).setScale(2));
    this.panel(GAME_WIDTH / 2 - 70, 64, 140, 14 + items.length * 12);
    this.list = new MenuList(this, GAME_WIDTH / 2, 72, items, { depth: DEPTH.hud + 1, spacing: 12, onCancel: () => this.showMain() });
  }

  // First visit: the camera starts up in the clouds and drifts down to base camp.
  playIntro() {
    this.introRunning = true;
    const to = this.camY;
    this.camY = to - 520;
    this.cameras.main.setScroll(this.camX, Math.round(this.camY));
    const st = { y: this.camY };
    this.introTween = this.tweens.add({
      targets: st, y: to, duration: 3200, ease: 'Sine.easeInOut',
      onUpdate: () => { this.camY = st.y; this.cameras.main.setScroll(this.camX, Math.round(st.y)); },
      onComplete: () => this.endIntro(),
    });
  }

  endIntro() {
    if (!this.introRunning) return;
    this.introRunning = false;
    if (this.introTween) this.introTween.stop();
    this.camY = this.homeY;
    this.cameras.main.setScroll(this.camX, Math.round(this.camY));
    this.ui.forEach((o) => { o.setAlpha(0); this.tweens.add({ targets: o, alpha: 1, duration: 500 }); });
    if (this.campMenu) this.campMenu.objs.forEach((o) => { o.setAlpha(0); this.tweens.add({ targets: o, alpha: 1, duration: 500 }); });
    if (this.list) this.list.texts.forEach((t) => { t.setAlpha(0); this.tweens.add({ targets: t, alpha: 1, duration: 500 }); });
    Audio.play('titlecard');
  }

  // Dev only (code WARPZONE): start a run at the beginning of any biome.
  // Teleport runs use a save copy, so nothing they do is kept.
  showTeleport() {
    this.clearUI();
    this.add2(new PixelText(this, GAME_WIDTH / 2, 40, 'DEV: TELEPORT', { color: COLORS.gold }).setOrigin(0.5, 0).setScale(2));
    const biomes = Object.values(BIOMES).filter((b) => !b.special).sort((a, b) => a.from - b.from);
    this.panel(GAME_WIDTH / 2 - 90, 64, 180, 14 + (biomes.length + 1) * 11);
    this.list = new MenuList(this, GAME_WIDTH / 2, 72, [
      ...biomes.map((b) => ({ label: `${b.name.replace('THE ', '')}  ${b.from} M`, onSelect: () => this.startClimb(false, b.from) })),
      { label: 'BACK', onSelect: () => this.showMain() },
    ], { depth: DEPTH.hud + 1, onCancel: () => this.showMain() });
    this.add2(new PixelText(this, GAME_WIDTH / 2, 82 + (biomes.length + 1) * 11, 'TEST RUN: NO RECORDS, UNLOCKS OR GEMS ARE SAVED', { color: COLORS.dim }).setOrigin(0.5, 0));
  }

  showSettings() {
    this.clearUI();
    const items = settingsItems(this.prog, () => this.showMain(), undefined, () => this.showCodeEntry());
    this.add2(new PixelText(this, GAME_WIDTH / 2, 28, 'SETTINGS', { color: COLORS.gold }).setOrigin(0.5, 0).setScale(2));
    this.panel(GAME_WIDTH / 2 - 90, 50, 180, 12 + items.length * 11);
    this.list = new MenuList(this, GAME_WIDTH / 2, 57, items, { depth: DEPTH.hud + 1, onCancel: () => this.showMain() });
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

  openCollection() {
    this.scene.launch('Collection', { returnTo: 'Menu' });
    this.scene.pause();
  }

  openLeaderboard() {
    this.scene.launch('Leaderboard', { returnTo: 'Menu', mode: this.mode });
    this.scene.pause();
  }

  openShop() {
    this.scene.launch('Shop', { mode: 'trader', returnTo: 'Menu', departed: false, gearAllowed: this.mode === 'normal' });
    this.scene.pause();
  }

  openWardrobe() {
    this.scene.launch('Shop', { mode: 'wardrobe', returnTo: 'Menu' });
    this.scene.pause();
  }

  startClimb(tutorial = false, devStart = null, expedition = null) {
    Audio.init();
    if (tutorial || devStart !== null || expedition) {
      wipeOut(this, () => this.scene.start('Climb', { tutorial, devStart, expedition }));
      return;
    }
    // A normal climb starts right here: the words fade and the run takes over
    // the same camp, mountain and time of day.
    if (this.starting) return;
    this.starting = true;
    this.stopDemo();
    this.tweens.add({
      targets: [...this.ui, ...(this.campMenu ? this.campMenu.objs : [])], alpha: 0, duration: 220,
      onComplete: () => {
        this.registry.set('nextSeed', null);
        this.scene.start('Climb', { seed: this.seed, dayT: this.dayNight.t, fromTitle: true });
      },
    });
  }

  // Hand-built mountains with a summit, picked from a lineup of painted peaks.
  showExpeditions() {
    this.scene.launch('Expeditions');
    this.scene.pause();
  }

  // Chalk, trail and hit effect follow the outfit (also after the wardrobe).
  refreshEffects() {
    const look = this.prog.data.look;
    this.effects.setChalk(findCosmetic('chalk', look.chalk || 'chalk-white'));
    this.effects.setTrail(findCosmetic('trail', look.trail || 'trail-none'));
    this.effects.setHit(findCosmetic('hit', look.hit || 'hit-ring'));
  }

  // ---------------------------------------------------------------- title demo climb
  updateDemo(delta) {
    const d = this.demo;
    const c = this.climber;
    if (!d.climbing) {
      c.setPose(Math.floor(this.t / 2600) % 2 ? 'look2' : 'look');
      d.wait -= delta;
      if (d.wait <= 0) this.demoClimb();
      return;
    }
    const h = c.head;
    if (c.busy) this.effects.trail(h.x, h.y + 14);
    // The camera follows the climber up, as in a run.
    const anchor = POSES[c.pose].anchor;
    const focusY = anchor === 54 || anchor === 40 ? c.y - 50 : anchor === 28 ? c.y - 23 : c.y;
    const target = focusY - GAME_HEIGHT * CAMERA_ANCHOR;
    this.camY += (target - this.camY) * (1 - Math.exp((-delta / 1000) * 3));
    this.cameras.main.setScroll(this.camX, Math.round(this.camY));
  }

  // Any input during the demo climb snaps back to camp. Returns true if it did.
  stopDemo() {
    const d = this.demo;
    d.wait = IDLE_DEMO_MS;
    if (!d.climbing) return false;
    d.run++;
    d.climbing = false;
    this.climber.stopTweens();
    this.climber.setPosition(this.camp.x, this.camp.y);
    this.climber.setPose('look');
    this.camY = this.homeY;
    this.cameras.main.setScroll(this.camX, Math.round(this.camY));
    this.children.list.filter((o) => o.isDemoVeil).forEach((o) => o.destroy());
    this.showMain();
    return true;
  }

  // Climbs about 40 m on real routes, a beat per move, then fades back to camp.
  async demoClimb() {
    const d = this.demo;
    if (this.list) { d.wait = IDLE_DEMO_MS; return; }
    const run = ++d.run;
    d.climbing = true;
    this.clearUI();
    const alive = () => d.run === run;
    const wait = (ms) => new Promise((r) => this.time.delayedCall(ms, r));
    const c = this.climber;
    const beat = 340;
    let node = this.camp;
    c.setPose('pull');
    await c.tweenTo(node.x, node.y - 50, 260, 'Quad.easeOut');
    while (alive() && levelToMeters(node.level) < 40) {
      c.setPose('hang');
      await wait(beat * (1 + Math.random()));
      if (!alive()) return;
      const routes = this.mountain.computeRoutes(node);
      if (!routes.length) break;
      const r = routes[Math.floor(Math.random() * routes.length)];
      const t = r.target, from = { x: c.x, y: c.y };
      const notes = r.notes.slice(0, 5);
      for (let i = 0; i < notes.length && alive(); i++) {
        const dir = notes[i].dir;
        const p = Math.min(0.85, ((i + 1) / notes.length) * 0.85);
        const perfect = Math.random() < 0.7;
        c.via(dir === 'L' ? 'reachL_mid' : dir === 'R' ? 'reachR_mid' : 'pull_mid',
          dir === 'L' ? (perfect ? 'perfectL' : 'reachL') : dir === 'R' ? (perfect ? 'perfectR' : 'reachR') : ['pull', 'stepL', 'stepR'][i % 3]);
        c.tweenTo(from.x + (t.x - from.x) * p, from.y + (t.y - from.y) * p, 150, 'Quad.easeOut', perfect ? 40 : 0);
        const hx = c.x + (dir === 'L' ? -10 : dir === 'R' ? 10 : 0);
        this.effects.chalk(hx, c.y - 2);
        if (perfect) { this.effects.sparkle(hx, c.y - 2, 5); this.effects.hit(hx, c.y - 2); c.flash(50); c.squash(0.88, 1.14, 180, 40); }
        await wait(beat);
      }
      if (!alive()) return;
      if (t.kind === 'ledge') {
        c.setPose('mantle');
        await c.tweenTo(t.x, t.y + 4, 180, 'Quad.easeOut');
        c.setPose('stand');
        c.setPosition(t.x, t.y);
        c.squash(1.16, 0.84, 220);
        this.effects.chalk(t.x, t.y);
        await c.hold('stand', 500);
        c.setPose('pull');
        c.setPosition(t.x, t.y - 50);
      } else {
        c.setPose('grab');
        await c.tweenTo(t.x, t.y, 200, 'Back.easeOut');
        this.effects.chalk(t.x, t.y + 2);
        c.squash(1.1, 0.9, 160);
      }
      node = t;
    }
    if (!alive()) return;
    await wait(600);
    // Fade the world (not the menu) to black and back.
    const cam = this.cameras.main;
    const veil = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a0c14).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.hud - 1).setAlpha(0);
    veil.isDemoVeil = true;
    await new Promise((r) => this.tweens.add({ targets: veil, alpha: 1, duration: 500, onComplete: r }));
    if (!alive()) return;
    c.stopTweens();
    c.setPosition(this.camp.x, this.camp.y);
    c.setPose('look');
    this.camY = this.homeY;
    cam.setScroll(this.camX, Math.round(this.camY));
    this.tweens.add({ targets: veil, alpha: 0, duration: 600, onComplete: () => veil.destroy() });
    d.climbing = false;
    d.wait = IDLE_DEMO_MS;
    this.showMain();
  }

  onKey(event) {
    Audio.init();
    if (this.introRunning) { this.endIntro(); return; }
    if (this.stopDemo()) return;
    if (event.repeat) return;
    if (this.list) { this.list.handleKey(event.code); return; }
    if (this.campMenu && this.campMenu.handleKey(event.code)) return;
    if (event.code === 'Escape' && this.campMenu && this.campMenu.visible) this.showOptions();
  }

  update(time, delta) {
    this.t += delta;
    this.dayNight.update(delta);
    const day = this.dayNight.state();
    // During the intro the scenery follows the camera down from up high.
    const alt = 3 + Math.sin(this.t / 9000) * 3 + Math.max(0, (this.homeY - this.camY) / PX_PER_METER);
    this.background.update(delta, alt, day, { birds: 1 }, { mix: biomeMixAt(alt) });
    this.weather.update(delta, { biome: BIOMES.green, alt, light: day.light, reduced: this.prog.settings.reducedParticles, snowBoost: this.season === 'christmas' ? 0.5 : 0 });
    this.overlay.fillColor = day.light;
    if (!this.introRunning) this.updateDemo(delta);
    this.wall.update(delta, Math.ceil(-(this.camY / LEVEL_PX)) + RENDER_AHEAD_LEVELS, this.camY - 200, this.camY + GAME_HEIGHT);
    if (this.campMenu && this.campMenu.visible) this.campMenu.update(delta, !this.list && !this.demo.climbing && !this.introRunning);
    this.climber.updateLamp(day.night);
    this.wall.night = day.night;
    this.atmos.update(delta, { day, biome: BIOMES.green });
    Audio.setAmbience({ wind: 0.25, stream: 0, birds: day.night < 0.4 ? 1 : 0 });
    Audio.update();
  }
}
