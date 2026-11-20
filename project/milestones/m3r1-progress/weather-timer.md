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

- UI and timer (commit 2):
  - `state/timerSlice.ts` (the setup choice and the clock) and `state/timeout.ts` (the `timeRanOut` action and `submitOnTimeout`).
  - `components/header/TimerChip.tsx`: the countdown, the warnings, Pause and the pause cover.
  - `components/header/ReadinessChips.tsx`: "REP planning" and "NIC ready".
  - `components/timer/TimerChoice.tsx`: on the setup screen.
  - `components/weather/{WeatherIcon,WeatherChip,TerritoryWeather}.tsx`: the icons, the exported chip, and the pane pill with next turn's forecast.
  - The weather symbol on the map's odds plaques.
  - `screens/report/TurnConditions.tsx`: the report's Conditions section, with whose time ran out and how many units held, each zone's weather, and frostbite.
  - `presentation/weatherText.ts`.
  - `styles/_weather-timer.scss`.
  - Capture: `@capture weather and turn timer` in `e2e/capture.spec.ts` (20a to 20f).

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

- WT-10. **The timer lives in its own Redux slice, `timer`.** Reducers stay pure. Every time arrives in an action payload, read from `Date.now()` by the chip, and the engine sees only `timedOut`. The setup choice is a preference: it defaults to Off and survives across games; Exit and Start Campaign clear only the clock.
- WT-11. **Each player's clock is keyed by game seed, turn and faction.** It starts when that player's planning screen shows its timer chip, which in hot-seat play is right after Continue on the handoff screen (Q-TIMER-2), or at once with one local player. The budget is minutes × 60 s, doubled on turn 1. Unused time is dropped: every turn and player gets a fresh clock.
- WT-12. **At zero, the chip dispatches `timeRanOut` once.** The game reducer submits `draft.orders` with `timedOut: true` and drops any order still being built (the open stage). Units without an order take their defaults (entrench, or rest), and the coordinator moves on as for End Turn. `heldUnitCount` counts the faction's units that had no unit order.
- WT-13. **The warnings stay in the chip.** It turns amber in the last minute and red in the last 10 seconds, and a polite live region says "One minute left" and then "Ten seconds left", once each. The 1-minute warning is skipped when the whole budget is 1 minute or less. The chip has `role="timer"`, with the time left in its name. The notification shelf is not used: it has no auto-dismiss, and on a phone it covered the pane toggle and End Turn.
- WT-14. **Pause** covers the whole screen with a dialog (a portal to `body`), like the handoff screen, and keeps the time left (Q-TIMER-4). It is offered only when no faction is an online player, which today is always.
- WT-15. **Readiness chips** show the abbreviation and a visible "ready" or "planning", as in the capture. The full name is visually hidden for screen readers.
- WT-16. **The header layout is set by CSS `order`** in `_weather-timer.scss`; `GameHeader` is not edited.
  - Desktop: title, readiness chips, then the meters on the right before Exit.
  - Phone: title and Exit, a forced break, one compact row of meters (timer, Funds, Manpower), then the readiness chips.
  - A meter chip is any header child with the class `header-meter`. The timer has it, and economy's chips need it (Needs from).
- WT-17. **Open deviation for the integrator: the weather pill and forecast sit in the Units tab, under the "Held by" line.** The approved capture puts them above the tabs, with economy's "Pays +11 Funds" chip. Today the territory heading lives inside the Units panel, so the pill disappears on Build and Recruit. Moving the heading, the pill and economy's chip above the tabs is a pane-frame change I did not make. The forecast names next turn's two likeliest outcomes in the zone, from next turn's season table, never from the seeded roll. Ties keep table order.
- WT-18. **Icons** are inline SVG in `currentColor`, one per outcome id (sun, thermometer, rain cloud, mud ripples, snowflake, cold thermometer with a flake), with a cloud fallback. They are decorative, and the name is always written or labelled. Each outcome has its own shape and tone, never colour alone. The timer chip and Pause carry icons too (X8).
- WT-19. **The map's odds plaques** get the destination's weather symbol through a new optional `weatherAt` prop on `DestinationOddsLayer`, passed from `MapLayers`. Plaque placement counts the symbol's width.
- WT-21. **The `weather` battle modifier** (`modifierName` in `presentation/odds.ts`, owned here per CT-30) is named after its outcome, "Mud" or "Severe cold", taken from the id because these helpers have no scenario (`presentation/weatherName.ts`). On destination rows, `modifierPhrase` adds the roll: "Mud \u22121".
- WT-22. **The `DateChip` slot renders nothing on purpose.** The date is in the kicker (WT-7).
- WT-20. **The computer player** reads weather through its odds: `estimateAttack` calls `situationalModifiers`, which calls the hooks. It does not yet avoid moving in Severe cold.

## Stubbed or inert until another stream calls it

