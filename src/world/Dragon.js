import { DEPTH, GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';
import { lerpColor } from '../utils/color.js';
import {
  buildDragonTextures, dirIndex, SEG_RADII, HEAD_W, HEAD_H, HEAD_NECK, HEAD_EYE, HEAD_MOUTH,
  WING_W, WING_H, WING_SHOULDER, WING_FLAP, CLAW_W, CLAW_H, CLAW_EDGE,
} from '../render/dragonArt.js';

// The dragon of the Dragon's Spine, coiled around the peak behind the wall.
// On the side with the most open sky its long neck rises from behind the rock
// and its head rests low on the clouds, asleep: it breathes, smoke curls from
// its nose, the lava cracks in its scales smoulder. A wing and, across the
// wall, its tail move slowly. When it wakes (DragonEye mechanic) the head rears
// up, the wing spreads and beats, a clawed hand hooks over the edge of the
// wall, and the eye follows the climber. While it watches it snarls, spits
// fireballs into the sky, and draws breath (inhale) to breathe fire at you
// (breathe).
//
// Everything but the claw and the flames is screen space, behind the wall.
const D = DEPTH.bgWeather + 1;
const NECK = 36;
const TAIL = 26;
const ARM = 30;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const bez = (p, t) => {
  const u = 1 - t;
  return [
    u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0],
    u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1],
  ];
};
const nearR = (r) => SEG_RADII.reduce((a, b) => (Math.abs(b - r) < Math.abs(a - r) ? b : a));
const segKey = (r) => `dragon_seg_${nearR(r)}`;
const glowKey = (r) => `dragon_segglow_${nearR(r)}`;
const bellyKey = (r, lined) => `dragon_${lined ? 'bellyl' : 'belly'}_${nearR(r)}`;
const outlineKey = (r) => `dragon_segol_${nearR(r)}`;
const EMBER = 0xff6a1a;

export class Dragon {
  constructor(scene) {
    this.scene = scene;
    buildDragonTextures(scene);
    const img = (key, depth) => scene.add.image(0, 0, key).setScrollFactor(0).setDepth(depth).setVisible(false);
    const glow = (key, depth) => img(key, depth).setBlendMode('ADD').setTint(EMBER);
    this.wing = img('dragon_wing_0', D - 1);
    this.spines = Array.from({ length: NECK }, (_, i) => img('dragon_spine_0', D - 0.5 + i * 0.001));
    this.neckLine = Array.from({ length: NECK }, () => img('dragon_segol_10', D - 0.2));
    this.neck = Array.from({ length: NECK }, (_, i) => img('dragon_seg_10', D + i * 0.01));
    this.neckGlow = Array.from({ length: NECK }, (_, i) => glow('dragon_segglow_10', D + i * 0.01 + 0.004));
    this.bellies = Array.from({ length: NECK }, (_, i) => img('dragon_belly_10', D + i * 0.01 + 0.006));
    this.head = img('dragon_head_0', D + 1);
    this.headGlow = glow('dragon_head_glow_0', D + 1.01);
    // The arm reaches from low on the body to a claw hooked over the wall's edge.
    this.armLine = Array.from({ length: ARM }, () => img('dragon_segol_6', D - 0.3));
    this.arm = Array.from({ length: ARM }, (_, i) => img('dragon_seg_6', D - 0.25 + i * 0.001));
    this.claw = scene.add.image(0, 0, 'dragon_claw_0').setScrollFactor(0).setDepth(DEPTH.wall + 2).setVisible(false);
    this.clawGlow = scene.add.image(0, 0, 'dragon_claw_glow_0').setScrollFactor(0).setDepth(DEPTH.wall + 2.1).setBlendMode('ADD').setTint(EMBER).setVisible(false);
    this.tailLine = Array.from({ length: TAIL }, () => img('dragon_segol_6', D - 2.2));
    this.tail = Array.from({ length: TAIL }, (_, i) => img('dragon_seg_6', D - 2 + i * 0.01));
    this.tailGlow = Array.from({ length: TAIL }, (_, i) => glow('dragon_segglow_6', D - 2 + i * 0.01 + 0.004));
    this.tailSpines = Array.from({ length: TAIL }, (_, i) => img('dragon_spine_0', D - 2.5 + i * 0.001));
    this.tip = img('dragon_tip_0', D - 1.8);
    this.eye = scene.add.graphics().setScrollFactor(0).setDepth(D + 1.1).setVisible(false);
    this.eyeGlow = img('glow_small', D + 1.2).setBlendMode('ADD').setTint(0xffc040);
    this.mouthGlow = img('glow', D + 1.05).setBlendMode('ADD').setTint(0xff6a20);
    this.smoke = [];
    this.motes = [];
    this.body = [this.wing, ...this.spines, ...this.neckLine, ...this.neck, ...this.neckGlow, ...this.bellies, this.head, this.headGlow,
      ...this.tailLine, ...this.tail, ...this.tailGlow, ...this.tailSpines, this.tip];
    this.limb = [...this.armLine, ...this.arm, this.claw, this.clawGlow];
    this.t = 0;
    this.raise = 0;
    this.lunge = 0;
    this.pull = 0;
    this.roarUntil = 0;
    this.inhaleFrom = 0;
    this.inhaleUntil = 0;
    this.blinkAt = 3000;
    this.smokeIn = 1500;
    this.side = null;
    this.visible = false;
    this.clawIn = 0;
  }

