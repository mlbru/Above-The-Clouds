// Biome definitions: everything that makes one part of the mountain look, sound
// and play differently lives here. Rock palettes go dark -> light (5 shades).
//   wall      overlays painted on the rock (see render/wallOverlays.js), the colour
//             on top of rest ledges, and whether segment strata bands show
//   decor     texture swaps for shared decorations
//   rest      rest-ledge mix, the discovery viewpoints reveal, viewpoint names
//   events    ambient set pieces (eagles)
//   backdrop  sky tint and distant scenery layers (see render/backdropArt.js)
//   mechanic  the biome's own rule (see systems/mechanics/)
//   music     key (root + scale), lead instrument (see AudioSystem INSTRUMENTS),
//             tempo, and a motif of [semitones above root, beats] played an
//             `octave` up; drum adds a slow low pulse
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
    music: { root: 57, scale: [0, 2, 4, 7, 9], instrument: 'pluck', tempo: 96, octave: 12, motif: [[0, 1], [4, 0.5], [7, 0.5], [9, 1], [7, 1], [4, 2]] },
    wall: { overlays: ['moss'], ledgeTop: 'accentB', ledgeFringe: true, featureStrata: false, edge: 'vines' },
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
    from: 80,
    rock: [0x26252b, 0x3d3c45, 0x58575f, 0x77757c, 0x9b9a9e],
    outline: 0x151419,
    accentA: 0x6d6a5f, accentB: 0x8e8a7a, accentC: 0xb3ae9b,
    holdTint: 0xb0aaa0,
    windowScale: 1.0, costMultiplier: 1.0, drainMultiplier: 1.0,
    hazards: { loose: 0.14, icy: 0 },
    weather: { wind: 0.55, snow: 0, leaves: 0, mist: 0.45 },
    ambience: { birds: 0.25, stream: 0, wind: 0.55 },
    music: { root: 55, scale: [0, 3, 5, 7, 10], instrument: 'marimba', tempo: 84, octave: 12, motif: [[0, 0.5], [0, 0.5], [3, 1], [5, 0.5], [7, 1.5], [5, 0.5], [3, 2]] },
    wall: { overlays: ['strata', 'lichen'], ledgeTop: 'rock4', edge: 'blocks' },
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
    music: { root: 52, scale: [0, 2, 3, 7, 8], instrument: 'musicbox', tempo: 72, octave: 24, motif: [[7, 1], [8, 0.5], [7, 0.5], [3, 1], [2, 1], [0, 3]] },
    wall: { overlays: ['frost'], ledgeTop: 'accentB', edge: 'icicles' },
    decor: { pine: 'decor_cliffpine_snow' },
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
    // Flocks of cranes cross the sea of clouds.
    ambience: { birds: 0.5, stream: 0, wind: 0.6 },
    music: { root: 60, scale: [0, 2, 4, 7, 11], instrument: 'flute', tempo: 66, octave: 12, motif: [[0, 1.5], [4, 0.5], [7, 1], [11, 1], [12, 3]] },
    wall: { overlays: ['windcarved'], ledgeTop: 'rock4', edge: 'puffs' },
    rest: { discovery: 'sea-of-clouds', viewpoints: ['SEA OF CLOUDS', 'MOON TERRACE', 'STAR LEDGE', 'THE QUIET EDGE'] },
    backdrop: {
      sky: { top: 0x3a62c0, bottom: 0xf2e8f0, amount: 0.3 },
      layers: [
        { key: 'bg_clouds_cumulus', paint: 'cumulus', seed: 121, h: 150, E: 1000, f: 0.14, haze: 0.1, fill: 0xdcd6ec, depth: DEPTH.far + 6 },
        { key: 'bg_clouds_peaks', paint: 'cloudPeaks', seed: 131, h: 110, E: 760, f: 0.2, haze: 0.16, fill: 0xe4e0f0, depth: DEPTH.far + 8 },
      ],
    },
    mechanic: 'thermals',
    floaters: true,
  },
  // High-altitude variations so the mountain can keep going.
  obsidian: {
    id: 'obsidian',
    name: 'THE OBSIDIAN SPIRES',
    from: 700,
    rock: [0x16131c, 0x2a2533, 0x433b50, 0x655a78, 0x9384a8],
    outline: 0x0b0a10,
    accentA: 0xd16a8c, accentB: 0xf09ab4, accentC: 0x8a7ad8,
    holdTint: 0xc8b8d8,
    windowScale: 0.88, costMultiplier: 1.15, drainMultiplier: 1.2,
    hazards: { loose: 0.12, icy: 0.05 },
    weather: { wind: 0.8, snow: 0.1, leaves: 0, mist: 0.2 },
    ambience: { birds: 0, stream: 0, wind: 0.85 },
    music: { root: 50, scale: [0, 3, 5, 6, 10], instrument: 'cello', tempo: 60, octave: 0, motif: [[0, 2], [3, 1], [6, 1], [5, 2], [0, 2]], drum: true },
    wall: { overlays: ['glass', 'veins'], ledgeTop: 'rock4', edge: 'jagged' },
    // Shared segments dress the black glass in its own props.
    decor: { piton: 'decor_vent', rocks: 'decor_vent' },
    rest: { viewpoints: ['DARK GLASS PLINTH', 'EMBER BALCONY', 'NIGHT SPIRE'] },
    backdrop: {
      sky: { top: 0x1a1438, bottom: 0x6a3a6a, amount: 0.45 },
      layers: [
        { key: 'bg_obsidian_spires', paint: 'obsidianSpires', seed: 141, h: 130, E: 1000, f: 0.12, haze: 0.12, fill: 0x14111c, depth: DEPTH.far + 6 },
        { key: 'bg_obsidian_embers', paint: 'emberRidge', seed: 151, h: 100, E: 850, f: 0.18, haze: 0.06, fill: 0x1e1828, depth: DEPTH.far + 8 },
      ],
    },
    mechanic: 'darkness',
    // The cloud sea far below, dusk-violet under the black glass.
    sea: 0x8a78b0,
  },
  crystal: {
    id: 'crystal',
    name: 'THE CRYSTAL HEIGHTS',
    from: 950,
    rock: [0x18303a, 0x285060, 0x3e7488, 0x66a2b4, 0xa6dbe2],
    outline: 0x0c1c22,
    accentA: 0xb8fff4, accentB: 0xf0fffb, accentC: 0xffc8f0,
    holdTint: 0xd8f4f8,
    windowScale: 0.86, costMultiplier: 1.2, drainMultiplier: 1.2,
    hazards: { loose: 0.04, icy: 0.25 },
    weather: { wind: 0.7, snow: 0.6, leaves: 0, mist: 0.15 },
    ambience: { birds: 0, stream: 0, wind: 0.8 },
    music: { root: 62, scale: [0, 2, 4, 6, 9], instrument: 'glass', tempo: 80, octave: 24, motif: [[9, 0.5], [6, 0.5], [4, 0.5], [2, 0.5], [4, 1], [6, 1], [9, 2]] },
    wall: { overlays: ['facets', 'frost'], ledgeTop: 'accentB', edge: 'shards' },
    rest: { viewpoints: ['PRISM LEDGE', 'GLASS GARDEN', 'THE LANTERN'] },
    backdrop: {
      sky: { top: 0x2a4a7a, bottom: 0xf0d8f0, amount: 0.35 },
      layers: [
        { key: 'bg_crystal_clusters', paint: 'crystalClusters', seed: 161, h: 130, E: 1250, f: 0.1, haze: 0.12, fill: 0x5a8a9c, depth: DEPTH.far + 6 },
        { key: 'bg_crystal_isles', paint: 'crystalIsles', seed: 171, h: 100, E: 1100, f: 0.15, haze: 0.08, fill: null, depth: DEPTH.far + 8 },
      ],
    },
    mechanic: 'prismLight',
    floaters: true,
    sea: 0xf8d8f0,
  },
  storm: {
    id: 'storm',
    name: 'THE STORM CROWN',
    from: 1200,
    rock: [0x181c26, 0x2a3040, 0x404a60, 0x5e6a84, 0x8a96ae],
    outline: 0x0c0e14,
    accentA: 0x6a7aa0, accentB: 0xc8d8ff, accentC: 0xffe45a,
    holdTint: 0xb8c4dc,
    windowScale: 0.86, costMultiplier: 1.2, drainMultiplier: 1.25,
    hazards: { loose: 0.14, icy: 0.08 },
    weather: { wind: 0.9, snow: 0, leaves: 0, mist: 0.35 },
    ambience: { birds: 0, stream: 0, wind: 0.9 },
    music: { root: 48, scale: [0, 2, 3, 7, 8], instrument: 'horn', tempo: 92, octave: 12, motif: [[0, 0.5], [0, 0.5], [3, 1], [7, 1], [8, 0.5], [7, 0.5], [3, 2]], drum: true },
    wall: { overlays: ['strata', 'wet', 'scorch'], ledgeTop: 'rock4', edge: 'jagged' },
    decor: { crystals: 'decor_chain' },
    rest: { hut: 0.06, viewpoints: ['THUNDER SHELF', 'THE ANVIL HEAD', 'IRON BALCONY', 'STORMWATCH'] },
    backdrop: {
      sky: { top: 0x1c2234, bottom: 0x6a7090, amount: 0.6 },
      layers: [
        { key: 'bg_storm_anvils', paint: 'stormAnvils', seed: 251, h: 140, E: 1500, f: 0.1, haze: 0.08, fill: 0x3a4058, depth: DEPTH.far + 6 },
        { key: 'bg_storm_crags', paint: 'stormCrags', seed: 261, h: 110, E: 1350, f: 0.16, haze: 0.06, fill: 0x1a1e2a, depth: DEPTH.far + 8 },
      ],
    },
    mechanic: 'storm',
    sea: 0x5a6078,
    // Heavy cloud: the sun is only a pale smudge up here.
    overcast: 0.85,
  },
  aurora: {
    id: 'aurora',
    name: 'THE AURORA RIDGE',
    from: 1450,
    rock: [0x10202a, 0x1c3440, 0x2c505c, 0x46767c, 0x78aaa4],
    outline: 0x08121a,
    // Snow and ice in cool mint: the bright greens belong to the sky.
    accentA: 0x9ad8c8, accentB: 0xe8fff6, accentC: 0x6ac0b8,
    holdTint: 0xc8e8e0,
    windowScale: 0.84, costMultiplier: 1.25, drainMultiplier: 1.25,
    hazards: { loose: 0.06, icy: 0.22 },
    weather: { wind: 0.5, snow: 0.45, leaves: 0, mist: 0.1 },
    ambience: { birds: 0, stream: 0, wind: 0.5 },
    music: { root: 53, scale: [0, 2, 5, 7, 9], instrument: 'pad', tempo: 88, octave: 12, motif: [[0, 1.5], [7, 0.5], [9, 1.5], [7, 0.5], [5, 1.5], [2, 0.5], [0, 2]] },
    wall: { overlays: ['glaze', 'frost'], ledgeTop: 'accentB', edge: 'rime' },
    decor: { pine: 'decor_cliffpine_snow' },
    rest: { viewpoints: ['NORTH WINDOW', 'THE GREEN VEIL', 'STARFALL LEDGE', 'LONG NIGHT'] },
    // The northern lights hang over this whole stretch, day or night.
    aurora: 1,
    backdrop: {
      sky: { top: 0x0c1430, bottom: 0x2a5068, amount: 0.75 },
      layers: [
        { key: 'bg_aurora_peaks', paint: 'auroraPeaks', seed: 271, h: 130, E: 1750, f: 0.1, haze: 0.1, fill: 0x1c3040, depth: DEPTH.far + 6 },
        { key: 'bg_aurora_lake', paint: 'auroraLake', seed: 281, h: 90, E: 1600, f: 0.16, haze: 0.04, fill: 0x0e1c26, depth: DEPTH.far + 8 },
      ],
    },
    mechanic: 'swing',
    sea: 0x3a6078,
    // Polar night: the sun never quite comes up here.
    overcast: 0.95,
  },
  dragon: {
    id: 'dragon',
    name: "THE DRAGON'S SPINE",
    from: 1700,
    rock: [0x1e0e0e, 0x3a1a18, 0x5c2a22, 0x8a4430, 0xc0704a],
    outline: 0x100606,
    accentA: 0xa8243a, accentB: 0xf0a050, accentC: 0xffe08a,
    holdTint: 0xe0b090,
    windowScale: 0.82, costMultiplier: 1.3, drainMultiplier: 1.3,
    hazards: { loose: 0.14, icy: 0 },
    weather: { wind: 0.5, snow: 0, leaves: 0, mist: 0.25 },
    ambience: { birds: 0, stream: 0, wind: 0.5 },
    music: { root: 50, scale: [0, 1, 5, 7, 8], instrument: 'throat', tempo: 100, octave: 0, motif: [[0, 1], [0, 0.5], [1, 0.5], [5, 1], [7, 1.5], [8, 0.5], [7, 1], [0, 2]], drum: true },
    wall: { overlays: ['scales', 'embers'], ledgeTop: 'rock4', edge: 'spines' },
    decor: { rocks: 'decor_bones' },
    rest: { hut: 0, viewpoints: ['THE SCALE SHELF', 'SMOKE BALCONY', "WYRM'S SHOULDER", 'THE LAST SPINE'] },
    backdrop: {
      sky: { top: 0x2a0e1a, bottom: 0xe0603a, amount: 0.6 },
      layers: [
        { key: 'bg_dragon_coils', paint: 'dragonCoils', seed: 291, h: 140, E: 2000, f: 0.1, haze: 0.08, fill: null, depth: DEPTH.far + 6 },
        { key: 'bg_dragon_ridge', paint: 'emberRidge', seed: 301, h: 100, E: 1850, f: 0.16, haze: 0.06, fill: 0x1e1828, depth: DEPTH.far + 8 },
      ],
    },
    mechanic: 'dragonEye',
    sea: 0xc87058,
  },
  // Expedition themes (special: never part of the endless mountain). An
  // expedition with a `theme` uses that biome for its whole climb.
  volcano: {
    id: 'volcano',
    special: true,
    name: 'MOUNT EMBER',
    from: 0,
    rock: [0x140e10, 0x2a1c1c, 0x40292a, 0x5e3a36, 0x8a5246],
    outline: 0x0a0607,
    accentA: 0xa8243a, accentB: 0xff9a3c, accentC: 0xffd25a,
    holdTint: 0xc89a8a,
    ground: 0x3a2a26,
    gemFrom: 'obsidian',
    windowScale: 0.9, costMultiplier: 1.1, drainMultiplier: 1.2,
    hazards: { loose: 0.2, icy: 0 },
    weather: { wind: 0.4, snow: 0, leaves: 0, mist: 0.15 },
    ambience: { birds: 0, stream: 0, wind: 0.5 },
    music: { root: 45, scale: [0, 1, 4, 5, 7, 8], instrument: 'cello', tempo: 84, octave: 12, motif: [[0, 1], [1, 0.5], [4, 0.5], [7, 1], [8, 1], [7, 2]], drum: true },
    wall: { overlays: ['embers'], ledgeTop: 'rock4' },
    rest: { hut: 0, viewpoints: ['ASH SHELF', 'THE HOT LEDGE'] },
    // The everyday hills and forests far behind turn to scorched ground.
    rangeTint: 0x5a3a3a,
    backdrop: {
      sky: { top: 0x3a1018, bottom: 0xf06a3a, amount: 0.75 },
      layers: [
        { key: 'bg_volcano_ridge', paint: 'emberRidge', seed: 211, h: 100, E: 300, f: 0.25, haze: 0.1, fill: 0x1a1012, depth: DEPTH.far + 6 },
        { key: 'bg_volcano_spires', paint: 'obsidianSpires', seed: 221, h: 130, E: 380, f: 0.18, haze: 0.16, fill: 0x24161a, depth: DEPTH.far + 8 },
      ],
    },
    mechanic: 'rockfall',
  },
  sky: {
    id: 'sky',
    special: true,
    name: 'THE SKY ISLANDS',
    from: 0,
    rock: [0x3a2a3a, 0x5a4252, 0x7e5e66, 0xa8847a, 0xd8b898],
    outline: 0x22161e,
    accentA: 0x3f8a4a, accentB: 0x6fc25a, accentC: 0xa8e878,
    holdTint: 0xf0e0c8,
    seaFrom: 30,
    // Up among the islands the distant hills drop away: only sky and cloud sea.
    hideRanges: true,
    gemFrom: 'clouds',
    windowScale: 0.95, costMultiplier: 1.0, drainMultiplier: 1.0,
    hazards: { loose: 0, icy: 0 },
    weather: { wind: 0.7, snow: 0, leaves: 0.3, mist: 0 },
    ambience: { birds: 1, stream: 0, wind: 0.7 },
    music: { root: 62, scale: [0, 2, 4, 7, 9], instrument: 'flute', tempo: 76, octave: 12, motif: [[0, 1], [4, 1], [7, 0.5], [9, 0.5], [12, 2], [9, 1]] },
    wall: { overlays: ['moss'], ledgeTop: 'accentB' },
    rest: { hut: 0, viewpoints: ['WIND GARDEN', 'THE LAST ISLAND'] },
    backdrop: {
      sky: { top: 0x3a8ae8, bottom: 0xfff0e0, amount: 0.6 },
      layers: [
        { key: 'bg_sky_cumulus', paint: 'cumulus', seed: 231, h: 150, E: 260, f: 0.14, haze: 0.1, fill: 0xf0ecf8, depth: DEPTH.far + 6 },
        { key: 'bg_sky_isles', paint: 'crystalIsles', seed: 241, h: 100, E: 320, f: 0.2, haze: 0.2, fill: null, depth: DEPTH.far + 8 },
      ],
    },
    mechanic: 'thermals',
  },
};

