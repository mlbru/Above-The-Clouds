# Above the Clouds

**An endless pixel-art climbing game where every move is a rhythm.** Pick a route up the
wall, then climb it by pressing a short run of directions on the beat. Grip is your only
resource, the mountain never ends, and every part of it plays by its own rules.

**[▶ Play in your browser](https://mlbru.github.io/Above-The-Clouds/)** · keyboard, mouse or touch · no install

![Title screen: the climber at base camp below the wall](docs/screenshots/title.png)

## Nine biomes, eight twists

The mountain climbs through nine biomes. Each has its own scenery in the distance, its own
rock, weather and music, and (above the first) its own mechanic. From Above the Clouds on,
every biome is about 250 m long. Above 1950 m the five highest biomes take turns, forever.

| | Biome | What changes |
| --- | --- | --- |
| ![The Green Rise](docs/screenshots/green-rise.png) | **The Green Rise**<br>0 m | The calm start: meadows, a winding river and pine forest below. No twist, just the climb. |
| ![The Stone Wall with a rock falling towards the climber](docs/screenshots/stone-wall.png) | **The Stone Wall**<br>80 m | **Rockfall.** Rocks come down as you grab a hold. Press the shown direction on the beat to dodge; a hit costs grip, a clean dodge feeds your streak. |
| ![The Frozen Reach in a whiteout](docs/screenshots/frozen-reach.png) | **The Frozen Reach**<br>300 m | **Whiteout.** Blizzards roll in. Notes only appear just before the line, but gems turn up twice as often. Wait it out on a ledge, or climb on by feel. |
| ![Above the Clouds with a thermal route](docs/screenshots/above-the-clouds.png) | **Above the Clouds**<br>480 m | **Thermals.** Some routes ride warm air. Hit the orange up-note perfectly and the updraft lifts you 3 m higher. |
| ![The Obsidian Spires in the dark](docs/screenshots/obsidian-spires.png) | **The Obsidian Spires**<br>700 m | **Darkness.** The black glass swallows the light. Notes are faint shapes that flash up on every beat, and your headlamp comes on. |
| ![The Crystal Heights](docs/screenshots/crystal-heights.png) | **The Crystal Heights**<br>950 m | **Prism light.** A beam of split sunlight sweeps across the routes while you decide. Start a climb on the lit route and its hits cost no grip, and its gem is worth double. |
| | **The Storm Crown**<br>1200 m | **Storms.** Thunderheads roll over the summit ridge. While a storm rages, hanging on a hold drains grip five times faster with no grace period: pick quickly, or wait it out on a ledge. Lightning lights up the wall. |
| | **The Aurora Ridge**<br>1450 m | **Swing.** Northern lights sway over the ice, day and night, and so does the rhythm: every route plays long-short, long-short. |
| | **The Dragon's Spine**<br>1700 m | **Dragon fire.** A dragon sleeps coiled around the peak. Now and then it wakes and rears its head beside the wall. While it watches, the mountain shakes, the play box sways and thunder rolls, and every few seconds it draws breath and breathes fire at you: swing clear with the arrow, on the beat. Ledges are safe. |

## How it plays

- **Choose a route.** Safe, normal or risky: higher routes gain more height but cost more
  grip and have longer, trickier rhythms.
- **Climb on the beat.** Arrows slide into the line; press ← ↑ → in time. Perfect hits cost
  almost no grip, misses cost a lot.
- **Rest on ledges.** Ledges refill your grip and are your checkpoints.
- **One slip per biome.** Lose your grip once and you either catch yourself or fall back to
  your last ledge. Lose it a second time in the same biome, caught or not, and the run is
  over: back to 0 m.
- **Collect and spend.** Every biome has its own gem. Spend them at the trader at base camp
  on gear, perks and clothes.

Three modes: **Normal**, **Hard** (stricter timing, hungrier grip) and **Summit** (one fall
ends the run). Each keeps its own record.

## Run locally

```
npm install
npm run dev        # http://localhost:5183
npm test           # logic tests (node:test)
npm run build      # production build in dist/
node tests/balanceSim.mjs   # Monte-Carlo balance check
```

URL flags: `?seed=123` (reproducible mountain), `?play` (skip title),
`?timer` (setTimeout game loop for background tabs), `?harness` (loads the in-browser
integration tests; run `await __runHarness()` in the console), `?at=1450` (dev server only:
a test run starting at that height, nothing saved), `?touch` (swipe controls on a computer),
`?portrait` / `?landscape` (force a layout), `?season=halloween|christmas|none` (pretend it is
that time of year).

## Bram explains as you go

There is no separate tutorial: the first time something new shows up in a run (choosing a
route, the beat, jugs, ledges, slipping, off-beat and hold notes, loose rock, ice,
crumbling holds, gusts, blind notes, gems, and every biome's twist), Bram, the base camp
trader, pops up and explains it in one sentence ("DUCK THE ROCK! PRESS THE ARROW ON THE
BEAT!"). The game stands still while he talks (the clock, notes, crumbling holds and
falling rocks all wait); press Space, an arrow or tap the bubble to carry on, and the
rhythm gets a short lead-in again. Each tip is shown once per save
(`src/data/bramTips.js`, `src/ui/BramTip.js`).

The old Training Crag still exists for testing: `?tutorial` jumps straight in.

## Expeditions

**EXPEDITIONS** (the signpost at base camp) opens a lineup of painted mountains on a wide
horizon: ← → swing the view from one to the next (the sky changes with it), and the chosen one
shows its height, your best, journal pages found and a flag where you got to. Space climbs.

- **Bram's Route** (about 600 m, 12 pitches): the climb Bram and Elsa never finished.
- **Mount Ember** (about 320 m, 7 pitches): an active volcano. Lava rises behind you while you
  climb (it waits while you rest on a ledge); close to it the holds are hot and drain your grip
  fast, and if it reaches your feet you slip. The mountain erupts: dodge the rocks on the beat.
- **The Sky Islands** (about 280 m, 7 pitches): no wall at all, just rocks floating over a sea of
  clouds. Wide jumps from island to island on gust notes and thermals.
- **The Crevasse** (about 130 m, 4 pitches): a crack in the glacier between two ice walls. The
  holds alternate walls, so SAFE and RISKY climbs end in a leap across the gap on the last
  arrow (← or →); NORMAL stays on your own wall. Ledges are snow bridges (`chasm` in
  `src/data/expeditions.js`, the gap painted in `src/render/wallArt.js`).

Every hold, rhythm and ledge is written by hand in `src/data/expeditions.js` and laid out by
`src/systems/ExpeditionMountain.js`; an expedition can bring its own look (`theme`, the special
biomes `volcano` and `sky` in `src/data/biomes.js`), rising lava and floating islands. No fall
limit: a fall always takes you back to the last ledge. Each ledge holds a journal page (Elsa's
own notes on the two new mountains), the summit a last page, and the first ascent pays gems.

## Base camp is the menu

The title screen has no list: base camp itself is the menu. The wall is **CLIMB** (press ↓ on it
to switch between Normal, Hard and Summit), the campfire is **COLLECTION**, the signpost is
**EXPEDITIONS**, Bram is the **SHOP** and the tent is the **WARDROBE**. ← → hop between them,
Space goes; the mouse works too. The title camp *is* the start of your next run (same
mountain, same time of day): picking CLIMB fades the words away and the climber steps straight
onto the wall, with no loading screen and no second base camp. Fall back to base camp during a
run and you get the same camp menu (with your slips for the Green Rise under the logo); CLIMB
carries on with the run (`src/ui/CampMenu.js`). Settings, controls and fullscreen sit behind the gear in the
top right. Left alone for 20 seconds, the climber sets off up the wall by himself; any key
brings him back.

## The collection

**COLLECTION** (the campfire, or the pause menu): everything you have met on the mountain, as
cards, in seven chapters: places, creatures, gems, gear, hazards, wonders and Bram's stamps.
Found cards show their picture; the rest show their back with a "?" (stamps show their goal
and your progress). A card you have not looked at yet is tagged NEW and turns over the first
time you pick it. 36 stamps on five pages (height, rhythm, mountain, finds, daring), from
"climb 50 m" to "reach 2000 m", plus two secret ones; each pays gems once
(`src/data/journal.js`, `src/data/logbook.js`, `src/scenes/CollectionScene.js`).

## End of a run

When the run ends you get a summary: the height you reached, a strip of the mountain
showing which biome you were stranded in (and your record), perfect moves, best streak,
finds (stones, discoveries, viewpoints), gems and slips caught, and any logbook stamps the
run earned (`src/ui/RunSummary.js`).

The run-ending fall is a short scene of its own: the climber tumbles down through the clouds
while the height counts back to 0 m, then lands in the cloud sea (`cloudFall()` in ClimbScene).

## Life on the mountain

- **New biome panorama**: climbing into a new biome slides in cinema bars and lets the camera
  drift up over the new stretch before its title card; the grip clock waits, any key skips it.
- **Moods**: the climber cheers on a ledge after a streak of 10+, puts the hands on the knees
  when arriving with little grip, and shivers and hugs themself in the cold.
- **Animals** (`src/world/Critters.js`): birds perch on holds on the lower mountain and take off
  when you climb close; mountain goats stand on rest ledges, turn to watch you and jump away
  when you arrive.
- **Seasons** (`src/data/seasons.js`): around Halloween (15 Oct - 3 Nov) base camp gets carved
  pumpkins and bats and Bram sells the PUMPKIN COAT; around Christmas (1 Dec - 6 Jan) snow,
  fairy lights and baubles, and the SANTA BOBBLE.

## Game details

- **The mountain gets harder as you climb**: the beat speeds up, timing windows shrink,
  climbs get longer (up to 7 inputs) and rest ledges spread out (`ramp` in `balanceConfig.js`).
- **Tricks unlock with height**: off-beat rhythms (40 m+), crumbling holds that break after a
  few seconds (150 m+), wind gusts with tighter timing (250 m+), hold notes (180 m+), and
  blind notes that fade out before the line (380 m+).
- **The high mountain keeps getting harder** after the tempo tops out at 800 m. New kinds of
  notes appear and get more common all the way to about 3500 m: **mirrored** arrows in pink that
  you press the other way (950 m+), **doubles**, two stacked arrows pressed together (1200 m+), and
  **rolls**, a dotted tail you tap again and again until its dots are gone (1450 m+; 3 taps,
  4 from 2200 m, 5 from 3000 m). From 1700 m climbs get one more input (`mirror`, `chord`,
  `roll` in the `ramp` of `balanceConfig.js`).
- **Perfect streaks**: consecutive perfect moves are counted under the grip meter. At 10, 20
  and 30 (then every 10) you get grip back; 20 and 30 in a row unlock the Golden Beanie and
  the Blaze jacket (`streak` in `balanceConfig.js`).
- **Record marker**: a dashed gold line with a flag shows your record height for the current
  mode on the wall, and fades when you pass it.
- **Music**: every biome has its own key, tempo, lead instrument and motif (`music` in
  `src/data/biomes.js`): a plucked string in the Green Rise, a wooden marimba on the Stone
  Wall, a music box in the Frozen Reach, a breathy flute above the clouds, a low bowed
  string with a slow drum in the Obsidian Spires, FM glass bells in the Crystal Heights, a dark
  brass horn over storm drums on the Storm Crown, a slow breathing pad on the Aurora Ridge and
  a throat-singing drone with war drums on the Dragon's Spine.
  The motif plays under every biome title card and comes back (sometimes varied) while you climb.
- **Animation**: every reach and pull goes through an in-between frame; topping out on a
  ledge goes elbows-over, knee up, stand. A fall starts with the hands peeling off the hold,
  then the climber flails down (a run-ending fall tumbles away).
- **Feedback**: perfect hits flash the climber, burst a ring and play a note that climbs with
  the streak. The streak counter grows and catches fire at 10/20, and shatters when broken.
  New biomes get a typed title card, every 100 m shows a banner, and beating your record
  sets off a fanfare with confetti.
- **Rockfall** (Stone Wall): every 30-50 s a rockfall greets you as you grab a hold. A rock
  drops onto you on the beat; the climber braces and ducks, and pressing the shown direction
  (left/right) swings the body clear on one hand while the rock passes. From 210 m two
  rocks come in a row. A hit costs 12 grip, a clean dodge counts towards your perfect streak
  (`ROCKFALL` in `src/systems/mechanics/Rockfall.js`).
- **Thermals** (Above the Clouds): sometimes one route carries a thermal (warm up-arrow on
  its card and next to its hold). Hit the orange up-note perfectly and the updraft lifts you
  3 m higher after the climb; any other hit is a normal climb (`THERMALS` in
  `src/systems/mechanics/Thermals.js`).
- **Darkness** (Obsidian Spires): the black glass swallows the light. Notes on the track are
  faint shapes that flash up on every beat (blind notes flash too) and the headlamp comes on
  (`DARKNESS` in `src/systems/mechanics/Darkness.js`).
- **Prism light** (Crystal Heights): while you decide, a beam of split light moves from route
  to route (1.1 s each, bouncing at the ends). Start a climb on the lit route and its hits cost
  no grip (misses still do) and a gem on it is worth double. Nothing is ever taken away
  (`PRISM_LIGHT` in `src/systems/mechanics/PrismLight.js`).
- **Storms** (Storm Crown): every 30-50 s a storm builds (a rumble and a toast), then rages for
  about 22 s. While it rages, hanging on a hold (not a ledge) drains grip 5x faster with no
  grace period; lightning strikes every few seconds (`STORM` in `src/systems/mechanics/Storm.js`).
- **Swing** (Aurora Ridge): straight one-beat gaps become long-short pairs (4/3 and 2/3 of a
  beat); held notes, rolls and off-beats keep their timing (`SWING` in
  `src/systems/mechanics/Swing.js`).
- **Dragon fire** (Dragon's Spine): the dragon sleeps 26-42 s, wakes over 4 s, then watches
  for about 24 s. While it watches the screen shakes, the play box sways and tilts, red
  lightning and thunder roll and it spits fireballs at the sky. 2.5 s after it wakes, and then
  every 5-8 s, the next hold you grab brings a fire breath: 1.5 s of inhaling (the throat
  glows), then the flames land on the beat; press the shown arrow to swing clear, or lose 14
  grip. Above 1950 m it breathes twice. A ledge is safe (`DRAGON_EYE` in
  `src/systems/mechanics/DragonEye.js`, the dragon itself in `src/world/Dragon.js`).
- **Every biome looks like its own place**: its own wall outline (`wall.edge`: ivy on the Green
  Rise, stepped granite blocks on the Stone Wall, icicles in the Frozen Reach, clinging cloud
  puffs above the clouds, sharp glass facets on the Obsidian Spires and the Storm Crown, crystal
  shards in the Crystal Heights, rime feathers on the Aurora Ridge, ivory spines on the Dragon's
  Spine), its own rock pattern (`wall.overlays`), its own props on the wall (pitons, nests,
  magma vents, chains, frost flowers, bones and gold), its own cloud-sea colour (`sea`) and its
  own life in the sky (cranes, bats, storm light, shooting stars, dragon smoke). Floating
  islands only drift above the clouds and among the crystals (`floaters`).
- **Whiteout** (Frozen Reach): now and then a blizzard rolls in, announced by a toast. During
  the storm the scene washes out and notes only appear shortly before the line (blind notes
  stay visible), but gems turn up twice as often. Wait it out on a ledge or climb through it
  (`WHITEOUT` in `src/systems/mechanics/Whiteout.js`).
- **Gems**: a route can carry a gem on its target hold (also shown on its route card). Take
  that route to grab it; the other routes' gems fade away. Risky routes carry gems most
  often. Every area has its own stone (emerald, amber, sapphire, cloud opal, ruby, diamond,
  storm topaz, tourmaline, dragon pearl),
  rarer and worth more the higher you go. Every 50 m of height, perfect-streak milestones
  and a new record add a few gems; Hard pays x1.5, Summit x2 (`GEM_INCOME` in `src/data/shop.js`).
- **The trader** stands at base camp (T, or tap them). GEAR: one-use items, pack up to 3;
  they are used up when you leave base camp at the start of a Normal run (chalk bag,
  energy bar, crampons, quickdraws, spare rope, lucky charm). PERKS: bought once, one active
  at a time (gem sense, iron grip, steady hands, streak saver). STYLE: buy clothes and chalk
  colours; some need a number of found regional gems first. Gear and perks only work in Normal.
- **Wardrobe**: in the pause menu, on the title screen and at the trader. It lists only what
  you own; the STYLE tab shows everything you can still earn or buy. Besides clothes and chalk
  there are **trails** (stardust, wildfire, pixel hearts, rainbow road…) left behind as you
  move and **hit effects** (star burst, lightning, gem shards…) for perfect hits. Every item has
  a rarity (common, rare, epic, legendary), new unlocks are tagged NEW, and a preview stage
  plays trails and hit effects live. At the trader, Bram talks back.
- **One slip per biome**: the first time you lose your grip in a biome you get the catch
  prompt as before (caught, or back to your last checkpoint). That uses up the biome's slip:
  the second slip in the same biome ends the run at once and you start again at 0 m. The HUD
  shows `1 SLIP LEFT` or `NO SLIPS LEFT` next to the biome name. Summit also ends the run on
  any fall.
- **Modes** (title screen): Normal, Hard (stricter timing, hungrier grip, no perfect refills,
  faster ramp) and Summit (Hard rules, and one fall ends the run). Each mode has its own record.

## Biomes

Everything that makes a part of the mountain different lives in its entry in
`src/data/biomes.js`: palette, timing and grip numbers, weather, music, wall overlays
(`src/render/wallOverlays.js`), decor swaps, rest ledges and viewpoint names, backdrop
layers and sky tint (`src/render/backdropArt.js`) and an optional mechanic
(`src/systems/mechanics/`). Adding or changing a biome should not need edits elsewhere.

## Bram's dares

**DARES** (chalked on the rock beside the climb at base camp) lets you pick up to two dares for
the next endless run: **Mirror Mountain** (every ← and → is shown the other way round),
**Endless Night** (the sun never rises), **Quick Hands** (the beat is 10% faster), **Light Pack**
(ledges only fill your grip to half) and **Blind Faith** (every note goes blind above 100 m).
Each dare multiplies the gems you earn by 1.25. A dared run keeps its own record per set of
dares and mode, never touches the mode records and is not sent to the leaderboard. Every dare
has a stamp for reaching 500 m with it on (`src/data/dares.js`).

## Look and feel settings

Five choices in Settings, so the feel can be tuned per player:
- **CHALK MARKS**: YOUR LINE (prints on used holds plus a dotted chalk line between them, so
  looking down shows the way you came), PRINTS (prints only) or OFF.
- **BEAT PULSE**: SUBTLE (the hold you are going for pulses on the beat, breath clouds come out
  on the beat in the cold), FULL (also a swell of the biome's motes and a one-pixel nod while
  hanging) or OFF. During a climb it follows the climb's own beat, otherwise the biome's tempo.
- **HIT-STOP**: SUBTLE, PUNCHY or OFF. Perfect hits hold the body still for a moment; streak
  milestones and perfect dodges freeze every tween and particle for a few frames (the clock and
  the notes keep running). PUNCHY holds longer, squashes harder and flashes the screen; a puff of
  dust comes off the boots on every ledge landing (`freezeFrame` in ClimbScene).
- **WEATHER ON YOU**: snow piles on the hat, shoulders and pack, storms and waterfalls darken
  and drip the jacket, dragon fire and the volcano leave soot, crystal dust glitters. On a ledge
  the climber shakes it all off (`src/entities/WeatherCoat.js`).
- **LEDGE LIFE**: LIVELY adds new idles after about 9 seconds on a ledge: a drink from the
  bottle, a look at the map, a wave, warm breath into the hands in the cold, pointing at the
  stars at night. CALM keeps the original fidgets.

## Codes

Settings > ENTER CODE (title screen or pause menu). Entering a code again switches it off.
- `GEMSTORM`: unlimited gems (and every regional-gem requirement counts as met), for testing the trader.
- `OPENBOOK`: turns every card in the collection face up (no gear, perks or gems are given, so
  it is not a cheat and runs still count for the leaderboard). On the save named MAARTEN it
  also restores the Normal record of 1867 m (already on the online board, so nothing is sent).
- `GRANDMASTER`: masters every biome at once (all three stars in each), which unlocks all nine
  mastery outfits. It is not switched off by entering it again.

## Controls

| Action | Keys |
| --- | --- |
| Choose route | ← → / A D / 1 2 3 / mouse |
| Start climb | ↑ / W / Space / Enter |
| Climb inputs | ← ↑ → / A W D, on the beat (keep held for hold notes) |
| At a ledge | R rest · V view · C photo · T trader (base camp) · Space climb |
| Trader / wardrobe | ↑ ↓ choose · ← → pack / change · Space buy / wear · Q E tabs · Esc leave |
| Pause | Esc / P (in fullscreen in Chrome and Edge a tap of Esc pauses; hold Esc to leave fullscreen) |
| Debug overlay | F3 or ` (then B cycles the autopilot) |

## Deploy

Every push to `main` runs the tests, builds the game and publishes it to GitHub Pages
(`.github/workflows/pages.yml`).

The GitHub Pages version is an installable app: on a phone, "Add to Home Screen" (Safari) or
"Install app" (Chrome); on a computer, the install icon in the address bar. It works offline.
Updates need no reinstall: the service worker (`public/sw.js`) always fetches the page from the
network first, so after a push the installed app picks up the new version the next time it is
opened online (offline it plays the last version it saw). Saves stay in the browser storage of
that site, so they carry over between versions.

## Shareable files (`npm run release`)

Written next to the project folder:
- `above-the-clouds.html`: one file to double-click on a computer. Swipe controls switch on automatically on touch screens.
- `above-the-clouds-mobile.html`: the same game with the swipe controls always on.
- `above-the-clouds-web.zip`: contains `index.html`, ready to upload to itch.io, Netlify or GitHub Pages.

On phones and tablets you swipe: anywhere on the screen, swipe left, up, right or down for
that arrow. The arrow counts from the moment your finger touched the screen, so swipe on the
beat. Keep the finger down for hold notes; two fingers swipe a double. Tap route cards and menu
items directly, and use the pause button at the top (`src/ui/TouchControls.js`).

Play upright or sideways. Upright the screen is narrower than the mountain (300 px instead of
480) and the camera follows the climber sideways; the menus have their own upright layout.
The layout is chosen when the game starts; turn the phone and a button offers to switch.

## Structure

- `src/config/` — `gameConfig.js` (resolution, depths), `balanceConfig.js` (all tuning)
- `src/systems/` — pure logic: `ComboSystem`, `GripSystem`, `SegmentGenerator`
  (`Mountain`), `ProgressionSystem`, `DayNightSystem`; plus Phaser-side `WeatherSystem`,
  `Effects`, and procedural `AudioSystem`
- `src/data/` — combo patterns, biomes, segment templates, cosmetics, gems, trader goods
  (`shop.js`), discoveries, audio manifest
- `src/render/` — procedural pixel art (climber poses, holds, decor, backgrounds, wall painter)
- `src/world/` — parallax `Background`, per-segment `WallRenderer`
- `src/entities/Climber.js`, `src/ui/*`, `src/scenes/*`

## Replacing assets

- Audio: add `{ key, url, gain? }` entries to `src/data/audioManifest.js` (import the
  file with `?inline` so the one-file builds stay one file). Several entries with one key
  are takes of the same sound; one is picked at random with a small pitch change. Keys
  with recordings: `grab`, `grab-ice`, `boot`, `boot-snow`, `pebble`, `rockfall`, `rockhit`,
  `slide`, `crystal` and a looping `wind`; any other key replaces the synth sound of that
  name. Missing or broken files keep the synth sound.
- Art: every texture is created under a fixed key in `src/render/textures.js`
  (e.g. `climber` with named frames, `hold_<biome>_<kind>_<hazard>`, `decor_*`, `bg_*`).
  Load a sheet under the same key to replace it.