  // weight: how much of the Dragon's Spine is on screen (0..1); phase/open from
  // the DragonEye mechanic; bounds: wall { l, r } in screen x at mid height;
  // clawBounds: the wall at the claw's height; climber: climber position on
  // screen; light: the day light colour.
  update(dt, { weight, phase, open, bounds, clawBounds, climber, light }) {
    const show = weight > 0.05;
    if (show !== this.visible) {
      this.visible = show;
      [...this.body, this.eye].forEach((o) => o.setVisible(show));
      if (!show) {
        [...this.limb, this.eyeGlow, this.mouthGlow].forEach((o) => o.setVisible(false));
        [...this.smoke, ...this.motes].forEach((s) => s.destroy());
        this.smoke = []; this.motes = [];
      }
    }
    if (!show) return;
    this.t += dt;
    const t = this.t / 1000;
    const alpha = Math.min(1, weight * 1.4);

    // The head lives on the side with the most open sky (decided while it
    // sleeps, so it never jumps across while you watch).
    const freeL = bounds.l, freeR = GAME_WIDTH - bounds.r;
    if (this.side === null || (phase === 'sleep' && this.raise < 0.05)) this.side = freeL >= freeR ? -1 : 1;
    const side = this.side, dir = -side;
    const edge = side < 0 ? bounds.l : bounds.r;
    const free = side < 0 ? freeL : freeR;
    const freeX = side < 0 ? edge / 2 : (edge + GAME_WIDTH) / 2;

    // Rear up with the eye: up while it opens and watches, down as it closes.
    const awake = phase === 'opening' || phase === 'watching';
    this.raise += ((awake ? 1 : 0) - this.raise) * Math.min(1, dt / (awake ? 1500 : 1200));
    const r = ease(this.raise);
    const watching = phase === 'watching';
    const inhaling = this.t < this.inhaleUntil;
    const inhaleK = inhaling ? (this.t - this.inhaleFrom) / Math.max(1, this.inhaleUntil - this.inhaleFrom) : 0;
    // Drawing breath pulls the head back and up; the breath throws it forward.
    this.pull += ((inhaling ? ease(inhaleK) : 0) - this.pull) * Math.min(1, dt / 120);

    // Head position (its neck joint): breathing, a restless sway while it
    // watches, leaning towards the climber, the pull and the lunge.
    // Asleep it breathes slow and deep (about every 5 s); awake, quick and shallow.
    const breath = Math.sin(t * 1.25);
    const deep = 1 - r;
    const hx0 = freeX - dir * Math.min(30, free * 0.25);
    const sleepPos = [hx0, GAME_HEIGHT - 44];
    const lean = watching ? Math.max(-14, Math.min(18, (climber.y - 90) * 0.12)) : 0;
    const watchPos = [hx0 - dir * 6, 66 + lean];
    let hx = lerp(sleepPos[0], watchPos[0], r) + dir * (this.lunge * 34 - this.pull * 16);
    let hy = lerp(sleepPos[1], watchPos[1], r) - this.pull * 10 + this.lunge * 8
      - breath * lerp(2, 1, r) + (Math.sin(t * 1.3) * 3 + Math.sin(t * 3.1) * 1) * r;
    hx += Math.sin(t * 0.9) * 3 * r;
    hx = Math.round(hx); hy = Math.round(hy);

    // Jaw: shut asleep; a snarl while it watches, now and then a gape; open as
    // it draws breath; roaring when it breathes or bellows.
    const roar = this.t < this.roarUntil;
    const gape = watching && (t % 2.8) > 2.1;
    const jaw = roar ? 3 : inhaling ? (inhaleK > 0.6 ? 2 : 1) : gape ? 2 : watching ? 1 : 0;
    const tint = lerpColor(light, 0xffffff, 0.45);
    // The lava in its cracks smoulders: brighter awake, flaring as it breathes in.
    const heat = 0.35 + 0.25 * Math.sin(t * 2.2) + r * 0.25 + (inhaling ? inhaleK * 0.6 : 0) + (roar ? 0.5 : 0);
    const flip = dir < 0;
    const ox = (x) => (flip ? 1 - x : x);
    // Asleep the head rests with its chin sunk into the clouds, nodding a
    // little with every breath; it lifts level as it rears up.
    const tilt = dir * (0.16 + breath * 0.03) * deep;
    this.head.setTexture(`dragon_head_${jaw}`).setFlipX(flip).setOrigin(ox(HEAD_NECK.x / HEAD_W), HEAD_NECK.y / HEAD_H).setPosition(hx, hy).setRotation(tilt).setTint(tint).setAlpha(alpha);
    this.headGlow.setTexture(`dragon_head_glow_${jaw}`).setFlipX(flip).setOrigin(ox(HEAD_NECK.x / HEAD_W), HEAD_NECK.y / HEAD_H).setPosition(hx, hy).setRotation(tilt).setAlpha(Math.min(1, heat) * alpha);
    const cosT = Math.cos(tilt), sinT = Math.sin(tilt);
    const local = (p) => {
      const dx = dir * (p.x - HEAD_NECK.x), dy = p.y - HEAD_NECK.y;
      return [hx + dx * cosT - dy * sinT, hy + dx * sinT + dy * cosT];
    };

    // Neck: from behind the wall, out into the sky, up to the back of the
    // head; a slow wave runs up it, faster and stronger when it is awake.
    const base = [edge + dir * 34, GAME_HEIGHT + 20];
    const ctrl = [
      base,
      [edge - dir * lerp(40, 30, r), lerp(GAME_HEIGHT * 0.85, GAME_HEIGHT * 0.8, r)],
      [hx - dir * lerp(34, 44, r), hy + lerp(26, 62, r)],
      [hx + dir * 2, hy + 4],
    ];
    const waveAmp = lerp(1.5, 4, r) + this.pull * 2;
    const waveSpeed = lerp(1.2, 2.6, r);
    for (let i = 0; i < NECK; i++) {
      const u = i / (NECK - 1);
      let [x, y] = bez(ctrl, u);
      const [x2, y2] = bez(ctrl, Math.min(1, u + 0.02));
      const [x1, y1] = bez(ctrl, Math.max(0, u - 0.02));
      let tx = x2 - x1, ty = y2 - y1;
      const len = Math.hypot(tx, ty) || 1;
      tx /= len; ty /= len;
      // The belly faces the wall (front), the spines face away and up.
      let nx = -ty, ny = tx;
      if (nx * dir + ny * 0.3 < 0) { nx = -nx; ny = -ny; }
      const wave = Math.sin(u * Math.PI * 2.2 - t * waveSpeed) * waveAmp * Math.sin(u * Math.PI);
      x += nx * wave; y += ny * wave;
      // Each breath swells the body near the shoulders most.
      const rad = lerp(13.5, 8, u) + Math.sin(u * Math.PI) * 1.5 + breath * lerp(0.4, 1, deep) * (1 - u * 0.6) + this.pull * Math.sin(u * Math.PI) * 1.2;
      const px = Math.round(x), py = Math.round(y + breath * u * 1.5);
      this.neck[i].setTexture(segKey(rad)).setPosition(px, py).setTint(tint).setAlpha(alpha);
      this.neckGlow[i].setTexture(glowKey(rad)).setPosition(px, py).setAlpha(Math.max(0, Math.min(1, heat * (0.6 + 0.4 * Math.sin(t * 3 - u * 6)))) * alpha);
      this.neckLine[i].setTexture(outlineKey(rad)).setPosition(px, py).setAlpha(alpha);
      this.bellies[i].setTexture(bellyKey(rad, i % 3 === 0)).setPosition(Math.round(px + nx * rad * 0.42), Math.round(py + ny * rad * 0.42)).setTint(tint).setAlpha(alpha);
      const sp = this.spines[i];
      sp.setVisible(i % 3 === 0 && i < NECK - 2);
      if (sp.visible) sp.setTexture(`dragon_spine_${dirIndex(Math.atan2(-ny, -nx))}`).setPosition(Math.round(px - nx * (rad + 2)), Math.round(py - ny * (rad + 2))).setTint(tint).setAlpha(alpha);
    }

    // Wing: from the shoulder; folded asleep, unfolding, then beating. It
    // beats harder as the dragon draws breath.
    const sh = bez(ctrl, 0.34);
    let frame = 0;
    if (phase === 'opening') frame = this.raise > 0.5 ? 2 : 1;
    else if (watching) frame = WING_FLAP[Math.floor(t / (inhaling ? 0.09 : 0.16)) % WING_FLAP.length];
    else if (this.raise > 0.3) frame = 1;
    // Folded (frame 0) it lies back along the body towards the wall, rising
    // and falling with the breath; spread, it reaches out into the sky.
    const folded = frame === 0;
    const wflip = folded ? !flip : flip;
    this.wing.setTexture(`dragon_wing_${frame}`).setFlipX(wflip)
      .setOrigin(wflip ? 1 - WING_SHOULDER.x / WING_W : WING_SHOULDER.x / WING_W, WING_SHOULDER.y / WING_H)
      .setPosition(Math.round(sh[0] - dir * (folded ? 2 : 8)), Math.round(sh[1] - (folded ? 4 + breath : 2))).setScale(1.15).setTint(tint).setAlpha(alpha);

    this.updateClaw(dt, side, dir, clawBounds || bounds, ctrl, r, inhaling, tint, alpha, heat);
    this.updateTail(t, side, bounds, watching, tint, alpha, heat);
    this.updateEye(dt, local(HEAD_EYE), dir, open, climber, alpha);

    // Fire in the mouth whenever the jaw is open, roaring as it breathes in.
    const throat = local({ x: 40, y: 34 });
    const mouthOn = jaw >= 2 || inhaling;
    this.mouthGlow.setVisible(mouthOn).setPosition(throat[0] + dir * 6, throat[1] + jaw * 2)
      .setScale(0.5 + (inhaling ? inhaleK * 0.7 : 0) + (jaw === 3 ? 0.5 : 0)).setAlpha((0.5 + Math.random() * 0.2) * alpha);
    // Asleep, a breath of smoke comes out each time the chest falls.
    const exhale = this.lastBreath !== undefined && this.lastBreath >= 0.98 && breath < 0.98 && r < 0.1;
    this.lastBreath = breath;
    this.updateSmoke(dt, local({ x: 73, y: 22 }), dir, watching, alpha, exhale);
    this.updateMotes(dt, local(HEAD_MOUTH), inhaling, alpha);
    this.mouthPos = local(HEAD_MOUTH);
  }

