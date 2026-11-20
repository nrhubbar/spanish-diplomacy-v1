# `m3r1-movement-rail-ports` progress

Mode: make it work (declog D13). Decisions M1-M6, X5, X6; step 3 and the withdraw legs of step 6.

## Done

- **Engine** (`src/main/engine/movement/`):
  - `network.ts`: held-whole ground from sub-territory holders, P8 entry terrain, rail reach (`railReach`), rail links for the map, capital departures, friendly ports, landings, sea closure through a hook.
  - `allowance.ts`: M1 allowance, the truck bonus (`transport`, `mobile` effects from data) as the module's `allowanceDelta` hook, step cost.
  - `routes.ts`: the one route enumerator (`moveRoutes`) and checker (`describeRoute`, `validateRoute`) that the reveal check, the planning screen and the computer player share; army keys and capacity claims.
  - `transit.ts`: the `allowance` module's step-1 part (`checkArmies`: armies, allowance and capacities) and step-3 part (`moveAlongRoutes`: interception, staging, reinforcements).
  - `withdraw.ts`: P6 withdraw legs (`withdrawLegs`) on a stand-in path function (`ownPath`).
  - `hooks.ts`: `allowanceDelta` (trucks) and `combatModifiers` (amphibious).
- **Outcomes**: `move-held-back`, `move-intercepted`, `move-transit` (`types/outcomes/moves.ts`, `MovementTurnOutcome`), with report lines in `presentation/systemText/movement.ts`.
- **Spain** runs `rules.movement: "allowance"`.
- **Computer player (H5)**: `legalMoves` returns routed orders (rail, sea, marches with the trucks standing with the unit); `withRoutes` attaches routes, sends free trucks with the largest (marching first) army in their territory, cuts marches the army cannot carry, and keeps armies within departures, landings and lanes.
- **UI (X5, X6, X8)**:
  - destination rows tagged by route ("By rail", "Rail, then attack", "Amphibious"), with chips (weather via `WeatherChip`, mountain or swamp entry, fatigue, rail level, port or amphibious, transit, moves left) and a route line, as the button's description;
  - a breakdown card (`screens/movement/RouteCard.tsx`) for the hovered or focused row: odds and every modifier, moves used, terrain, rail level and borders, amphibious, weather, take chance;
  - "Army leaving <territory>" (`ArmyLeaving.tsx`): units, attack, moves this turn and the truck rule;
  - map plaques carry the short tag ("Rail + attack");
  - the rail layer (`map/layers/RailLayer.tsx`): thin curves between sub-territory stations, main lines (level 2+) at full-map zoom, all lines from the operational zoom, tie marks on main lines, the rideable network of the selected units in the route colour, rail and sea routes traced while choosing and once planned;
  - small line icons (`MoveIcon.tsx`) on chips and the truck rule;
  - planned orders list each leg ("Madrid \u2192 Castilla-La Mancha (rail) \u2192 Arag\u00f3n").
- Captures: `@capture movement, rail and ports (X5, X6)` writes `21a-move-destinations`, `21b-move-route-card`, `21c-rail-operational`.
- Tests: `src/test/movement.test.ts`, 20 tests on the modular tiny-front with a lorry and a horse type: ground, rail reach and range, departures, allowance and trucks, route shapes and checks, ports and amphibious, the amphibious modifier, transit, interception, held-back armies, the computer player, the X5 texts, withdraw legs.

## Decisions

