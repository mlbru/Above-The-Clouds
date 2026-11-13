// Sinterklaas at base camp (data/seasons.js): a wooden shoe set out by the
// fire with a carrot and hay for the horse, a pile of presents wrapped in
// paper and string, a chocolate letter, a bowl of kruidnoten, bunting of
// little mitres, and now and then the Sint himself riding his white horse
// over camp.
import { PixelGrid } from '../utils/pixelGrid.js';
import { lerpColor } from '../utils/color.js';

const OUT = 0x1a1016;

// A wooden clog lying on its side, toe to the right, a painted band on it;
// a carrot and a wisp of hay stick out of the opening.
function shoeGrid() {
  const g = new PixelGrid(18, 12);
  const wood = 0xe8c47a, woodL = 0xfff0c0, woodD = 0xa8803e;
  // Body: a long rounded shape rising to the heel on the left.
  for (let x = 1; x < 17; x++) {
    const top = x < 6 ? 4 : x < 13 ? 6 - Math.round((x - 6) * 0.05) : 6 + Math.round((x - 13) * 0.6);
    const bot = 10;
    for (let y = top; y <= bot; y++) g.set(x, y, y === top ? woodL : y >= bot - 1 ? woodD : wood);
  }
  // The opening near the heel: dark inside.
  for (let x = 3; x < 9; x++) g.set(x, 5, 0x3a2410);
  for (let x = 4; x < 8; x++) g.set(x, 6, 0x5a3a1a);
  // A painted tulip on the toe.
  g.set(13, 8, 0xd83a2a); g.set(12, 7, 0xd83a2a); g.set(14, 7, 0xd83a2a); g.set(13, 7, 0xff6a4a); g.set(13, 9, 0x3a8a3a); g.set(12, 9, 0x3a8a3a);
  // The carrot leaning out, leaves on top.
  for (let k = 0; k < 6; k++) { g.set(5 + Math.round(k * 0.5), 5 - k, k > 4 ? 0xffa040 : 0xf07a1a); g.set(6 + Math.round(k * 0.5), 5 - k, k < 2 ? 0xc85a10 : null); }
  g.set(8, 0, 0x4aa83a); g.set(9, 0, 0x6ac84a); g.set(7, 0, 0x3a8a2a);
  // Hay.
  for (const [x, y] of [[2, 4], [2, 3], [3, 3], [1, 2], [4, 2], [3, 1]]) g.set(x, y, 0xf2d870);
  g.outline(OUT);
  return g;
}

// Presents: a big one in brown paper tied with red string and a tag, one in
// red and white stripes with a gold bow, a small blue one, and a long
// lumpy "surprise".
function giftsGrid() {
  const g = new PixelGrid(30, 18);
  const box = (x0, y0, w, h, fill, edge, ribbon, stripe) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let c = fill;
      if (stripe && (x + y) % 4 < 2) c = stripe;
      if (y === 0) c = lerpColor(c, 0xffffff, 0.35);
      if (x === w - 1 || y === h - 1) c = edge;
      if (x === Math.floor(w / 2) || y === Math.floor(h / 2)) c = ribbon;
      g.set(x0 + x, y0 + y, c);
    }
  };
  // The surprise: a long wrapped thing leaning at the back.
  for (let k = 0; k < 14; k++) for (let t = -2; t <= 2; t++) g.set(22 + Math.round(k * 0.35) + t, 16 - k, t === -2 ? 0x8ad8f0 : t === 2 ? 0x2a6a9a : (k + t) % 3 ? 0x4aa8d8 : 0xfff0a0);
  box(1, 6, 13, 11, 0xc89a62, 0x8a6638, 0xc8243a, null);
  box(12, 9, 11, 8, 0xe8e0d8, 0xa89a90, 0xf2c252, 0xd8303a);
  box(9, 13, 6, 4, 0x3a6ad8, 0x22408a, 0xe8eef8, null);
  // Bows.
  for (const [x, y, c] of [[7, 5, 0xc8243a], [17, 8, 0xf2c252], [12, 12, 0xe8eef8]]) { g.set(x - 1, y, c); g.set(x + 1, y, c); g.set(x, y, lerpColor(c, 0x000000, 0.3)); g.set(x - 2, y - 1, c); g.set(x + 2, y - 1, c); }
  // A tag with a rhyme on it.
  g.set(3, 8, 0xfff6e0); g.set(4, 8, 0xfff6e0); g.set(3, 9, 0xfff6e0); g.set(4, 9, 0x8a8aa0);
  g.outline(OUT);
  return g;
}

// A chocolate letter S, half out of its wrapper.
function letterGrid() {
  const g = new PixelGrid(12, 15);
  const S = [
    ' ######',
    '########',
    '##    ##',
    '##',
    '#######',
    ' #######',
    '      ##',
    '##    ##',
    '########',
    ' ######',
  ];
  S.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') g.set(x + 2, y + 1, 0x6a3a1c); }));
  for (let y = 0; y < 15; y++) for (let x = 0; x < 12; x++) {
    if (g.get(x, y) !== 0x6a3a1c) continue;
    if (g.get(x, y - 1) == null || g.get(x - 1, y) == null) g.set(x, y, 0xa8683a);
  }
  // The wrapper: red and white paper round the bottom half.
  for (let y = 8; y < 14; y++) for (let x = 1; x < 11; x++) g.set(x, y, y === 8 ? 0xffffff : (x + Math.floor(y / 2)) % 3 === 0 ? 0xffffff : 0xd8303a);
  g.outline(OUT);
  return g;
}

