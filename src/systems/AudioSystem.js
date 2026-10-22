// Procedural Web Audio: synthesized SFX, layered ambience and sparse generative
// music. Real samples (see data/audioManifest.js) override synth sounds by key.
// Every method is a safe no-op until init() runs after a user gesture.

const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

class AudioSystemImpl {
  constructor() {
    this.ctx = null;
    this.musicVolume = 0.6;
    this.sfxVolume = 0.8;
    this.phaserSound = null;
    this.phaserCache = null;
    this.music = { root: 57, scale: [0, 2, 4, 7, 9], intensity: 0.3, swellUntil: 0, nextAt: 0 };
    this.amb = { wind: 0.2, stream: 0, birds: 0, nextBirdAt: 0 };
    this.paused = false;
    this.lastPlay = {};
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      this.ctx = null;
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createDynamicsCompressor();
    this.master.threshold.value = -16;
    this.master.connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.ambBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.ambBus.connect(this.master);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(3.2, 2.6);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.55;
    this.reverb.connect(this.reverbGain);
    this.reverbGain.connect(this.master);
    this.noise = this.makeNoise(2, 'white');
    this.brown = this.makeNoise(4, 'brown');
    this.applyVolumes();
    this.startAmbience();
  }

  setSampleSource(sound, cache) { this.phaserSound = sound; this.phaserCache = cache; }

  setVolumes(music, sfx) {
    this.musicVolume = music;
    this.sfxVolume = sfx;
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const duck = this.paused ? 0.35 : 1;
    this.sfxBus.gain.setTargetAtTime(this.sfxVolume * 0.9, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.sfxVolume * 0.7 * duck, t, 0.2);
    this.musicBus.gain.setTargetAtTime(this.musicVolume * 0.42 * duck, t, 0.3);
  }

  setPaused(p) { this.paused = p; this.applyVolumes(); }

