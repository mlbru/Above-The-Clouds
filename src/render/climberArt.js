import { PixelGrid } from '../utils/pixelGrid.js';
import { darken, lighten, lerpColor } from '../utils/color.js';
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
  // Fidgets while resting on a ledge (Climber.fidget): a big stretch, chalking
  // up and clapping the dust off overhead, shaking the arms loose.
  stretch: { lh: [15, 11], rh: [33, 11], lf: [20, 54], rf: [28, 54], b: [0, 2], anchor: 54 },
  stretch_b: { lh: [16, 9], rh: [32, 9], lf: [20, 53], rf: [28, 53], b: [0, 1], anchor: 54 },
  chalk: { lh: [15, 34], rh: [26, 36], lf: [20, 54], rf: [28, 54], b: [0, 3], head: 'down', anchor: 54 },
  clap_open: { lh: [18, 14], rh: [30, 14], lf: [20, 54], rf: [28, 54], b: [0, 3], anchor: 54 },
  clap: { lh: [22, 13], rh: [26, 13], lf: [20, 54], rf: [28, 54], b: [0, 3], anchor: 54 },
  shake: { lh: [9, 36], rh: [39, 33], lf: [20, 54], rf: [28, 54], b: [0, 3], anchor: 54 },
  shake2: { lh: [10, 32], rh: [38, 37], lf: [20, 54], rf: [28, 54], b: [0, 3], anchor: 54 },
  // Moods on a ledge: arms up after a long streak, hands on the knees when
  // the grip ran low, arms wrapped round the body in the cold.
  cheer: { lh: [8, 9], rh: [40, 9], lf: [20, 54], rf: [28, 54], b: [0, 2], anchor: 54 },
  cheer_b: { lh: [10, 5], rh: [38, 5], lf: [20, 52], rf: [28, 52], b: [0, 0], anchor: 54 },
  pant: { lh: [17, 43], rh: [31, 43], lf: [18, 54], rf: [30, 54], b: [0, 9], head: 'down', anchor: 54 },
  pant_b: { lh: [17, 44], rh: [31, 44], lf: [18, 54], rf: [30, 54], b: [0, 10], pb: 1, head: 'down', anchor: 54 },
  hug: { lh: [27, 31], rh: [21, 31], lf: [21, 54], rf: [27, 54], b: [0, 4], head: 'down', anchor: 54 },
  hug_b: { lh: [27, 32], rh: [21, 32], lf: [21, 54], rf: [27, 54], b: [0, 5], pb: 1, head: 'down', anchor: 54 },
  // Ledge life (settings LEDGE LIFE: LIVELY): a drink from the bottle, a look
  // at the map, a wave, pointing at the stars, blowing warm air into the hands.
  drink: { lh: [15, 34], rh: [27, 19], lf: [20, 54], rf: [28, 54], b: [0, 3], head: 'right', anchor: 54 },
  drink_b: { lh: [15, 34], rh: [27, 16], lf: [20, 54], rf: [28, 54], b: [0, 2], head: 'right', anchor: 54 },
  map: { lh: [13, 15], rh: [35, 15], lf: [20, 54], rf: [28, 54], b: [0, 3], anchor: 54 },
  wave: { lh: [15, 34], rh: [38, 9], lf: [20, 54], rf: [28, 54], b: [0, 3], head: 'right', anchor: 54 },
  wave_b: { lh: [15, 34], rh: [41, 13], lf: [20, 54], rf: [28, 54], b: [0, 3], head: 'right', anchor: 54 },
  point: { lh: [15, 34], rh: [36, 10], lf: [20, 54], rf: [28, 54], b: [0, 3], head: 'right', anchor: 54 },
  blow: { lh: [22, 19], rh: [26, 19], lf: [20, 54], rf: [28, 54], b: [0, 4], head: 'down', anchor: 54 },
  blow_b: { lh: [22, 20], rh: [26, 20], lf: [20, 54], rf: [28, 54], b: [0, 5], pb: 1, head: 'down', anchor: 54 },
  sit: { front: true, anchor: 40 },
  sit_b: { front: true, breathe: 1, anchor: 40 },
};

