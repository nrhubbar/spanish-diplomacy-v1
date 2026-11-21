# m3r2-ai: progress

> Internal. Phase 2 of Milestone 3 Revision 2 (tasks §3.3 `ai`): R12, and the AI's use of R1, R5, R7, R9, R10 and R11; S3 (declog PC6).

## Done

- **Moves (R5, AI1).** The move planner keeps reading `moveRoutes`, the routes `reachFor` reports, so March, Motor, Rail and Sea come as the rules offer them, with passes and pockets. Fixed in `ai/reach.ts` and `orders/move.ts`:
  - the route memo keys on the foot flag;
  - a foot unit keeps the March its trucks would bar;
  - trucks go only with an army whose route they may take;
  - planned armies are checked with their own units, so the foot rule and the pocket hold.
- **Trucks (AI2).** Recruited only where a Motor road leaves the site (`motorPays`).
- **Pockets (R1).** Withdraw leaves through the army's own pocket (from `pockets-control`). Joint attacks from several origins come from `bestAttackOn`; its existing test still covers them, and the pass penalty is in the estimate (NE4).
- **Building.**
  - The Factory (R9) is built as an unlocking building, with its Manpower in the price.
  - Link works are in `orders/linkWorks.ts` (AI5). The planner queues one only when it opens rail rides or Motor routes for armies that stand where the route starts. It keeps one at a time.
- **Air (AI4).**
  - Ground Support goes over defended attacks only, from fighters and bombers alike, up to `air.supportMax` aircraft, and only when `plannedAir` gives at least an even air battle.
  - Patrol goes over the own ground most threatened by raids or by enemies next door; otherwise the fighter patrols its base.
- **S3 (AI3).** A hopeless last stand keeps a rearguard, and a lone defender stays. The D24 test is updated.
- **Guard (AI6).** `src/test/aiGuard.test.ts` covers every order kind, air mission, move mode, build project kind, improvement and link work. Behaviour cases are in `src/test/aiActions.test.ts`.

## Checks

- `npm run lint` and `npm run typecheck` pass.
- `npm run test:unit` passes: 1442 tests, coverage gate included. The smoke test is green.
- Per-file branch coverage:

  | File | Branches | Baseline |
  |---|---|---|
  | `reach.ts` | 93.8 | 85.7 |
  | `air-mission.ts` | 94.4 | 90.3 |
  | `linkWorks.ts` | 100 | new |
  | `build.ts` | 93.1 | 93.0 |
  | `recruit.ts` | 95 | 94.9 |
  | `withdraw.ts` | 94.1 | 94.5 |
  | `move.ts` | 91.7 | 89.8 |

  `move.ts` is still below the gate: its uncovered branches are older `??` fallbacks. Lines and functions are at 100 everywhere.

## Review

`diff-reviewer` ran once. Fixed: `linkWorkGain` builds the held set once, not per destination. Comments now say why the route memo needs no pocket key (C1: no move leaves contested ground, and uncontested ground is one pocket), why `motorPays` may read the whole territory (recruit sites are uncontested), and why a last stand with no unit that can fight is left whole. Not changed: the review asked to filter Ground Support's defenders by hostility, but the engine has no alliances in battle (every other faction fights), and `hostileIn` doesn't filter either.

## Notes for the coordinator

- **Smoke run time.** The smoke run now takes about 42 s, against 21 s before; the game paths changed.
  - Most of the AI's time is in `estimateAttack`. Its pass check calls `marchCrossing`, and that calls `linksOf` and `linkBetween`, which rebuild arrays on every call (engine, `network-engine`).
  - Remembering `linksOf` per scenario would cut a large share of planning time.
- **S3** couldn't be reproduced on this base: the seed-2 game doesn't reach that position any more. The fix is pinned by a constructed test.

## Left

- `move.ts` branch coverage (91.7) is below 93; it was 89.8 before this stream.
- The design notes (`supportWorth`, link-work `routeScore` and `countedRoutes`) are for the harness to tune when the owner asks.