  makeNoise(seconds, type) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  }

  makeImpulse(seconds, decay) {
    const ctx = this.ctx;
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  // ---------- primitives ----------
  env(gainNode, t, attack, peak, release) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.exponentialRampToValueAtTime(0.0001, t + attack + release);
  }

  noiseHit({ t = 0, dur = 0.1, type = 'bandpass', freq = 1000, q = 1, peak = 0.3, attack = 0.005, sweepTo = null, bus = this.sfxBus, reverb = 0 }) {
    const ctx = this.ctx;
    const start = ctx.currentTime + t;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, start);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, start + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    this.env(g, start, attack, peak, dur);
    src.connect(f).connect(g).connect(bus);
    if (reverb) { const rg = ctx.createGain(); rg.gain.value = reverb; g.connect(rg).connect(this.reverb); }
    src.start(start, Math.random() * 1.5);
    src.stop(start + attack + dur + 0.05);
  }

  tone({ t = 0, freq = 440, toFreq = null, dur = 0.2, type = 'sine', peak = 0.2, attack = 0.005, bus = this.sfxBus, reverb = 0, detune = 0 }) {
    const ctx = this.ctx;
    const start = ctx.currentTime + t;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    o.detune.value = detune;
    if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, start + dur);
    const g = ctx.createGain();
    this.env(g, start, attack, peak, dur);
    o.connect(g).connect(bus);
    if (reverb) { const rg = ctx.createGain(); rg.gain.value = reverb; g.connect(rg).connect(this.reverb); }
    o.start(start);
    o.stop(start + attack + dur + 0.05);
  }

  // ---------- public SFX ----------
  play(name, opts = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (this.lastPlay[name] && now - this.lastPlay[name] < 0.025) return;
    this.lastPlay[name] = now;
    if (this.phaserCache && this.phaserCache.exists(name) && this.phaserSound) {
      try { this.phaserSound.play(name, { volume: this.sfxVolume }); return; } catch { /* fall back */ }
    }
    const fn = this.sfx[name];
    if (fn) fn.call(this, opts);
  }

  get sfx() {
    return {
      grab(o) {
        this.noiseHit({ dur: 0.06, freq: 1800 + Math.random() * 600, q: 1.2, peak: 0.28 });
        this.tone({ freq: 140, toFreq: 60, dur: 0.07, peak: 0.25 });
        if (o.icy) this.tone({ t: 0.01, freq: 2600, toFreq: 2400, dur: 0.25, peak: 0.05, reverb: 0.4 });
      },
      boot(o) {
        this.tone({ freq: 95, toFreq: 48, dur: 0.09, peak: 0.22 });
        this.noiseHit({ dur: 0.05, type: 'lowpass', freq: o.snow ? 2400 : 700, peak: o.snow ? 0.18 : 0.12 });
        if (o.snow) this.noiseHit({ t: 0.03, dur: 0.08, type: 'highpass', freq: 3000, peak: 0.05 });
      },
      cloth() { this.noiseHit({ dur: 0.14, freq: 2800, q: 0.6, peak: 0.06, attack: 0.04 }); },
      breath(o) {
        const v = 0.025 + (o.intensity || 0) * 0.06;
        this.noiseHit({ dur: 0.35, freq: 1100, q: 2.5, peak: v, attack: 0.15 });
        this.noiseHit({ t: 0.55, dur: 0.45, freq: 800, q: 2, peak: v * 1.2, attack: 0.08 });
      },
      pebble(o) {
        const n = o.count || 4;
        for (let i = 0; i < n; i++) {
          const t = i * (0.09 + Math.random() * 0.12) + i * i * 0.01;
          this.noiseHit({ t, dur: 0.02, type: 'highpass', freq: 2500 + Math.random() * 2500, peak: 0.12 * (1 - i / (n + 1)) * (o.volume || 1), reverb: 0.3 });
        }
      },
      // The pitch climbs a pentatonic ladder with the streak, but only up to about
      // an octave; after that it wanders between the top notes instead of rising.
      perfect(o) {
        const LADDER = [0, 2, 4, 7, 9, 12, 14, 16];
        const TOP = [12, 14, 16, 14, 12, 9];
        const k = Math.max(0, (o.streak || 1) - 1);
        const off = k < LADDER.length ? LADDER[k] : TOP[(k - LADDER.length) % TOP.length];
        const base = 72 + off;
        this.tone({ freq: midiToHz(base), dur: 0.45, type: 'triangle', peak: 0.055, reverb: 0.6 });
        this.tone({ t: 0.03, freq: midiToHz(base + 7), dur: 0.5, peak: 0.03 - off * 0.0008, reverb: 0.6 });
        this.noiseHit({ dur: 0.04, type: 'highpass', freq: 5000, peak: 0.05 });
      },
      streakbreak(o) {
        const from = 84 + Math.min(4, Math.floor((o.streak || 5) / 5));
        this.tone({ freq: midiToHz(from), toFreq: midiToHz(from - 19), dur: 0.35, type: 'triangle', peak: 0.06 });
        this.noiseHit({ t: 0.02, dur: 0.12, type: 'highpass', freq: 3500, peak: 0.08 });
      },
      streakmilestone() {
        const r = 79;
        [0, 4, 7, 12, 16].forEach((s, i) => this.tone({ t: i * 0.05, freq: midiToHz(r + s), dur: 0.5, type: 'triangle', peak: 0.05, reverb: 0.5 }));
        this.tone({ t: 0.25, freq: midiToHz(r + 24), dur: 1.0, peak: 0.05, reverb: 0.8 });
      },
      // Short rising arpeggio for every 100 m.
      milestone() {
        const r = this.music.root + 12;
        [0, 7, 12, 16].forEach((s, i) => this.tone({ t: i * 0.08, freq: midiToHz(r + s), dur: 0.9, type: 'triangle', peak: 0.05, reverb: 0.7 }));
      },
      // Fanfare for beating your record: two brass-ish hits, then a held chord.
      fanfare() {
        const r = this.music.root + 12;
        const brass = (t, m, dur, peak) => {
          this.tone({ t, freq: midiToHz(m), dur, type: 'sawtooth', peak: peak * 0.35, attack: 0.02, reverb: 0.5 });
          this.tone({ t, freq: midiToHz(m), dur, type: 'triangle', peak, attack: 0.01, reverb: 0.5, detune: 6 });
        };
        brass(0, r, 0.14, 0.07); brass(0.16, r, 0.14, 0.07); brass(0.32, r + 7, 0.14, 0.07);
        [0, 4, 7, 12].forEach((s) => brass(0.5, r + s, 1.6, 0.05));
        this.noiseHit({ t: 0.5, dur: 0.9, type: 'highpass', freq: 6000, peak: 0.05, reverb: 0.6 });
      },
      // Sting under a new biome title card.
      titlecard() {
        const r = this.music.root;
        [0, 7, 12, 16, 19].forEach((s, i) => this.tone({ t: i * 0.03, freq: midiToHz(r + s), dur: 2.6, attack: 0.3, peak: 0.035, reverb: 0.9, bus: this.musicBus }));
        this.tone({ freq: midiToHz(r - 12), dur: 2.4, attack: 0.05, peak: 0.08, reverb: 0.6, bus: this.musicBus });
      },
      // Bright chime; rarer stones ring higher and longer.
      gem(o) {
        const v = o.value || 1;
        const r = 88 + Math.min(10, Math.round(Math.log2(v) * 3));
        this.tone({ freq: midiToHz(r), dur: 0.25, type: 'triangle', peak: 0.06, reverb: 0.5 });
        this.tone({ t: 0.07, freq: midiToHz(r + 7), dur: 0.35 + v * 0.03, type: 'triangle', peak: 0.05, reverb: 0.6 });
        if (v >= 3) this.tone({ t: 0.14, freq: midiToHz(r + 12), dur: 0.6, peak: 0.04, reverb: 0.8 });
        this.noiseHit({ dur: 0.05, type: 'highpass', freq: 6000, peak: 0.05 });
      },
      buy() {
        this.tone({ freq: midiToHz(84), dur: 0.08, type: 'square', peak: 0.03 });
        this.tone({ t: 0.08, freq: midiToHz(91), dur: 0.3, type: 'triangle', peak: 0.06, reverb: 0.5 });
        this.noiseHit({ t: 0.02, dur: 0.12, type: 'highpass', freq: 5000, peak: 0.06 });
      },
      denied() { this.tone({ freq: 150, dur: 0.12, type: 'square', peak: 0.04 }); this.tone({ t: 0.1, freq: 120, dur: 0.14, type: 'square', peak: 0.04 }); },
      gear() {
        this.noiseHit({ dur: 0.18, freq: 1600, q: 0.8, peak: 0.12, attack: 0.02 });
        [0, 4, 7].forEach((s2, i) => this.tone({ t: 0.05 + i * 0.05, freq: midiToHz(76 + s2), dur: 0.3, type: 'triangle', peak: 0.05 }));
      },
      tick() { this.tone({ freq: 1800, dur: 0.015, type: 'square', peak: 0.012 }); },
      // A crystal's chime: one pitch per direction, ringing out.
      crystal(o) {
        const n = { L: 84, U: 88, R: 91 }[o.dir] || 86;
        this.tone({ freq: midiToHz(n), dur: 0.9, type: 'sine', peak: 0.06, reverb: 0.9 });
        this.tone({ t: 0.01, freq: midiToHz(n + 12), dur: 0.5, type: 'triangle', peak: 0.018, reverb: 0.9 });
      },
      good() { this.tone({ freq: 660, dur: 0.05, type: 'triangle', peak: 0.05 }); },
      miss() {
        this.tone({ freq: 110, toFreq: 70, dur: 0.15, peak: 0.25, type: 'triangle' });
        this.noiseHit({ dur: 0.22, freq: 900, sweepTo: 400, q: 1, peak: 0.18 });
      },
      slip() {
        this.noiseHit({ dur: 0.8, freq: 2200, sweepTo: 350, q: 1.5, peak: 0.25, attack: 0.02 });
        this.play('pebble', { count: 6 });
      },
      recover() {
        this.play('grab');
        this.noiseHit({ t: 0.05, dur: 0.3, freq: 700, q: 2, peak: 0.12, attack: 0.03 });
      },
      fall() { this.noiseHit({ dur: 1.0, freq: 400, sweepTo: 1800, q: 0.8, peak: 0.2, attack: 0.1 }); },
      land() {
        this.tone({ freq: 120, toFreq: 40, dur: 0.2, peak: 0.4 });
        this.noiseHit({ dur: 0.2, type: 'lowpass', freq: 900, peak: 0.25 });
      },
      ui() { this.tone({ freq: 1250, dur: 0.025, type: 'square', peak: 0.025 }); },
      select() { this.tone({ freq: 880, dur: 0.05, type: 'triangle', peak: 0.06 }); this.tone({ t: 0.06, freq: 1320, dur: 0.08, type: 'triangle', peak: 0.05 }); },
      photo() { this.noiseHit({ dur: 0.02, type: 'highpass', freq: 3000, peak: 0.2 }); this.noiseHit({ t: 0.08, dur: 0.03, type: 'highpass', freq: 2000, peak: 0.15 }); },
      discovery() {
        const r = this.music.root + 12;
        [0, 4, 7, 12].forEach((s, i) => this.tone({ t: i * 0.14, freq: midiToHz(r + s), dur: 1.2, peak: 0.05, reverb: 0.8, bus: this.musicBus }));
      },
      checkpoint() {
        const r = this.music.root + 12;
        this.tone({ freq: midiToHz(r), dur: 1.4, peak: 0.05, reverb: 0.8, bus: this.musicBus });
        this.tone({ t: 0.2, freq: midiToHz(r + 7), dur: 1.6, peak: 0.04, reverb: 0.8, bus: this.musicBus });
      },
      flawless() {
        const r = 84;
        [0, 7, 12].forEach((s, i) => this.tone({ t: i * 0.06, freq: midiToHz(r + s), dur: 0.7, peak: 0.05, reverb: 0.7 }));
      },
      gust() { this.noiseHit({ dur: 1.4, freq: 300, sweepTo: 1400, q: 0.9, peak: 0.16, attack: 0.5, bus: this.ambBus }); },
      crumble() {
        this.noiseHit({ dur: 0.3, type: 'lowpass', freq: 900, peak: 0.25 });
        this.play('pebble', { count: 6 });
      },
      creak() { this.noiseHit({ dur: 0.18, freq: 500, q: 4, peak: 0.08, attack: 0.03 }); },
      held() { this.tone({ freq: 990, dur: 0.12, type: 'triangle', peak: 0.05 }); this.tone({ t: 0.05, freq: 1480, dur: 0.18, type: 'triangle', peak: 0.04 }); },
      runover() {
        const r = this.music.root;
        [7, 3, 0, -5].forEach((s, i) => this.tone({ t: i * 0.35, freq: midiToHz(r + s), dur: 2, attack: 0.05, peak: 0.05, reverb: 0.9, bus: this.musicBus }));
      },
      wing() { this.noiseHit({ dur: 0.5, freq: 500, q: 0.7, peak: 0.08, attack: 0.15 }); },
    };
  }

  // ---------- ambience ----------
  startAmbience() {
    const ctx = this.ctx;
    const wind = ctx.createBufferSource();
    wind.buffer = this.brown; wind.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass'; this.windFilter.frequency.value = 500; this.windFilter.Q.value = 0.8;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    wind.connect(this.windFilter).connect(this.windGain).connect(this.ambBus);
    wind.start();
    const stream = ctx.createBufferSource();
    stream.buffer = this.noise; stream.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 350;
    this.streamGain = ctx.createGain(); this.streamGain.gain.value = 0;
    stream.connect(lp).connect(hp).connect(this.streamGain).connect(this.ambBus);
    stream.start();
  }

  setAmbience({ wind = 0.2, stream = 0, birds = 0 }) {
    this.amb.wind = wind; this.amb.stream = stream; this.amb.birds = birds;
  }

  setMusicMode({ root, scale }) { this.music.root = root; this.music.scale = scale; }

  swell(seconds = 25) {
    if (!this.ctx) return;
    this.music.swellUntil = this.ctx.currentTime + seconds;
    this.music.nextAt = Math.min(this.music.nextAt, this.ctx.currentTime + 0.5);
  }

  update() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const gust = 0.6 + 0.4 * Math.sin(t * 0.23) * Math.sin(t * 0.071 + 1);
    this.windGain.gain.setTargetAtTime(0.04 + this.amb.wind * 0.22 * gust, t, 0.8);
    this.windFilter.frequency.setTargetAtTime(300 + this.amb.wind * 500 * gust, t, 0.8);
    this.streamGain.gain.setTargetAtTime(this.amb.stream * 0.07, t, 1.0);
    if (this.amb.birds > 0 && t > this.amb.nextBirdAt) {
      this.amb.nextBirdAt = t + 3 + Math.random() * 9 / this.amb.birds;
      this.chirp();
    }
    const swelling = t < this.music.swellUntil;
    const intensity = swelling ? 1 : this.music.intensity;
    if (t > this.music.nextAt) {
      this.music.nextAt = t + (swelling ? 2.4 : 5 + Math.random() * 6);
      if (Math.random() < 0.35 + intensity * 0.6) this.musicPhrase(intensity);
    }
  }

  setMusicIntensity(v) { this.music.intensity = v; }

  chirp() {
    const n = 2 + Math.floor(Math.random() * 4);
    const base = 2200 + Math.random() * 1500;
    for (let i = 0; i < n; i++) {
      this.tone({ t: i * 0.11, freq: base * (1 + Math.random() * 0.2), toFreq: base * 1.4, dur: 0.06, peak: 0.025, bus: this.ambBus, reverb: 0.3 });
    }
  }

  musicPhrase(intensity) {
    const { root, scale } = this.music;
    const pick = (oct) => root + oct * 12 + scale[Math.floor(Math.random() * scale.length)];
    // Soft pad chord
    const chordRoot = Math.floor(Math.random() * scale.length);
    [0, 2, 4].forEach((step, i) => {
      const deg = (chordRoot + step) % scale.length;
      const octave = Math.floor((chordRoot + step) / scale.length);
      const note = root - 12 + scale[deg] + octave * 12;
      this.tone({ t: i * 0.08, freq: midiToHz(note), dur: 4.5, attack: 1.6, type: 'sine', peak: 0.05 * (0.5 + intensity * 0.5), bus: this.musicBus, reverb: 0.7 });
      this.tone({ t: i * 0.08, freq: midiToHz(note), dur: 4, attack: 1.8, type: 'triangle', peak: 0.012, detune: 7, bus: this.musicBus, reverb: 0.7 });
    });
    // A few bell notes when the music is "present"
    const bells = intensity > 0.6 ? 3 + Math.floor(Math.random() * 3) : Math.random() < 0.5 ? 1 : 0;
    for (let i = 0; i < bells; i++) {
      this.tone({ t: 0.6 + i * (0.45 + Math.random() * 0.3), freq: midiToHz(pick(1)), dur: 1.6, attack: 0.01, peak: 0.03, bus: this.musicBus, reverb: 0.9 });
    }
  }
}

export const Audio = new AudioSystemImpl();
