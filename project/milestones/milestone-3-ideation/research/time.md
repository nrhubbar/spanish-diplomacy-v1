# Cluster `time`: research notes for idea 3 (timed turns) and idea 12 (weather)

Raw notes. Every claim carries a URL or is tagged "(from recall, unverified)". Web access worked. I made about 31 web calls (searches plus fetches), slightly over the 25-30 cap. Five targets failed or found nothing; they are listed under "Gaps" below.

## 0. Assumptions

- **A-TIME-1.** A turn is two weeks. This comes from the owner's statement. No turn length exists anywhere in the data today: `scenario.json` has only `snapshotLabel` ("31 July 1936"), and `turnLabel` (`src/main/presentation/turn.ts`) shows the date on turn 1 only (rule B15). Revision 5 listed "Calendar and turn dates, weather" as out of scope (`project/milestones/milestone-2-rev-5.md`, line 408).
- **A-TIME-2.** The timer is a game setting chosen on the setup screen. It is not scenario data, so `scenario.json` is untouched.
- **A-TIME-3.** "Autosubmitted" means the timer does what pressing End Turn would do. The orders already planned in the draft (`draft.orders`) are locked, and every other army holds (it entrenches or rests, as under T3). A half-built order, such as an army selected with no destination yet, is discarded.
- **A-TIME-4.** On a shared PC the clock runs only while that player is on the planning screen. It starts when they press "Continue to X" on the handoff screen. It does not run on the handoff, resolution or setup screens.
- **A-TIME-5.** Computer players have no clock. They submit instantly, as they do today (`advance` in `src/main/state/coordinator.ts`).
- **A-TIME-6.** The weather tables below are illustrative. They are derived from modern AEMET normals (1991-2020; Santander 1981-2010), not 1936-39 observations. They will need tuning against the balance harness (idea 11).
- **A-TIME-7.** Weather uses four climate zones over the 18 territories (mapping in section 2.5).
- **A-TIME-8.** A turn's month is the month of its midpoint, its start date plus 7 days.
- **A-TIME-9.** Weather is rolled at the start of each turn, before planning, and is visible to every player. It is a planning input, not a surprise.

## 1. Idea 3: timed turns

### 1.1 What the code does today

- **Setup** (`src/main/screens/SetupScreen.tsx`). One card per faction with an actor select: Local Player, Computer Player, or "Online Player (coming later)", which is disabled. Then "Start Campaign". There is no game-wide settings row yet. A timer select would sit under the faction grid, above the action row.
- **Session** (`src/main/state/session.ts`). The phases are `idle`, `setup`, `handoff`, `planning`, `resolution` and `game-over`.
  - `GameRecord` holds `assignments`, `history`, `locked`, `scenarioId`, `seed` and `state`.
  - `Draft.orders` is the list of valid, completed move orders. `Draft.stage` is a half-built order.
- **Coordinator** (`advance`). It walks the factions in order. A local human goes to the handoff screen when there is more than one local human, and straight to planning otherwise. A computer player is generated and locked at once. When everyone is locked, the turn resolves immediately (T1, `milestone-2-rev-6-tasks.md` section 1.3). The handoff screen keeps orders private.
- **`endTurn`** locks `draft.orders` through `lockSubmission`, which validates them, and calls `advance`. A timeout can reuse exactly this path.
- **Reducer purity.** `startGame` creates the seed outside the reducer, in the action's prepare callback. A timer must do the same with time: the action carries `now`, and the reducer never calls `Date.now()`.
- **Army counts** (Spain scenario). Republic 15, Northern 12, Southern 8. Default actors: Republic is a local human; Northern and Southern are computer players.

### 1.2 Precedents (what happens on timeout)

