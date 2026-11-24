import { loadScenario, type PackageSources, type Scenario } from "./engine";
import { type GameLine, playGame, type RecordKind } from "./game";
import { applyPatch, type PatchOperation } from "./patch";
import { type Comparison, compare, type RunMetrics, summarize } from "./summary";

/** The harness's default turn limit (tasks 3.3): a game still running after it is a freeze. */
export const defaultTurnLimit = 66;
export const baselineName = "baseline";

/** A named patch over the scenario document (H4). The baseline's patch is empty. Plain data, so it crosses to worker threads. */
export interface Variant {
  readonly description?: string;
  readonly name: string;
  readonly patch: readonly PatchOperation[];
}

/** Everything a run is asked to do. */
export interface RunPlan {
  /** What each game records beyond its outcome; absent, nothing more. */
  readonly record?: RecordKind;
  readonly scenarioId: string;
  readonly seeds: readonly number[];
  readonly turnLimit: number;
  /** Variants played beside the baseline, on the same seeds. */
  readonly variants: readonly Variant[];
}

/** One variant; every cell plays every seed. The cell id is the variant's name. */
export interface Cell {
  readonly id: string;
  readonly variant: Variant;
}

export interface GameTask {
  readonly cell: number;
  readonly seed: number;
}

export function cellsOf(plan: RunPlan): readonly Cell[] {
  const variants: readonly Variant[] = [{ name: baselineName, patch: [] }, ...plan.variants];
  return variants.map((variant) => ({ id: variant.name, variant }));
}

/** Games in cell order, seeds ascending within each cell. */
export function tasksOf(plan: RunPlan): readonly GameTask[] {
  return cellsOf(plan).flatMap((_, cell) => plan.seeds.map((seed) => ({ cell, seed })));
}

/** Builds a cell's scenario: the variant's patch over the package. */
export function cellScenario(sources: readonly PackageSources[], plan: RunPlan, cell: Cell): Scenario {
  const patch = cell.variant.patch;
  return loadScenario(sources, plan.scenarioId, patch.length === 0 ? undefined : (document) => applyPatch(document, patch));
}

/** A game as a worker thread posts it back: its line, and what is never part of the line. */
export interface PlayedGame {
  readonly line: GameLine;
  /** Wall-clock time to play it, without loading the scenario. */
  readonly milliseconds: number;
  /** The worker thread that played it, 1 first. */
  readonly worker: number;
}

/** Plays tasks and times them, loading each cell's scenario once, outside the time. */
export function createTimedRunner(sources: readonly PackageSources[], plan: RunPlan, clock: () => number): (task: GameTask) => Omit<PlayedGame, "worker"> {
  const cells = cellsOf(plan);
  const scenarios = new Map<number, Scenario>();
  return (task) => {
    const cell = cells[task.cell];
    if (cell === undefined) throw new Error(`Unknown cell ${task.cell}.`);
    let scenario = scenarios.get(task.cell);
    if (scenario === undefined) {
      scenario = cellScenario(sources, plan, cell);
      scenarios.set(task.cell, scenario);
    }
    const began = clock();
    const line = playGame({ scenario, turnLimit: plan.turnLimit, variant: cell.variant.name, ...(plan.record === undefined ? {} : { record: plan.record }) }, task.seed);
    return { line, milliseconds: Math.round(clock() - began) };
  };
}

/** Plays tasks without timing them: the smoke test's path. */
export function createTaskRunner(sources: readonly PackageSources[], plan: RunPlan): (task: GameTask) => GameLine {
  const run = createTimedRunner(sources, plan, () => 0);
  return (task) => run(task).line;
}

/** Writes seed lists compactly: `1-200`, or `1-5,9`. */
export function seedRanges(seeds: readonly number[]): string {
  const sorted = [...new Set(seeds)].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let previous = start;
  for (const seed of [...sorted.slice(1), undefined]) {
    if (seed !== undefined && previous !== undefined && seed === previous + 1) {
      previous = seed;
      continue;
    }
    if (start !== undefined && previous !== undefined) ranges.push(start === previous ? `${start}` : `${start}-${previous}`);
    start = seed;
    previous = seed;
  }
  return ranges.join(",");
}

export interface CellSummary {
  readonly id: string;
  readonly metrics: RunMetrics;
  readonly variant: string;
  readonly variantDescription?: string;
}

/** `summary.json`. Deterministic: the same plan and seeds always give the same bytes. */
export interface Summary {
  readonly cells: readonly CellSummary[];
  /** Every variant against the baseline. */
  readonly comparisons: readonly Comparison[];
  readonly factions: readonly string[];
  readonly format: "spanish-diplomacy-sim/1";
  readonly games: number;
  readonly scenarioId: string;
  readonly seeds: string;
  readonly turnLimit: number;
}

export function buildSummary(plan: RunPlan, factionIds: readonly string[], lines: readonly GameLine[]): Summary {
  const cells = cellsOf(plan);
  const linesOf = (cell: Cell) => lines.filter((line) => line.variant === cell.variant.name);
  const comparisons: Comparison[] = [];
  for (const cell of cells) {
    if (cell.variant.name !== baselineName) {
      const base = cells.find((other) => other.variant.name === baselineName);
      if (base !== undefined) comparisons.push(compare(cell.id, linesOf(cell), base.id, linesOf(base), factionIds));
    }
  }
  return {
    cells: cells.map((cell) => ({
      id: cell.id,
      metrics: summarize(linesOf(cell), factionIds, plan.turnLimit),
      variant: cell.variant.name,
      ...(cell.variant.description === undefined ? {} : { variantDescription: cell.variant.description })
    })),
    comparisons,
    factions: factionIds,
    format: "spanish-diplomacy-sim/1",
    games: lines.length,
    scenarioId: plan.scenarioId,
    seeds: seedRanges(plan.seeds),
    turnLimit: plan.turnLimit
  };
}

/** Sorts game lines (or anything else there is one of per game) into `games.jsonl` order: cell order, then seed. */
export function orderLines<Line extends Pick<GameLine, "seed" | "variant">>(plan: RunPlan, lines: readonly Line[]): readonly Line[] {
  const order = new Map(cellsOf(plan).map((cell, index) => [cell.id, index]));
  const rank = (line: Line) => order.get(line.variant) ?? order.size;
  return [...lines].sort((a, b) => rank(a) - rank(b) || a.seed - b.seed);
}

export interface RunResult {
  readonly lines: readonly GameLine[];
  readonly summary: Summary;
}

/**
 * Validates every cell's scenario up front, before any game is played, and returns every
 * faction id across all cells (a variant may add one), in order of first appearance.
 */
export function prepare(sources: readonly PackageSources[], plan: RunPlan): readonly string[] {
  const scenarios = cellsOf(plan).map((cell) => cellScenario(sources, plan, cell));
  return [...new Set(scenarios.flatMap((scenario) => scenario.factions.map((faction) => faction.id as string)))];
}

/** Runs a whole plan on this thread: the smoke test's path, and the core every worker shares. */
export function runInProcess(sources: readonly PackageSources[], plan: RunPlan): RunResult {
  const factionIds = prepare(sources, plan);
  const run = createTaskRunner(sources, plan);
  const lines = orderLines(plan, tasksOf(plan).map(run));
  return { lines, summary: buildSummary(plan, factionIds, lines) };
}
