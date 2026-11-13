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
import { caveMouthKey, creatureFor } from '../render/caveArt.js';
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
  },

  // ---------------------------------------------------------------- the cave
  // Step inside: the cave is a scene of its own (scenes/CaveScene.js),
  // launched over the climb, which waits.
  enterCave(route) {
    const t = route.target, cv = route.cave;
    const biome = biomeAt(levelToMeters(t.level));
    this.state = 'CAVE';
    this.routeUI.hide();
    if (this.caveMouth) { this.caveMouth.objs.forEach((o) => o.destroy()); this.caveMouth = null; }
    this.cave = { route };
    this.prog.bump('caves');
    this.discover('hidden-cave');
    this.time.delayedCall(250, () => {
      if (!this.sys.isActive()) return;
      this.paused = false;
      this.openOverlay('Cave', { returnTo: 'Climb', biome: biome.id, kind: cv.kind, side: cv.side });
    });
  },

  // The cave scene asks for the find: applies it, returns what to show.
  caveReward(kind) {
    const c = this.cave;
    if (!c || c.rewarded) return null;
    c.rewarded = true;
    const biome = biomeAt(levelToMeters(c.route.target.level));
    const gem = gemForBiome(biome.id);
    if (kind === 'cache') {
      const n = this.runRng.int(CAVE.cacheStones[0], CAVE.cacheStones[1]);
      this.awardGems(gem.value * n);
      return { stones: n, title: `${n} ${gem.name}${n > 1 ? 'S' : ''}`, line1: 'SOMEONE HID THEM HERE LONG AGO.', line2: 'THEY ARE YOURS NOW.', color: toCss(gem.color) };
    }
    if (kind === 'fossil') {
      this.awardGems(gem.value * 2);
      this.discover('cave-fossil');
      return { stones: 2, title: `THE SKULL'S EYE: ${gem.name}`, line1: 'OLDER THAN THE MOUNTAIN. IT COMES OUT', line2: 'OF THE SOCKET WARM IN YOUR HAND.', color: '#ffb070' };
    }
    if (kind === 'page') {
      const p = PAGES[this.runRng.int(0, PAGES.length - 1)];
      this.awardGems(gem.value);
      this.discover('cave-page');
      return { page: p, title: 'A LOST PAGE', line1: 'TUCKED UNDER IT: ONE STONE, FOR LUCK.', line2: '', color: '#f0e6cc' };
    }
    const cr = creatureFor(biome.id);
    this.grip.restoreFull();
    this.discover('cave-creature');
    return { title: `THE ${cr.name} SLEEPS ON`, line1: 'YOU SIT A WHILE BESIDE IT IN THE WARM.', line2: 'YOUR GRIP IS FULL AGAIN.', color: '#ffd8a0' };
  },

  // Back out of the cave: you are on the hold at its mouth.
  leaveCave() {
    const c = this.cave;
    if (!c) return;
    this.cave = null;
    Audio.play('cloth');
    this.arrive(c.route.target, 0);
  },

  caveInput() {},
};
