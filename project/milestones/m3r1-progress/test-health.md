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
- Castilla y León, by battle or sweep: 3 and 2.

This happens when the Republic is one territory short, which `ai/orders/move.ts` with `ai/plan.ts` and `ai/assessment.ts` allows:
- `plan.exposure` refuses only to empty an objective. Neither La Rioja nor Galicia is a North objective.
- `assess` applies the victory alarm as one multiplier (here ×2.5) to every stake. Attacking the leader's objective (Madrid, País Vasco) therefore still outranks keeping the territory whose loss ends the game.
- `assess.pressureOn` counts only armies in adjacent territories. It misses rail and truck reach: in seeds 5 and 48, 2 of the 7 or 8 attackers on Castilla y León came by rail from Catalunya and Murcia.

Also on turn 1, the Republic's `planWithdrawals` ("hopeless" ratio 2) leaves contested Asturias and Andalucía in 99 to 100 percent of games.

## S3 diagnosis

| Seed (without blunders) | What happened | Verdict |
|---|---|---|
| 25 (turn 15), 58 (turn 8) | The Republic's only unit in an objective was the Catalan recon flight. It rebased to Baleares when Catalunya fell (D17). | Metric artefact |
| 100 (turn 28) | The South's 7 units in contested Andalucía withdrew to Ceuta under the hopeless rule. Andalucía stayed contested. | Withdrawal under fire |

## Checks

- Typecheck and lint pass on every commit.
- Unit tests: 852 passed and 1 failed. The failure is S1, which is real and left in place.
- Coverage (v8, `--coverage.reportOnFailure`):

  | Measure | Coverage |
  |---|---|
  | Statements | 93.56% |
  | Branches | 83.63% |
  | Functions | 94.00% |
  | Lines | 95.48% |

  Branches is below the 90 percent bar and the 93 percent threshold.
- `npm run sim -- --games 100 --run m3r1-test-health-100`: S1 is 10 with blunders and 12 without; S3 is 0 in both cells.
- e2e: all five projects, `--grep-invert @capture`, no baselines written (see the hand-off report).