1. **MV-1. Held whole** is read from `state.subTerritories[*].holder`, not `control`. País Vasco (Álava North) and Extremadura (Cáceres North) are therefore not friendly ground for transit until `m3r1-sub-territories` derives control from holders.
2. **MV-2. Friendly ground** for a transit stop or a rail end is held whole with no other faction's army at the start of the turn.
3. **MV-3. Route shapes** are exactly M4's plus sea: `step` (any one land step), `march` (2+ land steps), `rail`, `step-rail`, `rail-step`, `sea` (one sea leg, always the move's only leg). At most one rail leg. A route may not enter a territory twice.
4. **MV-4. Allowance cost**: each land or sea step costs 1, plus 1 when it enters a mountain or swamp sub-territory (P8, the connection's `entry`). A path fits when its cost is at most the allowance, and a single step always fits. Rail legs cost nothing.
5. **MV-5. Trucks**: +1 when the army's transport capacity (`transport.carries`, 2 for Spain's truck column) covers every unit that is neither transport nor `mobile`, and there is at least one truck or nothing needs carrying (an all-cavalry army gets +1). The terrain cost is waived only when every unit in the army is `mobile`.
6. **MV-6. Rail reach**: for each level L from the boarding capital's level down to 1, a 0-1 search over held sub-territories with rail of at least L; crossing a territory border costs 1. A territory whose capital is reached within `railRangePerLevel * L` crossings, and which is friendly ground, is a ride end; the highest L that reaches it gives its ride. Rides may pass through held sub-territories of contested territories.
7. **MV-7. Departures** at a boarding capital are its rail level plus every `rail-departures` building effect there (the Rail yard). Port landings are the best friendly port level in the destination times `landingsPerPortLevel`. An amphibious lane takes one army per faction per connection per turn.
8. **MV-8. An army** (W4) is every unit of one faction with the same origin and the same legs. Capacity counts armies, so units sailing one lane from one origin are always one army: the amphibious lane limit binds only in principle.
9. **MV-9. Over-capacity and over-allowance** armies are held back, not disbanded: at reveal, in the order their first unit was ordered, an army that does not fit stays put with its standing order and a `move-held-back` outcome. Per-order validation (M9 disbanding) still covers impossible legs.
10. **MV-10. Sea moves** sail from any port the faction holds in the origin territory (not only the connection's entry), and land in the faction's best port in the destination; with none there it is an amphibious assault. The sea is open unless a module's `seaClosed` hook closes it.
11. **MV-11. Amphibious modifier**: the `combatModifiers` hook adds `d20.modifiers.amphibious` for an attacker whose start territory reaches the battle only by sea while its faction holds no port there. Exact because a sea leg is always a move's only leg. Only under `d20-graded`; under the d6 rules it is left out.
12. **MV-12. Transit**: at step 3, a multi-leg move stops at the first of its transit territories (leg ends before the last) that another faction's valid move enters, and defends there as a reinforcement (`move-intercepted`). Rail rides are checked at their ends only, not at each territory the train passes. Every other multi-leg advance moves to its staging territory (where its last leg starts) and becomes an ordinary one-step move from there for steps 4-6, so a bounce returns it to the staging territory. Its `origins` entry is the staging territory.
13. **MV-13. Reports**: battle and move outcomes show the last step (from the staging territory); a `move-transit` outcome per army records the whole route. `submittedOrders` keep the full legs. Remapping the move outcomes to the submitted order is left for make-it-right.
14. **MV-14. Frostbite** is `m3r1-weather-timer`'s step-9 part (WT-5); the movement module does not apply it.
15. **MV-15. Canonical route per destination** (UI and AI): step or sea first, then a pure ride, a march, step-then-ride, ride-then-step; first found within a shape, in scenario order. Routes with no capacity left given the faction's other planned moves are skipped, so the next shape is offered.
16. **MV-16. Computer player**: plans per unit on routed destinations; trucks are never planned on their own; post-pass as above. Capacity overflow drops the extra armies' orders (they hold). Routes are remembered per state object (`railReach`, the planner's unit routes), which keeps a Spain plan at about 3.4 ms a faction against 2.5 ms on single steps.
17. **MV-17. Orders keep no legs for a plain land step** (CT-6), from the planning screen and the computer player alike; rail, sea and marches carry theirs.
18. **MV-18. Route details are the button's description, not its name**: the button names the destination and the odds; the route line and chips sit beside it with `aria-describedby`. The card shows on hover and on keyboard focus.
19. **MV-19. Sea closure** reads `isSeaRouteClosed` (`engine/weather.ts`). The interim `seaClosed` hook I had added to `hooks.ts` is removed, so `hooks.ts` is back to the contract's version.
20. **MV-20. The amphibious modifier stays d20-only** (MV-11) although the hook is collected under both dice: the d6 `combat` block has no amphibious number, and the d20 value would swamp a d6. Spain ships on `d20-graded`, so it applies there.
21. **MV-21. Withdraw legs** (P6): one land step to an adjacent territory the faction controlled at the start of the turn, reached through its own sub-territories of the origin (`ownPath`, a breadth-first search from any held sub-territory to one bordering the target). Undefined means surrender. Not wired: Withdraw still validates in `m3r1-sub-territories`.

## Stubbed

- Withdraw legs (P6): `withdrawLegs` and its stand-in `ownPath` are written and tested, not yet called at step 6 (see "Needs from").
- Weather's −1 in Mud or Snow and sea closure now come from `m3r1-weather-timer` (its `allowanceDelta` hook and `isSeaRouteClosed`).

