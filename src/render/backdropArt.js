// Biome backdrop layers: distant scenery that belongs to one part of the
// mountain. Biomes list their layers in `backdrop.layers`; each layer names a
// painter below. Layers are drawn in natural colours and tinted by daylight.
import { makeCanvas } from '../utils/pixelGrid.js';
import { lerpColor, bayer, rgb } from '../utils/color.js';
import { SeededRandom, makeNoise2D } from '../utils/seededRandom.js';

// Midpoint-displacement ridge line that wraps around horizontally.
export function ridgeHeights(rng, width, base, amp, roughness, wrap = true) {
  const pts = new Array(width + 1).fill(0);
  let step = 128;
  const n = Math.ceil(width / step) * step;
  const arr = new Array(n + 1).fill(base);
  for (let i = 0; i <= n; i += step) arr[i] = base + rng.range(-amp, amp);
  if (wrap) arr[n] = arr[0];
  let a = amp;
  while (step > 1) {
    const half = step / 2;
    a *= roughness;
    for (let i = half; i < n; i += step) arr[i] = (arr[i - half] + arr[i + half]) / 2 + rng.range(-a, a);
    step = half;
  }
  for (let x = 0; x <= width; x++) pts[x] = arr[Math.min(x, n)];
  return pts;
}

function toCanvas(w, h, paint) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const put = (x, y, col) => {
    const i = (y * w + x) * 4;
    const [r, g, b] = rgb(col);
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
  };
  paint(put);
  ctx.putImageData(img, 0, 0);
  return c;
}

// Sharp snow peaks with dark rock on the steepest faces, above a glacier:
// a pale-blue ice field cut by crevasses.
function glacier({ w, h, seed }) {
  const rng = new SeededRandom(seed);
  const ridge = ridgeHeights(rng, w, 44, 34, 0.62);
  const noise = makeNoise2D(seed);
  const ice = makeNoise2D(seed + 1);
  const slopeAt = (x) => (ridge[(x + 3) % w] - ridge[(x - 3 + w) % w]) / 6;
  const fieldTop = (x) => h - 46 + Math.round(Math.sin(x / w * Math.PI * 4) * 3 + (ice(x * 0.03, 0) - 0.5) * 10);
  return toCanvas(w, h, (put) => {
    for (let x = 0; x < w; x++) {
      const top = Math.round(ridge[x]);
      const slope = slopeAt(x);
      const ft = fieldTop(x);
      for (let y = Math.max(0, top); y < h; y++) {
        const d = y - top;
        const n = noise(x * 0.05, y * 0.06);
        let col;
        if (y < ft) {
          // Peaks: right-facing slopes and diagonal gullies are in shadow.
          const gully = noise((x + d * 0.7) * 0.08, d * 0.02) > 0.6;
          const shade = (slope > 0.15 && d < 34 + n * 26) || (gully && d > 5);
          col = shade ? 0xa8bcdc : 0xf4f8ff;
          if (Math.abs(slope) > 0.75 && d > 2 && d < 6 + n * 24 && noise(x * 0.3, y * 0.1) > 0.35) col = shade ? 0x4a5874 : 0x67779a;
          else if (gully && d > 10 && n > 0.62) col = 0x67779a;
          if (y > ft - 6 && bayer(x, y) < (y - (ft - 6)) / 6) col = 0xdce8f6;
        } else {
          // Glacier: smooth ice with crevasses that follow the flow.
          const fd = y - ft;
          col = fd < 2 ? 0xffffff : fd < 6 ? 0xe4eefa : 0xc4daf2;
          const c = ice(x * 0.12, fd * 0.35);
          if (fd > 4 && c > 0.72 && (fd + Math.floor(x / 9)) % 5 === 0) col = 0x5a80bc;
          else if (fd > 4 && c > 0.66 && (fd + Math.floor(x / 9)) % 5 === 1) col = 0x8eb4e2;
          if (fd > 26) col = lerpColor(col, 0xb4cbe8, Math.min(1, (fd - 26) / 20));
        }
        put(x, y, col);
      }
    }
  });
}

// Seracs: chunky, leaning blocks of glacier ice with broken tops and blue
// layer bands, standing on a snow shelf.
function seracs({ w, h, seed }) {
  const rng = new SeededRandom(seed);
  const noise = makeNoise2D(seed);
  const px = new Array(w * h).fill(null);
  const set = (x, y, c) => { if (y >= 0 && y < h) px[y * w + (((x % w) + w) % w)] = c; };
  const shelf = h - 22;
  const blocks = Array.from({ length: 18 }, () => ({ x: rng.int(0, w - 1), tall: rng.int(18, 58), hw: rng.int(9, 20), lean: rng.range(-0.18, 0.18), s: rng.int(0, 99) }));
  blocks.sort((a, b) => b.tall - a.tall);
  for (const b of blocks) {
    for (let dx = -b.hw; dx <= b.hw; dx++) {
      // Broken, stepped top edge.
      const jag = Math.round((noise((b.x + dx) * 0.25, b.s) - 0.5) * 14 + Math.abs(dx) / b.hw * 6);
      const top = shelf - b.tall + Math.max(0, jag);
      for (let y = top; y < h; y++) {
        const cx = Math.round(b.x + dx + (shelf - y) * b.lean);
        const edge = Math.abs(dx) === b.hw;
        let c = dx < -b.hw / 3 ? 0xeaf3ff : dx < b.hw / 3 ? 0xc8dcf4 : 0x96b4dc;
        if ((y + b.s) % 9 === 0 && !edge) c = lerpColor(c, 0x6a90c8, 0.5);
        if (y - top < 2) c = 0xffffff;
        if (edge) c = 0x5e7cae;
        set(cx, y, c);
      }
    }
  }
  for (let x = 0; x < w; x++) {
    const sTop = shelf + Math.round(Math.sin(x / w * Math.PI * 6) * 2 + (noise(x * 0.05, 3) - 0.5) * 4);
    for (let y = sTop; y < h; y++) {
      const d = y - sTop;
      set(x, y, d < 2 ? 0xffffff : d < 8 && bayer(x, y) < 0.5 ? 0xf0f6ff : 0xdfeaf7);
    }
  }
  return toCanvas(w, h, (put) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[y * w + x] !== null) put(x, y, px[y * w + x]);
  });
}

