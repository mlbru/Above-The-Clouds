// Trail Boons inside a climb. Installed onto ClimbScene.prototype, so `this`
// is the climb scene. The rules live in data/boons.js; this file places the
// shrines on the wall, opens the cairn, and applies every gift and its price.
import { DEPTH, METERS_PER_LEVEL, levelToMeters } from '../config/gameConfig.js';
import { COLORS } from '../ui/PixelText.js';
import { SHRINE, GROUPS, boonCard, boonEffects, boonOffer, shrinePlan, activeSynergies, isSouvenir, souvenirBiome, stretchIndexAt } from '../data/boons.js';
import { biomeAt, biomeStretchAt, BIOMES } from '../data/biomes.js';
import { addThermal, THERMALS } from '../systems/mechanics/Thermals.js';
import { difficultyAt } from '../systems/DifficultySystem.js';
import { buildBoonTextures, boonIconKey } from '../render/boonArt.js';
import { gemForBiome } from '../data/gems.js';
import { Audio } from '../systems/AudioSystem.js';
import { toCss } from '../utils/color.js';

const NO_FX = boonEffects([]);
const css = (c) => `#${c.toString(16).padStart(6, '0')}`;

// ?boons=echo,magpie on the dev server: start a run holding these (testing only).
function devBoons() {
  try {
    if (!import.meta.env || !import.meta.env.DEV) return [];
    const v = new URLSearchParams(window.location.search).get('boons');
    return v ? v.split(',').filter((id) => boonCard(id)) : [];
  } catch { return []; }
}

