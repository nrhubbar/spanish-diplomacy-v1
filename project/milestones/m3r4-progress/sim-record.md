# sim-record

What each simulated game records (`--record inventory`), for the owner's economy tuning. Spec and columns: `project/specs/sim-harness.md`, "Recording".

## Built
- `src/sim/inventory.ts`: the record, read from the state at the end of each turn (stocks) and from the turn's orders and outcomes (flows). Turn 0 is the opening board.
- `src/sim/timings.ts`: `timings.jsonl`, per game and for the run, with a note on contention. Never in the deterministic lines.
- `src/sim/report.ts`: `report.json` and seven CSVs, built from what the run wrote; `--report DIR` builds them again without playing.
- `--record` and `--report` in `args.ts`. A default run writes the same bytes as before (`defaultOutput.test.ts` against files written before the change, in `src/test/sim/golden/`).

## Decisions
- "Ordered" counts orders given, "refused" those the reveal did not accept. In the 10-game run none were refused.
- "Under way" is the engine's "in progress" (a turn of progress or more); a queue head that has not started counts as waiting.
- Income and upkeep come from the turn's outcomes. `incomeFor` on the end-of-turn state is before raid cuts, and `upkeepLines` on it is next turn's bill. Tests check the recorded figures against the engine's own functions.
- An upgraded building (paved airfield) counts as its own building and the one it upgraded, as the state lists both.

## Checks
- One 10-game run (seeds 1-10, 9 workers, 10 cores): 5.0 s in all, 25.1 s of games, 2.3 s a game (median), 4.9 s at most, about 120 to 180 ms a turn. `games.jsonl` 227 KB, `report.json` 240 KB, CSVs 190 KB. 10 of 10 decided, median 19 turns, no freezes, no early wins.
- On those 10 games, every turn's training and unit changes fit the orders accepted (no type lost or double-counted).
- 200 games would be about 4.5 MB of `games.jsonl`.

## Not done
- The 200-game run is the coordinator's.
- Nothing measured with other work stopped: the machine was loaded (load average 8.6 at the start).
