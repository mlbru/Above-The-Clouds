import Phaser from 'phaser';
import {
  GAME_WIDTH, GAME_HEIGHT, DEPTH, CAMERA_ANCHOR, GENERATE_AHEAD_LEVELS, RENDER_AHEAD_LEVELS, KEEP_BELOW_LEVELS,
  levelToMeters, yToMeters, LEVEL_PX, PX_PER_METER, METERS_PER_LEVEL, camXFor,
} from '../config/gameConfig.js';
import { BALANCE } from '../config/balanceConfig.js';
import { Mountain } from '../systems/SegmentGenerator.js';
import { ComboSystem, timingWindows } from '../systems/ComboSystem.js';
import { GripSystem } from '../systems/GripSystem.js';
import { DayNightSystem } from '../systems/DayNightSystem.js';
import { WeatherSystem } from '../systems/WeatherSystem.js';
import { Effects } from '../systems/Effects.js';
import { Audio } from '../systems/AudioSystem.js';
import { Background } from '../world/Background.js';
import { Atmosphere } from '../world/Atmosphere.js';
import { wipeOut, wipeIn } from '../utils/transition.js';
import { WallRenderer } from '../world/WallRenderer.js';
import { WetWall } from '../world/WetWall.js';
import { Dragon } from '../world/Dragon.js';
import { Critters } from '../world/Critters.js';
import { currentSeason } from '../data/seasons.js';
import { OutfitFx } from '../entities/OutfitFx.js';
import { Climber } from '../entities/Climber.js';
import { HUD } from '../ui/HUD.js';
import { RouteSelector } from '../ui/RouteSelector.js';
import { ComboPrompt } from '../ui/ComboPrompt.js';
import { RestMenu } from '../ui/RestMenu.js';
import { CampMenu } from '../ui/CampMenu.js';
import { PixelText, COLORS } from '../ui/PixelText.js';
import { BIOMES, biomeAt, biomeMixAt, biomeStretchAt, nextBiomeAbove, setBiomeTheme, biomeTheme } from '../data/biomes.js';
import { MASTERY_BIOMES, masteryGoals, starLabel } from '../data/mastery.js';
import { BiomeMechanics } from '../systems/mechanics/index.js';
import { ROCKFALL } from '../systems/mechanics/Rockfall.js';
import { DARKNESS } from '../systems/mechanics/Darkness.js';
import { PRISM_LIGHT, litIndex } from '../systems/mechanics/PrismLight.js';
import { DRAGON_EYE } from '../systems/mechanics/DragonEye.js';
import { sandboxCopy } from '../systems/ProgressionSystem.js';
import { DISCOVERIES } from '../data/discoveries.js';
import { SeededRandom, hashInts, randomSeed } from '../utils/seededRandom.js';
import { buildClimberTexture } from '../render/textures.js';
import { modeConfig, difficultyAt } from '../systems/DifficultySystem.js';
import { TutorialMountain, TUTORIAL_SEED } from '../systems/TutorialMountain.js';
import { TutorialDirector } from '../systems/TutorialDirector.js';
import { TutorialCoach } from '../ui/TutorialCoach.js';
import { BramTip } from '../ui/BramTip.js';
import { RunSummary } from '../ui/RunSummary.js';
import { GoldenCity } from '../systems/GoldenCity.js';
import { leaderboardEnabled, queueSubmit, playerName } from '../systems/Leaderboard.js';
import { JournalCard } from '../ui/JournalCard.js';
import { EXPEDITIONS } from '../data/expeditions.js';
import { ExpeditionMountain } from '../systems/ExpeditionMountain.js';
import { TAG_TIPS } from '../data/bramTips.js';
import { POSES } from '../render/climberArt.js';
import { FIDGET_NAMES, LIVELY_NAMES } from '../entities/Climber.js';
import { WeatherCoat } from '../entities/WeatherCoat.js';
import { DARE, cleanDares, dareKey, dareLabel, dareScale } from '../data/dares.js';
import { GEMS } from '../data/gems.js';
import { GEAR_BY_ID, PERK_BY_ID, GEM_INCOME, GEAR_FX } from '../data/shop.js';
import { findCosmetic } from '../data/cosmetics.js';
import { GEM_TARGET } from '../ui/HUD.js';
import { toCss, lerpColor } from '../utils/color.js';

const MILESTONE_LINES = {
  1: 'HIGHER THAN BIG BEN',
  4: 'ABOVE THE EIFFEL TOWER',
  5: 'ABOVE THE EMPIRE STATE BUILDING',
  9: 'ABOVE THE BURJ KHALIFA',
  other: ['KEEP CLIMBING', "DON'T LOOK DOWN", 'THE AIR GETS THINNER', 'THE CLOUDS ARE BELOW YOU', 'NOBODY HAS BEEN THIS HIGH TODAY'],
};
const EARLY_LINES = { 25: 'ABOVE THE TREETOPS', 50: 'AS HIGH AS NIAGARA FALLS' };

export const STATE = {
  ROUTE_SELECT: 'ROUTE_SELECT',
  CLIMBING_COMBO: 'CLIMBING_COMBO',
  CLIMB_ANIMATION: 'CLIMB_ANIMATION',
  RESTING: 'RESTING',
  VIEWING: 'VIEWING',
  SLIPPING: 'SLIPPING',
  DODGING: 'DODGING',
  FALLING: 'FALLING',
  PAUSED: 'PAUSED',
  RUN_OVER: 'RUN_OVER',
};

