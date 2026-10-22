// Biome definitions: everything that makes one part of the mountain look, sound
// and play differently lives here. Rock palettes go dark -> light (5 shades).
//   wall      overlays painted on the rock (see render/wallOverlays.js), the colour
//             on top of rest ledges, and whether segment strata bands show
//   decor     texture swaps for shared decorations
//   rest      rest-ledge mix, the discovery viewpoints reveal, viewpoint names
//   events    ambient set pieces (eagles)
//   backdrop  sky tint and distant scenery layers (see render/backdropArt.js)
//   mechanic  the biome's own rule (see systems/mechanics/)
import { DEPTH } from '../config/gameConfig.js';

export const BIOMES = {
  green: {
    id: 'green',
    name: 'THE GREEN RISE',
    from: 0,
    rock: [0x2c2f3a, 0x45495a, 0x5d6475, 0x7a8293, 0x98a1ae],
    outline: 0x1a1c26,
    accentA: 0x3f6a3c, accentB: 0x5f8c46, accentC: 0x86ad58,
    holdTint: 0x9fa69a,
    windowScale: 1.1, costMultiplier: 0.8, drainMultiplier: 0.8,
    hazards: { loose: 0, icy: 0 },
    weather: { wind: 0.25, snow: 0, leaves: 0.6, mist: 0.15 },
    ambience: { birds: 1, stream: 0.6, wind: 0.25 },
    music: { root: 57, scale: [0, 2, 4, 7, 9] },
    wall: { overlays: ['moss'], ledgeTop: 'accentB', ledgeFringe: true, featureStrata: false },
    rest: { hut: 0.1, tool: 0.04, discovery: null, viewpoints: ['PINE OVERLOOK', 'FALLS LOOKOUT', 'MEADOW BALCONY', 'FERN TERRACE'] },
    backdrop: {
      sky: { top: 0x4f90e0, bottom: 0xd8f0f0, amount: 0.25 },
      layers: [
        { key: 'bg_green_valley', paint: 'valley', seed: 81, h: 110, E: 110, f: 0.5, haze: 0.12, fill: 0x4a7c3a, depth: DEPTH.mid + 3 },
        { key: 'bg_green_forest', paint: 'forest', seed: 91, h: 70, E: 20, f: 0.95, haze: 0.02, fill: 0x23402a, depth: DEPTH.near + 2 },
      ],
    },
    events: { eagles: true },
  },
  stone: {
    id: 'stone',
    name: 'THE STONE WALL',
    from: 120,
    rock: [0x26252b, 0x3d3c45, 0x58575f, 0x77757c, 0x9b9a9e],
    outline: 0x151419,
    accentA: 0x6d6a5f, accentB: 0x8e8a7a, accentC: 0xb3ae9b,
    holdTint: 0xb0aaa0,
    windowScale: 1.0, costMultiplier: 1.0, drainMultiplier: 1.0,
    hazards: { loose: 0.14, icy: 0 },
    weather: { wind: 0.55, snow: 0, leaves: 0, mist: 0.45 },
    ambience: { birds: 0.25, stream: 0, wind: 0.55 },
    music: { root: 55, scale: [0, 3, 5, 7, 10] },
    wall: { overlays: ['strata', 'lichen'], ledgeTop: 'rock4' },
    rest: { discovery: 'valley-reveal', viewpoints: ['GRANITE BALCONY', "EAGLE'S PERCH", 'MISTY VALLEY VIEW', 'THE ANVIL'] },
    backdrop: {
      sky: { top: 0x6a88b8, bottom: 0xdad8d4, amount: 0.25 },
      layers: [
        { key: 'bg_stone_granite', paint: 'granite', seed: 101, h: 130, E: 300, f: 0.28, haze: 0.22, fill: 0x2e4a32, depth: DEPTH.mid + 2 },
        { key: 'bg_stone_pinnacles', paint: 'pinnacles', seed: 111, h: 110, E: 230, f: 0.42, haze: 0.14, fill: 0xa4acb8, depth: DEPTH.mid + 3 },
      ],
    },
    mechanic: 'rockfall',
    events: { eagles: true },
  },
  frozen: {
    id: 'frozen',
    name: 'THE FROZEN REACH',
    from: 300,
    rock: [0x1f2a40, 0x34435f, 0x51648a, 0x7d93b8, 0xb5c8e2],
    outline: 0x121a2b,
    accentA: 0xcfe2f5, accentB: 0xeef6ff, accentC: 0x8ec5f0,
    holdTint: 0xd8e6f5,
    windowScale: 0.92, costMultiplier: 1.1, drainMultiplier: 1.15,
    hazards: { loose: 0.05, icy: 0.2 },
    weather: { wind: 0.75, snow: 0.8, leaves: 0, mist: 0.3 },
    ambience: { birds: 0, stream: 0, wind: 0.8 },
    music: { root: 52, scale: [0, 2, 3, 7, 8] },
    wall: { overlays: ['frost'], ledgeTop: 'accentB' },
    decor: { pine: 'decor_pine_snow' },
    rest: { discovery: 'prayer-flags', viewpoints: ['FROST WINDOW', 'BLUE CREVASSE VIEW', 'GLACIER STEP', 'SILENT CORNICE'] },
    backdrop: {
      sky: { top: 0x7a98cc, bottom: 0xe8f0fa, amount: 0.35 },
      layers: [
        { key: 'bg_frozen_glacier', paint: 'glacier', seed: 61, h: 150, E: 560, f: 0.2, haze: 0.2, fill: 0xb4cbe8, depth: DEPTH.far + 6 },
        { key: 'bg_frozen_seracs', paint: 'seracs', seed: 71, h: 90, E: 430, f: 0.34, haze: 0.12, fill: 0xdfeaf7, depth: DEPTH.far + 7 },
      ],
    },
    mechanic: 'whiteout',
  },
  clouds: {
    id: 'clouds',
    name: 'ABOVE THE CLOUDS',
    from: 480,
    rock: [0x2a2440, 0x443a62, 0x63578a, 0x8d7fb0, 0xc0b5dc],
    outline: 0x17132a,
    accentA: 0xf5d6a8, accentB: 0xfff1d6, accentC: 0xa8e0ff,
    holdTint: 0xe6dcf5,
    windowScale: 0.92, costMultiplier: 1.05, drainMultiplier: 1.1,
    hazards: { loose: 0.05, icy: 0.1 },
    weather: { wind: 0.6, snow: 0.2, leaves: 0, mist: 0.1 },
    ambience: { birds: 0, stream: 0, wind: 0.6 },
    music: { root: 60, scale: [0, 2, 4, 7, 11] },
    wall: { overlays: ['veins'], ledgeTop: 'rock4' },
    rest: { discovery: 'sea-of-clouds', viewpoints: ['SEA OF CLOUDS', 'MOON TERRACE', 'STAR LEDGE', 'THE QUIET EDGE'] },
    backdrop: {
      sky: { top: 0x3a62c0, bottom: 0xf2e8f0, amount: 0.3 },
      layers: [
        { key: 'bg_clouds_cumulus', paint: 'cumulus', seed: 121, h: 150, E: 1000, f: 0.14, haze: 0.1, fill: 0xdcd6ec, depth: DEPTH.far + 6 },
        { key: 'bg_clouds_peaks', paint: 'cloudPeaks', seed: 131, h: 110, E: 760, f: 0.2, haze: 0.16, fill: 0xe4e0f0, depth: DEPTH.far + 8 },
      ],
    },
    mechanic: 'thermals',
  },
  // High-altitude variations so the mountain can keep going.
  obsidian: {
    id: 'obsidian',
    name: 'THE OBSIDIAN SPIRES',
    from: 800,
    rock: [0x16131c, 0x2a2533, 0x433b50, 0x655a78, 0x9384a8],
    outline: 0x0b0a10,
    accentA: 0xd16a8c, accentB: 0xf09ab4, accentC: 0x8a7ad8,
    holdTint: 0xc8b8d8,
    windowScale: 0.88, costMultiplier: 1.15, drainMultiplier: 1.2,
    hazards: { loose: 0.12, icy: 0.05 },
    weather: { wind: 0.8, snow: 0.1, leaves: 0, mist: 0.2 },
    ambience: { birds: 0, stream: 0, wind: 0.85 },
    music: { root: 50, scale: [0, 3, 5, 6, 10] },
    wall: { overlays: ['veins'], ledgeTop: 'rock4' },
    rest: { viewpoints: ['DARK GLASS PLINTH', 'EMBER BALCONY', 'NIGHT SPIRE'] },
    backdrop: {
      sky: { top: 0x1a1438, bottom: 0x6a3a6a, amount: 0.45 },
      layers: [
        { key: 'bg_obsidian_spires', paint: 'obsidianSpires', seed: 141, h: 130, E: 1100, f: 0.12, haze: 0.12, fill: 0x14111c, depth: DEPTH.far + 6 },
        { key: 'bg_obsidian_embers', paint: 'emberRidge', seed: 151, h: 100, E: 950, f: 0.18, haze: 0.06, fill: 0x1e1828, depth: DEPTH.far + 8 },
      ],
    },
    mechanic: 'darkness',
  },
  crystal: {
    id: 'crystal',
    name: 'THE CRYSTAL HEIGHTS',
    from: 1050,
    rock: [0x18303a, 0x285060, 0x3e7488, 0x66a2b4, 0xa6dbe2],
    outline: 0x0c1c22,
    accentA: 0xb8fff4, accentB: 0xf0fffb, accentC: 0xffc8f0,
    holdTint: 0xd8f4f8,
    windowScale: 0.86, costMultiplier: 1.2, drainMultiplier: 1.2,
    hazards: { loose: 0.04, icy: 0.25 },
    weather: { wind: 0.7, snow: 0.6, leaves: 0, mist: 0.15 },
    ambience: { birds: 0, stream: 0, wind: 0.8 },
    music: { root: 62, scale: [0, 2, 4, 6, 9] },
    wall: { overlays: ['frost', 'veins'], ledgeTop: 'accentB' },
    rest: { viewpoints: ['PRISM LEDGE', 'GLASS GARDEN', 'THE LANTERN'] },
    backdrop: {
      sky: { top: 0x2a4a7a, bottom: 0xf0d8f0, amount: 0.35 },
      layers: [
        { key: 'bg_crystal_clusters', paint: 'crystalClusters', seed: 161, h: 130, E: 1350, f: 0.1, haze: 0.12, fill: 0x5a8a9c, depth: DEPTH.far + 6 },
        { key: 'bg_crystal_isles', paint: 'crystalIsles', seed: 171, h: 100, E: 1200, f: 0.15, haze: 0.08, fill: null, depth: DEPTH.far + 8 },
      ],
    },
    mechanic: 'echo',
  },
};

