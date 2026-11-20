# Milestone 3 Revision 1 Decision Log

> Internal. Nothing here may be imported into or rendered by the player-facing application.

This log records the decisions and assumptions made while carrying out `milestone-3-rev-1-tasks.md`. Each one is numbered for reference.
- The product decisions (section 1 of the tasks document) come from the owner's answers.
- This log says how they were carried out, and records integrator defaults where the answers left a gap.
- Workers return their decisions in their checkpoint and hand-off reports; the integrator copies them here under the stream's heading.

## Process

**D1. Branches, worktrees and ports.** Integration happens on `milestone-3-rev-1`, in `../spanish-diplomacy-v1-m3r1`, on port 5300. Each stream is cut from the integration branch when it starts, on branch `m3r1-<slug>`, in the worktree `../spanish-diplomacy-v1-m3r1-<slug>`, with the port in tasks section 3.2. Agents are named in lower-kebab-case after their stream (`m3r1-contract`), and so are their reviewers (`m3r1-contract-review`) and the supervisor (`m3r1-supervisor`). The worktrees are created by the integrator with `git worktree add`, not by the agent tool's isolation option, so branch names follow this convention and cleanup follows the workspace README.

**D2. Baseline.** `milestone-3-rev-1` was cut from `m3-ideation` at `8cf06ea`, which is `main` (`d7f3006`) plus the Milestone 3 ideation documents, the three answer files, the UX mockups and `project/testing-screenshots.md`. `git diff main m3-ideation -- src e2e assets scripts package.json` was empty. `milestone3.md` is marked superseded by the tasks document.

**D3. `m2-strength` stays as a preset (E2).** The owner kept `m2-strength` as a preset (Q-MIS-d-1). The tiny-front fixture uses it, with the d6 table and none of the new systems, so the Milestone 2 engine tests keep testing real behaviour through the new phase pipeline. Spain uses `m3-modular`.

**D4. Supervisor and checkpoints.** The owner asked for a coordinator, a supervisor and N workers, with token checkpoints. It runs like this:
- Each worker stops at the end of each checkpoint in its stream and returns a short report.
- `m3r1-supervisor` reviews the report and the diff since the last checkpoint, then answers continue, redirect or stop.
- The integrator resumes the worker with that answer.
- Before hand-off, a read-only `m3r1-<slug>-review` agent checks correctness against the decisions the stream owns.

**D5. Several generals on one side (U6).** The owner's answers make a general a unit in his own right, whose effect applies to the army he is in. They do not say what happens with two generals in one army, or on one side of a battle. Default: only the best single general's +1 counts, per army for the rally and per side for the roll. Traits apply only for the general whose +1 counts. This is reported to the owner as an open question.

**D6. Fatigue on a mixed side (C6).** Fatigue belongs to units, but a battle rolls one die per side. Default: the side takes "Fatigued −2" when fatigued units (level 2) carry at least half of its attack value. This mirrors the half-of-value rule for demoralization.

**D7. Smaller defaults, to be tuned by the harness.** All of these are values in scenario data:
- Recruiting: at most 2 Recruit orders per territory per turn, plus 1 with a Factory.
- Rail: range in territories is twice the lowest rail level on the route.
- Ports: a port lands as many armies per turn as its level.
- Replenish: a Hospital gives +25 percent men per turn, and a Depot gives +25 percent cap.
- Frostbite: a unit that moves in Severe cold loses 5 percent of its men.
- Recon: reveals last one turn.
- Generals: a replacement general (after a death or a sacking) appears the next turn in the faction's seat territory, a new faction field in scenario data. A general rallies the demoralized units of the army he is in, or the units holding with him, at the end of the turn.
- Harness: the default turn limit is 66 turns, which is about April 1939.

## Streams

(Filled in as checkpoints and hand-offs arrive.)

