# `m3r1-contract` progress

## CP1: types and schema (commits `ec8fc98` and `66a7d8e`, which adds CT-16 and CT-17)

**Done.**
- `engine/types.ts` is now a barrel over `engine/types/{rules,effects,scenario,economy,systems,package,state,orders,outcomes}.ts`; imports elsewhere are unchanged. New branded ids are in `engine/ids.ts`.
- Spec v2 types for every system in tasks section 1: rule modules, unit types (kind, values, effects, recruit rules, allowed order kinds, symbol, air range), sub-territories (terrain, development, buildings, rail, port, start holder), connection entries, territory capitals, the development and building catalogues, improvements, resources and starting stocks, recruitment and movement numbers, the d20 grade catalogue and 7 x 21 table, weather outcomes, seasons and zones, the calendar, air, generals (traits and rosters, faction seats), and AI profiles with the blunder chance.
- `GameState` v2: sub-territory holders, development, buildings, queues, rail and port; treasuries; training; raised-unit definitions; unit fatigue; weather; the generals roster index; recon reveals; raid income cuts. `initialGameState` fills them (all empty under `m2-strength`).
- The flat order union: Move (optional path of `land`, `rail`, `sea` legs), Withdraw, Replenish, Recruit, Build, AirMission, Sack.
- Zod schema v2 (`schema/{coreSchema,modularSchema,systemsSchema,scenarioSchema}.ts`) and regenerated `scenario.schema.json` and `map.schema.json`. Version 1 is dropped.
- Loader split into `scenarios/loader/*.ts`, with rules L14-L25 written into `project/specs/scenario-package.md` v2 (`map-package.md` bumped to v2).
- Both packages bumped to spec version 2 in place, still on `m2-strength`, each faction naming an AI profile with today's weights.
- Tests: `specModular.test.ts` (an `m3-modular` fixture built from tiny-front, every new L-rule rejected once, schema and engine literal lists kept equal), `orders.test.ts` (the union through `resolveTurn`).

**Decisions and assumptions.**
- CT-1. The schema is one variant per ruleset (`z.discriminatedUnion("ruleset")`). `m2-strength` takes none of the Milestone 3 blocks. `m3-modular` takes `rules` plus optional blocks, and the loader requires the blocks each selected module reads (L15).
- CT-2. Built-in modules: dice `d6-table`/`d20-graded`, economy `none`/`development`, recruitment `none`/`buildings`, weather `none`/`seasonal-zones`, movement `single-step`/`allowance`, partition `none`/`provinces`, air `none`/`missions`. The first of each is the `m2-strength` preset. Unimplemented modules will be pass-through skeletons (CP3). In CP2 Spain selects `d6-table` and `single-step`, so its resolution cannot change; `m3r1-d20-combat` and `m3r1-movement-rail-ports` flip those two when they land.
- CT-3. The d6 `combat` block stays required under both rulesets while `d6-table` is the only implemented dice module. `m3r1-d20-combat` makes it conditional on `dice: d6-table` (and `Scenario.combat` optional) when it lands.
- CT-4. The seven rule areas are E2's. Generals have no area: they are unit types plus the `generals` block. Fatigue numbers live in the `d20` block, which `m3r1-d20-combat` owns (C6).
- CT-5. Buildings, weather outcomes and general traits carry coded effect lists, like unit effects (E6), so code never names a scenario's building ids. For example, "the Depot raises the replenishment cap" is a `replenish-cap` effect on the Depot.
- CT-6. Move keeps `from` and `to` and gains an optional `legs` path. Absent means one step along the connection. Under `single-step`, only a one-leg land or sea path ending at `to` is valid.
- CT-7. Orders other than moves validate as "not available in this scenario" until their module lands. They are reported as a new outcome, `rejected-order`, which disbands nothing (the refund hook for phase 1). An impossible move stays `invalid-order` and disbands its army (M9). A unit given two orders of any kinds is ordered twice.
- CT-8. The new `GameState` fields are required. The date is not stored: it derives from `turnNumber` and `scenario.calendar` (T1, owned by `m3r1-weather-timer`). The forecast also derives, from next turn's season tables. A recruited unit has no scenario definition, so `GameState.raised` carries its name, type and establishment.
- CT-9. A territory's capital is `capitalSubTerritoryId` on the territory, not a flag on each sub-territory.
- CT-10. Sub-territory adjacency is a top-level `subTerritoryBorders` list of id pairs, which is simple for `m3r1-map-provinces` to emit. A connection's entries are `entry: [a, b]`, in `between` order.
- CT-11. `ai` is required under both rulesets, and each faction names its profile (`aiProfile`). Spain has `republic-staff`, `north-staff` and `south-staff`; tiny-front has one shared `fixture-staff`. All of them hold today's constants. The computer player does not read them yet; that wiring comes in CP3, with no change in behaviour. `blunderChance` is 0.01 for Spain (H6) and 0 for tiny-front, and nothing reads it yet.
- CT-12. A unit type's `symbol` is its NATO APP-6A function name. The drawn asset stays in the map package's `unitSymbols`.
- CT-13. `m3-modular` unit types may have attack or defence 0 (trucks, generals). `m2-strength` keeps positive values.
- CT-14. The map spec is bumped to version 2 with no new fields. `m3r1-map-provinces` owns the sub-territory geometry fields in `mapSchema.ts`, so I left them alone to avoid a conflict. The shape I propose: optional `subTerritories: { [D8 id]: { path, label: { x, y }, capital: { x, y } } }`, where `path` is closed SVG path data in view box units. L10 would gain "every scenario sub-territory has a map entry".
- CT-15. The schema is split into parts with `.ts` import extensions so `node scripts/build-schemas.ts` still runs unchanged. The generated JSON Schema is now 3307 lines, because each ruleset variant inlines the shared parts.

