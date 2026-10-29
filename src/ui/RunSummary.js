import { PixelText, COLORS, drawPanel } from './PixelText.js';
import { DEPTH, GAME_WIDTH, GAME_HEIGHT, IS_PORTRAIT, IS_TOUCH } from '../config/gameConfig.js';
import { measureLine } from '../utils/pixelFont.js';
import { biomeAt } from '../data/biomes.js';
import { GEM_ORDER, gemForBiome } from '../data/gems.js';
import { STARS } from '../data/mastery.js';
import { Audio } from '../systems/AudioSystem.js';
import { toCss } from '../utils/color.js';

const STRIP = { x: IS_PORTRAIT ? 20 : 50, w: GAME_WIDTH - (IS_PORTRAIT ? 40 : 100), h: 7 };
// Portrait: the stat cards wrap into rows of three.
const PER_ROW = IS_PORTRAIT ? 3 : 5;

// Cuts a list of names down to what fits on one line ("A, B +3").
function fitList(names, maxW) {
  let out = '';
  for (let i = 0; i < names.length; i++) {
    const rest = names.length - i - 1;
    const next = out ? `${out}, ${names[i]}` : names[i];
    const tail = rest ? ` +${rest}` : '';
    if (measureLine(next + tail) > maxW) return `${out} +${names.length - i}`;
    out = next;
  }
  return out;
}

// The end-of-run screen: how high you got, where on the mountain you were
// stranded, and what the run was worth. Numbers count up one after another.
// s: { modeLabel, reached, best, isRecord, reason, perfects, bestStreak,
//      caught, finds[], stones{}, gems, wallet, stamps[], mastery[] }
// Optional (expedition summit): title, titleColor, recordLine, strandedLabel.
export class RunSummary {
  constructor(scene, s, { onAgain, onTitle, onBoard = null, boardLabel = '[L] LEADERBOARD' }) {
    this.scene = scene;
    this.objs = [];
    const oy = Math.max(0, Math.round((GAME_HEIGHT - 270) / 2));
    const W = GAME_WIDTH / 2;
    const add = (o) => { o.setScrollFactor(0).setDepth(DEPTH.overlay + 1); this.objs.push(o); return o; };
    const text = (x, y, str, color, scale = 1, ox = 0.5) => add(new PixelText(scene, x, y + oy, str, { color }).setOrigin(ox, 0).setScale(scale));
    const biome = biomeAt(s.reached);

    add(scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a0c14, 1).setOrigin(0, 0));
    const g = add(scene.add.graphics());
    if (s.reason) text(W, 16, s.reason, COLORS.dim);
    text(W, 28, s.title || 'THE MOUNTAIN WINS', s.titleColor || COLORS.red, 2);
    const height = text(W, 48, '0 M', COLORS.text, 4);
    // A near miss says how close it was: "ONLY 12 M SHORT OF YOUR RECORD".
    const short = Math.ceil(s.best - s.reached);
    const close = !s.isRecord && s.best > 0 && short > 0 && short <= Math.max(15, s.best * 0.2);
    if (s.recordLine) text(W, 72, s.recordLine, COLORS.dim);
    else if (close) text(W, 72, `${s.modeLabel} RUN  •  ONLY ${short} M SHORT OF YOUR RECORD`, COLORS.gold);
    else text(W, 72, s.isRecord ? `${s.modeLabel} RUN  •  A NEW RECORD!` : `${s.modeLabel} RUN  •  RECORD ${Math.floor(s.best)} M`, s.isRecord ? COLORS.gold : COLORS.dim);

    // The mountain as a strip of biomes, with where you got stuck and your record.
    const top = s.stripTop || Math.max(1300, s.reached * 1.15, s.best * 1.05);
    const sy = 90 + oy;
    let prev = null, runStart = 0;
    for (let px = 0; px <= STRIP.w; px++) {
      const b = px < STRIP.w ? biomeAt((px / STRIP.w) * top) : null;
      if (prev && b !== prev) {
        g.fillStyle(prev.accentA, 0.85);
        g.fillRect(STRIP.x + runStart, sy, px - runStart, STRIP.h);
        g.fillStyle(prev.outline, 1);
        g.fillRect(STRIP.x + px - 1, sy, 1, STRIP.h);
        runStart = px;
      }
      prev = b;
    }
    g.lineStyle(1, 0x4a4560, 1).strokeRect(STRIP.x - 1, sy - 1, STRIP.w + 2, STRIP.h + 2);
    const xAt = (m) => STRIP.x + Math.round((Math.min(m, top) / top) * STRIP.w);
    if (s.best > 0) {
      const bx = xAt(s.best);
      g.fillStyle(0xf2c14e, 1).fillRect(bx, sy - 7, 1, STRIP.h + 7).fillRect(bx + 1, sy - 7, 4, 3);
    }
    this.marker = add(scene.add.image(STRIP.x, sy - 3, 'arrow_D').setTint(0xffffff));
    const mx = xAt(s.reached);
    scene.tweens.add({ targets: this.marker, x: mx, duration: 900, ease: 'Cubic.easeOut' });
    text(W, 102, s.strandedLabel || `STRANDED IN ${biome.name}`, toCss(biome.accentA));