export function lookPalette(look) {
  const jacketItem = findCosmetic('jacket', look.jacket);
  const jacket = jacketItem.color;
  const hat = findCosmetic('hat', look.hat);
  const packItem = findCosmetic('pack', look.pack);
  const pack = packItem.color;
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
    // Premium shells have a dark zip and a small chest logo.
    jacketLogo: jacketItem.logo ?? null, jacketZip: jacketItem.zip ?? null,
    // Mastery rewards: a woven pattern on the jacket, a mossy pack.
    jacketPattern: jacketItem.pattern || null, packStyle: packItem.style || null,
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
  } else if (p.hatStyle === 'hood') {
    // A rough wool hood pulled over the head, its point hanging down the back.
    g.ellipse(cx, cy - 0.5, 5.2, 5.6, p.hat);
    for (let y = cy - 5; y <= cy + 4; y++) if (g.get(cx + 3, y) !== null) g.set(cx + 3, y, p.hatDark);
    g.set(cx - 2, cy - 4, p.hatLight); g.set(cx - 3, cy - 3, p.hatLight); g.set(cx - 1, cy - 5, p.hatLight);
    g.rect(cx - 6, cy + 3, 13, 3, p.hat);
    g.rect(cx - 6, cy + 5, 13, 1, p.hatDark);
    g.line(cx, cy + 4, cx + 1, cy + 9, p.hatDark, 2);
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
  if (p.jacketLogo !== null) { g.set(ox + 6, oy + 21, p.jacketLogo); g.set(ox + 7, oy + 22, p.jacketLogo); g.set(ox + 6, oy + 23, p.jacketLogo); }
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
  if (p.packStyle === 'moss') {
    // Moss grows over the roll and the top of the pack, strands hang below.
    for (let x = ox - 6; x <= ox + 6; x++) {
      if ((x * 5) % 3 !== 0) g.set(x, py - 5, MOSS[1]);
      if ((x * 7) % 4 === 0) g.set(x, py - 4, MOSS[2]);
      if ((x * 3) % 5 === 0) g.set(x, py, MOSS[0]);
    }
    for (let y = py + 2; y < py + 12; y++) for (let x = ox - 5; x <= ox + 5; x++) if ((x * 3 + y * 5) % 9 === 0) g.set(x, y, MOSS[1]);
    g.rect(ox - 4, py + 13, 1, 2, MOSS[0]); g.rect(ox + 3, py + 13, 1, 3, MOSS[0]); g.set(ox + 3, py + 15, MOSS[1]);
  }
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
  if (p.acc === 'collar') {
    // A collar of black volcanic glass, its facets catching a violet light.
    g.rect(ox - 5, oy + 16, 11, 2, 0x1a1424);
    for (let x = ox - 4; x <= ox + 4; x += 2) g.set(x, oy + 16, 0x6a4a9a);
  }
  if (p.acc === 'aurora') {
    // The aurora scarf (its colours are animated on top, see OutfitFx).
    g.rect(ox - 4, oy + 16, 9, 2, 0x5af0a0);
    g.line(ox - 6, oy + 18, ox - 7, oy + 26, 0x40c8d8, 2);
  }
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
  g.rect(24, 28 + by, 1, 10 - by, p.jacketZip ?? p.jacketDark);
  if (p.jacketLogo !== null) { g.set(21, 30 + by, p.jacketLogo); g.set(20, 31 + by, p.jacketLogo); g.set(22, 31 + by, p.jacketLogo); }
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
  if (p.acc === 'collar') { g.rect(19, 26 + by, 11, 2, 0x1a1424); for (let x = 20; x <= 28; x += 2) g.set(x, 26 + by, 0x6a4a9a); }
  if (p.acc === 'aurora') { g.rect(20, 26 + by, 9, 2, 0x5af0a0); g.rect(27, 28 + by, 2, 6, 0x40c8d8); }
  if (p.hatStyle === 'hood') {
    // The hood frames the face.
    for (let y = hy - 7; y <= hy + 5; y++) {
      for (let x = 17; x <= 31; x++) {
        const out = ((x + 0.5 - 24) / 6.4) ** 2 + ((y + 0.5 - hy + 0.5) / 6.6) ** 2 <= 1;
        const face = ((x + 0.5 - 24) / 4.2) ** 2 + ((y + 0.5 - hy - 0.8) / 4.6) ** 2 <= 1;
        if (out && !face) g.set(x, y, x > 27 ? p.hatDark : p.hat);
      }
    }
    g.set(21, hy - 5, p.hatLight); g.set(22, hy - 6, p.hatLight);
  }
  if (p.packStyle === 'moss') {
    for (let x = 34; x <= 44; x++) { if ((x * 5) % 3 !== 0) g.set(x, 26, MOSS[1]); if ((x * 7) % 4 === 0) g.set(x, 27, MOSS[2]); }
    g.set(36, 40, MOSS[0]); g.set(42, 40, MOSS[0]); g.set(42, 41, MOSS[0]);
  }
  if (p.acc === 'feather') g.line(28, hy - 4, 31, hy - 9, 0xf0ead6);
}

export const FRAME_NAMES = Object.keys(POSES);

const MOSS = [0x3a5a22, 0x6a9a3a, 0x9ac85a];

