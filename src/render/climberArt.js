import { PixelGrid } from '../utils/pixelGrid.js';
import { darken, lighten } from '../utils/color.js';
import { findCosmetic } from '../data/cosmetics.js';

export const FRAME_W = 48;
export const FRAME_H = 56;
const OUTLINE = 0x16141f;

// Rear-view poses. Hands/feet are absolute frame coords; b = body offset.
// anchor = frame y that sits on the attach point (hands on a hold, or feet on a ledge).
export const POSES = {
  hang: { lh: [18, 5], rh: [30, 5], lf: [19, 52], rf: [30, 51], b: [0, 0], anchor: 5 },
  hang_b: { lh: [18, 5], rh: [30, 5], lf: [19, 52], rf: [30, 51], b: [0, 1], pb: 1, anchor: 5 },
  hang_tired: { lh: [18, 5], rh: [30, 5], lf: [18, 54], rf: [31, 53], b: [0, 3], pb: 1, head: 'down', anchor: 5 },
  reachL: { lh: [10, 0], rh: [30, 6], lf: [20, 52], rf: [29, 48], b: [-2, 1], anchor: 5 },
  reachR: { lh: [18, 6], rh: [38, 0], lf: [19, 48], rf: [28, 52], b: [2, 1], anchor: 5 },
  pull: { lh: [19, 9], rh: [29, 9], lf: [17, 45], rf: [31, 44], b: [0, -5], anchor: 5 },
  stepL: { lh: [18, 6], rh: [30, 6], lf: [14, 40], rf: [29, 52], b: [-1, 0], anchor: 5 },
  stepR: { lh: [18, 6], rh: [30, 6], lf: [19, 52], rf: [34, 40], b: [1, 0], anchor: 5 },
  grab: { lh: [17, 3], rh: [31, 3], lf: [20, 51], rf: [28, 51], b: [0, -1], anchor: 5 },
  perfectL: { lh: [13, 0], rh: [30, 8], lf: [22, 54], rf: [31, 45], b: [-1, -3], anchor: 5 },
  perfectR: { lh: [18, 8], rh: [35, 0], lf: [17, 45], rf: [26, 54], b: [1, -3], anchor: 5 },
  hesitate: { lh: [18, 6], rh: [30, 6], lf: [19, 52], rf: [34, 55], b: [2, 2], head: 'down', anchor: 5 },
  slip: { lh: [16, 0], rh: [32, 1], lf: [16, 54], rf: [33, 53], b: [0, 6], anchor: 5 },
  slip2: { lh: [17, 2], rh: [31, 0], lf: [19, 55], rf: [30, 52], b: [1, 5], head: 'down', anchor: 5 },
  fall: { lh: [8, 16], rh: [40, 12], lf: [13, 53], rf: [36, 50], b: [0, 4], anchor: 28 },
  fall2: { lh: [9, 12], rh: [39, 16], lf: [15, 54], rf: [34, 52], b: [0, 4], anchor: 28 },
  // In-betweens: halfway into a reach or a pull, so moves read as motion.
  reachL_mid: { lh: [14, 3], rh: [30, 6], lf: [20, 52], rf: [29, 50], b: [-1, 1], anchor: 5 },
  reachR_mid: { lh: [18, 6], rh: [34, 3], lf: [19, 50], rf: [28, 52], b: [1, 1], anchor: 5 },
  pull_mid: { lh: [18, 7], rh: [30, 7], lf: [18, 49], rf: [30, 48], b: [0, -2], anchor: 5 },
  // Topping out onto a ledge: elbows over the edge, then a knee up.
  mantle: { lh: [13, 30], rh: [35, 30], lf: [18, 50], rf: [31, 46], b: [0, 0], anchor: 30 },
  mantle2: { lh: [14, 36], rh: [34, 36], lf: [17, 53], rf: [31, 44], b: [0, 5], head: 'down', anchor: 36 },
  // Rockfall: brace and duck while the rock comes, then swing the body clear
  // on one hand (dodgeL swings left, dodgeR right).
  brace: { lh: [18, 5], rh: [30, 5], lf: [17, 47], rf: [31, 47], b: [0, 3], head: 'down', anchor: 5 },
  dodgeL: { lh: [5, 16], rh: [27, 4], lf: [7, 47], rf: [15, 53], b: [-9, 3], head: 'down', anchor: 5 },
  dodgeR: { lh: [21, 4], rh: [43, 16], lf: [33, 53], rf: [41, 47], b: [9, 3], head: 'down', anchor: 5 },
  // Falling: hands peel off the hold, then arms and legs flail (fall, fall2, fall3).
  fall_peel: { lh: [12, 3], rh: [37, 6], lf: [17, 55], rf: [32, 54], b: [0, 8], head: 'down', anchor: 5 },
  fall3: { lh: [6, 20], rh: [42, 20], lf: [11, 50], rf: [38, 54], b: [0, 4], anchor: 28 },
  stand: { lh: [15, 34], rh: [33, 34], lf: [20, 54], rf: [28, 54], b: [0, 3], anchor: 54 },
  stand_b: { lh: [15, 35], rh: [33, 35], lf: [20, 54], rf: [28, 54], b: [0, 4], pb: 1, anchor: 54 },
  land: { lh: [12, 37], rh: [36, 37], lf: [17, 54], rf: [31, 54], b: [0, 9], anchor: 54 },
  look: { lh: [15, 34], rh: [29, 14], lf: [20, 54], rf: [28, 54], b: [0, 3], head: 'right', anchor: 54 },
  look2: { lh: [15, 34], rh: [29, 14], lf: [20, 54], rf: [28, 54], b: [0, 3], head: 'left', anchor: 54 },
  sit: { front: true, anchor: 40 },
  sit_b: { front: true, breathe: 1, anchor: 40 },
};

