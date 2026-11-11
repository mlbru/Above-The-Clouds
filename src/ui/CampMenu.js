import { GAME_WIDTH, GAME_HEIGHT, DEPTH, IS_PORTRAIT, IS_TOUCH } from '../config/gameConfig.js';
import { PixelText, COLORS } from './PixelText.js';
import { measureLine } from '../utils/pixelFont.js';
import { buildLogoTexture } from '../render/logoArt.js';
import { Audio } from '../systems/AudioSystem.js';
import { JOURNAL_CHAPTERS, journalProgress } from '../data/journal.js';
import { BIOMES } from '../data/biomes.js';
import { MASTERY_BIOMES, STARS } from '../data/mastery.js';

// Base camp as a menu, used by the title screen and by base camp during a
// run: the logo, one floating word over each spot at camp (the wall is CLIMB,
// the campfire COLLECTION, the signpost EXPEDITIONS, Bram the SHOP, the tent
// the WARDROBE, the lift station left of the wall the MAP), a bobbing arrow and a warm glow on the chosen one, and a
// gear in the corner. ← → choose, Space / ↑ go; the mouse works too.
//
// opts: {
//   camp: the camp ledge node; spots: the wall renderer's campSpots
//   actions: { climb, collection, expeditions, shop, wardrobe, dares, map } (omit to hide)
//   dares(): the badge under DARES (what is picked)
//   subtitle(): the line under the logo
//   mode(): { text, color } under CLIMB, or null; onDown(): ↓ on CLIMB
//   onGear(); onBoard() (the leaderboard trophy beside the gear, omit to hide)
// }
// Under MAP: the picked lift ticket, else your mastery stars.
function mapBadge(prog) {
  const lift = prog.data.lift;
  if (lift) return `LIFT: ${BIOMES[lift].name.replace(/^THE /, '')}`;
  const stars = MASTERY_BIOMES.reduce((n, id) => n + prog.stars(id).length, 0);
  return `★${stars}/${MASTERY_BIOMES.length * STARS.length}`;
}

export class CampMenu {
  constructor(scene, opts) {
    this.scene = scene;
    this.opts = opts;
    this.objs = [];
    this.spotId = 'climb';
    this.t = 0;
    this.visible = false;
  }

