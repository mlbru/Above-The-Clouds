import Phaser from 'phaser';
import { SunRays } from '../world/SunRays.js';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH, CAMERA_ANCHOR, PX_PER_METER, LEVEL_PX, RENDER_AHEAD_LEVELS, levelToMeters, camXFor, IS_PORTRAIT } from '../config/gameConfig.js';
import { Mountain } from '../systems/SegmentGenerator.js';
import { randomSeed } from '../utils/seededRandom.js';
import { DayNightSystem, sunHeight, lowSun } from '../systems/DayNightSystem.js';
import { WeatherSystem } from '../systems/WeatherSystem.js';
import { Background } from '../world/Background.js';
import { Atmosphere } from '../world/Atmosphere.js';
import { wipeOut, wipeIn } from '../utils/transition.js';
import { WallRenderer } from '../world/WallRenderer.js';
import { Audio } from '../systems/AudioSystem.js';
import { PixelText, COLORS, drawPanel } from '../ui/PixelText.js';
import { FancyMenu } from '../ui/FancyMenu.js';
import { CampMenu } from '../ui/CampMenu.js';
import { forecastLines } from '../data/forecast.js';
import { bramGreeting } from '../data/bramTalk.js';
import { mountainMode, activeThinAir } from '../data/thinAir.js';
import { liftHeight } from '../data/lifts.js';
import { cleanDares, dareLabel, dareScale } from '../data/dares.js';
import { CodeEntry } from '../ui/CodeEntry.js';
import { buildClimberTexture } from '../render/textures.js';
import { BIOMES, biomeMixAt, setBiomeTheme } from '../data/biomes.js';
import { SEASONS, currentSeason } from '../data/seasons.js';
import { lerpColor, warmthOf } from '../utils/color.js';
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

