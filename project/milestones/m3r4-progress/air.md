# air: N11, N6 and Ground Support in N4

## N11 one die, one table
- `air.battleTable` in the scenario (schema, `scenario.schema.json`, loader check L25): the five default rows, each with a name and each side's share (`none`, `half`, `all`). Change the table there.
- `engine/air/airBattle.ts`: score = die + attacker's air rolls − defender's − anti-air, clamped by `scoreFor`. The result records the row it read. Every aircraft counts; texts say so.
- The share applies to the sum of at most `supportMax` aircraft, then rounds down once (3 + 3 at half is 3). A side whose share comes to 0 counts no aircraft, so the report says its support did not count.
- A scenario without an `air` block has no table: support applies unopposed, as before.
- `PlannedAir` is now `average`, `share` (average / full) and `results` (one per row, absent when unopposed). `chance` and `odds` are gone. `weighOdds` weighs every result.
- AI: `supportWorth` became `ai.profiles.*.air.supportShare` (0.5), the least average share for aircraft to fly. Against anti-air of 3 a bomber alone keeps 0.45 (does not fly), a fighter alone exactly 0.5 (flies), both 0.625. Before, none of them flew (a win chance of 0.38 to 0.48). The planner still decides aircraft one by one, in id order, so the bomber is refused before the fighter is counted.

## Re-derived fixtures
- `airBattle.test.ts`, `m3r2Contract.test.ts`, `battleAir.test.tsx`: two-dice numbers replaced by the table's. The 60-seed turn test still reads the `air-battle` stream (now one pick) and expects all five rows.
- `aiActions.test.ts` "keeps its aircraft off": the rule changed (above); now pinned at thresholds 0.45, 0.5 and 0.55.
- `mapOrdersLogic.test.ts`: the air sentence is now the ledger row; total checked against its rows.

## N4 Ground Support in the ledger
- `withPlannedAir` (`presentation/rollLedger.ts`): "Ground Support, N aircraft (average; air battle first)", value to tenths, the five results folded out, total rounded from the true total. Unopposed support stays an ordinary row. `airLine` and `InvadeOdds.air` are gone. `RollLedgerRow` has optional `note` and `details`.
- `orders-ux` (N5): the rounding is `toTenth` there; swap in the shared formatter.

## N6 targets on the map
- `OrderStage` has a second step, `choose-target` (`mission`, and `territoryId` once a raid chose its territory). Shared with Move: `selectedDestinations` and the highlights, `clickTerritory`/`clickUnit`, `cancelOrderStage`, the hover card and tap modal (`targetNote` beside `reachNote`), the phone's bar with Cancel. Missions show no odds.
- `TargetPanel` lists the same targets as buttons for the keyboard. A raid lists its sub-territories after the territory; zoomed in, one click on a sub-territory plans it.
- Escape: there was no handler for Move. `useEscape` now leaves either choice; a dialog or menu keeps its own Escape.

## Not done or not seen in a browser
- The new battle card and the averaged ledger row are unit tested only: no opening board has anti-air or a contested sky.
- `capture.spec.ts` was edited for the missing drop-down and not run (its next step asks for an "Intercept" button that no longer exists; older than this branch).
