# Simulation Harness Specification

The harness plays seeded all-computer games with no browser and reports what happened as JSON. It measures the game; it never tunes it (H7). Decisions: H1 to H4, H6 and H7 in `project/milestones/milestone-3-rev-1-tasks.md`, from Q-HARN-1 to Q-HARN-7 and Q-MR-32 and Q-MR-33.

## Running it

```
npm run sim -- --games 200
npm run sim -- --games 1000 --variant src/sim/variants/digging-in-cap-2.json --run dig-cap
```

`npm run sim` builds the bundle with `vite.sim.config.ts`, then runs `build/sim-cli/sim.mjs`. `npm run sim:build` only builds it. The bundle is a single Node file. On the main thread it is the command-line tool; it also starts copies of itself as the worker threads that play the games.

| Option | Default | Meaning |
|---|---|---|
| `--games N` | 200 | Games per cell, seeds `--first-seed` to `--first-seed + N - 1`. |
| `--first-seed S` | 1 | First seed. |
| `--seeds LIST` | | Explicit seeds, for example `1-50,77`. Overrides the two options above. |
| `--turns N` | 66 | The turn limit. A game still running after it is a freeze. |
| `--variant FILE` | | A variant patch file, played on the same seeds as the baseline. Repeatable. |
| `--lineup SEATS` | | Personas by faction, for example `republic=builder,north=denier`, played on the same seeds as the baseline (see Lineups). Repeatable. |
| `--scenario ID` | the only shipped scenario | Which scenario package to play. Required when more than one is shipped. |
| `--workers N` | cores less one | Worker threads. The results do not depend on it. |
| `--run NAME` | a UTC time stamp | The run folder's name. |
| `--out DIR` | `build/sim` | The output folder. |
| `--record inventory` | | Also record what every side had and queued on each turn, how long games take, and the report tables (see Recording). Without it, nothing below changes. |
| `--report DIR` | | Write a finished `--record` run's `report.json` and CSV tables again from its files. Plays nothing. |

The exit code is 0 when the run is done, 2 for bad arguments, variant files or scenario data (reported before any game is played), and 1 for a failure during play. A game that throws, or a worker thread that exits with a game unfinished, stops the whole run with that error; the run never waits on a lost thread.

Standard sizes (H2): `npm run test:unit` runs a 10-game smoke run (`src/test/sim/smoke.test.ts`). Runs of 200 and 1000 games are on demand.

## How a game is played

- Every faction is the computer player, using the app's own submission coordinator (`advance` and `nextTurn`). That coordinator calls `resolveTurn` and `generateComputerSubmission` with the same per-faction seeds, the same history and the same validation as a game in the app, so a rule added to the computer player reaches the harness unchanged.
- A game ends at a victory or at the turn limit.
- All randomness comes from the game seed. The same seeds always give the same `games.jsonl` and `summary.json`, byte for byte, whatever the worker count.
- `src/sim/engine.ts` is the harness's only import from `src/main/**`. Scenario packages come from `scenarioSources()`, which is the app's `builtInSources`, so a moved scenario folder is followed automatically. The harness holds no scenario ids.

## Cells

