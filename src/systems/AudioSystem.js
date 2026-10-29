// Procedural Web Audio: synthesized SFX, layered ambience and sparse generative
// music. Recorded samples (see data/audioManifest.js) replace synth sounds by
// key; a key can have several takes, one is picked at random and its pitch
// nudged a little so repeats don't sound identical.
// Every biome's music has its own lead instrument and motif (data/biomes.js).
// Every method is a safe no-op until init() runs after a user gesture.

const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

class AudioSystemImpl {
  constructor() {
    this.ctx = null;
    this.musicVolume = 0.6;
    this.sfxVolume = 0.8;
    this.phaserSound = null;
    this.phaserCache = null;
    this.music = { root: 57, scale: [0, 2, 4, 7, 9], instrument: 'pluck', tempo: 96, octave: 12, motif: null, drum: false, intensity: 0.3, swellUntil: 0, nextAt: 0 };
    this.samples = {};
    this.sampleSources = [];
    this.plucks = {};
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
    this.decodeSamples();
  }

  setSampleSource(sound, cache) { this.phaserSound = sound; this.phaserCache = cache; }

  // entries: [{ key, url, gain?, rate?, reverb? }] (url may be a data: URL). Several
  // entries with the same key are takes of one sound. Decoded once the
  // AudioContext exists; anything that fails to load keeps the synth sound.
  loadSamples(entries) {
    this.sampleSources.push(...entries);
    if (this.ctx) this.decodeSamples();
  }

  decodeSamples() {
    const pending = this.sampleSources.splice(0);
    for (const e of pending) {
      fetch(e.url)
        .then((r) => r.arrayBuffer())
        .then((ab) => new Promise((res, rej) => this.ctx.decodeAudioData(ab, res, rej)))
        .then((buffer) => {
          (this.samples[e.key] || (this.samples[e.key] = [])).push({ buffer, gain: e.gain ?? 1, rate: e.rate ?? 1, reverb: e.reverb || 0 });
          if (e.key === 'wind') this.useWindSample();
        })
        .catch(() => console.warn(`[audio] could not decode ${e.key}, using synth fallback`));
    }
  }

