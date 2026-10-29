// Time-based judging of a sequence of directional inputs. Pure logic: the
// caller passes "now" (ms) from a pausable clock, never frame counts.
//
// Notes can be given as a plain direction pattern (['L','U','R']) or as rhythm
// specs: { dir, gap (beats since previous note), hold (beats), hidden, gust,
//          mirror (shown the other way round), chord (a second direction
//          pressed together with dir), roll (taps needed before the tail ends),
//          still (a beat on which you must NOT press), swarm (a still beat
//          that is the Amber Hive's swarm), gear (ticks a gear note turns) }.
export const RESULT = { PERFECT: 'perfect', GOOD: 'good', MISS: 'miss' };

export class ComboSystem {
  constructor({
    pattern, notes: specs, beatMs, perfectMs, goodMs, earlyGraceMs = 200, leadInMs = 900, startTime = 0,
    minGapMs = 0, gustWindowScale = 0.72, holdReleaseGraceMs = 120, minPerfectMs = 45, minGoodMs = 90,
    rollBeats = 1.5, chordSpreadMs = 90, stillScale = 0.85,
  }) {
    this.stillScale = stillScale;
    this.chordSpreadMs = chordSpreadMs;
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
        rollMs: spec.roll ? Math.max(450, Math.round(rollBeats * beatMs)) : 0,
        taps: spec.roll || 0,
        tapsLeft: spec.roll ? spec.roll - 1 : 0,
        mirror: !!spec.mirror,
        still: !!spec.still,
        swarm: !!spec.swarm,
        gear: spec.gear || 0,
        chord: spec.chord || null,
        pressed: null,
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
      if (note.rollMs) t += note.rollMs;
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
      const c = this.current;
      // A still beat that passes untouched is a perfect one.
      if (c.still) missed.push(this.judge(c, RESULT.PERFECT, null, 0));
      else missed.push(this.judge(c, RESULT.MISS, c.pressed ? 'half' : 'late', now - c.time));
    }
    return missed;
  }

  // Completes holds and rolls whose tail has passed. Returns the completed
  // notes; a roll that ran out of time with taps left turns into a miss
  // (reason 'roll') and is returned in `failed`.
  updateHolds(now, failed = []) {
    const done = [];
    this.activeHolds = this.activeHolds.filter((h) => {
      if (now < h.end) return true;
      h.note.holding = false;
      if (h.note.tapsLeft > 0) {
        h.note.result = RESULT.MISS;
        h.note.reason = 'roll';
        failed.push(h.note);
        return false;
      }
      h.note.holdDone = true;
      done.push(h.note);
      return false;
    });
    return done;
  }

  // Releasing a held direction too early breaks the hold. Returns the note
  // that turned into a miss, or null.
  release(dir, now) {
    const h = this.activeHolds.find((x) => x.note.dir === dir && x.note.holdMs);
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
    // A roll in progress takes every tap of its arrow until its tail ends
    // (a little longer, so a last extra tap is never judged as the next note).
    const roll = this.activeHolds.find((h) => h.note.rollMs && h.note.dir === dir && now < h.end + 150);
    if (roll) {
      if (roll.note.tapsLeft > 0) roll.note.tapsLeft--;
      return { auto, judged: null, tap: roll.note };
    }
    // A press that arrives just after a window closed is that note's late
    // miss; it must not also be judged against the next note.
    // (A still beat that just passed untouched is no reason to drop the press.)
    if (this.index >= this.notes.length || auto.some((n) => !n.still)) return { auto, judged: null };
    const note = this.current;
    const dt = now - note.time;
    let judged = null;
    // A still beat: any press close to it is a move the dragon sees. Presses
    // further away belong to nothing and are ignored.
    if (note.still) {
      if (Math.abs(dt) <= note.goodMs * this.stillScale) judged = this.judge(note, RESULT.MISS, 'moved', dt);
      return { auto, judged };
    }
    if (dt < -(note.goodMs + this.earlyGraceMs)) judged = null;
    else if (dt < -note.goodMs) judged = this.judge(note, RESULT.MISS, 'early', dt);
    else if (note.chord) judged = this.pressChord(note, dir, dt);
    else if (dir !== note.dir) judged = this.judge(note, RESULT.MISS, 'wrong', dt);
    else if (Math.abs(dt) <= note.perfectMs) judged = this.judge(note, RESULT.PERFECT, null, dt);
    else judged = this.judge(note, RESULT.GOOD, null, dt);
    if (judged && judged.result !== RESULT.MISS && judged.holdMs) {
      judged.holding = true;
      this.activeHolds.push({ note: judged, end: judged.time + judged.holdMs });
    }
    if (judged && judged.result !== RESULT.MISS && judged.rollMs) {
      judged.holding = true;
      this.activeHolds.push({ note: judged, end: judged.time + judged.rollMs });
    }
    return { auto, judged, half: note.chord && !judged ? note : null };
  }

  // A double note needs both arrows. The first press is remembered; the note
  // is judged on the second, by the later of the two (and the gap between them).
  pressChord(note, dir, dt) {
    if (dir !== note.dir && dir !== note.chord) return this.judge(note, RESULT.MISS, 'wrong', dt);
    if (!note.pressed) { note.pressed = { dir, dt }; return null; }
    if (note.pressed.dir === dir) return null;
    if (Math.abs(dt - note.pressed.dt) > this.chordSpreadMs + note.goodMs) return this.judge(note, RESULT.MISS, 'half', dt);
    const worst = Math.abs(dt) > Math.abs(note.pressed.dt) ? dt : note.pressed.dt;
    const apart = Math.abs(dt - note.pressed.dt);
    const perfect = Math.abs(worst) <= note.perfectMs && apart <= this.chordSpreadMs;
    return this.judge(note, perfect ? RESULT.PERFECT : RESULT.GOOD, null, worst);
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