  show() {
    this.hide();
    const sc = this.scene, o = this.opts, prog = sc.registry.get('progression');
    const d = prog.data;
    const W = GAME_WIDTH / 2;
    const ui = (obj) => { obj.setScrollFactor(0).setDepth(DEPTH.hud); this.objs.push(obj); return obj; };
    const world = (obj) => { obj.setDepth(DEPTH.hud); this.objs.push(obj); return obj; };

    // In portrait the logo is smaller and sits below the touch buttons.
    const ly = IS_PORTRAIT ? 46 : 14;
    // The painted logo (render/logoArt.js) with a sparkle that twinkles across it.
    const logoScale = IS_PORTRAIT ? 2 : 3;
    const logoKey = buildLogoTexture(sc, `logo_title_${logoScale}`, 'ABOVE THE CLOUDS', logoScale);
    this.logo = ui(sc.add.image(W, ly - 4, logoKey).setOrigin(0.5, 0));
    this.logoTwinkle = ui(sc.add.image(W, ly, 'glow_small').setBlendMode('ADD').setTint(0xfff4c8).setScale(0.6).setAlpha(0));
    ui(new PixelText(sc, W, ly - 4 + this.logo.height + 1, o.subtitle(), { color: '#dfe8ff', shadow: '#2a2440' }).setOrigin(0.5, 0));

    // Bram's forecast: his face and one line at a time, typed out, under the
    // logo. A Golden City line shimmers gold with sparks around it.
    this.fc = null;
    if (o.forecast) {
      const lines = o.forecast().filter((l) => measureLine(l.text) + 30 <= GAME_WIDTH - 8);
      if (lines.length) {
        const fy = ly - 4 + this.logo.height + 13;
        this.fc = { lines, i: -1, t: 0, typed: -1, y: fy, blink: 0 };
        this.fcG = ui(sc.add.graphics());
        this.fcFace = ui(sc.add.sprite(0, fy + 8, 'bram_face', 0));
        this.fcText = ui(new PixelText(sc, 0, fy + 5, '', { color: '#f4efe4', shadow: '#16141f' }));
        this.nextForecast();
      }
    }

    // The gear in the top right corner.
    const gx = GAME_WIDTH - 16, gy = 16;
    const gear = ui(sc.add.graphics());
    gear.fillStyle(0x16141f, 0.6).fillCircle(gx, gy, 10);
    gear.fillStyle(0xf4efe4, 1).fillCircle(gx, gy, 5);
    for (let a = 0; a < 8; a++) gear.fillRect(Math.round(gx + Math.cos((a * Math.PI) / 4) * 6) - 1, Math.round(gy + Math.sin((a * Math.PI) / 4) * 6) - 1, 3, 3);
    gear.fillStyle(0x16141f, 1).fillCircle(gx, gy, 2);
    ui(sc.add.zone(gx - 11, gy - 11, 22, 22).setOrigin(0, 0).setInteractive({ useHandCursor: true })).on('pointerdown', () => o.onGear());

    if (o.onBoard) {
      const tx = gx - 26;
      const cup = ui(sc.add.graphics());
      cup.fillStyle(0x16141f, 0.6).fillCircle(tx, gy, 10);
      cup.fillStyle(0xf2c14e, 1).fillRect(tx - 4, gy - 5, 8, 6).fillRect(tx - 1, gy + 1, 2, 3).fillRect(tx - 3, gy + 4, 6, 1);
      cup.fillRect(tx - 6, gy - 4, 2, 3).fillRect(tx + 4, gy - 4, 2, 3);
      ui(sc.add.zone(tx - 11, gy - 11, 22, 22).setOrigin(0, 0).setInteractive({ useHandCursor: true })).on('pointerdown', () => o.onBoard());
    }

    // The spots.
    const sp = o.spots || {}, camp = o.camp, a = o.actions;
    const fresh = d.unlocked.filter((id) => prog.isNew(id)).length;
    const j = journalProgress(prog);
    const unseen = JOURNAL_CHAPTERS.reduce((n, c) => n + c.entries.filter((e) => e.known(prog) && !(d.journalSeen || []).includes(e.id)).length, 0);
    this.spots = [
      a.collection && sp.fire && { id: 'collection', label: 'COLLECTION', x: sp.fire.x, y: sp.fire.y - 20, badge: unseen ? `${unseen} NEW` : `${j.seen}/${j.total}`, badgeNew: !!unseen, go: a.collection },
      a.expeditions && sp.sign && { id: 'expeditions', label: 'EXPEDITIONS', x: sp.sign.x, y: sp.sign.y - 34, go: a.expeditions },
      a.climb && { id: 'climb', label: 'CLIMB', x: camp.x, y: camp.y - 62, go: a.climb, carved: true },
      // The mountain map (lift tickets and mastery): on the rock left of the climb.
      a.map && { id: 'map', label: 'MAP', x: camp.x - 62, y: camp.y - 96, badge: mapBadge(prog), badgeNew: false, go: a.map, carved: true },
      // Bram's dares: chalked on the rock beside the start of the climb.
      a.dares && { id: 'dares', label: 'DARES', x: camp.x + 62, y: camp.y - 96, badge: o.dares ? o.dares() : null, badgeNew: false, go: a.dares, carved: true },
      a.shop && sp.trader && { id: 'shop', label: 'SHOP', x: sp.trader.x, y: sp.trader.y - 40, badge: `◆${prog.gems}`, go: a.shop },
      a.wardrobe && sp.tent && { id: 'wardrobe', label: 'WARDROBE', x: sp.tent.x, y: sp.tent.y - 22, badge: fresh ? `${fresh} NEW` : null, badgeNew: !!fresh, go: a.wardrobe },
    ].filter(Boolean).sort((p, q) => p.x - q.x);
    this.spotObjs = this.spots.map((s, i) => {
      const label = world(new PixelText(sc, s.x, s.y, s.label, { color: '#ffffff', shadow: '#16141f' }).setOrigin(0.5, 1));
      const badge = s.badge ? world(new PixelText(sc, s.x, s.y + 1, s.badge, { color: s.badgeNew ? '#ff7ab8' : '#9fe8ff', shadow: '#16141f' }).setOrigin(0.5, 0)) : null;
      const zone = world(sc.add.zone(s.x - 24, s.y - 12, 48, 56).setOrigin(0, 0).setInteractive({ useHandCursor: true }));
      zone.on('pointerover', () => this.select(i));
      zone.on('pointerup', (p) => { if (p.getDistance() < 12) { this.select(i); this.activate(); } });
      return { label, badge };
    });
    this.arrow = world(sc.add.image(0, 0, 'arrow_s_D').setTint(0xf2c14e));
    this.glow = world(sc.add.image(0, 0, 'glow').setBlendMode('ADD').setTint(0xffd27a));
    this.glow.setDepth(DEPTH.decor - 1);
    this.modeText = world(new PixelText(sc, camp.x, camp.y - 60, '', { color: '#dfe8ff', shadow: '#16141f' }).setOrigin(0.5, 0));
    if (o.onDown) this.modeText.setInteractive({ useHandCursor: true }).on('pointerdown', () => o.onDown());
    ui(new PixelText(sc, W, GAME_HEIGHT - 12, IS_TOUCH ? 'TAP A PLACE, OR SWIPE ← → AND ↑' : '← → CHOOSE    SPACE GO', { color: '#dfe8ff', shadow: '#16141f' }).setOrigin(0.5, 0).setAlpha(0.7));
    const want = this.spots.findIndex((s) => s.id === this.spotId);
    this.select(want < 0 ? 0 : want, true);
    this.visible = true;
  }