**D8. Sub-territory ids, agreed before phase 0 starts.** These ids are shared by `m3r1-contract` (scenario data) and `m3r1-map-provinces` (geometry):
- The ids in `milestone-3-ideation/ux-pass/provinces.json`, as lowercase kebab-case province names: a-coruna, lugo, ourense, pontevedra, asturias, cantabria, bizkaia, gipuzkoa, alava, navarra, la-rioja, zaragoza, huesca, teruel, madrid, burgos, valladolid, leon, palencia, zamora, salamanca, avila, segovia, soria, toledo, ciudad-real, cuenca, guadalajara, albacete, badajoz, caceres, barcelona, girona, lleida, tarragona, valencia, castellon, alicante, sevilla, cadiz, huelva, cordoba, granada, malaga, jaen, almeria, murcia, ceuta, melilla, mallorca, menorca and ibiza.
- Asturias splits into `oviedo` (the capital pocket around the city) and `asturias` (the rest).
- Madrid splits into three: `madrid` (the capital, with the city and the south), `guadarrama` (the Sierra to the north-west) and `henares` (the Henares valley to the east, Alcala).
- Baleares is `mallorca` (its capital), `menorca` and `ibiza`.
- `m3r1-map-provinces` draws the splits; `m3r1-contract` writes the data for those ids.

**D9. Which stall measure H7 uses.** The harness reports two:
- "freeze": no winner by the turn limit (66 turns);
- "stalled": 5 or more quiet turns in a row, Revision 7's S2.

H7's 15 percent target is measured as **freeze**, because the owner's goal is games that end. "Stalled" stays in every report so results compare with Revision 7, which measured 58 percent.

