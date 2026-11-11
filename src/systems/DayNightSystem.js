import { lerpColor } from '../utils/color.js';

// Keyframes around one full day. t in [0,1).
//   light  multiplied over the scene (the colour of the hour)
//   lift   added over the scene at liftA (tints the shadows: rose at dawn,
//          teal in the morning, amber at golden hour, violet at the blue hour)
const KEYS = [
  { t: 0.0, top: 0x2e3a6e, bottom: 0xe8907a, light: 0xd8b8c8, night: 0.3, lift: 0x3a1a38, liftA: 0.08, name: 'DAWN' },
  { t: 0.04, top: 0x4a64a0, bottom: 0xf6b48a, light: 0xffd8c0, night: 0.06, lift: 0x3a2018, liftA: 0.07, name: 'SUNRISE' },
  { t: 0.1, top: 0x5a8cd0, bottom: 0xcfe4f0, light: 0xf4f8ff, night: 0, lift: 0x0e2a3a, liftA: 0.05, name: 'MORNING' },
  { t: 0.22, top: 0x4c84d4, bottom: 0xbfe0f4, light: 0xffffff, night: 0, lift: 0x000000, liftA: 0, name: 'DAY' },
  { t: 0.42, top: 0x5884cc, bottom: 0xdce4e6, light: 0xfff8ec, night: 0, lift: 0x140e04, liftA: 0.03, name: 'AFTERNOON' },
  { t: 0.5, top: 0x5a78bc, bottom: 0xf2d0a0, light: 0xffe4c0, night: 0, lift: 0x3a2008, liftA: 0.07, name: 'GOLDEN HOUR' },
  { t: 0.56, top: 0x483e80, bottom: 0xf4946a, light: 0xffc4a8, night: 0.06, lift: 0x3a1430, liftA: 0.08, name: 'SUNSET' },
  { t: 0.61, top: 0x2a2e66, bottom: 0xb8708a, light: 0xb8a4cc, night: 0.32, lift: 0x141848, liftA: 0.08, name: 'BLUE HOUR' },
  { t: 0.66, top: 0x141a42, bottom: 0x3e4474, light: 0x8a8cbc, night: 0.72, lift: 0x0c1438, liftA: 0.07, name: 'DUSK' },
  { t: 0.72, top: 0x0a0f26, bottom: 0x1b284c, light: 0x6874aa, night: 1, lift: 0x081030, liftA: 0.06, name: 'NIGHT' },
  { t: 0.92, top: 0x0d1430, bottom: 0x262c58, light: 0x707aac, night: 0.92, lift: 0x0a1034, liftA: 0.06, name: 'NIGHT' },
  { t: 0.965, top: 0x1c2452, bottom: 0x6a5488, light: 0x9a92bc, night: 0.62, lift: 0x1c1440, liftA: 0.07, name: 'FIRST LIGHT' },
  { t: 1.0, top: 0x2e3a6e, bottom: 0xe8907a, light: 0xd8b8c8, night: 0.3, lift: 0x3a1a38, liftA: 0.08, name: 'DAWN' },
];

// The sky's geometry (screen pixels). The sun and moon travel on arcs that
// start and end below the horizon, so they rise out of the hills and sink
// back behind them instead of popping in mid-sky.
export const SKY = { horizon: 158, zenith: 26, left: 26, rightPad: 26 };
const SUN_UP = -0.035, SUN_DOWN = 0.605; // the sun's arc (t)
const MOON_UP = 0.585, MOON_DOWN = 1.035; // the moon's arc (wraps past midnight)
const OVER = 0.07; // how far each arc runs on below the horizon at both ends

const smooth = (x) => x * x * (3 - 2 * x);

// Where a body on its arc sits: p 0..1 across the sky. h is its elevation
// (1 at the top, 0 on the horizon, negative below it).
function arc(p, width, flip) {
  const h = Math.sin(p * Math.PI);
  const span = width - SKY.left - SKY.rightPad;
  const x = flip ? width - SKY.left - p * span : SKY.left + p * span;
  return { x, y: SKY.horizon - h * (SKY.horizon - SKY.zenith), h };
}

// The real moon: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter.
export function moonPhase(date = new Date()) {
  const synodic = 29.530588853;
  const ref = Date.UTC(2000, 0, 6, 18, 14);
  const days = (date.getTime() - ref) / 86400000;
  return (((days / synodic) % 1) + 1) % 1;
}

// How much of the moon is lit, 0..1.
export const moonLit = (phase) => (1 - Math.cos(phase * Math.PI * 2)) / 2;

export class DayNightSystem {
  constructor({ dayLengthSec = 600, startT = 0.1, width = 480 } = {}) {
    this.dayLengthMs = dayLengthSec * 1000;
    this.t = startT;
    this.width = width;
    this.phase = moonPhase();
  }
  update(dtMs) {
    this.t = (this.t + dtMs / this.dayLengthMs) % 1;
  }
  state() {
    const t = ((this.t % 1) + 1) % 1;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].t <= t) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    // Eased between the keys so no change of hour starts or stops abruptly.
    const f = smooth((t - a.t) / (b.t - a.t));
    // The bodies, including the stretch of each arc below the horizon (the
    // sky still glows there, and the rays fan up from behind the hills).
    const sunP = (t - SUN_UP) / (SUN_DOWN - SUN_UP);
    const mt = t < 0.5 ? t + 1 : t;
    const moonP = (mt - MOON_UP) / (MOON_DOWN - MOON_UP);
    const sunSky = sunP > -OVER && sunP < 1 + OVER ? arc(sunP, this.width, false) : null;
    const moonSky = moonP > -OVER && moonP < 1 + OVER ? arc(moonP, this.width, true) : null;
    const lit = moonLit(this.phase);
    return {
      t,
      name: f < 0.5 ? a.name : b.name,
      skyTop: lerpColor(a.top, b.top, f),
      skyBottom: lerpColor(a.bottom, b.bottom, f),
      light: lerpColor(a.light, b.light, f),
      lift: lerpColor(a.lift, b.lift, f),
      liftA: a.liftA + (b.liftA - a.liftA) * f,
      night: a.night + (b.night - a.night) * f,
      // Lighting uses these: only a body above the horizon lights the scene.
      sun: sunSky && sunSky.h > 0 ? sunSky : null,
      moon: moonSky && moonSky.h > 0 ? moonSky : null,
      sunSky,
      moonSky,
      moonPhase: this.phase,
      moonLit: lit,
      isDawn: t < 0.06,
    };
  }
}

// The sun's elevation 0..1 (0 when it is down), for the light of the hour.
export const sunHeight = (day) => (day.sun ? Math.max(0, Math.min(1, day.sun.h)) : 0);
// 0..1: how low the sun is while it is up (1 on the horizon, 0 from mid-morning).
export const lowSun = (day) => (day.sun ? Math.max(0, 1 - day.sun.h / 0.45) : 0);
