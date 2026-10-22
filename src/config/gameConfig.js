// Global constants shared by gameplay and rendering. No Phaser imports here so
// the pure systems (and their tests) can use them.
export const GAME_WIDTH = 480;

// The internal height follows the shape of the player's screen (16:9 -> 270,
// 16:10 -> 300, 4:3 -> 320) so fullscreen fills it without black bars. It is
// fixed for the session: this module is evaluated before any other game code.
// On touch screens the game leaves room at both sides for the on-screen
// buttons (each column is ~19% of the screen height plus margins).
export const IS_TOUCH = typeof window !== 'undefined' && (window.ATC_MOBILE === true
  || new URLSearchParams(window.location.search).has('touch')
  || ((navigator.maxTouchPoints || 0) > 0 && window.matchMedia && window.matchMedia('(pointer: coarse)').matches));

function screenHeight() {
  try {
    const s = IS_TOUCH ? { width: window.innerWidth, height: window.innerHeight } : window.screen;
    let w = Math.max(s.width, s.height);
    const h = Math.min(s.width, s.height);
    if (!w || !h) return 270;
    if (IS_TOUCH) w -= 2 * (h * 0.19 + 24);
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
export const CAMERA_ANCHOR = 0.6;

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