// The Crevasse expedition: inside a crack in the glacier, two ice walls facing
// each other. Built on the Frozen Reach, darker and bluer, with no whiteout.
BIOMES.crevasse = {
  ...BIOMES.frozen,
  id: 'crevasse',
  special: true,
  name: 'THE CREVASSE',
  from: 0,
  rock: [0x14203a, 0x24365a, 0x3a5684, 0x6488b8, 0xa8c8ec],
  outline: 0x0a1222,
  accentA: 0x9fd8ff, accentB: 0xe4f4ff, accentC: 0x5ab0f0,
  ground: 0xdfeaf7,
  gemFrom: 'frozen',
  hazards: { loose: 0, icy: 0.25 },
  weather: { wind: 0.4, snow: 0.35, leaves: 0, mist: 0.2 },
  ambience: { birds: 0, stream: 0, wind: 0.6 },
  music: { root: 50, scale: [0, 2, 3, 7, 9], instrument: 'glass', tempo: 78, octave: 24, motif: [[0, 1], [7, 0.5], [9, 0.5], [7, 1], [3, 1], [2, 2]] },
  rest: { hut: 0, viewpoints: ['SNOW BRIDGE', 'THE BLUE LIGHT'] },
  backdrop: {
    sky: { top: 0x5a7ab8, bottom: 0xe8f4ff, amount: 0.45 },
    layers: [
      { key: 'bg_crevasse_glacier', paint: 'glacier', seed: 251, h: 150, E: 560, f: 0.2, haze: 0.2, fill: 0xb4cbe8, depth: DEPTH.far + 6 },
      { key: 'bg_crevasse_seracs', paint: 'seracs', seed: 261, h: 110, E: 430, f: 0.34, haze: 0.12, fill: 0xdfeaf7, depth: DEPTH.far + 7 },
    ],
  },
  mechanic: null,
};

