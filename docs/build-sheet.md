# Above the Clouds: build sheet 4
**Trail Boons · Flags · Daily Climb · Bram's Forecast** · 10 Nov 2026

This sheet is meant to be built from. It combines the boon design (v3), the sim results, and the plans for
flags of other climbers, the Daily Climb and Bram's forecast. Every number is a starting value; the
balance sim decides the final ones.

## Build order

| # | Milestone | Why this order | Needs you? |
|---|---|---|---|
| 1 | ✅ **Seeded runs**: Golden City roll from the seed, next seed saved (built 10 Nov) | Daily and forecast both depend on it | No |
| 2 | ✅ **Trail Boons v3** (built 10 Nov, see notes below) | The biggest gameplay change; Daily reuses its seeded offers | No |
| 3 | **Flags of other climbers** | Uses the existing board, no SQL change | No |
| 4 | **Daily Climb** | Needs 1 + 2 and a new table | **Yes: run the SQL in Supabase** |
| 5 | **Bram's forecast** | Needs 1; measure generation time first | No |

Each milestone ends with `npm test` passing and a check in the running game, before the next one starts.

---

## 1 · Seeded runs (foundation)

What the code does today:
- The mountain, gems and biome twists already come from the seed (`Mountain`, `BiomeMechanics`).
- The Golden City roll uses `Math.random()` (`src/systems/GoldenCity.js:23`), so it cannot be forecast or shared.
- The next run's seed lives only in `registry.nextSeed` (`MenuScene.js:48`). A page reload gives a new mountain.

Changes:
1. Golden City: roll once per biome stretch from `hashInts(seed, biomeStartLevel, GOLDEN_SALT)`, same 1-in-150 chance.
   The `GOLDENCITY` code still forces it.
2. Save `nextSeed` in the save data. It only moves on to a new seed once a run has really started
   (the climber has left base camp). Reloading at camp shows the same mountain. This stops "seed fishing".
3. Shrine placement and boon offers (section 2) also come from the seed, with their own salt.

Done when: the same seed gives the same Golden City biomes, shrines and offers in two runs (test), and a
reload at camp keeps the mountain.

---

## 2 · Trail Boons v3

**Built 10 Nov. Changes made while building:**
- IRON NERVE's price is now *no FLAWLESS bonus*: a GOOD already broke the streak in the game, so the old price cost nothing.
- QUICKSTEP is renamed STEADY PACE, and the NIGHT OWL synergy MOON SONG (both names were already logbook stamps).
- A souvenir's price is the twist itself; its gift is +50% gems.
- The balance sim now follows the game's real slip rule (a second slip in a biome ends the run, caught or not).
  The old `balanceSim.mjs` only counts *uncaught* falls, so its heights are about twice too high.
- Sim result, 1000 runs per gift: every gift lands between -5% and +9%, three-gift stacks at most +13%.


### Shrines
- **3 per run, one per band:** biome 2–3, biome 4–6, biome 7–9 (counted from the start biome on lift-ticket runs).
  The seed picks the biome in each band and the ledge in it.
- A shrine is a rest ledge with a cairn. The grip clock and notes wait while you choose 1 of 3.
  ← → Space, tap, mouse and gamepad; landscape and portrait.