  // The clawed hand: an arm reaches from low on the body and the talons hook
  // over the wall's edge as the dragon rears up, digging in as it draws breath.
  updateClaw(dt, side, dir, cb, ctrl, r, inhaling, tint, alpha, heat) {
    const want = r > 0.55 ? 1 : 0;
    this.clawIn += (want - this.clawIn) * Math.min(1, dt / (want ? 500 : 350));
    const show = this.clawIn > 0.03;
    this.limb.forEach((o) => o.setVisible(show));
    if (!show) return;
    const k = ease(this.clawIn);
    const edge = side < 0 ? cb.l : cb.r;
    const cy = Math.round(GAME_HEIGHT * 0.44 + Math.sin(this.t / 900) * 1.5);
    // The talons hook just over the edge; the hand slides in from the sky.
    const cx = Math.round(edge + dir * 4 - dir * (1 - k) * 40);
    const grip = inhaling ? 1 : 0;
    const flip = dir < 0;
    const oxv = CLAW_EDGE.x / CLAW_W;
    this.claw.setTexture(`dragon_claw_${grip}`).setFlipX(flip).setOrigin(flip ? 1 - oxv : oxv, CLAW_EDGE.y / CLAW_H)
      .setPosition(cx, cy).setTint(tint).setAlpha(alpha * Math.min(1, k * 1.5));
    this.clawGlow.setTexture(`dragon_claw_glow_${grip}`).setFlipX(flip).setOrigin(this.claw.originX, this.claw.originY)
      .setPosition(cx, cy).setAlpha(Math.max(0, Math.min(1, heat)) * alpha * k);
    // The arm: from the shoulder on the neck, bending down at the elbow, to the wrist.
    const wrist = [cx - dir * (CLAW_EDGE.x - 6), cy + 6];
    const from = bez(ctrl, 0.42);
    const elbow = [lerp(from[0], wrist[0], 0.55) - dir * 4, Math.max(from[1], wrist[1]) + 16];
    for (let i = 0; i < ARM; i++) {
      const u = i / (ARM - 1);
      const a = [lerp(from[0], elbow[0], u), lerp(from[1], elbow[1], u)];
      const b = [lerp(elbow[0], wrist[0], u), lerp(elbow[1], wrist[1], u)];
      const x = Math.round(lerp(a[0], b[0], u)), y = Math.round(lerp(a[1], b[1], u));
      const rad = lerp(9, 6, u) + Math.sin(u * Math.PI) * 1.5;
      this.arm[i].setTexture(segKey(rad)).setPosition(x, y).setTint(tint).setAlpha(alpha);
      this.armLine[i].setTexture(outlineKey(rad)).setPosition(x, y).setAlpha(alpha);
    }
  }

