# ux-cards progress

Done. Both items left by the first session are built.

## Where things are
- `map/pieceLayout.ts`: `withoutAircraft`, `placeAircraft`, `layoutPieces`. Armies are laid out first; aircraft take room they leave, and armies move only when no spot is left. Aircraft group by `compactMetricsAt` (zoom, or a phone's overview) and never by the armies' `compact`.
- `AirLayer` renders `UnitCounter` and `GroupCounter` with `air={{ grounded }}`, which adds the `air-counter` class, `data-grounded`, the hatch and the cloud badge. Its container is also a `.counter-layer`.
- `presentation/airPane.ts`: `aircraftCounterText`, `aircraftGroupText`, `isGrounded` (the engine's own hook), `baseWeather` (the pane's line).
- `presentation/unitEffects.ts`: `unitEffectLines`, every kind from the data. `recruitTerms` is a list of `{ meta, detail }`; print it with `termsLine`.
- `presentation/battleLedger.ts`: `effectName`, which the Invade odds card should use too.
- `e2e/cards.spec.ts`: cards at three zooms, Recruit at 416, 320 and 320 with 200% text, ledger and Who fought.

## For others
- `e2e/production.spec.ts:22` counts `.unit-counter` at 41; it is 46 now, with the five aircraft.
- The unit schema takes only capitals and digits in `designation` (a loader test pins it), so the aircraft read NI52, BR19, JU52 and REC.
- At 320 px with 200% text the game's shell is wider than the screen; the Recruit tab fits its own pane. This is the pane's and the header's to fix.