  nextForecast() {
    const fc = this.fc;
    fc.i = (fc.i + 1) % fc.lines.length;
    fc.t = 0;
    fc.typed = -1;
    const line = fc.lines[fc.i];
    const w = measureLine(line.text);
    const x0 = Math.round(GAME_WIDTH / 2 - (w + 26) / 2);
    this.fcFace.setX(x0 + 9);
    this.fcText.setX(x0 + 26).setText('').setColor(line.gold ? '#ffe27a' : '#f4efe4').setAlpha(1);
    fc.x0 = x0; fc.w = w;
  }

  updateForecast(dt) {
    const fc = this.fc;
    if (!fc || !this.fcText.active) return;
    fc.t += dt;
    const line = fc.lines[fc.i];
    const n = Math.min(line.text.length, Math.floor(fc.t / 30));
    if (n !== fc.typed) {
      fc.typed = n;
      this.fcText.setText(line.text.slice(0, n));
      if (n > 0 && n < line.text.length && n % 3 === 0) Audio.play('tick', { volume: 0.15 });
    }
    // Bram blinks now and then and moves his mouth while he talks.
    fc.blink -= dt;
    const talking = n < line.text.length;
    this.fcFace.setFrame(fc.blink < 0 && fc.blink > -140 ? 1 : 0);
    if (fc.blink < -140) fc.blink = 2200 + Math.random() * 2400;
    const g = this.fcG.clear();
    // A little speech tail from his face to the words.
    const tx = fc.x0 + 20, ty = fc.y + 8;
    g.fillStyle(line.gold ? 0xffe27a : 0xf4efe4, 0.9).fillRect(tx, ty, 2, 1).fillRect(tx + 1, ty - 1, 1, 1).fillRect(tx + 1, ty + 1, 1, 1);
    if (talking) g.fillStyle(0x16141f, 1).fillRect(fc.x0 + 8, fc.y + 14 + (Math.floor(fc.t / 90) % 2), 3, 1);
    if (line.gold) {
      // The gold shimmers and a few sparks twinkle round it.
      this.fcText.setColor(['#ffe27a', '#fff6c8', '#ffd24a', '#fff1a0'][Math.floor(fc.t / 160) % 4]);
      for (let k = 0; k < 6; k++) {
        const a = Math.max(0, Math.sin(fc.t / 300 + k * 1.7));
        if (a < 0.3) continue;
        const sx = fc.x0 + 26 + ((k * 37) % Math.max(1, fc.w)), sy = fc.y + (k % 2 ? 1 : 13);
        g.fillStyle(0xfff6c8, a).fillRect(sx, sy, 1, 1);
        if (a > 0.85) g.fillStyle(0xffd24a, a * 0.6).fillRect(sx - 1, sy, 3, 1).fillRect(sx, sy - 1, 1, 3);
      }
    }
    // After a while the next line (if he has more than one to say).
    if (fc.lines.length > 1 && fc.t > line.text.length * 30 + 6500) {
      this.fcText.setAlpha(Math.max(0, 1 - (fc.t - line.text.length * 30 - 6500) / 300));
      if (fc.t > line.text.length * 30 + 6800) this.nextForecast();
    }
  }