  // The tail tip curls out from behind the far side of the wall and lashes.
  updateTail(t, side, bounds, watching, tint, alpha, heat) {
    const opp = -side;
    const edge = opp < 0 ? bounds.l : bounds.r;
    const room = opp < 0 ? bounds.l : GAME_WIDTH - bounds.r;
    const show = room > 26;
    [...this.tail, ...this.tailLine, ...this.tailGlow, ...this.tailSpines, this.tip].forEach((s) => s.setVisible(show));
    if (!show) return;
    const agit = watching ? 2.2 : 1;
    const reach = Math.min(70, room - 8);
    const ctrl = [
      [edge - opp * 26, GAME_HEIGHT * 0.78],
      [edge + opp * reach * 0.5, GAME_HEIGHT * 0.8 + Math.sin(t * 0.7) * 6],
      [edge + opp * reach + Math.sin(t * 0.6 * agit) * 8, GAME_HEIGHT * 0.58 + Math.sin(t * 0.9 * agit) * 12],
      [edge + opp * (reach * 0.7) + Math.sin(t * 1.1 * agit) * 10, GAME_HEIGHT * 0.45 + Math.cos(t * 0.8 * agit) * 10],
    ];
    let last = null, lastT = null;
    for (let i = 0; i < TAIL; i++) {
      const u = i / (TAIL - 1);
      const [x, y] = bez(ctrl, u);
      const [xn, yn] = bez(ctrl, Math.min(1, u + 0.03));
      const tx = xn - x, ty = yn - y;
      const rad = lerp(10, 3.5, u);
      const px = Math.round(x), py = Math.round(y);
      this.tail[i].setTexture(segKey(rad)).setPosition(px, py).setTint(tint).setAlpha(alpha);
      this.tailGlow[i].setTexture(glowKey(rad)).setPosition(px, py).setAlpha(Math.max(0, Math.min(1, heat * 0.8)) * alpha);
      this.tailLine[i].setTexture(outlineKey(rad)).setPosition(px, py).setAlpha(alpha);
      // Spines on the outer side of the curl.
      let nx = -ty, ny = tx;
      const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      if (ny > 0) { nx = -nx; ny = -ny; }
      const sp = this.tailSpines[i];
      sp.setVisible(i % 3 === 1 && u < 0.85);
      if (sp.visible) sp.setTexture(`dragon_spine_${dirIndex(Math.atan2(ny, nx))}`).setPosition(Math.round(x + nx * (rad + 1)), Math.round(y + ny * (rad + 1))).setTint(tint).setAlpha(alpha);
      last = [x, y]; lastT = [tx, ty];
    }
    this.tip.setTexture(`dragon_tip_${dirIndex(Math.atan2(lastT[1], lastT[0]))}`).setPosition(Math.round(last[0] + lastT[0] * 2), Math.round(last[1] + lastT[1] * 2)).setTint(tint).setAlpha(alpha);
  }

