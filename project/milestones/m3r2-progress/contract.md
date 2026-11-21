# m3r2-contract: progress

> Internal. Phase 0 of Milestone 3 Revision 2 (tasks §3.3 `contract`).

## Done

- **D1 typed entries.** `typedEntry`, `markerEntry` and `entryKinds` in `schema/coreSchema.ts`. Control, connections, unit/building/weather/trait effects, `belowOneToOne`, link modifiers, `linkModifiers` and the map's circle shape are `{"@type", "@data"}` in JSON and `{kind, ...}` in the engine. Spain, tiny-front, the modular fixture and the tests' raw documents migrated; `npm run spec:build` regenerated both schemas; `scripts/build-map.ts` reads and writes the typed forms.
- **D2, D3 links.** `links[]` (one per border, L28), `linkModifiers[]` (road, rail, pass) and `linkProjects` in the schema and `Scenario` (`types/links.ts`). Spain's 120 links come from the 1936 table, each with sources and a note. Sub-territory `rail` is gone from data; the loader derives the engine's level from the links (declog D6).
- **D4** `buildable` on every sub-territory (L29), enforced in `siteRefusal` and the Build list. Madrid lists no port.
- **D5** blunders removed (AI, schema, data, roll stream, sim option and cells, tests, specs).
- **Data:** R3 Málaga sea lane (declog D5); R4 the two North units removed; R5 `foot` flag and `rangeByLevel`; R6 pass effects; R7 link-project prices; R8 dug-in 2 a turn to 6; R9 factory +6 Manpower; R2 the Barbastro garrison (declog D8).
- **Order union and events:** `intercept` → `patrol`; Ground Support for any type that lists it; `LinkProject` build projects (refused until built); `air-battle`, `pocket-cut`, `territory-flipped` with report lines, visibility (public) and report groups.
- **Stubs:** `engine/network/links.ts` (real), `engine/network/reach.ts`, `engine/partition/pockets.ts`, `engine/air/airBattle.ts`, each with tests in `src/test/m3r2Contract.test.ts`. Also an `air-battle` roll-stream tag.
- Specs: `scenario-package.md`, `map-package.md`, `sim-harness.md`.

## Checks

`npm run lint`, `npm run typecheck`, `npm run test:unit` (97 files, 1269 tests, coverage gate) all pass.

Per-file coverage: every new file meets the gate. Touched files that were already below it are not lower, except `ai/orders/air-mission.ts` (branches 91.2 to 90.1, one branch the data changes no longer reach; not fixed, for `ai`). The diff-reviewer pass has not run.

## Left for later streams

- `network-engine`: `reachFor`, move modes, rail on links (then drop `railRangePerLevel`, `improvements.rail` and the derived sub-territory rail), link works in the catalogue and queues, the pass modifier in combat.
- `air-rules`: `airBattle`, `airBattleOdds`; add `support` to the fighter type's missions.
- `pockets-control`: `pocketsOf`, `pocketOfArmy`, `arrivalPocket`; review the sea entry in the partition's distance graph (declog D5).
- `ai`: link works, Patrol and fighters on Ground Support.
