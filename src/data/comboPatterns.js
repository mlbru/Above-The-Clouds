// Hand-authored library of readable climbing sequences.
// L = reach/shift left, R = reach/shift right, U = pull/step up.
const RAW = {
  3: ['LUR', 'RUL', 'LUL', 'RUR', 'ULU', 'URU', 'LRU', 'RLU', 'LUU', 'RUU'],
  4: ['LURU', 'RULU', 'LULU', 'RURU', 'ULUR', 'URUL', 'LRUU', 'RLUU', 'LUUL', 'RUUR', 'ULUL', 'URUR'],
  5: ['RULUR', 'LURUL', 'LULUR', 'RURUL', 'ULURU', 'LRULU', 'RLURU', 'LULUL', 'RURUR', 'URURU', 'ULULU', 'LUURU', 'RUULU'],
};

export const DIRS = ['L', 'U', 'R'];

export const COMBO_PATTERNS = Object.fromEntries(
  Object.entries(RAW).map(([len, list]) => [
    len,
    list.map((s) => {
      const dirs = s.split('');
      const lean = dirs.filter((d) => d === 'R').length - dirs.filter((d) => d === 'L').length;
      const upRatio = dirs.filter((d) => d === 'U').length / dirs.length;
      return { id: s, dirs, lean, upRatio };
    }),
  ]),
);

// A pattern is valid if it uses only known directions and never repeats the
// same direction three times in a row (unreadable and physically odd).
export function isValidPattern(dirs) {
  if (!Array.isArray(dirs) || dirs.length < 1) return false;
  for (let i = 0; i < dirs.length; i++) {
    if (!DIRS.includes(dirs[i])) return false;
    if (i >= 2 && dirs[i] === dirs[i - 1] && dirs[i] === dirs[i - 2]) return false;
  }
  return true;
}

function weightFor(style) {
  return (p) => {
    if (style === 'crack') return 0.4 + p.upRatio * 2;
    if (style === 'traverse') return 0.4 + (1 - p.upRatio) * 2;
    return 1;
  };
}

// style: 'balanced' | 'crack' (more pulling up) | 'traverse' (more side moves)
export function choosePattern(rng, length, dx, style = 'balanced') {
  if (length > 5) {
    // Longer climbs chain two authored patterns, retrying until readable.
    for (let attempt = 0; attempt < 20; attempt++) {
      const a = choosePattern(rng, 3, dx, style);
      const b = choosePattern(rng, length - 3, dx, style);
      const joined = a.concat(b);
      if (isValidPattern(joined)) return joined;
    }
    return ['L', 'U', 'R', 'U', 'L', 'U', 'R'].slice(0, length);
  }
  const pool = COMBO_PATTERNS[length] || COMBO_PATTERNS[3];
  const sign = Math.abs(dx) < 14 ? 0 : Math.sign(dx);
  let candidates = pool.filter((p) => (sign === 0 ? Math.abs(p.lean) <= 1 : Math.sign(p.lean) === sign || p.lean === 0));
  if (!candidates.length) candidates = pool;
  return rng.weighted(candidates, weightFor(style)).dirs.slice();
}
