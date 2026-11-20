import { describe, expect, it } from "vitest";
import { fixtureSources } from "../fixtures/scenarios/fixtureSources";
import { faction } from "../support";
import { defaultScenarioId, holdsGround, loadScenario, objectivesOf, scenarioSources, territoryIdsOf, type TurnOutcome } from "../../sim/engine";
import { assertInTerritories, playGame, retreatedUnits } from "../../sim/game";
import { initialGameState } from "../../main/engine/resolution";
import { applyPatch, PatchError } from "../../sim/patch";
import {
  baselineName,
  blunderControl,
  blunderPatch,
  buildSummary,
  cellId,
  cellsOf,
  defaultBlunderMode,
  orderLines,
  prepare,
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

  it("reads losses, control and S3 from the board, and fails loudly where it cannot match a unit or objective", () => {
    const scenario = loadScenario(sources, "tiny-front");
    const line = playGame({ blunders: true, scenario, turnLimit: 30, variant: baselineName }, 2);
    // Tiny-front's objectives start in enemy hands, so S3 is checked only once one is taken.
    expect(line.objectiveChecks).toBeGreaterThanOrEqual(0);
    for (const losses of Object.values(line.losses)) expect(losses.men).toBeGreaterThanOrEqual(losses.units);
    const without = (territoryId: string) => ({
      ...scenario,
      index: { ...scenario.index, territories: new Map([...scenario.index.territories].filter(([id]) => id !== territoryId)) }
    });
    // A unit standing somewhere that is not a territory (for example a sub-territory id).
    const piece = { factionId: "red", strength: 100, territoryId: "westfold-north" };
    expect(() => { assertInTerritories([["red-guard", piece]], territoryIdsOf(scenario)); })
      .toThrow(/Unit "red-guard" stands in "westfold-north", which is not a territory/);
    expect(() => { assertInTerritories([["red-guard", { ...piece, territoryId: "westfold" }]], territoryIdsOf(scenario)); }).not.toThrow();
    // An objective that is not a territory.
    expect(() => objectivesOf(without("harbor"))).toThrow(/Faction "red" has objectives that are not territories: harbor/);
  });

  it("judges S3 on units that hold ground, and still counts withdrawals (D24)", () => {
    // Aircraft never hold ground (D17); ground units and generals do.
    const spain = loadScenario(sources, defaultScenarioId(scenarioSources()));
    const start = initialGameState(spain);
    expect(holdsGround(spain, start, "rep-catalan-recon")).toBe(false);
    expect(holdsGround(spain, start, "rep-wad-ras-1")).toBe(true);
    expect(holdsGround(spain, start, "rep-general-miaja")).toBe(true);
    // Retreats and retreating bounces are driven out; a Withdraw order (C1) is a choice (D24).
    const outcomes = [
      { kind: "battle", retreats: [{ from: "a", to: "b", unitId: "retreated" }] },
      { kind: "bounced-move", order: { unitId: "bounced" }, retreatedTo: "b" },
      { kind: "bounced-move", order: { unitId: "held" } },
      { kind: "withdrew", order: { unitId: "withdrawn" } },
      { kind: "aircraft-rebased", unitId: "rebased" }
    ] as unknown as readonly TurnOutcome[];
    expect([...retreatedUnits(outcomes)].sort()).toEqual(["bounced", "retreated"]);
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
    expect(summary.blunderControl).toBe("scenario");
    expect(summary.comparisons.map((comparison) => `${comparison.subject} vs ${comparison.against}`)).toEqual([
      "no-works/with-blunders vs baseline/with-blunders",
      "no-works/without-blunders vs baseline/without-blunders",
      "baseline/with-blunders vs baseline/without-blunders",
      "no-works/with-blunders vs no-works/without-blunders"
    ]);
    // Tiny-front states a blunder chance of 0, so with and without play alike there.
    const blunderComparison = summary.comparisons[2];
    expect(blunderComparison?.pairs).toBe(3);
    expect(blunderComparison?.freezeRate).toEqual({ high: 0, low: 0, value: 0 });
    expect(blunderComparison?.winShare["red"]).toEqual({ high: 0, low: 0, value: 0 });
  });

  it("leaves a seam for the blunder chance: pending plays without, a pointer turns blunders off by patch", () => {
    // Pending: no pointer, so no patch, and a run plays one setting.
    expect(blunderControl(undefined)).toBe("pending");
    expect(defaultBlunderMode("pending")).toBe("without");
    expect(blunderPatch(false, undefined)).toEqual([]);
    expect(blunderPatch(true, undefined)).toEqual([]);
    // Scenario: the chance is in scenario data (where the harness points now), so a run plays both.
    expect(blunderControl("/ai/blunderChance")).toBe("scenario");
    expect(defaultBlunderMode("scenario")).toBe("both");
    expect(defaultBlunderMode()).toBe("both");
    expect(blunderPatch(true, "/ai/blunderChance")).toEqual([]);
    const off = blunderPatch(false, "/ai/blunderChance");
    expect(off).toEqual([{ op: "add", path: "/ai/blunderChance", value: 0 }]);
    // `add` sets the chance whether or not the scenario states it.
    expect(applyPatch({ ai: { blunderChance: 0.01, profiles: {} } }, off)).toEqual({ ai: { blunderChance: 0, profiles: {} } });
    expect(applyPatch({ ai: { profiles: {} } }, off)).toEqual({ ai: { blunderChance: 0, profiles: {} } });
  });

  it("plays a stated blunder chance with blunders, and the chance 0 without", () => {
    // Present: a variant states a chance of 1, so every unit order blunders with blunders on;
    // the without-blunders cell patches it back to 0 and plays the planned orders.
    const plan = tinyPlan({
      blunders: "both",
      seeds: [1, 2],
      turnLimit: 3,
      variants: [{ name: "always", patch: [{ op: "replace", path: "/ai/blunderChance", value: 1 }] }]
    });
    const { lines } = runInProcess(sources, plan);
    const routes = (variant: string, blunders: boolean) =>
      lines.filter((line) => line.variant === variant && line.blunders === blunders).map((line) => line.firstTurnRoutes);
    expect(routes("always", false)).toEqual(routes(baselineName, false));
    expect(routes("always", true)).not.toEqual(routes("always", false));
    // Tiny-front's own chance is 0: with and without play the same orders.
    expect(routes(baselineName, true)).toEqual(routes(baselineName, false));
  });

  it("restores an absent blunder chance without blunders, and refuses it with them", () => {
    // Absent: the scenario must state the chance (the loader requires it). The without-blunders
    // patch adds it back, so that cell loads; the with-blunders cell has nothing to play.
    const absent = { name: "absent", patch: [{ op: "remove", path: "/ai/blunderChance" }] } as const;
    expect(prepare(sources, tinyPlan({ blunders: "without", seeds: [1], variants: [absent] }))).toEqual(["red", "blue"]);
    expect(() => prepare(sources, tinyPlan({ blunders: "with", seeds: [1], variants: [absent] }))).toThrow(/Invalid package .*tiny-front/);
  });

  it("collects factions across every cell, so a variant that adds one is reported", () => {
    const scenario = loadScenario(sources, "tiny-front");
    const red = scenario.factions.find((faction) => faction.id === "red");
    const plan = tinyPlan({
      seeds: [1],
      variants: [{
        name: "green",
        patch: [
          { op: "add", path: "/factions/-", value: { ...red, abbreviation: "GRN", color: "#2e8b57", id: "green", name: "Green" } },
          // L23: every faction needs a computer-player profile.
          { op: "add", path: "/ai/profiles/green", value: scenario.ai.profiles[faction("red")] },
          { op: "test", path: "/territories/3/id", value: "lowlands" },
          { op: "replace", path: "/territories/3/initialControl", value: { factionId: "green", kind: "controlled" } }
        ]
      }]
    });
    expect(prepare(sources, plan)).toEqual(["red", "blue", "green"]);
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
