// The Dragon's Gate: the end of the first Dragon's Spine. From WAKE_FROM the
// dragon wakes for good and never sleeps again; it breathes faster and its
// war drums never stop. The first ledge past LEDGE_AT is always a ledge (the
// generator makes it one) and is the Gate itself: two black pillars with
// braziers. Reach it and the dragon lowers its head to the ledge, you climb
// onto its neck, and it carries you across the cloud sea to the next
// mountain, the Far Range. Once per run, in every endless mode.
import { LOOP_START } from './biomes.js';

export const GATE = {
  wakeFrom: 1760,
  ledgeAt: 1830,
  // Must stay inside the first Dragon's Spine.
  below: LOOP_START,
  // While the Gate holds it awake, it breathes every few seconds.
  breathSec: [3, 4.5],
  // The far mountain's name and the line Bram would carve on the post.
  farName: 'THE FAR RANGE',
};

// Is the segment starting at startMeters (after one that started at
// prevMeters) the Gate ledge?
export const isGateSegment = (prevMeters, startMeters) => prevMeters < GATE.ledgeAt && startMeters >= GATE.ledgeAt && startMeters < GATE.below;
