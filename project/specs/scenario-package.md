# Scenario Package Specification (spec version 1)

A scenario package is the rules data for one playable scenario: factions, territories and how they connect, cities, units, and victory parameters. The game engine interprets it; it contains no presentation. Its companion map package (`map-package.md`) holds everything visual.

- Machine-readable schema: `src/main/scenarios/schema/scenario.schema.json` (JSON Schema draft 2020-12), generated from `scenarioSchema.ts` by `npm run spec:build`. A unit test fails if the two drift.
- Reference packages: `src/main/scenarios/spain-1936-07-31/` (shipped) and `src/test/fixtures/scenarios/tiny-front/` (minimal test fixture).

## Adding a scenario

1. Create `src/main/scenarios/<scenario-id>/` with `scenario.json` and `map.json`. Start each file with the `$schema` line, so editors validate as you type.
2. Put map assets anywhere under `assets/` and reference them by repository-relative path from `map.json`.
3. Run `npm run test:unit`. The contract tests load every package and report each problem with its JSON path and rule id. A package that fails validation is left out of the game and reported in a notification; it never crashes the app.

No code changes are needed, provided the scenario fits the `m2-movement` ruleset below. A scenario that needs different rules needs a new ruleset in the engine, and its `ruleset` value makes that explicit.

## Fields

All ids are lowercase kebab-case (`[a-z0-9]+(-[a-z0-9]+)*`) and are never shown to players.

| Field | Type | Meaning |
|---|---|---|
| `specVersion` | `1` | Spec version. |
| `id` | id | Scenario id; unique across packages. |
| `name` | text | Shown in the scenario picker. |
| `snapshotLabel` | text | Starting date or moment; shown on setup and turn 1 only. |
| `ruleset` | `"m2-movement"` | Rules the engine applies. Unknown values fail to load. |
| `map` | path | The map package, relative to this file. |
| `victory.territoryShare` | 0-1 | Share of victory-eligible territories that wins (rounded up). |
| `victory.cityShare` | 0-1 | Share of victory-eligible cities that wins (rounded up). |
| `victory.tieBreak` | list of `cities` / `territories` | Order in which qualifying factions are compared. |
| `unitTypes[]` | `{ id, name }` | Unit types. Symbols come from the map package. |
| `factions[]` | see below | At least two. |
| `territories[]` | see below | At least two. |
| `connections[]` | `{ between: [id, id], kind: land or sea, label? }` | Undirected adjacency. |
| `cities[]` | `{ id, name, territoryId, countsForVictory, initialController? }` | Cities; a city without `initialController` starts unoccupied. |
| `units[]` | see below | Starting formations. |
| `sources[]` | `{ id, title, url? }` | Source catalog for historical data. |

Faction: `id`, `name`, `abbreviation` (1-4 characters, used on narrow screens), `color` (`#rrggbb`, the faction's identity color everywhere), `motivation` (one sentence on setup), `defaultActor` (`local-human` or `computer`), `objectiveTerritoryIds` (used by computer players).

Territory: `id`, `name`, `countsForVictory`, `initialControl` (`{ kind: "controlled", factionId }` or `{ kind: "contested", factionIds: [two or more] }`), and optional `isolated: { reason }` for a territory deliberately left without connections.

Unit: `id`, `name`, `factionId`, `type`, `formationKind` (`regiment`, `battalion`, `column`, `security`, `other`), optional `approximateStrength` (display only; no rules effect), `territoryId`, optional `cityId` (must be in the unit's territory; the counter is drawn at that city), `sources` (at least one `{ sourceId, reference? }`), and optional `historicalNote`.

## Validation rules

The loader applies these when the app starts. Each failure names the JSON path and the rule.

| Rule | Requirement |
|---|---|
| L1 | Valid against the schema; `specVersion` and `ruleset` supported. |
| L2 | Ids are unique within each collection. |
| L3 | Every reference resolves (factions, territories, cities, unit types, sources, objectives). |
| L4 | A unit's `cityId` is in the unit's territory. |
| L5 | Contested control lists at least two distinct factions. |
| L6 | No self-connections or duplicate connections. |
| L7 | Every territory has a connection, unless it is declared `isolated`; an isolated territory has none. |
| L8 | Every faction starts with at least one unit or controlled territory. |
| L9 | No faction starts at or above a victory threshold. |
| L10 | The map package covers every territory, city, and unit type (see `map-package.md`). |
| L11 | Every asset the map package names exists. |

## The `m2-movement` ruleset

Each turn every faction submits orders in secret; all orders resolve together against the start-of-turn state.

| Rule | Behavior |
|---|---|
| M1 | Orders are validated against the start-of-turn state. A unit takes at most one order; without one it holds. |
| M2 | A move must follow a connection from the unit's current territory. Land and sea connections behave alike. |
| M3 | Standoff: when two or more factions move into the same territory, all those moves bounce. Units of one faction may move together. |
| M4 | A move into a territory where a hostile unit holds (is not moving away) bounces, unless the mover's faction also has a unit holding there (a reinforcement). |
| M5 | Units of different factions swapping territories meet head-on and both bounce. |
| M6 | An unopposed move takes control of its destination, including a contested one. |
| M7 | After movement, a territory changes hands when exactly one faction has units there and either the set of factions present changed this turn or that faction moved in. Its cities follow. Holding never changes control. |
| M8 | A bounced unit is lost if a unit of another faction entered the territory it tried to leave. |
| M9 | A unit with an impossible order, or with more than one order, is disbanded. |
| M10 | Victory is checked after M7. A faction meeting either threshold qualifies; `tieBreak` orders qualifiers; a remaining tie is a shared victory. |

Friendly units never obstruct each other. Units of one faction may enter the same territory, join friendly units there, follow a friendly unit out, swap, or move in a chain or ring. Only units of another faction cause a bounce (M3-M5) or a loss (M8). The M4 reinforcement exception counts friendly units that hold (OD-7), so a unit entering a shared territory that its only friendly occupant is leaving faces the hostile holder alone.

Known property: because a held territory cannot be taken (M4), games settle into stable fronts. See decision OD-9 in `milestone-2-rev-5.md`.

## Worked example

`src/test/fixtures/scenarios/tiny-front/scenario.json` is a complete five-territory scenario with two factions, one sea connection, one contested island, two cities, and three units. It exercises every field above except `isolated` and is played end to end in the e2e suite.
