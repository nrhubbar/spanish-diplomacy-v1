import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { orderLines, type PlayedGame, type RunPlan } from "./run";

/** How long one game took. Never part of `games.jsonl`: it differs from run to run. */
export interface GameTiming {
  readonly kind: "game";
  readonly variant: string;
  readonly seed: number;
  readonly turns: number;
  /** Wall-clock time of this game on its worker thread, without loading the scenario. */
  readonly milliseconds: number;
  /** The worker thread that played it, 1 first. */
  readonly worker: number;
}

/** How long the whole run took: the last line of `timings.jsonl`. */
export interface RunTiming {
  readonly kind: "run";
  readonly games: number;
  readonly workers: number;
  readonly cores: number;
  /** Wall-clock time from starting the worker threads to the last game's end. */
  readonly totalMilliseconds: number;
  /** The games' own times added up, over every worker thread. */
  readonly gameMilliseconds: number;
  readonly note: string;
}

export type TimingLine = GameTiming | RunTiming;

/** Why a game's time is not what it would take alone; written with every run. */
export const contentionNote = "Worker threads play games at the same time and share the machine's cores, memory and anything else running on it, so a game's time includes waiting for them, and the first game of each worker runs before the code is warm. The times are for planning runs, not for comparing code.";

/** The run's timings, games in `games.jsonl` order and the run last. */
export function timingLines(plan: RunPlan, played: readonly PlayedGame[], run: Pick<RunTiming, "cores" | "totalMilliseconds" | "workers">): readonly TimingLine[] {
  const games = played.map(({ line, milliseconds, worker }): GameTiming => ({ kind: "game", variant: line.variant, seed: line.seed, turns: line.turns, milliseconds, worker }));
  return [
    ...orderLines(plan, games),
    {
      kind: "run",
      games: games.length,
      workers: run.workers,
      cores: run.cores,
      totalMilliseconds: run.totalMilliseconds,
      gameMilliseconds: games.reduce((sum, game) => sum + game.milliseconds, 0),
      note: contentionNote
    }
  ];
}

/** Writes `timings.jsonl` beside the run's other files. */
export function writeTimings(dir: string, timings: readonly TimingLine[]): void {
  writeFileSync(join(dir, "timings.jsonl"), timings.map((line) => `${JSON.stringify(line)}\n`).join(""));
}
