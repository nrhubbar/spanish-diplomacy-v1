// The harness's console and comparison edges: empty intervals, negative differences, mixed game ends.
import { describe, expect, it } from "vitest";
import { fixtureSources } from "../fixtures/scenarios/fixtureSources";
import { readVariants } from "../../sim/main";
import { formatSummary } from "../../sim/output";
import { runInProcess } from "../../sim/run";
import { compare } from "../../sim/summary";

const { lines, summary } = runInProcess([fixtureSources], { scenarioId: "tiny-front", seeds: [1, 2], turnLimit: 6, variants: [{ name: "same", patch: [] }] });

describe("sim edges", () => {
  it("writes n/a for empty intervals, signs negative differences, and leaves out an unknown median", () => {
    const cell = summary.cells[0]!;
    const comparison = summary.comparisons[0]!;
    const text = formatSummary({
      ...summary,
      cells: [{ ...cell, metrics: { ...cell.metrics, decidedRate: null, length: { ...cell.metrics.length, decided: null }, wins: {} } }],
      comparisons: [{ ...comparison, freezeRate: null, turns: { high: -0.5, low: -2, value: -1 }, winShare: {} }],
      factions: ["red"]
    }, "out");
    expect(text).toContain("decided n/a");
    expect(text).not.toContain("median length");
    expect(text).toContain("red n/a");
    expect(text).toContain("freezes n/a pts");
    expect(text).toContain("turns -1.00 [-2.00, -0.50]");
  });

  it("compares decided, frozen and stalled games seed by seed", () => {
    const [first, second] = lines;
    const subject = [{ ...first!, end: "decided" as const, longestQuiet: 9, seed: 1 }, { ...second!, end: "freeze" as const, longestQuiet: 0, seed: 2 }];
    const against = [{ ...first!, end: "freeze" as const, longestQuiet: 0, seed: 1 }, { ...second!, end: "decided" as const, longestQuiet: 9, seed: 2 }];
    const result = compare("a", subject, "b", against, ["red"]);
    expect(result.pairs).toBe(2);
    expect(result.decidedRate?.value).toBe(0);
    expect(compare("a", subject, "b", [], ["red"]).pairs).toBe(0);
  });

  it("reports a variant file that throws something other than an error", () => {
    const read = (): string => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- the harness must report a thrown non-error too
      throw "unreadable";
    };
    expect(() => readVariants(["odd.json"], read)).toThrow("odd.json: unreadable");
  });
});