  hide() {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    this.spots = null;
    this.visible = false;
  }

  setAlpha(v) { this.objs.forEach((o) => o.setAlpha(v)); }

  select(i, quiet = false) {
    if (!this.spots || !this.spots[i]) return;
    if (i !== this.spot && !quiet) Audio.play('ui');
    this.spot = i;
    this.spotId = this.spots[i].id;
    this.spotObjs.forEach((o, k) => {
      const sel = k === i;
      // Words on the rock are chiselled into it (dark letters with a lit lower
      // lip); the chosen one lights up in gold and lifts off the stone.
      // After dark the chiselled letters would vanish into the rock: they
      // catch the moonlight instead (pale stone with a dark shadow).
      const carved = this.spots[k].carved && !sel && !this.nightLabels;
      const moonlit = this.spots[k].carved && !sel && this.nightLabels;
      o.label.setScale(sel ? 2 : 1).setColor(sel ? COLORS.gold : carved ? '#23222c' : moonlit ? '#d4dcf2' : '#ffffff').setShadow(carved ? '#aeb2bf' : '#16141f')
        .setAlpha(sel ? 1 : carved ? 0.92 : 0.85).setDepth(DEPTH.hud + (sel ? 2 : 0));
      if (o.badge) o.badge.setDepth(DEPTH.hud + (sel ? 2 : 0));
    });
    const mode = this.spotId === 'climb' && this.opts.mode ? this.opts.mode() : null;
    this.modeText.setText(mode ? mode.text : '').setColor(mode ? mode.color : '#ffffff');
  }

  activate() {
    const s = this.spots && this.spots[this.spot];
    if (!s) return;
    Audio.play('select');
    s.go();
  }

  // Returns true when the key belonged to the camp menu.
  handleKey(code) {
    if (!this.spots) return false;
    if (code === 'KeyL' && this.opts.onBoard) { this.opts.onBoard(); return true; }
    switch (code) {
      case 'ArrowLeft': case 'KeyA': this.select(Math.max(0, this.spot - 1)); return true;
      case 'ArrowRight': case 'KeyD': this.select(Math.min(this.spots.length - 1, this.spot + 1)); return true;
      case 'ArrowDown': case 'KeyS': if (this.spotId === 'climb' && this.opts.onDown) this.opts.onDown(); return true;
      case 'ArrowUp': case 'KeyW': case 'Space': case 'Enter': this.activate(); return true;
      default: return false;
    }
  }

  update(dt, show = true) {
    this.t += dt;
    const s = this.spots && this.spots[this.spot];
    if (!s || !this.arrow.active) return;
    if (this.logo) {
      const ly = (IS_PORTRAIT ? 46 : 14) - 4;
      this.logo.y = ly + Math.round(Math.sin(this.t / 900));
      // A glint runs over the letters every few seconds.
      const cyc = (this.t % 5200) / 5200;
      if (this.logoTwinkle && this.logoTwinkle.active) {
        const on = cyc < 0.18 ? Math.sin((cyc / 0.18) * Math.PI) : 0;
        this.logoTwinkle.setPosition(this.logo.x - this.logo.width / 2 + 20 + (this.logo.width - 40) * (cyc / 0.18), this.logo.y + 8).setAlpha(on * 0.9).setScale(0.4 + on * 0.5);
      }
    }
    this.updateForecast(dt);
    const dn = this.scene.dayNight;
    const night = !!dn && dn.state().night > 0.4;
    if (night !== !!this.nightLabels) { this.nightLabels = night; this.select(this.spot, true); }
    const bob = Math.round(Math.abs(Math.sin(this.t / 240)) * 3);
    this.arrow.setPosition(s.x, s.y - 26 - bob).setVisible(show);
    this.glow.setPosition(s.x, s.y + 22).setAlpha(show ? 0.35 + 0.1 * Math.sin(this.t / 300) : 0);
  }
}
