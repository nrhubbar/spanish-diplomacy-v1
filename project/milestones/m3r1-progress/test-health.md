# m3r1-test-health (make it right)

Branch `m3r1-test-health`, cut from `milestone-3-rev-1` at `328c0b9`. Goal: a test signal the reviewers and fixers can trust. No game rule or balance changed.

## What changed

- TH-1. **Harness blunder tests** (declog D21, six reds). `blunderControl(pointer)` and `blunderPatch(blunders, pointer)` take the seam explicitly. Callers pass `blunderChancePointer`, so the `pending` case stays reachable with `undefined`. The tests now cover:
  - `pending`: no patch, `without` by default, and the console note;
  - `scenario`: `both` by default, with no console note;
  - a stated chance (a tiny-front variant at 1 changes the turn-1 orders with blunders on);
  - a chance of 0 (tiny-front's own, so both settings play alike);
  - an absent chance (it loads without blunders and is refused with them, because the loader requires it).

  The "collects factions" variant now adds the new faction's AI profile (L23).
- TH-2. **Smoke line count.** The smoke run plays `without` blunders only, so it stays at 10 games.
- TH-3. **Timeouts, shortened rather than raised:**
  - Smoke determinism replays a short plan (seeds 1-3, 8 turns, with blunders, so the blunder stream is replayed too) instead of the whole 10-game run.
  - `state.test` R3 replays 2 seeds for 4 turns instead of 3 seeds for 6. A Spain turn's cost grows with the turn number.
  - Full suite: 49 s.
- TH-4. **S3 metric.** Only units that hold ground count. Aircraft do not (D17). A Withdraw order (C1) counts as leaving under fire, like a battle retreat. Documented in `project/specs/sim-harness.md`. Over 100 seeds, abandonments drop to 0 in both cells; win shares are unchanged from D21.
- TH-5. **App test** "plays an all-computer game straight to the turn report":
  - It waits for the Turn report pane before clicking Start Next Turn.
  - The game seed is pinned.
- TH-6. **Hot-seat "Turn resolution"**: the awaited `findByRole` stays, with a comment explaining why.

## S1 diagnosis (not fixed; it is not an invalid order)

All 22 early wins over 100 seeds (10 with blunders, 12 without) are Republic territory wins on turn 2 or 3. Victory needs 10 of 18 territories held whole (P7).

**1. Rules and data put the Republic at 8 or 9 territories by turn 2.**
- It starts with 6 territories whole and holds part of all 6 contested ones.
- The P3 one-a-turn sweep gives it, with no fight:
  - Extremadura on turn 1 in 100 of 100 games: Cáceres is the North's, but the North has no army in Extremadura;
  - País Vasco in 52 to 54 games: Álava, with no North army;
  - Baleares by turn 2: Ibiza and then Mallorca, with no South garrison.
- Republic territories held whole, without blunders:

  | After | 7 | 8 | 9 | 10 |
  |---|---|---|---|---|
  | Turn 1 | 48 | 52 | | |
  | Turn 2 | 3 | 52 | 43 | 2 |

**2. The computer player gives up the deciding territory.** It is the North each time:
- La Rioja, entered empty: 8 of 12 wins without blunders, 7 of 10 with;
- Galicia, emptied that turn: 3 and 3;
- Castilla y León: 3 without blunders (battles in seeds 5 and 48, a sweep in 33) and 3 with (sweeps in 33 and 68, a walk-in in 22).

This happens when the Republic is one territory short, which `ai/orders/move.ts` with `ai/plan.ts` and `ai/assessment.ts` allows:
- `plan.exposure` refuses only to empty an objective. Neither La Rioja nor Galicia is a North objective.
- `assess` applies the victory alarm as one multiplier (here ×2.5) to every stake. Attacking the leader's objective (Madrid, País Vasco) therefore still outranks keeping the territory whose loss ends the game.
- `assess.pressureOn` counts only armies in adjacent territories, so it misses rail and truck reach. This matters only for the seed 5 and 48 battles, where 2 of the 7 or 8 attackers on Castilla y León came by rail from Catalunya and Murcia. The La Rioja walk-ins came from adjacent Cantabria.

**Verdict:** both causes are needed. The start holders and the P3 sweep (rules and data) bring the Republic to 8 or 9 territories. The North's move planner (`exposure`, plus the uniform victory alarm) then gives up the 10th.

Also on turn 1, the Republic's `planWithdrawals` ("hopeless" ratio 2) leaves contested Asturias and Andalucía in 99 to 100 percent of games.

## S3 diagnosis

| Seed (without blunders) | What happened | Verdict |
|---|---|---|
| 25 (turn 15), 58 (turn 8) | The Republic's only unit in an objective was the Catalan recon flight. It rebased to Baleares when Catalunya fell (D17). | Metric artefact |
| 100 (turn 28) | The South's 7 units in contested Andalucía withdrew to Ceuta under the hopeless rule. Andalucía stayed contested. | Withdrawal under fire |

**For the integrator: the Withdraw exemption is a judgment call.** Seed 100 is a real planner choice: `planWithdrawals` pulled every unit out of the South's seat objective. With the exemption, S3 can no longer catch a withdraw-planner bug that walks off objectives. Reverting it is one line in `retreatedUnits` (`src/sim/game.ts`). The aircraft exclusion is not in question.

## Checks

- Typecheck and lint pass on every commit.
- **`npm run test:unit` exits 1, for two independent reasons:**
  1. S1, which is real and deliberately left red (852 passed, 1 failed);
  2. branch coverage of 83.63 percent, against the config threshold of 93 and the 90 percent bar.

  Fixing S1 alone will not turn the suite green.
- Coverage (v8, `--coverage.reportOnFailure`):

  | Measure | Coverage |
  |---|---|
  | Statements | 93.56% |
  | Branches | 83.63% |
  | Functions | 94.00% |
  | Lines | 95.48% |

- `npm run sim -- --games 100 --run m3r1-test-health-100`: S1 is 10 with blunders and 12 without; S3 is 0 in both cells. Win shares match D21.

### Worst-covered new files

Files added since `d7f3006`, ranked by uncovered branches (branches is the failing measure):

| # | File | Branches | Uncovered branches | Lines |
|---|---|---|---|---|
| 1 | `screens/pane/AirPane.tsx` | 2% | 86 | 16% |
| 2 | `state/planning/air.ts` | 5% | 63 | 7% |
| 3 | `map/layers/AirLayer.tsx` | 5% | 60 | 22% |
| 4 | `presentation/grades.ts` | 8% | 54 | 16% |
| 5 | `presentation/movement.ts` | 63% | 47 | 94% |
| 6 | `presentation/systemText/air.ts` | 0% | 29 | 16% |
| 7 | `engine/recruitment/rules.ts` | 80% | 23 | 100% |
| 8 | `presentation/systemText/generals.ts` | 0% | 21 | 21% |
| 9 | `screens/pane/RecruitTab.tsx` | 72% | 18 | 97% |
| 10 | `map/layers/RailLayer.tsx` | 83% | 17 | 100% |
| 11 | `ai/orders/air-mission.ts` | 81% | 17 | 92% |
| 12 | `engine/recruitment/phases.ts` | 76% | 16 | 96% |
| 13 | `engine/movement/routes.ts` | 90% | 16 | 98% |
| 14 | `engine/generals/changes.ts` | 88% | 16 | 100% |
| 15 | `presentation/economy.ts` | 78% | 15 | 95% |

All paths are under `src/main/`. Also at 0 percent: `screens/report/BattleGradedRoll.tsx` (12 branches) and `presentation/systemText/morale.ts`.

### e2e

Run once on all five projects with `E2E_PORT=5321 npx playwright test --grep-invert @capture --update-snapshots=none`, then the failures rerun with `--last-failed`. No baselines were written.

| Project | Passed | Skipped | Failed |
|---|---|---|---|
| chromium | 22 | 2 | 4 |
| firefox | 17 | 11 | 0 |
| webkit | 17 | 11 | 0 |
| mobile-chromium | 16 | 3 | 9 |
| mobile-webkit | 13 | 12 | 3 |

Desktop Firefox and WebKit skip 11 tests each: the visual, performance, Chromium-only input and WebGL tests. Their 0 failures cover the acceptance, keyboard-pan and report-focus specs only.

**Expected baseline diffs (8):** `visual.spec.ts` setup, planning, resolution and fallback, on chromium (1 to 6 percent of pixels) and mobile-chromium (7 to 22 percent).
- Milestone 3 adds header chips and rows, and rail, air and general counters.
- I inspected the mobile actual images. The mobile map's counters now overlap one another, which is the same defect as the target-size failures below.

**Real functional failures (both runs):**
1. Axe `target-size` (WCAG 2.2, serious) on map unit counters, from `expectAccessible` (`acceptance.spec.ts:58`):
   - mobile-chromium: `acceptance.spec.ts:61` (mixed turn), `:120` (A1, A2) and `:141` (B1, B4); `reportFocus.spec.ts:51` on the rerun;
   - mobile-webkit: `:61` and `:120`;
   - the counters named are `rep-castilla-3`, `rep-santander-column` and `rep-wad-ras-1`.
2. mobile-webkit, `acceptance.spec.ts:180` (colocated armies), times out. At line 188, clicking the Covadonga entry in "Your armies" is blocked because `div.order-command` intercepts pointer events.
3. mobile-chromium, `performance.spec.ts:12` (P3): the selection median is 169 ms and 148 ms, against a 120 ms budget (4× CPU throttle).
4. mobile-chromium, `reportFocus.spec.ts:51`, also failed at line 63 on the first run: `expect(target.collapsed).toBe(true)`. e2e games draw a random seed at Start Campaign, so this failure moves between runs because it depends on the seed (the turn's battles), not on timing.

**Flakes:** none.
