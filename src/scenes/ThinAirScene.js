import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, IS_PORTRAIT, IS_TOUCH } from '../config/gameConfig.js';
import { PixelText, COLORS } from '../ui/PixelText.js';
import { measureLine } from '../utils/pixelFont.js';
import { THIN_AIR, TIER_RULES, thinAirTop } from '../data/thinAir.js';
import { frostTextures } from '../world/LensDrops.js';
import { Audio } from '../systems/AudioSystem.js';
import { SeededRandom } from '../utils/seededRandom.js';

// THIN AIR: Bram's old brass altimeter. ← → turn the bezel one tier at a time
// (OFF, then 1..10); the needle swings after it, trembling more the higher it
// points, and frost creeps over the glass and the screen. The tier's own rule
// is engraved on a plate beside it, the rules it stacks on are listed small.
// Space straps it on (and clears any dares). Launched over the title camp.
const BRASS = 0xc8963c, BRASS_D = 0x7a5420, BRASS_L = 0xf0d08a, ENAMEL = 0xf2ead6, INK = 0x2a2018;
const SWEEP = Math.PI * 1.6; // the dial's arc, from OFF (bottom left) to 10 (bottom right)
const BRAM = [
  'THE AIR UP THERE IS THIN ENOUGH. BUT IF YOU WANT IT THINNER...',
  'A LITTLE HUNGRIER. YOU WILL FEEL IT IN YOUR FOREARMS.',
  'THE BEAT GETS NARROW. KEEP YOUR EARS OPEN.',
  'THE MOUNTAIN STOPS BEING POLITE EARLY.',
  'EVERY MISS COSTS MORE. SO DO NOT MISS.',
  'COLD LEDGES. THEY NEVER QUITE WARM YOU UP.',
  'NOTHING IS FREE NOW. NOT EVEN A PERFECT.',
  'NO APPLAUSE UP HERE. JUST YOU AND THE WIND.',
  'THE ROCK CRUMBLES IF YOU LOOK AT IT.',
  'LONGER REACHES. YOUR SHOULDERS WILL WRITE ME LETTERS.',
  'YOUR HEART RACES. SO DOES THE MOUNTAIN. ELSA NEVER WENT THIS FAR.',
];