- **Grounding:** `weatherHooks.grounded` is written and tested. Nothing calls `hookedGrounded` yet (`m3r1-air-generals`).
- **Movement penalty:** `weatherHooks.allowanceDelta` is written and tested. Nothing calls `hookedAllowanceDelta` yet (`m3r1-movement-rail-ports`).
- **Sea closure:** `isSeaConnectionClosed` and `isSeaRouteClosed` are written and tested. No validation calls them yet (`m3r1-movement-rail-ports`).
- **Weather on destination rows:** `WeatherChip` is exported. `DestinationChoices` belongs to `m3r1-movement-rail-ports`, and I did not edit it.
- So the sim's weather difference measures only the attack modifier, the dig-in block and frostbite.

## Needs from

- **`m3r1-movement-rail-ports`:**
  - call `isSeaRouteClosed` (or `isSeaConnectionClosed`) when validating sea legs;
  - clamp the allowance at 1 after `hookedAllowanceDelta` (M1);
  - use `WeatherChip` on destination rows (to come);
  - leave frostbite to this stream.
- **`m3r1-economy-builds`:** put the class `header-meter` on each Funds and Manpower chip, the root element of each child the header renders, so the shared row orders them after the timer (WT-16).
- **`m3r1-d20-combat`:** the `weather` modifier arrives through `combatModifiers` with the d20 value (−3 or −6) once `rules.dice` is `d20-graded`. Its name and phrase are done (WT-21).
- **`m3r1-air-generals`:** call `hookedGrounded` before a mission flies.

## Files outside my ownership

- `src/main/engine/types/orders.ts`: `PlayerSubmission.timedOut`.
- `src/main/state/coordinator.ts`: one line, `beforePlanning` in `advance`.
- `src/main/state/selectors.ts`: one line, computer players ready.
- `src/main/state/store.ts`: one line, the `timer` reducer.
- `src/main/state/gameSlice.ts`: the `timeRanOut` case, plus its import.
- `src/main/screens/SetupScreen.tsx`: `<TimerChoice />`.
- `src/main/screens/OrderBuilder.tsx`: `<TerritoryWeather />` in `TerritoryDetails`.
- `src/main/screens/ResolutionScreen.tsx`: `<TurnConditions />`.
- `src/main/map/DestinationOddsLayer.tsx` and `src/main/map/MapLayers.tsx`: the weather symbol on the plaques.
- `src/main/style.scss`: one `@use` line.
- `src/main/presentation/odds.ts`: the `weather` case of `modifierName`, and the weather roll in `modifierPhrase`.
- `src/main/components/header/DateChip.tsx`: its comment only.
- `src/main/presentation/systemText/weather.ts`: this area's own file; the placeholder lines are now generic sentences.
- Tests and e2e:
  - `src/test/state.test.ts`: SIC is now ready.
  - `src/test/edges.test.tsx`: the chip reads "ready".
  - `src/test/app.test.tsx` and `e2e/acceptance.spec.ts`: the turn dates.
  - `e2e/capture.spec.ts`: the new capture.

## Checks

- lint and typecheck passed.
- `vitest`: 686 passed. The only failures are the six known-red sim-harness tests (D14).
- New tests: `src/test/weather.test.ts` (16) and `src/test/timer.test.tsx` (11, including a hot-seat timeout).
- e2e on chromium and mobile-chromium (`E2E_PORT=5317`): 44 passed and 5 skipped. The 7 failures are all visual baseline diffs, the allowed kind, from the setup timer, the date in the kicker, the readiness words and the weather pill. No baselines were regenerated.
- `@capture weather and turn timer` passes on both projects. The captures are `build/e2e/screenshots/{chromium,mobile-chromium}-20a-setup-timer`, `20b-planning-timer-weather`, `20c-destination-weather`, `20d-paused`, `20e-ten-seconds` and `20f-time-ran-out`.
- `npm run sim -- --games 50`, with a variant that turns weather off, on seeds 1-50 with a 66-turn limit:

| Cell | Decided | Freezes | Stalled | Median length | Republic | North | South |
|---|---|---|---|---|---|---|---|
| Weather, with blunders | 52% | 48% | 76% | 19.5 | 38.5% | 30.8% | 30.8% |
| Weather, without blunders | 42% | 58% | 74% | 15 | 52.4% | 28.6% | 19.1% |
| No weather, with blunders | 48% | 52% | 80% | 18.5 | 50.0% | 33.3% | 16.7% |
| No weather, without blunders | 54% | 46% | 58% | 15 | 40.7% | 44.4% | 14.8% |

  Win shares are of decided games. Weather against no weather, with blunders: freezes −4.0 points [−18.0, +10.0], and South's win share +8.0 points [−3.3, +19.3]. Every interval crosses zero at 50 games. The median game ends around turn 15 to 20 (about February to March 1937), so only part of each game sees winter weather. Abandonments and early wins: 0 in every cell.
