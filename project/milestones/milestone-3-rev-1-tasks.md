# Milestone 3 Revision 1: Tasks

> Internal product and implementation plan. Nothing in this document may be imported into or rendered by the player-facing application.

**Baseline:** `m3-ideation` at `8cf06ea`. It is `main` (`d7f3006`, Milestone 2 Revision 7) plus documentation only; `git diff main m3-ideation -- src e2e assets scripts package.json` is empty.

**Goal:** everything in Milestone 3 implemented at the production bar (section 5) in one revision. Revisions are attempts: the owner plays this one, and Revision 2 fixes what the playtest finds.

**Inputs:** these files are the source of truth for every decision below. Cite their question ids.
- `project/milestones/milestone-3-ideation/answers/owner-answers.md`: 110 ideation answers. A note overrides its tick.
- `project/milestones/milestone-3-ideation/answers/mechanics-review-answers.md`: 37 mechanics answers, plus the interpretations the owner confirmed.
- `project/milestones/milestone-3-ideation/answers/ux-options-answers.md`: 19 UX answers.
- `project/milestones/milestone-3-ideation/ux-review/` and `images/ux-*.webp`: the approved UX, captured from the live app. The mock code in `ux-pass/` is a visual reference, not production code or data.
- `project/coding-principles.md`, `project/specs/*.md`, and `project/testing-screenshots.md` (how to get and make screenshots).

`milestone3.md` is superseded by this document.

## 1. Decisions

Product decisions come from the owner. Integrator defaults, where the answers left a gap, are logged in `milestone-3-rev-1-declog.md` (process section) and named here as "(default, declog Dn)".

### 1.1 Words

| ID | Decision | Source |
|---|---|---|
| W1 | **Territory**: one of the scenario's regions. Units move between territories and battles are fought for a whole territory. Control, victory and recruitment are judged per territory. | Mechanics review "words"; Q-PART-2 note |
| W2 | **Sub-territory**: a province, or a scenario override. Spain: 1936 provinces, Baleares as its three islands, Asturias in 2 (Oviedo and the rest), Madrid in 3. It holds development, a build queue, buildings, terrain, rail and a port. It changes hands after battles. Units never stand in one or fight for one. | Q-PART-1, Q-MR-12, Q-MR-18 |
| W3 | **Capital sub-territory**: one per territory. Recruiting happens there, it has the most build options, and defenders keep it longest. | Q-RECR-2 note, Q-PART-3 note |
| W4 | **Unit**: the lasting piece, with its own men, morale, fatigue and type. **Army**: whatever units leave one territory with the same order that turn, or hold there together. It exists for one turn's evaluation. There is no Organize order and no home territory. | Q-MR-24 note, Q-UX-I1 |
| W5 | **One unit model.** A unit type carries values, effects, training, requirements, allowed order kinds and a symbol. Infantry, militia, artillery, cavalry, tanks, trucks, anti-air, aircraft (recon, fighter, bomber) and generals are all unit types. | Q-UX-I2 note, Q-UX-10 note |
| W6 | **Contested territory**: two or more factions hold sub-territories in it. | Q-MR-21 |

### 1.2 Data and engine

