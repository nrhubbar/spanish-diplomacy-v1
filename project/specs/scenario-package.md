# Scenario Package Specification (spec version 2)

A scenario package is the rules data for one playable scenario: factions, territories and how they connect, cities, units and their combat values, the combat rules' numbers, and victory parameters. The game engine interprets it; it contains no presentation. Its companion map package (`map-package.md`) holds everything visual.

- Machine-readable schema: `src/scenarios/scenario.schema.json` (JSON Schema draft 2020-12), generated from `scenarioSchema.ts` and its parts (`coreSchema.ts`, `modularSchema.ts`, `systemsSchema.ts`) by `npm run spec:build`. A unit test fails if the two drift. The schema has one variant per ruleset, so it states which blocks each ruleset takes.
- Version 1 is dropped: both packages were migrated in one commit (E1). A package with `specVersion: 1` fails to load.
- Reference packages: `src/scenarios/spanish-civil-war-1936/` (shipped, `m3-modular`) and `src/test/fixtures/scenarios/tiny-front/` (minimal test fixture, `m2-strength`). `src/scenarios/MANIFEST.md` describes the folder layout.

## Adding a scenario

1. Create `src/scenarios/<scenario-id>/` with `scenario.json` and `map.json`. Start each file with the `$schema` line, so editors validate as you type.
2. Put map assets anywhere under `assets/` and reference them by repository-relative path from `map.json`.
3. Run `npm run test:unit`. The contract tests load every package and report each problem with its JSON path and rule id. A package that fails validation is left out of the game and reported in a notification; it never crashes the app.

