// Expeditions: hand-built mountains with a real summit. Every hold, every
// rhythm and every ledge is written here; ExpeditionMountain lays them out.
//
// A pitch is the climb from one ledge to the next.
//   line    the holds on the way up, left to right in climbing order. Each
//           token is the sideways step (px) from the previous hold, then
//           optional flags: j jug, l loose, i icy, c crumbling, g gem,
//           ^ rise 3 levels, _ rise 1 level (default 2; 1 level = 1.5 m).
//           The first hold after a ledge always rises at least 3 levels.
//   rhythm  the arrows for each route type; the climb towards hold n uses
//           entry n of the list (cycling). Arrow tokens: L U R, then
//           - (half beat early, off-beat), + (half beat late), = (hold for
//           1.5 beats), ? (blind), ! (gust).
//   tempo   beat length factor for the pitch (lower is faster)
//   width   wall width around the line; features: wall art (crack, strata, icefall)
//   ledge   name of the ledge at the top; page: Bram's journal page found there
//
// From a hold, SAFE climbs to the next hold, NORMAL skips one, RISKY skips two.
//
// Optional per expedition:
//   theme    a special biome used for the whole climb (data/biomes.js: volcano, sky)
//   lava     { speed } rising lava in px per second (see ClimbScene.updateLava)
//   islands  true: no wall, every hold is a floating island (render/wallArt.js)
//   look     colours for the expedition picker's painted mountain

