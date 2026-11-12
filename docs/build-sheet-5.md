# Above the Clouds: build sheet 5

Picked from idea sheet 4 (2026-11-12): 2.6, the outcrop rock fix, 2.12, 2.13, 3.5, Thin Air
(difficulty only), 6.2, 6.3 and all of section 7 except the old-climber statue.

Status (2026-11-12): **all six built**, tests and build pass, not yet committed. Differences
from the plan are marked *changed*.

## Build order

1. **Outcrop rocks**: no more flat cuts.
2. **Small polish** (§7) and **climber feel** (2.12).
3. **Accessibility** (2.13).
4. **Thin Air** tiers and the altimeter screen (6.2).
5. **Camp requests** and the corkboard (3.5, 6.3).
6. **Base camp grows** (2.6).

---

## 1 · Outcrop rocks

The dark crags that slide past at the wall's edge (`foregroundRock` in `render/textures.js`)
were painted 30 px wide on their first and last row, so they started and stopped with a flat
cut. Their outline now tapers to a point at both ends (each crag curls back out of view past
the screen edge), with chunky steps on the way. Three shapes per biome instead of one.

## 2 · Small polish and climber feel

| Idea | How |
| --- | --- |
| Bram's lines follow your record | Camp forecast and trader lines pick from a pool keyed to your best height and the last run ("BACK FROM 1800? SIT. EAT.") |
| A goat that follows you | Now and then a goat on the first ledges hops after you for a few holds, then gives up and bleats |
| Shiny holds | Holds you've grabbed often (lifetime count per biome) get a worn, polished highlight |
| Wish on a shooting star | About one shooting star in three, while you hang or rest, can be wished on: press E (touch: tap the sky) before it burns out for one gem. *Changed:* E instead of ↑, because ↑ starts a climb |
| Frost on the lens | In the Frozen Reach and Aurora Ridge, frost creeps in from the screen corners (LensDrops already does rain) |
| A distant climber | Very small, on a far peak in the backdrop, sometimes waving a lamp at night |
| Breathing | Breathing gets faster and louder as grip drops |
| Glowing cloud sea | At night the cloud sea below glows faintly with the lights of the valley underneath |
| Hair and scarf in the wind | Scarf, beanie bobble and loose hair stream with the wind direction |
| Breath grows with height | Breath puffs get bigger the higher you are |
| Taped hands | After 30 minutes of climbing in one run, white tape on the fingers; after an hour, it goes worn and red |
| Look at the gem | While choosing, the climber turns their head towards a route with a gem |
| Near-miss wobble | A GOOD hit (not perfect) on the last note makes the climber wobble for a moment |

## 3 · Accessibility

New Settings section **ACCESS**:
- **NOTE COLOURS**: STANDARD, RED-GREEN (blue mirrors, yellow thermals, white gusts) and
  BLUE-YELLOW (red mirrors, orange thermals, grey gusts). *Changed:* no shape mark on gems.
- **HIGH CONTRAST**: a black track, a white line and stronger timing zones. *Changed:* no
  outlines on the notes themselves.
- **SCREEN SHAKE**: FULL, LOW, OFF. LOW softens every camera jolt to 40% and the dragon's box
  sway to 30%.
- **LATENCY**: a calibration screen: Bram taps a pot with a spoon on the beat, you tap along
  eight times, and the average offset is saved and added to every judgement.

## 4 · Thin Air

A ladder of ten harder versions of Normal. Pure difficulty: no new rewards apart from a
record and a mark per tier.

- **Unlock**: reach the Dragon's Spine (1700 m) in Normal. Tier *n+1* opens when you reach the
  Crystal Heights (832 m) on tier *n*.
- **Rules stack** (tier 3 has the rules of tiers 1 to 3):
  1. Grip drains 15% faster while you hang.
  2. Timing windows are 8% tighter.
  3. The mountain ramps up 25% sooner.
  4. Misses cost 2 grip more.
  5. Ledges only fill your grip to 85.
  6. Perfects cost twice as much grip.
  7. No grip back from streak milestones.
  8. Crumbling holds break 25% sooner, and the catch window is 15% narrower.
  9. Every climb from 300 m has one more input.
  10. The beat is 6% faster.
- Gear, perks and Trail Boons still work (it is still Normal). Dares are not combined with it:
  picking a tier clears the dares and picking a dare sets Thin Air off.
- Each tier keeps its own record. Thin Air runs are not sent to the leaderboard.
- **Screen**: Bram hands you his old brass altimeter. ← → turn the bezel one tier at a time;
  the screen frosts over more with each tier and the needle trembles. The tier's new rule is
  engraved under the dial, the rules below it are listed small. Space straps it on.
- At camp, the CLIMB badge shows `THIN AIR 3`.

## 5 · Camp requests

A corkboard on a post at base camp (a new camp spot, **REQUESTS**). Three notes at a time,
pinned with string; a finished one gets a red thumbprint and pays out when you open the
board. A new note replaces it after your next run.

- Requests come from a pool of about 30 in four kinds: **find** (a discovery, a regional gem,
  a viewpoint), **do** (a streak, a clean biome, dodge 5 rocks), **reach** (a height in a biome
  or with a gift), **people** (story ones, from named people at camp: the photographer, the
  geologist, the old woman, the child).
- Each pays gems. *Changed:* story notes add no Collection card; instead that person sits at
  the fire from then on (see 6).
- Requests only count in Normal endless runs (Thin Air included).

## 6 · Base camp grows

Base camp shows your progress:
- An extra tent for every 500 m of Normal record (up to four).
- A banner over the trail for every mastered biome, in that biome's colours.
- Bram's stall upgrades in three steps by gems spent (crate → awning → lanterns and a sign).
- People whose story notes you finished sit at the fire (Ines, Dr Pim, Marta, Noor, Tenzin).
- Other climbers' tents are recoloured copies of yours (blue, green, rose).
- A pennant on the THIN AIR altimeter post for your highest tier.

---

## Where it lives

| Piece | Files |
| --- | --- |
| Outcrop rocks | `foregroundRock` in `render/textures.js` (`fg_<biome>_<0-2>`) |
| Polish | `data/bramTalk.js`, `world/Critters.js` (`follow`), `world/WallRenderer.js` (worn holds, `placeCampGrowth`), `world/SkyLife.js` (distant climber, wish stars), `world/LensDrops.js` (frost), `world/Background.js` (town glow) |
| Climber feel | `entities/Climber.js` (`wobble`, breathing, `lookSide`), `entities/OutfitFx.js` (`drawHair`, `drawTape`), `hang_lookL/R` in `render/climberArt.js` |
| Access | ACCESS rows in `ui/SettingsMenu.js`, latency test in `scenes/SettingsScene.js`, `applyNotePalette` in `ui/ComboPrompt.js`, `now()` in ClimbScene |
| Thin Air | `data/thinAir.js`, `scenes/ThinAirScene.js`, altimeter spot in `ui/CampMenu.js` |
| Requests | `data/requests.js`, `scenes/RequestsScene.js`, board and people in `render/campArt.js` |
| Tests | `tests/camp.test.js` |
