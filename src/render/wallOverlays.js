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