- **webDiplomacy.**
  - Live games use phase lengths of 5 to 30 minutes, and slower games last days ([webDiplomacy FAQ](https://webdiplomacy.net/faq.php)).
  - Orders can be "saved", which means remembered and still changeable, or "ready". When every player is ready, the phase processes early, regardless of the deadline (same FAQ).
  - A game setting sets how many phases a player can miss before they are removed (same FAQ).
  - Each game allows 0 to 4 "excused missed turns". When the deadline passes with a player missing orders, the phase time resets and that player loses one excuse. With none left, the player is removed and the country is opened for takeover ([webDiplomacy forum](https://webdiplomacy.net/contrib/phpBB3/viewtopic.php?p=459857), [forum thread on excused turns](https://webdiplomacy.net/contrib/phpBB3/viewtopic.php?p=88724)).
  - Saved but unreadied orders are processed at the deadline, and units with no orders hold (from recall, unverified).
- **vDiplomacy.** A country that fails to submit goes into civil disorder, and the phase is extended so a replacement can be found ([vDiplomacy features](https://vdiplomacy.net/features.php)).
- **Classic Diplomacy house rules.** A missed-order turn (NMR) in a retreat phase disbands the unit, and an NMR in a build phase waives the builds ([Diplomacy house rules](https://mainecav.org/diplomacy/gthr.html)). In movement phases, units with no orders hold (from recall, unverified).
- **Backstabbr.** Search failed (no relevant result). Units without orders hold at the deadline (from recall, unverified).
- **Supremacy 1914 and Call of War.** These run in real time, with a daily "day change".
  - Supremacy 1914: after 3 days of inactivity the AI takes over until the player returns ([Supremacy guide](https://www.yekbot.com/supremacy-1914-diplomacy-guide/)).
  - Call of War: a player is inactive after about two day changes without orders, and production queue orders do not count as activity ([Call of War forum](https://www.playsupremacy.com/en/forums/call-of-war-1942/call-of-war-1942-questions-and-answers/how-long-until-a-player-goes-inactive-eb521b59)).
- **Polytopia.**
  - In Live games, a player who runs out of time has their turn skipped. Three skips and they are kicked, and unused time rolls over to the next turn. Live games replaced an older 5-minute timer option ([Polytopia dev tracker](https://devtrackers.gg/polytopia/p/3c0ff875-time-for-esports-2-0)).
  - Normal games later got a 7-day timer ([Polytopia dev tracker, update](https://devtrackers.gg/polytopia/p/fdbb945e-beta-update-2-3-4-9667)).
- **Chess clocks** ([Wikipedia, Time control](https://en.wikipedia.org/wiki/Time_control)).
  - Sudden death: one budget for the whole game.
  - Fischer increment: time is added after each move.
  - Bronstein delay: time is added back, but never more than the time used.
  - Byo-yomi: a fixed-length period per move, reset each move.
  - Running out normally loses the game.
  - The useful idea for us is a bank: unused time carrying over.
- **Civilization VI.** It has "dynamic" turn timers that players find hectic later in the game ([Steam discussion](https://steamcommunity.com/app/289070/discussions/0/6620894968767840714)). I found no official source for what happens when the timer expires. In simultaneous mode the turn ends for everyone (from recall, unverified).
- **Frozen Synapse.** The Frozen Synapse 2 modes include a toggle for a planning time limit ([Wikipedia, Frozen Synapse 2](https://en.wikipedia.org/wiki/Frozen_Synapse_2)). Without it, planning is untimed ([GameGrin review](https://www.gamegrin.com/reviews/frozen-synapse-2-review/)).
- **Combat Mission WEGO.** I found no built-in timer. A forum proposal suggested about 3 minutes per orders phase, with the action starting once both sides submit or time runs out ([Battlefront forum](https://community.battlefront.com/topic/123151-time-limit-for-turn-based-multiplayer-games/)).
- **Neptune's Pride.** Search failed (no relevant result). Its turn-based mode has a turn deadline, and a player who misses enough turns is marked AFK and handed to the AI (from recall, unverified).

**Pattern.** Every precedent that resolves on a timeout does one of three things with a missing player's orders:
- (a) uses what they saved;
- (b) holds everything;
- (c) hands them to an AI.

Repeated misses lead to removal. Short live timers (5 to 30 minutes) are for players at the same time; long ones (hours to days) are for async play.

### 1.3 Shared-PC specifics

- **Planning is sequential.** On one device the humans plan one after another, so a turn's wall time is the sum of their planning times plus the handoffs. With a 10-minute timer and three humans, a turn can take 30 minutes or more. In online play the clocks run in parallel, so a turn's wall time is the longest single clock.
  - So 30 min and 1 h make sense only once online play exists (plan.md section 13.3, Phase 10). 1 h on a shared PC with three humans can mean a 3-hour turn.
- **The handoff screen** shows no map, so time spent there cannot be used to plan. Keeping the clock off during handoff costs nothing. The risk is a player waiting on the handoff to think. An optional cap could start the clock automatically after N seconds on the handoff; I list it as an option but do not recommend it.
- **Turn 1** includes the in-map Briefing (`BriefingView`), so a 1-minute clock on turn 1 is harsh. Whether turn 1 gets extra time is a real design question.
- **Army counts.** At an assumed 15 to 25 seconds per army order, the Republic's 15 armies need about 4 to 6 minutes. That makes 1 minute a "blitz" mode in which most armies hold. This is an assumption, not measured.
- **Pause.** A pause that leaves the map visible is a free extension. A pause should cover the screen, as the handoff does, and resume the same clock.

### 1.4 Engine fit

- **Session and record.** The setup session gains `turnTimer: { kind: "off" } | { kind: "timed", seconds: 60 | 300 | 600 | 1800 | 3600 }`, and it is copied into `GameRecord`.
- **Planning session.** It gains `clock: { deadline: number } | { paused: true, remainingMs: number }`.
  - `beginPlanning`, `startGame` and `startNextTurn` receive `now` through prepare callbacks. A one-human game goes straight to planning with no `beginPlanning`.
- **Expiry.** A new action, `turnTimeExpired({ now })`, is dispatched by a small hook or middleware that sets a timeout at the deadline.
  - The reducer checks `phase === "planning" && now >= deadline`.
  - It then runs exactly the `endTurn` path: `lockSubmission(draft.orders)` and then `advance`. When the last local player expires, the turn resolves at once (T1). Privacy holds, because `advance` routes to the handoff screen.
- **Report.** The record notes which factions timed out (`timedOut: FactionId[]`), so the turn report can say "Republic's time ran out: 9 orders submitted, 6 armies held".
- **Engine untouched.** No engine change and no new ruleset are needed: `resolveTurn` never sees time. Replays stay deterministic, because only the orders matter.
- **Tests.** Vitest fake timers cover the hook. The reducer is tested with explicit `now` values. Playwright's clock API covers end-to-end runs (from recall, unverified).
- **Genericity.** High. The feature is scenario-agnostic.

## 2. Idea 12: weather

### 2.1 Was weather strategically important in Spain? History

- **Guadalajara (8-23 March 1937).** This is the strongest case.
  - On 8 March, fog and sleet cut visibility to 100 m.
  - By 12 March the Italian aircraft were "grounded on water-logged airports", while the Republican Albacete airfield "had a concrete strip". Roatta's motorised units "got stuck and were easy target for strafing fighters".
  - On 18 March, sleet covered the Republican assault but also delayed it, and the Republican air force flew after midday.
  - Hugh Thomas is cited as saying the Italians "had not taken the weather into account at all". Preston is cited on troops poorly prepared for snow and sleet ([Wikipedia, Battle of Guadalajara](https://en.wikipedia.org/wiki/Battle_of_Guadalajara)).
  - Some accounts also credit Soviet armour superiority, so weather was one factor, not the only one (search summary of the same sources).
- **Teruel (15 December 1937 to 22 February 1938).**
  - It was fought "during the worst Spanish winter in 20 years". Teruel usually has the lowest winter temperature in Spain.
  - Snow fell on 15 December. A four-day blizzard from New Year's Eve brought about 120 cm of snow and about -18 C, and "the fighting ground to a halt as guns and machines froze". There was widespread frostbite.
  - "The Nationalist advances stalled because of the weather" in early January. They resumed on 17 January as the weather improved ([Wikipedia, Battle of Teruel](https://en.wikipedia.org/wiki/Battle_of_Teruel)).
- **The Ebro (25 July to 16 November 1938).**
  - Heat reached 37 C in the shade on 4 August and compounded water and food shortages.
  - Franco opened the dams at Tremp and Camarasa, and the floods destroyed the pontoon bridges. The Segre dams were opened again on 18 August ([Wikipedia, Battle of the Ebro](https://en.wikipedia.org/wiki/Battle_of_the_Ebro)).
  - The dam releases were deliberate acts, not weather. They belong to a possible future "river" or event rule, not to the weather table.
- **Catalonia offensive (December 1938).** It was planned for 10 December and postponed to 23 December. Weather is cited, along with the flooded Ebro and Segre and an air force reduced by bad weather ([Wikipedia, Catalonia Offensive](https://www.wikipedia.com/wiki/Fall_of_Catalonia); [Spectator, 23 December 1938](https://archive.spectator.co.uk/article/23rd-december-1938/1/plots-in-spain-general-francos-offensive-intended-)). The Spectator also links the delay to unrest in Franco's ranks.
- **Winter around Madrid, 1936-37.** I did not research this separately (budget). The Madrid front froze into positional war over the winter after November 1936, and the Jarama battle was fought in February 1937 (from recall, unverified). The Northern campaign against Bilbao began only on 31 March 1937, after the winter (from recall, unverified).
- **Counter-evidence.** The Army of Africa's fastest advance, through Extremadura towards Madrid, came in August and September 1936 at the height of summer (from recall, unverified). Heat did not stop mobile operations then, so "Hot" must be mild.

**Conclusion.** Weather mattered in Spain mainly in two ways:
- winter cold and snow on the high Meseta and in Aragon (Teruel), and wet weather in the north;
- rain and mud grounding aircraft and miring motorised columns (Guadalajara), and weather pushing back the start of offensives (Catalonia 1938).

It was a real, but secondary, factor: less than in Russia, more than "none". The owner's hedge ("if the weather was strategically important in spain") is answered "moderately, yes, mostly in winter". That supports a small, seasonal weather system, not a big one.

### 2.2 Climate by region (AEMET normals quoted on Wikipedia)

Precipitation days are days with at least 1 mm.

| Station (zone) | Wettest months, rain days | Driest, rain days | Snow days | Mean max Jul | Source |
|---|---|---|---|---|---|
| Santander (Cantabrian), 1981-2010 | Nov 13.3, Jan 12.3, Dec 12.1 | Jul 7.3 | 0.9 per year | 23.6 C | [Wikipedia, Santander](https://en.wikipedia.org/wiki/Santander,_Spain) |
| Madrid Retiro (Meseta), 1991-2020 | Oct 7.2, May 6.8, Apr 6.7 | Jul 1.5, Aug 1.5 | 2.9 per year (Jan 0.9, Feb 1.0); frost days Jan 5.0 | 32.8 C | [Wikipedia, Climate of Madrid](https://en.wikipedia.org/wiki/Climate_of_Madrid) |
| Teruel, 918 m (Meseta and Aragon), 1991-2020 | May 6.9, Apr 5.9 | Feb 2.8 | 10.5 per year (Feb 2.8, Jan 2.3); mean min Jan -2.2 C | 31.9 C | [Wikipedia, Teruel](https://en.wikipedia.org/wiki/Teruel) |
| Valencia (Mediterranean), 1991-2020 | Sep 5.2, Oct 4.7 | Jul 1.2 | none listed | 29.9 C | [Wikipedia, Valencia](https://en.wikipedia.org/wiki/Valencia) |
| Seville airport (South), 1991-2020 | Dec 6.5, Oct 6.3 | Jul 0.1 | none listed | 36.3 C (mean monthly max Jul 41.9 C) | [Wikipedia, Seville](https://en.wikipedia.org/wiki/Seville) |

Climate zones, in outline ([Wikipedia, Climate of Spain](https://en.wikipedia.org/wiki/Climate_of_Spain)):
- **Cantabrian oceanic:** over 1,000 mm a year, rain all year, autumn the wettest season.
- **Central tablelands:** semi-arid or continental.
- **Mediterranean coast:** hot, dry summers and mild, wet winters.
- **Semi-arid southeast:** Murcia and Almeria, 200 to 500 mm a year, summers over 40 C.

### 2.3 Game precedents

- **Frank Chadwick's ETO series**, which includes Europe Engulfed by inference (search did not confirm the game by name).
  - Weather tables are indexed by month and theatre, with a die roll each game turn.
  - In Mud, overland movement drops to one hex per movement step, rail excepted, and overruns are prohibited outside Clear and Overcast.
  - Snow and Extreme Cold cost 2 MP per hex.
  - Overcast, Mud, Storms and Snow prohibit air transport missions.
  - January to March counts as Winter in the East ([Watchword, "So much for the weather"](https://www.watchword.biz/post/so-much-for-the-weather)).
  - This is the closest match to what the owner described: a month-indexed table rolled per turn.
- **Paths of Glory.** The rules PDF fetch failed (HTTP 403). It has no random weather roll, but certain turns are marked "Mud" on the turn track, and offensives in those turns are penalised (from recall, unverified).
- **Unity of Command II.** The manual PDF was image-only and could not be read. Its intro says bad terrain and "miserable weather" disrupt supply ([UoC II manual](https://cdn.steamstatic.com/steam/apps/809230/manuals/Manual_-_Unity_of_Command_II_-_Revision_8.pdf)). Weather in UoC is scripted per scenario turn and shown in advance, with mud and snow cutting movement and supply (from recall, unverified).
- **HOI4.** The wiki fetch failed (page did not load). HOI4 has per-state weather (rain, snow, blizzard, mud, sandstorm) that varies by season and slows movement, penalises attack, and limits air (from recall, unverified).
- **A World at War.** Not researched (budget). It has a winter and weather rule for the Eastern Front (from recall, unverified).
- **Other wargame engines.**
  - OpenPanzer: mud reduces movement, and rain or snow halves ground attack strength ([OpenPanzer manual](https://nicupavel.github.io/openpanzer-manual)).
  - Strategic Command: mud gives about half movement off roads ([Slitherine forum](https://forum.slitherine.com/viewtopic.php?p=454422)).
- **Spanish Civil War games.**
  - Arriba Espana has a "Winter" combat rule (9.1.5) ([rulespal, Arriba Espana](https://rulespal.com/arriba-espana/rulebook)).
  - Crusade and Revolution has a Winter rule (16.5) ([rulespal, Crusade and Revolution](https://rulespal.com/crusade-and-revolution/rulebook)).
  - Pasaran uses a weather table cross-indexed with the quarter: a sun means good weather and a cloud bad ([rulespal, Pasaran](https://rulespal.com/pasaran-the-spanish-civil-war/rulebook)).
  - A West Front II Spanish Civil War scenario review says mud made attacking "just impossible", so not much happened ([grognard.com review](https://www.grognard.com/reviews1/westfscw.doc)). That is a warning about over-strong mud.
  - The rule details for these games were not retrieved. Only the tables of contents and summaries were seen.

**Pattern.** Board wargames at our scale, months-long turns, use either a fixed seasonal rule (Arriba Espana, Crusade and Revolution) or a month-indexed table rolled per turn (ETO series, Pasaran). Weather is always known before the phasing player plans.

### 2.4 Calendar (A-TIME-1, A-TIME-8)

Turn n starts on 31 July 1936 + 14 x (n - 1) days, and its midpoint is 7 days later. There are 26 turns a year.

| Turn | Dates | Midpoint month | Note |
|---|---|---|---|
| 1 | 31 Jul to 13 Aug 1936 | Aug | scenario start |
| 5 | 25 Sep to 8 Oct 1936 | Oct | |
| 8 | 6 to 19 Nov 1936 | Nov | battle for Madrid begins (from recall, unverified) |
| 12 | 1 to 14 Jan 1937 | Jan | |
| 16-17 | 26 Feb to 25 Mar 1937 | Mar | Guadalajara |
| 30 | 10 to 23 Sep 1937 | Sep | the soak test stops here |
| 36-41 | 3 Dec 1937 to 24 Feb 1938 | Dec to Feb | Teruel (15 Dec to 22 Feb) |
| 52-60 | 15 Jul to 17 Nov 1938 | Jul to Nov | Ebro (25 Jul to 16 Nov) |
| 70 | 24 Mar to 6 Apr 1939 | Mar/Apr | war ends 1 April 1939 |

The soak test runs 30 turns, so it exercises only one winter (turns 8 to 17). A weather balance check should run 40 to 70 turns.

### 2.5 Proposed zones and tables

The zones:
- `cantabrian` (Galicia, Asturias, Cantabria, Pais Vasco). Station: Santander.
- `meseta` (Castilla y Leon, La Rioja, Navarra, Aragon, Madrid, Castilla-La Mancha). Values are the average of Madrid and Teruel.
- `mediterranean` (Cataluna, Valencia, Murcia, Islas Baleares). Station: Valencia.
- `south` (Andalucia, Extremadura, Ceuta, Melilla). Station: Seville.

Notes on the zoning:
- Navarra is mixed, with a humid north and a dry Ribera, and is put in `meseta`.
- Murcia is semi-arid and goes in `mediterranean`.
- Ceuta and Melilla are coastal North Africa, closest to `south`.

The outcomes are Clear, Hot, Rain, Mud, Snow and Severe cold, as integer weights out of 20. Integer weights keep the tables independent of the dice decision in idea 9.

**Derivation** (a script, reproducible):
- Let wet = round(20 x min(0.65, rain days / 20)). In winter months (Nov to Mar) half of wet is Mud; in Apr and Oct a third; otherwise none.
- Snow = round(min(5, 1.6 x snow days)).
- Severe cold = 2 when the mean minimum is below 0 C, and 1 when it is below 2.5 C.
- Hot = min(8, round(2.5 x (mean max - 30))) when the mean max is above 30 C.
- Clear is the rest.

These are illustrative values, not 1930s data (A-TIME-6). Each cell is clear/hot/rain/mud/snow/cold.

| Month | cantabrian | meseta | mediterranean | south |
|---|---|---|---|---|
| Jan | 7/0/6/6/1/0 | 12/0/2/2/3/1 | 16/0/2/2/0/0 | 14/0/3/3/0/0 |
| Feb | 9/0/5/6/0/0 | 12/0/2/2/3/1 | 16/0/2/2/0/0 | 15/0/3/2/0/0 |
| Mar | 10/0/5/5/0/0 | 13/0/3/2/2/0 | 16/0/2/2/0/0 | 14/0/3/3/0/0 |
| Apr | 8/0/8/4/0/0 | 13/0/4/2/1/0 | 16/0/3/1/0/0 | 14/0/4/2/0/0 |
| May | 10/0/10/0/0/0 | 13/0/7/0/0/0 | 16/0/4/0/0/0 | 16/0/4/0/0/0 |
| Jun | 12/0/8/0/0/0 | 16/0/4/0/0/0 | 18/0/2/0/0/0 | 12/7/1/0/0/0 |
| Jul | 13/0/7/0/0/0 | 12/6/2/0/0/0 | 19/0/1/0/0/0 | 12/8/0/0/0/0 |
| Aug | 12/0/8/0/0/0 | 13/4/3/0/0/0 | 16/2/2/0/0/0 | 12/8/0/0/0/0 |
| Sep | 11/0/9/0/0/0 | 16/0/4/0/0/0 | 15/0/5/0/0/0 | 13/4/3/0/0/0 |
| Oct | 9/0/7/4/0/0 | 14/0/4/2/0/0 | 15/0/3/2/0/0 | 14/0/4/2/0/0 |
| Nov | 7/0/7/6/0/0 | 13/0/3/3/1/0 | 16/0/2/2/0/0 | 14/0/3/3/0/0 |
| Dec | 8/0/6/6/0/0 | 12/0/3/2/2/1 | 16/0/2/2/0/0 | 14/0/3/3/0/0 |

**Proposed effects**, in today's d6 terms. They are applied as a named M14 roll modifier for attackers in the battle's zone, and listed in the battle breakdown.

| Outcome | Standard set | Soft set | Other effects |
|---|---|---|---|
| Clear | 0 | 0 | none |
| Hot | -1 | 0 | Hook for exhaustion (idea 6). |
| Rain | -1 | 0 | Aircraft reduced (hook, idea 8). |
| Mud | -2 | -1 | Aircraft grounded except from cities with paved fields; motorised and tank bonus lost (hooks, idea 8); movement cost doubled (hook, idea 6). |
| Snow | -2 | -1 | No digging-in gain this turn (M22). |
| Severe cold | -2 | -2 | No digging-in gain (M22); hook for frostbite losses for armies that move. |

What this means at 2:1 with the shipped table, where success needs row 4 or more:
- with no modifier, an attack succeeds 3 times in 6;
- at -1, 2 in 6;
- at -2, 1 in 6.

The `weather-months` widget shows the expected chance for each zone and month.

**Movement.** Every move today is one connection, and there are no movement points (M2). So "movement effects" have nothing to attach to until idea 6 (movement points or exhaustion) or idea 7 (sub-regions) lands. Until then the only movement-like levers are:
- closing sea connections in storms (Strait, Baleares);
- forbidding attacks in severe cold;
- weather on the attack roll.

I recommend the attack modifier only, with the other levers as dormant hooks.

### 2.6 Engine fit

- **Scenario schema.**
  - `calendar: { start: "1936-07-31", turnDays: 14 }`
  - `weather: { outcomes[], zones[], tables }`
  - `territories[].weatherZone`
  - Sketch:

```json
"calendar": { "start": "1936-07-31", "turnDays": 14 },
"weather": {
  "outcomes": [
    { "id": "clear", "name": "Clear", "attack": 0 },
    { "id": "mud", "name": "Mud", "attack": -2, "noDiggingIn": false }
  ],
  "zones": [ { "id": "meseta", "name": "Meseta" } ],
  "tables": { "meseta": [ { "clear": 12, "rain": 2, "mud": 2, "snow": 3, "cold": 1 } ] }
}
```

  - `tables[zone]` has exactly 12 entries, January first.
  - Territory: `"weatherZone": "meseta"`.
- **New loader rules.**
  - Every territory has a zone when `weather` is present.
  - Every zone has 12 months.
  - Weights are whole numbers, 0 or more, and each month sums to more than 0.
  - Outcome ids resolve.
  - `calendar` is required when `weather` is present.
- **Ruleset.** Weather changes resolution, so it needs a new ruleset id (mismatch d, owned by Engine).
- **State and seeding.**
  - `GameState.weather: Record<ZoneId, OutcomeId>`.
  - Weather is rolled by the engine in `initialGameState` for turn 1. At the end of `resolveTurn` it is rolled for the next turn and stored in `finalState`, so it is known before planning.
  - It uses its own seeded stream, `deriveSeed(seed, weatherStreamTag, turn, zoneIndex)`, beside `battleStreamTag` in `engine/dice.ts`.
- **Rules.**
  - M26 gains step 0, "Weather (known since the turn began)".
  - M14 gains "the battle zone's weather: plus its `attack` (0 or less)".
  - M22 gains "no gain in a zone whose weather has `noDiggingIn`".
- **Which zone a battle uses.**
  - A territory battle (M17-M19) and a standing battle (M27) use the territory's zone.
  - A head-on meeting (M20) is fought on the road between two territories, so it uses the worse of the two zones' modifiers. A sea connection uses the worse end.
- **Planning and the computer player.** `estimateAttack` must include the weather modifier. That keeps planning odds and the computer player consistent with resolution, and the existing consistency test enforces it.
- **UI.**
  - A weather badge for each zone on the map (marker `weather-badge`).
  - The turn label gains dates ("Turn 5 . 25 Sep to 8 Oct 1936"). This changes rule B15.
  - Battle breakdowns name the weather.
- **Balance risk (stated plainly).**
  - Penalties that fall only on attackers make stalemate more likely. The soak test already freezes 58 percent of games against a 20 percent budget.
  - The standard set lowers the 2:1 success chance in a Cantabrian January from 50 percent to about 33 percent.
  - So the weather effects must be small, must be data, and must be gated by a harness metric (idea 11): the freeze rate with weather on, over 40 to 70 turns.
- **Genericity.**
  - Good. Zones, outcomes, tables and calendar are all data.
  - A WW1 or WW2 scenario reuses them with different zones; Russian mud is just weights.
  - What would not be generic is hard-coded outcome behaviour. Keep effects to a small closed set of fields: `attack`, `noDiggingIn`, and later `air` and `moveCost`.

## 3. Options and tradeoffs

### Idea 3

- **A. Per-player planning clock; on expiry, lock the draft (recommended).**
  - Pros: simple. It reuses `endTurn` and `lockSubmission`, there is no engine change, and it matches webDiplomacy's "saved orders count".
  - Cons: a slow player's plan is truncated.
- **B. Per-player clock; on expiry, everything holds** (Diplomacy NMR).
  - Pros: harsh but clear.
  - Cons: throws away work. It feels bad on a shared PC, where the player is physically there.
- **C. Chess-clock bank** (Fischer increment or Polytopia rollover).
  - Pros: fair over a game.
  - Cons: more UI and state, and players must learn a bank. It adds nothing for a first version.
- **D. Computer takes over** the faction for the turn (Supremacy 1914).
  - Pros: no army is idle.
  - Cons: surprising, and it needs a computer plan merged with a partial draft. It belongs with online play and inactivity, not with a per-turn timer.

Extras worth asking about:
- a grace extension once per game (webDiplomacy excuses);
- pause;
- turn-1 extra time;
- showing 30 min and 1 h only with online play.

### Idea 12

- **A. Per-zone seasonal tables, rolled each turn and shown before planning (recommended).** Small effect set, data-driven, gated by the harness.
- **B. One national roll per turn** from a monthly table.
  - Pros: simpler; one badge.
  - Cons: snow in Seville or mud in Valencia when it is clear in the north looks wrong across Spain's very different climates.
- **C. Fixed seasonal rule, no roll** (Arriba Espana-style winter): for example, Meseta and Cantabrian attacks -1 from December to February.
  - Pros: deterministic, fully plannable, cheapest.
  - Cons: loses the owner's "weather roll" and the month-by-month odds.
- **D. Defer** until idea 6 (movement) and idea 8 (aircraft) exist, since most historical weather effects act through those.

## 4. Recommendation

- **Idea 3: option A.**
  - Offer Off, 1, 5 and 10 minutes now. Show 30 minutes and 1 hour disabled as "online play", as the Online Player option is.
  - The clock runs only on that player's planning screen.
  - Pause covers the screen.
  - Computer players are untimed.
  - Timeouts are reported in the turn results.
- **Idea 12: option A**, with the soft effect set as the starting point. Start with the attack modifier and no digging-in in snow or cold. Keep air and movement as dormant hooks for ideas 8 and 6. Add a harness gate on the freeze rate.
  - Under the soft set, Hot and Rain are display-only in Milestone 3: badge and forecast, with no rule effect. They come alive when exhaustion (idea 6) and aircraft (idea 8) arrive, or if the harness shows room for the standard set's -1.

## 5. Draft questions

See `time.questions.json`. There are 7 timer questions (`Q-TIMER-1` to 7) and 8 weather questions (`Q-WX-1` to 8).

## 6. Gaps

**Search snippets.** Some claims rest only on search-result summaries (search snippet, page not fetched). These are:
- the webDiplomacy forum threads (excused missed turns);
- vDiplomacy features;
- the Diplomacy house rules;
- the Supremacy 1914 guide and the Call of War forum;
- both Polytopia dev-tracker posts;
- the Civilization VI Steam thread;
- the Frozen Synapse 2 Wikipedia page and the GameGrin review;
- the Battlefront forum;
- the Watchword ETO article;
- OpenPanzer and Slitherine;
- the rulespal tables of contents (Arriba Espana, Crusade and Revolution, Pasaran);
- the grognard.com review;
- the Spectator 1938 page;
- the Catalonia Offensive page.

Pages actually fetched and read: the webDiplomacy FAQ, Time control, and the Wikipedia pages for Guadalajara, Teruel, the Ebro, Climate of Spain, Climate of Madrid, Santander, Seville, Teruel and Valencia.

**Other gaps:**

- Paths of Glory rules PDF: HTTP 403.
- Unity of Command II manual: image-only PDF.
- HOI4 wiki: page failed to load.
- Backstabbr, Neptune's Pride, and Civ expiry rules: no source found.
- Madrid winter 1936-37: not researched.

What these sections say about those games is tagged "(from recall, unverified)".