    // Stat cards.
    const cards = [
      { label: 'PERFECTS', value: s.perfects },
      { label: 'BEST STREAK', value: s.bestStreak },
      { label: 'FINDS', value: s.finds.length + Object.values(s.stones).reduce((a, b) => a + b, 0) },
      { label: 'GEMS', value: s.gems, prefix: '+', color: '#9fe8ff' },
      { label: 'SLIPS CAUGHT', value: s.caught },
    ];
    const cw = 84, gap = 6;
    this.counters = cards.map((c, i) => {
      const row = Math.floor(i / PER_ROW), inRow = Math.min(PER_ROW, cards.length - row * PER_ROW);
      const x = Math.round(W - (inRow * cw + (inRow - 1) * gap) / 2) + (i % PER_ROW) * (cw + gap);
      const ry = row * 38;
      drawPanel(g, x, 118 + oy + ry, cw, 32, { alpha: 0.9 });
      const v = text(x + cw / 2, 122 + ry, `${c.prefix || ''}0`, c.color || COLORS.text, 2);
      text(x + cw / 2, 140 + ry, c.label, COLORS.faint);
      return { ...c, text: v };
    });

    // What you found on the way.
    let y = 158 + (Math.ceil(cards.length / PER_ROW) - 1) * 38;
    const stones = GEM_ORDER.filter((k) => s.stones[k]);
    if (stones.length) {
      let x = W - (stones.length * 26) / 2;
      for (const k of stones) {
        add(scene.add.image(x + 5, y + 4 + oy, `gem_${k}`));
        text(x + 12, y + 2, `X${s.stones[k]}`, COLORS.dim, 1, 0);
        x += 26;
      }
      y += 13;
    }
    if (s.finds.length) { text(W, y, `FOUND: ${fitList(s.finds, GAME_WIDTH - 60)}`, COLORS.blue); y += 10; }
    if (s.stamps.length) { text(W, y, `LOGBOOK: ${fitList(s.stamps.map((st) => st.name), GAME_WIDTH - 60)}`, COLORS.gold); y += 10; }
    // Mastery: how close this run came in its highest biomes.
    for (const m of s.mastery || []) {
      const stars = STARS.map((k) => (m.stars.includes(k) ? '★' : '☆')).join('');
      const done = m.stars.length >= STARS.length;
      const gem = gemForBiome(m.biome);
      const line = done ? `${stars} ${m.name} MASTERED`
        : `${stars} ${m.name}   STREAK ${Math.min(m.streak, m.goals.streak)}/${m.goals.streak}   ${gem.name} ${Math.min(m.gems, m.goals.gems)}/${m.goals.gems}`;
      text(W, y, line, done ? COLORS.gold : m.color);
      y += 10;
    }
    text(W, y + 2, `WALLET ◆${s.wallet}`, '#9fe8ff');

    const fy = Math.max(y + 18, 222);
    this.canOpenBoard = !!onBoard;
    // On a touch screen the buttons drop their key names; upright they stack.
    const key = (k, label) => (IS_TOUCH ? label : `[${k}] ${label}`);
    const buttons = [
      { label: key('SPACE', 'CLIMB AGAIN'), color: COLORS.green, go: onAgain },
      ...(onBoard ? [{ label: IS_TOUCH ? boardLabel.replace(/^\[L\] /, '') : boardLabel, color: COLORS.gold, go: onBoard }] : []),
      { label: key('ESC', 'TITLE'), color: COLORS.dim, go: onTitle },
    ];
    if (IS_PORTRAIT) {
      buttons.forEach((b, i) => text(W, fy + i * 20, b.label, b.color, 1).setInteractive({ useHandCursor: true }).on('pointerdown', b.go));
    } else {
      const gapX = 18;
      let bx = Math.round(W - (buttons.reduce((n, b) => n + measureLine(b.label), 0) + gapX * (buttons.length - 1)) / 2);
      for (const b of buttons) {
        text(bx, fy, b.label, b.color, 1, 0).setInteractive({ useHandCursor: true }).on('pointerdown', b.go);
        bx += measureLine(b.label) + gapX;
      }
    }

    // Count up: height first, then the cards in turn.
    const count = (obj, to, prefix, suffix, delay, dur) => {
      const st = { v: 0 };
      scene.tweens.add({
        targets: st, v: to, delay, duration: to ? dur : 1, ease: 'Cubic.easeOut',
        onUpdate: () => obj.setText(`${prefix}${Math.round(st.v)}${suffix}`),
        onComplete: () => { obj.setText(`${prefix}${to}${suffix}`); if (to) Audio.play('tick'); },
      });
    };
    count(height, Math.floor(s.reached), '', ' M', 150, 900);
    this.counters.forEach((c, i) => count(c.text, c.value, c.prefix || '', '', 700 + i * 160, 500));
  }

  destroy() { this.objs.forEach((o) => o.destroy()); this.objs = []; }
}
