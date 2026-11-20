import { describe, expect, it } from "vitest";
import { distribution, pairedDifference, quantile, round, t95, wilson } from "../../sim/stats";

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

  it("gives a paired difference with a Student-t interval, and none below two pairs", () => {
    expect(pairedDifference([])).toBeNull();
    expect(pairedDifference([1])).toBeNull();
    expect(pairedDifference([0, 0, 0])).toEqual({ high: 0, low: 0, value: 0 });
    // sd 1.1547 over sqrt(4), times t(3) = 3.1824.
    const spread = pairedDifference([1, -1, 1, -1]);
    expect(spread?.value).toBe(0);
    expect(spread?.low).toBeCloseTo(-1.8373, 3);
    expect(spread?.high).toBeCloseTo(1.8373, 3);
  });

  it("gives Student's t quantile, exact to 30 degrees of freedom and within 1e-4 beyond", () => {
    expect(t95(1)).toBe(12.7062);
    expect(t95(19)).toBe(2.093);
    expect(t95(30)).toBe(2.0423);
    for (const [df, exact] of [[31, 2.0395], [40, 2.0211], [60, 2.0003], [120, 1.9799], [1000, 1.9623]] as const) {
      expect(Math.abs(t95(df) - exact)).toBeLessThan(1e-4);
    }
    expect(() => t95(0)).toThrow(RangeError);
    expect(() => t95(2.5)).toThrow(RangeError);
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