// Sparse pixel buffer that wraps horizontally; painters draw back to front.
function layerBuffer(w, h) {
  const px = new Array(w * h).fill(null);
  return {
    set: (x, y, c) => { if (y >= 0 && y < h && c !== null) px[y * w + (((Math.round(x) % w) + w) % w)] = c; },
    get: (x, y) => (y >= 0 && y < h ? px[y * w + (((x % w) + w) % w)] : null),
    canvas: () => toCanvas(w, h, (put) => {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[y * w + x] !== null) put(x, y, px[y * w + x]);
    }),
  };
}

// Green Rise: rolling meadows with field patches, a winding river and farmhouses.
function valley({ w, h, seed }) {
  const rng = new SeededRandom(seed);
  const noise = makeNoise2D(seed);
  const b = layerBuffer(w, h);
  const hills = [
    { base: 22, amp: 10, cols: [0x8fbf6a, 0x7aae5a, 0x6a9a50] },
    { base: 46, amp: 9, cols: [0x7ab05a, 0x66a04c, 0x568a42] },
    { base: 70, amp: 7, cols: [0x6aa24e, 0x5a9044, 0x4a7c3a] },
  ];
  hills.forEach((hl, i) => {
    const ridge = ridgeHeights(rng, w, hl.base, hl.amp, 0.5);
    for (let x = 0; x < w; x++) {
      const top = Math.round(ridge[x]);
      for (let y = top; y < h; y++) {
        const d = y - top;
        // Light on the crest, darker into the fold, dithered between.
        let c = d < 2 ? hl.cols[0] : d < 9 ? (bayer(x, y) < (9 - d) / 9 ? hl.cols[0] : hl.cols[1]) : hl.cols[1];
        if (d > 16 && bayer(x, y) < Math.min(1, (d - 16) / 14)) c = hl.cols[2];
        // A few field patches in wheat and young green, outlined by hedges.
        const fx = Math.floor((x + i * 9) / 26), fy = Math.floor((y + i * 3) / 9);
        const f = noise(fx * 1.7 + i * 7, fy * 1.3);
        if (d > 4 && f > 0.78) {
          c = (fx + fy) % 3 === 0 ? 0xd2c27a : (fx + fy) % 3 === 1 ? 0xa8c86a : 0x8cba5a;
          if ((x + i * 9) % 26 === 0 || (y + i * 3) % 9 === 0) c = 0x3e6a34;
        }
        b.set(x, y, c);
      }
    }
  });
  // River: winds down the valley, wider as it comes closer.
  for (let y = 30; y < h; y++) {
    const k = (y - 30) / (h - 30);
    const cx = w * 0.55 + Math.sin(y * 0.09) * 30 * (0.4 + k) + Math.sin(y * 0.031 + 1) * 40;
    const hw = 1 + k * 4;
    for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) b.set(x, y, x === Math.round(cx - hw) ? 0xd8f0ff : (x + y) % 5 === 0 ? 0xb8e0f8 : 0x6aa8d8);
  }
  // Farmhouses with red roofs.
  for (let i = 0; i < 9; i++) {
    const x = rng.int(0, w - 1), y = rng.int(36, h - 14);
    if (b.get(x, y) === 0x6aa8d8) continue;
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 4; dx++) b.set(x + dx, y + dy, dy === 0 ? 0xb0483a : dx === 3 ? 0xc8c0b0 : 0xf0ece0);
    b.set(x + 1, y - 1, 0xc85a48); b.set(x + 2, y - 1, 0xc85a48);
  }
  return b.canvas();
}

// Green Rise: a dense pine treeline close behind the wall, with pale birches.
function forest({ w, h, seed }) {
  const rng = new SeededRandom(seed);
  const b = layerBuffer(w, h);
  const floor = 26;
  for (let x = 0; x < w; x++) for (let y = floor; y < h; y++) b.set(x, y, y < floor + 3 ? 0x2e5a34 : 0x23402a);
  const trees = Array.from({ length: 150 }, () => ({ x: rng.int(0, w - 1), tall: rng.int(12, 26), birch: rng.chance(0.08) }));
  trees.sort((a, c) => a.tall - c.tall);
  for (const t of trees) {
    const top = floor + 8 - t.tall + rng.int(0, 6);
    if (t.birch) {
      for (let y = top + 4; y < floor + 6; y++) b.set(t.x, y, y % 4 === 0 ? 0x3a3a3a : 0xe8e4dc);
      for (let y = top; y < top + 10; y++) for (let dx = -3; dx <= 3; dx++) if (Math.abs(dx) + Math.abs(y - top - 4) < 5) b.set(t.x + dx, y, dx < 0 ? 0x9ac85a : 0x6a9a44);
      continue;
    }
    for (let y = 0; y < t.tall; y++) {
      const hw = Math.floor((y / t.tall) * 4.5);
      for (let dx = -hw; dx <= hw; dx++) b.set(t.x + dx, top + y, dx < 0 ? 0x3f7044 : dx > 1 ? 0x24482c : 0x2f5a36);
    }
  }
  return b.canvas();
}