export function lookPalette(look) {
  const jacket = findCosmetic('jacket', look.jacket).color;
  const hat = findCosmetic('hat', look.hat);
  const pack = findCosmetic('pack', look.pack).color;
  const acc = findCosmetic('accessory', look.accessory).style;
  const chalk = findCosmetic('chalk', look.chalk || 'chalk-white');
  return {
    jacket, jacketDark: darken(jacket, 0.72), jacketLight: lighten(jacket, 0.18),
    pants: 0x343c52, pantsDark: 0x262c3e,
    boots: 0x6a4428, sole: 0x2a1d15,
    glove: 0x3d4150,
    skin: 0xe8b48a, skinDark: 0xc98e68,
    hair: 0x5a3a22, hairLight: 0x7a5232,
    pack, packDark: darken(pack, 0.68), packLight: lighten(pack, 0.2),
    roll: 0x6aa6cf, rollDark: 0x4a7fa6,
    chalk: chalk.rainbow ? 0xf07ab8 : chalk.color, chalkBand: chalk.rainbow ? 0x6fd6b0 : 0xbdb6a6,
    hatStyle: hat.style, hat: hat.color || 0, hatDark: darken(hat.color || 0, 0.7), hatLight: lighten(hat.color || 0, 0.35),
    acc,
  };
}

function bendJoint(a, b, length, side) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const dist = Math.hypot(dx, dy) || 1;
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  if (dist >= length) return [mx, my];
  const h = Math.sqrt((length / 2) ** 2 - (dist / 2) ** 2);
  let px = -dy / dist, py = dx / dist;
  if (px * side < 0 || (Math.abs(px) < 0.2 && py < 0)) { px = -px; py = -py; }
  return [mx + px * h, my + py * h];
}

