import { describe, expect, it } from "vitest";
import { defaultScenarioId, scenarioSources } from "../../sim/engine";
import { earlyWinTurn } from "../../sim/game";
import { defaultTurnLimit, type RunPlan, runInProcess } from "../../sim/run";

// H2: the 10-game smoke run that replaced the 200-game soak in npm test. It plays the shipped
// scenario through the same harness core as `npm run sim`, and checks structure, determinism,
// S1 and S3 only. Balance (win shares, freeze and stall rates) is measured by `npm run sim`
// and reported, never asserted here.
//
// The smoke run plays one cell, without blunders, to stay a 10-game run: the default (both
// settings, H6) would double it. Blunders reach the game through scenario data, which the
// tiny-front harness tests and the determinism check below cover.
describe("harness smoke run on the shipped scenario", () => {
  const sources = scenarioSources();
  const plan: RunPlan = {
    blunders: "without",
    scenarioId: defaultScenarioId(sources),
    seeds: Array.from({ length: 10 }, (_, index) => index + 1),
    turnLimit: defaultTurnLimit,
    variants: []
  };
  const run = runInProcess(sources, plan);
  const cell = run.summary.cells[0];

  it("writes one line per game and one summary cell with every metric", () => {
    expect(run.lines).toHaveLength(10);
    expect(run.summary.cells).toHaveLength(1);
    expect(run.summary.games).toBe(10);
    expect(run.summary.turnLimit).toBe(66);
    const metrics = cell?.metrics;
    expect(metrics?.decided === undefined ? undefined : metrics.decided + metrics.freezes).toBe(10);
    expect(Object.keys(metrics?.wins ?? {}).sort()).toEqual([...run.summary.factions].sort());
    expect(Object.keys(metrics?.losses ?? {}).sort()).toEqual([...run.summary.factions].sort());
    expect(Object.keys(metrics?.firstTurn ?? {}).sort()).toEqual([...run.summary.factions].sort());
    expect(metrics?.battles.total).toBeGreaterThan(0);
    for (const line of run.lines) {
      expect(line.battlesByTurn).toHaveLength(line.turns);
      expect(line.turns).toBeLessThanOrEqual(66);
      expect(line.end === "decided").toBe(line.winners.length > 0);
      expect(Object.values(line.firstTurnRoutes).flat().length).toBeGreaterThan(0);
    }
  });

  it("gives the same lines and summary for the same seeds", () => {
    // Determinism, on a short plan so it does not replay the whole smoke run: a few seeds over
    // the first turns, with blunders on so their seeded stream is replayed too. Per-turn cost
    // grows with the turn number, so the cut is in turns.
    const short: RunPlan = { ...plan, blunders: "with", seeds: [1, 2, 3], turnLimit: 8 };
    const first = runInProcess(sources, short);
    expect(first.lines).toHaveLength(3);
    expect(runInProcess(sources, short)).toEqual(first);
  });

  it("never abandons every objective without losing a unit or being driven out (S3)", () => {
    // S3 must have been tested at all: factions held objectives on some turns.
    expect(cell?.metrics.sanity.objectiveChecks).toBeGreaterThan(0);
    expect(cell?.metrics.sanity.abandonments).toBe(0);
  });

  it("wins at most 5 percent of games before turn 4 (S1)", () => {
    expect(earlyWinTurn).toBe(4);
    expect((cell?.metrics.sanity.earlyWins ?? 1) / 10).toBeLessThanOrEqual(0.05);
  });
});