// Stone Wall: rounded granite domes and sheer faces with dark water streaks,
// a forest at their feet.
function granite({ w, h, seed }) {
  const rng = new SeededRandom(seed);
  const noise = makeNoise2D(seed);
  const b = layerBuffer(w, h);
  const SHADES = [0x5e5b58, 0x76726c, 0x938e86, 0xb0aaa0, 0xcbc5b8];
  const domes = Array.from({ length: 6 }, (_, i) => ({ x: (i / 6) * w + rng.range(-25, 25), r: rng.range(36, 78), top: rng.range(8, 46), flat: rng.range(0.5, 1) }));
  const trees = h - 20;
  for (let x = 0; x < w; x++) {
    let top = h, lit = 0;
    for (const d of domes) {
      for (const xx of [x, x - w, x + w]) {
        const dx = (xx - d.x) / d.r;
        if (Math.abs(dx) >= 1) continue;
        const t = d.top + (1 - Math.sqrt(1 - dx * dx)) * d.r * d.flat;
        if (t < top) { top = t; lit = dx; }
      }
    }
    top = Math.round(Math.min(top, h - 34));
    for (let y = top; y < h; y++) {
      const d = y - top;
      // Light from the upper left: a smooth ramp across the dome, dithered.
      const v = 0.62 - lit * 0.42 - Math.min(0.2, d / 300) + (noise(x * 0.05, y * 0.05) - 0.5) * 0.25;
      let idx = Math.max(0, Math.min(4, Math.floor(v * 5 + (bayer(x, y) - 0.5) * 0.8)));
      if (d < 2) idx = Math.min(4, idx + 1);
      if (noise(x * 0.4, y * 0.01) > 0.66 && d > 4) idx = Math.max(0, idx - 2);
      b.set(x, y, SHADES[idx]);
    }
  }
  // A thin waterfall thread down one of the faces.
  const wx = Math.round(domes[2].x + 8);
  for (let y = Math.round(domes[2].top + 12); y < trees; y++) b.set(wx + Math.round(Math.sin(y * 0.2) * 0.6), y, y % 3 ? 0xe8f4ff : 0xb8d8f0);
  // Pines along the bottom.
  for (let x = 0; x < w; x++) for (let y = trees + 6; y < h; y++) b.set(x, y, 0x2e4a32);
  for (let i = 0; i < 120; i++) {
    const x = rng.int(0, w - 1), tall = rng.int(6, 13), top = trees + 8 - tall;
    for (let y = 0; y < tall; y++) {
      const hw = Math.floor((y / tall) * 2.6);
      for (let dx = -hw; dx <= hw; dx++) b.set(x + dx, top + y, dx < 0 ? 0x4a6e48 : 0x2e4a32);
    }
  }
  return b.canvas();
}

// Stone Wall: free-standing rock towers rising out of a misty gorge.
function pinnacles({ w, h, seed }) {
  const rng = new SeededRandom(seed);
  const noise = makeNoise2D(seed);
  const b = layerBuffer(w, h);
  const mist = h - 24;
  const towers = Array.from({ length: 12 }, () => ({ x: rng.int(0, w - 1), tall: rng.int(28, 84), hw: rng.int(7, 15), s: rng.int(0, 99) }));
  towers.sort((a, c) => c.tall - a.tall);
  for (const t of towers) {
    for (let dx = -t.hw; dx <= t.hw; dx++) {
      const top = mist - t.tall + Math.round(Math.abs(dx) / t.hw * 7 + (noise((t.x + dx) * 0.4, t.s) - 0.5) * 8);
      for (let y = top; y < h; y++) {
        const k = Math.max(0, (y - top) / t.tall);
        // Towers taper towards a broken summit and flare out at the base.
        const wide = Math.round(t.hw * (0.4 + k * 0.7 + Math.pow(Math.max(0, k - 0.75), 2) * 3));
        if (Math.abs(dx) > wide) continue;
        let c = dx < -wide / 3 ? 0x9c9286 : dx < wide / 3 ? 0x7c736a : 0x5c554e;
        if (noise((t.x + dx) * 0.6, y * 0.04) > 0.7) c = 0x4f4943;
        else if ((y + t.s + Math.floor(noise(t.x * 0.1, y * 0.3) * 3)) % 13 === 0 && Math.abs(dx) < wide - 1) c = 0xb0a694;
        if (y - top < 2) c = 0xb8ae9e;
        if (Math.abs(dx) === wide) c = 0x3e3934;
        b.set(t.x + dx, y, c);
      }
    }
  }
  for (let x = 0; x < w; x++) {
    const mt = mist + Math.round(Math.sin(x / w * Math.PI * 8) * 3 + (noise(x * 0.06, 2) - 0.5) * 6);
    for (let y = mt; y < h; y++) {
      const d = y - mt;
      if (d < 6 && bayer(x, y) > d / 6) continue;
      b.set(x, y, d < 8 ? 0xc4cad4 : 0xa4acb8);
    }
  }
  return b.canvas();
}

