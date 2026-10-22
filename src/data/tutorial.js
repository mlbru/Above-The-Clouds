// The Training Crag: a hand-built tutorial climb, coached by Bram the trader.
// Lessons are tied to holds on a fixed wall. Each lesson has a few short spoken
// lines, an optional goal, and a tag saying when the feature shows up in a real
// run (derived from the balance config so it stays accurate).
import { BALANCE } from '../config/balanceConfig.js';
import { BIOMES } from './biomes.js';

const hardH = (m, b) => Math.round(m / b.modes.hard.rampSpeed);

const fromShort = (m, b) => `FROM ${m} M (HARD: ${hardH(m, b)} M)`;

export function whenTexts(b = BALANCE) {
  const r = b.ramp;
  const rest = r.restEvery;
  return {
    always: 'EVERY CLIMB',
    jug: 'ABOUT 1 IN 10 HOLDS',
    rest: `EVERY ${rest[0].every} TO ${rest[rest.length - 1].every} SECTIONS`,
    slip: 'WHEN YOUR GRIP RUNS OUT',
    streak: 'ALWAYS: 10, 20, 30 IN A ROW PAY OUT',
    offbeat: fromShort(r.syncopation[0], b),
    hold: fromShort(r.hold[0], b),
    loose: `FROM ${BIOMES.stone.from} M`,
    icy: `FROM ${BIOMES.frozen.from} M`,
    crumbling: fromShort(r.crumbling[0], b),
    gust: fromShort(r.gust[0], b),
    blind: fromShort(r.fade[0], b),
    ramp: `FASTER AND FASTER UNTIL ${r.fullAt} M`,
    gems: 'EVERY RUN, MOSTLY ON RISKY ROUTES',
  };
}

// Main-line x position per level: a gentle zig-zag up the middle of the wall.
export const pathX = (level) => Math.round(240 + 42 * Math.sin(level * 0.55));

// Levels with a special hold, and the extra holds used by the route-choice lesson.
const SPECIAL = { 6: { kind: 'jug' }, 20: { hazard: 'loose' }, 22: { hazard: 'icy' }, 23: { hazard: 'crumbling' } };
const EXTRAS = { 8: -56, 9: 60 };
export const LEDGES = { camp: 0, mid: 10, top: 30 };
const GAP = [1, 2, 11, 12];

// Segment layout: [startLevel, endLevel, rest]
export const TUTORIAL_SEGMENTS = [
  [0, 4, { type: 'camp', name: 'TRAINING CRAG' }],
  [5, 10, { type: 'ledge', name: 'TRAINING LEDGE' }],
  [11, 30, { type: 'hut', name: 'TOP OF THE TRAINING CRAG' }],
];

export function tutorialLevelNodes(level) {
  const y = -level * 24;
  if (Object.values(LEDGES).includes(level)) return [{ id: `${level}:0`, level, x: pathX(level), y, kind: 'ledge', hazard: null, main: true }];
  if (GAP.includes(level)) return [];
  const sp = SPECIAL[level] || {};
  const nodes = [{ id: `${level}:0`, level, x: pathX(level), y, kind: sp.kind || 'hold', hazard: sp.hazard || null, main: true }];
  if (EXTRAS[level]) nodes.push({ id: `${level}:1`, level, x: pathX(level) + EXTRAS[level], y, kind: 'hold', hazard: null, main: false });
  return nodes;
}

const n = (dir, extra = {}) => ({ dir, gap: 1, hold: 0, hidden: false, gust: false, ...extra });
const seq = (s) => s.split('').map((d) => n(d));

