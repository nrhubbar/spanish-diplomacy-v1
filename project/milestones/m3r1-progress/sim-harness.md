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