- CT-16. One noun for where numbers come from. Every block and catalogue entry that carries numbers takes optional `sources` (citations) and `note` (design note), the same pair sub-territories use. Unit types and weather no longer use `basis`. The loader checks every cited source (L3). Both packages' `ai` blocks carry a note: today's Revision 7 constants, and the blunder chance from H6 and Q-MR-33.
- CT-17. The "no scenario knowledge in code" guard now skips only scenario package folders (those holding a `scenario.json`), so the moved loader checks under `scenarios/loader/` are guarded again. It also collects sub-territory, resource, development, building and general ids. Consequence for CP2 and the slices: Spain's catalogue ids must not equal string literals in code. For example, use `artillery-group` rather than `artillery`, which is also a symbol name.

**Checks** (gated on exit codes): `npm run lint` passed, `npm run typecheck` passed, `npm run test:unit` passed (29 files, 551 tests after the follow-up; coverage 98.79 statements, 94.67 branches, 99.12 functions, 99.48 lines; the soak bands and determinism hold), `npm run build` passed, `npm run spec:build` regenerated both schemas. E2E was not run: no UI changed.

**Files outside my list that I touched**, each a small wiring change for the union:
- `src/main/presentation/text.ts`: one line for `rejected-order`;
- `src/main/screens/report/focus.ts`: one case;
- `src/main/state/selectors.ts`: revealed orders filter to moves;
- `engine/{board,orders,validation,resolution}.ts`: fatigue carried, the union validated;
- tests that read `order.unitId` or `order.to` off the union.

**Flags for the integrator.**
1. E3 puts the schema at `src/scenarios/scenario.schema.json`. The generator's output path is in `scripts/build-schemas.ts`, which my brief bars me from editing. For CP2 I plan to leave the schema at `src/main/scenarios/schema/`, point `$schema` and `MANIFEST.md` there, and leave the one-line move to whoever owns `scripts/`. Redirect me if you want it moved.
2. `scripts/map/iberia-1936.ts` hardcodes `src/main/scenarios/spain-1936-07-31/map.json`, and `build-map` reads the previous file there. After the CP2 move, `m3r1-map-provinces` must update that one line.
3. The CP2 id change to `spanish-civil-war-1936` touches the test helpers (`spainId`, the registry list in `spec.test.ts`) and any e2e spec that names the id.

**Next: CP2.** Move Spain to `src/scenarios/spanish-civil-war-1936/` with `MANIFEST.md`. Migrate Spain to `m3-modular` with real starting data for the D8 ids. Keep tiny-front on the `m2-strength` preset.

## CP2: redirect items, the scenario folder and the migration (commits `ea8b0cb`, `ae3b273`)

**Done.**
- Redirect items 1-6 (item 7 waits for CP4):
  - `ai.profiles` is keyed by faction id, one per faction, and factions no longer name a profile;
  - outcomes for every new system, one file per area, with sub-territory changes in `TurnResolutionResult`;
  - `BattleOutcome` as a d6 or d20 variant, with the new modifier kinds;
  - the general links on units and pending replacements in `GeneralsState`;
  - the schemas moved to `src/scenarios/`;
  - the guard exempts coded word lists.
- Spain moved to `src/scenarios/spanish-civil-war-1936/` and renamed (E3, E4), with `src/scenarios/MANIFEST.md`. The test helpers and loader tests follow the new id; no e2e spec named it.
- Spain on `m3-modular` with starting data for every D8 id, plus the catalogues and system blocks below. Tiny-front stays on the `m2-strength` preset, with one AI profile per faction.
- New APP-6A symbols in `assets/icons/nato/` (transport, air defence, fighter, recon, bomber, headquarters), with attribution. The map package names one symbol per unit type.
- Tests: `spainData.test.ts` (D8 ids, capitals, start holders, treasuries, rosters, the d20 table, weather), the map-entry rule, the general-unit rules, the AI-profile rules, and placeholder lines for the new outcomes.

