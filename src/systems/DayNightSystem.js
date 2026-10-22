import { lerpColor } from '../utils/color.js';

// Keyframes around one full day. t in [0,1).
const KEYS = [
  { t: 0.0, top: 0x3a4a7a, bottom: 0xf2a27a, light: 0xffd6b8, night: 0.15, name: 'DAWN' },
  { t: 0.07, top: 0x5f8fd0, bottom: 0xd6e6ef, light: 0xfff2e2, night: 0, name: 'MORNING' },
  { t: 0.2, top: 0x4c84d4, bottom: 0xbfe0f4, light: 0xffffff, night: 0, name: 'DAY' },
  { t: 0.44, top: 0x5884cc, bottom: 0xdfe4e2, light: 0xfff4e4, night: 0, name: 'AFTERNOON' },
  { t: 0.54, top: 0x4a3f7a, bottom: 0xf0905e, light: 0xffc49e, night: 0.1, name: 'SUNSET' },
  { t: 0.61, top: 0x232a55, bottom: 0x8a5a7a, light: 0xa898c4, night: 0.55, name: 'DUSK' },
  { t: 0.69, top: 0x0a0f26, bottom: 0x1b284c, light: 0x6874aa, night: 1, name: 'NIGHT' },
  { t: 0.93, top: 0x0d1430, bottom: 0x2a2f5a, light: 0x707aac, night: 0.9, name: 'NIGHT' },
  { t: 1.0, top: 0x3a4a7a, bottom: 0xf2a27a, light: 0xffd6b8, night: 0.15, name: 'DAWN' },
];

export class DayNightSystem {
  constructor({ dayLengthSec = 600, startT = 0.1 } = {}) {
    this.dayLengthMs = dayLengthSec * 1000;
    this.t = startT;
  }
  update(dtMs) {
    this.t = (this.t + dtMs / this.dayLengthMs) % 1;
  }
  state() {
    const t = this.t;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].t <= t) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const f = (t - a.t) / (b.t - a.t);
    // Sun is up from t=0 to 0.6; moon from 0.6 to 1.0.
    const sunP = t / 0.6;
    const moonP = (t - 0.6) / 0.4;
    return {
      t,
      name: f < 0.5 ? a.name : b.name,
      skyTop: lerpColor(a.top, b.top, f),
      skyBottom: lerpColor(a.bottom, b.bottom, f),
      light: lerpColor(a.light, b.light, f),
      night: a.night + (b.night - a.night) * f,
      sun: sunP >= 0 && sunP <= 1 ? { x: 40 + sunP * 400, y: 150 - Math.sin(sunP * Math.PI) * 120 } : null,
      moon: moonP >= 0 && moonP <= 1 ? { x: 420 - moonP * 380, y: 140 - Math.sin(moonP * Math.PI) * 110 } : null,
      isDawn: t < 0.06,
    };
  }
}