// A little bowl of kruidnoten.
function nutsGrid() {
  const g = new PixelGrid(12, 7);
  for (let x = 1; x < 11; x++) for (let y = 3; y < 7; y++) if (Math.abs(x - 5.5) < 5.5 - (y - 3) * 0.8) g.set(x, y, y === 3 ? 0xe8e0f0 : 0x5a7ab8);
  for (const [x, y] of [[3, 2], [5, 2], [7, 2], [4, 1], [6, 1], [8, 2], [5, 0]]) { g.set(x, y, 0xb06a2a); }
  g.set(4, 1, 0xd88a42); g.set(7, 2, 0x8a4a1a);
  g.outline(OUT);
  return g;
}

// A pennant shaped like a mitre: red with a gold cross and white trim.
function mitreFlag(v) {
  const g = new PixelGrid(7, 9);
  const red = [0xd8243a, 0xf2c252, 0xe8e0d8][v], gold = v === 1 ? 0xd8303a : 0xf2c252;
  for (let y = 0; y < 9; y++) for (let x = 0; x < 7; x++) {
    const w = y < 4 ? y * 0.9 : 3;
    if (Math.abs(x - 3) > w + 0.2) continue;
    g.set(x, y, y >= 7 ? 0xffffff : red);
  }
  g.set(3, 2, gold); g.set(3, 3, gold); g.set(3, 4, gold); g.set(2, 3, gold); g.set(4, 3, gold);
  return g;
}

// The Sint on his white horse, galloping: four frames. Red cape streaming,
// a tall red mitre with gold, a white beard, a gold staff with a crook.
function rideFrame(f) {
  const g = new PixelGrid(36, 30);
  const white = 0xf4f4f8, shade = 0xc8ccd8, dark = 0x8a90a8;
  // Horse body.
  g.ellipse(17, 17, 9, 4.6, white);
  for (let x = 9; x < 26; x++) g.set(x, 21, shade);
  // Neck and head reaching forward (right).
  for (let k = 0; k < 8; k++) for (let t = -2; t <= 2; t++) g.set(24 + k * 0.8 + t * 0.3, 15 - k * 0.9 + t * 0.4, t > 1 ? shade : white);
  g.ellipse(32, 8.5, 3, 2, white);
  g.set(34, 9, dark); g.set(31, 7, 0x1a1a2a);
  g.set(29, 5, white); g.set(30, 5, shade);
  // Mane and tail flying.
  for (let k = 0; k < 6; k++) g.set(25 + k * 0.7, 10 - k * 0.6 + (f % 2), 0xdcdce8);
  for (let k = 0; k < 7; k++) g.set(8 - k, 15 + Math.round(Math.sin(k * 0.8 + f) * 1.2) + Math.floor(k / 3), k % 2 ? shade : white);
  // Legs: a gallop in four poses.
  const legs = [
    [[11, 21, -3], [14, 21, -1], [21, 21, 2], [24, 21, 4]],
    [[11, 21, -1], [14, 21, 1], [21, 21, 0], [24, 21, 2]],
    [[11, 21, 2], [14, 21, 3], [21, 21, -2], [24, 21, -1]],
    [[11, 21, 0], [14, 21, 1], [21, 21, -1], [24, 21, 1]],
  ][f];
  for (const [x, y, lean] of legs) for (let k = 0; k < 6; k++) { g.set(x + Math.round(lean * k / 6), y + k, k === 5 ? dark : white); }
  // The rider: red cape over the horse's back.
  for (let y = 8; y < 17; y++) for (let x = 13; x < 20; x++) if (x - 13 > (y - 8) * -0.2 && (x < 19 || y > 10)) g.set(x, y, y > 14 ? 0xa81a2a : 0xd8243a);
  // Cape streaming back.
  for (let k = 0; k < 6; k++) for (let t = 0; t < 3; t++) g.set(12 - k, 10 + t + Math.round(k * 0.4) + ((k + f) % 2), 0xc81e30);
  // Face and beard.
  g.rect(17, 5, 3, 2, 0xf0c8a8);
  g.rect(16, 7, 5, 3, 0xffffff); g.set(18, 10, 0xffffff);
  // The mitre: tall, red, a gold band and cross.
  for (let y = 0; y < 5; y++) for (let x = 16; x < 21; x++) if (Math.abs(x - 18) <= Math.min(2, y * 0.7 + 0.5)) g.set(x, y, 0xd8243a);
  g.rect(16, 4, 5, 1, 0xf2c252); g.set(18, 1, 0xf2c252); g.set(18, 2, 0xf2c252); g.set(17, 2, 0xf2c252); g.set(19, 2, 0xf2c252);
  // The staff, gold, a crook at the top.
  for (let y = 2; y < 18; y++) g.set(22, y, y < 4 ? 0xffe08a : 0xd8a83a);
  g.set(23, 1, 0xf2c252); g.set(24, 2, 0xf2c252); g.set(24, 3, 0xd8a83a);
  g.outline(OUT);
  return g;
}

export function sintGrids() {
  return {
    shoe: shoeGrid(), gifts: giftsGrid(), letter: letterGrid(), nuts: nutsGrid(),
    flags: [0, 1, 2].map(mitreFlag), ride: [0, 1, 2, 3].map(rideFrame),
  };
}
