import { describe, expect, it } from "vitest";
import { defaultGames, defaultOutDir, parseArgs, parseSeeds, usage, UsageError } from "../../sim/args";
import { defaultTurnLimit } from "../../sim/run";

describe("sim arguments", () => {
  it("defaults to 200 games from seed 1 and 66 turns, leaving the scenario to the run", () => {
    const options = parseArgs([]);
    expect(options).toEqual({
      help: false,
      outDir: defaultOutDir,
      seeds: Array.from({ length: defaultGames }, (_, index) => index + 1),
      turnLimit: defaultTurnLimit,
      variantFiles: []
    });
    expect(defaultTurnLimit).toBe(66);
  });

  it("reads every option, in either --flag value or --flag=value form", () => {
    const options = parseArgs([
      "--games", "3", "--first-seed=10", "--turns", "12", "--variant", "a.json", "--variant=b.json",
      "--scenario", "tiny-front", "--workers", "2", "--run", "ab_1.x", "--out", "tmp/sim"
    ]);
    expect(options).toEqual({
      help: false,
      outDir: "tmp/sim",
      run: "ab_1.x",
      scenarioId: "tiny-front",
      seeds: [10, 11, 12],
      turnLimit: 12,
      variantFiles: ["a.json", "b.json"],
      workers: 2
    });
    expect(parseArgs(["--games", "9", "--seeds", "4-6,2"]).seeds).toEqual([4, 5, 6, 2]);
    expect(parseArgs(["-h"]).help).toBe(true);
    expect(parseArgs(["--help"]).help).toBe(true);
    expect(usage).toContain("--variant FILE");
  });

  it("rejects what it cannot read", () => {
    expect(() => parseArgs(["--games", "0"])).toThrow(UsageError);
    expect(() => parseArgs(["--games", "two"])).toThrow(/positive whole number/);
    expect(() => parseArgs(["--turns"])).toThrow(/needs a value/);
    expect(() => parseArgs(["--turns", "--games"])).toThrow(/needs a value/);
    expect(() => parseArgs(["--blunders", "with"])).toThrow(/Unknown option/);
    expect(() => parseArgs(new Array<string>(1))).toThrow(/Unknown option ""/);
    expect(() => parseArgs(["--run", "../up"])).toThrow(/--run/);
    expect(() => parseArgs(["--fast"])).toThrow(/Unknown option/);
  });

  it("parses seed lists", () => {
    expect(parseSeeds("1-3, 7")).toEqual([1, 2, 3, 7]);
    expect(() => parseSeeds("3-1")).toThrow(/backwards/);
    expect(() => parseSeeds("0")).toThrow(/not a seed/);
    expect(() => parseSeeds("1-3,2")).toThrow(/twice/);
  });
});