// Above the Clouds: towering cumulus clouds, lit from the upper left with
// lavender shade on their undersides.
function cumulus({ w, h, seed }) {
  const rng = new SeededRandom(seed);
  const base = h - 18;
  const mask = new Uint8Array(w * h);
  const at = (x, y) => (y < 0 || y >= h ? 0 : mask[y * w + (((x % w) + w) % w)]);
  const disc = (cx, cy, r) => {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if (y >= 0 && y < h && (x - cx) ** 2 + (y - cy) ** 2 <= r * r) mask[y * w + (((x % w) + w) % w)] = 1;
    }
  };
  for (let i = 0; i < 7; i++) {
    // Each tower: a stack of puffs that narrows towards the top.
    const cx = (i / 7) * w + rng.range(-20, 20), tall = rng.range(40, 120), wide = rng.range(24, 40);
    // A solid core so the puffs read as one tower, then cauliflower bumps on its edge.
    for (let t = 0; t <= 1; t += 0.06) disc(cx + Math.sin(t * 5 + i) * 4, base - t * tall, wide * 0.55 * (1 - t * 0.55));
    for (let k = 0; k < 40; k++) {
      const t = Math.pow(rng.next(), 1.3);
      const r = wide * 0.55 * (1 - t * 0.55);
      const a = rng.range(-Math.PI, 0.2);
      disc(cx + Math.cos(a) * r, base - t * tall + Math.sin(a) * r * 0.6, rng.range(5, 11) * (1 - t * 0.35));
    }
  }
  for (let x = 0; x < w; x++) for (let y = base - 6; y < h; y++) mask[y * w + x] = 1;
  return toCanvas(w, h, (put) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!at(x, y)) continue;
      let c = lerpColor(0xf4f0fa, 0xd4cce8, Math.max(0, Math.min(1, (y - (base - 90)) / 110)));
      if (!at(x - 2, y - 3) || !at(x, y - 2)) c = 0xffffff;
      else if (!at(x + 2, y + 3) || !at(x + 3, y + 1)) c = bayer(x, y) < 0.6 ? 0xb8aed8 : 0xc8c0e2;
      put(x, y, c);
    }
  });
}

// Above the Clouds: far summits that break through the cloud floor.
function cloudPeaks({ w, h, seed }) {
  const rng = new SeededRandom(seed);
  const noise = makeNoise2D(seed);
  const b = layerBuffer(w, h);
  const floor = h - 22;
  const peaks = Array.from({ length: 9 }, () => ({ x: rng.int(0, w - 1), tall: rng.int(24, 80), hw: rng.int(20, 44), skew: rng.range(-0.4, 0.4) }));
  peaks.sort((a, c) => c.tall - a.tall);
  for (const p of peaks) {
    for (let dx = -p.hw; dx <= p.hw; dx++) {
      const k = Math.abs(dx) / p.hw;
      const ridge = (noise((p.x + dx) * 0.18, p.tall) - 0.5) * 16 * (1 - k) + Math.abs(noise((p.x + dx) * 0.5, 7) - 0.5) * 6;
      const top = Math.round(floor - p.tall * (1 - k) * (1 + p.skew * Math.sign(dx) * k) + ridge);
      const lit = dx < p.skew * p.hw * 0.5;
      for (let y = top; y < floor + 4; y++) {
        const d = y - top;
        let c = lit ? 0x625a8a : 0x3e3862;
        if (noise((p.x + dx + d * 0.6) * 0.12, d * 0.05) > 0.62) c = lit ? 0x4e4876 : 0x332e54;
        // Snow caps the top and runs down in gullies.
        const snow = d < 5 + noise((p.x + dx) * 0.3, y * 0.1) * 12 || (d < 30 && noise((p.x + dx - d * 0.5) * 0.2, d * 0.04) > 0.7);
        if (snow) c = lit ? 0xf4f0ff : 0xbcb4dc;
        b.set(p.x + dx, y, c);
      }
    }
  }
  for (let x = 0; x < w; x++) {
    const ft = floor + Math.round(Math.sin(x / w * Math.PI * 10) * 2 + (noise(x * 0.08, 5) - 0.5) * 5);
    for (let y = ft; y < h; y++) b.set(x, y, y - ft < 2 ? 0xffffff : 0xe4e0f0);
  }
  return b.canvas();
}

// Obsidian Spires: black glass needles with sharp lit facets and glowing
// magenta fissures.
function obsidianSpires({ w, h, seed }) {
  const rng = new SeededRandom(seed);
  const noise = makeNoise2D(seed);
  const b = layerBuffer(w, h);
  const spires = Array.from({ length: 16 }, () => ({ x: rng.int(0, w - 1), tall: rng.int(40, 120), hw: rng.int(6, 16), lean: rng.range(-0.15, 0.15), s: rng.int(0, 99) }));
  spires.sort((a, c) => c.tall - a.tall);
  for (const sp of spires) {
    const top = h - sp.tall;
    for (let y = top; y < h; y++) {
      const k = (y - top) / sp.tall;
      const hw = Math.max(1, Math.round(sp.hw * Math.pow(k, 0.85)));
      const cx = Math.round(sp.x + (h - y) * sp.lean);
      for (let dx = -hw; dx <= hw; dx++) {
        // Two facets: a lit glassy face on the left, a near-black one on the right.
        let c = dx < 0 ? (dx > -hw * 0.5 ? 0x3a3150 : 0x2a2438) : 0x14111c;
        if (dx === -hw) c = 0x6a5a8a;
        if (dx === 0 && k < 0.9) c = 0x8a7aa8;
        const crack = noise((sp.x + dx) * 0.5, y * 0.08 + sp.s);
        if (crack > 0.76 && Math.abs(dx) < hw - 1) c = crack > 0.82 ? 0xf09ab4 : 0xd16a8c;
        b.set(cx + dx, y, c);
      }
    }
  }
  return b.canvas();
}

// Obsidian Spires: a low black ridge cut by rivers of pink-orange glow.
function emberRidge({ w, h, seed }) {
  const rng = new SeededRandom(seed);
  const noise = makeNoise2D(seed);
  const ridge = ridgeHeights(rng, w, 34, 22, 0.62);
  return toCanvas(w, h, (put) => {
    for (let x = 0; x < w; x++) {
      const top = Math.round(ridge[x]);
      for (let y = Math.max(0, top); y < h; y++) {
        const d = y - top;
        let c = d < 2 ? 0x4a3e62 : 0x1e1828;
        if (d > 2 && noise(x * 0.06, y * 0.06) > 0.6) c = 0x2c2438;
        // Thin glowing rivers wind down the slopes, with a dim halo.
        const flow = Math.abs(noise(x * 0.05 + d * 0.012, d * 0.012) - 0.5);
        if (d > 4) {
          if (flow < 0.018) c = 0xffb07a;
          else if (flow < 0.034) c = 0xf06a6a;
          else if (flow < 0.06 && bayer(x, y) < 0.5) c = 0x6a2e4e;
        }
        put(x, y, c);
      }
    }
  });
}