export const EXPEDITIONS = {
  'brams-route': {
    id: 'brams-route',
    name: "BRAM'S ROUTE",
    look: { kind: 'peak', biome: 'green', alt: 60, dayT: 0.03, ground: 0xffffff, color: 0x9fd8ff, difficulty: 1 },
    blurb: 'THE CLIMB BRAM NEVER FINISHED. 12 PITCHES TO A REAL SUMMIT.',
    seed: 19790,
    reward: 120,
    pitches: [
      {
        name: 'THE MEADOW SLABS', ledge: 'MEADOW LEDGE', tempo: 1.08, width: 300,
        line: '0 -24 +30j -20 +26 -30 +18g +24 -26 +20 -18j +28 -24 +16',
        rhythm: {
          safe: ['L U R', 'U L U', 'R U L', 'U R U'],
          normal: ['L U R U', 'U L U R', 'R U L U'],
          risky: ['L U R U L', 'R U L U R'],
        },
        page: [
          'DAY ONE. ELSA AND I LEFT THE MEADOWS AT DAWN.',
          'SHE SAYS WE STAND ON TOP BEFORE THE FULL MOON.',
          'I BELIEVE HER. I ALWAYS DO.',
        ],
      },
      {
        name: 'PINE CHIMNEY', ledge: 'PINE TOP', tempo: 1.02, width: 230, features: ['crack'], waterfall: 1,
        line: '-10 +22 -22 +22 -22g +22 -20 +20j -22 +22 -22 +22g -20 +18 -16',
        rhythm: {
          safe: ['L U R', 'R U L', 'U L U'],
          normal: ['L U- R U', 'R U L U', 'L U R U'],
          risky: ['L U R- U L', 'R U L U R', 'L R U- L U'],
        },
        page: [
          'THE CHIMNEY WAS TIGHT. ELSA CLIMBED IT HUMMING.',
          'I CLIMBED IT COMPLAINING.',
          'WE ATE THE LAST OF THE BREAD UP HERE.',
        ],
      },
      {
        name: 'GRANITE GATE', ledge: 'GRANITE GATE', tempo: 0.98, width: 280, features: ['strata'],
        line: '20 +30 -18l +26 -34 +20g -24 +30 -16l +22 -30j +26 -20 +24g -18',
        rhythm: {
          safe: ['U L U', 'L U R', 'R U U'],
          normal: ['L U R U', 'U R- U L', 'R U L U'],
          risky: ['L U R U L', 'U L- U R U', 'R U L- U R'],
        },
        page: [
          "ROCKS CAME DOWN TODAY. ELSA HEARD THEM FIRST:",
          "'LEFT, BRAM!' I WENT LEFT.",
          'I OWE HER A NEW HAT. MINE IS SOMEWHERE BELOW.',
        ],
      },
      {
        name: "BRAM'S CRACK", ledge: "BRAM'S CRACK", tempo: 0.94, width: 200, features: ['crack'],
        line: '-14 +8^ -8 +8 -8g +8^ -8 +8 -8j +8 -8^ +8g -8 +8 -8',
        rhythm: {
          safe: ['U U L', 'U U R', 'L U U'],
          normal: ['U L U= R', 'U R U L', 'L U U= R'],
          risky: ['U L U R U', 'U R U= L U', 'L U R U U'],
        },
        page: [
          'WE NAMED THIS CRACK AFTER ME, BECAUSE I GOT',
          'STUCK IN IT FOR AN HOUR. ELSA TOOK A PHOTO.',
          'I HOPE THE FILM IS RUINED.',
        ],
      },
      {
        name: 'THE ANVIL', ledge: 'THE ANVIL', tempo: 0.9, width: 300, features: ['strata'],
        line: '30 -36 +34l -30 +24g -38 +32 -20j +36 -34l +24 -28g +30 -22 +18',
        rhythm: {
          safe: ['L U R', 'R U L', 'U L U'],
          normal: ['L U R- U', 'R U- L U', 'L R U U='],
          risky: ['L U- R U L+', 'R U L U- R', 'L U R U= L'],
        },
        page: [
          'FROM THE ANVIL YOU CAN SEE THE WHOLE VALLEY.',
          'ELSA TRADED HER COMPASS FOR MY LAST CHOCOLATE.',
          'I THINK SHE WON THAT TRADE.',
        ],
      },
      {
        name: 'LOOSE STEPS', ledge: 'LOOSE STEPS', tempo: 0.86, width: 270,
        line: '-20 +26l -22c +28l -24 +20lg -30 +22c -18l +26j -24l +20g -26c +22 -16',
        rhythm: {
          safe: ['U L U', 'L U R', 'R U L U'],
          normal: ['L U R U', 'U L- U R', 'R U L U?'],
          risky: ['L U R U L', 'R U- L U R', 'U L U? R U'],
        },
        page: [
          'BAD ROCK. EVERY HOLD WOBBLES. WE MOVED SLOWLY',
          'AND TALKED ABOUT NOTHING, WHICH HELPED.',
          'FIRST SNOW TONIGHT.',
        ],
      },
      {
        name: 'BLUE ICE GULLY', ledge: 'BLUE GULLY', tempo: 0.84, width: 230, features: ['icefall'],
        line: '10 -16i +18 -14i +16g -18i +14 -16j +18i -14 +16ig -18 +14i -12 +10',
        rhythm: {
          safe: ['U L U', 'U R U', 'L U R'],
          normal: ['U L U R', 'L U= R U', 'R U L U'],
          risky: ['U L U R U', 'L U R U= L', 'R U- L U R'],
        },
        page: [
          'ICE IN THE GULLY. ELSA LED, I BELAYED.',
          'MY FINGERS ARE COLD ENOUGH TO RING LIKE BELLS.',
          'SHE SAYS THAT IS NOT HOW FINGERS WORK.',
        ],
      },
      {
        name: 'THE CORNICE', ledge: 'THE CORNICE', tempo: 0.82, width: 290,
        line: '-30 +34 -28i +36g -30 +28j -36i +30 -26 +34g -32i +26 -30 +24 -20',
        rhythm: {
          safe: ['L U R', 'R U L', 'U L! U'],
          normal: ['L U R! U!', 'R U L U', 'L U- R U'],
          risky: ['L U R! U! L', 'R U L U R', 'L U- R U L+'],
        },
        page: [
          'WIND ALL NIGHT. THE TENT SOUNDED LIKE A DRUM.',
          'NEITHER OF US SLEPT, SO WE SANG.',
          'BADLY. VERY BADLY.',
        ],
      },
      {
        name: 'WHITE SILENCE', ledge: 'TURNING POINT', tempo: 0.8, width: 260,
        line: '24 -22 +26i -24g +22 -26j +24i -20 +26 -24ig +22 -26 +20i -22 +18',
        rhythm: {
          safe: ['U L U', 'L U R', 'R U? L'],
          normal: ['L U? R U', 'U L U R?', 'R U L U'],
          risky: ['L U R? U L', 'R U? L U R', 'U L U R U?'],
        },
        page: [
          "THE WHITEOUT CAME. ELSA SLIPPED AND HURT HER WRIST.",
          "SHE SAID 'GO ON WITHOUT ME.' I SAID NO.",
          'WE TURNED BACK HERE. THIS IS MY LAST PAGE.',
        ],
      },
      {
        name: 'THE CLOUD LINE', ledge: 'THE CLOUD LINE', tempo: 0.78, width: 280,
        line: '-26 +30 -24g +28 -30j +24 -28 +30g -22 +26 -30 +24j -26 +22g -18',
        rhythm: {
          safe: ['L U R U', 'U L U R', 'R U L U'],
          normal: ['L U R U L', 'U L- U R U', 'R U L U= R'],
          risky: ['L U R U L U', 'R U- L U R U', 'U L U R- U L'],
        },
        page: [
          "A DIFFERENT HAND: 'BRAM. I CAME BACK ALONE,",
          'TEN SUMMERS LATER. YOUR PAGES WERE STILL HERE.',
          "I READ THEM ALL THE WAY UP.' - E.",
        ],
      },
      {
        name: 'THE LAST WALL', ledge: 'LAST BIVOUAC', tempo: 0.76, width: 240, features: ['strata'],
        line: '18 -20 +22 -20g +18^ -22 +20 -18j +22 -20^ +18g -22 +20 -18 +16',
        rhythm: {
          safe: ['L U R U', 'U R U L', 'R U L U'],
          normal: ['L U R- U L', 'U L U= R U', 'R U L+ U R'],
          risky: ['L U R U L U', 'R U- L U R U', 'U L U? R U L'],
        },
        page: [
          "'THE AIR IS THIN AND THE LIGHT IS STRANGE.",
          'I SANG OUR SONG. STILL BADLY.',
          "ONLY THE RIDGE IS LEFT.' - E.",
        ],
      },
      {
        name: 'SUMMIT RIDGE', ledge: 'THE SUMMIT', tempo: 0.74, width: 200,
        line: '-16 +18 -18g +16 -18 +18j -16 +18 -18g +16 -14 +18 -16j +14 -10',
        rhythm: {
          safe: ['L U R U', 'U L U R', 'R U L U'],
          normal: ['L U R U L', 'U R- U L U', 'R U L U= R'],
          risky: ['L U R U L U', 'U R U- L U R', 'R U L U R U'],
        },
      },
    ],
    // Found on the summit, under a flat stone.
    summitPage: [
      "'BRAM - I MADE IT. YOU WERE RIGHT TO TURN US BACK.",
      'COME UP ONE DAY AND READ THIS YOURSELF.',
      "I LEFT THE COMPASS. IT ALWAYS POINTED AT YOU.' - E.",
    ],
  },
};