  // Plays one take of a recorded sound. Returns false if there is none.
  playSample(key, { volume = 1, rate = 1, t = 0, bus = this.sfxBus } = {}) {
    const takes = this.samples[key];
    if (!takes || !takes.length) return false;
    const take = takes[Math.floor(Math.random() * takes.length)];
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = take.buffer;
    src.playbackRate.value = take.rate * rate * (0.94 + Math.random() * 0.12);
    const g = ctx.createGain();
    g.gain.value = take.gain * volume;
    src.connect(g).connect(bus);
    if (take.reverb) { const rg = ctx.createGain(); rg.gain.value = take.reverb; g.connect(rg).connect(this.reverb); }
    src.start(ctx.currentTime + t);
    return true;
  }

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
    if (this.playRecorded(name, opts)) return;
    if (this.phaserCache && this.phaserCache.exists(name) && this.phaserSound) {
      try { this.phaserSound.play(name, { volume: this.sfxVolume }); return; } catch { /* fall back */ }
    }
    const fn = this.sfx[name];
    if (fn) fn.call(this, opts);
  }

  // Sounds that have recordings. Some synth sounds are built from others
  // (slip = slide + pebbles), so those pick their recorded parts here.
  playRecorded(name, o) {
    if (!Object.keys(this.samples).length) return false;
    switch (name) {
      case 'grab': {
        const ok = this.playSample(o.icy ? 'grab-ice' : 'grab') || (o.icy && this.playSample('grab'));
        if (ok && o.icy && !this.samples['grab-ice']) this.tone({ t: 0.01, freq: 2600, toFreq: 2400, dur: 0.25, peak: 0.05, reverb: 0.4 });
        return ok;
      }
      case 'boot': return this.playSample(o.snow ? 'boot-snow' : 'boot') || this.playSample('boot');
      case 'pebble': {
        if (!this.samples.pebble) return false;
        const n = Math.min(3, Math.ceil((o.count || 4) / 2));
        for (let i = 0; i < n; i++) this.playSample('pebble', { t: i * (0.08 + Math.random() * 0.1), volume: (o.volume || 1) * (1 - i * 0.25) });
        return true;
      }
      case 'crumble': return this.playSample('rockfall') && (this.play('pebble', { count: 4 }), true);
      case 'rockhit': return this.playSample('rockhit');
      case 'crystal': {
        const n = { L: 0.89, U: 1, R: 1.12 }[o.dir] || 1;
        return this.playSample('crystal', { rate: n });
      }
      case 'gem': return this.playSample('crystal', { rate: 1.3 + Math.min(0.5, Math.log2(o.value || 1) * 0.12), volume: 0.7 }) && (this.tone({ t: 0.05, freq: midiToHz(95), dur: 0.3, type: 'triangle', peak: 0.03, reverb: 0.5 }), true);
      case 'slip': return this.playSample('slide') && (this.play('pebble', { count: 6 }), true);
      default: return this.playSample(name);
    }
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
      // A bird taking off: quick wing beats and a startled chirp.
      flutter() {
        for (let i = 0; i < 5; i++) this.noiseHit({ t: i * 0.07, dur: 0.05, freq: 900 + i * 120, q: 0.8, peak: 0.07 * (1 - i / 6) });
        this.chirp();
      },
      // A goat: a short wavering bleat.
      bleat() {
        [0, 0.06, 0.12, 0.18].forEach((t, i) => this.tone({ t, freq: 520 + (i % 2) * 40, toFreq: 480, dur: 0.08, type: 'sawtooth', peak: 0.025, reverb: 0.3 }));
      },
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
      // "ON FIRE": a deep drop under a bright rising chord.
      bassdrop() {
        this.tone({ freq: 160, toFreq: 38, dur: 0.6, peak: 0.32 });
        this.tone({ freq: 80, toFreq: 40, dur: 0.5, type: 'triangle', peak: 0.18 });
        this.noiseHit({ dur: 0.35, type: 'lowpass', freq: 400, sweepTo: 80, peak: 0.2 });
        [0, 7, 12, 19].forEach((s, i) => this.tone({ t: 0.08 + i * 0.04, freq: midiToHz(79 + s), dur: 0.6, type: 'triangle', peak: 0.045, reverb: 0.6 }));
        this.noiseHit({ t: 0.05, dur: 0.6, type: 'highpass', freq: 5000, sweepTo: 9000, peak: 0.05, reverb: 0.5 });
      },
      // The thud of a milestone number landing.
      slam() {
        this.tone({ freq: 120, toFreq: 45, dur: 0.35, peak: 0.28 });
        this.noiseHit({ dur: 0.12, type: 'lowpass', freq: 900, peak: 0.22 });
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
      // The new biome introduces itself: a held chord, then its motif.
      titlecard() {
        const r = this.music.root;
        [0, 7, 12, 16, 19].forEach((s, i) => this.tone({ t: i * 0.03, freq: midiToHz(r + s), dur: 2.6, attack: 0.3, peak: 0.035, reverb: 0.9, bus: this.musicBus }));
        this.tone({ freq: midiToHz(r - 12), dur: 2.4, attack: 0.05, peak: 0.08, reverb: 0.6, bus: this.musicBus });
        if (this.music.motif) this.playMotif(this.music.motif, 0.5, 0.055);
        this.music.nextAt = Math.max(this.music.nextAt, this.ctx.currentTime + 6);
      },
      // Sunrise on a ledge: a slow warm chord and a rising bell line.
      sunrise() {
        const r = this.music.root;
        [0, 4, 7, 11].forEach((st, i) => this.tone({ t: i * 0.08, freq: midiToHz(r + st), dur: 4.5, attack: 1.2, peak: 0.03, reverb: 0.9, bus: this.musicBus }));
        this.tone({ freq: midiToHz(r - 12), dur: 4.5, attack: 0.8, peak: 0.06, reverb: 0.7, bus: this.musicBus });
        [12, 16, 19, 23, 24, 28, 31].forEach((st, i) => this.tone({ t: 0.6 + i * 0.32, freq: midiToHz(r + st), dur: 1.6, type: 'triangle', peak: 0.04, attack: 0.01, reverb: 0.85, bus: this.musicBus }));
        this.music.nextAt = Math.max(this.music.nextAt, this.ctx.currentTime + 7);
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
      // A roll tap: a dry scrape of fingers on rock.
      scrabble() { this.noiseHit({ dur: 0.05, freq: 2400 + Math.random() * 800, q: 1.4, peak: 0.12 }); },
      // Lightning: a sharp crack, then thunder rolling away down the valley.
      thunder(o = {}) {
        const v = o.volume ?? 1;
        this.noiseHit({ dur: 0.12, type: 'highpass', freq: 2500, peak: 0.22 * v });
        this.noiseHit({ t: 0.05, dur: 2.6, type: 'lowpass', freq: 260, sweepTo: 90, peak: 0.42 * v, attack: 0.08, bus: this.ambBus, reverb: 0.6 });
        this.noiseHit({ t: 0.5, dur: 1.6, type: 'lowpass', freq: 180, peak: 0.22 * v, attack: 0.3, bus: this.ambBus });
      },
      // A far-off rumble before a storm.
      rumble() { this.noiseHit({ dur: 3, type: 'lowpass', freq: 140, sweepTo: 80, peak: 0.3, attack: 0.8, bus: this.ambBus }); },
      // The dragon wakes: a long, low growl rising into a roar.
      roar() {
        this.tone({ freq: 55, toFreq: 80, dur: 2.2, type: 'sawtooth', peak: 0.12, attack: 0.5, bus: this.ambBus, reverb: 0.6 });
        this.tone({ freq: 58, toFreq: 84, dur: 2.2, type: 'sawtooth', peak: 0.1, attack: 0.5, bus: this.ambBus });
        this.noiseHit({ dur: 2.4, type: 'bandpass', freq: 300, sweepTo: 700, q: 1.2, peak: 0.3, attack: 0.6, bus: this.ambBus, reverb: 0.5 });
      },
      // Into the Dragon's Spine: a low brass stab over a deep boom, and a far-off roar.
      dragonSting() {
        [38, 45, 50, 51].forEach((m, i) => this.tone({ t: i * 0.01, freq: midiToHz(m), dur: 2.8, type: 'sawtooth', peak: 0.035, attack: 0.02, bus: this.musicBus, reverb: 0.8 }));
        this.tone({ freq: 60, toFreq: 32, dur: 1.8, peak: 0.3, attack: 0.004, bus: this.musicBus, reverb: 0.6 });
        this.noiseHit({ dur: 1.4, type: 'lowpass', freq: 220, sweepTo: 60, peak: 0.35, attack: 0.01, bus: this.ambBus, reverb: 0.7 });
        this.tone({ t: 1.2, freq: 46, toFreq: 70, dur: 2.6, type: 'sawtooth', peak: 0.06, attack: 0.8, bus: this.ambBus, reverb: 0.9 });
      },
      // Dragon fire: a roaring rush of flame.
      flame() {
        this.noiseHit({ dur: 1.1, type: 'lowpass', freq: 1800, sweepTo: 500, peak: 0.35, attack: 0.08 });
        this.noiseHit({ dur: 0.9, type: 'bandpass', freq: 300, q: 0.8, peak: 0.25, attack: 0.05 });
      },
      // A scorched note: a quick hiss of heat.
      sizzle() { this.noiseHit({ dur: 0.25, type: 'highpass', freq: 3500, sweepTo: 1800, peak: 0.12 }); },
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
      // Amber Hive: the swarm swells past (a cloud of detuned drones), and a sting.
      buzz() {
        for (let i = 0; i < 3; i++) this.tone({ freq: 190 + i * 23, toFreq: 230 + i * 17, dur: 1.6, type: 'sawtooth', peak: 0.025, attack: 0.5, detune: i * 9 });
        this.noiseHit({ dur: 1.6, freq: 900, q: 3, peak: 0.05, attack: 0.5 });
      },
      sting() { this.tone({ freq: 1400, toFreq: 700, dur: 0.12, type: 'square', peak: 0.05 }); this.noiseHit({ dur: 0.08, type: 'highpass', freq: 3000, peak: 0.1 }); },
      // Clockwork Bastion: a gear note ticks round.
      clank() { this.tone({ freq: 620, dur: 0.03, type: 'square', peak: 0.03 }); this.noiseHit({ dur: 0.03, freq: 2600, q: 6, peak: 0.05 }); },
      // Bone Garden: a skull rattles in its niche; a bone hold snaps.
      rattle() { for (let i = 0; i < 5; i++) this.noiseHit({ t: i * 0.05, dur: 0.03, freq: 1400 + (i % 2) * 500, q: 5, peak: 0.1 }); },
      bonesnap() { this.noiseHit({ dur: 0.06, type: 'highpass', freq: 2200, peak: 0.25 }); this.tone({ freq: 300, toFreq: 120, dur: 0.1, type: 'triangle', peak: 0.08 }); },
      held() { this.tone({ freq: 990, dur: 0.12, type: 'triangle', peak: 0.05 }); this.tone({ t: 0.05, freq: 1480, dur: 0.18, type: 'triangle', peak: 0.04 }); },
      runover() {
        const r = this.music.root;
        [7, 3, 0, -5].forEach((s, i) => this.tone({ t: i * 0.35, freq: midiToHz(r + s), dur: 2, attack: 0.05, peak: 0.05, reverb: 0.9, bus: this.musicBus }));
      },
      wing() { this.noiseHit({ dur: 0.5, freq: 500, q: 0.7, peak: 0.08, attack: 0.15 }); },
      // Bram clears his throat: two short voiced blips.
      bram() {
        [[0, 196, 220], [0.12, 247, 233]].forEach(([t, f, to]) => {
          this.tone({ t, freq: f, toFreq: to, dur: 0.09, type: 'sawtooth', peak: 0.02, attack: 0.01 });
          this.noiseHit({ t, dur: 0.08, type: 'bandpass', freq: 750, q: 6, peak: 0.03, attack: 0.01 });
        });
      },
      // A rubber stamp hits the logbook, then a little bell.
      stamp() {
        this.tone({ freq: 110, toFreq: 55, dur: 0.12, peak: 0.3 });
        this.noiseHit({ dur: 0.08, type: 'lowpass', freq: 1400, peak: 0.25 });
        this.noiseHit({ t: 0.02, dur: 0.18, freq: 3000, q: 0.5, peak: 0.05 });
        [0, 7, 12].forEach((s2, i) => this.tone({ t: 0.18 + i * 0.07, freq: midiToHz(84 + s2), dur: 0.6, type: 'triangle', peak: 0.045, reverb: 0.6 }));
      },
      rockhit() {
        this.tone({ freq: 90, toFreq: 40, dur: 0.18, peak: 0.35 });
        this.noiseHit({ dur: 0.15, type: 'lowpass', freq: 1200, peak: 0.3 });
      },
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

  // A recorded wind loop takes over from the filtered noise (same gain curve).
  useWindSample() {
    if (this.windSample || !this.samples.wind) return;
    const ctx = this.ctx;
    const take = this.samples.wind[0];
    const src = ctx.createBufferSource();
    src.buffer = take.buffer; src.loop = true;
    const g = ctx.createGain(); g.gain.value = take.gain * 3.2;
    src.connect(g).connect(this.windGain);
    this.windFilter.disconnect();
    src.start(0, Math.random() * take.buffer.duration);
    this.windSample = src;
  }

  setAmbience({ wind = 0.2, stream = 0, birds = 0 }) {
    this.amb.wind = wind; this.amb.stream = stream; this.amb.birds = birds;
  }

  setMusicMode({ root, scale, instrument = 'pluck', tempo = 90, octave = 12, motif = null, drum = false, song = null }) {
    const newSong = song && song !== this.music.song;
    if (!song) this.endSong();
    Object.assign(this.music, { root, scale, instrument, tempo, octave, motif, drum, song });
    // A written song (the Golden City) loops bar by bar instead of the loose phrases.
    if (newSong) { this.music.songBar = 0; this.music.songAt = this.ctx ? this.ctx.currentTime + 0.3 : 0; }
  }

  // Stops a written song and fades out the notes it already scheduled (they
  // all play through the song's own bus and reverb send, which fade together).
  endSong() {
    this.music.song = null;
    if (!this.songBus) return;
    const { songBus, songVerb } = this;
    this.songBus = null;
    this.songVerb = null;
    const t = this.ctx.currentTime;
    for (const g of [songBus, songVerb]) {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + 0.8);
    }
    setTimeout(() => { songBus.disconnect(); songVerb.disconnect(); }, 1500);
  }

  // The song's own bus into the music bus, plus its own send into the reverb.
  ensureSongBus() {
    if (this.songBus) return;
    this.songBus = this.ctx.createGain();
    this.songBus.connect(this.musicBus);
    this.songVerb = this.ctx.createGain();
    this.songVerb.connect(this.reverb);
  }

  // Schedules the next bar of a written song shortly before it is due.
  songStep(t) {
    const m = this.music, song = m.song;
    if (m.songAt < t) m.songAt = t + 0.1;
    if (m.songAt - t > 0.25) return;
    const beat = 60 / song.tempo;
    const at = m.songAt - this.ctx.currentTime;
    const bar = m.songBar % song.lead.length;
    const v = 0.6 + m.intensity * 0.4;
    // Everything below goes through the song's bus and reverb send, so endSong()
    // can fade it all, tails included. (The instruments send to this.reverb,
    // which points at the song's send while this bar is scheduled.)
    this.ensureSongBus();
    const reverb = this.reverb, bus = this.songBus;
    this.reverb = this.songVerb;
    // Drone and chord.
    this.tone({ t: at, freq: midiToHz(m.root - 24), dur: beat * 4.4, attack: 0.6, type: 'sine', peak: 0.05 * v, bus, reverb: 0.5 });
    this.tone({ t: at, freq: midiToHz(m.root - 17), dur: beat * 4.4, attack: 0.8, type: 'triangle', peak: 0.014 * v, detune: 5, bus, reverb: 0.6 });
    for (const st of song.chords[bar]) {
      this.tone({ t: at, freq: midiToHz(m.root + st), dur: beat * 4, attack: 1.2, type: 'sine', peak: 0.022 * v, bus, reverb: 0.8 });
    }
    // Frame drum: a heavy one, then a light one.
    this.drum(at, 0.55 * v, bus);
    this.drum(at + beat * 2.5, 0.3 * v, bus);
    this.noiseHit({ t: at + beat * 3, dur: 0.06, type: 'highpass', freq: 5000, peak: 0.02 * v, bus, reverb: 0.4 });
    // The melody.
    let nt = at;
    for (const [st, beats] of song.lead[bar]) {
      if (st !== null) this.note(m.instrument, { t: nt, midi: m.root + st, dur: beats * beat * 1.3, peak: 0.05 * v, bus });
      nt += beats * beat;
    }
    // Now and then a glint of glass far above.
    if (bar % 4 === 3) [24, 28, 31].forEach((st, i) => this.note('glass', { t: at + beat * (2 + i * 0.33), midi: m.root + st + 12, peak: 0.015, bus }));
    this.reverb = reverb;
    m.songBar++;
    m.songAt += beat * 4;
  }

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
    if (!this.windSample) this.windFilter.frequency.setTargetAtTime(300 + this.amb.wind * 500 * gust, t, 0.8);
    else this.windSample.playbackRate.setTargetAtTime(0.85 + gust * 0.3, t, 0.8);
    this.streamGain.gain.setTargetAtTime(this.amb.stream * 0.07, t, 1.0);
    if (this.amb.birds > 0 && t > this.amb.nextBirdAt) {
      this.amb.nextBirdAt = t + 3 + Math.random() * 9 / this.amb.birds;
      this.chirp();
    }
    if (this.music.song) { this.songStep(t); return; }
    if (this.dragonLevel) this.dragonStep(t);
    // While the dragon is awake its war music carries everything.
    if (this.dragonLevel === 2) return;
    const swelling = t < this.music.swellUntil;
    const intensity = swelling ? 1 : this.music.intensity;
    if (t > this.music.nextAt) {
      this.music.nextAt = t + (swelling ? 2.4 : 5 + Math.random() * 6);
      if (Math.random() < 0.35 + intensity * 0.6) this.musicPhrase(intensity);
    }
  }

  setMusicIntensity(v) { this.music.intensity = v; }

  // The Dragon's Spine has music of its own, locked to the beat: 0 none,
  // 1 asleep (a slow heartbeat under a low drone), 2 awake (war drums, a
  // brass ostinato, a throat drone and cymbal swells, bar after bar).
  setDragonMusic(level) {
    if (!this.ctx || level === (this.dragonLevel || 0)) return;
    const from = this.dragonLevel || 0;
    this.dragonLevel = level;
    const t = this.ctx.currentTime;
    if (!this.dragonBus) { this.dragonBus = this.ctx.createGain(); this.dragonBus.gain.value = 0; this.dragonBus.connect(this.musicBus); }
    const g = this.dragonBus.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(level ? 1 : 0, t + (level ? 0.4 : 2.5));
    // Waking up: the fury starts on a crash right away.
    if (level === 2 && from < 2) { this.dragonAt = t + 0.05; this.dragonBar = 0; this.crash(0.05, 1, this.dragonBus); }
    else if (level && !from) { this.dragonAt = t + 0.3; this.dragonBar = 0; }
  }

  dragonStep(t) {
    if ((this.dragonAt || 0) < t) this.dragonAt = t + 0.1;
    if (this.dragonAt - t > 0.25) return;
    const at = this.dragonAt - t;
    const bus = this.dragonBus;
    const root = 38; // D, under the biome's own key
    const bar = this.dragonBar++;
    if (this.dragonLevel === 1) {
      // Asleep: a heartbeat every two seconds and a drone that comes and goes.
      const beat = 60 / 60;
      this.drum(at, 0.5, bus);
      this.drum(at + beat * 0.32, 0.3, bus);
      if (bar % 2 === 0) this.tone({ t: at, freq: midiToHz(root), dur: beat * 4.2, attack: 1.2, type: 'sawtooth', peak: 0.012, bus, reverb: 0.6 });
      this.dragonAt += beat * 2;
      return;
    }
    // Awake: 4/4 at 100, a phrase of four bars.
    const beat = 60 / 100;
    const phrase = bar % 4;
    // Taiko: a big hit on one, a pair on three, rolls leading into the next phrase.
    const hits = [[0, 1], [1.5, 0.45], [2, 0.8], [2.5, 0.6], [3, 0.7]];
    if (phrase === 3) hits.push([3.25, 0.5], [3.5, 0.6], [3.75, 0.8]);
    for (const [b, v] of hits) this.taiko(at + b * beat, v, bus);
    // Low brass ostinato: root, root, minor second, fifth (the dragon's scale).
    const line = phrase === 2 ? [0, 0, 1, 8] : [0, 0, 1, 7];
    line.forEach((st, i) => this.note('horn', { t: at + i * beat, midi: root + 12 + st, dur: beat * 0.9, peak: 0.05, bus }));
    // A throat drone under each phrase, and a brass call over the second half.
    if (phrase === 0) this.note('throat', { t: at, midi: root, dur: beat * 16, peak: 0.035, bus });
    if (phrase === 2) [[12, 1], [13, 0.5], [17, 0.5], [19, 2]].reduce((b, [st, len]) => {
      this.note('horn', { t: at + b * beat, midi: root + 12 + st, dur: len * beat * 1.1, peak: 0.045, bus });
      return b + len;
    }, 0);
    // A cymbal swells into every phrase.
    if (phrase === 3) this.noiseHit({ t: at + beat * 2, dur: beat * 2, type: 'highpass', freq: 6000, peak: 0.05, attack: beat * 1.9, bus, reverb: 0.5 });
    if (phrase === 0 && bar > 0) this.crash(at, 0.6, bus);
    // Ticking hats keep the pace.
    for (let i = 0; i < 8; i++) this.noiseHit({ t: at + i * beat * 0.5, dur: 0.03, type: 'highpass', freq: 8000, peak: i % 2 ? 0.012 : 0.02, bus });
    this.dragonAt += beat * 4;
  }

  // A deep taiko: a pitched thump with a skin slap on top.
  taiko(t, v = 1, bus = this.musicBus) {
    this.tone({ t, freq: 95, toFreq: 48, dur: 0.6, peak: 0.16 * v, attack: 0.003, bus, reverb: 0.35 });
    this.noiseHit({ t, dur: 0.08, type: 'bandpass', freq: 900, q: 1.5, peak: 0.07 * v, bus });
  }

  crash(t, v = 1, bus = this.musicBus) {
    this.noiseHit({ t, dur: 1.6, type: 'highpass', freq: 4500, sweepTo: 3000, peak: 0.07 * v, attack: 0.003, bus, reverb: 0.7 });
  }

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
    // The biome's motif (or a variation of it) on its own instrument, when the
    // music is "present"; otherwise a few loose notes on that instrument.
    const m = this.music;
    if (m.motif && Math.random() < 0.25 + intensity * 0.55) {
      this.playMotif(this.vary(m.motif), 0.6);
    } else {
      const n = intensity > 0.6 ? 2 + Math.floor(Math.random() * 3) : Math.random() < 0.5 ? 1 : 0;
      for (let i = 0; i < n; i++) this.note(m.instrument, { t: 0.6 + i * (0.45 + Math.random() * 0.3), midi: pick(0) + m.octave, dur: 1.4, peak: 0.03 });
    }
    if (m.drum && intensity > 0.4) {
      const beat = 60 / m.tempo;
      for (let i = 0; i < 4; i++) this.drum(0.6 + i * beat * 2, i === 0 ? 1 : 0.6);
    }
  }

  // Motif variations: as written, a scale step up, only its second half, or backwards.
  vary(motif) {
    const r = Math.random();
    if (r < 0.45) return motif;
    if (r < 0.65) {
      const { scale } = this.music;
      const step = (st) => {
        const oct = Math.floor(st / 12), deg = ((st % 12) + 12) % 12;
        const i = scale.indexOf(deg);
        if (i < 0) return st;
        return i + 1 < scale.length ? oct * 12 + scale[i + 1] : (oct + 1) * 12 + scale[0];
      };
      return motif.map(([st, b]) => [step(st), b]);
    }
    if (r < 0.85) return motif.slice(Math.floor(motif.length / 2));
    const rev = motif.map(([st]) => st).reverse();
    return motif.map(([, b], i) => [rev[i], b]);
  }

  playMotif(motif, t = 0, peak = 0.045) {
    const m = this.music;
    const beat = 60 / m.tempo;
    let at = t;
    for (const [st, beats] of motif) {
      this.note(m.instrument, { t: at, midi: m.root + m.octave + st, dur: Math.max(0.25, beats * beat * 1.4), peak });
      at += beats * beat;
    }
    return at;
  }

  // Low pulse for the darker biomes (a soft taiko).
  drum(t, v = 1, bus = this.musicBus) {
    this.tone({ t, freq: 70, toFreq: 42, dur: 0.5, peak: 0.12 * v, attack: 0.005, bus, reverb: 0.3 });
    this.noiseHit({ t, dur: 0.12, type: 'lowpass', freq: 400, peak: 0.06 * v, bus });
  }

  // ---------- instruments ----------
  note(instrument, o) {
    const fn = INSTRUMENTS[instrument] || INSTRUMENTS.bell;
    fn.call(this, { bus: this.musicBus, ...o });
  }

  // Karplus-Strong plucked string, one cached buffer per pitch.
  pluckBuffer(midi) {
    if (this.plucks[midi]) return this.plucks[midi];
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, Math.floor(sr * 2.2), sr);
    const d = buf.getChannelData(0);
    const n = Math.max(2, Math.round(sr / midiToHz(midi)));
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    for (let i = n; i < d.length; i++) d[i] = 0.4985 * (d[i - n] + d[i - n + 1]);
    this.plucks[midi] = buf;
    return buf;
  }
}

