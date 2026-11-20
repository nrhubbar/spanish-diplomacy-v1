# `m3r1-weather-timer` progress

Mode: make it work (declog D13). Decisions T1-T6, the timer and readiness parts of X1, step 0 and the weather effects.

## Done

- Engine, calendar and weather (commit 1):
  - `engine/calendar.ts`: half-month dates from `scenario.calendar`.
  - `engine/weather.ts`: the seeded roll, `beforePlanning` (step 0), zone lookups, the forecast, and the sea-closure functions.
  - `engine/modules/weather.ts`: the hooks, the report record at step 0, and frostbite at step 9.
  - `engine/phases/00-weather.ts`: the `time-ran-out` outcome.
  - `presentation/turn.ts`: the date in every turn label.
  - The coordinator rolls the weather before planning, and the readiness selector treats computer players as ready.

## Decisions

- WT-1. **The weather is rolled before planning, not inside `resolveTurn`.** `beforePlanning(scenario, state, seed)` sets `state.weather` from `rollStream(seed, "weather", turn, 0)`. `advance()` calls it on every entry, which is idempotent. So the start-of-turn state that planning, the computer player, the odds estimates and every hook read already holds the turn's weather (CT-44). This covers the app's start, every `nextTurn` and the sim, which also goes through `advance`. Step 0 inside `resolveTurn` only records `weather-rolled` from the start state. A test that calls `resolveTurn` directly with no `state.weather` gets neutral weather.
- WT-2. **One d20 a turn** (Q-WX-1, Q-MR-29) is read against each zone's table for the season of the turn's month. Each table runs from best to worst, so a high roll is bad weather everywhere at once.
- WT-3. **The attack modifier follows the dice in play.** Under `d20-graded` it is the outcome's `attackRoll` (Hot 0, Rain 0, Mud −3, Snow −3, Severe cold −6). Under `d6-table`, which Spain still uses until `m3r1-d20-combat` flips it, it is a third of that, truncated (0, 0, −1, −1, −2), which is Q-WX-6's d6 column and D3's ×3 rule. A zero modifier adds no line. The modifier uses the battle territory's zone.
- WT-4. **Effects use the start-of-turn weather** of the territory's zone:
  - `canDigIn`: the holder's territory.
  - `allowanceDelta`: the origin (`from`).
  - `grounded`: the aircraft's territory. The exception is an `all-weather-airbase` building effect in a sub-territory of that territory held by the aircraft's faction, read from data, never a building id (CT-5).
- WT-5. **Frostbite** is the weather module's step-9 (`morale`) part. A unit with a valid move whose origin or destination has a `frostbite` effect (Severe cold) loses that share of its current men, rounded to the nearest man (5 percent, D7). A unit already gone loses nothing. The outcome is public. `m3r1-movement-rail-ports` should not also apply frostbite: the TODO in `engine/modules/movement.ts` mentions it, but it lives here.
- WT-6. **Sea closure** is the exported `isSeaConnectionClosed(scenario, state, connection)` and `isSeaRouteClosed(scenario, state, from, to)` in `engine/weather.ts`. A sea connection is closed when a coastal zone at either end has an outcome whose `closes-sea` effect lists the turn's month. Spain's data puts that on Rain only, in December, January and February (Q-MR-30). No new hook was added to `hooks.ts`.
- WT-7. **The date** reads "Turn 7 · Late October 1936" through `turnLabel` whenever the scenario has a calendar, on every screen that shows the turn: planning, handoff and report. Turn 1 now reads "Late July 1936", not the snapshot label. Tiny-front, with no calendar, keeps "Turn 1 · Day 1" and "Turn 2". Following the approved capture, the date sits in the header kicker, so `DateChip` stays empty.
- WT-8. **Time running out** is carried by the submission. `PlayerSubmission.timedOut?: true` is an optional field in the contract's `types/orders.ts`. The engine's own step-0 part reports `time-ran-out` with the faction's units that had no unit order (`heldUnitCount`). The engine never reads a clock, so games replay. It works for every scenario, including those without weather.
- WT-9. **Readiness (T6).** `selectSubmissionStatus` counts a computer player as ready whether or not `advance` has reached it yet.

## Needs from

- **`m3r1-movement-rail-ports`:**
  - call `isSeaRouteClosed` (or `isSeaConnectionClosed`) when validating sea legs;
  - clamp the allowance at 1 after `hookedAllowanceDelta` (M1);
  - use `WeatherChip` on destination rows (to come);
  - leave frostbite to this stream.
- **`m3r1-d20-combat`:** the `weather` modifier arrives through `combatModifiers`. Give it a battle-card name; `presentation/odds.ts` `modifierName` has the weather case.
- **`m3r1-air-generals`:** call `hookedGrounded` before a mission flies.

## Files outside my ownership

- `src/main/engine/types/orders.ts`: `PlayerSubmission.timedOut`.
- `src/main/state/coordinator.ts`: one line, `beforePlanning` in `advance`.
- `src/main/state/selectors.ts`: one line, computer players ready.
- Tests: `src/test/state.test.ts` (SIC now ready), `src/test/app.test.tsx` and `e2e/acceptance.spec.ts` (the turn-1 date).

## Checks

- typecheck passed; lint on touched files passed.
- `vitest`: everything passes except the six known-red sim-harness tests (D14).