const DIR_KEYS = { ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R', ArrowUp: 'U', KeyW: 'U' };
const STAND_HAND = 50;
// How much of a biome a biomeMixAt() blend shows (0..1).
const biomeMixWeight = (mix, id) => (mix.a.id === id ? 1 - mix.t : 0) + (mix.b.id === id ? mix.t : 0);
// Milliseconds on a ledge without input before the climber starts to fidget.
const REST_IDLE_FIRST = 6000;
// F3 is a media key on most Macs (needs fn), and the ` key sends different
// codes on European keyboards, so the debug toggle accepts all of these.
const isDebugKey = (e) => e.code === 'F3' || e.code === 'Backquote' || e.code === 'IntlBackslash' || ['`', '~', '§', '±'].includes(e.key);

function urlSeed() {
  try {
    const v = new URLSearchParams(window.location.search).get('seed');
    return v !== null && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : null;
  } catch { return null; }
}

export class ClimbScene extends Phaser.Scene {
  constructor() { super('Climb'); }

  init(data) {
    this.tutorial = !!(data && data.tutorial);
    // Expeditions: a hand-built mountain with a summit (data/expeditions.js).
    this.expedition = (!this.tutorial && data && EXPEDITIONS[data.expedition]) || null;
    this.seed = this.tutorial ? TUTORIAL_SEED : this.expedition ? this.expedition.seed : (data && data.seed) ?? urlSeed() ?? randomSeed();
    // Dev teleport (code WARPZONE): start at this height on a save copy that is never written.
    this.devStart = this.tutorial || this.expedition ? null : (data && data.devStart) ?? null;
    this.devRun = this.devStart !== null;
    this.quickStart = !!(data && data.quickStart);
    // Started from the title camp: carry on from that view (same time of day).
    this.fromTitle = !!(data && data.fromTitle);
    this.dayT = data && data.dayT != null ? data.dayT : null;
  }

  create() {
    // An expedition with a theme (the volcano, the sky islands) is that biome all the way up.
    setBiomeTheme((this.expedition && this.expedition.theme) || null);
    this.season = this.tutorial || this.expedition ? null : currentSeason();
    this.prog = this.registry.get('progression');
    if (this.devRun) this.prog = sandboxCopy(this.prog);
    this.settings = this.prog.settings;
    Audio.setVolumes(this.settings.music, this.settings.sfx);
    buildClimberTexture(this, this.prog.data.look);

    this.runRng = new SeededRandom(hashInts(this.seed, 31337));
    this.clock = 0;
    this.lastFramePerf = performance.now();
    this.state = null;
    this.paused = false;
    // The scene instance is reused on restart: reset all per-run fields.
    this.runId = (this.runId || 0) + 1;
    this.combo = null;
    this.recovery = null;
    this.route = null;
    this.routes = [];
    this.prevRouteType = null;
    this.photoBusy = false;
    this.viewHint = null;
    this.targetMark = null;
    this.crumbleAt = 0;
    this.crumbleUI = null;
    this.gustAnnounced = null;
    this.runOverUI = null;

    this.mode = this.tutorial || this.expedition ? 'normal' : BALANCE.modes[this.settings.mode] ? this.settings.mode : 'normal';
    this.modeCfg = modeConfig(this.mode);
    // Bram's dares (endless runs only, data/dares.js). A dared run keeps its own record.
    this.dares = this.tutorial || this.expedition ? [] : cleanDares(this.settings.dares);
    this.dared = this.dares.length > 0;
    this.dareKey = this.dared ? dareKey(this.dares, this.mode) : null;
    this.mountain = this.tutorial ? new TutorialMountain(BALANCE) : this.expedition ? new ExpeditionMountain(this.expedition, BALANCE) : new Mountain(this.seed, BALANCE, this.mode);
    this.mountain.ensureLevel(GENERATE_AHEAD_LEVELS);
    this.grip = new GripSystem(BALANCE, this.modeCfg);
    this.dayNight = new DayNightSystem({ dayLengthSec: 600, startT: this.dares.includes('night') ? 0.8 : this.dayT ?? 0.09 });
    this.background = new Background(this);
    this.wall = new WallRenderer(this, this.mountain, this.seed);
    this.wetWall = new WetWall(this, this.mountain);
    this.critters = this.tutorial ? null : new Critters(this, this.mountain, this.seed);
    this.weather = new WeatherSystem(this);
    this.mechanics = this.tutorial ? null : new BiomeMechanics(new SeededRandom(hashInts(this.seed, 4242)));
    this.effects = new Effects(this);
    this.effects.reduced = this.settings.reducedParticles;
    // The Dragon's Spine: the dragon's eye, up in the sky beside the wall.
    this.dragon = new Dragon(this);
    this.lightOverlay = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffffff).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.light).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.atmos = new Atmosphere(this);
    this.atmos.reduced = this.settings.reducedParticles;

    const start = this.mountain.getLevel(0).nodes[0];
    this.climber = new Climber(this, start.x, start.y);
    this.outfit = new OutfitFx(this, this.climber);
    this.coat = new WeatherCoat(this, this.climber);
    this.lastBeat = null;
    this.hud = new HUD(this);
    this.routeUI = new RouteSelector(this, (i, confirm) => this.pickRoute(i, confirm));
    this.comboUI = new ComboPrompt(this);
    this.restUI = new RestMenu(this, (a) => this.restAction(a));
    // Back at base camp during a run you get the title camp menu, not the rest panel.
    this.atCamp = false;
    this.campMenu = this.tutorial || this.expedition ? null : new CampMenu(this, {
      actions: {
        climb: () => this.restAction('continue'),
        collection: () => this.openOverlay('Collection', { returnTo: 'Climb' }),
        expeditions: () => { this.registry.set('openExpeditions', true); this.toMenu(); },
        shop: () => this.openTrader(),
        wardrobe: () => this.openOverlay('Shop', { mode: 'wardrobe', returnTo: 'Climb' }),
      },
      subtitle: () => {
        const best = Math.floor(this.recordBest);
        const used = this.run && this.run.biomeFalls[biomeStretchAt(0)];
        return `BEST ${best} M${used ? '  •  NO SLIPS LEFT HERE' : ''}`;
      },
      onGear: () => this.pauseGame(),
    });
    this.floaters = [];
    this.director = null;
    if (this.tutorial) {
      this.tutorialCard = new TutorialCoach(this);
      this.director = new TutorialDirector(this, this.tutorialCard);
    }
    this.tips = this.tutorial ? null : new BramTip(this, this.prog, { onOpen: () => this.freezeForTip(), onClose: () => this.unfreezeForTip() });
    this.frozenTweens = null;
    this.journal = new JournalCard(this);
    this.city = new GoldenCity(this);
    this.setupLava(start);

    this.cam = this.cameras.main;
    this.cam.setRoundPixels(true);
    this.camY = start.y - STAND_HAND - GAME_HEIGHT * CAMERA_ANCHOR;
    this.camX = camXFor(start.x);
    this.cam.setScroll(this.camX, Math.round(this.camY));
    this.lookOffset = 0;
    this.revealUntil = 0;
    this.panoramaUntil = 0;
    this.panoramaBars = null;

    this.node = start;
    this.checkpoint = start;
    this.run = { climbed: 0, slips: 0, falls: 0, perfects: 0, flawless: 0, firstSlip: true, newBestShown: false, startBest: this.tutorial ? 0 : this.recordBest, streak: 0, bestStreak: 0 };
    this.run.dares = this.dares;
    this.run.gems = 0;
    // For the run summary and the logbook.
    this.run.mode = this.expedition ? 'expedition' : this.mode;
    if (this.expedition) this.run.startBest = this.prog.expedition(this.expedition.id).best;
    this.run.stones = {};
    this.run.finds = [];
    this.run.stamps = [];
    this.run.riskyRow = 0;
    this.run.whiteoutClimbs = 0;
    this.run.bare = true;
    // One lost grip per biome: caught or not, the second slip in the same biome ends the run.
    this.run.biomeFalls = {};
    this.run.heightMarks = 0;
    this.gearAllowed = !this.tutorial && this.mode === 'normal';
    this.gear = {};
    this.liftTo = null;
    this.lifting = false;
    this.perk = null;
    this.traderTag = null;
    this.routeGems = [];
    this.pendingGem = null;
    this.recordMark = null;
    this.recordPassed = false;
    this.biomeMark = null;
    this.trailAt = null;
    this.biomeId = null;
    this.debugVisible = this.prog.debugUnlocked && !!this.settings.debugOverlay;
    this.bot = null;
    this.lastJudge = '-';
    this.eventT = 0;
    this.auroraT = 0;
    this.floatT = 0;
    this.sitting = false;

    this.wall.update(0, RENDER_AHEAD_LEVELS, this.camY, this.camY + GAME_HEIGHT);
    this.wall.flush();

    this.input.keyboard.addCapture('UP,DOWN,LEFT,RIGHT,SPACE');
    this.input.keyboard.on('keydown', this.onKeyDown, this);
    this.input.keyboard.on('keyup', this.onKeyUp, this);
    this.onBlur = () => this.pauseGame();
    this.game.events.on('blur', this.onBlur);
    this.events.on('resume', this.onResume, this);
    this.events.once('shutdown', this.cleanup, this);

    if (!this.tutorial) this.prog.startRun();
    this.refreshLook();
    this.updateGearHud();
    this.checkBiome(0);
    this.run.passes = {};
    this.run.pass = null;
    this.trackPass(0, true);
    this.enterRest(start, { initial: true });
    // Base camp is the title screen now: a run goes straight to the routes.
    if (!this.tutorial) this.leaveRest();
    // Coming from the title the HUD fades in (in update(), so a tip that
    // freezes the tweens cannot hold it back).
    this.hudFade = this.fromTitle ? this.hud.root.map((o) => { const to = o.alpha; o.setAlpha(0); return { o, to }; }) : null;
    this.hudFadeT = 0;
    if (this.devRun && this.devStart > 0) this.startHigh(this.devStart);
    else if (this.liftTo) this.rideLift();
    if (typeof window !== 'undefined') window.__atc = this;
    wipeIn(this);
  }

  // Jumps the run up to the first rest ledge above `meters`: you start there,
  // and it is your checkpoint, so a fall never drops you back a biome.
  startHigh(meters) {
    this.run.newBestShown = true;
    this.run.milestone = Infinity;
    this.lifting = true;
    this.debugTeleport(meters + 1);
    for (let guard = 0; this.state !== STATE.RESTING && guard < 200; guard++) this.debugTeleport(levelToMeters(this.node.level) + 0.1);
    this.lifting = false;
    this.hud.toastQueue.length = 0;
    this.run.milestone = Math.floor(levelToMeters(this.node.level) / 100);
    // Let the biome's mechanic see where we landed, then offer routes again.
    this.mechanics.update(1, biomeMixAt(levelToMeters(this.node.level)));
    if (this.state === STATE.ROUTE_SELECT) { this.routeUI.hide(); this.enterRouteSelect(); }
  }

  // A lift ticket from the trader: the run starts up in a higher biome.
  rideLift() {
    const ticket = GEAR_BY_ID[this.liftTo];
    // Height you skip pays no gems; only what you climb from there on does.
    this.startHigh(ticket.lift);
    this.run.heightMarks = Math.floor((this.run.maxHeight || 0) / GEM_INCOME.heightEvery);
    const b = biomeAt(levelToMeters(this.node.level));
    this.hud.showBanner(b.name, `${ticket.name}  •  ${Math.floor(levelToMeters(this.node.level))} M`);
    Audio.setMusicMode(b.music);
    Audio.play('titlecard');
    this.updateGearHud();
  }

  // ---------------------------------------------------------------- timing
  // Pausable game clock plus sub-frame precision from the DOM event timestamp.
  now(event) {
    const pn = performance.now();
    let t = this.clock + Phaser.Math.Clamp(pn - this.lastFramePerf, 0, 50);
    if (event && event.timeStamp) {
      const lag = pn - event.timeStamp;
      if (lag > 0 && lag < 120) t -= lag;
    }
    return t;
  }

  get forgiving() { return this.settings.forgiving && this.modeCfg.allowForgiving; }

  // ---------------------------------------------------------------- input
  onKeyUp(event) {
    const dir = DIR_KEYS[event.code];
    if (!dir || this.state !== STATE.CLIMBING_COMBO || !this.combo) return;
    const broken = this.combo.release(dir, this.now(event));
    if (broken) this.onNote(broken);
  }

  onKeyDown(event) {
    if (event.repeat) return;
    const code = event.code;
    Audio.init();
    this.wakeUp();
    if (this.director && this.tutorialCard.open) {
      if (code === 'Escape' && this.tutorialCard.final) { this.prog.data.tutorialDone = true; this.prog.save(); this.toMenu(); }
      else if (code === 'Escape' || code === 'KeyP') this.pauseGame();
      else if (code === 'Space' || code === 'Enter' || DIR_KEYS[code] === 'U') this.tutorialCard.close();
      return;
    }
    if (this.state === STATE.RUN_OVER && code === 'Escape') { this.toMenu(); return; }
    if (this.state === STATE.RUN_OVER && code === 'KeyL' && this.runOverUI && this.runOverUI.canOpenBoard) { this.openLeaderboard(); return; }
    if (this.journal.open) {
      if (code === 'Escape' || code === 'KeyP') this.pauseGame();
      else if (DIR_KEYS[code] || code === 'Space' || code === 'Enter') this.journal.close();
      return;
    }
    if (this.tipOpen) {
      if (code === 'Escape' || code === 'KeyP') this.pauseGame();
      else if (DIR_KEYS[code] || code === 'Space' || code === 'Enter') this.tips.skip();
      return;
    }
    if (code === 'Escape' || code === 'KeyP') { this.pauseGame(); return; }
    if (isDebugKey(event) && this.prog.debugUnlocked) { this.setDebug(!this.debugVisible); return; }
    if (code === 'KeyB' && this.debugVisible && this.prog.debugUnlocked) {
      const modes = [null, 'perfect', 'sloppy'];
      const next = modes[(modes.indexOf(this.bot ? this.bot.mode : null) + 1) % modes.length];
      this.bot = next ? { mode: next, wait: 0, plans: null } : null;
      this.hud.toast(`AUTOPILOT: ${next ? next.toUpperCase() : 'OFF'}`, COLORS.blue);
      return;
    }
    const dir = DIR_KEYS[code];
    const confirm = code === 'Space' || code === 'Enter';
    if (this.inPanorama && (dir || confirm)) { this.endPanorama(); return; }
    switch (this.state) {
      case STATE.ROUTE_SELECT:
        if (code === 'ArrowLeft' || code === 'KeyA') this.cycleRoute(-1);
        else if (code === 'ArrowRight' || code === 'KeyD') this.cycleRoute(1);
        else if (dir === 'U' || confirm) this.pickRoute(this.selected, true);
        else if (/^Digit[1-3]$/.test(code)) this.pickRoute(Number(code.slice(5)) - 1, true);
        break;
      case STATE.CLIMBING_COMBO:
        if (dir) this.comboInput(dir, this.now(event));
        break;
      case STATE.SLIPPING:
        if (dir && this.recovery) this.recoveryInput(dir, this.now(event));
        break;
      case STATE.DODGING:
        if (dir) this.dodgeInput(dir, this.now(event));
        break;
      case STATE.RESTING:
        if (this.atCamp) { this.campMenu.handleKey(code); break; }
        if (code === 'KeyR' || code === 'ArrowDown' || code === 'KeyS') this.restAction('rest');
        else if (code === 'KeyV') this.restAction('view');
        else if (code === 'KeyC') this.restAction('photo');
        else if (code === 'KeyT') this.restAction('trader');
        else if (confirm || dir === 'U') this.restAction('continue');
        break;
      case STATE.VIEWING:
        this.exitView();
        break;
      case STATE.RUN_OVER:
        if (confirm || dir === 'U') this.climbAgain();
        break;
      default:
        break;
    }
  }

  // The debug overlay (F3, the ` key, or DEBUG OVERLAY in the pause and
  // options menus), only after the debug code. It stays on between runs.
  setDebug(on) {
    this.debugVisible = on;
    this.prog.setSetting('debugOverlay', on);
    if (!on) { this.hud.setDebug(null); if (this.bot) { this.bot = null; this.hud.toast('AUTOPILOT: OFF', COLORS.blue); } }
    else this.hud.toast('DEBUG ON  •  B: AUTOPILOT', COLORS.green);
  }

  pauseGame() {
    if (this.paused || !this.sys.isActive() || this.state === STATE.RUN_OVER) return;
    this.paused = true;
    Audio.setPaused(true);
    this.scene.launch('Pause');
    this.scene.pause();
  }

  onResume() {
    this.paused = false;
    if (this.atCamp) { this.campMenu.show(); this.hud.setVisible(false); }
    this.settings = this.prog.settings;
    this.effects.reduced = this.settings.reducedParticles;
    Audio.setPaused(false);
    Audio.setVolumes(this.settings.music, this.settings.sfx);
    this.lastFramePerf = performance.now();
    this.shiftTiming(BALANCE.timing.resumeShiftMs);
    if (this.bot) this.bot.plans = null;
    this.refreshLook();
    this.updateGearHud();
  }

  // Gives the player a moment to find the rhythm again (after a pause or a tip).
  shiftTiming(shift) {
    if (this.state === STATE.CLIMBING_COMBO && this.combo) this.combo.shift(shift);
    if (this.state === STATE.SLIPPING && this.recovery) this.recovery.shift(shift);
    if (this.state === STATE.DODGING && this.dodge) {
      this.dodge.shift(shift);
      if (this.dodgeRock) {
        // Restart the rock's drop so it still lands on the (shifted) beat.
        this.tweens.killTweensOf(this.dodgeRock);
        this.tweens.add({ targets: this.dodgeRock, y: this.climber.y - 22, duration: Math.max(200, this.dodge.notes[0].time - this.now()), ease: 'Quad.easeIn' });
      }
    }
    if (this.state === STATE.ROUTE_SELECT && this.crumbleAt) this.crumbleAt = Math.max(this.crumbleAt, this.clock + 1200);
  }

  // While Bram talks the game clock stops (combos, crumbling, crystals and the
  // grip drain all run on it) and every running tween holds still.
  // Tweens started while frozen (a rock that was about to drop, the slide of
  // a slip) are caught on the next frame. Bram's own bubble keeps moving.
  freezeForTip() {
    this.frozenTweens = this.frozenTweens || [];
    const own = this.tips ? this.tips.parts : [];
    for (const t of this.tweens.getTweens()) {
      if (!t.isPlaying() || (t.targets || []).some((o) => own.includes(o))) continue;
      t.pause();
      this.frozenTweens.push(t);
    }
  }

  unfreezeForTip() {
    (this.frozenTweens || []).forEach((t) => { try { t.resume(); } catch { /* tween already gone */ } });
    this.frozenTweens = null;
    this.lastFramePerf = performance.now();
    this.shiftTiming(BALANCE.timing.resumeShiftMs);
    if (this.bot) this.bot.plans = null;
  }

  get tipOpen() { return !!(this.tips && this.tips.blocking); }

  // Re-reads the outfit and wallet (after the wardrobe or the trader).
  refreshLook() {
    this.climber.refreshTexture();
    this.outfit.setLook(this.prog.data.look);
    this.effects.setChalk(findCosmetic('chalk', this.prog.data.look.chalk || 'chalk-white'));
    this.effects.setTrail(findCosmetic('trail', this.prog.data.look.trail || 'trail-none'));
    this.effects.setHit(findCosmetic('hit', this.prog.data.look.hit || 'hit-ring'));
    this.hud.setGems(this.prog.gems);
  }

  // ---------------------------------------------------------------- route selection
  enterRouteSelect() {
    this.state = STATE.ROUTE_SELECT;
    this.grip.resetHang();
    const node = this.node;
    if (node.kind === 'ledge') {
      this.climber.setPosition(node.x, node.y - STAND_HAND);
      this.climber.setPose('hang');
    }
    this.routes = this.mountain.computeRoutes(node, { forgiving: this.forgiving });
    if (this.mechanics) this.mechanics.decorateRoutes(this.routes, { mountain: this.mountain });
    if (!this.director) this.rollGems();
    this.startCrumble(node);
    if (!this.routes.length) {
      console.warn('No routes from', node.id);
      this.startSlip();
      return;
    }
    let sel = this.routes.findIndex((r) => r.type === (this.prevRouteType || 'normal'));
    if (sel < 0) sel = this.routes.findIndex((r) => r.type === 'normal');
    if (sel < 0 || this.grip.isLow) sel = 0;
    this.selected = sel;
    // Stone Wall: a due rockfall comes down as soon as you grab a hold; the
    // routes appear once it has passed.
    const rf = this.mechanics && this.mechanics.get('rockfall');
    if (rf && rf.due && node.kind !== 'ledge' && node.hazard !== 'crumbling') { this.startRockfall(); return; }
    if (this.breathDue()) { this.startFireBreath(); return; }
    this.routeUI.show(this.routes, sel, { x: this.climber.x, y: this.climber.y });
    if (this.director) this.director.onRouteSelect(node);
    this.prismStart = this.routes.some((r) => r.prism) ? this.clock : 0;
    this.prismLit = -1;
    this.routeTips(node);
  }

  // Bram explains whatever is new about this choice (once per save).
  routeTips(node) {
    this.tip('routes');
    if (node.kind === 'jug') this.tip('jug');
    if (this.routeGems.length) this.tip('gems');
    if (this.routes.some((r) => r.thermal)) this.tip('thermals');
    if (this.prismStart) this.tip('crystal');
    if (this.routes.some((r) => r.mods && r.mods.dark)) this.tip('darkness');
    if (this.routes.some((r) => r.mods && r.mods.tag === 'STORM')) this.tip('storm');
    if (this.routes.some((r) => r.swing)) this.tip('swing');
  }

  tip(id) { if (this.tips) this.tips.show(id); }

  setHudVisible(v) {
    this.hud.setVisible(v);
    if (this.tips) this.tips.setVisible(v);
  }

  // ---------------------------------------------------------------- prism light (Crystal Heights)
  // The beam moves across the routes; a climb started on the lit one is free.
  updatePrism() {
    const r0 = this.routes[0];
    const lit = litIndex(this.clock - this.prismStart, this.routes.length, r0.prism.start);
    if (lit === this.prismLit) return;
    this.prismLit = lit;
    this.routeUI.setLit(lit);
    const t = this.routes[lit].target;
    this.effects.sparkle(t.x, t.y, 4);
    Audio.play('crystal', { dir: ['L', 'U', 'R'][lit] || 'U' });
  }

  // ---------------------------------------------------------------- rockfall (Stone Wall)
  startRockfall() {
    this.dodgeKind = 'rock';
    this.dodges = this.mechanics.get('rockfall').start(levelToMeters(this.node.level));
    this.dodgeIndex = 0;
    this.dodgeHits = 0;
    this.state = STATE.DODGING;
    this.routeUI.hide();
    this.floatText(biomeAt(levelToMeters(this.node.level)).id === 'volcano' ? 'ERUPTION!' : 'ROCKFALL!', COLORS.red, 14);
    this.tip('rockfall');
    Audio.play('creak');
    Audio.play('pebble', { count: 4 });
    if (this.settings.shake) this.cam.shake(500, 0.002);
    const biome = biomeAt(levelToMeters(this.node.level));
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(i * 220, () => this.effects.pebbleFall(this.climber.x + this.runRng.range(-30, 30), this.camY + 2, 3, biome.rock[3]));
    }
    this.nextDodge(ROCKFALL.warnMs);
  }

  // ---------------------------------------------------------------- dragon fire (Dragon's Spine)
  // While the dragon watches, it breathes fire at a climber hanging on a hold
  // every few seconds (never on a ledge, never mid-climb).
  breathDue() {
    const eye = this.mechanics && this.mechanics.get('dragonEye');
    return !!(eye && eye.breathDue && !this.director && !this.tipOpen && this.node && this.node.kind !== 'ledge');
  }

  startFireBreath() {
    this.dodgeKind = 'fire';
    this.dodges = this.mechanics.get('dragonEye').startBreath(levelToMeters(this.node.level));
    this.dodgeIndex = 0;
    this.dodgeHits = 0;
    this.state = STATE.DODGING;
    this.routeUI.hide();
    this.floatText('IT DRAWS BREATH!', '#ff9a3c', 14);
    this.tip('dragon');
    this.nextDodge(DRAGON_EYE.breathLeadMs);
  }

  nextDodge(leadInMs) {
    const dir = this.dodges[this.dodgeIndex];
    const mult = (this.forgiving ? BALANCE.timing.forgivingMultiplier : 1) * this.modeCfg.catchScale;
    const fire = this.dodgeKind === 'fire';
    const cfg = fire ? DRAGON_EYE : ROCKFALL;
    this.dodge = new ComboSystem({
      pattern: [dir], beatMs: 1,
      perfectMs: Math.round(cfg.perfectMs * mult), goodMs: Math.round(cfg.goodMs * mult),
      earlyGraceMs: 150, leadInMs, startTime: this.now(),
    });
    this.comboUI.showRecovery(this.dodge, { label: fire ? `FIRE! SWING ${dir === 'L' ? 'LEFT' : 'RIGHT'}!` : `DODGE ${dir === 'L' ? 'LEFT' : 'RIGHT'}!`, color: fire ? '#ff9a3c' : COLORS.red });
    this.climber.setPose('brace');
    if (fire) {
      // It draws breath for the whole lead-in, then the flames land on the beat
      // where the climber hangs now.
      this.dragon.inhale(leadInMs);
      Audio.play('rumble');
      // The flames land on the side you must swing away from.
      const target = { x: this.climber.x + (dir === 'L' ? 6 : -6), y: this.climber.y - 10 };
      this.time.delayedCall(Math.max(0, leadInMs - 260), () => {
        if (this.dodgeKind !== 'fire') return;
        this.dragon.breathe(target, this.cam, this.effects);
        Audio.play('roar');
        Audio.play('flame');
        this.hud.flashScreen(0xff7a20, 0.22, 300);
        if (this.settings.shake) this.cam.shake(420, 0.006);
      });
      return;
    }
    // The rock drops onto the climber and lands exactly on the beat.
    const rock = this.add.image(this.climber.x + (dir === 'L' ? 5 : -5), this.camY - 14, 'rock_fall').setDepth(DEPTH.fx + 2).setScale(2);
    let trail = 0;
    this.tweens.add({
      targets: rock, y: this.climber.y - 22, angle: 200, duration: leadInMs, ease: 'Quad.easeIn',
      onUpdate: () => { if (++trail % 6 === 0) this.effects.pebbleFall(rock.x, rock.y - 8, 1, 0xa8743e); },
    });
    this.dodgeRock = rock;
  }

  // The dodge itself: swing the body out on one hand, let the rock pass, swing back.
  async swingClear(dir, reach = 4) {
    const c = this.climber;
    const hx = c.x, hy = c.y, side = dir === 'L' ? -1 : 1;
    c.busy++;
    c.setPose(dir === 'L' ? 'reachL_mid' : 'reachR_mid');
    this.time.delayedCall(40, () => { if (this.state === STATE.DODGING) c.setPose(dir === 'L' ? 'dodgeL' : 'dodgeR'); });
    this.effects.chalk(hx, hy);
    Audio.play('cloth');
    await c.tweenTo(hx + side * reach, hy + 1, 90, 'Quad.easeOut');
    await new Promise((r) => this.time.delayedCall(reach > 4 ? 420 : 170, r));
    if (this.state !== STATE.DODGING) { c.busy--; return; }
    c.setPose(dir === 'L' ? 'reachL_mid' : 'reachR_mid');
    await c.tweenTo(hx, hy, 150, 'Back.easeOut');
    c.busy--;
    if (this.state === STATE.DODGING) c.setPose(this.dodge ? 'brace' : 'hang');
  }

  dodgeInput(dir, t) {
    if (!this.dodge) return;
    const res = this.dodge.press(dir, t);
    if (res.auto.length) this.dodgeResult(res.auto[0]);
    else if (res.judged) this.dodgeResult(res.judged);
  }

  dodgeResult(note) {
    this.comboUI.judge(note);
    const fire = this.dodgeKind === 'fire';
    if (!fire) this.outfit.onRockfall();
    this.dodge = null;
    const rock = this.dodgeRock;
    this.dodgeRock = null;
    if (rock) {
      this.tweens.killTweensOf(rock);
      this.tweens.add({ targets: rock, y: rock.y + 260, angle: rock.angle + 260, duration: 700, ease: 'Quad.easeIn', onComplete: () => rock.destroy() });
    }
    const biome = biomeAt(levelToMeters(this.node.level));
    if (note.result !== 'miss') {
      this.swingClear(note.dir, fire ? 12 : 4);
      if (note.result === 'perfect') this.freezeFrame(fire ? 90 : 60, fire ? 0xff9a3c : 0xffffff);
      this.addStreak();
      this.floatText(fire ? (note.result === 'perfect' ? 'THROUGH THE FIRE!' : 'SINGED!') : note.result === 'perfect' ? 'DODGED!' : 'CLOSE ONE!', COLORS.green, 12);
      Audio.play('good');
      if (!this.director) { this.prog.bump(fire ? 'fireDodges' : 'dodges'); this.checkLogbook(); }
    } else if (fire) {
      // Caught in the flames: grip burns away, the climber smokes.
      this.dodgeHits++;
      const cost = Math.round(DRAGON_EYE.breathGrip * this.modeCfg.costScale);
      this.grip.change(-cost);
      this.breakStreak();
      this.climber.hold('slip2', 320);
      this.climber.sprite.setTintFill(0xffa040);
      this.time.delayedCall(140, () => { if (this.climber.sprite.active) this.climber.sprite.clearTint(); });
      this.effects.flameBurst(this.climber.x, this.climber.y - 8, 16);
      this.coat.scorch();
      Audio.play('flame');
      Audio.play('miss');
      if (this.settings.shake) this.cam.shake(200, 0.006);
      this.floatText(`BURNED! -${cost} GRIP`, COLORS.red, 12);
      if (this.grip.isEmpty) { this.startSlip(); return; }
    } else {
      this.dodgeHits++;
      this.grip.change(-ROCKFALL.hitGrip * this.modeCfg.costScale);
      this.breakStreak();
      this.climber.hold('slip2', 300);
      this.effects.pebbleFall(this.climber.x, this.climber.y - 8, 8, biome.rock[3]);
      Audio.play('rockhit');
      Audio.play('miss');
      Audio.play('pebble', { count: 5 });
      if (this.settings.shake) this.cam.shake(160, 0.005);
      this.floatText(`HIT! -${Math.round(ROCKFALL.hitGrip * this.modeCfg.costScale)} GRIP`, COLORS.red, 12);
      if (this.grip.isEmpty) { this.startSlip(); return; }
    }
    this.dodgeIndex++;
    if (this.dodgeIndex < this.dodges.length) { this.nextDodge(fire ? 1100 : ROCKFALL.nextMs); return; }
    this.time.delayedCall(380, () => {
      if (this.state !== STATE.DODGING) return;
      this.comboUI.hide();
      if (!this.dodgeHits && !fire) this.discover('rockfall-dodged');
      this.state = STATE.ROUTE_SELECT;
      this.grip.resetHang();
      this.climber.setPose('hang');
      this.routeUI.show(this.routes, this.selected, { x: this.climber.x, y: this.climber.y });
      if (this.prismStart) { this.prismStart = this.clock; this.prismLit = -1; }
    });
  }

  cycleRoute(d) {
    const n = this.routes.length;
    let next = this.selected;
    for (let k = 0; k < n; k++) {
      next = (next + d + n) % n;
      break;
    }
    this.selected = next;
    this.routeUI.setSelected(this.selected);
    Audio.play('ui');
  }

  pickRoute(i, confirm) {
    if (this.state !== STATE.ROUTE_SELECT || !this.routes[i] || this.tipOpen) return;
    if (this.director && this.director.holdRoutes) return;
    if (i !== this.selected) {
      this.selected = i;
      this.routeUI.setSelected(i);
      Audio.play('ui');
    }
    if (confirm) this.startCombo();
  }

  // Crumbling holds give you only a few seconds to pick a route.
  startCrumble(node) {
    this.clearCrumble();
    if (node.hazard !== 'crumbling') return;
    const ms = this.modeCfg.crumbleMs * (this.gear.quickdraws ? GEAR_FX.quickdrawScale : 1);
    this.crumbleAt = this.clock + ms;
    this.crumbleTotal = ms;
    const g = this.add.graphics().setDepth(DEPTH.fx + 4);
    const label = new PixelText(this, 0, 0, 'CRUMBLING!', { color: COLORS.red }).setOrigin(0.5, 0).setDepth(DEPTH.fx + 4);
    this.crumbleUI = { g, label, creakT: 0 };
    Audio.play('creak');
    this.tip('crumbling');
  }

  updateCrumble(dt) {
    if (!this.crumbleAt || !this.crumbleUI) return;
    const left = this.crumbleAt - this.clock;
    const h = this.climber.head;
    const { g, label } = this.crumbleUI;
    const w = 30, x = Math.round(h.x - w / 2), y = Math.round(h.y - 30);
    g.clear();
    g.fillStyle(0x16141f, 0.85); g.fillRect(x - 1, y - 1, w + 2, 4);
    g.fillStyle(left < 1000 ? 0xf0644b : 0xf2c14e, 1); g.fillRect(x, y, Math.max(0, Math.round((w * left) / this.crumbleTotal)), 2);
    label.setPosition(Math.round(h.x), y - 9).setVisible(left > 1000 || Math.floor(left / 120) % 2 === 0);
    const hold = this.wall.getHold(this.node.id);
    if (hold) hold.x = this.node.x + (left < 1500 ? (Math.floor(this.clock / 60) % 2 ? 1 : -1) : 0);
    this.crumbleUI.creakT += dt;
    if (this.crumbleUI.creakT > 700) { this.crumbleUI.creakT = 0; Audio.play('creak'); this.effects.pebbleFall(this.node.x, this.node.y + 4, 1, 0x8a7f74); }
    if (left <= 0) {
      const node = this.node;
      this.clearCrumble();
      Audio.play('crumble');
      this.effects.pebbleFall(node.x, node.y + 3, 10, 0x8a7f74);
      this.effects.chalk(node.x, node.y);
      const hs = this.wall.getHold(node.id);
      if (hs) {
        const debris = this.add.image(hs.x, hs.y, hs.texture.key).setDepth(DEPTH.fx);
        this.tweens.add({ targets: debris, y: debris.y + 120, angle: 200, alpha: 0, duration: 900, ease: 'Quad.easeIn', onComplete: () => debris.destroy() });
      }
      this.floatText('THE HOLD BROKE!', COLORS.red, 12);
      this.startSlip();
    }
  }

  clearCrumble() {
    this.crumbleAt = 0;
    if (this.crumbleUI) { this.crumbleUI.g.destroy(); this.crumbleUI.label.destroy(); this.crumbleUI = null; }
    const hold = this.node && this.wall.getHold(this.node.id);
    if (hold) hold.x = this.node.x;
  }

  // ---------------------------------------------------------------- combo
  startCombo() {
    const route = this.routes[this.selected];
    this.route = route;
    this.prevRouteType = route.type;
    if (this.director) this.director.onComboStart(route);
    const keep = this.routeGems.find((g) => g.route === route) || null;
    this.clearRouteGems(keep);
    this.pendingGem = keep;
    this.routeUI.hide();
    this.clearCrumble();
    this.state = STATE.CLIMBING_COMBO;
    // Started in the prism light: this climb's hits cost no grip.
    this.prismed = !!this.prismStart && this.selected === this.prismLit;
    route.prismed = this.prismed;
    this.prismStart = 0;
    if (this.prismed) {
      this.floatText('PRISM LIGHT: FREE CLIMB!', '#ffc8f0', 18, true);
      this.effects.sparkle(route.target.x, route.target.y, 10);
      if (!this.director) { this.prog.bump('prisms'); this.discover('prism-light'); }
    }
    this.thermalEarned = false;
    this.gustAnnounced = null;
    let windowScale = route.windowScale;
    if (this.gear.crampons && route.hazard === 'icy') windowScale /= BALANCE.hazards.icy.windowScale;
    if (this.gear.chalk && levelToMeters(this.node.level) < GEAR_FX.chalkUntil) windowScale *= GEAR_FX.chalkWindow;
    if (this.perk === 'diamondeye') windowScale *= GEAR_FX.diamondWindow;
    const w = timingWindows(BALANCE, { windowScale, forgiving: this.forgiving });
    const r = BALANCE.ramp;
    // Dares change the climb itself: mirrored arrows, a quicker beat, blind notes.
    let notes = route.notes;
    if (this.dared) {
      const blind = this.dares.includes('blind') && levelToMeters(this.node.level) >= DARE.blindFrom;
      const mirror = this.dares.includes('mirror');
      notes = notes.map((n) => ({
        ...n,
        mirror: n.mirror || (mirror && !n.still && !n.chord && (n.dir === 'L' || n.dir === 'R')),
        hidden: n.hidden || (blind && !n.still),
      }));
    }
    const beatMs = Math.round(route.beatMs * (this.dares.includes('quick') ? DARE.tempo : 1));
    this.combo = new ComboSystem({
      notes,
      minGapMs: r.minGapMs,
      gustWindowScale: r.gustWindowScale,
      holdReleaseGraceMs: r.holdReleaseGraceMs,
      rollBeats: r.rollBeats,
      chordSpreadMs: r.chordSpreadMs,
      minPerfectMs: BALANCE.timing.minPerfectMs,
      minGoodMs: BALANCE.timing.minGoodMs,
      beatMs,
      perfectMs: w.perfectMs,
      goodMs: w.goodMs,
      earlyGraceMs: BALANCE.timing.earlyGraceMs,
      leadInMs: BALANCE.timing.leadInMs,
      startTime: this.now(),
    });
    this.comboUI.show(this.combo, route);
    this.clearTargetMark();
    this.targetMark = this.add.image(route.target.x, route.target.y + 3, 'ring').setDepth(DEPTH.routeMarks).setTint(route.toLedge ? 0x9fd8ff : this.routeUI.colorOf(route)).setAlpha(0.8);
    this.from = { x: this.climber.x, y: this.climber.y };
    this.to = { x: route.target.x, y: route.target.y };
    this.leapAcross = !!(this.expedition && this.expedition.chasm) && route.target.kind !== 'ledge' && Math.abs(this.to.x - this.from.x) > 100;
    this.successes = 0;
    Audio.play('cloth');
    this.tip('beat');
    (route.tags || []).forEach((t) => TAG_TIPS[t] && this.tip(TAG_TIPS[t]));
    if (route.hazard === 'loose' || route.hazard === 'icy') this.tip(route.hazard);
  }

  comboInput(dir, t) {
    if (!this.combo) return;
    const res = this.combo.press(dir, t);
    res.auto.forEach((n) => this.onNote(n));
    if (res.judged && this.state === STATE.CLIMBING_COMBO) this.onNote(res.judged);
    // A tap on a roll: a quick scrabble at the rock, and a tick per tap.
    if (res.tap && this.state === STATE.CLIMBING_COMBO) {
      const left = res.tap.tapsLeft;
      Audio.play('scrabble');
      this.effects.chalk(this.climber.x + (dir === 'L' ? -6 : dir === 'R' ? 6 : 0), this.climber.y - 4);
      if (left === 0 && !res.tap.rollShown) { res.tap.rollShown = true; this.floatText('ROLLED!', '#9fffd0', 14); }
    }
    // The first arrow of a double note: a soft click while the other is awaited.
    if (res.half) Audio.play('tick');
  }

  onNote(note) {
    if (this.state !== STATE.CLIMBING_COMBO) return;
    const route = this.route;
    if (this.perk === 'steady' && note.result === 'miss' && !this.combo.steadyUsed) {
      this.combo.steadyUsed = true;
      this.grip.change(-this.grip.noteCost(route, note.result) * 0.5);
    } else if (!(this.prismed && note.result !== 'miss')) this.grip.applyNote(route, note.result);
    const style = this.comboUI.judge(note);
    this.lastJudge = `${note.result.toUpperCase()}${note.reason ? ' ' + note.reason.toUpperCase() : ''} ${Math.round(note.offset)}MS`;
    const n = this.combo.notes.filter((x) => !x.still).length;
    const biome = biomeAt(levelToMeters(route.target.level));
    if (note.thermal && note.result === 'perfect') {
      this.thermalEarned = true;
      this.floatText('THERMAL!', '#ffb45a', 24);
      Audio.play('gust');
    }
    if (note.result === 'perfect') {
      this.addStreak();
      if (this.perk === 'rubyheart') this.grip.change(GEAR_FX.rubyGrip);
    }
    else if (note.result === 'good' && this.perk === 'streaksaver' && !this.run.streakSaved && this.run.streak >= 3) {
      this.run.streakSaved = true;
      this.floatText('STREAK SAVED', '#ff9a3c', 20);
    } else this.breakStreak();
    if (note.reason === 'release' || note.reason === 'roll') {
      this.successes = Math.max(0, this.successes - 1);
      this.climber.hold('slip2', 240);
      Audio.play('miss');
      if (this.settings.shake) this.cam.shake(90, 0.002);
      this.floatText(style.text, style.color);
      this.tryEnergyBar();
      if (this.grip.isEmpty) this.startSlip();
      return;
    }
    if (note.result !== 'miss') {
      this.successes++;
      const p = Math.min(0.85, (this.successes / n) * 0.85);
      // Across the Crevasse you climb up your own wall and leap at the end.
      const tx = this.leapAcross ? this.from.x : this.from.x + (this.to.x - this.from.x) * p;
      const ty = this.from.y + (this.to.y - this.from.y) * p;
      let pose;
      if (note.dir === 'L') pose = note.result === 'perfect' ? 'perfectL' : 'reachL';
      else if (note.dir === 'R') pose = note.result === 'perfect' ? 'perfectR' : 'reachR';
      else pose = ['pull', 'stepL', 'stepR'][note.index % 3];
      this.climber.via(note.dir === 'L' ? 'reachL_mid' : note.dir === 'R' ? 'reachR_mid' : 'pull_mid', pose);
      // Hit-stop: on a perfect the climber freezes in the flash for a moment
      // before the move snaps through. Only the body waits; the beat never does.
      const heat = Math.min(20, this.run.streak);
      const stop = note.result === 'perfect' ? Math.round((heat >= 10 ? 55 : 40) * this.hitStopScale) : 0;
      this.climber.tweenTo(tx, ty, 150, 'Quad.easeOut', stop);
      const hx = this.climber.x + (note.dir === 'L' ? -10 : note.dir === 'R' ? 10 : 0), hy = this.climber.y - 2;
      if (note.result === 'perfect') {
        this.run.perfects++;
        this.passProgress('perfects');
        this.outfit.onPerfect();
        Audio.play('perfect', { streak: this.run.streak });
        // Sparks, ring and shake length grow with the streak.
        this.effects.sparkle(hx, hy, 6 + Math.floor(heat / 2));
        this.effects.hit(hx, hy, heat);
        this.climber.flash(stop + 10);
        if (this.settings.hitStop === 'punchy') this.climber.squash(0.82, 1.2, 200, stop);
        else this.climber.squash(0.88, 1.14, 180, stop);
        if (this.settings.shake) this.cam.shake(60 + heat * 2, 0.002);
      } else {
        Audio.play('grab');
        this.climber.squash(0.95, 1.06, 140);
      }
      if (note.dir === 'U') Audio.play('boot', { snow: biome.weather.snow > 0.3 });
      this.effects.chalk(hx, hy);
      if (note.holdMs) { this.climber.via('pull_mid', 'pull'); this.floatText('HOLD IT...', COLORS.gold, 10); }
    } else {
      this.climber.hold(this.grip.isLow ? 'slip2' : 'hesitate', 220);
      Audio.play('miss');
      if (route.hazard === 'loose') {
        this.effects.pebbleFall(route.target.x, route.target.y + 4, 6, 0xa8743e);
        Audio.play('pebble', { count: 5 });
      }
      if (route.hazard === 'icy') this.effects.snowBurst(route.target.x, route.target.y + 4);
      if (this.settings.shake) this.cam.shake(90, 0.002);
    }
    if (!note.holdMs || note.result === 'miss') this.floatText(style.text, style.color, 0, note.result === 'perfect');
    this.tryEnergyBar();
    if (this.grip.isEmpty) { this.startSlip(); return; }
    if (this.combo.done) this.finishCombo();
  }

  // ---------------------------------------------------------------- perfect streaks
  addStreak() {
    const n = ++this.run.streak;
    this.run.bestStreak = Math.max(this.run.bestStreak, n);
    if (n === 3) this.tip('streak');
    this.hud.setStreak(n);
    if (n === 5 && !this.director && !this.run.onFire) this.onFire();
    const cfg = BALANCE.streak;
    const last = cfg.milestones[cfg.milestones.length - 1];
    const ms = cfg.milestones.find((m) => m.at === n);
    const grip = ms ? ms.grip : n > last.at && (n - last.at) % cfg.every === 0 ? cfg.laterGrip : 0;
    if (grip) {
      this.grip.change(grip);
      Audio.play('streakmilestone');
      this.effects.sparkle(this.climber.x, this.climber.y - 6, 16);
      this.effects.ring(this.climber.x, this.climber.y - 10, 0xff9a3c, 30, 420);
      this.hud.flashScreen(0xff9a3c, 0.15, 300);
      if (this.settings.shake) this.cam.shake(160, 0.004);
      this.freezeFrame(80, 0xff9a3c);
      this.floatText(`${n} PERFECT! +${grip} GRIP`, '#ff9a3c', 20, true);
      this.awardGems(GEM_INCOME.streak[n] || GEM_INCOME.streak.later);
    }
    if (!this.director) this.prog.recordStreak(n).forEach((u) => this.hud.toast(`UNLOCKED: ${u.name}`, COLORS.gold));
    if (n % 5 === 0) this.checkLogbook();
  }

  // The first 5-perfect streak of a run. The very first one ever gets the full
  // title card; after that it is a shorter burst.
  onFire() {
    this.run.onFire = true;
    const first = !this.prog.data.onFireSeen;
    if (first) { this.prog.data.onFireSeen = true; this.prog.save(); }
    const { x, y } = this.climber;
    Audio.play('bassdrop');
    Audio.swell(20);
    this.hud.flashScreen(0xff9a3c, first ? 0.3 : 0.18, 360);
    this.effects.ring(x, y - 10, 0xff9a3c, 40, 500);
    this.effects.confettiBurst(x, y - 20, first ? 30 : 14);
    if (this.settings.shake) {
      this.cam.shake(220, 0.005);
      this.cam.setZoom(1.06);
      this.tweens.add({ targets: this.cam, zoom: 1, duration: 280, ease: 'Quad.easeOut' });
    }
    if (first) this.hud.celebrate({ title: 'ON FIRE!', sub: 'KEEP THE PERFECTS COMING', color: '#ff9a3c', flicker: true });
    else this.floatText('ON FIRE!', '#ff9a3c', 20, true);
  }

  breakStreak() {
    if (this.run.streak >= 5) {
      this.hud.toast(`STREAK ENDED AT ${this.run.streak}`, COLORS.dim);
      Audio.play('streakbreak', { streak: this.run.streak });
    }
    this.run.streak = 0;
    this.run.streakSaved = false;
    this.hud.setStreak(0);
  }

  // ---------------------------------------------------------------- gems
  get gemScale() { return (GEM_INCOME.modeScale[this.mode] || 1) * dareScale(this.dares); }

  // The record this run plays against: the mode's, or the dare set's own.
  get recordBest() { return this.dared ? this.prog.dareBestFor(this.dareKey) : this.prog.bestFor(this.mode); }

  // Each offered route may carry a gem on its target. Only the route you take
  // keeps its gem; the others fade away.
  rollGems() {
    this.clearRouteGems();
    const scale = this.perk === 'gemsense' ? GEAR_FX.gemSense : 1;
    for (const r of this.routes) {
      r.gem = this.city.active ? this.city.routeGem(r, this.mountain.takenGems)
        : this.mountain.routeGem(r, scale * ((r.mods && r.mods.gemScale) || 1));
      if (!r.gem) continue;
      const y = r.target.y - 6;
      const img = this.add.image(r.target.x, y, `gem_${r.gem.type}`).setDepth(this.city.active ? this.city.gemDepth : DEPTH.holds + 2).setScale(0);
      this.tweens.add({ targets: img, scale: 1, duration: 320, ease: 'Back.easeOut' });
      this.tweens.add({ targets: img, y: y - 1, duration: 420, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [1] });
      this.effects.sparkle(r.target.x, y, 4);
      this.routeGems.push({ route: r, img });
    }
  }

  fadeGem(g) {
    if (!g || !g.img) return;
    const img = g.img;
    this.tweens.killTweensOf(img);
    this.tweens.add({ targets: img, alpha: 0, y: img.y - 5, duration: 280, onComplete: () => img.destroy() });
  }

  clearRouteGems(keep = null) {
    (this.routeGems || []).forEach((g) => { if (g !== keep) this.fadeGem(g); });
    this.routeGems = [];
  }

  dropPendingGem() {
    this.fadeGem(this.pendingGem);
    this.pendingGem = null;
  }

  collectGem({ route, img }) {
    const gem = GEMS[route.gem.type];
    const node = route.target;
    this.mountain.takeGem(route.gem);
    const firstOfKind = this.prog.found(gem.id) === 0;
    const lucky = this.gear.charm > 0;
    if (lucky) { this.gear.charm--; this.updateGearHud(); }
    const value = Math.round(gem.value * this.gemScale * (lucky ? 2 : 1) * (route.prismed ? PRISM_LIGHT.gemScale : 1));
    this.prog.addGems(value, gem.id);
    this.run.gems += value;
    this.run.stones[gem.id] = (this.run.stones[gem.id] || 0) + 1;
    if (this.run.pass && GEMS[gem.id].biome === this.run.pass.biome) this.passProgress('gems');
    Audio.play('gem', { value: gem.value });
    this.effects.sparkle(node.x, node.y - 6, 8);
    this.effects.ring(node.x, node.y - 6, gem.color, 14, 300);
    this.floatText(`${gem.name} +${value}`, toCss(gem.color), 26, true);
    if (firstOfKind) this.hud.toast(`NEW GEM FOUND: ${gem.name}`, toCss(gem.color));
    const sx = (img ? img.x : node.x) - this.cam.scrollX, sy = (img ? img.y : node.y - 6) - this.cam.scrollY;
    if (img) { this.tweens.killTweensOf(img); img.destroy(); }
    this.flyingGems = (this.flyingGems || []).filter((f) => f.active);
    if (this.flyingGems.length >= 4) this.flyingGems.shift().destroy();
    const fly = this.add.image(sx, sy, `gem_${gem.id}`).setScrollFactor(0).setDepth(DEPTH.hud + 2);
    this.flyingGems.push(fly);
    this.tweens.add({ targets: fly, x: GEM_TARGET.x, duration: 520, ease: 'Sine.easeOut' });
    this.tweens.add({
      targets: fly, y: GEM_TARGET.y, scale: { from: 1.8, to: 1 }, duration: 520, ease: 'Cubic.easeIn',
      onComplete: () => { fly.destroy(); this.hud.setGems(this.prog.gems, true); this.hud.gemGain(value, toCss(gem.color)); Audio.play('tick'); },
    });
  }

  // Small gem rewards outside the wall stones (height, streaks, records).
  awardGems(base) {
    if (this.director || !base) return;
    const value = Math.max(1, Math.round(base * this.gemScale));
    this.prog.addGems(value);
    this.run.gems += value;
    this.hud.setGems(this.prog.gems, true);
    this.hud.gemGain(value);
  }

  checkHeightGems() {
    if (this.director || this.lifting) return;
    const marks = Math.floor((this.run.maxHeight || 0) / GEM_INCOME.heightEvery);
    if (marks <= this.run.heightMarks) return;
    const gained = marks - this.run.heightMarks;
    this.run.heightMarks = marks;
    this.awardGems(gained);
  }

  // ---------------------------------------------------------------- gear, perks & the trader
  // Packed gear is spent when you leave base camp at the start of a Normal run.
  activateLoadout() {
    if (!this.gearAllowed) return;
    const used = this.prog.consumePack();
    this.gear = {};
    this.liftTo = null;
    used.forEach((id) => {
      if (GEAR_BY_ID[id].lift) this.liftTo = id;
      else this.gear[id] = id === 'charm' ? GEAR_FX.charmGems : 1;
    });
    this.perk = this.prog.data.activePerk;
    this.run.bare = !used.length && !this.perk;
    if (used.length) {
      Audio.play('gear');
      this.hud.toast(`GEAR: ${used.map((id) => GEAR_BY_ID[id].name).join(', ')}`, COLORS.green);
    }
    if (this.perk) this.hud.toast(`PERK: ${PERK_BY_ID[this.perk].name}`, COLORS.gold);
    this.updateGearHud();
  }

  updateGearHud() {
    if (!this.gearAllowed) { this.hud.setGear([]); return; }
    const list = [];
    if (this.run.departed) {
      for (const id of Object.keys(this.gear)) list.push({ icon: GEAR_BY_ID[id].icon, used: !this.gear[id] });
      if (this.perk) list.push({ icon: PERK_BY_ID[this.perk].icon, used: false });
    } else {
      // Before leaving base camp: show what is packed.
      this.prog.data.packed.forEach((id) => list.push({ icon: GEAR_BY_ID[id].icon, used: false }));
      if (this.prog.data.activePerk) list.push({ icon: PERK_BY_ID[this.prog.data.activePerk].icon, used: false });
    }
    this.hud.setGear(list);
  }

  // The energy bar saves you once when grip runs (nearly) out.
  tryEnergyBar() {
    if (!this.gear.energy || this.grip.value > 12) return;
    this.gear.energy = 0;
    this.grip.change(GEAR_FX.energyGrip);
    Audio.play('gear');
    this.effects.sparkle(this.climber.x, this.climber.y - 10, 8);
    this.floatText(`ENERGY BAR! +${GEAR_FX.energyGrip} GRIP`, COLORS.green, 26, true);
    this.updateGearHud();
  }

  atTrader() { return !this.tutorial && this.node && this.node.level === 0 && !!this.wall.trader; }

  showTraderTag() {
    this.hideTraderTag();
    if (!this.atTrader()) return;
    const t = this.wall.trader;
    const tag = new PixelText(this, Math.round(t.x), Math.round(t.y - 44), 'T  TRADER', { color: COLORS.gold }).setOrigin(0.5, 0).setDepth(DEPTH.fx + 5);
    const gem = this.add.image(Math.round(t.x), Math.round(t.y - 50), 'icon_gem').setDepth(DEPTH.fx + 5);
    this.tweens.add({ targets: [tag, gem], y: '-=2', duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    [tag, t].forEach((o) => o.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.restAction('trader')));
    this.traderTag = [tag, gem];
  }

  hideTraderTag() {
    if (this.traderTag) this.traderTag.forEach((o) => o.destroy());
    this.traderTag = null;
    if (this.wall.trader && this.wall.trader.active) this.wall.trader.removeAllListeners('pointerdown').disableInteractive();
  }

  // Collection, wardrobe and the like open over the paused run.
  openOverlay(key, data) {
    if (this.paused) return;
    this.paused = true;
    this.scene.launch(key, data);
    this.scene.pause();
  }

  openTrader() {
    if (this.paused) return;
    this.paused = true;
    Audio.play('select');
    this.scene.launch('Shop', { mode: 'trader', returnTo: 'Climb', departed: !!this.run.departed, gearAllowed: this.gearAllowed });
    this.scene.pause();
  }

  // ---------------------------------------------------------------- big moments
  celebrateRecord() {
    Audio.play('fanfare');
    this.hud.flashScreen(0xf2c14e, 0.25, 420);
    this.hud.celebrate({ title: 'NEW RECORD!', sub: `BEST WAS ${Math.floor(this.run.startBest)} M`, flicker: true });
    const v = this.cam.worldView;
    this.effects.confettiBurst(v.x + 40, v.y + 30, 30);
    this.effects.confettiBurst(v.right - 40, v.y + 30, 30);
    this.effects.confettiBurst(this.climber.x, this.climber.y - 30, 20);
    if (this.settings.shake) this.cam.shake(240, 0.004);
    this.awardGems(GEM_INCOME.record);
  }

  // A banner every 100 m, plus two early ones at 25 and 50 m (only the first
  // time this run reaches them).
  checkMilestone(h) {
    if (this.director) return;
    const m = Math.floor(h / 100);
    if (m <= (this.run.milestone || 0)) {
      const early = [50, 25].find((e) => h >= e);
      if (!m && !this.run.milestone && early && early > (this.run.earlyMark || 0)) {
        this.run.earlyMark = early;
        this.slamMilestone(`${early} M`, EARLY_LINES[early], false);
      }
      return;
    }
    this.run.milestone = m;
    this.slamMilestone(`${m * 100} M`, MILESTONE_LINES[m] || MILESTONE_LINES.other[m % MILESTONE_LINES.other.length], true);
  }

  slamMilestone(title, sub, big) {
    Audio.play('milestone');
    this.effects.sparkle(this.climber.x, this.climber.y - 10, 10);
    this.hud.celebrate({
      title, sub, color: COLORS.text, slam: true,
      onLand: () => {
        Audio.play('slam');
        this.hud.flashScreen(0xffffff, big ? 0.2 : 0.12, 220);
        if (this.settings.shake) this.cam.shake(big ? 200 : 140, big ? 0.006 : 0.004);
      },
    });
  }

  // ---------------------------------------------------------------- record marker
  // A subtle flag line across the wall at this mode's record height.
  updateRecordMark() {
    const best = this.run.startBest;
    if (best < 3 || this.recordPassed) return;
    const y = Math.round(-best * PX_PER_METER);
    if (!this.recordMark) {
      if (y < this.camY - 80) return;
      const b = this.mountain.boundsAt(best / METERS_PER_LEVEL);
      const g = this.add.graphics().setDepth(DEPTH.wall + 2);
      for (let x = Math.round(b.l) - 6; x < b.r + 6; x += 6) {
        g.fillStyle(0xf2c14e, 0.55); g.fillRect(x, y, 3, 1);
        g.fillStyle(0x16141f, 0.35); g.fillRect(x, y + 1, 3, 1);
      }
      const flag = this.add.image(Math.round(b.r) + 2, y + 1, 'flag').setOrigin(0.1, 1).setDepth(DEPTH.decor + 1);
      const label = new PixelText(this, Math.round(b.r) - 2, y - 8, `RECORD ${Math.floor(best)} M`, { color: COLORS.gold }).setOrigin(1, 0).setDepth(DEPTH.decor + 1).setAlpha(0.85);
      this.recordMark = { g, flag, label, y };
    }
    if (levelToMeters(this.node.level) > best) {
      this.recordPassed = true;
      const m = this.recordMark;
      this.effects.sparkle(m.flag.x, m.y - 10, 14);
      this.tweens.add({ targets: m.flag, y: m.flag.y - 8, scaleY: 1.3, duration: 260, yoyo: true, ease: 'Quad.easeOut' });
      this.tweens.add({ targets: [m.g, m.flag, m.label], alpha: 0, duration: 1600, delay: 1400, onComplete: () => { m.g.destroy(); m.flag.destroy(); m.label.destroy(); } });
      this.recordMark = null;
    }
  }

  // Per-frame combo upkeep: late misses, finished holds and gust warnings.
  updateCombo(now) {
    const combo = this.combo;
    combo.update(now).forEach((n) => this.onNote(n));
    if (this.combo !== combo || this.state !== STATE.CLIMBING_COMBO) return;
    const failed = [];
    for (const n of combo.updateHolds(now, failed)) {
      if (n.rollMs) continue;
      Audio.play('held');
      this.effects.sparkle(this.climber.x, this.climber.y, 3);
      this.floatText('HELD!', COLORS.gold);
    }
    failed.forEach((n) => this.onNote(n));
    if (this.combo !== combo || this.state !== STATE.CLIMBING_COMBO) return;
    const gust = combo.notes.find((n) => n.gust && !n.result);
    if (gust && gust.time - now < 1300 && this.gustAnnounced !== combo) {
      this.gustAnnounced = combo;
      Audio.play('gust');
      this.floatText('GUST INCOMING', COLORS.blue, 16);
    }
    this.gustActive = !!gust && gust.time - now < 1300;
    // A gust shoves the climber; a roll is a quick scrabble for the hold.
    const rolling = combo.activeHolds.some((h) => h.note.rollMs);
    this.climber.offsetX = (this.gustActive && Math.floor(now / 140) % 2) || (rolling && Math.floor(now / 60) % 2) ? 1 : 0;
    if (combo.done) this.finishCombo();
  }

  finishCombo() {
    const combo = this.combo;
    if (!combo || this.state !== STATE.CLIMBING_COMBO) return;
    this.gustActive = false;
    this.climber.offsetX = 0;
    const s = combo.summary();
    const route = this.route;
    const ok = s.miss <= BALANCE.combo.maxMissesForSuccess;
    this.grip.applyComboEnd(s, ok);
    this.state = STATE.CLIMB_ANIMATION;
    this.clearTargetMark();
    this.time.delayedCall(280, () => { if (this.comboUI.combo === combo) this.comboUI.hide(); });
    this.combo = null;
    if (this.director) this.director.onComboEnd(route, s, ok);
    if (ok) this.completeClimb(route, s);
    else this.failClimb();
  }

  async completeClimb(route, s) {
    const t = route.target;
    if (!this.director) {
      this.run.riskyRow = route.type === 'risky' ? this.run.riskyRow + 1 : 0;
      this.run.riskyBest = Math.max(this.run.riskyBest || 0, this.run.riskyRow);
      if (this.mechanics && this.mechanics.get('whiteout').active) this.run.whiteoutClimbs++;
    }
    if (route.mods && route.mods.discovery) this.discover(route.mods.discovery);
    if (s.miss === 1) {
      this.floatText('SHAKY...', COLORS.dim, 10);
      await this.climber.hold('hesitate', 260);
    }
    if (s.allPerfect) {
      this.run.flawless++;
      Audio.play('flawless');
      this.effects.sparkle(t.x, t.y, 10);
      this.floatText(`FLAWLESS +${BALANCE.combo.perfectComboBonus} GRIP`, COLORS.gold, 12);
    }
    if (t.kind === 'ledge') {
      // Pull up, elbows over the edge, a knee up, then stand.
      this.climber.via('pull_mid', 'pull', 50);
      await this.climber.tweenTo(t.x, t.y + 2, 200, 'Quad.easeOut');
      this.climber.setPose('mantle');
      this.climber.setPosition(t.x, t.y + 4);
      await this.climber.tweenTo(t.x, t.y - 2, 110, 'Quad.easeOut');
      this.climber.setPose('mantle2');
      this.climber.setPosition(t.x, t.y - 4);
      await this.climber.tweenTo(t.x, t.y - 16, 120, 'Quad.easeOut');
      this.climber.setPose('land');
      this.climber.setPosition(t.x, t.y);
      this.climber.squash(1.16, 0.84, 220);
      Audio.play('boot');
      this.effects.chalk(t.x, t.y);
      if (this.settings.hitStop !== 'off') this.effects.landDust(t.x, t.y, biomeAt(levelToMeters(t.level)).rock[4]);
      if (this.settings.hitStop === 'punchy') this.freezeFrame(40);
      await this.climber.hold('stand', 150);
    } else if (this.leapAcross) {
      this.climber.setPose(t.x < this.from.x ? 'dodgeL' : 'dodgeR');
      Audio.play('cloth');
      await this.climber.jumpTo(t.x, t.y, 380, 16);
      this.climber.setPose('grab');
      Audio.play('grab', { icy: true });
      this.climber.squash(1.18, 0.82, 200);
      this.effects.snowBurst(t.x, t.y + 3);
      if (this.settings.shake) this.cam.shake(80, 0.003);
      this.flashHold(t.id);
      await this.climber.hold('grab', 140);
    } else {
      const flourish = s.allPerfect ? (t.x < this.from.x ? 'perfectL' : 'perfectR') : 'grab';
      this.climber.setPose(flourish);
      await this.climber.tweenTo(t.x, t.y, s.allPerfect ? 170 : 240, s.allPerfect ? 'Back.easeOut' : 'Sine.easeOut');
      Audio.play('grab', { icy: t.hazard === 'icy' });
      this.climber.squash(1.1, 0.9, 160);
      this.effects.chalk(t.x, t.y + 2);
      if (t.hazard === 'icy') this.effects.snowBurst(t.x, t.y + 3);
      this.flashHold(t.id);
      await this.climber.hold('grab', 120);
    }
    if (this.thermalEarned && route.thermal) {
      this.thermalEarned = false;
      this.arrive(t, route.heightGain, { stay: true });
      await this.thermalLift(route.thermal);
      return;
    }
    this.arrive(t, route.heightGain);
  }

  // Above the Clouds: a perfect thermal note lets the updraft carry you higher.
  async thermalLift({ to, gain }) {
    this.state = STATE.CLIMB_ANIMATION;
    this.climber.setPose('pull');
    Audio.play('gust');
    for (let i = 0; i < 6; i++) {
      this.time.delayedCall(i * 70, () => this.effects.breathPuff(this.climber.x + this.runRng.range(-8, 8), this.climber.y + 14));
    }
    await this.climber.tweenTo(to.x, to.y, 560, 'Sine.easeInOut');
    this.climber.setPose('grab');
    Audio.play('grab');
    this.effects.chalk(to.x, to.y);
    this.effects.sparkle(to.x, to.y, 6);
    this.flashHold(to.id);
    this.floatText(`LIFTED +${gain}M`, '#ffb45a', 12);
    this.discover('thermal-ride');
    this.prog.bump('thermals');
    await this.climber.hold('grab', 140);
    this.arrive(to, gain);
  }

  async failClimb() {
    this.dropPendingGem();
    this.floatText('LOST THE HOLD', COLORS.red, 10);
    await this.climber.hold('slip2', 220);
    Audio.play('pebble', { count: 2, volume: 0.6 });
    await this.climber.tweenTo(this.from.x, this.from.y, 260, 'Quad.easeIn');
    this.climber.setPose('hang');
    if (this.grip.isEmpty) { this.startSlip(); return; }
    this.enterRouteSelect();
  }

  // stay: record the arrival but leave the next state to the caller.
  arrive(node, gain, { stay = false } = {}) {
    const prev = this.node;
    this.node = node;
    this.run.climbed += gain;
    const h = levelToMeters(node.level);
    this.run.maxHeight = Math.max(this.run.maxHeight || 0, h);
    if (this.director) this.director.onArrive(node);
    else this.prog.addClimbed(gain);
    const { newBest, unlocks } = this.director ? { newBest: false, unlocks: [] }
      : this.expedition ? { newBest: this.prog.recordExpeditionHeight(this.expedition.id, h), unlocks: [] }
        : this.dared ? this.prog.recordDareHeight(h, this.dareKey) : this.prog.recordHeight(h, this.mode);
    if (newBest && !this.director && !this.expedition && !this.devRun && !this.dared) queueSubmit(this.prog);
    if (newBest && !this.run.newBestShown && this.run.startBest > 0) {
      this.run.newBestShown = true;
      this.celebrateRecord();
    }
    unlocks.forEach((u) => this.hud.toast(`UNLOCKED: ${u.name}`, COLORS.gold));
    if (this.pendingGem && this.pendingGem.route.target === node) this.collectGem(this.pendingGem);
    // CHALK MARKS: prints on the holds you used, and with YOUR LINE a dotted trail between them.
    const chalkMarks = this.settings.chalkMarks || 'line';
    if (chalkMarks !== 'off') {
      const tint = this.chalkTint();
      if (node.kind !== 'ledge') this.wall.addChalk(node.id, tint);
      if (chalkMarks === 'line' && prev && prev !== node && prev.level < node.level) this.wall.addChalkLine(prev, node, tint);
    }
    this.pendingGem = null;
    this.checkHeightGems();
    this.checkMilestone(h);
    this.checkBiome(h);
    this.trackPass(h);
    this.checkNextBiome(h);
    this.checkLogbook();
    this.mountain.ensureLevel(node.level + GENERATE_AHEAD_LEVELS);
    this.mountain.prune(Math.min(this.checkpoint.level, node.level - KEEP_BELOW_LEVELS));
    if (stay) return;
    if (node.summit) this.reachSummit(node);
    else if (node.kind === 'ledge') this.enterRest(node);
    else this.enterRouteSelect();
  }

  // ---------------------------------------------------------------- slipping & falling
  startSlip() {
    if (this.state === STATE.SLIPPING || this.state === STATE.FALLING) return;
    this.state = STATE.SLIPPING;
    this.dodge = null;
    this.routeUI.hide();
    this.comboUI.hide();
    this.clearTargetMark();
    this.clearCrumble();
    this.gustActive = false;
    this.combo = null;
    this.clearRouteGems();
    this.dropPendingGem();
    this.breakStreak();
    this.run.slips++;
    this.climber.stopTweens();
    // The biome's one slip is already used: this one ends the run.
    if (!this.director && !this.expedition) {
      const stretch = biomeStretchAt(levelToMeters(this.node.level));
      if (this.run.biomeFalls[stretch]) {
        this.runOverReason = `A SECOND SLIP IN ${biomeAt(levelToMeters(this.node.level)).name}`;
        this.floatText('LOST THE GRIP!', COLORS.red, 12);
        Audio.play('slip');
        this.startFall(true);
        return;
      }
      this.run.biomeFalls[stretch] = 1;
    }
    const cp = this.checkpoint;
    const catchLevel = this.mountain.catchLevelBelow(this.node.level - BALANCE.slip.slideLevels, cp.level);
    let catchNode = cp;
    if (catchLevel !== null) {
      const lv = this.mountain.getLevel(catchLevel);
      catchNode = lv.nodes.slice().sort((a, b) => Math.abs(a.x - this.climber.x) - Math.abs(b.x - this.climber.x))[0];
    }
    this.catchNode = catchNode;
    const catchY = catchNode.kind === 'ledge' ? catchNode.y - STAND_HAND : catchNode.y;
    this.climber.setPose('slip');
    Audio.play('slip');
    const biome = biomeAt(levelToMeters(this.node.level));
    this.effects.pebbleFall(this.climber.x, this.climber.y + 10, 8, biome.rock[3]);
    if (biome.weather.snow > 0.3) this.effects.snowBurst(this.climber.x, this.climber.y + 6);
    this.effects.chalk(this.climber.x, this.climber.y);
    if (this.settings.shake) this.cam.shake(260, 0.006);
    this.floatText('SLIPPING!', COLORS.red, 12);
    this.tip('slip');

    const cfg = BALANCE.slip;
    const extra = this.run.firstSlip ? cfg.firstSlipBonusMs : 0;
    this.run.firstSlip = false;
    const mult = (this.forgiving ? BALANCE.timing.forgivingMultiplier : 1) * this.modeCfg.catchScale;
    const dir = this.runRng.pick(['L', 'U', 'R']);
    this.recovery = new ComboSystem({
      pattern: [dir], beatMs: 1,
      perfectMs: Math.round(cfg.perfectMs * mult), goodMs: Math.round((cfg.goodMs + extra) * mult),
      earlyGraceMs: 150, leadInMs: cfg.leadInMs, startTime: this.now(),
    });
    this.comboUI.showRecovery(this.recovery);
    this.climber.tweenTo(catchNode.x, catchY, cfg.leadInMs, 'Quad.easeIn');
  }

  recoveryInput(dir, t) {
    const res = this.recovery.press(dir, t);
    if (res.auto.length) return this.recoveryFail(res.auto[0]);
    if (!res.judged) return;
    if (res.judged.result === 'miss') this.recoveryFail(res.judged);
    else this.recoverySuccess(res.judged);
  }

  async recoverySuccess(note, byRope = false) {
    if (this.director) this.director.onSlipCaught();
    if (!byRope) this.comboUI.judge(note);
    this.recovery = null;
    this.state = STATE.CLIMB_ANIMATION;
    this.lastJudge = byRope ? 'RECOVERY BY SPARE ROPE' : `RECOVERY ${note.result.toUpperCase()} ${Math.round(note.offset)}MS`;
    const node = this.catchNode;
    this.climber.stopTweens();
    const y = node.kind === 'ledge' ? node.y - STAND_HAND : node.y;
    this.climber.setPose('grab');
    Audio.play('recover');
    this.effects.chalk(node.x, y);
    if (this.settings.shake) this.cam.shake(120, 0.004);
    this.grip.set(note.result === 'perfect' ? BALANCE.grip.afterPerfectRecovery : BALANCE.grip.afterRecovery);
    if (!byRope && note.result === 'perfect' && !this.director) { this.prog.bump('greatCatches'); this.checkLogbook(); }
    this.floatText(byRope ? 'THE SPARE ROPE HELD!' : note.result === 'perfect' ? 'GREAT CATCH!' : 'CAUGHT IT!', COLORS.green, 12);
    if (this.lava) this.lava.y = Math.max(this.lava.y, node.y + 140);
    this.warnLastFall();
    await this.climber.tweenTo(node.x, y, 110, 'Quad.easeOut');
    await this.climber.hold('grab', 350);
    this.comboUI.hide();
    this.node = node;
    if (node.kind === 'ledge') this.respawnAt(node, 'CAUGHT THE LEDGE', false);
    else this.enterRouteSelect();
  }

  recoveryFail(note) {
    if (note) {
      this.comboUI.judge(note);
      this.lastJudge = `RECOVERY MISS ${note.reason ? note.reason.toUpperCase() : ''}`;
    }
    this.recovery = null;
    if (this.gear.rope > 0) {
      this.gear.rope = 0;
      Audio.play('gear');
      this.updateGearHud();
      this.recoverySuccess({ result: 'good', offset: 0 }, true);
      return;
    }
    this.startFall();
  }

  // final: the second slip in a biome (startSlip set runOverReason).
  async startFall(final = false) {
    if (this.director) this.director.onFall();
    this.state = STATE.FALLING;
    this.run.falls++;
    this.climber.stopTweens();
    this.time.delayedCall(250, () => this.comboUI.hide());
    Audio.play('fall');
    const cp = this.checkpoint;
    const dist = cp.y - this.climber.y;
    // Expeditions have no slip limit: every fall goes back to the last ledge.
    if (!final) this.runOverReason = null;
    const ending = final || (this.modeCfg.permadeath && !this.director && !this.expedition);
    await this.peelOff();
    if (this.state !== STATE.FALLING) return;
    if (ending) {
      // The last fall: the climber tumbles away down the wall.
      this.climber.flail(540);
      this.climber.tweenTo(this.climber.x + this.runRng.range(-30, 30), this.climber.y + 200, 900, 'Quad.easeIn');
      this.time.delayedCall(650, () => this.cloudFall());
      return;
    }
    this.climber.flail();
    if (dist < 170) {
      await this.climber.tweenTo(cp.x, cp.y, 300 + dist * 2, 'Quad.easeIn');
      this.climber.stopFlail();
      this.climber.setPose('land');
      this.climber.squash(1.25, 0.75, 260);
      Audio.play('land');
      this.effects.chalk(cp.x, cp.y);
      this.effects.chalk(cp.x - 6, cp.y);
      this.effects.chalk(cp.x + 6, cp.y);
      if (this.settings.shake) this.cam.shake(200, 0.008);
      this.floatText('LANDED SAFELY', COLORS.text, 12);
      await this.climber.hold('land', 550);
      this.respawnAt(cp, 'YOU LANDED ON THE LEDGE', false);
      this.warnLastFall();
    } else {
      this.climber.tweenTo(this.climber.x, this.climber.y + 150, 800, 'Quad.easeIn');
      this.time.delayedCall(420, () => {
        this.cam.fadeOut(420, 10, 12, 20);
        this.cam.once('camerafadeoutcomplete', () => {
          this.respawnAt(cp, cp.level === 0 ? 'BACK AT BASE CAMP' : 'BACK AT THE LAST CHECKPOINT', true);
          this.warnLastFall();
          this.cam.fadeIn(650, 10, 12, 20);
        });
      });
    }
  }

  // The end of a run: the climber tumbles down through the clouds, slowly,
  // while the height counts back to 0 m, then lands in the cloud sea.
  cloudFall() {
    if (this.state !== STATE.FALLING) return;
    const W = GAME_WIDTH, H = GAME_HEIGHT, D = DEPTH.hud + 5, ms = 2400;
    const day = this.dayNight.state();
    const from = Math.floor(levelToMeters(this.node.level));
    this.setHudVisible(false);
    this.comboUI.hide();
    const parts = [];
    const own = (o) => { parts.push(o); return o.setScrollFactor(0); };
    const sky = own(this.add.rectangle(0, 0, W, H, lerpColor(0x9fc4ec, 0x1c2242, day.night)).setOrigin(0, 0).setDepth(D).setAlpha(0));
    this.tweens.add({ targets: sky, alpha: 1, duration: 350 });
    const tint = lerpColor(0xffffff, 0x6a7090, day.night);
    for (let i = 0; i < 12; i++) {
      const front = i % 3 === 0;
      const c = own(this.add.image(Math.random() * W, H + 30 + Math.random() * H * 1.4, `cloud${i % 4}`).setDepth(front ? D + 3 : D + 1)
        .setScale(front ? 3 : 1.6 + Math.random()).setTint(tint).setAlpha(front ? 0.85 : 0.7));
      this.tweens.add({ targets: c, y: c.y - H * (front ? 3.2 : 2.2), duration: ms + 400, ease: 'Linear' });
    }
    const body = own(this.add.sprite(W / 2, H * 0.42, 'climber', 'fall').setDepth(D + 2).setAlpha(0));
    this.tweens.add({ targets: body, alpha: 1, duration: 300 });
    this.tweens.add({ targets: body, angle: 360 * (this.runRng.chance(0.5) ? 1 : -1), duration: 1800, repeat: -1 });
    this.tweens.add({ targets: body, x: W / 2 + 14, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const frames = ['fall', 'fall2', 'fall3', 'fall2'];
    let f = 0;
    const flail = this.time.addEvent({ delay: 140, loop: true, callback: () => body.setFrame(frames[++f % frames.length]) });
    const meter = own(new PixelText(this, W / 2, H * 0.14, `${from} M`, { color: COLORS.text, shadow: '#16141f' }).setOrigin(0.5, 0).setScale(3).setDepth(D + 4));
    const count = { m: from };
    this.tweens.add({ targets: count, m: 0, duration: ms - 300, ease: 'Quad.easeIn', onUpdate: () => meter.setText(`${Math.round(count.m)} M`) });
    Audio.swell(6);
    this.time.delayedCall(ms - 250, () => {
      const puff = own(this.add.rectangle(0, 0, W, H, 0xffffff).setOrigin(0, 0).setDepth(D + 5).setAlpha(0));
      this.tweens.add({ targets: puff, alpha: 0.7, duration: 200 });
      Audio.play('land');
      this.cam.fadeOut(350, 10, 12, 20);
      this.cam.once('camerafadeoutcomplete', () => {
        flail.remove();
        parts.forEach((o) => { this.tweens.killTweensOf(o); o.destroy(); });
        this.climber.stopFlail();
        this.runOver();
      });
    });
  }

  // The hands lose the hold: a short moment hanging off nothing, chalk and
  // grit coming off the hold, before the drop.
  async peelOff() {
    const c = this.climber;
    c.setPose('fall_peel');
    this.effects.chalk(c.x - 6, c.y);
    this.effects.chalk(c.x + 6, c.y);
    this.effects.pebbleFall(c.x, c.y + 2, 4, 0x8a7f74);
    await c.tweenTo(c.x, c.y - 3, 90, 'Quad.easeOut');
    await c.tweenTo(c.x, c.y + 6, 110, 'Quad.easeIn');
  }

  warnLastFall() {
    if (this.director || this.expedition) return;
    this.tip('fall');
    this.hud.toast('SLIP USED: THE NEXT ONE HERE SENDS YOU BACK TO 0 M', COLORS.red);
  }

  // ---------------------------------------------------------------- expeditions
  // "PITCH 4/12  BRAM'S CRACK" for the HUD.
  pitchLabel() {
    const seg = this.mountain.segmentForLevel(this.node.level);
    const n = this.expedition.pitches.length;
    let pi = seg && seg.pitchIndex != null ? seg.pitchIndex : 0;
    if (this.node.kind === 'ledge' && !this.node.summit && this.node.level > 0) pi = Math.min(n - 1, pi + 1);
    return `PITCH ${pi + 1}/${n}  ${this.expedition.pitches[pi].name}`;
  }

  // Bram's page from the cairn on this ledge.
  showJournalPage(pi) {
    if (this.state !== STATE.RESTING || this.journal.open) return;
    const exp = this.expedition;
    const isNew = this.devRun ? false : this.prog.findJournalPage(exp.id, pi);
    const found = this.prog.expedition(exp.id).pages.length;
    const total = exp.pitches.length - 1;
    this.journal.show({ title: `BRAM'S JOURNAL  •  PAGE ${pi + 1}`, lines: exp.pitches[pi].page, footer: isNew ? `NEW PAGE  •  ${found}/${total} FOUND` : `${found}/${total} PAGES FOUND` });
    if (isNew) Audio.play('discovery');
  }

  // The top of an expedition: celebrate, read the last page, then the summary.
  async reachSummit(node) {
    const exp = this.expedition;
    this.state = STATE.RUN_OVER;
    this.routeUI.hide();
    this.comboUI.hide();
    this.climber.setPose('look');
    const ms = this.clock - (this.run.departedAt || 0);
    const res = this.prog.recordSummit(exp.id, ms);
    if (res.first) this.awardGems(exp.reward);
    this.prog.bump('summits');
    this.checkLogbook();
    Audio.play('fanfare');
    Audio.swell(30);
    this.hud.flashScreen(0xfff1d6, 0.35, 600);
    const v = this.cam.worldView;
    this.effects.confettiBurst(v.x + 50, v.y + 30, 34);
    this.effects.confettiBurst(v.right - 50, v.y + 30, 34);
    this.effects.confettiBurst(node.x, node.y - 40, 24);
    this.hud.celebrate({ title: 'SUMMIT!', sub: `${exp.name}  •  ${Math.floor(levelToMeters(node.level))} M`, color: COLORS.gold });
    await new Promise((r) => this.time.delayedCall(2200, r));
    this.journal.show({ title: 'UNDER THE SUMMIT STONE', lines: exp.summitPage, footer: "NOT BRAM'S HANDWRITING" }, () => this.summitSummary(ms, res));
  }

  summitSummary(ms, res) {
    const fmt = (t) => `${Math.floor(t / 60000)}:${String(Math.floor((t % 60000) / 1000)).padStart(2, '0')}`;
    this.setHudVisible(false);
    const reached = levelToMeters(this.node.level);
    this.runOverUI = new RunSummary(this, {
      title: 'SUMMIT!', titleColor: COLORS.gold,
      modeLabel: this.expedition.name,
      reached, best: reached, isRecord: false,
      recordLine: `TIME ${fmt(ms)}  •  BEST ${fmt(res.bestTime)}  •  FALLS ${this.run.falls}`,
      reason: res.first ? `FIRST ASCENT!  +${this.expedition.reward}◆` : '',
      strandedLabel: 'STOOD ON THE SUMMIT', stripTop: reached,
      perfects: this.run.perfects, bestStreak: this.run.bestStreak,
      caught: Math.max(0, this.run.slips - this.run.falls),
      finds: this.run.finds, stones: this.run.stones, gems: this.run.gems,
      wallet: this.prog.gems, stamps: this.run.stamps,
    }, { onAgain: () => this.climbAgain(), onTitle: () => this.toMenu() });
  }

  // A second slip in one biome ends the run; in Summit mode so does any fall.
  runOver() {
    this.state = STATE.RUN_OVER;
    this.routeUI.hide();
    this.comboUI.hide();
    this.restUI.hide();
    this.setHudVisible(false);
    // The Golden City's song does not play over the run summary.
    if (this.city.active) Audio.setMusicMode(biomeAt(levelToMeters(this.node.level)).music);
    Audio.play('runover');
    this.checkLogbook();
    const best = this.recordBest;
    const reached = this.run.maxHeight || 0;
    const fallH = levelToMeters(this.node.level);
    this.runOverUI = new RunSummary(this, {
      modeLabel: this.dared ? `${this.modeCfg.label} DARE ${dareLabel(this.dares)}` : this.modeCfg.label,
      reached: Math.max(reached, fallH),
      best: this.run.startBest,
      isRecord: reached >= best && reached > this.run.startBest,
      reason: this.runOverReason ? `${this.runOverReason}: BACK TO 0 M` : this.modeCfg.permadeath ? 'ONE FALL ENDS A SUMMIT RUN' : '',
      perfects: this.run.perfects,
      bestStreak: this.run.bestStreak,
      caught: Math.max(0, this.run.slips - this.run.falls),
      finds: this.run.finds,
      stones: this.run.stones,
      gems: this.run.gems,
      wallet: this.prog.gems,
      stamps: this.run.stamps,
    }, {
      onAgain: () => this.climbAgain(),
      onTitle: () => this.toMenu(),
      onBoard: leaderboardEnabled() && !this.director && !this.expedition && !this.devRun && !this.dared ? () => this.openLeaderboard() : null,
      boardLabel: playerName(this.prog) ? '[L] LEADERBOARD' : '[L] JOIN THE LEADERBOARD',
    });
    this.cam.fadeIn(500, 10, 12, 20);
  }

  openLeaderboard() {
    this.scene.launch('Leaderboard', { returnTo: 'Climb', mode: this.mode });
    this.scene.pause();
  }

  climbAgain() { wipeOut(this, () => this.scene.restart(this.expedition ? { expedition: this.expedition.id } : this.devRun ? { devStart: this.devStart } : {})); }

  toMenu() {
    this.registry.set('dayT', this.dayNight.t);
    wipeOut(this, () => this.scene.start('Menu'));
  }

  respawnAt(cp, message, snap) {
    this.climber.stopTweens();
    if (this.lava) this.lava.y = cp.y + 150;
    this.refillAtLedge();
    this.node = cp;
    if (snap) {
      this.camY = cp.y - STAND_HAND - GAME_HEIGHT * CAMERA_ANCHOR;
      this.camX = camXFor(cp.x);
      this.cam.setScroll(Math.round(this.camX), Math.round(this.camY));
    }
    this.enterRest(cp, { respawn: true, message });
  }

  // ---------------------------------------------------------------- resting
  enterRest(node, opts = {}) {
    this.state = STATE.RESTING;
    this.node = node;
    this.checkpoint = node;
    this.routeUI.hide();
    this.comboUI.hide();
    this.clearCrumble();
    this.climber.stopTweens();
    this.climber.setPosition(node.x, node.y);
    this.climber.setPose('stand');
    this.sitting = false;
    this.grip.resetHang();
    const seg = this.mountain.segmentForLevel(node.level);
    const rest = (seg && seg.rest) || { type: 'ledge', name: 'LEDGE' };
    let title = rest.name || 'LEDGE';
    let subtitle = this.dares.includes('light') ? 'CHECKPOINT  •  GRIP TO HALF' : 'CHECKPOINT  •  GRIP RESTORED';
    let detail = '';
    if (opts.initial) { title = this.tutorial ? 'TRAINING CRAG' : 'BASE CAMP'; subtitle = this.tutorial ? 'TUTORIAL' : 'THE MOUNTAIN IS WAITING'; }
    else if (opts.respawn) subtitle = opts.message || 'BACK AT THE LAST CHECKPOINT';
    else if (this.director) Audio.play('checkpoint');
    else {
      Audio.play('checkpoint');
      this.tip('rest');
      if (biomeAt(levelToMeters(node.level)).id === 'obsidian') this.prog.bump('darkLedges');
      if (rest.viewpoint) {
        const r = this.prog.discoverViewpoint(rest.viewpoint);
        if (r.isNew) { detail = 'NEW VIEWPOINT'; this.hud.toast(`VIEWPOINT: ${rest.viewpoint}`, COLORS.blue); this.run.finds.push(rest.viewpoint); this.checkLogbook(); }
        r.unlocks.forEach((u) => this.hud.toast(`UNLOCKED: ${u.name}`, COLORS.gold));
        this.revealUntil = this.clock + 5000;
        Audio.swell(28);
      }
      if (rest.discovery) {
        const r = this.discover(rest.discovery);
        if (r) detail = DISCOVERIES[rest.discovery].text;
      }
    }
    if (!opts.initial && !opts.respawn && !this.director && !this.run.sunriseSeen && this.dayNight.state().isDawn) this.sunriseMoment();
    if (this.expedition && rest.journal != null && !opts.respawn) this.time.delayedCall(450, () => this.showJournalPage(rest.journal));
    this.restInfo = { title, subtitle, detail, trader: this.atTrader() };
    if (this.campMenu && node.level === 0 && !opts.initial) {
      // Base camp: the title camp menu instead of the rest panel.
      this.atCamp = true;
      this.hud.setVisible(false);
      this.campMenu.opts.camp = node;
      this.campMenu.opts.spots = this.wall.campSpots;
      this.campMenu.show();
    } else {
      this.restUI.show({ ...this.restInfo, sitting: false });
      this.showTraderTag();
    }
    Audio.setMusicIntensity(0.6);
    if (this.director) this.director.onRest(node);
    // How the climb went shows on the ledge: a cheer after a long perfect
    // streak, hands on the knees after arriving with little grip left.
    else if (!opts.initial && !opts.respawn && !this.atCamp) {
      if (this.run.streak >= 10) this.climber.fidget('cheer', this.effects);
      else if (this.grip.ratio < 0.35) this.climber.fidget('pant', this.effects);
    }
  }

  // Reaching a ledge just as the sun comes up (once per run): the HUD steps
  // aside, cinema bars slide in, the view drifts up to the sky and warm rays
  // fan out from the sun while its own melody plays.
  sunriseMoment() {
    this.run.sunriseSeen = true;
    const H = GAME_HEIGHT, D = DEPTH.hud - 2, ms = 6000;
    this.revealUntil = this.clock + ms;
    this.hud.setVisible(false);
    const bars = [0, 1].map((i) => this.add.rectangle(0, i ? H : 0, GAME_WIDTH, 22, 0x0a0812).setOrigin(0, i ? 0 : 1).setScrollFactor(0).setDepth(D));
    this.tweens.add({ targets: bars[0], y: 22, duration: 700, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: bars[1], y: H - 22, duration: 700, ease: 'Quad.easeOut' });
    const sun = this.dayNight.state().sun || { x: 60, y: 140 };
    const rays = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.far + 9).setBlendMode('ADD').setAlpha(0);
    const st = { a: 0 };
    const draw = () => {
      rays.clear();
      for (let i = 0; i < 9; i++) {
        const ang = -Math.PI * 0.95 + (i / 8) * Math.PI * 0.9 + Math.sin(st.a * 2 + i) * 0.02;
        const len = 240 + (i % 3) * 60, w = 0.035 + (i % 2) * 0.02;
        rays.fillStyle(i % 2 ? 0xffd6a0 : 0xffb070, 0.16);
        rays.fillTriangle(sun.x, sun.y, sun.x + Math.cos(ang - w) * len, sun.y + Math.sin(ang - w) * len, sun.x + Math.cos(ang + w) * len, sun.y + Math.sin(ang + w) * len);
      }
    };
    this.tweens.add({ targets: st, a: 1, duration: ms, onUpdate: draw });
    this.tweens.add({ targets: rays, alpha: 1, duration: 1400, yoyo: true, hold: ms - 2800 });
    const title = new PixelText(this, GAME_WIDTH / 2, 11, 'SUNRISE', { color: '#ffd6a0' }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(D + 1).setScale(2).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, duration: 900, delay: 500, yoyo: true, hold: ms - 2600 });
    Audio.play('sunrise');
    Audio.swell(12);
    if (levelToMeters(this.node.level) > 480) this.discover('sunrise-above');
    this.time.delayedCall(ms - 700, () => {
      this.tweens.add({ targets: bars[0], y: 0, duration: 700, ease: 'Quad.easeIn' });
      this.tweens.add({ targets: bars[1], y: H, duration: 700, ease: 'Quad.easeIn', onComplete: () => { bars.forEach((b) => b.destroy()); rays.destroy(); title.destroy(); if (!this.atCamp) this.hud.setVisible(true); } });
    });
  }

  // First completion pays out a few gems for the trader.
  grantTutorialReward(n) {
    if (this.prog.data.tutorialDone) return 0;
    this.prog.data.tutorialDone = true;
    this.prog.addGems(n);
    this.hud.setGems(this.prog.gems, true);
    return n;
  }

  celebrateTutorial() {
    Audio.play('fanfare');
    this.hud.flashScreen(0xf2c14e, 0.25, 420);
    const v = this.cam.worldView;
    this.effects.confettiBurst(v.x + 40, v.y + 30, 30);
    this.effects.confettiBurst(v.right - 40, v.y + 30, 30);
    this.effects.confettiBurst(this.climber.x, this.climber.y - 30, 20);
  }

  onTutorialComplete() {
    this.prog.data.tutorialDone = true;
    this.prog.save();
    wipeOut(this, () => this.scene.restart({}));
  }

  restAction(a) {
    if (this.state !== STATE.RESTING || this.journal.open) return;
    this.wakeUp();
    if (a === 'continue' && this.director && this.director.holdRest && !this.director.finished) { this.tutorialCard.next(); return; }
    if (a === 'rest') {
      this.sitting = !this.sitting;
      Audio.play('cloth');
      this.restUI.show({ ...this.restInfo, sitting: this.sitting });
      if (this.sitting) Audio.swell(18);
    } else if (a === 'view') this.startView();
    else if (a === 'photo') this.takePhoto();
    else if (a === 'trader' && this.atTrader()) this.openTrader();
    else if (a === 'continue') this.leaveRest();
  }

  // LIGHT PACK: a ledge only fills the grip up to half.
  get ledgeCap() { return this.grip.max * (this.dares.includes('light') ? DARE.lightCap : 1); }

  refillAtLedge() {
    if (this.dares.includes('light')) { this.grip.resetHang(); this.grip.set(Math.max(this.grip.value, this.ledgeCap)); }
    else this.grip.restoreFull();
  }

  leaveRest() {
    this.climber.stopFidget();
    this.refillAtLedge();
    if (this.atCamp) {
      this.atCamp = false;
      this.campMenu.hide();
      this.hud.setVisible(true);
    }
    this.restUI.hide();
    this.hideTraderTag();
    if (!this.run.departed && this.node.level === 0) { this.run.departed = true; this.run.departedAt = this.clock; this.activateLoadout(); }
    if (this.lava) this.tip('lava');
    this.sitting = false;
    Audio.setMusicIntensity(0.3);
    Audio.play('cloth');
    this.enterRouteSelect();
  }

  startView() {
    this.state = STATE.VIEWING;
    this.restUI.hide();
    this.hideTraderTag();
    this.setHudVisible(false);
    this.sitting = false;
    this.viewHint = new PixelText(this, GAME_WIDTH / 2, GAME_HEIGHT - 14, 'PRESS ANY KEY TO RETURN', { color: COLORS.faint }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH.hud);
    Audio.swell(20);
  }

  exitView() {
    this.state = STATE.RESTING;
    this.setHudVisible(true);
    if (this.viewHint) { this.viewHint.destroy(); this.viewHint = null; }
    this.restUI.show({ ...this.restInfo, sitting: this.sitting });
    this.showTraderTag();
  }

  takePhoto() {
    if (this.photoBusy) return;
    this.photoBusy = true;
    this.setHudVisible(false);
    this.restUI.setVisible(false);
    const h = Math.round(yToMeters(this.node.y));
    this.game.renderer.snapshot((img) => {
      this.photoBusy = false;
      if (!this.sys.isActive() && !this.sys.isPaused()) return;
      this.setHudVisible(true);
      this.restUI.setVisible(true);
      Audio.play('photo');
      const flash = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffffff).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.overlay);
      this.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() });
      this.prog.addPhoto();
      if (this.dayNight.state().night > 0.5) this.prog.bump('nightPhotos');
      this.checkLogbook();
      try {
        const a = document.createElement('a');
        a.href = img.src;
        a.download = `above-the-clouds-${h}m.png`;
        a.click();
      } catch { /* downloads blocked */ }
      this.hud.toast('PHOTO SAVED', COLORS.text);
    });
  }

  // ---------------------------------------------------------------- discoveries & biomes
  discover(id) {
    if (this.director) return false;
    const r = this.prog.discover(id);
    r.unlocks.forEach((u) => this.hud.toast(`UNLOCKED: ${u.name}`, COLORS.gold));
    if (!r.isNew) return false;
    this.hud.toast(`DISCOVERY: ${DISCOVERIES[id].name}`, COLORS.gold);
    Audio.play('discovery');
    this.run.finds.push(DISCOVERIES[id].name);
    this.checkLogbook();
    return true;
  }

  // ---------------------------------------------------------------- Bram's logbook
  checkLogbook() {
    if (this.director || !this.run) return;
    for (const st of this.prog.checkStamps(this.run)) {
      this.run.stamps.push(st);
      this.hud.toast(`LOGBOOK STAMP: ${st.name}  +${st.gems}◆`, COLORS.gold);
      this.hud.setGems(this.prog.gems, true);
      this.hud.gemGain(st.gems, COLORS.gold);
      Audio.play('stamp');
    }
  }

  checkBiome(h) {
    const b = biomeAt(h);
    if (b.id === this.biomeId) return;
    this.biomeId = b.id;
    const r = this.prog.discoverBiome(b.id);
    if (this.director && h === 0) return;
    this.city.close();
    // Very rarely a biome turns out to be the secret Golden City (never while the lift carries you).
    if (h > 0 && !this.director && !this.expedition && !this.lifting && this.city.roll(!!(this.prog.data.cheats && this.prog.data.cheats.goldenCity))) {
      this.city.open(biomeStretchAt(h));
      return;
    }
    Audio.setMusicMode(b.music);
    if (h > 0 && !this.lifting && !this.director && !this.expedition) { this.panorama(b, r.isNew); return; }
    this.hud.showBanner(b.name, r.isNew && h > 0 ? 'A NEW PART OF THE MOUNTAIN' : `${Math.floor(h)} M`);
    if (h > 0) { Audio.swell(16); Audio.play('titlecard'); }
  }

  // Climbing into a new biome: cinema bars slide in and the camera drifts up
  // to show the new part of the mountain, then the title card. The clock that
  // drains grip waits while it plays (see update()).
  panorama(b, isNew) {
    const H = GAME_HEIGHT, D = DEPTH.hud - 2, ms = 2600;
    this.panoramaUntil = this.clock + ms;
    this.revealUntil = 0;
    const bars = [0, 1].map((i) => this.add.rectangle(0, i ? H : 0, GAME_WIDTH, 18, 0x0a0812).setOrigin(0, i ? 0 : 1).setScrollFactor(0).setDepth(D));
    this.tweens.add({ targets: bars[0], y: 18, duration: 450, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: bars[1], y: H - 18, duration: 450, ease: 'Quad.easeOut' });
    Audio.swell(16);
    this.time.delayedCall(700, () => {
      this.hud.showBanner(b.name, isNew ? 'A NEW PART OF THE MOUNTAIN' : `${Math.floor(levelToMeters(this.node.level))} M`);
      Audio.play('titlecard');
    });
    this.panoramaBars = bars;
    this.time.delayedCall(ms - 450, () => this.endPanorama());
  }

  // Any key cuts the panorama short.
  endPanorama() {
    this.panoramaUntil = Math.min(this.panoramaUntil || 0, this.clock);
    const bars = this.panoramaBars;
    this.panoramaBars = null;
    if (bars) bars.forEach((bar, i) => this.tweens.add({ targets: bar, y: i ? GAME_HEIGHT : 0, duration: 450, ease: 'Quad.easeIn', onComplete: () => bar.destroy() }));
  }

  get inPanorama() { return this.clock < (this.panoramaUntil || 0) && this.state !== STATE.FALLING; }

  // Left alone on a ledge, the climber passes the time: a stretch, chalking
  // up, shaking the arms loose, a look around. Sitting, they nod off (Zzz).
  // ---------------------------------------------------------------- feel
  // HIT-STOP setting: how long perfect hits hold still (OFF, SUBTLE, PUNCHY).
  get hitStopScale() { return { off: 0, punchy: 1.6 }[this.settings.hitStop] ?? 1; }

  // A freeze-frame on a big moment: every tween and particle holds still for
  // a few frames. The game clock, the notes and the music keep running, so
  // the next beat still lands where it should.
  freezeFrame(ms, flash = null) {
    const scale = this.hitStopScale;
    if (!scale || this.tipOpen || this.paused) return;
    const hold = Math.round(ms * scale);
    this.frozenFx = this.frozenFx || new Set();
    this.children.list.forEach((o) => { if (o.type === 'ParticleEmitter' && o.timeScale) { o.timeScale = 0; this.frozenFx.add(o); } });
    this.tweens.timeScale = 0;
    if (flash && this.settings.hitStop === 'punchy') this.hud.flashScreen(flash, 0.18, hold + 120);
    const id = (this.freezeId = (this.freezeId || 0) + 1);
    window.setTimeout(() => {
      if (id !== this.freezeId || !this.sys || !this.sys.settings.active) return;
      this.tweens.timeScale = 1;
      this.frozenFx.forEach((o) => { if (o.active) o.timeScale = 1; });
      this.frozenFx.clear();
    }, hold);
  }

  // BEAT PULSE setting: the mountain moves with the beat. During a climb the
  // beat is the climb's own; otherwise the biome's music tempo.
  updateBeatPulse(biome, cold) {
    const mode = this.settings.beatPulse || 'subtle';
    this.climber.beatBreath = mode !== 'off';
    if (mode === 'off' || this.state === STATE.RUN_OVER || this.tipOpen) return;
    const combo = this.state === STATE.CLIMBING_COMBO && this.combo;
    const beat = combo
      ? `c${Math.floor((this.now() - this.combo.notes[0].time) / this.combo.beatMs + 64)}`
      : `f${Math.floor((this.clock / 60000) * biome.music.tempo)}`;
    if (beat === this.lastBeat) return;
    const first = this.lastBeat === null;
    this.lastBeat = beat;
    if (first) return;
    this.beatCount = (this.beatCount || 0) + 1;
    const pulse = (o, k = 1.25, ms = 150) => {
      if (!o || !o.active) return;
      o.setScale(k);
      this.tweens.add({ targets: o, scale: 1, duration: ms, ease: 'Quad.easeOut' });
    };
    // The ring on the hold you are climbing to, or the hold you have picked, beats.
    if (combo) pulse(this.targetMark, 1.3);
    else if (this.state === STATE.ROUTE_SELECT && this.routes[this.selected]) pulse(this.wall.getHold(this.routes[this.selected].target.id), 1.18, 130);
    // In the cold, breath clouds come out on every other beat.
    const around = this.state === STATE.ROUTE_SELECT || this.state === STATE.RESTING || this.state === STATE.CLIMBING_COMBO || this.state === STATE.VIEWING;
    if (cold && around && this.beatCount % 2 === 0) { const h = this.climber.head; this.effects.breathPuff(h.x + 2, h.y + 2); }
    if (mode !== 'full') return;
    // FULL: the air swells with the biome's own motes, and the hanging body
    // gives a one-pixel nod on the beat.
    this.atmos.pulse(biome, this.climber.x, this.climber.y - 20, combo ? 2 : 3);
    if (this.state === STATE.ROUTE_SELECT && this.climber.busy === 0) {
      this.climber.offsetX = 0;
      this.climber.sprite.y = Math.round(this.climber.y) + 1;
      this.time.delayedCall(90, () => this.climber.sync());
    }
  }

  updateRestIdle(dt, wallState, day = null) {
    if (wallState !== 'ledge' || this.atCamp || this.tipOpen || this.director) { this.restIdle = 0; this.restIdleNext = REST_IDLE_FIRST; return; }
    this.restIdle = (this.restIdle || 0) + dt;
    if (this.restIdle < (this.restIdleNext || REST_IDLE_FIRST) || this.climber.busy > 0 || this.climber.fidgeting) return;
    this.restIdleNext = this.restIdle + 3000 + Math.random() * 3500;
    if (this.sitting) { this.snore(); return; }
    // LEDGE LIFE: LIVELY. The longer you stay, the more the climber settles in:
    // a drink, a look at the map, a wave; warm hands in the cold, the stars at night.
    let pool = FIDGET_NAMES;
    if (this.settings.ledgeLife !== 'calm' && this.restIdle > 9000) {
      const biome = biomeAt(levelToMeters(this.node.level));
      const night = day ? day.night : 0;
      const cold = biome.weather.snow > 0.3 || night > 0.6;
      pool = [...FIDGET_NAMES, ...LIVELY_NAMES.filter((n) => (n !== 'stargaze' || night > 0.6) && (n !== 'warm' || cold))];
      if (night > 0.6 && this.lastFidget !== 'stargaze' && Math.random() < 0.35) pool = ['stargaze'];
    }
    const options = pool.filter((n) => n !== this.lastFidget);
    this.lastFidget = options[Math.floor(Math.random() * options.length)];
    this.climber.fidget(this.lastFidget, this.effects);
    if (this.lastFidget === 'chalk') Audio.play('cloth');
  }

  // A few Z's drift up from a sleeping climber.
  snore() {
    const h = this.climber.head;
    ['z', 'Z', 'Z'].forEach((ch, i) => {
      const t = new PixelText(this, Math.round(h.x + 6 + i * 3), Math.round(h.y - 8), ch, { color: '#c8d4ff' }).setDepth(DEPTH.fx + 3).setAlpha(0).setScale(i === 2 ? 2 : 1);
      this.tweens.add({ targets: t, alpha: { from: 0, to: 0.9 }, y: t.y - 16 - i * 4, x: t.x + 6, duration: 1600, delay: i * 420, ease: 'Sine.easeOut', yoyo: false,
        onComplete: () => this.tweens.add({ targets: t, alpha: 0, duration: 300, onComplete: () => t.destroy() }) });
    });
  }

  wakeUp() {
    this.restIdle = 0;
    this.restIdleNext = REST_IDLE_FIRST;
    if (this.climber && this.climber.fidgeting) { this.climber.stopFidget(); this.climber.setPose(this.sitting ? 'sit' : 'stand'); }
  }

  // Biome mastery: progress within one pass through a biome (data/mastery.js).
  // A pass counts as full when you climbed into it from the stretch below
  // (not when a lift or a dev start dropped you in halfway).
  trackPass(h, start = false) {
    if (this.director || this.expedition || biomeTheme()) return;
    const key = biomeStretchAt(h);
    const cur = this.run.pass;
    if (cur && cur.key === key) return;
    const from = Number(key.split('@')[1]);
    // Climbing straight out of the top of a stretch with no slip in it: the
    // flawless star (never while a lift ticket or dev start carries you up).
    const next = !!cur && biomeStretchAt(from - 0.01) === cur.key;
    if (next && !this.lifting && cur.full && !this.run.biomeFalls[cur.key]) this.earnStar(cur.biome, 'flawless');
    let pass = this.run.passes[key];
    if (!pass) {
      const full = start ? from === 0 : next && !this.lifting;
      pass = this.run.passes[key] = { key, from, biome: biomeAt(h).id, full, perfects: 0, gems: 0 };
    }
    this.run.pass = pass;
  }

  passProgress(kind) {
    const pass = this.run.pass;
    if (!pass || !MASTERY_BIOMES.includes(pass.biome)) return;
    pass[kind]++;
    if (pass[kind] === masteryGoals(pass.biome)[kind]) this.earnStar(pass.biome, kind);
  }

  earnStar(biomeId, star) {
    if (!MASTERY_BIOMES.includes(biomeId)) return;
    const r = this.prog.earnStar(biomeId, star);
    if (!r.isNew) return;
    const n = this.prog.stars(biomeId).length;
    const b = biomeAt(BIOMES[biomeId].from);
    this.hud.toast(`${'★'.repeat(n)}${'☆'.repeat(3 - n)} ${b.name.replace(/^THE /, '')}: ${starLabel(biomeId, star)}`, COLORS.gold);
    Audio.play('discovery');
    if (n === 3) this.time.delayedCall(1400, () => this.hud.showBanner(`${b.name} MASTERED`, 'A NEW ITEM AT THE TRADER\'S WARDROBE'));
    r.unlocks.forEach((u) => this.hud.toast(`UNLOCKED: ${u.name}`, COLORS.gold));
  }

  // 50 m before the next biome: a quiet heads-up and a line on the wall where it starts.
  checkNextBiome(h) {
    if (this.director || biomeTheme()) return;
    const next = nextBiomeAbove(h);
    const left = next.from - h;
    if (left > 50 || (this.biomeMark && this.biomeMark.from === next.from)) return;
    this.clearBiomeMark();
    const col = next.biome.accentA;
    if (this.run.teased !== next.from) {
      this.run.teased = next.from;
      this.hud.toast(`${next.biome.name} IN ${Math.ceil(left)} M`, toCss(col));
    }
    const y = Math.round(-next.from * PX_PER_METER);
    const b = this.mountain.boundsAt(next.from / METERS_PER_LEVEL);
    const g = this.add.graphics().setDepth(DEPTH.wall + 2);
    const light = lerpColor(col, 0xffffff, 0.4);
    for (let x = Math.round(b.l) - 6; x < b.r + 6; x += 6) {
      g.fillStyle(light, 0.8); g.fillRect(x, y, 3, 1);
      g.fillStyle(0x16141f, 0.45); g.fillRect(x, y + 1, 3, 1);
    }
    const label = new PixelText(this, Math.round(b.l) + 4, y - 9, `NEXT: ${next.biome.name}`, { color: toCss(light), shadow: '#16141f' }).setDepth(DEPTH.decor + 1);
    this.biomeMark = { g, label, from: next.from };
  }

  // The HUD countdown to the next area; it lights up in that area's colour for the last 50 m.
  nextBiomeLine(h) {
    if (this.lava) {
      const m = Math.max(0, Math.round(this.lavaGap() / PX_PER_METER));
      return { nextLine: `LAVA ${m} M BELOW`, nextColor: this.heat > 0 ? COLORS.red : '#ff9a3c' };
    }
    if (this.director || this.expedition) return { nextLine: '' };
    const next = nextBiomeAbove(h);
    const left = Math.max(1, Math.ceil(next.from - h));
    const name = next.biome.name.replace(/^THE /, '');
    return { nextLine: `${name} IN ${left} M`, nextColor: left <= 50 ? toCss(lerpColor(next.biome.accentA, 0xffffff, 0.4)) : COLORS.faint };
  }

  // The line fades once you climb past it.
  clearBiomeMark(fade = false) {
    const m = this.biomeMark;
    if (!m) return;
    this.biomeMark = null;
    if (!fade) { m.g.destroy(); m.label.destroy(); return; }
    this.tweens.add({ targets: [m.g, m.label], alpha: 0, duration: 1200, onComplete: () => { m.g.destroy(); m.label.destroy(); } });
  }

  onMechanicEvent({ id, event }) {
    if (id === 'storm') { this.onStormEvent(event); return; }
    if (id === 'dragonEye') { this.onDragonEvent(event); return; }
    if (id !== 'whiteout') return;
    if (event === 'warning') { this.hud.toast('A WHITEOUT IS COMING', COLORS.blue); this.tip('whiteout'); }
    else if (event === 'storm') {
      this.hud.showBanner('WHITEOUT', 'NOTES SHOW LATE  \u2022  GEMS X2');
      Audio.play('gust');
    } else if (event === 'clear') this.hud.toast('THE WHITEOUT CLEARS', COLORS.blue);
  }

  // The Storm Crown: rumbles, a banner, lightning while it rages.
  onStormEvent(event) {
    if (event === 'warning') { this.hud.toast('A STORM IS COMING', '#ffe45a'); Audio.play('rumble'); this.tip('storm'); }
    else if (event === 'storm') {
      this.hud.showBanner('THUNDERSTORM', 'GRIP DRAINS FAST WHILE YOU HANG');
      this.lightning();
    } else if (event === 'clear') this.hud.toast('THE STORM PASSES', '#ffe45a');
    else if (event === 'strike') this.lightning();
  }

  // The Dragon's Spine: the eye opens, watches, and closes again.
  onDragonEvent(event) {
    if (event === 'open') { this.hud.toast('THE DRAGON STIRS...', '#ff9a3c'); Audio.play('rumble'); if (this.settings.shake) this.cam.shake(900, 0.002); }
    else if (event === 'watch') {
      this.hud.showBanner('THE DRAGON IS AWAKE', 'DODGE ITS FIRE ON THE BEAT');
      Audio.play('roar');
      this.dragon.roar(1200);
      if (this.settings.shake) this.cam.shake(700, 0.0025);
      this.discover('dragon-eye');
    } else if (event === 'close') this.hud.toast('THE DRAGON SETTLES', '#ffd23c');
  }

  // The dragon around the peak (world/Dragon.js), driven by the DragonEye mechanic.
  updateDragon(dt, eye, day) {
    const sx = this.cam.scrollX;
    const b = this.mountain.boundsAt(-((this.camY + GAME_HEIGHT * 0.45) / LEVEL_PX));
    const cb = this.mountain.boundsAt(-((this.camY + GAME_HEIGHT * 0.44) / LEVEL_PX));
    const weight = eye ? biomeMixWeight(biomeMixAt(Math.max(0, yToMeters(this.camY + GAME_HEIGHT * 0.5))), 'dragon') : 0;
    this.dragon.update(dt, {
      weight, phase: eye ? eye.phase : 'sleep', open: eye ? eye.openness : 0,
      bounds: { l: b.l - sx, r: b.r - sx },
      clawBounds: { l: cb.l - sx, r: cb.r - sx },
      climber: { x: this.climber.x - sx, y: this.climber.y - this.cam.scrollY },
      light: day.light,
    });
    this.updatePressure(dt, eye && !this.director ? eye.pressure : 0, b);
  }

  // While the dragon watches, the mountain never sits still: the play box
  // drifts, tilts and trembles, the view shakes, the screen's edges pulse
  // red, embers rise, red lightning cracks the sky and the dragon spits
  // fireballs. p: 0..1 (DragonEye.pressure). The "screen shake" setting
  // turns off everything that moves the view or the box.
  updatePressure(dt, p, bounds) {
    this.pressure = (this.pressure || 0) + (p - (this.pressure || 0)) * Math.min(1, dt / 600);
    const k = this.pressure;
    const t = this.clock / 1000;
    const shake = this.settings.shake;
    if (k > 0.02 && shake && !this.tipOpen) {
      this.comboUI.setSway({
        x: (Math.sin(t * 1.7) * 10 + Math.sin(t * 4.3) * 3) * k,
        y: (Math.sin(t * 1.1) * 6 - Math.abs(Math.sin(t * 2.3)) * 4) * k,
        rot: Math.sin(t * 0.9) * 0.06 * k,
        shake: k > 0.5 ? [160, 0.003 * k] : null,
      });
    } else this.comboUI.setSway(null);
    if (shake && k > 0.3 && !this.cam.shakeEffect.isRunning) this.cam.shake(260, 0.0007 + 0.0013 * k);
    // A red pulse at the edges of the screen, like a racing heartbeat.
    if (!this.dragonRed) this.dragonRed = this.add.image(0, 0, 'vignette').setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.vignette + 1).setTintFill(0xb01408).setAlpha(0);
    const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * 1.6)), 8);
    this.dragonRed.setAlpha(k * (0.3 + 0.35 * beat));
    // Embers rise from below.
    if (!this.embers) {
      this.embers = this.add.particles(0, 0, 'px2', {
        x: { min: 0, max: GAME_WIDTH }, y: GAME_HEIGHT + 4,
        speedY: { min: -70, max: -30 }, speedX: { min: -18, max: 18 },
        lifespan: { min: 2500, max: 4200 }, scale: { start: 1.2, end: 0.3 }, alpha: { start: 0.9, end: 0 },
        tint: [0xffc060, 0xff7a20, 0xff3a10], blendMode: 'ADD', frequency: 90, emitting: false,
      }).setScrollFactor(0).setDepth(DEPTH.weather + 1);
    }
    this.embers.emitting = k > 0.1 && !this.settings.reducedParticles;
    this.embers.frequency = Math.max(25, 140 - 110 * k);
    if (k < 0.5 || this.tipOpen) return;
    // Thunder in a red sky.
    this.dragonThunderIn = (this.dragonThunderIn ?? 1500) - dt;
    if (this.dragonThunderIn <= 0) { this.dragonThunderIn = 2400 + Math.random() * 3200; this.dragonThunder(); }
    // Fireballs into the sky, or bursting on the rock (never on the climber).
    this.spitIn = (this.spitIn ?? 1200) - dt;
    if (this.spitIn <= 0 && this.state !== STATE.DODGING) {
      this.spitIn = 1600 + Math.random() * 2000;
      const onRock = Math.random() < 0.5;
      const cx = this.climber.x - this.cam.scrollX;
      let x = 30 + Math.random() * (GAME_WIDTH - 60), y = 12 + Math.random() * 50;
      if (onRock) {
        x = bounds.l - this.cam.scrollX + 16 + Math.random() * Math.max(10, bounds.r - bounds.l - 32);
        if (Math.abs(x - cx) < 50) x += x < cx ? -50 : 50;
        y = 20 + Math.random() * 60;
      }
      this.dragon.spit([x, y], this.cam, this.effects, () => {
        Audio.play('flame');
        if (onRock) this.effects.pebbleFall(x + this.cam.scrollX, y + this.cam.scrollY, 4, 0x5c2a22);
        if (this.settings.shake) this.cam.shake(140, 0.003);
      });
    }
  }

  // Red lightning forks through the dragon's sky, and thunder answers.
  dragonThunder() {
    const g = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.far + 9);
    let x = 40 + Math.random() * (GAME_WIDTH - 80), y = 0;
    const bottom = 60 + Math.random() * 80;
    const fork = (x0, y0, len, w) => {
      let px = x0, py = y0;
      while (py < y0 + len) {
        const nx = px + (Math.random() - 0.5) * 18, ny = py + 6 + Math.random() * 8;
        g.lineStyle(w + 3, 0xff4a20, 0.35).lineBetween(px, py, nx, ny);
        g.lineStyle(w, 0xffe2c8, 1).lineBetween(px, py, nx, ny);
        if (w > 1 && Math.random() < 0.2) fork(nx, ny, len * 0.35, 1);
        px = nx; py = ny;
      }
    };
    fork(x, y, bottom, 2);
    const flash = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xff6a40).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.hud - 1).setAlpha(this.settings.shake ? 0.16 : 0.05);
    this.tweens.add({ targets: [g, flash], alpha: 0, duration: 360, ease: 'Quad.easeIn', onComplete: () => { g.destroy(); flash.destroy(); } });
    this.time.delayedCall(80 + Math.random() * 400, () => Audio.play('thunder', { volume: 0.7 + Math.random() * 0.3 }));
    if (this.settings.shake) this.cam.shake(240, 0.003);
  }

  // A lightning bolt forks down the sky, the screen flashes, thunder follows.
  lightning() {
    const g = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.far + 9);
    let x = this.runRng.range(40, GAME_WIDTH - 40), y = 0;
    const bottom = this.runRng.range(110, 170);
    const draw = (x0, y0, len, w) => {
      let px = x0, py = y0;
      while (py < y0 + len) {
        const nx = px + this.runRng.range(-9, 9), ny = py + this.runRng.range(6, 14);
        g.lineStyle(w + 2, 0x8fa8ff, 0.35).lineBetween(px, py, nx, ny);
        g.lineStyle(w, 0xffffff, 1).lineBetween(px, py, nx, ny);
        if (w > 1 && this.runRng.chance(0.18)) draw(nx, ny, len * 0.35, 1);
        px = nx; py = ny;
      }
    };
    draw(x, y, bottom, 2);
    const flash = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xe8f0ff).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.hud - 1).setAlpha(this.settings.shake ? 0.3 : 0.08);
    this.tweens.add({ targets: [g, flash], alpha: 0, duration: 380, ease: 'Quad.easeIn', onComplete: () => { g.destroy(); flash.destroy(); } });
    this.time.delayedCall(120 + this.runRng.int(0, 500), () => Audio.play('thunder', { volume: 0.8 + this.runRng.range(0, 0.3) }));
    if (this.settings.shake) this.cam.shake(260, 0.0025);
    this.discover('thunderstorm');
    // Now and then the bolt comes down on the wall itself.
    if (Math.random() < 0.4) this.time.delayedCall(60, () => this.wallStrike());
  }

  // A bolt hits the rock somewhere in view (never on the climber): a white
  // jagged stroke, a burst of sparks and grit, and a scorch mark that cools
  // from glowing orange to black and fades after a while.
  wallStrike() {
    if (!this.scene.isActive()) return;
    const top = this.camY, cx = this.climber.x;
    let x = 0, y = 0;
    for (let i = 0; i < 8; i++) {
      y = top + 30 + Math.random() * GAME_HEIGHT * 0.45;
      const b = this.mountain.boundsAt(-y / LEVEL_PX);
      x = b.l + 14 + Math.random() * Math.max(1, b.r - b.l - 28);
      if (Math.abs(x - cx) > 44 || Math.abs(y - this.climber.y) > 60) break;
    }
    x = Math.round(x); y = Math.round(y);
    const g = this.add.graphics().setDepth(DEPTH.fx + 2);
    const pts = [[x + (Math.random() - 0.5) * 60, top - 4]];
    while (pts[pts.length - 1][1] < y - 8) {
      const [px, py] = pts[pts.length - 1];
      const k = (py - top) / Math.max(1, y - top);
      pts.push([px + (x - px) * 0.25 + (Math.random() - 0.5) * 16 * (1 - k), py + 6 + Math.random() * 10]);
    }
    pts.push([x, y]);
    for (let i = 1; i < pts.length; i++) {
      g.lineStyle(4, 0x8fa8ff, 0.4).lineBetween(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
      g.lineStyle(2, 0xffffff, 1).lineBetween(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
    }
    g.fillStyle(0xffffff, 0.9).fillCircle(x, y, 7);
    g.fillStyle(0xdde6ff, 0.35).fillCircle(x, y, 14);
    this.tweens.add({ targets: g, alpha: 0, duration: 320, ease: 'Quad.easeIn', onComplete: () => g.destroy() });
    // The scorch: an irregular dark patch with a hot rim that cools down.
    const mark = this.add.graphics().setDepth(DEPTH.wall + 1);
    const blobs = [];
    for (let i = 0; i < 7; i++) blobs.push([x + Math.round((Math.random() - 0.5) * 10), y + Math.round((Math.random() - 0.5) * 7), 2 + Math.round(Math.random() * 3)]);
    const rays = [];
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2, len = 6 + Math.random() * 7;
      rays.push([Math.cos(a), Math.sin(a), len]);
    }
    const st = { heat: 1 };
    const paint = () => {
      mark.clear();
      const rim = lerpColor(0x2a1a14, 0xffa040, st.heat);
      mark.fillStyle(rim, 0.9);
      for (const [dx, dy, len] of rays) for (let t = 3; t < len; t++) mark.fillRect(Math.round(x + dx * t), Math.round(y + dy * t * 0.7), 1, 1);
      mark.fillStyle(0x0e0a0c, 0.85);
      for (const [bx, by, r] of blobs) mark.fillRect(bx - r, by - r + 1, r * 2, r * 2 - 2).fillRect(bx - r + 1, by - r, r * 2 - 2, r * 2);
      mark.fillStyle(lerpColor(0x3a2a24, 0xffe0a0, st.heat), 1).fillRect(x - 1, y - 1, 2, 2);
    };
    paint();
    this.tweens.add({ targets: st, heat: 0, duration: 2600, ease: 'Quad.easeOut', onUpdate: paint });
    this.tweens.add({ targets: mark, alpha: 0, delay: 14000, duration: 4000, onComplete: () => mark.destroy() });
    this.effects.sparkle(x, y, 14);
    this.effects.pebbleFall(x, y, 5, 0x3a3a44);
    this.effects.ring(x, y, 0xdde6ff, 16, 260);
    Audio.play('thunder', { volume: 1.1 });
    if (this.settings.shake) this.cam.shake(200, 0.004);
  }

  updateEvents(dt, alt, day) {
    this.eventT += dt;
    if (this.eventT < 1000) return;
    this.eventT = 0;
    const biome = biomeAt(alt);
    if (biome.events?.eagles && alt > 25 && day.night < 0.4 && this.runRng.chance(1 / 120)) {
      this.background.spawnEagle(() => { Audio.play('wing'); this.discover('rare-bird'); });
    }
    this.auroraT = this.background.auroraVisible ? this.auroraT + 1 : 0;
    if (this.auroraT === 5) this.discover('northern-lights');
    this.floatT = this.background.floatersVisible ? this.floatT + 1 : 0;
    if (this.floatT === 4) this.discover('floating-stones');
    if (day.isDawn && alt > 480) this.discover('sunrise-above');
    if (biome.hazards.loose > 0 && this.runRng.chance(0.1)) {
      const b = this.mountain.boundsAt(-(this.camY / LEVEL_PX));
      this.effects.pebbleFall(this.runRng.range(b.l + 10, b.r - 10), this.camY - 6, this.runRng.int(1, 3), biome.rock[3]);
      Audio.play('pebble', { count: 2, volume: 0.35 });
    }
  }

  // ---------------------------------------------------------------- update
  update(time, delta) {
    if (this.hudFade) {
      this.hudFadeT = Math.min(1, this.hudFadeT + delta / 450);
      this.hudFade.forEach(({ o, to }) => o.active && o.setAlpha(to * this.hudFadeT));
      if (this.hudFadeT >= 1) this.hudFade = null;
    }
    const frozen = this.tipOpen;
    if (frozen) this.freezeForTip();
    const dt = frozen ? 0 : Math.min(delta, 100);
    this.clock += dt;
    this.lastFramePerf = performance.now();
    const now = this.clock;
    this.city.update(dt);
    this.dayNight.update(dt);
    // ENDLESS NIGHT: the clock never gets past midnight.
    if (this.dares.includes('night')) this.dayNight.t = 0.8;
    const day = this.dayNight.state();

    const cardOpen = this.director && this.tutorialCard.open;
    if (cardOpen && this.state === STATE.ROUTE_SELECT && this.node.kind === 'jug') this.grip.hang(dt / 1000, { onJug: true });
    switch (cardOpen || frozen ? null : this.state) {
      case STATE.ROUTE_SELECT: {
        if (this.inPanorama) break;
        if (this.breathDue()) { this.startFireBreath(); break; }
        if (this.prismStart) this.updatePrism();
        const biome = biomeAt(levelToMeters(this.node.level));
        const icy = this.node.hazard === 'icy' && !this.gear.crampons ? 1.4 : 1;
        // The Storm Crown: in a storm, hanging around costs grip fast.
        const storm = this.mechanics && this.node.kind !== 'ledge' ? this.mechanics.get('storm').hangScale : 1;
        this.grip.hang(dt / 1000, {
          drainMultiplier: this.director ? 0 : biome.drainMultiplier * icy * storm * (this.perk === 'irongrip' ? GEAR_FX.ironGrip : 1) * (1 + (this.heat || 0) * 3),
          onJug: this.node.kind === 'jug',
          noGrace: storm > 1,
        });
        this.tryEnergyBar();
        if (this.grip.isEmpty) this.startSlip();
        else this.updateCrumble(dt);
        break;
      }
      case STATE.CLIMBING_COMBO:
        if (this.combo) this.updateCombo(now);
        break;
      case STATE.DODGING:
        if (this.dodge) {
          const missed = this.dodge.update(now);
          if (missed.length) this.dodgeResult(missed[0]);
        }
        break;
      case STATE.SLIPPING:
        if (this.recovery) {
          const missed = this.recovery.update(now);
          if (missed.length) this.recoveryFail(missed[0]);
        }
        this.climber.setPose(Math.floor(now / 110) % 2 ? 'slip' : 'slip2');
        break;
      case STATE.FALLING:
        break;
      case STATE.RESTING:
      case STATE.VIEWING:
        if (this.grip.value < this.ledgeCap) this.grip.change(Math.min(this.ledgeCap - this.grip.value, (BALANCE.grip.restRecoverPerSec * dt) / 1000));
        break;
      default:
        break;
    }

    this.updateCamera(dt);
    const alt = Math.max(0, yToMeters(this.camY + GAME_HEIGHT * CAMERA_ANCHOR));
    const climberAlt = Math.max(0, yToMeters(this.climber.y));
    const biome = biomeAt(climberAlt);
    const ambience = biome.ambience;
    if (this.mechanics) this.mechanics.update(dt, biomeMixAt(climberAlt)).forEach((e) => this.onMechanicEvent(e));
    const mech = this.mechanics ? this.mechanics.weather() : { snow: 0, mist: 0, wind: 0 };
    const whiteout = this.mechanics ? this.mechanics.get('whiteout').intensity : 0;
    const stormMech = this.mechanics ? this.mechanics.get('storm') : null;
    const stormSky = stormMech ? stormMech.intensity : 0;
    this.hud.setStorm(stormMech && !this.director && stormMech.inside >= stormMech.cfg.minWeight ? { phase: stormMech.phase, progress: stormMech.progress } : null);
    this.background.update(dt, alt, day, { birds: ambience.birds }, { mix: biomeMixAt(alt), whiteout, storm: stormSky });
    this.weather.update(dt, {
      biome, alt, light: day.light, reduced: this.settings.reducedParticles,
      mistBoost: (alt > 440 && alt < 500 ? 0.3 : 0) + mech.mist,
      windBoost: (this.gustActive ? 1.2 : 0) + mech.wind,
      snowBoost: mech.snow + (this.season === 'christmas' && alt < 60 ? 0.5 : 0),
      whiteout,
    });
    // Obsidian Spires: the light sinks and the headlamp comes on.
    const dark = this.mechanics ? this.mechanics.get('darkness').intensity : 0;
    // Storm Crown: the storm clouds turn the day to slate.
    const storm = this.mechanics ? this.mechanics.get('storm').intensity : 0;
    let light = dark > 0.01 ? lerpColor(day.light, DARKNESS.shade, dark * DARKNESS.shadeAmount) : day.light;
    if (storm > 0.01) light = lerpColor(light, 0x3a4058, storm * 0.45);
    // The dragon's sky: everything turns ember red while it watches.
    if (this.pressure > 0.01) light = lerpColor(light, 0xff6a4a, this.pressure * 0.3);
    this.lightOverlay.fillColor = light;
    this.climber.updateLamp(Math.max(day.night, dark, storm * 0.7));
    this.wall.night = Math.max(day.night, dark, storm * 0.5);
    this.atmos.update(dt, { day, biome, dim: Math.max(whiteout, dark, storm, biome.overcast || 0) });
    const eye = this.mechanics ? this.mechanics.get('dragonEye') : null;
    this.updateDragon(dt, eye, day);
    const camLevelTop = -(this.camY / LEVEL_PX);
    this.wall.update(dt, Math.ceil(camLevelTop) + RENDER_AHEAD_LEVELS, this.camY, this.camY + GAME_HEIGHT);
    this.wetWall.update(dt, storm, this.camY);
    if (this.critters) this.critters.update(dt, this.climber, this.camY);

    const wallState = this.state === STATE.ROUTE_SELECT ? 'wall'
      : this.state === STATE.RESTING ? 'ledge'
        : this.state === STATE.VIEWING ? 'look' : 'none';
    this.emitTrail();
    this.updateLava(dt);
    if (this.atCamp) this.campMenu.update(dt, !this.tipOpen);
    this.updateRestIdle(dt, wallState, day);
    const cold = biome.weather.snow > 0.3 || day.night > 0.6;
    this.updateBeatPulse(biome, cold);
    this.climber.idle(dt, { state: wallState, gripRatio: this.grip.ratio, cold: biome.weather.snow > 0.3 || day.night > 0.6, effects: this.effects, sitting: this.sitting });
    const climberMix = biomeMixAt(climberAlt);
    this.outfit.update(dt, {
      hanging: this.state === STATE.ROUTE_SELECT && this.node && this.node.kind !== 'ledge',
      moving: this.state === STATE.CLIMBING_COMBO,
      streak: this.run.streak,
      prism: this.state === STATE.CLIMBING_COMBO && this.prismed ? 1 : biomeMixWeight(climberMix, 'crystal') * 0.35,
      eye: eye && eye.inside >= 0.5 ? eye.openness : 0,
      aurora: biomeMixWeight(climberMix, 'aurora'),
      wind: (this.gustActive ? 1 : 0) + mech.wind + biome.weather.wind * 0.4,
      bpm: biome.music.tempo,
      cold: biome.weather.snow > 0.3 || day.night > 0.6,
    });
    // WEATHER ON YOU: what the climber is exposed to right now.
    const onWall = wallState === 'wall' || this.state === STATE.CLIMBING_COMBO || this.state === STATE.DODGING;
    this.coat.enabled = this.settings.weatherCoat !== false;
    this.coat.update(dt, {
      snow: this.coat.enabled ? Math.min(1, biome.weather.snow + mech.snow + whiteout) * (onWall || wallState === 'ledge' ? 1 : 0) : 0,
      wet: this.coat.enabled ? Math.max(storm > 0.5 ? storm : 0, this.wall.waterfallNear(this.climber.y) && onWall ? 0.7 : 0) : 0,
      soot: this.coat.enabled ? Math.max(eye && eye.inside >= 0.5 ? eye.openness * 0.6 : 0, biomeMixWeight(climberMix, 'volcano') * 0.5) : 0,
      glitter: this.coat.enabled ? biomeMixWeight(climberMix, 'crystal') * (onWall ? 0.8 : 0.3) : 0,
      resting: wallState === 'ledge' && !this.atCamp,
      visible: this.climber.sprite.visible,
    });

    this.hud.update(dt, {
      heightM: climberAlt,
      best: this.expedition ? Math.max(this.run.startBest, this.run.maxHeight || 0) : this.recordBest,
      modeLabel: this.director ? 'TUTORIAL' : this.expedition ? this.expedition.name : [this.devRun ? 'DEV' : '', this.mode === 'normal' ? '' : this.modeCfg.label, this.dared ? `DARE ${dareLabel(this.dares)}` : ''].filter(Boolean).join(' '),
      biomeName: this.director ? biome.name : this.expedition ? this.pitchLabel() : `${biome.name}  ${this.run.biomeFalls[biomeStretchAt(climberAlt)] ? 'NO SLIPS LEFT' : '1 SLIP LEFT'}`,
      ...this.nextBiomeLine(climberAlt),
      grip: this.grip.value,
      gripLow: this.grip.isLow && this.state !== STATE.RESTING,
      gripCritical: this.grip.isCritical && this.state !== STATE.RESTING,
    });
    this.comboUI.update(this.now(), dt);
    if (this.state === STATE.ROUTE_SELECT) this.routeUI.update(dt, { x: this.climber.x, y: this.climber.y });

    Audio.setAmbience({
      wind: Math.min(1, ambience.wind * 0.8 + Math.min(1, alt / 1000) * 0.4 + whiteout * 0.5),
      stream: this.wall.waterfallNear(this.climber.y) ? 0.9 : ambience.stream * 0.35,
      birds: day.night < 0.4 ? ambience.birds : 0,
    });
    Audio.update();
    this.updateEvents(dt, climberAlt, day);
    this.updateRecordMark();
    if (this.biomeMark && levelToMeters(this.node.level) >= this.biomeMark.from) this.clearBiomeMark(true);
    this.updateBot(now);
    if (this.debugVisible) this.hud.setDebug(this.debugText(biome, day));
  }

  updateCamera(dt) {
    const anchor = POSES[this.climber.pose].anchor;
    let focusY = this.climber.y;
    if (anchor === 54 || anchor === 40) focusY = this.climber.y - STAND_HAND;
    else if (anchor === 28) focusY = this.climber.y - 23;
    let look = 0;
    if (this.inPanorama) look = -GAME_HEIGHT * 0.55;
    else if (this.state === STATE.VIEWING) look = -150;
    else if (this.state === STATE.RESTING && this.clock < this.revealUntil) look = -60;
    else if (this.state === STATE.RESTING) look = this.atCamp ? 0 : 34;
    else if (this.state === STATE.ROUTE_SELECT || this.state === STATE.CLIMBING_COMBO) look = -10;
    this.lookOffset += (look - this.lookOffset) * (1 - Math.exp((-dt / 1000) * 1.8));
    const target = focusY - GAME_HEIGHT * CAMERA_ANCHOR + this.lookOffset;
    const k = this.state === STATE.FALLING ? 3 : 5;
    this.camY += (target - this.camY) * (1 - Math.exp((-dt / 1000) * k));
    // In portrait the screen is narrower than the mountain: follow sideways too.
    this.camX += (camXFor(this.climber.x) - this.camX) * (1 - Math.exp((-dt / 1000) * k));
    this.cam.setScroll(Math.round(this.camX), Math.round(this.camY));
  }

  chalkTint() {
    const c = findCosmetic('chalk', this.prog.data.look.chalk || 'chalk-white');
    if (c.rainbow) return [0xf0644b, 0xf2c14e, 0x8fd16a, 0x6fd6ff, 0xb48ae0][Math.floor(Math.random() * 5)];
    return c.id === 'chalk-white' ? 0xf4f0e8 : c.color;
  }

  // The equipped trail follows the climber's body while it moves.
  emitTrail() {
    const c = this.climber;
    const last = this.trailAt;
    this.trailAt = { x: c.x, y: c.y };
    if (!last || (Math.abs(c.x - last.x) < 0.5 && Math.abs(c.y - last.y) < 0.5)) return;
    const h = c.head;
    this.effects.trail(h.x, h.y + 14);
  }

  floatText(text, color, dy = 0, pop = false) {
    if (this.floaters.length > 3) this.floaters.shift().destroy();
    const h = this.climber.head;
    const t = new PixelText(this, Math.round(h.x), Math.round(h.y - 22 - dy), text, { color }).setOrigin(0.5, 0).setDepth(DEPTH.fx + 5);
    if (pop) {
      t.setScale(2.2);
      this.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.easeOut' });
    }
    this.floaters.push(t);
    this.tweens.add({
      targets: t, y: t.y - 12, alpha: 0, duration: 900, delay: 250, ease: 'Sine.easeIn',
      onComplete: () => { this.floaters = this.floaters.filter((f) => f !== t); t.destroy(); },
    });
  }

  clearTargetMark() {
    if (this.targetMark) { this.targetMark.destroy(); this.targetMark = null; }
  }

  flashHold(nodeId) {
    const s = this.wall.getHold(nodeId);
    if (!s) return;
    s.setTintFill(0xffffff);
    this.time.delayedCall(70, () => { if (s.active) s.clearTint(); });
  }

  // ---------------------------------------------------------------- debug / autopilot
  updateBot(now) {
    const b = this.bot;
    if (!b) return;
    if (this.journal.open) {
      if (!b.tipWait) b.tipWait = performance.now() + 600;
      if (performance.now() > b.tipWait) { b.tipWait = 0; this.journal.close(); }
      return;
    }
    if (this.tipOpen) {
      if (!b.tipWait) b.tipWait = performance.now() + 400;
      if (performance.now() > b.tipWait) { b.tipWait = 0; this.tips.skip(); this.tips.skip(); }
      return;
    }
    if (this.director && this.tutorialCard.open) {
      if (!b.cardWait) b.cardWait = this.clock + 400;
      if (this.clock > b.cardWait) { b.cardWait = 0; this.tutorialCard.close(); }
      return;
    }
    if (this.state === STATE.RESTING) {
      if (!b.wait) b.wait = this.clock + 700;
      if (this.clock > b.wait) { b.wait = 0; this.restAction('continue'); }
      return;
    }
    if (this.state === STATE.ROUTE_SELECT) {
      if (!b.wait) b.wait = this.clock + 350;
      if (this.clock > b.wait) {
        b.wait = 0;
        const want = this.grip.value > 65 ? 'risky' : this.grip.value > 35 ? 'normal' : 'safe';
        let i = this.routes.findIndex((r) => r.type === want);
        if (i < 0) i = 0;
        this.pickRoute(i, true);
      }
      return;
    }
    const combo = this.state === STATE.CLIMBING_COMBO ? this.combo : this.state === STATE.SLIPPING ? this.recovery : this.state === STATE.DODGING ? this.dodge : null;
    if (!combo || combo.done) return;
    if (b.plans === null || b.plansFor !== combo) { b.plans = {}; b.plansFor = combo; }
    const note = combo.current;
    // Between notes (e.g. a hold note still running) there is nothing to press.
    if (!note) return;
    if (!b.plans[note.index]) {
      const sloppy = b.mode === 'sloppy';
      const off = sloppy ? (Math.random() * 2 - 1) * 260 : (Math.random() * 2 - 1) * 40;
      const wrong = sloppy && Math.random() < 0.12;
      const dirs = ['L', 'U', 'R'].filter((d) => d !== note.dir);
      b.plans[note.index] = { t: note.time + off, dir: wrong ? dirs[Math.floor(Math.random() * 2)] : note.dir };
    }
    const plan = b.plans[note.index];
    if (now >= plan.t) {
      if (this.state === STATE.CLIMBING_COMBO) this.comboInput(plan.dir, Math.max(plan.t, now - 16));
      else if (this.state === STATE.DODGING) this.dodgeInput(plan.dir, Math.max(plan.t, now - 16));
      else this.recoveryInput(plan.dir, Math.max(plan.t, now - 16));
    }
  }

  // Debug helper: skip upward along the longest routes (used for testing biomes).
  debugTeleport(meters) {
    let guard = 0;
    while (levelToMeters(this.node.level) < meters && guard++ < 5000) {
      if (this.state === STATE.RESTING) this.leaveRest();
      const route = this.routes[this.routes.length - 1];
      this.routeUI.hide();
      this.state = STATE.CLIMB_ANIMATION;
      this.climber.setPosition(route.target.x, route.target.y);
      this.arrive(route.target, route.heightGain);
    }
    this.camY = this.climber.y - STAND_HAND - GAME_HEIGHT * CAMERA_ANCHOR;
    this.wall.update(0, Math.ceil(-(this.camY / LEVEL_PX)) + RENDER_AHEAD_LEVELS, this.camY, this.camY + GAME_HEIGHT);
    this.wall.flush();
  }

  debugText(biome, day) {
    const seg = this.mountain.segmentForLevel(this.node.level);
    const cur = this.combo && this.combo.current;
    const lines = [
      `STATE ${this.paused ? STATE.PAUSED : this.state}   SEED ${this.seed}${this.director ? `   LESSON ${this.director.pointer}` : ''}`,
      `BIOME ${biome.id.toUpperCase()}   SEG ${seg ? seg.index : '-'} ${seg ? seg.templateId.toUpperCase() : ''}`,
      `NODE ${this.node.id}  LV ${this.node.level}  H ${levelToMeters(this.node.level).toFixed(1)}M  CP LV ${this.checkpoint.level}`,
      `GRIP ${this.grip.value.toFixed(1)}   TIME ${day.name} ${(day.t * 24).toFixed(1)}H   MODE ${this.modeCfg.label}`,
      (() => { const d = difficultyAt(levelToMeters(this.node.level), this.mode); return `RAMP BEAT x${d.beatScale.toFixed(2)} WIN x${d.windowScale.toFixed(2)} +${d.extraInputs} REST/${d.restEvery}`; })(),
      `ROUTE ${this.route ? this.route.type.toUpperCase() + ' ' + this.route.pattern.join('') + ' ' + (this.route.tags || []).join(' ') : '-'}`,
      `INPUT ${cur ? `${cur.index + 1}/${this.combo.notes.length} ${cur.dir} IN ${Math.round(cur.time - this.now())}MS` : '-'}`,
      `LAST ${this.lastJudge}`,
      `SEGMENTS ${this.mountain.segments.size} DATA / ${this.wall.activeCount} DRAWN   LEVELS ${this.mountain.levels.size}`,
      `OBJECTS ${this.children.length}   TWEENS ${this.tweens.getTweens().length}   TEXTURES ${this.textures.getTextureKeys().length}`,
      `AUTOPILOT ${this.bot ? this.bot.mode.toUpperCase() : 'OFF'} (B)   CLIMBED ${this.run.climbed.toFixed(1)}M   STREAK ${this.run.streak}`,
    ];
    return lines.join('\n');
  }

  // ---------------------------------------------------------------- rising lava (Mount Ember)
  // Lava creeps up from below while you climb (it waits while you rest on a
  // ledge). Close to it the holds are hot and drain grip fast; if it reaches
  // your feet you lose your grip.
  setupLava(start) {
    const cfg = this.expedition && this.expedition.lava;
    this.lava = null;
    this.heat = 0;
    if (!cfg) return;
    this.lava = { y: start.y + 150, speed: cfg.speed, g: this.add.graphics().setDepth(DEPTH.climber - 1), t: 0 };
    this.heatFx = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xff3a1a).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.light + 2).setBlendMode('ADD').setAlpha(0);
  }

  // Pixels between the lava surface and the climber's feet.
  lavaGap() {
    const feet = POSES[this.climber.pose].anchor === 54 ? this.climber.y : this.climber.y + 48;
    return this.lava.y - feet;
  }

  updateLava(dt) {
    const L = this.lava;
    if (!L) return;
    L.t += dt;
    const moving = this.run.departed && ![STATE.RESTING, STATE.VIEWING, STATE.RUN_OVER, STATE.FALLING, STATE.SLIPPING].includes(this.state);
    if (moving) L.y -= (L.speed * dt) / 1000;
    // It never falls far behind: the pressure stays on.
    L.y = Math.min(L.y, this.climber.y + 280);
    const gap = this.lavaGap();
    this.heat = moving ? Math.max(0, Math.min(1, 1 - gap / 80)) : 0;
    this.heatFx.setAlpha(this.heat * 0.22 + (this.heat > 0.6 ? Math.sin(L.t / 90) * 0.04 : 0));
    if (this.heat > 0.3 && !L.warned) { L.warned = true; this.floatText('HOT! KEEP CLIMBING', '#ff9a3c', 16); }
    if (this.heat < 0.1) L.warned = false;
    if (gap <= 0 && moving) {
      this.floatText('TOO HOT!', COLORS.red, 14);
      Audio.play('miss');
      this.startSlip();
    }
    // The lava itself: a wobbling bright surface over a deep red body.
    const g = L.g;
    g.clear();
    const v = this.cam.worldView;
    if (L.y > v.bottom + 12) return;
    const top = Math.round(L.y);
    for (let x = 0; x < GAME_WIDTH; x += 2) {
      const yy = top + Math.round(Math.sin(x / 14 + L.t / 320) * 2 + Math.sin(x / 5 + L.t / 170));
      g.fillStyle(0xffe08a, 1).fillRect(x, yy, 2, 2);
      g.fillStyle(0xff9a3c, 1).fillRect(x, yy + 2, 2, 4);
      g.fillStyle(0xf0644b, 1).fillRect(x, yy + 6, 2, 10);
      g.fillStyle(0xa8243a, 1).fillRect(x, yy + 16, 2, Math.max(0, v.bottom - yy));
    }
    g.fillStyle(0xff9a3c, 0.12).fillRect(0, top - 26, GAME_WIDTH, 26);
    g.fillStyle(0xffd25a, 0.1).fillRect(0, top - 10, GAME_WIDTH, 10);
    // Bubbles popping on the surface.
    for (let i = 0; i < 5; i++) {
      const bx = (i * 97 + Math.floor(L.t / 700) * 53) % GAME_WIDTH;
      const ph = (L.t / 700 + i * 0.37) % 1;
      if (ph < 0.6) g.fillStyle(0xffe08a, 1 - ph).fillCircle(bx, top + 4 - ph * 6, 1 + ph * 2);
    }
  }

  cleanup() {
    setBiomeTheme(null);
    this.tweens.timeScale = 1;
    if (this.coat) this.coat.destroy();
    Audio.endSong();
    this.input.keyboard.off('keydown', this.onKeyDown, this);
    this.input.keyboard.off('keyup', this.onKeyUp, this);
    this.game.events.off('blur', this.onBlur);
    this.events.off('resume', this.onResume, this);
    this.wall.destroy();
    this.routeUI.destroy();
    this.comboUI.hide();
    this.restUI.hide();
    if (this.tutorialCard) this.tutorialCard.destroy();
    if (this.tips) this.tips.destroy();
    this.journal.destroy();
    if (this.runOverUI) { this.runOverUI.destroy(); this.runOverUI = null; }
    Audio.setPaused(false);
    Audio.setMusicIntensity(0.3);
    if (typeof window !== 'undefined' && window.__atc === this) window.__atc = null;
  }
}