| ID | Decision | Source |
|---|---|---|
| E1 | Spec version 2. Both packages (Spain and the tiny-front fixture) are migrated in one commit; version 1 is dropped. | Q-MIS-d-2 |
| E2 | Ruleset `m3-modular`, with a `rules` object that picks one named module per area: dice, economy, recruitment, weather, movement, partition and air. `m2-strength` stays as a preset: the d6 table and no new systems. The tiny-front fixture uses that preset, so the Milestone 2 tests stay meaningful. | Q-MIS-d-1, (default, declog D3) |
| E3 | Layout `src/scenarios/<id>/`, holding `scenario.json`, `map.json`, the scenario's own assets (rail, trucks, factories, ports and so on) and an optional `plugin.ts`. A plugin may only register named rule modules, through the same interface the engine's own modules use. `src/scenarios/MANIFEST.md` describes the folder layout and the scenarios included. `src/scenarios/scenario.schema.json` (and the map schema) define the JSON. Symbols every scenario uses stay in one shared folder. Use the same nouns in every folder. | Q-DATA-2 note, Q-MR-34 |
| E4 | The Spain scenario's id and folder are `spanish-civil-war-1936`. A scenario is one war with one start date. The tiny-front fixture uses the same layout under `src/test/fixtures/scenarios/tiny-front/`. | Q-MR-35 |
| E5 | Parameters live in data. Rule logic lives in named modules in code, chosen by data, each with its own spec rules and tests. | Q-DATA-1 |
| E6 | A unit special effect is named in data from a coded list of effect kinds, with its numbers (for example `roll-bonus-per-points` with per 3, bonus 1, max 3). A type may carry several effects; most carry none or one. | Q-DATA-4, Q-UNIT-6 |
| E7 | Computer-player weights (today's `computerWeights`, `offensiveWeights`, `stakeWeights`, `victoryAlarm`) become named AI profiles in data, one per faction. The strategy logic stays in code. | Q-DATA-3, Q-HARN-6 |
| E8 | Orders are one flat list of typed orders per faction, for units and sites alike. Entrench, Rest and the contested "Attack" stay derived defaults, not submitted orders. | Q-TEN-3, rev 7 O5 |
| E9 | Each new module is checked on paper against one other era (WW1). Nothing is built for other eras yet. | Q-DATA-5 |

### 1.3 Map and sub-territories

| ID | Decision | Source |
|---|---|---|
| P1 | The scenario starts partitioned. Each sub-territory goes to its historical holder on 31 July 1936, from a control table in scenario data, whatever the parent territory's controller. Hand overrides are allowed where a capital holder misleads (Aragón's Republican east). Example: Álava starts Nationalist, so País Vasco starts contested. | Q-PART-7, Q-PART-9 |
| P2 | Armies move between territories and battles are territory-wide. Sub-territories decide control, income, building, rail, terrain, ports and paths. | Q-PART-2 (hybrid plus note) |
| P3 | An army entering a territory the enemy holds whole, with no enemy army there, takes all of it (M6). Inside a contested territory with no enemy army, your armies take one enemy sub-territory a turn, nearest the attack's origin first and the capital last (P7). | Q-MR-21 |
| P4 | A graded result's ground is 0, 1, 2 or all sub-territories. They flip from the outside in: nearest the attack's origin first, the capital last. Ties go by scenario order. | Q-PART-3 and note, Q-TEN-1 |
| P5 | On a partial-ground grade, defenders fall back inside the territory. On a whole-territory grade, they retreat (M21). Where a territory has one sub-territory, partial grades act as a stalemate. | Q-PART-6, Q-D20-7 |
| P6 | Forced retreats and Withdraw orders need a path through the mover's own sub-territories to an adjacent territory it held at the start of the turn. Without one, the army surrenders. | Q-MR-22, Q-PART-2 rule 2 |
| P7 | A partitioned territory counts toward the territory victory share only when one faction holds every sub-territory. | Q-PART-5 |
| P8 | Each connection names the sub-territory it enters on each side. That sub-territory's terrain applies on the way in. | Q-MR-19 |
| P9 | Sub-territory geometry is real province geometry (geoBoundaries ADM2, vendored with a checksum and attributed), built by `scripts/build-map.ts` in the map's projection. The Oviedo and Madrid splits are drawn into the data. | Q-PART-1, advisor |

### 1.4 Contested ground, morale and fatigue

| ID | Decision | Source |
|---|---|---|
| C1 | In a contested territory, units attack by default (the M27 standing battle) or withdraw. They cannot entrench, rest, replenish, recruit or move elsewhere. | Q-PART-2 rules 1-3, Q-MR-03, Q-UX-14 |
| C2 | M27 is kept: one standing battle per contested territory per turn, and the faction with the greatest standing attack attacks. "Attack by default" means no entrenching or resting, and only the M27 attacker's units gain fatigue. | Q-TEN-2, Q-MR-03 |
| C3 | With three or more factions, the capital holder (or else the last controller) always defends, in M27 and M19 alike. The attacker is the faction with the greatest attack. | Q-MR-37 |
| C4 | A demoralized unit in contested ground holds and defends, gains no fatigue and may withdraw. It recovers only if a general rallies it. | Q-MR-02 |
| C5 | There are three routes back to morale: rest in uncontested ground (M23), Replenish in uncontested ground, and a general rallying his army anywhere, including contested ground. | Q-MR-01, Q-MIS-b-2 |
| C6 | Fatigue track 0-3. It rises by 1 for each turn a unit attacks, and a quiet turn in uncontested ground resets it to 0. Level 2 is a named roll modifier, "Fatigued", −2 on the d20. Level 3 demoralizes the unit. Defending never tires a unit. | Q-MOVE-2 to 5, Q-MR-04 |
| C7 | Men are the only lasting damage, restored by Replenish. Morale and fatigue are temporary. There is no third value multiplier. | Q-MIS-b-11 |
| C8 | Training already under way when a territory becomes contested: militia finish and appear, other units pause until it is uncontested again. No new Recruit orders there. | Q-MR-14 |

### 1.5 Combat (d20)