// Woven jacket patterns of the mastery rewards. k = 0 shadow, 1 base, 2 lit.
const PATTERNS = {
  // Rime coat: pale ice blue, feathered with frost crystals.
  rime: (x, y, k) => {
    if ((x * 5 + y * 3) % 9 === 0) return 0xf4fbff;
    if (y % 4 === 0 && (x + y) % 3 === 0) return 0xd0ecff;
    return [0x6a9cc0, 0xa8d4ec, 0xd8f0ff][k];
  },
  // Prism shell: pearl white with soft rainbow bands running diagonally.
  prism: (x, y, k) => {
    const band = [0xffb8d8, 0xfff0a0, 0xb8ffd0, 0xa8dcff, 0xd8b8ff, 0xfff8f0][Math.floor((x + y) / 2) % 6];
    return lerpColor([0xa8a4bc, 0xe0dcec, 0xffffff][k], band, 0.42);
  },
  // Thunder jacket: storm navy with yellow lightning zigzags.
  bolt: (x, y, k) => {
    const m = x % 6, z = m < 3 ? m : 6 - m;
    const r = (((y - z) % 7) + 7) % 7;
    if (r === 0) return k === 0 ? 0xc8a020 : 0xffe04a;
    if (r === 1) return 0x0e1226;
    return [0x141a34, 0x24305a, 0x34447a][k];
  },
  // Honeycomb coat: golden wax cells, a few still full of honey.
  honeycomb: (x, y, k) => {
    const row = Math.floor(y / 3), cx = (x + (row % 2) * 2) % 4;
    if (y % 3 === 0 || cx === 0) return [0x7a4a10, 0x9a5c18, 0xb87a2a][k];
    if ((Math.floor((x + (row % 2) * 2) / 4) * 3 + row * 5) % 7 === 0) return 0xffb840;
    return [0xc8902c, 0xe8b04a, 0xffd870][k];
  },
  // Tinker's coat: oiled leather, a row of brass rivets and a little cog.
  brass: (x, y, k) => {
    if (x % 5 === 2 && y % 4 === 1) return 0xf0c870;
    if ((x + y) % 11 === 0) return 0x2a1c12;
    return [0x3a2618, 0x5a3c24, 0x7a5434][k];
  },
  // Bone mail: ash-black with pale ribs across the chest.
  bone: (x, y, k) => {
    if (y % 3 === 0 && (x % 6 !== 0)) return k === 0 ? 0xa89878 : 0xe8dcc0;
    if (x % 6 === 0 && y % 3 !== 2) return 0xc8b898;
    return [0x141214, 0x24201e, 0x3a3430][k];
  },
  // Dragonscale coat: overlapping red scales with a few gold flecks.
  scales: (x, y, k) => {
    const row = Math.floor(y / 3), sx = (x + (row % 2) * 2) % 4;
    if ((x * 7 + y * 13) % 29 === 0) return 0xf0a050;
    if (y % 3 === 2 && sx !== 0) return 0x3a0c14;
    if (y % 3 === 0 && sx === 1) return [0xa8443a, 0xd86a3a, 0xf08a4a][k];
    return [0x5e161e, 0x8e2a2a, 0xb8443a][k];
  },
};

// Where things sit on a pose, in frame pixels (for overlays that follow the
// climber): the top of the pack, the neck, the head and the shoulders.
export function bodyPoints(name) {
  const pose = POSES[name];
  if (pose.front) {
    const by = pose.breathe || 0;
    return { packTop: [39, 25], neck: [24, 26 + by], head: [24, 21 + by], shoulders: [[18, 29 + by], [30, 29 + by]], front: true };
  }
  const ox = 24 + pose.b[0], oy = pose.b[1] + (pose.anchor === 54 ? 2 : 0), pb = pose.pb || 0;
  return { packTop: [ox, oy + 18 + pb - 5], neck: [ox, oy + 16], head: [ox, oy + 12], shoulders: [[ox - 7, oy + 20], [ox + 7, oy + 20]], front: false };
}

// Draws every pose into one sprite-sheet canvas (row of FRAME_W x FRAME_H frames).
// maskCtx (optional) receives a sheet with only the jacket's pixels, in white:
// OutfitFx lays it over the climber to make the jacket frost, shimmer or glow.
export function drawClimberSheet(ctx, look, maskCtx = null) {
  const p = lookPalette(look);
  FRAME_NAMES.forEach((name, i) => {
    const pose = POSES[name];
    const g = new PixelGrid(FRAME_W, FRAME_H);
    if (pose.front) drawFront(g, pose, p);
    else drawRear(g, pose, p, i);
    const shade = new Map([[p.jacketDark, 0], [p.jacket, 1], [p.jacketLight, 2]]);
    const mask = maskCtx ? new PixelGrid(FRAME_W, FRAME_H) : null;
    for (let y = 0; y < FRAME_H; y++) {
      for (let x = 0; x < FRAME_W; x++) {
        const k = shade.get(g.get(x, y));
        if (k === undefined) continue;
        if (mask) mask.set(x, y, 0xffffff);
        if (p.jacketPattern) g.set(x, y, PATTERNS[p.jacketPattern](x, y, k));
      }
    }
    if (mask) mask.drawTo(maskCtx, i * FRAME_W, 0);
    g.shadeEdges(new Set([OUTLINE]), 0.78);
    g.outline(OUTLINE);
    g.drawTo(ctx, i * FRAME_W, 0);
  });
}
