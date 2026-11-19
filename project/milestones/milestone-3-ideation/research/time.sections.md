<!-- idea:3 -->
## Idea 3: Timed turns

### Summary
The owner asked for a setup setting: no timer, 1 min, 5 min, 10 min, 30 min or 1 h. A player has that long to press End Turn before their orders are submitted for them.

### Findings
- **Online games always settle a missed deadline in one of three ways.** They use the orders the player saved, they hold every unit, or they hand the player to an AI. Players who miss repeatedly are removed.
- **webDiplomacy.**
  - Live games have 5 to 30 minute phases ([webDiplomacy FAQ](https://webdiplomacy.net/faq.php)).
  - A phase ends early once every player has marked orders "ready" (same FAQ).
  - An "excused missed turn" resets the phase clock once. A player with no excuses left is removed ([webDiplomacy forum](https://webdiplomacy.net/contrib/phpBB3/viewtopic.php?p=459857)).
  - Saved orders are processed at the deadline, and units without orders hold (from recall, unverified).
- **Polytopia** Live games skip a timed-out player's turn and kick after three skips. Unused time rolls over to the next turn ([Polytopia dev tracker](https://devtrackers.gg/polytopia/p/3c0ff875-time-for-esports-2-0)).
- **Supremacy 1914** lets the AI take over after 3 days of inactivity ([Supremacy guide](https://www.yekbot.com/supremacy-1914-diplomacy-guide/)).
- **Chess clocks** add an increment (Fischer) or a capped delay (Bronstein). These amount to a time bank ([Wikipedia, Time control](https://en.wikipedia.org/wiki/Time_control)).
- **Frozen Synapse 2** makes a planning time limit an optional mode modifier ([Wikipedia](https://en.wikipedia.org/wiki/Frozen_Synapse_2)).
- **Combat Mission WEGO** has no documented timer. A forum proposal suggests about 3 minutes per orders phase ([Battlefront forum](https://community.battlefront.com/topic/123151-time-limit-for-turn-based-multiplayer-games/)).
- **Gaps.** No sources were found for Backstabbr, Neptune's Pride, or Civilization's behaviour on expiry.

**Shared PC: the clocks add up.** Players plan one after another, so a turn takes the sum of the human clocks plus the handoffs. With three humans on 10 minutes, a turn can run past 30 minutes. 30 min and 1 h only make sense online, where the clocks run in parallel (plan.md section 13.3).

**The handoff screen shows no map**, so stopping the clock there costs nothing.

**How long a turn takes is an estimate.** The Republic commands 15 armies. At an assumed 15 to 25 seconds per order, that is about 4 to 6 minutes to plan. 1 minute is therefore a blitz mode in which most armies hold. This is an assumption, not a measurement.

### Fit with today's engine
- **No engine or ruleset change.** `resolveTurn` never sees time, and replays stay deterministic.
- **Setup and state.**
  - `SetupScreen.tsx` gains a "Turn timer" select under the faction grid.
  - The `setup` session and `GameRecord` (`state/session.ts`) gain `turnTimer: { kind: "off" } | { kind: "timed", seconds }`.
  - The `planning` session gains a deadline, or the remaining time when paused.
- **Keep the reducer pure.** `beginPlanning`, `startGame` and `startNextTurn` take `now` through prepare callbacks, as `startGame` already does for the seed. A one-human game goes straight to planning.
- **Expiry.** A hook or middleware sets a timeout and dispatches `turnTimeExpired({ now })`.
  - The reducer runs the existing `endTurn` path: `lockSubmission(draft.orders)`, then `advance` in `state/coordinator.ts`.
  - A half-built order (`draft.stage`) is dropped. Armies without orders hold (T3).
  - When the last local player times out, the turn resolves at once (T1).
- **Computer players** have no clock.
- **Report.** `GameRecord` records which factions timed out, so the turn results can say so.
- **Tests.** Vitest fake timers for the hook. Explicit `now` values for the reducer.

### Options
| Option | What it is | Tradeoffs | Complexity | Genericity |
|---|---|---|---|---|
| A. Planning clock, submit the draft | Each human's clock runs only on their own planning screen. On expiry, the planned orders lock and the other armies hold. | Reuses End Turn. Matches "autosubmitted". A slow player's plan is cut short. | Low | Scenario-agnostic |
| B. Planning clock, hold everything | On expiry the draft is discarded and every army holds (Diplomacy no-orders style). | Clear but harsh. Throws away work while the player is sitting at the PC. | Low | Scenario-agnostic |
| C. Time bank (chess clock) | Unused time carries over, plus an increment each turn (Fischer, Polytopia). | Fairer over a long game. Needs more state and UI, and a concept players must learn. | Med | Scenario-agnostic |
| D. Computer takes over | On expiry the computer player plans the armies that have no orders. | No army sits idle. Surprising, and it has to merge a computer plan into a partial draft. Fits online inactivity better. | Med | Scenario-agnostic |

**Recommendation:** Option A, with a full-screen Pause that keeps the same clock.
- **Values.** Ship Off, 1, 5 and 10 min now. Show 30 min and 1 h disabled as "online play (coming later)", the way the Online Player option is shown today.
- **Timeouts are public.** Report them in the turn results.

### Widget
<!-- widget:timer-sim -->
Simulates one turn on a shared PC. Choose the timer, the number of humans and computer players, the handoff time, and the timeout policy. The output shows when each clock runs out and how many orders each player submits. Army counts are the Spain scenario's (15, 12 and 8). The seconds per order is an assumed input.

### Mockup
<!-- mockup:setup-timer -->

### Questions
<!-- questions:3 -->

<!-- idea:12 -->
## Idea 12: Weather

### Summary
The owner asked for a weather roll every two-week turn, affecting movement and attack, with odds that change with the month and season. This applies only if weather mattered strategically in Spain.

### Findings
Weather did matter in Spain, moderately and mostly in winter.

**Battles where weather was decisive or delaying:**
- **Guadalajara (March 1937).** Fog and sleet cut visibility to 100 m. Italian aircraft were "grounded on water-logged airports" while the Republican Albacete field "had a concrete strip". Roatta's motorised units "got stuck" in the mud under strafing fighters. Thomas is cited as saying the Italians "had not taken the weather into account at all" ([Wikipedia, Guadalajara](https://en.wikipedia.org/wiki/Battle_of_Guadalajara)).
- **Teruel (December 1937 to February 1938).** It was fought in "the worst Spanish winter in 20 years". A four-day blizzard dropped about 120 cm of snow at about -18 C. "The fighting ground to a halt as guns and machines froze", and Nationalist advances stalled until the weather improved on 17 January ([Wikipedia, Teruel](https://en.wikipedia.org/wiki/Battle_of_Teruel)).
- **Catalonia offensive (December 1938).** It was postponed from 10 to 23 December, partly because of weather and floods ([Wikipedia, Catalonia Offensive](https://www.wikipedia.com/wiki/Fall_of_Catalonia); [Spectator, 1938](https://archive.spectator.co.uk/article/23rd-december-1938/1/plots-in-spain-general-francos-offensive-intended-)).
- **Ebro (summer 1938).** Heat reached 37 C on 4 August and worsened water shortages. The bridge floods came from dams Franco deliberately opened, not from weather ([Wikipedia, Ebro](https://en.wikipedia.org/wiki/Battle_of_the_Ebro)).
- **Counter-evidence.** The Army of Africa advanced fastest in August 1936 (from recall, unverified), so heat should be mild.

**Climates differ sharply across Spain** ([Climate of Spain](https://en.wikipedia.org/wiki/Climate_of_Spain)):
- Santander has 13.3 rain days in November ([Wikipedia](https://en.wikipedia.org/wiki/Santander,_Spain)).
- Madrid has 1.5 rain days in July and 5.0 frost days in January ([Climate of Madrid](https://en.wikipedia.org/wiki/Climate_of_Madrid)).
- Teruel has 10.5 snow days a year and a January mean low of -2.2 C ([Wikipedia](https://en.wikipedia.org/wiki/Teruel)).
- Seville has 0.1 rain days in July and a mean high of 36.3 C ([Wikipedia](https://en.wikipedia.org/wiki/Seville)).
- Valencia peaks at 5.2 rain days in September ([Wikipedia](https://en.wikipedia.org/wiki/Valencia)).

One weather roll for all of Spain would therefore look wrong.

**Game precedents:**
- **Chadwick's ETO series** rolls each turn on a table indexed by month and theatre. Mud cuts movement to one hex per step and grounds air transport ([Watchword](https://www.watchword.biz/post/so-much-for-the-weather)).
- **Spanish Civil War games** use either a winter rule (Arriba Espana 9.1.5, [rulespal](https://rulespal.com/arriba-espana/rulebook)) or a quarterly weather table (Pasaran, [rulespal](https://rulespal.com/pasaran-the-spanish-civil-war/rulebook)).
- **A warning.** A reviewer of a West Front Spanish Civil War scenario found that mud made attacking "just impossible" ([grognard.com](https://www.grognard.com/reviews1/westfscw.doc)).
- **Gaps.** The Paths of Glory, HOI4 and Unity of Command II fetches failed. Their rules are known from recall only (unverified).

**Calendar.** Turn n starts on 31 July 1936 + 14(n-1) days. A turn's month is its midpoint's month.
- Turn 8 is mid-November 1936.
- Guadalajara falls in turns 16 and 17.
- Teruel falls in turns 36 to 41.
- The Ebro falls in turns 52 to 60.
- Turn 70 ends the war in April 1939.
- The soak test's 30 turns cover only one winter.

### Fit with today's engine
**Scenario schema.**
- `calendar: { start, turnDays }`.
- `weather.outcomes[]` with `{ id, name, attack, noDiggingIn }`.
- `weather.zones[]`.
- `weather.tables[zone]`: 12 monthly maps of whole-number weights. Weights, not dice faces, so the tables do not depend on idea 9.
- `territories[].weatherZone`.
- New loader rules: every territory has a zone, every zone has 12 months, and the weights are positive.
- Weather needs a new ruleset id (mismatch d).

**State and rolling.**
- `GameState.weather` is rolled in `initialGameState`, and again at the end of `resolveTurn` for the next turn. So it is known while planning.
- The roll has its own `deriveSeed` stream tag, next to `battleStreamTag`.

**Rules.**
- M26 gains a step 0.
- M14 gains a named weather modifier that appears in the battle breakdowns.
- M22 gains no digging-in in snow or severe cold.
- Territory battles (M17-M19) and standing battles (M27) use the territory's zone.
- Head-on battles (M20) use the worse of the two zones.

**Planning.** `estimateAttack` and the computer player must include weather. The odds-consistency test enforces this.

**Movement has nothing to attach to yet.** Every move is one connection (M2), so movement cost waits for idea 6, and grounded aircraft wait for idea 8.

**UI.**
- A weather badge for each zone.
- Turn dates on the turn label, which changes B15.

**Balance risk.** Penalties that fall only on attackers raise the 58 percent freeze rate. The effects must be gated by a harness metric (idea 11) over 60 to 70 turns (Q-TEN-4).

### Options
| Option | What it is | Tradeoffs | Complexity | Genericity |
|---|---|---|---|---|
| A. Seasonal tables for each zone, rolled each turn | Four climate zones, each with 12 monthly weight tables. Each turn's weather is rolled before planning and shown. It modifies the attack roll and blocks digging in. | Matches the owner's request and the history. Needs a calendar, a new ruleset, and harness tuning. | Med | High: zones, tables and calendar are all data |
| B. One roll for the whole country | One monthly table and one roll for all of Spain. | Simpler, with one badge. But Seville snow or Valencia mud next to a clear north looks wrong. | Low-Med | High |
| C. Fixed seasonal rule, no roll | For example, Meseta and Cantabrian attacks -1 from December to February (Arriba Espana style). | Deterministic and cheapest. Loses the roll and the monthly odds the owner asked for. | Low | Medium |
| D. Defer | Wait for movement points (idea 6) and aircraft (idea 8), since most historical weather effects act through them. | No balance risk now, but the owner's idea waits. | None | n/a |

**Recommendation:** Option A, with the soft effect set (Mud -1, Snow -1, Severe cold -2, no digging-in in snow or cold).
- Air and movement effects stay as dormant hooks for ideas 8 and 6.
- Under the soft set, Hot and Rain are display-only until then: a badge and a forecast, with no rule effect.
- Weather ships only once a harness run shows the freeze rate has not risen.

### Widget
<!-- widget:weather-months -->
Choose a month and a zone to see the weather odds, the effects, and the expected chance that a 2:1 attack takes its target. The weights are illustrative, derived from AEMET 1991-2020 normals (Santander, Madrid and Teruel, Valencia, Seville). The chance uses the shipped d6 table; each modifier also shows its d20 equivalent (three times larger), the scale weather would use once idea 9 lands.

### Mockup
<!-- mockup:weather-badge -->

### Questions
<!-- questions:12 -->

<!-- sources -->
- [webDiplomacy FAQ](https://webdiplomacy.net/faq.php)
- [webDiplomacy forum: excused missed turns](https://webdiplomacy.net/contrib/phpBB3/viewtopic.php?p=459857)
- [webDiplomacy forum: excused missed turns inefficient](https://webdiplomacy.net/contrib/phpBB3/viewtopic.php?p=88724)
- [vDiplomacy features](https://vdiplomacy.net/features.php)
- [Diplomacy house rules](https://mainecav.org/diplomacy/gthr.html)
- [Supremacy 1914 diplomacy guide](https://www.yekbot.com/supremacy-1914-diplomacy-guide/)
- [Call of War forum: inactivity](https://www.playsupremacy.com/en/forums/call-of-war-1942/call-of-war-1942-questions-and-answers/how-long-until-a-player-goes-inactive-eb521b59)
- [Polytopia dev tracker: Live games](https://devtrackers.gg/polytopia/p/3c0ff875-time-for-esports-2-0)
- [Polytopia dev tracker: update 2.3.4](https://devtrackers.gg/polytopia/p/fdbb945e-beta-update-2-3-4-9667)
- [Wikipedia: Time control](https://en.wikipedia.org/wiki/Time_control)
- [Steam: Civilization VI dynamic timer discussion](https://steamcommunity.com/app/289070/discussions/0/6620894968767840714)
- [Wikipedia: Frozen Synapse 2](https://en.wikipedia.org/wiki/Frozen_Synapse_2)
- [GameGrin: Frozen Synapse 2 review](https://www.gamegrin.com/reviews/frozen-synapse-2-review/)
- [Battlefront forum: time limit for turn-based multiplayer](https://community.battlefront.com/topic/123151-time-limit-for-turn-based-multiplayer-games/)
- [Wikipedia: Battle of Guadalajara](https://en.wikipedia.org/wiki/Battle_of_Guadalajara)
- [Wikipedia: Battle of Teruel](https://en.wikipedia.org/wiki/Battle_of_Teruel)
- [Wikipedia: Battle of the Ebro](https://en.wikipedia.org/wiki/Battle_of_the_Ebro)
- [Wikipedia: Catalonia Offensive](https://www.wikipedia.com/wiki/Fall_of_Catalonia)
- [The Spectator, 23 December 1938](https://archive.spectator.co.uk/article/23rd-december-1938/1/plots-in-spain-general-francos-offensive-intended-)
- [Wikipedia: Climate of Spain](https://en.wikipedia.org/wiki/Climate_of_Spain)
- [Wikipedia: Climate of Madrid](https://en.wikipedia.org/wiki/Climate_of_Madrid)
- [Wikipedia: Santander, Spain](https://en.wikipedia.org/wiki/Santander,_Spain)
- [Wikipedia: Teruel](https://en.wikipedia.org/wiki/Teruel)
- [Wikipedia: Valencia](https://en.wikipedia.org/wiki/Valencia)
- [Wikipedia: Seville](https://en.wikipedia.org/wiki/Seville)
- [Watchword: So much for the weather (ETO series)](https://www.watchword.biz/post/so-much-for-the-weather)
- [Unity of Command II manual](https://cdn.steamstatic.com/steam/apps/809230/manuals/Manual_-_Unity_of_Command_II_-_Revision_8.pdf)
- [OpenPanzer manual](https://nicupavel.github.io/openpanzer-manual)
- [Slitherine forum: weather effects](https://forum.slitherine.com/viewtopic.php?p=454422)
- [rulespal: Arriba Espana rulebook](https://rulespal.com/arriba-espana/rulebook)
- [rulespal: Crusade and Revolution rulebook](https://rulespal.com/crusade-and-revolution/rulebook)
- [rulespal: Pasaran rulebook](https://rulespal.com/pasaran-the-spanish-civil-war/rulebook)
- [grognard.com: West Front II Spanish Civil War review](https://www.grognard.com/reviews1/westfscw.doc)