  // A golden eye with a slit pupil that follows the climber and a bloodshot
  // rim; it blinks now and then. Shut, a lid line with a glow seeping through.
  updateEye(dt, [ex, ey], dir, open, climber, alpha) {
    const g = this.eye;
    g.clear();
    g.setAlpha(alpha);
    ex = Math.round(ex); ey = Math.round(ey);
    if (open > 0.5 && this.t > this.blinkAt) {
      if (this.t > this.blinkAt + 140) this.blinkAt = this.t + 2500 + Math.random() * 3500;
      else open = 0.04;
    }
    const W = 5, H = 3.6;
    if (open < 0.05) {
      g.fillStyle(0xffb03c, 0.35 + 0.15 * Math.sin(this.t / 700)).fillRect(ex - W + 1, ey, 2 * W - 1, 1);
      g.fillStyle(0x16060a, 1);
      for (let x = -W; x <= W; x++) g.fillRect(ex + x, ey - 1 + Math.round((x / W) ** 2), 1, 1);
      this.eyeGlow.setVisible(false);
      return;
    }
    const lookX = Math.max(-2, Math.min(2, (climber.x - ex) / 40));
    const lookY = Math.max(-1, Math.min(1, (climber.y - ey) / 60));
    for (let x = -W; x <= W; x++) {
      const k = x / W;
      const hh = Math.round(H * Math.sqrt(Math.max(0, 1 - k * k)) * open);
      for (let y = -hh; y <= hh; y++) {
        const dx = x - lookX, dy = y - lookY;
        const rr = Math.hypot(dx * 0.8, dy) / H;
        let c = rr < 0.35 ? 0xfff6a0 : rr < 0.7 ? 0xffc030 : rr < 0.95 ? 0xe06a14 : 0xa02010;
        if (Math.abs(dx) < 0.9 && Math.abs(dy) < hh + 0.5) c = 0x0a0204;
        g.fillStyle(c, 1).fillRect(ex + x, ey + y, 1, 1);
      }
      // Heavy lid edges.
      g.fillStyle(0x0e0406, 1).fillRect(ex + x, ey - hh - 1, 1, 1);
    }
    g.fillStyle(0xffffff, 0.9).fillRect(ex - dir * 2, ey - 1, 1, 1);
    this.eyeGlow.setVisible(true).setPosition(ex, ey).setScale(1.1).setAlpha((0.45 + 0.15 * Math.sin(this.t / 250)) * open * alpha);
  }