// Crystal Heights: huge leaning prisms in cyan and rose with bright facets.
function crystalClusters({ w, h, seed }) {
  const rng = new SeededRandom(seed);
  const b = layerBuffer(w, h);
  const palettes = [
    [0xe8fffb, 0xa6dbe2, 0x66a2b4, 0x3e7488],
    [0xfff0fa, 0xffc8f0, 0xd890c8, 0x9a5a98],
  ];
  const prisms = [];
  for (let i = 0; i < 10; i++) {
    const cx = (i / 10) * w + rng.range(-12, 12);
    for (let k = 0; k < 4; k++) prisms.push({ x: cx + rng.range(-16, 16), tall: rng.range(30, 110), hw: rng.range(5, 12), lean: rng.range(-0.45, 0.45), pal: palettes[rng.chance(0.3) ? 1 : 0] });
  }
  prisms.sort((a, c) => c.tall - a.tall);
  for (const p of prisms) {
    const base = h - 10;
    const tip = 9;
    for (let s = 0; s < p.tall; s++) {
      const y = base - s;
      const cx = Math.round(p.x + s * p.lean);
      const hw = s > p.tall - tip ? Math.max(0, Math.round(p.hw * (p.tall - s) / tip)) : Math.round(p.hw);
      for (let dx = -hw; dx <= hw; dx++) {
        const f = (dx + hw) / (2 * hw + 1);
        let c = f < 0.3 ? p.pal[0] : f < 0.6 ? p.pal[1] : f < 0.85 ? p.pal[2] : p.pal[3];
        if (Math.abs(dx) === hw) c = p.pal[3];
        if (s % 23 === 7 && f < 0.6) c = p.pal[0];
        b.set(cx + dx, y, c);
      }
    }
  }
  for (let x = 0; x < w; x++) for (let y = h - 10; y < h; y++) b.set(x, y, y === h - 10 ? 0x96c6d4 : 0x5a8a9c);
  return b.canvas();
}

// Crystal Heights: floating rock islands crowned with small crystals.
function crystalIsles({ w, h, seed }) {
  const rng = new SeededRandom(seed);
  const b = layerBuffer(w, h);
  for (let i = 0; i < 5; i++) {
    const cx = (i / 5) * w + rng.range(0, 60), cy = rng.range(30, h - 40), rw = rng.range(16, 34), depth = rng.range(16, 34);
    for (let dx = -rw; dx <= rw; dx++) {
      const k = Math.abs(dx) / rw;
      const top = Math.round(cy - (1 - k * k) * 4);
      const bottom = Math.round(cy + (1 - k) * depth);
      for (let y = top; y <= bottom; y++) {
        let c = y - top < 2 ? 0x76a8bc : dx < 0 ? 0x4a3e6a : 0x332a4e;
        if ((y + Math.round(dx)) % 7 === 0 && y - top > 3) c = 0x5a4e80;
        b.set(cx + dx, y, c);
      }
    }
    for (let n = 0; n < 5; n++) {
      const x = Math.round(cx + rng.range(-rw * 0.7, rw * 0.7)), tall = rng.int(5, 14);
      const col = rng.chance(0.3) ? [0xffc8f0, 0xd890c8] : [0xe8fffb, 0x66a2b4];
      for (let s = 0; s < tall; s++) {
        const hw = s > tall - 3 ? 0 : 1;
        for (let dx = -hw; dx <= hw; dx++) b.set(x + dx, Math.round(cy - 3 - s), dx < 0 ? col[0] : col[1]);
      }
    }
  }
  return b.canvas();
}

// Box-blurs a wrapping ridge line so slopes shade in broad faces, not stripes.
function smoothRidge(arr, radius) {
  const n = arr.length - 1;
  return arr.map((_, x) => {
    let sum = 0;
    for (let d = -radius; d <= radius; d++) sum += arr[((x + d) % n + n) % n];
    return sum / (2 * radius + 1);
  });
}

// Which side of its peak a pixel lies on: each summit sends a crest line down
// the mountain, left of it is the lit face, right of it the shadow. Shading by
// faces (not by the slope of each column) avoids vertical stripes.
function peakFaces(ridge, w, seed) {
  const noise = makeNoise2D(seed + 7);
  const peaks = [];
  for (let x = 0; x < w; x++) {
    let top = true;
    for (let d = -22; d <= 22 && top; d++) if (d && ridge[((x + d) % w + w) % w] < ridge[x]) top = false;
    if (top && (!peaks.length || x - peaks[peaks.length - 1].x > 8)) peaks.push({ x, y: ridge[x] });
  }
  return (x, y) => {
    let best = null, bd = 1e9;
    for (const p of peaks) {
      const d = Math.abs((((x - p.x) % w) + w + w / 2) % w - w / 2);
      if (d < bd) { bd = d; best = p; }
    }
    if (!best) return false;
    const dx = (((x - best.x) % w) + w + w / 2) % w - w / 2;
    const crest = (noise(best.x * 0.1, y * 0.05) - 0.5) * 0.9 * (y - best.y) + Math.sin(y * 0.3 + best.x) * 1.5;
    return dx > crest;
  };
}

