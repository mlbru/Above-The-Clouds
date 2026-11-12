// Run-wide things that are not a biome's: the mountain event of the run
// (data/events.js), stranded climbers you can rescue, the rival, and the
// newer gifts and dares (data/boons.js, data/dares.js). Installed onto
// ClimbScene.prototype, so `this` is the climb scene.
import { DEPTH, GAME_WIDTH, GAME_HEIGHT, levelToMeters, levelToY, METERS_PER_LEVEL } from '../config/gameConfig.js';
import { EVENTS, EVENT_CFG, RESCUE, runEvent, avalancheAt, eclipseStretch } from '../data/events.js';
import { biomeAt, biomeStretchAt, nextBiomeAbove } from '../data/biomes.js';
import { gemForBiome, GEMS } from '../data/gems.js';
import { GATE } from '../data/gate.js';
import { DARKNESS } from '../systems/mechanics/Darkness.js';
import { buildNpcClimber, buildFeather } from '../render/npcArt.js';
import { PixelText } from '../ui/PixelText.js';
import { Audio } from '../systems/AudioSystem.js';
import { lerpColor, toCss } from '../utils/color.js';

const W = GAME_WIDTH;
const rnd = (a, b) => a + Math.random() * (b - a);
const css = (c) => `#${c.toString(16).padStart(6, '0')}`;

// ?event=rival on the dev server: force a run's event (testing only).
function devEvent() {
  try {
    if (!import.meta.env || !import.meta.env.DEV) return null;
    const v = new URLSearchParams(window.location.search).get('event');
    return v && EVENTS[v] ? v : null;
  } catch { return null; }
}