  // Smoke curls from the nostril: lazy puffs asleep, sharper ones awake.
  // Asleep the puffs come with the breath (exhale) instead of on a timer.
  updateSmoke(dt, [nx, ny], dir, watching, alpha, exhale) {
    this.smokeIn -= dt;
    if ((exhale || (this.smokeIn <= 0 && watching)) && this.smoke.length < 12) {
      this.smokeIn = 900 + Math.random() * 900;
      for (let i = 0; i < 2; i++) {
        const p = this.scene.add.image(nx, ny, 'puff').setScrollFactor(0).setDepth(D + 0.9).setTint(watching ? 0x3a2626 : 0x4a3a3a).setAlpha(0).setScale(0.6);
        p.life = -i * 220; p.span = 2400 + Math.random() * 900; p.vx = dir * (0.006 + Math.random() * 0.006); p.vy = -0.012 - Math.random() * 0.006;
        this.smoke.push(p);
      }
    }
    this.smoke = this.smoke.filter((p) => {
      p.life += dt;
      if (p.life < 0) return true;
      const k = p.life / p.span;
      if (k >= 1) { p.destroy(); return false; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.setAlpha(Math.sin(k * Math.PI) * 0.5 * alpha).setScale(0.6 + k * 1.8);
      return true;
    });
  }

  // Drawing breath: embers from all around stream into the open jaws.
  updateMotes(dt, [mx, my], inhaling, alpha) {
    if (inhaling && this.motes.length < 40) {
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 60;
        const p = this.scene.add.image(mx + Math.cos(a) * d, my + Math.sin(a) * d, 'px2').setScrollFactor(0).setDepth(D + 1.3).setBlendMode('ADD')
          .setTint(Math.random() < 0.5 ? 0xffb040 : 0xff6a20).setScale(1 + Math.random());
        p.sx = p.x; p.sy = p.y; p.k = 0; p.speed = 0.0014 + Math.random() * 0.001;
        this.motes.push(p);
      }
    }
    this.motes = this.motes.filter((p) => {
      p.k += dt * p.speed;
      if (p.k >= 1) { p.destroy(); return false; }
      const e = p.k * p.k;
      p.setPosition(lerp(p.sx, mx, e), lerp(p.sy, my, e)).setAlpha((0.4 + p.k * 0.6) * alpha);
      return true;
    });
  }

