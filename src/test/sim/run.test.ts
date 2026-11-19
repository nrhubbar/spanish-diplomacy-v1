import { describe, expect, it } from "vitest";
import { fixtureSources } from "../fixtures/scenarios/fixtureSources";
import { loadScenario, scenarioSources } from "../../sim/engine";
import { playGame } from "../../sim/game";
import { PatchError } from "../../sim/patch";
import {
  baselineName,
  blunderControl,
  blunderPatch,
  buildSummary,
  cellId,
  cellsOf,
  defaultBlunderMode,
  orderLines,
  type RunPlan,
  runInProcess,
  seedRanges,
  tasksOf
} from "../../sim/run";
import { compare, stallQuietTurns, summarize } from "../../sim/summary";

const sources = [...scenarioSources(), fixtureSources];
const tinyPlan = (overrides: Partial<RunPlan> = {}): RunPlan => ({
  blunders: "with",
  scenarioId: "tiny-front",
  seeds: [1, 2, 3, 4, 5, 6],
  turnLimit: 30,
  variants: [],
  ...overrides
});

describe("harness core on the tiny-front fixture", () => {
  it("plays seeded games into complete game lines", () => {
    const scenario = loadScenario(sources, "tiny-front");
    const line = playGame({ blunders: true, scenario, turnLimit: 30, variant: baselineName }, 1);
    expect(line.seed).toBe(1);
    expect(line.variant).toBe(baselineName);
    expect(line.battlesByTurn).toHaveLength(line.turns);
    expect(Object.keys(line.losses).sort()).toEqual(["blue", "red"]);
    expect(Object.keys(line.firstTurnRoutes).sort()).toEqual(["blue", "red"]);
    expect(line.end === "decided").toBe(line.winners.length > 0);
    expect(line.end === "decided" ? line.victory : "none").toBeDefined();
    if (line.end === "freeze") expect(line.turns).toBe(30);
  });

  it("stops at the turn limit and calls a game still running a freeze", () => {
    const scenario = loadScenario(sources, "tiny-front");
    const line = playGame({ blunders: false, scenario, turnLimit: 1, variant: baselineName }, 3);
    expect(line.turns).toBe(1);
    expect(line.end).toBe(line.winners.length > 0 ? "decided" : "freeze");
  });

  it("summarizes every metric, and the same seeds give the same summary", () => {
    const first = runInProcess(sources, tinyPlan());
    const again = runInProcess(sources, tinyPlan());
    expect(again).toEqual(first);
    const metrics = first.summary.cells[0]?.metrics;
    if (metrics === undefined) throw new Error("no cell");
    expect(first.summary.cells.map((cell) => cell.id)).toEqual(["baseline/with-blunders"]);
    expect(metrics.games).toBe(6);
    expect(metrics.decided + metrics.freezes).toBe(6);
    expect(metrics.decided).toBeGreaterThan(0);
    const credited = Object.values(metrics.wins).reduce((sum, wins) => sum + wins.wins, 0);
    expect(credited).toBeCloseTo(metrics.decided, 3);
    expect(metrics.length.histogram.reduce((sum, bar) => sum + bar.games, 0)).toBe(metrics.decided);
    expect(metrics.length.histogram.at(-1)?.to).toBe(30);
    expect(metrics.battles.byTurn.length).toBeGreaterThan(0);
    expect(Object.values(metrics.battles.byColumn).reduce((sum, column) => sum + column.battles, 0)).toBe(metrics.battles.total);
    expect(metrics.firstTurn["red"]?.meanOrders).toBeGreaterThan(0);
    expect(metrics.sanity.abandonments).toBe(0);
    expect(metrics.stalled).toBe(first.lines.filter((line) => line.longestQuiet >= stallQuietTurns).length);
    expect(metrics.stalledRate?.value).toBeCloseTo(metrics.stalled / 6, 3);
    expect(first.summary.format).toBe("spanish-diplomacy-sim/1");
    expect(first.summary.seeds).toBe("1-6");
  });

  it("does not depend on the order games come back in", () => {
    const { lines } = runInProcess(sources, tinyPlan());
    const reversed = [...lines].reverse();
    expect(summarize(reversed, ["red", "blue"], 30)).toEqual(summarize(lines, ["red", "blue"], 30));
    expect(orderLines(tinyPlan(), reversed)).toEqual(lines);
    expect(buildSummary(tinyPlan(), ["red", "blue"], reversed)).toEqual(buildSummary(tinyPlan(), ["red", "blue"], lines));
  });

  it("plays variants and both blunder settings on the same seeds, and compares them", () => {
    const plan = tinyPlan({
      blunders: "both",
      seeds: [1, 2, 3],
      variants: [{ description: "No works", name: "no-works", patch: [{ op: "replace", path: "/combat/diggingIn/max", value: 1 }] }]
    });
    expect(cellsOf(plan).map((cell) => cell.id)).toEqual([
      "baseline/with-blunders", "baseline/without-blunders", "no-works/with-blunders", "no-works/without-blunders"
    ]);
    expect(tasksOf(plan)).toHaveLength(12);
    const { lines, summary } = runInProcess(sources, plan);
    expect(lines.map((line) => cellId(line.variant, line.blunders))).toEqual(cellsOf(plan).flatMap((cell) => [cell.id, cell.id, cell.id]));
    expect(summary.cells[2]?.variantDescription).toBe("No works");
    expect(summary.blunderControl).toBe("pending");
    expect(summary.comparisons.map((comparison) => `${comparison.subject} vs ${comparison.against}`)).toEqual([
      "no-works/with-blunders vs baseline/with-blunders",
      "no-works/without-blunders vs baseline/without-blunders",
      "baseline/with-blunders vs baseline/without-blunders",
      "no-works/with-blunders vs no-works/without-blunders"
    ]);
    // Blunders do not reach the computer player yet, so both settings play alike.
    const blunderComparison = summary.comparisons[2];
    expect(blunderComparison?.pairs).toBe(3);
    expect(blunderComparison?.freezeRate).toEqual({ high: 0, low: 0, value: 0 });
    expect(blunderComparison?.winShare["red"]).toEqual({ high: 0, low: 0, value: 0 });
  });

  it("leaves a seam for the blunder rate: pending plays without, a pointer turns blunders off by patch", () => {
    expect(blunderControl()).toBe("pending");
    expect(blunderControl("/ai/blunderRate")).toBe("scenario");
    expect(defaultBlunderMode("pending")).toBe("without");
    expect(defaultBlunderMode("scenario")).toBe("both");
    expect(blunderPatch(false)).toEqual([]);
    expect(blunderPatch(true, "/ai/blunderRate")).toEqual([]);
    expect(blunderPatch(false, "/ai/blunderRate")).toEqual([{ op: "replace", path: "/ai/blunderRate", value: 0 }]);
  });

  it("rejects a bad patch, a patched scenario that fails validation, and an unknown scenario", () => {
    const broken = (patch: RunPlan["variants"][number]["patch"]) => () =>
      runInProcess(sources, tinyPlan({ seeds: [1], variants: [{ name: "broken", patch }] }));
    expect(broken([{ op: "replace", path: "/combat/nothing", value: 1 }])).toThrow(PatchError);
    expect(broken([{ op: "replace", path: "/combat/diggingIn/max", value: "two" }])).toThrow(/Invalid package .*tiny-front/);
    expect(() => loadScenario(sources, "nowhere")).toThrow(/Unknown scenario/);
  });

  it("summarizes nothing without dividing by zero, and compares only shared seeds", () => {
    const empty = summarize([], ["red", "blue"], 12);
    expect(empty.decidedRate).toBeNull();
    expect(empty.wins["red"]).toEqual({ shareOfDecided: null, shareOfGames: null, wins: 0 });
    expect(empty.length).toEqual({ decided: null, histogram: [{ from: 1, games: 0, to: 6 }, { from: 7, games: 0, to: 12 }] });
    expect(empty.battles).toEqual({ byColumn: {}, byTurn: [], perTurn: 0, total: 0 });
    const { lines } = runInProcess(sources, tinyPlan({ seeds: [1, 2] }));
    const apart = compare("a", lines.slice(0, 1), "b", lines.slice(1), ["red"]);
    expect(apart.pairs).toBe(0);
    expect(apart.winShare["red"]).toBeNull();
  });

  it("writes seed lists compactly", () => {
    expect(seedRanges([])).toBe("");
    expect(seedRanges([5, 1, 2, 3, 9, 10, 2])).toBe("1-3,5,9-10");
    expect(seedRanges([7])).toBe("7");
  });
});
