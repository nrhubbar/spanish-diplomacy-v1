---
name: run-sim
description: Run the headless balance simulator (npm run sim) for a baseline or JSON-patch variants and summarise win rates. Only when the owner asks for sims; never add sims to a task on your own.
context: fork
disable-model-invocation: true
---

Run balance sims only when the owner has asked for them in this conversation.

1. Variants are JSON patches in `src/sim/variants/*.json` (see an existing one for the format). Write a new one there only if the request needs it.
2. Run from the checkout or worktree being tested:
   `npm run sim -- --games 400 --variant src/sim/variants/<name>.json --run <short-name>`
   `npm run sim -- --help` lists every option (seeds, turn limit, workers, output folder).
3. Results land under the output folder printed at the end (default under `build/`). Read the summary file, not every game log.
4. Report a small table: per faction win rate for the baseline and each variant, games, median game length, and early wins. Say when a difference is within noise (at 400 games, about ±3 points for a 10–15% rate).