| ID | Decision | Source |
|---|---|---|
| D1 | A d20, with an explicit 7 × 21 table in data (odds columns 0 to 6 by modified score 0 to 20), whose cells name grades from a catalogue. Each odds column uses only the grades that fit it. Only the battle's column is shown. | Q-D20-1 to 3 and note, Q-MR-06 |
| D2 | 13 grades, as the mechanics review's catalogue: Attacker destroyed, Attacker routed, Attacker repulsed, Attack checked, Bloody stalemate, Stalemate, Defender gives ground (1), Defender pushed back (2), Costly victory, Defender driven out, Defender routed, Defender broken (35%, all demoralized, weakest defender destroyed), Defender destroyed. Each grade's losses use the 10, 20 and 35 percent steps, with demoralization of none, half or all, weakest first. The harness tunes the numbers. | Q-MR-06, Q-D20-4, Q-D20-5 |
| D3 | Today's modifiers are restated ×3: works +3 a turn up to +9, Popular resistance +3, and the below-1:1 penalty ×3. | Q-D20-6 |
| D4 | A general gives +1 on the d20. City barricades give +1 to the defender whenever the battle territory has a city the defender controls, for every faction, and they stack with Popular resistance. | Q-MR-07, Q-MR-09, Q-UX-I4 |
| D5 | Artillery: +1 per 3 artillery attack points on the attacking side, at most +3, counted per side. Artillery cannot attack alone. Tanks: +1 per 3 tank points on attack, at most +2, and none in Mud or Snow. | Q-UNIT-2, Q-MR-25, Q-MR-26 |
| D6 | A worn-down unit below 10 percent of its full strength is destroyed. | Q-MR-08 |
| D7 | The weather attack modifier is soft: Hot 0, Rain 0, Mud −3, Snow −3, Severe cold −6. An amphibious assault is −4. Bomber support is +2. | Q-WX-6, Q-MR-23, unit sheet |
| D8 | A battle card shows the die, every modifier and the score. It then shows the column as bands, each with its score range, grade and effect, with the hit band outlined. Hovering over a battle icon on the map names its result. | Q-UX-09, Q-UX-13, owner's missing note |

### 1.6 Economy and buildings

| ID | Decision | Source |
|---|---|---|
| $1 | Two resources, Funds and Manpower. Production capacity is a per-site limit. Food is folded into Manpower. | Q-ECON-1, Q-ECON-2 |
| $2 | Income is the sum of the sub-territories' development, paid only for territories the faction holds whole. A contested territory pays nobody. | Q-ECON-4, Q-ECON-5 note, Q-PART-2 rule 3 |
| $3 | Development is a catalogue in data: Farms (Manpower), Mines (Funds) and Industry (Funds, city sub-territories only), each with levels 0-3 and 1936 starting levels. | Q-MR-12 |
| $4 | Buildings: Barracks, Factory, Depot, Fortifications, Hospital, Airfield (with a paved upgrade) and Rail yard. Port (0-2) and Rail (0-3) are levelled sub-territory improvements. The Depot gates trucks and tanks and raises the replenishment cap. | Q-MR-13, Q-CITY-2 |
| $5 | Every sub-territory has its own build queue. You pay when you queue, and you may queue several items. When a sub-territory changes hands, the item in progress keeps its progress for the new holder and its payment is forfeit. Items not yet started are refunded to the old holder. Queues pause while the territory is contested. Buildings are captured intact. | Q-CITY-3 note, Q-CITY-4, Q-MR-11 |
| $6 | Unspent resources carry over without limit. Opponents' balances are hidden, though recon can reveal them. | Q-ECON-6, Q-ECON-7 |
| $7 | No foreign aid until Milestone 4. The Southern command stays poor; if the harness says it needs more, raise Ceuta's and Melilla's Funds yields. Each faction's starting stocks are scenario data. | Q-ECON-3, Q-MR-10 |
| $8 | When a territory becomes contested, rail in the attacker-held sub-territories drops one level. Repairing it is an upgrade order. | Q-RAIL-4 note |

### 1.7 Recruitment and replenishment

| ID | Decision | Source |
|---|---|---|
| R1 | Recruit and Replenish are orders paid from resources. M11 Reinforcement keeps its name and meaning. | Q-RECR-1, Q-MIS-a-1 |
| R2 | You recruit at the capital sub-territory of an uncontested territory you hold. It costs Funds and Manpower and needs certain buildings. Every type is listed; a locked type says what it lacks. No recruitment tags. | Q-RECR-2 note |
| R3 | Building gates: Barracks for infantry, security forces and cavalry; Barracks and Factory for artillery; Factory and Depot for trucks and tanks; Factory for anti-air; Airfield and Factory for aircraft. Militia need nothing. A type may be limited to certain factions (colonial veterans are not Republican). | Q-RECR-2 note, unit sheet |
| R4 | Training times per type: militia 1 turn; infantry, security forces, colonial veterans and cavalry 2; trucks and anti-air 2; artillery 3; aircraft 3; tanks 4. There are no faction differences. | Q-RECR-3, Q-UNIT-5, Q-RECR-4 |
| R5 | Replenish costs half as much per value point as recruiting, capped at half the unit's establishment per turn. Any battle cancels it with a refund. It clears demoralization. A Hospital speeds it up and a Depot raises the cap. | Q-RECR-6, Q-MR-05, Q-MIS-b-2, $4 |
| R6 | Destroyed and surrendered units stay gone; a new Recruit makes a new unit. M25 is replaced by Replenish in `m3-modular`. | Q-RECR-7, Q-MIS-b-1 |
| R7 | New units appear at the end of the turn in which their training finishes, and cannot move that turn. | Q-RECR-5 |