- **Reroll:** once per shrine, flat gem price (start: an energy bar's price, tune with `--economy`).
- **Legendary:** 10% per offer, at most one gold card per offer.
- **Souvenir:** one of the three cards is always the shrine biome's own twist (see below).
- **Synergy pull:** holding one half of a pair doubles the other half's chance to be offered.
  Every card shows "PAIRS WITH …".

### The boons (every one has a cost)

| Boon | Group | Upside | Cost |
|---|---|---|---|
| DEEP BREATH | Grip | Ledges refill to 120 | Hang grace 1.5 s (was 3 s) |
| BRAM'S FLASK | Grip | ↓ on a hold: +30 grip, once per biome | Ledges refill to 90 |
| DRUMMER | Grip | Perfect off-beat note: +2 grip | Hold notes cost +2 grip *(tune, see sim)* |
| IRON NERVE | Grip | A GOOD costs halfway between good and perfect | A GOOD breaks your streak |
| ECHO | Rhythm | Perfects count double for the streak | A miss costs +2 grip *(tune, see sim)* |
| QUICKSTEP | Rhythm | Beat 5% slower | Ledges refill to 75 |
| SONGBIRD | Rhythm | A bird chirps the next arrow (high →, mid ↑, low ←) | Notes appear 30% later on the track |
| GAMBLER | Route | Risky routes cost 10% less grip (an expert's card, kept by choice) | No safe routes |
| MAGPIE | Route | A gem on every route | A fall loses 25% of this run's gems |
| CARTOGRAPHER | Route | See the next route offer while you choose | No hang grace at all |
| FEATHERWEIGHT | Route | +1 level on every 3rd climb in a row without a miss | Gusts ×1.5 as often |
| WARM LUNGS | Carry-over | Thermals in every biome at half chance | Missing the thermal note costs 4 grip |
| CAT'S EYES | Carry-over | Blind and faded notes stay at least 30% visible | Nights last twice as long |
| ICE FINGERS | Carry-over | Icy holds use the normal window and count double for the streak | Loose holds ×2.0 on a miss (was ×1.7) |
| SOUVENIR | Carry-over | This biome's twist follows you for the rest of the run | +50% gems each, up to 3 |
| ★ PHOENIX | Legendary | Your run-ending fall revives you on the last ledge at full grip, once | You lose all your other boons |
| ★ SECOND ROPE | Legendary | One extra slip in each band | Gems ×0.75 |
| ★ WILD ROUTE | Legendary | A 4th route with another biome's twist, worth double height | Misses on it cost double |

ECHO's streak doubling never counts for cosmetic unlocks or mastery stars: those use the real streak.

### Synergies

| Pair | Name | Effect |
|---|---|---|
| ECHO + MAGPIE | Hoard Song | Every 10-streak drops a gem |
| GAMBLER + MAGPIE | High Roller | Gems on risky routes are worth double |
| WARM LUNGS + FEATHERWEIGHT | Tailwind | A thermal climb counts twice toward the 3-in-a-row |
| CAT'S EYES + SONGBIRD | Night Owl | At night, Songbird's cost goes away |
| BRAM'S FLASK + DEEP BREATH | Second Wind | The flask refills to 120 |

### Rules
- **Normal endless runs only.** Off in Hard, Summit, dared runs and expeditions. Daily: on (seeded, see 4).
- Perks and gear still work. When two effects change the same number, the stronger one wins (no multiplying).
  Streak Saver protects the real streak.
- Boon runs count for the Normal record and the board, with a small shrine icon on the board and in the run summary.
- Run summary: boons, synergies and souvenirs in one shareable line.
- Collection: a Boons chapter (a card turns over the first time you pick it) and 5 stamps:
  *First Pact*, *Hold a Synergy*, *Rise from the Ashes* (PHOENIX saves you), *Three Souvenirs*, *1000 m as a GAMBLER*.
- Bram's tip at the first shrine: "A SHRINE! TAKE A GIFT. EVERY GIFT HAS A PRICE."
- Effects go through hooks in `src/systems/mechanics/` and one lookup helper; boon data in `src/data/boons.js`.

### Balance gate (`tests/balanceSim.mjs --boons`)
Sim, one boon held from the first shrine, 300 runs per player type, Normal. Best height vs no boons:

| Boon (v3 numbers) | Expert | Good | Average | Novice | Status |
|---|---|---|---|---|---|
| *Baseline* | 1619 m | 675 m | 284 m | 60 m | |
| DEEP BREATH | +5% | +1% | +5% | +4% | ✅ |
| BRAM'S FLASK | 0% | +1% | 0% | −4% | ✅ (worth more to real players who save it for a crisis) |
| IRON NERVE | +8% | +2% | +7% | +7% | ✅ |
| QUICKSTEP | −2% | +2% | +4% | +11% | ✅ |
| SONGBIRD | +6% | +6% | +4% | +8% | ✅ |
| CAT'S EYES | +6% | +4% | +3% | +2% | ✅ |
| FEATHERWEIGHT | +10% | +2% | +5% | −2% | ✅ expert card |
| WARM LUNGS | +1% | 0% | +1% | +1% | ✅ |
| ICE FINGERS | 0% | +1% | +3% | +3% | ✅ |
| CARTOGRAPHER | −1% | +1% | −1% | +1% | ✅ (sim can't see its upside) |
| SECOND ROPE ★ | +1% | +6% | +6% | +6% | ⚠️ weak for a legendary; try 2 slips per band |
| PHOENIX ★ | +1% | +6% | +9% | +7% | ✅ |
| GAMBLER (10% off) | **+18%** | −6% | −14% | −2% | ✅ kept at 10% by choice: the expert's card |
| DRUMMER (old cost) | −6% | −8% | −15% | −3% | ⚠️ sheet now has the new cost; re-check |
| ECHO (+3 on a miss) | −6% | −7% | −12% | −6% | ⚠️ sheet now says +2; streak refills not in sim |
| 3-boon stack (IRON NERVE + FLASK + ROPE) | +8% | +9% | +13% | +11% | ✅ no runaway |

Gate for the build: no single boon above **+15%** for any player type, and no common boon below **−8%** for the
average player. Not modelled yet: streak refills, nights, the 2nd and 3rd shrines, how players choose between cards.
The SONGBIRD and QUICKSTEP effects in the sim are estimates.

---

## 3 · Flags of other climbers

The live board (10 Nov) has **10 Normal players** (770 m to 2356 m), 4 Hard, 8 Summit. A top-5 idea would show
nothing to most players: the top 5 are all above 1286 m.

- **Show everyone's flag** for the current mode: a small coloured flag with name and height on the wall.
  Above 25 players: the 3 climbers just above your best, plus the #1.
- **Passing:** toast `YOU PASSED PIM · 918 M` and a short music sting. Passing the #1 sets off the record fanfare.
- Your own flag stays the existing gold record marker.
- Load the board once at base camp (`fetchTop` with a higher limit). Offline: no flags, no errors.
- Flags fade as you pass them, like the record marker.
- Settings: **OTHER CLIMBERS: FLAGS / OFF** (also a way to hide an unwanted name).
- No flags in expeditions or dared runs.

Done when: with the board loaded, flags show at the right heights; passing one shows the toast once; offline shows none.

---

## 4 · Daily Climb

- **Same mountain for everyone each day.** Seed = hash of the date in **Europe/Amsterdam**; the day turns at midnight there.
- **3 tries a day; the best one counts.** Share line: `Daily 10 Nov · 412 m · ▂▅█ · GAMBLER MAGPIE ECHO`.
- **Fair loadout:** no perks, no gear, no lift tickets. Boons on, from the seed, so everyone gets the same shrines and offers.
- Normal rules otherwise (one slip per biome).
- **Daily flags:** everyone climbed the same wall, so a flag marks the exact hold where a friend's best try ended
  (a torn flag). These are the strongest flags in the game.
- **Where:** a pinned note on Bram's dare board, or its own item at base camp. Shows today's date, your tries left and your best.
- Gems: a small fixed reward for the first try each day (anti-farming: later tries pay no gems).
- Daily stamps: *First Daily*, *7 Dailies in a row*, *Beat everyone on a Daily*.

### New table (you run this once in the Supabase SQL editor)
```sql
create table if not exists public.daily_scores (
  player_id uuid not null,
  day date not null,
  name text not null check (char_length(name) between 1 and 12),
  height real not null check (height >= 0 and height <= 5000),
  tries smallint not null default 1 check (tries between 1 and 3),
  boons text[] not null default '{}',
  fell_at real,
  updated_at timestamptz not null default now(),
  primary key (player_id, day)
);
create index if not exists daily_day_height on public.daily_scores (day, height desc);
-- Same "only ever goes up" trigger and open policies as public.scores.
```
Cheating: anyone with the public key can write any height (same as today's board). Fine among friends; worth a
server-side check later if the board grows.

Done when: two saves on the same day get the same mountain, shrines and offers; a 4th try is refused;
the score, boons and fall height reach the table; the share line copies.

---

## 5 · Bram's forecast

One true line from Bram under the logo at base camp. **He never lies**, so he only talks about what the seed fixes:
- gem clusters per biome, the biggest gap between ledges, which biome holds a shrine, and the Golden City
  (on the Daily only, so nobody can fish for it).
- Storms, rockfall and dragon timing depend on time, not the seed: he never forecasts those.
- **He talks about the biome just past your best:** "PAST YOUR RECORD, THE FROZEN REACH HIDES THREE SAPPHIRES."
- **Before building, measure** how long generating the next 2 or 3 biomes takes at camp. If it stalls the title
  screen, generate in small steps over a few frames.

Done when: every forecast line comes true in a test that climbs the same seed; the title screen does not stall.

---

## Open decisions
- Where the Daily lives at base camp: Bram's dare board or its own spot.
- Daily gem reward size.
- SECOND ROPE strength after re-checking.
- Whether boon runs get their own board later if the Normal record jumps too much.
