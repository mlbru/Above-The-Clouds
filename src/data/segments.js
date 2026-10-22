// Reusable climbing segment templates. The generator stitches these together.
// width: [min,max] wall width in px; wander: max sideways drift of the main line
// per level; density: chance of extra holds per level; style drives combo patterns.
export const SEGMENT_TEMPLATES = [
  { id: 'mossy-slab', name: 'Mossy Slab', biomes: ['green'], levels: [11, 13], width: [270, 310], wander: 18, density: 0.9, style: 'balanced', difficulty: 1, decor: ['grass', 'flowers', 'fern'], features: [] },
  { id: 'pine-ledges', name: 'Pine Ledges', biomes: ['green'], levels: [10, 12], width: [240, 280], wander: 22, density: 0.8, style: 'balanced', difficulty: 1, decor: ['pine', 'grass', 'fern'], features: [] },
  { id: 'waterfall-wall', name: 'Waterfall Wall', biomes: ['green'], levels: [12, 14], width: [280, 320], wander: 16, density: 0.8, style: 'crack', difficulty: 2, decor: ['grass', 'fern'], features: ['waterfall'] },
  { id: 'boulder-steps', name: 'Boulder Steps', biomes: ['green', 'stone'], levels: [10, 12], width: [250, 300], wander: 26, density: 1.1, style: 'traverse', difficulty: 2, decor: ['grass', 'rocks'], features: [] },
  { id: 'grey-buttress', name: 'Grey Buttress', biomes: ['stone', 'obsidian'], levels: [11, 14], width: [240, 280], wander: 20, density: 0.8, style: 'balanced', difficulty: 2, decor: ['rocks'], features: ['strata'] },
  { id: 'chimney-crack', name: 'Chimney Crack', biomes: ['stone', 'frozen', 'obsidian'], levels: [11, 13], width: [160, 190], wander: 12, density: 0.6, style: 'crack', difficulty: 3, decor: ['rocks'], features: ['crack'] },
  { id: 'loose-face', name: 'Loose Face', biomes: ['stone'], levels: [10, 12], width: [250, 290], wander: 22, density: 0.9, style: 'balanced', difficulty: 3, decor: ['rocks'], features: ['strata'], hazardBoost: { loose: 0.18 } },
  { id: 'traverse-band', name: 'Traverse Band', biomes: ['stone', 'frozen', 'clouds', 'crystal'], levels: [10, 12], width: [280, 320], wander: 30, density: 0.9, style: 'traverse', difficulty: 3, decor: ['rocks'], features: [] },
  { id: 'ice-curtain', name: 'Ice Curtain', biomes: ['frozen', 'crystal'], levels: [11, 13], width: [240, 290], wander: 18, density: 0.8, style: 'crack', difficulty: 3, decor: ['icicles'], features: ['icefall'], hazardBoost: { icy: 0.15 } },
  { id: 'frozen-pillars', name: 'Frozen Pillars', biomes: ['frozen'], levels: [10, 12], width: [200, 240], wander: 20, density: 0.7, style: 'balanced', difficulty: 3, decor: ['icicles', 'snowdrift'], features: ['crack'] },
  { id: 'cloud-spire', name: 'Cloud Spire', biomes: ['clouds', 'crystal'], levels: [11, 13], width: [170, 210], wander: 14, density: 0.6, style: 'crack', difficulty: 3, decor: ['crystals'], features: [] },
  { id: 'moonstone-face', name: 'Moonstone Face', biomes: ['clouds', 'obsidian', 'crystal'], levels: [11, 13], width: [250, 300], wander: 22, density: 0.9, style: 'balanced', difficulty: 3, decor: ['crystals'], features: ['strata'] },
  { id: 'obsidian-fins', name: 'Obsidian Fins', biomes: ['obsidian'], levels: [10, 12], width: [210, 250], wander: 26, density: 0.8, style: 'traverse', difficulty: 4, decor: ['crystals'], features: ['crack'], hazardBoost: { loose: 0.1 } },
];

export const REST_TYPES = {
  camp: { label: 'BASE CAMP' },
  ledge: { label: 'LEDGE' },
  hut: { label: 'OLD SHELTER' },
  viewpoint: { label: 'VIEWPOINT' },
  tool: { label: 'LEDGE' },
};
