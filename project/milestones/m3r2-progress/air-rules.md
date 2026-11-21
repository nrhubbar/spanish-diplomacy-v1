# m3r2-air-rules: progress

> Internal. Phase 1 of Milestone 3 Revision 2 (tasks §3.3 `air-rules`): R8, R9, R10, R11 and the battle card's air section (U10).

## Done

- **R11 air battle.** `engine/air/airBattle.ts`: `airBattle`, exact `airBattleOdds` (all 400 die pairs), `airBattleFought`, `groundSupport`. `engine/air/groundSupport.ts` builds the input from data (`airBattleInput`, `airBattleAircraft`, `antiAirOf`), settles a battle's air (`airOverBattle`), rolls on the `air-battle` stream by battle index (`airBattleRolls`), and feeds the `combatModifiers` hook (`supportModifiers` in `air/hooks.ts`). The d6 and d20 battle paths pass `battleIndex` and the defending units to the hook.
- **Report.** `generals/changes.ts` emits one `air-battle` event per air battle (with the `support` applied) and an `air-support` event per Ground Support flight with `applied`. `presentation/battleAir.ts` words it; `screens/report/BattleAir.tsx` draws it above its engagement (`IndexedBattle.air`, matched by territory and attacker).
- **Odds.** `estimateAttack(..., support)` and `estimateGradedBattle(..., support)` weigh the planned Ground Support by the chance to win the air against the defenders' AA (`plannedAir`, `estimate.air`).
- **R10.** Fighters fly Ground Support (data); Patrol joins the air battle and still intercepts raids and recon, never Ground Support. Rain grounds aircraft (data).
- **R8.** Works are pips 1 to 3 under both dice; `worksRoll` gives the roll (2 a pip on the d20). Counter, army line, group label, battle breakdown and the Briefing use levels and the right values. `src/test/m3r2-probe/worksPips.test.tsx` copied and passing at the R8 values.
- **R9.** The Factory's 6 Manpower is charged when queued and short Manpower refuses it: already true in `economy/catalogue.ts`; tests added.
- Schema: `air-battle` unit effect, `air.supportMax`; `spec:build` regenerated; `scenario-package.md` updated. Declog AR1 to AR6.

## Checks

`npm run lint`, `npm run typecheck`, `npm run test:unit` (coverage gate) pass. One jsdom test timed out once under a coverage run and passed on two reruns; the new seed sweeps take under 0.4 s each under coverage. Diff review done: grounded aircraft no longer count in planned support, and the possessive in the card text is fixed.

Per-file coverage: new files meet the gate. Touched files that were below it before are not lower: `ai/orders/air-mission.ts` (90.1 to 90.3 branches), `d20/battle.ts` (75, unchanged), `generals/changes.ts` (88.2 to 89.0), `standing.ts` (82.1, unchanged), `systemText/air.ts` (90.9 to 91.4), `ArmyLine.tsx` (80, unchanged), `BattleBasics.tsx` (85 to 86.4), `BattleCard.tsx` (90 to 91.7), `air/missions.ts` (92.0 to 92.7).

## APIs for other streams

- `map-orders`: `estimateAttack(scenario, state, factionId, unitIds, target, supportIds)` and its `air` (`PlannedAir`: `chance`, `input`, `odds`, `modifier`); `airBattleOdds`, `airBattleInput` and `plannedAir` for the Invade pane's Ground Support group (`air.supportMax` caps it).
- `ai`: `plannedAir` and `estimateAttack`'s `support` argument to weigh the air battle; fighters may now fly `support`.

## Left

- The `ai` stream teaches the AI Patrol over its attacks and fighters on Ground Support (today a fighter supports only a planned attack in range, else patrols).
- Review leftovers (low): an `air-support` event's `applied` reads the first battle at its territory its faction is in; the card matches an air battle by territory and attacker (battle outcomes carry no battle index). The weighed odds keep the unsupported battle's faces, bands and modifiers.
- AR5 departs from the literal "rain and snow ground all air": a paved airfield still flies; making it literal needs the Air pane's weather verdict changed (pane UI, not this stream). Owner to confirm.
- `presentation/odds.ts` `destinationEstimates` and `plannedEstimates` do not yet pass planned Ground Support; `map-orders` wires it with its Invade pane.
