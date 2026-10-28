// Everything on the settings screen (scenes/SettingsScene.js), in sections.
// A row is a volume slider (0..1 in tenths) or a set of choices:
//   { key, label, type: 'volume' | 'choice', values: [[value, shown, what it does]], text }
// `text` explains the row; each choice adds a line on what that choice does.
export const SETTING_SECTIONS = [
  {
    id: 'sound', title: 'SOUND', color: 0x9fd8ff,
    rows: [
      { key: 'music', label: 'MUSIC', type: 'volume', text: 'EVERY BIOME HAS ITS OWN SONG. THIS IS HOW LOUD IT PLAYS.' },
      { key: 'sfx', label: 'EFFECTS', type: 'volume', text: 'GRABS, WIND, ROCKFALL, BRAM. EVERYTHING THAT IS NOT MUSIC.' },
    ],
  },
  {
    id: 'screen', title: 'SCREEN', color: 0xf2c14e,
    rows: [
      { key: 'shake', label: 'SCREEN SHAKE', type: 'choice', text: 'THE CAMERA JOLTS ON MISSES, ROCKS AND DRAGON FIRE.',
        values: [[true, 'ON', 'THE WORLD SHAKES WHEN SOMETHING HITS HARD.'], [false, 'OFF', 'A STEADY CAMERA, ALWAYS.']] },
      { key: 'reducedParticles', label: 'PARTICLES', type: 'choice', text: 'SNOW, SPARKS, CHALK AND EMBERS IN THE AIR.',
        values: [[false, 'FULL', 'EVERY PARTICLE THE MOUNTAIN HAS.'], [true, 'REDUCED', 'FEWER PARTICLES, FOR SLOWER DEVICES OR CALMER EYES.']] },
    ],
  },
  {
    id: 'feel', title: 'FEEL', color: 0xd8a6ff,
    rows: [
      { key: 'chalkMarks', label: 'CHALK MARKS', type: 'choice', text: 'WHAT YOUR HANDS LEAVE ON THE ROCK.',
        values: [['line', 'YOUR LINE', 'PRINTS ON EVERY HOLD YOU USE, JOINED BY A DOTTED CHALK LINE. LOOK DOWN AND SEE THE WAY YOU CAME.'],
          ['prints', 'PRINTS', 'A CHALKY HANDPRINT ON EVERY HOLD YOU USE.'], ['off', 'OFF', 'CLEAN ROCK. NO MARKS AT ALL.']] },
      { key: 'beatPulse', label: 'BEAT PULSE', type: 'choice', text: 'THE MOUNTAIN MOVES WITH THE BEAT.',
        values: [['subtle', 'SUBTLE', 'THE HOLD YOU ARE GOING FOR PULSES ON THE BEAT. IN THE COLD YOUR BREATH KEEPS TIME.'],
          ['full', 'FULL', 'ALSO THE AIR SWELLS ON EVERY BEAT AND THE CLIMBER NODS ALONG WHILE HANGING.'], ['off', 'OFF', 'ONLY THE NOTES KEEP THE BEAT.']] },
      { key: 'hitStop', label: 'HIT-STOP', type: 'choice', text: 'BIG MOMENTS HOLD STILL FOR A FEW FRAMES. THE BEAT NEVER WAITS.',
        values: [['subtle', 'SUBTLE', 'A SHORT FREEZE ON PERFECTS, STREAK MILESTONES AND CLEAN DODGES.'],
          ['punchy', 'PUNCHY', 'LONGER FREEZES, HARDER SQUASH AND A FLASH ON THE BIG ONES.'], ['off', 'OFF', 'NO FREEZES. EVERYTHING FLOWS.']] },
      { key: 'weatherCoat', label: 'WEATHER ON YOU', type: 'choice', text: 'THE MOUNTAIN LEAVES ITS MARKS ON THE CLIMBER.',
        values: [[true, 'ON', 'SNOW ON YOUR HAT, A SOAKED JACKET, SOOT, CRYSTAL DUST. SHAKE IT OFF ON A LEDGE.'], [false, 'OFF', 'THE CLIMBER STAYS CLEAN.']] },
      { key: 'ledgeLife', label: 'LEDGE LIFE', type: 'choice', text: 'WHAT THE CLIMBER DOES WHILE YOU REST.',
        values: [['lively', 'LIVELY', 'STAY A WHILE: A DRINK, THE MAP, A WAVE, WARM HANDS, THE STARS AT NIGHT.'], ['calm', 'CALM', 'A STRETCH NOW AND THEN. NOTHING MORE.']] },
    ],
  },
  {
    id: 'play', title: 'PLAY', color: 0x8fd16a,
    rows: [
      { key: 'forgiving', label: 'TIMING', type: 'choice', text: 'HOW EXACT YOUR INPUTS MUST BE.',
        values: [[false, 'NORMAL', 'THE TIMING THE MOUNTAIN WAS MADE FOR.'], [true, 'FORGIVING', 'WIDER TIMING WINDOWS. NORMAL MODE ONLY.']] },
    ],
  },
];

// The look-and-feel rows as [key, label, [[value, shown]...]].
export const FEEL_OPTIONS = SETTING_SECTIONS.find((s) => s.id === 'feel').rows.map((r) => [r.key, r.label, r.values.map(([v, shown]) => [v, shown])]);

export const CONTROLS_TEXT = [
  'CHOOSE ROUTE   ← →  OR  A D  OR  1 2 3',
  'START CLIMB    ↑  W  SPACE  ENTER',
  'CLIMB INPUTS   ← ↑ →  OR  A W D  ON THE BEAT',
  'AT A LEDGE     R REST   V VIEW   C PHOTO',
  'PAUSE          ESC  OR  P        FULLSCREEN  F',
  'DEBUG          F3  OR  `   (B: AUTOPILOT)',
].join('\n');