**Decisions and assumptions.**
- CT-18. `ai.profiles` is a record keyed by faction id, so a harness variant patches `/ai/profiles/<factionId>`; `/ai/blunderChance` is unchanged. L23: one profile per faction, none for unknown factions. `ScenarioIndex.aiProfiles` is gone; read `scenario.ai.profiles[factionId]`.
- CT-19. Outcomes live in `engine/types/outcomes/<area>.ts` (moves, battle, morale, recruitment, economy, contested, air, generals, weather) and join in `types/outcomes.ts` as `MilestoneTwoOutcome | SystemOutcome`. Beyond the requested list I added a rally, a fatigue change, a grounded aircraft and "time ran out" (T6), so the slices need not touch the union. `presentation/systemText.ts` gives each system kind a placeholder report line, with TODOs for the owning slices; the report focus ignores system outcomes for now. `subTerritoryChanges` (cause `occupation`, `battle` or `sweep`) is empty until `m3r1-sub-territories` fills it.
- CT-20. `BattleOutcome = D6BattleOutcome | D20BattleOutcome`, told apart by `dice`. The UI layers are typed to the d6 variant and pick battles with `isD6Battle`, so d20 battles are left out of the report and map until `m3r1-d20-combat` handles them (TODO in code); a d20 battle's headline already reads "Battle for X.". New modifier kinds: `general`, `trait`, `barricades`, `unit-bonus` (artillery and tanks, per unit type), `fatigue`, `weather`, `amphibious`, `air-support`, `building` (Fortifications), with placeholder names.
- CT-21. `units[].generalId` (`m3-modular` only) links a unit of a `general` type to its roster entry, and `RaisedUnitDefinition` carries it. L21 adds: general units, and only they, name a roster general of their own faction, each fielded once. `GeneralsState` gains `pending: { factionId, generalId, arrivesOnTurn }[]`; replacements appear at the faction's `seatTerritoryId` (D7). Spain places no general units at the start: under the d6 rules every army counts at least 1 point (M12), so placing them would change play. `m3r1-air-generals` places them.
- CT-22. The generated `scenario.schema.json` and `map.schema.json` are in `src/scenarios/` (E3); the Zod sources stay in `src/main/scenarios/schema/`. I changed the two output paths in `scripts/build-schemas.ts`, as authorized. `scripts/map/iberia-1936.ts` still points at the old map path, left for the integrator (answer 5b).
- CT-23. The code-literal guard now drops every string in the engine's exported word lists (symbols, effect kinds, module names, order kinds and so on) from the id set. This supersedes the CT-17 consequence. Spain keeps descriptive type ids (`artillery-group`, `tank-company`) for readability, not to dodge the guard.
- CT-24. Map sub-territory entries: `checkSubTerritoryMap` (L10) checks a one-to-one match, with equal territory ids, whenever the map has `subTerritories.entries`. It is not required yet and is read structurally, because the field belongs to `m3r1-map-provinces`. A TODO in `loader/map.ts` asks the integrator to read it through their schema and require it for partitioned packages at merge. I added no map-schema fields and did not touch `map.schema.json` by hand.
- CT-25. Spain stays on `d6-table` and `single-step`, and territories keep their Milestone 2 `initialControl`, so play is identical: the soak bands and determinism pass. P1 would make País Vasco contested (Álava is held by the North), but deriving territory control from sub-territory holders belongs to `m3r1-sub-territories` (TODO).
- CT-26. Spain's data choices, each recorded in the package with a source or a design note:
  - Holders: the UX pass table, checked against `ubc-july-map`. Overrides: Huesca Republican (P1), Oviedo held by the North, the Guadarrama side Republican, Cáceres, Mallorca and Ibiza with the Southern command, Menorca Republican.
  - Capitals: Oviedo, Madrid and Mallorca for the split territories; Burgos for Castilla y León.
  - Development: Asturian coal, Basque iron, Catalan industry and the southern farmland. One Manpower is about 1,000 men.
  - Buildings: garrison towns per `nafziger-1936`, plus factories, airfields and rail yards where the 1936 sites were.
  - Ceuta yields nothing, and Melilla has one Mines level for the Rif iron (Q-MR-10).
  - Starting stocks: Republic 40 Funds and 10 Manpower; North 15 and 10; South 15 and 5.
  - The d20 table: column k reads grade floor((score + 3k + 4) / 3), and scores 0-1 destroy the attacker at 1:1 and below.
  - Four weather zones over four seasons; rain closes the sea in December to February.
  - Raid table bands up to 3, 10, 16 and 20.
  - Generals: Republic Miaja, Rojo, Pozas, Asensio; North Mola, Dávila, Solchaga; South Yagüe, Varela, Queipo. Traits: aggressive, tenacious, cautious, uninspiring.
  - Seats: Madrid, Castilla y León, Andalucía.
  - All the numbers are for the harness to tune.
- CT-27. Sub-territory borders come from the UX pass adjacency, with the Oviedo and Madrid splits drawn in by hand. Land connection entries are the first bordering pair; sea entries are Cádiz-Ceuta, Málaga-Melilla, Barcelona-Mallorca and Valencia-Ibiza. All of them are placeholders: `m3r1-map-provinces` regenerates borders and entries from the real geometry, and the integrator copies them in at merge.
- CT-28. The new general sources are Wikipedia and RAH pages. Three come from the research notes (Mola, Rojo, Dávila); the rest are standard English Wikipedia titles that I did not fetch this session.
- CT-29. Factions take `sources` and `note`, for their starting stock and seat.