function drawHead(g, cx, cy, p, turn) {
  g.ellipse(cx, cy, 4, 4.6, p.hair);
  g.set(cx - 1, cy + 1, p.hairLight);
  g.set(cx + 1, cy - 1, p.hairLight);
  if (turn === 'left') { g.set(cx - 4, cy + 1, p.skin); g.set(cx - 4, cy + 2, p.skinDark); g.set(cx - 3, cy + 3, p.skin); }
  if (turn === 'right') { g.set(cx + 3, cy + 1, p.skin); g.set(cx + 3, cy + 2, p.skinDark); g.set(cx + 2, cy + 3, p.skin); }
  const top = cy - 5;
  if (p.hatStyle === 'beanie' || p.hatStyle === 'bobble') {
    for (let y = top; y <= cy - 1; y++) for (let x = cx - 5; x <= cx + 5; x++) if (g.get(x, y) !== null) g.set(x, y, p.hat);
    for (let x = cx - 4; x <= cx + 3; x++) g.set(x, cy - 1, p.hatDark);
    g.set(cx - 2, top + 2, p.hatLight);
    g.set(cx - 1, top + 1, p.hatLight);
    if (p.hatStyle === 'bobble') g.ellipse(cx, top - 0.5, 2, 2, p.hatLight);
  } else if (p.hatStyle === 'helmet') {
    g.ellipse(cx, cy - 1.5, 4.8, 4, p.hat);
    for (let x = cx - 4; x <= cx + 3; x++) g.set(x, cy + 1, p.hatDark);
    g.set(cx - 2, cy - 4, 0xffffff);
    g.set(cx - 3, cy - 3, 0xffffff);
    g.set(cx + 2, cy - 2, p.hatDark);
  } else if (p.hatStyle === 'cap') {
    for (let y = top; y <= cy - 2; y++) for (let x = cx - 5; x <= cx + 5; x++) if (g.get(x, y) !== null) g.set(x, y, p.hat);
    for (let x = cx - 4; x <= cx + 3; x++) g.set(x, cy - 2, p.hatDark);
    g.set(cx - 1, cy - 2, 0xd8d0c0); g.set(cx, cy - 2, 0xd8d0c0);
    g.set(cx - 2, top + 1, p.hatLight);
    g.set(cx, top - 1, p.hatDark);
  } else if (p.hatStyle === 'crown') {
    g.rect(cx - 4, cy - 6, 9, 2, p.hat);
    g.rect(cx - 4, cy - 5, 9, 1, p.hatDark);
    [cx - 4, cx, cx + 4].forEach((x) => { g.set(x, cy - 7, p.hat); g.set(x, cy - 8, p.hatLight); });
    g.set(cx - 2, cy - 6, 0xe0344f); g.set(cx + 2, cy - 6, 0x4f86f0); g.set(cx, cy - 6, 0xd8fbff);
  }
  if (p.acc === 'goggles') {
    for (let x = cx - 4; x <= cx + 4; x++) if (g.get(x, cy - 1) !== null) g.set(x, cy - 1, 0x3a3a44);
    g.set(cx, cy - 1, 0x6fd6ff);
  }
  if (p.acc === 'feather') { g.line(cx + 3, cy - 2, cx + 6, cy - 8, 0xf0ead6); g.set(cx + 6, cy - 8, 0x8a6a4a); }
}

function drawLimb(g, a, b, length, side, color, endColor, endW) {
  const j = bendJoint(a, b, length, side);
  g.line(a[0], a[1], j[0], j[1], color, 3);
  g.line(j[0], j[1], b[0], b[1], color, 3);
  g.rect(Math.round(b[0] - endW / 2), Math.round(b[1] - 1), endW, 3, endColor);
}

