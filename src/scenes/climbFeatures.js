// Overhangs (idea sheet 1.3) and traverses to hidden caves (1.4). Installed
// onto ClimbScene.prototype, so `this` is the climb scene.
//   Overhang  a short band where the rock juts out (the generator marks the
//             levels with `roof`). Climbing under it the notes drip down a
//             lane out of the rock (ComboPrompt), you swing under the roof,
//             the rock overhead darkens the top of the view, water drips,
//             and hanging there drains grip faster.
//   Cave      now and then a fourth route: a sideways traverse (only ← and →)
//             that gains no height and ends at a cave mouth. Inside, lit by
//             your headlamp: a gem cache, a dragon's skull, a journal page or
//             a creature asleep.
import { DEPTH, GAME_WIDTH, GAME_HEIGHT, levelToMeters } from '../config/gameConfig.js';
import { biomeAt } from '../data/biomes.js';
import { gemForBiome } from '../data/gems.js';
import { caveMouthKey, caveRoomKey, creatureKey, creatureFor, ROOM_W, ROOM_H } from '../render/caveArt.js';
import { PixelText, COLORS, drawFrame } from '../ui/PixelText.js';
import { Audio } from '../systems/AudioSystem.js';
import { toCss } from '../utils/color.js';

export const ROOF_FX = { drain: 1.4 };
export const CAVE = {
  chance: 0.06,
  minMeters: 20,
  kinds: ['cache', 'fossil', 'page', 'creature'],
  cacheStones: [3, 5],
};

// Pages from old journals, found in caves (two lines each).
const PAGES = [
  ["ELSA, DAY 12: THE ROCK IS WARM HERE.", "SOMETHING BREATHES IN THE STONE."],
  ["BRAM, DAY 3: LEFT A ROPE AND A TIN OF", "BISCUITS. IF YOU FIND THEM, THEY ARE YOURS."],
  ["ELSA: THE CRANES FLY OVER AT DAWN.", "I COUNTED NINETY. BRAM SAYS I CANNOT COUNT."],
  ["NO NAME: I CAME FOR THE SUMMIT.", "I STAYED FOR THE VIEW. TELL MY MOTHER."],
  ["BRAM: ELSA TOOK THE HARD WAY AGAIN.", "I TOOK THE CAVE. NOBODY TELLS HER."],
  ["ELSA, NIGHT: THE DRAGON DREAMS ALOUD.", "IT DREAMS OF A MOUNTAIN ACROSS THE SEA."],
  ["A CHILD'S HAND: I SAW A GOAT UP HERE.", "IT WAS HIGHER THAN ME. NOT FAIR."],
  ["KEEPER OF THE FAR SHORE: THE TEA IS", "ALWAYS ON. COME DOWN WHEN YOU ARE COLD."],
];

