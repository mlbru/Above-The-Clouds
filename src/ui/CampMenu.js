import { GAME_WIDTH, GAME_HEIGHT, DEPTH, IS_PORTRAIT, IS_TOUCH } from '../config/gameConfig.js';
import { PixelText, COLORS } from './PixelText.js';
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
    this.logo = ui(new PixelText(sc, W, ly, 'ABOVE THE CLOUDS', { color: '#ffffff', shadow: '#2a2440' }).setOrigin(0.5, 0).setScale(IS_PORTRAIT ? 2 : 3));
    this.logo.setTint(0xffffff, 0xffffff, 0x9fd8ff, 0x9fd8ff);
    ui(new PixelText(sc, W, ly + (IS_PORTRAIT ? 18 : 24), o.subtitle(), { color: '#dfe8ff', shadow: '#2a2440' }).setOrigin(0.5, 0));

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
      a.climb && { id: 'climb', label: 'CLIMB', x: camp.x, y: camp.y - 62, go: a.climb },
      // The mountain map (lift tickets and mastery): on the rock left of the climb.
      a.map && { id: 'map', label: 'MAP', x: camp.x - 62, y: camp.y - 96, badge: mapBadge(prog), badgeNew: false, go: a.map },
      // Bram's dares: chalked on the rock beside the start of the climb.
      a.dares && { id: 'dares', label: 'DARES', x: camp.x + 62, y: camp.y - 96, badge: o.dares ? o.dares() : null, badgeNew: false, go: a.dares },
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
      o.label.setScale(sel ? 2 : 1).setColor(sel ? COLORS.gold : '#ffffff').setAlpha(sel ? 1 : 0.85).setDepth(DEPTH.hud + (sel ? 2 : 0));
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
    if (this.logo) this.logo.y = (IS_PORTRAIT ? 46 : 14) + Math.round(Math.sin(this.t / 900));
    const bob = Math.round(Math.abs(Math.sin(this.t / 240)) * 3);
    this.arrow.setPosition(s.x, s.y - 26 - bob).setVisible(show);
    this.glow.setPosition(s.x, s.y + 22).setAlpha(show ? 0.35 + 0.1 * Math.sin(this.t / 300) : 0);
  }
}
