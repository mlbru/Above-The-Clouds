// Time-based judging of a sequence of directional inputs. Pure logic: the
// caller passes "now" (ms) from a pausable clock, never frame counts.
//
// Notes can be given as a plain direction pattern (['L','U','R']) or as rhythm
// specs: { dir, gap (beats since previous note), hold (beats), hidden, gust }.
export const RESULT = { PERFECT: 'perfect', GOOD: 'good', MISS: 'miss' };

export class ComboSystem {
  constructor({
    pattern, notes: specs, beatMs, perfectMs, goodMs, earlyGraceMs = 200, leadInMs = 900, startTime = 0,
    minGapMs = 0, gustWindowScale = 0.72, holdReleaseGraceMs = 120, minPerfectMs = 45, minGoodMs = 90,
  }) {
    this.beatMs = beatMs;
    this.perfectMs = perfectMs;
    this.goodMs = goodMs;
    this.earlyGraceMs = earlyGraceMs;
    this.holdReleaseGraceMs = holdReleaseGraceMs;
    const list = specs || pattern.map((dir) => ({ dir }));
    let t = startTime + leadInMs;
    this.notes = list.map((spec, i) => {
      if (i > 0) t += Math.max(minGapMs, (spec.gap ?? 1) * beatMs);
      const gust = !!spec.gust;
      const note = {
        index: i,
        dir: spec.dir,
        time: t,
        holdMs: spec.hold ? Math.max(300, Math.round(spec.hold * beatMs)) : 0,
        hidden: !!spec.hidden,
        gust,
        thermal: !!spec.thermal,
        perfectMs: gust ? Math.max(minPerfectMs, Math.round(perfectMs * gustWindowScale)) : perfectMs,
        goodMs: gust ? Math.max(minGoodMs, Math.round(goodMs * gustWindowScale)) : goodMs,
        result: null,
        reason: null,
        offset: null,
        holding: false,
        holdDone: false,
      };
      if (note.holdMs) t += note.holdMs;
      return note;
    });
    this.index = 0;
    this.activeHolds = [];
  }

  get current() { return this.notes[this.index] || null; }
  get done() { return this.index >= this.notes.length && this.activeHolds.length === 0; }

  // Shift all pending timings (used when resuming from pause).
  shift(ms) {
    for (const n of this.notes) if (!n.result) n.time += ms;
    for (const h of this.activeHolds) h.end += ms;
  }

  // Marks notes whose window has fully passed as late misses.
  update(now) {
    const missed = [];
    while (this.index < this.notes.length && now - this.current.time > this.current.goodMs) {
      missed.push(this.judge(this.current, RESULT.MISS, 'late', now - this.current.time));
    }
    return missed;
  }

  // Completes holds whose duration has passed. Returns the completed notes.
  updateHolds(now) {
    const done = [];
    this.activeHolds = this.activeHolds.filter((h) => {
      if (now < h.end) return true;
      h.note.holding = false;
      h.note.holdDone = true;
      done.push(h.note);
      return false;
    });
    return done;
  }

  // Releasing a held direction too early breaks the hold. Returns the note
  // that turned into a miss, or null.
  release(dir, now) {
    const h = this.activeHolds.find((x) => x.note.dir === dir);
    if (!h) return null;
    this.activeHolds = this.activeHolds.filter((x) => x !== h);
    h.note.holding = false;
    if (now >= h.end - this.holdReleaseGraceMs) {
      h.note.holdDone = true;
      return null;
    }
    h.note.result = RESULT.MISS;
    h.note.reason = 'release';
    return h.note;
  }

  // Returns { auto: [late misses], judged: note|null }. judged is null when
  // the press was far too early to belong to the current note.
  press(dir, now) {
    const auto = this.update(now);
    // A press that arrives just after a window closed is that note's late
    // miss; it must not also be judged against the next note.
    if (this.index >= this.notes.length || auto.length) return { auto, judged: null };
    const note = this.current;
    const dt = now - note.time;
    let judged = null;
    if (dt < -(note.goodMs + this.earlyGraceMs)) judged = null;
    else if (dt < -note.goodMs) judged = this.judge(note, RESULT.MISS, 'early', dt);
    else if (dir !== note.dir) judged = this.judge(note, RESULT.MISS, 'wrong', dt);
    else if (Math.abs(dt) <= note.perfectMs) judged = this.judge(note, RESULT.PERFECT, null, dt);
    else judged = this.judge(note, RESULT.GOOD, null, dt);
    if (judged && judged.result !== RESULT.MISS && judged.holdMs) {
      judged.holding = true;
      this.activeHolds.push({ note: judged, end: judged.time + judged.holdMs });
    }
    return { auto, judged };
  }

  judge(note, result, reason, offset) {
    note.result = result;
    note.reason = reason;
    note.offset = offset;
    this.index++;
    return note;
  }

  summary() {
    const s = { perfect: 0, good: 0, miss: 0, total: this.notes.length };
    for (const n of this.notes) if (n.result) s[n.result]++;
    s.allPerfect = s.perfect === s.total;
    return s;
  }
}

// Computes the final perfect/good windows for a route from the balance config.
export function timingWindows(balance, { windowScale = 1, forgiving = false, extraGoodMs = 0 } = {}) {
  const t = balance.timing;
  const f = windowScale * (forgiving ? t.forgivingMultiplier : 1);
  return {
    perfectMs: Math.max(t.minPerfectMs, Math.round(t.perfectMs * f)),
    goodMs: Math.max(t.minGoodMs, Math.round(t.goodMs * f + extraGoodMs)),
  };
}
