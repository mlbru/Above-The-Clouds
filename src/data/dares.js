// Bram's dares: pick up to two before an endless run (the DARES sign at base
// camp). Each one makes the climb harder in its own way and adds to the gems
// you earn. A dared run keeps its own record per set of dares (and mode), so
// it never touches the mode records or the leaderboard.
//   mirror  every left/right arrow is shown the other way round (press the real one)
//   night   the sun never rises
//   quick   the beat is 10% faster
//   light   ledges only top your grip up to half
//   blind   every note goes blind above 100 m
export const DARES = [
  { id: 'mirror', name: 'MIRROR MOUNTAIN', short: 'MIRROR', text: 'EVERY ← AND → IS SHOWN THE OTHER WAY ROUND.', color: '#ff9ae6' },
  { id: 'night', name: 'ENDLESS NIGHT', short: 'NIGHT', text: 'THE SUN NEVER RISES.', color: '#9fb4ff' },
  { id: 'quick', name: 'QUICK HANDS', short: 'QUICK', text: 'THE BEAT IS 10% FASTER.', color: '#f2c14e' },
  { id: 'light', name: 'LIGHT PACK', short: 'LIGHT', text: 'LEDGES ONLY FILL YOUR GRIP TO HALF.', color: '#8fd16a' },
  { id: 'blind', name: 'BLIND FAITH', short: 'BLIND', text: 'EVERY NOTE GOES BLIND ABOVE 100 M.', color: '#d8a6ff' },
];
export const DARE_BY_ID = Object.fromEntries(DARES.map((d) => [d.id, d]));

export const MAX_DARES = 2;
export const DARE = {
  gemScale: 1.25, // per dare
  tempo: 0.91, // QUICK HANDS: beat length factor
  lightCap: 0.5, // LIGHT PACK: share of the grip a ledge fills
  blindFrom: 100, // BLIND FAITH: metres
  stampAt: 500, // every dare has a stamp for reaching this height with it on
};

// Only known ids, at most MAX_DARES, in a fixed order.
export function cleanDares(ids) {
  const set = new Set(ids || []);
  return DARES.filter((d) => set.has(d.id)).slice(0, MAX_DARES).map((d) => d.id);
}

export const dareScale = (ids) => DARE.gemScale ** cleanDares(ids).length;
// The record key: mode plus the dares, e.g. 'normal:mirror+night'.
export const dareKey = (ids, mode) => `${mode}:${cleanDares(ids).join('+')}`;
export const dareLabel = (ids) => cleanDares(ids).map((id) => DARE_BY_ID[id].short).join('+');
