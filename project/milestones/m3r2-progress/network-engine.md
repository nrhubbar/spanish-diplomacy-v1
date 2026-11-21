# m3r2-network-engine: progress

> Internal. Milestone 3 Revision 2, tasks §3.3 `network-engine` (R5, R6, R7, `reachFor`, order lines).

## Done

- **R5 move modes** on the links (`engine/network/paths.ts`, `movement/routes.ts`). March crosses one border by a link with a road, or any link for an all-`foot` army, leaving from the army's pocket (`pocketOfArmy`, the `pockets-control` stub). Motor (the `march` shape) runs on main roads the whole way, never over a `noMotor` pass, never into contested ground, at most `road.motorRange`, capped by today's truck allowance, with no mountain step (declog D13). Rail reads the links (`rangeByLevel` by the weakest link); a station at 0 closes; departures and the landing rules are Rev 1's (D12). Sea as today. step-rail and rail-step stay as Rail (D14). Every `MoveRoute` now has `mode` and `path: LinkStep[]`; route failures have an `UnreachableCode`.
- **`reachFor`** (`engine/network/reach.ts`): the `moveRoutes` route per territory with its mode and path, or the reasons mode by mode (March, Motor, Rail, Sea), e.g. "Motor can't cross the Somosierra pass.", or the contested-start refusal alone.
- **R6** (`movement/hooks.ts`, `passModifiers`): a `pass` combat modifier (`{kind, name, roll}`), d20 only, lost to flanking (D15). It is in the battle's `modifiers`, so odds and the report list it ("Pajares pass" in `presentation/odds.ts`). The amphibious estimate now reads March reach rather than "no land connection", so a Málaga landing at Murcia counts.
- **R7** (`economy/catalogue.ts`, `queues.ts`): link works priced from `linkProjects`, refused with plain reasons, one per link (D16), completed into `GameState.builtLinks` (carried by the turn draft, public in views) with the stations raised (D12).
- **Order lines** (`engine/network/lines.ts`): `orderLine(scenario, state, order)` and `pathPoints(path)` give the sub-territory ids a planned move passes.
- Retired `movement.railRangePerLevel`; `improvements.rail.maxLevel` is 2. Spec `scenario-package.md` updated; JSON Schema regenerated.

## APIs for other streams

- `reachFor(scenario, state, factionId, unitIds)`: `Reach` per territory (`mode`, `path` or `reasons`).
- `orderLine`, `pathPoints` (`network/lines.ts`) for `map-orders`.
- `network/links.ts`: `linkBetween`, `linkModifiers(link, state?)`, `isPass`, `passName`, `roadOn`, `railOn`, `stationCap`, `afterWork`, `workMisfit`.
- `network/paths.ts`: `marchCrossing`, `motorPath`, `startSubTerritories`, `allFoot`.
- `MoveRoute.mode` and `.path`; `describeRoute(..., unitIds?)` (8th argument) for the foot rule and the pocket.

## Review

`diff-reviewer` ran once. Fixed: a link work now waits while its far end is lost or contested (D16); the Motor range in the reason text comes from data; the rail reason shows only where the army could board. Not changed: a later leg leaving from the whole territory is correct, since a ride ends and every leg but the last stops only in ground held whole (commented in `routes.ts`).

## Checks

`npm run lint`, `npm run typecheck`, `npm run test:unit` pass. Per-file coverage: every touched file meets the gate, except `movement/transit.ts` (branches 92, as before) and `economy/queues.ts` (functions 90.9, was 90).

## Left

- `ai`: Motor and Rail choices with passes, link works in its build planner (it can't produce them yet).
- `pockets-control`: Málaga's exit from contested Andalucía is Withdraw (D17); the real `pocketOfArmy` changes which links an army leaves by, with no change here.
- `map-orders`: draw `orderLine`; the hover card reads `reachFor` reasons.
- The owner may want to look at Motor's rarity on the starting map (D13).
