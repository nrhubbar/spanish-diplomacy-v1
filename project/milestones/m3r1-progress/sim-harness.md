# `m3r1-sim-harness` progress

## CP1: harness core, CLI and metrics

**Done:**
- `npm run sim` (H1). `vite.sim.config.ts` bundles `src/sim/cli.ts` into one Node file, `build/sim-cli/sim.mjs`, which acts as both the CLI and its worker threads.
- `npm run sim:build` builds the bundle without running it.
- Options: `--games`, `--first-seed`, `--seeds`, `--turns` (default 66), `--variant FILE` (repeatable), `--blunders with|without|both`, `--scenario`, `--workers`, `--run`, `--out`.
- Outputs: `build/sim/<run>/summary.json` and `games.jsonl`, plus a short ASCII summary on the console.
- Metrics (H3), for each cell (one variant under one blunder setting):
  - win share per faction, of decided games and of all games, with Wilson 95 percent intervals;
  - decided and freeze rates, with intervals;
  - the game-length distribution and a 6-turn histogram;
  - battles in total, per turn, and by turn;
  - results by odds column;
  - men and units lost per faction;
  - turn-1 order counts and the top routes;
  - sanity: abandonments (S3), early wins (S1), and the longest quiet stretch.
- Comparisons: each variant against the baseline, and each blunder setting against the other. They are paired per seed, with 95 percent intervals on the win share, the freeze and decided rates, and the turns played.
- Variant patches (H4) are already in: an RFC 6902 subset (`add`, `remove`, `replace`, `test`) applied to the raw `scenario.json`, then validated by the real loader.

**Decisions:**
1. Games run through the app's submission coordinator (`advance`, `nextTurn`), which calls `resolveTurn` and the computer player. The per-faction seeds, the history the computer player reads, and the validation are the same as in a real game. A rule added there (blunders, H6) reaches the harness unchanged.
2. Only `src/sim/engine.ts` imports from `src/main/**`. Scenario packages come from `scenarioSources()`, which returns the app's `builtInSources`, so a moved scenario folder is followed without change. The default scenario id is the single constant `defaultScenarioId`, which becomes `spanish-civil-war-1936` at the contract merge.
3. A freeze is a game that reaches the turn limit with no winner. The soak's "five quiet turns" rule is now only a recorded metric (`longestQuiet`).
4. A shared victory credits each of its k winners 1/k, so win shares sum to the number of decided games.
5. `summary.json` is deterministic. It has no time stamp, games are sorted by seed, and it is the same for any worker count. A unit test compares 1 in-process worker with 4. With the built bundle, real threads (seeds 1-30 on 1 thread and on 9 threads) give byte-identical `summary.json` and `games.jsonl`. The time stamp appears only in the default run folder name.
6. Map art is stubbed in the sim bundle, because the loader checks only that asset paths exist (L11).
7. `--blunders` defaults to `both`, so every report carries both settings (H6). `summary.blunderControl` is `"pending"` until the blunder chance exists in scenario data. Until then both settings play alike, and the console says so.
8. Tests live in `src/sim/test/`. `src/sim/**` is added to the coverage include, with `cli.ts` (the thread glue) and the tests excluded.