// Storm Crown: towering thunderheads with flat anvil tops and grey rain shafts.
function stormAnvils({ w, h, seed }) {
  const rng = new SeededRandom(seed);
  const noise = makeNoise2D(seed);
  const base = h - 34;
  const mask = new Uint8Array(w * h);
  const at = (x, y) => (y < 0 || y >= h ? 0 : mask[y * w + (((x % w) + w) % w)]);
  const disc = (cx, cy, r) => {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if (y >= 0 && y < h && (x - cx) ** 2 + (y - cy) ** 2 <= r * r) mask[y * w + (((x % w) + w) % w)] = 1;
    }
  };
  const towers = [];
  for (let i = 0; i < 3; i++) {
    const cx = (i / 3) * w + rng.range(-15, 15), tall = rng.range(78, 96), wide = rng.range(62, 78);
    towers.push({ cx, wide });
    // A puffy body, broad and round at the bottom, pinched below the top...
    for (let t = 0; t <= 1; t += 0.04) disc(cx + Math.sin(t * 4 + i) * 4, base - 10 - t * tall, wide * 0.5 * (1 - t * 0.55));
    for (let k = 0; k < 50; k++) {
      const t = Math.pow(rng.next(), 1.4), rr = wide * 0.5 * (1 - t * 0.55);
      disc(cx + rng.range(-1, 1) * rr, base - 10 - t * tall, rng.range(8, 15) * (1 - t * 0.4));
    }
    // ...then the anvil: a flat, thin shelf spreading downwind.
    const top = base - 10 - tall;
    for (let k = 0; k < 34; k++) {
      const dx = rng.range(-wide * 0.45, wide * 0.95);
      disc(cx + dx, top + rng.range(-1, 3) + Math.max(0, dx) * 0.05, rng.range(4, 7) * (1 - Math.max(0, dx) / (wide * 1.6)));
    }
  }
  return toCanvas(w, h, (put) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (y >= base + 4) {
        // Rain shafts hang under each tower.
        const tw = towers.find((tt) => Math.abs((((x - tt.cx) % w) + w + w / 2) % w - w / 2) < tt.wide * 0.55);
        if (tw && bayer(x, y) < 0.55 - (y - base) / 70 && (x + y) % 3 !== 0) put(x, y, 0x4a5068);
        continue;
      }
      if (!at(x, y)) continue;
      let c = lerpColor(0x8a92aa, 0x3a4058, Math.max(0, Math.min(1, (y - (base - 100)) / 110)));
      if (!at(x - 2, y - 3) || !at(x, y - 2)) c = 0xc8d0e4;
      else if (!at(x + 2, y + 3)) c = bayer(x, y) < 0.6 ? 0x2a3044 : 0x343a50;
      if (noise(x * 0.05, y * 0.08) > 0.72 && c !== 0xc8d0e4) c = lerpColor(c, 0x2a3044, 0.4);
      put(x, y, c);
    }
  });
}

// Storm Crown: a jagged black ridge, its wet edges catching the light.
function stormCrags({ w, h, seed }) {
  const rng = new SeededRandom(seed);
  const noise = makeNoise2D(seed);
  const ridge = smoothRidge(ridgeHeights(rng, w, 44, 30, 0.52), 3);
  // A few sharp teeth stand up out of the ridge.
  for (let i = 0; i < 7; i++) {
    const cx = rng.int(0, w - 1), tall = rng.range(12, 26), hw = rng.range(9, 16);
    for (let dx = -hw; dx <= hw; dx++) {
      const x = (cx + Math.round(dx) + w) % w;
      ridge[x] = Math.min(ridge[x], ridge[cx] - tall * (1 - Math.abs(dx) / hw));
    }
  }
  const shadowAt = peakFaces(ridge, w, seed);
  return toCanvas(w, h, (put) => {
    for (let x = 0; x < w; x++) {
      const top = Math.round(ridge[x]);
      for (let y = Math.max(0, top); y < h; y++) {
        const d = y - top;
        const shadow = shadowAt(x, y);
        let c = shadow ? 0x14161e : 0x2a2f3a;
        if (d < 2) c = shadow ? 0x4a5468 : 0x8a96b4;
        else if (d < 4 && !shadow) c = 0x4a5468;
        if (d > 6 && noise(x * 0.09, y * 0.04) > 0.7) c = 0x2c3240;
        put(x, y, c);
      }
    }
  });
}

// Aurora Ridge: snow peaks at night, their snow faintly green under the lights.
function auroraPeaks({ w, h, seed }) {
  const rng = new SeededRandom(seed);
  const noise = makeNoise2D(seed);
  const ridge = smoothRidge(ridgeHeights(rng, w, 50, 38, 0.55), 2);
  const shadowAt = peakFaces(ridge, w, seed);
  return toCanvas(w, h, (put) => {
    for (let x = 0; x < w; x++) {
      const top = Math.round(ridge[x]);
      for (let y = Math.max(0, top); y < h; y++) {
        const d = y - top;
        const shadow = shadowAt(x, y);
        const snow = d < 18 + noise(x * 0.07, y * 0.05) * 16;
        let c = shadow ? 0x1a2c3c : 0x24404e;
        if (snow) c = shadow ? 0x4a7a80 : (bayer(x, y) < 0.5 ? 0xb8f0d8 : 0x9ae0c8);
        if (d < 1) c = 0xd8fff0;
        put(x, y, c);
      }
    }
  });
}

// Aurora Ridge: a frozen lake far below, mirroring green light.
function auroraLake({ w, h, seed }) {
  const rng = new SeededRandom(seed);
  const noise = makeNoise2D(seed);
  const shore = ridgeHeights(rng, w, 26, 12, 0.55);
  const lake = h - 40;
  return toCanvas(w, h, (put) => {
    for (let x = 0; x < w; x++) {
      const top = Math.round(shore[x]);
      for (let y = Math.max(0, top); y < h; y++) {
        let c = y - top < 2 ? 0x8ac0b8 : 0x10202a;
        if (y > lake) {
          const t = (y - lake) / 40;
          c = lerpColor(0x1c3a48, 0x0e1c26, t);
          // Streaks of reflected aurora, broken up by cracks in the ice.
          const glow = noise(x * 0.04, y * 0.4);
          if (glow > 0.66 && bayer(x, y) < 0.7 - t * 0.5) c = glow > 0.74 ? 0x5af0a0 : 0x2e8a78;
          if ((x * 7 + y * 3) % 53 === 0) c = 0xc8ffe8;
        }
        put(x, y, c);
      }
    }
  });
}