  // Bellows (when it first fixes on you).
  roar(ms = 900) { this.roarUntil = this.t + ms; }

  // Draws breath for ms: head back, throat and cracks glowing, embers sucked in.
  inhale(ms) {
    this.inhaleFrom = this.t;
    this.inhaleUntil = this.t + ms;
  }

  // The breath: the head thrusts forward and a torrent of fire pours from the
  // jaws onto target (world space). cam: the main camera (screen -> world).
  breathe(target, cam, effects, { big = true } = {}) {
    this.inhaleUntil = 0;
    this.roar(big ? 900 : 600);
    const sc = this.scene;
    sc.tweens.killTweensOf(this);
    this.lunge = 0;
    sc.tweens.add({ targets: this, lunge: 1, duration: 140, ease: 'Quad.easeOut', yoyo: true, hold: big ? 520 : 300, onComplete: () => { this.lunge = 0; } });
    if (!this.mouthPos) return;
    const from = [this.mouthPos[0] + cam.scrollX, this.mouthPos[1] + cam.scrollY];
    this.fireStream(from, target, big ? 44 : 22, big ? 12 : 16, big ? 1.3 : 1, effects);
  }

  // Lunges at the climber with a short gout of fire (a quick snap).
  snap(target, cam, effects) { this.breathe(target, cam, effects, { big: false }); }