## Needs from

- **m3r1-weather-timer**: done after the merge (allowance hook, `isSeaRouteClosed`, `WeatherChip`, frostbite).
- **m3r1-sub-territories**: the P6 path function (to replace `ownPath`), Withdraw validation at reveal, and a step-6 call of `withdrawLegs`; control derived from holders (MV-1). Its map layer may want `MapPackage.subTerritories`, which I added (below).
- **m3r1-recruit-replenish**: its recruit planner never recruits truck columns or cavalry in a 3-game, 20-turn probe, so marches never happen in Spain games; the move planner sends trucks along when there are any (tested on the fixture). A truck now and then for an army with two or more units would let H5's truck logic show in the harness.
- **contract (make-it-right)**: `CombatHookContext` could carry the turn's orders or scratch, so the amphibious rule does not need MV-11's inference.

## Files outside my ownership

- `src/main/engine/validation.ts`: dispatch to `validateRoute` under `allowance`.
- `src/main/state/planning/selection.ts` (`selectedDestinations` from routes, `selectedRoutes`) and `orders.ts` (legs on the planned order).
- `src/main/screens/DestinationChoices.tsx` (route tag, route line and chips as a description, the card) and `OrderBuilder.tsx` (`ArmyLeaving`, routes passed in).
- `src/main/map/DestinationOddsLayer.tsx` (`tags`) and `MapLayers.tsx` (passes them).
- `src/main/presentation/text.ts`: `route()` names each leg.
- `src/main/scenarios/loader.ts` and `loader/map.ts`: `MapPackage.subTerritories` (label and capital points from the map's `subTerritories.entries`), for the rail stations.
- `src/main/style.scss`: one `@use` line for `styles/_movement.scss`.
- `e2e/capture.spec.ts`: one capture test.
- `src/main/engine/types/outcomes.ts`: `MovementTurnOutcome` joined into `SystemOutcome`.
- `src/main/presentation/systemText.ts`: one import, one spread.
- `src/scenarios/spanish-civil-war-1936/scenario.json`: `rules.movement` to `allowance`.
- Tests: `pipeline.test.ts` (movement no longer a skeleton), `spainData.test.ts` (rules), `computerPlayer.test.ts` (a reinforcement may now ride through), `combatScreens.test.tsx` (more destinations than the two neighbours), `d20Combat.test.ts` (two AI boards pinned to `single-step`, as they count on one-step reach).

## Checks

After merging `milestone-3-rev-1` at `38b68ba` (d20-combat, recruit-replenish, weather-timer):
- typecheck, lint: pass.
- test:unit: 754 of 760 pass; the 6 failures are the known sim-harness ones (D14).
- `@capture movement, rail and ports` on chromium and mobile-chromium: pass.
- `npm run sim -- --games 50 --variant single-step.json --blunders without` (seeds 1-50, 66 turns, Spain on d20):
  - allowance: decided 76% [63, 86], freezes 24% [14, 37], stalled 32%, median length 14; wins of decided Republic 74% [58, 85], North 18% [9, 33], South 8% [3, 21]; battles per turn 1.52.
  - single-step on the same seeds: decided 72%, freezes 28%, stalled 42%; Republic 67%, North 19%, South 14%; battles per turn 1.31.
  - Difference: freezes -4 points [-24, +16], stalled -10 [-31, +11], Republic +8 [-11, +27]. None significant at 50 games.
- Probe of 3 games x 20 turns: 605 single steps, 59 rail-then-step, 23 rail, 18 step-then-rail, 24 sea; 40 transit and 18 interception outcomes; no army held back (the planner keeps within capacity).

Before the merge (Spain on d6):

- typecheck, lint: pass.
- test:unit: all pass except the six known sim-harness failures (D14).
- `npm run sim -- --games 50 --variant single-step.json --blunders without` (seeds 1-50, 66 turns):
  - allowance: decided 66% [52, 78], freezes 34% [22, 48], stalled 42%, median length 13; wins of decided Republic 85% [69, 93], North 6%, South 9%; battles per turn 0.67.
  - single-step on the same seeds: decided 54%, freezes 46%, stalled 58%; wins Republic 41%, North 44%, South 15%; battles per turn 0.48.
  - Rail cuts freezes by 12 points [-8, +32] and favours the Republic heavily (-34 points [-54, -14] without it): its interior lines and level-3 hubs (Madrid, Valencia, Barcelona) let it shift armies fast. For the harness and the owner, not tuned here.
