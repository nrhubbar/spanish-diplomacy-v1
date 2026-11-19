/** The normal quantile for a two-sided 95 percent interval. */
export const z95 = 1.959964;

/** A share with its 95 percent interval. */
export interface Interval {
  readonly high: number;
  readonly low: number;
  readonly value: number;
}

/** Rounds to four decimal places, so summaries stay readable and compare exactly. */
export function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * The Wilson score interval for `successes` out of `trials`. It stays inside 0..1 and is
 * honest at 0 and at small samples, where the normal approximation is not. `successes` may
 * be fractional (a shared victory credits each winner a part). Null when there are no trials.
 */
export function wilson(successes: number, trials: number): Interval | null {
  if (trials <= 0) return null;
  const p = successes / trials;
  const z2 = z95 * z95;
  const denominator = 1 + z2 / trials;
  const centre = (p + z2 / (2 * trials)) / denominator;
  const half = (z95 * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials))) / denominator;
  return { high: round(Math.min(1, centre + half)), low: round(Math.max(0, centre - half)), value: round(p) };
}

/**
 * The mean of paired differences (variant minus baseline, one per seed) with a 95 percent
 * normal interval. Pairing on seeds removes the seed-to-seed spread both runs share. Null when
 * there are no pairs.
 */
export function pairedDifference(differences: readonly number[]): Interval | null {
  const count = differences.length;
  if (count === 0) return null;
  const mean = differences.reduce((sum, value) => sum + value, 0) / count;
  const variance = count < 2 ? 0 : differences.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (count - 1);
  const half = z95 * Math.sqrt(variance / count);
  return { high: round(mean + half), low: round(mean - half), value: round(mean) };
}

/** Linear-interpolated quantile of an ascending list; `q` from 0 to 1. */
export function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  const position = (sorted.length - 1) * q;
  const below = Math.floor(position);
  const lower = sorted[below] ?? 0;
  const upper = sorted[Math.min(below + 1, sorted.length - 1)] ?? lower;
  return round(lower + (upper - lower) * (position - below));
}

/** Five-number summary plus the mean and the outer deciles. */
export interface Distribution {
  readonly max: number;
  readonly mean: number;
  readonly median: number;
  readonly min: number;
  readonly p10: number;
  readonly p25: number;
  readonly p75: number;
  readonly p90: number;
}

export function distribution(values: readonly number[]): Distribution | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return {
    max: sorted.at(-1) ?? 0,
    mean: round(sorted.reduce((sum, value) => sum + value, 0) / sorted.length),
    median: quantile(sorted, 0.5),
    min: sorted[0] ?? 0,
    p10: quantile(sorted, 0.1),
    p25: quantile(sorted, 0.25),
    p75: quantile(sorted, 0.75),
    p90: quantile(sorted, 0.9)
  };
}
