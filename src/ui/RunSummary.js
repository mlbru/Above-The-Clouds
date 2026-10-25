import { PixelText, COLORS, drawPanel } from './PixelText.js';
import { DEPTH, GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';
import { measureLine } from '../utils/pixelFont.js';
import { biomeAt } from '../data/biomes.js';
import { GEM_ORDER } from '../data/gems.js';
import { Audio } from '../systems/AudioSystem.js';
import { toCss } from '../utils/color.js';

const STRIP = { x: 50, w: GAME_WIDTH - 100, h: 7 };

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
//      caught, finds[], stones{}, gems, wallet, stamps[] }
// Optional (expedition summit): title, titleColor, recordLine, strandedLabel.
export class RunSummary {
  constructor(scene, s, { onAgain, onTitle }) {
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
    if (s.recordLine) text(W, 72, s.recordLine, COLORS.dim);
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
    const cw = 84, gap = 6, cx0 = Math.round(W - (cards.length * cw + (cards.length - 1) * gap) / 2), cy = 118 + oy;
    this.counters = cards.map((c, i) => {
      const x = cx0 + i * (cw + gap);
      drawPanel(g, x, cy, cw, 32, { alpha: 0.9 });
      const v = text(x + cw / 2, 122, `${c.prefix || ''}0`, c.color || COLORS.text, 2);
      text(x + cw / 2, 140, c.label, COLORS.faint);
      return { ...c, text: v };
    });

    // What you found on the way.
    let y = 158;
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
    text(W, y + 2, `WALLET ◆${s.wallet}`, '#9fe8ff');

    const fy = Math.max(y + 18, 222);
    const again = text(W - 70, fy, '[SPACE] CLIMB AGAIN', COLORS.green);
    const title = text(W + 70, fy, '[ESC] TITLE', COLORS.dim);
    again.setInteractive({ useHandCursor: true }).on('pointerdown', onAgain);
    title.setInteractive({ useHandCursor: true }).on('pointerdown', onTitle);

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