function drawRear(g, pose, p, frameIndex) {
  const [dx, dy] = pose.b;
  const pb = pose.pb || 0;
  const ox = 24 + dx;
  const oy = dy + (pose.anchor === 54 ? 2 : 0);
  // Legs (behind everything else)
  const hipL = [ox - 3, oy + 32], hipR = [ox + 3, oy + 32];
  drawLimb(g, hipL, pose.lf, 21, -1, p.pants, p.boots, 4);
  drawLimb(g, hipR, pose.rf, 21, 1, p.pants, p.boots, 4);
  g.set(pose.lf[0] - 2, pose.lf[1] + 1, p.sole); g.set(pose.lf[0] + 1, pose.lf[1] + 1, p.sole);
  g.set(pose.rf[0] - 2, pose.rf[1] + 1, p.sole); g.set(pose.rf[0] + 1, pose.rf[1] + 1, p.sole);
  g.rect(ox - 5, oy + 30, 11, 4, p.pants);
  // Torso
  g.rect(ox - 7, oy + 18, 15, 13, p.jacket);
  g.rect(ox - 6, oy + 17, 13, 1, p.jacket);
  g.rect(ox - 7, oy + 30, 15, 1, p.jacketDark);
  // Arms
  const shL = [ox - 7, oy + 20], shR = [ox + 7, oy + 20];
  drawLimb(g, shL, pose.lh, 15, -1, p.jacket, p.glove, 3);
  drawLimb(g, shR, pose.rh, 15, 1, p.jacket, p.glove, 3);
  g.set(shL[0], shL[1] - 1, p.jacketLight);
  // Backpack
  const py = oy + 18 + pb;
  g.rect(ox - 5, py, 11, 13, p.pack);
  g.rect(ox - 5, py, 1, 13, p.packLight);
  g.rect(ox + 5, py, 1, 13, p.packDark);
  g.rect(ox - 5, py + 12, 11, 1, p.packDark);
  g.rect(ox - 5, py - 1, 11, 3, p.packDark);
  g.rect(ox - 4, py - 1, 9, 1, p.pack);
  g.rect(ox - 3, py + 6, 7, 5, p.packDark);
  g.rect(ox - 2, py + 6, 5, 1, p.pack);
  g.set(ox, py + 3, 0xd8d0b8);
  // Sleeping-pad roll on top
  g.rect(ox - 6, py - 4, 13, 3, p.roll);
  g.rect(ox - 6, py - 2, 13, 1, p.rollDark);
  g.set(ox - 6, py - 3, p.rollDark); g.set(ox + 6, py - 3, p.rollDark);
  // Chalk bag
  g.rect(ox - 1, oy + 31, 3, 3, p.chalk);
  g.set(ox, oy + 31, p.chalkBand);
  if (p.acc === 'axe') {
    g.line(ox + 4, py + 11, ox - 3, py - 2, 0x7a5a3a);
    g.rect(ox - 6, py - 4, 6, 2, 0x9aa4b0);
    g.set(ox - 6, py - 2, 0x9aa4b0);
  }
  // Head
  const headY = oy + 12 + (pose.head === 'down' ? 1 : 0);
  drawHead(g, ox, headY, p, pose.head);
  if (p.acc === 'scarf') {
    g.rect(ox - 4, oy + 16, 9, 2, 0xf0e2c0);
    g.set(ox - 2, oy + 16, 0xc8463b); g.set(ox + 2, oy + 16, 0xc8463b);
    const sway = frameIndex % 2;
    g.line(ox - 3, oy + 18, ox - 5 - sway, oy + 24, 0xf0e2c0, 2);
    g.set(ox - 5 - sway, oy + 22, 0xc8463b);
  }
}