### 1.8 Movement, rail and ports

| ID | Decision | Source |
|---|---|---|
| M1 | Movement allowance, in territories: 1, plus 1 with enough trucks (one truck for every two other units; cavalry needs none), minus 1 for entering a mountain or swamp sub-territory, minus 1 in Mud or Snow. Never below 1. Rail legs don't count against it. | Q-MR-15, Q-MR-20 |
| M2 | Only the last step of a move may enter enemy or contested ground. Earlier steps pass through territories your faction held whole at the start of the turn. If an enemy army enters a territory you are passing through, your units stop at the first such territory and defend it as a reinforcement. | Q-MR-16, Q-MR-17, Q-UX-I3 |
| M3 | Rail has a level 0-3 on each sub-territory, and adjacent rail sub-territories connect. An army boards at its territory's capital and rides through rail sub-territories its faction holds to another territory's capital. The lowest level on the route sets the range. The boarding capital's level, plus 1 for a Rail yard, sets how many armies can leave per turn. | Q-MR-18 |
| M4 | Three shapes of move: one territory (more with the allowance); one friendly step then rail; or rail then one step, which may attack. | Q-RAIL-2 note, Q-MR-17 |
| M5 | Sea moves sail from a friendly port. Into a friendly port, the army lands normally, up to the port's capacity. Onto an enemy coast with no friendly port, it is an amphibious assault: −4, at most one army per sea connection per turn. Ceuta and Melilla are one-sub-territory territories with ports. | Q-MR-23, Q-CITY-7 note |
| M6 | There are no action points. Rail gauge is not modelled. Rail does not carry supply, and supply as a rule is dropped. | Q-MOVE-6, Q-RAIL-5, Q-RAIL-6, Q-MIS-c-1 |

### 1.9 Units, air and generals

| ID | Decision | Source |
|---|---|---|
| U1 | New types: artillery group, cavalry, tanks, trucks, anti-air, and aircraft (recon, fighter, bomber). The mechanics review's unit sheet is the starting set of effects; the harness tunes the numbers. | Q-UNIT-1, Q-MR-26 |
| U2 | Aircraft are units based in a territory with an Airfield. Each turn one flies one mission within a range in territories (set in data): raid, intercept, battle support (bombers) or recon. They are grounded in Mud and Snow unless the airfield is paved. Losses come from the raid roll and enemy fighters. In the UX they behave like units: counters on the map, selected like units, with a range ring. They use the NATO APP-6A fixed-wing aviation symbol. | Q-MR-27, Q-UX-10 and notes, Q-WX-5 |
| U3 | A raid on a chosen sub-territory rolls one of four outcomes: Air eliminated, Nothing hit, Income cut for one turn, or Building downgraded or destroyed. Anti-air in the target territory and intercepting fighters worsen the roll. | Q-UNIT-4 note |
| U4 | Recon shows an enemy territory's balances, queues and units in training for the next turn. | Q-MR-27, $6 |
| U5 | A general is a unit in his own right. His effect (+1, and the rally) applies to whatever army he is part of that turn. Each faction has a roster of 3-5 named commanders in data, each with one trait, good or bad. Sacking is a free order that brings in the next commander on the roster. A general can die, on a seeded roll, only when his army is destroyed or routed. Nothing is scripted. | Q-UX-I2 note, Q-MR-28, Q-GEN-2 note |
| U6 | Several generals in one army or on one side: only the best single general's +1 counts (default, declog D5). | Gap |

### 1.10 Time and weather