No code changes are needed, provided the scenario fits the `m2-strength` ruleset or the modules of `m3-modular` below. A scenario that needs different rules registers a named module (Milestone 3: through the scenario's own `plugin.ts`), and its `rules` value makes that explicit.

## Fields

All ids are lowercase kebab-case (`[a-z0-9]+(-[a-z0-9]+)*`) and are never shown to players.

| Field | Type | Meaning |
|---|---|---|
| `specVersion` | `2` | Spec version. |
| `id` | id | Scenario id; unique across packages. |
| `name` | text | Shown in the scenario picker. |
| `snapshotLabel` | text | Starting date or moment; shown on setup and turn 1 only. |
| `ruleset` | `"m2-strength"` or `"m3-modular"` | Rules the engine applies. Unknown values fail to load. `m3-modular` adds the fields in "Milestone 3 blocks" below; `m2-strength` takes none of them. |
| `map` | path | The map package, relative to this file. |
| `victory.territoryShare` | 0-1 | Share of victory-eligible territories that wins (rounded up). |
| `victory.cityShare` | 0-1 | Share of victory-eligible cities that wins (rounded up). |
| `victory.tieBreak` | list of `cities` / `territories` | Order in which qualifying factions are compared. |
| `combat` | see below | The numbers of the d6 battle rules: results table, below-1:1 rule, digging in, demoralization, faction modifiers. Required under both rulesets while `d6-table` is the only implemented dice module (decision CT-3 in `project/milestones/m3r1-progress/contract.md`). |
| `ai` | `{ blunderChance, profiles: { [factionId]: profile }, sources?, note? }` | E7, H6: one computer-player profile per faction (see "AI profiles"), and the chance, 0 to 1, that one computer order is a blunder. |
| `unitTypes[]` | `{ id, name, attack, defence }` | Unit types. `attack` and `defence` are positive whole numbers: the values of a full-strength army of the type (C4). Symbols come from the map package. |
| `factions[]` | see below | At least two. |
| `territories[]` | see below | At least two. |
| `connections[]` | `{ between: [id, id], kind: land or sea, label? }` | Undirected adjacency. |
| `cities[]` | `{ id, name, territoryId, countsForVictory, initialController? }` | Cities; a city without `initialController` starts unoccupied. |
| `units[]` | see below | Starting formations. |
| `sources[]` | `{ id, title, url? }` | Source catalog for historical data. |

Faction: `id`, `name`, `abbreviation` (1-4 characters, used on narrow screens), `color` (`#rrggbb`, the faction's identity color everywhere), `motivation` (one sentence on setup), `defaultActor` (`local-human` or `computer`), `objectiveTerritoryIds` (used by computer players), and `briefing: { objective, firstTurnHint }`.

Briefing: player-facing text shown in the in-map Briefing. `objective` says what the faction is fighting for and how it wins; if it states the victory numbers, they must match the thresholds the `victory` shares produce. `firstTurnHint` is shown on turn 1 only. It reads like an intelligence report and ends in a question: it gives the player ideas and a choice, never a move to copy. Neither field may mention balance or design intent.

Territory: `id`, `name`, `countsForVictory`, `initialControl` (`{ kind: "controlled", factionId }` or `{ kind: "contested", factionIds: [two or more] }`), and optional `isolated: { reason }` for a territory deliberately left without connections.

Unit: `id`, `name`, `factionId`, `type`, `formationKind` (`regiment`, `battalion`, `column`, `security`, `other`), `strength` (men at the snapshot) and `fullStrength` (men at full establishment; both positive whole numbers), `territoryId`, optional `cityId` (must be in the unit's territory; the counter is drawn at that city), `sources` (at least one `{ sourceId, reference? }`), optional `historicalNote`, and optional `designation` (the counter label, up to 4 capitals or digits; derived from the name when absent).

Combat (`combat`), every field required:

| Field | Type | Meaning |
|---|---|---|
| `table` | 7 lists of 7 results | `table[column][row]`. Columns are the odds: 0 is below 1:1, then 1:1 to 6:1. Rows are the modified roll, 0 to 6 (M15). Results are the seven keys of M16. |
| `belowOneToOne` | `{ kind: "halving", rollPenalty }` | Below 1:1 the attacker's roll takes `rollPenalty` (a whole number, 0 or more) for each halving of the odds (M14). |
| `diggingIn` | `{ perTurn, max }` | Defence roll bonus gained per turn of entrenching, and its cap; positive whole numbers (M22). |
| `demoralizationFactor` | above 0, at most 1 | Multiplier for a demoralized army's values (M12). |
| `factionModifiers[]` | `{ id, name, factionId, when, attack?, defence? }` | Named roll bonuses for one faction (M24). `name` is shown in battle breakdowns. `when` is `holds-controlled-city`. `attack` and `defence` are whole numbers, 0 or more, default 0; at least one is above 0. |

The shipped table is the prototype's, corrected so each odds step is exactly one result better for the attacker (C2): column `k` is `SEQ[k..k+6]` over `SEQ = AE AE AA AD BD BD DD DX DE DE DE DE DE` (attacker-eliminated, attacker-attrition, attacker-demoralized, both-demoralized, defender-demoralized, defender-exchange, defender-eliminated).

### AI profiles

`ai.profiles` is keyed by faction id, one profile per faction (E7), so a harness variant patches `/ai/profiles/<factionId>`; the blunder chance is `/ai/blunderChance`. A profile is `{ computer, offensive, stakes, victoryAlarm }`, the weights of today's computer player. `computer`: `approachObjective`, `bouncedLastTurn`, `caution`, `demoralizedShare`, `enemyLoss`, `ownLoss`. `offensive`: `reach`, `oddsTieBreak`, `staging`, `focus`, `stallStep`, `stallCap`. `stakes`: `city`, `objective`, `territory`. `victoryAlarm`: `perStep`, `steps`. `builds` (EB-15, required with an economy module, L27): `spendShare`, the share of each resource left after Recruit orders that Build orders may spend; `maxOrdersPerTurn`; and `itemsPerEmptyQueue`, the new items one sub-territory with an empty queue may take in a turn. The strategy logic stays in code.

## Milestone 3 blocks (`m3-modular` only)

Every block below is optional in the schema; the loader requires each one that a selected module reads (L15). Ids of sub-territories, resources, development tracks, buildings, grades, weather outcomes, seasons, zones, traits and generals are each their own namespace.

Every block and catalogue entry that carries numbers (`ai`, unit types, sub-territories, development tracks, buildings, `improvements`, `recruitment`, `movement`, `d20`, `weather`, `calendar`, `air`, `generals`) takes the same two optional fields: `sources` (citations, as on units) and `note` (a design note for numbers no source gives). Every number in data has one or the other; sub-territories must (L18).

| Field | Type | Meaning |
|---|---|---|
| `rules` | `{ dice, economy, recruitment, weather, movement, partition, air }` | E2: one module name per area. See "Rule modules". |
| `unitTypes[]` | see "Unit types" | W5: replaces the `m2-strength` unit type. |
| `factions[].startingStock` | resource amounts | $7: the treasury on turn 1. Required when `resources` is not empty (L24). |
| `factions[].seatTerritoryId` | territory id | D7: where a replacement general appears. Required with `generals` (L21). Factions also take `sources` and `note`. |
| `units[].generalId` | general id | U5: the roster general a unit of a `general` type stands for (L21). |
| `territories[].capitalSubTerritoryId` | sub-territory id | W3: the capital. Required with sub-territories (L16). |
| `territories[].weatherZone` | zone id | T2. Required with `weather` (L20). |
| `connections[].entry` | `[sub-territory id, sub-territory id]` | P8: the sub-territory entered on each side, in `between` order. Required with sub-territories (L19). |
| `cities[].subTerritoryId` | sub-territory id | The sub-territory the city stands in. Required with sub-territories (L16). |
| `subTerritories[]` | see below | W2, P1. |
| `subTerritoryBorders[]` | `[id, id]` | Undirected sub-territory adjacency, inside and across territories, generated from the map geometry. |
| `resources[]` | `{ id, name }` | $1: Funds and Manpower for Spain. Amounts elsewhere are `{ [resourceId]: whole number }`; a missing resource is 0. |
| `development[]` | `{ id, name, resource, yieldPerLevel, maxLevel, cityOnly, upgrade: { cost, turns } }` | $3: Farms, Mines, Industry. |
| `buildings[]` | `{ id, name, cost, turns, capitalOnly, cityOnly, upgradeOf?, effects[] }` | $4. Building effects: `recruit-slots { extra }`, `replenish-rate { share }`, `replenish-cap { share }`, `rail-departures { extra }`, `airbase`, `all-weather-airbase`, `defence-roll { roll }`. |
| `improvements` | `{ rail: { cost, turns, maxLevel }, port: { ... }, railDamageOnContest }` | $4, $8: the levelled rail (0-3) and port (0-2). |
| `recruitment` | `{ maxPerTerritory, replenishCostShare, replenishShare }` | R2, R5, D7. |
| `movement` | `{ landingsPerPortLevel, railRangePerLevel }` | M3, M5, D7. |
| `d20` | see below | D1-D7, C6. |
| `weather` | `{ outcomes[], seasons[], zones[] }` | T2, T4. |
| `calendar` | `{ start: { year, month, half }, turnsPerYear: 24 }` | T1: half-month turns; turn 1 is the start. |
| `air` | `{ raidTable[], interceptRoll, reconTurns, generalDeathRoll? }` | U2-U4; `generalDeathRoll` (0-20, absent means 0) is the d20 at or under which a general dies when his army is destroyed or routed (U5). |
| `generals` | `{ traits[], roster[] }` | U5. |

Sub-territory: `id`, `name`, `territoryId`, `terrain` (`open`, `mountain`, `swamp`), `startHolder` (P1: the holder on the start date, whatever the territory's controller), `development` (`{ [trackId]: level }`), `buildings` (ids), `rail` (0-3), `port` (0-2), and `sources` and/or `note` (every number has a source or a design note, L18).

Unit type: `id`, `name`, `kind` (`ground`, `air`, `general`), `attack` and `defence` (whole numbers, 0 or more), `symbol` (the NATO APP-6A function: `infantry`, `militia`, `security`, `artillery`, `cavalry`, `armour`, `transport`, `air-defence`, `fixed-wing`, `headquarters`; the map package still names the drawn asset), `orders` (the unit order kinds it may take: `move`, `withdraw`, `replenish`, `air-mission`, `sack`), `effects[]`, optional `recruit: { cost, establishment, trainingTurns, requires[], factionIds? }`, `air: { range, missions[] }` for air types only (L17), and `sources` and `note`. Unit effects (E6): `roll-bonus-per-points { role, per, bonus, max, exceptWeather[] }`, `cannot-attack-alone`, `transport { carries }`, `mobile`, `raid-defence { roll }`, `trains-in-contested`, `command-bonus { roll }`, `rally`, `battle-support { roll }`.

d20: `grades[]` (`{ id, name, attacker: { lossPercent, demoralized }, defender: { lossPercent, demoralized, weakestDestroyed }, ground }`, with `lossPercent` 0, 10, 20, 35 or 100, `demoralized` `none`, `half` or `all`, and `ground` 0, 1, 2 or `all`), `table` (7 odds columns by 21 modified scores, 0 to 20, of grade ids), `modifiers` (`worksPerTurn`, `worksMax`, `belowOneToOnePenalty`, `barricades`, `fatigued`, `amphibious`), `fatigue` (`fatiguedLevel`, `demoralizedLevel`), `breakUpShare`, and `factionModifiers[]` (as in `combat`).

Weather: `outcomes[]` (`{ id, name, attackRoll, effects[] }`, effects `blocks-digging-in`, `grounds-aircraft`, `movement-penalty { amount }`, `frostbite { share }`, `closes-sea { months }`), `seasons[]` (`{ id, name, months[] }`, covering each month once), and `zones[]` (`{ id, name, coastal, tables: { [seasonId]: [{ outcome, upTo }] } }`, each table running from the best weather to the worst and ending at 20).

Generals: `traits[]` (`{ id, name, effects[] }`, effects `roll-modifier { role, roll }` and `no-rally`) and `roster[]` (`{ id, name, factionId, trait, sources[] }`, in roster order).

### Rule modules

| Area | Built-in modules (the first is the `m2-strength` preset) | Blocks the module needs (L15) |
|---|---|---|
| `dice` | `d6-table`, `d20-graded` | `d20-graded`: `d20` |
| `economy` | `none`, `development` | `subTerritories`, `resources`, `development`, `buildings`, `improvements` |
| `recruitment` | `none`, `buildings` | `subTerritories`, `resources`, `buildings`, `recruitment` |
| `weather` | `none`, `seasonal-zones` | `weather`, `calendar` |
| `movement` | `single-step`, `allowance` | `subTerritories`, `movement` |
| `partition` | `none`, `provinces` | `subTerritories` |
| `air` | `none`, `missions` | `air` |

The catalogue is `src/main/engine/modules.ts`. Until its owning stream lands, a module runs its area's preset parts and pass-through skeletons: selecting it changes nothing in resolution.

### Cross-area hooks, turn scratch and what each player sees

- **Hooks.** A module may answer cross-area questions through `RuleModule.hooks` (`src/main/engine/hooks.ts`): `combatModifiers`, `allowanceDelta`, `canDigIn`, `grounded`, `incomeDelta`, `replenishBonus`, `recruitRequirements`, `validateOrder`, `orderVerdict` and `retreatAllowed`. The engine collects every selected module's answer in area order. The d6 rules already call `combatModifiers` (battles and planning estimates) and `canDigIn` (digging in), so a hook such as Snow stopping the works applies under the d6 preset too. With no hooks every collector is neutral.
- **Order validation, verdicts and retreats.** Each order kind belongs to the module that validates it, through `validateOrder`, a map from order kind to a validator typed for that kind: Move to the movement modules (one step under `single-step`, a route under `allowance`, then the demoralized rule), Recruit and Replenish to `recruitment: buildings`, Build to `economy: development`, Withdraw to `partition: provinces`, air missions to `air: missions`, and Sack to either air module. At reveal (M1, M9) the engine runs the owners' validators in area order, the first refusal winning; a kind no selected module owns is "not available in this scenario". An order its owner accepts may still be refused by any module's `orderVerdict` (C1: no move leaves contested ground); a verdict cannot make an unowned kind valid. `engine/validation.ts` only dispatches; `validateMoveOrder`, `legalDestinations` and the computer player all go through it. `retreatAllowed` must hold for every module before an army may retreat to a territory (M21); `settleDepartures` asks it for every candidate.
- **Turn scratch.** `TurnDraft.scratch` holds each area's turn-only data. An area declares its key in its own module file by declaration merging on `TurnScratch`, for example bombers assigned at step 2 and read at step 5.
- **Hidden information.** `viewFor` (state) and `outcomesFor` (outcomes) give what one faction may see. Every screen reads the session through `visibleSession`: the viewer is the faction whose turn it is, and a report goes to the one local player, or shows public information only. Computer players remember only the outcomes their faction could see. Private outcomes are income, queued, progressing, refunded and forfeited builds, training, replenishment and recon results; each is shown to its own faction, and to a viewer whose recon reveals that territory this turn.
- **Blunders (H6).** Each order a computer player plans draws once from its blunder stream. A draw below `ai.blunderChance` replaces the order with a uniformly chosen legal alternative for the same unit, or with its default order.

### Outcomes

A turn reports one flat list of outcomes (`TurnResolutionResult.outcomes`), plus `subTerritoryChanges` for every sub-territory that changed hands (by occupation, a battle's ground, or the contested sweep). The types are split by area under `src/main/engine/types/outcomes/` (moves, battle, morale, recruitment, economy, contested, air, generals, weather) and joined into one union in `types/outcomes.ts`. Each area file exports its own union, and `SystemOutcome` joins them. A battle is a `d6` or a `d20` variant: the d6 one has the die (1-6), the row (0-6) and a result; the d20 one has the die (1-20), the score (0-20), a grade id and the ground taken (0, 1, 2 or all). For both, `losses` (men lost and units destroyed) and `demoralizedUnitIds` are the one record of what the battle did to units. Battle modifiers add `general`, `trait`, `barricades`, `unit-bonus` (artillery, tanks), `fatigue`, `weather`, `amphibious`, `air-support` and `building` to the Milestone 2 kinds.

## Validation rules

The loader applies these when the app starts. Each failure names the JSON path and the rule.

| Rule | Requirement |
|---|---|
| L1 | Valid against the schema; `specVersion` and `ruleset` supported. This includes the shape of `combat` (a 7 by 7 table of known results and the ranges above), unit type values, and unit strengths. |
| L2 | Ids are unique within each collection, including `combat.factionModifiers`. |
| L3 | Every reference resolves (factions, territories, cities, unit types, sources, objectives, faction modifiers' factions). |
| L4 | A unit's `cityId` is in the unit's territory. |
| L5 | Contested control lists at least two distinct factions. |
| L6 | No self-connections or duplicate connections. |
| L7 | Every territory has a connection, unless it is declared `isolated`; an isolated territory has none. |
| L8 | Every faction starts with at least one unit or controlled territory. |
| L9 | No faction starts at or above a victory threshold. |
| L10 | The map package covers every territory, city, and unit type (see `map-package.md`). When the map lists sub-territory entries, they match the scenario's sub-territories one to one, each in the same territory. |
| L11 | Every asset the map package names exists. |
| L12 | A unit's `strength` is no greater than its `fullStrength`. |
| L13 | Every faction modifier changes something: its `attack` or `defence` is above 0. |
| L14 | `m3-modular`: every `rules` module is a known module for its area. |
| L15 | `m3-modular`: every block a selected module needs is present (and not empty, for lists). |
| L16 | With sub-territories: every territory names a capital sub-territory of its own, and every city names a sub-territory of its own territory. |
| L17 | Air unit types, and only they, carry `air`; buildings, factions and weather outcomes that a unit type names exist. |
| L18 | Every sub-territory has sources or a note; development levels are within their track's `maxLevel`, city-only tracks are above 0 only where a city stands; buildings exist, are listed once, respect `capitalOnly`, `cityOnly` and `upgradeOf`; rail and port are within the improvement caps. |
| L19 | Sub-territory borders join two known, different sub-territories once; with sub-territories, every connection names an entry on each side, inside that side's territory. |
| L20 | With `weather`: every territory names a known zone; seasons cover each month once; every zone has a table for each known season, rising to 20, naming known outcomes. |
| L21 | With `generals`: traits and sources resolve; every faction has 3 to 5 generals and a known seat territory. Units of a `general` type, and only they, name a roster general of their own faction, each fielded once. |
| L22 | `d20`: the table names known grades; `fatiguedLevel` is below `demoralizedLevel`; `worksPerTurn` is at most `worksMax`; d20 faction modifiers name known factions. |
| L23 | `ai.profiles` has one profile for each faction and none for unknown factions. |
| L24 | Every resource amount names a known resource; with resources, every faction has a `startingStock`. |
| L25 | `air.raidTable` rises to 20. |
| L26 | With the `provinces` partition module: a territory's `initialControl` matches its sub-territories' start holders (one holder: controlled by it; two or more: contested by exactly them), and a city's `initialController` is its sub-territory's start holder. |
| L27 | With an economy module other than `none`, every AI profile has a `builds` budget. |

## The `m3-modular` ruleset

`m3-modular` resolves a turn as the ordered steps of tasks section 2, one file per step in `src/main/engine/phases/` (`00-weather` to `12-victory`). Each step runs the engine's own part (step 1, reveal; step 12, victory), then each selected module's part in area order (`dice`, `economy`, `recruitment`, `weather`, `movement`, `partition`, `air`). A module names the data blocks it needs and its parts of each step; the engine's own modules are one file per area under `src/main/engine/modules/`, joined in `src/main/engine/modules.ts`. Parts run in area order, each on the draft the previous part returned, so a later area cannot undo an earlier one: a rule that must shape an earlier part (Snow blocking digging in, read by the dice module's morale part from `systems.weather`) is read inside that part. a scenario's optional `plugin.ts` exports `plugin: { modules }` and registers modules through the same interface, and a name registered twice is a package problem. The presets carry today's rules: `d6-table` takes steps 4, 5, 7 and 9, `single-step` step 3, partition `none` steps 6 and 8. Until each slice lands, its Milestone 3 module runs its area's preset parts plus pass-through skeletons, so a package moved to `m3-modular` plays as it did. Orders are one flat list per faction (E8): Move (with an optional path of `land`, `rail` and `sea` legs; absent means one step), Withdraw, Replenish, Recruit, Build, AirMission and Sack. A Build order is handled by the `development` economy module (below). A Move whose path is more than one step, and every other kind whose module has not landed, is not yet available: a move is an impossible order (M9), and any other order is reported as `rejected-order` without disbanding anything.

Every roll kind draws from its own seeded streams, `deriveSeed(game seed, tag, turn, index)`, with one tag per kind: battle (the M26 tag, so battle rolls are unchanged), weather, raid, general death and blunder (`src/main/engine/dice.ts`). A faction sees the state through `viewFor` (`src/main/engine/visibility.ts`): other factions' treasuries, queue items and units in training are hidden unless its recon reveals their territory this turn ($6, U4); the computer player plans on that view.

### Air and generals (module `air: missions`, `m3r1-air-generals`)

- **Pieces (W5, AG-3).** Aircraft (`kind: air`) and generals (`kind: general`) are units. Only ground units march, fight, retreat and hold ground: the air module's step-1 part sets aircraft and generals aside after the reveal, and its step-9 part puts them back. A unit takes only the order kinds its type lists, so aircraft never move.
- **Airbases (U2).** A territory is an airbase for a faction when the faction holds a sub-territory there with an `airbase` or `all-weather-airbase` building, and no other faction controls the territory whole. An aircraft flies one mission a turn to a territory within `air.range` connections (land and sea), from an airbase. Before it flies, the `grounded` hook may ground it (weather).
- **Missions (U2-U4, D7).** Missions resolve at step 2, in unit id order.
  - **Recon** targets a territory another faction holds some of. It adds a reveal until `turn + reconTurns`.
  - **Intercept** names a territory. Each enemy fighter intercepting over the raid's territory adds `interceptRoll` to the raid's roll.
  - **Raid** targets a sub-territory another faction holds.
    - It rolls a d20 from the `raid` stream (index: the raid's order in the turn), plus the best `raid-defence` among other factions' units in the territory and the interceptions, clamped to 1-20, and reads `raidTable`.
    - Air eliminated: the raider is lost; with fighters there, the interception names it.
    - Income cut: a `RaidCut` for the next turn. The `incomeDelta` hook removes that sub-territory's development yield from its holder when he holds the territory whole. The air module's step-11 part drops spent cuts and reveals.
    - Building hit: a building chosen by the stream's next draw is destroyed, or a paved airfield falls back to the building it upgrades. Without buildings, the highest development level drops by one.
  - **Support** names a territory. The bombers' best `battle-support` roll counts once per side, through `combatModifiers` (`air-support`). The battle parts pass the turn's scratch to the hook.
- **Generals (U5, U6, D5, D7).**
  - **Command.** Each side's best general gives his `command-bonus` and the `roll-modifier` of his trait for the side's role. The best general has the highest bonus, then the earliest roster place.
  - **Where he fights.** In a battle, a general counts where he goes this turn: where he moves, or where he stands. In a planning estimate, he counts where he stands or among the attacking units.
  - **His army.** The ground units of his faction moving with him (same origin and destination) or holding with him.
  - **After the battles (step 9):**
    - He arrives where his army arrived, or stays put.
    - When his whole army was destroyed, retreated or surrendered, or he stood alone in ground the enemy took, he rolls a d20 from the `general-death` stream and dies at or under `generalDeathRoll`. A survivor follows the retreat, or goes to the seat (else the first territory his faction controls).
    - The best general with each army rallies its demoralized units, unless his trait is `no-rally`.
  - **Sack** is a free order for one's own general. He leaves at once.
  - **Replacements.** After a sacking or a death, the next roster entry not in play or on his way is due. He appears at the end of the next turn in the seat territory (else the first controlled territory) as unit `general-<generalId>`, whose definition derives from the id.
### Partition (`provinces`): sub-territories and contested ground

The `provinces` module (`src/main/engine/modules/partition.ts`, rules in `src/main/engine/partition/`) flips `systems.subTerritories[*].holder` (rail damage, $8, is the economy's EC-8, read from those holders) and replaces M6, M7 and the control part of M18 for `m3-modular`. Armies still move between territories and battles are territory-wide (P2); sub-territories decide control.

| Rule | Behaviour |
|---|---|
| P1 | Each sub-territory starts with its `startHolder`. Territory and city control are derived from the holders, never from armies: one holder controls the territory whole, two or more contest it (W6); a city follows its own sub-territory's holder. L26 keeps `initialControl` equal to that derivation. |
| P3 | Occupation (step 6): one faction alone in a territory it entered this turn, where other factions held every sub-territory, takes all of them (M6). The sweep (step 8): where one faction alone has armies and other factions still hold ground, it takes one of their sub-territories a turn, including on the turn it enters. |
| P4 | A battle's ground flips from the outside in: the defending factions' sub-territories nearest the attack's origin first (breadth-first over `subTerritoryBorders` and each connection's `entry` pair, from every sub-territory of the origin territories, or from the attacker's own ground for a standing battle or the sweep), the capital last, ties in scenario order. A d20 battle states its ground (0, 1, 2 or all) and its attacker gains it; with the d6 preset a taking result (the territory `taken`) is "all", gained by the occupier. Only the defending factions lose ground; a third holder with no army there keeps it until the sweep. |
| P5 | A partial grade takes nothing where the territory has one sub-territory (a stalemate). Defenders who keep ground stay; the dice module decides who retreats. |
| P6 | A forced retreat (M21) or a Withdraw needs a path: a sub-territory its faction holds in the territory it leaves that borders (or is the connection entry of) one it holds in the destination. Holders are judged at the start of the turn, as M21 judges control. Without a path to any candidate the army surrenders; a surrender that only the path rule caused is reported as `path-surrender`. |
| P7 | Victory counts a territory only when one faction holds all of it: control is derived that way, so `victory.ts` needs nothing more. |
| C1 | In a contested territory (judged at the start of the turn) units attack by default, the M27 standing battle (hold, when demoralized), or withdraw. A Move out of contested ground is refused (`orderVerdict`), so planning and computer players never offer it; works do not grow there (`canDigIn`). Withdraw goes to an adjacent territory the faction holds whole, along P6; units withdraw at step 6, after defending in step 5, and are reported as `withdrew`. If another faction's army now stands in the destination, they fall back as in M21, or surrender. |

`isContested(scenario, state, territoryId)` (`partition/holders.ts`) is the one test of contested ground for every slice: training pauses (C8), Replenish, Recruit and build queues. Every sub-territory that changes hands is listed in `subTerritoryChanges` with its cause (`occupation`, `battle` or `sweep`).

### Economy: the `development` module (`m3r1-economy-builds`)

Code: `src/main/engine/economy/` (rules), `engine/modules/economy.ts` (wiring), `ai/orders/build.ts` (computer player).

| Rule | Behaviour |
|---|---|
| EC-1 ($1) | Each faction has a treasury of the scenario's `resources`, starting at its `startingStock` ($7). Balances carry over without limit ($6). |
| EC-2 (W6, $2) | A territory is held whole when one faction holds every one of its sub-territories, and contested when two or more do. This is read from sub-territory holders, not from the Milestone 2 territory control. |
| EC-3 ($2, $3) | Step 11: a faction's income is the sum, over the sub-territories of the territories it holds whole, of each development level times its track's `yieldPerLevel`, in the track's resource. A contested territory pays nobody. The `incomeDelta` hooks (raid cuts, U3) then change it, never below 0. The header's preview is the same function. |
| EC-4 ($4, $5) | A Build order queues one project in one sub-territory: a building, one development level, or one level of rail or port. It is valid when the faction holds the sub-territory, the territory is not contested, the project respects `capitalOnly`, `cityOnly`, `upgradeOf` (the base built or queued) and the maximum level counting items already queued, a building is neither built nor queued, and the treasury covers the price. |
| EC-5 ($5) | Step 1: valid Build orders are paid in full and appended to the queue, in submission order, against a running ledger. An order the remaining balance cannot cover, or a second order for the same thing, fails as a private `build-refunded` with an empty refund (nothing was paid), so other factions do not see it ($6). The economy part runs before recruitment's, so builds are paid before Recruit orders. |
| EC-6 ($5) | Step 10: only the head of each queue progresses, by one turn, and an item queued this turn progresses at once (a 2-turn building ordered on turn t stands at the end of turn t + 1). A finished item applies (the building stands, or the level rises by 1) and leaves the queue. A queue in a contested territory pauses. |
| EC-7 ($5) | Step 10, before progress: in a sub-territory that changed hands this turn, the head item, if it has made progress, passes to the new holder with its progress, and its payment is lost (`build-forfeited`). Every other item is refunded to the faction that queued it (`build-refunded`). Buildings are captured intact. |
| EC-8 ($8) | Step 10: a territory held whole at the start of the turn and contested at its end loses `railDamageOnContest` rail levels, never below 0, in every sub-territory not held by its former whole holder (`rail-damaged`). Repairing is an ordinary rail Build order. |
| EC-9 ($4) | Building effects reach other areas through the hooks: `defence-roll` (Fortifications) in a sub-territory a defender holds in the battle territory takes its roll off the attacker's die, the strongest one once per battle (modifier kind `building`); `replenish-rate` and `replenish-cap` in sub-territories of the unit's territory its faction holds add to `replenishBonus`, each building once. `recruit-slots`, `rail-departures`, `airbase` and `all-weather-airbase` are read by their own areas. |
| EC-10 ($6) | Other factions' treasuries and queue items are hidden (`viewFor`, `outcomesFor`); income and build outcomes are private to their factions. |

### Recruitment module `buildings` (R1-R7, C8)

- **RR1. Where.** A Recruit order names a territory and a unit type. It is valid when the faction controls the territory, holds its capital sub-territory, and the territory is not contested (W6: territory control is contested, or two factions hold its sub-territories). Contested ground takes no new Recruit orders (C8).
- **RR2. What.** Every type with a `recruit` block is listed. A type is locked when `recruit.factionIds` leaves the faction out, when the capital sub-territory lacks a building in `recruit.requires`, or when a `recruitRequirements` hook names a reason. A type with no `requires` (militia) needs no building.
- **RR3. How many (D7).** A territory takes at most `recruitment.maxPerTerritory` Recruit orders a turn, plus the `extra` of every `recruit-slots` building in its capital. Orders past the limit are refunded at reveal.
- **RR4. Paying (step 1).** After the economy's builds, Recruit and Replenish orders are paid in submission order. An order the balance cannot cover is refunded (`training-refunded`, `replenish-cancelled`), and nothing is taken.
- **RR5. Training (step 10, R4, R7).** A paid Recruit starts training with `recruit.trainingTurns` turns left. Each step 10 takes one turn off, including the turn of the order, so a one-turn militia appears at the end of the turn it was ordered and moves the next turn. A unit appears in its territory at full establishment, healthy, with fatigue 0.
- **RR6. Contested training (C8).** If the territory is contested at step 10, types with the `trains-in-contested` effect advance; the rest pause (`training-paused`, once) and resume when it is uncontested. If the faction loses the capital sub-territory, the training is lost with its payment, like a build in progress ($5).
- **RR7. Recruited units (R6).** A recruited unit's id is `r_<faction>_<type>_<serial>`, the serial counting that faction's units of that type raised or in training. Its definition (`GameState.raised`) is derived from the id: the type's name with "No. <serial>", and the type's establishment as full strength. Recruited units follow every scenario unit in scenario-order tie-breaks. Destroyed and surrendered units never return.
- **RR8. Replenish (R5).** A unit whose type allows `replenish` may replenish in uncontested territory its faction controls, when it is below full strength or demoralized. It restores at most `replenishShare` of its full strength a turn, plus the `rateShare` and `capShare` of the `replenishBonus` hook (Hospital, Depot). Its price is `replenishCostShare` of the type's Recruit cost times the share of full strength restored, rounded up per resource. It is paid at step 1. At step 9, after the dice module's morale part, the men arrive and demoralization clears; if the unit fought any battle this turn (meeting, territory or standing), fell back, or was lost, the order is cancelled and refunded.

### Calendar, weather and the turn timer (`seasonal-zones`, T1-T6)

- **Date (T1).** Turn 1 is `calendar.start`. Each later turn is the next half-month, 24 a year. The date derives from the turn number and is never stored; it reads "Turn 7 · Late October 1936" wherever the turn is shown.
- **Roll (T2).** Before anyone plans a turn (step 0), the coordinator sets `GameState.weather`: one d20 from the weather stream, `deriveSeed(seed, weather, turn, 0)`, read against every zone's table for the season holding the turn's month. Each table runs best to worst, so one roll moves the whole map the same way. The roll is a pure function of the seed and turn, so replays match. Inside `resolveTurn`, step 0 only reports `weather-rolled` from the start state.
- **Forecast (T3).** Next turn's chances in a zone come from next turn's season table. They are never taken from the seeded roll.
- **Effects (T4).** These use the start-of-turn weather of a territory's zone, through the hooks:
  - `combatModifiers`: the battle territory's `attackRoll`, under `d20-graded`. Under `d6-table` it is a third of that, truncated (Q-WX-6). A zero adds nothing.
  - `canDigIn`: false with `blocks-digging-in`.
  - `allowanceDelta`: minus `movement-penalty.amount` at the origin. The movement module keeps the allowance at 1 or more.
  - `grounded`: true with `grounds-aircraft`, unless the aircraft's faction holds a sub-territory of that territory with an `all-weather-airbase` building.
- **Sea closure.** A sea connection is closed when a coastal zone at either end has an outcome whose `closes-sea` lists the turn's month (`isSeaConnectionClosed` in `engine/weather.ts`).
- **Frostbite.** At step 9, a unit with a valid move whose origin or destination has `frostbite` loses that share of its men, rounded to the nearest man. This produces a `frostbite` outcome.
- **Turn timer (T5, T6).** This rule applies to every ruleset. A submission may carry `timedOut: true`, set when the player's planning clock ran out. The engine then reports `time-ran-out` at step 0, with the faction's units that had no unit order (`heldUnitCount`). The clock itself lives only in the UI; the engine never reads time.

## The `m2-strength` ruleset

Each turn every faction submits orders in secret; all orders resolve together against the start-of-turn state. Armies have men (`strength`), morale, and values; territories can be dug in. Rule ids M1-M10 keep their Revision 5 meaning where they survive. Revision 5's movement-only rules M3, M4, M5, and M8 are retired: the battle rules M11 and M17-M21 replace them, and their ids are not reused.

**Status.** Every rule is enforced by the resolver (`src/main/engine/resolution.ts` and the modules it calls). The arithmetic of M12-M16 and M24 lives in `src/main/engine/combat.ts`, including `estimateAttack`, which planning uses for odds (C15) and which a test keeps consistent with resolution.

| Rule | Topic | Status |
|---|---|---|
| M1, M2 | Orders and moves | Now |
| M6, M7 | Taking and changing control | Now |
| M9 | Impossible orders | Now |
| M10 | Victory | Now |
| M11 | Reinforcement | Now |
| M12-M16 | Values, odds, modifiers, table, results | Now |
| M17-M19 | Battles, occupation, several entrants | Now |
| M20 | Head-on meeting battles | Now |
| M21 | Returns, retreats, and surrender | Now |
| M22 | Digging in | Now |
| M23 | Morale | Now |
| M24 | Faction modifiers | Now |
| M25 | No recovery of men | Now |
| M26 | Resolution order | Now |
| M27 | Standing battles in shared territories | Now |

### Orders and movement

| Rule | Behavior |
|---|---|
| M1 | Orders are validated against the start-of-turn state. An army takes at most one order; without one it holds. |
| M2 | A move must follow a connection from the army's current territory. Land and sea connections behave alike. |
| M6 | An unopposed move takes control of its destination, including a contested one. |
| M7 | After movement and battles, a territory changes hands when exactly one faction has armies there and either the set of factions present changed this turn or one of that faction's armies ended the turn there having started elsewhere. Its cities follow. Holding never changes control. |
| M9 | An army with an impossible order, or with more than one order, is disbanded. Planning and computer players never offer such orders. |
| M10 | Victory is checked last. A faction meeting either threshold qualifies; `tieBreak` orders qualifiers; a remaining tie is a shared victory. |

Friendly armies never obstruct each other. Armies of one faction may enter the same territory, join friendly armies there, follow a friendly army out, swap, or move in a chain or ring. Only armies of another faction cause a bounce or a battle. An army moving into a territory where armies of its own faction defend after the meeting battles joins them, as a reinforcement does (M11).

Every valid move is reported once: as a reinforcement (`reinforcement-arrived`), an unopposed move (`successful-move`), a move that bounced without a battle (`bounced-move` or, after a surrender, `disbanded-move`), or through the battles its army fought in, which list it as an attacker or defender. A meeting winner may appear in two battles, and a winner that then enters unopposed is also reported as a successful move.

### Battles

**M11. Reinforcement (C10).** A move is a reinforcement when its faction controls the destination at the start of the turn, or when an army of its faction is in the destination and does not move out (OD-7). A reinforcement always arrives: it is never bounced and never fights on the way in. It joins the defence of its destination in that turn's battles.

**M12. Values (C4, C5, C6).** Every army is its own instance with its own men and morale. Its attack (or defence) value is its type's attack (or defence) x `strength / fullStrength`, x `demoralizationFactor` when demoralized, rounded once to the nearest whole number (halves round up), and never below 1. A side's value is the sum of its armies' rounded values; all armies of one faction in one battle form one side, whatever their origins. Attackers use attack values and defenders defence values, except where M19 says otherwise. What a counter shows is exactly what fights.

**M13. Odds (C2, C3).** Odds are rounded in the defender's favour. At or above 1:1 they are `floor(attack / defence)`:1; below 1:1 they are 1:`ceil(defence / attack)`. So 5 against 3 is 1:1, 2 against 3 is 1:2, and 2 against 7 is 1:4. The table column is the odds up to 6:1 (columns 1 to 6), or column 0 below 1:1.

**M14. Roll modifiers.** The attacker's die roll changes by:
- each faction modifier of the attacker (M24): plus its `attack`;
- the defenders' works (M22): minus the dug-in level;
- each faction modifier of a defender (M24): minus its `defence`;
- odds above 6:1: plus one for each step beyond 6 (8:1 is +2);
- odds below 1:1: minus `belowOneToOne.rollPenalty` for each halving of the rounded odds (C3). 1:2 and 1:3 are one halving, 1:4 to 1:7 two, 1:8 three.

Every modifier is reported by name in the battle's breakdown (C14).

**M15. The table.** The table row is the die (1 to 6) plus every modifier, clamped to 0..6; the result is `table[column][row]`. Row 0 is reached only with a net negative modifier. With the shipped table, 2:1 without modifiers takes the territory one time in two, and 3:1 against a defender dug in at +3 one time in six.

**M16. Results (C2a).** Attrition and demoralization are different, and attrition is worse.

| Result | Effect |
|---|---|
| `attacker-eliminated` | Every attacking army is destroyed. |
| `attacker-attrition` | The attackers pay attrition worth the defenders' value. Survivors return (M21). |
| `attacker-demoralized` | The attackers are demoralized and return (M21). |
| `both-demoralized` | The defenders are demoralized and stay. The attackers are demoralized and return. |
| `defender-demoralized` | The defenders are demoralized and every defending army retreats (M21). The attackers claim the territory (M18). |
| `defender-exchange` | Every defending army is destroyed. The attackers pay attrition worth the defenders' value, and the survivors claim the territory. |
| `defender-eliminated` | Every defending army is destroyed. The attackers claim the territory. |

The last three are the attacker's successes; the chance to take a territory is the chance of rolling one of them.

- *Attrition.* The paying side loses men worth the opposing side's value (its M12 side value, before modifiers). One point costs `fullStrength / base` men of the army that pays, where `base` is the type value it fought with: a 740-man regiment rated 4-6 loses 185 men per point when attacking. The army with the highest value in the battle pays first (ties: more men, then scenario order). An army can pay at most the points it holds, `base x strength / fullStrength`; an army left holding under one point is destroyed, and the rest of the debt passes to the next army. Men lost are rounded to the nearest man. Debt beyond the whole side is dropped.
- *Demoralization.* Armies are demoralized from the weakest up (lowest value in the battle; ties: fewer men, then scenario order) until the demoralized armies carry at least half of the side's value. A side with one army demoralizes it. An army that is already demoralized restarts its clock (M23). On `defender-demoralized` only those armies are demoralized, but every defending army retreats.
- *Reporting.* A battle reports the losses, demoralizations, retreats, and surrenders it caused. Where several battles share defenders (M17), each effect on the defenders is reported once, in the first battle by index that caused it, and a demoralization is not reported for defenders another battle destroyed. Surrendered armies are listed as surrendered, not as losses.

**M17. Battles in a defended territory (section 1.6 step 1, C8).** A territory is defended when an army of a faction other than the mover's is in it at the start of the turn and does not move out, or arrives there as a reinforcement (M11). Every army of one faction that moves into it, and is not a reinforcement, attacks it as one side. The defenders are every army of the other factions there, including the loser of a head-on meeting battle that returned home (M20); armies of several factions defend together as one side. Each attacking faction fights the defenders in a separate battle, and every battle uses the same values, those after the meeting battles (M20), so the order never matters. The defenders take every result they receive: losses add up, any demoralizing result demoralizes them, and any result that removes them from the territory removes them.

**M18. Who occupies (section 1.6 step 2).** Attacking factions whose battle succeeded, and which have an army left, claim the territory. With one claimant, it moves in. With several, the claimant with the greatest attack value left after its own losses (M12, recomputed) moves in, and the others return (M21) without further loss. With a tie for greatest, every claimant returns and the territory is left empty. Without a claimant, the defenders hold; if no defender is left either (an exchange that also destroyed every attacker), the territory is left empty.

**M19. Empty territory, several factions entering (section 1.6 step 3).** When no army stays in a territory, no entrant is a reinforcement, and two or more factions move in, the entrant with the greatest attack value stands as the defender, using its attack values as its defence with no works; faction modifiers apply. Each other entrant fights it as in M17, and M18 decides who occupies; if the standing entrant holds, it moves in and takes the territory. A standing entrant driven off (`defender-demoralized`) never got in: it returns to its origin like a failed attacker (M21). With a tie for greatest, every entrant bounces with a `standoff` and returns (M21). A single entrant is unopposed (M6).

**M20. Head-on (C9).** When armies of exactly two factions move along one connection in opposite directions, they meet on the road. Reinforcements (M11) are never on the road: they pass a hostile move without meeting it. Each faction's movers on that road form a side. The side with the greater attack value attacks; the other defends with its defence values. Meeting battles have no works and no faction modifiers. With equal attack values there is no battle and both sides bounce. On a success the attacker wins; on `attacker-eliminated`, `attacker-attrition`, or `attacker-demoralized` the defender wins; on `both-demoralized` neither wins and both bounce. The winner continues its move as if the road were clear and is resolved against its destination like any other move (M11, M17-M19). The loser bounces, takes its result, and returns to its origin, where it defends if attacked. With more than two factions moving along one connection in opposite directions, every move that meets another faction's bounces without a battle. Every army that bounced on the road, with or without a battle, is back at its origin before the territory battles and defends it (M17).

**M21. Returns, retreats, and surrender (C11, replaces M8).**
- An attacker that does not occupy, a driven-off standing entrant (M19), and an army whose entry bounced (M19) return to their origin. If another faction took the origin, that is, an army of another faction that started the turn elsewhere stands there after the battles, the army retreats from there instead.
- A retreating army moves to an adjacent territory that its faction controlled at the start of the turn and that no army of another faction occupies after the battles, choosing the one holding the most armies of its faction (ties: scenario order). Every choice is made against the same snapshot, before any army retreats, so armies of one faction retreating from one territory move together and the order never matters.
- With nowhere to go, the army surrenders: it is destroyed and reported as surrendered.
- Armies in a battle report their retreat or surrender in its battle outcome. An army whose entry bounced without a battle (M19) reports it in its move outcome: a bounced move names where it fell back (`retreatedTo`), and a surrender is a disbanded move naming the faction that took its origin. Head-on bounces (M20) defend their origin, so any retreat of theirs is reported by the battle there.

**M22. Digging in (C7).** Every army has exactly one order each turn: Move, Entrench, or Rest. Entrench and Rest are not submitted: an army without a move order entrenches when it is healthy and rests when it is demoralized (M23), so submissions stay lists of move orders (M1). A demoralized army can never entrench. A faction holds a territory when it controls it and has an army there. At the end of each turn, a territory gains `diggingIn.perTurn` levels of works for its holder, up to `diggingIn.max`, when:
- the same faction held it at the start and at the end of the turn;
- no battle was fought there; and
- at least one of the holder's armies entrenched there: it was there and not demoralized at the start of the turn, had no valid move order, and is still there at the end.

Otherwise the territory keeps its level, so a territory that was fought over, or whose only armies moved or rested, gains nothing. Works are removed when their faction no longer holds the territory. Meeting battles (M20) are fought on the road, not in a territory. The works give the defenders their level as a defence modifier (M14) whenever the works' faction is among the defenders, except in head-on (M20), entry (M19), and standing (M27) battles.

**M23. Morale (C6).**
- A demoralized army fights at `demoralizationFactor` times its values (M12) and cannot attack: it may move only into a territory where no army of another faction stands at the start of the turn. Any other move is an impossible order (M9); planning and computer players offer only the allowed destinations.
- A demoralized army without a move order rests (M22). It has rested in a turn when it had no move order, did not retreat, and was not demoralized that turn. At the end of each turn, a demoralized army that rested recovers and is reported as recovered: one turn of rest is enough. A demoralized army that moves restarts its count, and a new demoralization restarts it too, so `quietTurns` stays 0 while an army is demoralized.

**M24. Faction modifiers (C17).** A faction modifier adds its `attack` to the roll when its faction attacks and subtracts its `defence` when its faction is among the defenders, while its condition holds. `holds-controlled-city`: the battle territory contains at least one city the faction controlled at the start of the turn. The Spain scenario's "Popular resistance" (Republic, +1 defence) is one; battle breakdowns name it like any other modifier.

**M25. No recovery of men (C13).** In Milestone 2 an army's strength never rises, and destroyed or surrendered armies never return. Only morale recovers (M23). Recruitment and reinforcements arrive in Milestone 3.

**M26. Resolution order.** One turn resolves in this order:
1. Orders (M1, M2, M9, M23).
2. Reinforcements arrive (M11).
3. Head-on meeting battles (M20).
4. Battles in defended territories, and in empty territories that several factions enter (M17-M19).
5. Results (M16) and occupation (M18).
6. Returns, retreats, and surrender (M21).
7. Standing battles in shared territories (M27), and their retreats (M21).
8. Control (M6, M7).
9. Morale recovery (M23) and digging in (M22).
10. Victory (M10).

Each battle rolls one die from its own seeded stream, `deriveSeed(game seed, battleStreamTag, turn, battle index)`. The tag (`0x62617474`, in `engine/dice.ts`) keeps battle streams apart from the computer players' streams, `deriveSeed(game seed, turn, faction index)`. Meeting battles are indexed first, then territory battles, then standing battles. Meetings are ordered by the lower id of their two territories, then by attacking faction id, then by the higher territory id; territory battles by territory id, then by attacking faction id; standing battles by territory id. Ids compare by code unit, never by locale. The die is the stream's first draw; a standing battle's tie-break rolls come after it. The same seed always replays the same game.

**M27. Standing battles (D29).** After the territory battles and their retreats, factions that still have armies in one territory fight there, once per territory per turn.
- A faction's standing attack is the attack value (M12) of its armies there that are not demoralized; a demoralized army cannot attack (M23). If no faction there has one, there is no battle.
- The faction with the greatest standing attack attacks with those armies. The other faction with the greatest standing attack defends with all of its armies there, at their defence values.
- A tie for either place is broken by a seeded roll from the battle's stream among the tied factions in id order (a roll of `k` picks the `k`-th), recorded in the battle as a tie-break.
- Neither side has works (M22). Faction modifiers apply (M24), judged at the start of the turn.
- Results apply as in any battle (M16), with one difference: the attacker is already in the territory, so it stays whatever happens. A defender that must retreat leaves the territory (M21). The site records `taken` when the defender is gone and the attacker remains, `left-empty` when no army is left, and `held` otherwise.
- A standing battle is a battle fought in the territory for digging in (M22).

## The `d20-graded` dice module (D1-D8, C2-C7, U6)

`m3-modular` scenarios that select `dice: d20-graded` fight every battle on the d20 (`src/main/engine/d20/`, joined in `engine/modules/dice.ts`). The M rules above hold except where these say otherwise. The `combat` block still supplies the demoralization factor (M12); every other number comes from the `d20` block.

**D20-1. Values.** As M12, except that a type with value 0 (trucks, generals) counts 0 rather than 1, and general units never count. A side of value 0 fights as 1 for the odds.

**D20-2. Odds and score.** The odds column is M13's. Below 1:1 the roll takes `belowOneToOnePenalty` per halving; above 6:1 it gains the same per step beyond the table. The score is the d20 (1-20, the battle stream's first draw) plus every modifier, clamped to 0-20, and `table[column][score]` names the grade.

**D20-3. Modifiers**, signed from the attacker's view:
- in a territory: the works (M22, at the d20's rates), each `d20.factionModifiers` entry (M24), and `barricades` against the attacker when the territory has a city a defending faction controlled at the start of the turn (D4, stacking with Popular resistance);
- always: the best general on each side (the greatest command bonus plus his trait's roll for the side's role; ties in scenario order) and that general's trait (U6, declog D5); for each unit type with `roll-bonus-per-points` matching the side's role, `bonus` per `per` points of that type's value on the side, at most `max`, none in its `exceptWeather` (D5); and `fatigued` when units at `fatiguedLevel` or above carry at least half of a side's value (declog D6), negative for a fatigued attacker and positive for a fatigued defender;
- in a territory, the selected modules' `combatModifiers` hooks (weather, amphibious, air support, buildings; D7).
- Meeting battles (M20) take only the armies' own modifiers: generals, unit bonuses and fatigue.

**D20-4. Grades (D2, D6).** Each side's effect is applied in this order: on a grade with `weakestDestroyed`, the weakest unit (lowest value, then fewer men, then scenario order) is destroyed; every other unit loses `lossPercent` of its men now, rounded; a unit left below `breakUpShare` of its full strength is destroyed; then `none`, `all`, or the weakest units until they carry half of the side's value as fought are demoralized. Generals lose no men and are never demoralized.

**D20-5. Territory battles (M17-M19, P4, P5).** Each attacking faction fights the defenders separately from one snapshot of values; the defenders' losses add up battle by battle. A grade with ground `all`, or an attack that leaves no fighting defender, makes a claim, and M18 picks the occupant; the defenders retreat (M21), or, for an entry battle's standing entrant, return home. Otherwise a grade with ground 1 or 2, in a territory with more than one sub-territory under a partition module other than `none`, brings its attackers into the territory beside the defenders, who stay; anywhere else it acts as a stalemate (Q-D20-7). Every other attacker returns (M21). The battle records the ground it actually took: `all` for the occupant, 1 or 2 for attackers that came in, else 0. A side made only of units with `cannot-attack-alone` (generals and value-0 units aside) does not attack: its move bounces as a standoff (D5). With three or more entrants into an empty territory, the one holding its capital sub-territory, else its last controller, stands as the defender (C3).

**D20-6. Meetings (M20).** A grade with ground `all` lets the attacker continue; a grade with ground 0 that cost the defender nothing lets the defender continue; every other grade bounces both.

**D20-7. Standing battles (M27, C2, C3).** As M27, except: no standing battle is fought where a territory battle was fought this turn; generals and units that cannot attack alone do not make a standing attack; with three or more factions present, the capital holder (else the last controller) always defends and the greatest standing attack among the others attacks. A grade with ground `all` makes the defender retreat; partial ground leaves both in place, with the ground recorded for the partition module.

**D20-8. Fatigue and morale (C4-C7, M22, M23).** At step 9:
- every unit that fought on the attacking side of a battle this turn gains 1 fatigue, up to `demoralizedLevel`; reaching it demoralizes the unit;
- a unit with no move order that did not retreat, did not attack, and stands in uncontested ground at the end of the turn has a quiet turn: its fatigue returns to 0 and, if it was demoralized before this turn, it recovers (M23). In contested ground it does not (C4); the recruitment module's Replenish and the air module's general rally run after this part and may restore morale themselves (C5);
- works grow by `worksPerTurn` up to `worksMax`, never in contested ground or where a battle was fought, and as the `canDigIn` hooks allow (T4).
Each fatigue change is reported as a `fatigue` outcome.

**D20-9. Estimates (C15).** `estimateAttack` returns the d20 odds, the grade chances, the column's bands, `takeChance` (a grade with ground `all`) and `gainChance` (any ground), with every modifier the battle would take.

## Worked example

`src/test/fixtures/scenarios/tiny-front/scenario.json` is a complete five-territory scenario with two factions, one sea connection, one contested island, two cities, three units (one below full strength), and its own combat block with one faction modifier. It exercises every field above except `isolated` and is played end to end in the e2e suite.