export const climbRun = {
  initRun() {
    const allowed = !this.tutorial && !this.expedition && !this.director;
    const id = allowed ? devEvent() || runEvent(this.seed) : null;
    this.runEv = id ? { id, announced: false } : null;
    this.evG = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.weather + 2);
    this.evSky = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.far + 9);
    this.evAdd = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.far + 9.5).setBlendMode('ADD');
    this.evWorld = this.add.graphics().setDepth(DEPTH.fx + 2);
    this.avalanche = null;
    this.avalancheDone = {};
    this.flocks = [];
    this.flockWait = 3000;
    this.meteorWait = 2500;
    this.streaks = [];
    this.eclipseK = 0;
    this.eclipse = id === 'eclipse' ? eclipseStretch(this.seed, this.devStart || 0) : null;
    this.rival = null;
    this.stranded = null;
    this.companion = null;
    this.sherpaUsed = {};
    this.lastLightUsed = {};
    this.crowTheft = {};
    this.lightUntil = 0;
    buildFeather(this);
    this.run.event = id;
  },

  // ---------------------------------------------------------------- the event
  // Leaving base camp: Bram tells you what the mountain has in store today.
  announceEvent() {
    const ev = this.runEv;
    if (!ev || ev.announced) return;
    ev.announced = true;
    const e = EVENTS[ev.id];
    this.time.delayedCall(600, () => {
      if (!this.sys.isActive()) return;
      this.hud.showBanner(e.name, 'TODAY ON THE MOUNTAIN');
      Audio.play('titlecard');
      if (this.tips) this.tips.say(e.bram);
    });
    if (ev.id === 'rival') this.startRival();
  },

  updateRun(dt, alt, day) {
    if (!this.run || this.state === 'RUN_OVER') return;
    const ev = this.runEv && this.runEv.announced ? this.runEv.id : null;
    this.evG.clear(); this.evSky.clear(); this.evAdd.clear(); this.evWorld.clear();
    if (ev === 'avalanche') this.updateAvalanche(dt, alt);
    if (ev === 'migration') this.updateFlocks(dt, day);
    if (ev === 'meteors') this.updateStreaks(dt, day);
    // The eclipse: the moon slides over the sun for one biome stretch.
    const inEclipse = !!(this.eclipse && biomeStretchAt(alt) === `${this.eclipse.biome}@${this.eclipse.from}`);
    const wasDark = this.eclipseK > 0.5;
    this.eclipseK += ((inEclipse ? 1 : 0) - this.eclipseK) * Math.min(1, dt / 2500);
    if (this.eclipseK > 0.5 && !wasDark && !this.run.eclipseSeen) {
      this.run.eclipseSeen = true;
      this.hud.showBanner('THE ECLIPSE', 'THE SUN GOES OUT');
      this.discover && this.prog.bump('eclipses');
    }
    if (this.eclipseK > 0.01) this.drawEclipse(day);
    if (this.rival) this.updateRival(dt);
    if (this.companion) this.updateCompanion(dt);
    if (this.stranded) this.updateStranded(dt);
    // DRAGON PACIFIST: in the Spine the dragon is held awake (it never breathes, see breathDue).
    if (this.dares.includes('pacifist')) {
      const eye = this.mechanics && this.mechanics.get('dragonEye');
      if (eye && eye.inside >= eye.cfg.minWeight && !eye.held) eye.holdAwake([9999, 9999]);
    }
    // NIGHT SHIFT: the carried storm only comes at night.
    if (this.bfx && this.bfx.nightShift && this.mechanics) {
      if (day.night > 0.5) this.mechanics.carried.add('storm'); else this.mechanics.carried.delete('storm');
    }
  },

  // ---- avalanche season
  updateAvalanche(dt, alt) {
    const stretch = biomeStretchAt(alt);
    const from = Number(stretch.split('@')[1]) || 0;
    const c = EVENT_CFG.avalanche;
    const len = nextBiomeAbove(alt).from - from;
    if (!this.avalanche && !this.avalancheDone[stretch] && alt >= avalancheAt(this.seed, from, len) && alt > 20
      && (this.state === 'ROUTE_SELECT' || this.state === 'CLIMBING_COMBO' || this.state === 'CLIMB_ANIMATION') && !this.inPanorama) {
      this.avalancheDone[stretch] = true;
      this.avalanche = { t: 0, warn: c.warnSec * 1000, safe: false, hit: false, roar: 0 };
      this.hud.showBanner('AVALANCHE!', 'GET TO A LEDGE BEFORE IT COMES DOWN');
      Audio.play('thunder', { volume: 0.6 });
      if (this.settings.shake) this.cam.shake(500, 0.002);
    }
    const a = this.avalanche;
    if (!a) return;
    a.t += dt;
    const g = this.evG;
    if (!a.hit) {
      if (this.state === 'RESTING' && !a.safe) { a.safe = true; this.floatText('SAFE ON THE LEDGE!', '#e8f4ff', 20, true); }
      const left = Math.max(0, a.warn - a.t);
      // The warning: a frosty bar across the top that runs down, and snow
      // dust sifting down the screen, thicker as it gets close.
      const k = 1 - left / a.warn;
      // Above you the snow gathers: a churning white cornice along the top
      // of the screen that grows and sags lower the closer it gets.
      const lip = 6 + k * 34;
      for (let i = 0; i < 22; i++) {
        const x = (i / 21) * (W + 30) - 15 + Math.sin(a.t / 400 + i) * 3;
        const r = 10 + ((i * 13) % 9) + k * 8;
        const y = lip - r * 0.6 + Math.sin(a.t / 260 + i * 1.7) * 2 * k;
        g.fillStyle(0x9aaec8, 0.92).fillCircle(x, y + 2, r);
        g.fillStyle(0xc8d6e8, 0.95).fillCircle(x - r * 0.2, y - r * 0.2, r * 0.75);
        g.fillStyle(0xeef4fc, 0.9).fillCircle(x - r * 0.35, y - r * 0.4, r * 0.35);
      }
      g.fillStyle(0xb8c8dc, 0.95).fillRect(0, 0, W, Math.max(0, lip - 12));
      // The warning: a plate with the word, the seconds left and a bar that runs down.
      const bx = W / 2 - 64, by = Math.round(lip + 10);
      g.fillStyle(0x16141f, 0.9).fillRect(bx - 3, by - 3, 134, 19);
      g.fillStyle(a.safe ? 0x2e5a22 : 0x2a3448, 1).fillRect(bx - 2, by - 2, 132, 17);
      g.fillStyle(0x16141f, 1).fillRect(bx, by + 10, 128, 4);
      g.fillStyle(a.safe ? 0x8fd16a : k > 0.75 && Math.floor(a.t / 160) % 2 ? 0xffffff : 0xb8d8f0, 1).fillRect(bx, by + 10, Math.round(128 * (1 - k)), 4);
      g.fillStyle(0xffffff, 0.6).fillRect(bx, by + 10, Math.round(128 * (1 - k)), 1);
      if (!a.label) a.label = new PixelText(this, 0, 0, '', { color: '#e8f4ff' }).setScrollFactor(0).setDepth(DEPTH.weather + 3);
      a.label.setVisible(true).setPosition(bx + 2, by).setText(a.safe ? 'AVALANCHE  •  SAFE ON THE LEDGE' : `AVALANCHE IN ${Math.ceil(left / 1000)}  •  GET TO A LEDGE`).setColor(a.safe ? '#b8ff8a' : k > 0.75 ? '#ffffff' : '#e8f4ff');
      for (let i = 0; i < 10 + k * 70; i++) {
        const x = (i * 97 + Math.floor(a.t / 7) * (i % 3 + 1)) % W;
        const y = ((i * 53 + a.t * (0.04 + (i % 5) * 0.01)) % (GAME_HEIGHT * 0.8));
        g.fillStyle(0xffffff, 0.5 + 0.4 * k).fillRect(x, Math.round(y), i % 4 ? 1 : 2, i % 4 ? 1 : 2);
      }
      if (k > 0.6 && Math.random() < dt / 300 && this.settings.shake) this.cam.shake(120, 0.001 + k * 0.002);
      if (left <= 0) {
        a.hit = true;
        a.t = 0;
        if (a.label) a.label.destroy();
        Audio.play('thunder', { volume: 1 });
        if (this.settings.shake) this.cam.shake(1200, a.safe ? 0.004 : 0.008);
        if (!a.safe && this.state !== 'RESTING') {
          this.grip.change(-c.grip);
          this.hud.flashScreen(0xffffff, 0.6, 900);
          this.floatText(`SWEPT! -${c.grip} GRIP`, '#e8f4ff', 20, true);
          this.climber.hold('slip2', 600);
          if (this.grip.isEmpty && !this.lastLight()) this.startSlip();
        } else this.hud.toast('IT ROARS PAST THE LEDGE', '#e8f4ff');
      }
      return;
    }
    // The slide itself: a white wall of snow rolling down the screen.
    const k = a.t / 1700;
    if (k >= 1) { this.avalanche = null; return; }
    const front = -80 + k * (GAME_HEIGHT + 220);
    for (let i = 0; i < 26; i++) {
      const x = (i / 25) * (W + 40) - 20, r = 26 + ((i * 37) % 22);
      const y = front - ((i * 29) % 40);
      g.fillStyle(0xdfe8f4, 0.95).fillCircle(x, y, r);
      g.fillStyle(0xffffff, 0.9).fillCircle(x - r * 0.25, y - r * 0.3, r * 0.6);
    }
    g.fillStyle(0xf4f8ff, 0.9 * (1 - k * 0.6)).fillRect(0, 0, W, Math.max(0, front - 30));
    for (let i = 0; i < 30; i++) g.fillStyle(0xffffff, 0.9).fillRect((i * 71 + Math.floor(a.t / 3)) % W, Math.round(front + 20 + ((i * 13) % 60)), 3, 3);
  },

  // ---- the migration
  updateFlocks(dt, day) {
    if ((this.flockWait -= dt) < 0) {
      const c = EVENT_CFG.migration;
      this.flockWait = rnd(c.flockSec[0], c.flockSec[1]) * 1000;
      // Mostly far skeins, now and then a big low one passing close.
      const near = Math.random() < 0.3;
      const dir = Math.random() < 0.5 ? 1 : -1, n = near ? 9 + Math.floor(Math.random() * 6) : 14 + Math.floor(Math.random() * 22);
      this.flocks.push({ x: dir > 0 ? -80 : W + 80, y: rnd(near ? 60 : 20, near ? 150 : 110), dir, n, v: near ? rnd(30, 40) : rnd(14, 22), s: near ? 2 : rnd(0.8, 1.2), t: 0 });
    }
    const far = lerpColor(0x3a3a4a, day.light || 0xffffff, 0.35 + day.night * 0.2);
    const near = lerpColor(0x22202c, day.light || 0xffffff, 0.12);
    this.flocks = this.flocks.filter((f) => {
      f.t += dt;
      f.x += f.dir * f.v * dt / 1000;
      const big = f.s >= 2, p = big ? 2 : 1, g = this.evSky;
      g.fillStyle(big ? near : far, 1);
      for (let i = 0; i < f.n; i++) {
        // A long, ragged V: the leader, then two lines trailing back.
        const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
        const bx = Math.round(f.x - f.dir * row * 9 * f.s + Math.sin(i * 2.3) * 2), by = Math.round(f.y + side * row * 4 * f.s + Math.sin(f.t / 500 + i) * 1.2 * f.s);
        const up = Math.floor(f.t / (big ? 260 : 210) + i * 0.7) % 2;
        // A crane: long neck stretched forward, long wings, legs trailing.
        g.fillRect(bx - 2 * p, by, 5 * p, p).fillRect(bx + f.dir * 3 * p, by - p, p, p);
        g.fillRect(bx - f.dir * 4 * p, by + p, 2 * p, p);
        if (up) g.fillRect(bx - p, by - 2 * p, p, 2 * p).fillRect(bx, by - 3 * p, p, p).fillRect(bx + p, by - 4 * p, p, p);
        else g.fillRect(bx - p, by + p, p, 2 * p).fillRect(bx, by + 2 * p, p, p).fillRect(bx + p, by + 3 * p, p, p);
      }
      return f.x > -300 && f.x < W + 300;
    });
  },

  // A perfect hit in the migration: now and then a crane drops a feather,
  // which drifts down to you and is worth a stone.
  dropFeather() {
    const cx = this.climber.x, top = this.camY - 10;
    const f = this.add.image(cx + rnd(-60, 60), top, 'ev_feather').setDepth(DEPTH.fx + 3);
    const ty = this.climber.y - 10;
    let t = 0;
    const ev = this.time.addEvent({
      delay: 16, loop: true, callback: () => {
        t += 16;
        const k = Math.min(1, t / 1800);
        f.setPosition(Math.round(f.x + (cx - f.x) * 0.04 + Math.sin(t / 160) * 1.2), Math.round(top + (ty - top) * k));
        f.setRotation(Math.sin(t / 200) * 0.6);
        if (k >= 1) {
          ev.remove(); f.destroy();
          const gem = gemForBiome(biomeAt(levelToMeters(this.node.level)).id);
          this.awardGems(gem.value);
          this.effects.sparkle(cx, ty, 8);
          this.floatText('A CRANE FEATHER!', '#f4efe4', 26, true);
          Audio.play('gem', { value: gem.value });
        }
      },
    });
  },

  // ---- the meteor shower: shooting stars across the sky all run.
  updateStreaks(dt, day) {
    if ((this.meteorWait -= dt) < 0) {
      this.meteorWait = rnd(2500, 6000);
      this.streaks.push({ x: rnd(40, W + 120), y: rnd(-10, 60), t: 0, ms: rnd(500, 900), len: rnd(30, 60) });
    }
    const vis = 0.45 + day.night * 0.55;
    this.streaks = this.streaks.filter((s) => {
      s.t += dt;
      const k = s.t / s.ms;
      const x = s.x - k * 150, y = s.y + k * 90;
      for (let j = 0; j < s.len; j += 2) {
        const a = (1 - j / s.len) * vis * Math.sin(Math.min(1, k) * Math.PI);
        this.evAdd.fillStyle(j < 4 ? 0xffffff : 0xffd870, a).fillRect(Math.round(x + j * 1.66), Math.round(y - j), 2, 1);
      }
      return k < 1;
    });
  },

  // A falling star comes down onto one of the routes and leaves a gem there.
  meteorGem(routes) {
    const free = routes.filter((r) => !r.gem && r.target.kind !== 'ledge');
    if (!free.length || !this.runRng.chance(EVENT_CFG.meteors.chance)) return;
    const r = this.runRng.pick(free);
    const gem = { type: gemForBiome(biomeAt(levelToMeters(r.target.level)).id).id, key: `meteor:${r.from.id}>${r.target.id}` };
    const sx = r.target.x + 140, sy = r.target.y - 200;
    const head = this.add.image(sx, sy, 'glow_small').setDepth(DEPTH.fx + 3).setBlendMode('ADD').setTint(0xffd870).setScale(1.6);
    const trail = this.add.graphics().setDepth(DEPTH.fx + 2).setBlendMode('ADD');
    this.tweens.addCounter({
      from: 0, to: 1, duration: 520, ease: 'Quad.easeIn',
      onUpdate: (tw) => {
        const k = tw.getValue();
        const x = sx + (r.target.x - sx) * k, y = sy + (r.target.y - 6 - sy) * k;
        head.setPosition(x, y);
        trail.clear();
        for (let j = 0; j < 40; j += 2) trail.fillStyle(j < 6 ? 0xffffff : 0xffb040, 0.8 * (1 - j / 40)).fillRect(Math.round(x + j * 0.7), Math.round(y - j), 2, 2);
      },
      onComplete: () => {
        head.destroy(); trail.destroy();
        if (this.state !== 'ROUTE_SELECT' || !this.routes.includes(r)) return;
        r.gem = gem;
        this.addRouteGem(r);
        this.effects.ring(r.target.x, r.target.y - 6, 0xffd870, 18, 400);
        this.effects.sparkle(r.target.x, r.target.y - 6, 12);
        if (this.settings.shake) this.cam.shake(120, 0.002);
        Audio.play('rockhit', { volume: 0.5 });
        this.routeUI.show(this.routes, this.selected, { x: this.climber.x, y: this.climber.y });
      },
    });
  },

  // A gem on a route, drawn as rollGems draws them.
  addRouteGem(r) {
    const y = r.target.y - 6;
    const img = this.add.image(r.target.x, y, `gem_${r.gem.type}`).setDepth(DEPTH.holds + 2).setScale(0);
    img.glow = this.add.image(r.target.x, y, 'glow_small').setDepth(img.depth - 1).setBlendMode('ADD').setTint(GEMS[r.gem.type] ? GEMS[r.gem.type].color : 0xffffff).setScale(1.6).setAlpha(0);
    this.tweens.add({ targets: img.glow, alpha: { from: 0.25, to: 0.6 }, scale: { from: 1.4, to: 1.9 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: img, scale: 1, duration: 320, ease: 'Back.easeOut' });
    this.routeGems.push({ route: r, img });
  },

  // ---- the eclipse: a black disc over the sun with a pale corona, the sky dim.
  drawEclipse(day) {
    const k = this.eclipseK;
    const sun = this.background.sunScreen;
    this.evSky.fillStyle(0x0a0818, 0.35 * k).fillRect(0, 0, W, GAME_HEIGHT);
    if (!sun) return;
    for (let i = 0; i < 3; i++) this.evAdd.fillStyle(0xe8e0ff, 0.12 * k * (1 - i * 0.3)).fillCircle(sun.x, sun.y, 12 + i * 6 + Math.sin(this.clock / 700 + i) * 1.5);
    this.evSky.fillStyle(0x07060c, k).fillCircle(sun.x + (1 - k) * 18, sun.y, 9);
    this.evAdd.fillStyle(0xffffff, 0.6 * k).fillRect(Math.round(sun.x + 7), Math.round(sun.y - 3), 2, 2);
  },

  // ---- the rival
  startRival() {
    const c = EVENT_CFG.rival;
    const key = buildNpcClimber(this, 'npc_rival', c.look);
    const sprite = this.add.sprite(this.climber.x, this.climber.y, key, 3).setOrigin(0.5, 1).setDepth(DEPTH.climber - 1);
    const tag = new PixelText(this, 0, 0, c.name, { color: css(c.look.coat) }).setOrigin(0.5, 1).setDepth(DEPTH.climber - 1).setAlpha(0.85);
    this.rival = { level: this.node.level, sprite, tag, wins: 0, losses: 0, rest: 0, legs: {}, x: this.climber.x, side: this.climber.x < 240 ? 1 : -1 };
  },

  updateRival(dt) {
    const rv = this.rival, c = EVENT_CFG.rival;
    if (levelToMeters(rv.level) > GATE.ledgeAt - 10) {
      // The rival turns back at the Dragon's Gate.
      this.hud.toast(`${c.name} TURNS BACK AT THE GATE. ${rv.wins} - ${rv.losses} TO YOU`, '#ff9a7a');
      this.tweens.add({ targets: [rv.sprite, rv.tag], alpha: 0, duration: 800, onComplete: () => { rv.sprite.destroy(); rv.tag.destroy(); } });
      this.rival = null;
      return;
    }
    const busy = this.inPanorama || this.state === 'FALLING' || this.state === 'RUN_OVER' || this.atCamp;
    const me = this.node ? this.node.level : 0;
    if (!busy) {
      if (rv.rest > 0) rv.rest -= dt;
      else {
        // Rubber band: never more than a short way ahead or behind.
        let speed = 1 / (c.secPerLevel * 1000);
        if (rv.level > me + c.lead) speed *= 0.3;
        else if (rv.level < me - 12) speed *= 2.2;
        else if (rv.level < me - 6) speed *= 1.4;
        const before = Math.floor(rv.level);
        rv.level += dt * speed;
        const lv = this.mountain.getLevel(Math.floor(rv.level));
        if (lv && lv.nodes.length && lv.nodes[0].kind === 'ledge' && Math.floor(rv.level) !== before) {
          // Reached a ledge: if you are not there yet, that leg is theirs.
          const L = Math.floor(rv.level);
          if (!rv.legs[L] && me < L) {
            rv.legs[L] = 'rival';
            rv.losses++;
            this.hud.toast(`${c.name} REACHED THE LEDGE FIRST`, '#ff9a7a');
          }
          rv.rest = 2500;
        }
      }
    }
    const L = Math.floor(rv.level), f = rv.level - L;
    const a = this.mountain.getLevel(L), b = this.mountain.getLevel(L + 1);
    const pick = (lv) => {
      if (!lv || !lv.nodes.length) return null;
      const want = (lv.bounds.l + lv.bounds.r) / 2 + rv.side * (lv.bounds.r - lv.bounds.l) * 0.28;
      return lv.nodes.slice().sort((p, q) => Math.abs(p.x - want) - Math.abs(q.x - want))[0];
    };
    const na = pick(a), nb = pick(b) || na;
    if (!na) return;
    const x = na.x + (nb.x - na.x) * f, y = levelToY(L) + (levelToY(L + 1) - levelToY(L)) * f;
    rv.x += (x - rv.x) * Math.min(1, dt / 120);
    const onLedge = na.kind === 'ledge' && f < 0.3;
    rv.sprite.setPosition(Math.round(rv.x), Math.round(y + (onLedge ? 0 : 18))).setFrame(rv.rest > 0 || onLedge ? 3 : 1 + (L % 2));
    rv.tag.setPosition(Math.round(rv.x), Math.round(rv.sprite.y - 29));
    // Out of sight: a marker at the top or bottom edge, how far ahead or behind.
    const sy = rv.sprite.y - this.camY;
    if (sy < 8 || sy > GAME_HEIGHT + 20) {
      const ahead = sy < 8, m = Math.abs(Math.round((rv.level - me) * METERS_PER_LEVEL));
      const g = this.evG, mx = Math.max(30, Math.min(W - 30, rv.x)), my = ahead ? 58 : GAME_HEIGHT - 50;
      g.fillStyle(0x16141f, 0.85).fillRect(mx - 26, my - 4, 52, 11);
      g.fillStyle(c.look.coat, 1).fillRect(mx - 25, my - 3, 3, 9);
      g.fillStyle(0xf4efe4, 1);
      for (let k = 0; k < 3; k++) g.fillRect(mx + 18 - k, ahead ? my + k : my + 4 - k, k * 2 + 1, 1);
      if (!rv.mark) rv.mark = new PixelText(this, 0, 0, '', { color: css(c.look.coat) }).setScrollFactor(0).setDepth(DEPTH.weather + 3);
      rv.mark.setVisible(true).setPosition(Math.round(mx - 19), my - 2).setText(`${m} M`);
    } else if (rv.mark) rv.mark.setVisible(false);
  },

  // ---- rescues (idea sheet 1.8)
  // Now and then someone hangs from a broken rope under one of the holds you
  // could climb to: take that route and they follow you up.
  rescueRoutes(node) {
    if (this.stranded || this.companion || !this.run || this.director || this.expedition) return;
    if (levelToMeters(node.level) < RESCUE.minMeters || !this.runRng.chance(this.rescueChance ?? RESCUE.chance)) return;
    const options = this.routes.filter((r) => r.type !== 'safe' && r.target.kind !== 'ledge' && !r.wild);
    if (!options.length) return;
    const r = this.runRng.pick(options);
    const done = (this.prog.data.rescued || []).map((p) => p.name);
    const people = RESCUE.people.filter((p) => !done.includes(p.name));
    const person = this.runRng.pick(people.length ? people : RESCUE.people);
    r.rescue = person;
    r.tags = [...(r.tags || []), 'RESCUE'];
    const key = buildNpcClimber(this, `npc_${person.name.toLowerCase()}`, person);
    const t = r.target;
    const sprite = this.add.sprite(t.x + 12, t.y + 30, key, 0).setOrigin(0.5, 0).setDepth(DEPTH.climber - 1);
    const g = this.add.graphics().setDepth(DEPTH.climber - 1.1);
    const tag = new PixelText(this, t.x + 12, t.y + 61, person.name, { color: css(person.coat) }).setOrigin(0.5, 0).setDepth(DEPTH.climber - 1);
    const help = new PixelText(this, t.x + 26, t.y + 22, 'HELP!', { color: '#f4efe4' }).setOrigin(0, 0).setDepth(DEPTH.climber - 1);
    this.stranded = { route: r, person, sprite, g, tag, help, t: 0, x: t.x, y: t.y };
  },

  updateStranded(dt) {
    const s = this.stranded;
    s.t += dt;
    // They swing on the rope; the rope runs up to a piton by the hold, and
    // the broken half dangles off it.
    const sw = Math.sin(s.t / 600) * 3;
    s.sprite.setPosition(Math.round(s.x + 12 + sw), s.y + 30).setRotation(sw * 0.02);
    s.g.clear();
    s.g.lineStyle(1, 0xe0503a, 1).lineBetween(s.x + 9, s.y - 1, s.x + 12 + sw, s.y + 32);
    s.g.fillStyle(0xb8bcc8, 1).fillRect(s.x + 8, s.y - 2, 3, 2);
    for (let k = 0; k < 12; k++) s.g.fillStyle(0xe0503a, 1).fillRect(Math.round(s.x + 10 + Math.sin(k * 0.6 + s.t / 400) * 1.5), s.y + k, 1, 1);
    s.help.setAlpha(Math.floor(s.t / 400) % 2 ? 1 : 0.3).setPosition(Math.round(s.x + 24 + sw), s.y + 20);
    s.tag.setPosition(Math.round(s.x + 12 + sw), s.y + 59);
    // Climbed on past them, or out of sight: they wait for the next climber.
    if (s.y > this.camY + GAME_HEIGHT + 80) this.clearStranded();
  },

  clearStranded(keepSprite = false) {
    const s = this.stranded;
    if (!s) return;
    s.g.destroy(); s.help.destroy();
    if (!keepSprite) { s.sprite.destroy(); s.tag.destroy(); }
    this.stranded = null;
  },

  // Starting the climb: if it is the stranded climber's route, they tie in
  // and follow you.
  rescueStart(route) {
    const s = this.stranded;
    if (!s) return;
    if (route !== s.route) { if (s.route.from === this.node) this.floatText(`${s.person.name} WATCHES YOU GO`, '#f4efe4', 30); return; }
    this.clearStranded(true);
    this.companion = { person: s.person, sprite: s.sprite, tag: s.tag, strikes: 0, tx: s.x + 12, ty: s.y + 26, slip: 0 };
    s.sprite.setOrigin(0.5, 1).setRotation(0).setFrame(1);
    this.hud.toast(`${s.person.name} TIES IN BEHIND YOU`, css(s.person.coat));
  },

  updateCompanion(dt) {
    const c = this.companion;
    c.slip = Math.max(0, c.slip - dt);
    const sp = c.sprite;
    sp.x += (c.tx - sp.x) * Math.min(1, dt / 180);
    sp.y += (c.ty - sp.y) * Math.min(1, dt / 180);
    if (c.slip > 0) sp.setFrame(4);
    else if (c.ledge) sp.setFrame(Math.floor(this.clock / 500) % 2 ? 3 : 1);
    else sp.setFrame(1 + (Math.floor(sp.y / 8) % 2 === 0 ? 0 : 1));
    c.tag.setPosition(Math.round(sp.x), Math.round(sp.y - 30)).setOrigin(0.5, 1);
    c.tag.setText(`${c.person.name} ${'◆'.repeat(RESCUE.strikes - c.strikes)}`);
  },

  // The companion climbs up to where you just were.
  companionFollow(prev) {
    const c = this.companion;
    if (!c || !prev) return;
    c.ledge = prev.kind === 'ledge';
    c.tx = prev.x + (c.ledge ? -18 : 0);
    c.ty = prev.y + (c.ledge ? 0 : 20);
  },

  // Every miss you make, they make too.
  companionMiss() {
    const c = this.companion;
    if (!c) return;
    c.strikes++;
    c.slip = 380;
    this.floatText(`${c.person.name} SLIPS!`, css(c.person.coat), -20);
    if (c.strikes >= RESCUE.strikes) this.loseCompanion(`${c.person.name} HAS HAD ENOUGH AND ROPES DOWN TO CAMP. HMPH.`);
  },

  loseCompanion(line) {
    const c = this.companion;
    if (!c) return;
    this.companion = null;
    this.hud.toast(line, '#f4efe4');
    c.sprite.setFrame(0);
    this.tweens.add({ targets: [c.sprite, c.tag], y: '+=220', alpha: 0, duration: 1600, ease: 'Quad.easeIn', onComplete: () => { c.sprite.destroy(); c.tag.destroy(); } });
  },

  // On a ledge with them: they are safe. A pouch of stones, and their flag
  // flies at base camp from now on.
  companionSafe(node) {
    const c = this.companion;
    if (!c || node.level === 0) return;
    this.companion = null;
    const gem = gemForBiome(biomeAt(levelToMeters(node.level)).id);
    const d = this.prog.data;
    if (!Array.isArray(d.rescued)) d.rescued = [];
    if (!d.rescued.some((p) => p.name === c.person.name)) d.rescued.push({ name: c.person.name, coat: c.person.coat });
    this.prog.bump('rescues');
    this.awardGems(gem.value * RESCUE.pouch);
    this.hud.toast(`${c.person.name} IS SAFE! THEIR FLAG WILL FLY AT CAMP`, css(c.person.coat));
    this.floatText(`THANK YOU! A POUCH OF ${gem.name}`, toCss(gem.color), 26, true);
    this.effects.sparkle(c.sprite.x, c.sprite.y - 12, 14);
    Audio.play('milestone');
    c.sprite.setPosition(node.x - 22, node.y).setFrame(3);
    c.tag.setText(c.person.name);
    this.time.delayedCall(6000, () => this.tweens.add({ targets: [c.sprite, c.tag], alpha: 0, duration: 800, onComplete: () => { c.sprite.destroy(); c.tag.destroy(); } }));
  },

  // ---------------------------------------------------------------- hooks
  // After the routes are offered: dares that change them, the eclipse, a rescue.
  runRoutes(node) {
    if (!this.run) return;
    // TOURIST: one route only, the middle one.
    if (this.dares.includes('tourist') && this.routes.length > 1) {
      const mid = this.routes.find((r) => r.type === 'normal') || this.routes[Math.floor(this.routes.length / 2)];
      this.routes = [mid];
    }
    if (this.eclipseK > 0.5) {
      const mods = { tag: 'ECLIPSE', hint: 'ECLIPSE: NOTES FLASH ON THE BEAT', dark: DARKNESS };
      this.routes.forEach((r) => { if (!r.mods) r.mods = mods; });
    }
    this.rescueRoutes(node);
  },

  // After the gems are placed: falling stars, and the OLD CROW.
  runGems(node) {
    if (!this.run || this.director) return;
    if (this.runEv && this.runEv.announced && this.runEv.id === 'meteors') this.meteorGem(this.routes);
    if (this.bfx.crow && this.cameFromLedge) {
      this.cameFromLedge = false;
      const free = this.routes.filter((r) => !r.gem && r.target.kind !== 'ledge');
      if (free.length) {
        const r = this.runRng.pick(free);
        r.gem = { type: gemForBiome(biomeAt(levelToMeters(r.target.level)).id).id, key: `crow:${r.from.id}>${r.target.id}` };
        this.crowFlight(r);
      }
    }
  },

  // The crow flaps in from the side and leaves the gem on the hold.
  crowFlight(r) {
    const from = r.target.x < 240 ? -1 : 1;
    const crow = this.add.sprite(r.target.x + from * 160, r.target.y - 70, 'bird', 0).setDepth(DEPTH.fx + 2).setTint(0x1a1424).setScale(1.5).setFlipX(from > 0);
    const fl = this.time.addEvent({ delay: 120, loop: true, callback: () => crow.setFrame((crow.frame.name + 1) % 2) });
    this.tweens.add({
      targets: crow, x: r.target.x, y: r.target.y - 12, duration: 700, ease: 'Sine.easeOut',
      onComplete: () => {
        if (this.state === 'ROUTE_SELECT' && this.routes.includes(r)) { this.addRouteGem(r); this.routeUI.show(this.routes, this.selected, { x: this.climber.x, y: this.climber.y }); }
        this.tweens.add({ targets: crow, x: r.target.x - from * 200, y: r.target.y - 120, duration: 900, ease: 'Sine.easeIn', onComplete: () => { fl.remove(); crow.destroy(); } });
      },
    });
  },

  // OLD CROW's price: a new biome, a stone stolen.
  crowSteals(h) {
    if (!this.bfx || !this.bfx.crow || this.run.gems <= 0) return;
    const key = biomeStretchAt(h);
    if (this.crowTheft[key]) return;
    this.crowTheft[key] = true;
    const v = Math.min(this.run.gems, gemForBiome(biomeAt(h).id).value);
    this.run.gems -= v;
    if (!this.prog.infiniteGems) { this.prog.data.gems = Math.max(0, this.prog.data.gems - v); this.prog.save(); }
    this.hud.setGems(this.prog.gems, true);
    this.hud.toast(`THE CROW TOOK ${v}◆`, '#b8a8d8');
  },

  // Before a judged note costs grip: SHERPA catches one miss per biome.
  runNoteBefore(note) {
    if (!this.bfx.sherpa || note.result !== 'miss' || note.still || note.reason === 'release' || note.reason === 'roll') return;
    const key = biomeStretchAt(levelToMeters(this.node.level));
    if (this.sherpaUsed[key]) return;
    this.sherpaUsed[key] = true;
    note.result = 'good';
    note.reason = null;
    this.floatText('SHERPA CAUGHT IT!', '#8fd16a', 26, true);
    this.effects.ring(this.climber.x, this.climber.y - 6, 0x8fd16a, 16, 360);
  },

  // After a note: feathers, and the companion copying your misses.
  runNote(note) {
    if (note.still) return;
    if (note.result === 'perfect' && this.runEv && this.runEv.announced && this.runEv.id === 'migration' && Math.random() < EVENT_CFG.migration.featherChance) this.dropFeather();
    if (note.result === 'miss') this.companionMiss();
  },

  // A ledge: the rival's race and the rescue.
  runRest(node) {
    if (!this.run || this.director) return;
    if (this.companion) this.companionSafe(node);
    const rv = this.rival;
    if (rv && node.level > 0 && !rv.legs[node.level]) {
      rv.legs[node.level] = 'you';
      if (rv.level < node.level) {
        rv.wins++;
        const gem = gemForBiome(biomeAt(levelToMeters(node.level)).id);
        this.awardGems(gem.value * EVENT_CFG.rival.ledgeGems);
        this.floatText(`FIRST TO THE LEDGE! BEAT ${EVENT_CFG.rival.name}`, '#ff9a7a', 30, true);
      }
    }
    this.cameFromLedge = true;
  },

  // A slip: the companion lets go and ropes down to camp.
  runSlip() {
    if (this.companion) this.loseCompanion(`${this.companion.person.name} LETS GO AND ROPES DOWN TO CAMP.`);
  },

  // LAST LIGHT: when the grip runs out, time stops for a beat and you hold
  // on, once per biome. Returns true if it saved you.
  lastLight() {
    if (!this.bfx || !this.bfx.lastLight || !this.node) return false;
    const key = biomeStretchAt(levelToMeters(this.node.level));
    if (this.lastLightUsed[key]) return false;
    this.lastLightUsed[key] = true;
    this.grip.set(18);
    this.freezeFrame(420, 0xfff0c0);
    this.hud.flashScreen(0xffe8a0, 0.4, 700);
    this.effects.ring(this.climber.x, this.climber.y - 6, 0xffd24a, 30, 600);
    this.floatText('LAST LIGHT!', '#ffd24a', 24, true);
    Audio.play('phoenix');
    return true;
  },

  // Which slip allowance a fall uses: one per biome stretch, or one for the
  // whole run (ONE ROPE, LAST LIGHT).
  slipKey(meters) {
    return this.dares.includes('onerope') || (this.bfx && this.bfx.oneSlip) ? 'run' : biomeStretchAt(meters);
  },

  // STORMCALLER: a bolt of lightning feeds you grip (NIGHT SHIFT: and lights every note).
  lightningGrip() {
    const fx = this.bfx;
    if (!fx || !fx.lightningGrip || this.state === 'RUN_OVER' || this.state === 'FALLING') return;
    this.grip.change(fx.lightningGrip);
    this.floatText(`STORMCALLER +${fx.lightningGrip}`, '#ffe45a', 16);
    if (fx.nightShift) this.lightUntil = this.clock + 1600;
  },
};