| ID | Decision | Source |
|---|---|---|
| T1 | Turns are half-months, 24 a year, starting Late July 1936, from a calendar block in scenario data. The date reads "Turn 7 · Late October 1936". | Q-MR-31, Q-WX-7 note, Q-UX-13 |
| T2 | Weather: one d20 roll a turn, read against each zone's seasonal table, with each table ordered from best weather to worst. There are four zones: Cantabrian, Meseta, Mediterranean and South. The outcomes are Clear, Hot, Rain, Mud, Snow and Severe cold. Rolls are seeded per game. | Q-WX-1 to 4, Q-MR-29 and note, Q-UX-I5, Q-WX-8 |
| T3 | The turn's weather is shown before planning, with next turn's odds as a forecast. It appears in the territory pane, and a weather symbol sits on the odds chips and destination rows. No weather effects are drawn on the map. | Q-WX-3, owner's missing note, Q-UX-13 |
| T4 | Weather effects: the attack modifier (D7); no digging in during Snow or Severe cold; aircraft grounded (U2); movement −1 (M1); the sea closes when a coastal zone touching it has Rain in December, January or February; units that move in Severe cold lose men to frostbite. | Q-WX-5, Q-MR-30, Q-UX-I5 |
| T5 | Turn timer, chosen at setup: Off, 1, 5 or 10 minutes. 30 minutes and 1 hour are shown greyed out, for online play later. Each player's clock runs only on their own planning screen, from Continue on the handoff screen. Turn 1 gets double time, and unused time does not carry over. When time runs out, the planned orders go in and every other unit takes its default. A pause button exists in local play only. | Q-TIMER-1 to 6, Q-TIMER-4 note, Q-UX-11 |
| T6 | A countdown chip, warnings at 1 minute and 10 seconds, and a line in the turn results saying whose time ran out and how many units held. The faction chips show readiness, and local computer players are always ready. | Q-TIMER-7 and note |

### 1.11 UI

| ID | Decision | Source |
|---|---|---|
| X1 | Funds and Manpower are chips in the header, each with next turn's income. On a phone, the timer, Funds and Manpower share one compact row, followed by the readiness chips; tapping a chip gives detail. | Q-UX-01, Q-UX-12 |
| X2 | Sub-territories on the map: provinces are drawn only in contested territories, with faint diagonal lines. Names and capital stars appear on zoom. | Q-UX-02 |
| X3 | The territory pane has tabs: Units, Build, Recruit. It opens on Units. Zooming in and clicking a sub-territory focuses the pane on it, with a link back. | Q-UX-03, Q-UX-04, Q-CITY-3 note |
| X4 | Recruit list: each type shows values, cost, training time and a quantity. Locked types say why inline, and hovering gives details. A basket line shows the turn's cost. | Q-UX-05 |
| X5 | Move destinations show chips on every row (weather, terrain, fatigue, rail) and a full breakdown card for the row you hover over or tap. An "Army leaving <territory>" summary shows the units, attack, moves left and the truck rule. | Q-UX-06, Q-UX-07 |
| X6 | Rail on the map: main lines (levels 2-3) at full-map zoom and every line when zoomed in. When you select units, the network they can ride lights up. Lines are thin curves tied to sub-territory stations. | Q-UX-08, Q-RAIL-5 note |
| X7 | The orders in contested ground and the Replenish order follow the approved capture. Unit pills show the general, "Fatigue n" and Demoralized. Units in training are drawn dashed. Sub-territory cards show development pips, buildings, and the queue with progress bars. | Q-UX-14, Q-UX-13 |
| X8 | More icons and symbols, wherever they don't clutter the UI. This is an acceptance item for every stream. | Q-UX-13 note |

### 1.12 Harness, process and targets

| ID | Decision | Source |
|---|---|---|
| H1 | `npm run sim` is a command-line tool, bundled by Vite, that runs games across worker threads. It writes JSON only: a summary, and one line per game. | Q-HARN-1 and note, Q-HARN-7 |
| H2 | `npm test` runs a 10-game smoke run in place of the 200-game soak. Runs of 200 and 1000 games are on demand. | Q-HARN-2 |
| H3 | The metrics: win share per faction with 95 percent intervals, decided and freeze rates, the game-length distribution, battles per turn and results by odds column, losses per faction, and first-turn moves. | Q-HARN-3 |
| H4 | Variants are small JSON patches over the scenario, run on the same seeds as the baseline, with the difference and its interval reported. Today's computer player runs every side, with a per-faction profile that a variant can change. | Q-HARN-5, Q-HARN-6 |
| H5 | The computer player must use every new order (Recruit, Replenish, builds, rail, air missions, generals, Withdraw) in the revision that adds it, with tests. | Q-HARN-8 |
| H6 | A blunder chance, set in scenario data and starting at 1 in 100 orders, is built into the computer player with seeded rolls. It applies in real games and the harness alike, and the harness reports results with and without it. | Q-MR-33 |
| H7 | End-of-milestone goal, not a per-merge gate: over 1000 games, freezes at or under 15 percent and every faction winning at least 20 percent of decided games. Misses are reported to the owner, not tuned in a loop. | Q-MR-32, Q-MIS-e-2, Q-SEQ-3 |
| H8 | No CI in Milestone 3. The integrator runs the checks locally. Owner-owned budgets (freeze rate, initial chunk) live in one file that a local check reads. | Q-PROC-1, Q-PROC-2, Q-PROC-6 |
| H9 | The hotspot files are split in the contract stream: `CampaignMap.tsx`, `state/planning.ts`, `useMapCamera.ts`, `engine/combat.ts`, and `style.scss` into partials. | Q-PROC-6, advisor |

