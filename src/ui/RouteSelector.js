import { PixelText, COLORS, drawPanel } from './PixelText.js';
import { DEPTH, GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';
import { ROUTE_COLORS } from '../config/balanceConfig.js';
import { toCss } from '../utils/color.js';
import { THERMAL_TINT, ECHO_TINT } from './ComboPrompt.js';

const CARD_W = 104, CARD_H = 34;

// Shows the available routes on the rock (markers + dotted path) and as compact
// cards at the bottom of the screen.
export class RouteSelector {
  constructor(scene, onPick) {
    this.scene = scene;
    this.onPick = onPick;
    this.objects = [];
    this.routes = [];
    this.selected = 0;
    this.time = 0;
    this.path = scene.add.graphics().setDepth(DEPTH.routeMarks);
    this.cards = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud);
  }

  colorOf(route) { return route.toLedge ? ROUTE_COLORS.ledge : ROUTE_COLORS[route.type]; }

  show(routes, selected, from) {
    this.hide();
    this.routes = routes;
    this.selected = selected;
    this.from = from;
    const n = routes.length;
    const totalW = n * CARD_W + (n - 1) * 6;
    const x0 = Math.round(GAME_WIDTH / 2 - totalW / 2);
    routes.forEach((r, i) => {
      const color = this.colorOf(r);
      const ring = this.scene.add.image(r.target.x, r.target.y + 3, 'ring').setDepth(DEPTH.routeMarks).setTint(color);
      const num = new PixelText(this.scene, r.target.x, r.target.y - 18, `${i + 1}`, { color: toCss(color) }).setOrigin(0.5, 0).setDepth(DEPTH.routeMarks);
      ring.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.onPick(i, true));
      const cx = x0 + i * (CARD_W + 6);
      const cy = GAME_HEIGHT - CARD_H - 8;
      const head = new PixelText(this.scene, cx + 6, cy + 5, `${i + 1} ${r.label}`, { color: toCss(color) });
      const gain = new PixelText(this.scene, cx + 6, cy + 15, `↑${r.heightGain.toFixed(1)}M  GRIP -${Math.round(r.gripCost)}`, { color: COLORS.text });
      const HAZ = { icy: 'ICY: TIGHT TIMING', loose: 'LOOSE: MISSES HURT', crumbling: 'CRUMBLES: BE QUICK' };
      const tricks = (r.tags || []).join(' ');
      const crampons = r.hazard === 'icy' && this.scene.gear && this.scene.gear.crampons;
      const tag = crampons ? 'ICY: CRAMPONS ON' : r.hazard ? HAZ[r.hazard] : r.target.kind === 'jug' ? 'JUG: SHAKE OUT' : tricks ? `${r.inputs} ${tricks}` : r.toLedge ? 'REST AHEAD' : `${r.inputs} MOVES`;
      const tagColor = crampons ? COLORS.green : r.hazard ? COLORS.red : r.target.kind === 'jug' ? COLORS.green : tricks ? COLORS.blue : COLORS.dim;
      const sub = new PixelText(this.scene, cx + 6, cy + 24, tag, { color: tagColor });
      [head, gain, sub].forEach((t) => t.setScrollFactor(0).setDepth(DEPTH.hud + 1));
      const zone = this.scene.add.zone(cx, cy, CARD_W, CARD_H).setOrigin(0, 0).setScrollFactor(0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.onPick(i, true));
      zone.on('pointermove', () => { if (this.selected !== i) this.onPick(i, false); });
      const gem = r.gem ? this.scene.add.image(cx + CARD_W - 30, cy + 7, `gem_${r.gem.type}`).setScrollFactor(0).setDepth(DEPTH.hud + 1) : null;
      // Mechanic badges (thermal up-arrow, echo crystal) on the card and next to the target hold.
      const badge = r.thermal ? { key: 'arrow_s_U', tint: THERMAL_TINT } : r.echo ? { key: 'spark', tint: ECHO_TINT } : null;
      const thermal = badge ? [
        this.scene.add.image(cx + CARD_W - (r.gem ? 40 : 30), cy + 7, badge.key).setTint(badge.tint).setScrollFactor(0).setDepth(DEPTH.hud + 1),
        r.echo
          ? this.scene.add.image(r.target.x + 11, r.target.y + 2, 'decor_crystals').setOrigin(0.5, 1).setDepth(DEPTH.routeMarks)
          : this.scene.add.image(r.target.x + 9, r.target.y - 14, badge.key).setTint(badge.tint).setDepth(DEPTH.routeMarks),
      ] : [];
      this.objects.push({ ring, num, head, gain, sub, zone, cx, cy, route: r, gem, thermal });
    });
    const mods = routes[0] && routes[0].mods;
    const echoAt = routes.findIndex((r) => r.echo);
    const hint = mods ? mods.hint : echoAt >= 0 ? `ECHO CRYSTAL ON ROUTE ${echoAt + 1}: LISTEN, THEN PLAY IT BACK` : null;
    this.mods = hint ? { hint } : null;
    this.hint = new PixelText(this.scene, GAME_WIDTH / 2, GAME_HEIGHT - 8 - CARD_H - 13, hint || '← → CHOOSE    ↑ / SPACE CLIMB', { color: hint ? (mods ? COLORS.blue : '#b8fff4') : COLORS.faint }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH.hud);
    this.redraw();
  }

  setSelected(i) {
    this.selected = i;
    this.redraw();
  }

  redraw() {
    const g = this.cards;
    g.clear();
    // A biome mechanic's hint (whiteout) sits on a panel so it reads on bright snow.
    if (this.mods && this.hint) drawPanel(g, Math.round(this.hint.x - this.hint.width / 2) - 5, this.hint.y - 3, Math.round(this.hint.width) + 10, Math.round(this.hint.height) + 5, { alpha: 0.85 });
    this.objects.forEach((o, i) => {
      const sel = i === this.selected;
      const color = this.colorOf(o.route);
      const dy = sel ? -3 : 0;
      drawPanel(g, o.cx, o.cy + dy, CARD_W, CARD_H, { alpha: sel ? 0.92 : 0.7, highlight: sel ? color : null });
      // Difficulty pips
      for (let p = 0; p < 3; p++) {
        g.fillStyle(p < o.route.difficulty ? color : 0x3a3550, 1);
        g.fillRect(o.cx + CARD_W - 20 + p * 5, o.cy + 6 + dy, 3, 3);
      }
      [o.head, o.gain, o.sub].forEach((t, k) => t.setY(o.cy + [5, 15, 24][k] + dy).setAlpha(sel ? 1 : 0.75));
      if (o.gem) o.gem.setY(o.cy + 7 + dy);
      o.num.setAlpha(sel ? 1 : 0.6);
    });
  }

  update(dt, from) {
    this.time += dt;
    if (!this.objects.length) return;
    if (from) this.from = from;
    const g = this.path;
    g.clear();
    this.objects.forEach((o, i) => {
      const sel = i === this.selected;
      const pulse = sel ? 1 + 0.15 * Math.sin(this.time / 140) : 1;
      o.ring.setScale(Math.round(pulse * 4) / 4).setAlpha(sel ? 1 : 0.55);
      const color = this.colorOf(o.route);
      const fx = this.from.x, fy = this.from.y;
      const tx = o.route.target.x, ty = o.route.target.y;
      const dist = Math.hypot(tx - fx, ty - fy);
      const steps = Math.floor(dist / 5);
      const offset = (this.time / 60) % 5;
      g.fillStyle(color, sel ? 0.95 : 0.35);
      for (let s = 1; s < steps; s++) {
        const t = (s * 5 + (sel ? offset : 0)) / dist;
        if (t > 0.92) break;
        const bend = Math.sin(t * Math.PI) * 6 * Math.sign(tx - fx || 1);
        g.fillRect(Math.round(fx + (tx - fx) * t + bend * 0.3), Math.round(fy + (ty - fy) * t), sel ? 2 : 1, sel ? 2 : 1);
      }
    });
  }

  hide() {
    this.objects.forEach((o) => [o.ring, o.num, o.head, o.gain, o.sub, o.zone, o.gem, ...(o.thermal || [])].forEach((x) => x && x.destroy()));
    this.objects = [];
    if (this.hint) { this.hint.destroy(); this.hint = null; }
    this.cards.clear();
    this.path.clear();
  }

  destroy() { this.hide(); this.path.destroy(); this.cards.destroy(); }
}
