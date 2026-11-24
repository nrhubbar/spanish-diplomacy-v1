import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createTimedRunner, type PlayedGame, type RunPlan } from "../../sim/run";
import { contentionNote, timingLines, writeTimings } from "../../sim/timings";
import { clearTempOut, cliSources, stepClock, tempOut } from "./cliFixture";

afterEach(clearTempOut);

const plan: RunPlan = { scenarioId: "tiny-front", seeds: [1, 2], turnLimit: 3, variants: [{ name: "other", patch: [] }] };
const game = (variant: string, seed: number, milliseconds: number, worker: number): PlayedGame => ({ line: { seed, turns: seed + 1, variant } as PlayedGame["line"], milliseconds, worker });

describe("timings", () => {
  it("times each game by the clock, apart from its line, loading the scenario outside the time", () => {
    const run = createTimedRunner(cliSources, plan, stepClock(12.4));
    const first = run({ cell: 0, seed: 1 });
    expect(first.milliseconds).toBe(12);
    expect(JSON.stringify(first.line)).not.toContain("milliseconds");
  });

  it("lists games in games.jsonl order, then the run with its workers and why times are long", () => {
    const lines = timingLines(plan, [game("other", 1, 30, 2), game("baseline", 2, 20, 1), game("baseline", 1, 10, 2)], { cores: 8, totalMilliseconds: 45, workers: 2 });
    expect(lines).toEqual([
      { kind: "game", variant: "baseline", seed: 1, turns: 2, milliseconds: 10, worker: 2 },
      { kind: "game", variant: "baseline", seed: 2, turns: 3, milliseconds: 20, worker: 1 },
      { kind: "game", variant: "other", seed: 1, turns: 2, milliseconds: 30, worker: 2 },
      { kind: "run", games: 3, workers: 2, cores: 8, totalMilliseconds: 45, gameMilliseconds: 60, note: contentionNote }
    ]);
    const dir = join(tempOut(), "t");
    mkdirSync(dir);
    writeTimings(dir, lines);
    expect(readFileSync(join(dir, "timings.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line) as unknown)).toEqual(lines);
  });
});