// Your local time of day as the game's day phase (0 dawn, 0.2 midday,
// 0.54 sunset, 0.69+ night), so the title camp matches the sky outside.
export function realClockT(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60;
  const keys = [[0, 0.82], [5.5, 0.97], [6.5, 0.02], [8.5, 0.09], [12, 0.24], [16.5, 0.44], [19, 0.54], [20.5, 0.62], [22, 0.7], [24, 0.82]];
  for (let i = 0; i < keys.length - 1; i++) {
    const [h0, t0] = keys[i], [h1, t1] = keys[i + 1];
    if (h >= h0 && h <= h1) {
      let a = t0, b = t1;
      if (b < a) b += 1;
      return ((a + ((h - h0) / (h1 - h0)) * (b - a)) % 1 + 1) % 1;
    }
  }
  return 0.24;
}

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    setBiomeTheme(null);
    this.prog = this.registry.get('progression');
    buildClimberTexture(this, this.prog.data.look);
    // The title camp is the start of the next run: same seed, same mountain,
    // so picking CLIMB carries straight on from what you see here.
    // The next mountain is saved, so reloading at camp shows the same one; it
    // only moves on once a run has really left base camp (ClimbScene).
    this.seed = this.registry.get('nextSeed') ?? urlSeed() ?? this.prog.data.nextSeed ?? randomSeed();
    this.registry.set('nextSeed', this.seed);
    if (this.prog.data.nextSeed !== this.seed && urlSeed() === null) { this.prog.data.nextSeed = this.seed; this.prog.save(); }
    this.starting = false;
    this.season = currentSeason();
    this.campMenu = null;
    this.wall = null;
    this.climber = null;
    // The camp follows your own clock: morning light in the morning, a starry
    // night with fireflies late at night. It drifts on slowly from there.
    this.dayNight = new DayNightSystem({ width: GAME_WIDTH, dayLengthSec: 1800, startT: this.registry.get('dayT') ?? realClockT() });
    this.campLife = { smokeT: 0, flies: [] };
    if (typeof window !== 'undefined') window.__menu = this;
    this.sunRays = null;
    this.background = new Background(this);
    this.buildWorld();
    this.weather = new WeatherSystem(this);
    this.overlay = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffffff).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.light).setBlendMode(Phaser.BlendModes.MULTIPLY);
    // Aerial depth: the upper wall fades into the haze of the sky, so the
    // rock reads as rising away from you rather than as a flat backdrop.
    this.haze = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.mist - 1);
    // The hour's colour added into the shadows (see ClimbScene's grade).
    this.lift = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.light + 1).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
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
    this.events.on('resume', () => {
      // A new Thin Air tier (or dares that switch it off) means a different mountain.
      const want = activeThinAir(this.prog.data);
      const changed = this.registry.get('campChanged');
      this.registry.set('campChanged', false);
      if (want !== this.builtTier || changed) { this.buildWorld(); if (this.campMenu && this.campMenu.visible) this.showMain(); return; }
      if (this.list) this.list.refresh(); else if (this.campMenu && this.campMenu.visible) this.showMain();
    });
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
          map: () => this.showMap(),
          thinAir: () => this.showThinAir(),
          requests: () => this.showRequests(),
        },
        dares: () => {
          const ids = cleanDares(this.prog.settings.dares);
          return ids.length ? `${dareLabel(ids)} X${dareScale(ids).toFixed(2)}` : 'NONE';
        },
        subtitle: () => {
          const tier = activeThinAir(this.prog.data);
          const best = Math.floor(tier ? this.prog.thinAirBestFor(tier) : this.prog.bestFor(this.mode));
          const line = best ? `BEST ${best} M` : 'AN ENDLESS CLIMB TO THE BEAT';
          return this.season ? `${SEASONS[this.season].greeting}  •  ${line}` : line;
        },
        mode: () => {
          const tier = activeThinAir(this.prog.data);
          if (tier) return { text: `< THIN AIR ${tier} >`, color: '#9fe8ff' };
          return { text: `< ${BALANCE.modes[this.mode].label} >${cleanDares(this.prog.settings.dares).length ? ' + DARES' : ''}`, color: { normal: COLORS.green, hard: COLORS.gold, summit: COLORS.red }[this.mode] };
        },
        // Bram's forecast for this mountain (data/forecast.js): only what the seed fixes.
        forecast: () => {
          const lift = this.prog.data.lift;
          const hello = bramGreeting(this.prog.data);
          return [...(hello ? [hello] : []), ...forecastLines(this.seed, {
            startMeters: lift ? liftHeight(lift) : 0,
            boons: this.mode === 'normal' && !cleanDares(this.prog.settings.dares).length,
          })];
        },
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
    // The camp is the start of the next run: the same mountain, Thin Air included.
    this.mountain = new Mountain(this.seed, BALANCE, mountainMode(this.prog.data));
    this.builtTier = activeThinAir(this.prog.data);
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

  // Lift tickets and mastery: the mountain map (scenes/MapScene.js).
  showMap() {
    this.scene.launch('Map', { returnTo: 'Menu', mode: this.mode });
    this.scene.pause();
  }

  // THIN AIR: Bram's altimeter (scenes/ThinAirScene.js). Its tier shapes the
  // mountain, so the camp is rebuilt when it comes back changed.
  showThinAir() {
    this.scene.launch('ThinAir', { returnTo: 'Menu' });
    this.scene.pause();
  }

  // Camp requests: the corkboard (scenes/RequestsScene.js).
  showRequests() {
    this.scene.launch('Requests', { returnTo: 'Menu' });
    this.scene.pause();
  }

  // Bram's dares: a screen of its own (scenes/DaresScene.js).
  showDares() {
    this.scene.launch('Dares', { returnTo: 'Menu' });
    this.scene.pause();
  }

  // The small options menu behind the gear.
  showOptions() {
    this.clearUI();
    const dev = !!(this.prog.data.cheats && this.prog.data.cheats.devTeleport);
    const s = this.prog.settings;
    const items = [
      { label: 'SETTINGS', icon: 'gear', color: 0xd8a6ff, onSelect: () => this.showSettings() },
      { label: 'CONTROLS', icon: 'keys', color: 0x9fd8ff, onSelect: () => this.showControls() },
      { label: 'FULLSCREEN', icon: 'expand', value: () => (isFullscreen() ? 'ON' : 'OFF'), onSelect: () => toggleFullscreen().then(() => this.list && this.list.refresh()) },
      ...(this.prog.debugUnlocked ? [{ label: 'DEBUG OVERLAY', icon: 'bug', color: 0x8fd16a, value: () => (s.debugOverlay ? 'ON' : 'OFF'), onSelect: () => this.prog.setSetting('debugOverlay', !s.debugOverlay) }] : []),
      ...(dev ? [{ label: 'DEV: TELEPORT', icon: 'flag', color: 0xf0644b, onSelect: () => this.showTeleport() }] : []),
      { label: 'BACK', icon: 'back', onSelect: () => this.showMain() },
    ];
    const y = IS_PORTRAIT ? 90 : Math.max(48, Math.floor((GAME_HEIGHT - items.length * 15 - 30) / 2));
    this.add2(new PixelText(this, GAME_WIDTH / 2, y - 22, 'OPTIONS', { color: COLORS.gold }).setOrigin(0.5, 0).setScale(2));
    this.list = new FancyMenu(this, GAME_WIDTH / 2, y, items, { width: 160, depth: DEPTH.hud + 1, onCancel: () => this.showMain() });
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
    this.list = new FancyMenu(this, GAME_WIDTH / 2, 60, [
      ...biomes.map((b) => ({ label: b.name.replace('THE ', ''), icon: 'flag', value: () => `${b.from} M`, onSelect: () => this.startClimb(false, b.from) })),
      { label: 'BACK', icon: 'back', onSelect: () => this.showMain() },
    ], { width: 180, rowH: 12, depth: DEPTH.hud + 1, accent: 0xf0644b, onCancel: () => this.showMain() });
    this.add2(new PixelText(this, GAME_WIDTH / 2, 64 + this.list.height, 'TEST RUN: NO RECORDS, UNLOCKS OR GEMS ARE SAVED', { color: COLORS.dim }).setOrigin(0.5, 0));
  }

  // The settings screen is an overlay of its own (scenes/SettingsScene.js).
  showSettings() {
    this.scene.launch('Settings', { returnTo: 'Menu', onCode: true });
    this.scene.pause();
  }

  showCodeEntry() {
    this.clearUI();
    // Back goes to Settings with the options menu underneath again, so leaving
    // Settings lands on the options and not back in here.
    this.list = new CodeEntry(this, this.prog, () => { this.showOptions(); this.showSettings(); }, { depth: DEPTH.hud + 1 });
  }


  showControls() {
    this.scene.launch('Controls', { returnTo: 'Menu' });
    this.scene.pause();
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
      // Waiting at camp the climber is never still for long: a stretch,
      // chalking up, a drink, checking the map; at night warming the hands
      // and pointing out the stars.
      d.idleT = (d.idleT ?? 4000) - delta;
      if (!c.fidgeting && c.busy === 0 && d.idleT <= 0) {
        const night = this.dayNight.state().night > 0.55;
        const pool = night ? ['warm', 'stargaze', 'look', 'chalk'] : ['stretch', 'chalk', 'drink', 'map', 'look', 'shake'];
        c.fidget(pool[Math.floor(Math.random() * pool.length)], this.effects);
        d.idleT = 5500 + Math.random() * 4500;
      } else if (!c.fidgeting) c.setPose(Math.floor(this.t / 2600) % 2 ? 'look2' : 'look');
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

  // Camp after dark: the tent glows from inside, moths circle Bram's lantern,
  // Bram nods off (a few Zs drifting up), the fire throws more sparks and
  // crackles, and a shooting star now and then makes a little wish sound.
  campNight(dt, day, spots, reduced) {
    const life = this.campLife;
    const n = Math.max(0, Math.min(1, (day.night - 0.35) / 0.4));
    if (!life.night) {
      life.night = {
        tent: spots.tent ? this.add.image(spots.tent.x, spots.tent.y - 7, 'glow').setBlendMode('ADD').setTint(0xffb860).setScale(0.7, 0.45).setDepth(DEPTH.light + 1).setAlpha(0) : null,
        tentLit: spots.tent ? this.add.image(spots.tent.x, spots.tent.y - 5, 'glow_small').setBlendMode('ADD').setTint(0xffd890).setScale(1.6, 1).setDepth(DEPTH.decor + 1).setAlpha(0) : null,
        moths: this.add.graphics().setDepth(DEPTH.light + 1),
        zT: 0, crackT: 0,
      };
      this.background.skyLife.onStar = () => { if (!this.demo.climbing) Audio.play('wish'); };
    }
    const L = life.night;
    const flick = 0.85 + 0.15 * Math.sin(this.t / 90) * Math.sin(this.t / 37);
    if (L.tent) { L.tent.setAlpha(n * 0.5 * flick); L.tentLit.setAlpha(n * 0.6 * flick); }
    const g = L.moths.clear();
    const lamp = spots.trader && spots.trader.lamp;
    if (lamp && n > 0 && !reduced) {
      for (let i = 0; i < 3; i++) {
        const a = this.t / (260 + i * 70) + i * 2.1, r = 5 + i * 2 + Math.sin(this.t / 400 + i) * 2;
        const x = Math.round(lamp.x + Math.cos(a) * r), y = Math.round(lamp.y + Math.sin(a * 1.3) * r * 0.7);
        g.fillStyle(0xfff0d0, n * (Math.floor(this.t / 60 + i) % 2 ? 0.9 : 0.5)).fillRect(x, y, 1, 1);
      }
    }
    // Bram nodding off.
    if (spots.trader && n > 0.6 && !this.demo.climbing && (L.zT -= dt) < 0) {
      L.zT = 1800 + Math.random() * 1600;
      const z = new PixelText(this, spots.trader.x + 4, spots.trader.y - 30, 'z', { color: '#dfe8ff', shadow: '#16141f' }).setDepth(DEPTH.decor + 5).setAlpha(0);
      this.tweens.add({ targets: z, y: z.y - 16, x: z.x + 8, alpha: { from: 0.9, to: 0 }, scale: { from: 0.8, to: 1.4 }, duration: 2200, ease: 'Sine.easeOut', onComplete: () => z.destroy() });
    }
    // The fire: extra sparks and a crackle now and then.
    const fire = spots.fire;
    if (fire && n > 0 && (L.crackT -= dt) < 0) {
      L.crackT = 500 + Math.random() * 1800;
      if (Math.random() < 0.5) Audio.play('crackle');
      if (!reduced) for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
        const e = this.add.rectangle(fire.x + Phaser.Math.Between(-3, 3), fire.y - 6, 1, 1, Math.random() < 0.5 ? 0xffd27a : 0xff8a3c).setDepth(DEPTH.light + 1).setBlendMode('ADD');
        this.tweens.add({ targets: e, y: e.y - Phaser.Math.Between(20, 46), x: e.x + Phaser.Math.Between(-10, 10), alpha: 0, duration: Phaser.Math.Between(700, 1400), ease: 'Sine.easeOut', onComplete: () => e.destroy() });
      }
    }
  }

  // Life at camp: smoke and sparks from the fire, fireflies over the meadow
  // at night, and the rim light of the hour on the wall.
  updateCampLife(dt, day) {
    const spots = this.wall && this.wall.campSpots;
    if (!spots || !spots.fire) return;
    const life = this.campLife;
    const reduced = this.prog.settings.reducedParticles;
    life.smokeT += dt;
    const fire = spots.fire;
    if (life.smokeT > (reduced ? 420 : 200)) {
      life.smokeT = 0;
      const p = this.add.rectangle(fire.x + Phaser.Math.Between(-2, 2), fire.y - 8, 2, 2, day.night > 0.5 ? 0x8a8aa0 : 0xeeeaf4, 0.75).setDepth(DEPTH.decor + 3);
      this.tweens.add({ targets: p, y: p.y - Phaser.Math.Between(34, 56), x: p.x + Phaser.Math.Between(4, 16), scale: 3, alpha: 0, duration: Phaser.Math.Between(1800, 2600), ease: 'Sine.easeOut', onComplete: () => p.destroy() });
      if (Math.random() < 0.35) {
        const e = this.add.rectangle(fire.x + Phaser.Math.Between(-3, 3), fire.y - 6, 1, 1, 0xffb040).setDepth(DEPTH.decor + 3);
        this.tweens.add({ targets: e, y: e.y - Phaser.Math.Between(14, 30), x: e.x + Phaser.Math.Between(-6, 6), alpha: 0, duration: Phaser.Math.Between(700, 1200), onComplete: () => e.destroy() });
      }
    }
    this.campNight(dt, day, spots, reduced);
    // Fireflies come out after dusk and blink as they drift.
    const want = !reduced && day.night > 0.45 ? 16 : 0;
    while (life.flies.length < want) {
      const f = this.add.rectangle(this.camp.x + Phaser.Math.Between(-220, 220), this.camp.y - Phaser.Math.Between(4, 70), 1, 1, 0xd8ff7a).setDepth(DEPTH.decor + 4).setBlendMode('ADD');
      f.base = { x: f.x, y: f.y, p: Math.random() * 10, s: 0.5 + Math.random() };
      life.flies.push(f);
    }
    while (life.flies.length > want) life.flies.pop().destroy();
    for (const f of life.flies) {
      const t = this.t / 1000 * f.base.s + f.base.p;
      f.setPosition(f.base.x + Math.sin(t * 0.7) * 14, f.base.y + Math.sin(t * 1.3) * 6);
      f.setAlpha(Math.max(0, Math.sin(t * 2.1)) * day.night);
    }
    // The wall's rim catches the light of the hour, as on the climb.
    if (this.wall.setRim) {
      const sun = day.sun, moon = day.moon;
      const side = (sun || moon) && (sun || moon).x >= GAME_WIDTH / 2 ? 'r' : 'l';
      const h = sunHeight(day);
      const str = sun ? (0.25 + h * 0.5) * Math.min(1, h / 0.08) : moon ? 0.34 * day.night * (0.45 + day.moonLit * 0.55) * Math.min(1, moon.h / 0.08) : 0;
      const col = sun ? 0xffe0b0 : 0x9fb8ff;
      this.wall.setRim({ [side]: [col, str], [side === 'l' ? 'r' : 'l']: [col, str * 0.18] });
      const height = sun ? h : 0.6;
      const away = side === 'l' ? 1 : -1;
      this.wall.setSun({ dx: away * (1 + (1 - height) * 3), dy: 2 + (1 - height), shadow: sun ? 1 : 0.35 * day.night, shade: sun ? 0.55 - height * 0.2 : 0.3 * day.night, side });
    }
    if (!this.sunRays) this.sunRays = new SunRays(this, DEPTH.light - 2);
    this.sunRays.update(dt, day, { sky: this.background, clouds: this.background.clouds, camY: this.camY, reduced });
  }

  update(time, delta) {
    this.t += delta;
    this.dayNight.update(delta);
    const day = this.dayNight.state();
    // During the intro the scenery follows the camera down from up high.
    const alt = 3 + Math.sin(this.t / 9000) * 3 + Math.max(0, (this.homeY - this.camY) / PX_PER_METER);
    this.background.update(delta, alt, day, { birds: 1 }, { mix: biomeMixAt(alt) });
    this.weather.update(delta, { biome: BIOMES.green, alt, light: day.light, reduced: this.prog.settings.reducedParticles, snowBoost: this.season === 'christmas' ? 0.5 : 0 });
    // The Green Rise keeps its fresh colour even at sunset (half the warmth).
    this.overlay.fillColor = warmthOf(day.light, 0.5);
    const hz = this.haze.clear(), top = GAME_HEIGHT * 0.62;
    for (let i = 0; i < 12; i++) {
      const y0 = Math.round((i * top) / 12), y1 = Math.round(((i + 1) * top) / 12);
      hz.fillStyle(lerpColor(day.skyBottom, day.skyTop, 0.25), 0.3 * (1 - i / 12) ** 1.6 * (1 - day.night * 0.5)).fillRect(0, y0, GAME_WIDTH, y1 - y0);
    }
    this.lift.fillColor = warmthOf(lerpColor(day.lift, 0xff9a40, lowSun(day) * 0.25), 0.5);
    this.lift.setAlpha(day.liftA * 3.5);
    if (!this.introRunning) this.updateDemo(delta);
    this.wall.update(delta, Math.ceil(-(this.camY / LEVEL_PX)) + RENDER_AHEAD_LEVELS, this.camY - 200, this.camY + GAME_HEIGHT);
    if (this.campMenu && this.campMenu.visible) this.campMenu.update(delta, !this.list && !this.demo.climbing && !this.introRunning);
    this.climber.updateLamp(day.night);
    this.wall.night = day.night;
    this.atmos.update(delta, { day, biome: BIOMES.green });
    this.updateCampLife(delta, day);
    Audio.setAmbience({ wind: 0.25, stream: 0, birds: day.night < 0.4 ? 1 : 0 });
    Audio.update();
  }
}