function drawFront(g, pose, p) {
  const by = pose.breathe || 0;
  // Legs dangle over the ledge towards the viewer.
  g.rect(18, 39, 5, 3, p.pants); g.rect(26, 39, 5, 3, p.pants);
  g.rect(19, 42, 4, 9, p.pants); g.rect(26, 42, 4, 9, p.pants);
  g.rect(19, 42, 4, 1, p.pantsDark); g.rect(26, 42, 4, 1, p.pantsDark);
  g.rect(18, 51, 5, 3, p.boots); g.rect(26, 51, 5, 3, p.boots);
  g.rect(18, 53, 5, 1, p.sole); g.rect(26, 53, 5, 1, p.sole);
  // Pack set down beside the climber
  g.rect(35, 30, 9, 10, p.pack); g.rect(35, 30, 9, 2, p.packDark); g.rect(37, 34, 5, 4, p.packDark);
  g.rect(34, 27, 11, 3, p.roll); g.rect(34, 29, 11, 1, p.rollDark);
  // Torso
  g.rect(18, 27 + by, 13, 12 - by, p.jacket);
  g.rect(24, 28 + by, 1, 10 - by, p.jacketDark);
  g.rect(18, 38, 13, 1, p.jacketDark);
  // Arms resting on knees
  drawLimb(g, [18, 29 + by], [17, 40], 13, -1, p.jacket, p.glove, 3);
  drawLimb(g, [30, 29 + by], [31, 40], 13, 1, p.jacket, p.glove, 3);
  // Face
  const hy = 21 + by;
  g.ellipse(24, hy, 4, 4.6, p.skin);
  g.rect(20, hy - 4, 9, 2, p.hair);
  g.set(22, hy + 1, 0x2a2030); g.set(26, hy + 1, 0x2a2030);
  g.set(21, hy + 3, 0xe08a7a); g.set(27, hy + 3, 0xe08a7a);
  g.set(24, hy + 3, p.skinDark);
  if (p.hatStyle === 'beanie' || p.hatStyle === 'bobble') {
    g.ellipse(24, hy - 3, 5, 3, p.hat);
    g.rect(19, hy - 2, 11, 2, p.hatDark);
    if (p.hatStyle === 'bobble') g.ellipse(24, hy - 7, 2, 2, p.hatLight);
  } else if (p.hatStyle === 'helmet') {
    g.ellipse(24, hy - 3, 5, 3.6, p.hat);
    g.rect(19, hy - 1, 11, 1, p.hatDark);
    g.set(22, hy - 5, 0xffffff);
  } else if (p.hatStyle === 'cap') {
    g.ellipse(24, hy - 3, 5, 2.6, p.hat);
    g.rect(19, hy - 2, 12, 1, p.hatDark);
    g.rect(22, hy - 1, 7, 1, p.hatDark);
    g.set(22, hy - 4, p.hatLight);
  } else if (p.hatStyle === 'crown') {
    g.rect(20, hy - 5, 9, 2, p.hat);
    g.rect(20, hy - 4, 9, 1, p.hatDark);
    [20, 24, 28].forEach((x) => { g.set(x, hy - 6, p.hat); g.set(x, hy - 7, p.hatLight); });
    g.set(22, hy - 5, 0xe0344f); g.set(26, hy - 5, 0x4f86f0); g.set(24, hy - 5, 0xd8fbff);
  }
  if (p.acc === 'goggles') {
    g.rect(19, hy - 1, 11, 1, 0x3a3a44);
    g.rect(20, hy - 2, 4, 2, 0x6fd6ff); g.rect(25, hy - 2, 4, 2, 0x6fd6ff);
    g.set(20, hy - 2, 0xffffff); g.set(25, hy - 2, 0xffffff);
  }
  if (p.acc === 'scarf') { g.rect(20, 26 + by, 9, 2, 0xf0e2c0); g.set(22, 26 + by, 0xc8463b); g.rect(27, 28 + by, 2, 5, 0xf0e2c0); }
  if (p.acc === 'feather') g.line(28, hy - 4, 31, hy - 9, 0xf0ead6);
}

export const FRAME_NAMES = Object.keys(POSES);

// Draws every pose into one sprite-sheet canvas (row of FRAME_W x FRAME_H frames).
export function drawClimberSheet(ctx, look) {
  const p = lookPalette(look);
  FRAME_NAMES.forEach((name, i) => {
    const pose = POSES[name];
    const g = new PixelGrid(FRAME_W, FRAME_H);
    if (pose.front) drawFront(g, pose, p);
    else drawRear(g, pose, p, i);
    g.shadeEdges(new Set([OUTLINE]), 0.78);
    g.outline(OUTLINE);
    g.drawTo(ctx, i * FRAME_W, 0);
  });
}