const VOLCANO_RHYTHM = (tempoSafe, tempoNormal, tempoRisky) => ({ safe: tempoSafe, normal: tempoNormal, risky: tempoRisky });

EXPEDITIONS['mount-ember'] = {
  id: 'mount-ember',
  name: 'MOUNT EMBER',
  look: { kind: 'volcano', biome: 'volcano', alt: 60, dayT: 0.56, ground: 0x6a4038, color: 0xff9a3c, difficulty: 3 },
  blurb: 'AN ACTIVE VOLCANO. THE LAVA RISES BEHIND YOU. DON\'T STOP.',
  seed: 66613,
  reward: 160,
  theme: 'volcano',
  lava: { speed: 7 },
  pitches: [
    {
      name: 'THE ASH FIELDS', ledge: 'CINDER SHELF', tempo: 1.04, width: 320,
      line: '0 +26 -22 +30j -26 +20g -28 +24 -18l +30 -24 +20 -26j +22',
      rhythm: VOLCANO_RHYTHM(['L U R', 'U R U', 'R U L'], ['L U R U', 'U L U R', 'R U- L U'], ['L U R U L', 'R U L- U R']),
      page: ['ELSA - MY OWN NOTES NOW. BRAM KEEPS HIS.', 'THE GROUND IS WARM HERE. MY BOOTS SMOKE', 'IF I STAND STILL. SO I DO NOT STAND STILL.'],
    },
    {
      name: 'BLACK GLASS SLOPE', ledge: 'OBSIDIAN STEP', tempo: 1.0, width: 290, features: ['crack'],
      line: '-14 +24 -30l +22 -20 +28g -24 +18 -30 +26l -22 +30j -18 +20 -24',
      rhythm: VOLCANO_RHYTHM(['L U= R', 'U L U', 'R U L'], ['L U R= U', 'U L- U R', 'R U L U'], ['L U R U= L', 'R U- L U R', 'U L R- U L']),
      page: ['THE ROCK IS GLASS. IT CUTS THE ROPE.', 'BEHIND ME THE GLOW CLIMBS TOO,', 'A LITTLE SLOWER THAN ME. FOR NOW.'],
    },
    {
      name: 'THE SMOKE CHIMNEY', ledge: 'SULPHUR LEDGE', tempo: 0.96, width: 250, features: ['crack'],
      line: '20 -22 +22 -22g +22 -20 +20j -22 +22l -22 +20 -20g +22 -18',
      rhythm: VOLCANO_RHYTHM(['L U R', 'R U L', 'U U L'], ['L U- R U', 'R U L= U', 'U L U R'], ['L U R- U L', 'R U= L U R', 'L R U- L U']),
      page: ['SMOKE IN THE CHIMNEY. I CLIMBED IT BLIND,', 'COUNTING BEATS LIKE BRAM TAUGHT ME.', 'ONE, TWO, REACH. ONE, TWO, REACH.'],
    },
    {
      name: 'THE LAVA STAIRS', ledge: 'THE HOT LEDGE', tempo: 0.92, width: 230,
      line: '-20 +30c -26 +22 -30l +28g -22 +26c -30 +24 -20j +30 -26 +20l',
      rhythm: VOLCANO_RHYTHM(['L U R U', 'U R U', 'R L U'], ['L U R U L', 'U R- U L', 'R U L= U'], ['L U R U L U', 'R U- L U R U', 'U L R U= L']),
      page: ['THE STEPS CRUMBLE WHEN YOU TOUCH THEM.', 'DO NOT TOUCH THEM TWICE.', 'I LEFT A RED THREAD ON EVERY GOOD HOLD.'],
    },
    {
      name: 'ERUPTION GULLY', ledge: 'THE BOMB SHELTER', tempo: 0.88, width: 210, features: ['strata'],
      line: '16 -24 +20g -26 +24l -20 +26 -22j +20 -26c +24 -20 +18g -16',
      rhythm: VOLCANO_RHYTHM(['L U R U', 'R U L U', 'U L U R'], ['L U- R U L', 'R U L U= R', 'U R- U L U'], ['L U R- U L R', 'R U L U= R U', 'U L R U- L U']),
      page: ['THE MOUNTAIN COUGHED. STONES FLEW UP', 'AND CAME DOWN ON THE BEAT, LIKE A DRUM.', 'BRAM WOULD HAVE LAUGHED. I SCREAMED.'],
    },
    {
      name: 'THE CINDER CONE', ledge: 'EMBER SADDLE', tempo: 0.84, width: 190,
      line: '-18 +20 -20c +18 -20g +20 -18l +18 -20 +20j -18 +18c -16 +14',
      rhythm: VOLCANO_RHYTHM(['L U R U', 'U L U R', 'R U L U'], ['L U R- U L', 'U L U= R U', 'R U- L U R'], ['L U R U- L U', 'R U L U R= U', 'U R- U L U R']),
      page: ['NEARLY THERE. THE AIR TASTES OF MATCHES.', 'I CAN HEAR THE CRATER BREATHING.', 'IT SOUNDS LIKE SOMEONE ASLEEP.'],
    },
    {
      name: 'THE CRATER RIM', ledge: 'THE CRATER RIM', tempo: 0.8, width: 170,
      line: '14 -16 +16g -14 +16 -16j +14 -16l +16 -14g +12 -12',
      rhythm: VOLCANO_RHYTHM(['L U R U', 'U L U R', 'R U L U'], ['L U R U L', 'U R- U L U', 'R U L U= R'], ['L U R U L U', 'U R U- L U R', 'R U L U R= U']),
    },
  ],
  summitPage: [
    'A RED THREAD TIED TO A ROCK ON THE RIM,',
    'AND A NOTE: "THE MOUNTAIN SLEEPS. LET IT.',
    'THE SKY HAS ISLANDS. I AM GOING THERE." - E.',
  ],
};

