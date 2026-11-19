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