**Dropped or deferred:** support orders (dropped for good); action points; supply; political capital and foreign aid (Milestone 4); CI/CD, CLAUDE.md and hooks, hosting (Milestone 5); rail gauge.

## 2. Turn sequence (`m3-modular`)

This replaces M26 for `m3-modular`. Each step is one phase module in `engine/phases/`, run in this order.

| Step | Phase | Decisions |
|---|---|---|
| 0 | Before planning: the weather roll and the forecast. Balances, income preview and timer start are shown. | T2, T3, T5 |
| 1 | Reveal: validate every order against the start-of-turn state, pay for purchases, and refund what fails. | E8, $5, R2, R5 |
| 2 | Air missions: recon, interception, raids. Support missions attach to their battle. | U2-U4 |
| 3 | Transit legs (rail, sea, truck steps through friendly ground), interception stops, and reinforcements (M11). | M1-M5 |
| 4 | Head-on meeting battles, on final steps only (M20). | M2 |
| 5 | Battles in defended and empty territories (M17-M19), using the d20 grades. | D1-D7, C3 |
| 6 | Occupation, sub-territory flips, returns, retreats along the path rule, withdrawals and surrenders. | P3-P6 |
| 7 | Standing battles in contested territories (M27), and their flips and retreats. | C1-C3 |
| 8 | Control: territories, sub-territories (including the one-a-turn sweep) and cities. Rail damage. | P3, $8 |
| 9 | Morale (rest, Replenish, rally), fatigue, digging in, frostbite, and general deaths. | C4-C7, T4, U5 |
| 10 | Training and build queues advance. New units appear. (Replenished men arrive at step 9.) | R4, R7, $5, C8 |
| 11 | Income from whole territories, minus raid cuts. | $2, U3 |
| 12 | Victory. | P7 |

Each battle and each roll draws from its own seeded stream: `deriveSeed(game seed, tag, turn, index)`, with a separate tag per kind (battle, weather, raid, general death, blunder). The same seed replays the same game.

## 3. Workstreams

### 3.1 Roles and process

> **Changed 19 November 2026 (declog D13):** every feature stream now starts at once from the interim base, and workers no longer stop at checkpoints. Reviews and the production bar (section 5) move to a final make-it-right phase. The checkpoint text below describes the original plan.

- **Coordinator and integrator (`m3r1-integrator`)**: the main session. It owns this document, the declog, merges, `e2e/baselines/**`, the final verify, and the reports to the owner.
- **Supervisor (`m3r1-supervisor`)**: a review agent. It reads each checkpoint report and the stream's diff since the last checkpoint, and answers **continue**, **redirect** (with what to change), or **stop** (stuck or out of scope). It writes nothing.
- **Workers (`m3r1-<slug>`)**: one agent per stream, on branch `m3r1-<slug>`, in the worktree `../spanish-diplomacy-v1-m3r1-<slug>` with its own `E2E_PORT`. Workers run the agentic loop on their own: build, test, fix, repeat.
- **Stream reviewer (`m3r1-<slug>-review`)**: before hand-off, a read-only agent checks the stream's diff against the decisions it owns. It reports correctness gaps only, not style.

**Checkpoints.** Each stream's tasks are grouped as checkpoints (CP1, CP2, ...). At the end of each, the worker:
- commits;
- appends to `project/milestones/m3r1-progress/<slug>.md`: what is done, the numbered decisions, the checks run with results, and what comes next;
- stops and hands back a short report.

The supervisor reviews it, and the integrator resumes the worker. A worker also stops early and hands back in two cases:
- it has tried the same failing check three times without progress;
- it needs to change a file another stream owns, beyond a one-line wiring change.

### 3.2 Phases and ports

| Phase | Stream | Branch | Port |
|---|---|---|---|
| 0 | `m3r1-contract` | `m3r1-contract` | 5301 |
| 0 | `m3r1-map-provinces` | `m3r1-map-provinces` | 5302 |
| 0 | `m3r1-sim-harness` | `m3r1-sim-harness` | 5303 |
| 1 | `m3r1-sub-territories` | `m3r1-sub-territories` | 5311 |
| 1 | `m3r1-d20-combat` | `m3r1-d20-combat` | 5312 |
| 1 | `m3r1-economy-builds` | `m3r1-economy-builds` | 5313 |
| 1 | `m3r1-recruit-replenish` | `m3r1-recruit-replenish` | 5314 |
| 2 | `m3r1-movement-rail-ports` | `m3r1-movement-rail-ports` | 5315 |
| 2 | `m3r1-air-generals` | `m3r1-air-generals` | 5316 |
| 2 | `m3r1-weather-timer` | `m3r1-weather-timer` | 5317 |
| all | integrator | `milestone-3-rev-1` | 5300 |

- Phase 0 streams run in parallel.
- Phase 1 starts when `m3r1-contract` and `m3r1-map-provinces` are merged.
- Phase 2 starts as phase 1 slots free up. At most four workers run at once.
- Each stream is cut from the integration branch at the time it starts.

