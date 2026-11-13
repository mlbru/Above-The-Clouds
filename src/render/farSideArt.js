// The Far Range's side scenery: tall strips of world that fill the screen to
// the left and right of the wall you climb, so up here you climb inside a
// place (a gorge, a temple town, a forest of giant trunks) rather than on a
// pillar in the open sky. Two depths per side, each tile seamless top to
// bottom so it can scroll forever:
//   back  a hazier wall further out (slow parallax)
//   mid   a darker, closer one with more detail (faster)
// Every layer is drawn for the LEFT side (screen edge at x = 0, inner edge
// ragged on the right); the right side gets its own seed and is flipped.
// Extra layers: `_glow` (windows, lanterns, glowing caps: ADD, at night) and
// `_water` (falling water, scrolled downward by the scene).
import { makeCanvas } from '../utils/pixelGrid.js';
import { lerpColor, bayer, rgb } from '../utils/color.js';
import { SeededRandom } from '../utils/seededRandom.js';

export const SIDE_W = 224, SIDE_H = 512;
const TAU = Math.PI * 2;

// Value noise that wraps vertically every SIDE_H pixels.
function pnoise(seed) {
  const hash = (i, j) => {
    let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(seed, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  return (x, y, sx, sy) => {
    const ny = Math.round(SIDE_H / sy);
    const fx = x / sx, fy = (((y / sy) % ny) + ny) % ny;
    const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
    const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    const a = hash(i, j % ny), b = hash(i + 1, j % ny), c = hash(i, (j + 1) % ny), d = hash(i + 1, (j + 1) % ny);
    return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
  };
}

function buffer() {
  const px = new Array(SIDE_W * SIDE_H).fill(null);
  const wrapY = (y) => ((Math.round(y) % SIDE_H) + SIDE_H) % SIDE_H;
  return {
    px,
    set(x, y, c) { x = Math.round(x); if (x < 0 || x >= SIDE_W || c == null) return; px[wrapY(y) * SIDE_W + x] = c; },
    get(x, y) { x = Math.round(x); return x < 0 || x >= SIDE_W ? null : px[wrapY(y) * SIDE_W + x]; },
    canvas() {
      const cv = makeCanvas(SIDE_W, SIDE_H);
      const ctx = cv.getContext('2d');
      const img = ctx.createImageData(SIDE_W, SIDE_H);
      for (let i = 0; i < px.length; i++) {
        if (px[i] == null) continue;
        const [r, g, b] = rgb(px[i]);
        img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      return cv;
    },
  };
}

const ramp = (list, k, x, y) => list[Math.max(0, Math.min(list.length - 1, Math.round(k * (list.length - 1) + (bayer(x, y) - 0.5) * 0.9)))];

// The inner edge of a strip: where the rock ends, per row (seamless).
function edgeFn(rng, base, amp) {
  const ph = [rng.range(0, TAU), rng.range(0, TAU), rng.range(0, TAU)];
  const k = [rng.int(1, 2), rng.int(3, 4), rng.int(6, 9)];
  return (y) => base + Math.sin((y / SIDE_H) * TAU * k[0] + ph[0]) * amp + Math.sin((y / SIDE_H) * TAU * k[1] + ph[1]) * amp * 0.45 + Math.sin((y / SIDE_H) * TAU * k[2] + ph[2]) * amp * 0.18;
}

// ---------------------------------------------------------------- the Cascade
// A gorge wall of wet basalt columns, ferns and trees on every shelf, and
// waterfalls pouring the whole height (their water is its own layer).
function cascade(seed, near) {
  const rng = new SeededRandom(seed);
  const n = pnoise(seed);
  const b = buffer(), water = buffer(), glow = buffer();
  const rock = near ? [0x050c0c, 0x0a1614, 0x12221e, 0x1c322c, 0x2a463e] : [0x16302c, 0x1e3c36, 0x284a42, 0x365c52, 0x4a7466];
  const green = near ? [0x0c2414, 0x163a1e, 0x24562a, 0x3a7a3a] : [0x24502e, 0x30683a, 0x44844a, 0x62a45a];
  const edge = edgeFn(rng, near ? 112 : 178, near ? 22 : 24);
  for (let y = 0; y < SIDE_H; y++) {
    const e = edge(y);
    for (let x = 0; x < Math.min(SIDE_W, e + 1); x++) {
      // Columns: vertical joints a few pixels apart, each column lit on its left.
      const u = x + n(x, y, 30, 64) * 10;
      const cw = near ? 15 : 11, cu = ((u % cw) + cw) % cw;
      let k = 0.55 - (cu / cw) * 0.35 + (n(x, y, 8, 26) - 0.5) * 0.35;
      if (cu < 1) k = 0.05;
      // Breaks across the columns.
      if ((y + Math.floor(u / cw) * 37) % 61 === 0) k = 0.1;
      // Toward the inner edge the rock turns its face to the light.
      const d = e - x;
      if (d < 4) k += 0.25;
      let c = ramp(rock, k, x, y);
      // Wet streaks and moss in the damp.
      const m = n(x, y, 22, 22);
      if (m > 0.62) c = ramp(green, (m - 0.62) * 2.6 + (d < 6 ? 0.3 : 0), x, y);
      else if (n(x * 3, y, 6, 80) > 0.78) c = lerpColor(c, 0xa8d8e0, near ? 0.12 : 0.2);
      b.set(x, y, c);
    }
    b.set(e + 1, y, rock[0]);
  }
  // Shelves with ferns and trees sticking out past the edge.
  const shelves = near ? 6 : 8;
  for (let i = 0; i < shelves; i++) {
    const y0 = Math.round((i + rng.range(0.1, 0.9)) * (SIDE_H / shelves));
    const e = edge(y0);
    const len = rng.int(10, near ? 34 : 26);
    for (let x = Math.round(e - 18); x < e + len; x++) {
      const t = (x - (e - 18)) / (len + 18);
      const th = Math.round(4 - t * 3);
      for (let k = 0; k < th; k++) b.set(x, y0 + k, k === 0 ? green[3] : rock[1 + (k === 1 ? 1 : 0)]);
    }
    // A tree on the shelf, or a fan of fern.
    const tx = Math.round(e + rng.range(-6, len - 6));
    if (rng.chance(0.6)) {
      const tall = rng.int(16, near ? 40 : 30);
      for (let k = 0; k < tall; k++) b.set(tx + Math.round(Math.sin(k * 0.15) * 1.5), y0 - k, rock[0]);
      for (let k = 0; k < 4; k++) {
        const cy = y0 - tall + rng.int(-3, 6), cx = tx + rng.int(-9, 9), r = rng.range(5, near ? 11 : 8);
        for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
          const dd = Math.hypot(xx, yy) / r;
          if (dd > 1 + (n(cx + xx, cy + yy, 3, 3) - 0.5) * 0.4) continue;
          b.set(cx + xx, cy + yy, ramp(green, 0.75 - (yy / r) * 0.35 - (xx / r) * 0.15 - dd * 0.2, cx + xx, cy + yy));
        }
      }
    } else {
      for (let f = -3; f <= 3; f++) for (let k = 0; k < 10; k++) b.set(tx + f * k * 0.45, y0 - Math.round(k * (1 - Math.abs(f) * 0.12) - k * k * 0.01 * Math.abs(f)) , ramp(green, 0.6 + (k < 4 ? 0.2 : 0), tx + f, y0 - k));
    }
  }
  // Waterfalls down the whole height, in their own layer (it flows).
  const falls = near ? [rng.range(40, 80)] : [rng.range(30, 60), rng.range(96, 120), rng.range(140, 160)];
  for (const fx of falls) {
    const w = near ? 7 : 5;
    for (let y = 0; y < SIDE_H; y++) {
      const wob = Math.round(Math.sin((y / SIDE_H) * TAU * 3) * 1.2);
      for (let k = -w; k <= w; k++) {
        const x = fx + k + wob;
        const edgeK = Math.abs(k) / w;
        // Streaks of white and pale blue, varying along the fall.
        const streak = (Math.floor(x * 7) % 5 + Math.floor(y / 3)) % 7;
        let c = streak < 2 ? 0xc8e8f0 : streak < 5 ? 0xf4fcff : 0xe0f2f8;
        if (edgeK > 0.75) { if (bayer(x, y) > 0.55) continue; c = 0xa8d0dc; }
        water.set(x, y, c);
      }
      // The rock behind the fall is dark and wet.
      b.set(fx - w - 1 + wob, y, rock[0]); b.set(fx + w + 1 + wob, y, rock[0]);
    }
  }
  // Glow-worms in the damp shadows: tiny lights at night.
  for (let i = 0; i < 70; i++) {
    const x = rng.int(4, SIDE_W - 30), y = rng.int(0, SIDE_H - 1);
    if (b.get(x, y) != null) glow.set(x, y, rng.chance(0.5) ? 0x9ff8ff : 0x6ae0f0);
  }
  return { base: b, water, glow };
}

// ---------------------------------------------------------------- the Hanging Monastery
// A sandstone cliff packed with temple halls one above the other, joined by
// stairs and walkways, lanterns and prayer flags; the closer layer is the
// corner of a great pagoda, roof over roof.
function monastery(seed, near) {
  const rng = new SeededRandom(seed);
  const n = pnoise(seed);
  const b = buffer(), glow = buffer();
  const sand = near ? [0x1a100a, 0x2c1c12, 0x3e2a1c, 0x54402c, 0x6e5640] : [0x4a3a3a, 0x5e4a46, 0x766056, 0x927a68, 0xae967e];
  const red = near ? [0x3a0c0a, 0x6a1812, 0x9a2a1e, 0xc8402a] : [0x7a2a2a, 0x9a3a32, 0xb8504a, 0xd87060];
  const roofC = near ? [0x0c0808, 0x1a1210, 0x2a1e1a, 0x3e2c26] : [0x2a2228, 0x3a2e34, 0x4a3c42, 0x5e4e54];
  const gold = [0x8a5a10, 0xd8a03a, 0xf2c252, 0xffe08a];
  if (near) {
    // The pagoda: a red column of wall with a roof every 128 px.
    const wallR = 66;
    for (let y = 0; y < SIDE_H; y++) {
      for (let x = 0; x < wallR; x++) {
        const k = 0.35 + (x / wallR) * 0.4 + (n(x, y, 10, 30) - 0.5) * 0.2;
        let c = ramp(red, k, x, y);
        if (x === wallR - 1) c = red[0];
        if (x % 22 === 21) c = red[0];
        b.set(x, y, c);
      }
    }
    for (let t = 0; t < 4; t++) {
      const ry = t * 128 + 40;
      // A roof: dark tiles in rows, sweeping out and up to a gold tip.
      for (let k = 0; k < 18; k++) {
        const reach = wallR + 10 + k * 2.6;
        const yk = ry + k - Math.pow(k / 18, 3) * 0;
        for (let x = 0; x < reach; x++) {
          const lift = Math.pow(Math.max(0, x - wallR) / 50, 2.2) * 14;
          const yy = Math.round(yk - lift);
          b.set(x, yy, k < 2 ? roofC[3] : (x + k) % 4 === 0 ? roofC[0] : ramp(roofC, 0.6 - k * 0.025, x, yy));
        }
      }
      const tipX = wallR + 10 + 17 * 2.6, tipY = ry + 17 - Math.pow((tipX - wallR) / 50, 2.2) * 14;
      for (let k = 0; k < 6; k++) b.set(tipX + k * 0.6, tipY - k, gold[2]);
      // Under the eaves: brackets, a hanging bell and a lantern.
      for (let x = 4; x < wallR + 18; x += 8) for (let k = 0; k < 4; k++) b.set(x, ry + 18 + k, k === 0 ? gold[1] : red[1]);
      const bx = wallR + 24;
      for (let k = 0; k < 9; k++) b.set(bx, ry + 22 + k, roofC[0]);
      for (let yy = 0; yy < 7; yy++) for (let xx = -3 + Math.floor(yy / 3) * -1; xx <= 3 + Math.floor(yy / 3); xx++) b.set(bx + xx, ry + 31 + yy, ramp(gold, 0.7 - xx * 0.08, bx + xx, yy));
      const lx = wallR + 6;
      for (let yy = 0; yy < 10; yy++) for (let xx = -3; xx <= 3; xx++) {
        if (Math.abs(xx) === 3 && (yy === 0 || yy === 9)) continue;
        b.set(lx + xx, ry + 24 + yy, yy === 0 || yy === 9 ? roofC[0] : 0xe8502a);
        if (yy > 1 && yy < 8 && Math.abs(xx) < 3) glow.set(lx + xx, ry + 24 + yy, 0xffb050);
      }
      // A row of lit windows between the roofs.
      for (let w = 0; w < 3; w++) {
        const wx = 8 + w * 20, wy = ry + 58;
        for (let yy = 0; yy < 12; yy++) for (let xx = 0; xx < 8; xx++) {
          const frame = xx === 0 || xx === 7 || yy === 0 || yy === 11 || xx === 4;
          b.set(wx + xx, wy + yy, frame ? red[0] : 0x2a1210);
          if (!frame) glow.set(wx + xx, wy + yy, yy < 6 ? 0xffd080 : 0xffa040);
        }
      }
    }
    return { base: b, glow };
  }
  // The back layer: a cliff with halls built into it.
  const edge = edgeFn(rng, 186, 16);
  for (let y = 0; y < SIDE_H; y++) {
    const e = edge(y);
    for (let x = 0; x < Math.min(SIDE_W, e + 1); x++) {
      let k = 0.5 + (n(x, y, 18, 40) - 0.5) * 0.5 + (x > e - 5 ? 0.25 : 0);
      if ((y + Math.round(n(x, y, 40, 40) * 8)) % 13 === 0) k -= 0.3;
      if (n(x, y, 4, 90) > 0.8) k -= 0.25;
      b.set(x, y, ramp(sand, k, x, y));
    }
    if (n(e, y, 9, 9) > 0.6) for (let k = 1; k < 4; k++) b.set(e + k, y, k === 3 ? 0x6a9a5a : 0x3e6a34);
  }
  // Halls: red walls on white plaster, dark roofs with gold ridges, windows.
  for (let i = 0; i < 7; i++) {
    const hy = Math.round((i + rng.range(0.2, 0.8)) * (SIDE_H / 7));
    const e = edge(hy);
    const hw = rng.int(26, 46), hh = rng.int(14, 20), hx = Math.round(e - hw + rng.int(4, 18));
    for (let y = hy - hh; y <= hy + 5; y++) for (let x = hx; x < hx + hw; x++) {
      let c = y > hy ? (x < hx + 3 ? 0xfff4e0 : 0xe0d2bc) : ramp(red, 0.65 - (x - hx) / hw * 0.3, x, y);
      if (y <= hy && (x - hx) % 9 >= 3 && (x - hx) % 9 <= 5 && y > hy - hh + 4 && y < hy - 2) { c = 0x2a1210; glow.set(x, y, 0xffc860); }
      b.set(x, y, c);
    }
    for (let k = 0; k < 6; k++) for (let x = hx - 5 + k; x < hx + hw + 6 - k; x++) b.set(x, hy - hh - 1 - k, k === 5 ? gold[2] : k === 0 ? roofC[0] : ramp(roofC, 0.5, x, k));
    b.set(hx - 6, hy - hh - 2, gold[2]); b.set(hx + hw + 6, hy - hh - 2, gold[2]); b.set(hx - 7, hy - hh - 3, gold[3]); b.set(hx + hw + 7, hy - hh - 3, gold[3]);
    // Stairs down to the next hall, and a string of flags out over the drop.
    for (let k = 0; k < 30; k++) { b.set(hx + hw - 4 - k * 0.8, hy + 6 + k, 0xe8d8c0); b.set(hx + hw - 4 - k * 0.8, hy + 7 + k, sand[0]); }
    const cols = [0x4a8ae8, 0xf0f0e8, 0xe84a3a, 0x5ac86a, 0xf2c252];
    for (let k = 0; k < 26; k++) {
      const fx = hx + hw + 2 + k * 1.6, fy = hy - hh + Math.round(Math.sin((k / 25) * Math.PI) * 6);
      b.set(fx, fy, 0x3a2418);
      if (k % 2 === 0) { b.set(fx, fy + 1, cols[(k / 2) % 5]); b.set(fx, fy + 2, cols[(k / 2) % 5]); }
    }
  }
  return { base: b, glow };
}

// ---------------------------------------------------------------- the Moss Cathedral
// Trunks as big as towers, furrowed bark under thick moss, roots arching out,
// shelves of glowing bracket fungus, curtains of hanging moss.
function moss(seed, near) {
  const rng = new SeededRandom(seed);
  const n = pnoise(seed);
  const b = buffer(), glow = buffer();
  const bark = near ? [0x060a04, 0x0e140a, 0x182010, 0x242e18, 0x323e20] : [0x1a2416, 0x24301c, 0x303e24, 0x3e5030, 0x52663c];
  const mossC = near ? [0x163a12, 0x245a1a, 0x3a8226, 0x6ab03a] : [0x2a5a22, 0x3a7a2a, 0x5a9e3a, 0x8ac85a];
  const trunks = near ? [{ x: 34, w: 46 }] : [{ x: 26, w: 34 }, { x: 96, w: 26 }, { x: 158, w: 30 }];
  // Behind the far trunks: the dim depths of the forest, more trunks in the
  // gloom and a ceiling of leaves, so no sky shows through.
  if (!near) {
    for (let y = 0; y < SIDE_H; y++) {
      const e = 196 + Math.sin((y / SIDE_H) * TAU * 3) * 8 + (n(0, y, 1, 30) - 0.5) * 14;
      for (let x = 0; x < Math.min(SIDE_W, e); x++) {
        const tr = Math.sin(x * 0.42 + n(x, y, 30, 120) * 5);
        let c = tr > 0.55 ? 0x2a3a26 : tr > 0.2 ? 0x22301e : 0x1a2618;
        const leaf = n(x, y, 3, 3);
        if (leaf > 0.7) c = lerpColor(c, 0x3e5a2a, 0.6);
        if (x > e - 3) c = 0x14200f;
        b.set(x, y, c);
      }
    }
  }
  for (const t of trunks) {
    for (let y = 0; y < SIDE_H; y++) {
      const sway = Math.sin((y / SIDE_H) * TAU * 2 + t.x) * 6 + Math.sin((y / SIDE_H) * TAU * 5 + t.w) * 2;
      const cx = t.x + sway, hw = t.w / 2 + Math.sin((y / SIDE_H) * TAU * 3 + t.x) * 3;
      for (let x = Math.floor(cx - hw); x <= cx + hw; x++) {
        const f = (x - cx) / hw;
        // Furrows run up the bark, twisting a little.
        const fur = Math.sin((x - cx) * 0.9 + y * 0.06 + n(x, y, 6, 60) * 4);
        let k = 0.62 - f * 0.4 + fur * 0.12;
        if (fur > 0.82) k -= 0.3;
        let c = ramp(bark, k, x, y);
        // Moss on the lit side: fine cushions that thicken toward the light,
        // with darker hollows between the clumps.
        const m = n(x, y, 4, 6) * 0.6 + n(x, y, 12, 20) * 0.4;
        const want = 0.62 + f * 0.25;
        if (m > want) c = ramp(mossC, 0.3 + (m - want) * 3 - f * 0.3, x, y);
        else if (m > want - 0.04) c = lerpColor(c, mossC[0], 0.5);
        if (Math.abs(f) > 0.95) c = bark[0];
        b.set(x, y, c);
      }
    }
  }
  // Roots arching out from the trunks toward the climb.
  for (let i = 0; i < (near ? 3 : 5); i++) {
    const y0 = rng.int(0, SIDE_H - 1), t = trunks[rng.int(0, trunks.length - 1)];
    const reach = rng.int(30, near ? 70 : 60), lift = rng.int(10, 40), th = rng.range(3, near ? 7 : 5);
    for (let s = 0; s <= 1; s += 0.01) {
      const x = t.x + t.w / 2 - 4 + s * reach, y = y0 - Math.sin(s * Math.PI) * lift + s * 30;
      const w = th * (1 - s * 0.6);
      for (let k = -w; k <= w; k++) b.set(x, y + k, k < -w * 0.4 ? mossC[2] : ramp(bark, 0.55 - k / w * 0.3, x, y + k));
    }
  }
  // Bracket fungi in shelves up the trunks, glowing pale green at night.
  for (let i = 0; i < (near ? 6 : 9); i++) {
    const t = trunks[rng.int(0, trunks.length - 1)];
    const y0 = rng.int(0, SIDE_H - 1), side = rng.chance(0.7) ? 1 : -1;
    const sway = Math.sin((y0 / SIDE_H) * TAU * 2 + t.x) * 6;
    const x0 = t.x + sway + side * t.w / 2;
    for (let s = 0; s < 3; s++) {
      const w = rng.int(5, near ? 12 : 9), yy = y0 + s * 5;
      for (let x = 0; x <= w; x++) {
        const h = Math.round(2 * Math.sin((x / w) * Math.PI) + 1);
        for (let k = 0; k < h; k++) {
          const px = x0 + side * x;
          b.set(px, yy - k, k === h - 1 ? 0xd8f0c0 : 0x9ab88a);
          glow.set(px, yy - k, 0x9affb8);
        }
        b.set(x0 + side * x, yy + 1, 0x4a5a3a);
      }
    }
  }
  // Curtains of hanging moss from above, swaying strands.
  for (let i = 0; i < (near ? 10 : 14); i++) {
    const x = rng.int(0, SIDE_W - 1), y0 = rng.int(0, SIDE_H - 1), len = rng.int(12, 50);
    for (let k = 0; k < len; k++) b.set(x + Math.sin(k * 0.2 + i) * 1.2, y0 + k, k > len - 3 ? mossC[3] : mossC[1 + (k % 5 === 0 ? 1 : 0)]);
  }
  // Ferns sprouting from the bark.
  for (let i = 0; i < 12; i++) {
    const t = trunks[rng.int(0, trunks.length - 1)];
    const fx = t.x + t.w / 2 + rng.int(-4, 4), fy = rng.int(0, SIDE_H - 1);
    for (let f = -2; f <= 3; f++) for (let k = 0; k < 9; k++) b.set(fx + f * k * 0.5, fy - k + Math.abs(f) * k * 0.15, ramp(mossC, 0.85 - k * 0.04, fx, fy));
  }
  return { base: b, glow };
}

// ---------------------------------------------------------------- the Fossil Reef
// Back: cliffs of lifted reef, banded cream, coral and sand, stepping out in
// terraces with scrub on every shelf and holes worn by the old sea. Mid: the
// reef itself up close, rose-dark stone bulging with brain coral, staghorn
// branches reaching out over the climb, great ammonites set in the rock.
// At night the old sea's light comes back: fossils glow a faint sea-green.
function reef(seed, near) {
  const rng = new SeededRandom(seed);
  const n = pnoise(seed);
  const b = buffer(), glow = buffer();
  const edge = edgeFn(rng, near ? 108 : 172, near ? 26 : 14);
  const hsh = (a, c) => { let h = Math.imul(a + 7, 374761393) ^ Math.imul(c + 3, 668265263) ^ seed; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  if (!near) {
    // Terraces of lifted reef, each stepping out a little further than the
    // one above: a green-topped shelf, a shadowed undercut, then a banded
    // face that lightens as it drops; holes worn by the old sea.
    const TH = 32, NT = SIDE_H / TH;
    const face = [0xf4e6d8, 0xecd2c2, 0xe2bcae, 0xf0dccc, 0xd8aaa0, 0xe8cab8];
    for (let y = 0; y < SIDE_H; y++) {
      const wob = n(0, y, 1, 40) * 6;
      const yy = y + wob;
      const T = ((Math.floor(yy / TH) % NT) + NT) % NT, ty = ((yy % TH) + TH) % TH;
      const step = (hsh(T, 1) - 0.5) * 34;
      const e = edge(y) + step - ty * 0.35;
      for (let x = 0; x < Math.min(SIDE_W, e + 1); x++) {
        const d = e - x;
        let c = face[Math.floor((yy + n(x, y, 40, 10) * 4) / 5) % face.length];
        // Light from the open side: the face lightens toward its edge and down.
        c = lerpColor(c, 0x8a6474, Math.max(0, 0.28 - ty * 0.008 - Math.min(0.2, d < 30 ? (30 - d) * 0.006 : 0)));
        if (ty < 2) c = ty === 0 ? 0x9ad0a8 : 0x6aa486;
        else if (ty < 3 && n(x, y, 3, 3) > 0.4) c = 0x5a9478;
        else if (ty < 7) c = lerpColor(c, 0x6a4a5a, 0.42 - (ty - 3) * 0.08);
        // Weathering: fine vertical runnels down each face.
        if (ty > 8 && n(x, y, 2, 30) > 0.72) c = lerpColor(c, 0xb08a90, 0.3);
        if (d < 2) c = d < 1 ? 0xfff8f0 : lerpColor(c, 0xfff0e4, 0.5);
        b.set(x, y, c);
      }
    }
    // Sea-worn holes: dark pockets, lit on their lower lip.
    for (let i = 0; i < 26; i++) {
      const cy = rng.int(0, SIDE_H - 1), cx = rng.int(8, Math.max(9, Math.round(edge(cy)) - 30)), rx = rng.range(2, 7), ry = rx * rng.range(0.6, 1.1);
      for (let dy = -ry - 1; dy <= ry + 1; dy++) for (let dx = -rx - 1; dx <= rx + 1; dx++) {
        const e2 = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
        if (e2 < 1) b.set(cx + dx, cy + dy, lerpColor(0x5a3a48, 0x2a1a24, 1 - dy / ry * 0.5 - 0.5));
        else if (e2 < 1.5 && dy > 0) b.set(cx + dx, cy + dy, 0xfff4e8);
      }
    }
    // Arches worn right through, the sky beyond.
    for (let i = 0; i < 2; i++) {
      const cy = rng.int(0, SIDE_H - 1), cx = rng.int(60, 140), rx = rng.int(8, 13), ry = rng.int(13, 19);
      for (let dy = -ry - 2; dy <= ry + 2; dy++) for (let dx = -rx - 2; dx <= rx + 2; dx++) {
        const e2 = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
        if (cx + dx > edge(cy + dy) - 6) continue;
        if (e2 < 1) b.set(cx + dx, cy + dy, lerpColor(0x9ad0ec, 0xfff0e4, (dy + ry) / (2 * ry)));
        else if (e2 < 1.4) b.set(cx + dx, cy + dy, dx > 0 ? 0xfff6ec : 0x8a6474);
      }
    }
    for (let i = 0; i < 90; i++) {
      const y = rng.int(0, SIDE_H - 1), x = rng.int(0, Math.max(1, Math.round(edge(y)) - 2));
      glow.set(x, y, 0x5ad8c8);
    }
    return { base: b, glow };
  }
  // ---- near: the reef itself, close up.
  const rock = [0x2a181e, 0x3c2228, 0x522e32, 0x6a3e3e, 0x84524c];
  for (let y = 0; y < SIDE_H; y++) {
    const e = edge(y);
    for (let x = 0; x < Math.min(SIDE_W, e + 1); x++) {
      const d = e - x;
      // Pitted limestone: big soft lumps, small dark pits in it.
      const lump = n(x, y, 22, 22);
      let k = 0.3 + lump * 0.45 + Math.min(0.3, Math.max(0, 10 - d) * 0.03);
      const pit = n(x, y, 4, 4);
      if (pit > 0.74) k -= 0.35; else if (pit < 0.2) k += 0.12;
      let c = ramp(rock, k, x, y);
      if (((y + Math.round(n(x, y, 50, 60) * 12)) % 13 + 13) % 13 === 0) c = lerpColor(c, 0xa86a5a, 0.35);
      // Shell hash: tiny cream fans scattered through it.
      if (hsh(Math.floor(x / 4), Math.floor(y / 3)) < 0.05 && x % 4 === 1) { c = y % 3 === 0 ? 0xf0dcc8 : 0xb88a78; }
      if (d < 2) c = d < 1 ? 0x140a0e : 0xd88070;
      b.set(x, y, c);
    }
  }
  // Brain coral heads bulging out of the reef, their grooves winding.
  for (let i = 0; i < 11; i++) {
    const y0 = rng.int(0, SIDE_H - 1), R = rng.int(8, 22), x0 = edge(y0) - R * rng.range(0.2, 1.4);
    const hue = rng.chance(0.5) ? [0x4a2a2e, 0x7a4038, 0xa85e4a, 0xd88a68, 0xf8b890] : [0x34302a, 0x5a5440, 0x8a8056, 0xb8aa72, 0xe0d4a0];
    for (let dy = -R; dy <= R; dy++) for (let dx = -R * 1.15; dx <= R * 1.15; dx++) {
      const e2 = (dx * dx) / (R * R * 1.3) + (dy * dy) / (R * R);
      if (e2 > 1) continue;
      const mx = x0 + dx, my = y0 + dy;
      const gv = Math.sin(n(mx, my, 5, 5) * 18 + n(mx, my, 11, 11) * 9);
      let k = 0.62 - dy / R * 0.3 + dx / R * 0.12 - e2 * 0.2 + (gv > 0.35 ? 0.22 : gv < -0.45 ? -0.32 : 0);
      let c = ramp(hue, k, mx, my);
      if (e2 > 0.88) c = dx > 0 && dy < R * 0.3 ? hue[4] : hue[0];
      b.set(mx, my, c);
    }
  }
  // Great ammonites set into the rock; their sutures glow at night.
  for (let i = 0; i < 3; i++) {
    const cy = rng.int(0, SIDE_H - 1), R = rng.int(16, 26), cx = rng.int(R + 4, Math.max(R + 5, Math.round(edge(cy)) - R - 10));
    for (let dy = -R - 1; dy <= R + 1; dy++) for (let dx = -R - 1; dx <= R + 1; dx++) {
      const r = Math.hypot(dx, dy);
      if (r > R + 1) continue;
      if (r > R) { b.set(cx + dx, cy + dy, 0x1a0e12); continue; }
      const a = Math.atan2(dy, dx);
      const u = (Math.log(Math.max(0.7, r) / (R * 0.05)) / 0.19 - a) / TAU, f = u - Math.floor(u);
      const lightK = -(dx * 0.6 + dy) / R;
      let c = f < 0.12 ? 0x2a181c : Math.sin(a * (12 + r * 0.5)) > 0.45 ? 0xd8b8a0 : 0xb08878;
      c = lerpColor(c, lightK > 0 ? 0xfff0e0 : 0x2a1620, Math.min(0.5, Math.abs(lightK) * 0.45));
      b.set(cx + dx, cy + dy, c);
      if (f < 0.12 && f > 0.04 && r > 3) glow.set(cx + dx, cy + dy, 0x6affd8);
    }
  }
  // Sea fans spread out past the edge against the sky, lattice and all.
  for (let i = 0; i < 6; i++) {
    const y0 = rng.int(0, SIDE_H - 1), R = rng.int(16, 30), x0 = edge(y0) - 4, tilt = rng.range(-0.5, 0.3);
    const col = rng.chance(0.5) ? [0xe8806a, 0xffb89a, 0x8a3a3a] : [0xc86a8a, 0xf0a8c0, 0x6a2a4a];
    for (let dy = -R; dy <= R; dy++) for (let dx = 0; dx <= R; dx++) {
      const r = Math.hypot(dx, dy);
      if (r > R || r < 2) continue;
      const a = Math.atan2(dy, dx) - tilt;
      if (Math.abs(a) > 1.25) continue;
      const rib = Math.abs(Math.sin(a * 9)) < 0.16, ring = Math.abs(Math.sin(r * 0.8)) < 0.2;
      if (rib || ring || r > R - 1) b.set(x0 + dx, y0 + dy, r > R - 1 ? col[1] : dy < 0 ? col[0] : col[2]);
    }
  }
  // Staghorn branches reaching out over the climb from the edge.
  for (let i = 0; i < 5; i++) {
    const y0 = rng.int(0, SIDE_H - 1);
    const grow = (x, y, ang, th, depth) => {
      for (let k = 0; k < 16 - depth * 3 && th > 0.8; k++) {
        for (let t = -th; t <= th; t++) b.set(x, y + t, t < -th * 0.3 ? 0xf0a088 : t > th * 0.5 ? 0x4a2a2e : 0xb0685a);
        x += Math.cos(ang); y += Math.sin(ang); ang += (n(x, y, 8, 8) - 0.5) * 0.3; th *= 0.95;
      }
      if (depth < 3) { grow(x, y, ang - 0.5, th * 0.85, depth + 1); grow(x, y, ang + 0.45, th * 0.8, depth + 1); }
      else { b.set(x, y, 0xffe0cc); glow.set(x, y, 0x9afff0); }
    };
    grow(edge(y0) - 4, y0, rng.range(-0.7, 0.1), rng.range(2.2, 3.2), 0);
  }
  // Polyps: pinpricks of the old sea's light.
  for (let i = 0; i < 140; i++) {
    const y = rng.int(0, SIDE_H - 1), x = rng.int(0, Math.max(1, Math.round(edge(y)) - 3));
    glow.set(x, y, i % 3 ? 0x6af0d8 : 0xb8fff0);
  }
  return { base: b, glow };
}

// ---------------------------------------------------------------- the Starfall Crater
// Back: the crater's own wall, dark violet rock in thrown-up layers, cracked
// by fractures that fan out from the impact, gold seams of star-metal in it.
// Mid: slabs of black glass as big as houses, flung up and frozen at angles,
// their facets catching violet and cyan, lumps of star-metal wedged between.
// At night the seams and the metal glow.
function starfall(seed, near) {
  const rng = new SeededRandom(seed);
  const n = pnoise(seed);
  const b = buffer(), glow = buffer();
  const rock = near ? [0x05050c, 0x0c0c1a, 0x16142a, 0x22203c, 0x302c52] : [0x1c1a34, 0x262444, 0x322e56, 0x423c6c, 0x58508a];
  const edge = edgeFn(rng, near ? 104 : 180, near ? 28 : 20);
  for (let y = 0; y < SIDE_H; y++) {
    const e = edge(y);
    for (let x = 0; x < Math.min(SIDE_W, e + 1); x++) {
      const d = e - x;
      // Layers thrown up and tilted by the impact.
      const tilt = y + x * 0.35 + n(x, y, 40, 50) * 14;
      const layer = Math.floor(tilt / 11);
      let k = 0.35 + ((layer * 37) % 7) / 18 + (n(x, y, 10, 10) - 0.5) * 0.4 + Math.min(0.35, Math.max(0, 8 - d) * 0.05);
      let c = ramp(rock, k, x, y);
      if (((Math.round(tilt) % 11) + 11) % 11 === 0) c = rock[0];
      // Fractures fanning out.
      const fr = Math.abs(Math.sin(x * 0.11 + y * 0.045 + n(x, y, 20, 30) * 3));
      if (fr < 0.04) c = 0x020208;
      // Star-metal seams, glowing at night.
      if (d < 2) c = near ? 0x6a5aa8 : 0x9a8ad0;
      b.set(x, y, c);
    }
  }
  // Seams of star-metal: jagged cracks, a few per strip, glowing at night.
  for (let i = 0; i < (near ? 7 : 10); i++) {
    let x = rng.range(4, 150), y = rng.range(0, SIDE_H), ang = rng.range(0, TAU);
    const len = rng.int(24, 70);
    for (let k = 0; k < len; k++) {
      if (x > edge(y) - 3) break;
      b.set(x, y, k % 9 === 0 ? 0xfff2c8 : 0xe0a848); b.set(x + 1, y, 0x3a2a1a);
      glow.set(x, y, 0xffd070);
      if (k % 5 === 0) ang += rng.range(-0.9, 0.9);
      x += Math.cos(ang); y += Math.sin(ang);
      if (rng.chance(0.04)) { let bx = x, by = y; const ba = ang + rng.range(-1.4, 1.4); for (let j = 0; j < 8; j++) { b.set(bx, by, 0xc8902a); glow.set(bx, by, 0xffc050); bx += Math.cos(ba); by += Math.sin(ba); } }
    }
  }
  if (near) {
    // Slabs of black glass jutting from the edge, two facets and a lit ridge.
    for (let i = 0; i < 10; i++) {
      const y0 = rng.int(0, SIDE_H - 1), len = rng.int(40, 90), wd = rng.int(8, 18);
      const ang = rng.range(-0.9, 0.5);
      const x0 = edge(y0) - wd;
      for (let s2 = 0; s2 < len; s2++) {
        const k = s2 / len, hw = wd * (1 - k) + 0.6;
        const cx = x0 + Math.cos(ang) * s2, cy = y0 + Math.sin(ang) * s2;
        for (let t = -hw; t <= hw; t++) {
          const px = cx - Math.sin(ang) * t, py = cy + Math.cos(ang) * t;
          const f = t / hw;
          let c = f < 0 ? (f < -0.7 ? 0x3a3470 : 0x1c1a38) : 0x08080f;
          if (Math.abs(f) < 0.1) c = k > 0.8 ? 0xffffff : 0xa898f0;
          if (f > 0.85) c = 0x2ab8c0;
          b.set(px, py, c);
          if (Math.abs(f) < 0.1 && (s2 % 7 === 0)) glow.set(px, py, 0x9ad8ff);
        }
      }
    }
    // Lumps of star-metal, lattice-cut and glowing.
    for (let i = 0; i < 8; i++) {
      const cy = rng.int(0, SIDE_H - 1), R = rng.int(5, 11), cx = Math.min(SIDE_W - R - 1, edge(cy) - R * 0.6);
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const r = Math.hypot(dx, dy * 1.2);
        if (r > R) continue;
        const lat = (((dx + 50) % 4) === 0) || (((Math.round(dx * 0.5 + dy * 0.87) + 50) % 4) === 0);
        let c = r > R - 1 ? 0x5a3a1a : dy < -R * 0.4 ? 0xfff2c8 : lat ? 0xd8a848 : 0xb8863a;
        b.set(cx + dx, cy + dy, c);
        if (r < R - 1) glow.set(cx + dx, cy + dy, dy < 0 ? 0xffe090 : 0xffb848);
      }
    }
    // Green splash glass spattered over everything.
    for (let i = 0; i < 160; i++) {
      const y = rng.int(0, SIDE_H - 1), x = rng.int(0, Math.max(1, Math.round(edge(y)) - 2));
      b.set(x, y, 0x3ac88a); b.set(x, y - 1, 0xc8ffd8);
      if (i % 4 === 0) glow.set(x, y, 0x6affb0);
    }
  } else {
    // Faint far sparks of star-metal.
    for (let i = 0; i < 120; i++) {
      const y = rng.int(0, SIDE_H - 1), x = rng.int(0, Math.max(1, Math.round(edge(y)) - 2));
      b.set(x, y, 0xfff0c0); glow.set(x, y, 0xffe0a0);
    }
  }
  return { base: b, glow };
}

const PAINT = { cascade, monastery, moss, reef, starfall };

// Builds `far_side_<biome>_<layer>_<side>` (+ `_glow`, `_water`) textures once.
export function buildFarSideTextures(scene) {
  if (scene.textures.exists('far_side_starfall_mid_r')) return;
  for (const [id, fn] of Object.entries(PAINT)) {
    ['back', 'mid'].forEach((layer, li) => {
      ['l', 'r'].forEach((side, si) => {
        const out = fn(700 + li * 31 + si * 97 + id.length * 13, layer === 'mid');
        const key = `far_side_${id}_${layer}_${side}`;
        for (const [part, buf] of Object.entries(out)) {
          const k = part === 'base' ? key : `${key}_${part}`;
          if (scene.textures.exists(k)) scene.textures.remove(k);
          scene.textures.addCanvas(k, buf.canvas());
        }
      });
    });
  }
}