EXPEDITIONS['sky-islands'] = {
  id: 'sky-islands',
  name: 'THE SKY ISLANDS',
  look: { kind: 'islands', biome: 'sky', alt: 140, dayT: 0.12, ground: null, color: 0xa8e878, difficulty: 2 },
  blurb: 'NO WALL. JUST ROCKS FLOATING IN THE WIND. JUMP ON THE GUSTS.',
  seed: 42420,
  reward: 160,
  theme: 'sky',
  islands: true,
  pitches: [
    {
      name: 'THE FIRST STEPPING STONES', ledge: 'MEADOW ISLAND', tempo: 1.04, width: 300,
      line: '0 +46 -40 +52 -48j +40 -52g +46 -40 +50 -44j +36',
      rhythm: { safe: ['L U R', 'U R U', 'R U L'], normal: ['L U R U', 'U L! U R', 'R U L U'], risky: ['L U R! U L', 'R U L U R'] },
      page: ['ELSA - THE ISLANDS ARE REAL. THEY DRIFT.', 'YOU WAIT FOR ONE TO COME CLOSE, THEN JUMP.', 'THE WIND HELPS IF YOU LISTEN TO IT.'],
    },
    {
      name: 'THE DRIFTING CHAIN', ledge: 'ROPE ISLAND', tempo: 1.0, width: 300,
      line: '-30 +54 -50 +44g -56 +50 -42j +56 -48 +44g -52 +40',
      rhythm: { safe: ['L U R', 'U L! U', 'R U L'], normal: ['L U! R U', 'U L U R', 'R U L! U'], risky: ['L U R U! L', 'R! U L U R', 'U L R U L'] },
      page: ['SOMEONE TIED THE ISLANDS TOGETHER ONCE.', 'THE ROPES ARE GONE. THE KNOTS ARE NOT.', 'I THINK IT WAS A CHILD. THE KNOTS ARE BAD.'],
    },
    {
      name: 'THE BIRD ROCKS', ledge: 'NEST ISLAND', tempo: 0.96, width: 300,
      line: '40 -46 +52j -50 +46 -54g +50 -44 +56 -50j +44 -38',
      rhythm: { safe: ['L U R', 'R U L', 'U R U'], normal: ['L U- R U', 'R U L! U', 'U L U R'], risky: ['L U R- U! L', 'R U L U R', 'L R! U L U'] },
      page: ['BIRDS NEST UNDER THE ISLANDS, UPSIDE DOWN.', 'THEY WATCHED ME CLIMB. NOBODY CLAPPED.', 'ONE STOLE MY APPLE.'],
    },
    {
      name: 'THE GUST GAP', ledge: 'THE WINDY ONE', tempo: 0.92, width: 300,
      line: '-36 +58 -54 +50 -58 +54g -50 +58 -52j +48 -56 +44',
      rhythm: { safe: ['L U! R', 'U R U', 'R! U L'], normal: ['L U R! U', 'U! L U R', 'R U L U!'], risky: ['L U! R U L', 'R U L! U R', 'U L R U! L'] },
      page: ['HERE THE GAPS ARE TOO WIDE TO JUMP.', 'THE GUSTS CARRY YOU, IF YOU JUMP ON THE BEAT.', 'IF YOU DO NOT, THE CLOUDS ARE SOFT. I HOPE.'],
    },
    {
      name: 'THE GARDEN ISLES', ledge: 'WIND GARDEN', tempo: 0.88, width: 300,
      line: '30 -48 +50g -44 +52j -50 +46 -54g +48 -46 +52 -40',
      rhythm: { safe: ['L U R U', 'U L U R', 'R U L'], normal: ['L U- R U L', 'U L U! R', 'R U= L U'], risky: ['L U R- U L R', 'U R U! L U', 'R U L U= R'] },
      page: ['FLOWERS UP HERE THAT DO NOT GROW BELOW.', 'I PRESSED ONE FOR BRAM. IT IS IN THIS PAGE.', '(THE PAGE SMELLS OF HONEY.)'],
    },
    {
      name: 'THE THIN AIR', ledge: 'THE LAST ISLAND BUT ONE', tempo: 0.84, width: 300,
      line: '-40 +56 -52 +54 -50g +56 -54 +50j -56 +52 -48 +40',
      rhythm: { safe: ['L U R U', 'U L! U R', 'R U L U'], normal: ['L U R! U L', 'U L U- R U', 'R U! L U R'], risky: ['L U! R U L U', 'R U L U- R! U', 'U R U L! U R'] },
      page: ['I CAN SEE THE TOP ISLAND. IT HAS A TREE.', 'AN APPLE TREE. THE BIRD WAS RIGHT.', 'BRAM, IF YOU READ THIS: COME UP. BRING BREAD.'],
    },
    {
      name: 'THE TREE ISLAND', ledge: 'THE TREE ISLAND', tempo: 0.8, width: 300,
      line: '36 -44 +46g -42 +44 -40 +42j -38 +40g -30',
      rhythm: { safe: ['L U R U', 'U L U R', 'R U L U'], normal: ['L U R U! L', 'U R- U L U', 'R U L U= R'], risky: ['L U R! U L U', 'U R U- L U R', 'R U L U R! U'] },
    },
  ],
  summitPage: [
    'UNDER THE APPLE TREE, TWO CUPS AND A KETTLE.',
    'A NOTE IN ELSA\'S HAND: "I KNEW YOU WOULD COME.',
    'SIT. THE TEA IS COLD, BUT THE VIEW IS NOT."',
  ],
};

