// Regional gems: every part of the mountain has its own stone. Higher stones
// are rarer but worth more. `value` is what a stone adds to your gem wallet.
export const GEMS = {
  emerald: { id: 'emerald', name: 'EMERALD', biome: 'green', value: 1, rarity: 1.0, color: 0x3fcf6a },
  amber: { id: 'amber', name: 'AMBER', biome: 'stone', value: 2, rarity: 0.9, color: 0xf2a03c },
  sapphire: { id: 'sapphire', name: 'SAPPHIRE', biome: 'frozen', value: 3, rarity: 0.8, color: 0x4f86f0 },
  opal: { id: 'opal', name: 'CLOUD OPAL', biome: 'clouds', value: 4, rarity: 0.7, color: 0xe8d8ff },
  honeystone: { id: 'honeystone', name: 'HONEYSTONE', biome: 'hive', value: 5, rarity: 0.65, color: 0xffb32c },
  ruby: { id: 'ruby', name: 'RUBY', biome: 'obsidian', value: 6, rarity: 0.6, color: 0xe0344f },
  diamond: { id: 'diamond', name: 'DIAMOND', biome: 'crystal', value: 7, rarity: 0.5, color: 0xd8fbff },
  verdigris: { id: 'verdigris', name: 'VERDIGRIS', biome: 'clockwork', value: 8, rarity: 0.48, color: 0x4ad8b0 },
  topaz: { id: 'topaz', name: 'STORM TOPAZ', biome: 'storm', value: 9, rarity: 0.45, color: 0xffd23c },
  tourmaline: { id: 'tourmaline', name: 'TOURMALINE', biome: 'aurora', value: 10, rarity: 0.4, color: 0x3ff0b0 },
  jet: { id: 'jet', name: 'BONE JET', biome: 'bones', value: 11, rarity: 0.38, color: 0xc8b8e8 },
  pearl: { id: 'pearl', name: 'DRAGON PEARL', biome: 'dragon', value: 12, rarity: 0.35, color: 0xff6a4a },
  // The Far Range.
  riverpearl: { id: 'riverpearl', name: 'RIVER PEARL', biome: 'cascade', value: 13, rarity: 0.34, color: 0xe8fcff },
  jade: { id: 'jade', name: 'TEMPLE JADE', biome: 'monastery', value: 14, rarity: 0.33, color: 0x4ad890 },
  mossagate: { id: 'mossagate', name: 'MOSS AGATE', biome: 'moss', value: 15, rarity: 0.32, color: 0xb8f070 },
  ammolite: { id: 'ammolite', name: 'AMMOLITE', biome: 'reef', value: 16, rarity: 0.31, color: 0xff8a5a },
  moldavite: { id: 'moldavite', name: 'MOLDAVITE', biome: 'starfall', value: 17, rarity: 0.3, color: 0x6ae08a },
};

export const GEM_ORDER = ['emerald', 'amber', 'sapphire', 'opal', 'honeystone', 'ruby', 'diamond', 'verdigris', 'topaz', 'tourmaline', 'jet', 'pearl', 'riverpearl', 'jade', 'mossagate', 'ammolite', 'moldavite'];

export function gemForBiome(biomeId) {
  return GEM_ORDER.map((k) => GEMS[k]).find((g) => g.biome === biomeId) || GEMS.emerald;
}
