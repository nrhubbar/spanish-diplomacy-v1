# m3r2-pockets-control: progress

> Internal. Phase 1 of Milestone 3 Revision 2 (tasks §3.3 `pockets-control`).

## Done

- **R1 pockets** (`engine/partition/pockets.ts`):
  - `pocketsIn` and `pocketsOf` return the connected groups of a side's ground in a contested territory. Uncontested ground is one pocket, islands included. Results are cached per holdings object.
  - `pocketOfArmy` and `pocketOfUnit` find an army's pocket. They read its place through a chain: the stored place, then its city's sub-territory, then the side's first pocket.
  - `arrivalSite` and `arrivalPocket` give the side's ground nearest the border an army crosses.
- **An army's place** is stored on the unit as `UnitState.subTerritoryId`, set at step 8 (`settlePockets` in `partition/steps.ts`) only where it is needed (declog D12).
- **Ways out** (`partition/paths.ts`): `exitGround`, and `pathThrough`, `hasPath` and `withdrawRoutes` take `unitIds`, so armies leave only through their own pocket. The Rev 1 P6 path through other pockets is gone.
  - Withdraw validation and the retreat hook (`RetreatContext.unitId`, `retreatDestination(..., unitId)`) pass the army.
  - Path-surrender reports pass it too.
  - The Withdraw menu and the AI ask per army.
- **Stranding:** an army whose own pocket falls is stranded and retreats out of it, even when its side holds another pocket (D16).
- **Málaga:** its regiment leaves only by the Alboran coast lane to Murcia, and not when the storms close it. Note 1 is adapted to R3 (D13).
- **R2** (`flipWhole` at step 8, replacing the sweep):
  - A territory where only one side has ground armies flips whole to that side and emits `territory-flipped`.
  - Aircraft never count (`groundSides` and `loneSide` in `control.ts`), in step-6 occupation too.
  - D27.1 still applies: the lone side needs a unit that can fight.
  - `deriveControl` follows the same rule for the `none` module (D15).
- **`pocket-cut`:** emitted at step 8, one event per pocket, for armies whose pocket split or lost ground.
- **D5 flip order fixed:** flip order is measured per attack origin, over land where the origin shares a land connection with the target (`attackDistances`, `frontGraph`; D14).
- **Tests:**
  - `src/test/pockets.test.ts` holds the acceptance tests for notes 1 and 14, the Málaga test, and the pocket, R2 and AI cases.
  - Tests that pinned the sweep, P6 or the old route lists are updated: `partition`, `partitionRules`, `combatAirFixes`, `contestedPlanning`, `movementPresentation`, `ui/armyPicker` and `ui/ordersAndBattles`.

## Checks

- `npm run lint` and `npm run typecheck` pass.
- `npm run test:unit`: 1322 of 1323 tests pass. The one failure is the smoke test's S3 (open, D17).
- Per-file branch coverage:

  | File | Branches | Baseline |
  |---|---|---|
  | `pockets.ts` | 100 | new |
  | `steps.ts` | 95.3 | |
  | `paths.ts` | 94.3 | was 92.1 |
  | `withdraw.ts` | about 94.5 | |
  | `flips.ts` | 91.1 | was 85.3 |
  | `partition/orders.ts` | 90.2 | was 89.7 |

  `control.ts`, `retreat.ts`, `planning/contested.ts` and `engine/hooks.ts` are unchanged or full.

## Left

- **S3 in the smoke test** (D17): under R2, D24's hopeless-last-stand Withdraw hands the seat over whole. This is AI policy, for the supervisor and `ai`.
- **`ai`:** the AI can read pockets (`pocketOfArmy`, `withdrawRoutes(..., unitIds)`). It doesn't yet plan with them for pocket exits or joint attacks.
- **`map-orders`:** use `pocketsOf` and `pocketOfArmy` for "already here" units in the Invade and Reinforce panes.