export const climbFeatures = {
  initFeatures() {
    this.roofK = 0;
    this.roofG = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.weather + 1);
    this.roofDrips = [];
    this.cave = null;
    this.caveMouth = null;
    this.cavesRolled = new Set();
  },

  // How far the rock juts out at a level (0: not an overhang).
  roofAt(level) {
    const lv = this.mountain && this.mountain.getLevel(level);
    return lv && lv.roof ? lv.roof : 0;
  },

  // After the routes are offered: overhang routes and the cave traverse.
  featureRoutes(node) {
    if (!this.routes || !this.routes.length) return;
    // Under a roof every route drips: plain notes only, down the lane.
    const underRoof = (r) => this.roofAt(node.level) > 0 || this.roofAt(r.target.level) > 0 || this.roofAt(Math.round((node.level + r.target.level) / 2)) > 0;
    let roofed = false;
    for (const r of this.routes) {
      if (!underRoof(r) || r.echo) continue;
      r.roof = true;
      r.notes = r.notes.filter((n) => !n.still).map((n) => ({ dir: n.dir, gap: n.gap, hidden: n.hidden }));
      r.tags = ['OVERHANG'];
      roofed = true;
    }
    if (roofed) { this.tip('roof'); if (!this.run.roofSeen) { this.run.roofSeen = true; this.floatText('UNDER THE ROOF', '#c8d8f0', 26, true); } }
    this.caveRoute(node, roofed);
  },

  caveRoute(node, roofed) {
    if (this.caveMouth && this.caveMouth.level !== node.level) { this.caveMouth.objs.forEach((o) => o.destroy()); this.caveMouth = null; }
    if (this.director || this.expedition || this.lifting || node.kind === 'ledge' || roofed || this.dares.includes('tourist')) return;
    const meters = levelToMeters(node.level);
    if (meters < CAVE.minMeters || this.cavesRolled.has(node.level)) return;
    this.cavesRolled.add(node.level);
    if (!this.runRng.chance(this.caveChance ?? CAVE.chance)) return;
    const lv = this.mountain.getLevel(node.level);
    if (!lv) return;
    const left = node.x - lv.bounds.l > lv.bounds.r - node.x;
    const side = left ? -1 : 1;
    const cx = Math.round(left ? lv.bounds.l + 18 : lv.bounds.r - 18);
    if (Math.abs(cx - node.x) < 60) return;
    const base = this.routes.find((r) => r.type === 'normal') || this.routes[0];
    const n = 4 + (meters > 600 ? 1 : 0);
    const dirs = Array.from({ length: n }, () => (this.runRng.chance(0.7) ? (left ? 'L' : 'R') : (left ? 'R' : 'L')));
    const kind = this.runRng.pick(CAVE.kinds);
    const target = { id: `cave:${node.level}:${cx}`, level: node.level, x: cx, y: node.y, kind: 'hold', hazard: null, cave: true };
    this.routes.push({
      ...base, type: 'cave', label: 'CAVE', toLedge: false, from: node, target, levels: 0, heightGain: 0,
      inputs: n, pattern: dirs, notes: dirs.map((dir, i) => ({ dir, gap: i && this.runRng.chance(0.25) ? 0.5 : 1 })),
      tags: ['TRAVERSE'], hazard: null, difficulty: 2, gem: null, thermal: null, mods: null, roof: false,
      cave: { kind, side }, gripCost: base.gripCost * 0.8,
    });
    // The mouth in the rock, something glinting inside.
    const biome = biomeAt(meters);
    const objs = [this.add.image(cx, node.y + 6, caveMouthKey(this, biome)).setOrigin(0.5, 1).setDepth(DEPTH.holds - 1)];
    const tint = kind === 'cache' ? gemForBiome(biome.id).color : kind === 'page' ? 0xffc860 : kind === 'creature' ? 0xffb040 : 0xff7a3a;
    const glint = this.add.image(cx, node.y - 3, 'glow_small').setDepth(DEPTH.light + 1).setBlendMode('ADD').setTint(tint).setScale(1.2).setAlpha(0.5);
    objs.push(glint);
    this.tweens.add({ targets: glint, alpha: { from: 0.2, to: 0.7 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (kind === 'creature') {
      // Two eyes in the dark, blinking now and then.
      const eyes = this.add.graphics().setDepth(DEPTH.light + 1);
      eyes.fillStyle(0xffd060, 1).fillRect(cx - 3, node.y - 4, 1, 1).fillRect(cx + 2, node.y - 4, 1, 1);
      this.tweens.add({ targets: eyes, alpha: { from: 1, to: 0 }, duration: 120, yoyo: true, repeat: -1, repeatDelay: 2600 });
      objs.push(eyes);
    }
    this.caveMouth = { level: node.level, objs };
    this.tip('cave');
  },

  // Grip drains faster hanging under the rock.
  roofDrain() { return this.node && this.node.kind !== 'ledge' && this.roofAt(this.node.level) > 0 ? ROOF_FX.drain : 1; },

  updateFeatures(dt) {
    // The rock overhead: how much of a roof is over the climber.
    const lvl = this.node ? this.node.level : 0;
    const roof = Math.max(this.roofAt(lvl), this.roofAt(lvl + 1), this.roofAt(lvl + 2));
    this.roofK += ((roof > 0 ? 1 : 0) - this.roofK) * Math.min(1, dt / 500);
    const g = this.roofG.clear();
    const k = this.roofK;
    if (k > 0.01 && this.state !== 'RUN_OVER') {
      // A dark ragged band across the top of the view: the underside of the
      // roof, with water gathering on it and dripping past you.
      const t = this.clock;
      for (let x = 0; x < GAME_WIDTH; x += 4) {
        const h = 26 + Math.sin(x * 0.07) * 6 + Math.sin(x * 0.23 + 1) * 3 + ((x * 37) % 7);
        g.fillStyle(0x0c0a12, 0.6 * k).fillRect(x, 0, 4, Math.round(h * k));
        g.fillStyle(0x2a2636, 0.6 * k).fillRect(x, Math.round(h * k) - 2, 4, 2);
      }
      if (Math.random() < dt / 160 * k && this.roofDrips.length < 18) this.roofDrips.push({ x: Math.random() * GAME_WIDTH, y: 24, v: 0 });
      this.roofDrips = this.roofDrips.filter((d) => {
        d.v += dt * 0.0008; d.y += d.v * dt;
        g.fillStyle(0xbfe0f0, 0.75 * k).fillRect(Math.round(d.x), Math.round(d.y), 1, 3);
        return d.y < GAME_HEIGHT;
      });
      // You swing under the rock while you hang there.
      if (this.state === 'ROUTE_SELECT' && this.climber.sprite) this.climber.sprite.setAngle(Math.sin(t / 650) * 7 * k);
    } else if (this.climber.sprite && this.climber.sprite.angle && this.state !== 'FALLING' && this.state !== 'SLIPPING') this.climber.sprite.setAngle(0);
    if (this.state === 'CLIMBING_COMBO' && this.climber.sprite && Math.abs(this.climber.sprite.angle) > 0.1 && !this.climber.flailTween) this.climber.sprite.setAngle(this.climber.sprite.angle * 0.9);
    if (this.cave) this.updateCave(dt);
  },

  // ---------------------------------------------------------------- the cave
  enterCave(route) {
    const t = route.target, cv = route.cave;
    const biome = biomeAt(levelToMeters(t.level));
    this.state = 'CAVE';
    this.routeUI.hide();
    if (this.caveMouth) { this.caveMouth.objs.forEach((o) => o.destroy()); this.caveMouth = null; }
    Audio.play('cloth');
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const cx = Math.round(W / 2), cy = Math.round(H / 2 - 6);
    const D = DEPTH.hud - 4;
    const objs = [];
    const add = (o) => { objs.push(o); return o.setScrollFactor(0); };
    const back = add(this.add.rectangle(0, 0, W, H, 0x050408).setOrigin(0, 0).setDepth(D).setAlpha(0));
    const frameG = add(this.add.graphics().setDepth(D + 0.1));
    drawFrame(frameG, cx - ROOM_W / 2 - 5, cy - ROOM_H / 2 - 5, ROOM_W + 10, ROOM_H + 10, { accent: biome.accentC, alpha: 1 });
    const key = caveRoomKey(this, biome, cv.kind, cv.side);
    const room = add(this.add.image(cx, cy, key).setDepth(D + 0.2));
    const roomGlow = add(this.add.image(cx, cy, `${key}_glow`).setDepth(D + 0.4).setBlendMode('ADD').setAlpha(0.8));
    // The headlamp's beam from the entrance, dust turning in it.
    const beam = add(this.add.graphics().setDepth(D + 0.3).setBlendMode('ADD'));
    let sleeper = null;
    if (cv.kind === 'creature') sleeper = add(this.add.sprite(cx + 6, cy + ROOM_H / 2 - 52, creatureKey(this, biome.id), 0).setDepth(D + 0.25).setScale(2));
    // Open like an eye: a circle of light grows out of the dark.
    const maskG = this.make.graphics({ add: false }).setScrollFactor(0);
    const mask = maskG.createGeometryMask();
    [room, roomGlow, beam, frameG].concat(sleeper ? [sleeper] : []).forEach((o) => o.setMask(mask));
    // What you find, and what it gives.
    const gem = gemForBiome(biome.id);
    let title = '', line1 = '', line2 = '', color = COLORS.gold;
    this.prog.bump('caves');
    this.discover('hidden-cave');
    if (cv.kind === 'cache') {
      const n = this.runRng.int(CAVE.cacheStones[0], CAVE.cacheStones[1]);
      this.awardGems(gem.value * n);
      title = `A CACHE OF ${gem.name}`; line1 = `SOMEONE HID ${n} STONES HERE LONG AGO.`; line2 = 'THEY ARE YOURS NOW.'; color = toCss(gem.color);
    } else if (cv.kind === 'fossil') {
      this.awardGems(gem.value * 2);
      this.discover('cave-fossil');
      title = "A DRAGON'S SKULL"; line1 = 'OLDER THAN THE MOUNTAIN, SET IN THE STONE.'; line2 = `YOU PRY ${gem.name} FROM ITS SOCKET.`; color = '#fff2d8';
    } else if (cv.kind === 'page') {
      const p = PAGES[this.runRng.int(0, PAGES.length - 1)];
      this.awardGems(gem.value);
      this.discover('cave-page');
      title = 'A PAGE FROM AN OLD JOURNAL'; [line1, line2] = p; color = '#f0e6cc';
    } else {
      const cr = creatureFor(biome.id);
      this.grip.restoreFull();
      this.discover('cave-creature');
      title = `A ${cr.name}, ASLEEP`; line1 = 'YOU SIT A WHILE BESIDE IT IN THE WARM.'; line2 = 'YOUR GRIP IS FULL AGAIN.'; color = '#ffd8a0';
    }
    const txt = (y, s, c, scale = 1) => add(new PixelText(this, cx, y, s, { color: c }).setOrigin(0.5, 0).setScale(scale).setDepth(D + 1).setAlpha(0));
    const head = txt(Math.max(4, cy - ROOM_H / 2 - 22), 'A HIDDEN CAVE', COLORS.dim);
    const t1 = txt(cy + ROOM_H / 2 - 30, title, color, 1);
    const t2 = txt(cy + ROOM_H / 2 - 19, line1, '#e8e4dc');
    const t3 = txt(cy + ROOM_H / 2 - 10, line2, '#e8e4dc');
    const hint = txt(Math.min(GAME_HEIGHT - 10, cy + ROOM_H / 2 + 8), 'SPACE OR TAP: CLIMB ON', COLORS.faint);
    const plate = add(this.add.graphics().setDepth(D + 0.9).setAlpha(0));
    plate.fillStyle(0x07060c, 0.8).fillRect(cx - ROOM_W / 2, cy + ROOM_H / 2 - 33, ROOM_W, 33);
    this.cave = { route, objs, beam, maskG, sleeper, t: 0, side: cv.side, texts: [head, t1, t2, t3, hint, plate], back, motes: Array.from({ length: 26 }, () => ({ u: Math.random(), v: Math.random(), s: 0.3 + Math.random() * 0.7 })), cx, cy, opened: false };
    this.tweens.add({ targets: back, alpha: 0.86, duration: 300 });
    Audio.play(cv.kind === 'cache' ? 'gem' : 'checkpoint', { value: gem.value });
  },

  updateCave(dt) {
    const c = this.cave;
    c.t += dt;
    const open = Math.min(1, c.t / 700);
    const e = open * open * (3 - 2 * open);
    c.maskG.clear().fillStyle(0xffffff).fillCircle(c.cx, c.cy, e * (ROOM_W * 0.62));
    if (c.t > 500) c.texts.forEach((o) => o.setAlpha(Math.min(1, (c.t - 500) / 300)));
    // The beam: a soft cone from the entrance side, flickering a little.
    const b = c.beam.clear();
    const ex = c.cx + c.side * (ROOM_W / 2 - 8), ey = c.cy - 26;
    const fl = 0.85 + 0.15 * Math.sin(c.t / 90) * Math.sin(c.t / 37);
    for (let i = 0; i < 5; i++) {
      const spread = 28 + i * 12, reach = ROOM_W * (0.55 + i * 0.07);
      b.fillStyle(0xffd8a0, 0.022 * fl).fillTriangle(ex, ey, ex - c.side * reach, ey - spread * 0.4, ex - c.side * reach, ey + spread * 1.4);
    }
    for (const m of c.motes) {
      m.u = (m.u + dt * 0.00003 * m.s) % 1; m.v = (m.v + Math.sin(c.t / 900 + m.s * 9) * 0.0004) % 1;
      const x = ex - c.side * m.u * ROOM_W * 0.7, y = ey - 10 + m.v * 60 * m.u + m.u * 20;
      b.fillStyle(0xffffff, 0.5 * (1 - m.u) * fl).fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    if (c.sleeper) {
      c.sleeper.setFrame(Math.floor(c.t / 1100) % 2);
      // Zzz drifting up.
      const zt = (c.t % 2400) / 2400;
      b.fillStyle(0xd8e4ff, 0.7 * (1 - zt)).fillRect(Math.round(c.sleeper.x + 12 + zt * 10), Math.round(c.sleeper.y - 10 - zt * 18), 3, 1)
        .fillRect(Math.round(c.sleeper.x + 14 + zt * 10), Math.round(c.sleeper.y - 9 - zt * 18), 1, 1)
        .fillRect(Math.round(c.sleeper.x + 12 + zt * 10), Math.round(c.sleeper.y - 8 - zt * 18), 3, 1);
    }
    // The autopilot climbs on by itself.
    if (this.bot && c.t > 1200) this.leaveCave();
  },

  caveInput() {
    if (!this.cave || this.cave.t < 600) return;
    this.leaveCave();
  },

  leaveCave() {
    const c = this.cave;
    if (!c) return;
    this.cave = null;
    Audio.play('cloth');
    this.tweens.add({
      targets: c.objs.filter((o) => o.alpha !== undefined), alpha: 0, duration: 260,
      onComplete: () => { c.objs.forEach((o) => o.destroy()); c.maskG.destroy(); },
    });
    this.arrive(c.route.target, 0);
  },
};
