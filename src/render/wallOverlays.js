// Biome overlays for the rock face. A biome lists the overlays it uses in
// `wall.overlays`; WallPainter runs them in order for every rock pixel.
// Each overlay reads the pixel context `p` and may change `p.c` (the colour).
// p: { x, wy, c, idx, lit, seam, dEdge, ov, dn, pal, painter }
import { bayer, lerpColor } from '../utils/color.js';
import { hashInts } from '../utils/seededRandom.js';
import { shadeFossil } from './fossilArt.js';

export const WALL_OVERLAYS = {
  // Moss and grass patches on the lit faces.
  moss(p) {
    const { pal } = p;
    if (p.ov > 0.64 && p.lit && !p.seam) p.c = p.idx >= 4 ? pal.accentC : pal.accentB;
    else if (p.ov > 0.7 && !p.seam && bayer(p.x, p.wy) < 0.5) p.c = pal.accentA;
  },
  // Thin dark horizontal bands of layered rock.
  strata(p) {
    if (((p.wy + Math.floor(p.dn * 6)) % 23 + 23) % 23 === 0 && p.dEdge > 2 && p.dn > 0.3) p.c = p.pal.rock[0];
  },
  // Pale lichen on the brightest rock.
  lichen(p) {
    if (p.ov > 0.74 && p.lit) p.c = p.pal.accentB;
  },
  // Snow on the lit faces and streaks of blue ice running down the wall.
  frost(p) {
    const { pal } = p;
    if (p.lit && p.ov > 0.42) p.c = p.idx >= 4 ? pal.accentB : pal.accentA;
    const iv = p.painter.ice(p.x * 0.08, p.wy * 0.02) * 0.7 + p.painter.ice(p.x * 0.3, p.wy * 0.05) * 0.3;
    if (iv > 0.7 && p.dEdge > 2 && !p.seam) p.c = lerpColor(p.c, pal.accentC, iv > 0.76 ? 0.6 : bayer(p.x, p.wy) < 0.5 ? 0.4 : 0.15);
  },
  // Mount Ember: a few glowing lava cracks (not everywhere) and hot glints.
  embers(p) {
    const { pal } = p;
    const near = Math.abs(p.ov - 0.5);
    if (near < 0.012 && p.dn > 0.58 && p.dEdge > 2) p.c = near < 0.005 && p.dn > 0.7 ? pal.accentC : pal.accentB;
    else if (near < 0.03 && p.dn > 0.6 && p.dEdge > 2) p.c = lerpColor(p.c, pal.accentA, 0.45);
    if ((hashInts(p.x, p.wy, 5) & 2047) < 2) p.c = pal.accentC;
  },
  // Storm Crown: dark scorch marks where lightning struck, with pale burnt edges.
  scorch(p) {
    const { pal } = p;
    const v = p.painter.ice(p.x * 0.05, p.wy * 0.05);
    if (v > 0.8 && p.dEdge > 2) p.c = v > 0.84 ? pal.rock[0] : lerpColor(p.c, pal.rock[0], 0.5);
    else if (v > 0.78 && p.dEdge > 2 && bayer(p.x, p.wy) < 0.5) p.c = pal.accentA;
    if ((hashInts(p.x, p.wy, 7) & 4095) < 2) p.c = pal.accentC;
  },
  // Dragon's Spine: the rock is scaled like the dragon's hide, rows of
  // overlapping half-moons with a lit rim.
  scales(p) {
    const { pal } = p;
    const row = Math.floor(p.wy / 6);
    const sx = ((p.x + (row % 2) * 4) % 8 + 8) % 8, sy = ((p.wy % 6) + 6) % 6;
    const d = (sx - 3.5) ** 2 / 16 + (sy - 0.5) ** 2 / 25;
    if (p.dEdge < 3 || p.seam) return;
    if (d > 0.82 && d < 1.15) p.c = sy < 2 && p.lit ? pal.accentB : lerpColor(p.c, pal.rock[0], 0.55);
    else if (d < 0.35 && p.lit && bayer(p.x, p.wy) < 0.4) p.c = lerpColor(p.c, pal.accentA, 0.35);
  },
  // Above the Clouds: the wind has scoured long pale streaks across the rock.
  windcarved(p) {
    const { pal } = p;
    if (p.dEdge < 3 || p.seam) return;
    // A few long, thin streaks, each a pale line with a shadow just below.
    const s = p.painter.ice(p.x * 0.008, p.wy * 0.09);
    const below = p.painter.ice(p.x * 0.008, (p.wy - 1) * 0.09);
    if (s > 0.8 && p.lit) p.c = lerpColor(p.c, pal.accentB, 0.4);
    else if (below > 0.8 && s <= 0.8) p.c = lerpColor(p.c, pal.rock[0], 0.4);
    if ((hashInts(p.x, p.wy, 13) & 2047) < 2) p.c = pal.accentC;
  },
  // Obsidian Spires: black glass. Lit faces carry sharp diagonal reflections.
  glass(p) {
    const { pal } = p;
    if (p.dEdge < 2 || p.seam) return;
    const band = ((p.x - Math.floor(p.wy * 0.6)) % 47 + 47) % 47;
    if (p.lit && band < 2) p.c = band === 0 ? 0xe0d8ff : lerpColor(p.c, 0xb8a8f0, 0.6);
    else if (p.lit && band < 6 && bayer(p.x, p.wy) < 0.4) p.c = lerpColor(p.c, pal.accentC, 0.45);
    if (Math.abs(p.ov - 0.5) < 0.008 && p.dn > 0.5) p.c = pal.accentA;
  },
  // Crystal Heights: the rock is grown from crystal. A diamond lattice of facets,
  // each lit a little differently, with bright edges here and there.
  facets(p) {
    const { pal } = p;
    if (p.dEdge < 2) return;
    // Warp the lattice so facets come in uneven sizes and angles.
    const wx = p.x + (p.painter.ice(p.x * 0.02, p.wy * 0.02) - 0.5) * 30;
    const u = wx + p.wy * 0.55, v = wx - p.wy * 0.55;
    const cu = Math.floor(u / 26), cv = Math.floor(v / 26);
    const h = hashInts(cu, cv, 21) % 6;
    if (h === 0) p.c = lerpColor(p.c, pal.accentB, 0.22);
    else if (h === 1) p.c = lerpColor(p.c, pal.rock[0], 0.22);
    else if (h === 2) p.c = lerpColor(p.c, pal.accentC, 0.16);
    // Only the odd facet catches the light along its upper edge.
    const eu = ((u % 26) + 26) % 26;
    if (eu < 1 && h === 0 && p.lit) p.c = pal.accentB;
  },
  // Storm Crown: rain runs down the rock in dark wet streaks with pale drips.
  wet(p) {
    if (p.dEdge < 2) return;
    if (hashInts(p.x, 0, 31) % 7 !== 0) return;
    const w = p.painter.ice(p.x * 0.7, p.wy * 0.015);
    if (w > 0.55) p.c = lerpColor(p.c, 0x0c1018, 0.35);
    if (w > 0.55 && (p.wy + p.x * 3) % 17 === 0) p.c = 0xa8b8d8;
  },
  // Aurora Ridge: glazed ice that mirrors the lights, slow green and violet sheens.
  glaze(p) {
    const { pal } = p;
    if (p.dEdge < 2 || !p.lit) return;
    const t = ((Math.floor(p.x * 0.5) + p.wy) % 64 + 64) % 64;
    if (t < 3) p.c = lerpColor(p.c, 0x5af0a0, t === 1 ? 0.45 : 0.25);
    else if (t > 31 && t < 34) p.c = lerpColor(p.c, 0x9a70f0, 0.3);
    if ((hashInts(p.x, p.wy, 17) & 1023) < 2) p.c = pal.accentB;
  },
  // Amber Hive: the rock is one great comb. Six-sided cells with waxy walls,
  // some brimming with honey, some empty and dark.
  honeycomb(p) {
    const { pal } = p;
    if (p.dEdge < 3 || p.seam) return;
    const S = 6;
    const q = ((Math.sqrt(3) / 3) * p.x - p.wy / 3) / S, r = ((2 / 3) * p.wy) / S;
    let rq = Math.round(q), rr = Math.round(r);
    const rs = Math.round(-q - r);
    const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs + q + r);
    if (dq > dr && dq > ds) rq = -rr - rs;
    else if (dr > ds) rr = -rq - rs;
    const dx = p.x - S * Math.sqrt(3) * (rq + rr / 2), dy = p.wy - S * 1.5 * rr;
    const d = Math.max(Math.abs(dx), Math.abs(dx * 0.5 + dy * 0.866), Math.abs(dx * 0.5 - dy * 0.866)) / (S * 0.866);
    if (d > 0.8) {
      // The wax walls: lit along their top, shadowed below.
      p.c = dy < 0 && p.lit ? lerpColor(p.c, pal.rock[4], 0.25) : lerpColor(p.c, pal.rock[0], 0.3);
      return;
    }
    // A few cells still hold dark old honey, a few are empty; kept dull so
    // the bright wax holds stand out against them.
    const h = hashInts(rq, rr, 43) % 13;
    if (h === 0) p.c = lerpColor(p.c, 0x8a4a08, 0.45);
    else if (h === 1) p.c = lerpColor(p.c, pal.rock[0], 0.35);
  },
  // Honey runs down the comb in slow drips, a bright bead at the bottom.
  drips(p) {
    const { pal } = p;
    if (p.dEdge < 2 || hashInts(p.x, 0, 47) % 37 !== 0) return;
    const w = p.painter.ice(p.x * 0.9, p.wy * 0.05);
    const below = p.painter.ice(p.x * 0.9, (p.wy + 1) * 0.05);
    if (w > 0.72) p.c = below <= 0.72 ? pal.accentB : lerpColor(p.c, pal.accentA, 0.6);
  },
  // Clockwork Bastion: dressed stone blocks with dark mortar; now and then an
  // iron plate riveted into the wall.
  masonry(p) {
    const { pal } = p;
    if (p.dEdge < 2) return;
    const row = Math.floor(p.wy / 12), ry = ((p.wy % 12) + 12) % 12;
    const bx = Math.floor((p.x + (row % 2) * 11) / 22), rx = (((p.x + (row % 2) * 11) % 22) + 22) % 22;
    if (ry === 0 || rx === 0) { p.c = lerpColor(p.c, pal.rock[0], 0.6); return; }
    if (ry === 1 && p.lit) p.c = lerpColor(p.c, pal.rock[4], 0.35);
    if (hashInts(bx, row, 53) % 11 === 0) {
      p.c = lerpColor(pal.rock[1], 0x4a4e58, 0.5);
      if ((rx === 2 || rx === 20) && (ry === 2 || ry === 10)) p.c = 0xb8bcc8;
      else if (ry === 1) p.c = 0x6a6e7a;
    }
  },
  // Great gears set into the masonry, half sunk, copper going green.
  gears(p) {
    const { pal } = p;
    if (p.dEdge < 4) return;
    const C = 70, gx = Math.floor(p.x / C), gy = Math.floor(p.wy / C);
    const hsh = hashInts(gx, gy, 59);
    if (hsh % 3) return;
    const cx = gx * C + 20 + (hsh >> 3) % 30, cy = gy * C + 20 + (hsh >> 6) % 30, R = 14 + (hsh >> 9) % 8;
    const dx = p.x - cx, dy = p.wy - cy, d = Math.hypot(dx, dy);
    const tooth = Math.cos(Math.atan2(dy, dx) * (8 + (hsh >> 12) % 5)) > 0.3;
    const outer = R + (tooth ? 3 : 0);
    if (d > outer + 1) return;
    if (d > outer) { p.c = lerpColor(p.c, pal.rock[0], 0.6); return; }
    if (d > R - 3 || d < 3) p.c = lerpColor(pal.accentA, dy < 0 ? pal.accentB : pal.rock[1], dy < 0 ? 0.3 : 0.4);
    else if (Math.abs(dx) < 1.5 || Math.abs(dy) < 1.5) p.c = lerpColor(pal.accentA, pal.rock[1], 0.5);
    else p.c = lerpColor(p.c, pal.rock[0], 0.35);
    if (d > R - 3 && bayer(p.x, p.wy) < 0.18) p.c = pal.accentC;
  },
  // Bone Garden: whole skeletons of old dragons lie in the rock (render/fossilArt.js).
  fossils(p) {
    if (p.dEdge < 4 || p.seam) return;
    shadeFossil(p);
  },
  // Ash settles on every ledge and lit face; now and then an ember glows in it.
  ash(p) {
    const { pal } = p;
    if (p.lit && p.ov > 0.5 && bayer(p.x, p.wy) < (p.ov - 0.5) * 3) p.c = lerpColor(p.c, 0xc8c0b8, 0.45);
    if ((hashInts(p.x, p.wy, 67) & 4095) < 2) p.c = pal.accentC;
  },
  // The Cascade: the basalt is always wet. Water runs down it in sheets
  // that shine where the light hits, dark streaks where it has soaked in,
  // and beads of water glinting on the lit faces. The rock stands in
  // columns of uneven width, broken across here and there.
  slick(p) {
    const { pal } = p;
    if (p.dEdge < 2) return;
    const u = p.x + (p.painter.ice(p.wy * 0.008, 3.1) - 0.5) * 18;
    const col = Math.floor(u / 13), cu = ((u % 13) + 13) % 13;
    const break_ = (p.wy + (hashInts(col, 0, 97) % 53)) % 53;
    if (p.dn > 0.3 && !p.seam) {
      if (cu < 1) p.c = lerpColor(p.c, pal.rock[0], 0.55);
      else if (cu < 2 && p.lit) p.c = lerpColor(p.c, pal.rock[4], 0.3);
      else if (break_ === 0 && hashInts(col, Math.floor((p.wy + (hashInts(col, 0, 97) % 53)) / 53), 5) % 3 === 0) p.c = lerpColor(p.c, pal.rock[0], 0.6);
    }
    const run = p.painter.ice(p.x * 0.35, p.wy * 0.012);
    if (hashInts(Math.floor(p.x / 3), 0, 71) % 5 < 2 && run > 0.62) {
      // A film of running water: dark and glassy, a bright line along one side.
      p.c = lerpColor(p.c, 0x061014, 0.4);
      if (p.lit && p.x % 3 === 0) p.c = lerpColor(p.c, 0xc8f0f8, 0.5);
      if ((p.wy + p.x * 7) % 23 === 0) p.c = 0xe8fcff;
    }
    if (p.lit && (hashInts(p.x, p.wy, 73) & 511) < 2) p.c = 0xffffff;
  },
  // Moss and ferns in the damp: soft moss in the hollows, and here and there
  // a fern, its fronds fanning out from a dark heart, lit along the top.
  ferns(p) {
    const { pal } = p;
    if (p.seam || p.dEdge < 3) return;
    if (p.ov > 0.62 && !p.lit && bayer(p.x, p.wy) < (p.ov - 0.62) * 6) p.c = lerpColor(p.c, pal.accentA, 0.55);
    const C = 26, gx = Math.floor(p.x / C), gy = Math.floor(p.wy / C);
    for (let oy = 0; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const cx0 = gx + ox, cy0 = gy + oy;
      const hsh = hashInts(cx0, cy0, 101);
      if (hsh % 3) continue;
      const fx = cx0 * C + 4 + (hsh >> 4) % (C - 8), fy = cy0 * C + 4 + (hsh >> 9) % (C - 8);
      const dx = p.x - fx, dy = p.wy - fy;
      const d = Math.hypot(dx, dy);
      const R = 6 + (hsh >> 13) % 5;
      if (d > R || dy > 2) continue;
      const a = Math.atan2(dy, dx);
      // Five fronds fanning up and out, arching down at their tips.
      const fronds = [-2.6, -2.1, -1.57, -1.05, -0.55];
      for (const fa of fronds) {
        const droop = fa + (d / R) * 0.5 * Math.sign(Math.cos(fa));
        if (Math.abs(a - droop) < 0.32 - d * 0.02) {
          p.c = d > R * 0.55 && a < -1.2 ? pal.accentB : d < 2 ? lerpColor(pal.accentA, pal.rock[0], 0.5) : pal.accentA;
          if (Math.abs(a - droop) < 0.06 && d > 2) p.c = lerpColor(pal.accentA, pal.rock[0], 0.35);
          return;
        }
      }
    }
  },
  // The Hanging Monastery: little arched niches cut into the rock, each with
  // a carved figure or a candle, and rows of carved marks under the ledges.
  niches(p) {
    const { pal } = p;
    if (p.dEdge < 6 || p.seam) return;
    const CW = 46, CH = 58;
    const gx = Math.floor(p.x / CW), gy = Math.floor(p.wy / CH);
    const hsh = hashInts(gx, gy, 79);
    if (hsh % 4) return;
    const cx = gx * CW + 12 + (hsh >> 3) % 22, cy = gy * CH + 14 + (hsh >> 7) % 26;
    const dx = p.x - cx, dy = p.wy - cy;
    const w = 5, h = 9;
    // An arch: straight sides, a round top.
    const inArch = Math.abs(dx) <= w && dy <= h && (dy >= 0 || dx * dx + dy * dy <= w * w);
    const onRim = Math.abs(dx) <= w + 1 && dy <= h + 1 && (dy >= 0 || dx * dx + dy * dy <= (w + 1) * (w + 1));
    if (inArch) {
      p.c = lerpColor(pal.rock[0], 0x0a0604, 0.3);
      // A candle and its glow, or a small seated figure.
      if ((hsh >> 11) % 2) {
        if (dx === 0 && dy >= h - 3 && dy < h) p.c = 0xf4ead8;
        else if (dx === 0 && dy === h - 4) p.c = 0xffd060;
        else if (Math.abs(dx) <= 2 && dy >= h - 6 && dy < h) p.c = lerpColor(p.c, 0xb86a2a, 0.35);
      } else {
        const fd = dx * dx / 9 + (dy - 5) * (dy - 5) / 12;
        if (fd < 1) p.c = dy < 3 ? lerpColor(pal.accentB, pal.rock[2], 0.4) : lerpColor(pal.accentB, pal.rock[1], 0.55);
        if (dx * dx + (dy - 1) * (dy - 1) <= 2) p.c = lerpColor(pal.accentB, pal.rock[3], 0.3);
      }
    } else if (onRim) p.c = dy < 0 || dx < 0 ? pal.rock[4] : pal.rock[1];
    else if (dy === h + 2 && Math.abs(dx) <= w + 2) p.c = pal.rock[1];
  },
  // Painted panels on the rock where a shrine once stood: whitewash framed
  // in red with a gold line, the paint flaking at the edges.
  stucco(p) {
    const { pal } = p;
    if (p.dEdge < 5 || p.seam) return;
    const CW = 52, CH = 40;
    const gx = Math.floor(p.x / CW), gy = Math.floor(p.wy / CH);
    const hsh = hashInts(gx, gy, 113);
    if (hsh % 5) return;
    const w = 14 + (hsh >> 3) % 16, h = 10 + (hsh >> 8) % 12;
    const x0 = gx * CW + 4 + (hsh >> 12) % (CW - w - 6), y0 = gy * CH + 4 + (hsh >> 16) % (CH - h - 6);
    const dx = p.x - x0, dy = p.wy - y0;
    const flake = (p.painter.ice(p.x * 0.4, p.wy * 0.4) - 0.5) * 3;
    if (dx < flake || dy < flake * 0.6 || dx > w - flake || dy > h - flake * 0.6) return;
    if (dx < 2 || dy < 2 || dx > w - 2 || dy > h - 2) p.c = lerpColor(pal.accentA, pal.rock[1], 0.25);
    else if (dx === 2 || dy === 2 || dx === w - 2 || dy === h - 2) p.c = lerpColor(pal.accentB, pal.rock[2], 0.3);
    else p.c = lerpColor(0xe8dcc4, pal.rock[3], 0.25 + (bayer(p.x, p.wy) < 0.25 ? 0.15 : 0));
    // A faded painted mark in the middle of some panels.
    if ((hsh >> 20) % 2 && Math.abs(dx - w / 2) < 2 && Math.abs(dy - h / 2) < 3) p.c = lerpColor(pal.accentA, 0xe8dcc4, 0.35);
  },
  // The Moss Cathedral: a deep cushion of moss over the old stone, bright
  // on top of every bump, with tiny glowing sporecaps here and there.
  cushion(p) {
    const { pal } = p;
    if (p.dEdge < 2) return;
    const m = p.ov * 0.7 + p.painter.ice(p.x * 0.12, p.wy * 0.12) * 0.3;
    if (m > 0.5) {
      const k = Math.min(1, (m - 0.5) * 4);
      p.c = p.lit ? lerpColor(pal.accentA, pal.accentB, k * 0.7) : p.idx <= 1 ? lerpColor(pal.rock[1], pal.accentA, 0.5) : lerpColor(pal.accentA, pal.rock[2], 0.35);
      if (p.lit && bayer(p.x, p.wy) < k * 0.25) p.c = pal.accentC;
    } else if (m > 0.46 && bayer(p.x, p.wy) < (m - 0.46) * 25) p.c = lerpColor(p.c, pal.accentA, 0.5);
    if ((hashInts(p.x, p.wy, 83) & 1023) < 2) p.c = 0xd8ffa8;
  },
  // Roots creeping down through the moss and into the cracks, bark-brown
  // with a lit edge, splitting as they go.
  rootveins(p) {
    const { pal } = p;
    if (p.dEdge < 4) return;
    const wob = p.painter.ice(p.wy * 0.025, Math.floor(p.x / 38) * 3.7) * 22;
    const cx = Math.floor(p.x / 38) * 38 + 19 + wob - 11;
    const d = Math.abs(p.x - cx);
    const on = hashInts(Math.floor(p.x / 38), Math.floor(p.wy / 140), 89) % 3 !== 0;
    if (!on) return;
    const w = 1.5 + p.painter.ice(p.x * 0.01, p.wy * 0.01) * 2.5;
    if (d < w) p.c = d < w - 1 ? (p.x < cx ? 0x8a6a40 : 0x4a3220) : 0x2a1c10;
    else if (d < w + 1) p.c = lerpColor(p.c, pal.rock[0], 0.5);
  },
  // Glowing mineral veins and scattered glints.
  veins(p) {
    const { pal } = p;
    if (Math.abs(p.ov - 0.5) < 0.01 && p.dEdge > 2) p.c = pal.accentC;
    if ((hashInts(p.x, p.wy, 3) & 1023) < 2) p.c = pal.accentB;
  },
};

// The overlays to run for a biome palette on a given segment. Segments with
// the 'strata' feature add strata bands unless the biome opts out.
export function overlaysFor(pal, segment) {
  const names = pal.wall.overlays;
  const addStrata = segment.features.includes('strata') && pal.wall.featureStrata !== false && !names.includes('strata');
  return (addStrata ? ['strata', ...names] : names).map((n) => WALL_OVERLAYS[n]);
}

// Colour on top of a rest ledge.
export function ledgeTopColor(pal) {
  return pal.wall.ledgeTop === 'rock4' ? pal.rock[4] : pal[pal.wall.ledgeTop];
}
