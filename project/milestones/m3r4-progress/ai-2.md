# ai-2: P4, the computer player

**S1 failed with the backing on both sides (2 of 10 games won before turn 4: 0.2 against a limit of 0.05), so steps 1 and 2 are reverted here.** They are whole, with their tests, on `m3r4-ai-2-backing`. Not tuned, smoke test not rerun.

## On this branch
- Recruit prices (`orders/recruit.ts`): `recruitSupply` is read again for each slot, from the planned orders and the recruits already taken. Test: `aiSpending.test.ts`, "prices what is left as a turn's orders pile up".

## On `m3r4-ai-2-backing` (reverted here)
- 534173d, cb097b7: the attack backing (5df177d, 10a1ed4), picked cleanly.
- ae5844d: the choice of who flies (`bestSupport`, with `supportChance`) is one function in `ai/groundSupport.ts`, used by the air planner and by `Backing.aircraftOver`. An attack no longer counts aircraft that wouldn't fly.
- 61edad2: `Assessment.danger` counts the enemy's generals (as `generalsWith`) and Ground Support (`aircraftOver`, against the AA at home). `assess` takes the whole board as an optional last argument, since `movePlanningView` leaves aircraft out. `oddsForValues` takes the backing and shares `supportedOdds` with `estimateBattle` (`engine/d20/estimate.ts`, outside the stream). The backing depends on the territory and the attacker only, so the `danger` keys are unchanged.
- Not counted: our own generals defending (danger compares values), and enemy aircraft defending a garrison we attack (the planner knows only AA, as on the Invade card).

## Lost aircraft (step 4): not built
The profile's `air` block holds only `supportChance`. Nothing in the data turns a chance of losing an aircraft into a cost, so it needs a new number.

## Checks
- Full unit run, once, with steps 1 to 3 in: 1886 of 1887 passed, S1 the only failure. S3 passed. Coverage gave no failure line and no figures.
- **S1 is not shown on this branch's final state.** Step 3 was in the failing run and is still here; the run allowance was spent.
- After the reverts: typecheck, lint and the 7 AI test files (89 tests) pass.
- Planning, opening board, best of 8 single calls, before and after steps 1 to 3 (the first is step 1 as picked): Republic 8.2 to 9.0 ms, North 5.8 to 6.3, South 2.8 to 3.1.

## Recruits now (one planner call each, opening board)
Republic 1 truck, 1 infantry, 3 guns; North 1 truck, 1 anti-air; South none. (`ai.md` gives older lists from a different base; the mid and rich boards were not recomputed.)