// Dragon's Spine: the sleeping dragon's body coils through the far haze, a
// scaled ribbon with a row of spines, dipping behind the peaks and out again.
function dragonCoils({ w, h, seed }) {
  const rng = new SeededRandom(seed);
  const b = layerBuffer(w, h);
  const ph = rng.range(0, Math.PI * 2);
  const centre = (x) => h * 0.55 + Math.sin((x / w) * Math.PI * 4 + ph) * h * 0.2 + Math.sin((x / w) * Math.PI * 10) * 4;
  const thick = (x) => 20 + Math.sin((x / w) * Math.PI * 2 + ph) * 5;
  for (let x = 0; x < w; x++) {
    const cy = centre(x), r = thick(x);
    // Behind the far peaks every other loop: only the top of the back shows.
    const sunk = Math.sin((x / w) * Math.PI * 4 + ph) > 0.55;
    for (let y = Math.round(cy - r); y <= cy + r; y++) {
      const k = (y - cy) / r;
      if (sunk && k > -0.2) continue;
      const row = Math.floor((y - cy + r) / 4);
      const sx = (x + (row % 2) * 3) % 6;
      let c = k < -0.6 ? 0x8a2a2a : k < 0.2 ? 0x6a1c22 : k < 0.7 ? 0x4a1418 : 0xc89060;
      if (k > 0.7) c = (x + y) % 4 ? 0xc89060 : 0xa87048;
      else if (sx === 0 || (y - cy + r) % 4 === 0) c = lerpColor(c, 0x2a0a10, 0.5);
      if (k < -0.85) c = 0xf0a050;
      b.set(x, y, c);
    }
    // Spines along the back.
    if (x % 9 === 0) {
      const top = Math.round(cy - r);
      for (let s = 1; s < 11; s++) for (let dx = -Math.floor((11 - s) / 3); dx <= 0; dx++) b.set(x + dx + Math.floor(s / 3), top - s, s > 8 ? 0xffe08a : 0x3a1014);
    }
  }
  return b.canvas();
}

// Amber Hive: golden rock towers rising out of the clouds, giant papery hives
// hanging under their overhangs, specks of bees around them.
function hiveTowers({ w, h, seed }) {
  const rng = new SeededRandom(seed);
  const b = layerBuffer(w, h);
  const towers = Array.from({ length: 7 }, () => ({ cx: rng.int(0, w - 1), hw: rng.range(9, 17), top: rng.range(10, 70) }));
  towers.sort((a, c) => c.top - a.top);
  for (const t of towers) {
    for (let dx = -Math.ceil(t.hw) - 3; dx <= t.hw + 3; dx++) {
      // A tower bulges near the top (the overhang) and narrows below it.
      const x = t.cx + dx;
      for (let y = Math.round(t.top); y < h; y++) {
        const k = (y - t.top) / (h - t.top);
        const half = t.hw * (k < 0.12 ? 1.2 : 0.85 + Math.sin(k * 9 + t.cx) * 0.08);
        if (Math.abs(dx) > half) continue;
        const f = dx / half;
        let c = f < -0.45 ? 0xd8a050 : f > 0.4 ? 0x6a4018 : 0xa86e2c;
        if (y - t.top < 2) c = 0xf0c070;
        if ((y + Math.floor(dx * 0.3)) % 9 === 0 && f > -0.6) c = lerpColor(c, 0x4a2a10, 0.4);
        b.set(x, y, c);
      }
    }
    // The hive: a striped paper teardrop under the overhang.
    if (rng.chance(0.75)) {
      const hx = t.cx + (rng.chance(0.5) ? -1 : 1) * (t.hw + 5), hy = t.top + 10, rx = rng.range(7, 11), ry = rng.range(11, 16);
      for (let y = Math.floor(hy - ry); y <= hy + ry; y++) for (let x = Math.floor(hx - rx); x <= hx + rx; x++) {
        const u = (x - hx) / rx, v = (y - hy) / ry;
        if (u * u + v * v * (v < 0 ? 1.4 : 1) > 1) continue;
        let c = ((y - Math.floor(hy - ry)) % 4 < 2) ? 0xe8c070 : 0xc89040;
        if (u > 0.5) c = lerpColor(c, 0x7a4a18, 0.4);
        b.set(x, y, c);
      }
      b.set(hx, Math.round(hy + ry * 0.4), 0x2a160a); b.set(hx + 1, Math.round(hy + ry * 0.4), 0x2a160a);
      for (let k = 0; k < 4; k++) b.set(hx + rng.range(-14, 14), Math.round(hy + rng.range(-10, 14)), 0x2a1a0a);
    }
  }
  return b.canvas();
}

