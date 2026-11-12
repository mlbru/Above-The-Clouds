# Build sheet 7 · The Far Range

What this sheet built (all of it pushed, the playable files rebuilt).

## The dragons match
- The dragon that carries you across the cloud sea now wears the Spine dragon's own head
  (`drawHead(jaw, scale)` in `render/dragonArt.js`, drawn at 0.82): same swept horns,
  brow, frills, teeth, lava cracks and golden eye. Wing bones and body shading use the
  same dark crimson ramp as the wall dragon.

## The Far Range
- The dragon sets you down on **the Far Shore**: a ledge the generator always makes just
  above 1873 m (`isFarShoreSegment`), dressed with a carved standing stone (its dragon
  glows at night), a stone lantern and your flag. The landing happens inside the cloud
  bank at the end of the flight, so the clouds part on the new mountain.
- Heights read as **mountain + far range**: `1906 + 120 FAR` next to the height.
- On the Far Range the old foothills are gone: the cloud sea, the Far Range's own
  scenery, and on the horizon the peak you came from.
- The high loop now runs Cascade, Hanging Monastery, Moss Cathedral, then the old high
  biomes again.

| Biome | Look | Twist (all seen, nothing heard) | Gem |
|---|---|---|---|
| The Cascade (1873 m) | wet basalt columns, ferns, big waterfalls with a rainbow in the spray, rainforest cliffs behind | **Spray**: a curtain of water swings across the wall and the note track; notes behind it ripple. Wet holds cost 20% more grip; six perfects in the spray fill a rainbow and make the next climb free | River pearl |
| The Hanging Monastery (2046 m) | sandstone with arched niches and painted panels, plank walkways, prayer flags, paper lanterns, prayer wheels, temples on pillars | **Bells**: a monk on a balcony strikes his bell for every arrow of the call and the row lights them one by one; then the notes come down as blank bells. On monastery ledges a monk pours tea: the next climb is free | Temple jade |
| The Moss Cathedral (2219 m) | moss cushion, roots in the rock, root curtains, glowing caps, shafts of light, a nave of root arches behind | **Vines**: hold an arrow along the vine and press the next one where it bends | Moss agate |

## Follow-up (same day)
- **Far Shore camp**: the Far Range's own base camp, where the dragon sets you down. A
  moss-roofed hut of hides with light in the door, the camp keeper smoking a pipe by the
  fire with a pot on a tripod, a drying rack, the carved standing stone, a stone lantern,
  prayer flags and your flag. The keeper's hot meal makes your first climb there free.
- **Filled sides**: every Far Range biome has two layers of scenery on both sides of the
  screen, scrolling at their own speed, so you climb inside a place and see little sky:
  a gorge of wet basalt with trees and flowing waterfalls (Cascade), a cliff packed with
  temple halls next to a pagoda tower (Monastery), giant mossy trunks with roots and
  fungus shelves and a dim forest behind (Moss Cathedral). Windows, lanterns, glow-worms
  and fungus light up at night (`render/farSideArt.js`, `world/FarSides.js`).
- **Glitch fixed**: the close-passing cloud bank was a few huge stretched sprites plus a
  full-screen tint, so at sunset the whole view flashed pink for a second. It is now a
  bank of real pixel puffs drifting across the top of the view, with no screen tint.

## Run features (idea sheet 1.8, 1.10)
- **Rescue**: now and then someone hangs from a broken rope under a hold. Take that route
  and they tie in and follow you; every miss you make, they make too (three and they rope
  down to camp). Reach a ledge together: a pouch of three stones, and their flag flies at
  base camp from then on.
- **Mountain events**, one per run (about 7 in 10 runs), announced by Bram as you leave camp:
  avalanche season (be on a ledge when the slide comes), the migration (perfects may bring
  down a crane feather worth a stone), the eclipse (one biome goes dark, notes flash on the
  beat), meteor shower (falling stars leave gems on routes), the rival (Kestrel races you
  ledge to ledge, with a marker at the screen edge).

## Gifts and dares (idea sheet 1.13, 1.14)
- Gifts: METRONOME (a pendulum you see, not a tick), SHERPA, STORMCALLER, GOAT HOOVES,
  OLD CROW, LAST LIGHT (legendary), synergy NIGHT SHIFT.
- Dares: SHORT SIGHT (replaces "silent mountain"), FRAGILE, PACIFIST DRAGON, TOURIST,
  ONE ROPE. The dares board is now a row of cards on a line that slides.

## Dev
- `?event=avalanche|migration|eclipse|meteors|rival` forces a run's event.
- `window.__atc.rescueChance = 1` makes the next route choice have a stranded climber.