### 3.3 Phase 0

#### `m3r1-contract`: types, schema, loader, skeletons, splits

**Owns:**
- `src/main/engine/types.ts`, plus any new `engine/types/*.ts`;
- the order union;
- `engine/phases/` (skeletons);
- `engine/modules.ts` (the module registry and plugin interface);
- `src/scenarios/**` (the move and the migration, apart from province geometry);
- `src/main/scenarios/{loader,registry}.ts` and `schema/**`;
- `project/specs/scenario-package.md` and `map-package.md`, version 2;
- the hotspot splits (H9);
- `project/budgets.json`, plus a check script;
- the UI slots: header slots, pane tab frame, map layer slots.

**Must not:** implement the rules of any phase-1 or phase-2 stream. Leave each phase as a skeleton that returns its input unchanged, plus `TODO(<stream slug>)` and a failing-free test that pins the pass-through.

- **CP1: types and schema.**
  - Spec v2 types and Zod schema for every system in section 1:
    - sub-territories, with capital, terrain, development, buildings, rail, port and the start control table;
    - connections with entry sub-territories;
    - unit types (unit type kind `ground`, `air` or `general`; values; effects list; training turns; requirements; allowed factions; allowed order kinds; symbol);
    - the generals roster;
    - the buildings and development catalogues;
    - resources and starting stocks;
    - the d20 table and grade catalogue;
    - weather zones and tables;
    - the calendar;
    - AI profiles;
    - the blunder rate;
    - the ruleset and rules modules.
  - The `GameState` v2 shape:
    - sub-territory holders;
    - development, buildings and queues per sub-territory;
    - rail and port levels;
    - treasuries;
    - training;
    - unit fatigue;
    - weather and calendar;
    - the generals roster index;
    - recon reveals;
    - raid income cuts.
  - The flat order union: Move with a path of legs (land, rail, sea), Withdraw, Replenish, Recruit, Build, AirMission and Sack.
  - Loader validation rules for each (the L-rules in the spec).
  - Regenerate `scenario.schema.json`.
- **CP2: the scenario folder.**
  - Move to `src/scenarios/spanish-civil-war-1936/`.
  - Write `src/scenarios/MANIFEST.md`.
  - Migrate Spain to `m3-modular` with real starting data for:
    - development levels, buildings, rail and ports per sub-territory (pending province ids: use the ids agreed with `m3r1-map-provinces`, listed in the declog);
    - unit types and their effects;
    - generals rosters (cite sources as today);
    - starting stocks;
    - the weather tables;
    - the d20 table;
    - AI profiles.
  - Migrate tiny-front to v2 with the `m2-strength` preset.
  - Every unit and value keeps a source or a design note, as today.
- **CP3: the engine skeleton.**
  - `engine/phases/<NN>-<name>.ts`, one per section 2 step, run in order by `resolveTurn`.
  - The `m2-strength` preset runs today's rules through the same pipeline: today's code moves into phases without changing behaviour, and every existing engine test passes.
  - The module registry and plugin interface.
  - Per-viewer state filtering, for hidden balances.
  - Seeded streams per roll kind.
  - `ai/orders/<kind>.ts` stubs, one per order kind.
- **CP4: the UI frame and the splits.**
  - Split the hotspot files (H9), with no behaviour change.
  - Add slots:
    - the header (date, timer, resources, readiness);
    - the territory pane tabs (Units, Build, Recruit), with Build and Recruit empty but present;
    - a sub-territory focus route in the pane;
    - map layers (sub-territories, rail, air), each an empty component.
  - Add the budgets file and its check.
  - All existing tests pass. Baselines may change only where the frame is visible.

#### `m3r1-map-provinces`: real sub-territory geometry

**Owns:**
- `scripts/fetch-map-sources.ts`, `scripts/build-map.ts` and `scripts/map/**`;
- `scripts/sources/**`;
- the sub-territory geometry in `map.json`;
- the map package schema additions for sub-territories (coordinate the type with the contract through the declog);
- `assets/maps/**`, with its checksums.

**Tasks:**
- Vendor geoBoundaries ESP ADM2 with a sha256 in `manifest.json`, and add attribution.
- Project and simplify the provinces, and write their paths, label points and capital points.
- Draw the splits by hand:
  - Baleares by island;
  - Asturias into Oviedo and the rest;
  - Madrid into 3, choosing historically sensible lines and recording them in the declog.
- Derive sub-territory adjacency, inside and across territory borders, and each connection's entry sub-territories.
- Emit them for the scenario package, so the contract can write them into `scenario.json`.
- Province ids are lowercase kebab-case province names, as in `ux-pass/provinces.json`.
- Agree the list with the contract early, and record it in the declog.

#### `m3r1-sim-harness`: the headless harness

