import { describe, expect, it } from "vitest";
import { distribution, pairedDifference, quantile, round, wilson } from "../../sim/stats";

describe("harness statistics", () => {
  it("gives the Wilson interval, inside 0..1 even at the edges", () => {
    expect(wilson(5, 10)).toEqual({ high: 0.7634, low: 0.2366, value: 0.5 });
    expect(wilson(0, 10)).toEqual({ high: 0.2775, low: 0, value: 0 });
    expect(wilson(10, 10)).toEqual({ high: 1, low: 0.7225, value: 1 });
    expect(wilson(0, 0)).toBeNull();
  });

  it("accepts fractional successes for shared victories", () => {
    const interval = wilson(2.5, 10);
    expect(interval?.value).toBe(0.25);
    expect(interval?.low).toBeLessThan(0.25);
  });

  it("gives a paired difference with a normal interval", () => {
    expect(pairedDifference([])).toBeNull();
    expect(pairedDifference([1])).toEqual({ high: 1, low: 1, value: 1 });
    expect(pairedDifference([0, 0, 0])).toEqual({ high: 0, low: 0, value: 0 });
    const spread = pairedDifference([1, -1, 1, -1]);
    expect(spread?.value).toBe(0);
    expect(spread?.low).toBeCloseTo(-1.1316, 3);
    expect(spread?.high).toBeCloseTo(1.1316, 3);
  });

  it("interpolates quantiles and summarizes a distribution", () => {
    expect(quantile([], 0.5)).toBe(0);
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([7], 0.9)).toBe(7);
    expect(distribution([])).toBeNull();
    expect(distribution([3, 1, 2])).toEqual({ max: 3, mean: 2, median: 2, min: 1, p10: 1.2, p25: 1.5, p75: 2.5, p90: 2.8 });
    expect(round(1 / 3)).toBe(0.3333);
  });
});