const wrap = (text, maxW) => {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (measureLine(next) > maxW && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines.join('\n');
};

export class ThinAirScene extends Phaser.Scene {
  constructor() { super('ThinAir'); }

  init(data) { this.returnTo = data.returnTo || 'Menu'; }

  create() {
    this.prog = this.registry.get('progression');
    this.top = thinAirTop(this.prog.data);
    this.tier = Math.min(this.prog.settings.thinAir | 0, this.top);
    this.shown = this.tier; // the bezel's angle, in tiers (eased)
    this.needle = this.tier; this.needleV = 0;
    this.t = 0;
    this.closing = false;
    // The scene object is reused: forget objects from the last visit.
    this.mark = null; this.btnText = null; this.engrave = null; this.wobble = 0; this.lockedFlash = 0; this.punch = 0;
    frostTextures(this);

    // A cold night sky, deep blue to black, with snow blowing across.
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x050814, 0.94).setOrigin(0, 0).setInteractive();
    const sky = this.add.graphics();
    for (let i = 0; i < 12; i++) sky.fillStyle(0x0e1834, 0.05 + i * 0.012).fillRect(0, (i * GAME_HEIGHT) / 12, GAME_WIDTH, GAME_HEIGHT / 12 + 1);
    this.snow = Array.from({ length: 46 }, (_, i) => ({ x: (i * 97.3) % GAME_WIDTH, y: (i * 53.1) % GAME_HEIGHT, v: 10 + (i % 5) * 6, s: i % 7 === 0 ? 2 : 1 }));
    this.snowG = this.add.graphics().setDepth(1);
    // The screen frosts over from the corners, more with every tier.
    this.frostImgs = [0, 1, 2, 3].map((i) => this.add.image(0, 0, `lens_frost_${i}`).setOrigin(0, 0).setDepth(6).setAlpha(0));

    // Layout: dial left and plate right, or dial on top when upright.
    const R = IS_PORTRAIT ? 52 : 58;
    this.R = R;
    if (IS_PORTRAIT) { this.cx = GAME_WIDTH / 2; this.cy = 74 + R; this.px = 14; this.py = this.cy + R + 18; this.pw = GAME_WIDTH - 28; }
    else {
      const y0 = Math.max(0, Math.floor((GAME_HEIGHT - 250) / 2));
      this.cx = 22 + R + 18; this.cy = y0 + 46 + R; this.px = this.cx + R + 34; this.py = y0 + 40; this.pw = GAME_WIDTH - this.px - 14;
    }
    this.dialG = this.add.graphics().setDepth(2);
    this.glassG = this.add.graphics().setDepth(3);
    this.numbers = [];
    this.title = new PixelText(this, IS_PORTRAIT ? GAME_WIDTH / 2 : this.px + this.pw / 2, IS_PORTRAIT ? 34 : this.py - 24, 'THIN AIR', { color: '#9fe8ff', shadow: '#0a1020' }).setOrigin(0.5, 0).setScale(2).setDepth(5);
    this.plate = this.add.graphics().setDepth(4);
    this.texts = [];
    this.face = this.add.sprite(0, 0, 'bram_face', 0).setDepth(5);
    this.bramText = new PixelText(this, 0, 0, '', { color: '#dfe8ff', shadow: '#0a1020' }).setDepth(5);
    this.hint = new PixelText(this, GAME_WIDTH / 2, GAME_HEIGHT - 12, IS_TOUCH ? 'TAP THE DIAL TO TURN IT  •  TAP STRAP ON' : '← → TURN   SPACE STRAP ON   ESC BACK', { color: '#6f7a98', shadow: '#0a1020' }).setOrigin(0.5, 0).setDepth(5);

    // Frost dots on the glass: each appears once the tier passes its value.
    const rng = new SeededRandom(907);
    this.frostDots = [];
    for (let i = 0; i < 520; i++) {
      const a = rng.next() * Math.PI * 2, d = Math.sqrt(rng.next()) * (R - 6);
      const edge = d / (R - 6);
      this.frostDots.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, at: (1 - edge) * 9 + 1 + rng.next() * 1.5, a: 0.35 + rng.next() * 0.5 });
    }

    // Touch: left half of the dial turns down, right half up.
    const z = this.add.zone(this.cx - R, this.cy - R, R * 2, R * 2).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(8);
    z.on('pointerdown', (p) => this.turn(p.x < this.cx ? -1 : 1));

    // The strap-on button under the plate.
    this.btnG = this.add.graphics().setDepth(4);
    this.btn = { w: 74, h: 16 };
    this.btnZone = this.add.zone(0, 0, this.btn.w, this.btn.h).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(8);
    this.btnZone.on('pointerdown', () => this.confirm());

    this.input.keyboard.on('keydown', this.onKey, this);
    this.events.once('shutdown', () => this.input.keyboard.off('keydown', this.onKey, this));

    // Entry: the dial drops in on its strap, the plate slides in.
    this.drop = 1;
    this.tweens.add({ targets: this, drop: 0, duration: 620, ease: 'Back.easeOut' });
    this.plateIn = 0;
    this.tweens.add({ targets: this, plateIn: 1, duration: 420, delay: 180, ease: 'Cubic.easeOut' });
    Audio.play('clank');
    this.renderPlate();
  }

  // ---------------------------------------------------------------- input
  onKey(e) {
    if (this.closing) return;
    switch (e.code) {
      case 'ArrowLeft': case 'KeyA': case 'ArrowDown': case 'KeyS': this.turn(-1); break;
      case 'ArrowRight': case 'KeyD': case 'ArrowUp': case 'KeyW': this.turn(1); break;
      case 'Space': case 'Enter': this.confirm(); break;
      case 'Escape': case 'Backspace': this.close(); break;
      default: break;
    }
  }

  turn(d) {
    if (this.closing) return;
    const next = this.tier + d;
    if (next < 0 || next > THIN_AIR.tiers) { this.wobble = 1; Audio.play('denied'); return; }
    if (next > this.top) {
      // Locked: the bezel clicks against its stop and Bram shakes his head.
      this.wobble = 1;
      this.lockedFlash = 1;
      Audio.play('denied');
      this.renderPlate(next);
      return;
    }
    this.tier = next;
    Audio.play('tick');
    Audio.play('clack');
    this.renderPlate();
  }

  confirm() {
    if (this.closing) return;
    this.closing = true;
    this.prog.setSetting('thinAir', this.tier);
    if (this.tier) this.prog.setSetting('dares', []);
    Audio.play(this.tier ? 'stamp' : 'cloth');
    if (this.tier) { this.cameras.main.flash(160, 160, 220, 255); this.punch = 1; }
    // Strapped on: the dial swings down out of view.
    this.tweens.add({ targets: this, drop: -1.4, duration: 520, delay: 380, ease: 'Back.easeIn', onComplete: () => this.close(true) });
  }

  close(done = false) {
    if (!done && this.closing) return;
    if (!done) Audio.play('cloth');
    this.scene.stop();
    this.scene.resume(this.returnTo);
  }

  // ---------------------------------------------------------------- the plate
  // What the chosen tier does, its record, and what opens the next one.
  // peek: a locked tier the player tried to turn to.
  renderPlate(peek = null) {
    this.texts.forEach((t) => t.destroy());
    this.texts = [];
    const add = (x, y, s, color, scale = 1, shadow = '#0a1020') => { const t = new PixelText(this, x, y, s, { color, shadow }).setScale(scale).setDepth(5); this.texts.push(t); return t; };
    const x = this.px + 8, w = this.pw - 16;
    let y = this.py + 8;
    const tier = this.tier;
    if (peek) {
      add(x, y, `THIN AIR ${peek}`, '#6f7a98', 2); y += 18;
      add(x, y, wrap(`LOCKED. REACH ${THIN_AIR.nextAt} M (THE CRYSTAL HEIGHTS) ON THIN AIR ${peek - 1} TO OPEN IT.`, w), '#f0a08a'); y += 26;
      add(x, y, wrap(`IT WILL ADD: ${TIER_RULES[peek - 1].text}`, w), '#a8b4d0');
      this.bram('NOT YET. THAT ONE YOU EARN ON THE MOUNTAIN.');
      this.plateH = 96;
      return;
    }
    if (!tier) {
      add(x, y, 'OFF', COLORS.green, 2); y += 18;
      add(x, y, wrap('PLAIN NORMAL. THE MOUNTAIN AS IT WAS MADE.', w), COLORS.text); y += 18;
      add(x, y, wrap(`TURN THE BEZEL TO MAKE EVERY RUN HARDER, ONE RULE AT A TIME. ${this.top} OF ${THIN_AIR.tiers} TIERS OPEN.`, w), '#a8b4d0'); y += 28;
    } else {
      const rule = TIER_RULES[tier - 1];
      add(x, y, `THIN AIR ${tier}`, '#9fe8ff', 2); y += 18;
      add(x, y, rule.short, '#f0d08a'); y += 11;
      // The new rule, engraved: dark letters on a brass strip.
      const lines = wrap(rule.text, w - 8);
      const eng = add(x + 4, y + 4, lines, '#2a2018', 1, null);
      this.engrave = { x, y, w, h: eng.height + 8 };
      y += eng.height + 14;
      if (tier > 1) {
        add(x, y, 'AND EVERYTHING BELOW:', '#6f7a98'); y += 10;
        const below = TIER_RULES.slice(0, tier - 1).map((r) => r.short).reverse().join('  •  ');
        const b = add(x, y, wrap(below, w), '#a8b4d0'); y += b.height + 6;
      }
      const best = Math.floor(this.prog.thinAirBestFor(tier));
      add(x, y, best ? `BEST ON THIS TIER: ${best} M` : 'NOT CLIMBED ON THIS TIER YET', best ? COLORS.gold : '#6f7a98'); y += 10;
      if (tier < THIN_AIR.tiers) add(x, y, tier < this.top ? `THIN AIR ${tier + 1} IS OPEN.` : `REACH ${THIN_AIR.nextAt} M TO OPEN THIN AIR ${tier + 1}.`, '#6f7a98');
      y += 12;
    }
    if (!tier) this.engrave = null;
    this.plateH = Math.max(96, y - this.py + 4);
    this.bram(BRAM[tier]);
    this.wobble = Math.max(this.wobble || 0, 0.4);
  }

  bram(text) {
    const maxW = IS_PORTRAIT ? GAME_WIDTH - 50 : GAME_WIDTH - 60;
    const lines = wrap(text, maxW);
    const y = GAME_HEIGHT - 30 - (lines.split('\n').length - 1) * 9;
    this.face.setPosition(IS_PORTRAIT ? 22 : 30, y + 4);
    this.bramText.setPosition(IS_PORTRAIT ? 36 : 44, y).setText(lines);
  }

  // ---------------------------------------------------------------- drawing
  update(time, delta) {
    this.t += delta;
    const dt = Math.min(delta, 50) / 1000;
    // The bezel eases to the tier; the needle chases it on a spring.
    this.shown += (this.tier - this.shown) * Math.min(1, dt * 12);
    this.needleV += ((this.tier - this.needle) * 90 - this.needleV * 9) * dt;
    this.needle += this.needleV * dt;
    this.wobble = Math.max(0, (this.wobble || 0) - dt * 2.5);
    this.lockedFlash = Math.max(0, (this.lockedFlash || 0) - dt * 2);
    this.punch = Math.max(0, (this.punch || 0) - dt * 3);
    const frost = this.shown / THIN_AIR.tiers;
    this.frostImgs.forEach((img, i) => img.setAlpha(Math.max(0, Math.min(1, frost * 4 - i)) * 0.7));

    // Snow, blowing harder at higher tiers.
    const sg = this.snowG.clear();
    for (const f of this.snow) {
      f.x += (f.v * (0.6 + frost * 1.8)) * dt; f.y += f.v * 0.5 * dt;
      if (f.x > GAME_WIDTH) f.x -= GAME_WIDTH;
      if (f.y > GAME_HEIGHT) f.y -= GAME_HEIGHT;
      sg.fillStyle(0xdfe8ff, 0.5).fillRect(Math.round(f.x), Math.round(f.y), f.s, 1);
    }

    this.drawDial(frost);
    this.drawPlate();
  }

  drawDial(frost) {
    const g = this.dialG.clear(), gl = this.glassG.clear();
    const R = this.R;
    const cx = Math.round(this.cx + Math.sin(this.t / 140) * this.wobble * 2);
    const cy = Math.round(this.cy - this.drop * (this.cy + R + 20));
    const s = 1 + this.punch * 0.06;
    // The strap it hangs from.
    g.fillStyle(0x5a3a22, 1).fillRect(cx - 4, 0, 8, Math.max(0, cy - R - 2));
    g.fillStyle(0x7a5232, 1).fillRect(cx - 3, 0, 2, Math.max(0, cy - R - 2));
    g.fillStyle(0xc8963c, 1).fillRect(cx - 5, cy - R - 8, 10, 4);
    // Brass case: dark rim, knurled bezel that turns with the tier, bright lip.
    const rot = -this.shown * (SWEEP / THIN_AIR.tiers);
    g.fillStyle(0x0a0806, 1).fillCircle(cx + 2, cy + 3, R * s + 4);
    g.fillStyle(BRASS_D, 1).fillCircle(cx, cy, R * s + 4);
    for (let k = 0; k < 48; k++) {
      const a = rot + (k / 48) * Math.PI * 2;
      g.fillStyle(k % 2 ? BRASS : BRASS_L, 1).fillRect(Math.round(cx + Math.cos(a) * (R * s + 2)) - 1, Math.round(cy + Math.sin(a) * (R * s + 2)) - 1, 2, 2);
    }
    g.fillStyle(BRASS, 1).fillCircle(cx, cy, R * s);
    g.fillStyle(BRASS_L, 1).fillCircle(cx - 1, cy - 1, R * s - 3);
    g.fillStyle(BRASS_D, 1).fillCircle(cx, cy, R * s - 4);
    // The enamel face.
    g.fillStyle(ENAMEL, 1).fillCircle(cx, cy, R * s - 6);
    g.fillStyle(0xe2d8bc, 1).fillCircle(cx + 2, cy + 3, R * s - 14);
    g.fillStyle(ENAMEL, 1).fillCircle(cx, cy, R * s - 16);
    // Tier marks: OFF bottom left round to 10 bottom right. Locked ones faded.
    const a0 = Math.PI / 2 + (Math.PI * 2 - SWEEP) / 2;
    for (let i = 0; i <= THIN_AIR.tiers * 2; i++) {
      const a = a0 + (i / (THIN_AIR.tiers * 2)) * SWEEP;
      const major = i % 2 === 0, n = i / 2;
      const locked = major && n > this.top;
      const r0 = R - 8, r1 = R - (major ? 15 : 11);
      for (let r = r1; r <= r0; r++) g.fillStyle(locked ? 0xb0a890 : n >= 7 && major ? 0xb02a1a : INK, 1).fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
    }
    // Numbers are pixel text: place them once.
    if (!this.numbers.length) {
      for (let n = 0; n <= THIN_AIR.tiers; n++) this.numbers.push(new PixelText(this, 0, 0, n ? String(n) : 'OFF', { color: '#2a2018', shadow: null }).setOrigin(0.5, 0.5).setDepth(2.5));
    }
    this.numbers.forEach((t, n) => {
      const a = a0 + (n / THIN_AIR.tiers) * SWEEP;
      const r = R - 23;
      t.setPosition(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r)).setAlpha(n > this.top ? 0.3 : 1).setColor(n === this.tier ? '#b02a1a' : '#2a2018');
    });
    // The maker's mark and the word on the face.
    if (!this.mark) this.mark = new PixelText(this, 0, 0, 'ELSA + BRAM', { color: '#8a7a5a', shadow: null }).setOrigin(0.5, 0).setDepth(2.5);
    this.mark.setPosition(cx, cy + 12);
    // The needle: trembles more the higher it points.
    const shake = (Math.sin(this.t / 23) * 0.5 + Math.sin(this.t / 37) * 0.5) * 0.006 * this.needle;
    const na = a0 + (this.needle / THIN_AIR.tiers) * SWEEP + shake;
    // It stops short of the numbers so the chosen one stays readable.
    for (let r = -8; r < R - 30; r++) {
      const w = r < 0 ? 2 : 1;
      g.fillStyle(r > R - 38 ? 0xd83a22 : 0x1a1410, 1).fillRect(Math.round(cx + Math.cos(na) * r) - (w > 1 ? 1 : 0), Math.round(cy + Math.sin(na) * r), w, w);
    }
    g.fillStyle(BRASS_D, 1).fillCircle(cx, cy, 4);
    g.fillStyle(BRASS_L, 1).fillCircle(cx - 1, cy - 1, 2);
    // Frost on the glass, growing in from the rim.
    for (const d of this.frostDots) {
      if (d.at > this.shown + 0.01) continue;
      gl.fillStyle(0xeef6ff, d.a * Math.min(1, (this.shown - d.at) * 2 + 0.3)).fillRect(Math.round(cx + d.x), Math.round(cy + d.y), 1, 1);
    }
    // The glass: a curved glint, and a red pulse when you hit a locked tier.
    for (let k = 0; k < 14; k++) {
      const a = -2.4 + k * 0.06;
      gl.fillStyle(0xffffff, 0.35 - k * 0.02).fillRect(Math.round(cx + Math.cos(a) * (R - 12)), Math.round(cy + Math.sin(a) * (R - 12)), 2, 1);
    }
    if (this.lockedFlash > 0) gl.fillStyle(0xf0644b, this.lockedFlash * 0.25).fillCircle(cx, cy, R - 6);
  }

  drawPlate() {
    const g = this.plate.clear();
    const k = this.plateIn;
    const x = Math.round(this.px + (1 - k) * 60), y = this.py, w = this.pw, h = this.plateH || 96;
    this.texts.forEach((t) => { if (t.baseX === undefined) t.baseX = t.x; t.setX(t.baseX + (x - this.px)).setAlpha(k); });
    // A dark slate with brass corners.
    g.fillStyle(0x0a1020, 0.85 * k).fillRect(x, y, w, h);
    g.fillStyle(0x9fe8ff, 0.35 * k).fillRect(x, y, w, 1).fillRect(x, y + h - 1, w, 1);
    g.fillStyle(BRASS, k);
    for (const [px, py] of [[x, y], [x + w - 3, y], [x, y + h - 3], [x + w - 3, y + h - 3]]) g.fillRect(px, py, 3, 3);
    if (this.engrave) {
      const e = this.engrave, ex = e.x + (x - this.px);
      g.fillStyle(BRASS_D, k).fillRect(ex, e.y, e.w, e.h);
      g.fillStyle(BRASS, k).fillRect(ex + 1, e.y + 1, e.w - 2, e.h - 2);
      g.fillStyle(BRASS_L, k).fillRect(ex + 1, e.y + 1, e.w - 2, 1);
    }
    // STRAP ON button under the plate.
    const bg = this.btnG.clear();
    const bx = x + w - this.btn.w, by = y + h + 6;
    this.btnZone.setPosition(bx, by);
    bg.fillStyle(BRASS_D, k).fillRect(bx, by, this.btn.w, this.btn.h);
    bg.fillStyle(this.tier ? 0x9fe8ff : BRASS, k).fillRect(bx + 1, by + 1, this.btn.w - 2, this.btn.h - 2);
    if (!this.btnText) this.btnText = new PixelText(this, 0, 0, '', { color: '#0a1020', shadow: null }).setOrigin(0.5, 0).setDepth(5);
    this.btnText.setText(this.tier ? 'STRAP IT ON' : 'CLIMB PLAIN').setPosition(bx + this.btn.w / 2, by + 5).setAlpha(k);
  }
}
