# ux-pane

Done: the resizable pane and phone stops, the Invade rework, ticked units on the map, header fixes, casualties.

- **Roll ledger:** `components/RollLedger.tsx`, props `rows: {label, value}[]`, `total`, optional `title`, `totalLabel`. Labels: `presentation/rollLedger.ts` (`ledgerLabel`, `rollLedger`), which falls back to `modifierName`.
- **Estimate:** `estimateAttack(..., support, plannedRoutes?)`. `routesOfMoves` (`engine/movement/transit.ts`) builds the routes; the hooks read scratch, then `plannedRoutes`, then infer a March. Only the Invade pane passes it; the map's destination odds still infer.
- **Ticks:** `pane.muster` (`paneSlice`): the player's changes over the draft, dropped by any change of view. `musterPicks`, `tickedOnMap` (`state/planning/muster.ts`); `MapView.tickedUnitIds`, `glows()` (`map/view.ts`).
- **Aircraft glow:** `tickedUnitIds` holds ticked aircraft too. `AirLayer` (ux-cards) does not read it yet: use `glows(view, unit.id)` there.
- **Casualties:** `engine/casualties.ts`, an explicit list of outcome kinds; a new outcome counts for nothing unless listed. `GameState.casualties` is optional. New `men` on `disbanded-move`, `invalid-order`, `path-surrender`; `surrenderedMen` on battles; a frostbite break-up's `men` is now all the unit had left.
- **Pane size:** `map/paneSize.ts` (pure), `map/panePreference.ts` (localStorage), `map/PaneGrip.tsx`. `paneSlice.opensTall` says which views open at 86%.
- `armiesOf` now returns non-empty armies, which removed two dead checks in `ai/orders/move.ts`.