// Lead instruments for the biome music. Called with the AudioSystem as `this`;
// o: { t, midi, dur, peak, bus }.
const INSTRUMENTS = {
  // The Green Rise: a plucked string, like a little harp or guitar.
  pluck({ t = 0, midi, dur, peak = 0.04, bus }) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.pluckBuffer(midi);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2600;
    const g = ctx.createGain(); g.gain.value = peak * 2.4;
    src.connect(f).connect(g).connect(bus);
    const rg = ctx.createGain(); rg.gain.value = 0.35; g.connect(rg).connect(this.reverb);
    const start = ctx.currentTime + t;
    g.gain.setValueAtTime(peak * 2.4, start + Math.min(dur, 1.8));
    g.gain.exponentialRampToValueAtTime(0.0001, start + Math.min(dur, 1.8) + 0.3);
    src.start(start);
    src.stop(start + 2.2);
  },
  // The Stone Wall: a wooden marimba, dry and knocking.
  marimba({ t = 0, midi, peak = 0.04, bus }) {
    const f = midiToHz(midi);
    this.tone({ t, freq: f, dur: 0.6, type: 'sine', peak: peak * 1.4, attack: 0.003, bus, reverb: 0.25 });
    this.tone({ t, freq: f * 3.93, dur: 0.08, type: 'sine', peak: peak * 0.5, attack: 0.002, bus });
    this.tone({ t, freq: f * 9.2, dur: 0.03, type: 'sine', peak: peak * 0.2, attack: 0.001, bus });
  },
  // The Frozen Reach: a music box, high and glassy.
  musicbox({ t = 0, midi, peak = 0.04, bus }) {
    const f = midiToHz(midi);
    this.tone({ t, freq: f, dur: 1.6, type: 'sine', peak: peak * 0.9, attack: 0.002, bus, reverb: 0.8 });
    this.tone({ t, freq: f * 2, dur: 0.5, type: 'sine', peak: peak * 0.35, attack: 0.002, bus, reverb: 0.8 });
    this.tone({ t, freq: f * 5.4, dur: 0.12, type: 'sine', peak: peak * 0.12, attack: 0.001, bus });
  },
  // Above the Clouds: a breathy flute with a slow vibrato.
  flute({ t = 0, midi, dur, peak = 0.04, bus }) {
    const ctx = this.ctx;
    const start = ctx.currentTime + t;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = midiToHz(midi);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5; const lg = ctx.createGain(); lg.gain.value = midiToHz(midi) * 0.006;
    lfo.connect(lg).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak * 1.1, start + 0.12);
    g.gain.setValueAtTime(peak * 1.1, start + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur + 0.25);
    o.connect(g).connect(bus);
    const rg = ctx.createGain(); rg.gain.value = 0.6; g.connect(rg).connect(this.reverb);
    o.start(start); lfo.start(start);
    o.stop(start + dur + 0.3); lfo.stop(start + dur + 0.3);
    this.noiseHit({ t, dur: Math.min(0.3, dur), type: 'bandpass', freq: midiToHz(midi) * 2, q: 3, peak: peak * 0.25, attack: 0.05, bus });
  },
  // The Obsidian Spires: a low bowed string, dark and slow.
  cello({ t = 0, midi, dur, peak = 0.04, bus }) {
    const ctx = this.ctx;
    const start = ctx.currentTime + t;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midiToHz(midi);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 4.5; const lg = ctx.createGain(); lg.gain.value = midiToHz(midi) * 0.008;
    lfo.connect(lg).connect(o.frequency);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak * 0.9, start + 0.35);
    g.gain.setValueAtTime(peak * 0.9, start + dur * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur + 0.6);
    o.connect(f).connect(g).connect(bus);
    const rg = ctx.createGain(); rg.gain.value = 0.5; g.connect(rg).connect(this.reverb);
    o.start(start); lfo.start(start);
    o.stop(start + dur + 0.7); lfo.stop(start + dur + 0.7);
  },
  // The Crystal Heights: an FM glass bell that shimmers as it fades.
  glass({ t = 0, midi, peak = 0.04, bus }) {
    const ctx = this.ctx;
    const start = ctx.currentTime + t;
    const f = midiToHz(midi);
    const car = ctx.createOscillator(); car.frequency.value = f;
    const mod = ctx.createOscillator(); mod.frequency.value = f * 3.5;
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(f * 2.2, start);
    mg.gain.exponentialRampToValueAtTime(f * 0.05, start + 1.2);
    mod.connect(mg).connect(car.frequency);
    const g = ctx.createGain();
    this.env(g, start, 0.003, peak * 0.8, 2.2);
    car.connect(g).connect(bus);
    const rg = ctx.createGain(); rg.gain.value = 0.9; g.connect(rg).connect(this.reverb);
    car.start(start); mod.start(start);
    car.stop(start + 2.4); mod.stop(start + 2.4);
  },
  // The Golden City: a hammered dulcimer, two strings a hair apart, bright and metallic.
  santur({ t = 0, midi, dur, peak = 0.04, bus }) {
    const ctx = this.ctx;
    const start = ctx.currentTime + t;
    const len = Math.min(Math.max(dur, 0.8), 2);
    for (const rate of [1, 1.004]) {
      const src = ctx.createBufferSource();
      src.buffer = this.pluckBuffer(midi);
      src.playbackRate.value = rate;
      const f = ctx.createBiquadFilter(); f.type = 'peaking'; f.frequency.value = 3200; f.gain.value = 6;
      const g = ctx.createGain(); g.gain.value = peak * 1.5;
      src.connect(f).connect(g).connect(bus);
      const rg = ctx.createGain(); rg.gain.value = 0.55; g.connect(rg).connect(this.reverb);
      g.gain.setValueAtTime(peak * 1.5, start + len);
      g.gain.exponentialRampToValueAtTime(0.0001, start + len + 0.3);
      src.start(start);
      src.stop(start + len + 0.35);
    }
    this.tone({ t, freq: midiToHz(midi) * 4.2, dur: 0.15, type: 'sine', peak: peak * 0.18, attack: 0.001, bus });
  },
  // The Storm Crown: a dark brass horn, swelling in.
  horn({ t = 0, midi, dur, peak = 0.04, bus }) {
    const ctx = this.ctx;
    const start = ctx.currentTime + t;
    const f = midiToHz(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak * 0.8, start + 0.18);
    g.gain.setValueAtTime(peak * 0.8, start + dur * 0.75);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur + 0.4);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.5;
    lp.frequency.setValueAtTime(f * 1.5, start);
    lp.frequency.exponentialRampToValueAtTime(f * 5, start + 0.2);
    lp.frequency.exponentialRampToValueAtTime(f * 2.5, start + dur + 0.3);
    for (const d of [-6, 6]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d;
      o.connect(lp);
      o.start(start); o.stop(start + dur + 0.5);
    }
    lp.connect(g).connect(bus);
    const rg = ctx.createGain(); rg.gain.value = 0.45; g.connect(rg).connect(this.reverb);
  },
  // The Aurora Ridge: a slow, wide synth pad that breathes in and out.
  pad({ t = 0, midi, dur, peak = 0.04, bus }) {
    const ctx = this.ctx;
    const start = ctx.currentTime + t;
    const len = Math.max(dur, 1) + 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak * 0.7, start + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, start + len);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    for (const [m, d] of [[1, -9], [1, 9], [2, 0]]) {
      const o = ctx.createOscillator(); o.type = m === 2 ? 'sine' : 'triangle'; o.frequency.value = midiToHz(midi) * m; o.detune.value = d;
      o.connect(lp);
      o.start(start); o.stop(start + len + 0.1);
    }
    lp.connect(g).connect(bus);
    const rg = ctx.createGain(); rg.gain.value = 1; g.connect(rg).connect(this.reverb);
  },
  // The Dragon's Spine: a throat-singing drone, a low buzz with a whistling overtone.
  throat({ t = 0, midi, dur, peak = 0.04, bus }) {
    const ctx = this.ctx;
    const start = ctx.currentTime + t;
    const f = midiToHz(midi);
    const len = Math.max(dur, 0.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak * 1.2, start + 0.12);
    g.gain.setValueAtTime(peak * 1.2, start + len * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, start + len + 0.3);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    // Two vocal formants; the upper one glides like a whistle over the drone.
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 450; f1.Q.value = 4;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 18;
    f2.frequency.setValueAtTime(f * 8, start);
    f2.frequency.linearRampToValueAtTime(f * 10, start + len);
    const g2 = ctx.createGain(); g2.gain.value = 2.2;
    o.connect(f1).connect(g);
    o.connect(f2).connect(g2).connect(g);
    g.connect(bus);
    const rg = ctx.createGain(); rg.gain.value = 0.5; g.connect(rg).connect(this.reverb);
    o.start(start); o.stop(start + len + 0.4);
  },
  bell({ t = 0, midi, peak = 0.03, bus }) {
    this.tone({ t, freq: midiToHz(midi), dur: 1.6, attack: 0.01, peak, bus, reverb: 0.9 });
  },
};

export const Audio = new AudioSystemImpl();