**Checks** (gated on exit codes):
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run test:unit` passed: 30 files, 566 tests, with the soak bands and determinism. Coverage: 98.55 statements, 94.21 branches, 99.21 functions, 99.17 lines.
- `npm run build` passed. The initial chunk is now 165.79 kB gzip, up from 157.68: Spain's larger `scenario.json` is bundled eagerly. CP4 item 7 (lazy registry, loader and Zod) addresses this, and the 155 kB budget is left alone.
- `npm run test:e2e` on chromium and mobile-chromium (`E2E_PORT=5301`): 51 passed, 5 skipped, no visual diffs.

**Files outside my list that I touched:**
- `scripts/build-schemas.ts`: two paths, authorized;
- `assets/icons/nato/*`: six new symbols and the attribution;
- `src/main/presentation/{text,odds,battle,battleText,systemText}.ts`, `src/main/map/{MapLegend.tsx,RouteLayer.tsx,routes.ts}`, `src/main/screens/report/*`: typed to d6 battles, plus placeholder lines and names;
- tests that read battle results or the old id.

**Next: CP3.** The engine skeleton: `engine/phases/` run in order by `resolveTurn`, the module registry and plugin interface, per-viewer filtering, seeded streams per roll kind, and the `ai/orders/<kind>.ts` stubs; the computer player reads `ai.profiles`.

### CP2 follow-up

- CT-30. The placeholder report lines are split one file per area under `presentation/systemText/`, mirroring `engine/types/outcomes/`, and joined with `satisfies Record<SystemOutcome["kind"], string>`, so each slice edits only its own file.
  - `modifierName` in `presentation/odds.ts` names the owner of each new case: d20 combat (barricades, unit-bonus, fatigue), air-generals (general, trait, air-support), weather-timer (weather), movement (amphibious), economy (building).
- CT-31. Rail yards moved to the boarding capitals, Burgos (for Medina del Campo) and Toledo (for Alcazar de San Juan), because M3 counts them only there. Valladolid and Ciudad Real no longer have one.

**Public API changes for `m3r1-sim-harness`.** I read their worktree at `603e72d`; I did not edit it.
- `src/sim/game.ts:122-125`: `outcome.result` after `kind !== "battle"` no longer typechecks. Use `isD6Battle(outcome)` (from `engine/types`) or switch on `outcome.dice`. A d20 battle has `grade` and `score` in place of `result` and `row`; `column` is common to both.
- `src/sim/engine.ts:125-126`: `orderRoute` reads `order.from` and `order.to` off `submittedOrders`, which are now `Order[]`. Narrow with `isMoveOrder` first.
- `src/sim/engine.ts:27`: `blunderChancePointer` can now be `/ai/blunderChance`. Profiles are at `/ai/profiles/<factionId>`.
- The scenario id is now `spanish-civil-war-1936`. Their default scenario comes from the registry, so only id literals, if any, change.
- `TurnOutcome` has about 30 new kinds, so an exhaustive switch over it breaks. Their code has none.
- `TurnResolutionResult.subTerritoryChanges`, `UnitState.fatigue` and the new `GameState` fields are required. Their code builds no literals of these.
- `digging-in-cap-2.json` (`/combat/diggingIn/max`) still applies.

**Merge to-dos for the integrator:**
- `scripts/map/iberia-1936.ts` still has the old map path;
- wire `checkSubTerritoryMap` to map-provinces' schema and require it for partitioned packages (TODO in `loader/map.ts`);
- replace the placeholder `subTerritoryBorders` and connection `entry` pairs with map-provinces' generated file;
- regenerate `map.schema.json` after both streams merge.

**Checks after the follow-up:** lint passed, typecheck passed, test:unit passed (30 files, 566 tests).

### CP2 note: generated topology

- CT-32. `m3r1-map-provinces`' generated `sub-territory-topology.json` is the single source of truth for `subTerritoryBorders`, `connections[].entry` and city-to-sub-territory assignment. My hand-written values are placeholders, to be replaced at merge, and I spent no more effort on them.
  - I checked that nothing depends on the exact values.
  - No test reads Spain's borders, entries or city assignments. `spainData.test.ts` checks only the D8 ids, capitals, start holders and the system blocks.
  - The loader rules are generic. L16 checks that a city's sub-territory lies in the city's territory. L19 checks that a border joins two known, different sub-territories once, and that each entry lies on its own side of the connection. Neither rule requires an entry pair to be a border, so sea entries and the pipeline's overrides (`melilla`-`malaga`, `valencia`-`mallorca`, `badajoz`-`sevilla`) pass, and so do sea borders inside a territory (`mallorca`-`menorca`, `mallorca`-`ibiza`).

## CP3: the engine skeleton (commits `8645500`, `693ea64`, `19b96e1`)

**Done.**
- Supervisor fold-ins:
  - `SystemOutcome` joins one union per area file (`WeatherTurnOutcome`, `RecruitmentTurnOutcome`, `EconomyTurnOutcome`, `ContestedTurnOutcome`, `AirTurnOutcome`, `GeneralsTurnOutcome`, `MoraleTurnOutcome`), and the per-area report-line files key on those unions;
  - d20 battles drop `unitEffects`;
  - Caceres starts with the North.
- `engine/phases/00-weather.ts` to `12-victory.ts`, one per section 2 step, run in order by `resolveTurn` through `phases/pipeline.ts`. `phases/draft.ts` holds the turn in progress and `phases/result.ts` assembles the report. `resolveTurn`'s signature is unchanged.
- `engine/modules.ts`: `RuleModule` (area, id, data blocks, its parts of each step), `ScenarioPlugin`, `createModuleRegistry`, and the built-in modules. The loader checks L14 and L15 against the package's registry and resolves `Scenario.modules`. The scenario registry finds a `plugin.ts` beside `scenario.json` (glob `plugins` in `PackageSources`).
- Seeded streams per roll kind (`rollStream`, `seededRollStreams`; tags for battle, weather, raid, general death and blunder). `TurnInput.streams` carries them to the phases.
- `engine/visibility.ts`: `viewFor(scenario, state, viewer)`.
- `ai/orders/<kind>.ts`: the move planner, moved unchanged from `computerPlayer.ts`, and one stub per other kind. `computerPlayer.ts` runs them in order on the faction's own view. The computer player reads `ai.profiles`, and the weight constants are gone.
- Tests:
  - `pipeline.test.ts`: step order, module parts, pass-through skeletons, skeleton equals preset, registry and plugins, streams;
  - `visibility.test.ts`: hidden and revealed state, the planner stubs;
  - updated AI tests, which now read profiles.

**Decisions and assumptions.**
- CT-33. A step is the engine's own part (reveal at step 1, victory at step 12) followed by each selected module's part, in `ruleAreas` order. Today's rules sit in the presets' parts:
  - `d6-table`: meetings, battles, standing, morale and digging in;
  - `single-step`: transit (reinforcements);
  - partition `none`: occupation and retreats, control.
  - Each Milestone 3 module runs its area's preset parts plus pass-through skeletons (weather, air, training, income), so Spain on `m3-modular` plays as before. A slice that lands replaces its module's parts; for example, `m3r1-d20-combat` gives `d20-graded` its own battle steps.
- CT-34. Several modules may take part in one step (training: economy and recruitment; morale: dice, later recruitment and air). Parts run in area order, each on the previous part's draft. A plugin registers modules through the same `RuleModule` interface, and a name registered twice in an area is a package problem, not a crash.
- CT-35. Milestone 3 events (`draft.events`) come after the recoveries, at the end of the outcome list, so the Milestone 2 order is unchanged. `subTerritoryChanges` comes from `draft.subTerritoryChanges`.
- CT-36. Roll streams: the battle tag is the Milestone 2 one, so the d6 battle rolls do not move and nothing was re-baselined. Each new kind has its own ASCII tag, and computer-player tie-breaks keep `deriveSeed(seed, turn, faction index)`. The new planners must not draw from the move planner's `random`; the blunder stream is for H6.
- CT-37. `viewFor` hides other factions' treasuries, queue items and training, and other factions' reveals. A territory revealed this turn (`untilTurn >= turnNumber`) shows everything of its holders. Under `m2-strength` it returns an equal state. Only the computer player uses it so far; the hidden-balance UI is `m3r1-economy-builds`'.
- CT-38. Planners run in kind order (move, withdraw, replenish, recruit, build, air mission, sack), and each sees the orders already planned (`PlanningContext.planned`), so it can avoid ordering a unit twice.
- CT-39. d20 battles record losses only in `losses` (men and destroyed, per unit) and `demoralizedUnitIds`, the same fields as d6. `UnitGradeEffect` is gone.
- CT-40. Caceres starts with the Northern command: it was in the VII Organic Division (Valladolid) and rose under Mola (`nafziger-1936`, plus `ubc-july-map`). No loader rule ties sub-territory holders to territory control, so it loads. Extremadura's `initialControl` stays the Milestone 2 one (Republic and South) until `m3r1-sub-territories` derives control from holders, which would make it Republic and North.

**How I proved that behaviour did not change.** I used a temporary probe test, kept out of the repo. It records:
- `soak(spain(), 200, 30)` and `soak(tiny(), 50, 30)`;
- a sha256 over `JSON.stringify` of every turn result of 40 seeded all-computer games of 30 turns per package, through the real coordinator.

I recorded the probe after the Caceres move: the soaks there equal the CP2 ones, and only Spain's full-game hash moved, as expected, because `finalState.subTerritories` now holds Caceres for the North. The JSON file was byte-identical (`cmp`, sha256 `4687658c...`) at two points:
- after the AI-profile wiring, the planner split and `viewFor`;
- after the phase pipeline and module registry.

**Checks** (gated on exit codes):
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run test:unit` passed: 32 files, 578 tests, with the soak bands and determinism. Coverage: 98.60 statements, 94.13 branches, 99.23 functions, 99.20 lines.
- `npm run build` passed. The initial chunk is 167.45 kB gzip, over the 155 kB budget; CP4 makes the packages, loader and Zod lazy.
- `npm run test:e2e` on chromium and mobile-chromium (`E2E_PORT=5301`): 51 passed, 5 skipped.

**Files outside my list that I touched:**
- `src/main/ai/**`: the planner split, the profile reads and the stubs;
- AI tests.

**Next: CP4.**
- The hotspot splits (H9).
- The UI slots: header, pane tabs, the sub-territory focus route, map layers.
- `project/budgets.json` and its check.
- Lazy registry, loader, Zod and packages, with non-eager globs for `scenario.json` and `map.json`, to bring the initial chunk under 155 kB.

### CP3 follow-up (after review)

- CT-41. Module files are split one per area under `engine/modules/` (`dice`, `economy`, `recruitment`, `weather`, `movement`, `partition`, `air`), joined in `engine/modules.ts`.
  - Each Milestone 3 module has its own pass-through parts in its area's file, with the owning slice's TODO:
    - economy: build purchases, build queues, income;
    - recruitment: recruit purchases, replenishment, training;
    - weather: the roll;
    - air: missions, general changes, raid cuts.
  - So no two slices share a part function or a row. The step files keep only the presets' parts, or, for steps 0, 2, 10 and 11, the engine's empty part as the home of the step's contract.
  - The spec and `phases/pipeline.ts` now state the ordering rule: parts run in area order, each on the previous part's draft, so a rule that must shape an earlier part is read inside that part. For example, Snow blocking digging in is read by the d20 morale part from `systems.weather`.
- CT-42. H6's blunder stream reaches the computer player. The coordinator passes `blunder: rollStream(seed, "blunder", turn, faction index)` in the optional `ComputerPlayerContext.blunder`, and planners read it as `context.memory.blunder`. Nothing reads it yet. No stream in `tasks` owns blunder logic in the computer player (the harness owns only its reporting), so the integrator should assign it.
- CT-43. The probe is byte-identical again after the area split and the blunder wiring (sha256 `4687658c...`).
- Files outside my list that I also touched: `src/main/state/coordinator.ts` (one line, the blunder stream) and `src/main/scenarios/builtInSources.ts` (the plugin glob).
- Sim harness at `603e72d`, read-only: no CP3 hits.
  - Workers get only the run plan and tasks, and load their scenario themselves, so the functions in `Scenario.modules` never cross `postMessage` or `workerData`.
  - They use none of the removed or changed exports: the weight constants, `prizeFactor`, `knownModules`, `moduleBlocks`, or imports from inside `computerPlayer.ts`.
  - `PackageSources.plugins` is optional.

## CP4 and hand-off (commits `106dd42` to `6e9925b`)

**Done.**
- Supervisor redirect items:
  1. Cross-area hooks on `RuleModule.hooks` (`engine/hooks.ts`): `combatModifiers`, `allowanceDelta`, `canDigIn`, `grounded`, `incomeDelta`, `replenishBonus` and `recruitRequirements`. The engine collects them across the selected modules, and the d6 rules call `combatModifiers` (`situationalModifiers`, so battles and planning estimates both use it) and `canDigIn` (`digIn`).
  2. `TurnDraft.scratch`: each area declares its own key by declaration merging in its module file. Air (bomber support) and movement (legs) show the pattern.
  3. `outcomesFor` and `state/visible.ts` (`visibleSession`, `sessionViewer`). `useSession` returns the visible session, so every screen reads filtered state; the coordinator gives computer players filtered history; other factions' locked submissions are dropped.
  4. Blunders (H6), below.
- H9 splits, with no behaviour change. Each split file stays as a barrel, so no import changed.
  - `engine/combat.ts` into `combat/{values,odds,estimate}.ts`;
  - `state/planning.ts` into `planning/{selection,orders,focus}.ts`;
  - `map/CampaignMap.tsx` into `MapLayers.tsx`;
  - `map/useMapCamera.ts` into `useKeyPan.ts`;
  - `style.scss` into ten partials under `styles/`. The compiled CSS is byte-identical (`sass` then `cmp`).
- UI slots:
  - header slots under `components/header/` (`DateChip`, `TimerChip` and `ResourceChips` render nothing yet; `ReadinessChips` is the extracted status list);
  - the territory pane tabs `screens/pane/TerritoryTabs.tsx` (Units, then Build and Recruit, which are present but empty, under `m3-modular`; no tabs under `m2-strength`);
  - the sub-territory focus view `screens/pane/SubTerritoryFocus.tsx`, with a link back, reached through the `focusSubTerritory` action and `Draft.focusedSubTerritoryId`;
  - empty map layers `map/layers/{SubTerritoryLayer,RailLayer,AirLayer}.tsx`, between the map and the counters (air above them);
  - a `styles/_pane-tabs.scss` partial.
- Lazy loading. The app loads its registry from `scenarios/lazySources.ts` through non-eager globs for `scenario.json`, `map.json` and `plugin.ts`, so the packages, the loader and Zod leave the initial chunk. The app waits for them before its first render, as before. Tests and the harness keep the eager `builtInSources`.
- `project/budgets.json` (initial chunk 155 kB gzip; the H7 harness goals) and `npm run budgets:check` (`scripts/check-budgets.mjs`). The check measures the entry script and its preloads in `build/dist`, and with `--sim <dir>` reads a harness `summary.json`. It exits 1 on any miss.
- Blunders (`ai/blunder.ts`).

**Decisions and assumptions.**
- CT-44. The hooks see the start-of-turn state; that is where this turn's weather will be when it is rolled before planning (T3, `m3r1-weather-timer`). The collectors combine answers as follows:
  - `combatModifiers`: concatenated.
  - `allowanceDelta`: summed.
  - `canDigIn`: all must agree.
  - `grounded`: any one grounds.
  - `incomeDelta`: summed per resource, never below 0.
  - `replenishBonus`: summed.
  - `recruitRequirements`: concatenated reasons.
  - Meeting battles (M20) take no hooks, as they take no modifiers today; `m3r1-d20-combat` decides.
- CT-45. With several local players, or none, a turn report shows public information only. With one local player it shows that player's view. Planning and handoff use the faction whose turn it is.
- CT-46. Private outcomes are income; queued, progressing, refunded and forfeited builds (a forfeit goes to both holders); started, paused and refunded training; replenishment; and recon results. A completed build, a completed unit, raids, interceptions, weather, generals and every Milestone 2 outcome are public, because they show on the board.
- CT-47. A blunder costs exactly one draw per planned order. The same draw decides whether the order blunders and which alternative replaces it, uniformly over the unit's other legal destinations plus its default order. Orders to sites keep their draw but never blunder. At chance 0, or with no stream, nothing is drawn.
- CT-48. The pane tabs show only when the scenario has an economy or a recruitment module, so tiny-front and the Milestone 2 tests keep their pane. The Build and Recruit panels are empty `div`s, with no placeholder text.
- CT-49. The sub-territory focus is pane state in the draft, not a React Router route: routing is per session phase (`routeForSession`), and the focus lives inside the planning screen. Selecting anything else drops it.
- CT-50. The lazy registry still loads before the first render. It leaves the initial chunk but not the boot path; deferring it until the setup screen would mean rebuilding the store around an async registry, which I judged out of scope.
- CT-51. `scripts/check-budgets.mjs` is a new file under `scripts/`. I touched none of the existing scripts there.

**How I checked behaviour.** The same probe as CP3 (sha256 `4687658c...`) was byte-identical after the hooks, scratch and visibility changes, after the splits, and with blunders at chance 0. With Spain's 0.01 the soak changes on purpose, and every soak band still holds:
- freezes: 121 of 200 (was 116);
- decided games: 97 (was 103);
- early wins: 1;
- abandonments: 0;
- first-turn changes: 909.

Tiny-front, which has chance 0, is unchanged.

**Checks** (gated on exit codes):
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run test:unit` passed: 36 files, 596 tests. Coverage: 98.53 statements, 93.57 branches, 99.27 functions, 99.14 lines.
- `npm run build` passed.
- `npm run budgets:check`: initial chunk 102.99 kB gzip against 155 kB (met; it was 167.45).
- `npm run test:e2e` on chromium and mobile-chromium (`E2E_PORT=5301`): 50 passed, 5 skipped, and 1 visual diff, the allowed kind. `visual.spec.ts` "planning at every zoom level" (chromium) now shows the Units, Build and Recruit tabs in the Spain pane; see `build/e2e/test-results/visual-planning-at-every-zoom-level-chromium/planning-destinations-diff.png`. I did not regenerate the baseline.
- Production smoke against a served `build/dist`: 1 passed.
- Axe runs inside the e2e acceptance specs, which passed.

**Files outside my list that I touched in CP4:**
- `src/main/state/{coordinator,gameSlice,session,selectors}.ts`: filtered history, the blunder stream, the focus action, `focusedSubTerritoryId`;
- `src/main/hooks.ts`: the visible session;
- `src/main/screens/{OrdersScreen,ResolutionScreen,OrderBuilder}.tsx`: slots and tabs;
- `src/main/components/GameHeader.tsx`;
- `src/main/main.tsx`: the lazy registry;
- `package.json`: the `budgets:check` script;
- `scripts/check-budgets.mjs`: new;
- `src/main/engine/works.ts`: the `canDigIn` hook.

**For `m3r1-sim-harness`.**
- Blunders now play in every coordinator-run game at the scenario's `ai.blunderChance`, from the blunder stream. Their "pending" blunder control can switch to "scenario", with `/ai/blunderChance` as the pointer. A chance of 0 gives exactly the old games.
- The CP2 break list still applies.
- CP4 changes no public engine signature. `builtInSources` stays eager, and `PackageSources.plugins` is optional.

**Merge to-dos for the integrator** (unchanged from CP2):
- `scripts/map/iberia-1936.ts`'s old map path;
- wire `checkSubTerritoryMap` to map-provinces' schema;
- replace the placeholder topology with map-provinces' generated file;
- regenerate `map.schema.json` after both merges;
- review the one changed visual baseline.

### Hand-off follow-up (commit `216d526`)

- **Read first: CT-50 is only partly done.** Item 7 asked for the registry, loader and Zod to load only when the setup screen needs them.
  - Done: they, and the scenario packages, are out of the initial chunk (102.99 kB, under 155).
  - Not done: `main.tsx` still awaits them before the first render, so first paint waits for the same bytes, now with an extra round trip (index, then `lazySources`, then the package chunks).
  - Finishing it means the store, the `gameSlice` reducers and `RegistryContext` must start without a registry and receive it later, or the setup route loads it, which is about a day's change to the app shell. The integrator decides.
- CT-52. Readiness is public: the visible session keeps every faction's locked submission and empties the orders of every faction but the viewer's, so hot-seat readiness chips are unchanged.
- CT-53. `ordersFor` filters `result.submittedOrders` with the same rule as `outcomesFor`. Moves and visible actions stay (withdraw, sack, raid, intercept and support missions). Other factions' Recruit, Build, Replenish and recon orders are hidden unless the viewer's recon reveals that territory.
- CT-54. The territory tabs render all three panels and hide the inactive two, so every `aria-controls` points at an element in the DOM.
- Checks after the follow-up:
  - lint and typecheck passed;
  - test:unit passed (596 tests);
  - e2e on chromium and mobile-chromium: 50 passed, 5 skipped, and the one allowed visual diff (the Spain pane tabs);
  - `e2e:capture`: 11 passed.
- Screenshots (under `build/e2e/screenshots/`): `chromium-08b-pane-open.png`, `mobile-chromium-08b-pane-open.png`, `chromium-04b-order-menu.png`, `chromium-12-fixture-planning.png` (tiny-front, no tabs), plus the diff `build/e2e/test-results/visual-planning-at-every-zoom-level-chromium/planning-destinations-diff.png`.

## Make-it-right follow-ups (`m3r1-contract-followups`, cut from `328c0b9`)

Shared API changes the streams asked for (declog D19, EB-12, EB-15, RR-12), landed before the parallel fixers start.

- **Order validation (`RuleHooks.validateOrder`).** A map from order kind to a validator typed for that kind (`OrderValidators`, `OrderValidationContext<K>` in `engine/hooks.ts`). Owners: Move, the movement modules (`engine/movement/validation.ts`: the unit checks, then one step or a route, then the demoralized rule); Recruit and Replenish, `recruitment: buildings`; Build, `economy: development`; Withdraw, `partition: provinces`; air missions, `air: missions`; Sack, either air module. `engine/validation.ts` runs the owners (first refusal wins; no owner means "not available"), then `orderVerdict`, which is now only a veto (C1 moves out of contested ground). Add a kind's rules in its module's file, never in `validation.ts`.
- **Report lines (`presentation/systemText/`).** Each area exports `ReportLines<AreaOutcome>`: one function per kind, receiving the whole outcome and a `ReportLineContext` (`scenario`, optional `state`, the viewer's final board, and optional `viewer`). The join uses `satisfies ReportLines<SystemOutcome>`. `describeOutcome` and `describeOutcomeGroup` take an optional `ReportView` (`{ state, viewer }`); `OutcomeSummary` passes the session's viewer. Lines may use any field of their outcome (they arrive filtered by `outcomesFor`), but a public outcome carrying another faction's numbers names them only for that faction (`build-forfeited.lost`).
- **Resource display (`resources[].display`, EB-12).** `{ unit, suffix }`: one point is `unit` of the real thing, amounts read as points plus `suffix`. Use `resourceAmount`, `signedResourceAmount` and `resourceAmountInFull` (`presentation/economy.ts`), or `amountText`, `signedAmountText` and `resourcesLabel`, which go through them. Spain's Manpower is `{ unit: 1000, suffix: "k" }`.
- **AI build budget (`ai.profiles.<faction>.builds`, L27).** `spendShare` 0.6, `maxOrdersPerTurn` 3, `itemsPerEmptyQueue` 1; required with an economy module.
- **RR-12.** Replenish needs the unit below strength; a demoralized unit at full strength rests or is rallied.

**Open for the fixers:** `OutcomeSummary` groups only moves, air and generals, so the economy, recruitment, contested, movement-transit and fatigue lines are written but not shown in the turn report. `FocusNote` (`eventsAt`) skips every system outcome. Literal non-ASCII remains in `components/weather/TerritoryWeather.tsx`, `presentation/turn.ts`, `screens/pane/build/SiteCard.tsx`, `screens/pane/ContestedChip.tsx`, `screens/pane/TerritoryHeading.tsx` and a few tests.
