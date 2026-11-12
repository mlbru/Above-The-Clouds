# Above the Clouds: build sheet 6

Asked for on 2026-11-12: the Dragon's Gate with the dragon carrying you to another mountain,
pets that grow (3.10), things in front of the camera (2.10), and a new beat that works without
sound. Ideas for the new mountain's first three biomes are in `idea-sheet-4.md` §8.

Status: built, tests (104) and build pass.

| Piece | What | Files |
| --- | --- | --- |
| Dragon's Gate | From 1760 m the dragon is held awake (breath every 3 to 4.5 s). The first ledge past 1830 m is forced by the generator, so it always lands at 1845 to 1866 m inside the Spine. Pillars, chain and braziers on it. | `data/gate.js`, `SegmentGenerator` (`gate`), `DragonEye.holdAwake/release`, `WallRenderer.placeGate`, `ClimbScene.updateGate/dragonGate` |
| The flight | 10.5 s cinematic, skippable, the run waits (like the lift ride). Captions: THE DRAGON'S GATE, ACROSS THE CLOUD SEA, THE FAR RANGE. Lands on THE FAR SHORE with full grip. Old mountain stays on the horizon. New discovery: THE DRAGON'S GATE. | `ui/DragonFlight.js`, `SkyLife.oldMountain` |
| Roped pairs | Two plain, different arrows, a beat or more apart, never the first note. Drawn swapped with a rope, they hop into place 1.6 beats (at least 650 ms) before the first one is due. About 15% of routes at 2000 m, 30% from 2500 m. Bram tip, Collection card. | `ramp.swap`, `buildRhythm`, `ComboPrompt` |
| Pets | Goat kid, hive bee, crystal moth, dragonling. Grow at 1500 m and 6000 m climbed together. Habits are hints only. The pen screen and the pen at camp. | `data/pets.js`, `render/petArt.js`, `entities/PetFx.js`, `scenes/PetScene.js` |
| Close passers | Bird, cloud bank, snow, leaves, bees, bats, crystal dust, steam, embers, by biome, every 28 to 65 s, top of the screen only, off with REDUCED particles. | `world/NearPass.js` |

Not built: the Far Range's own biomes (after the Far Shore the high loop continues), and the
playable ride on the dragon's back (idea B).