export const climbBoons = {
  // Called once in create(). Boons are a Normal endless-run thing only.
  initBoons() {
    buildBoonTextures(this);
    this.bfx = NO_FX;
    const allowed = !this.tutorial && !this.expedition && !this.dared && this.mode === 'normal';
    this.boons = allowed ? { held: [], shrines: [], flaskUsed: {}, ropeUsed: {}, cleanRow: 0, phoenixUsed: false, log: [] } : null;
    this.songbird = null;
    this.previewG = this.add.graphics().setDepth(DEPTH.routeMarks);
    if (!this.boons) return;
    this.planShrines(0);
    const dev = devBoons();
    if (dev.length) { this.boons.held = dev; this.applyBoons(); }
  },

  // The three shrines of this run, counted from where it starts (a lift ticket starts higher).
  planShrines(startMeters) {
    if (!this.boons) return;
    this.boons.shrines.forEach((s) => this.clearCairn(s));
    this.boons.startIndex = stretchIndexAt(startMeters);
    this.boons.shrines = shrinePlan(this.seed, startMeters).map((p) => ({ ...p, node: null, used: false, cairn: null, rerolls: 0 }));
    this.updateShrines();
  },

  // Once the climber is close, the shrine's ledge is found and its cairn built.
  updateShrines() {
    if (!this.boons) return;
    const h = levelToMeters(this.node ? this.node.level : 0);
    for (const s of this.boons.shrines) {
      if (s.node || s.used || h < s.from - 90) continue;
      const from = Math.ceil(s.from / METERS_PER_LEVEL);
      const level = this.mountain.nextLedgeAbove(from - 1, 120);
      if (level === null) continue;
      const lv = this.mountain.getLevel(level);
      s.node = lv && lv.nodes.find((n) => n.kind === 'ledge');
      if (s.node) this.buildCairn(s);
    }
  },

  buildCairn(s) {
    const n = s.node;
    const side = n.x > 240 ? -1 : 1;
    const x = n.x + side * 30, y = n.y + 1;
    // Bigger than a hold, so it reads from a few ledges below: a shaft of pale
    // light over it, the stones, and a rune that glows like ice in the dark.
    const pillar = this.add.image(x, y - 90, 'glow').setBlendMode('ADD').setTint(0xa8d8ff).setScale(1.1, 5.4).setAlpha(0.22).setDepth(DEPTH.holds);
    const cairn = this.add.image(x, y, 'shrine_cairn').setOrigin(0.5, 1).setScale(1.5).setDepth(DEPTH.holds + 1);
    const runeGlow = this.add.image(x, y - 21, 'glow').setBlendMode('ADD').setTint(0xbfeaff).setScale(0.9).setAlpha(0.7).setDepth(DEPTH.light + 1);
    const rune = this.add.image(x - 1, y - 21, 'shrine_rune').setTint(0xe8fbff).setScale(1.5).setDepth(DEPTH.holds + 2);
    s.cairn = { pillar, cairn, rune, runeGlow, x, y };
  },

  clearCairn(s) {
    if (!s.cairn) return;
    Object.values(s.cairn).forEach((o) => o && o.destroy && o.destroy());
    s.cairn = null;
  },

  // The cairn's rune pulses and motes rise from it while it waits.
  updateCairns(dt) {
    if (!this.boons) return;
    for (const s of this.boons.shrines) {
      const c = s.cairn;
      if (!c) continue;
      if (s.used) { c.rune.setAlpha(0.15); c.runeGlow.setAlpha(0); c.pillar.setAlpha(0); continue; }
      const a = 0.65 + 0.35 * Math.sin(this.clock / 380);
      c.rune.setAlpha(a);
      c.runeGlow.setAlpha(0.45 + 0.35 * a).setScale(0.8 + 0.15 * a);
      c.pillar.setAlpha(0.14 + 0.1 * a);
      if (!this.settings.reducedParticles && Math.random() < dt / 200) this.effects.sparkle(c.x + (Math.random() - 0.5) * 16, c.y - 14 - Math.random() * 20, 1);
    }
  },

  shrineAt(node) {
    if (!this.boons || !node) return null;
    return this.boons.shrines.find((s) => !s.used && s.node && s.node.id === node.id) || null;
  },

  // Arriving on (or falling back to) a shrine ledge opens the cairn.
  openShrine(s) {
    if (!s || s.used || this.paused) return;
    this.shrineOpen = s;
    this.climber.stopFidget && this.climber.stopFidget();
    const offer = this.shrineOffer(s);
    this.openOverlay('Shrine', {
      returnTo: 'Climb',
      shrine: { index: s.band, biomeName: BIOMES[s.biome].name },
      offer,
      held: this.boons.held.slice(),
      rerollPrice: SHRINE.rerollPrice,
      canReroll: s.rerolls < 1,
      wallet: this.prog.infiniteGems ? Infinity : this.prog.gems,
      firstTime: !(this.prog.data.counters && this.prog.data.counters.shrines),
    });
  },

  shrineOffer(s) {
    return boonOffer(this.seed, s.band, { held: this.boons.held.concat(this.boons.phoenixUsed ? ['phoenix'] : []), reroll: s.rerolls, biome: s.biome });
  },

  // From the cairn: pay for new stones (null when you cannot).
  shrineReroll() {
    const s = this.shrineOpen;
    if (!s || s.rerolls >= 1 || !this.prog.spend(SHRINE.rerollPrice)) return null;
    s.rerolls++;
    this.hud.setGems(this.prog.gems, true);
    return this.shrineOffer(s);
  },

  // From the cairn: the gift taken (null: walked on).
  shrinePicked(id) {
    const s = this.shrineOpen;
    this.shrineOpen = null;
    this.shrinePending = null;
    if (!s) return;
    s.used = true;
    this.prog.bump('shrines');
    if (s.cairn) { this.effects.sparkle(s.cairn.x, s.cairn.y - 12, 10); this.effects.ring(s.cairn.x, s.cairn.y - 12, 0x9fd8ff, 24, 500); }
    if (!id) { this.hud.toast('YOU WALKED ON', COLORS.dim); return; }
    const before = activeSynergies(this.boons.held).map((x) => x.id);
    this.boons.held.push(id);
    this.boons.log.push(id);
    this.run.gifts = this.boons.held.slice();
    this.run.souvenirs = this.boons.held.filter(isSouvenir).length;
    const card = boonCard(id);
    this.prog.bump('gifts');
    if (isSouvenir(id)) this.prog.bump('souvenirs');
    if (card.group === 'legendary') this.prog.bump('legendaryGifts');
    this.noteBoonSeen(id);
    this.applyBoons();
    Audio.play('checkpoint');
    this.hud.toast(`GIFT: ${card.name}`, css(GROUPS[card.group].color));
    for (const syn of activeSynergies(this.boons.held)) {
      if (before.includes(syn.id)) continue;
      this.prog.bump('synergies');
      this.noteBoonSeen(`syn:${syn.id}`);
      this.hud.toast(`SYNERGY: ${syn.name}`, '#7cf0d8');
    }
    this.checkLogbook();
  },

  // The Collection's Boons chapter turns a card over the first time you take it.
  noteBoonSeen(id) {
    const d = this.prog.data;
    if (!Array.isArray(d.boonsSeen)) d.boonsSeen = [];
    if (!d.boonsSeen.includes(id)) { d.boonsSeen.push(id); this.prog.save(); }
  },

  // Recomputes every number the boons change and pushes it where it is used.
  applyBoons() {
    const held = this.boons ? this.boons.held : [];
    const fx = boonEffects(held);
    this.bfx = fx;
    const g = this.grip;
    g.max = fx.maxGrip;
    if (g.value > g.max) g.set(g.max);
    g.graceSec = fx.hangGraceSec;
    g.looseMul = fx.looseMissMultiplier;
    g.goodFactor = fx.goodCostFactor;
    g.noFlawless = fx.noFlawlessBonus;
    if (this.mechanics) this.mechanics.carried = new Set(held.filter(isSouvenir).map(souvenirBiome));
    this.hud.setBoons(held.map((id) => ({ icon: boonIconKey(id), color: GROUPS[boonCard(id).group].color })));
    if (fx.songbird && !this.songbird) {
      this.songbird = this.add.sprite(this.climber.x, this.climber.y, 'songbird_0').setDepth(DEPTH.climber + 2);
      this.songbird.sing = 0;
    } else if (!fx.songbird && this.songbird) { this.songbird.destroy(); this.songbird = null; }
  },

  // What the note track needs to know (ComboPrompt asks).
  boonView() {
    const fx = this.bfx || NO_FX;
    const night = this.dayNight.state().night > 0.5;
    return { minAlpha: fx.minNoteAlpha, lateReveal: fx.songbird && !(fx.nightOwl && night) ? fx.lateReveal : 1 };
  },

  // ---------------------------------------------------------------- routes
  // Gifts that change what is offered: no safe routes, cheaper risky ones,
  // thermals everywhere, more gusts, and the wild fourth route.
  boonRoutes(node) {
    const fx = this.bfx;
    if (!this.boons || fx === NO_FX) return;
    if (fx.noSafe && this.routes.some((r) => r.type !== 'safe')) this.routes = this.routes.filter((r) => r.type !== 'safe');
    if (fx.riskyCostScale !== 1) this.routes.forEach((r) => { if (r.type === 'risky') r.gripCost *= fx.riskyCostScale; });
    const h = levelToMeters(node.level);
    if (fx.thermalsEverywhere && !this.routes.some((r) => r.thermal)) addThermal(this.routes, this.mountain, this.runRng, { ...THERMALS, chance: THERMALS.chance * fx.thermalsEverywhere });
    if (fx.gustScale > 1) {
      const extra = difficultyAt(h, this.thinAir ? this.modeCfg : this.mode).gust * (fx.gustScale - 1) * 0.6;
      for (const r of this.routes) {
        if (r.notes.length < 3 || r.notes.some((n) => n.gust) || !this.runRng.chance(extra)) continue;
        const i = this.runRng.int(1, r.notes.length - 2);
        if ([r.notes[i], r.notes[i + 1]].some((n) => n.hold || n.still || n.roll || n.chord)) continue;
        r.notes = r.notes.map((n, k) => (k === i || k === i + 1 ? { ...n, gust: true } : n));
        r.tags = [...(r.tags || []), 'GUST'];
      }
    }
    if (fx.wildRoute) this.addWildRoute(node);
  },

  // WILD ROUTE: a fourth route that climbs twice as high as the risky one.
  addWildRoute(node) {
    const base = this.routes.find((r) => r.type === 'risky' && !r.toLedge);
    if (!base) return;
    const span = (base.target.level - node.level) * 2;
    if (this.mountain.nextLedgeAbove(node.level, span) !== null) return;
    this.mountain.ensureLevel(node.level + span);
    const lv = this.mountain.getLevel(node.level + span);
    const to = lv && lv.nodes.filter((n) => n.kind !== 'ledge' && Math.abs(n.x - node.x) <= 150).sort((a, b) => Math.abs(a.x - base.target.x) - Math.abs(b.x - base.target.x))[0];
    if (!to) return;
    this.routes.push({ ...base, type: 'wild', label: 'WILD', target: to, heightGain: base.heightGain * 2, wild: true, difficulty: 3, thermal: null, gem: null, notes: base.notes.map((n) => ({ ...n, thermal: false })), tags: [...(base.tags || []), 'WILD'] });
  },

  // CARTOGRAPHER: faint rings where the chosen route's next routes would lead.
  drawPreview() {
    const g = this.previewG;
    if (!g) return;
    g.clear();
    if (!this.bfx.preview || this.state !== 'ROUTE_SELECT') return;
    const r = this.routes[this.selected];
    if (!r || r.target.kind === 'ledge') return;
    const next = this.mountain.computeRoutes(r.target, { forgiving: this.forgiving });
    const color = this.routeUI.colorOf(r);
    for (const n of next) {
      const t = n.target;
      const steps = 8;
      for (let k = 1; k < steps; k += 1) {
        const x = r.target.x + ((t.x - r.target.x) * k) / steps, y = r.target.y + ((t.y - r.target.y) * k) / steps;
        g.fillStyle(color, 0.35).fillRect(Math.round(x), Math.round(y), 1, 1);
      }
      g.lineStyle(1, color, 0.45).strokeCircle(t.x, t.y + 3, 5);
    }
  },

  // ---------------------------------------------------------------- climbing
  // ↓ on a hold: BRAM'S FLASK, once per biome.
  drinkFlask() {
    const fx = this.bfx;
    if (!fx.flask || this.node.kind === 'ledge') return false;
    const stretch = biomeStretchAt(levelToMeters(this.node.level));
    if (this.boons.flaskUsed[stretch]) { this.floatText('THE FLASK IS EMPTY HERE', COLORS.dim, 10); return true; }
    this.boons.flaskUsed[stretch] = true;
    const gain = fx.flask === 'full' ? this.grip.max - this.grip.value : 30;
    this.grip.change(gain);
    Audio.play('flask');
    this.effects.sparkle(this.climber.x, this.climber.y - 8, 10);
    this.effects.ring(this.climber.x, this.climber.y - 8, 0xd84a3a, 18, 400);
    this.floatText(`BRAM'S FLASK +${Math.round(gain)} GRIP`, '#ff9a7a', 14, true);
    return true;
  },

  // Extra grip a judged note costs or gives.
  boonNote(note, route) {
    const fx = this.bfx;
    if (fx === NO_FX) return;
    if (note.result === 'miss' && fx.missExtraCost) this.grip.change(-fx.missExtraCost);
    if (route.wild && note.result === 'miss') this.grip.change(-this.grip.noteCost(route, 'miss'));
    if (note.holdMs && fx.holdExtraCost) this.grip.change(-fx.holdExtraCost);
    const offbeat = note.gap != null && note.gap !== 1;
    if (offbeat && note.result === 'perfect' && fx.offbeatPerfectGrip) {
      this.grip.change(fx.offbeatPerfectGrip);
      this.floatText(`+${fx.offbeatPerfectGrip}`, '#8fd16a', -6);
    }
    if (note.thermal && note.result !== 'perfect' && fx.thermalMissCost) {
      this.grip.change(-fx.thermalMissCost);
      this.floatText(`THERMAL LOST -${fx.thermalMissCost}`, '#ffb45a', 22);
    }
  },

  // How far one perfect moves the streak (ECHO, ICE FINGERS on ice).
  streakStep(route) {
    const fx = this.bfx;
    return fx.streakPerPerfect * (route && route.hazard === 'icy' ? fx.icyStreak : 1);
  },

  // FEATHERWEIGHT: every 3rd clean climb in a row lifts you one hold higher.
  // thermal: this climb rode a thermal (TAILWIND counts it twice; the lift waits a climb).
  featherLift(route, s, thermal = false) {
    const fx = this.bfx;
    if (!fx.featherEvery || !this.boons) return null;
    if (s.miss > 0) { this.boons.cleanRow = 0; return null; }
    this.boons.cleanRow += thermal && fx.tailwind ? 2 : 1;
    if (thermal || this.boons.cleanRow < fx.featherEvery) return null;
    this.boons.cleanRow = 0;
    const t = route.target;
    if (t.kind === 'ledge' || this.mountain.nextLedgeAbove(t.level, 1) !== null) return null;
    this.mountain.ensureLevel(t.level + 1);
    const lv = this.mountain.getLevel(t.level + 1);
    const to = lv && lv.nodes.filter((n) => n.kind !== 'ledge' && Math.abs(n.x - t.x) <= 50).sort((a, b) => Math.abs(a.x - t.x) - Math.abs(b.x - t.x))[0];
    return to ? { to, gain: METERS_PER_LEVEL } : null;
  },

  // ---------------------------------------------------------------- gems
  boonGemScale(route = null) {
    const fx = this.bfx;
    return fx.gemScale * (fx.highRoller && route && route.type === 'risky' ? 2 : 1);
  },

  // HOARD SONG: every 10 in a streak drops a stone of this biome.
  hoardSong(prev, n) {
    if (!this.bfx.hoardSong || Math.floor(prev / 10) === Math.floor(n / 10)) return;
    const gem = gemForBiome(biomeAt(levelToMeters(this.node.level)).id);
    const value = Math.max(1, Math.round(gem.value * this.gemScale));
    this.prog.addGems(value, gem.id);
    this.run.gems += value;
    this.effects.sparkle(this.climber.x, this.climber.y - 14, 10);
    this.floatText(`HOARD SONG: ${gem.name} +${value}`, toCss(gem.color), 30, true);
    this.hud.setGems(this.prog.gems, true);
    Audio.play('gem', { value: gem.value });
  },

  // MAGPIE: a fall drops a quarter of this run's gems.
  magpieDrop() {
    const loss = this.bfx.fallGemLoss ? Math.floor(this.run.gems * this.bfx.fallGemLoss) : 0;
    if (loss <= 0) return;
    this.run.gems -= loss;
    if (!this.prog.infiniteGems) { this.prog.data.gems = Math.max(0, this.prog.data.gems - loss); this.prog.save(); }
    this.hud.setGems(this.prog.gems, true);
    this.effects.pebbleFall(this.climber.x, this.climber.y, 6, 0x6ad8ff);
    this.hud.toast(`THE MAGPIE DROPPED ${loss}◆`, '#6ad8ff');
  },

  // ---------------------------------------------------------------- saving a run
  // A second slip in a biome would end the run. SECOND ROPE catches it once
  // per three biomes; PHOENIX lifts you back once (and burns every other gift).
  boonRescue(stretch) {
    if (!this.boons) return null;
    const fx = this.bfx;
    if (fx.secondRope) {
      const from = Number(stretch.split('@')[1]) || 0;
      const group = Math.floor((stretchIndexAt(from) - this.boons.startIndex) / 3);
      if (!this.boons.ropeUsed[group]) {
        this.boons.ropeUsed[group] = true;
        this.floatText('SECOND ROPE!', '#ffd24a', 24, true);
        Audio.play('gear');
        this.hud.toast('THE SECOND ROPE GIVES YOU ONE MORE SLIP', '#ffd24a');
        return 'rope';
      }
    }
    if (fx.phoenix && !this.boons.phoenixUsed) {
      this.boons.phoenixUsed = true;
      const lost = this.boons.held.filter((id) => id !== 'phoenix');
      this.boons.held = [];
      this.applyBoons();
      this.prog.bump('phoenixRises');
      this.run.phoenix = true;
      Audio.play('phoenix');
      this.hud.flashScreen(0xff8a3c, 0.45, 600);
      for (let k = 0; k < 3; k++) this.time.delayedCall(k * 120, () => this.effects.ring(this.climber.x, this.climber.y, 0xffb45a, 30 + k * 12, 520));
      this.effects.sparkle(this.climber.x, this.climber.y, 24);
      this.floatText('PHOENIX!', '#ffb45a', 24, true);
      this.hud.toast(lost.length ? `PHOENIX BURNED ${lost.length} GIFT${lost.length > 1 ? 'S' : ''}` : 'THE PHOENIX RISES', '#ffb45a');
      return 'phoenix';
    }
    return null;
  },

  // ---------------------------------------------------------------- life
  // The songbird rides on the climber's pack and sings one beat before each arrow.
  updateSongbird(now) {
    const b = this.songbird;
    if (!b) return;
    b.setPosition(Math.round(this.climber.x - 6), Math.round(this.climber.y - 21 + (Math.floor(now / 400) % 2)));
    b.setVisible(this.climber.sprite.visible);
    if (b.sing > now) b.setTexture('songbird_1'); else b.setTexture('songbird_0');
    const c = this.combo;
    if (!c || this.state !== 'CLIMBING_COMBO') return;
    for (const n of c.notes) {
      if (n.chirped || n.result || n.still) continue;
      if (now >= n.time - c.beatMs) {
        n.chirped = true;
        Audio.play('songbird', { dir: n.mirror ? ({ L: 'R', R: 'L', U: 'U' }[n.dir]) : n.dir });
        b.sing = now + 140;
      }
    }
  },

  // Nights last longer with CAT'S EYES.
  dayStep(dt) {
    const fx = this.bfx || NO_FX;
    return fx.nightScale > 1 && this.dayNight.state().night > 0.5 ? dt / fx.nightScale : dt;
  },

  // For the run summary and the share line.
  boonSummary() {
    if (!this.boons || !this.boons.log.length) return null;
    return { held: this.boons.held.slice(), log: this.boons.log.slice(), synergies: activeSynergies(this.boons.held).map((s) => s.name), phoenix: !!this.run.phoenix };
  },
};