// The Crevasse: a crack in the glacier, two ice walls facing each other.
// The line zigzags across the gap: every hold is on the other wall, so most
// climbs end in a jump, and the jump is the last arrow (L or R, on the beat).
// Rhythm banks have two entries, so entry 0 is a jump to the left wall (even
// holds) and entry 1 a jump to the right wall (odd holds). Ledges are snow
// bridges across the gap.
// The holds alternate walls (x 150 left, 330 right), so even holds are on the
// left wall and odd holds on the right; rhythm entry 0 is for climbs to the
// left wall, entry 1 for the right. SAFE and RISKY cross the gap and end on
// the jump arrow; NORMAL skips one hold and stays on the same wall.
EXPEDITIONS.crevasse = {
  id: 'crevasse',
  name: 'THE CREVASSE',
  look: { kind: 'glacier', biome: 'crevasse', alt: 60, dayT: 0.08, ground: 0xdfeaf7, color: 0x9fd8ff, difficulty: 2 },
  blurb: 'A CRACK IN THE GLACIER. JUMP FROM WALL TO WALL ON THE BEAT.',
  seed: 31337,
  reward: 140,
  theme: 'crevasse',
  chasm: true,
  pitches: [
    {
      name: 'THE BLUE DOOR', ledge: 'FIRST BRIDGE', tempo: 1.06, width: 340,
      line: '-90 +180 -180 +180j -180 +180g -180 +180 -180j +180',
      rhythm: { safe: ['U L', 'U R'], normal: ['U U U', 'U L U'], risky: ['U R U L', 'U L U R'] },
      page: ['ELSA - A CRACK IN THE ICE, WIDE AS A ROAD.', 'NO WAY UP BUT TO JUMP ACROSS AND BACK.', 'LOOK AT THE WALL YOU JUMP TO. NEVER DOWN.'],
    },
    {
      name: 'THE ECHO WALLS', ledge: 'ICICLE BRIDGE', tempo: 1.0, width: 340,
      line: '-180 +180 -180g +180 -180i +180 -180j +180 -180 +180g',
      rhythm: { safe: ['U R- L', 'U L- R'], normal: ['U L U', 'U R U'], risky: ['U U R L', 'U U L R'] },
      page: ['EVERY JUMP ECHOES THREE TIMES IN HERE.', 'I COUNTED THE ECHOES AND JUMPED ON THE FOURTH.', 'IT WORKS. DO NOT TELL BRAM I SAID SO.'],
    },
    {
      name: 'THE NARROWS', ledge: 'THE BLUE BRIDGE', tempo: 0.96, width: 340,
      line: '-180 +180i -180 +180j -180g +180 -180i +180 -180 +180j',
      rhythm: { safe: ['U= L', 'U= R'], normal: ['U L U U', 'U R U U'], risky: ['R U L U L', 'L U R U R'] },
      page: ['THE ICE GETS GLASSY. MY BOOTS SQUEAK.', 'A SLIDE HERE IS A LONG WAY DOWN.', 'SO: CHALK, BREATHE, JUMP.'],
    },
    {
      name: 'THE SKYLIGHT', ledge: 'THE SKYLIGHT', tempo: 0.9, width: 340,
      line: '-180 +180 -180i +180g -180 +180j -180i +180 -180g +180',
      rhythm: { safe: ['U L', 'U R'], normal: ['U R U- U', 'U L U- U'], risky: ['U L R U- L', 'U R L U- R'] },
    },
  ],
  summitPage: [
    'AT THE TOP OF THE CRACK, A SNOW CAVE.',
    'INSIDE, A SLED, A LANTERN AND A NOTE:',
    "'BRAM - THE ICE SINGS IF YOU JUMP IN TIME.' - E.",
  ],
};

export const EXPEDITION_ORDER = ['brams-route', 'mount-ember', 'sky-islands', 'crevasse'];
