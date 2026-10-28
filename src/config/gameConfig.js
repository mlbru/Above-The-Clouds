// Global constants shared by gameplay and rendering. No Phaser imports here so
// the pure systems (and their tests) can use them.
// The internal height follows the shape of the player's screen (16:9 -> 270,
// 16:10 -> 300, 4:3 -> 320) so fullscreen fills it without black bars. It is
// fixed for the session: this module is evaluated before any other game code.
const PARAMS = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
export const IS_TOUCH = typeof window !== 'undefined' && (window.ATC_MOBILE === true
  || PARAMS.has('touch')
  || ((navigator.maxTouchPoints || 0) > 0 && window.matchMedia && window.matchMedia('(pointer: coarse)').matches));

// Portrait: a phone held upright (or ?portrait). The screen is then narrower
// than the mountain and the camera follows the climber sideways. Decided once
// at start; turning the phone offers a reload into the other layout.
export const IS_PORTRAIT = typeof window !== 'undefined' && !PARAMS.has('landscape')
  && (PARAMS.has('portrait') || (IS_TOUCH && window.innerHeight > window.innerWidth));

// The mountain is always this wide; the screen (GAME_WIDTH) can be narrower.
export const WORLD_WIDTH = 480;
export const GAME_WIDTH = IS_PORTRAIT ? 300 : 480;
// The camera's x for a point it should keep centred (0 when the screen is as wide as the mountain).
export const camXFor = (x) => Math.max(0, Math.min(WORLD_WIDTH - GAME_WIDTH, Math.round(x - GAME_WIDTH / 2)));

function screenHeight() {
  try {
    const s = IS_TOUCH ? { width: window.innerWidth, height: window.innerHeight } : window.screen;
    if (IS_PORTRAIT) {
      const ratio = IS_TOUCH && s.height > s.width ? s.height / s.width : 16 / 9;
      return Math.max(440, Math.min(640, Math.round(GAME_WIDTH * ratio)));
    }
    const w = Math.max(s.width, s.height);
    const h = Math.min(s.width, s.height);
    if (!w || !h) return 270;
    return Math.max(240, Math.min(320, Math.round(GAME_WIDTH / (w / h))));
  } catch {
    return 270;
  }
}
export const GAME_HEIGHT = typeof window === 'undefined' ? 270 : screenHeight();

// One climbing "level" is the vertical spacing between hold rows.
export const LEVEL_PX = 24;
export const PX_PER_METER = 16;
export const METERS_PER_LEVEL = LEVEL_PX / PX_PER_METER;

export const levelToY = (level) => -level * LEVEL_PX;
export const yToMeters = (y) => -y / PX_PER_METER;
export const levelToMeters = (level) => level * METERS_PER_LEVEL;

// Camera keeps the climber's hands at this fraction of the screen height.
// A tall portrait screen shows more of the wall ahead.
export const CAMERA_ANCHOR = IS_PORTRAIT ? 0.66 : 0.6;

// How far ahead/behind (in levels) the world is generated and kept alive.
export const GENERATE_AHEAD_LEVELS = 70;
export const RENDER_AHEAD_LEVELS = 34;
export const KEEP_BELOW_LEVELS = 22;

export const DEPTH = {
  sky: 0,
  far: 10,
  mid: 20,
  near: 30,
  cloudSea: 40,
  bgWeather: 45,
  wall: 100,
  holds: 110,
  decor: 120,
  routeMarks: 130,
  climber: 150,
  fx: 160,
  foreground: 180,
  mist: 190,
  light: 200,
  weather: 210,
  vignette: 300,
  hud: 1000,
  overlay: 2000,
};