// Order the mountain passes through. After the last entry the high variants loop.
const SEQUENCE = ['green', 'stone', 'frozen', 'clouds', 'obsidian', 'crystal'];
const LOOP = ['clouds', 'obsidian', 'crystal'];
const LOOP_START = 1300;
const LOOP_SPAN = 250;
export const BLEND_METERS = 18;

function biomeIdAt(h) {
  if (h >= LOOP_START) return LOOP[Math.floor((h - LOOP_START) / LOOP_SPAN) % LOOP.length];
  let id = SEQUENCE[0];
  for (const b of SEQUENCE) if (h >= BIOMES[b].from) id = b;
  return id;
}

function boundaryStart(h) {
  if (h >= LOOP_START) return LOOP_START + Math.floor((h - LOOP_START) / LOOP_SPAN) * LOOP_SPAN;
  let from = 0;
  for (const b of SEQUENCE) if (h >= BIOMES[b].from) from = BIOMES[b].from;
  return from;
}

// Height inside a biome's own stretch, mapped onto its first pass. In the high
// loop a biome comes back later; its scenery should look as it did the first time.
export function biomeLocalAlt(heightMeters, id) {
  const h = Math.max(0, heightMeters);
  const start = boundaryStart(h);
  if (biomeIdAt(h) === id) return BIOMES[id].from + (h - start);
  const next = boundaryStart(h + BLEND_METERS);
  if (next > start && biomeIdAt(next) === id) return BIOMES[id].from + (h - next);
  if (start > 0 && biomeIdAt(start - 0.01) === id) return BIOMES[id].from + (h - boundaryStart(start - 0.01));
  return h;
}

// Identifies one stretch of a biome (the high loop visits a biome more than once).
export function biomeStretchAt(heightMeters) {
  const h = Math.max(0, heightMeters);
  return `${biomeIdAt(h)}@${boundaryStart(h)}`;
}

export function biomeAt(heightMeters) {
  return BIOMES[biomeIdAt(Math.max(0, heightMeters))];
}

// Returns { a, b, t } so visuals can blend gradually across a boundary.
export function biomeMixAt(heightMeters) {
  const h = Math.max(0, heightMeters);
  const cur = biomeIdAt(h);
  const start = boundaryStart(h);
  if (start > 0 && h - start < BLEND_METERS) {
    const prev = biomeIdAt(start - 0.01);
    const t = 0.5 + 0.5 * ((h - start) / BLEND_METERS);
    return { a: BIOMES[prev], b: BIOMES[cur], t };
  }
  const nextStart = boundaryStart(h + BLEND_METERS);
  if (nextStart > start) {
    const next = biomeIdAt(nextStart);
    const t = 0.5 * (1 - (nextStart - h) / BLEND_METERS);
    return { a: BIOMES[cur], b: BIOMES[next], t };
  }
  return { a: BIOMES[cur], b: BIOMES[cur], t: 0 };
}