A run plays one cell per variant: the baseline first, then each variant in the order given, then each lineup. Each cell plays every seed. A cell's id is the variant's name, for example `baseline`. (Rev 2 removed the computer player's blunders, and with them the `--blunders` option.)

## Outputs

Each run writes `build/sim/<run>/` with (a run with `--record` writes more, see Recording):
- `games.jsonl`: one JSON object per game, in cell order, with seeds ascending within each cell;
- `summary.json`: the metrics for each cell, plus the comparisons.

The console prints a few ASCII lines per cell and per comparison. There is no HTML report (Q-HARN-7).

### `games.jsonl`

| Field | Meaning |
|---|---|
| `variant`, `seed` | Which cell and seed. |
| `end` | `decided` (a faction won) or `freeze` (no winner by the turn limit). |
| `turns` | Turns played: the winning turn, or the turn limit. |
| `winners`, `victory` | Winning faction ids (more than one for a shared victory) and the victory condition. |
| `battlesByTurn` | Battles fought on each turn, turn 1 first. |
| `battles` | Battle counts by odds column, then by result: `battles[column][result]`. |
| `losses` | Per faction, from the board before and after each turn, matched by unit id. `units` counts units that left the board (destroyed, surrendered or disbanded). `men` is the men of those units plus each remaining unit's drop in men. Units that appear during the game (reinforcements, recruits) are counted neither way, and a unit's gain in men never offsets another's loss. |
| `firstTurnRoutes` | Per faction, the turn-1 orders as `from>to` routes. |
| `longestQuiet` | The longest run of quiet turns. A turn is quiet when no territory changed hands, comparing territory-level control before and after the turn, over the scenario's territory ids only. Sub-territory or city changes do not break a quiet stretch. Battles do not either, which keeps Revision 7's S2 meaning. |
| `abandonments` | S3 events (see the sanity metrics). |
| `objectiveChecks` | S3 checks made: the faction-turns on which a faction held an objective. |

### `summary.json`

Top level: `format` (`spanish-diplomacy-sim/1`), `scenarioId`, `seeds` (as ranges), `turnLimit`, `games`, `factions`, `cells[]` and `comparisons[]`. Each cell has `id`, `variant`, `variantDescription` (if any), `seats` (the personas its factions play, if any is given one) and `metrics`.

Every interval is `{ value, low, high }`, rounded to 4 decimal places. It is `null` when there is nothing to measure, for example a share of decided games when no game was decided.

## Recording (`--record inventory`)

For tuning the economy. Each line of `games.jsonl` gains `inventory` (between `firstTurnRoutes` and `longestQuiet`), deterministic like the rest of the line; `summary.json` does not change. A second file, `timings.jsonl`, holds everything that differs from run to run.

`inventory.columns` lists, in scenario order, `unitTypes`, `projects` (`building:`, `development:`, `improvement:` and `link:` keys), `sites` (the projects that stand in a sub-territory, without links), `resources` and `counts`. `inventory.sides[faction][measure]` is one row per turn, turn 0 (the opening board) first, with one number per column. The measures, and the columns each has, are in `measureColumns` (`src/sim/inventory.ts`):

| Measure | Columns | Meaning |
|---|---|---|
| `units` | `unitTypes` | Units on the map at the end of the turn, of every kind: ground, air and generals. |
| `training`, `paused` | `unitTypes` | Units in training at the end of the turn, split by whether it is paused (C8). A unit is in one of them. |
| `recruitsOrdered`, `recruitsRefused` | `unitTypes` | Recruit orders given this turn, and those of them not paid for and started. |
| `standing` | `sites` | What stands in the sub-territories the side holds: buildings (a count; an upgraded building is listed as its own building too, as the state lists it), development levels and port and rail levels (added up). |
| `buildsUnderWay`, `buildsWaiting` | `projects` | Queue items, for the side that paid for them: with a turn of progress or more (an item paused by a contested territory included), and not started yet. |
| `buildsOrdered`, `buildsRefused` | `projects` | Build orders given this turn, and those of them not paid for and queued. |
| `held` | `resources` | Points held, to thousandths: the treasury less the carry. The header's whole number is its floor. |
| `income`, `upkeep`, `unpaid` | `resources` | What the engine paid (after raid cuts) and charged this turn, and what the side could not pay. At turn 0, what the opening board pays and costs. |
| `counts` | `counts` | Territories held whole, contested territories the side has a part of, sub-territories held, replacement generals on their way. |

Stocks (`units`, `training`, `paused`, `standing`, `buildsUnderWay`, `buildsWaiting`, `held`, `counts`) are read from the state at the end of the turn; flows (the orders, `income`, `upkeep`, `unpaid`) happen during it. Never add orders to stocks: an accepted order is already in training or in a queue at the end of the turn (or, when a unit trains in one turn, on the map). Income and upkeep come from the turn's outcomes and not from the engine's forecast of the board at its end, because by then the turn's raid cuts are over and `upkeepLines` is next turn's bill; a test checks both against the engine. The record throws on a unit, building or project it has no column for, rather than dropping it.

`timings.jsonl`: one line per game (`kind: "game"`, `variant`, `seed`, `turns`, `milliseconds`, `worker`), in `games.jsonl` order, then one `kind: "run"` line (`games`, `workers`, `cores`, `totalMilliseconds` wall clock, `gameMilliseconds` added up over workers, and a `note` on contention). A game's time leaves out loading the scenario.

`report.json` and the CSVs are built from the files above. Per-turn means are over the games still running on that turn, and the `games` column says how many that is, so late turns rest on few games. `report.json` has, for each cell: outcomes (wins, lengths, freezes, stalls, early wins, victory conditions), `running`, `sides[faction].perTurn`, `.final` (stocks at each game's end) and `.totals` (flows over each game from turn 1), and `milliseconds`.

| File | One row per | Columns |
|---|---|---|
| `units.csv` | variant, side, turn, unit type | `games`, `onMap`, `training`, `paused`, `ordered`, `refused` (means) |
| `buildings.csv` | variant, side, turn, project | `games`, `standing` (blank for link works), `underWay`, `waiting`, `ordered`, `refused` (means) |
| `economy.csv` | variant, side, turn, resource | `games`, `held`, `income`, `upkeep`, `unpaid` (means) |
| `land.csv` | variant, side, turn, count | `games`, `mean` |
| `finals.csv` | game and side | `seed`, `end`, `turns`, `winners`, `victory`, `won` (the win credit), each stock at the game's end as `measure:column`, each flow's total as `total-measure:column` |
| `games.csv` | game | `seed`, `end`, `turns`, `winners`, `victory`, `earlyWin`, `stalled`, `longestQuiet`, `battles` |
| `timings.csv` | game | `seed`, `turns`, `milliseconds`, `millisecondsPerTurn`, `worker` |

## Metrics (H3)

| Metric | Definition |
|---|---|
| `wins[faction].shareOfDecided` | Win credit over decided games, with a Wilson 95% interval. This is H7's measure. |
| `wins[faction].shareOfGames` | Win credit over all games, freezes included. |
| `wins[faction].wins` | Win credit. A shared victory credits each of its k winners 1/k, so credits add up to `decided`. |
| `decided`, `decidedRate` | Games with a winner. |
| `freezes`, `freezeRate` | **Freeze:** a game that reaches the turn limit with no winner. |
| `stalled`, `stalledRate` | **Stalled:** a game with 5 or more quiet turns in a row (no territory changing hands), decided or not. This is Revision 7's S2 "freeze" (58 percent over 200 games of 30 turns), kept so results compare with it. The integrator's declog records which of the two measures H7's 15 percent applies to. |
| `length.decided` | Turns to a decision, decided games only: min, p10, p25, median, p75, p90, max and mean. |
| `length.histogram` | Decided games in 6-turn bars, from turn 1 to the limit. |
| `battles.total`, `battles.perTurn` | Battles in all, and per turn played. |
| `battles.byTurn` | The mean number of battles on each turn, over the games still running on it. |
| `battles.byColumn` | For each odds column: battles, their share of all battles, and the count of each result. |
| `losses[faction]` | Men and units lost, in total and per game. |
| `firstTurn[faction]` | The mean number of turn-1 orders, and the 10 most common routes with the games and share of games that used them. |
| `sanity.abandonments` | S3: a faction left every objective it held with no unit lost and no army retreated. It is judged from unit positions against the scenario's territory ids. A unit standing anywhere else, or an objective that is not a territory, stops the run with an error, so S3 cannot pass by matching nothing. Only units that hold ground count: aircraft do not (D17; they never fight a ground battle and rebase when their airfield's territory falls), while ground units and generals do. Leaving under fire is not abandoning: a battle retreat, or a bounced move that retreated. A Withdraw order (C1) is the computer player's own choice, so it still counts (declog D24). A unit that surrenders on the path rule (P6) left the board, so it counts as lost. |
| `sanity.objectiveChecks` | The total of `objectiveChecks`. The smoke test requires it to be above 0, so S3 is known to have been tested. |
| `sanity.earlyWins`, `earlyWinRate` | S1: games won before turn 4. |
| `sanity.longestQuiet` | The distribution of `longestQuiet`. |
| `sharedVictories` | Decided games with more than one winner. |

## Comparisons

Two cells are compared seed by seed, over the seeds both played: each variant against the baseline.

For each seed the harness takes the difference, subject minus baseline, in:
- each faction's win credit;
- whether the game was decided;
- whether it froze;
- whether it stalled;
- the turns played.

A comparison reports the mean difference with a 95% Student-t interval: `mean +- t(0.975, n - 1) * sd / sqrt(n)`, where `sd` is the sample standard deviation of the differences. With fewer than 2 pairs the comparison is `null`, since no spread can be measured. Pairing on seeds removes the spread from game to game that both runs share. Rate differences are fractions, so the console shows them as percentage points.

## Variant patches (H4)

A variant is a JSON file. It is either an object, or a bare patch array, which takes its name from the file name:

```json
{
  "name": "digging-in-cap-2",
  "description": "Works cap at 2.",
  "patch": [
    { "op": "test", "path": "/factions/0/id", "value": "republic" },
    { "op": "replace", "path": "/combat/diggingIn/max", "value": 2 }
  ]
}
```

- **Format:** the patch is a subset of RFC 6902 JSON Patch, applied to the raw `scenario.json`.
  - The supported operations are `add`, `remove`, `replace` and `test`. `move` and `copy` are not supported.
  - Paths are RFC 6901 JSON Pointers: `~1` stands for `/`, `~0` for `~`, and `-` appends to an array.
  - Use `test` to guard an array index against a reordered scenario.
- **Validation:** the patched document goes through the real loader, so a patch that breaks the scenario fails with the loader's message before any game is played.
- **Names:** a variant's name must be lowercase letters, digits and hyphens. It must be unique and must not be `baseline`.
- **Example:** `src/sim/variants/digging-in-cap-2.json`.

**AI profiles.** Each faction's computer-player profile (E7) is at `/ai/profiles/<factionId>` in `scenario.json`, so a variant changes one side's weights with an ordinary patch, for example `{ "op": "replace", "path": "/ai/profiles/south/computer/caution", "value": 0.3 }`.

**Personas.** The scenario's persona library is at `/ai/personas` (see "AI profiles" in `scenario-package.md`). A variant seats one with `{ "op": "add", "path": "/ai/seats/north", "value": "denier" }`, beside whatever else it changes; the shipped scenario has an empty `seats` for this. A scenario without `seats` needs `{ "op": "add", "path": "/ai/seats", "value": { "north": "denier" } }`.

## Lineups

`--lineup republic=builder,north=denier` plays a cell in which the Republic plays the `builder` persona, the North `denier`, and every faction not named its own profile. It is a variant the command line writes: it sets `/ai/seats` as a whole, so it replaces any seats the scenario has. The cell's name is its seats in the order given (`republic-builder_north-denier`), after the baseline and the `--variant` cells. An unknown faction or persona, or a name used twice, stops the run before any game is played. A cell whose scenario seats a persona, by lineup or by patch, has `seats` in `summary.json` and `report.json`; other cells have no such field. To test a strategy against a balance change, put the change and the seats in one variant file, or change the scenario and play lineups.

## Re-check at the contract merge

Everything the harness reads from the game goes through `src/sim/engine.ts`. Most bookkeeping comes from the board before and after each turn: units by id, their territory and men, and territory control. These places still read the engine's outcome kinds or result fields, because nothing on the board records them:

| Where | What it reads | Used for |
|---|---|---|
| `battleColumn` (`engine.ts`), `playGame` (`game.ts`) | outcomes of kind `battle`: `column` and `result` | `battlesByTurn`, `battles` (results by odds column) |
| `retreatedUnits` (`game.ts`) | `battle.retreats` and `bounced-move.retreatedTo` | S3: an army driven out has not abandoned its objective |
| `holdsGround` (`engine.ts`) | the unit's type kind (`unitKindIn`), including recruited `r_` units | S3: aircraft do not hold objectives |
| `orderRoute` (`engine.ts`), `playGame` | `result.submittedOrders` (`from`, `to`, `factionId`) | `firstTurnRoutes` |
| `playGame` | `result.victory` (`factionIds`, `condition`) | winners and the decided or freeze end |
| `territoryControlKey` (`engine.ts`) | `state.control[territoryId]` | quiet turns (S2) |
| `objectivesOf` (`engine.ts`) | `faction.objectiveTerritoryIds` | S3 |
| `unitTypeIdOf`, `projectKey`, `siteKeys`, `linkKeys`, `heldPoints` (`engine.ts`) | unit types, build projects, sub-territory and link works, holdings | `inventory` |
| `accountOf`, `ordersOf` (`inventory.ts`) | outcomes `income`, `upkeep`, `training-started`, `build-queued`; `submittedOrders` | `inventory` flows |
| `defaultScenarioId`, `loadScenario`, `playComputerGame` | the registry and the submission coordinator | loading and playing |

## Targets (H7)

These are end-of-milestone goals over 1000 games, not gates for each merge:
- freezes at or under 15 percent;
- every faction winning at least 20 percent of decided games (`shareOfDecided`).

Misses are reported to the owner, not tuned in a loop. The smoke test never asserts balance. It checks structure, determinism, S1 (at most 5 percent early wins) and S3 (no abandonments).
