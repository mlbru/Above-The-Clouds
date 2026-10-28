// Biome overlays for the rock face. A biome lists the overlays it uses in
// `wall.overlays`; WallPainter runs them in order for every rock pixel.
// Each overlay reads the pixel context `p` and may change `p.c` (the colour).
// p: { x, wy, c, idx, lit, seam, dEdge, ov, dn, pal, painter }
import { bayer, lerpColor } from '../utils/color.js';
import { hashInts } from '../utils/seededRandom.js';

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