// Clockwork Bastion: a dwarf fortress on the far peaks, towers with lit
// windows, copper roofs gone green, and a great clock on the tallest.
function clockTowers({ w, h, seed }) {
  const rng = new SeededRandom(seed);
  const b = layerBuffer(w, h);
  const base = h - 34;
  // The curtain wall, crenellated, along the whole ridge.
  for (let x = 0; x < w; x++) {
    const top = base + Math.round(Math.sin(x / 40) * 3) - (x % 8 < 4 ? 3 : 0);
    for (let y = top; y < h; y++) b.set(x, y, y - top < 1 ? 0x8a7058 : (x % 8 === 0 ? 0x3a2e26 : 0x5a4a3c));
  }
  const towers = Array.from({ length: 6 }, (_, i) => ({ cx: Math.round((i + rng.range(0.1, 0.9)) * (w / 6)), hw: rng.int(7, 13), tall: rng.int(30, 70) }));
  const big = towers.reduce((a, t) => (t.tall > a.tall ? t : a));
  big.tall = Math.max(big.tall, 80); big.hw = Math.max(big.hw, 12);
  for (const t of towers) {
    const top = base - t.tall;
    for (let dx = -t.hw; dx <= t.hw; dx++) {
      for (let y = top; y < h; y++) b.set(t.cx + dx, y, dx < -t.hw + 2 ? 0x8a7058 : dx > t.hw - 3 ? 0x3a2e26 : 0x5a4a3c);
    }
    // A pointed copper roof.
    for (let k = 0; k < t.hw + 4; k++) for (let dx = -(t.hw + 2 - k); dx <= t.hw + 2 - k; dx++) b.set(t.cx + dx, top - k, dx < 0 ? 0x5aa08a : 0x34685a);
    // Rows of lit windows.
    for (let y = top + 8; y < base - 4; y += 9) for (let dx = -t.hw + 3; dx <= t.hw - 3; dx += 5) if (rng.chance(0.55)) { b.set(t.cx + dx, y, 0xffd080); b.set(t.cx + dx, y + 1, 0xd8963a); }
  }
  // The clock face, with its hands near the hour.
  const cy = base - big.tall + 14, r = big.hw - 3;
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const d = Math.hypot(x, y);
    if (d <= r) b.set(big.cx + x, cy + y, d > r - 1.2 ? 0xd8a850 : 0xf0e4c0);
  }
  for (let k = 0; k < r - 2; k++) { b.set(big.cx, cy - k, 0x2a2018); if (k < r - 4) b.set(big.cx + Math.round(k * 0.7), cy + Math.round(k * 0.4), 0x2a2018); }
  return b.canvas();
}

// Bone Garden: an ash ridge on which the skeletons of old dragons lie, ribs
// standing up like the frames of burnt-out houses, a skull at the end.
function boneRidge({ w, h, seed }) {
  const rng = new SeededRandom(seed);
  const b = layerBuffer(w, h);
  const ridge = smoothRidge(ridgeHeights(rng, w, h * 0.42, 12, 0.5), 3);
  for (let x = 0; x < w; x++) for (let y = Math.round(ridge[x]); y < h; y++) b.set(x, y, y - ridge[x] < 2 ? 0x7a6e68 : 0x2e2826);
  for (let s = 0; s < 3; s++) {
    const x0 = rng.int(0, w - 1), n = rng.int(5, 10), size = rng.range(18, 38), gap = rng.int(5, 9);
    // Each skeleton leans its own way; its ribs curl as they rise.
    const lean = rng.range(-8, 8);
    // The spine along the ground, ribs rising from it, biggest in the middle.
    for (let i = 0; i < n; i++) {
      const rx = x0 + i * gap, gy = Math.round(ridge[((rx % w) + w) % w]);
      let tall = size * Math.sin(((i + 0.5) / n) * Math.PI) * rng.range(0.8, 1.1);
      if (rng.chance(0.2)) tall *= rng.range(0.3, 0.6); // snapped off
      for (let k = 0; k <= tall; k++) {
        const bend = Math.round((k / tall) ** 2 * lean);
        b.set(rx + bend, Math.round(gy - k), k > tall - 2 ? 0xfff2d8 : 0xd8ccb0);
        b.set(rx + bend + 1, Math.round(gy - k), 0x9a8a70);
      }
      b.set(rx, gy - 1, 0xc8b898); b.set(rx + 3, gy - 2, 0xc8b898);
    }
    // The skull: a long snout, a dark socket and a swept-back horn.
    // The skull at the head end, or the tail end, facing either way.
    const f = rng.chance(0.5) ? 1 : -1;
    const sx = f > 0 ? x0 + n * gap + 6 : x0 - 10, sy = Math.round(ridge[((sx % w) + w) % w]) - 6;
    for (let y = -6; y <= 6; y++) for (let x = -8; x <= 12; x++) {
      const inSkull = (x / 8) ** 2 + (y / 6) ** 2 <= 1 || (x > 0 && x < 12 && y > -3 + x * 0.1 && y < 4);
      if (inSkull) b.set(sx + x * f, sy + y, y < -2 ? 0xfff2d8 : y > 2 ? 0xa89878 : 0xd8ccb0);
    }
    b.set(sx - f, sy - 1, 0x1a1414); b.set(sx, sy - 1, 0x1a1414); b.set(sx - f, sy, 0x1a1414);
    const horn = rng.int(7, 13);
    for (let k = 0; k < horn; k++) b.set(sx - (4 + k) * f, sy - 4 - Math.round(k * 0.6), 0xe8dcc0);
    for (let k = 0; k < horn; k++) b.set(sx - (4 + k) * f, sy - 3 - Math.round(k * 0.6), 0xa89878);
  }
  return b.canvas();
}

const PAINTERS = { hiveTowers, clockTowers, boneRidge, glacier, seracs, valley, forest, granite, pinnacles, cumulus, cloudPeaks, obsidianSpires, emberRidge, crystalClusters, crystalIsles, stormAnvils, stormCrags, auroraPeaks, auroraLake, dragonCoils };

export function buildBackdropTextures(scene, biomes) {
  for (const biome of Object.values(biomes)) {
    for (const layer of biome.backdrop?.layers || []) {
      const canvas = PAINTERS[layer.paint]({ w: 480, h: layer.h, seed: layer.seed });
      if (scene.textures.exists(layer.key)) scene.textures.remove(layer.key);
      scene.textures.addCanvas(layer.key, canvas);
    }
  }
}
