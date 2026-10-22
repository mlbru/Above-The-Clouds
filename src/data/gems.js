// Regional gems: every part of the mountain has its own stone. Higher stones
// are rarer but worth more. `value` is what a stone adds to your gem wallet.
export const GEMS = {
  emerald: { id: 'emerald', name: 'EMERALD', biome: 'green', value: 1, rarity: 1.0, color: 0x3fcf6a },
  amber: { id: 'amber', name: 'AMBER', biome: 'stone', value: 2, rarity: 0.9, color: 0xf2a03c },
  sapphire: { id: 'sapphire', name: 'SAPPHIRE', biome: 'frozen', value: 3, rarity: 0.8, color: 0x4f86f0 },
  opal: { id: 'opal', name: 'CLOUD OPAL', biome: 'clouds', value: 5, rarity: 0.7, color: 0xe8d8ff },
  ruby: { id: 'ruby', name: 'RUBY', biome: 'obsidian', value: 8, rarity: 0.6, color: 0xe0344f },
  diamond: { id: 'diamond', name: 'DIAMOND', biome: 'crystal', value: 12, rarity: 0.5, color: 0xd8fbff },
};

export const GEM_ORDER = ['emerald', 'amber', 'sapphire', 'opal', 'ruby', 'diamond'];

export function gemForBiome(biomeId) {
  return GEM_ORDER.map((k) => GEMS[k]).find((g) => g.biome === biomeId) || GEMS.emerald;
}