// Steps run in order. type 'rest' happens on a ledge; type 'route' offers the
// listed routes from `from`; type 'slip' empties your grip after Bram's lines.
//   lesson: title shown in the lesson chip (steps without one continue a lesson)
//   say:    Bram's lines (string, or { t, p } with p = what the arrow points at)
//   combo:  line when the climb starts
//   goal:   { text, perfects | noMiss | risky | later }; win / lose: Bram's reaction
//           (later: completed by the next step, which has `completes`)
//   when:   when this shows up in a real run
export function buildTutorialSteps(b = BALANCE) {
  const w = whenTexts(b);
  return [
    { type: 'rest', at: '0:0', lesson: 'WELCOME', say: [
      "HEY THERE! I'M BRAM. I RUN THE STALL\nDOWN AT BASE CAMP.",
      "LET'S GET YOU CLIMBING.\nPRESS SPACE OR ↑ TO LEAVE CAMP.",
    ] },
    { type: 'route', from: '0:0', lesson: 'ON THE BEAT', when: w.always,
      say: [{ t: 'ONE ROUTE FOR NOW.\nPRESS ↑ OR SPACE TO START IT.', p: 'cards' }],
      combo: { t: 'PRESS EACH ARROW THE MOMENT\nIT TOUCHES THE LINE!', p: 'line' },
      goal: { text: 'FINISH THE CLIMB' }, win: "YOU'RE CLIMBING! EASY, RIGHT?",
      routes: [{ to: '3:0', type: 'safe', label: 'FIRST CLIMB', notes: seq('LUR'), beatMs: 820, windowScale: 1.3 }] },
    { type: 'route', from: '3:0', lesson: 'PERFECT TIMING', when: w.always,
      say: ['RIGHT ON THE LINE = PERFECT.\nA BIT OFF = GOOD. WAY OFF = MISS.'],
      combo: { t: 'AIM FOR THE CENTRE!', p: 'line' },
      goal: { text: '2 PERFECTS', perfects: 2 }, win: 'NOW THAT IS CLEAN CLIMBING!', lose: 'ALMOST! TWO MISSES AND YOU\nLOSE THE HOLD, SO STAY SHARP.',
      routes: [{ to: '5:0', type: 'normal', label: 'PRACTICE', notes: seq('LURU'), beatMs: 720, windowScale: 1.2 }] },
    { type: 'route', from: '5:0', lesson: 'GRIP', when: w.always,
      say: [{ t: "SEE THAT BAR? THAT'S YOUR GRIP.\nEVERY MOVE COSTS A LITTLE.", p: 'grip' }, { t: 'PERFECTS COST ALMOST NOTHING.\nRUN OUT AND YOU SLIP!', p: 'grip' }],
      goal: { text: 'REACH THE JUG' }, win: 'GOOD. NOW LOOK AT THAT HOLD...',
      routes: [{ to: '6:0', type: 'safe', label: 'TO THE JUG', notes: seq('ULU'), beatMs: 720, windowScale: 1.2 }] },
    { type: 'route', from: '6:0', setGrip: 55, lesson: 'JUGS AND ROUTES', when: w.jug,
      say: [{ t: 'BIG POCKET = JUG. HANG HERE\nAND YOUR GRIP REFILLS!', p: 'grip' }, { t: 'NOW PICK A ROUTE WITH ← →.\nRISKY GOES HIGHER, COSTS MORE.', p: 'cards' }],
      goal: { text: 'TRY THE RISKY ONE', risky: true }, win: 'BRAVE! RISKY ROUTES ALSO\nCARRY THE MOST GEMS.', lose: 'PLAYING IT SAFE. SMART\nWHEN YOUR GRIP IS LOW!',
      routes: [
        { to: '7:0', type: 'safe', notes: seq('RUL'), beatMs: 700, windowScale: 1.15 },
        { to: '8:1', type: 'normal', notes: seq('LULU'), beatMs: 620, windowScale: 1.1 },
        { to: '9:1', type: 'risky', notes: seq('RURUL'), beatMs: 560, windowScale: 1.05 },
      ] },
    { type: 'rest', at: '10:0', lesson: 'LEDGES', when: w.rest, say: [
      "A LEDGE! FULL GRIP AGAIN, AND\nIT'S YOUR NEW CHECKPOINT.",
      'R REST   V VIEW   C PHOTO\nSPACE: CLIMB ON.',
    ] },
    { type: 'route', from: '10:0', say: ["ONE MORE MOVE... THEN I'LL SHOW\nYOU WHAT HAPPENS AT ZERO GRIP."],
      routes: [{ to: '13:0', type: 'safe', notes: seq('ULU'), beatMs: 720, windowScale: 1.2 }] },
    { type: 'slip', from: '13:0', lesson: 'SLIPPING', when: w.slip,
      say: [{ t: "UH OH, NO GRIP! YOU'RE SLIPPING!\nHIT THE BIG ARROW WHEN THE RING CLOSES!", p: 'recovery' }],
      goal: { text: 'CATCH THE WALL' } },
    { type: 'route', from: '13:0', afterSlip: true, lesson: 'STREAKS', when: w.streak,
      say: [{ t: 'PERFECTS IN A ROW MAKE A STREAK.\nLISTEN TO THE NOTES CLIMB!', p: 'streak' }],
      goal: { text: '6 PERFECTS', perfects: 6 }, win: 'ON FIRE! LONG STREAKS PAY OUT\nGRIP AND GEMS.', lose: 'ONE GOOD OR MISS RESETS IT.\nYOU WILL GET THERE!',
      routes: [{ to: '15:0', type: 'normal', label: 'STREAK', notes: seq('LURULU'), beatMs: 620, windowScale: 1.1 }] },
    { type: 'route', from: '15:0', lesson: 'OFF-BEAT', when: w.offbeat,
      say: ['THIS ONE SKIPS! WATCH THE GAPS\nBETWEEN THE ARROWS.'],
      combo: { t: 'FOLLOW THE ARROWS,\nNOT A STEADY BEAT!', p: 'line' },
      goal: { text: 'NO MISSES', noMiss: true }, win: 'NICE RHYTHM!',
      routes: [{ to: '17:0', type: 'normal', label: 'OFFBEAT', notes: [n('L'), n('U', { gap: 0.5 }), n('R', { gap: 1.5 }), n('U'), n('L', { gap: 0.5 })], beatMs: 640, windowScale: 1.1 }] },
    { type: 'route', from: '17:0', lesson: 'HOLD NOTES', when: w.hold,
      say: ['AN ARROW WITH A TAIL? PRESS IT\nAND KEEP HOLDING TILL THE TAIL ENDS.'],
      combo: { t: 'HOLD... HOLD...\nLET GO WHEN THE TAIL IS GONE!', p: 'line' },
      goal: { text: 'NO MISSES', noMiss: true }, win: 'STRONG FINGERS!',
      routes: [{ to: '19:0', type: 'normal', label: 'HOLD', notes: [n('U'), n('L'), n('U', { hold: 1.5 }), n('R', { gap: 1 })], beatMs: 620, windowScale: 1.1 }] },
    { type: 'route', from: '19:0', lesson: 'LOOSE ROCK', when: w.loose,
      say: [{ t: 'ORANGE ROCK IS LOOSE. A MISS\nON IT COSTS EXTRA GRIP.', p: 'cards' }],
      goal: { text: 'NO MISSES', noMiss: true },
      routes: [{ to: '20:0', type: 'safe', notes: seq('LUR'), beatMs: 680, windowScale: 1.1 }] },
    { type: 'route', from: '20:0', lesson: 'ICE', when: w.icy,
      say: [{ t: 'SHINY BLUE = ICE. TIGHTER TIMING,\nAND HANGING ON IT DRAINS GRIP.', p: 'cards' }],
      goal: { text: 'NO MISSES', noMiss: true }, win: 'SMOOTH ON THE ICE!',
      routes: [{ to: '22:0', type: 'normal', label: 'ICY', notes: seq('RULU'), beatMs: 660, windowScale: 0.85 }] },
    { type: 'route', from: '22:0', lesson: 'CRUMBLING', when: w.crumbling,
      say: ['GREY CRACKED ROCK CRUMBLES.\nOFF IT FAST, BEFORE IT BREAKS!'],
      goal: { text: 'GET OFF IN TIME', later: true },
      routes: [{ to: '23:0', type: 'safe', notes: seq('URU'), beatMs: 680, windowScale: 1.1 }] },
    { type: 'route', from: '23:0', say: [{ t: 'QUICK! PICK THE ROUTE NOW!', p: 'cards' }], win: 'PHEW! JUST IN TIME.', completes: true,
      routes: [{ to: '24:0', type: 'safe', label: 'QUICK!', notes: seq('LUR'), beatMs: 680, windowScale: 1.1 }] },
    { type: 'route', from: '24:0', lesson: 'WIND', when: w.gust,
      say: ['HEAR THAT WIND? BLUE ARROWS ARE\nGUSTS: THEIR TARGET IS SMALLER.'],
      combo: { t: 'GUST! TIGHT TIMING\nON THE BLUE ONES!', p: 'line' },
      goal: { text: 'NO MISSES', noMiss: true }, win: 'THE WIND CAN TRY!',
      routes: [{ to: '26:0', type: 'normal', label: 'GUST', notes: [n('L'), n('U'), n('R', { gust: true }), n('U', { gust: true }), n('L')], beatMs: 640, windowScale: 1.05 }] },
    { type: 'route', from: '26:0', lesson: 'BLIND NOTES', when: w.blind,
      say: ['SOME ARROWS VANISH BEFORE THE LINE.\nKEEP THE BEAT IN YOUR HEAD!'],
      combo: { t: 'THE SMALL ROW ON TOP\nSTILL SHOWS WHICH ONE.', p: 'line' },
      goal: { text: 'NO MISSES', noMiss: true }, win: 'CLIMBING BLIND. IMPRESSIVE!',
      routes: [{ to: '28:0', type: 'normal', label: 'BLIND', notes: [n('U'), n('L', { hidden: true }), n('U'), n('R', { hidden: true }), n('U')], beatMs: 640, windowScale: 1.1 }] },
    { type: 'route', from: '28:0', lesson: 'THE REAL MOUNTAIN', when: w.ramp,
      say: ['LAST CLIMB! OUT THERE THE BEAT GETS\nFASTER THE HIGHER YOU GO.'],
      goal: { text: 'REACH THE TOP' },
      routes: [{ to: '30:0', type: 'normal', label: 'TO THE TOP', notes: seq('LURU'), beatMs: 580, windowScale: 1.05 }] },
    { type: 'rest', at: '30:0', final: true, lesson: 'GEMS', when: w.gems, say: [
      'YOU MADE IT! ONE LAST THING: GEMS.',
      { t: 'A GEM ON A ROUTE CARD? TAKE THAT\nROUTE AND THE GEM IS YOURS.', p: 'gems' },
      "SPEND THEM AT MY STALL. HERE'S\nSOME START-UP MONEY. GOOD LUCK!",
    ] },
  ];
}

export const TUTORIAL_REWARD = 15;