**Checks:**
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npm test`: exit 0. 33 files and 514 tests; coverage 98.7 percent statements and 94.2 percent branches.
- `npm run sim -- --games 20 --run cp1-20`: 40 games (20 seeds by 2 blunder settings) on 9 threads, in under 1 s.
  - Baseline: 10 of 20 decided, 50 percent [29.9, 70.1]; freezes 50 percent; median length 14.5 turns.
  - Wins of decided games: Republic 50 percent, Northern command 40, Southern command 10.
  - 0.46 battles per turn; no abandonments and no early wins.

**Missing APIs (for the integrator):**
- AI profile per faction (H4). The weights are code constants in `ai/computerPlayer.ts`, `ai/offensive.ts` and `ai/assessment.ts`, and `generateComputerSubmission` takes no profile, so a variant cannot change one yet. It can once E7 puts the profiles in `scenario.json` and the computer player reads them from the scenario. The patch path then works with no harness change. Open question: which stream wires the computer player to read them.
- Blunder chance (H6). The harness needs the chance's JSON Pointer in `scenario.json` from whichever stream adds it. "Without blunders" then sets that pointer to 0 in `cellScenario` (`src/sim/run.ts`), and `blunderControl` becomes `"scenario"`.

**Outside my ownership:** `vitest.config.ts`, one line: `src/sim/**` is added to the coverage include.

**Note:** variants (CP2 scope) are already built and tested on tiny-front, but have not yet been run against Spain through the bundled CLI.

**Next (CP2):**
- Replace the 200-game soak with a 10-game smoke run through `runInProcess`.
- Write `project/specs/sim-harness.md`.
- Report the missing AI-profile API: the weights are code constants (E7).

## CP2: smoke run, stall measure, blunder seam, docs

**Done:**
- H2: `npm test` now runs a 10-game smoke run, `src/test/sim/smoke.test.ts`. It plays the shipped scenario for 66 turns through `runInProcess`, the core that `npm run sim` uses.
  - It checks structure, determinism (same seeds, same summary), S1 (at most 5 percent early wins) and S3 (no abandonments).
  - It has no freeze or win bands.
  - `src/test/soak.test.ts` and `soakRun.ts` are deleted.
  - The harness unit tests moved from `src/sim/test/` to `src/test/sim/`, following coding-principles.
- No scenario ids in code. `defaultScenarioId(sources)` picks the only playable package in `builtInSources`; with none or several, `--scenario` is required and the error lists the ids.
- The stall measure: `stalled` and `stalledRate` (5 or more quiet turns in a row, Revision 7's S2) appear beside `freezes` and `freezeRate` (no winner by the turn limit). Both are in each cell's metrics, the comparisons and the console.
- The blunder seam (H6): `blunderRatePointer` in `src/sim/engine.ts`, expected at `/ai/blunderRate`.
  - While it is undefined, `blunderControl` is `"pending"` and `--blunders` defaults to `without`.
  - Once it is set, `blunderControl` is `"scenario"`, `--blunders` defaults to `both`, and a cell without blunders gets a `replace` of the rate with 0 after the variant's patch.
- `project/specs/sim-harness.md`: running the harness, its outputs, the patch format, the metrics, the two stall measures, comparisons, the blunder seam and the expected AI-profile pointer (`/ai/profiles/<factionId>`).
- An example variant: `src/sim/variants/digging-in-cap-2.json`.

**Decisions (continuing CP1's numbering):**
9. Decision 7 is superseded: while blunders are pending, the default is `without` (supervisor). A run that asks for `both` still plays both, and the console says the two play alike.
10. Decision 8 is superseded: the tests live in `src/test/sim/`.
11. "Stalled" counts any game with a quiet stretch of 5 turns or more, decided or not. It is computed from each game's `longestQuiet`. The declog records which measure H7 uses.
12. The profiles (E7) and the blunder rate belong to `m3r1-contract`; the integrator wires both. Today a patch to `/ai/...` fails validation ("Unrecognized key: ai"), which is reported before any game is played.

**Checks:**
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npm test`: exit 0. 33 files and 514 tests; coverage 98.8 percent statements and 94.4 percent branches.
- ASCII check on every file I own: clean.
- Real threads: seeds 1-30 with the variant, on 1 thread and on 9 threads, give byte-identical `summary.json` and `games.jsonl`.
- `npm run sim -- --games 20 --variant src/sim/variants/digging-in-cap-2.json --run cp2-20`: 40 games, without blunders.
  - Baseline: decided 50 percent [29.9, 70.1]; freezes 50 percent; stalled 60 percent; median length 14.5.
  - Baseline wins of decided games: Republic 50, Northern command 40, Southern command 10.
  - With a works cap of 2: decided 75 percent; freezes 25; stalled 35.
  - Paired difference: freezes -25.0 points [-53.0, +3.0], stalled -25.0 [-49.1, -0.9], Republic win share +20.0 [+2.0, +38.0].
- `node build/sim-cli/sim.mjs --games 200`: 1.3 s.
  - Decided 55.5 percent; freezes 44.5 percent [37.8, 51.4]; stalled 58.5 percent, against Revision 7's 58.
  - Wins of decided games: Republic 40.5, Northern command 47.8, Southern command 11.7.
  - No abandonments and no early wins.

**Outside my ownership:**
- `vitest.config.ts`: the coverage include (CP1), the exclude that drops `src/sim/test/**`, and the `testTimeout` comment.
- `src/test/setup.ts`: one comment that mentioned the soak.
