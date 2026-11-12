// What Bram says when you come back to base camp: one line that knows your
// record and how the last run went. Shown first among his forecast lines.
// Pure: prog data in, { text } out (or null when he has nothing to add).
const LINES = {
  first: ['FIRST TIME UP? START SLOW. THE WALL IS PATIENT.'],
  record: ['NEW RECORD! {m} M. I SAW YOUR LAMP FROM HERE.', '{m} M! I WILL CARVE IT ON THE POST.'],
  short: ['BACK ALREADY? THE GREEN RISE BITES TOO.', 'A SHORT ONE. SHAKE IT OFF.'],
  mid: ['{m} M. NOT BAD. THE CLOUDS WILL WAIT.', 'YOU SMELL OF ROCK DUST. GOOD.'],
  high: ['{m} M. THE SPIRES MADE YOU QUIET, I CAN TELL.', 'TEA IS ON. {m} M EARNS A CUP.'],
  top: ['BACK FROM {m}? SIT. EAT. YOU LOOK LIKE A GHOST.', '{m} M. YOUR HANDS ARE SHAKING. MINE TOO.'],
  dragon: ['YOU MET THE DRAGON AND KEPT YOUR EYEBROWS.'],
  elsa: ['HIGHER THAN ELSA EVER GOT. SHE WOULD HAVE LAUGHED.'],
};

const pick = (list, n) => list[Math.abs(n | 0) % list.length];

// data: the save (prog.data). Returns { text } or null.
export function bramGreeting(data) {
  const last = data.lastRun;
  const best = (data.bestByMode && data.bestByMode.normal) || 0;
  if (!data.runs) return { text: LINES.first[0] };
  if (!last) return best >= 2000 ? { text: LINES.elsa[0] } : null;
  const m = Math.floor(last.reached || 0);
  const n = (data.runs || 0) + m;
  let list;
  if (last.record && m >= 30) list = LINES.record;
  else if (m >= 1700 && best < 2000 && n % 3 === 0) list = LINES.dragon;
  else if (best >= 2000 && n % 4 === 0) list = LINES.elsa;
  else if (m >= 1400) list = LINES.top;
  else if (m >= 650) list = LINES.high;
  else if (m >= 60) list = LINES.mid;
  else list = LINES.short;
  return { text: pick(list, n).replace('{m}', m) };
}
