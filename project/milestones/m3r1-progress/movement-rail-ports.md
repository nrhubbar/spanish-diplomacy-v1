# `m3r1-movement-rail-ports` progress

Mode: make it work (declog D13). Decisions M1-M6, X5, X6; step 3 and the withdraw legs of step 6.

## Done

- **Engine** (`src/main/engine/movement/`):
  - `network.ts`: held-whole ground from sub-territory holders, P8 entry terrain, rail reach (`railReach`), rail links for the map, capital departures, friendly ports, landings, sea closure through a hook.
  - `allowance.ts`: M1 allowance, the truck bonus (`transport`, `mobile` effects from data) as the module's `allowanceDelta` hook, step cost.
  - `routes.ts`: the one route enumerator (`moveRoutes`) and checker (`describeRoute`, `validateRoute`) that the reveal check, the planning screen and the computer player share; army keys and capacity claims.
  - `transit.ts`: the `allowance` module's step-1 part (`checkArmies`: armies, allowance and capacities) and step-3 part (`moveAlongRoutes`: interception, staging, reinforcements, frostbite).
  - `hooks.ts`: `allowanceDelta` (trucks) and `combatModifiers` (amphibious).
- **Outcomes**: `move-held-back`, `move-intercepted`, `move-transit` (`types/outcomes/moves.ts`, `MovementTurnOutcome`), with report lines in `presentation/systemText/movement.ts`.
- **Spain** runs `rules.movement: "allowance"`.
- **Computer player (H5)**: `legalMoves` returns routed orders (rail, sea, marches with the trucks standing with the unit); `withRoutes` attaches routes, sends free trucks with the largest (marching first) army in their territory, cuts marches the army cannot carry, and keeps armies within departures, landings and lanes.
- Tests: `src/test/movement.test.ts` (on the modular tiny-front with a lorry and a horse type).

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
14. **MV-14. Frostbite** (T4, D7) is applied at step 3 to every unit that moves, read from `systems.weather` at its start territory's zone; a unit keeps at least one man. Inert until `m3r1-weather-timer` rolls weather.
15. **MV-15. Canonical route per destination** (UI and AI): step or sea first, then a pure ride, a march, step-then-ride, ride-then-step; first found within a shape, in scenario order. Routes with no capacity left given the faction's other planned moves are skipped, so the next shape is offered.
16. **MV-16. Computer player**: plans per unit on routed destinations; trucks are never planned on their own; post-pass as above. Capacity overflow drops the extra armies' orders (they hold).

## Stubbed

- Weather's −1 in Mud or Snow: not implemented here, to avoid counting it twice; `m3r1-weather-timer` answers `allowanceDelta`.
- Sea closure: `seaClosed` hook added; nothing answers it yet.
- Withdraw legs (P6): see "Needs from".

## Needs from

- **m3r1-weather-timer**: an `allowanceDelta` hook returning `-amount` of the `movement-penalty` effect of the army's zone outcome; a `seaClosed` hook (T4, winter Rain on a coastal zone touching the connection); `systems.weather` filled at step 0 so frostbite applies.
- **m3r1-sub-territories**: the P6 path function and Withdraw validation at reveal; control derived from holders (MV-1).
- **m3r1-recruit-replenish**: Spain starts with no trucks or cavalry; truck behaviour is only tested on the fixture until units can be recruited.
- **m3r1-d20-combat**: the amphibious modifier arrives through `combatModifiers` with kind `amphibious`.
- **contract (make-it-right)**: `CombatHookContext` could carry the turn's orders or scratch, so the amphibious rule does not need MV-11's inference.

## Files outside my ownership

- `src/main/engine/hooks.ts`: `SeaContext`, `seaClosed`, `hookedSeaClosed` (additive).
- `src/main/engine/validation.ts`: dispatch to `validateRoute` under `allowance`.
- `src/main/engine/types/outcomes.ts`: `MovementTurnOutcome` joined into `SystemOutcome`.
- `src/main/presentation/systemText.ts`: one import, one spread.
- `src/scenarios/spanish-civil-war-1936/scenario.json`: `rules.movement` to `allowance`.
- Tests: `pipeline.test.ts` (movement no longer a skeleton), `spainData.test.ts` (rules), `computerPlayer.test.ts` (a reinforcement may now ride through).

## Checks

- typecheck, lint: pass.
- test:unit: all pass except the six known sim-harness failures (D14).
- `npm run sim -- --games 50 --variant single-step.json --blunders without` (seeds 1-50, 66 turns):
  - allowance: decided 66% [52, 78], freezes 34% [22, 48], stalled 42%, median length 13; wins of decided Republic 85% [69, 93], North 6%, South 9%; battles per turn 0.67.
  - single-step on the same seeds: decided 54%, freezes 46%, stalled 58%; wins Republic 41%, North 44%, South 15%; battles per turn 0.48.
  - Rail cuts freezes by 12 points [-8, +32] and favours the Republic heavily (-34 points [-54, -14] without it): its interior lines and level-3 hubs (Madrid, Valencia, Barcelona) let it shift armies fast. For the harness and the owner, not tuned here.