**D10. AI data pointers.** The blunder chance is `/ai/blunderChance` (H6's word), and the per-faction profiles are `/ai/profiles/<factionId>`, a record keyed by faction id (E7). Both the contract and the harness use these.

**D11. Province data licence.** The ADM2 province boundaries vendored from geoBoundaries (revision `9469f09`) come from Spain's statistics office (INE), under the INE Data License, not CC BY 4.0 as the tasks assumed. INE allows reuse, commercial or not, on these conditions:
- the source is cited and the date given;
- the meaning is not distorted;
- nothing implies INE endorses the reuse.

`assets/maps/ATTRIBUTION.md` quotes the terms. The Settings attribution carries the required citation and the 2018 date. The Madrid split lines were traced from geoBoundaries ADM3 municipal borders (IGN, CC BY 4.0), which the existing IGN credit covers. Reported to the owner.

**D12. Sub-territory splits as drawn (P9, D8):**
- **Oviedo** is the municipality, about 187 km², an island inside `asturias`. It is the pocket held from 19 July to October 1936.
- **Madrid** splits at Talamanca de Jarama:
  - `guadarrama` is the Sierra Norte, the Sierra de Guadarrama and El Escorial: 62 municipalities, about 2,070 km². This is wider than D8's "north-west": it takes the whole Sierra front, Somosierra included.
  - `henares` is the Henares valley and the Jarama-Henares plain around Alcala: 26 municipalities, about 870 km².
  - `madrid` is the city, the west and the south.
- **Baleares** splits by island. Formentera goes with `ibiza`; Cabrera and Dragonera go with `mallorca`.

The outer edges of all sub-territories are the region rings, vertex for vertex. The paths are in a lazily loaded `assets/maps/iberia-sub-territories.svg`, so the initial chunk does not grow.

**D13. Process change: make it work, then make it right (owner, 19 November 2026).** The owner asked to start every feature stream at once and to make it green later in the merge cycle, rather than early, because the checkpoint cycle was turning over too soon. From here on the work runs in three passes:
- **Make it work:** every feature stream runs at once from the interim integration base, each in its own worktree. Workers build each feature end to end without stopping at checkpoints. They commit often and keep their progress note current. They stop only when blocked, or when they would need another stream's files. Per-checkpoint supervisor reviews are paused.
- **Make it right:** the last phase of this revision. Stream reviewers, the supervisor, full green checks (lint, typecheck, coverage of at least 90 percent, e2e, axe), visual baselines and the declog. All the section 5 production-bar items still apply; they move to this phase.
- **Make it fast:** the chunk budget and frame costs, after that.

**D14. Interim integration base.** Before the feature streams were cut, the integrator merged into `milestone-3-rev-1`:
- `m3r1-contract` through `0b7f1d5`: CP1 to CP3, plus the first CP4 commit (lazy packages and the budgets file);
- `m3r1-map-provinces`;
- `m3r1-sim-harness`.

Merge fixes:
- The topology file moved into the new scenario folder.
- `scripts/map/iberia-1936.ts` points at it.
- The generated borders, connection entries and city placement were copied into `scenario.json`, and a test keeps them equal.
- The harness was updated for the order and battle unions, and its blunder pointer set to `/ai/blunderChance`.

Lint and typecheck pass. Six harness tests that assumed blunders were "pending" are known red, and are left for the make-it-right pass. The contract's remaining CP4 work (cross-area hooks, open turn draft, per-viewer outcomes, UI slots, splits, blunder logic) merges into `milestone-3-rev-1` when it finishes. The feature streams then merge that branch in.

**D15. Contract fully merged.** `m3r1-contract` CP4 (`8b1b36b`) merged into `milestone-3-rev-1` with no conflicts. It brings:
- the cross-area hooks (`engine/hooks.ts`);
- per-area turn scratch;
- `viewFor`, `outcomesFor` and `ordersFor`, with `visibleSession` used by every screen;
- the UI slots;
- the hotspot splits (H9);
- `project/budgets.json` with `npm run budgets:check`;
- the blunder logic (H6).

Lint and typecheck pass. The same six harness tests as in D14 are red, as known. The feature streams were told to merge `milestone-3-rev-1`.

**D16. First paint still waits for the lazy scenario chunk (contract CT-50).** The initial chunk is 102.99 kB against the 155 kB budget, so the budget is met. `main.tsx` still awaits the registry before the first render. Moving that wait to the setup screen means reworking the app shell, which is deferred to the make-it-fast phase (D13).

**D17. Aircraft are not ground combatants (integrator default).** The answers make aircraft units (U2, Q-UX-10) but say nothing about ground battles. Default:
- aircraft never join a ground battle on either side, take no losses from it, and do not retreat with ground units;
- if an enemy takes the whole territory that holds their airfield, they rebase to the nearest friendly airfield within range, or are destroyed.

Reported to the owner.

**D18. Interim merges of the first finished slices.** `m3r1-d20-combat` (`c61e09e`), `m3r1-recruit-replenish` (`84afb1d`) and `m3r1-weather-timer` (`dad7589`, including WT-17) were merged into `milestone-3-rev-1` as each finished, so the four streams still running build on them. The conflicts were all additive (`presentation/text.ts`, `presentation/odds.ts` comments, `style.scss` uses, `e2e/capture.spec.ts`, `scenario-package.md`), and both sides were kept. Typecheck and lint pass. Seven unit tests are red:
- the six known harness tests (D14);
- the smoke test's S1 check: early wins in 1 of 10 games, against a limit of 5 percent.

For make-it-right:
- **Capture name collisions:** three streams use the prefix `20a`-`20f` in `e2e/capture.spec.ts`; renumber them.
- **S1 early wins under the d20:** in d20-combat's 50-game run, 8 of 50 games ended before turn 4. The computer players leave the contested territories on turn 1, so control settles a territory short of the Republic's threshold. This should change once control comes from sub-territory holders, which `m3r1-sub-territories` is building. Re-measure after that merge.
- **Republic dominance:** in both the d20 and the recruit runs, the Republic wins 70 to 80 percent of decided games. It starts with 40 Funds against 15, and nobody has income yet. Re-measure once economy merges. Reported, not tuned (H7).

**D19. Economy merged; balance finding.** `m3r1-economy-builds` (`ac2b0ee`) merged into `milestone-3-rev-1` with no conflicts; typecheck and lint pass. With the economy on, no game freezes in 50 runs, but the Republic wins 96 to 98 percent of decided games (67 percent with the economy off). This is because Andalucía is contested from turn 1 and pays nobody, so the Southern command earns about 1 Fund a turn. Turn-1 income:

| Faction | Funds | Manpower |
|---|---|---|
| Republic | 14 | 27 |
| North | 5 | 27 |
| Southern command | 1 | 0 |

The owner's answer to Q-MR-10 was to leave the South poor and, if needed, raise Ceuta's and Melilla's Funds. Reported, not tuned (H7). The levers are Ceuta and Melilla's yields, starting stocks, the insurgents' development levels and sub-territory flips, so re-measure once `m3r1-sub-territories` merges. Requests for make-it-right:
- a per-resource display scale, to read "Manpower 18k" as in the approved capture (EB-12);
- an order-validation hook per module;
- a report-line API that takes the whole outcome;
- an AI profile field for the build budget.

**D20. Sub-territories merged, reconciled with economy.** `m3r1-sub-territories` (`744c51e`) merged into `milestone-3-rev-1` with no conflicts; typecheck and lint pass. Before the merge, the stream reconciled with economy:
- **Rail damage:** applied once, at economy's step 10. The two rules were the same.
- **Focus view:** economy's `BuildList` is mounted there.
- **Contested and held-whole:** one implementation, `engine/partition/holders.ts`. Economy's helpers delegate to it.
- **Captures:** renumbered `22a` to `22e`.

A new red for make-it-fast: the smoke determinism test times out (76 s against 15 s). Games now run longer, and the computer player's attack estimates (`bestAttackOn`, `estimateGradedBattle`) take about 170 ms of planning a turn by turn 20.

Merge order for the last two streams: air-generals, then movement-rail-ports. Each merges the integration branch first and keeps one Withdraw implementation and one contested test. Capture numbers: economy `21`, sub-territories `22`, movement `23`, air-generals `24`.

**D21. Make it work: complete.** All seven feature streams are merged into `milestone-3-rev-1` (`0704660`):
- `m3r1-air-generals` at `7a51b84`, reconciled with sub-territories;
- `m3r1-movement-rail-ports` at `0a5d84f`, now with one Withdraw implementation and contested origins refused through `orderVerdict`.

Typecheck, lint and build pass. The initial chunk is 142.44 kB gzip against the 155 kB budget. Nine unit tests are red, all known, for make-it-right:
- the six harness tests that assume blunders are pending (D14);
- the smoke test's line count;
- the smoke test's determinism, which times out;
- the smoke test's S1 check;
- `state.test` replay R3, which times out under the full suite.

**First full-game harness reading** (100 seeds, 66 turns, `build/sim/m3r1-all-merged-100`):

| | Decided | Freezes | Republic / North / South (of decided) | Early wins (S1) | Abandonments (S3) |
|---|---|---|---|---|---|
| With blunders | 100% | 0% | 33% / 47% / 20% | 10 | 0 |
| Without blunders | 99% | 1% | 48.5% / 39.4% / 12.1% | 12 | 3 |

With blunders, which is the shipped setting, H7 is met at 100 games: freezes at or under 15 percent, and every faction wins at least 20 percent of decided games. The 1000-game run comes at the end. Two invariants fail and are make-it-right items:
- S1: early wins are 10 to 12 percent against a 5 percent limit;
- S3: 3 abandonments without blunders, against a limit of 0.

**D22. Test health (`m3r1-test-health`, merged at `b71044c`).**
- The six blunder tests, the smoke line count and the two timeouts are fixed. The timeouts were fixed by shortening the test games, not by raising limits.
- The S3 metric no longer counts aircraft (D17).
- The all-computer app flake was test-side and is fixed.

What remains red:
- the S1 smoke check, deliberately;
- branch coverage at 83.6 percent (statements 93.6, functions 94.0, lines 95.5), against the 90 percent bar. The air UI is the least covered.

e2e on all five projects:
- Desktop Firefox and WebKit pass.
- Real failures:
  - axe `target-size` on map unit counters on phones;
  - a mobile-webkit click intercepted by `.order-command`;
  - mobile-chromium selection at 148 to 169 ms against a 120 ms budget (make-it-fast).
- The 8 visual diffs are expected and go to the baseline pass.

**D23. Cause of S1 (early wins).** All 22 early wins are the Republic reaching 10 of 18 whole territories on turn 2 or 3. Two causes, both needed:
1. **Data gap: territories that should be garrisoned are not.** The one-a-turn sweep (P3) gives the Republic territories with no fight:
   - Extremadura on turn 1 in every game: Cáceres is held by the North, with no North army there;
   - País Vasco (Álava) in about half the games;
   - Baleares by turn 2: no South army on Mallorca or Ibiza.

   Those sub-territories had Nationalist garrisons in July 1936 (Cáceres, Vitoria, Goded's Mallorca). The scenario holds them without units, so the sweep takes them unopposed. This is a scenario-data correctness gap, not a balance number. The fix is sourced garrison units, made in make-it-right.
2. **Computer-player bug:** the North gives up the deciding tenth territory, entering La Rioja empty or emptying Galicia or Castilla y León. The causes:
   - `ai/plan.ts` `exposure` refuses only to empty an objective;
   - the victory alarm in `ai/assessment.ts` is one ×2.5 multiplier on every stake, so attacking the leader still outranks holding the territory that would lose the game.

   Fixed in make-it-right as computer-player behaviour.

**D24. S3 keeps counting withdrawals (integrator decision).** The test-health stream exempted Withdraw from S3. That hides a real planner fault: in seed 100, the South withdrew all 7 units from Andalucía, its seat. S3 exists to catch the computer player walking off objectives, so the exemption is reverted. The withdraw planner is fixed so it never abandons a faction's seat or last objective while it can still hold.

**D25. Contract follow-ups merged (`3db2a38`).** The shared changes landed before the review:
- report lines take the whole typed outcome;
- a per-module `validateOrder` hook, after which `orderVerdict` only vetoes;
- `resources[].display`, so Manpower reads "10k";
- the AI build budget lives in `ai.profiles`;
- RR-12 is fixed: Replenish needs a unit below strength.

A 30-seed probe was byte-identical before and after every change. One gap is left for the UI review: the turn report shows only the moves, air and generals lines. The economy, recruitment, contested-ground, transit and fatigue lines exist but are shown nowhere (contract follow-ups decision 7).

**D26. Review shape.** The review runs on the integrated `milestone-3-rev-1`, not the old stream diffs. There are five read-only reviewers:
- `m3r1-review-map-movement`: sub-territories, movement, rail and ports;
- `m3r1-review-combat-air`: d20, fatigue and morale, air and generals;
- `m3r1-review-economy-recruit-time`: economy, recruitment, weather and timer;
- `m3r1-review-hidden-info`: hidden information in hot-seat play, across rules and UI;
- `m3r1-review-ui`: the UI against the approved `ux-*.webp` captures, icons (X8), axe, phone layouts and the report sections.

Fresh fixers then take their gap lists, at most four at once.

**D27. Integrator defaults for gaps the review found.** None of these is covered by the owner's answers. Each is reported to the owner and can be overridden.
1. **Only units that can fight take ground or attack.** A force with no attack value (generals, trucks, anti-air) cannot occupy or sweep a territory, and cannot attack on its own. This sits beside D17 for aircraft. It is the same rule as the artillery-alone rule (D5), applied to every unit with no attack.
2. **Aircraft rebase whenever they lose their base.** This covers the airfield being destroyed by a raid, its sub-territory flipping, and the territory being taken whole. If no friendly airfield is in range, they are destroyed.
3. **Enemy fighters can intercept any mission in range,** including support and recon flights, not only raids (U2: "losses from enemy fighters").
4. **A general's rally never cancels a demoralization from the same turn.** It recovers units that started the turn demoralized. A unit at the top of the fatigue track that attacks is demoralized again. This closes the fatigue-3 loop.
5. **Head-on meeting battles take the weather modifier** of the zone they are fought in, using the destination territory's zone.
6. **"Weakest first" demoralization counts combat units only.** Trucks and anti-air come last.
7. **A replacement general appears in the faction's seat** if the faction holds the seat's capital sub-territory, even while the seat is contested. Otherwise it appears in the faction's nearest held territory.

**D28. More integrator defaults from the review.** Each is reported to the owner and can be overridden.
1. **Hospital and Depot differ ($4, R5, RR-11).** The Hospital makes replenishment faster: the per-turn cap rises from half the unit's establishment to three quarters. The Depot makes it cheaper: Replenish costs 25 percent less Funds, because materiel is on hand. The Depot still gates trucks and tanks.
2. **Training when the capital falls (RR-8)** follows the build-queue rule ($5). A Recruit paid this turn whose training has not started is refunded. Training already under way is lost with its payment.
3. **Replenish pricing (R5)** carries the fractions of Manpower and Funds per faction, so a small top-up costs its true share rather than a whole point rounded up.
4. **Barracks and Factory** can only be built in a capital sub-territory, the only place they unlock anything.

**D29. Fix streams.** Fresh agents work from `milestone-3-rev-1` against the review files, which are kept in the integrator's scratchpad and summarised here:
- `m3r1-fix-map-movement`: the map and movement blockers and majors, D27.1 and its tests. The garrisons and withdraw planner stay with `m3r1-ai-fixes`.
- `m3r1-fix-combat-air`: the combat and air blockers and majors, D27.2 to D27.7, and the air rules tests.
- `m3r1-fix-economy-recruit`: D28, replenishing units that dig in, the computer player's development builds, and their tests.
- `m3r1-fix-hidden-info`: every leak. It also owns the timeout fix, which must submit the whole draft and count holds only from public orders.
- `m3r1-fix-ui`: the UI blockers and majors, the report groups (D25), army and unit wording, and tests for the air UI. It starts when a slot frees.

**D30. AI fixes merged (`m3r1-ai-fixes` at `66373d9`).**
- **Garrisons (D23, cause 1).** Four sourced garrisons were added:
  - Argel No. 27 at Cáceres (North);
  - Flandes No. 5 at Vitoria (North);
  - Palma No. 36 in the Baleares (South);
  - Baleares No. 37 at Mahón (Republic).

  The sweep fires only where one faction alone has armies, so a garrison turns a free take into a contest.
- **Victory defence (D23, cause 2).** Targeted critical ground:
  - a territory whose loss would win a rival the game is never emptied, is garrisoned if empty, and is weighted in `ai.profiles.victoryAlarm.critical`;
  - `pressureOn` counts rail, truck and sea reach.
- **Withdraw (D24).**
  - "Hopeless" now uses the engine's own odds.
  - The seat, the last objective and critical ground need a 0.75 take chance before they are given up.
  - The Republic's turn-1 withdrawals from Asturias and Andalucía, which happened in every game, are gone.
- **S3** counts withdrawals again.

100 seeds (`build/sim/ai-fixes-merged`):

| Blunders | Decided / freezes | Republic | North | South | S1 | S3 | Median length |
|---|---|---|---|---|---|---|---|
| with | 100% / 0% | 17% [11, 26] | 50% [40, 60] | 33% [25, 43] | 0 | 0 | 16 |
| without | 100% / 0% | 23% [16, 32] | 49% [39, 59] | 28% [20, 38] | 0 | 0 | 14 |

S1 and S3 are met. H7 is missed: with blunders, the shipped setting, the Republic wins 17 percent of decided games, against at least 20. Reported to the owner, not tuned.

**D31. Map-movement and combat-air fixes merged (`b781dcf`, `8ce36a8`).** These close every blocker and major from the map-movement and combat-air reviews:
- defenders retreat when they lose their last sub-territory;
- D27.1, through one `canFight` helper in `engine/units/fighting.ts`;
- withdrawals and retreats respect sea closure and ports;
- rail rides are intercepted;
- each sea connection names its ports (Q-CITY-7);
- the computer player recruits trucks;
- the artillery-alone rule covers every battle;
- fatigue 3 can no longer be cleared by a same-turn rally;
- raid cuts hit only the faction raided;
- aircraft never count as a staying army;
- D27.2 to D27.7.

A computer-player bug found during the merge is fixed too: `exposure` counted trucks as the last army on an objective, so Madrid was emptied in seed 1. Branch coverage in both areas is now at or above 90 percent.

100 seeds (`build/sim/m3r1-fix-combat-air-100`):

| Blunders | Decided / freezes | Republic | North | South | S1 | S3 | Median turns |
|---|---|---|---|---|---|---|---|
| with | 100% / 0% | 9% | 57% | 34% | 0 | 0 | 13 |
| without | 100% / 0% | 11% | 66% | 23% | 0 | 0 | 15 |

S1 and S3 are met. H7 is missed: the Republic is at 9 to 11 percent of decided games. Reported to the owner, not tuned.

**D32. All fix streams merged; the 1000-game reading; paused by the owner.**
- **Merged:** `m3r1-fix-ui` (`65e36c0`) and `m3r1-fix-economy-recruit` (`abb0a37`, plus a test fix in `15663d1`).
- **Unit tests:** all 1213 pass.
- **Branch coverage:** 92.32 percent, against the 93 percent gate in `vitest.config.ts`. `m3r1-coverage` was adding tests (3 commits on its branch, not merged) when the owner asked to pause.

**1000 seeds, 66 turns** (`build/sim/m3r1-final-1000`):

| Blunders | Decided / freezes | Republic | North | South | S1 early wins | S3 abandonments | Median turns |
|---|---|---|---|---|---|---|---|
| with | 100% / 0% | 9.6% [7.9, 11.6] | 64.8% [61.8, 67.7] | 25.6% [23.0, 28.4] | 3 (0.3%) | 2 | 12 |
| without | 100% / 0% | 10.3% [8.6, 12.3] | 64.5% [61.5, 67.4] | 25.2% [22.6, 28.0] | 1 (0.1%) | 1 | 12 |

- **H7:** the freeze target is met. The share target is missed: the Republic wins about 10 percent of decided games.
- **S1** is met.
- **S3** has 1 to 2 abandonments in 1000 games, against a target of 0.
- **Not yet done:** the baseline pass, `verify` with `CI=1`, the production smoke test, the timing tests on a quiet machine, the "Streams" summary and the rubric.
