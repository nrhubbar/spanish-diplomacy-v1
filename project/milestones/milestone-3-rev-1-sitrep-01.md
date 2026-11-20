# Milestone 3 Revision 1: Situation Report 01

> Internal. Nothing here may be imported into or rendered by the player-facing application.

**Date:** 20 November 2026. **Branch:** `milestone-3-rev-1`. **Status:** closed out. Functionally complete; the release checks deferred by the owner are listed below (declog D33).

## Progress

All of Milestone 3 is built, reviewed, fixed and merged on the integration branch:
- sub-territories and contested ground;
- d20 combat with fatigue and morale;
- economy and build queues;
- recruiting and Replenish;
- movement with trucks, rail, ports and amphibious landings;
- air missions and generals;
- calendar, weather and the turn timer;
- the simulation harness.

The work took about 9 hours of wall-clock time on 19 November, plus the close-out on 20 November. There are 18 work streams and the coverage stream, and 230-plus commits. They change about 400 files in `src`, `scripts` and `e2e` (+49k / −8k lines, about 11k of them tests).

| Phase | Delivered | Status |
|---|---|---|
| Phase 0: foundations | Spec v2 contract (types, schema, loader, phase pipeline, cross-area hooks, hidden-information views, UI slots, splits, budgets, blunders); real 1936 province geometry (55 sub-territories with topology); the `npm run sim` harness | Merged |
| Make it work | 7 feature slices | Merged |
| Make it right: health and shared changes | Test health; contract follow-ups; AI fixes (garrisons, victory defence, withdraw odds) | Merged |
| Make it right: review | 5 reviewers found 16 blockers, 41 majors and about 70 minors | Done |
| Make it right: fixes | 5 fixers closed every blocker and nearly every major | Merged |
| Close-out | Coverage gate met, by pulling logic out of components into pure functions; declog summary and rubric | Done |

**Checks at close:**
- lint, typecheck and build pass;
- `npm run test:unit` exits 0, with 1247 tests;
- coverage: statements 98.21%, branches 93.39%, functions 98.50%, lines 99.28%;
- initial chunk: 149.06 kB gzip against the 155 kB budget;
- rubric: 4.73.

**Balance**, 1000 games each, 66-turn limit (`build/sim/m3r1-final-1000`); win shares are of decided games:

| Blunders | Decided | Freezes | Republic | North | South | Early wins (S1) | Abandonments (S3) | Median turns |
|---|---|---|---|---|---|---|---|---|
| With (shipped) | 100% | 0% | 9.6% [7.9, 11.6] | 64.8% | 25.6% | 0.3% | 2 | 12 |
| Without | 100% | 0% | 10.3% [8.6, 12.3] | 64.5% | 25.2% | 0.1% | 1 | 12 |

Freezes are solved: Revision 7 stalled 58 percent of games. The Republic's share fell as correctness fixes removed advantages it should not have had: free territory from missing garrisons, and computer-player bugs. Nothing has been tuned (H7).

## Where the tokens went

The figures are per-agent counts the harness reported at each agent's last stop. They leave out the coordinator session and the earlier ideation, mechanics and UX steps, and the harness does not say how it counts cache reads, so treat them as relative sizes.

| Phase | Tokens | Share |
|---|---|---|
| Feature slices (7) | 3.04M | 31.9% |
| Fixers (5) | 1.83M | 19.2% |
| Reviews (5) | 1.44M | 15.1% |
| Foundations (3) | 1.42M | 14.9% |
| Health and shared changes (3) | 0.91M | 9.5% |
| Supervisor and phase-0 reviewers | 0.41M | 4.4% |
| Coverage close-out | 0.22M | 2.4% |
| Coverage, first attempt (stopped) | not reported | |
| **Total** | **about 9.27M** | |

The largest agents:

