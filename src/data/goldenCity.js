// The secret level. Very rarely a biome you climb into turns out to be the
// Golden City: everything is made of gold except the diamonds, which sit on
// almost every hold. It has its own song and lasts until you leave that biome.
export const GOLDEN_CITY = {
  name: 'THE GOLDEN CITY',
  // Chance per new biome you climb into (Green Rise never: you start there).
  chance: 1 / 150,
  diamondChance: 0.8,
};

// Semitones above D4. A slow, mysterious tune in D Hijaz (D Eb F# G A Bb C):
// eight bars of melody over a drone, a chord per bar and a frame drum.
const D = 12, Eb = 13, Fs = 16, G = 17, A = 19, Bb = 20, C = 22, D2 = 24, REST = null;
export const GOLDEN_CITY_MUSIC = {
  root: 62, scale: [0, 1, 4, 5, 7, 8, 10], instrument: 'santur', tempo: 70, octave: 12, motif: null, drum: false,
  song: {
    tempo: 70,
    lead: [
      [[D, 1], [Eb, 0.5], [Fs, 0.5], [G, 1], [Fs, 1]],
      [[Eb, 1.5], [D, 0.5], [REST, 2]],
      [[A, 1], [Bb, 0.5], [A, 0.5], [G, 1], [Fs, 1]],
      [[G, 0.5], [Fs, 0.5], [Eb, 1], [D, 2]],
      [[D2, 1], [C, 0.5], [Bb, 0.5], [A, 2]],
      [[Bb, 0.5], [A, 0.5], [G, 0.5], [Fs, 0.5], [G, 2]],
      [[Fs, 1], [Eb, 1], [Fs, 0.5], [G, 0.5], [A, 1]],
      [[Eb, 1], [D, 3]],
    ],
    // One chord per bar (semitones above D4): D, D, Cm, D, Gm, Gm, Cm, D.
    chords: [[0, 4, 7], [0, 4, 7], [-2, 1, 5], [0, 4, 7], [-7, -4, 0], [-7, -4, 0], [-2, 1, 5], [0, 4, 7]],
  },
};

// A diamond for a route's target while the city is open (or null).
export function cityGem(route, taken, rand) {
  if (route.target.kind === 'ledge') return null;
  const key = `${route.from.id}>${route.target.id}`;
  if (taken.has(key) || rand() >= GOLDEN_CITY.diamondChance) return null;
  return { type: 'diamond', key };
}