// An expedition theme replaces the mountain's biomes while it is climbed.
let THEME = null;
export function setBiomeTheme(id) { THEME = id ? BIOMES[id] : null; }
export function biomeTheme() { return THEME; }

// Order the mountain passes through. After the last entry the high biomes loop.
// Every biome is about 250 m long (the Green Rise and the Stone Wall are shorter).
export const SEQUENCE = ['green', 'stone', 'frozen', 'clouds', 'obsidian', 'crystal', 'storm', 'aurora', 'dragon'];
const LOOP = ['obsidian', 'crystal', 'storm', 'aurora', 'dragon'];
export const LOOP_START = 1950;
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
  if (THEME) return `${THEME.id}@0`;
  const h = Math.max(0, heightMeters);
  return `${biomeIdAt(h)}@${boundaryStart(h)}`;
}

export function biomeAt(heightMeters) {
  if (THEME) return THEME;
  return BIOMES[biomeIdAt(Math.max(0, heightMeters))];
}

// The next biome above this height and where it starts: { biome, from }.
export function nextBiomeAbove(heightMeters) {
  const h = Math.max(0, heightMeters);
  const from = h >= LOOP_START ? boundaryStart(h) + LOOP_SPAN
    : (SEQUENCE.map((id) => BIOMES[id].from).find((f) => f > h) ?? LOOP_START);
  return { biome: BIOMES[biomeIdAt(from)], from };
}

// Returns { a, b, t } so visuals can blend gradually across a boundary.
export function biomeMixAt(heightMeters) {
  if (THEME) return { a: THEME, b: THEME, t: 0 };
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