  // A stream of fireballs from `from` to `to` (world space): each swells and
  // cools from white-yellow to red as it flies; smoke rises where it lands.
  fireStream(from, to, count, every, size, effects) {
    const sc = this.scene;
    const hot = [0xfff4c0, 0xffd060, 0xff9a30, 0xff5a20, 0xc83010];
    for (let i = 0; i < count; i++) {
      sc.time.delayedCall(110 + i * every, () => {
        const spread = 10 + size * 8;
        const jx = (Math.random() - 0.5) * spread, jy = (Math.random() - 0.5) * spread;
        const f = sc.add.image(from[0], from[1], 'puff').setDepth(DEPTH.fx + 1).setBlendMode('ADD').setTint(hot[0]).setScale(0.8 * size);
        const st = { k: 0 };
        sc.tweens.add({
          targets: st, k: 1, duration: 280 + Math.random() * 140, ease: 'Quad.easeOut',
          onUpdate: () => {
            const k = st.k;
            f.setPosition(lerp(from[0], to.x + jx, k), lerp(from[1], to.y + jy, k) - Math.sin(k * Math.PI) * 12)
              .setScale((0.8 + k * 3.4) * size).setAlpha(1 - k * 0.7).setTint(hot[Math.min(4, Math.floor(k * 5))]);
          },
          onComplete: () => {
            f.destroy();
            if (Math.random() < 0.3) effects.flameBurst(to.x + jx, to.y + jy, 3);
          },
        });
      });
    }
    sc.time.delayedCall(110 + count * every + 200, () => {
      for (let i = 0; i < 6; i++) {
        const p = sc.add.image(to.x + (Math.random() - 0.5) * 22, to.y + (Math.random() - 0.5) * 12, 'puff').setDepth(DEPTH.fx).setTint(0x2a1e1e).setAlpha(0.6).setScale(1.5);
        sc.tweens.add({ targets: p, y: p.y - 26, scale: 3.8, alpha: 0, duration: 1200 + Math.random() * 500, onComplete: () => p.destroy() });
      }
    });
  }

  // Spits a fireball high into the sky or onto the rock (screen-space target):
  // it arcs, trails sparks and bursts.
  spit(target, cam, effects, onBurst) {
    if (!this.mouthPos) return;
    this.roar(350);
    const sc = this.scene;
    const from = [this.mouthPos[0], this.mouthPos[1]];
    const ball = sc.add.image(from[0], from[1], 'puff').setScrollFactor(0).setDepth(DEPTH.fx + 1).setBlendMode('ADD').setTint(0xffd060).setScale(1.6);
    const core = sc.add.image(from[0], from[1], 'glow_small').setScrollFactor(0).setDepth(DEPTH.fx + 1).setBlendMode('ADD').setTint(0xff7a20).setScale(1.4);
    const st = { k: 0 };
    const arc = 30 + Math.random() * 40;
    sc.tweens.add({
      targets: st, k: 1, duration: 520 + Math.random() * 200, ease: 'Sine.easeIn',
      onUpdate: () => {
        const k = st.k;
        const x = lerp(from[0], target[0], k), y = lerp(from[1], target[1], k) - Math.sin(k * Math.PI) * arc;
        ball.setPosition(x, y).setScale(1.6 + Math.sin(k * 30) * 0.2);
        core.setPosition(x, y);
        if (Math.random() < 0.5) effects.flameBurst(x + cam.scrollX, y + cam.scrollY, 1);
      },
      onComplete: () => {
        ball.destroy(); core.destroy();
        effects.flameBurst(target[0] + cam.scrollX, target[1] + cam.scrollY, 10);
        const flash = sc.add.image(target[0], target[1], 'glow').setScrollFactor(0).setDepth(DEPTH.fx + 1).setBlendMode('ADD').setTint(0xff8a30).setScale(0.6).setAlpha(0.9);
        sc.tweens.add({ targets: flash, scale: 1.6, alpha: 0, duration: 380, onComplete: () => flash.destroy() });
        if (onBurst) onBurst(target);
      },
    });
  }

  destroy() {
    [...this.body, ...this.limb, this.eye, this.eyeGlow, this.mouthGlow, ...this.smoke, ...this.motes].forEach((o) => o.destroy());
  }
}
