# upkeep (M3 Rev 3)

## Carry and fractions (step 1, for `values`)
- `engine/carry.ts` is the only place that turns thousandths into whole points. `GameState.carry[faction][resource]` is thousandths owed (below zero: in hand). It replaces `replenishCarry`.
- What a faction really has: `holdings(state, faction)` = treasury x 1000 - carry, in thousandths. `deposit(state, faction, change)` adds or takes thousandths and leaves the treasury at the whole part. Income and upkeep use it; Replenish still takes a whole point only once the carry owes one (`chargeReplenish`).
- `development[].yieldPerLevel` takes thousandths (`positiveThousandthsSchema`, `multipleOf(0.001)`), so `1.5` is data only. `incomeFor(...).paid` and `subTerritoryYield` are points with fractions; `addResources`/`subtractResources` keep them to thousandths, so sums don't drift.
- `resourceAmount` prints at most three decimals ("1.5", "0.25k").

## Upkeep and Disband (steps 2 and 3, engine and computer player)
- Data: `unitTypes[].upkeep` (points per resource, thousandths, default none), the `upkeep` block (`maxLossShare`, `minStrengthShare`), and `"disband"` in each type's `orders`.
- `engine/economy/upkeep.ts`: `projectedHoldings` (thousandths), `upkeepShortfall` (points) and `upkeepProblem` (the refusal text) take the planned orders; `upkeepLines` is the per-type breakdown the balance view needs. `chargeUpkeep` runs after `collectIncome`.
- Refusals are judged at reveal (`payForRecruits`), since a Disband in the same submission can make room.
- `engine/recruitment/disband.ts`: validation and step 10. `ai/orders/disband.ts`: the computer player, planned before Replenish and Recruit.
- `withoutUpkeep(scenario)` in `test/support.ts` for tests that count treasuries.

## Planning and UI
- `Draft.disbands` (`planning/disband.ts`); `unitOrdersWithout` (was `replenishWithout`) drops a unit's Replenish and Disband when it takes another order. `UnitOrderKind` is `OrderKind` plus `disband`, which is given on the card, never from the selection bar.
- `draftOrders` is what `upkeepProblem` is asked about while planning. Each order only lowers the projection, so any order the reveal has granted so far projects at least as much: an accepted order is refused at reveal only if the player later plans a Build that costs an upkept resource, or keeps a unit they had planned to disband. The shortage warning shows both.
- Ledger: the Upkeep row opens into a line per type; the Carried over row is the carry plus what Replenish's whole points leave. Pinned: `now + total` is `projectedHoldings`.
- The computer player's Builds skip a project that would deepen a shortage (`worsens` in `ai/orders/build.ts`).

## Left to do
- Playwright for the ledger row, the warning and Disband; the spec doc.
- RED, for `values` to re-check: `src/test/sim/smoke.test.ts` S1. Seed 8 is won by the Republic by territories on turn 3 (10 of 18 territories, the threshold; 9 of 18 without upkeep, so it was one short before). No bug found: the data alone moves it. The first difference is the South's turn 1. It holds 5k Manpower and earns 0 on the board it plans on (only Ceuta and Melilla are held whole; Andalucia is contested, and pays 15k at turn end), and its bill is 2.3k. The infantry regiment (1k) fits; the militia column (3k and 1.5k upkeep) would leave it 2.8k short, so both the planner and the reveal refuse it, and the Funds go to a mine. It is one column weaker for the rest of the game, does not enter Murcia on turn 2, and loses Castilla-La Mancha on turn 3 instead of contesting it. Seed 8 turns on small spending changes: with the computer player's turn 1 check off (the reveal still refuses the column, so only the mine is missing) it is not won by turn 4. Seed 8 has no Disband in turns 1 to 3.
