# `m3r1-recruit-replenish` progress

Mode: make it work (declog D13). Branch `m3r1-recruit-replenish`, merged with `milestone-3-rev-1` at `eb9515f` (contract CP4).

## What works

- **Engine** (`engine/recruitment/{rules,phases}.ts`, wired in `engine/modules/recruitment.ts`; Spain's `buildings` module is on):
  - Recruit orders are validated (R2, R3, C8), paid at step 1 after builds, and limited per territory (D7). Units then train (R4), pause in contested ground (C8; militia finish), and appear at the end of their last training turn (R7) with definitions in `GameState.raised` (R6).
  - Replenish orders are validated (R5, C1), paid at step 1, and land at step 9. Men are capped per turn and demoralization clears. Any battle, a retreat, or the unit's loss cancels the order with a refund.
- **UI**:
  - The Recruit tab (X4) lists every type with its APP-6A symbol, values, cost, men, training time and a stepper. Locked types say why inline, and hover or focus shows the details: what the type needs, with a tick or a cross for each building. The tab shows the capital's buildings, the D7 count, and a basket line ("This turn" and "Left").
  - The Replenish order leads the order menu when every selected unit can take it. It shows the men, arrival, cost and cancel rule, as in the capture.
  - Units in training, plus this turn's Recruit orders, are drawn dashed under the Units tab.
  - Turn reports use full sentences.
- **Computer player** (H5): `ai/orders/recruit.ts` and `ai/orders/replenish.ts`, plus `ai/orders/spending.ts`, so a later planner spends only what is left.

## Decisions

- RR-1. `engine/resources.ts` holds the shared step-1 arithmetic: `addResources`, `subtractResources`, `scaleResources` (rounds up), `canAfford`, `treasuryOf` and `adjustTreasury`. Economy-builds should import these rather than write its own.
- RR-2. A territory is contested (W6) when its control is `contested`, or when its sub-territories have more than one holder. So País Vasco (Álava North) counts as contested from turn 1. `isContested` in `recruitment/rules.ts` is a stub for sub-territories' own export.
- RR-3. A Recruit site is a territory whose control is the faction's, whose capital sub-territory the faction holds, and which is not contested.
- RR-4. Building gates (R3) and recruit slots (D7) read the capital sub-territory's `buildings` in state: types' `requires`, and the `recruit-slots` effect. Nothing names a building id in code. The `recruitRequirements` hook's reasons are added to the lock.
- RR-5. `validateOrder` checks only static conditions: the site, the faction limit, the buildings, and for Replenish the unit and its ground. Affordability and the D7 limit are checked at reveal, so `lockSubmission` never throws on two orders that are each valid. A refused order reports its price as `refund` and takes nothing.
- RR-6. Payment runs in submission order, after the economy part (area order), from what the builds left.
- RR-7. Timing (R4, R7): step 10 takes a turn off every unit in training, including on the turn of the order. A one-turn militia ordered on turn N appears at the end of turn N and moves on turn N+1. A test pins this.
- RR-8. C8, lost capital: if the faction no longer holds the capital sub-territory at step 10, its training is lost with the payment, like a build in progress ($5). This reports `training-refunded` with an empty refund and a reason. **Owner gap.**
- RR-9. Recruited ids are `r_<faction>_<type>_<serial>`; scenario ids are kebab-case, so an id with underscores cannot clash with one. The definition is derived from the id: "<Type> No. <serial>", with the type's establishment. `requireUnitDefinition(scenario, id)` falls back to it, so no call site had to thread state through. Its return type is narrowed to `UnitIdentity` (name, designation, faction, type, full strength, general). `GameState.raised` records the same definition.
- RR-10. `unitOrder` (scenario-order tie-breaks) places recruited units after every scenario unit, by serial, then type, then faction (`raisedOrder`).
- RR-11. Replenish price = `replenishCostShare` × the type's Recruit cost × the men restored ÷ the unit's full strength, rounded up per resource. That is half the price per value point. The per-turn cap is (`replenishShare` + hook `rateShare` + hook `capShare`) × full strength. **Owner gap:** under this reading the Hospital (+25% rate) and the Depot (+25% cap) do the same thing.
- RR-12. A demoralized unit already at full strength may replenish for nothing (0 men, 0 cost), which clears its morale. **Owner gap:** charge a minimum?
- RR-13. Replenish needs uncontested territory under the unit's own faction's control (C1, C5).
- RR-14. Cancel rule (Q-RECR-5 as ticked, Q-MR-05): a unit on any battle side at steps 4, 5 or 7 (meeting, territory or standing) cancels, and so does a unit that moved territory (fell back) or was lost. The refund is in full.
- RR-15. `replenish-applied.recovered` is read from the start-of-turn morale. The d6 rest rule (M23) runs earlier in step 9 and may also report a recovery for the same unit.
- RR-16. `replenishBonus` is only consumed here, not answered. The Hospital and Depot numbers must come from economy-builds' hook, so they are not counted twice. Until then, no bonus applies.
- RR-17. UI draft: `Draft.recruits` and `Draft.replenishments` (optional). `withDraft` carries them over unless the new draft sets them, and `focusOn` and `unfocus` keep them. End Turn submits `draftOrders(draft)`. Planning a move, Entrench or Rest drops a unit's Replenish order, and Replenish drops its move. `OrderKind` and `ArmyOrder` gain `replenish` ("Replenishing").
- RR-18. The Recruit tab takes every rule answer from the engine. The + button is disabled, with its reason in its title and the hover details, when the type is locked, the D7 slots are full, or the basket leaves too little. The details sit below the row, because the pane's scroll area clips anything drawn outside it. On phones they show on tap (focus) of a locked row only.
- RR-19. The Recruit computer player (no random draws, CT-36) works as follows:
  - **Sites:** every allowed site, most threatened first (enemy attack next door), then scenario order.
  - **Type:** the open ground type with the best (attack + defence) per price. Each resource is counted as a share of the faction's balance, so no resource id is named in code. The score is lowered by 15% per training turn.
  - **Support:** one artillery-like type (`cannot-attack-alone`) per four own units.
  - **Budget:** it keeps 30% of each resource for builds. All of these numbers are design notes for the harness.
  - Aircraft are left to air-generals.
- RR-20. The Replenish computer player picks units with no other order that are demoralized or missing at least 20% of their men. Demoralized units come first, then the most worn, while the balance lasts.
- RR-21. Report sentences: `describeSystemOutcome(outcome, scenario?)` uses `describeRecruitmentOutcome` when it has a scenario. The placeholder strings stay for callers that have none.
- RR-22. Tiny-front stays on the `m2-strength` preset, so recruitment is explicitly off there. Under recruitment `none`, Recruit and Replenish stay "not available" (M9).

## Stubbed

- `isContested`: read from control and holders until sub-territories exports one.
- Replenish bonuses: none until economy-builds answers `replenishBonus`.
- The basket's "Left" ignores this turn's Build orders (TODO in `balanceAfterBasket`). `ai/orders/spending.ts` does not yet price Build orders.
- No income lands yet (economy pass-through), so spending comes only from starting stocks.

## Needs from

- **m3r1-economy-builds:**
  - answer `replenishBonus` from the `replenish-rate` and `replenish-cap` building effects in the unit's territory;
  - add the build basket to `balanceAfterBasket` and Build prices to `ai/orders/spending.ts`;
  - reuse `engine/resources.ts`;
  - a `Draft.builds` field rides through `withDraft` the same way (extend `keepBasket`).
- **m3r1-sub-territories:**
  - export a contested test (W6) to replace `recruitment/rules.ts#isContested`;
  - a capital captured mid-training is handled by RR-8.
- **m3r1-d20-combat:**
  - a unit with a Replenish order should hold without digging in (Q-RECR-5, "the army holds, no entrenching"). Hooks cannot see orders, so the dice module's digging-in part should skip units with a valid Replenish order (`draft.input.submissions`).
  - Use `requireUnitDefinition` (with its raised fallback) or `state.raised` for unit values in the new combat code.
- **m3r1-air-generals:** the AI should recruit aircraft where airfields stand. The Recruit list already shows air types.

## Files outside my ownership that I touched

- `engine/validation.ts`: switch cases for recruit and replenish;
- `engine/lookup.ts`: the raised fallback and the `UnitIdentity` type;
- `engine/board.ts`: `raisedOrder` in `unitOrder`.
- `state/session.ts`: the Draft fields and `OrderKind`;
- `state/planning/{selection,orders,focus}.ts` and `state/planning.ts`: the menu, counts, `withDraft` keeping the basket, and Replenish replacing a move;
- `state/gameSlice.ts`: `changeRecruitQuantity`, and End Turn submitting `draftOrders`.
- `screens/OrderCommand.tsx`: the Replenish label and the `details` prop;
- `screens/ArmyPicker.tsx`: the Replenish detail and status;
- `screens/OrderBuilder.tsx`: the summary count and `TrainingList`.
- `presentation/army.ts`: `replenish` in `ArmyOrder`;
- `presentation/systemText.ts` and `presentation/text.ts`: the scenario passed for sentences;
- `style.scss`: one `@use`.
- `e2e/capture.spec.ts`: a new `@capture recruit and replenish` test (20a-20d).
- `project/specs/scenario-package.md`: rules RR1-RR8.
- Tests: `engineTurn.test.ts` (the M25 invariant skips recruited and replenished units), `visibility.test.ts` (my planners left out of the stubs list), `orders.test.ts` (a fake training outcome dropped), `state.test.ts` (the counts gain `replenish`).

New files: `engine/resources.ts`, `engine/recruitment/*`, `ai/orders/spending.ts`, `presentation/recruitment.ts`, `screens/pane/TrainingList.tsx`, `styles/_recruit.scss`, and the tests `recruitment`, `recruitmentAi`, `recruitmentPlanning` and `recruitmentScreens`.

## Checks

- `npm run lint`: pass. `npm run typecheck`: pass.
- `npx vitest run`: 693 tests, 687 pass. The 6 failures are the known-red sim-harness tests (D14). Spain's soak and determinism tests still pass.
- E2E, chromium and mobile-chromium (`E2E_PORT=5314`): 47 passed, 5 skipped, 4 failed.
  - The three performance failures pass when run serially; they were CPU contention.
  - The one visual diff (planning destinations) comes from the contract's tab bar, not this stream.
- Captures: `build/e2e/screenshots/{chromium,mobile-chromium}-20a-recruit-tab.png`, `-20b-recruit-locked-details`, `-20c-units-in-training`, `-20d-recruit-tab-provincial`.
- `npm run sim -- --games 50` (100 games, with and without blunders):
  - Without blunders: decided 78%, freezes 22%. Wins of decided games: Republic 74.4%, North 12.8%, South 12.8%. Median length 10 turns.
  - With blunders: decided 74%, freezes 26%. Wins: Republic 62.2%, North 18.9%, South 18.9%.
- Outcome tally, 50 seeded all-computer games (a throwaway script, not committed):
  - Recruit: 500 orders, 500 `training-started`, 500 `training-completed`.
  - Replenish: 1284 orders, 1164 `replenish-applied`, 120 `replenish-cancelled`.
  - 0 `rejected-order`.
  - The Republic's lead follows from its 40-Funds starting stock against 15, with no income yet; this is not tuned (H7).