| Agent | Tokens |
|---|---|
| `m3r1-contract` | 741k |
| `m3r1-air-generals` | 580k |
| `m3r1-sub-territories` | 526k |
| `m3r1-movement-rail-ports` | 471k |
| `m3r1-fix-ui` | 457k |
| `m3r1-map-provinces` | 445k |
| `m3r1-economy-builds` | 407k |
| `m3r1-d20-combat` | 403k |
| `m3r1-fix-economy-recruit` | 394k |
| `m3r1-fix-combat-air` | 371k |

**What drove the spend:**
- **Making it right cost more than building it.** Reviews and fixes used 3.26M, against 3.04M for the feature slices. Most of the 16 blockers came from slices built in parallel against each other:
  - two Withdraw implementations;
  - two "contested" tests;
  - rail damage applied twice;
  - aircraft counted as ground armies.
- **The contract was under-specified at first.** It needed two supervisor redirects, and every slice waited on it. A more complete contract in the tasks doc would have saved this.
- **Reconciliation rounds.** The slices that finished last, and the fixers, each spent another 30k to 60k tokens merging in each other's work and removing duplicates.
- **Each reviewer re-read the codebase,** at about 290k tokens each.
- **Concurrency.** Running five to seven agents at once hit the 5-hour usage limit twice. Nothing was lost.

## What is left

**Deferred by the owner (D33):**
- regenerate and review the visual baselines;
- the quiet-machine timing tests;
- `npm run verify` with `CI=1`;
- the production smoke test;
- leftover review minors, which go to Revision 2 planning.

**Make it fast:**
- the computer player's planning time in long games (about 170 ms a turn by turn 20);
- first paint waits for the scenario (D16);
- selection on mobile Chromium is 148 to 169 ms, against a 120 ms budget.

**Revision 2 housekeeping:**
- split modules over 200 lines (rubric R8);
- remove six unused helpers;
- fix two odd strings (D34).

**Owner:** play-through, then the squash onto `main` and removal of the 22 worktrees.

## Decisions waiting on the owner

**1. Balance and pace**
1. **The Republic's share is about 10 percent, against the 20 percent target.** Accept it, or choose a lever:
   - starting stocks (40/10, 15/10, 15/5);
   - development yields;
   - victory thresholds;
   - AI profiles;
   - garrison strengths.
2. **Game length.** The median game is 12 turns, ending about January 1937. Is that acceptable?
3. **Manpower piles up.** The AI spends almost all its Funds but only 40 to 60 percent of its Manpower. This is about the unit mix, or the data.
4. **S3 abandonments.** There are 1 or 2 in 1000 games, against a target of 0.

**2. Integrator defaults to confirm or override:**
- D5: the best general per side counts.
- D6: Fatigued applies when fatigued units carry half the side's attack.
- D17: aircraft are never ground combatants.
- D27.1: non-fighters can't take ground or attack alone.
- D27.2 to D27.3: aircraft rebase whenever they lose their base, and fighters intercept any mission.
- D27.4: a rally never cancels a demoralization from the same turn.
- D27.5 to D27.7: meetings take the weather modifier; trucks and anti-air are demoralized last; where replacement generals appear.
- D28.1: the Hospital raises the replenishment cap to three quarters; the Depot makes Replenish 25 percent cheaper.
- D28.2: when a capital falls, training not yet started is refunded.
- D28.3 to D28.4: Replenish carries fractions; Barracks and Factory are capital-only.

**3. Smaller rule questions:**
- Should only Rain close the sea in winter?
- Rail is damaged only on the first contested turn. Is that right?
- Should recon's reveal also cover the next turn's report?
- A lone replacement general in a contested seat rolls for death every turn. Is that acceptable?
- Spain's sea game changed: there is no Málaga–Ceuta crossing, the Baleares can be reached only via Mallorca, and Menorca can be trapped. Is that acceptable?

**4. Process.** For Revision 2, is a fuller contract before any slice starts worth the planning time? Here the contract and the reconciliation rounds were the largest avoidable cost.