**Owns:**
- `src/sim/**` (new);
- the `sim` and `sim:*` npm scripts;
- the Vite config entry for the CLI;
- `src/test/soak*` (replaced by the 10-game smoke run);
- `project/specs/sim-harness.md` (new).

**Tasks:**
- Build H1 to H4 and H6's reporting (with and without blunders) against today's `resolveTurn` and computer player.
- Read the engine through its public API only, so it keeps working when the contract lands.
- The harness owns the turn limit; the default is 66 turns.
- Variants are JSON patches.
- Keep the outputs: `build/sim/<run>/summary.json` and `games.jsonl`.
- The unit tests must not depend on Spain's balance numbers.

### 3.4 Phases 1 and 2: vertical slices

Each slice owns its phase modules, its AI module(s), its pane or map components, its style partial, and its spec rule section. Each delivers the engine, data, UI, computer player and tests together. A slice that needs a hook in another stream's phase adds it through the phase interface the contract defined. Any edit to a file another stream owns is listed in the hand-off.

| Stream | Decisions | Phases | UI |
|---|---|---|---|
| `m3r1-sub-territories` | W2, W3, W6, P1-P8, C1, C8 (pause only), X2, X3 focus | 6, 7, 8 | Sub-territory map layer; focus view; Attack and Withdraw in contested ground |
| `m3r1-d20-combat` | D1-D8, C2-C7, U6 | 4, 5, 7 combat math, 9 morale and fatigue | Battle card bands, battle icon tooltip, odds estimate, unit pills |
| `m3r1-economy-builds` | $1-$8 | 1 purchases, 10 builds, 11 | Header chips (X1), Build tab, focus-view build list, hidden balances |
| `m3r1-recruit-replenish` | R1-R7, C8 | 1 purchases, 9 replenish morale, 10 training | Recruit tab (X4), Replenish order, in-training units |
| `m3r1-movement-rail-ports` | M1-M6, P6 path use | 3, 6 withdraw legs | Move chips and card (X5), army summary, rail layer (X6), sea and amphibious moves |
| `m3r1-air-generals` | U1-U6 | 2, 5 support, 9 general deaths, 11 raid cuts | Air counters and missions (U2), NATO symbols, generals and sacking |
| `m3r1-weather-timer` | T1-T6 | 0 | Date, weather pill and forecast, weather on chips, setup timer, countdown, warnings, pause, readiness |

**Every slice:**
- implements H5 for its orders: `ai/orders/<kind>.ts`, with tests;
- adds its data to both packages, or explicitly leaves it off in tiny-front's preset;
- adds icons and symbols (X8);
- updates `project/specs/scenario-package.md` with its rules;
- adds `@capture` captures for its screens to `e2e/capture.spec.ts`, with the tag;
- checks its screens against the approved `images/ux-*.webp`.

## 4. Shared rules for every agent

Revision 7's section 3 applies:
- work only in your own worktree, with your own `E2E_PORT`;
- every commit passes lint, typecheck and unit tests, gated on exit codes;
- no baseline regeneration outside the integrator;
- ASCII sources, with `\u` escapes for accents and glyphs;
- the seeded generator for every random number;
- nothing from `project/` reaches the app, and nothing in the app mentions balance;
- do not paste large test output into hand-offs.

Before starting:
- run `npm ci` in your worktree;
- read this document, the three answer files for your decisions, and the matching `ux-*.webp` images.

**Hand-off report** (and each checkpoint report):
- what changed;
- numbered decisions and assumptions;
- checks run, with results;
- files outside your ownership that you touched;
- screenshots to look at (paths under `build/e2e/screenshots`).

## 5. Production bar

**Per stream, before hand-off:**
- lint, typecheck, and unit tests with coverage of at least 90 percent;
- build;
- `npm run test:e2e` on chromium and mobile-chromium, with visual baseline diffs the only allowed failures;
- axe clean on the stream's screens;
- the computer player uses every new order the stream adds (H5);
- the stream reviewer reports no open correctness gap.

**Integrator, at the end:**
1. Merge in the order contract, map-provinces, sim-harness, then the slices in finishing order. Every merge commit passes every check.
2. Regenerate the baselines once and review every changed image.
3. Run `npm run verify` from a clean checkout with `CI=1`, then the production smoke test.
4. Measure the initial chunk against the budget. Report an overrun; do not raise the budget.
5. Run the 1000-game harness report against H7 and report the result.
6. Write the declog, with every stream's numbered decisions and a rubric re-score.
7. Stop at a verified `milestone-3-rev-1`. The owner plays it before it is squashed onto `main`.

## 6. Not in Revision 1

- Political capital, foreign aid and focuses (Milestone 4).
- CI/CD, hosting, CLAUDE.md and hooks (Milestone 5).
- Online play: the 30-minute and 1-hour timers are shown disabled.
- Balance tuning beyond reporting (H7).
